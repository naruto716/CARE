import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

const isDev = process.env.NODE_ENV === 'development';

// Determine database path
// In production, we might want to store it in appData, but for now adhering to process.cwd()/data as per previous logic
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'library.db');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH, { verbose: isDev ? console.log : undefined });
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON'); // Important for ON DELETE CASCADE

// Initialize Schema
const initSchema = () => {
    const createGroupsTable = `
        CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
    `;

    const createImagesTable = `
        CREATE TABLE IF NOT EXISTS images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER NOT NULL,
            original_path TEXT NOT NULL,
            preview_path TEXT,
            date_added INTEGER NOT NULL,
            metadata TEXT,
            FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE
        );
    `;

    const createDetectionBatchesTable = `
        CREATE TABLE IF NOT EXISTS detection_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
    `;

    const createDetectionsTable = `
        CREATE TABLE IF NOT EXISTS detections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id INTEGER NOT NULL,
            image_id INTEGER NOT NULL,
            label TEXT,
            confidence REAL,
            detection_confidence REAL,
            x1 REAL,
            y1 REAL,
            x2 REAL,
            y2 REAL,
            source TEXT,
            created_at INTEGER NOT NULL,
            FOREIGN KEY(batch_id) REFERENCES detection_batches(id) ON DELETE CASCADE,
            FOREIGN KEY(image_id) REFERENCES images(id) ON DELETE CASCADE
        );
    `;

    const createReidRunsTable = `
        CREATE TABLE IF NOT EXISTS reid_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            species TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );
    `;

    const createReidIndividualsTable = `
        CREATE TABLE IF NOT EXISTS reid_individuals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            display_name TEXT NOT NULL,
            color TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY(run_id) REFERENCES reid_runs(id) ON DELETE CASCADE
        );
    `;

    const createReidMembersTable = `
        CREATE TABLE IF NOT EXISTS reid_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            individual_id INTEGER NOT NULL,
            detection_id INTEGER NOT NULL,
            FOREIGN KEY(individual_id) REFERENCES reid_individuals(id) ON DELETE CASCADE,
            FOREIGN KEY(detection_id) REFERENCES detections(id) ON DELETE CASCADE
        );
    `;

    const createEmbeddingsTable = `
        CREATE TABLE IF NOT EXISTS embeddings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            image_id INTEGER NOT NULL,
            bbox_hash TEXT NOT NULL,
            embedding_type TEXT NOT NULL,
            embedding BLOB NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY(image_id) REFERENCES images(id) ON DELETE CASCADE
        );
    `;

    const createEmbeddingsIndex = `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_embeddings_lookup 
        ON embeddings(image_id, bbox_hash, embedding_type);
    `;

    // Jobs table for persistence across app restarts
    const createJobsTable = `
        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            payload TEXT,
            status TEXT NOT NULL,
            progress INTEGER DEFAULT 0,
            message TEXT,
            created_at INTEGER NOT NULL
        );
    `;

    db.exec(createGroupsTable);
    db.exec(createImagesTable);
    db.exec(createDetectionBatchesTable);
    db.exec(createDetectionsTable);
    db.exec(createReidRunsTable);
    db.exec(createReidIndividualsTable);
    db.exec(createReidMembersTable);
    db.exec(createEmbeddingsTable);
    db.exec(createEmbeddingsIndex);
    db.exec(createJobsTable);

    // Migration: Add metadata column if it doesn't exist
    const columns = db.pragma('table_info(images)') as { name: string }[];
    if (!columns.some(col => col.name === 'metadata')) {
        db.exec('ALTER TABLE images ADD COLUMN metadata TEXT');
    }
    // Migration: Add cloud_url column if it doesn't exist
    if (!columns.some(col => col.name === 'cloud_url')) {
        db.exec('ALTER TABLE images ADD COLUMN cloud_url TEXT');
    }
};

initSchema();

export interface Group {
    id: number;
    name: string;
    created_at: number;
    updated_at: number;
}

export interface Image {
    id: number;
    group_id: number;
    original_path: string;
    cloud_url?: string;         // S3 URL for cloud processing
    preview_path?: string;
    date_added: number;
    metadata?: string; // JSON string of Record<string, string>
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
}

export interface ReidRun {
    id: number;
    name: string;
    species: string;
    created_at: number;
}

export interface ReidIndividual {
    id: number;
    run_id: number;
    name: string;           // Original from Python ("ID-0")
    display_name: string;   // Display name ("ID-1", "ID-2", etc.)
    color: string;          // Hex color ("#E57373")
    created_at: number;
}

export interface ReidMember {
    id: number;
    individual_id: number;
    detection_id: number;
}

export interface Embedding {
    id: number;
    image_id: number;
    bbox_hash: string;
    embedding_type: string;
    embedding: Buffer;
    created_at: number;
}

// Distinct, accessible colors for reid individuals
const INDIVIDUAL_COLORS = [
    '#E57373', '#64B5F6', '#81C784', '#FFD54F', '#BA68C8',
    '#4DB6AC', '#FF8A65', '#A1887F', '#90A4AE', '#F06292',
    '#7986CB', '#AED581', '#FFB74D', '#9575CD', '#4DD0E1',
    '#DCE775', '#FF8A80', '#80DEEA', '#FFAB91', '#B39DDB',
    '#C5E1A5', '#FFCC80', '#CE93D8', '#80CBC4', '#EF9A9A',
    '#81D4FA', '#A5D6A7', '#FFE082', '#B0BEC5', '#F48FB1'
];

// Generate a unique display name using simple ID format (ID-1, ID-2, etc.)
function generateDisplayName(existingNames: string[]): { name: string; color: string } {
    // Find the highest existing ID number
    let maxId = 0;
    for (const existing of existingNames) {
        const match = existing.match(/^ID-(\d+)$/);
        if (match) {
            const num = parseInt(match[1]);
            if (num > maxId) maxId = num;
        }
    }

    const newId = maxId + 1;
    const colorIndex = (newId - 1) % INDIVIDUAL_COLORS.length;
    return { name: `ID-${newId}`, color: INDIVIDUAL_COLORS[colorIndex] };
}

// Query result types for paginated reid data
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

export const DatabaseService = {
    // --- Groups ---

    createGroup: (name: string, createdAt?: number): number => {
        const stmt = db.prepare('INSERT INTO groups (name, created_at, updated_at) VALUES (?, ?, ?)');
        const now = Date.now();
        const info = stmt.run(name, createdAt || now, now);
        return info.lastInsertRowid as number;
    },

    getGroup: (id: number): Group | undefined => {
        const stmt = db.prepare('SELECT * FROM groups WHERE id = ?');
        return stmt.get(id) as Group | undefined;
    },

    updateGroupName: (id: number, name: string): void => {
        const stmt = db.prepare('UPDATE groups SET name = ?, updated_at = ? WHERE id = ?');
        stmt.run(name, Date.now(), id);
    },

    deleteGroup: (id: number): void => {
        const stmt = db.prepare('DELETE FROM groups WHERE id = ?');
        stmt.run(id);
    },

    getAllGroups: (): Group[] => {
        const stmt = db.prepare('SELECT * FROM groups ORDER BY created_at DESC');
        return stmt.all() as Group[];
    },

    // --- Images ---

    addImage: (groupId: number, originalPath: string, previewPath?: string, cloudUrl?: string): number => {
        const stmt = db.prepare('INSERT INTO images (group_id, original_path, preview_path, cloud_url, date_added) VALUES (?, ?, ?, ?, ?)');
        const info = stmt.run(groupId, originalPath, previewPath || null, cloudUrl || null, Date.now());
        return info.lastInsertRowid as number;
    },

    updateImagePreview: (id: number, previewPath: string): void => {
        const stmt = db.prepare('UPDATE images SET preview_path = ? WHERE id = ?');
        stmt.run(previewPath, id);
    },

    deleteImage: (id: number): void => {
        const stmt = db.prepare('DELETE FROM images WHERE id = ?');
        stmt.run(id);
    },

    updateImageMetadata: (id: number, metadata: Record<string, string>): void => {
        const stmt = db.prepare('UPDATE images SET metadata = ? WHERE id = ?');
        stmt.run(JSON.stringify(metadata), id);
    },

    getImageMetadata: (id: number): Record<string, string> | null => {
        const stmt = db.prepare('SELECT metadata FROM images WHERE id = ?');
        const row = stmt.get(id) as { metadata: string | null } | undefined;
        if (!row || !row.metadata) return null;
        try {
            return JSON.parse(row.metadata);
        } catch {
            return null;
        }
    },

    getImageByPath: (originalPath: string): Image | undefined => {
        const stmt = db.prepare('SELECT * FROM images WHERE original_path = ?');
        return stmt.get(originalPath) as Image | undefined;
    },

    getImages: (filter?: { date?: string, groupIds?: number[], searchQuery?: string }): (Image & { group_name: string, group_created_at: number })[] => {
        let query = `
            SELECT images.*, groups.name as group_name, groups.created_at as group_created_at
            FROM images
            JOIN groups ON images.group_id = groups.id
            WHERE 1=1
        `;
        const params: any[] = [];

        if (filter?.date) {
            // date string YYYYMMDD
            query += ` AND strftime('%Y%m%d', datetime(groups.created_at / 1000, 'unixepoch', 'localtime')) = ?`;
            params.push(filter.date);
        }

        if (filter?.groupIds && filter.groupIds.length > 0) {
            const placeholders = filter.groupIds.map(() => '?').join(',');
            query += ` AND groups.id IN (${placeholders})`;
            params.push(...filter.groupIds);
        }

        if (filter?.searchQuery) {
            query += ` AND (
                images.original_path LIKE ? OR 
                groups.name LIKE ?
            )`;
            const likeQuery = `%${filter.searchQuery}%`;
            params.push(likeQuery, likeQuery);
        }

        query += ` ORDER BY groups.created_at DESC, images.date_added DESC`;

        const stmt = db.prepare(query);
        return stmt.all(...params) as (Image & { group_name: string, group_created_at: number })[];
    },

    // --- Detection Batches ---

    createDetectionBatch: (name: string): number => {
        const stmt = db.prepare('INSERT INTO detection_batches (name, created_at, updated_at) VALUES (?, ?, ?)');
        const now = Date.now();
        const info = stmt.run(name, now, now);
        return info.lastInsertRowid as number;
    },

    getDetectionBatches: (): DetectionBatch[] => {
        const stmt = db.prepare('SELECT * FROM detection_batches ORDER BY created_at DESC');
        return stmt.all() as DetectionBatch[];
    },

    updateDetectionBatchName: (id: number, name: string): void => {
        const stmt = db.prepare('UPDATE detection_batches SET name = ?, updated_at = ? WHERE id = ?');
        stmt.run(name, Date.now(), id);
    },

    deleteDetectionBatch: (id: number): void => {
        const stmt = db.prepare('DELETE FROM detection_batches WHERE id = ?');
        stmt.run(id);
    },

    // --- Detections ---

    addDetection: (
        batchId: number,
        imageId: number,
        label: string | null,
        confidence: number,
        detectionConfidence: number,
        bbox: [number, number, number, number],
        source: string
    ): number => {
        const stmt = db.prepare(`
            INSERT INTO detections (
                batch_id, image_id, label, confidence, detection_confidence, 
                x1, y1, x2, y2, source, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const now = Date.now();
        const info = stmt.run(
            batchId,
            imageId,
            label,
            confidence,
            detectionConfidence,
            bbox[0], bbox[1], bbox[2], bbox[3],
            source,
            now
        );
        return info.lastInsertRowid as number;
    },

    getDetectionsForBatch: (batchId: number, species?: string[], minConfidence?: number): (Detection & Image)[] => {
        let query = `
            SELECT 
                detections.id as detection_id,
                detections.batch_id,
                detections.image_id,
                detections.label,
                detections.confidence,
                detections.detection_confidence,
                detections.x1, detections.y1, detections.x2, detections.y2,
                detections.source,
                detections.created_at as detection_created_at,
                images.id as id,
                images.group_id,
                images.original_path,
                images.preview_path,
                images.date_added
            FROM detections
            JOIN images ON detections.image_id = images.id
            WHERE batch_id = ?
        `;

        const params: any[] = [batchId];

        if (species && species.length > 0) {
            const placeholders = species.map(() => '?').join(',');
            query += ` AND detections.label IN (${placeholders})`;
            params.push(...species);
        }

        if (minConfidence !== undefined) {
            query += ` AND detections.confidence >= ?`;
            params.push(minConfidence);
        }

        query += ` ORDER BY images.original_path, detections.created_at`;

        const stmt = db.prepare(query);
        return stmt.all(...params) as (Detection & Image)[];
    },

    getAvailableSpecies: (): string[] => {
        const stmt = db.prepare("SELECT DISTINCT label FROM detections WHERE label IS NOT NULL AND label != '' AND LOWER(label) != 'blank' ORDER BY label");
        const rows = stmt.all() as { label: string }[];
        return rows.map(r => r.label);
    },

    updateDetectionLabel: (id: number, label: string): void => {
        const stmt = db.prepare('UPDATE detections SET label = ? WHERE id = ?');
        stmt.run(label, id);
    },

    deleteDetection: (id: number): void => {
        const stmt = db.prepare('DELETE FROM detections WHERE id = ?');
        stmt.run(id);
    },

    // --- Cleanup ---

    cleanupMissingImages: (): number => {
        const images = db.prepare('SELECT id, original_path FROM images').all() as { id: number, original_path: string }[];
        let deletedCount = 0;
        const deleteStmt = db.prepare('DELETE FROM images WHERE id = ?');

        const deleteTransaction = db.transaction((idsToDelete: number[]) => {
            for (const id of idsToDelete) {
                deleteStmt.run(id);
            }
        });

        const idsToDelete: number[] = [];

        for (const img of images) {
            if (!fs.existsSync(img.original_path)) {
                idsToDelete.push(img.id);
                deletedCount++;
            }
        }

        if (idsToDelete.length > 0) {
            deleteTransaction(idsToDelete);
        }

        // Also cleanup empty groups? User didn't specify, but it's good practice.
        // Let's leave empty groups for now as user might want to keep them.

        return deletedCount;
    },

    // --- ReID Runs ---

    createReidRun: (name: string, species: string): number => {
        const stmt = db.prepare('INSERT INTO reid_runs (name, species, created_at) VALUES (?, ?, ?)');
        const now = Date.now();
        const info = stmt.run(name, species, now);
        return info.lastInsertRowid as number;
    },

    getReidRuns: (): ReidRun[] => {
        const stmt = db.prepare('SELECT * FROM reid_runs ORDER BY created_at DESC');
        return stmt.all() as ReidRun[];
    },

    getReidRun: (id: number): ReidRun | undefined => {
        const stmt = db.prepare('SELECT * FROM reid_runs WHERE id = ?');
        return stmt.get(id) as ReidRun | undefined;
    },

    deleteReidRun: (id: number): void => {
        const stmt = db.prepare('DELETE FROM reid_runs WHERE id = ?');
        stmt.run(id);
    },

    updateReidRunName: (id: number, name: string): void => {
        const stmt = db.prepare('UPDATE reid_runs SET name = ? WHERE id = ?');
        stmt.run(name, id);
    },

    // --- ReID Individuals ---

    createReidIndividual: (runId: number, originalName: string): number => {
        // Get existing display names for this run to avoid collisions
        const existingStmt = db.prepare('SELECT display_name FROM reid_individuals WHERE run_id = ?');
        const existingNames = (existingStmt.all(runId) as { display_name: string }[]).map(r => r.display_name);

        const { name: displayName, color } = generateDisplayName(existingNames);

        const stmt = db.prepare(`
            INSERT INTO reid_individuals (run_id, name, display_name, color, created_at) 
            VALUES (?, ?, ?, ?, ?)
        `);
        const now = Date.now();
        const info = stmt.run(runId, originalName, displayName, color, now);
        return info.lastInsertRowid as number;
    },

    getReidIndividuals: (runId: number): ReidIndividual[] => {
        const stmt = db.prepare('SELECT * FROM reid_individuals WHERE run_id = ? ORDER BY created_at');
        return stmt.all(runId) as ReidIndividual[];
    },

    updateReidIndividualName: (id: number, displayName: string): void => {
        const stmt = db.prepare('UPDATE reid_individuals SET display_name = ? WHERE id = ?');
        stmt.run(displayName, id);
    },

    updateReidIndividualColor: (id: number, color: string): void => {
        const stmt = db.prepare('UPDATE reid_individuals SET color = ? WHERE id = ?');
        stmt.run(color, id);
    },

    deleteReidIndividual: (id: number): void => {
        const stmt = db.prepare('DELETE FROM reid_individuals WHERE id = ?');
        stmt.run(id);
    },

    // --- ReID Members ---

    addReidMember: (individualId: number, detectionId: number): number => {
        const stmt = db.prepare('INSERT INTO reid_members (individual_id, detection_id) VALUES (?, ?)');
        const info = stmt.run(individualId, detectionId);
        return info.lastInsertRowid as number;
    },

    removeReidMember: (id: number): void => {
        const stmt = db.prepare('DELETE FROM reid_members WHERE id = ?');
        stmt.run(id);
    },

    moveReidMember: (memberId: number, newIndividualId: number): void => {
        const stmt = db.prepare('UPDATE reid_members SET individual_id = ? WHERE id = ?');
        stmt.run(newIndividualId, memberId);
    },

    // Merge multiple individuals into one (useful for manual corrections)
    mergeReidIndividuals: (targetId: number, sourceIds: number[]): void => {
        const updateStmt = db.prepare('UPDATE reid_members SET individual_id = ? WHERE individual_id = ?');
        const deleteStmt = db.prepare('DELETE FROM reid_individuals WHERE id = ?');

        const mergeTransaction = db.transaction(() => {
            for (const sourceId of sourceIds) {
                if (sourceId !== targetId) {
                    updateStmt.run(targetId, sourceId);
                    deleteStmt.run(sourceId);
                }
            }
        });

        mergeTransaction();
    },

    // --- ReID Queries (Paginated with Filtering) ---

    /**
     * Get comprehensive ReID data with filtering and pagination.
     * Pagination is by individuals (not detections).
     */
    getReidResults: (options: {
        runId: number;
        page?: number;
        pageSize?: number;
        species?: string[];           // Filter by species (from detection labels)
        individualIds?: number[];     // Filter to specific individuals
        searchQuery?: string;         // Search by individual display_name
        minConfidence?: number;       // Filter detections by confidence
    }): ReidQueryResult | null => {
        const {
            runId,
            page = 1,
            pageSize = 20,
            species,
            individualIds,
            searchQuery,
            minConfidence
        } = options;

        // Get the run
        const run = DatabaseService.getReidRun(runId);
        if (!run) return null;

        // Build individual query with filters
        let individualQuery = `
            SELECT ri.*, 
                   (SELECT COUNT(*) FROM reid_members rm WHERE rm.individual_id = ri.id) as member_count
            FROM reid_individuals ri
            WHERE ri.run_id = ?
        `;
        const individualParams: any[] = [runId];

        if (individualIds && individualIds.length > 0) {
            const placeholders = individualIds.map(() => '?').join(',');
            individualQuery += ` AND ri.id IN (${placeholders})`;
            individualParams.push(...individualIds);
        }

        if (searchQuery) {
            individualQuery += ` AND ri.display_name LIKE ?`;
            individualParams.push(`%${searchQuery}%`);
        }

        // If filtering by species, only include individuals that have at least one detection of that species
        if (species && species.length > 0) {
            const speciesPlaceholders = species.map(() => '?').join(',');
            individualQuery += ` AND EXISTS (
                SELECT 1 FROM reid_members rm
                JOIN detections d ON rm.detection_id = d.id
                WHERE rm.individual_id = ri.id AND d.label IN (${speciesPlaceholders})
            )`;
            individualParams.push(...species);
        }

        individualQuery += ` ORDER BY ri.created_at`;

        // Get total count for pagination
        const countQuery = `SELECT COUNT(*) as count FROM (${individualQuery})`;
        const countStmt = db.prepare(countQuery);
        const totalIndividuals = (countStmt.get(...individualParams) as { count: number }).count;

        // Apply pagination
        const offset = (page - 1) * pageSize;
        individualQuery += ` LIMIT ? OFFSET ?`;
        individualParams.push(pageSize, offset);

        const individualStmt = db.prepare(individualQuery);
        const individuals = individualStmt.all(...individualParams) as (ReidIndividual & { member_count: number })[];

        // For each individual, get their detections with image info
        const detectionQuery = `
            SELECT 
                d.*,
                i.original_path as image_path,
                i.preview_path as image_preview_path
            FROM reid_members rm
            JOIN detections d ON rm.detection_id = d.id
            JOIN images i ON d.image_id = i.id
            WHERE rm.individual_id = ?
            ${species && species.length > 0 ? `AND d.label IN (${species.map(() => '?').join(',')})` : ''}
            ${minConfidence !== undefined ? `AND d.confidence >= ?` : ''}
            ORDER BY d.created_at
        `;

        let totalDetections = 0;
        const individualsWithMembers: ReidIndividualWithMembers[] = individuals.map(ind => {
            const detParams: any[] = [ind.id];
            if (species && species.length > 0) detParams.push(...species);
            if (minConfidence !== undefined) detParams.push(minConfidence);

            const detStmt = db.prepare(detectionQuery);
            const detections = detStmt.all(...detParams) as ReidDetectionWithImage[];
            totalDetections += detections.length;

            return {
                ...ind,
                detections
            };
        });

        return {
            run,
            individuals: individualsWithMembers,
            pagination: {
                total_individuals: totalIndividuals,
                total_detections: totalDetections,
                page,
                page_size: pageSize,
                has_more: offset + individuals.length < totalIndividuals
            }
        };
    },

    /**
     * Get summary statistics for a ReID run
     */
    getReidRunStats: (runId: number): {
        individual_count: number;
        detection_count: number;
        species: string;
        created_at: number;
    } | null => {
        const run = DatabaseService.getReidRun(runId);
        if (!run) return null;

        const individualCountStmt = db.prepare('SELECT COUNT(*) as count FROM reid_individuals WHERE run_id = ?');
        const individualCount = (individualCountStmt.get(runId) as { count: number }).count;

        const detectionCountStmt = db.prepare(`
            SELECT COUNT(*) as count 
            FROM reid_members rm
            JOIN reid_individuals ri ON rm.individual_id = ri.id
            WHERE ri.run_id = ?
        `);
        const detectionCount = (detectionCountStmt.get(runId) as { count: number }).count;

        return {
            individual_count: individualCount,
            detection_count: detectionCount,
            species: run.species,
            created_at: run.created_at
        };
    },

    /**
     * Get all ReID runs with summary stats (for listing)
     */
    getReidRunsWithStats: (): (ReidRun & { individual_count: number; detection_count: number })[] => {
        const stmt = db.prepare(`
            SELECT 
                rr.*,
                (SELECT COUNT(*) FROM reid_individuals ri WHERE ri.run_id = rr.id) as individual_count,
                (SELECT COUNT(*) FROM reid_members rm 
                 JOIN reid_individuals ri ON rm.individual_id = ri.id 
                 WHERE ri.run_id = rr.id) as detection_count
            FROM reid_runs rr
            ORDER BY rr.created_at DESC
        `);
        return stmt.all() as (ReidRun & { individual_count: number; detection_count: number })[];
    },

    // --- Helper: Get detections for images (used by smartReID) ---

    getDetectionsForImages: (imageIds: number[]): (Detection & { image_path: string })[] => {
        if (imageIds.length === 0) return [];
        const placeholders = imageIds.map(() => '?').join(',');
        const stmt = db.prepare(`
            SELECT d.*, i.original_path as image_path
            FROM detections d
            JOIN images i ON d.image_id = i.id
            WHERE d.image_id IN (${placeholders})
            ORDER BY d.image_id, d.created_at
        `);
        return stmt.all(...imageIds) as (Detection & { image_path: string })[];
    },

    getImagesWithoutDetections: (imageIds: number[]): number[] => {
        if (imageIds.length === 0) return [];
        const placeholders = imageIds.map(() => '?').join(',');
        const stmt = db.prepare(`
            SELECT i.id 
            FROM images i
            WHERE i.id IN (${placeholders})
            AND NOT EXISTS (SELECT 1 FROM detections d WHERE d.image_id = i.id)
        `);
        return (stmt.all(...imageIds) as { id: number }[]).map(r => r.id);
    },

    getImagesByIds: (imageIds: number[]): Image[] => {
        if (imageIds.length === 0) return [];
        const placeholders = imageIds.map(() => '?').join(',');
        const stmt = db.prepare(`SELECT * FROM images WHERE id IN (${placeholders})`);
        return stmt.all(...imageIds) as Image[];
    },

    // Get detections from the LATEST batch only for each image
    getLatestDetectionsForImages: (imageIds: number[]): (Detection & { image_path: string })[] => {
        if (imageIds.length === 0) return [];
        const placeholders = imageIds.map(() => '?').join(',');
        // Use a subquery to find the latest batch_id for each image
        const stmt = db.prepare(`
            SELECT d.*, i.original_path as image_path
            FROM detections d
            JOIN images i ON d.image_id = i.id
            WHERE d.image_id IN (${placeholders})
            AND d.batch_id = (
                SELECT d2.batch_id 
                FROM detections d2 
                WHERE d2.image_id = d.image_id 
                ORDER BY d2.created_at DESC 
                LIMIT 1
            )
            ORDER BY d.image_id
        `);
        return stmt.all(...imageIds) as (Detection & { image_path: string })[];
    },

    // Get all ReID results for a single image
    getReidResultsForImage: (imageId: number): {
        runId: number;
        runName: string;
        species: string;
        runCreatedAt: number;
        individualId: number;
        individualName: string;
        individualDisplayName: string;
        individualColor: string;
        detectionId: number;
    }[] => {
        const stmt = db.prepare(`
            SELECT 
                rr.id as runId,
                rr.name as runName,
                rr.species as species,
                rr.created_at as runCreatedAt,
                ri.id as individualId,
                ri.name as individualName,
                ri.display_name as individualDisplayName,
                ri.color as individualColor,
                rm.detection_id as detectionId
            FROM reid_members rm
            JOIN reid_individuals ri ON rm.individual_id = ri.id
            JOIN reid_runs rr ON ri.run_id = rr.id
            JOIN detections d ON rm.detection_id = d.id
            WHERE d.image_id = ?
            ORDER BY rr.created_at DESC, ri.name
        `);
        return stmt.all(imageId) as any[];
    },

    // Get all ReID results for multiple images
    getReidResultsForImages: (imageIds: number[]): {
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
    }[] => {
        if (imageIds.length === 0) return [];
        const placeholders = imageIds.map(() => '?').join(',');
        const stmt = db.prepare(`
            SELECT 
                d.image_id as imageId,
                rr.id as runId,
                rr.name as runName,
                rr.species as species,
                rr.created_at as runCreatedAt,
                ri.id as individualId,
                ri.name as individualName,
                ri.display_name as individualDisplayName,
                ri.color as individualColor,
                rm.detection_id as detectionId
            FROM reid_members rm
            JOIN reid_individuals ri ON rm.individual_id = ri.id
            JOIN reid_runs rr ON ri.run_id = rr.id
            JOIN detections d ON rm.detection_id = d.id
            WHERE d.image_id IN (${placeholders})
            ORDER BY rr.created_at DESC, ri.name
        `);
        return stmt.all(...imageIds) as any[];
    },

    // Dashboard Stats
    getDashboardStats: (): {
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
    } => {
        const totalImages = (db.prepare('SELECT COUNT(*) as count FROM images').get() as { count: number }).count;
        const totalGroups = (db.prepare('SELECT COUNT(*) as count FROM groups').get() as { count: number }).count;
        const totalDetections = (db.prepare('SELECT COUNT(*) as count FROM detections').get() as { count: number }).count;
        const totalSpecies = (db.prepare("SELECT COUNT(DISTINCT label) as count FROM detections WHERE label IS NOT NULL AND label != '' AND LOWER(label) != 'blank'").get() as { count: number }).count;
        const totalReidRuns = (db.prepare('SELECT COUNT(*) as count FROM reid_runs').get() as { count: number }).count;
        const totalIndividuals = (db.prepare('SELECT COUNT(*) as count FROM reid_individuals').get() as { count: number }).count;

        // Species breakdown for ring chart
        const speciesBreakdown = db.prepare(`
            SELECT label, COUNT(*) as count 
            FROM detections 
            WHERE label IS NOT NULL AND label != '' AND LOWER(label) != 'blank'
            GROUP BY label 
            ORDER BY count DESC 
            LIMIT 7
        `).all() as { label: string; count: number }[];

        // Individuals per species - get species from detections via reid_members
        const individualsPerSpecies = db.prepare(`
            SELECT d.label as species, COUNT(DISTINCT ri.id) as count
            FROM reid_individuals ri
            JOIN reid_members rm ON rm.individual_id = ri.id
            JOIN detections d ON d.id = rm.detection_id
            WHERE d.label IS NOT NULL AND d.label != '' AND LOWER(d.label) != 'blank'
            GROUP BY d.label
            ORDER BY count DESC
            LIMIT 6
        `).all() as { species: string; count: number }[];

        // Detection timeline - last 6 months
        const detectionTimeline = db.prepare(`
            SELECT strftime('%Y-%m', datetime(created_at/1000, 'unixepoch')) as month, COUNT(*) as count
            FROM detections
            WHERE created_at > (strftime('%s', 'now', '-6 months') * 1000)
            GROUP BY month
            ORDER BY month ASC
        `).all() as { month: string; count: number }[];

        // Recent activity - last 5 items from various tables
        const recentGroups = db.prepare(`
            SELECT 'group' as type, name, (SELECT COUNT(*) FROM images WHERE group_id = groups.id) as count, created_at as date 
            FROM groups ORDER BY created_at DESC LIMIT 3
        `).all() as { type: string; name: string; count: number; date: number }[];

        const recentBatches = db.prepare(`
            SELECT 'classification' as type, name, (SELECT COUNT(*) FROM detections WHERE batch_id = detection_batches.id) as count, created_at as date 
            FROM detection_batches ORDER BY created_at DESC LIMIT 3
        `).all() as { type: string; name: string; count: number; date: number }[];

        const recentReid = db.prepare(`
            SELECT 'reid' as type, name, (SELECT COUNT(*) FROM reid_individuals WHERE run_id = reid_runs.id) as count, created_at as date 
            FROM reid_runs ORDER BY created_at DESC LIMIT 3
        `).all() as { type: string; name: string; count: number; date: number }[];

        const recentActivity = [...recentGroups, ...recentBatches, ...recentReid]
            .sort((a, b) => b.date - a.date)
            .slice(0, 5);

        return {
            totalImages,
            totalGroups,
            totalDetections,
            totalSpecies,
            totalReidRuns,
            totalIndividuals,
            recentActivity,
            speciesBreakdown,
            individualsPerSpecies,
            detectionTimeline
        };
    },

    // --- Embeddings ---
    getEmbedding(imageId: number, bboxHash: string, embeddingType: string): Buffer | null {
        const stmt = db.prepare(`
            SELECT embedding FROM embeddings 
            WHERE image_id = ? AND bbox_hash = ? AND embedding_type = ?
        `);
        const result = stmt.get(imageId, bboxHash, embeddingType) as { embedding: Buffer } | undefined;
        return result?.embedding ?? null;
    },

    storeEmbedding(imageId: number, bboxHash: string, embeddingType: string, embedding: Buffer): void {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO embeddings (image_id, bbox_hash, embedding_type, embedding, created_at)
            VALUES (?, ?, ?, ?, ?)
        `);
        stmt.run(imageId, bboxHash, embeddingType, embedding, Date.now());
    },

    getEmbeddingsBatch(items: { imageId: number; bboxHash: string }[], embeddingType: string): Map<string, Buffer> {
        const result = new Map<string, Buffer>();
        if (items.length === 0) return result;

        const stmt = db.prepare(`
            SELECT image_id, bbox_hash, embedding FROM embeddings 
            WHERE image_id = ? AND bbox_hash = ? AND embedding_type = ?
        `);

        for (const item of items) {
            const row = stmt.get(item.imageId, item.bboxHash, embeddingType) as { image_id: number; bbox_hash: string; embedding: Buffer } | undefined;
            if (row) {
                const key = `${row.image_id}:${row.bbox_hash}`;
                result.set(key, row.embedding);
            }
        }
        return result;
    },

    storeEmbeddingsBatch(items: { imageId: number; bboxHash: string; embedding: Buffer }[], embeddingType: string): void {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO embeddings (image_id, bbox_hash, embedding_type, embedding, created_at)
            VALUES (?, ?, ?, ?, ?)
        `);
        const now = Date.now();
        const transaction = db.transaction((items: { imageId: number; bboxHash: string; embedding: Buffer }[]) => {
            for (const item of items) {
                stmt.run(item.imageId, item.bboxHash, embeddingType, item.embedding, now);
            }
        });
        transaction(items);
    },

    /**
     * Clear all cached embeddings from the database.
     * Returns the number of embeddings deleted.
     */
    clearAllEmbeddings(): number {
        const countStmt = db.prepare('SELECT COUNT(*) as count FROM embeddings');
        const count = (countStmt.get() as { count: number }).count;

        const deleteStmt = db.prepare('DELETE FROM embeddings');
        deleteStmt.run();

        return count;
    },

    getDbPath(): string {
        return DB_PATH;
    },

    // --- Jobs Persistence ---

    saveJob(job: { id: string; type: string; payload: any; status: string; progress: number; message: string; createdAt: number }): void {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO jobs (id, type, payload, status, progress, message, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(job.id, job.type, JSON.stringify(job.payload), job.status, job.progress, job.message, job.createdAt);
    },

    updateJob(id: string, updates: { status?: string; progress?: number; message?: string; payload?: any }): void {
        const fields: string[] = [];
        const values: any[] = [];

        if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
        if (updates.progress !== undefined) { fields.push('progress = ?'); values.push(updates.progress); }
        if (updates.message !== undefined) { fields.push('message = ?'); values.push(updates.message); }
        if (updates.payload !== undefined) { fields.push('payload = ?'); values.push(JSON.stringify(updates.payload)); }

        if (fields.length === 0) return;

        values.push(id);
        const stmt = db.prepare(`UPDATE jobs SET ${fields.join(', ')} WHERE id = ?`);
        stmt.run(...values);
    },

    deleteJob(id: string): void {
        const stmt = db.prepare('DELETE FROM jobs WHERE id = ?');
        stmt.run(id);
    },

    getUnfinishedJobs(): { id: string; type: string; payload: any; status: string; progress: number; message: string; createdAt: number }[] {
        const stmt = db.prepare(`SELECT * FROM jobs WHERE status IN ('running', 'pending') ORDER BY created_at DESC`);
        const rows = stmt.all() as { id: string; type: string; payload: string; status: string; progress: number; message: string; created_at: number }[];
        return rows.map(row => ({
            id: row.id,
            type: row.type,
            payload: JSON.parse(row.payload || '{}'),
            status: row.status,
            progress: row.progress,
            message: row.message,
            createdAt: row.created_at
        }));
    },

    getCompletedJobs(limit = 50): { id: string; type: string; payload: any; status: string; progress: number; message: string; createdAt: number }[] {
        const stmt = db.prepare(`SELECT * FROM jobs WHERE status IN ('completed', 'failed', 'cancelled') ORDER BY created_at DESC LIMIT ?`);
        const rows = stmt.all(limit) as { id: string; type: string; payload: string; status: string; progress: number; message: string; created_at: number }[];
        return rows.map(row => ({
            id: row.id,
            type: row.type,
            payload: JSON.parse(row.payload || '{}'),
            status: row.status,
            progress: row.progress,
            message: row.message,
            createdAt: row.created_at
        }));
    },

    getAllJobs(limit = 50): { id: string; type: string; payload: any; status: string; progress: number; message: string; createdAt: number }[] {
        const stmt = db.prepare(`SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?`);
        const rows = stmt.all(limit) as { id: string; type: string; payload: string; status: string; progress: number; message: string; created_at: number }[];
        return rows.map(row => ({
            id: row.id,
            type: row.type,
            payload: JSON.parse(row.payload || '{}'),
            status: row.status,
            progress: row.progress,
            message: row.message,
            createdAt: row.created_at
        }));
    },

    cleanupOldJobs(keepCount = 50, maxAgeDays = 7): number {
        const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
        const cutoffTime = Date.now() - maxAgeMs;

        // Delete completed jobs older than maxAgeDays, keeping at most keepCount recent
        const stmt = db.prepare(`
            DELETE FROM jobs 
            WHERE status IN ('completed', 'failed', 'cancelled')
            AND (created_at < ? OR id NOT IN (
                SELECT id FROM jobs 
                WHERE status IN ('completed', 'failed', 'cancelled')
                ORDER BY created_at DESC 
                LIMIT ?
            ))
        `);
        const result = stmt.run(cutoffTime, keepCount);
        return result.changes;
    }
};
