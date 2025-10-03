'use strict';

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

const els = {
  apiKey: document.getElementById('apiKey'),
  toggleKey: document.getElementById('toggleKey'),
  model: document.getElementById('model'),
  concurrency: document.getElementById('concurrency'),
  concurrencyValue: document.getElementById('concurrencyValue'),
  categories: document.getElementById('categories'),
  modeManual: document.getElementById('modeManual'),
  modeAuto: document.getElementById('modeAuto'),
  autoHint: document.getElementById('autoHint'),
  pickFolder: document.getElementById('pickFolder'),
  start: document.getElementById('start'),
  stop: document.getElementById('stop'),
  folderPath: document.getElementById('folderPath'),
  imageCount: document.getElementById('imageCount'),
  progressBar: document.getElementById('progressBar'),
  progressText: document.getElementById('progressText'),
  grid: document.getElementById('grid'),
  compatNote: document.getElementById('compatNote'),
  galleryHint: document.getElementById('galleryHint'),
  summaryCats: document.getElementById('summaryCats'),
  applySection: document.getElementById('applySection'),
  applyBtn: document.getElementById('applyBtn'),
  applyAction: document.getElementById('applyAction'),
};

let rootHandle = null;
let rootPath = null;
let files = [];
let isRunning = false;
let cancelRequested = false;
let analysisCache = new Map();
let imageURLs = new Map();
const CACHE_KEY = 'gemini_image_analysis_cache';
const MAX_CACHE_SIZE = 10000;
let cacheSaveTimer = null;

init();

function init() {
  if (!isElectron && !('showDirectoryPicker' in window)) {
    els.compatNote.hidden = false;
  }

  const savedKey = localStorage.getItem('gemini_api_key');
  if (savedKey) els.apiKey.value = savedKey;
  
  loadPersistentCache();

  document.documentElement.setAttribute('data-theme', 'dark');

  els.toggleKey.addEventListener('click', () => {
    els.apiKey.type = els.apiKey.type === 'password' ? 'text' : 'password';
  });

  els.concurrency.addEventListener('input', () => {
    els.concurrencyValue.textContent = String(els.concurrency.value);
    updateRangeProgress();
  });
  
  updateRangeProgress();

  els.modeManual.addEventListener('change', updateCategoryMode);
  els.modeAuto.addEventListener('change', updateCategoryMode);

  els.pickFolder.addEventListener('click', onPickFolder);
  els.start.addEventListener('click', onStart);
  els.stop.addEventListener('click', onStop);
  els.applyBtn.addEventListener('click', onApply);
}

function updateRangeProgress() {
  const value = els.concurrency.value;
  const min = els.concurrency.min || 1;
  const max = els.concurrency.max || 5;
  const progress = ((value - min) / (max - min)) * 100;
  els.concurrency.style.setProperty('--range-progress', `${progress}%`);
}

function updateCategoryMode() {
  const isAuto = els.modeAuto.checked;
  els.categories.disabled = isAuto;
  els.autoHint.hidden = !isAuto;
  if (isAuto) {
    els.categories.style.opacity = '0.5';
  } else {
    els.categories.style.opacity = '1';
  }
}

async function onPickFolder() {
  try {
    els.galleryHint.textContent = 'Scanning...';
    clearImageURLs();
    files = [];
    els.grid.innerHTML = '';
    els.applySection.hidden = true;
    els.summaryCats.innerHTML = '';
    const startAt = performance.now();

    if (isElectron) {
      rootPath = await window.electronAPI.pickFolder();
      if (!rootPath) { els.galleryHint.textContent = 'Ready'; return; }
      els.folderPath.textContent = rootPath;
      const scanned = await window.electronAPI.scanImages(rootPath);
      const fragment = document.createDocumentFragment();
      for (const it of scanned) {
        const entry = { abs: it.abs, name: it.name, path: it.rel };
        files.push(entry);
        addGridItem(entry, fragment);
      }
      els.grid.appendChild(fragment);
    } else {
      rootHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      els.folderPath.textContent = await getHandlePath(rootHandle);
      const fragment = document.createDocumentFragment();
      for await (const f of enumerateImages(rootHandle)) {
        files.push(f);
        addGridItem(f, fragment);
      }
      els.grid.appendChild(fragment);
    }
    
    setupLazyLoading();

    const ms = Math.round(performance.now() - startAt);
    els.galleryHint.textContent = `Found ${files.length} images in ${ms} ms`;
    els.imageCount.textContent = String(files.length);
    
    if (files.length > 0) {
      els.start.hidden = false;
      els.start.disabled = false;
    } else {
      els.start.hidden = true;
    }
  } catch (err) {
    console.error(err);
  }
}

async function* enumerateImages(dirHandle, path = '') {
  for await (const [name, handle] of dirHandle.entries()) {
    if (name === 'OrganizedImages') continue;
    const newPath = path ? `${path}/${name}` : name;
    if (handle.kind === 'directory') {
      yield* enumerateImages(handle, newPath);
    } else if (handle.kind === 'file') {
      if (isImageName(name)) {
        const file = await handle.getFile();
        yield { handle, file, name, path: newPath };
      }
    }
  }
}

function isImageName(name) {
  const lower = name.toLowerCase();
  return (
    lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') ||
    lower.endsWith('.webp') || lower.endsWith('.gif')
  );
}

function addGridItem(entry, container = els.grid) {
  const item = document.createElement('div');
  item.className = 'item';
  const thumb = document.createElement('div');
  thumb.className = 'thumb';
  const img = document.createElement('img');
  img.alt = entry.name;
  img.loading = 'lazy';
  img.dataset.src = isElectron ? entry.abs : 'pending';
  thumb.appendChild(img);
  const meta = document.createElement('div');
  meta.className = 'meta';
  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = entry.name;
  const badge = document.createElement('div');
  badge.className = 'badge badge--ready';
  badge.textContent = 'Ready';
  meta.appendChild(name);
  meta.appendChild(badge);
  item.appendChild(thumb);
  item.appendChild(meta);
  container.appendChild(item);

  entry._els = { item, badge, img };
}

async function createPreview(file) {
  const url = URL.createObjectURL(file);
  imageURLs.set(file.name, url);
  return url;
}

async function createPreviewFromPath(absPath) {
  const esc = absPath.replace(/\\/g, '/');
  return `file://${esc}`;
}

function clearImageURLs() {
  for (const url of imageURLs.values()) {
    URL.revokeObjectURL(url);
  }
  imageURLs.clear();
}

function setupLazyLoading() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const gridItem = files.find(f => f._els && f._els.img === img);
        if (gridItem && !img.src) {
          loadImagePreview(gridItem, img);
          observer.unobserve(img);
        }
      }
    });
  }, { rootMargin: '100px' });

  files.forEach(entry => {
    if (entry._els && entry._els.img) {
      observer.observe(entry._els.img);
    }
  });
}

async function loadImagePreview(entry, img) {
  try {
    if (isElectron) {
      const url = await createPreviewFromPath(entry.abs);
      img.src = url;
    } else {
      const url = await createPreview(entry.file);
      img.src = url;
    }
  } catch (err) {
    console.error('Failed to load preview:', err);
  }
}

async function onStart() {
  if (!isElectron && !rootHandle) return;
  if (isElectron && !rootPath) return;
  const apiKey = els.apiKey.value.trim();
  if (!apiKey) { alert('Enter Gemini API key'); return; }
  localStorage.setItem('gemini_api_key', apiKey);

  isRunning = true;
  cancelRequested = false;
  els.start.hidden = true;
  els.stop.hidden = false;
  els.stop.disabled = false;
  els.applySection.hidden = true;
  els.summaryCats.innerHTML = '';

  const modelId = els.model.value;
  const concurrency = Number(els.concurrency.value) || 3;
  const isAutoMode = els.modeAuto.checked;
  const categories = isAutoMode ? [] : parseCategories(els.categories.value);
  const total = files.length;
  let done = 0;
  updateProgress(done, total);

  const worker = async (entry) => {
    if (cancelRequested) return;
    
    const cacheKey = `${entry.path || entry.name}_${isAutoMode ? 'auto' : categories.join(',')}`;
    
    if (analysisCache.has(cacheKey)) {
      const cached = analysisCache.get(cacheKey);
      entry.category = cached;
      setBadge(entry, cached, 'badge--ok');
      done += 1;
      updateProgress(done, total);
      return;
    }
    
    setBadge(entry, 'Analyzing', 'badge--work');
    try {
      const sourceFile = await loadFileForEntry(entry);
      const downscaled = await downscaleForAi(sourceFile, 1280);
      const category = await categorizeWithGemini(downscaled, apiKey, modelId, categories, isAutoMode);
      const safeCategory = isAutoMode ? category : (categories.includes(category) ? category : 'other');
      entry.category = safeCategory;
      analysisCache.set(cacheKey, safeCategory);
      debouncedSaveCache();
      setBadge(entry, safeCategory, 'badge--ok');
    } catch (e) {
      console.error(e);
      entry.category = 'error';
      setBadge(entry, 'Error', 'badge--error');
    } finally {
      done += 1;
      updateProgress(done, total);
    }
  };

  await processPool(files, worker, concurrency);
  savePersistentCache();
  isRunning = false;
  els.start.hidden = false;
  els.start.disabled = false;
  els.stop.hidden = true;
  els.stop.textContent = 'Stop';

  const categorizedCount = files.filter(f => f.category && f.category !== 'error').length;
  if (categorizedCount > 0) {
    renderCategorySummary();
    els.applySection.hidden = false;
    if (cancelRequested) {
      els.galleryHint.textContent = `Stopped. ${categorizedCount} images categorized.`;
    }
  } else if (!cancelRequested) {
    renderCategorySummary();
    els.applySection.hidden = false;
  }
}

function onStop() {
  cancelRequested = true;
  els.stop.disabled = true;
  els.stop.textContent = 'Stopping...';
}

async function onApply() {
  const isMove = els.applyAction.value === 'move';
  const unapplied = files.filter(f => f.category && f.category !== 'error' && !f.applied);
  if (unapplied.length === 0) {
    alert('All images have already been applied.');
    return;
  }
  const confirmed = confirm(`${isMove ? 'Move' : 'Copy'} ${unapplied.length} images into category folders?`);
  if (!confirmed) return;

  els.applyBtn.disabled = true;
  els.applyBtn.textContent = 'Applying...';
  const outRoot = isElectron ? null : await ensureDir(rootHandle, 'OrganizedImages');
  let applied = 0;
  const appliedEntries = [];

  for (const entry of unapplied) {
    try {
      if (isElectron) {
        const targetName = await window.electronAPI.uniqueNameInCategory(rootPath, entry.category, entry.name);
        if (isMove) {
          await window.electronAPI.moveOrganizedFile(rootPath, entry.category, entry.abs, targetName);
        } else {
          await window.electronAPI.writeOrganizedCopy(rootPath, entry.category, entry.abs, targetName);
        }
      } else {
        if (isMove) {
          await moveToCategory(outRoot, entry.category, entry);
        } else {
          await copyToCategory(outRoot, entry.category, entry);
        }
      }
      entry.applied = true;
      appliedEntries.push(entry);
      applied += 1;
    } catch (e) {
      console.error(e);
      setBadge(entry, 'Error', 'badge--error');
    }
  }

  if (isMove && applied > 0) {
    for (const entry of appliedEntries) {
      if (entry._els && entry._els.item) {
        entry._els.item.remove();
      }
      const index = files.indexOf(entry);
      if (index > -1) {
        files.splice(index, 1);
      }
    }
    
    els.imageCount.textContent = String(files.length);
    
    const remainingCategorized = files.filter(f => f.category && f.category !== 'error').length;
    
    if (remainingCategorized === 0) {
      els.applySection.hidden = true;
      
      const errorCount = files.filter(f => f.category === 'error').length;
      if (errorCount > 0) {
        els.galleryHint.textContent = `All images moved. ${errorCount} error${errorCount > 1 ? 's' : ''} remaining.`;
      } else {
        els.galleryHint.textContent = 'All images moved. Select a new folder to continue.';
      }
      els.summaryCats.innerHTML = '';
    } else {
      renderCategorySummary();
    }
  } else if (!isMove && applied > 0) {
    for (const entry of appliedEntries) {
      setBadge(entry, `✓ ${entry.category}`, 'badge--ok');
    }
  }

  els.applyBtn.textContent = isMove ? `Moved ${applied}` : `Copied ${applied}`;
  setTimeout(() => {
    els.applyBtn.textContent = 'Apply';
    els.applyBtn.disabled = false;
  }, 2000);
}

function renderCategorySummary() {
  const counts = {};
  for (const entry of files) {
    if (entry.category && entry.category !== 'error') {
      counts[entry.category] = (counts[entry.category] || 0) + 1;
    }
  }
  els.summaryCats.innerHTML = '';
  for (const [cat, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    const chip = document.createElement('div');
    chip.className = 'chip';
    const dot = document.createElement('div');
    dot.className = 'dot';
    const label = document.createElement('span');
    label.textContent = cat;
    const countSpan = document.createElement('span');
    countSpan.className = 'count';
    countSpan.textContent = count;
    chip.appendChild(dot);
    chip.appendChild(label);
    chip.appendChild(countSpan);
    els.summaryCats.appendChild(chip);
  }
}

function setBadge(entry, text, cls) {
  const b = entry._els && entry._els.badge;
  if (!b) return;
  b.className = `badge ${cls}`;
  b.textContent = text;
}

function updateProgress(done, total) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  els.progressBar.style.width = pct + '%';
  els.progressText.textContent = `${done} / ${total}`;
}

function parseCategories(text) {
  return text
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
}

async function ensureDir(parentHandle, name) {
  return await parentHandle.getDirectoryHandle(name, { create: true });
}

async function copyToCategory(outRoot, category, entry) {
  const catDir = await ensureDir(outRoot, category);
  const targetName = await uniqueName(catDir, entry.name);
  const fileHandle = await catDir.getFileHandle(targetName, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    const buf = await entry.file.arrayBuffer();
    await writable.write(buf);
  } finally {
    await writable.close();
  }
}

async function moveToCategory(outRoot, category, entry) {
  await copyToCategory(outRoot, category, entry);
  if (entry.handle && entry.handle.remove) {
    await entry.handle.remove();
  }
}

async function uniqueName(dir, baseName) {
  const dot = baseName.lastIndexOf('.');
  const stem = dot > 0 ? baseName.slice(0, dot) : baseName;
  const ext = dot > 0 ? baseName.slice(dot) : '';
  let attempt = baseName;
  for (let i = 1; i < 1000; i++) {
    try {
      await dir.getFileHandle(attempt);
      attempt = `${stem}-${i}${ext}`;
    } catch {
      return attempt;
    }
  }
  return `${stem}-${Date.now()}${ext}`;
}

async function processPool(items, worker, concurrency) {
  const q = items.slice();
  const runners = new Array(Math.min(concurrency, q.length)).fill(0).map(async () => {
    while (q.length && !cancelRequested) {
      const item = q.shift();
      if (!item) break;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

async function downscaleForAi(file, maxSize) {
  if (!/^image\//.test(file.type)) return file;
  
  if (file.size < 50000 && Math.max(file.width || 0, file.height || 0) <= maxSize) {
    return file;
  }
  
  const img = await readImageFromFile(file);
  const { canvas, ctx, width, height } = createCanvasForImage(img, maxSize);
  
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  
  const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));
  return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
}

function readImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

function createCanvasForImage(img, maxSize) {
  const ratio = img.width / img.height;
  let width = img.width;
  let height = img.height;
  if (Math.max(width, height) > maxSize) {
    if (width > height) {
      width = maxSize;
      height = Math.round(maxSize / ratio);
    } else {
      height = maxSize;
      width = Math.round(maxSize * ratio);
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  return { canvas, ctx, width, height };
}

async function categorizeWithGemini(file, apiKey, modelId, categories, isAutoMode) {
  const base64 = await toBase64(file);
  let prompt;
  if (isAutoMode) {
    prompt = `You are an image categorization assistant. Analyze this image and assign it ONE broad category.

IMPORTANT RULES:
1. Screenshots (computer/phone UI, app interfaces, code, text on screen, software, charts with text) → "screenshots"
2. Illustrations/drawings/cartoons (digital art, graphic design, logos, icons, diagrams) → "art"
3. Real photographs of people → "people"
4. Real photographs of nature/outdoors → "nature"
5. Real photographs of food → "food"
6. Real photographs of buildings → "architecture"
7. Real photographs of objects/products → "objects"
8. Documents (papers, forms, receipts, text documents) → "documents"
9. Real photographs of animals → "animals"

Examples:
- App interface or software UI → "screenshots"
- Code editor screenshot → "screenshots"
- Robot illustration/cartoon → "art"
- Diagram or infographic → "art"
- Icon or logo → "art"
- Photo of a laptop → "objects"
- Photo of a person → "people"

Return ONLY the category name in lowercase, no punctuation or extra words.`;
  } else {
    prompt = [
      'You are an image categorization assistant. Choose the single best category',
      'for this image from the list below. Return only the category name exactly,',
      'with no punctuation or extra words. If none fit, return "other".',
      '',
      'Categories:',
      categories.map(c => `- ${c}`).join('\n'),
    ].join('\n');
  }

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inline_data: { mime_type: file.type || 'image/jpeg', data: base64 } },
        ],
      },
    ],
    generationConfig: { temperature: 0 },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let attempt = 0;
  let lastErr = null;
  
  while (attempt < 3) {
    if (cancelRequested) throw new Error('Cancelled');
    
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (!res.ok) {
        const text = await res.text();
        const error = new Error(`Gemini error ${res.status}: ${text}`);
        
        if (res.status === 429 || res.status >= 500) {
          throw error;
        } else {
          throw error;
        }
      }
      
      const data = await res.json();
      const text = (((data || {}).candidates || [])[0] || {}).content?.parts?.[0]?.text || '';
      const norm = (text || '').trim().toLowerCase().replace(/[^a-z0-9_\- ]+/g, '').split(/\s+/)[0] || 'other';
      return norm;
      
    } catch (e) {
      lastErr = e;
      attempt += 1;
      
      if (attempt < 3) {
        const backoffTime = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
        console.log(`Retry ${attempt}/3 for Gemini API after ${backoffTime}ms...`);
        await delay(backoffTime);
      }
    }
  }
  
  throw lastErr || new Error('Gemini request failed after 3 attempts');
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = String(result).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function getHandlePath(handle) {
  const parts = [handle.name || ''];
  let current = handle;
  while (current && current.parent) {
    parts.unshift(current.parent.name || '');
    current = current.parent;
  }
  return parts.filter(Boolean).join('/');
}

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function loadFileForEntry(entry) {
  if (!isElectron) return entry.file;
  const buf = await window.electronAPI.readFileBytes(entry.abs);
  const mime = guessMimeFromName(entry.name);
  const blob = new Blob([buf], { type: mime });
  return new File([blob], entry.name, { type: mime });
}

function guessMimeFromName(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

function loadPersistentCache() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length <= MAX_CACHE_SIZE) {
        analysisCache = new Map(parsed);
      }
    }
  } catch (err) {
    console.error('Failed to load cache:', err);
  }
}

function debouncedSaveCache() {
  if (cacheSaveTimer) clearTimeout(cacheSaveTimer);
  cacheSaveTimer = setTimeout(() => {
    savePersistentCache();
  }, 2000);
}

function savePersistentCache() {
  try {
    if (analysisCache.size > MAX_CACHE_SIZE) {
      const entries = Array.from(analysisCache.entries());
      analysisCache = new Map(entries.slice(-MAX_CACHE_SIZE));
    }
    const serialized = JSON.stringify(Array.from(analysisCache.entries()));
    localStorage.setItem(CACHE_KEY, serialized);
  } catch (err) {
    console.error('Failed to save cache:', err);
  }
}
