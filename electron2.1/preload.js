const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    saveFitrep: (data) => ipcRenderer.invoke('save-fitrep', data),
    exportPDF: (data) => ipcRenderer.invoke('generate-report', data),
    exportACCDB: () => ipcRenderer.invoke('export-accdb'),
    exportSQLite: (data) => ipcRenderer.invoke('export-sqlite', data) 
});