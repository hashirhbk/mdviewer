const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');

let mainWindow;
let fileWatcher = null;
let watchedPath = '';
let watchedMtimeMs = 0;

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

function clearWatchedFile() {
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
  }
  watchedPath = '';
  watchedMtimeMs = 0;
}

async function watchFileChanges(filePath) {
  clearWatchedFile();
  watchedPath = filePath;

  try {
    const stats = await fsp.stat(filePath);
    watchedMtimeMs = stats.mtimeMs;
  } catch (_) {
    watchedMtimeMs = 0;
  }

  try {
    fileWatcher = fs.watch(filePath, { persistent: false }, async () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (watchedPath !== filePath) return;

      try {
        const stats = await fsp.stat(filePath);
        if (stats.mtimeMs === watchedMtimeMs) return;
        watchedMtimeMs = stats.mtimeMs;
      } catch (_) {
        // Keep notifying; file may have been replaced/removed.
      }

      mainWindow.webContents.send('mdviewer:file-changed', { path: filePath });
    });

    fileWatcher.on('error', () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.webContents.send('mdviewer:file-changed', { path: filePath });
    });
  } catch (_) {
    // If watch cannot be established, continue without live notifications.
  }
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
  mainWindow.on('closed', () => {
    clearWatchedFile();
    mainWindow = null;
  });

  mainWindow.webContents.on('context-menu', (_event, params) => {
    if (!params.selectionText || !params.selectionText.trim()) {
      return;
    }
    const menu = Menu.buildFromTemplate([{ role: 'copy', label: 'Copy' }]);
    menu.popup({ window: mainWindow });
  });

  const fileArg = resolveFileArg(argv);
  mainWindow.webContents.once('did-finish-load', async () => {
    mainWindow.webContents.send('mdviewer:set-mode', initialMode);
    if (!fileArg) {
      return;
    }

    try {
      const doc = await readFileSafe(fileArg);
      mainWindow.webContents.send('mdviewer:file-opened', doc);
      await watchFileChanges(doc.path);
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

app.on('before-quit', () => {
  clearWatchedFile();
});

ipcMain.handle('mdviewer:open-dialog', async () => {
  const doc = await openMarkdownDialog();
  if (doc && doc.path) {
    await watchFileChanges(doc.path);
  }
  return doc;
});

ipcMain.handle('mdviewer:read-file', async (_event, filePath) => {
  const doc = await readFileSafe(filePath);
  if (doc.path) {
    await watchFileChanges(doc.path);
  }
  return doc;
});
