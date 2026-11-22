import './style.css';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import Sortable from 'sortablejs';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const $ = (id) => document.getElementById(id);
const files = new Map();
let activeId = null;
let selected = new Set();
let lastSelected = null;
let output = [];
let history = [];
let future = [];
let generating = false;
let adding = false;
let thumbnailObserver;
let toastTimer;
let dragDepth = 0;
let nextId = 1;

const id = () => `item-${nextId++}`;
const basename = (name) => name.replace(/\.pdf$/i, '');

function toast(message, error = false) {
  const el = $('toast');
  el.textContent = message;
  el.classList.toggle('error', error);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 4200);
}

function saveHistory() {
  history.push(output.map((item) => ({ ...item })));
  if (history.length > 80) history.shift();
  future = [];
}

function updateOutput(next, { remember = true } = {}) {
  if (remember) saveHistory();
  output = next;
  renderOutput();
}

function undo() {
  if (!history.length || generating) return;
  future.push(output.map((item) => ({ ...item })));
  output = history.pop();
  renderOutput();
}

function redo() {
  if (!future.length || generating) return;
  history.push(output.map((item) => ({ ...item })));
  output = future.pop();
  renderOutput();
}

function renderFiles() {
  const list = $('file-list');
  list.replaceChildren();
  $('source-empty').hidden = files.size > 0;
  $('file-count').textContent = String(files.size);
  for (const file of files.values()) {
    const el = document.createElement('div');
    el.className = `file-item${activeId === file.id ? ' active' : ''}`;
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `View ${file.name}`);
    const icon = document.createElement('div');
    icon.className = 'file-icon';
    icon.textContent = 'PDF';
    const info = document.createElement('div');
    info.className = 'file-details';
    const name = document.createElement('strong');
    name.className = 'file-name';
    name.textContent = file.name;
    name.title = file.name;
    const count = document.createElement('span');
    count.className = 'file-pages';
    count.textContent = `${file.pageCount} ${file.pageCount === 1 ? 'page' : 'pages'}`;
    info.append(name, count);
    const remove = document.createElement('button');
    remove.className = 'file-remove';
    remove.type = 'button';
    remove.textContent = '×';
    remove.title = `Remove ${file.name}`;
    remove.setAttribute('aria-label', `Remove ${file.name}`);
    remove.addEventListener('click', (event) => { event.stopPropagation(); removeFile(file.id); });
    el.append(icon, info, remove);
    el.addEventListener('click', () => activateFile(file.id));
    el.addEventListener('keydown', (event) => {
      if (event.target === el && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault(); activateFile(file.id);
      }
    });
    list.append(el);
  }
}

function removeFile(fileId) {
  const file = files.get(fileId);
  if (!file || generating) return;
  const affected = output.filter((page) => page.fileId === fileId).length;
  if (affected && !window.confirm(`Remove "${file.name}"? This also removes ${affected} page(s) from your output.`)) return;
  if (affected) updateOutput(output.filter((page) => page.fileId !== fileId));
  file.pdf.destroy().catch(() => {});
  files.delete(fileId);
  if (activeId === fileId) {
    activeId = files.keys().next().value ?? null;
    selected.clear();
    lastSelected = null;
    renderPages();
  }
  renderFiles();
}

async function addFiles(fileList) {
  if (adding || generating) return;
  const candidates = [...fileList];
  if (!candidates.length) return;
  adding = true;
  $('add-file').disabled = true;
  let success = 0;
  try {
    for (const raw of candidates) {
      if (raw.type !== 'application/pdf' && !raw.name.toLowerCase().endsWith('.pdf')) {
        toast(`Skipped ${raw.name}: not a PDF.`, true);
        continue;
      }
      try {
        const bytes = new Uint8Array(await raw.arrayBuffer());
        const loadingTask = pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false });
        const pdf = await loadingTask.promise;
        const item = { id: id(), name: raw.name, bytes, pdf, pageCount: pdf.numPages, thumbs: new Map(), loadingThumbs: new Map() };
        files.set(item.id, item);
        success++;
        if (!activeId) activeId = item.id;
        renderFiles();
        if (activeId === item.id) renderPages();
      } catch (error) {
        console.warn('Unable to read PDF:', error);
        toast(`Could not open ${raw.name}. Password-protected or damaged PDFs are not supported.`, true);
      }
    }
    if (success) toast(`Added ${success} PDF ${success === 1 ? 'file' : 'files'}.`);
  } finally {
    adding = false;
    $('add-file').disabled = false;
    $('file-input').value = '';
  }
}

function activateFile(fileId) {
  if (!files.has(fileId) || activeId === fileId) return;
  activeId = fileId;
  selected.clear();
  lastSelected = null;
  renderFiles();
  renderPages();
}

async function ensureThumb(file, pageNum) {
  if (file.thumbs.has(pageNum)) return file.thumbs.get(pageNum);
  if (file.loadingThumbs.has(pageNum)) return file.loadingThumbs.get(pageNum);
  const task = (async () => {
    const page = await file.pdf.getPage(pageNum);
    const unscaled = page.getViewport({ scale: 1 });
    const scale = Math.min(1.5, 240 / unscaled.width, 320 / unscaled.height);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    const context = canvas.getContext('2d', { alpha: false });
    await page.render({ canvasContext: context, canvas, viewport }).promise;
    const url = canvas.toDataURL('image/jpeg', .82);
    page.cleanup();
    file.thumbs.set(pageNum, url);
    return url;
  })();
  file.loadingThumbs.set(pageNum, task);
  try { return await task; }
  finally { file.loadingThumbs.delete(pageNum); }
}

function thumbnailInto(fileId, pageNum, holder) {
  const file = files.get(fileId);
  if (!file) return;
  if (file.thumbs.has(pageNum)) {
    setThumb(holder, file.thumbs.get(pageNum));
    return;
  }
  holder.innerHTML = '<div class="loading-shape" aria-hidden="true"></div>';
  ensureThumb(file, pageNum).then((url) => {
    if (holder.isConnected && files.has(fileId) && holder.dataset.pageKey === `${fileId}:${pageNum}`) setThumb(holder, url);
  }).catch((error) => {
    console.warn('Thumbnail render failed:', error);
    if (holder.isConnected) holder.textContent = 'Preview unavailable';
  });
}

function setThumb(holder, url) {
  const image = document.createElement('img');
  image.src = url;
  image.alt = '';
  image.draggable = false;
  holder.replaceChildren(image);
}

function renderPages() {
  thumbnailObserver?.disconnect();
  const grid = $('page-grid');
  grid.replaceChildren();
  const file = files.get(activeId);
  $('pages-empty').hidden = !!file;
  $('pages-toolbar').hidden = !file;
  $('pages-actions').hidden = !file;
  $('active-file-name').textContent = file ? file.name : 'Select a PDF to browse';
  $('pages-meta').textContent = file ? `${file.pageCount} pages` : '';
  if (!file) return;
  thumbnailObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const holder = entry.target;
        thumbnailObserver.unobserve(holder);
        thumbnailInto(file.id, Number(holder.dataset.page), holder);
      }
    }
  }, { root: grid, rootMargin: '250px' });
  for (let page = 1; page <= file.pageCount; page++) {
    const el = document.createElement('div');
    el.className = 'page-card';
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `Select page ${page}`);
    el.dataset.page = String(page);
    const check = document.createElement('span');
    check.className = 'selected-check';
    check.textContent = '✓';
    const preview = document.createElement('div');
    preview.className = 'page-preview';
    preview.dataset.pageKey = `${file.id}:${page}`;
    preview.dataset.page = String(page);
    const number = document.createElement('span');
    number.className = 'page-number';
    number.textContent = `Page ${page}`;
    const enlarge = document.createElement('button');
    enlarge.type = 'button';
    enlarge.className = 'preview-button';
    enlarge.textContent = '⤢ Preview';
    enlarge.setAttribute('aria-label', `Preview page ${page}`);
    enlarge.addEventListener('click', (event) => { event.stopPropagation(); showPreview(file.id, page); });
    el.append(check, preview, number, enlarge);
    el.addEventListener('click', (event) => toggleSelection(page, event.shiftKey));
    el.addEventListener('keydown', (event) => {
      if (event.target === el && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault(); toggleSelection(page, event.shiftKey);
      }
    });
    grid.append(el);
    thumbnailObserver.observe(preview);
  }
  refreshSelection();
}

function toggleSelection(page, range = false) {
  if (range && lastSelected !== null) {
    const [low, high] = [lastSelected, page].sort((a,b) => a - b);
    for (let p = low; p <= high; p++) selected.add(p);
  } else if (selected.has(page)) selected.delete(page);
  else selected.add(page);
  lastSelected = page;
  refreshSelection();
}

function refreshSelection() {
  const count = selected.size;
  $('selection-count').textContent = `${count} selected`;
  $('add-start').disabled = !count;
  $('add-end').disabled = !count;
  $('add-description').textContent = count ? `${count} ${count === 1 ? 'page' : 'pages'} ready to add` : 'Select pages to add them to the output';
  for (const card of $('page-grid').children) {
    const isSelected = selected.has(Number(card.dataset.page));
    card.classList.toggle('selected', isSelected);
    card.setAttribute('aria-pressed', String(isSelected));
  }
}

function addSelected(position) {
  if (!selected.size || !activeId || generating) return;
  const additions = [...selected].sort((a, b) => a - b).map((pageNum) => ({ id: id(), fileId: activeId, pageNum }));
  updateOutput(position === 'start' ? [...additions, ...output] : [...output, ...additions]);
  selected.clear();
  lastSelected = null;
  refreshSelection();
  toast(`Added ${additions.length} ${additions.length === 1 ? 'page' : 'pages'} to the ${position}.`);
}

function renderOutput() {
  const strip = $('output-strip');
  strip.replaceChildren();
  $('output-empty').hidden = output.length > 0;
  $('output-count').textContent = `${output.length} ${output.length === 1 ? 'page' : 'pages'}`;
  $('export-summary').textContent = output.length ? `${output.length} ${output.length === 1 ? 'page' : 'pages'} · ${new Set(output.map((p) => p.fileId)).size} source ${new Set(output.map((p) => p.fileId)).size === 1 ? 'file' : 'files'}` : 'Add pages to get started';
  $('undo').disabled = !history.length || generating;
  $('redo').disabled = !future.length || generating;
  $('clear-output').disabled = !output.length || generating;
  $('generate').disabled = !output.length || generating;
  output.forEach((item, index) => {
    const file = files.get(item.fileId);
    if (!file) return;
    const card = document.createElement('div');
    card.className = 'output-card';
    card.dataset.itemId = item.id;
    card.tabIndex = 0;
    card.setAttribute('aria-label', `Output page ${index + 1}, ${file.name} page ${item.pageNum}. Drag to reorder.`);
    const position = document.createElement('span');
    position.className = 'output-position';
    position.textContent = String(index + 1);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'output-remove';
    remove.textContent = '×';
    remove.title = 'Remove this page';
    remove.setAttribute('aria-label', `Remove output page ${index + 1}`);
    remove.addEventListener('click', () => {
      if (!generating) updateOutput(output.filter((p) => p.id !== item.id));
    });
    const thumb = document.createElement('div');
    thumb.className = 'page-preview';
    thumb.dataset.pageKey = `${item.fileId}:${item.pageNum}`;
    const label = document.createElement('span');
    label.className = 'output-label';
    label.textContent = file.name;
    label.title = file.name;
    const number = document.createElement('span');
    number.className = 'output-page-label';
    number.textContent = `Original page ${item.pageNum}`;
    card.append(position, remove, thumb, label, number);
    card.addEventListener('dblclick', (event) => {
      if (event.target !== remove) showPreview(item.fileId, item.pageNum);
    });
    strip.append(card);
    thumbnailInto(item.fileId, item.pageNum, thumb);
  });
}

async function showPreview(fileId, pageNum) {
  const file = files.get(fileId);
  if (!file) return;
  const dialog = $('preview-dialog');
  $('preview-title').textContent = `${file.name} · Page ${pageNum}`;
  $('preview-content').textContent = 'Rendering page…';
  dialog.showModal();
  try {
    const page = await file.pdf.getPage(pageNum);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(2, 1000 / base.width, 1300 / base.height) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d', { alpha: false }), canvas, viewport }).promise;
    page.cleanup();
    if (dialog.open) $('preview-content').replaceChildren(canvas);
  } catch (error) {
    console.warn(error);
    if (dialog.open) $('preview-content').textContent = 'Unable to preview this page.';
  }
}

async function generate() {
  if (!output.length || generating) return;
  const name = basename($('output-filename').value.trim().replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')) || 'Combined PDF';
  const snapshot = output.slice();
  generating = true;
  $('generate-text').textContent = 'Generating…';
  renderOutput();
  try {
    const result = await PDFDocument.create();
    const sources = new Map();
    for (const item of snapshot) {
      if (!sources.has(item.fileId)) {
        const file = files.get(item.fileId);
        if (!file) throw new Error('A source PDF was removed.');
        sources.set(item.fileId, await PDFDocument.load(file.bytes, { ignoreEncryption: false }));
      }
      const [page] = await result.copyPages(sources.get(item.fileId), [item.pageNum - 1]);
      result.addPage(page);
    }
    const bytes = await result.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.pdf`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    toast(`Generated ${name}.pdf with ${snapshot.length} pages.`);
  } catch (error) {
    console.error('Could not generate PDF:', error);
    toast(`Unable to generate PDF: ${error.message || 'unknown error'}`, true);
  } finally {
    generating = false;
    $('generate-text').textContent = 'Generate PDF';
    renderOutput();
  }
}

const sortable = Sortable.create($('output-strip'), {
  animation: 170,
  direction: 'horizontal',
  scroll: true,
  scrollSensitivity: 55,
  scrollSpeed: 14,
  ghostClass: 'sortable-ghost',
  chosenClass: 'sortable-chosen',
  filter: '.output-remove',
  onEnd(event) {
    if (event.oldIndex == null || event.newIndex == null || event.oldIndex === event.newIndex || generating) return;
    const reordered = output.slice();
    const [item] = reordered.splice(event.oldIndex, 1);
    reordered.splice(event.newIndex, 0, item);
    updateOutput(reordered);
  }
});

$('add-file').addEventListener('click', () => $('file-input').click());
$('file-input').addEventListener('change', (event) => addFiles(event.target.files));
$('select-all').addEventListener('click', () => {
  const file = files.get(activeId);
  if (!file) return;
  selected = new Set(Array.from({ length: file.pageCount }, (_, i) => i + 1));
  lastSelected = null;
  refreshSelection();
});
$('clear-selection').addEventListener('click', () => { selected.clear(); lastSelected = null; refreshSelection(); });
$('add-start').addEventListener('click', () => addSelected('start'));
$('add-end').addEventListener('click', () => addSelected('end'));
$('undo').addEventListener('click', undo);
$('redo').addEventListener('click', redo);
$('clear-output').addEventListener('click', () => {
  if (!output.length || generating) return;
  if (window.confirm(`Clear all ${output.length} pages from the output? You can undo this action.`)) updateOutput([]);
});
$('generate').addEventListener('click', generate);
$('close-preview').addEventListener('click', () => $('preview-dialog').close());
$('preview-dialog').addEventListener('click', (event) => { if (event.target === $('preview-dialog')) $('preview-dialog').close(); });
document.addEventListener('keydown', (event) => {
  if (event.target.matches('input,textarea,[contenteditable="true"]')) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    if (event.shiftKey) redo(); else undo();
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
    event.preventDefault(); redo();
  }
});

function hasFileTransfer(event) {
  return [...(event.dataTransfer?.types || [])].includes('Files');
}
document.addEventListener('dragenter', (event) => {
  if (!hasFileTransfer(event)) return;
  event.preventDefault();
  dragDepth++;
  $('drop-overlay').hidden = false;
});
document.addEventListener('dragover', (event) => {
  if (!hasFileTransfer(event)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
});
document.addEventListener('dragleave', (event) => {
  if (!hasFileTransfer(event)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) $('drop-overlay').hidden = true;
});
document.addEventListener('drop', (event) => {
  if (!hasFileTransfer(event)) return;
  event.preventDefault();
  dragDepth = 0;
  $('drop-overlay').hidden = true;
  addFiles(event.dataTransfer.files);
});
window.addEventListener('blur', () => { dragDepth = 0; $('drop-overlay').hidden = true; });

renderFiles();
renderPages();
renderOutput();
