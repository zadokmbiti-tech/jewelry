#!/usr/bin/env node
/*
 * Generates the crawlable category landing pages and keeps the static menus in sync.
 *
 *   node scripts/build-categories.js
 *
 * Source of truth: CATEGORY_META and CATEGORY_GROUPS in frontend/app.js.
 * Re-run this whenever you add, rename or remove a category, then commit the result.
 *
 * What it writes (all inside frontend/):
 *   - index.html            : refreshes the Menu dropdown and footer "Shop" links
 *                             (the parts between the <!--MENU--> / <!--FOOTSHOP--> markers)
 *   - c/<group>/index.html  : one page per category group      -> /c/necklaces/
 *   - c/<group>/<sub>/index.html : one page per sub-category   -> /c/necklaces/pearl-necklaces/
 *   - sitemap.xml           : home, About, Help and every category page
 *
 * Every generated page is the normal storefront (same app.js / styles.css) with its own
 * title, description, canonical URL, H1, intro text, breadcrumb and links. The product grid
 * is still filled in by app.js from the API, pre-filtered to that category.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SITE = 'https://jewelrywebpage.vercel.app';
const FRONTEND = path.join(__dirname, '..', 'frontend');
const read = (f) => fs.readFileSync(path.join(FRONTEND, f), 'utf8');
const write = (f, s) => {
  const full = path.join(FRONTEND, f);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, s);
};

// Same rule as slugify() in frontend/app.js
const slugify = (str) =>
  String(str).toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const esc = (str) =>
  String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------------------------------------------------------------- category data
function loadCategories() {
  const src = read('app.js');
  const grab = (name, open, close) => {
    const start = src.indexOf(`const ${name} =`);
    if (start < 0) throw new Error(`${name} not found in app.js`);
    const from = src.indexOf(open, start);
    const end = src.indexOf(`\n${close};`, from);
    if (from < 0 || end < 0) throw new Error(`could not read ${name}`);
    return src.slice(from, end + 1 + close.length);
  };
  const meta = new Function(`return ${grab('CATEGORY_META', '{', '}')}`)();
  const groups = new Function(`return ${grab('CATEGORY_GROUPS', '[', ']')}`)();
  if (groups.some((g) => !Array.isArray(g) || !Array.isArray(g[1]))) {
    throw new Error('CATEGORY_GROUPS has a malformed entry (missing comma?)');
  }
  return groups.map(([label, keys]) => ({
    label,
    slug: slugify(label),
    filter: `group:${label}`,
    subs: keys.map((key) => {
      const label = (meta[key] || { label: key }).label;
      return { key, label, slug: slugify(key) };
    }),
  }));
}

// ---------------------------------------------------------------- shared markup
function menuHtml(groups) {
  const out = [`<a class="nd-all" href="/#collection">✦ All Pieces</a>`];
  for (const g of groups) {
    out.push(`<div class="nd-group-title"><a href="/c/${g.slug}/">${esc(g.label)}</a></div>`);
    for (const s of g.subs) out.push(`<a href="/c/${g.slug}/${s.slug}/">${esc(s.label)}</a>`);
  }
  return out.map((l) => '          ' + l).join('\n') + '\n          ';
}

function footerShopHtml(groups) {
  const find = (g, k) => groups.find((x) => x.slug === g).subs.find((s) => s.key === k);
  const links = [];
  const set = groups.find((g) => g.slug === 'jewelry-sets');
  if (set) links.push([`/c/${set.slug}/${find('jewelry-sets', 'xuping-sets').slug}/`, 'Xuping Sets']);
  for (const slug of ['necklaces', 'earrings', 'belts']) {
    const g = groups.find((x) => x.slug === slug);
    if (g) links.push([`/c/${g.slug}/`, slug === 'belts' ? 'Leather Belts' : g.label]);
  }
  return links.map(([h, t]) => `<a href="${h}">${esc(t)}</a>`).join('');
}

const replaceBetween = (html, name, inner) => {
  const a = `<!--${name}:START-->`;
  const b = `<!--${name}:END-->`;
  const i = html.indexOf(a);
  const j = html.indexOf(b);
  if (i < 0 || j < i) throw new Error(`marker ${name} missing in index.html`);
  return html.slice(0, i + a.length) + inner + html.slice(j);
};

// ---------------------------------------------------------------- page text
const HOURS = 'Monday to Saturday, 8:00 AM to 10:00 PM';

function pageInfo(group, sub) {
  const label = sub ? sub.label : group.label;
  const pathname = sub ? `/c/${group.slug}/${sub.slug}/` : `/c/${group.slug}/`;
  const title = sub ? `${label} in Kenya | Sj Gems Ruaka` : `${label} in Ruaka, Kenya | Sj Gems`;
  let description;
  if (sub) {
    description = `Shop ${label} at Sj Gems Jewelry Store in Ruaka, Kiambu. Order online, pay with M-Pesa and get delivery across Kenya.`;
  } else {
    const head = `Browse ${label.toLowerCase()} at Sj Gems in Ruaka, Kiambu: `;
    const tail = '. Pay with M-Pesa and get delivery across Kenya.';
    let list = '';
    for (const s of group.subs) {
      const next = list ? `${list}, ${s.label}` : s.label;
      if ((head + next + ' and more' + tail).length > 158) break;
      list = next;
    }
    description = `${head}${list}${list === group.subs.map((s) => s.label).join(', ') ? '' : ' and more'}${tail}`;
  }
  const h1 = sub ? label : `${label} in Ruaka, Kenya`;
  const intro =
    `Browse our ${label.toLowerCase()} at Sj Gems Jewelry Store in Ruaka, Kiambu County. ` +
    `Order online and pay with M-Pesa, or visit the store ${HOURS}. We deliver across Kenya.`;
  return { label, pathname, title, description, h1, intro, filter: sub ? sub.key : group.filter };
}

function introHtml(groups, group, sub, info) {
  const crumbs = [`<a href="/">Home</a>`];
  if (sub) {
    crumbs.push(`<a href="/c/${group.slug}/">${esc(group.label)}</a>`);
    crumbs.push(`<span aria-current="page">${esc(sub.label)}</span>`);
  } else {
    crumbs.push(`<span aria-current="page">${esc(group.label)}</span>`);
  }
  const related = sub
    ? group.subs.filter((s) => s.key !== sub.key).map((s) => [`/c/${group.slug}/${s.slug}/`, s.label])
    : group.subs.map((s) => [`/c/${group.slug}/${s.slug}/`, s.label]);
  const relatedTitle = sub ? `More in ${group.label}` : `Shop ${group.label} by type`;
  const others = groups.filter((g) => g.slug !== group.slug).map((g) => [`/c/${g.slug}/`, g.label]);
  const list = (items) => items.map(([h, t]) => `<li><a href="${h}">${esc(t)}</a></li>`).join('');
  return `
<div class="cat-intro">
  <nav class="breadcrumb" aria-label="Breadcrumb">${crumbs.join('<span class="sep" aria-hidden="true">/</span>')}</nav>
  <h1>${esc(info.h1)}</h1>
  <p class="cat-intro-text">${esc(info.intro)}</p>
  ${related.length ? `<div class="cat-links"><h2>${esc(relatedTitle)}</h2><ul>${list(related)}</ul></div>` : ''}
  <div class="cat-links"><h2>Other categories</h2><ul>${list(others)}</ul></div>
</div>
`;
}

function structuredData(baseGraph, group, sub, info) {
  const url = SITE + info.pathname;
  const crumbs = [{ name: 'Home', url: SITE + '/' }, { name: group.label, url: `${SITE}/c/${group.slug}/` }];
  if (sub) crumbs.push({ name: sub.label, url });
  const graph = [
    ...baseGraph,
    {
      '@type': 'CollectionPage',
      '@id': url + '#page',
      url,
      name: info.title.replace(/&amp;/g, '&'),
      description: info.description,
      isPartOf: { '@id': SITE + '/#website' },
      about: { '@id': SITE + '/#store' },
      breadcrumb: { '@id': url + '#breadcrumb' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': url + '#breadcrumb',
      itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })),
    },
  ];
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2).replace(/</g, '\\u003c');
}

function seoHead(info, baseGraph, group, sub) {
  const url = SITE + info.pathname;
  const t = esc(info.title);
  const d = esc(info.description);
  const img = `${SITE}/Assets/sjgems-logo.png`;
  return `<title>${t}</title>
<meta name="description" content="${d}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Sj Gems Jewelry Store">
<meta property="og:locale" content="en_KE">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${img}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${img}">
<script type="application/ld+json">
${structuredData(baseGraph, group, sub, info)}
</script>`;
}

// ---------------------------------------------------------------- build
function main() {
  const groups = loadCategories();

  // 1) refresh the static menus inside index.html
  let index = read('index.html');
  index = replaceBetween(index, 'MENU', '\n' + menuHtml(groups));
  index = replaceBetween(index, 'FOOTSHOP', footerShopHtml(groups));
  write('index.html', index);

  // base structured data (WebSite + JewelryStore) comes from the home page
  const seoRegion = index.slice(index.indexOf('<!--SEO:START-->'), index.indexOf('<!--SEO:END-->'));
  const ld = seoRegion.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
  if (!ld) throw new Error('home page JSON-LD not found');
  const baseGraph = JSON.parse(ld[1])['@graph'];

  // 2) build the template for category pages (root-relative URLs)
  const template = index
    .replace('href="styles.css', 'href="/styles.css')
    .replace('src="app.js', 'src="/app.js')
    .replace(/href="about\.html/g, 'href="/about.html')
    .replace(/href="help-center\.html/g, 'href="/help-center.html')
    .replace(/href="#top"/g, 'href="/"');

  // On category pages the product grid should come first; the "Popular Categories"
  // tiles move below it instead of pushing the page content down.
  const moveTilesBelowGrid = (html) => {
    const a = html.indexOf('<section id="popularCategories">');
    const aEnd = a < 0 ? -1 : html.indexOf('</section>', a) + '</section>'.length;
    const c = html.indexOf('<section id="collection">');
    const cEnd = c < 0 ? -1 : html.indexOf('</section>', c) + '</section>'.length;
    if (a < 0 || c < 0 || a > c) throw new Error('could not reorder category tiles');
    const tiles = html.slice(a, aEnd);
    return html.slice(0, a) + html.slice(aEnd, cEnd) + '\n\n' + tiles + html.slice(cEnd);
  };

  // 3) wipe old generated pages, then write new ones
  fs.rmSync(path.join(FRONTEND, 'c'), { recursive: true, force: true });
  const urls = [];
  let count = 0;
  const emit = (group, sub) => {
    const info = pageInfo(group, sub);
    let html = template;
    html = replaceBetween(html, 'SEO', '\n' + seoHead(info, baseGraph, group, sub) + '\n');
    html = replaceBetween(html, 'H1', '');
    html = replaceBetween(html, 'INTRO', introHtml(groups, group, sub, info));
    html = moveTilesBelowGrid(html);
    const setCat = `<script>window.__INITIAL_CATEGORY__ = ${JSON.stringify(info.filter).replace(/</g, '\\u003c')};</script>\n`;
    html = html.replace('<script src="/app.js', setCat + '<script src="/app.js');
    write(path.join(info.pathname.replace(/^\//, ''), 'index.html'), html);
    urls.push({ loc: SITE + info.pathname, priority: sub ? '0.6' : '0.8' });
    count += 1;
  };
  for (const g of groups) {
    emit(g, null);
    for (const s of g.subs) emit(g, s);
  }

  // 4) sitemap
  const fixed = [
    { loc: SITE + '/', priority: '1.0', changefreq: 'weekly' },
    { loc: SITE + '/about.html', priority: '0.5', changefreq: 'monthly' },
    { loc: SITE + '/help-center.html', priority: '0.5', changefreq: 'monthly' },
  ];
  const all = [...fixed, ...urls.map((u) => ({ ...u, changefreq: 'weekly' }))];
  write(
    'sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      all
        .map((u) => `  <url><loc>${u.loc}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`)
        .join('\n') +
      `\n</urlset>\n`
  );
  console.log(`Generated ${count} category pages (${groups.length} groups) and a sitemap with ${all.length} URLs.`);
}

main();
