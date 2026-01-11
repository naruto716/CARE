import { BrowserWindow, nativeImage } from 'electron';
import { randomUUID } from 'crypto';
import { DatabaseService } from './database';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { spawnPythonSubprocess, terminateSubprocess, setSubProcess } from './python';
import { uploadImageToS3, initS3Client } from './s3';
import { getAWSConfig } from './settings';

function getAppDataDir() {
    if (process.platform === 'win32') {
        let appDataPath = process.env.APPDATA || process.env.LOCALAPPDATA
        if (appDataPath) {
            return path.join(appDataPath, 'ml4sg-care')
        }
    }
    return path.join(os.homedir(), '.ml4sg-care')
}

export interface Job {
    id: string;
    type: 'import' | 'thumbnail' | 'detect' | 'reid';
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    message: string;
    payload: any;
    createdAt: number;
    completedAt?: number;
    error?: string;
}

export class JobManager {
    private static instance: JobManager;
    private queue: Job[] = [];
    private activeJobs: Map<string, Job> = new Map();
    private completedJobs: Job[] = [];
    private mainWindow: BrowserWindow | null = null;
    private maxConcurrent = 2;
    private processing = false;
    private maxHistory = 50;

    private constructor() { }

    static getInstance(): JobManager {
        if (!JobManager.instance) {
            JobManager.instance = new JobManager();
            JobManager.instance.loadPersistedJobs();
            JobManager.instance.cleanupOldJobs();
        }
        return JobManager.instance;
    }

    setMainWindow(window: BrowserWindow) {
        this.mainWindow = window;
    }

    addJob(type: Job['type'], payload: any): string {
        const job: Job = {
            id: randomUUID(),
            type,
            status: 'pending',
            progress: 0,
            message: 'Queued',
            payload,
            createdAt: Date.now()
        };
        this.queue.push(job);

        // Persist to database
        this.saveJobToDb(job);

        this.emitUpdate();
        this.processQueue();
        return job.id;
    }

    getJobs(): Job[] {
        return [
            ...Array.from(this.activeJobs.values()),
            ...this.queue,
            ...this.completedJobs
        ].sort((a, b) => b.createdAt - a.createdAt);
    }

    cancelJob(id: string) {
        const queuedIndex = this.queue.findIndex(j => j.id === id);
        if (queuedIndex !== -1) {
            const job = this.queue[queuedIndex];
            job.status = 'cancelled';
            job.completedAt = Date.now();
            this.queue.splice(queuedIndex, 1);
            this.addToHistory(job);
            this.emitUpdate();
            return;
        }

        if (this.activeJobs.has(id)) {
            const job = this.activeJobs.get(id);
            if (job) {
                job.status = 'cancelled';
                job.completedAt = Date.now();
                // Only terminate subprocess for jobs that spawn Python processes
                if (job.type === 'detect' || job.type === 'reid') {
                    terminateSubprocess();
                }
                this.activeJobs.delete(id);
                this.addToHistory(job);
                this.emitUpdate();
            }
        }
    }

    retryJob(id: string): string | null {
        // Find job in completed history
        const jobIndex = this.completedJobs.findIndex(j => j.id === id);
        if (jobIndex === -1) return null;

        const originalJob = this.completedJobs[jobIndex];

        // Allow retry for import, detect, and reid jobs that failed or were cancelled
        if (!['import', 'detect', 'reid'].includes(originalJob.type)) return null;
        if (!['failed', 'cancelled'].includes(originalJob.status)) return null;

        // Remove from history and from database
        this.completedJobs.splice(jobIndex, 1);
        DatabaseService.deleteJob(id);

        // Re-queue with same payload (which includes processedPaths for resume)
        const newJobId = this.addJob(originalJob.type, originalJob.payload);
        return newJobId;
    }

    private addToHistory(job: Job) {
        this.completedJobs.unshift(job);
        if (this.completedJobs.length > this.maxHistory) {
            this.completedJobs.pop();
        }
        // Update job status in database
        this.updateJobInDb(job);
    }

    private emitUpdate() {
        if (this.mainWindow) {
            this.mainWindow.webContents.send('job-update', this.getJobs());
        }
    }

    private async processQueue() {
        if (this.processing) return;
        this.processing = true;

        try {
            while (this.activeJobs.size < this.maxConcurrent && this.queue.length > 0) {
                const job = this.queue.shift();
                if (!job) break;

                this.activeJobs.set(job.id, job);
                // Do not await here to allow concurrency
                this.runJob(job);
            }
        } finally {
            this.processing = false;
        }
    }

    private async runJob(job: Job) {
        job.status = 'running';
        job.message = 'Starting...';
        this.emitUpdate();

        try {
            switch (job.type) {
                case 'import':
                    await this.handleImportJob(job);
                    break;
                case 'thumbnail':
                    await this.handleThumbnailJob(job);
                    break;
                case 'detect':
                    await this.handleDetectJob(job);
                    break;
                case 'reid':
                    await this.handleReidJob(job);
                    break;
                default:
                    throw new Error(`Unknown job type: ${job.type}`);
            }

            if ((job.status as string) !== 'cancelled') {
                job.status = 'completed';
                job.progress = 100;
                // Only set default message if none was set by handler
                if (job.message === 'Starting...' || !job.message) {
                    job.message = 'Completed';
                }
            }
        } catch (error) {
            console.error(`Job ${job.id} failed:`, error);
            if ((job.status as string) !== 'cancelled') {
                job.status = 'failed';
                job.error = error instanceof Error ? error.message : String(error);
            }
        } finally {
            // Only process if job is still in activeJobs (not already handled by cancelJob)
            if (this.activeJobs.has(job.id)) {
                job.completedAt = Date.now();
                this.activeJobs.delete(job.id);
                this.addToHistory(job);
                this.emitUpdate();
            }

            // Trigger next job
            this.processQueue();
        }
    }

    // --- Workers ---

    private async generateThumbnail(imageId: number, originalPath: string) {
        try {
            const thumbDir = path.join(process.cwd(), 'data', 'thumbnails');
            await fs.ensureDir(thumbDir);

            const thumbFilename = `${imageId}_thumb.jpg`;
            const thumbPath = path.join(thumbDir, thumbFilename);

            const image = nativeImage.createFromPath(originalPath);
            if (image.isEmpty()) {
                return;
            }

            const resized = image.resize({ height: 300 });
            const buffer = resized.toJPEG(80);

            await fs.writeFile(thumbPath, buffer);
            DatabaseService.updateImagePreview(imageId, thumbPath);
        } catch (error) {
            console.error('Thumbnail generation failed:', error);
        }
    }

    private async countFiles(filePaths: string[]): Promise<number> {
        let count = 0;
        const processDir = async (dir: string) => {
            try {
                const files = await fs.readdir(dir);
                for (const file of files) {
                    const fullPath = path.join(dir, file);
                    const stat = await fs.stat(fullPath).catch(() => null);
                    if (stat?.isDirectory()) await processDir(fullPath);
                    else if (stat?.isFile()) {
                        const ext = path.extname(file).toLowerCase();
                        // Skip macOS ._ files
                        if (!file.startsWith('._') && (ext === '.jpg' || ext === '.jpeg')) count++;
                    }
                }
            } catch (e) { console.warn('Count error:', e); }
        };

        for (const p of filePaths) {
            const stat = await fs.stat(p).catch(() => null);
            if (stat?.isDirectory()) await processDir(p);
            else if (stat?.isFile()) {
                const basename = path.basename(p);
                const ext = path.extname(p).toLowerCase();
                // Skip macOS ._ files
                if (!basename.startsWith('._') && (ext === '.jpg' || ext === '.jpeg')) count++;
            }
        }
        return count;
    }

    private async handleImportJob(job: Job) {
        const { filePaths, groupName, afterAction, species, processedPaths = [] } = job.payload;

        // Initialize S3 client with credentials from settings
        initS3Client(getAWSConfig());

        // Track imported image IDs for chained actions
        const importedImageIds: number[] = [];

        // Track processed paths for resume capability
        const processedSet = new Set<string>(processedPaths);
        const newlyProcessedPaths: string[] = [...processedPaths];

        // Set of existing target filenames for uniqueness checking
        const existingTargetFiles = new Set<string>();

        job.message = 'Scanning files...';
        this.emitUpdate();

        // Count total for progress
        const totalFiles = await this.countFiles(filePaths);

        // Create Group if needed (for flat file lists)
        let currentGroupId: number | null = job.payload.lastGroupId || null;

        // Pre-check: are we uploading a list of files directly?
        const filesOnly = [];
        for (const p of filePaths) {
            try {
                const stat = await fs.stat(p);
                if (stat.isFile()) filesOnly.push(p);
            } catch (e) {
                console.warn(`Failed to stat ${p}`, e);
            }
        }

        if (filesOnly.length > 0 && groupName && !currentGroupId) {
            currentGroupId = DatabaseService.createGroup(groupName);
            job.payload.lastGroupId = currentGroupId;
        }

        // Local storage directory for copied files
        const baseDataDir = process.cwd();
        const localImagesDir = path.join(baseDataDir, 'data', 'images');
        await fs.ensureDir(localImagesDir);

        // Recursive Process
        let processedCount = processedPaths.length;

        const processFile = async (filePath: string, groupId: number, targetGroupName: string) => {
            if ((job.status as string) === 'cancelled') return;

            // Skip if already processed (for resume)
            if (processedSet.has(filePath)) {
                return;
            }

            // Skip macOS resource fork files (._filename)
            const filename = path.basename(filePath);
            if (filename.startsWith('._')) {
                return;
            }

            const ext = path.extname(filePath).toLowerCase();
            if (ext === '.jpg' || ext === '.jpeg') {
                try {
                    // Check if file is on removable drive
                    const { isRemovableDrive } = await import('./utils/driveType');
                    const isRemovable = await isRemovableDrive(filePath);

                    let finalPath = filePath;

                    if (isRemovable) {
                        // Copy file to local storage with unique folder per import job
                        const sanitizedGroupName = targetGroupName.replace(/[<>:"/\\|?*]/g, '_').trim() || 'imported';
                        // Use job.id to create unique folder, preventing collisions between imports with same group name
                        const uniqueFolderName = `${sanitizedGroupName}_${job.id.slice(0, 8)}`;
                        const groupDir = path.join(localImagesDir, uniqueFolderName);
                        await fs.ensureDir(groupDir);

                        let targetPath = path.join(groupDir, path.basename(filePath));

                        // Handle filename collisions within the same import batch
                        if (existingTargetFiles.has(targetPath) || await fs.pathExists(targetPath)) {
                            const base = path.basename(filePath, ext);
                            let counter = 1;
                            while (existingTargetFiles.has(targetPath) || await fs.pathExists(targetPath)) {
                                targetPath = path.join(groupDir, `${base}_${counter}${ext}`);
                                counter++;
                            }
                        }
                        existingTargetFiles.add(targetPath);

                        // Copy file
                        await fs.copy(filePath, targetPath);
                        finalPath = targetPath;
                        console.log(`[Import] Copied from removable: ${filePath} -> ${targetPath}`);
                    }

                    // Upload to S3 cloud storage
                    let cloudUrl: string | undefined;
                    try {
                        cloudUrl = await uploadImageToS3(finalPath, targetGroupName);
                        console.log(`[Import] Uploaded to cloud: ${cloudUrl}`);
                    } catch (s3Error) {
                        console.warn(`[Import] S3 upload failed (continuing without cloud URL):`, s3Error);
                        // Continue without cloud_url - local storage still works
                    }

                    // Add to DB with final path and cloud URL
                    const imageId = DatabaseService.addImage(groupId, finalPath, undefined, cloudUrl);
                    importedImageIds.push(imageId);

                    // Generate Thumbnail
                    await this.generateThumbnail(imageId, finalPath);

                    // Track as processed
                    newlyProcessedPaths.push(filePath);
                    processedSet.add(filePath);

                } catch (e) {
                    console.error(`Error adding image ${filePath}:`, e);
                }
                processedCount++;
            }

            // Update Progress
            if (totalFiles > 0) {
                job.progress = Math.floor((processedCount / totalFiles) * 100);
            }

            // Throttle updates and persist progress periodically
            if (processedCount % 5 === 0) {
                job.message = `Importing ${processedCount}/${totalFiles}...`;
                job.payload.processedPaths = newlyProcessedPaths;
                this.updateJobInDb(job);
                this.emitUpdate();
            }
        };


        const processDir = async (dirPath: string) => {
            if ((job.status as string) === 'cancelled') return;

            try {
                const stat = await fs.stat(dirPath);
                if (!stat.isDirectory()) return;

                const folderName = path.basename(dirPath);
                const groupId = DatabaseService.createGroup(folderName);

                const files = await fs.readdir(dirPath);
                for (const file of files) {
                    if ((job.status as string) === 'cancelled') return;
                    const fullPath = path.join(dirPath, file);
                    try {
                        const fileStat = await fs.stat(fullPath);
                        if (fileStat.isDirectory()) {
                            await processDir(fullPath);
                        } else if (fileStat.isFile()) {
                            await processFile(fullPath, groupId, folderName);
                        }
                    } catch (e) {
                        console.warn(`Error processing file ${fullPath}:`, e);
                    }
                }
            } catch (e) {
                console.warn(`Error processing dir ${dirPath}:`, e);
            }
        };

        // Start processing
        for (const p of filePaths) {
            if ((job.status as string) === 'cancelled') break;
            try {
                const stat = await fs.stat(p);
                if (stat.isDirectory()) {
                    await processDir(p);
                } else if (currentGroupId !== null && stat.isFile()) {
                    await processFile(p, currentGroupId, groupName || 'imported');
                }
            } catch (e) {
                console.warn(`Error accessing path ${p}:`, e);
            }
        }

        job.message = `Imported ${processedCount} images.`;
        job.progress = 100;

        // Handle chained actions
        if (afterAction && importedImageIds.length > 0 && (job.status as string) !== 'cancelled') {
            if (afterAction === 'classify') {
                // Get paths for the imported images
                const images = DatabaseService.getImagesByIds(importedImageIds);
                const selectedPaths = images.map(img => img.original_path);

                job.message = `Imported ${processedCount} images. Starting classification...`;
                this.emitUpdate();

                // Queue a detect job with imageIds for caching
                this.addJob('detect', { selectedPaths, imageIds: importedImageIds });
            } else if (afterAction === 'reid' && species) {
                // Get paths for the imported images
                const images = DatabaseService.getImagesByIds(importedImageIds);
                const selectedPaths = images.map(img => img.original_path);

                job.message = `Imported ${processedCount} images. Starting classification...`;
                this.emitUpdate();

                // Queue a detect job that will chain to reid
                this.addJob('detect', {
                    selectedPaths,
                    chainToReid: true,
                    imageIds: importedImageIds,
                    species
                });
            }
        }
    }

    private async handleThumbnailJob(job: Job) {
        const { imageId, originalPath } = job.payload;
        await this.generateThumbnail(imageId, originalPath);
    }

    /**
     * Run detection inline (used by ReID job when images need detection first)
     * @param imageIdsToDetect - The actual image IDs from the database
     */
    private async runDetectionInline(job: Job, imageIdsToDetect: number[]) {
        const baseDataDir = process.cwd();
        const detectionJobDir = path.join(baseDataDir, 'data', 'detections', `reid_${job.id}`);
        const imageOutputDir = path.join(detectionJobDir, 'images');
        const jsonOutputDir = path.join(detectionJobDir, 'json');
        const manifestPath = path.join(baseDataDir, 'data', 'temp', `detection_manifest_reid_${job.id}.json`);

        try {
            terminateSubprocess();
            await fs.remove(manifestPath).catch(() => { });

            // Get images from database - this gives us the correct ID -> path mapping
            const images = DatabaseService.getImagesByIds(imageIdsToDetect);

            // Build path -> id mapping for later
            const pathToIdMap = new Map<string, number>();
            const absolutePaths: string[] = [];

            for (const img of images) {
                if (await fs.pathExists(img.original_path)) {
                    absolutePaths.push(img.original_path);
                    // Map by filename since that's what we'll have in JSON output
                    const filename = path.parse(img.original_path).name;
                    pathToIdMap.set(filename, img.id);
                }
            }

            if (absolutePaths.length === 0) {
                throw new Error('No valid images found for detection.');
            }

            // Write Manifest
            await fs.ensureDir(path.dirname(manifestPath));
            await fs.writeJson(manifestPath, { files: absolutePaths }, { spaces: 2 });

            // Ensure output directories exist
            await fs.ensureDir(imageOutputDir);
            await fs.ensureDir(jsonOutputDir);

            // Spawn Python
            const args = [
                'detection',
                manifestPath,
                imageOutputDir,
                jsonOutputDir,
                path.join(baseDataDir, 'logs')
            ];

            const ps = spawnPythonSubprocess(args);
            setSubProcess(ps);

            if (!ps || !ps.stdout) {
                throw new Error('Failed to spawn Python process for detection.');
            }

            // Wrap process in promise
            await new Promise<void>((resolve, reject) => {
                ps.stdout?.on('data', (data: Buffer) => {
                    const txt = data.toString();
                    console.log(`[ReID Detection ${job.id}] ${txt.trim()}`);

                    // Parse progress
                    const processMatch = txt.match(/PROCESS:\s*(\d+)\/(\d+)/);
                    if (processMatch) {
                        const current = parseInt(processMatch[1]);
                        const total = parseInt(processMatch[2]);
                        if (total > 0) {
                            // Use 0-50% for detection, 50-100% for ReID
                            job.progress = Math.floor((current / total) * 50);
                            job.message = `Classification: ${current}/${total}`;
                            this.emitUpdate();
                        }
                    } else if (txt.includes('Loading models')) {
                        job.message = 'Loading classification models...';
                        this.emitUpdate();
                    }
                });

                ps.on('close', (code) => {
                    setSubProcess(null);
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`Detection process exited with code ${code}`));
                    }
                });

                ps.on('error', (err) => {
                    reject(err);
                });
            });

            // Import detection results to Database using the ID mapping
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const batchName = `ReID Pre-Detection ${dateStr} ${timeStr}`;

            const batchId = DatabaseService.createDetectionBatch(batchName);

            // Read all JSON files in the output directory
            const jsonFiles = await fs.readdir(jsonOutputDir);
            for (const jsonFile of jsonFiles) {
                if (!jsonFile.endsWith('.json')) continue;

                const jsonPath = path.join(jsonOutputDir, jsonFile);
                const baseName = path.parse(jsonFile).name;
                const imageId = pathToIdMap.get(baseName);

                if (!imageId) {
                    console.warn(`[ReID Detection] No image ID found for ${baseName}`);
                    continue;
                }

                try {
                    const result = await fs.readJson(jsonPath);

                    if (result.boxes && Array.isArray(result.boxes)) {
                        for (const box of result.boxes) {
                            if (box.bbox && box.bbox.length === 4) {
                                DatabaseService.addDetection(
                                    batchId,
                                    imageId,
                                    box.label,
                                    box.pred_conf || 0,
                                    box.detection_conf || 0,
                                    box.bbox,
                                    box.source || 'unknown'
                                );
                            }
                        }
                    }
                } catch (e) {
                    console.error(`Failed to parse detection result for ${jsonFile}`, e);
                }
            }

            console.log(`[ReID Detection] Saved detections for ${jsonFiles.length} images to batch ${batchId}`);

        } finally {
            // Cleanup
            await fs.remove(manifestPath).catch(() => { });
        }
    }

    private async handleReidJob(job: Job) {
        const { imageIds, species } = job.payload;
        const baseDataDir = process.cwd();
        const tempDir = path.join(baseDataDir, 'temp', 'reid_v2');

        try {
            await fs.ensureDir(tempDir);

            job.message = 'Loading detections...';
            this.emitUpdate();

            // Get LATEST detections for selected images (only from most recent batch per image)
            // Detection is now handled separately before this job is queued

            // Debug: Also get ALL detections to compare
            const allDetectionsRaw = DatabaseService.getDetectionsForImages(imageIds);
            console.log(`[ReID Debug] imageIds: ${JSON.stringify(imageIds)}`);
            console.log(`[ReID Debug] ALL detections (any batch): ${allDetectionsRaw.length}`);

            const allDetections = DatabaseService.getLatestDetectionsForImages(imageIds);
            console.log(`[ReID Debug] allDetections count (latest batch only): ${allDetections.length}`);
            console.log(`[ReID Debug] allDetections labels: ${JSON.stringify(allDetections.map((d: any) => d.label))}`);

            // Step 4: Filter by species
            const speciesLower = species.toLowerCase();
            console.log(`[ReID Debug] Looking for species: "${speciesLower}"`);

            const matchingDetections = allDetections.filter(
                (det: any) => det.label?.toLowerCase() === speciesLower
            );

            console.log(`[ReID Debug] matchingDetections count: ${matchingDetections.length}`);

            if (matchingDetections.length === 0) {
                throw new Error(`No ${species} detections found in the selected images. Found ${allDetections.length} detections with labels: ${[...new Set(allDetections.map((d: any) => d.label))].join(', ')}`);
            }

            job.message = `Found ${matchingDetections.length} ${species} detections. Starting ReID...`;
            this.emitUpdate();

            // Step 4: Generate input JSON for Python
            const inputJsonPath = path.join(tempDir, `reid_input_${job.id}.json`);
            const outputJsonPath = path.join(tempDir, `reid_output_${job.id}.json`);

            const inputData = {
                db_path: DatabaseService.getDbPath(),
                species: species,
                detections: matchingDetections.map((det: any) => ({
                    detection_id: det.id,
                    image_id: det.image_id,
                    image_path: det.image_path,
                    bbox: [det.x1, det.y1, det.x2, det.y2]
                })),
                output_path: outputJsonPath
            };

            await fs.writeJson(inputJsonPath, inputData, { spaces: 2 });

            // Step 5: Run Python reid_v2
            const args = ['reid_v2', inputJsonPath];
            const ps = spawnPythonSubprocess(args);

            if (!ps) {
                throw new Error('Failed to start Python process');
            }

            setSubProcess(ps);

            job.message = 'Loading AI models...';
            this.emitUpdate();

            // Wait for completion
            await new Promise<void>((resolve, reject) => {
                ps.stdout?.on('data', (data: Buffer) => {
                    const txt = data.toString();
                    console.log(`[ReID Job ${job.id}] ${txt.trim()}`);

                    // Parse progress
                    const processMatch = txt.match(/PROCESS:\s*(\d+)\/(\d+)/);
                    if (processMatch) {
                        const current = parseInt(processMatch[1]);
                        const total = parseInt(processMatch[2]);
                        if (total > 0) {
                            job.progress = Math.floor((current / total) * 100);
                            job.message = `Processing: ${current}/${total}`;
                            this.emitUpdate();
                        }
                    } else if (txt.includes('Loading model')) {
                        job.message = 'Loading ReID models...';
                        job.progress = 5;
                        this.emitUpdate();
                    } else if (txt.includes('STATUS: PROCESSING')) {
                        job.message = 'Computing embeddings...';
                        this.emitUpdate();
                    }
                });

                ps.on('close', (code) => {
                    setSubProcess(null);
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`ReID process exited with code ${code}`));
                    }
                });

                ps.on('error', (err) => {
                    reject(err);
                });
            });

            // Step 6: Parse output and store in database
            if (!await fs.pathExists(outputJsonPath)) {
                throw new Error('ReID output file not found.');
            }

            const outputData = await fs.readJson(outputJsonPath);

            // Create ReID run
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const runName = `ReID ${species} ${dateStr} ${timeStr}`;
            const reidRunId = DatabaseService.createReidRun(runName, species);

            // Create individuals and members
            for (const individual of outputData.individuals) {
                const individualId = DatabaseService.createReidIndividual(reidRunId, individual.name);
                for (const detectionId of individual.detection_ids) {
                    DatabaseService.addReidMember(individualId, detectionId);
                }
            }

            job.message = `Identified ${outputData.individuals.length} individuals`;

            // Cleanup temp files
            await fs.remove(inputJsonPath).catch(() => { });
            await fs.remove(outputJsonPath).catch(() => { });

        } catch (error) {
            throw error;
        }
    }

    private async handleDetectJob(job: Job) {
        const { selectedPaths, chainToReid, imageIds, species } = job.payload;

        // Use project root for data to keep it local
        const baseDataDir = process.cwd();
        // Create unique, deterministic output paths based on job ID
        const detectionJobDir = path.join(baseDataDir, 'data', 'detections', job.id);
        const imageOutputDir = path.join(detectionJobDir, 'images');
        const jsonOutputDir = path.join(detectionJobDir, 'json');

        const manifestPath = path.join(baseDataDir, 'data', 'temp', `detection_manifest_${job.id}.json`);

        try {
            terminateSubprocess();
            await fs.remove(manifestPath).catch(() => { });

            // Build path-to-ID map from provided imageIds (if available)
            // This is the CORRECT way - use IDs that were passed in, not path lookup
            const imageIdMap: Record<string, number> = {};

            console.log(`[Detect Job] Received imageIds: ${imageIds?.length ?? 'undefined'}, paths: ${selectedPaths.length}`);

            if (imageIds && Array.isArray(imageIds) && imageIds.length === selectedPaths.length) {
                // We have matching imageIds from the caller - use them directly
                for (let i = 0; i < selectedPaths.length; i++) {
                    imageIdMap[selectedPaths[i]] = imageIds[i];
                }
                console.log(`[Detect Job] Built imageIdMap with ${Object.keys(imageIdMap).length} entries`);
            } else {
                console.log(`[Detect Job] No valid imageIds, caching disabled`);
            }

            // Validate paths
            const absolutePaths: string[] = [];
            for (const imagePath of selectedPaths) {
                if (await fs.pathExists(imagePath)) {
                    absolutePaths.push(imagePath);
                }
            }

            if (absolutePaths.length === 0) {
                throw new Error('No valid images found to process.');
            }

            // Write Manifest with cache info (only if we have valid imageIds)
            await fs.ensureDir(path.dirname(manifestPath));
            await fs.writeJson(manifestPath, {
                files: absolutePaths,
                db_path: Object.keys(imageIdMap).length > 0 ? DatabaseService.getDbPath() : undefined,
                image_id_map: Object.keys(imageIdMap).length > 0 ? imageIdMap : undefined
            }, { spaces: 2 });

            // Ensure output directories exist
            await fs.ensureDir(imageOutputDir);
            await fs.ensureDir(jsonOutputDir);

            // Spawn Python
            const args = [
                'detection',
                manifestPath,
                imageOutputDir,
                jsonOutputDir,
                path.join(baseDataDir, 'logs')
            ];

            const ps = spawnPythonSubprocess(args);
            setSubProcess(ps);

            if (!ps || !ps.stdout) {
                throw new Error('Failed to spawn Python process.');
            }

            job.message = 'Initializing AI models...';
            this.emitUpdate();

            // Wrap process in promise
            await new Promise<void>((resolve, reject) => {
                ps.stdout?.on('data', (data: Buffer) => {
                    const txt = data.toString();
                    console.log(`[Job ${job.id}] ${txt.trim()}`);

                    // Parse progress
                    // Example: [1] PROCESS: 8/61
                    const processMatch = txt.match(/PROCESS:\s*(\d+)\/(\d+)/);
                    if (processMatch) {
                        const current = parseInt(processMatch[1]);
                        const total = parseInt(processMatch[2]);
                        if (total > 0) {
                            job.progress = Math.floor((current / total) * 100);
                            job.message = `Processing detections: ${current}/${total}`;
                            // Throttle updates slightly? JobManager.emitUpdate handles some UI
                            this.emitUpdate();
                        }
                    } else if (txt.includes('Loading models')) {
                        job.message = 'Loading AI models...';
                        this.emitUpdate();
                    } else if (txt.includes('Running MegaDetector')) {
                        job.message = 'Running Object Detection...';
                        this.emitUpdate();
                    }
                });

                ps.on('close', (code) => {
                    setSubProcess(null);
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`Python process exited with code ${code}`));
                    }
                });

                ps.on('error', (err) => {
                    reject(err);
                });
            });

            // Post-process: Import results to Database
            // job.message = 'Saving results to database...'; // Kept internal, user sees progress bar
            this.emitUpdate();

            const now = new Date();
            const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const batchName = `Detection ${dateStr} ${timeStr}`;

            const batchId = DatabaseService.createDetectionBatch(batchName);
            console.log(`[Detect Job] Created batch ${batchId}, processing ${absolutePaths.length} images`);

            let savedCount = 0;
            for (const originalPath of absolutePaths) {
                const filename = path.basename(originalPath);
                const jsonFilename = path.parse(filename).name + '.json';
                const jsonPath = path.join(jsonOutputDir, jsonFilename);

                if (await fs.pathExists(jsonPath)) {
                    try {
                        const result = await fs.readJson(jsonPath);

                        // Use the image ID map if available (from passed imageIds), otherwise lookup by path
                        const imageId = imageIdMap[originalPath] ?? DatabaseService.getImageByPath(originalPath)?.id;

                        if (imageId && result.boxes && Array.isArray(result.boxes)) {
                            console.log(`[Detect Job] Saving detections for image ID ${imageId} (path: ${originalPath})`);
                            for (const box of result.boxes) {
                                if (box.bbox && box.bbox.length === 4) {
                                    DatabaseService.addDetection(
                                        batchId,
                                        imageId,
                                        box.label,
                                        box.pred_conf || 0,
                                        box.detection_conf || 0,
                                        box.bbox,
                                        box.source || 'unknown'
                                    );
                                    savedCount++;
                                }
                            }
                        } else {
                            console.log(`[Detect Job] No image found for path: ${originalPath}, result.boxes: ${JSON.stringify(result.boxes)}`);
                        }
                    } catch (e) {
                        console.error(`Failed to parse result for ${originalPath}`, e);
                    }
                } else {
                    console.log(`[Detect Job] No JSON found at: ${jsonPath}`);
                }
            }

            console.log(`[Detect Job] Saved ${savedCount} detections to batch ${batchId}`);

            // Handle chained actions (use values destructured at function start)
            if (chainToReid && imageIds && species && (job.status as string) !== 'cancelled') {
                job.message = 'Classification complete. Starting ReID...';
                this.emitUpdate();

                // Queue the reid job
                this.addJob('reid', { imageIds, species });
            }

        } finally {
            // Cleanup
            await fs.remove(manifestPath).catch(() => { });
        }
    }

    // --- Job Persistence Helpers ---

    private saveJobToDb(job: Job): void {
        try {
            DatabaseService.saveJob({
                id: job.id,
                type: job.type,
                payload: job.payload,
                status: job.status,
                progress: job.progress,
                message: job.message,
                createdAt: job.createdAt
            });
        } catch (error) {
            console.error('[JobManager] Failed to save job to DB:', error);
        }
    }

    private updateJobInDb(job: Job): void {
        try {
            DatabaseService.updateJob(job.id, {
                status: job.status,
                progress: job.progress,
                message: job.message,
                payload: job.payload
            });
        } catch (error) {
            console.error('[JobManager] Failed to update job in DB:', error);
        }
    }

    private loadPersistedJobs(): void {
        try {
            console.log('[JobManager] loadPersistedJobs called');
            // Load ALL recent jobs from database
            const allJobsFromDb = DatabaseService.getAllJobs(this.maxHistory);
            console.log('[JobManager] All jobs from DB:', allJobsFromDb.length);

            for (const jobData of allJobsFromDb) {
                // For unfinished jobs (running/pending), mark as failed since app was closed
                const wasUnfinished = ['running', 'pending'].includes(jobData.status);

                const job: Job = {
                    id: jobData.id,
                    type: jobData.type as Job['type'],
                    status: wasUnfinished ? 'failed' : jobData.status as Job['status'],
                    progress: jobData.progress,
                    message: wasUnfinished
                        ? 'App terminated unexpectedly. Click Retry to resume.'
                        : jobData.message,
                    payload: jobData.payload,
                    createdAt: jobData.createdAt,
                    completedAt: wasUnfinished ? Date.now() : undefined,
                    error: wasUnfinished ? 'App terminated unexpectedly' : undefined
                };
                this.completedJobs.push(job);

                // Update unfinished jobs status in DB
                if (wasUnfinished) {
                    DatabaseService.updateJob(job.id, { status: 'failed', message: job.message });
                }
            }

            if (allJobsFromDb.length > 0) {
                console.log(`[JobManager] Loaded ${allJobsFromDb.length} jobs from previous sessions`);
            }
        } catch (error) {
            console.error('[JobManager] Failed to load persisted jobs:', error);
        }
    }

    private cleanupOldJobs(): void {
        try {
            const deleted = DatabaseService.cleanupOldJobs(50, 7);
            if (deleted > 0) {
                console.log(`[JobManager] Cleaned up ${deleted} old jobs from database`);
            }
        } catch (error) {
            console.error('[JobManager] Failed to cleanup old jobs:', error);
        }
    }
}
