const { ipcRenderer } = require('electron');

window.mdviewerAPI = {
  openDialog: () => ipcRenderer.invoke('mdviewer:open-dialog'),
  readFile: (filePath) => ipcRenderer.invoke('mdviewer:read-file', filePath),
  onFileOpened: (fn) => ipcRenderer.on('mdviewer:file-opened', (_event, doc) => fn(doc)),
  onFileOpenError: (fn) => ipcRenderer.on('mdviewer:file-open-error', (_event, msg) => fn(msg)),
  onFileChanged: (fn) => ipcRenderer.on('mdviewer:file-changed', (_event, payload) => fn(payload)),
  onSetMode: (fn) => ipcRenderer.on('mdviewer:set-mode', (_event, mode) => fn(mode)),
};
