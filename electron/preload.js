const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  scanImages: (dirPath) => ipcRenderer.invoke('scan-images', dirPath),
  readFileBytes: (absPath) => ipcRenderer.invoke('read-file-bytes', absPath),
  writeOrganizedCopy: (baseDir, category, sourceAbs, targetName) => ipcRenderer.invoke('write-organized-copy', baseDir, category, sourceAbs, targetName),
  moveOrganizedFile: (baseDir, category, sourceAbs, targetName) => ipcRenderer.invoke('move-organized-file', baseDir, category, sourceAbs, targetName),
  uniqueName: (dirPath, baseName) => ipcRenderer.invoke('unique-name', dirPath, baseName),
  uniqueNameInCategory: (baseDir, category, baseName) => ipcRenderer.invoke('unique-name-in-category', baseDir, category, baseName),
});


