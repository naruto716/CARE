"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const isDev = process.env.NODE_ENV === 'development';
// Determine database path
// In production, we might want to store it in appData, but for now adhering to process.cwd()/data as per previous logic
const DATA_DIR = path_1.default.join(process.cwd(), 'data');
const DB_PATH = path_1.default.join(DATA_DIR, 'library.db');
if (!fs_1.default.existsSync(DATA_DIR)) {
    fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
}
const db = new better_sqlite3_1.default(DB_PATH, { verbose: isDev ? console.log : undefined });
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
    const columns = db.pragma('table_info(images)');
    if (!columns.some(col => col.name === 'metadata')) {
        db.exec('ALTER TABLE images ADD COLUMN metadata TEXT');
    }
    // Migration: Add cloud_url column if it doesn't exist
    if (!columns.some(col => col.name === 'cloud_url')) {
        db.exec('ALTER TABLE images ADD COLUMN cloud_url TEXT');
    }
};
initSchema();
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
function generateDisplayName(existingNames) {
    // Find the highest existing ID number
    let maxId = 0;
    for (const existing of existingNames) {
        const match = existing.match(/^ID-(\d+)$/);
        if (match) {
            const num = parseInt(match[1]);
            if (num > maxId)
                maxId = num;
        }
    }
    const newId = maxId + 1;
    const colorIndex = (newId - 1) % INDIVIDUAL_COLORS.length;
    return { name: `ID-${newId}`, color: INDIVIDUAL_COLORS[colorIndex] };
}
exports.DatabaseService = {
    // --- Groups ---
    createGroup: (name, createdAt) => {
        const stmt = db.prepare('INSERT INTO groups (name, created_at, updated_at) VALUES (?, ?, ?)');
        const now = Date.now();
        const info = stmt.run(name, createdAt || now, now);
        return info.lastInsertRowid;
    },
    getGroup: (id) => {
        const stmt = db.prepare('SELECT * FROM groups WHERE id = ?');
        return stmt.get(id);
    },
    updateGroupName: (id, name) => {
        const stmt = db.prepare('UPDATE groups SET name = ?, updated_at = ? WHERE id = ?');
        stmt.run(name, Date.now(), id);
    },
    deleteGroup: (id) => {
        const stmt = db.prepare('DELETE FROM groups WHERE id = ?');
        stmt.run(id);
    },
    getAllGroups: () => {
        const stmt = db.prepare('SELECT * FROM groups ORDER BY created_at DESC');
        return stmt.all();
    },
    // --- Images ---
    addImage: (groupId, originalPath, previewPath, cloudUrl) => {
        const stmt = db.prepare('INSERT INTO images (group_id, original_path, preview_path, cloud_url, date_added) VALUES (?, ?, ?, ?, ?)');
        const info = stmt.run(groupId, originalPath, previewPath || null, cloudUrl || null, Date.now());
        return info.lastInsertRowid;
    },
    updateImagePreview: (id, previewPath) => {
        const stmt = db.prepare('UPDATE images SET preview_path = ? WHERE id = ?');
        stmt.run(previewPath, id);
    },
    deleteImage: (id) => {
        const stmt = db.prepare('DELETE FROM images WHERE id = ?');
        stmt.run(id);
    },
    updateImageMetadata: (id, metadata) => {
        const stmt = db.prepare('UPDATE images SET metadata = ? WHERE id = ?');
        stmt.run(JSON.stringify(metadata), id);
    },
    getImageMetadata: (id) => {
        const stmt = db.prepare('SELECT metadata FROM images WHERE id = ?');
        const row = stmt.get(id);
        if (!row || !row.metadata)
            return null;
        try {
            return JSON.parse(row.metadata);
        }
        catch {
            return null;
        }
    },
    getImageByPath: (originalPath) => {
        const stmt = db.prepare('SELECT * FROM images WHERE original_path = ?');
        return stmt.get(originalPath);
    },
    getImages: (filter) => {
        let query = `
            SELECT images.*, groups.name as group_name, groups.created_at as group_created_at
            FROM images
            JOIN groups ON images.group_id = groups.id
            WHERE 1=1
        `;
        const params = [];
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
        return stmt.all(...params);
    },
    // --- Detection Batches ---
    createDetectionBatch: (name) => {
        const stmt = db.prepare('INSERT INTO detection_batches (name, created_at, updated_at) VALUES (?, ?, ?)');
        const now = Date.now();
        const info = stmt.run(name, now, now);
        return info.lastInsertRowid;
    },
    getDetectionBatches: () => {
        const stmt = db.prepare('SELECT * FROM detection_batches ORDER BY created_at DESC');
        return stmt.all();
    },
    updateDetectionBatchName: (id, name) => {
        const stmt = db.prepare('UPDATE detection_batches SET name = ?, updated_at = ? WHERE id = ?');
        stmt.run(name, Date.now(), id);
    },
    deleteDetectionBatch: (id) => {
        const stmt = db.prepare('DELETE FROM detection_batches WHERE id = ?');
        stmt.run(id);
    },
    // --- Detections ---
    addDetection: (batchId, imageId, label, confidence, detectionConfidence, bbox, source) => {
        const stmt = db.prepare(`
            INSERT INTO detections (
                batch_id, image_id, label, confidence, detection_confidence, 
                x1, y1, x2, y2, source, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const now = Date.now();
        const info = stmt.run(batchId, imageId, label, confidence, detectionConfidence, bbox[0], bbox[1], bbox[2], bbox[3], source, now);
        return info.lastInsertRowid;
    },
    getDetectionsForBatch: (batchId, species, minConfidence) => {
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
        const params = [batchId];
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
        return stmt.all(...params);
    },
    getAvailableSpecies: () => {
        const stmt = db.prepare("SELECT DISTINCT label FROM detections WHERE label IS NOT NULL AND label != '' AND LOWER(label) != 'blank' ORDER BY label");
        const rows = stmt.all();
        return rows.map(r => r.label);
    },
    updateDetectionLabel: (id, label) => {
        const stmt = db.prepare('UPDATE detections SET label = ? WHERE id = ?');
        stmt.run(label, id);
    },
    deleteDetection: (id) => {
        const stmt = db.prepare('DELETE FROM detections WHERE id = ?');
        stmt.run(id);
    },
    // --- Cleanup ---
    cleanupMissingImages: () => {
        const images = db.prepare('SELECT id, original_path FROM images').all();
        let deletedCount = 0;
        const deleteStmt = db.prepare('DELETE FROM images WHERE id = ?');
        const deleteTransaction = db.transaction((idsToDelete) => {
            for (const id of idsToDelete) {
                deleteStmt.run(id);
            }
        });
        const idsToDelete = [];
        for (const img of images) {
            if (!fs_1.default.existsSync(img.original_path)) {
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
    createReidRun: (name, species) => {
        const stmt = db.prepare('INSERT INTO reid_runs (name, species, created_at) VALUES (?, ?, ?)');
        const now = Date.now();
        const info = stmt.run(name, species, now);
        return info.lastInsertRowid;
    },
    getReidRuns: () => {
        const stmt = db.prepare('SELECT * FROM reid_runs ORDER BY created_at DESC');
        return stmt.all();
    },
    getReidRun: (id) => {
        const stmt = db.prepare('SELECT * FROM reid_runs WHERE id = ?');
        return stmt.get(id);
    },
    deleteReidRun: (id) => {
        const stmt = db.prepare('DELETE FROM reid_runs WHERE id = ?');
        stmt.run(id);
    },
    updateReidRunName: (id, name) => {
        const stmt = db.prepare('UPDATE reid_runs SET name = ? WHERE id = ?');
        stmt.run(name, id);
    },
    // --- ReID Individuals ---
    createReidIndividual: (runId, originalName) => {
        // Get existing display names for this run to avoid collisions
        const existingStmt = db.prepare('SELECT display_name FROM reid_individuals WHERE run_id = ?');
        const existingNames = existingStmt.all(runId).map(r => r.display_name);
        const { name: displayName, color } = generateDisplayName(existingNames);
        const stmt = db.prepare(`
            INSERT INTO reid_individuals (run_id, name, display_name, color, created_at) 
            VALUES (?, ?, ?, ?, ?)
        `);
        const now = Date.now();
        const info = stmt.run(runId, originalName, displayName, color, now);
        return info.lastInsertRowid;
    },
    getReidIndividuals: (runId) => {
        const stmt = db.prepare('SELECT * FROM reid_individuals WHERE run_id = ? ORDER BY created_at');
        return stmt.all(runId);
    },
    updateReidIndividualName: (id, displayName) => {
        const stmt = db.prepare('UPDATE reid_individuals SET display_name = ? WHERE id = ?');
        stmt.run(displayName, id);
    },
    updateReidIndividualColor: (id, color) => {
        const stmt = db.prepare('UPDATE reid_individuals SET color = ? WHERE id = ?');
        stmt.run(color, id);
    },
    deleteReidIndividual: (id) => {
        const stmt = db.prepare('DELETE FROM reid_individuals WHERE id = ?');
        stmt.run(id);
    },
    // --- ReID Members ---
    addReidMember: (individualId, detectionId) => {
        const stmt = db.prepare('INSERT INTO reid_members (individual_id, detection_id) VALUES (?, ?)');
        const info = stmt.run(individualId, detectionId);
        return info.lastInsertRowid;
    },
    removeReidMember: (id) => {
        const stmt = db.prepare('DELETE FROM reid_members WHERE id = ?');
        stmt.run(id);
    },
    moveReidMember: (memberId, newIndividualId) => {
        const stmt = db.prepare('UPDATE reid_members SET individual_id = ? WHERE id = ?');
        stmt.run(newIndividualId, memberId);
    },
    // Merge multiple individuals into one (useful for manual corrections)
    mergeReidIndividuals: (targetId, sourceIds) => {
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
    getReidResults: (options) => {
        const { runId, page = 1, pageSize = 20, species, individualIds, searchQuery, minConfidence } = options;
        // Get the run
        const run = exports.DatabaseService.getReidRun(runId);
        if (!run)
            return null;
        // Build individual query with filters
        let individualQuery = `
            SELECT ri.*, 
                   (SELECT COUNT(*) FROM reid_members rm WHERE rm.individual_id = ri.id) as member_count
            FROM reid_individuals ri
            WHERE ri.run_id = ?
        `;
        const individualParams = [runId];
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
        const totalIndividuals = countStmt.get(...individualParams).count;
        // Apply pagination
        const offset = (page - 1) * pageSize;
        individualQuery += ` LIMIT ? OFFSET ?`;
        individualParams.push(pageSize, offset);
        const individualStmt = db.prepare(individualQuery);
        const individuals = individualStmt.all(...individualParams);
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
        const individualsWithMembers = individuals.map(ind => {
            const detParams = [ind.id];
            if (species && species.length > 0)
                detParams.push(...species);
            if (minConfidence !== undefined)
                detParams.push(minConfidence);
            const detStmt = db.prepare(detectionQuery);
            const detections = detStmt.all(...detParams);
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
    getReidRunStats: (runId) => {
        const run = exports.DatabaseService.getReidRun(runId);
        if (!run)
            return null;
        const individualCountStmt = db.prepare('SELECT COUNT(*) as count FROM reid_individuals WHERE run_id = ?');
        const individualCount = individualCountStmt.get(runId).count;
        const detectionCountStmt = db.prepare(`
            SELECT COUNT(*) as count 
            FROM reid_members rm
            JOIN reid_individuals ri ON rm.individual_id = ri.id
            WHERE ri.run_id = ?
        `);
        const detectionCount = detectionCountStmt.get(runId).count;
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
    getReidRunsWithStats: () => {
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
        return stmt.all();
    },
    // --- Helper: Get detections for images (used by smartReID) ---
    getDetectionsForImages: (imageIds) => {
        if (imageIds.length === 0)
            return [];
        const placeholders = imageIds.map(() => '?').join(',');
        const stmt = db.prepare(`
            SELECT d.*, i.original_path as image_path
            FROM detections d
            JOIN images i ON d.image_id = i.id
            WHERE d.image_id IN (${placeholders})
            ORDER BY d.image_id, d.created_at
        `);
        return stmt.all(...imageIds);
    },
    getImagesWithoutDetections: (imageIds) => {
        if (imageIds.length === 0)
            return [];
        const placeholders = imageIds.map(() => '?').join(',');
        const stmt = db.prepare(`
            SELECT i.id 
            FROM images i
            WHERE i.id IN (${placeholders})
            AND NOT EXISTS (SELECT 1 FROM detections d WHERE d.image_id = i.id)
        `);
        return stmt.all(...imageIds).map(r => r.id);
    },
    getImagesByIds: (imageIds) => {
        if (imageIds.length === 0)
            return [];
        const placeholders = imageIds.map(() => '?').join(',');
        const stmt = db.prepare(`SELECT * FROM images WHERE id IN (${placeholders})`);
        return stmt.all(...imageIds);
    },
    // Get detections from the LATEST batch only for each image
    getLatestDetectionsForImages: (imageIds) => {
        if (imageIds.length === 0)
            return [];
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
        return stmt.all(...imageIds);
    },
    // Get all ReID results for a single image
    getReidResultsForImage: (imageId) => {
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
        return stmt.all(imageId);
    },
    // Get all ReID results for multiple images
    getReidResultsForImages: (imageIds) => {
        if (imageIds.length === 0)
            return [];
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
        return stmt.all(...imageIds);
    },
    // Dashboard Stats
    getDashboardStats: () => {
        const totalImages = db.prepare('SELECT COUNT(*) as count FROM images').get().count;
        const totalGroups = db.prepare('SELECT COUNT(*) as count FROM groups').get().count;
        const totalDetections = db.prepare('SELECT COUNT(*) as count FROM detections').get().count;
        const totalSpecies = db.prepare("SELECT COUNT(DISTINCT label) as count FROM detections WHERE label IS NOT NULL AND label != '' AND LOWER(label) != 'blank'").get().count;
        const totalReidRuns = db.prepare('SELECT COUNT(*) as count FROM reid_runs').get().count;
        const totalIndividuals = db.prepare('SELECT COUNT(*) as count FROM reid_individuals').get().count;
        // Species breakdown for ring chart
        const speciesBreakdown = db.prepare(`
            SELECT label, COUNT(*) as count 
            FROM detections 
            WHERE label IS NOT NULL AND label != '' AND LOWER(label) != 'blank'
            GROUP BY label 
            ORDER BY count DESC 
            LIMIT 7
        `).all();
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
        `).all();
        // Detection timeline - last 6 months
        const detectionTimeline = db.prepare(`
            SELECT strftime('%Y-%m', datetime(created_at/1000, 'unixepoch')) as month, COUNT(*) as count
            FROM detections
            WHERE created_at > (strftime('%s', 'now', '-6 months') * 1000)
            GROUP BY month
            ORDER BY month ASC
        `).all();
        // Recent activity - last 5 items from various tables
        const recentGroups = db.prepare(`
            SELECT 'group' as type, name, (SELECT COUNT(*) FROM images WHERE group_id = groups.id) as count, created_at as date 
            FROM groups ORDER BY created_at DESC LIMIT 3
        `).all();
        const recentBatches = db.prepare(`
            SELECT 'classification' as type, name, (SELECT COUNT(*) FROM detections WHERE batch_id = detection_batches.id) as count, created_at as date 
            FROM detection_batches ORDER BY created_at DESC LIMIT 3
        `).all();
        const recentReid = db.prepare(`
            SELECT 'reid' as type, name, (SELECT COUNT(*) FROM reid_individuals WHERE run_id = reid_runs.id) as count, created_at as date 
            FROM reid_runs ORDER BY created_at DESC LIMIT 3
        `).all();
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
    getEmbedding(imageId, bboxHash, embeddingType) {
        const stmt = db.prepare(`
            SELECT embedding FROM embeddings 
            WHERE image_id = ? AND bbox_hash = ? AND embedding_type = ?
        `);
        const result = stmt.get(imageId, bboxHash, embeddingType);
        return result?.embedding ?? null;
    },
    storeEmbedding(imageId, bboxHash, embeddingType, embedding) {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO embeddings (image_id, bbox_hash, embedding_type, embedding, created_at)
            VALUES (?, ?, ?, ?, ?)
        `);
        stmt.run(imageId, bboxHash, embeddingType, embedding, Date.now());
    },
    getEmbeddingsBatch(items, embeddingType) {
        const result = new Map();
        if (items.length === 0)
            return result;
        const stmt = db.prepare(`
            SELECT image_id, bbox_hash, embedding FROM embeddings 
            WHERE image_id = ? AND bbox_hash = ? AND embedding_type = ?
        `);
        for (const item of items) {
            const row = stmt.get(item.imageId, item.bboxHash, embeddingType);
            if (row) {
                const key = `${row.image_id}:${row.bbox_hash}`;
                result.set(key, row.embedding);
            }
        }
        return result;
    },
    storeEmbeddingsBatch(items, embeddingType) {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO embeddings (image_id, bbox_hash, embedding_type, embedding, created_at)
            VALUES (?, ?, ?, ?, ?)
        `);
        const now = Date.now();
        const transaction = db.transaction((items) => {
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
    clearAllEmbeddings() {
        const countStmt = db.prepare('SELECT COUNT(*) as count FROM embeddings');
        const count = countStmt.get().count;
        const deleteStmt = db.prepare('DELETE FROM embeddings');
        deleteStmt.run();
        return count;
    },
    getDbPath() {
        return DB_PATH;
    },
    // --- Jobs Persistence ---
    saveJob(job) {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO jobs (id, type, payload, status, progress, message, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(job.id, job.type, JSON.stringify(job.payload), job.status, job.progress, job.message, job.createdAt);
    },
    updateJob(id, updates) {
        const fields = [];
        const values = [];
        if (updates.status !== undefined) {
            fields.push('status = ?');
            values.push(updates.status);
        }
        if (updates.progress !== undefined) {
            fields.push('progress = ?');
            values.push(updates.progress);
        }
        if (updates.message !== undefined) {
            fields.push('message = ?');
            values.push(updates.message);
        }
        if (updates.payload !== undefined) {
            fields.push('payload = ?');
            values.push(JSON.stringify(updates.payload));
        }
        if (fields.length === 0)
            return;
        values.push(id);
        const stmt = db.prepare(`UPDATE jobs SET ${fields.join(', ')} WHERE id = ?`);
        stmt.run(...values);
    },
    deleteJob(id) {
        const stmt = db.prepare('DELETE FROM jobs WHERE id = ?');
        stmt.run(id);
    },
    getUnfinishedJobs() {
        const stmt = db.prepare(`SELECT * FROM jobs WHERE status IN ('running', 'pending') ORDER BY created_at DESC`);
        const rows = stmt.all();
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
    getCompletedJobs(limit = 50) {
        const stmt = db.prepare(`SELECT * FROM jobs WHERE status IN ('completed', 'failed', 'cancelled') ORDER BY created_at DESC LIMIT ?`);
        const rows = stmt.all(limit);
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
    getAllJobs(limit = 50) {
        const stmt = db.prepare(`SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?`);
        const rows = stmt.all(limit);
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
    cleanupOldJobs(keepCount = 50, maxAgeDays = 7) {
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
