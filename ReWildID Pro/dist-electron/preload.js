"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('windowControls', {
    minimize: () => electron_1.ipcRenderer.invoke('window:minimize'),
    maximize: () => electron_1.ipcRenderer.invoke('window:maximize'),
    close: () => electron_1.ipcRenderer.invoke('window:close'),
    isMaximized: () => electron_1.ipcRenderer.invoke('window:isMaximized'),
    onStateChange: (callback) => {
        const handler = (_event, { isMaximized }) => callback(isMaximized);
        electron_1.ipcRenderer.on('window-state-changed', handler);
        return () => electron_1.ipcRenderer.removeListener('window-state-changed', handler);
    },
    removeStateChangeListener: () => {
        electron_1.ipcRenderer.removeAllListeners('window-state-changed');
    }
});
electron_1.contextBridge.exposeInMainWorld('api', {
    browseImage: (date, folderPath) => electron_1.ipcRenderer.invoke('browseImage', date, folderPath),
    viewImage: (originalPath) => electron_1.ipcRenderer.invoke('viewImage', originalPath),
    getImagePaths: (currentFolder) => electron_1.ipcRenderer.invoke('getImagePaths', currentFolder),
    getImages: (filter) => electron_1.ipcRenderer.invoke('getImages', filter),
    getImagesByIds: (imageIds) => electron_1.ipcRenderer.invoke('getImagesByIds', imageIds),
    uploadPaths: (filePaths, groupName, afterAction, species) => electron_1.ipcRenderer.invoke('uploadPaths', filePaths, groupName, afterAction, species),
    deleteGroup: (id) => electron_1.ipcRenderer.invoke('deleteGroup', id),
    deleteImage: (id) => electron_1.ipcRenderer.invoke('deleteImage', id),
    updateGroupName: (id, name) => electron_1.ipcRenderer.invoke('updateGroupName', id, name),
    checkIsDirectory: (filePath) => electron_1.ipcRenderer.invoke('checkIsDirectory', filePath),
    openFileDialog: () => electron_1.ipcRenderer.invoke('openFileDialog'),
    saveImages: (sourcePaths) => electron_1.ipcRenderer.invoke('saveImages', sourcePaths),
    detect: (selectedPaths, onStream, imageIds) => {
        // Remove existing listeners to avoid duplicates
        electron_1.ipcRenderer.removeAllListeners('stream');
        electron_1.ipcRenderer.on('stream', (_, txt) => onStream(txt));
        return electron_1.ipcRenderer.invoke('detect', selectedPaths, imageIds);
    },
    browseDetectImage: (date, folderPath, filterLabel, confLow, confHigh) => electron_1.ipcRenderer.invoke('browseDetectImage', date, folderPath, filterLabel, confLow, confHigh),
    viewDetectImage: (date, imagePath) => electron_1.ipcRenderer.invoke('viewDetectImage', date, imagePath),
    getDetectImagePaths: (dirPath, filterLabel, confLow, confHigh) => electron_1.ipcRenderer.invoke('getDetectImagePaths', dirPath, filterLabel, confLow, confHigh),
    downloadDetectImages: (filterLabel) => electron_1.ipcRenderer.invoke('downloadDetectImages', filterLabel),
    downloadSelectedDetectImages: (selectPaths) => electron_1.ipcRenderer.invoke('downloadSelectedDetectImages', selectPaths),
    runReid: (selectedPaths, onStream) => {
        electron_1.ipcRenderer.removeAllListeners('stream');
        electron_1.ipcRenderer.on('stream', (_, txt) => onStream(txt));
        return electron_1.ipcRenderer.invoke('runReid', selectedPaths);
    },
    browseReidImage: (date, time, group_id) => electron_1.ipcRenderer.invoke('browseReidImage', date, time, group_id),
    downloadReidImages: (date, time) => electron_1.ipcRenderer.invoke('downloadReidImages', date, time),
    deleteReidResult: (date, time) => electron_1.ipcRenderer.invoke('deleteReidResult', date, time),
    renameReidGroup: (date, time, old_group_id, new_group_id) => electron_1.ipcRenderer.invoke('renameReidGroup', date, time, old_group_id, new_group_id),
    terminateAI: () => electron_1.ipcRenderer.invoke('terminateAI'),
    getPathForFile: (file) => electron_1.webUtils.getPathForFile(file),
    // Detection Batches
    getDetectionBatches: () => electron_1.ipcRenderer.invoke('getDetectionBatches'),
    updateDetectionBatchName: (id, name) => electron_1.ipcRenderer.invoke('updateDetectionBatchName', id, name),
    deleteDetectionBatch: (id) => electron_1.ipcRenderer.invoke('deleteDetectionBatch', id),
    getDetectionsForBatch: (batchId, species, minConfidence) => electron_1.ipcRenderer.invoke('getDetectionsForBatch', batchId, species, minConfidence),
    getAvailableSpecies: () => electron_1.ipcRenderer.invoke('getAvailableSpecies'),
    updateDetectionLabel: (id, label) => electron_1.ipcRenderer.invoke('updateDetectionLabel', id, label),
    deleteDetection: (id) => electron_1.ipcRenderer.invoke('deleteDetection', id),
    // Image Metadata
    updateImageMetadata: (id, metadata) => electron_1.ipcRenderer.invoke('updateImageMetadata', id, metadata),
    getImageMetadata: (id) => electron_1.ipcRenderer.invoke('getImageMetadata', id),
    // Jobs
    getJobs: () => electron_1.ipcRenderer.invoke('getJobs'),
    cancelJob: (id) => electron_1.ipcRenderer.invoke('cancelJob', id),
    retryJob: (id) => electron_1.ipcRenderer.invoke('retryJob', id),
    onJobUpdate: (callback) => {
        const handler = (_event, jobs) => callback(jobs);
        electron_1.ipcRenderer.on('job-update', handler);
        return () => electron_1.ipcRenderer.removeListener('job-update', handler);
    },
    // New Smart ReID (DB-based)
    smartReID: (imageIds, species) => {
        return electron_1.ipcRenderer.invoke('smartReID', imageIds, species);
    },
    getReidRuns: () => electron_1.ipcRenderer.invoke('getReidRuns'),
    getReidRun: (id) => electron_1.ipcRenderer.invoke('getReidRun', id),
    deleteReidRun: (id) => electron_1.ipcRenderer.invoke('deleteReidRun', id),
    updateReidRunName: (id, name) => electron_1.ipcRenderer.invoke('updateReidRunName', id, name),
    getReidResults: (filter) => electron_1.ipcRenderer.invoke('getReidResults', filter),
    getReidResultsForImage: (imageId) => electron_1.ipcRenderer.invoke('getReidResultsForImage', imageId),
    getReidResultsForImages: (imageIds) => electron_1.ipcRenderer.invoke('getReidResultsForImages', imageIds),
    getLatestDetectionsForImages: (imageIds) => electron_1.ipcRenderer.invoke('getLatestDetectionsForImages', imageIds),
    updateReidIndividualName: (id, displayName) => electron_1.ipcRenderer.invoke('updateReidIndividualName', id, displayName),
    updateReidIndividualColor: (id, color) => electron_1.ipcRenderer.invoke('updateReidIndividualColor', id, color),
    mergeReidIndividuals: (targetId, sourceIds) => electron_1.ipcRenderer.invoke('mergeReidIndividuals', targetId, sourceIds),
    getDashboardStats: () => electron_1.ipcRenderer.invoke('getDashboardStats'),
    // Embeddings Cache
    clearEmbeddingsCache: () => electron_1.ipcRenderer.invoke('clearEmbeddingsCache'),
    // Python Code Execution (for AI Agent)
    executePythonCode: (code) => electron_1.ipcRenderer.invoke('executePythonCode', code),
    // Database Backup (for AI Agent)
    backupTable: (tableName, whereClause, params) => electron_1.ipcRenderer.invoke('backupTable', tableName, whereClause, params),
    listBackups: (tableName) => electron_1.ipcRenderer.invoke('listBackups', tableName),
    restoreBackup: (backupPath) => electron_1.ipcRenderer.invoke('restoreBackup', backupPath),
    deleteBackup: (backupPath) => electron_1.ipcRenderer.invoke('deleteBackup', backupPath),
    // Clipboard (for AI Agent generated images)
    copyImageToClipboard: (dataUrl) => electron_1.ipcRenderer.invoke('copyImageToClipboard', dataUrl),
    // AWS Settings
    getAWSSettings: () => electron_1.ipcRenderer.invoke('getAWSSettings'),
    saveAWSSettings: (settings) => electron_1.ipcRenderer.invoke('saveAWSSettings', settings),
});
