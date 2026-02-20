const path = require('node:path');

const MarkdownIt = require('markdown-it');
const hljs = require('highlight.js');

const openBtn = document.getElementById('openBtn');
const refreshBtn = document.getElementById('refreshBtn');
const modeSourceBtn = document.getElementById('modeSource');
const modeSplitBtn = document.getElementById('modeSplit');
const modeRenderedBtn = document.getElementById('modeRendered');

const workbench = document.getElementById('workbench');
const sourcePane = document.getElementById('sourcePane');
const previewPane = document.getElementById('previewPane');
const markdownInput = document.getElementById('markdownInput');
const renderedOutput = document.getElementById('renderedOutput');

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  typographer: true,
  highlight: (str, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      const highlighted = hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
      return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
    }
    const escaped = md.utils.escapeHtml(str);
    return `<pre><code class="hljs">${escaped}</code></pre>`;
  },
});

const state = {
  currentPath: '',
  currentDir: '',
  dirty: false,
  mode: 'split',
  needsRefresh: false,
};

let renderTimer = null;

function setMode(mode) {
  state.mode = mode;
  workbench.classList.remove('mode-source', 'mode-split', 'mode-rendered');
  workbench.classList.add(`mode-${mode}`);

  sourcePane.classList.toggle('hidden', mode === 'rendered');
  previewPane.classList.toggle('hidden', mode === 'source');

  modeSourceBtn.classList.toggle('is-active', mode === 'source');
  modeSplitBtn.classList.toggle('is-active', mode === 'split');
  modeRenderedBtn.classList.toggle('is-active', mode === 'rendered');
}

function updateTitle() {
  const base = state.currentPath ? `${state.currentPath.split(/[\\/]/).pop()} - mdviewer` : 'mdviewer';
  document.title = state.dirty ? `* ${base}` : base;
}

function renderNow() {
  renderedOutput.innerHTML = md.render(markdownInput.value);
}

function setRefreshVisible(visible) {
  state.needsRefresh = visible;
  refreshBtn.classList.toggle('hidden', !visible);
}

function scheduleRender() {
  if (renderTimer) clearTimeout(renderTimer);
  renderTimer = setTimeout(renderNow, 220);
}

function loadDocument(doc) {
  state.currentPath = doc.path;
  state.currentDir = path.dirname(doc.path);
  state.dirty = false;
  markdownInput.value = doc.content;
  setRefreshVisible(false);
  updateTitle();
  renderNow();
}

async function openDocument() {
  if (state.dirty) {
    const proceed = window.confirm('You have unsaved changes. Discard them and open another file?');
    if (!proceed) return;
  }

  try {
    const doc = await window.mdviewerAPI.openDialog();
    if (!doc) return;
    loadDocument(doc);
  } catch (err) {
    window.alert(`Open failed: ${String(err)}`);
  }
}

async function refreshDocument() {
  if (!state.currentPath) return;

  if (state.dirty) {
    const proceed = window.confirm('File changed on disk. Reload and discard unsaved changes?');
    if (!proceed) return;
  }

  try {
    const doc = await window.mdviewerAPI.readFile(state.currentPath);
    if (!doc) return;
    loadDocument(doc);
  } catch (err) {
    window.alert(`Refresh failed: ${String(err)}`);
  }
}

openBtn.addEventListener('click', openDocument);
refreshBtn.addEventListener('click', refreshDocument);
modeSourceBtn.addEventListener('click', () => setMode('source'));
modeSplitBtn.addEventListener('click', () => setMode('split'));
modeRenderedBtn.addEventListener('click', () => setMode('rendered'));

markdownInput.addEventListener('input', () => {
  state.dirty = true;
  updateTitle();
  scheduleRender();
});

window.mdviewerAPI.onFileOpened((doc) => {
  loadDocument(doc);
});

window.mdviewerAPI.onFileOpenError((msg) => {
  window.alert(`Open failed: ${msg}`);
});

window.mdviewerAPI.onFileChanged((payload) => {
  if (!payload || !payload.path) return;
  if (!state.currentPath) return;
  if (payload.path !== state.currentPath) return;
  setRefreshVisible(true);
});

window.mdviewerAPI.onSetMode((mode) => {
  if (mode === 'source' || mode === 'split' || mode === 'rendered') {
    setMode(mode);
  }
});

const defaultImageRule = md.renderer.rules.image || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const src = token.attrGet('src');
  if (src && state.currentDir && !/^(https?:|file:|data:|\/)/i.test(src)) {
    const absolute = path.resolve(state.currentDir, src);
    token.attrSet('src', `file://${absolute}`);
  }
  return defaultImageRule(tokens, idx, options, env, self);
};

const defaultLinkOpenRule = md.renderer.rules.link_open || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const href = token.attrGet('href');
  if (href && state.currentDir && !/^(https?:|file:|mailto:|#|\/)/i.test(href)) {
    const absolute = path.resolve(state.currentDir, href);
    token.attrSet('href', `file://${absolute}`);
  }
  token.attrSet('target', '_blank');
  token.attrSet('rel', 'noreferrer');
  return defaultLinkOpenRule(tokens, idx, options, env, self);
};

setMode('split');
renderNow();
setRefreshVisible(false);
updateTitle();
