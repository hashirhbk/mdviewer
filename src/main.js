const fs = require('node:fs');
const fsp = require('node:fs/promises');
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

function launchArgs() {
  return process.argv.slice(process.defaultApp ? 2 : 1);
}

function normalizePathArg(arg) {
  if (!arg || arg.startsWith('--')) return '';
  if (arg === '.' || arg === '..') return '';

  if (arg.startsWith('file://')) {
    try {
      const url = new URL(arg);
      return decodeURIComponent(url.pathname);
    } catch (_) {
      return '';
    }
  }

  return path.resolve(arg);
}

function resolveFileArg(argv) {
  for (const arg of argv) {
    if (arg.endsWith('.js')) continue;

    const full = normalizePathArg(arg);
    if (!full) continue;

    try {
      const stat = fs.statSync(full);
      if (stat.isDirectory()) continue;
      return full;
    } catch (_) {
      // Ignore non-existing paths and keep scanning args.
    }
  }
  return '';
}

async function readFileSafe(filePath) {
  const content = await fsp.readFile(filePath, 'utf8');
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
  const argv = launchArgs();
  const initialMode = resolveInitialMode(argv);

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

  const fileArg = resolveFileArg(argv);
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
