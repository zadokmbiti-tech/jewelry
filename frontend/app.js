const isLocal = window.location.hostname === "localhost"
  || window.location.hostname === "127.0.0.1"
  || window.location.protocol === "file:";

const API_URL = isLocal
  ? "http://localhost:8088"
  : "https://jewelry-backend-nine.vercel.app";
let PRODUCTS = [];

const CATEGORY_META = {
  "xuping-sets":                   { label: "Xuping Sets",                   color: "xuping-sets",                   ink: "xuping-sets-ink" },
  "xuping-earrings":                { label: "Xuping Earrings",               color: "xuping-earrings",               ink: "xuping-earrings-ink" },
  "genuine-leather-belts":          { label: "Genuine Leather Belts",         color: "genuine-leather-belts",         ink: "genuine-leather-belts-ink" },
  "kids-xuping-earrings":           { label: "Kids Xuping Earrings",          color: "kids-xuping-earrings",          ink: "kids-xuping-earrings-ink" },
  "xuping-necklaces":               { label: "Xuping Necklaces",              color: "xuping-necklaces",              ink: "xuping-necklaces-ink" },
  "pearl-necklaces":                { label: "Pearl Necklaces",               color: "pearl-necklaces",               ink: "pearl-necklaces-ink" },
  "pu-leather-belts":               { label: "P.U Leather Belts",             color: "pu-leather-belts",              ink: "pu-leather-belts-ink" },
  "male-stainless-steel-sets":      { label: "Male Stainless Steel Sets",     color: "male-stainless-steel-sets",     ink: "male-stainless-steel-sets-ink" },
  "statement-stainless-earrings":   { label: "Statement Stainless Earrings",  color: "statement-stainless-earrings",  ink: "statement-stainless-earrings-ink" },
  "fashion-jewelry-necklace-sets":  { label: "Fashion Jewelry Necklace Sets", color: "fashion-jewelry-necklace-sets", ink: "fashion-jewelry-necklace-sets-ink" },
  "hypoallergenic-watches":           { label: "Hypoallergenic Watches", color: "hypoallergenic-watches", ink: "hypoallergenic-watches-ink" },
  "genuine-leather-watches":          { label: "Genuine Leather Watches", color: "genuine-leather-watches", ink: "genuine-leather-watches-ink" },
  "elite-compact-jewelry-case":       { label: "Elite Compact Jewelry Case", color: "elite-compact-jewelry-case", ink: "elite-compact-jewelry-case-ink" },
  "charger-protectors":               { label: "Charger Protectors", color: "charger-protectors", ink: "charger-protectors-ink" },
  "brass-jewelry":                    { label: "Brass Jewelry", color: "brass-jewelry", ink: "brass-jewelry-ink" },
  "hair-clips":                       { label: "Hair Clips", color: "hair-clips", ink: "hair-clips-ink" },
  "twist-fabric-headband":            { label: "Twist Fabric Headband", color: "twist-fabric-headband", ink: "twist-fabric-headband-ink" },
  "pearl-twist-headband":             { label: "Pearl Twist Headband", color: "pearl-twist-headband", ink: "pearl-twist-headband-ink" },
  "magnetic-and-generic-watches":     { label: "Magnetic and Generic Watches", color: "magnetic-and-generic-watches", ink: "magnetic-and-generic-watches-ink" },
  "kids-pocket-mirrors":              { label: "Kids Pocket Mirrors", color: "kids-pocket-mirrors", ink: "kids-pocket-mirrors-ink" },
  "adult-pocket-mirrors":             { label: "Adult Pocket Mirrors", color: "adult-pocket-mirrors", ink: "adult-pocket-mirrors-ink" },
  "anxiety-rings":                    { label: "Anxiety Rings", color: "anxiety-rings", ink: "anxiety-rings-ink" },
  "brass-rings":                      { label: "Brass Rings", color: "brass-rings", ink: "brass-rings-ink" },
  "stainless-steel-rings":            { label: "Stainless Steel Rings", color: "stainless-steel-rings", ink: "stainless-steel-rings-ink" },
  "xuping-rings":                     { label: "Xuping Rings", color: "xuping-rings", ink: "xuping-rings-ink" },
  "classic-jewelry-organizers":       { label: "Classic Jewelry Organizers", color: "classic-jewelry-organizers", ink: "classic-jewelry-organizers-ink" },
  "statement-rings":                  { label: "Statement Rings", color: "statement-rings", ink: "statement-rings-ink" },
  "kids-digital-watches":             { label: "Kids Digital Watches", color: "kids-digital-watches", ink: "kids-digital-watches-ink" },
  "sunglasses":                       { label: "Sunglasses", color: "sunglasses", ink: "sunglasses-ink" },
  "photochromic-glasses":             { label: "Photochromic Glasses", color: "photochromic-glasses", ink: "photochromic-glasses-ink" },
  "premium-wine-bottle-gift-box":     { label: "Premium Wine Bottle Gift Box", color: "premium-wine-bottle-gift-box", ink: "premium-wine-bottle-gift-box-ink" },
  "anti-blue-light-glasses":          { label: "Anti-Blue Light Glasses", color: "anti-blue-light-glasses", ink: "anti-blue-light-glasses-ink" },
  "ruched-rhinestone-headband":       { label: "Ruched Rhinestone Headband", color: "ruched-rhinestone-headband", ink: "ruched-rhinestone-headband-ink" },
  "pearl-and-rhinestones-headband":   { label: "Pearl & Rhinestones Headband", color: "pearl-and-rhinestones-headband", ink: "pearl-and-rhinestones-headband-ink" },
  "crystal-satin-ruche-headband":     { label: "Crystal Satin Ruche Headband", color: "crystal-satin-ruche-headband", ink: "crystal-satin-ruche-headband-ink" },
  "travel-bags":                      { label: "Travel Bags", color: "travel-bags", ink: "travel-bags-ink" },
  "stainless-steel-necklaces":        { label: "Stainless Steel Necklaces", color: "stainless-steel-necklaces", ink: "stainless-steel-necklaces-ink" },
  "mens-watches":                     { label: "Men's Watches", color: "mens-watches", ink: "mens-watches-ink" },
  "tennis-bracelets":                 { label: "Tennis Bracelets", color: "tennis-bracelets", ink: "tennis-bracelets-ink" },
  "xuping-bangles":                   { label: "Xuping Bangles", color: "xuping-bangles", ink: "xuping-bangles-ink" },
  "xuping-tennis-bracelets":          { label: "Xuping Tennis Bracelets", color: "xuping-tennis-bracelets", ink: "xuping-tennis-bracelets-ink" },
  "xuping-bracelets":                 { label: "Xuping Bracelets", color: "xuping-bracelets", ink: "xuping-bracelets-ink" },
  "brass-necklaces":                  { label: "Brass Necklaces", color: "brass-necklaces", ink: "brass-necklaces-ink" },
  "bag-charms":                       { label: "Bag Charms", color: "bag-charms", ink: "bag-charms-ink" },
  "other_items":                      { label: "Other Items", color: "other_items", ink: "other_items-ink" },
};
const CATEGORY_GROUPS = [
  ["Necklaces", ["xuping-necklaces","pearl-necklaces","stainless-steel-necklaces","brass-necklaces"]],
  ["Earrings", ["xuping-earrings","kids-xuping-earrings","statement-stainless-earrings"]],
  ["Rings", ["anxiety-rings","brass-rings","stainless-steel-rings","xuping-rings","statement-rings"]],
  ["Bracelets & Bangles", ["tennis-bracelets","xuping-bangles","xuping-tennis-bracelets","xuping-bracelets"]],
  ["Jewelry Sets", ["xuping-sets","male-stainless-steel-sets","fashion-jewelry-necklace-sets"]],
  ["Watches", ["hypoallergenic-watches","genuine-leather-watches","magnetic-and-generic-watches","kids-digital-watches","mens-watches"]],
  ["Belts", ["genuine-leather-belts","pu-leather-belts"]],
  ["Headbands & Hair Accessories", ["twist-fabric-headband","pearl-twist-headband","ruched-rhinestone-headband","pearl-and-rhinestones-headband","crystal-satin-ruche-headband","hair-clips"]],
  ["Eyewear", ["sunglasses","photochromic-glasses","anti-blue-light-glasses"]],
  ["Bags", ["travel-bags"]],
  ["Mirrors", ["kids-pocket-mirrors","adult-pocket-mirrors"]],
  ["Jewelry Storage & Cases", ["elite-compact-jewelry-case","classic-jewelry-organizers"]],
  ["Other Accessories & Gifts", ["brass-jewelry","charger-protectors","premium-wine-bottle-gift-box","bag-charms","other_items"]],
];
// Same rule as scripts/build-categories.js, which generates the /c/... landing pages.
function slugify(str){
  return String(str).toLowerCase().replace(/&/g,' ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}
function buildCategoryOptionsHtml(selectedSlug) {
  return CATEGORY_GROUPS.map(([groupLabel, slugs]) => {
    const opts = slugs.map(slug => {
      const label = (CATEGORY_META[slug] || { label: slug }).label;
      const sel = slug === selectedSlug ? ' selected' : '';
      return `<option value="${slug}"${sel}>${escapeHtml(label)}</option>`;
    }).join('');
    return `<optgroup label="${escapeHtml(groupLabel)}">${opts}</optgroup>`;
  }).join('');
}

const PLACEHOLDER_IMG = "https://placehold.co/800x800/f7f5f1/b8860b?text=Ruaka+Jewelry";

function normalizeProduct(p) {
  const meta = CATEGORY_META[p.category] || { label: p.category, color: "xuping-sets", ink: "xuping-sets-ink" };
  return {
    id: p.id,
    name: p.name,
    cat: p.category,
    catLabel: meta.label,
    price: p.price,
    salePrice: (typeof p.sale_price === "number") ? p.sale_price : null,
    desc: p.description || "",
    quantity: typeof p.quantity === "number" ? p.quantity : 0,
    isNew: !!p.is_new,
    color: meta.color,
    ink: meta.ink,
    img: p.image_url || PLACEHOLDER_IMG,
    avgRating: typeof p.avg_rating === "number" ? p.avg_rating : null,
    reviewCount: typeof p.review_count === "number" ? p.review_count : 0,
  };
}

function starsHtml(avg, count, size = 13){
  const full = Math.round(avg || 0);
  const stars = [1,2,3,4,5].map(n => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${n <= full ? 'var(--gold)' : 'none'}" stroke="var(--gold)" stroke-width="1.3"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21.1 7 14.2 2 9.3l6.9-1z"/></svg>`).join('');
  const countLabel = count > 0 ? `<span class="rating-count">${avg.toFixed(1)} (${count})</span>` : `<span class="rating-count">No reviews yet</span>`;
  return `<span class="rating-stars">${stars}</span>${countLabel}`;
}
function starsOnlyHtml(rating, size = 12){
  return `<span class="rating-stars">${[1,2,3,4,5].map(n => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${n <= rating ? 'var(--gold)' : 'none'}" stroke="var(--gold)" stroke-width="1.3"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21.1 7 14.2 2 9.3l6.9-1z"/></svg>`).join('')}</span>`;
}

function escapeHtml(str){
  return String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function stockInfo(qty){
  if (qty <= 0) return { text: "Out of Stock", cls: "stock-out" };
  if (qty <= 3) return { text: `Only ${qty} left!`, cls: "stock-low" };
  return null;
}

async function loadProducts() {
  const grid = document.getElementById('grid');
  if (!grid) return;
  grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:var(--muted);">Loading collection…</p>`;
  try {
    const res = await fetch(`${API_URL}/products`);
    if (!res.ok) throw new Error('Request failed');
    const data = await res.json();
    PRODUCTS = data.map(normalizeProduct);
    renderGrid();
    renderCategoryTiles();
    renderRecentlyViewed();
  } catch (err) {
    grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:var(--muted);">Couldn't load the collection right now. Please try again shortly.</p>`;
  }
}

function renderCategoryTiles(){
  const wrap = document.getElementById('catTiles');
  if (!wrap) return;
  wrap.innerHTML = CATEGORY_GROUPS.map(([groupLabel, slugs]) => {
    const items = PRODUCTS.filter(p => slugs.includes(p.cat));
    const cover = items[0];
    const img = cover ? cover.img : PLACEHOLDER_IMG;
    const bg = cover ? `var(--${cover.color})` : 'var(--surface)';
    return `
      <a class="cat-tile" href="/c/${slugify(groupLabel)}/">
        <div class="cat-tile-img" style="background:${bg};"><img src="${escapeHtml(img)}" alt="${escapeHtml(groupLabel)}" loading="lazy"></div>
        <div class="cat-tile-name">${escapeHtml(groupLabel)}</div>
        <div class="cat-tile-count">${items.length} piece${items.length === 1 ? '' : 's'}</div>
      </a>
    `;
  }).join('');
}

// "Recently Viewed" -- purely client-side, tracked whenever a product modal
// is opened. Capped at 8, most recent first, no duplicates.
const RECENTLY_VIEWED_KEY = 'sjgems_recently_viewed';
function trackRecentlyViewed(id){
  let list = [];
  try { list = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY)) || []; } catch(e) {}
  list = [id, ...list.filter(x => x !== id)].slice(0, 8);
  localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(list));
}

function renderRecentlyViewed(){
  const section = document.getElementById('recentlyViewed');
  const strip = document.getElementById('recentlyViewedStrip');
  if (!section || !strip) return;
  let ids = [];
  try { ids = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY)) || []; } catch(e) {}
  const items = ids.map(id => PRODUCTS.find(p => p.id === id)).filter(Boolean);
  if (items.length === 0){ section.style.display = 'none'; return; }
  section.style.display = '';
  strip.innerHTML = items.map(p => `
    <div class="related-card" onclick="openModal(${p.id})">
      <div class="tray" style="background:var(--${p.color});">
        <img class="tray-img" src="${escapeHtml(p.img)}" alt="${escapeHtml(p.name)}" loading="lazy">
      </div>
      <div class="related-name">${escapeHtml(p.name)}</div>
      <div class="price" style="font-size:0.85rem;">${fmt(p.salePrice != null && p.salePrice < p.price ? p.salePrice : p.price)}</div>
    </div>
  `).join('');
}

const CART_STORAGE_KEY = 'sjgems_cart';
function loadCart(){
  try { return JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || []; }
  catch (e) { return []; }
}
function saveCart(){
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}
let cart = loadCart();

function fmt(n){ return "KES " + n.toLocaleString(); }

function priceHtml(p){
  if (p.salePrice != null && p.salePrice < p.price){
    return `<span class="price price-sale"><span class="price-was">${fmt(p.price)}</span> ${fmt(p.salePrice)}</span>`;
  }
  return `<span class="price">${fmt(p.price)}</span>`;
}

let currentCategory = window.__INITIAL_CATEGORY__ || 'all';
let currentSearch = '';

function renderGrid(filter=currentCategory){
  currentCategory = filter;
  const grid = document.getElementById('grid');
  let items;
  if (filter === 'all') {
    items = PRODUCTS;
  } else if (filter.startsWith('group:')) {
    const groupLabel = filter.slice(6);
    const groupEntry = CATEGORY_GROUPS.find(([label]) => label === groupLabel);
    const slugs = groupEntry ? groupEntry[1] : [];
    items = PRODUCTS.filter(p => slugs.includes(p.cat));
  } else {
    items = PRODUCTS.filter(p => p.cat === filter);
  }
  const q = currentSearch.trim().toLowerCase();
  if(q){
    items = items.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.catLabel.toLowerCase().includes(q)
    );
  }
  const pieceCountEl = document.getElementById('pieceCount');
  if(items.length === 0){
    const safeQuery = currentSearch.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const msg = q ? `No pieces match "${safeQuery}".` : `No pieces in this collection yet  check back soon.`;
    grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:var(--muted);">${msg}</p>`;
    if(pieceCountEl) pieceCountEl.textContent = '0 pieces to discover';
    return;
  }
  if(pieceCountEl){
    const n = String(items.length).padStart(2, '0');
    pieceCountEl.textContent = `${n} piece${items.length === 1 ? '' : 's'} to discover`;
  }
  const saved = getWishlist();
  grid.innerHTML = items.map(p => {
    const stock = stockInfo(p.quantity);
    const badge = stock ? `<span class="stock-badge ${stock.cls}">${stock.text}</span>` : '';
    const saleBadge = (p.salePrice != null && p.salePrice < p.price) ? `<span class="stock-badge sale-badge">Sale</span>` : '';
    const addDisabled = p.quantity <= 0 ? 'style="opacity:0.4;pointer-events:none;"' : '';
    const wished = saved.includes(p.id) ? ' active' : '';
    const comparing = getCompareList().includes(p.id) ? ' active' : '';
    return `
    <div class="card" onclick="openModal(${p.id})">
      <div class="tray" style="background:var(--${p.color})">
        <div class="wish${wished}" onclick="event.stopPropagation(); toggleWishlist(${p.id}, this)">
          <svg viewBox="0 0 24 24" stroke-width="1.5"><path d="M12 21s-8-5.5-8-11a5 5 0 019-3 5 5 0 019 3c0 5.5-8 11-8 11z"/></svg>
        </div>
        <img class="tray-img" src="${escapeHtml(p.img)}" alt="${escapeHtml(p.name)}" loading="lazy">
      </div>
      <div class="card-info">
        <div class="card-cat">${escapeHtml(p.catLabel)}</div>
        <div class="card-name">${escapeHtml(p.name)}</div>
        ${p.reviewCount > 0 ? `<div class="card-rating">${starsHtml(p.avgRating, p.reviewCount, 11)}</div>` : ''}
        ${(badge || saleBadge) ? `<div style="margin-bottom:8px;">${saleBadge}${badge}</div>` : ''}
        <div class="card-price-row">${priceHtml(p)}</div>
        <div class="card-actions-row">
          <button class="add-btn" ${addDisabled} onclick="event.stopPropagation(); requireRegistration(() => addToCart(${p.id}))">Add to bag</button>
          <label class="compare-check${comparing}" onclick="event.stopPropagation();">
            <input type="checkbox" ${comparing ? 'checked' : ''} onchange="toggleCompare(${p.id}, this)"> Compare
          </label>
        </div>
      </div>
    </div>
  `;
  }).join('');
  renderCompareBar();
}

const WISHLIST_KEY = 'sjgems_wishlist';
function getWishlist(){
  try{ return JSON.parse(localStorage.getItem(WISHLIST_KEY)) || []; }
  catch(e){ return []; }
}
function toggleWishlist(id, el){
  let list = getWishlist();
  if(list.includes(id)){
    list = list.filter(x => x !== id);
    el.classList.remove('active');
  } else {
    list.push(id);
    el.classList.add('active');
  }
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(list));
}

// Compare products: in-memory only (deliberately not persisted -- a
// "compare" selection is a short browsing task, not something a shopper
// expects to still be there tomorrow). Capped at 4 so the compare table
// stays readable.
const COMPARE_MAX = 4;
let compareList = [];
function getCompareList(){ return compareList; }

function toggleCompare(id, checkbox){
  if (compareList.includes(id)){
    compareList = compareList.filter(x => x !== id);
  } else {
    if (compareList.length >= COMPARE_MAX){
      if (checkbox) checkbox.checked = false;
      alert(`You can compare up to ${COMPARE_MAX} products at a time.`);
      return;
    }
    compareList.push(id);
  }
  renderGrid(currentCategory);
}

function removeFromCompare(id){
  compareList = compareList.filter(x => x !== id);
  renderGrid(currentCategory);
  if (compareList.length === 0) closeCompareModal();
  else renderCompareModal();
}

function clearCompare(){
  compareList = [];
  renderGrid(currentCategory);
  closeCompareModal();
}

function renderCompareBar(){
  const bar = document.getElementById('compareBar');
  if (!bar) return;
  if (compareList.length === 0){ bar.classList.remove('open'); return; }
  bar.classList.add('open');
  document.getElementById('compareCount').textContent = compareList.length;
}

function openCompareModal(){
  if (compareList.length === 0) return;
  renderCompareModal();
  document.getElementById('overlay').classList.add('open');
  document.getElementById('compareModal').classList.add('open');
}
function closeCompareModal(){
  document.getElementById('compareModal').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
}

function renderCompareModal(){
  const items = compareList.map(id => PRODUCTS.find(p => p.id === id)).filter(Boolean);
  const wrap = document.getElementById('compareTable');
  if (items.length === 0){ wrap.innerHTML = ''; return; }
  wrap.innerHTML = `
    <div class="compare-grid" style="grid-template-columns: 140px repeat(${items.length}, 1fr);">
      <div></div>
      ${items.map(p => `
        <div class="compare-col-head">
          <button class="compare-remove" onclick="removeFromCompare(${p.id})">&times;</button>
          <div class="tray" style="background:var(--${p.color});width:100%;aspect-ratio:1;border-radius:8px;">
            <img class="tray-img" src="${escapeHtml(p.img)}" alt="${escapeHtml(p.name)}">
          </div>
          <div class="card-name" style="margin-top:8px;">${escapeHtml(p.name)}</div>
        </div>
      `).join('')}

      <div class="compare-row-label">Category</div>
      ${items.map(p => `<div>${escapeHtml(p.catLabel)}</div>`).join('')}

      <div class="compare-row-label">Price</div>
      ${items.map(p => `<div>${priceHtml(p)}</div>`).join('')}

      <div class="compare-row-label">Rating</div>
      ${items.map(p => `<div>${p.reviewCount > 0 ? starsHtml(p.avgRating, p.reviewCount, 12) : 'No reviews yet'}</div>`).join('')}

      <div class="compare-row-label">Availability</div>
      ${items.map(p => `<div>${p.quantity > 0 ? (p.quantity <= 3 ? `Only ${p.quantity} left` : 'In Stock') : 'Out of Stock'}</div>`).join('')}

      <div class="compare-row-label"></div>
      ${items.map(p => `<div><a class="btn-primary" style="width:100%;justify-content:center;" onclick="closeCompareModal(); openModal(${p.id});">View</a></div>`).join('')}
    </div>
  `;
}

document.querySelectorAll('.cat-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    renderGrid(chip.dataset.filter);
  });
});

function handleSearch(value){
  currentSearch = value;
  document.getElementById('searchClear').classList.toggle('show', value.length > 0);
  renderGrid(currentCategory);
}

function clearSearch(){
  currentSearch = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').classList.remove('show');
  renderGrid(currentCategory);
}

function addToCart(id){
  const product = PRODUCTS.find(p => p.id === id);
  if(!product || product.quantity <= 0) return;
  const existing = cart.find(i => i.id === id);
  if(existing){
    if(existing.qty >= product.quantity) return;
    existing.qty++;
  } else {
    cart.push({...product, qty:1});
  }
  updateCartUI();
  openCart();
}

function changeQty(id, delta){
  const item = cart.find(i => i.id === id);
  if(!item) return;
  if(delta > 0 && item.qty >= item.quantity) return;
  item.qty += delta;
  if(item.qty <= 0) cart = cart.filter(i => i.id !== id);
  updateCartUI();
}

function removeItem(id){
  cart = cart.filter(i => i.id !== id);
  updateCartUI();
}

function updateCartUI(){
  saveCart();
  const count = cart.reduce((s,i) => s+i.qty, 0);
  document.getElementById('cartCount').textContent = count;
  const wrap = document.getElementById('drawerItems');
  if(cart.length === 0){
    wrap.innerHTML = `<div class="drawer-empty">Your bag is empty.<br>Browse the collection to add a piece.</div>`;
  } else {
    wrap.innerHTML = cart.map(i => `
      <div class="drawer-item">
        <div class="tray" style="background:var(--${i.color})">
          <img class="tray-img" src="${escapeHtml(i.img)}" alt="${escapeHtml(i.name)}" loading="lazy">
        </div>
        <div class="di-info">
          <div class="card-name">${escapeHtml(i.name)}</div>
          <div class="price">${fmt(i.price)}</div>
          <div class="di-qty">
            <button onclick="changeQty(${i.id}, -1)">−</button>
            <span>${i.qty}</span>
            <button onclick="changeQty(${i.id}, 1)">+</button>
          </div>
          <div class="di-remove" onclick="removeItem(${i.id})">Remove</div>
        </div>
      </div>
    `).join('');
  }
  const subtotal = cart.reduce((s,i) => s + i.price*i.qty, 0);
  document.getElementById('subtotal').textContent = fmt(subtotal);
}

let modalMedia = [];
let modalMediaIndex = 0;
let modalMediaAlt = '';

function modalMainMediaHtml(m, altName){
  return m.media_type === 'video'
    ? `<video class="tray-img" id="modalMainMedia" src="${escapeHtml(m.url)}" controls playsinline autoplay></video>`
    : `<img class="tray-img" id="modalMainMedia" src="${escapeHtml(m.url)}" alt="${escapeHtml(altName)}" loading="lazy">`;
}

function modalThumbsHtml(media){
  if (media.length <= 1) return '';
  return `<div class="modal-thumbs">${media.map((m, idx) => m.media_type === 'video'
      ? `<div class="modal-thumb-video ${idx===0?'active':''}" onclick="event.stopPropagation(); setModalMedia(${idx})"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>`
      : `<img src="${escapeHtml(m.url)}" alt="Product photo ${idx+1}" class="${idx===0?'active':''}" onclick="event.stopPropagation(); setModalMedia(${idx})">`
    ).join('')}</div>`;
}

function modalNavHtml(media){
  if (media.length <= 1) return '';
  return `
    <button class="modal-nav modal-nav-prev" onclick="event.stopPropagation(); prevModalMedia()" aria-label="Previous image">
      <svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>
    </button>
    <button class="modal-nav modal-nav-next" onclick="event.stopPropagation(); nextModalMedia()" aria-label="Next image">
      <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
    </button>
  `;
}

function setModalMedia(idx){
  if (!modalMedia.length) return;
  modalMediaIndex = (idx + modalMedia.length) % modalMedia.length;
  const m = modalMedia[modalMediaIndex];
  const current = document.getElementById('modalMainMedia');
  if (current) current.outerHTML = modalMainMediaHtml(m, modalMediaAlt);
  document.querySelectorAll('#modalBox .modal-thumbs img, #modalBox .modal-thumb-video').forEach((el, i) => el.classList.toggle('active', i === modalMediaIndex));
}

function nextModalMedia(){ setModalMedia(modalMediaIndex + 1); }
function prevModalMedia(){ setModalMedia(modalMediaIndex - 1); }

document.addEventListener('keydown', (e) => {
  if (!document.getElementById('modal').classList.contains('open')) return;
  if (e.key === 'ArrowRight') nextModalMedia();
  if (e.key === 'ArrowLeft') prevModalMedia();
});

// Swipe left/right on the product image to move through the gallery, the
// same way Kilimall's product viewer works on mobile -- not just arrow taps.
let modalTouchStartX = 0;
let modalTouchStartY = 0;
document.getElementById('modal').addEventListener('touchstart', (e) => {
  if (!e.target.closest('.modal-tray') || modalMedia.length <= 1) return;
  modalTouchStartX = e.touches[0].clientX;
  modalTouchStartY = e.touches[0].clientY;
}, { passive: true });
document.getElementById('modal').addEventListener('touchend', (e) => {
  if (!e.target.closest('.modal-tray') || modalMedia.length <= 1) return;
  const touch = e.changedTouches[0];
  const dx = touch.clientX - modalTouchStartX;
  const dy = touch.clientY - modalTouchStartY;
  const SWIPE_THRESHOLD = 40;
  if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0) nextModalMedia(); else prevModalMedia();
  }
}, { passive: true });

function modalMarkup(p, media){
  const stock = stockInfo(p.quantity);
  const stockLine = p.quantity <= 0
    ? `<div class="modal-stock stock-out">Out of Stock</div>`
    : (stock ? `<div class="modal-stock stock-low">${stock.text}</div>` : `<div class="modal-stock stock-ok">In Stock</div>`);
  const addBtn = p.quantity <= 0
    ? `<a class="btn-primary disabled" style="width:100%;justify-content:center;">Out of Stock</a>`
    : `<a class="btn-primary" style="width:100%;justify-content:center;" onclick="requireRegistration(() => { addToCart(${p.id}); closeAll(); })">Add to Bag</a>`;
  const buyNowBtn = p.quantity <= 0
    ? ''
    : `<a class="btn-buynow" onclick="requireRegistration(() => buyNow(${p.id}))">Buy Now</a>`;
  const first = media[0] || { url: p.img, media_type: 'image' };
  const mainMedia = modalMainMediaHtml(first, p.name);
  const ratingLine = `<div class="modal-rating">${starsHtml(p.avgRating, p.reviewCount, 15)}</div>`;
  return `
    <button class="modal-close" onclick="closeAll()"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.5"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    <div class="modal-tray" style="background:var(--${p.color});">
      ${mainMedia}
      ${modalNavHtml(media)}
      ${modalThumbsHtml(media)}
    </div>
    <div class="modal-info">
      <div class="card-cat">${escapeHtml(p.catLabel)}</div>
      <h2>${escapeHtml(p.name)}</h2>
      ${ratingLine}
      <div class="modal-price">${priceHtml(p)}</div>
      <p class="modal-desc">${escapeHtml(p.desc)}</p>
      ${stockLine}
      ${addBtn}
      ${buyNowBtn}
      <div class="modal-reviews" id="modalReviews"></div>
      <div class="modal-related" id="modalRelated"></div>
    </div>
  `;
}

function renderRelatedProducts(p){
  const wrap = document.getElementById('modalRelated');
  if (!wrap) return;
  const related = PRODUCTS.filter(x => x.cat === p.cat && x.id !== p.id).slice(0, 4);
  if (related.length === 0){ wrap.innerHTML = ''; return; }
  wrap.innerHTML = `
    <h4 class="modal-section-title">You May Also Like</h4>
    <div class="related-strip">
      ${related.map(r => `
        <div class="related-card" onclick="openModal(${r.id})">
          <div class="tray" style="background:var(--${r.color});">
            <img class="tray-img" src="${escapeHtml(r.img)}" alt="${escapeHtml(r.name)}" loading="lazy">
          </div>
          <div class="related-name">${escapeHtml(r.name)}</div>
          <div class="price" style="font-size:0.85rem;">${fmt(r.salePrice != null && r.salePrice < r.price ? r.salePrice : r.price)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

async function renderReviews(productId){
  const wrap = document.getElementById('modalReviews');
  if (!wrap) return;
  const session = getCustomerInfo();
  wrap.innerHTML = `
    <h4 class="modal-section-title">Reviews</h4>
    <div id="reviewForm">${session ? `
      <div class="review-form">
        <div class="review-stars-input" id="reviewStarsInput">
          ${[1,2,3,4,5].map(n => `<svg data-n="${n}" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--gold)" stroke-width="1.3" onclick="setReviewStars(${n})"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21.1 7 14.2 2 9.3l6.9-1z"/></svg>`).join('')}
        </div>
        <textarea id="reviewComment" placeholder="Share your thoughts on this piece (optional)" rows="2"></textarea>
        <a class="btn-primary" style="width:100%;justify-content:center;margin-top:8px;" onclick="submitReview(${productId})">Submit Review</a>
      </div>
    ` : `<p class="auth-note" style="margin:0 0 14px;">Please <a onclick="showRegisterModal()" style="color:var(--gold);cursor:pointer;">log in</a> to leave a review.</p>`}</div>
    <div id="reviewsList"><p style="color:var(--muted);font-size:0.85rem;">Loading reviews…</p></div>
  `;
  reviewStars = 0;

  try {
    const res = await fetch(`${API_URL}/products/${productId}/reviews`);
    const reviews = res.ok ? await res.json() : [];
    const list = document.getElementById('reviewsList');
    if (reviews.length === 0){
      list.innerHTML = `<p style="color:var(--muted);font-size:0.85rem;">No reviews yet. Be the first to review this piece.</p>`;
      return;
    }
    list.innerHTML = reviews.map(r => `
      <div class="review-item">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong style="font-size:0.85rem;">${escapeHtml(r.customer_name)}</strong>
          ${starsOnlyHtml(r.rating)}
        </div>
        ${r.comment ? `<p style="font-size:0.85rem;color:var(--muted);margin-top:4px;">${escapeHtml(r.comment)}</p>` : ''}
        <div style="font-size:0.72rem;color:var(--muted);margin-top:4px;">${new Date(r.created_at).toLocaleDateString()}</div>
      </div>
    `).join('');
  } catch (err) {
    document.getElementById('reviewsList').innerHTML = `<p style="color:#a3423f;font-size:0.85rem;">Could not load reviews.</p>`;
  }
}

let reviewStars = 0;
function setReviewStars(n){
  reviewStars = n;
  document.querySelectorAll('#reviewStarsInput svg').forEach(svg => {
    svg.setAttribute('fill', Number(svg.dataset.n) <= n ? 'var(--gold)' : 'none');
  });
}

async function submitReview(productId){
  if (reviewStars === 0){ alert('Please select a star rating.'); return; }
  const session = getCustomerInfo();
  if (!session){ showRegisterModal(); return; }
  const comment = document.getElementById('reviewComment').value.trim();
  try {
    const res = await customerFetch(`${API_URL}/products/${productId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: reviewStars, comment: comment || null }),
    });
    if (res.status === 401){ localStorage.removeItem(CUSTOMER_STORAGE_KEY); showRegisterModal(); return; }
    if (!res.ok) throw new Error('failed');
    await loadProducts();
    const p = PRODUCTS.find(x => x.id === productId);
    if (p) document.querySelector('.modal-rating').outerHTML = `<div class="modal-rating">${starsHtml(p.avgRating, p.reviewCount, 15)}</div>`;
    renderReviews(productId);
  } catch (err) {
    alert('Could not submit your review right now. Please try again.');
  }
}

async function openModal(id){
  const p = PRODUCTS.find(x => x.id === id);
  modalMedia = [{ url: p.img, media_type: 'image' }];
  modalMediaIndex = 0;
  modalMediaAlt = p.name;
  document.getElementById('modalBox').innerHTML = modalMarkup(p, modalMedia);
  document.getElementById('overlay').classList.add('open');
  document.getElementById('modal').classList.add('open');
  renderRelatedProducts(p);
  renderReviews(p.id);
  trackRecentlyViewed(p.id);
  renderRecentlyViewed();

  try {
    const res = await fetch(`${API_URL}/products/${id}`);
    if (!res.ok) return;
    const detail = await res.json();
    const media = (detail.images && detail.images.length)
      ? detail.images.map(im => ({ url: im.url, media_type: im.media_type || 'image' }))
      : [{ url: p.img, media_type: 'image' }];
    modalMedia = media;
    modalMediaIndex = 0;
    document.getElementById('modalBox').innerHTML = modalMarkup(p, media);
    renderRelatedProducts(p);
    renderReviews(p.id);
  } catch (err) {
  }
}

function openCart(){
  document.getElementById('overlay').classList.add('open');
  document.getElementById('drawer').classList.add('open');
}
function closeCart(){
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
}
// Shared by cart checkout and Buy Now, so both paths post to /orders the
// same way instead of duplicating the request/error handling.
async function placeOrder(items, opts = {}){
  const { clearCart = false, triggerBtn = null } = opts;
  const info = getCustomerInfo();
  if (!info) { showRegisterModal(); return false; }

  if (triggerBtn){ triggerBtn.style.pointerEvents = 'none'; triggerBtn.style.opacity = '0.6'; }
  try {
    const res = await customerFetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (res.status === 401) {
      localStorage.removeItem(CUSTOMER_STORAGE_KEY);
      if (triggerBtn){ triggerBtn.style.pointerEvents = ''; triggerBtn.style.opacity = ''; }
      alert('Your session has expired. Please log in again to complete this order.');
      pendingCartAction = () => placeOrder(items, opts);
      showRegisterModal();
      return false;
    }
    if (!res.ok) throw new Error('order failed');
  } catch (err) {
    if (triggerBtn){ triggerBtn.style.pointerEvents = ''; triggerBtn.style.opacity = ''; }
    alert("Couldn't place your order right now. Please check your connection and try again, or message us on WhatsApp.");
    return false;
  }

  if (triggerBtn){ triggerBtn.style.pointerEvents = ''; triggerBtn.style.opacity = ''; }
  if (clearCart){ cart = []; updateCartUI(); }
  document.getElementById('overlay').classList.add('open');
  document.getElementById('stkModal').classList.add('open');
  return true;
}

async function openStk(){
  if(cart.length === 0) return;
  const info = getCustomerInfo();
  if(!info){ showRegisterModal(); return; }
  const checkoutBtn = document.querySelector('.checkout-btn');
  await placeOrder(cart.map(i => ({ product_id: i.id, quantity: i.qty })), { clearCart: true, triggerBtn: checkoutBtn });
}

// Buy Now skips the bag entirely, it places a single-item order right away
// without adding or clearing anything already sitting in the cart.
function buyNow(id){
  closeAll();
  doBuyNow(id);
}

async function doBuyNow(id){
  const p = PRODUCTS.find(x => x.id === id);
  if (!p || p.quantity <= 0) return;
  await placeOrder([{ product_id: id, quantity: 1 }]);
}
function closeAll(){
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('modal').classList.remove('open');
  document.getElementById('stkModal').classList.remove('open');
  const adminLoginEl = document.getElementById('adminLoginModal');
  if (adminLoginEl) adminLoginEl.classList.remove('open');
  document.getElementById('registerModal').classList.remove('open');
  document.getElementById('accountDrawer').classList.remove('open');
  document.getElementById('compareModal').classList.remove('open');
}

window.addEventListener('scroll', () => {
  document.getElementById('header').classList.toggle('scrolled', window.scrollY > 40);
});

function toggleMobileMenu(){
  document.getElementById('hamburgerBtn').classList.toggle('open');
  document.getElementById('mobileMenu').classList.toggle('open');
}

// ---- Admin module -----------------------------------------------------
// The admin markup (admin-panel.html) and code (admin.js) are not part of the
// public page. They are fetched the first time an admin opens the panel.
// The real access control is the X-Admin-Secret check on the API.
let _adminLoading = null;
function loadAdminModule(){
  if (window.__adminLoaded) return Promise.resolve();
  if (_adminLoading) return _adminLoading;
  _adminLoading = (async () => {
    const res = await fetch('/admin-panel.html' + ADMIN_ASSET_VERSION);
    if (!res.ok) throw new Error('admin panel unavailable');
    document.body.insertAdjacentHTML('beforeend', await res.text());
    await new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = '/admin.js' + ADMIN_ASSET_VERSION;
      el.onload = resolve;
      el.onerror = () => reject(new Error('admin script failed to load'));
      document.body.appendChild(el);
    });
    window.__adminLoaded = true;
  })().catch(err => { _adminLoading = null; throw err; });
  return _adminLoading;
}
const ADMIN_ASSET_VERSION = '?v=20261101';
async function openAdminEntry(){
  try {
    await loadAdminModule();
    adminOpenEntry();
  } catch (err) {
    alert('Could not load the admin panel. Check your connection and try again.');
  }
}
// An admin session in progress needs the offline-sync code ready (it listens for
// the browser coming back online), so preload it in that case only.
try {
  if (sessionStorage.getItem('jewelry_admin_secret')) loadAdminModule().catch(() => {});
} catch (e) {}

function goToCategory(filter){
  document.querySelectorAll('.cat-chip').forEach(c => c.classList.toggle('active', c.dataset.filter === filter));
  const catSelect = document.getElementById('categorySelect');
  if(catSelect) catSelect.value = [...catSelect.options].some(o => o.value === filter) ? filter : 'all';
  renderGrid(filter);
  document.getElementById('menuDropdown').classList.remove('open');
  document.getElementById('collection').scrollIntoView({behavior:'smooth'});
}

document.querySelectorAll('.nav-dropdown-toggle').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    btn.parentElement.classList.toggle('open');
  });
});
document.addEventListener('click', () => {
  document.querySelectorAll('.nav-dropdown.open').forEach(d => d.classList.remove('open'));
});

const CUSTOMER_STORAGE_KEY = 'jewelry_customer_session';
let pendingCartAction = null;
let authMode = 'login';

function getCustomerInfo(){
  try { return JSON.parse(localStorage.getItem(CUSTOMER_STORAGE_KEY) || 'null'); }
  catch (e) { return null; }
}

function customerFetch(url, options = {}){
  const session = getCustomerInfo();
  const headers = { ...(options.headers || {}) };
  if (session && session.token) headers['X-Customer-Token'] = session.token;
  return fetch(url, { ...options, headers });
}

// Gates add-to-bag / buy-now / checkout behind a real account (accounts are
// required to buy, per the storefront's checkout policy).
function requireRegistration(action){
  if (getCustomerInfo()) { action(); return; }
  pendingCartAction = action;
  showRegisterModal();
}

function showRegisterModal(){
  switchAuthTab('login');
  document.getElementById('overlay').classList.add('open');
  document.getElementById('registerModal').classList.add('open');
  setTimeout(() => document.getElementById('regPhoneInput').focus(), 100);
}

function switchAuthTab(mode){
  authMode = mode;
  document.getElementById('registerErr').style.display = 'none';
  document.getElementById('authTabLogin').classList.toggle('active', mode === 'login');
  document.getElementById('authTabRegister').classList.toggle('active', mode === 'register');
  document.getElementById('authNameField').style.display = mode === 'register' ? 'block' : 'none';
  document.getElementById('authTitle').textContent = mode === 'register' ? 'Create Account' : 'Log In';
  document.getElementById('authSubtitle').textContent = mode === 'register'
    ? 'Sign up to shop, track orders, and check out'
    : 'An account is required to buy';
  document.getElementById('authSubmitBtn').textContent = mode === 'register' ? 'Create Account' : 'Log In';
  document.getElementById('authNote').textContent = mode === 'register'
    ? 'We only use this to confirm your M-Pesa order and delivery.'
    : "Don't have an account? Use the Create Account tab above.";
}

async function submitAuth(){
  const name = document.getElementById('regNameInput').value.trim();
  const phone = document.getElementById('regPhoneInput').value.trim();
  const password = document.getElementById('regPasswordInput').value;
  const errBox = document.getElementById('registerErr');
  errBox.style.display = 'none';

  const phoneOk = /^(?:\+?254|0)[71]\d{8}$/.test(phone.replace(/\s+/g, ''));
  if (!phoneOk) {
    errBox.textContent = 'Enter a valid Kenyan phone number, e.g. 0712 345 678.';
    errBox.style.display = 'block';
    return;
  }
  if (!password || password.length < 6) {
    errBox.textContent = 'Password must be at least 6 characters.';
    errBox.style.display = 'block';
    return;
  }
  if (authMode === 'register' && !name) {
    errBox.textContent = 'Please enter your full name.';
    errBox.style.display = 'block';
    return;
  }

  const btn = document.getElementById('authSubmitBtn');
  btn.style.pointerEvents = 'none'; btn.style.opacity = '0.6';
  try {
    const endpoint = authMode === 'register' ? '/auth/register' : '/auth/login';
    const body = authMode === 'register' ? { name, phone, password } : { phone, password };
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      errBox.textContent = data.detail || 'Something went wrong. Please try again.';
      errBox.style.display = 'block';
      return;
    }
    localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify({ token: data.token, name: data.name, phone: data.phone }));
    closeAll();
    if (pendingCartAction) {
      const action = pendingCartAction;
      pendingCartAction = null;
      action();
    }
  } catch (err) {
    errBox.textContent = 'Could not reach the server. Please check your connection.';
    errBox.style.display = 'block';
  } finally {
    btn.style.pointerEvents = ''; btn.style.opacity = '';
  }
}

function openAccountEntry(){
  const session = getCustomerInfo();
  if (!session) { showRegisterModal(); return; }
  document.getElementById('accountGreeting').textContent = `Hi, ${session.name}`;
  document.getElementById('overlay').classList.add('open');
  document.getElementById('accountDrawer').classList.add('open');
  loadMyOrders();
}

function closeAccountDrawer(){
  document.getElementById('accountDrawer').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
}

async function loadMyOrders(){
  const list = document.getElementById('accountOrdersList');
  list.innerHTML = '<p style="color:var(--muted);padding:0 28px;">Loading…</p>';
  try {
    const res = await customerFetch(`${API_URL}/orders/mine`);
    if (res.status === 401) { customerLogout(); return; }
    if (!res.ok) throw new Error('failed');
    const orders = await res.json();
    if (orders.length === 0){
      list.innerHTML = '<div class="drawer-empty">No orders yet.<br>Your order history will show up here.</div>';
      return;
    }
    list.innerHTML = orders.map(o => `
      <div class="drawer-item" style="flex-direction:column;align-items:stretch;gap:6px;">
        <div style="display:flex;justify-content:space-between;">
          <strong>Order #${o.id}</strong>
          <span>${fmt(o.subtotal)}</span>
        </div>
        <div style="color:var(--muted);font-size:13px;">${ORDER_STATUS_LABEL[o.status] || o.status} · ${new Date(o.created_at).toLocaleDateString()}</div>
        <div style="color:var(--muted);font-size:13px;">${o.items.map(i => `${escapeHtml(i.name)} × ${i.quantity}`).join(', ')}</div>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = '<p style="color:#a3423f;padding:0 28px;">Could not load your orders.</p>';
  }
}

function customerLogout(){
  const session = getCustomerInfo();
  if (session && session.token) {
    customerFetch(`${API_URL}/auth/logout`, { method: 'POST' }).catch(() => {});
  }
  localStorage.removeItem(CUSTOMER_STORAGE_KEY);
  closeAccountDrawer();
}

const ORDER_STATUS_LABEL = { pending: 'Pending', paid: 'Paid', cancelled: 'Cancelled' };
const SUNZLY_WA_NUMBER = "254741573866";
const SUNZLY_STORE_NAME = "Sj Gems Jewelry Store";
let sunzlyOpened = false;
let sunzlyBusy = false;

const SUNZLY_ESCALATION = [
  {
    reason: "human",
    test: /\b(human|real person|speak to (someone|somebody)|talk to (someone|somebody)|customer care|customer support|representative|agent)\b/,
    msg: "Sure  connecting you with our team on WhatsApp now."
  },
  {
    reason: "complaint",
    test: /\b(complain|complaint|refund|broken|damaged|wrong (item|order|product)|not happy|unhappy|angry|disappointed|poor quality|faulty|defective|scam|cheated|exchange)\b/,
    msg: "I'm sorry to hear that. This is best handled directly by our team  let me connect you on WhatsApp."
  },
  {
    reason: "order",
    test: /\b(my order|order status|track (my )?order|where is my order|haven'?t received|did ?n'?t receive|cancel (my )?order)\b/,
    msg: "For order status or changes, our team can look that up for you directly  connecting you on WhatsApp."
  },
  {
    reason: "negotiate",
    test: /\b(negotiate|discount|lower the price|reduce the price|best price|bargain|lowest price|cheaper price|can you reduce)\b/,
    msg: "For special pricing, our team can chat with you directly  connecting you on WhatsApp."
  },
  {
    reason: "policy",
    test: /\b(return polic|returns polic|sizing guide|ring size|what size|size guide)\b/,
    msg: "For exact sizing and returns details on a specific piece, our team can confirm that for you  connecting you on WhatsApp."
  }
];

const SUNZLY_FAQ = [
  {
    test: /\b(deliver|delivery|shipping|ship|how long|when will i get)\b/,
    reply: "We deliver country-wide from our Ruaka store, with new stock arriving every week, gift-boxed. Exact delivery time depends on your location  happy to have our team confirm timing if you'd like."
  },
  {
    test: /\b(mpesa|m-pesa|pay|payment|checkout|stk)\b/,
    reply: "Checkout is by M-Pesa: add items to your bag and tap <strong>Checkout with M-Pesa</strong> to place your order. We'll confirm payment details with you directly by phone or WhatsApp before it's dispatched."
  },
  {
    test: /\b(material|materials|gold|silver|plated|genuine|real gold|certified)\b/,
    reply: "Our pieces use certified materials  Emerald, Silver, Brass and Gold-plated metals, plus genuine leather and pearl products."
  },
  {
    test: /\b(location|address|where are you|shop location|find you|visit|directions)\b/,
    reply: `You'll find us in Ruaka, Kiambu. You can also reach us on WhatsApp/call at +${SUNZLY_WA_NUMBER.replace(/^254/, "254 ")} or email hello@sjgemsjewelrystore.co.ke.`
  },
  {
    test: /\b(open|hours|opening time|closing time)\b/,
    reply: "For our exact opening hours, our team can confirm on WhatsApp  they're quick to respond!"
  },
  {
    test: /\b(new|latest|new arrivals|just in|newest)\b/,
    reply: null,
    dynamic: "newArrivals"
  }
];

function sunzlyTokenize(s){
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(t => t.length >= 3);
}

function sunzlySearchProducts(text){
  const tokens = sunzlyTokenize(text);
  if (!tokens.length || !PRODUCTS.length) return [];
  const scored = PRODUCTS.map(p => {
    const hay = `${p.name} ${p.catLabel} ${p.cat}`.toLowerCase();
    let score = 0;
    tokens.forEach(t => { if (hay.includes(t)) score++; });
    return { p, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map(x => x.p);
}

function sunzlyProductListHtml(products){
  const items = products.map(p => {
    const stock = stockInfo(p.quantity);
    const stockTxt = stock ? `  <em>${stock.text}</em>` : "";
    return `<li>${p.name} (${p.catLabel})  ${fmt(p.price)}${stockTxt}</li>`;
  }).join("");
  return `<ul>${items}</ul>`;
}

function sunzlyHandoffLink(userText){
  const preset = `Hi! I was chatting with Sunzly AI on the site about: "${userText.slice(0, 180)}". Could you help me further?`;
  return `https://wa.me/${SUNZLY_WA_NUMBER}?text=${encodeURIComponent(preset)}`;
}

function sunzlyRenderMessage(role, html){
  const body = document.getElementById("sunzlyBody");
  const div = document.createElement("div");
  div.className = `sunzly-msg ${role}`;
  div.innerHTML = html;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function sunzlyShowTyping(){
  const body = document.getElementById("sunzlyBody");
  const div = document.createElement("div");
  div.className = "sunzly-typing";
  div.id = "sunzlyTypingIndicator";
  div.innerHTML = "<span></span><span></span><span></span>";
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function sunzlyHideTyping(){
  const el = document.getElementById("sunzlyTypingIndicator");
  if (el) el.remove();
}

function sunzlyEscalate(reason, msg, userText){
  const link = sunzlyHandoffLink(userText);
  const html = `${msg}
    <a class="sunzly-handoff-btn" href="${link}" target="_blank" rel="noopener">
      <svg viewBox="0 0 24 24"><path d="M17.5 14.4c-.3-.2-1.7-.8-2-1-.3-.1-.5-.2-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.4-1.5-.9-.8-1.5-1.8-1.6-2.1-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.2-.1.2-.3.3-.5.1-.2 0-.4 0-.5C10 9 9.5 7.8 9.3 7.3c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2.1 3.2 5.1 4.4.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4z"/><path d="M12 2a10 10 0 00-8.5 15.2L2 22l4.9-1.3A10 10 0 1012 2zm0 18a8 8 0 01-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1112 20z"/></svg>
      Continue on WhatsApp
    </a>`;
  sunzlyRenderMessage("bot", html);
}

function sunzlyRespond(text){
  const lower = text.toLowerCase();

  for (const rule of SUNZLY_ESCALATION) {
    if (rule.test.test(lower)) {
      sunzlyEscalate(rule.reason, rule.msg, text);
      return;
    }
  }

  if (/\b(hi|hello|hey|habari|mambo|niaje)\b/.test(lower)) {
    sunzlyRenderMessage("bot", `Hi! I'm Sunzly AI 👋 How can I help  delivery, payment, or finding a piece from our collection?`);
    return;
  }

  if (/\b(who are you|what are you|sunzly)\b/.test(lower)) {
    sunzlyRenderMessage("bot", `I'm Sunzly AI, the assistant for ${SUNZLY_STORE_NAME}. I can help with delivery, payment, materials, and finding pieces in our catalogue  and I'll bring in our team for anything trickier.`);
    return;
  }

  if (/\b(thank you|thanks|asante|cheers)\b/.test(lower)) {
    sunzlyRenderMessage("bot", "You're welcome! Anything else I can help with?");
    return;
  }
  if (/\b(bye|goodbye|see you)\b/.test(lower)) {
    sunzlyRenderMessage("bot", `Thanks for stopping by ${SUNZLY_STORE_NAME}! 💛`);
    return;
  }

  for (const rule of SUNZLY_FAQ) {
    if (rule.test.test(lower)) {
      if (rule.dynamic === "newArrivals") {
        const fresh = PRODUCTS.filter(p => p.isNew);
        if (fresh.length) {
          sunzlyRenderMessage("bot", `Here's what's new right now:${sunzlyProductListHtml(fresh.slice(0, 3))}Browse the full collection below for more.`);
        } else {
          sunzlyRenderMessage("bot", "New pieces drop every week! Browse the collection below and look out for our latest listings.");
        }
        return;
      }
      sunzlyRenderMessage("bot", rule.reply);
      return;
    }
  }

  const matches = sunzlySearchProducts(text);
  if (matches.length) {
    sunzlyRenderMessage("bot", `Here's what I found in our collection:${sunzlyProductListHtml(matches)}Scroll down to the Collection section to see more, or ask me anything else.`);
    return;
  }

  sunzlyEscalate("unsure", "I'm not fully sure about that one  let me connect you with our team so they can help directly.", text);
}

function sunzlySend(preset){
  if (sunzlyBusy) return;
  const input = document.getElementById("sunzlyInput");
  const text = (typeof preset === "string" ? preset : input.value).trim();
  if (!text) return;
  sunzlyRenderMessage("user", text.replace(/</g, "&lt;"));
  input.value = "";
  sunzlyBusy = true;
  sunzlyShowTyping();
  setTimeout(() => {
    sunzlyHideTyping();
    sunzlyRespond(text);
    sunzlyBusy = false;
  }, 500 + Math.random() * 400);
}

function toggleSunzly(force){
  const panel = document.getElementById("sunzlyPanel");
  const willOpen = typeof force === "boolean" ? force : !panel.classList.contains("open");
  panel.classList.toggle("open", willOpen);
  if (willOpen) {
    document.getElementById("sunzlyDot").style.display = "none";
    if (!sunzlyOpened) {
      sunzlyOpened = true;
      sunzlyRenderMessage("bot", `Hi, I'm Sunzly AI 👋 the virtual assistant for ${SUNZLY_STORE_NAME}. Ask me about delivery, payment, or our collection  I'll bring in our team for anything I can't handle myself.`);
    }
    document.getElementById("sunzlyInput").focus();
  }
}

(function applyInitialCategory(){
  const c = window.__INITIAL_CATEGORY__;
  const sel = document.getElementById('categorySelect');
  if (c && sel && [...sel.options].some(o => o.value === c)) sel.value = c;
})();

loadProducts();
updateCartUI();
