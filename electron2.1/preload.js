const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    saveFitrep: (data) => ipcRenderer.invoke('save-fitrep', payload),
    exportPDF: (data) => ipcRenderer.invoke('generate-report', data),
    exportACCDB: () => ipcRenderer.invoke('export-accdb'),
    exportSQLite: (data) => ipcRenderer.invoke('export-sqlite', data),

    // NEW: HomePage Database Management Endpoints
    getDatabases: () => ipcRenderer.invoke('getDatabases'),
    uploadDatabase: () => ipcRenderer.invoke('uploadDatabase'),
    createDatabase: () => ipcRenderer.invoke('createDatabase'),
    loadFitreps: (dbPath) => ipcRenderer.invoke('loadFitreps', dbPath),
    loadFitrep: (data) => ipcRenderer.invoke('loadFitrep', data),
    deleteFitrep: (data) => ipcRenderer.invoke('deleteFitrep', data),
    openExternal: (filePath) => ipcRenderer.invoke('openExternal', filePath),
    exportDb: (dbPath) => ipcRenderer.invoke('exportDb', dbPath),
    removeDatabase: (dbPath) => ipcRenderer.invoke('removeDatabase', dbPath),
});