"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const controller_1 = require("./controller");
const jobs_1 = require("./jobs");
const pythonExecutor_1 = require("./pythonExecutor");
const backup_1 = require("./backup");
const settings_1 = require("./settings");
const sqsClient_1 = require("./sqsClient");
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    electron_1.app.quit();
}
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        frame: false, // Make the window frameless
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path_1.default.join(__dirname, 'preload.js'),
            webSecurity: false, // Keeping consistent with neurolink/care-electron
            allowRunningInsecureContent: false,
        },
    });
    // Initialize Job Manager
    jobs_1.JobManager.getInstance().setMainWindow(mainWindow);
    // Start SQS results listener for cloud detection/reid
    try {
        (0, sqsClient_1.initSQSClient)();
        (0, sqsClient_1.startResultsListener)();
        console.log('[Main] SQS results listener started');
    }
    catch (e) {
        console.warn('[Main] Failed to start SQS listener (cloud features disabled):', e);
    }
    // Grant media permissions (covers webcam, microphone, and screen recording)
    mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        if (permission === 'media') {
            callback(true);
        }
        else {
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
        electron_1.desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
            const screenSource = sources.find(source => source.id.startsWith('screen:')) || sources[0];
            if (screenSource) {
                callback({ video: screenSource, audio: 'loopback' });
            }
            else {
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
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
    // Open external links in default browser
    mainWindow.webContents.setWindowOpenHandler((details) => {
        electron_1.shell.openExternal(details.url);
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
const stream = (txt) => {
    if (mainWindow) {
        mainWindow.webContents.send('stream', txt);
    }
    else {
        console.log('null mainWindow, cannot send stream data');
    }
};
// IPC handlers for window controls
electron_1.ipcMain.handle('window:minimize', () => {
    if (mainWindow)
        mainWindow.minimize();
});
electron_1.ipcMain.handle('window:maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        }
        else {
            mainWindow.maximize();
        }
    }
});
electron_1.ipcMain.handle('window:close', () => {
    if (mainWindow)
        mainWindow.close();
});
electron_1.ipcMain.handle('window:isMaximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
});
// IPC handlers for backend logic
electron_1.ipcMain.handle('browseImage', (_, date, folderPath) => (0, controller_1.browseImage)(date, folderPath));
electron_1.ipcMain.handle('viewImage', (_, originalPath) => (0, controller_1.viewImage)(originalPath));
electron_1.ipcMain.handle('getImagePaths', (_, currentFolder) => (0, controller_1.getImagePaths)(currentFolder));
electron_1.ipcMain.handle('getImages', (_, filter) => (0, controller_1.getImages)(filter));
electron_1.ipcMain.handle('getImagesByIds', (_, imageIds) => (0, controller_1.getImagesByIds)(imageIds));
electron_1.ipcMain.handle('downloadSelectedGalleryImages', (_, selectedPaths) => (0, controller_1.downloadSelectedGalleryImages)(selectedPaths));
electron_1.ipcMain.handle('uploadImage', (_, relativePath, originalPath) => (0, controller_1.uploadImage)(relativePath, originalPath));
electron_1.ipcMain.handle('uploadPaths', (_, filePaths, groupName, afterAction, species) => (0, controller_1.uploadPaths)(filePaths, groupName, afterAction, species));
electron_1.ipcMain.handle('deleteGroup', (_, id) => (0, controller_1.deleteGroup)(id));
electron_1.ipcMain.handle('deleteImage', (_, id) => (0, controller_1.deleteImage)(id));
electron_1.ipcMain.handle('updateGroupName', (_, id, name) => (0, controller_1.updateGroupName)(id, name));
electron_1.ipcMain.handle('checkIsDirectory', (_, filePath) => (0, controller_1.checkIsDirectory)(filePath));
electron_1.ipcMain.handle('openFileDialog', () => (0, controller_1.openFileDialog)());
electron_1.ipcMain.handle('saveImages', (_, sourcePaths) => (0, controller_1.saveImages)(sourcePaths));
electron_1.ipcMain.handle('detect', (_, selectedPaths, imageIds) => (0, controller_1.detect)(selectedPaths, stream, imageIds));
electron_1.ipcMain.handle('browseDetectImage', (_, date, folderPath, filterLabel, confLow, confHigh) => (0, controller_1.browseDetectImage)(date, folderPath, filterLabel, confLow, confHigh));
electron_1.ipcMain.handle('viewDetectImage', (_, date, imagePath) => (0, controller_1.viewDetectImage)(date, imagePath));
electron_1.ipcMain.handle('getDetectImagePaths', (_, dirPath, filterLabel, confLow, confHigh) => (0, controller_1.getDetectImagePaths)(dirPath, filterLabel, confLow, confHigh));
electron_1.ipcMain.handle('downloadDetectImages', (_, filterLabel) => (0, controller_1.downloadDetectImages)(filterLabel));
electron_1.ipcMain.handle('downloadSelectedDetectImages', (_, selectPaths) => (0, controller_1.downloadSelectedDetectImages)(selectPaths));
electron_1.ipcMain.handle('runReid', (_, selectedPaths) => (0, controller_1.runReid)(selectedPaths, stream));
electron_1.ipcMain.handle('browseReidImage', (_, date, time, group_id) => (0, controller_1.browseReidImage)(date, time, group_id));
electron_1.ipcMain.handle('downloadReidImages', (_, date, time) => (0, controller_1.downloadReidImages)(date, time));
electron_1.ipcMain.handle('deleteReidResult', (_, date, time) => (0, controller_1.deleteReidResult)(date, time));
electron_1.ipcMain.handle('renameReidGroup', (_, date, time, old_group_id, new_group_id) => (0, controller_1.renameReidGroup)(date, time, old_group_id, new_group_id));
electron_1.ipcMain.handle('terminateAI', (_) => (0, controller_1.terminateAI)());
// Detection Batches
electron_1.ipcMain.handle('getDetectionBatches', () => (0, controller_1.getDetectionBatches)());
electron_1.ipcMain.handle('updateDetectionBatchName', (_, id, name) => (0, controller_1.updateDetectionBatchName)(id, name));
electron_1.ipcMain.handle('deleteDetectionBatch', (_, id) => (0, controller_1.deleteDetectionBatch)(id));
electron_1.ipcMain.handle('getDetectionsForBatch', (_, batchId, species, minConfidence) => (0, controller_1.getDetectionsForBatch)(batchId, species, minConfidence));
electron_1.ipcMain.handle('getAvailableSpecies', () => (0, controller_1.getAvailableSpecies)());
electron_1.ipcMain.handle('updateDetectionLabel', (_, id, label) => (0, controller_1.updateDetectionLabel)(id, label));
electron_1.ipcMain.handle('deleteDetection', (_, id) => (0, controller_1.deleteDetection)(id));
// Job Management
electron_1.ipcMain.handle('getJobs', () => jobs_1.JobManager.getInstance().getJobs());
electron_1.ipcMain.handle('cancelJob', (_, id) => jobs_1.JobManager.getInstance().cancelJob(id));
electron_1.ipcMain.handle('retryJob', (_, id) => jobs_1.JobManager.getInstance().retryJob(id));
// New Smart ReID (DB-based)
electron_1.ipcMain.handle('smartReID', (_, imageIds, species) => (0, controller_1.smartReID)(imageIds, species));
electron_1.ipcMain.handle('getReidRuns', () => (0, controller_1.getReidRuns)());
electron_1.ipcMain.handle('getReidRun', (_, id) => (0, controller_1.getReidRun)(id));
electron_1.ipcMain.handle('deleteReidRun', (_, id) => (0, controller_1.deleteReidRunById)(id));
electron_1.ipcMain.handle('updateReidRunName', (_, id, name) => (0, controller_1.updateReidRunName)(id, name));
electron_1.ipcMain.handle('getReidResults', (_, filter) => (0, controller_1.getReidResults)(filter));
electron_1.ipcMain.handle('getReidResultsForImage', (_, imageId) => (0, controller_1.getReidResultsForImage)(imageId));
electron_1.ipcMain.handle('getReidResultsForImages', (_, imageIds) => (0, controller_1.getReidResultsForImages)(imageIds));
electron_1.ipcMain.handle('getLatestDetectionsForImages', (_, imageIds) => (0, controller_1.getLatestDetectionsForImages)(imageIds));
electron_1.ipcMain.handle('updateReidIndividualName', (_, id, displayName) => (0, controller_1.updateReidIndividualName)(id, displayName));
electron_1.ipcMain.handle('updateReidIndividualColor', (_, id, color) => (0, controller_1.updateReidIndividualColor)(id, color));
electron_1.ipcMain.handle('mergeReidIndividuals', (_, targetId, sourceIds) => (0, controller_1.mergeReidIndividuals)(targetId, sourceIds));
electron_1.ipcMain.handle('getDashboardStats', () => (0, controller_1.getDashboardStats)());
// Image Metadata
electron_1.ipcMain.handle('updateImageMetadata', (_, id, metadata) => (0, controller_1.updateImageMetadata)(id, metadata));
electron_1.ipcMain.handle('getImageMetadata', (_, id) => (0, controller_1.getImageMetadata)(id));
// Embeddings Cache
electron_1.ipcMain.handle('clearEmbeddingsCache', () => (0, controller_1.clearEmbeddingsCache)());
// Python Code Execution (for AI Agent)
electron_1.ipcMain.handle('executePythonCode', (_, code) => (0, pythonExecutor_1.executePythonCode)(code));
// Database Backup (for AI Agent)
electron_1.ipcMain.handle('backupTable', (_, tableName, whereClause, params) => (0, backup_1.backupTable)(tableName, whereClause, params));
electron_1.ipcMain.handle('listBackups', (_, tableName) => (0, backup_1.listBackups)(tableName));
electron_1.ipcMain.handle('restoreBackup', (_, backupPath) => (0, backup_1.restoreBackup)(backupPath));
electron_1.ipcMain.handle('deleteBackup', (_, backupPath) => (0, backup_1.deleteBackup)(backupPath));
// Copy image to clipboard (for AI Agent generated images)
electron_1.ipcMain.handle('copyImageToClipboard', (_, dataUrl) => {
    try {
        // Extract base64 data from data URL
        const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
        const image = electron_1.nativeImage.createFromBuffer(Buffer.from(base64Data, 'base64'));
        electron_1.clipboard.writeImage(image);
        return { success: true };
    }
    catch (error) {
        console.error('Failed to copy image to clipboard:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
// AWS Settings
electron_1.ipcMain.handle('getAWSSettings', () => {
    return (0, settings_1.getAWSConfig)();
});
electron_1.ipcMain.handle('saveAWSSettings', (_, settings) => {
    const current = (0, settings_1.loadSettings)();
    current.aws = { ...current.aws, ...settings };
    (0, settings_1.saveSettings)(current);
    return { success: true };
});
electron_1.app.on('ready', () => {
    createWindow();
    electron_1.app.on('activate', function () {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
