export interface FileDetails {
    name: string;
    isDirectory: boolean;
    path: string;
    parent?: string;
}

export interface BrowseImageResponse {
    ok: boolean;
    status?: number;
    files?: FileDetails[];
    error?: string;
}

export interface ViewImageResponse {
    ok: boolean;
    data?: Uint8Array;
    error?: string;
}

export interface ReidInfoForImage {
    individualId: number;
    individualName: string;
    individualDisplayName: string;
    individualColor: string;
    runId: number;
    runName: string;
    species: string;
}

export interface DBImage {
    id: number;
    group_id: number;
    original_path: string;
    preview_path?: string;
    cloud_url?: string; // S3 URL if image was uploaded to cloud
    date_added: number;
    group_name: string;
    group_created_at: number;
    metadata?: Record<string, string>;
    detections?: Detection[];
    reidResults?: ReidInfoForImage[];
}

export interface DetectionBatch {
    id: number;
    name: string;
    created_at: number;
    updated_at: number;
}

export interface Detection {
    id: number;
    batch_id: number;
    image_id: number;
    label: string;
    confidence: number;
    detection_confidence: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    source: string;
    created_at: number;
    image_path?: string;
}

// ReID Types
export interface ReidRun {
    id: number;
    name: string;
    species: string;
    created_at: number;
}

export interface ReidRunWithStats extends ReidRun {
    individual_count: number;
    detection_count: number;
}

export interface ReidIndividual {
    id: number;
    run_id: number;
    name: string;           // Original from Python ("ID-0")
    display_name: string;   // Friendly name ("Luna", "Blaze 2")
    color: string;          // Hex color ("#E57373")
    created_at: number;
}

export interface ReidDetectionWithImage extends Detection {
    image_path: string;
    image_preview_path?: string;
}

export interface ReidIndividualWithMembers extends ReidIndividual {
    member_count: number;
    detections: ReidDetectionWithImage[];
}

export interface ReidQueryResult {
    run: ReidRun;
    individuals: ReidIndividualWithMembers[];
    pagination: {
        total_individuals: number;
        total_detections: number;
        page: number;
        page_size: number;
        has_more: boolean;
    };
}

export interface ReidResultsFilter {
    runId: number;
    page?: number;
    pageSize?: number;
    species?: string[];
    individualIds?: number[];
    searchQuery?: string;
    minConfidence?: number;
}

export interface ElectronApi {
    // ... existing methods ...
    getDetectionBatches: () => Promise<{ ok: boolean; batches?: DetectionBatch[]; error?: string }>;
    updateDetectionBatchName: (id: number, name: string) => Promise<{ ok: boolean; error?: string }>;
    deleteDetectionBatch: (id: number) => Promise<{ ok: boolean; error?: string }>;
    getDetectionsForBatch: (batchId: number, species?: string[], minConfidence?: number) => Promise<{ ok: boolean; detections?: Detection[]; error?: string }>;
    getAvailableSpecies: () => Promise<{ ok: boolean; species?: string[]; error?: string }>;
    updateDetectionLabel: (id: number, label: string) => Promise<{ ok: boolean; error?: string }>;
    deleteDetection: (id: number) => Promise<{ ok: boolean; error?: string }>;

    browseImage: (date: string, folderPath: string) => Promise<BrowseImageResponse>;
    viewImage: (originalPath: string) => Promise<ViewImageResponse>;
    getImagePaths: (currentFolder: string) => Promise<{ ok: boolean; selectAllPaths?: string[]; error?: string }>;
    getImages: (filter?: { date?: string, groupIds?: number[], searchQuery?: string }) => Promise<{ ok: boolean; images?: DBImage[]; error?: string }>;
    getImagesByIds: (imageIds: number[]) => Promise<{ ok: boolean; images?: DBImage[]; error?: string }>;
    downloadSelectedGalleryImages: (selectedPaths: string[]) => Promise<{ ok: boolean; error?: string }>;
    uploadImage: (relativePath: string, originalPath: string) => Promise<{ ok: boolean; error?: string }>;
    uploadPaths: (filePaths: string[], groupName?: string, afterAction?: 'classify' | 'reid', species?: string) => Promise<{ ok: boolean; count?: number; errors?: string[]; error?: string }>;
    deleteGroup: (id: number) => Promise<{ ok: boolean; error?: string }>;
    deleteImage: (id: number) => Promise<{ ok: boolean; error?: string }>;
    updateGroupName: (id: number, name: string) => Promise<{ ok: boolean; error?: string }>;
    checkIsDirectory: (filePath: string) => Promise<boolean>;
    openFileDialog: () => Promise<{ canceled: boolean; filePaths: string[] }>;
    saveImages: (sourcePaths: string[]) => Promise<{ ok: boolean; successCount?: number; failCount?: number; error?: string }>;
    detect: (selectedPaths: string[], onStream: (txt: string) => void, imageIds?: number[]) => Promise<{ ok: boolean; error?: string }>;
    browseDetectImage: (date: string, folderPath: string, filterLabel: string, confLow: number, confHigh: number) => Promise<BrowseImageResponse>;
    viewDetectImage: (date: string, imagePath: string) => Promise<ViewImageResponse>;
    getDetectImagePaths: (dirPath: string, filterLabel: string, confLow: number, confHigh: number) => Promise<{ ok: boolean; selectAllPaths?: string[]; error?: string }>;
    downloadDetectImages: (filterLabel: string) => Promise<{ ok: boolean; error?: string }>;
    downloadSelectedDetectImages: (selectPaths: string[]) => Promise<{ ok: boolean; error?: string }>;
    // Legacy ReID (file-based) - keeping for backward compatibility
    runReid: (selectedPaths: string[], onStream: (txt: string) => void) => Promise<{ ok: boolean; error?: string }>;
    browseReidImage: (date: string, time: string, group_id: string) => Promise<any>;
    downloadReidImages: (date: string, time: string) => Promise<{ ok: boolean; error?: string }>;
    deleteReidResult: (date: string, time: string) => Promise<{ ok: boolean; error?: string }>;
    renameReidGroup: (date: string, time: string, old_group_id: string, new_group_id: string) => Promise<{ ok: boolean; error?: string }>;
    terminateAI: () => Promise<void>;

    // New Smart ReID (DB-based)
    smartReID: (imageIds: number[], species: string) => Promise<{ ok: boolean; reidRunId?: number; error?: string }>;

    // ReID Run Management
    getReidRuns: () => Promise<{ ok: boolean; runs?: ReidRunWithStats[]; error?: string }>;
    getReidRun: (id: number) => Promise<{ ok: boolean; run?: ReidRun; error?: string }>;
    deleteReidRun: (id: number) => Promise<{ ok: boolean; error?: string }>;
    updateReidRunName: (id: number, name: string) => Promise<{ ok: boolean; error?: string }>;

    // ReID Results (Paginated)
    getReidResults: (filter: ReidResultsFilter) => Promise<{ ok: boolean; result?: ReidQueryResult; error?: string }>;

    // ReID Results for Image (get all runs/individuals that include a specific image)
    getReidResultsForImage: (imageId: number) => Promise<{
        ok: boolean;
        results?: {
            runId: number;
            runName: string;
            species: string;
            runCreatedAt: number;
            individualId: number;
            individualName: string;
            individualDisplayName: string;
            individualColor: string;
            detectionId: number;
        }[];
        error?: string;
    }>;

    getReidResultsForImages: (imageIds: number[]) => Promise<{
        ok: boolean;
        results?: {
            imageId: number;
            runId: number;
            runName: string;
            species: string;
            runCreatedAt: number;
            individualId: number;
            individualName: string;
            individualDisplayName: string;
            individualColor: string;
            detectionId: number;
        }[];
        error?: string;
    }>;

    // Get latest detections for images (only from most recent batch per image)
    getLatestDetectionsForImages: (imageIds: number[]) => Promise<{
        ok: boolean;
        detections?: (Detection & { image_path: string })[];
        error?: string;
    }>;

    // ReID Individual Management
    updateReidIndividualName: (id: number, displayName: string) => Promise<{ ok: boolean; error?: string }>;
    updateReidIndividualColor: (id: number, color: string) => Promise<{ ok: boolean; error?: string }>;
    mergeReidIndividuals: (targetId: number, sourceIds: number[]) => Promise<{ ok: boolean; error?: string }>;

    // Dashboard Stats
    getDashboardStats: () => Promise<{
        ok: boolean;
        stats?: {
            totalImages: number;
            totalGroups: number;
            totalDetections: number;
            totalSpecies: number;
            totalReidRuns: number;
            totalIndividuals: number;
            recentActivity: { type: string; name: string; count: number; date: number }[];
            speciesBreakdown: { label: string; count: number }[];
            individualsPerSpecies: { species: string; count: number }[];
            detectionTimeline: { month: string; count: number }[];
        };
        error?: string;
    }>;

    // Image Metadata
    updateImageMetadata: (id: number, metadata: Record<string, string>) => Promise<{ ok: boolean; error?: string }>;
    getImageMetadata: (id: number) => Promise<{ ok: boolean; metadata?: Record<string, string> | null; error?: string }>;

    getPathForFile: (file: File) => string;
    getJobs: () => Promise<any[]>;
    cancelJob: (id: string) => Promise<void>;
    retryJob: (id: string) => Promise<string | null>;
    onJobUpdate: (callback: (jobs: any[]) => void) => () => void;

    // Embeddings Cache
    clearEmbeddingsCache: () => Promise<{ ok: boolean; count?: number; error?: string }>;
}

declare global {
    interface Window {
        api: ElectronApi;
    }
}
