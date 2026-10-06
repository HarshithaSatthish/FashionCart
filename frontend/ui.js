export const categories = ["T-Shirts","Shirts","Jeans","Trousers","Dresses","Jackets","Shoes","Handbags","Accessories","Sportswear"];

export function esc(value='') {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

export function money(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export function num(value) { return new Intl.NumberFormat('en-IN').format(Number(value || 0)); }
export function pct(value, digits=0) { return `${(Number(value || 0) * 100).toFixed(digits)}%`; }
export function when(value) { if (!value) return '—'; const d = new Date(value); return d.toLocaleString([], {dateStyle:'medium', timeStyle:'short'}); }
export function dateOnly(value) { if (!value) return '—'; return new Date(value).toLocaleDateString([], {dateStyle:'medium'}); }
export function initials(name='User') { return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase(); }

const paths = {
  dashboard:'M3 3h7v7H3zM14 3h7v4h-7zM14 11h7v10h-7zM3 14h7v7H3z',
  products:'M4 7.5 12 3l8 4.5v9L12 21l-8-4.5zM4 7.5l8 4.5 8-4.5M12 12v9',
  customers:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  orders:'M6 2h12l2 5H4zM5 7v14h14V7M9 11h6',
  transactions:'M4 4h16v16H4zM8 8h8M8 12h8M8 16h5',
  analysis:'M4 19V9M10 19V5M16 19v-7M22 19V3',
  rules:'M6 3v12M18 9v12M6 9h12M6 15h12M3 3h6v6H3zM15 15h6v6h-6z',
  recommend:'M12 2l1.8 5.3L19 9l-5.2 1.7L12 16l-1.8-5.3L5 9l5.2-1.7zM19 15l.9 2.6L22.5 19l-2.6.9L19 22.5l-.9-2.6-2.6-.9 2.6-1.4z',
  profile:'M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10',
  search:'M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15',
  bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  logout:'M10 17l5-5-5-5M15 12H3M21 3v18h-6',
  plus:'M12 5v14M5 12h14',
  upload:'M12 16V4M7 9l5-5 5 5M4 20h16',
  arrow:'M5 12h14M13 6l6 6-6 6',
  chevron:'M9 18l6-6-6-6',
  edit:'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  trash:'M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6',
  close:'M6 6l12 12M18 6 6 18',
  check:'M5 12l4 4L19 6',
  filter:'M4 5h16M7 12h10M10 19h4',
  more:'M5 12h.01M12 12h.01M19 12h.01',
  back:'M19 12H5M11 18l-6-6 6-6',
  lock:'M6 10h12v10H6zM8 10V7a4 4 0 0 1 8 0v3',
  mail:'M3 5h18v14H3zM3 6l9 7 9-7',
  user:'M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10',
  calendar:'M4 6h16v15H4zM8 3v6M16 3v6M4 10h16',
  download:'M12 4v12M7 11l5 5 5-5M4 20h16',
};

export function icon(name, size=18) {
  const d = paths[name] || paths.dashboard;
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

export function badge(text, tone='neutral') { return `<span class="badge badge-${tone}">${esc(text)}</span>`; }
export function statusBadge(status='') {
  const s=String(status).toUpperCase();
  const tone=s==='COMPLETED'||s==='ACTIVE'?'success':s==='PENDING'||s==='RUNNING'?'warn':s==='CANCELLED'||s==='FAILED'?'danger':'neutral';
  return badge(s || 'UNKNOWN', tone);
}

export function productVisual(product, size='md') {
  const name = typeof product === 'string' ? product : product?.product_name || product?.product || 'Product';
  const cat = typeof product === 'object' ? product?.category : '';
  const glyph = cat==='Shoes'?'◒':cat==='Handbags'?'▰':cat==='Dresses'?'⌁':cat==='Jeans'||cat==='Trousers'?'Ⅱ':cat==='Jackets'?'◇':cat==='Accessories'?'◉':'⌑';
  return `<div class="product-visual pv-${size}" data-seed="${esc(name.slice(0,1))}"><span>${glyph}</span></div>`;
}

export function metric(label, value, meta='', tone='violet', iconName='analysis') {
  return `<article class="metric-card"><div class="metric-top"><span class="metric-label">${esc(label)}</span><span class="metric-icon tone-${tone}">${icon(iconName,16)}</span></div><div class="metric-value">${esc(value)}</div>${meta?`<div class="metric-meta">${meta}</div>`:''}</article>`;
}

export function emptyState(title, action='', nav='') {
  return `<div class="empty-state"><div class="empty-mark">${icon('recommend',28)}</div><h3>${esc(title)}</h3>${action?`<button class="btn btn-primary" data-nav="${esc(nav)}">${esc(action)}</button>`:''}</div>`;
}

export function loadingRows(count=5) {
  return `<div class="skeleton-list">${Array.from({length:count},(_,i)=>`<div class="skeleton-row"><span style="width:${35+(i%3)*15}%"></span><span></span><span></span></div>`).join('')}</div>`;
}

export function errorBlock(message='Something went wrong.') {
  return `<div class="error-state"><div class="error-code">!</div><h3>Something went wrong</h3><p>${esc(message)}</p><button class="btn btn-secondary" data-retry>Retry</button></div>`;
}
