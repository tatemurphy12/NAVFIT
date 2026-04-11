const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    saveFitrep: (data) => ipcRenderer.invoke('save-fitrep', data),
    exportPDF: (data) => ipcRenderer.invoke('generate-report', data),
    exportACCDB: (dbPath) => ipcRenderer.invoke('export-accdb', dbPath),
    
    // Fixed Menu Listener
    onMenuNavigateHome: (callback) => {
        const subscription = (event) => callback();
        ipcRenderer.on('menu-navigate-home', subscription);
        // Returns a cleanup function to prevent memory leaks
        return () => ipcRenderer.removeListener('menu-navigate-home', subscription);
    },

    onMenuSaveTrigger: (callback) => {
        const subscription = (event) => callback();
        ipcRenderer.on('menu-save-trigger', subscription); // Listen for signal from main
        return () => ipcRenderer.removeListener('menu-save-trigger', subscription);
    },

    // HomePage Database Management Endpoints
    getDatabases: () => ipcRenderer.invoke('getDatabases'),
    uploadDatabase: () => ipcRenderer.invoke('uploadDatabase'),
    createDatabase: () => ipcRenderer.invoke('createDatabase'),
    loadFitreps: (dbPath) => ipcRenderer.invoke('loadFitreps', dbPath),
    loadFitrep: (data) => ipcRenderer.invoke('loadFitrep', data),
    deleteFitrep: (data) => ipcRenderer.invoke('deleteFitrep', data),
    removeDatabase: (dbPath) => ipcRenderer.invoke('removeDatabase', dbPath),
    getRaterGroupSummary: (dbPath) => ipcRenderer.invoke('getRaterGroupSummary', dbPath),
    getDbSsnState: (dbPath) => ipcRenderer.invoke('getDbSsnState', dbPath),
    encryptSSNs: (data) => ipcRenderer.invoke('encryptSSNs', data),
    decryptSSNs: (data) => ipcRenderer.invoke('decryptSSNs', data),
});