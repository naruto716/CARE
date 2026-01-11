import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('windowControls', {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onStateChange: (callback: (isMaximized: boolean) => void) => {
        const handler = (_event: any, { isMaximized }: { isMaximized: boolean }) => callback(isMaximized);
        ipcRenderer.on('window-state-changed', handler);
        return () => ipcRenderer.removeListener('window-state-changed', handler);
    },
    removeStateChangeListener: () => {
        ipcRenderer.removeAllListeners('window-state-changed');
    }
});

contextBridge.exposeInMainWorld('api', {
    browseImage: (date: string, folderPath: string) => ipcRenderer.invoke('browseImage', date, folderPath),
    viewImage: (originalPath: string) => ipcRenderer.invoke('viewImage', originalPath),
    getImagePaths: (currentFolder: string) => ipcRenderer.invoke('getImagePaths', currentFolder),
    getImages: (filter?: any) => ipcRenderer.invoke('getImages', filter),
    getImagesByIds: (imageIds: number[]) => ipcRenderer.invoke('getImagesByIds', imageIds),
    uploadPaths: (filePaths: string[], groupName?: string, afterAction?: 'classify' | 'reid', species?: string) =>
        ipcRenderer.invoke('uploadPaths', filePaths, groupName, afterAction, species),
    deleteGroup: (id: number) => ipcRenderer.invoke('deleteGroup', id),
    deleteImage: (id: number) => ipcRenderer.invoke('deleteImage', id),
    updateGroupName: (id: number, name: string) => ipcRenderer.invoke('updateGroupName', id, name),
    checkIsDirectory: (filePath: string) => ipcRenderer.invoke('checkIsDirectory', filePath),
    openFileDialog: () => ipcRenderer.invoke('openFileDialog'),
    saveImages: (sourcePaths: string[]) => ipcRenderer.invoke('saveImages', sourcePaths),
    detect: (selectedPaths: string[], onStream: (txt: string) => void, imageIds?: number[]) => {
        // Remove existing listeners to avoid duplicates
        ipcRenderer.removeAllListeners('stream');
        ipcRenderer.on('stream', (_, txt) => onStream(txt));
        return ipcRenderer.invoke('detect', selectedPaths, imageIds);
    },
    browseDetectImage: (date: string, folderPath: string, filterLabel: string, confLow: number, confHigh: number) =>
        ipcRenderer.invoke('browseDetectImage', date, folderPath, filterLabel, confLow, confHigh),
    viewDetectImage: (date: string, imagePath: string) => ipcRenderer.invoke('viewDetectImage', date, imagePath),
    getDetectImagePaths: (dirPath: string, filterLabel: string, confLow: number, confHigh: number) =>
        ipcRenderer.invoke('getDetectImagePaths', dirPath, filterLabel, confLow, confHigh),
    downloadDetectImages: (filterLabel: string) => ipcRenderer.invoke('downloadDetectImages', filterLabel),
    downloadSelectedDetectImages: (selectPaths: string[]) => ipcRenderer.invoke('downloadSelectedDetectImages', selectPaths),
    runReid: (selectedPaths: string[], onStream: (txt: string) => void) => {
        ipcRenderer.removeAllListeners('stream');
        ipcRenderer.on('stream', (_, txt) => onStream(txt));
        return ipcRenderer.invoke('runReid', selectedPaths);
    },
    browseReidImage: (date: string, time: string, group_id: string) =>
        ipcRenderer.invoke('browseReidImage', date, time, group_id),
    downloadReidImages: (date: string, time: string) => ipcRenderer.invoke('downloadReidImages', date, time),
    deleteReidResult: (date: string, time: string) => ipcRenderer.invoke('deleteReidResult', date, time),
    renameReidGroup: (date: string, time: string, old_group_id: string, new_group_id: string) =>
        ipcRenderer.invoke('renameReidGroup', date, time, old_group_id, new_group_id),
    terminateAI: () => ipcRenderer.invoke('terminateAI'),
    getPathForFile: (file: File) => webUtils.getPathForFile(file),

    // Detection Batches
    getDetectionBatches: () => ipcRenderer.invoke('getDetectionBatches'),
    updateDetectionBatchName: (id: number, name: string) => ipcRenderer.invoke('updateDetectionBatchName', id, name),
    deleteDetectionBatch: (id: number) => ipcRenderer.invoke('deleteDetectionBatch', id),
    getDetectionsForBatch: (batchId: number, species?: string[], minConfidence?: number) => ipcRenderer.invoke('getDetectionsForBatch', batchId, species, minConfidence),
    getAvailableSpecies: () => ipcRenderer.invoke('getAvailableSpecies'),
    updateDetectionLabel: (id: number, label: string) => ipcRenderer.invoke('updateDetectionLabel', id, label),
    deleteDetection: (id: number) => ipcRenderer.invoke('deleteDetection', id),

    // Image Metadata
    updateImageMetadata: (id: number, metadata: Record<string, string>) => ipcRenderer.invoke('updateImageMetadata', id, metadata),
    getImageMetadata: (id: number) => ipcRenderer.invoke('getImageMetadata', id),

    // Jobs
    getJobs: () => ipcRenderer.invoke('getJobs'),
    cancelJob: (id: string) => ipcRenderer.invoke('cancelJob', id),
    retryJob: (id: string) => ipcRenderer.invoke('retryJob', id),
    onJobUpdate: (callback: (jobs: any[]) => void) => {
        const handler = (_event: any, jobs: any[]) => callback(jobs);
        ipcRenderer.on('job-update', handler);
        return () => ipcRenderer.removeListener('job-update', handler);
    },

    // New Smart ReID (DB-based)
    smartReID: (imageIds: number[], species: string) => {
        return ipcRenderer.invoke('smartReID', imageIds, species);
    },
    getReidRuns: () => ipcRenderer.invoke('getReidRuns'),
    getReidRun: (id: number) => ipcRenderer.invoke('getReidRun', id),
    deleteReidRun: (id: number) => ipcRenderer.invoke('deleteReidRun', id),
    updateReidRunName: (id: number, name: string) => ipcRenderer.invoke('updateReidRunName', id, name),
    getReidResults: (filter: any) => ipcRenderer.invoke('getReidResults', filter),
    getReidResultsForImage: (imageId: number) => ipcRenderer.invoke('getReidResultsForImage', imageId),
    getReidResultsForImages: (imageIds: number[]) => ipcRenderer.invoke('getReidResultsForImages', imageIds),
    getLatestDetectionsForImages: (imageIds: number[]) => ipcRenderer.invoke('getLatestDetectionsForImages', imageIds),
    updateReidIndividualName: (id: number, displayName: string) => ipcRenderer.invoke('updateReidIndividualName', id, displayName),
    updateReidIndividualColor: (id: number, color: string) => ipcRenderer.invoke('updateReidIndividualColor', id, color),
    mergeReidIndividuals: (targetId: number, sourceIds: number[]) => ipcRenderer.invoke('mergeReidIndividuals', targetId, sourceIds),
    getDashboardStats: () => ipcRenderer.invoke('getDashboardStats'),

    // Embeddings Cache
    clearEmbeddingsCache: () => ipcRenderer.invoke('clearEmbeddingsCache'),

    // Python Code Execution (for AI Agent)
    executePythonCode: (code: string) => ipcRenderer.invoke('executePythonCode', code),

    // Database Backup (for AI Agent)
    backupTable: (tableName: string, whereClause?: string, params?: any[]) =>
        ipcRenderer.invoke('backupTable', tableName, whereClause, params),
    listBackups: (tableName?: string) => ipcRenderer.invoke('listBackups', tableName),
    restoreBackup: (backupPath: string) => ipcRenderer.invoke('restoreBackup', backupPath),
    deleteBackup: (backupPath: string) => ipcRenderer.invoke('deleteBackup', backupPath),

    // Clipboard (for AI Agent generated images)
    copyImageToClipboard: (dataUrl: string) => ipcRenderer.invoke('copyImageToClipboard', dataUrl),

    // AWS Settings
    getAWSSettings: () => ipcRenderer.invoke('getAWSSettings'),
    saveAWSSettings: (settings: { accessKeyId?: string; secretAccessKey?: string; region?: string; bucket?: string }) =>
        ipcRenderer.invoke('saveAWSSettings', settings),
});
