const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'assets', 'logo.png');
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#f7f5fb',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
  });

  const indexPath = path.join(__dirname, '..', 'index.html');
  mainWindow.loadFile(indexPath);
  mainWindow.setTitle('SnapSort');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('pick-folder', async () => {
  const res = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (res.canceled || !res.filePaths[0]) return null;
  return res.filePaths[0];
});

ipcMain.handle('scan-images', async (_evt, dirPath) => {
  function isImage(file) {
    const lower = file.toLowerCase();
    return (
      lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') ||
      lower.endsWith('.webp') || lower.endsWith('.gif')
    );
  }

  const results = [];
  async function walk(current, rel = '') {
    const entries = await fs.promises.readdir(current, { withFileTypes: true });
    const tasks = [];
    
    for (const entry of entries) {
      if (entry.name === 'OrganizedImages') continue;
      const abs = path.join(current, entry.name);
      const nextRel = rel ? path.join(rel, entry.name) : entry.name;
      
      if (entry.isDirectory()) {
        tasks.push(walk(abs, nextRel));
      } else if (entry.isFile() && isImage(entry.name)) {
        results.push({ abs, rel: nextRel, name: entry.name });
      }
    }
    
    await Promise.all(tasks);
  }
  
  await walk(dirPath);
  return results;
});

ipcMain.handle('read-file-bytes', async (_evt, absPath) => {
  const data = await fs.promises.readFile(absPath);
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
});

ipcMain.handle('write-organized-copy', async (_evt, baseDir, category, sourceAbs, targetName) => {
  const outDir = path.join(baseDir, 'OrganizedImages', category);
  await fs.promises.mkdir(outDir, { recursive: true });
  const dest = path.join(outDir, targetName);
  await fs.promises.copyFile(sourceAbs, dest);
  return dest;
});

ipcMain.handle('move-organized-file', async (_evt, baseDir, category, sourceAbs, targetName) => {
  const outDir = path.join(baseDir, 'OrganizedImages', category);
  await fs.promises.mkdir(outDir, { recursive: true });
  const dest = path.join(outDir, targetName);
  await fs.promises.rename(sourceAbs, dest);
  return dest;
});

ipcMain.handle('unique-name', async (_evt, dirPath, baseName) => {
  const dot = baseName.lastIndexOf('.');
  const stem = dot > 0 ? baseName.slice(0, dot) : baseName;
  const ext = dot > 0 ? baseName.slice(dot) : '';
  let attempt = baseName;
  for (let i = 1; i < 1000; i++) {
    const candidate = path.join(dirPath, attempt);
    try {
      await fs.promises.access(candidate);
      attempt = `${stem}-${i}${ext}`;
    } catch {
      return attempt;
    }
  }
  return `${stem}-${Date.now()}${ext}`;
});

ipcMain.handle('unique-name-in-category', async (_evt, baseDir, category, baseName) => {
  const dirPath = path.join(baseDir, 'OrganizedImages', category);
  const dot = baseName.lastIndexOf('.');
  const stem = dot > 0 ? baseName.slice(0, dot) : baseName;
  const ext = dot > 0 ? baseName.slice(dot) : '';
  let attempt = baseName;
  for (let i = 1; i < 1000; i++) {
    const candidate = path.join(dirPath, attempt);
    try {
      await fs.promises.access(candidate);
      attempt = `${stem}-${i}${ext}`;
    } catch {
      return attempt;
    }
  }
  return `${stem}-${Date.now()}${ext}`;
});


