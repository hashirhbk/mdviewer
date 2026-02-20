const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow, dialog, ipcMain } = require('electron');

let mainWindow;

function resolveInitialMode(argv) {
  for (const arg of argv) {
    if (!arg.startsWith('--mode=')) continue;
    const mode = arg.slice('--mode='.length);
    if (mode === 'source' || mode === 'split' || mode === 'rendered') {
      return mode;
    }
  }
  return 'split';
}

function resolveFileArg(argv) {
  for (const arg of argv) {
    if (!arg) continue;
    if (arg.startsWith('--')) continue;
    if (arg.endsWith('.js')) continue;
    const full = path.resolve(arg);
    return full;
  }
  return '';
}

async function readFileSafe(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  return {
    path: filePath,
    content,
  };
}

async function openMarkdownDialog() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Markdown File',
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const targetPath = result.filePaths[0];
  return readFileSafe(targetPath);
}

function createWindow() {
  const initialMode = resolveInitialMode(process.argv.slice(1));

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false,
      nodeIntegration: true,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());

  const fileArg = resolveFileArg(process.argv.slice(1));
  mainWindow.webContents.once('did-finish-load', async () => {
    mainWindow.webContents.send('mdviewer:set-mode', initialMode);
    if (!fileArg) {
      return;
    }

    try {
      const doc = await readFileSafe(fileArg);
      mainWindow.webContents.send('mdviewer:file-opened', doc);
    } catch (err) {
      mainWindow.webContents.send('mdviewer:file-open-error', String(err.message || err));
    }
  });
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

ipcMain.handle('mdviewer:open-dialog', async () => {
  const doc = await openMarkdownDialog();
  return doc;
});

ipcMain.handle('mdviewer:read-file', async (_event, filePath) => {
  return readFileSafe(filePath);
});
