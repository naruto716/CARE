import { app, BrowserWindow, ipcMain, session, desktopCapturer, shell, clipboard, nativeImage } from 'electron';
import path from 'path';
import {
    browseDetectImage,
    browseImage,
    browseReidImage,
    detect,
    deleteReidResult,
    downloadSelectedGalleryImages,
    downloadDetectImages,
    downloadReidImages,
    downloadSelectedDetectImages,
    getDetectImagePaths,
    getImagePaths,
    renameReidGroup,
    runReid,
    terminateAI,
    uploadImage,
    uploadPaths,
    viewDetectImage,
    viewImage,
    deleteGroup,
    deleteImage,
    updateGroupName,
    getImages,
    getImagesByIds,
    checkIsDirectory,
    openFileDialog,
    saveImages,
    getDetectionBatches,
    updateDetectionBatchName,
    deleteDetectionBatch,
    getDetectionsForBatch,
    getAvailableSpecies,
    updateDetectionLabel,
    deleteDetection,
    // New Smart ReID
    smartReID,
    getReidRuns,
    getReidRun,
    deleteReidRunById,
    updateReidRunName,
    getReidResults,
    getReidResultsForImage,
    getReidResultsForImages,
    getLatestDetectionsForImages,
    updateReidIndividualName,
    updateReidIndividualColor,
    mergeReidIndividuals,
    getDashboardStats,
    // Image Metadata
    updateImageMetadata,
    getImageMetadata,
    // Embeddings Cache
    clearEmbeddingsCache
} from './controller';
import { JobManager } from './jobs';
import { executePythonCode } from './pythonExecutor';
import { backupTable, listBackups, restoreBackup, deleteBackup } from './backup';
import { getAWSConfig, loadSettings, saveSettings } from './settings';
import { startResultsListener, initSQSClient } from './sqsClient';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        frame: false, // Make the window frameless
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false, // Keeping consistent with neurolink/care-electron
            allowRunningInsecureContent: false,
        },
    });

    // Initialize Job Manager
    JobManager.getInstance().setMainWindow(mainWindow);

    // Start SQS results listener for cloud detection/reid
    try {
        initSQSClient();
        startResultsListener();
        console.log('[Main] SQS results listener started');
    } catch (e) {
        console.warn('[Main] Failed to start SQS listener (cloud features disabled):', e);
    }

    // Grant media permissions (covers webcam, microphone, and screen recording)
    mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        if (permission === 'media') {
            callback(true);
        } else {
            callback(false);
        }
    });

    // Handle permission checks
    mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission) => {
        if (permission === 'media') {
            return true;
        }
        return false;
    });

    // Set up display media request handler for screen sharing
    mainWindow.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
        desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
            const screenSource = sources.find(source => source.id.startsWith('screen:')) || sources[0];
            if (screenSource) {
                callback({ video: screenSource, audio: 'loopback' });
            } else {
                callback({});
            }
        }).catch(error => {
            console.error('Failed to get desktop capture sources:', error);
            callback({});
        });
    }, { useSystemPicker: true });

    // Load the app
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Open external links in default browser
    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url);
        return { action: 'deny' };
    });

    // Add event listeners to track window state changes
    mainWindow.on('maximize', () => {
        mainWindow?.webContents.send('window-state-changed', { isMaximized: true });
    });

    mainWindow.on('unmaximize', () => {
        mainWindow?.webContents.send('window-state-changed', { isMaximized: false });
    });

    mainWindow.on('restore', () => {
        mainWindow?.webContents.send('window-state-changed', { isMaximized: false });
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Stream function for AI output
const stream = (txt: string) => {
    if (mainWindow) {
        mainWindow.webContents.send('stream', txt);
    } else {
        console.log('null mainWindow, cannot send stream data');
    }
};

// IPC handlers for window controls
ipcMain.handle('window:minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window:maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.handle('window:close', () => {
    if (mainWindow) mainWindow.close();
});

ipcMain.handle('window:isMaximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
});

// IPC handlers for backend logic
ipcMain.handle('browseImage', (_, date, folderPath) => browseImage(date, folderPath));
ipcMain.handle('viewImage', (_, originalPath) => viewImage(originalPath));
ipcMain.handle('getImagePaths', (_, currentFolder) => getImagePaths(currentFolder));
ipcMain.handle('getImages', (_, filter) => getImages(filter));
ipcMain.handle('getImagesByIds', (_, imageIds) => getImagesByIds(imageIds));
ipcMain.handle('downloadSelectedGalleryImages', (_, selectedPaths) => downloadSelectedGalleryImages(selectedPaths));
ipcMain.handle('uploadImage', (_, relativePath, originalPath) => uploadImage(relativePath, originalPath));
ipcMain.handle('uploadPaths', (_, filePaths, groupName, afterAction, species) => uploadPaths(filePaths, groupName, afterAction, species));
ipcMain.handle('deleteGroup', (_, id) => deleteGroup(id));
ipcMain.handle('deleteImage', (_, id) => deleteImage(id));
ipcMain.handle('updateGroupName', (_, id, name) => updateGroupName(id, name));
ipcMain.handle('checkIsDirectory', (_, filePath) => checkIsDirectory(filePath));
ipcMain.handle('openFileDialog', () => openFileDialog());
ipcMain.handle('saveImages', (_, sourcePaths) => saveImages(sourcePaths));
ipcMain.handle('detect', (_, selectedPaths, imageIds) => detect(selectedPaths, stream, imageIds));
ipcMain.handle('browseDetectImage', (_, date, folderPath, filterLabel, confLow, confHigh) =>
    browseDetectImage(date, folderPath, filterLabel, confLow, confHigh)
);
ipcMain.handle('viewDetectImage', (_, date, imagePath) => viewDetectImage(date, imagePath));
ipcMain.handle('getDetectImagePaths', (_, dirPath, filterLabel, confLow, confHigh) =>
    getDetectImagePaths(dirPath, filterLabel, confLow, confHigh)
);
ipcMain.handle('downloadDetectImages', (_, filterLabel) => downloadDetectImages(filterLabel));
ipcMain.handle('downloadSelectedDetectImages', (_, selectPaths) => downloadSelectedDetectImages(selectPaths));
ipcMain.handle('runReid', (_, selectedPaths) => runReid(selectedPaths, stream));
ipcMain.handle('browseReidImage', (_, date, time, group_id) => browseReidImage(date, time, group_id));
ipcMain.handle('downloadReidImages', (_, date, time) => downloadReidImages(date, time));
ipcMain.handle('deleteReidResult', (_, date, time) => deleteReidResult(date, time));
ipcMain.handle('renameReidGroup', (_, date, time, old_group_id, new_group_id) =>
    renameReidGroup(date, time, old_group_id, new_group_id)
);
ipcMain.handle('terminateAI', (_) => terminateAI());

// Detection Batches
ipcMain.handle('getDetectionBatches', () => getDetectionBatches());
ipcMain.handle('updateDetectionBatchName', (_, id, name) => updateDetectionBatchName(id, name));
ipcMain.handle('deleteDetectionBatch', (_, id) => deleteDetectionBatch(id));
ipcMain.handle('getDetectionsForBatch', (_, batchId, species, minConfidence) => getDetectionsForBatch(batchId, species, minConfidence));
ipcMain.handle('getAvailableSpecies', () => getAvailableSpecies());
ipcMain.handle('updateDetectionLabel', (_, id, label) => updateDetectionLabel(id, label));
ipcMain.handle('deleteDetection', (_, id) => deleteDetection(id));

// Job Management
ipcMain.handle('getJobs', () => JobManager.getInstance().getJobs());
ipcMain.handle('cancelJob', (_, id) => JobManager.getInstance().cancelJob(id));
ipcMain.handle('retryJob', (_, id) => JobManager.getInstance().retryJob(id));

// New Smart ReID (DB-based)
ipcMain.handle('smartReID', (_, imageIds, species) => smartReID(imageIds, species));
ipcMain.handle('getReidRuns', () => getReidRuns());
ipcMain.handle('getReidRun', (_, id) => getReidRun(id));
ipcMain.handle('deleteReidRun', (_, id) => deleteReidRunById(id));
ipcMain.handle('updateReidRunName', (_, id, name) => updateReidRunName(id, name));
ipcMain.handle('getReidResults', (_, filter) => getReidResults(filter));
ipcMain.handle('getReidResultsForImage', (_, imageId) => getReidResultsForImage(imageId));
ipcMain.handle('getReidResultsForImages', (_, imageIds) => getReidResultsForImages(imageIds));
ipcMain.handle('getLatestDetectionsForImages', (_, imageIds) => getLatestDetectionsForImages(imageIds));
ipcMain.handle('updateReidIndividualName', (_, id, displayName) => updateReidIndividualName(id, displayName));
ipcMain.handle('updateReidIndividualColor', (_, id, color) => updateReidIndividualColor(id, color));
ipcMain.handle('mergeReidIndividuals', (_, targetId, sourceIds) => mergeReidIndividuals(targetId, sourceIds));
ipcMain.handle('getDashboardStats', () => getDashboardStats());

// Image Metadata
ipcMain.handle('updateImageMetadata', (_, id, metadata) => updateImageMetadata(id, metadata));
ipcMain.handle('getImageMetadata', (_, id) => getImageMetadata(id));

// Embeddings Cache
ipcMain.handle('clearEmbeddingsCache', () => clearEmbeddingsCache());

// Python Code Execution (for AI Agent)
ipcMain.handle('executePythonCode', (_, code: string) => executePythonCode(code));

// Database Backup (for AI Agent)
ipcMain.handle('backupTable', (_, tableName: string, whereClause?: string, params?: any[]) =>
    backupTable(tableName, whereClause, params)
);
ipcMain.handle('listBackups', (_, tableName?: string) => listBackups(tableName));
ipcMain.handle('restoreBackup', (_, backupPath: string) => restoreBackup(backupPath));
ipcMain.handle('deleteBackup', (_, backupPath: string) => deleteBackup(backupPath));

// Copy image to clipboard (for AI Agent generated images)
ipcMain.handle('copyImageToClipboard', (_, dataUrl: string) => {
    try {
        // Extract base64 data from data URL
        const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
        const image = nativeImage.createFromBuffer(Buffer.from(base64Data, 'base64'));
        clipboard.writeImage(image);
        return { success: true };
    } catch (error) {
        console.error('Failed to copy image to clipboard:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});

// AWS Settings
ipcMain.handle('getAWSSettings', () => {
    return getAWSConfig();
});

ipcMain.handle('saveAWSSettings', (_, settings: { accessKeyId?: string; secretAccessKey?: string; region?: string; bucket?: string }) => {
    const current = loadSettings();
    current.aws = { ...current.aws, ...settings };
    saveSettings(current);
    return { success: true };
});


app.on('ready', () => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
