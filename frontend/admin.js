// Loaded on demand by app.js (loadAdminModule) together with admin-panel.html.
const ADMIN_STORAGE_KEY = 'jewelry_admin_secret';

function getAdminSecret(){
  return sessionStorage.getItem(ADMIN_STORAGE_KEY) || '';
}

function adminFetch(url, options = {}){
  const headers = { ...(options.headers || {}), 'X-Admin-Secret': getAdminSecret() };
  return fetch(url, { ...options, headers });
}

function adminOpenEntry(){
  if (getAdminSecret()){
    adminFetch(`${API_URL}/admin/ping`, { method: 'POST' }).then(res => {
      if (res.ok) { openAdminPanel(); } else { sessionStorage.removeItem(ADMIN_STORAGE_KEY); showAdminLogin(); }
    }).catch(() => showAdminLogin());
    return;
  }
  showAdminLogin();
}

function showAdminLogin(){
  document.getElementById('adminLoginErr').style.display = 'none';
  document.getElementById('adminPasswordInput').value = '';
  document.getElementById('overlay').classList.add('open');
  document.getElementById('adminLoginModal').classList.add('open');
  setTimeout(() => document.getElementById('adminPasswordInput').focus(), 100);
}

async function submitAdminLogin(){
  const pw = document.getElementById('adminPasswordInput').value;
  const errBox = document.getElementById('adminLoginErr');
  if (!pw) return;
  sessionStorage.setItem(ADMIN_STORAGE_KEY, pw);
  try {
    const res = await adminFetch(`${API_URL}/admin/ping`, { method: 'POST' });
    if (res.ok) {
      closeAll();
      openAdminPanel();
    } else {
      sessionStorage.removeItem(ADMIN_STORAGE_KEY);
      errBox.style.display = 'block';
    }
  } catch (err) {
    sessionStorage.removeItem(ADMIN_STORAGE_KEY);
    errBox.textContent = 'Could not reach the server. Try again.';
    errBox.style.display = 'block';
  }
}

function adminLogout(){
  sessionStorage.removeItem(ADMIN_STORAGE_KEY);
  document.getElementById('adminPanel').classList.remove('open');
  document.body.style.overflow = '';
}

function toggleAdminPwVisibility(){
  const input = document.getElementById('adminPasswordInput');
  const eye = document.getElementById('adminPwEye');
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  eye.innerHTML = showing
    ? '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>'
    : '<path d="M17.9 17.9A10.4 10.4 0 0112 19c-7 0-11-7-11-7a19 19 0 015.1-5.6M9.9 4.2A10 10 0 0112 4c7 0 11 7 11 7a19 19 0 01-2.5 3.4M14.1 14.1a3 3 0 11-4.2-4.2"/><path d="M2 2l20 20"/>';
}

function openAdminPanel(){
  document.getElementById('adminPanel').classList.add('open');
  document.body.style.overflow = 'hidden';
  showAdminTab('add');
}

function showAdminTab(tab){
  document.getElementById('tabAddBtn').classList.toggle('active', tab === 'add');
  document.getElementById('tabManageBtn').classList.toggle('active', tab === 'manage');
  document.getElementById('tabOrdersBtn').classList.toggle('active', tab === 'orders');
  document.getElementById('tabCustomersBtn').classList.toggle('active', tab === 'customers');
  document.getElementById('adminAddView').style.display = tab === 'add' ? 'block' : 'none';
  document.getElementById('adminManageView').style.display = tab === 'manage' ? 'block' : 'none';
  document.getElementById('adminOrdersView').style.display = tab === 'orders' ? 'block' : 'none';
  document.getElementById('adminCustomersView').style.display = tab === 'customers' ? 'block' : 'none';
  if (tab === 'add') renderPendingBanner();
  if (tab === 'manage') loadManageList();
  if (tab === 'orders') loadOrdersList();
  if (tab === 'customers') loadCustomersList();
}


async function loadOrdersList(){
  const list = document.getElementById('ordersList');
  list.innerHTML = '<p style="color:var(--muted);">Loading…</p>';
  try {
    const res = await adminFetch(`${API_URL}/admin/orders`);
    if (!res.ok) throw new Error('failed');
    const orders = await res.json();
    if (orders.length === 0){
      list.innerHTML = '<p style="color:var(--muted);">No orders yet.</p>';
      return;
    }
    list.innerHTML = orders.map(o => `
      <div class="a-prow" style="flex-direction:column;align-items:stretch;gap:8px;">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;">
          <div>
            <div class="a-pname">Order #${o.id}  ${escapeHtml(o.customer_name)}</div>
            <div class="a-pmeta">${escapeHtml(o.customer_phone)}  ${new Date(o.created_at).toLocaleString()}</div>
          </div>
          <div style="text-align:right;">
            <div class="a-pname">${fmt(o.subtotal)}</div>
            <select onchange="updateOrderStatus(${o.id}, this.value)" style="margin-top:4px;">
              <option value="pending" ${o.status==='pending'?'selected':''}>Pending</option>
              <option value="paid" ${o.status==='paid'?'selected':''}>Paid</option>
              <option value="cancelled" ${o.status==='cancelled'?'selected':''}>Cancelled</option>
            </select>
          </div>
        </div>
        <div class="a-pmeta">${o.items.map(i => `${escapeHtml(i.name)} × ${i.quantity} (${fmt(i.price)})`).join(', ')}</div>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = '<p style="color:#a3423f;">Could not load orders.</p>';
  }
}

async function updateOrderStatus(orderId, status){
  const res = await adminFetch(`${API_URL}/admin/orders/${orderId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok){ alert('Could not update order status.'); loadOrdersList(); }
}

async function loadCustomersList(){
  const list = document.getElementById('customersList');
  list.innerHTML = '<p style="color:var(--muted);">Loading…</p>';
  try {
    const res = await adminFetch(`${API_URL}/admin/customers`);
    if (!res.ok) throw new Error('failed');
    const customers = await res.json();
    if (customers.length === 0){
      list.innerHTML = '<p style="color:var(--muted);">No registered customers yet.</p>';
      return;
    }
    list.innerHTML = customers.map(c => `
      <div class="a-prow">
        <div class="a-pinfo">
          <div class="a-pname">${escapeHtml(c.name)}</div>
          <div class="a-pmeta">${escapeHtml(c.phone)}  Registered ${new Date(c.created_at).toLocaleDateString()}</div>
        </div>
        <a class="btn-primary" style="padding:8px 14px;" href="https://wa.me/${c.phone.replace(/^0/, '254').replace(/\D/g,'')}" target="_blank" rel="noopener">WhatsApp</a>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = '<p style="color:#a3423f;">Could not load customers.</p>';
  }
}

const ADMIN_MAX_IMAGES = 10;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_INPUT_BYTES = 150 * 1024 * 1024;

function isVideoFile(file){ return file.type.startsWith('video/'); }

function invalidImageReason(file){
  if (isVideoFile(file)){
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) return `"${file.name}" isn't a supported video type (mp4, webm, mov only).`;
    if (file.size > MAX_VIDEO_INPUT_BYTES) return `"${file.name}" is over the 150MB limit -- trim it before uploading.`;
    return null;
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return `"${file.name}" isn't a supported file type (jpg, png, webp, gif, mp4, webm, mov only).`;
  if (file.size > MAX_IMAGE_BYTES) return `"${file.name}" is over the 5MB limit.`;
  return null;
}

// Holds the picked-but-not-yet-uploaded files for each form, in upload
// order. Index 0 is always what will be sent as the primary/main photo.
// Keyed by 'ap' for the Add Product form, or `ed-${productId}` for an
// Edit Product panel's "Add Photos" section.
const mediaOrderState = {};

function mediaPreviewHtml(file, key, index){
  const url = URL.createObjectURL(file);
  const inner = isVideoFile(file)
    ? `<div class="preview-video-wrap"><video src="${url}" muted playsinline preload="metadata"></video><span class="preview-video-badge">▶ VIDEO</span></div>`
    : `<img src="${url}">`;
  const control = index === 0
    ? `<div class="a-preview-main-badge">MAIN</div>`
    : `<div class="a-preview-setmain" onclick="setMainPreview('${key}', ${index})">★ Set as main</div>`;
  return `<div class="a-preview-item">${inner}${control}</div>`;
}

function renderMediaPreview(key, containerId){
  const files = mediaOrderState[key] || [];
  document.getElementById(containerId).innerHTML =
    files.map((f, i) => mediaPreviewHtml(f, key, i)).join('');
}

function setMainPreview(key, index){
  const files = mediaOrderState[key];
  if (!files || index <= 0 || index >= files.length) return;
  const [chosen] = files.splice(index, 1);
  files.unshift(chosen);
  const containerId = key === 'ap' ? 'apPreviewRow' : `edPreviewRow-${key.replace('ed-', '')}`;
  renderMediaPreview(key, containerId);
}

document.getElementById('apImageFiles').addEventListener('change', function(e){
  const files = Array.from(e.target.files);
  const status = document.getElementById('apStatus');
  if (files.length > ADMIN_MAX_IMAGES){
    status.textContent = `❌ Choose at most ${ADMIN_MAX_IMAGES} files.`;
    e.target.value = '';
    document.getElementById('apPreviewRow').innerHTML = '';
    return;
  }
  const badFile = files.map(invalidImageReason).find(Boolean);
  if (badFile){
    status.textContent = `❌ ${badFile}`;
    e.target.value = '';
    document.getElementById('apPreviewRow').innerHTML = '';
    return;
  }
  status.textContent = '';
  mediaOrderState['ap'] = files;
  renderMediaPreview('ap', 'apPreviewRow');
});

function fileToBase64(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function parseJsonResponse(res, context){
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    const snippet = text.trim().slice(0, 120) || `HTTP ${res.status}`;
    throw new Error(`${context} failed (${res.status}): ${snippet}`);
  }
}

const UPLOAD_MAX_DIMENSION = 1600;
const UPLOAD_JPEG_QUALITY = 0.82;

function resizeImageForUpload(file, maxDim = UPLOAD_MAX_DIMENSION, quality = UPLOAD_JPEG_QUALITY){
  return new Promise((resolve, reject) => {
    if (file.type === 'image/gif'){
      fileToBase64(file).then(base64 => resolve({ base64, contentType: file.type })).catch(reject);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim){
        if (width >= height){ height = Math.round(height * (maxDim / width)); width = maxDim; }
        else { width = Math.round(width * (maxDim / height)); height = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (!dataUrl || dataUrl === 'data:,'){
        fileToBase64(file).then(base64 => resolve({ base64, contentType: file.type })).catch(reject);
        return;
      }
      resolve({ base64: dataUrl.split(',')[1], contentType: 'image/jpeg' });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      fileToBase64(file).then(base64 => resolve({ base64, contentType: file.type })).catch(reject);
    };
    img.src = objectUrl;
  });
}

const VIDEO_MAX_DIMENSION = 720;
const VIDEO_BYTE_BUDGET = 2_800_000;
const VIDEO_BITRATE_MAX = 1_800_000;
const VIDEO_BITRATE_MIN = 250_000;
const VIDEO_FPS = 30;
const VIDEO_SKIP_COMPRESSION_UNDER_BYTES = 2 * 1024 * 1024;
const VIDEO_MAX_VIABLE_SECONDS = Math.floor((VIDEO_BYTE_BUDGET * 8) / VIDEO_BITRATE_MIN);

function pickSupportedVideoMimeType(){
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  for (const type of candidates){
    if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

function compressVideoForUpload(file){
  return new Promise((resolve, reject) => {
    const fallbackToOriginal = () => fileToBase64(file)
      .then(base64 => resolve({ base64, contentType: file.type }))
      .catch(() => reject(new Error(`Could not read "${file.name}".`)));

    const mimeType = pickSupportedVideoMimeType();
    const canCapture = typeof HTMLCanvasElement !== 'undefined' && HTMLCanvasElement.prototype.captureStream;
    if (file.size <= VIDEO_SKIP_COMPRESSION_UNDER_BYTES || !mimeType || !canCapture || !window.MediaRecorder){
      fallbackToOriginal();
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = objectUrl;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(objectUrl);
      if (result) resolve(result); else fallbackToOriginal();
    };

    video.onerror = () => finish(null);

    video.onloadedmetadata = () => {
      let { videoWidth: width, videoHeight: height, duration } = video;
      if (!width || !height){ finish(null); return; }
      if (!duration || !isFinite(duration) || duration <= 0){
        duration = 30;
      }

      if (duration > VIDEO_MAX_VIABLE_SECONDS){
        settled = true;
        URL.revokeObjectURL(objectUrl);
        reject(new Error(
          `"${file.name}" is about ${Math.round(duration)}s long -- even fully compressed that's too large for a single upload (Vercel's ~4.5MB request limit). ` +
          `Please trim it to under ~${VIDEO_MAX_VIABLE_SECONDS}s and try again.`
        ));
        return;
      }

      const targetBitrate = Math.min(
        VIDEO_BITRATE_MAX,
        Math.max(VIDEO_BITRATE_MIN, Math.floor((VIDEO_BYTE_BUDGET * 8) / duration))
      );

      if (width > VIDEO_MAX_DIMENSION || height > VIDEO_MAX_DIMENSION){
        if (width >= height){ height = Math.round(height * (VIDEO_MAX_DIMENSION / width)); width = VIDEO_MAX_DIMENSION; }
        else { width = Math.round(width * (VIDEO_MAX_DIMENSION / height)); height = VIDEO_MAX_DIMENSION; }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      let combinedStream;
      try {
        const canvasStream = canvas.captureStream(VIDEO_FPS);
        combinedStream = canvasStream;
        if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined'){
          const Ctx = window.AudioContext || window.webkitAudioContext;
          const audioCtx = new Ctx();
          audioCtx.resume().catch(() => {});
          const source = audioCtx.createMediaElementSource(video);
          const dest = audioCtx.createMediaStreamDestination();
          source.connect(dest);
          dest.stream.getAudioTracks().forEach(t => combinedStream.addTrack(t));
        }
      } catch (err) {
        finish(null);
        return;
      }

      let recorder;
      try {
        recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: targetBitrate });
      } catch (err) {
        finish(null);
        return;
      }

      const chunks = [];
      let recordedBytes = 0;
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0){ chunks.push(e.data); recordedBytes += e.data.size; }
      };
      recorder.onerror = () => finish(null);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
        if (!blob.size){ finish(null); return; }
        if (blob.size > VIDEO_BYTE_BUDGET * 1.3){
          settled = true;
          URL.revokeObjectURL(objectUrl);
          reject(new Error(`"${file.name}" compressed to ${(blob.size / (1024*1024)).toFixed(1)}MB, still too large to upload. Try a shorter clip.`));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => finish({ base64: reader.result.split(',')[1], contentType: mimeType.split(';')[0] });
        reader.onerror = () => finish(null);
        reader.readAsDataURL(blob);
      };

      let rafId;
      const drawFrame = () => {
        if (video.paused || video.ended) return;
        ctx.drawImage(video, 0, 0, width, height);
        rafId = requestAnimationFrame(drawFrame);
      };

      video.onended = () => { cancelAnimationFrame(rafId); if (recorder.state !== 'inactive') recorder.stop(); };
      video.onplay = () => { recorder.start(); drawFrame(); };

      video.play().catch(() => finish(null));
    };
  });
}

// ── Offline queue ───────────────────────────────────────────────────────
// Lets an admin add a product with zero connectivity (e.g. at a market
// stall). The product's fields + chosen files are saved in IndexedDB
// (structured-clone supports File/Blob directly, so no base64 needed) and
// pushed to the server automatically once we're back online.
const OFFLINE_DB_NAME = 'sjgems-offline';
const OFFLINE_STORE = 'pendingProducts';
let _offlineSyncing = false;

function openOfflineDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(OFFLINE_STORE)){
        req.result.createObjectStore(OFFLINE_STORE, { keyPath: 'localId', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function offlineQueueAdd(entry){
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, 'readwrite');
    const req = tx.objectStore(OFFLINE_STORE).add(entry);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function offlineQueueGetAll(){
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, 'readonly');
    const req = tx.objectStore(OFFLINE_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function offlineQueuePut(entry){
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, 'readwrite');
    const req = tx.objectStore(OFFLINE_STORE).put(entry);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function offlineQueueDelete(localId){
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, 'readwrite');
    const req = tx.objectStore(OFFLINE_STORE).delete(localId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function renderPendingBanner(){
  const banner = document.getElementById('apPendingBanner');
  if (!banner) return;
  let items;
  try { items = await offlineQueueGetAll(); } catch { items = []; }

  if (items.length === 0){ banner.style.display = 'none'; banner.innerHTML = ''; return; }
  items.sort((a, b) => a.queuedAt - b.queuedAt);

  banner.style.display = 'block';
  banner.innerHTML = `
    <div class="a-pending-banner-head">
      <strong>📥 ${items.length} product${items.length === 1 ? '' : 's'} waiting to upload</strong>
      <button type="button" class="a-pending-sync-btn" id="apSyncNowBtn" ${navigator.onLine ? '' : 'disabled'}>
        ${navigator.onLine ? 'Sync now' : 'Offline'}
      </button>
    </div>
    <ul class="a-pending-list">
      ${items.map(it => `
        <li>
          <span class="a-pending-item-name">
            ${escapeHtml(it.fields.name)}  ${it.files.length} file${it.files.length === 1 ? '' : 's'}
            ${it.lastError ? `<span class="a-pending-item-err">${escapeHtml(it.lastError)}</span>` : ''}
          </span>
          <span class="a-pending-item-actions">
            ${it.duplicateInfo ? `<button type="button" onclick="resolveOfflineDuplicate(${it.localId}, true)">Add anyway</button>` : ''}
            <button type="button" onclick="discardOfflineProduct(${it.localId})">Discard</button>
          </span>
        </li>
      `).join('')}
    </ul>`;

  const syncBtn = document.getElementById('apSyncNowBtn');
  if (syncBtn) syncBtn.onclick = () => syncPendingProducts();
}

async function discardOfflineProduct(localId){
  await offlineQueueDelete(localId);
  renderPendingBanner();
}

async function resolveOfflineDuplicate(localId, force){
  const items = await offlineQueueGetAll();
  const item = items.find(i => i.localId === localId);
  if (!item) return;
  item.duplicateInfo = null;
  item.lastError = null;
  item.forceNext = force;
  await offlineQueuePut(item);
  syncPendingProducts();
}

async function syncPendingProducts(){
  if (_offlineSyncing || !navigator.onLine) { renderPendingBanner(); return; }
  _offlineSyncing = true;
  const status = document.getElementById('apStatus');
  try {
    const items = (await offlineQueueGetAll()).sort((a, b) => a.queuedAt - b.queuedAt);
    for (const item of items){
      if (!navigator.onLine) break;
      try {
        if (status) status.textContent = `Uploading queued product "${item.fields.name}"...`;
        await postProductAndImages(item.fields, item.files, !!item.forceNext, msg => { if (status) status.textContent = msg; });
        await offlineQueueDelete(item.localId);
        loadProducts();
      } catch (err) {
        if (err instanceof TypeError){
          break; // lost connection again -- leave remaining items queued
        }
        item.lastError = err.duplicate ? err.duplicate.message : err.message;
        item.duplicateInfo = err.duplicate || null;
        await offlineQueuePut(item);
      }
    }
    if (status) status.textContent = '';
  } finally {
    _offlineSyncing = false;
    renderPendingBanner();
  }
}

window.addEventListener('online', () => syncPendingProducts());

// ── Product creation (shared by the live form and the offline sync queue) ─
async function postProductAndImages(fields, files, force, onProgress){
  const productRes = await adminFetch(`${API_URL}/admin/products${force ? '?force=true' : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields)
  });
  const productData = await parseJsonResponse(productRes, 'Product creation');

  if (productRes.status === 409 && productData.detail && typeof productData.detail === 'object'){
    const err = new Error(productData.detail.message);
    err.duplicate = productData.detail;
    throw err;
  }
  if (!productRes.ok){
    const msg = productData.detail && typeof productData.detail === 'object' ? productData.detail.message : productData.detail;
    throw new Error(msg || 'Product creation failed');
  }

  for (let i = 0; i < files.length; i++){
    const file = files[i];
    const kind = isVideoFile(file) ? 'video' : 'image';
    if (onProgress) onProgress(kind === 'video'
      ? `Compressing & uploading video ${i + 1} of ${files.length}...`
      : `Uploading image ${i + 1} of ${files.length}...`);
    const { base64: dataBase64, contentType } = kind === 'video'
      ? await compressVideoForUpload(file)
      : await resizeImageForUpload(file);
    const uploadRes = await adminFetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, contentType, dataBase64 })
    });
    const uploadData = await parseJsonResponse(uploadRes, `${kind === 'video' ? 'Video' : 'Image'} ${i + 1} upload`);
    if (!uploadRes.ok) throw new Error(uploadData.error || `${kind === 'video' ? 'Video' : 'Image'} ${i + 1} upload failed`);

    const imgRes = await adminFetch(`${API_URL}/admin/products/${productData.id}/images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blob_url: uploadData.url, is_primary: i === 0, sort_order: i, media_type: kind })
    });
    if (!imgRes.ok) throw new Error(`Linking ${kind} ${i + 1} failed`);
  }

  return productData;
}

async function submitAddProduct(e, force){
  e.preventDefault();
  const status = document.getElementById('apStatus');
  const submitBtn = document.getElementById('apSubmitBtn');
  // Use the reordered list (from the preview grid), falling back to raw
  // file input order if the user never touched a "Set as main" control.
  const imageFiles = mediaOrderState['ap'] || Array.from(document.getElementById('apImageFiles').files);

  if (!document.getElementById('apName').value || !document.getElementById('apPrice').value){
    status.textContent = '❌ Fill in the required fields.';
    return;
  }
  const apSalePriceVal = document.getElementById('apSalePrice').value;
  if (apSalePriceVal !== '' && parseFloat(apSalePriceVal) >= parseFloat(document.getElementById('apPrice').value)){
    status.textContent = '❌ Sale price must be lower than the regular price.';
    return;
  }
  if (imageFiles.length === 0){
    status.textContent = '❌ Choose at least 1 photo or video.';
    return;
  }
  if (imageFiles.length > ADMIN_MAX_IMAGES){
    status.textContent = `❌ Choose at most ${ADMIN_MAX_IMAGES} files.`;
    return;
  }

  const fields = {
    name: document.getElementById('apName').value,
    description: document.getElementById('apDescription').value,
    price: parseFloat(document.getElementById('apPrice').value),
    sale_price: apSalePriceVal === '' ? null : parseFloat(apSalePriceVal),
    category: document.getElementById('apCategory').value,
    quantity: parseInt(document.getElementById('apQuantity').value, 10) || 0,
    is_new: document.getElementById('apIsNew').checked
  };

  const queueForLater = async (msg) => {
    await offlineQueueAdd({ fields, files: imageFiles, queuedAt: Date.now(), lastError: null, duplicateInfo: null, forceNext: false });
    status.textContent = msg;
    document.getElementById('addProductForm').reset();
    document.getElementById('apPreviewRow').innerHTML = '';
    delete mediaOrderState['ap'];
    renderPendingBanner();
  };

  if (!navigator.onLine){
    await queueForLater("📥 You're offline  product saved on this device. It'll upload automatically once you're back online.");
    return;
  }

  submitBtn.style.pointerEvents = 'none';
  submitBtn.style.opacity = '0.6';

  try {
    status.textContent = 'Saving product...';
    await postProductAndImages(fields, imageFiles, force, msg => status.textContent = msg);

    status.textContent = '✅ Product added!';
    document.getElementById('addProductForm').reset();
    document.getElementById('apPreviewRow').innerHTML = '';
    delete mediaOrderState['ap'];
    loadProducts();

  } catch (err) {
    if (err.duplicate){
      const d = err.duplicate;
      const goAhead = window.confirm(
        `${d.message}\n\nExisting stock: ${d.existing_quantity}, price: ${d.existing_price}.\n\n` +
        `Click OK to add this as a separate listing anyway, or Cancel to stop ` +
        `(then edit the existing product #${d.existing_product_id} instead).`
      );
      submitBtn.style.pointerEvents = '';
      submitBtn.style.opacity = '';
      if (goAhead) return submitAddProduct(e, true);
      status.textContent = `⚠️ Not added  "${fields.name}" already exists in this category.`;
      return;
    }
    if (err instanceof TypeError){
      // fetch itself failed (offline / connection dropped) before the
      // product was created server-side, so it's safe to queue the whole
      // thing without risking a server-side duplicate.
      await queueForLater("📥 Connection lost  product saved on this device. It'll upload automatically once you're back online.");
      return;
    }
    status.textContent = '❌ ' + err.message;
  } finally {
    submitBtn.style.pointerEvents = '';
    submitBtn.style.opacity = '';
  }
}

let _manageProductsCache = [];

async function loadManageList(){
  const list = document.getElementById('manageList');
  try {
    const res = await fetch(`${API_URL}/products`);
    const products = await res.json();
    _manageProductsCache = products;
    if (products.length === 0){
      list.innerHTML = '<p style="color:var(--muted);">No products yet.</p>';
      document.getElementById('manageCount').textContent = '';
      return;
    }
    list.innerHTML = products.map(p => {
      const categoryLabel = (CATEGORY_META[p.category]||{label:p.category}).label;
      const searchBlob = `${p.name} ${categoryLabel} ${p.price}`.toLowerCase();
      return `
      <div class="a-prow" id="prow-${p.id}" data-search="${escapeHtml(searchBlob)}">
        <img src="${escapeHtml(p.image_url || 'https://placehold.co/100x100?text=No+Image')}" alt="${escapeHtml(p.name)}">
        <div class="a-pinfo">
          <div class="a-pname">${escapeHtml(p.name)}</div>
          <div class="a-pmeta">${fmt(p.price)}  ${escapeHtml(categoryLabel)}  Qty: ${p.quantity}</div>
        </div>
        <button onclick="openEditPanel(${p.id})">Edit</button>
        <button class="a-del" onclick="deleteManagedProduct(${p.id})">Delete</button>
      </div>
      <div id="editpanel-${p.id}" data-search-group="${p.id}"></div>
    `;
    }).join('');
    filterManageList();
  } catch (err) {
    list.innerHTML = '<p style="color:#a3423f;">Could not load products.</p>';
  }
}

function filterManageList(){
  const input = document.getElementById('manageSearchInput');
  const countEl = document.getElementById('manageCount');
  const term = (input && input.value || '').trim().toLowerCase();
  const rows = document.querySelectorAll('#manageList .a-prow');
  let visibleCount = 0;

  rows.forEach(row => {
    const matches = !term || (row.dataset.search || '').includes(term);
    row.style.display = matches ? '' : 'none';
    const panel = row.nextElementSibling;
    if (panel && panel.dataset && panel.dataset.searchGroup) panel.style.display = matches ? '' : 'none';
    if (matches) visibleCount++;
  });

  if (!countEl) return;
  if (!term){
    countEl.textContent = '';
  } else if (visibleCount === 0){
    countEl.textContent = `No products match "${input.value.trim()}".`;
  } else {
    countEl.textContent = `${visibleCount} of ${rows.length} product${rows.length === 1 ? '' : 's'} match.`;
  }
}

async function deleteManagedProduct(id){
  if (!confirm('Delete this product? This cannot be undone.')) return;
  const res = await adminFetch(`${API_URL}/admin/products/${id}`, { method: 'DELETE' });
  if (res.ok){ loadManageList(); loadProducts(); } else { alert('Could not delete product.'); }
}

async function openEditPanel(id){
  const panelWrap = document.getElementById(`editpanel-${id}`);
  if (panelWrap.innerHTML) { panelWrap.innerHTML = ''; return; }

  const res = await fetch(`${API_URL}/products/${id}`);
  if (!res.ok) return alert('Could not load product');
  const p = await res.json();

  const catOptions = buildCategoryOptionsHtml(p.category);

  const currentImagesHtml = (p.images && p.images.length)
    ? p.images.map(im => `
        <div class="a-current-img" id="curimg-${im.id}">
          ${im.media_type === 'video'
            ? `<video src="${escapeHtml(im.url)}" muted playsinline preload="metadata"></video>`
            : `<img src="${escapeHtml(im.url)}">`}
          ${im.is_primary ? `<div class="a-img-main-badge">MAIN</div>` : `<div class="a-img-setmain" onclick="setMainImage(${id}, ${im.id})">★ Set as main</div>`}
          <div class="a-img-remove" onclick="removeProductImage(${id}, ${im.id})">×</div>
        </div>
      `).join('')
    : '<span style="color:var(--muted); font-size:0.85rem;">No photos or videos</span>';

  panelWrap.innerHTML = `
    <div class="a-edit-panel">
      <div class="a-field"><label>Product Name</label><input type="text" id="edName-${id}" value="${escapeHtml(p.name)}"></div>
      <div class="a-field"><label>Description</label><textarea id="edDescription-${id}" rows="3">${escapeHtml(p.description || '')}</textarea></div>
      <div class="a-field"><label>Price (KES)</label><input type="number" id="edPrice-${id}" value="${p.price}"></div>
      <div class="a-field"><label>Sale Price (optional)</label><input type="number" id="edSalePrice-${id}" min="0" value="${p.sale_price != null ? p.sale_price : ''}" placeholder="Leave blank for no sale"></div>
      <div class="a-field"><label>Category</label><select id="edCategory-${id}">${catOptions}</select></div>
      <div class="a-field"><label>Quantity Available</label><input type="number" id="edQuantity-${id}" min="0" value="${p.quantity}"></div>
      <div class="a-check"><input type="checkbox" id="edIsNew-${id}" ${p.is_new ? 'checked' : ''}><label style="margin:0;text-transform:none;letter-spacing:0;color:var(--ink);">Mark as New</label></div>

      <div class="a-field">
        <label>Current Images (click × to remove one)</label>
        <div class="a-current-images" id="curImagesRow-${id}">${currentImagesHtml}</div>
      </div>
      <div class="a-field">
        <label>Add Photos or Videos (up to ${ADMIN_MAX_IMAGES} total)</label>
        <input type="file" id="edImageFiles-${id}" accept="image/*,video/*" multiple>
        <div class="a-preview-row" id="edPreviewRow-${id}"></div>
      </div>

      <a class="btn-primary a-submit" onclick="saveEditedProduct(${id})">Save Changes</a>
      <div class="a-status" id="edStatus-${id}"></div>
    </div>
  `;

  document.getElementById(`edImageFiles-${id}`).addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    const badFile = files.map(invalidImageReason).find(Boolean);
    if (badFile){
      alert(badFile);
      e.target.value = '';
      document.getElementById(`edPreviewRow-${id}`).innerHTML = '';
      return;
    }
    mediaOrderState[`ed-${id}`] = files;
    renderMediaPreview(`ed-${id}`, `edPreviewRow-${id}`);
  });
}

async function setMainImage(productId, imageId){
  const res = await adminFetch(`${API_URL}/admin/products/${productId}/images/${imageId}/primary`, { method: 'PATCH' });
  if (res.ok){
    document.getElementById(`editpanel-${productId}`).innerHTML = ''; // force re-render with fresh data
    await openEditPanel(productId);
    loadProducts();
  } else {
    alert('Could not set main image.');
  }
}

async function removeProductImage(productId, imageId){
  if (!confirm('Remove this image?')) return;
  const res = await adminFetch(`${API_URL}/admin/products/${productId}/images/${imageId}`, { method: 'DELETE' });
  if (res.ok){
    const el = document.getElementById(`curimg-${imageId}`);
    if (el) el.remove();
    loadProducts();
  } else {
    alert('Could not remove image.');
  }
}

async function saveEditedProduct(id){
  const status = document.getElementById(`edStatus-${id}`);
  const edPriceVal = document.getElementById(`edPrice-${id}`).value;
  const edSalePriceVal = document.getElementById(`edSalePrice-${id}`).value;
  if (edSalePriceVal !== '' && parseFloat(edSalePriceVal) >= parseFloat(edPriceVal)){
    status.textContent = '❌ Sale price must be lower than the regular price.';
    return;
  }
  status.textContent = 'Saving...';
  try {
    const updateRes = await adminFetch(`${API_URL}/admin/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: document.getElementById(`edName-${id}`).value,
        description: document.getElementById(`edDescription-${id}`).value,
        price: parseFloat(document.getElementById(`edPrice-${id}`).value),
        sale_price: (() => {
          const v = document.getElementById(`edSalePrice-${id}`).value;
          return v === '' ? null : parseFloat(v);
        })(),
        category: document.getElementById(`edCategory-${id}`).value,
        quantity: parseInt(document.getElementById(`edQuantity-${id}`).value, 10) || 0,
        is_new: document.getElementById(`edIsNew-${id}`).checked
      })
    });
    if (!updateRes.ok) throw new Error('Failed to update product details');

    const currentImgCount = document.querySelectorAll(`#curImagesRow-${id} .a-current-img`).length;
    const newFiles = mediaOrderState[`ed-${id}`] || Array.from(document.getElementById(`edImageFiles-${id}`).files);
    if (newFiles.length > 0){
      if (currentImgCount + newFiles.length > ADMIN_MAX_IMAGES){
        throw new Error(`A product can have at most ${ADMIN_MAX_IMAGES} files total (${currentImgCount} already there).`);
      }
      for (let i = 0; i < newFiles.length; i++){
        const file = newFiles[i];
        const kind = isVideoFile(file) ? 'video' : 'image';
        status.textContent = kind === 'video'
          ? `Compressing & uploading video ${i + 1} of ${newFiles.length}...`
          : `Uploading image ${i + 1} of ${newFiles.length}...`;
        const { base64: dataBase64, contentType } = kind === 'video'
          ? await compressVideoForUpload(file)
          : await resizeImageForUpload(file);
        const uploadRes = await adminFetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, contentType, dataBase64 })
        });
        const uploadData = await parseJsonResponse(uploadRes, `${kind === 'video' ? 'Video' : 'Image'} ${i + 1} upload`);
        if (!uploadRes.ok) throw new Error(uploadData.error || `${kind === 'video' ? 'Video' : 'Image'} ${i + 1} upload failed`);

        const imgRes = await adminFetch(`${API_URL}/admin/products/${id}/images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blob_url: uploadData.url, is_primary: currentImgCount === 0 && i === 0, sort_order: currentImgCount + i, media_type: kind })
        });
        if (!imgRes.ok) throw new Error(`Linking ${kind} ${i + 1} failed`);
      }
    }

    status.textContent = '✅ Saved!';
    delete mediaOrderState[`ed-${id}`];
    loadProducts();
    setTimeout(() => { loadManageList(); }, 500);

  } catch (err) {
    status.textContent = '❌ ' + err.message;
  }
}

