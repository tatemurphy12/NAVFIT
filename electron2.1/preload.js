const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    saveFitrep: (data) => ipcRenderer.invoke('save-fitrep', data),
    exportPDF: (data) => ipcRenderer.invoke('generate-report', data),
    exportACCDB: (dbPath) => ipcRenderer.invoke('export-accdb', dbPath),

    // NEW: HomePage Database Management Endpoints
    getDatabases: () => ipcRenderer.invoke('getDatabases'),
    uploadDatabase: () => ipcRenderer.invoke('uploadDatabase'),
    createDatabase: () => ipcRenderer.invoke('createDatabase'),
    loadFitreps: (dbPath) => ipcRenderer.invoke('loadFitreps', dbPath),
    loadFitrep: (data) => ipcRenderer.invoke('loadFitrep', data),
    deleteFitrep: (data) => ipcRenderer.invoke('deleteFitrep', data),
    removeDatabase: (dbPath) => ipcRenderer.invoke('removeDatabase', dbPath),
    getRaterGroupSummary: (dbPath) => ipcRenderer.invoke('getRaterGroupSummary', dbPath),
});