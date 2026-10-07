import { categories, esc, money, num, pct, when, dateOnly, initials, icon, badge, statusBadge, productVisual, metric, emptyState, loadingRows, errorBlock } from './ui.js';

const app = document.getElementById('app');
const overlayRoot = document.getElementById('overlay-root');
const toastRoot = document.getElementById('toast-root');
const API = window.FASHIONCART_API_URL || '/api';

const state = {
  token: localStorage.getItem('fashioncart_token') || '',
  user: null,
  authMode: 'login',
  route: location.hash.slice(1) || '/dashboard',
  busy: false,
  lastRender: null,
  basket: [],
  pg: {},
};

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  if (options.json !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && state.token) logout(false);
    const err = new Error(payload?.error?.message || payload?.detail?.message || `Request failed (${response.status})`);
    err.status = response.status;
    err.code = payload?.error?.code || 'REQUEST_FAILED';
    err.details = payload;
    throw err;
  }
  return payload;
}

const PAGE_SIZE = 25;
const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// Load every page of a list endpoint (for dropdowns/pickers). Capped to protect the browser.
async function fetchAll(path, cap = 2000) {
  const sep = path.includes('?') ? '&' : '?';
  let items = [], total = 0;
  for (let p = 1; ; p++) {
    const d = await api(`${path}${sep}limit=100&page=${p}`);
    const batch = d.items || [];
    total = d.total; items = items.concat(batch);
    if (!batch.length || items.length >= total || items.length >= cap) break;
  }
  return { items, total };
}

function pagerHtml(d) {
  const pages = Math.max(1, Math.ceil(d.total / d.limit));
  const from = d.total ? (d.page - 1) * d.limit + 1 : 0, to = Math.min(d.total, d.page * d.limit);
  const dis = (c) => c ? 'disabled' : '';
  return `<nav class="pager" aria-label="Pagination"><span class="pager-info">Showing <b>${num(from)}–${num(to)}</b> of <b>${num(d.total)}</b></span><div class="pager-btns"><button class="table-action" data-pg="first" ${dis(d.page <= 1)} aria-label="First page">«</button><button class="table-action" data-pg="prev" ${dis(d.page <= 1)}>‹ Prev</button><span class="pager-page">Page ${d.page} / ${pages}</span><button class="table-action" data-pg="next" ${dis(d.page >= pages)}>Next ›</button><button class="table-action" data-pg="last" ${dis(d.page >= pages)} aria-label="Last page">»</button></div></nav>`;
}

// Server-side paginated table. cfg: {key, tbody, pager, cols, empty, path(), row(item), after?(data)}
async function loadTable(cfg) {
  const st = state.pg[cfg.key] || (state.pg[cfg.key] = { page: 1 });
  const tb = document.getElementById(cfg.tbody), pg = document.getElementById(cfg.pager);
  if (!tb || !pg) return;
  const seq = st.seq = (st.seq || 0) + 1;
  const wrap = tb.closest('.table-wrap');
  wrap?.setAttribute('aria-busy', 'true'); tb.style.opacity = '.55';
  const base = cfg.path();
  let d;
  try { d = await api(`${base}${base.includes('?') ? '&' : '?'}page=${st.page}&limit=${PAGE_SIZE}`); }
  catch (err) { if (seq === st.seq) { tb.style.opacity = ''; wrap?.removeAttribute('aria-busy'); toast(err.message, 'danger'); } return; }
  if (seq !== st.seq) return; // a newer request superseded this one
  const pages = Math.max(1, Math.ceil(d.total / d.limit));
  if (st.page > pages) { st.page = pages; return loadTable(cfg); }
  tb.style.opacity = ''; wrap?.removeAttribute('aria-busy');
  tb.innerHTML = d.items.length ? d.items.map(cfg.row).join('') : `<tr><td colspan="${cfg.cols}">${emptyState(cfg.empty)}</td></tr>`;
  pg.innerHTML = pagerHtml(d);
  pg.querySelectorAll('[data-pg]').forEach(b => b.addEventListener('click', () => {
    const a = b.dataset.pg;
    st.page = a === 'first' ? 1 : a === 'prev' ? st.page - 1 : a === 'next' ? st.page + 1 : pages;
    loadTable(cfg);
  }));
  bindPageNav(tb);
  cfg.after?.(d);
}

function toast(message, tone='success') {
  const node = document.createElement('div');
  node.className = `toast toast-${tone}`;
  node.innerHTML = `<span class="toast-dot"></span><span>${esc(message)}</span>`;
  toastRoot.appendChild(node);
  requestAnimationFrame(() => node.classList.add('show'));
  setTimeout(() => { node.classList.remove('show'); setTimeout(() => node.remove(), 220); }, 3200);
}

function showModal(html) {
  overlayRoot.innerHTML = `<div class="overlay" data-close-overlay><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  overlayRoot.querySelector('.modal').addEventListener('click', e => e.stopPropagation());
  overlayRoot.querySelector('[data-close-overlay]').addEventListener('click', () => closeOverlay());
  overlayRoot.querySelectorAll('[data-modal-close]').forEach(x => x.addEventListener('click', closeOverlay));
}
function showDrawer(html) {
  overlayRoot.innerHTML = `<div class="overlay" data-close-overlay><aside class="drawer" role="dialog" aria-modal="true">${html}</aside></div>`;
  overlayRoot.querySelector('.drawer').addEventListener('click', e => e.stopPropagation());
  overlayRoot.querySelector('[data-close-overlay]').addEventListener('click', closeOverlay);
  overlayRoot.querySelectorAll('[data-modal-close]').forEach(x => x.addEventListener('click', closeOverlay));
}
function closeOverlay(){ overlayRoot.innerHTML=''; }

function nav(path) {
  if (!path.startsWith('/')) path = `/${path}`;
  location.hash = path;
}

function logout(show=true) {
  localStorage.removeItem('fashioncart_token');
  state.token = '';
  state.user = null;
  state.route = '/dashboard';
  if (show) toast('Signed out', 'neutral');
  render();
}

function roleCan(section) {
  const role = state.user?.role;
  if (role === 'ADMIN') return true;
  if (role === 'ANALYST') return ['dashboard','products','customers','orders','transactions','analysis','rules','recommendations','profile'].includes(section);
  if (role === 'USER') return ['dashboard','products','recommendations','profile'].includes(section);
  return false;
}

const navGroups = [
  { label:'MAIN', items:[
    ['dashboard','/dashboard','Dashboard','dashboard'],
    ['products','/products','Products','products'],
    ['customers','/customers','Customers','customers'],
    ['orders','/orders','Orders','orders'],
  ]},
  { label:'INTELLIGENCE', items:[
    ['transactions','/transactions','Transactions','transactions'],
    ['analysis','/analysis','Apriori Analysis','analysis'],
    ['analysis','/rules','Association Rules','rules'],
    ['recommendations','/recommendations','Recommendations','recommend'],
  ]},
  { label:'SYSTEM', items:[['users','/users','Users','customers'],['profile','/profile','Profile','profile']]},
];

function activePath(path) {
  const r = state.route;
  if (path === '/dashboard') return r === '/dashboard';
  return r === path || r.startsWith(`${path}/`);
}

function sidebar() {
  const groups = navGroups.map(group => {
    const items = group.items.filter(([perm]) => roleCan(perm)).map(([,path,label,ico]) =>
      `<button class="nav-item ${activePath(path)?'active':''}" data-nav="${path}">${icon(ico,18)}<span>${esc(label)}</span></button>`
    ).join('');
    if (!items) return '';
    return `<div class="nav-group"><div class="nav-label">${group.label}</div>${items}</div>`;
  }).join('');
  const mobileItems = state.user?.role === 'USER'
    ? [['/dashboard','Home','dashboard'],['/products','Products','products'],['/recommendations','Recommend','recommend'],['/profile','Profile','profile']]
    : [['/dashboard','Home','dashboard'],['/products','Products','products'],['/analysis','Analysis','analysis'],['/recommendations','Recommend','recommend']];
  const mobile = mobileItems.map(([path,label,ico]) => `<button class="mobile-tab ${activePath(path)?'active':''}" data-nav="${path}">${icon(ico,17)}<span>${label}</span></button>`).join('')
    + (state.user?.role === 'USER' ? '' : `<button class="mobile-tab" id="mobileMore">${icon('more',17)}<span>More</span></button>`);
  return `<aside class="sidebar">
    <div class="brand"><span class="brand-mark">${icon('products',17)}</span><span>FashionCart</span></div>
    <nav>${groups}</nav><div class="mobile-tabs">${mobile}</div>
    <div class="sidebar-user">
      <span class="avatar">${esc(initials(state.user?.name))}</span>
      <span class="sidebar-user-copy"><b>${esc(state.user?.name)}</b><small>${esc(state.user?.role)}</small></span>
      <button class="icon-btn dark" id="sideLogout" title="Logout">${icon('logout',17)}</button>
    </div>
  </aside>`;
}

function pageTitle() {
  const r=state.route;
  if (r.startsWith('/products/')) return r.endsWith('/new')?'New Product':r.endsWith('/edit')?'Edit Product':'Product Detail';
  if (r.startsWith('/customers/')) return r.endsWith('/new')?'New Customer':'Customer Detail';
  if (r.startsWith('/orders/')) return r.endsWith('/new')?'Create Order':'Order Detail';
  if (r.startsWith('/analysis/')) return 'Analysis Detail';
  const map={'/dashboard':'Dashboard','/products':'Products','/customers':'Customers','/orders':'Orders','/transactions':'Transactions','/analysis':'Apriori Analysis','/rules':'Association Rules','/recommendations':'Recommendations','/users':'Users','/profile':'Profile'};
  return map[r] || 'FashionCart';
}

function shell() {
  return `<div class="app-shell">${sidebar()}<section class="workspace">
    <header class="topbar">
      <div class="crumb"><span>FashionCart</span><b>/</b><strong>${esc(pageTitle())}</strong></div>
      <div class="global-search-wrap"><span>${icon('search',16)}</span><input id="globalSearch" placeholder="Search products, orders..." autocomplete="off"><div class="search-results" id="globalResults"></div></div>
      <div class="top-actions">
        <span class="engine-pill"><i></i>Apriori Engine Ready</span>
        <button class="icon-btn" title="Notifications" id="notificationBtn">${icon('bell',17)}<span class="notification-dot"></span></button>
        ${roleCan('analysis')?`<button class="btn btn-primary compact" data-nav="/analysis">${icon('analysis',15)} Run Analysis</button>`:''}
        <button class="avatar-button" id="profileBtn"><span class="avatar sm">${esc(initials(state.user?.name))}</span><span class="top-user"><b>${esc(state.user?.name)}</b><small>${esc(state.user?.role)}</small></span>${icon('chevron',14)}</button>
      </div>
    </header>
    <main id="page" class="page"><div class="page-loading">${loadingRows(7)}</div></main>
  </section></div>`;
}

function bindGlobal() {
  document.querySelectorAll('[data-nav]').forEach(el => el.addEventListener('click', () => nav(el.dataset.nav)));
  document.getElementById('sideLogout')?.addEventListener('click', () => logout());
  document.getElementById('profileBtn')?.addEventListener('click', () => nav('/profile'));
  document.getElementById('notificationBtn')?.addEventListener('click', openNotifications);
  document.getElementById('mobileMore')?.addEventListener('click', openMobileMore);
  const search = document.getElementById('globalSearch');
  let timer;
  search?.addEventListener('input', () => {
    clearTimeout(timer);
    timer=setTimeout(()=>globalSearch(search.value), 180);
  });
  search?.addEventListener('keydown', e=>{ if(e.key==='Escape') document.getElementById('globalResults').classList.remove('open'); });
}


async function openNotifications() {
  showDrawer(`<div class="drawer-head"><div><span class="eyebrow">SYSTEM</span><h2>Notifications</h2></div><button class="icon-btn" data-modal-close>${icon('close')}</button></div><div class="page-loading compact">${loadingRows(3)}</div>`);
  try {
    const [dashboard, productData, analyses] = await Promise.all([
      api('/dashboard'),
      api('/products/stats'),
      roleCan('analysis') ? api('/analysis').catch(()=>[]) : Promise.resolve([]),
    ]);
    const lowStock=productData.low_stock;
    const outStock=productData.out_of_stock;
    const latest=analyses[0];
    const items=[];
    if(latest) items.push({tone:'success',title:`Analysis #${latest.id} completed`,detail:`${latest.association_rule_count} rules from ${latest.transaction_count} transactions.`,time:when(latest.created_at),nav:`/analysis/${latest.id}`});
    else if(roleCan('analysis')) items.push({tone:'violet',title:'Analysis not run yet',detail:'Run Apriori to generate association rules.',time:'Action',nav:'/analysis'});
    if(dashboard.top_rule) items.push({tone:'violet',title:'Recommendation rules ready',detail:`Top lift ${Number(dashboard.top_rule.lift).toFixed(2)}× is available.`,time:'Latest',nav:'/recommendations'});
    if(lowStock||outStock) items.push({tone:'warn',title:'Inventory attention',detail:`${lowStock} low-stock · ${outStock} out-of-stock products.`,time:'Current',nav:'/products'});
    if(!items.length) items.push({tone:'success',title:'All systems ready',detail:'No action is required right now.',time:'Now',nav:'/dashboard'});
    const drawer=overlayRoot.querySelector('.drawer');
    if(!drawer) return;
    drawer.innerHTML=`<div class="drawer-head"><div><span class="eyebrow">SYSTEM</span><h2>Notifications</h2></div><button class="icon-btn" data-modal-close>${icon('close')}</button></div><div class="notification-list">${items.map(n=>`<button class="notification notification-button" data-drawer-nav="${n.nav}"><span class="n-dot ${n.tone}"></span><div><b>${esc(n.title)}</b><small>${esc(n.detail)}</small></div><time>${esc(n.time)}</time></button>`).join('')}</div>`;
    drawer.querySelectorAll('[data-modal-close]').forEach(x=>x.addEventListener('click',closeOverlay));
    drawer.querySelectorAll('[data-drawer-nav]').forEach(x=>x.addEventListener('click',()=>{closeOverlay();nav(x.dataset.drawerNav)}));
  } catch(err) {
    const drawer=overlayRoot.querySelector('.drawer');
    if(drawer) drawer.innerHTML=`<div class="drawer-head"><div><span class="eyebrow">SYSTEM</span><h2>Notifications</h2></div><button class="icon-btn" data-modal-close>${icon('close')}</button></div>${errorBlock(err.message)}`;
    drawer?.querySelectorAll('[data-modal-close]').forEach(x=>x.addEventListener('click',closeOverlay));
  }
}

function openMobileMore() {
  const links=[
    ['/customers','Customers','customers'],['/orders','Orders','orders'],['/transactions','Transactions','transactions'],['/rules','Rules','rules'],['/users','Users','customers'],['/profile','Profile','profile']
  ].filter(([path])=>path==='/profile'||roleCan(path.slice(1)==='rules'?'analysis':path.slice(1)));
  showDrawer(`<div class="drawer-head"><div><span class="eyebrow">WORKSPACE</span><h2>More</h2></div><button class="icon-btn" data-modal-close>${icon('close')}</button></div><div class="mobile-more-list">${links.map(([path,label,ico])=>`<button class="nav-item" data-drawer-nav="${path}">${icon(ico,18)}<span>${esc(label)}</span>${icon('chevron',14)}</button>`).join('')}</div>`);
  overlayRoot.querySelectorAll('[data-drawer-nav]').forEach(x=>x.addEventListener('click',()=>{closeOverlay();nav(x.dataset.drawerNav)}));
}

async function globalSearch(q) {
  const box=document.getElementById('globalResults');
  if (!box) return;
  q=q.trim();
  if(q.length<2){ box.classList.remove('open'); return; }
  try {
    const [products,customers]=await Promise.all([
      api(`/products?limit=5&search=${encodeURIComponent(q)}`),
      roleCan('customers') ? api(`/customers?limit=5&search=${encodeURIComponent(q)}`).catch(()=>({items:[]})) : Promise.resolve({items:[]}),
    ]);
    let rows=(products.items||[]).map(p=>`<button data-search-nav="/products/${p.id}">${productVisual(p,'xs')}<span><b>${esc(p.product_name)}</b><small>${esc(p.category)}</small></span><i>Product</i></button>`).join('');
    rows += (customers.items||[]).map(c=>`<button data-search-nav="/customers/${c.id}"><span class="avatar sm">${esc(initials(c.name))}</span><span><b>${esc(c.name)}</b><small>${esc(c.email)}</small></span><i>Customer</i></button>`).join('');
    if(roleCan('orders') && /^\d+$/.test(q)) rows += `<button data-search-nav="/orders/${esc(q)}">${icon('orders',18)}<span><b>Order #${esc(q)}</b><small>Open order detail</small></span><i>Order</i></button>`;
    box.innerHTML = rows || `<div class="search-empty">No matches</div>`;
    box.classList.add('open');
    box.querySelectorAll('[data-search-nav]').forEach(x=>x.addEventListener('click',()=>{box.classList.remove('open');nav(x.dataset.searchNav)}));
  } catch { box.classList.remove('open'); }
}

function authScreen() {
  const isLogin = state.authMode === 'login';
  app.innerHTML = `<div class="auth-shell">
    <section class="auth-art">
      <div class="auth-brand"><span class="brand-mark large">${icon('products',20)}</span><b>FashionCart</b></div>
      <div class="editorial-grid">
        <div class="fashion-block fb-1"><img class="fb-bg" src="/assets/products/summer-dress.jpg" alt="Summer Dress" loading="eager"><span>01</span><b>SUMMER DRESS</b></div>
        <div class="fashion-block fb-2"><img class="fb-bg" src="/assets/products/white-sneakers.jpg" alt="White Sneakers" loading="eager"><span>02</span><b>WHITE SNEAKERS</b></div>
        <div class="fashion-block fb-3"><img class="fb-bg" src="/assets/products/leather-handbag.jpg" alt="Leather Handbag" loading="eager"><span>03</span><b>LEATHER HANDBAG</b></div>
      </div>
      <div class="auth-insight"><span class="mini-status">STRONG ASSOCIATION</span><div class="auth-rule"><div class="mini-pair">${productVisual('Classic T-Shirt','xs')}<b>Classic T-Shirt</b></div>${icon('arrow',18)}<div class="mini-pair">${productVisual('Slim Jeans','xs')}<b>Slim Jeans</b></div></div><div class="auth-metrics"><span>CONF <strong>76%</strong></span><span>LIFT <strong>1.38×</strong></span></div></div>
      <div class="auth-copy"><span class="eyebrow light">PURCHASE INTELLIGENCE</span><h1>Find what customers<br>buy <em>together.</em></h1><p>Association mining for fashion commerce.</p></div>
    </section>
    <section class="auth-panel">
      <div class="auth-card">
        <div class="mobile-auth-brand"><span class="brand-mark">${icon('products',17)}</span><b>FashionCart</b></div>
        <span class="eyebrow">INTELLIGENCE CONSOLE</span>
        <h2>${isLogin?'Welcome back':'Create account'}</h2>
        <p>${isLogin?'Access purchase intelligence and recommendations.':'Start with a secure user account.'}</p>
        <form id="authForm" class="form-stack">
          ${isLogin?'':`<label>Full name<div class="input-wrap">${icon('user',16)}<input name="name" required minlength="2" placeholder="Your name"></div></label>`}
          <label>Email<div class="input-wrap">${icon('mail',16)}<input name="email" type="email" required placeholder="you@company.com"></div></label>
          <label>Password<div class="input-wrap">${icon('lock',16)}<input name="password" type="password" required minlength="8" placeholder="Minimum 8 characters"></div></label>
          ${isLogin?'':`<label>Confirm Password<div class="input-wrap">${icon('lock',16)}<input name="confirm_password" type="password" required minlength="8" placeholder="Repeat password"></div></label><div class="password-strength" id="passwordStrength"><i></i><i></i><i></i><span>Use 8+ characters</span></div>`}
          <button class="btn btn-primary full" type="submit" id="authSubmit">${isLogin?'Sign In':'Create Account'} ${icon('arrow',16)}</button>
        </form>
        ${isLogin?`<div class="demo-logins"><span>DEMO ACCESS</span><button data-demo="admin">Admin</button><button data-demo="analyst">Analyst</button><button data-demo="user">User</button></div>`:''}
        <div class="auth-switch">${isLogin?'New to FashionCart?':'Already registered?'} <button id="authSwitch">${isLogin?'Create account':'Sign in'}</button></div>
      </div>
      <small class="auth-foot">FastAPI · MySQL · Apriori · JWT</small>
    </section>
  </div>`;
  document.getElementById('authSwitch').addEventListener('click',()=>{state.authMode=isLogin?'register':'login';authScreen()});
  document.querySelectorAll('[data-demo]').forEach(btn=>btn.addEventListener('click',()=>{
    const values={admin:['admin@fashioncart.dev','Admin@123'],analyst:['analyst@fashioncart.dev','Analyst@123'],user:['user@fashioncart.dev','User@123']}[btn.dataset.demo];
    const f=document.getElementById('authForm');f.email.value=values[0];f.password.value=values[1];
  }));
  document.getElementById('authForm').addEventListener('submit', handleAuth);
  if(!isLogin){
    const password=document.querySelector('#authForm [name="password"]');
    password.addEventListener('input',()=>{const v=password.value;const score=(v.length>=8?1:0)+( /[A-Z]/.test(v)&&/[a-z]/.test(v)?1:0)+( /\d/.test(v)&&/[^A-Za-z0-9]/.test(v)?1:0);const meter=document.getElementById('passwordStrength');meter.querySelectorAll('i').forEach((x,i)=>x.classList.toggle('on',i<score));meter.querySelector('span').textContent=score>=3?'Strong password':score===2?'Good password':'Use 8+ characters';});
  }
}

async function handleAuth(e) {
  e.preventDefault(); const form=new FormData(e.currentTarget); const submit=document.getElementById('authSubmit');
  submit.disabled=true; submit.textContent=state.authMode==='login'?'Signing in…':'Creating…';
  try {
    if(state.authMode==='login') {
      const result=await api('/auth/login',{method:'POST',json:{email:form.get('email'),password:form.get('password')}});
      state.token=result.access_token; state.user=result.user; localStorage.setItem('fashioncart_token',state.token); toast('Welcome to FashionCart'); nav('/dashboard'); render();
    } else {
      if(form.get('password')!==form.get('confirm_password')) throw new Error('Passwords do not match');
      await api('/auth/register',{method:'POST',json:{name:form.get('name'),email:form.get('email'),password:form.get('password')}});
      state.authMode='login'; toast('Account created. Sign in.'); authScreen();
    }
  } catch(err) { toast(err.message,'danger'); authScreen(); }
}

function pageHeader(title, subtitle='', actions='') {
  return `<div class="page-head"><div><h1>${esc(title)}</h1>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div><div class="page-actions">${actions}</div></div>`;
}

function attachRetry() { document.querySelector('[data-retry]')?.addEventListener('click',()=>renderPage()); }

window.addEventListener('hashchange',()=>{state.route=location.hash.slice(1)||'/dashboard';render();});

async function render() {
  if (!state.token) { authScreen(); return; }
  if (!state.user) {
    app.innerHTML = `<div class="boot"><span class="brand-mark large">${icon('products',22)}</span><b>FashionCart</b><small>Loading intelligence workspace…</small></div>`;
    try { state.user = await api('/auth/me'); } catch { logout(false); return; }
  }
  state.route = location.hash.slice(1) || '/dashboard';
  app.innerHTML = shell();
  bindGlobal();
  await renderPage();
}

async function renderPage() {
  const page=document.getElementById('page'); if(!page) return;
  page.innerHTML=`<div class="page-loading">${loadingRows(7)}</div>`;
  const r=state.route;
  try {
    if(r==='/dashboard') return await dashboardPage(page);
    if(r==='/products') return await productsPage(page);
    if(r==='/products/new') return await productFormPage(page);
    if(/^\/products\/\d+\/edit$/.test(r)) return await productFormPage(page,Number(r.split('/')[2]));
    if(/^\/products\/\d+$/.test(r)) return await productDetailPage(page,Number(r.split('/')[2]));
    if(r==='/customers') return await customersPage(page);
    if(r==='/customers/new') return await customerFormPage(page);
    if(/^\/customers\/\d+$/.test(r)) return await customerDetailPage(page,Number(r.split('/')[2]));
    if(r==='/orders') return await ordersPage(page);
    if(r==='/orders/new') return await orderCreatePage(page);
    if(/^\/orders\/\d+$/.test(r)) return await orderDetailPage(page,Number(r.split('/')[2]));
    if(r==='/transactions') return await transactionsPage(page);
    if(r==='/analysis') return await analysisPage(page);
    if(/^\/analysis\/\d+$/.test(r)) return await analysisDetailPage(page,Number(r.split('/')[2]));
    if(r==='/rules') return await rulesPage(page);
    if(r==='/recommendations') return await recommendationsPage(page);
    if(r==='/users') return await usersPage(page);
    if(r==='/profile') return await profilePage(page);
    page.innerHTML=`${pageHeader('Not Found','The requested workspace does not exist.')}<div class="error-state"><div class="error-code">404</div><h3>Page not found</h3><p>Choose a valid workspace from the navigation.</p><button class="btn btn-primary" data-nav="/dashboard">Dashboard</button></div>`; bindPageNav(page);
  } catch(err) {
    if(err.status===403) page.innerHTML=`${pageHeader('Access restricted','Your role does not have permission for this workspace.')}<div class="error-state"><div class="error-code">403</div><h3>Access restricted</h3><p>Use a permitted section from the navigation.</p><button class="btn btn-primary" data-nav="/dashboard">Dashboard</button></div>`;
    else page.innerHTML=errorBlock(err.message);
    bindPageNav(); attachRetry();
  }
}

function bindPageNav(root=document) { root.querySelectorAll('[data-nav]').forEach(el=>el.addEventListener('click',()=>nav(el.dataset.nav))); }

// Page implementations are below.
async function userHomePage(page) {
  const first = (state.user.name || 'there').split(' ')[0];
  const [d, pdata] = await Promise.all([api('/dashboard'), fetchAll('/products?sort_by=name')]);
  const rules = d.highest_lift_rules || [];
  const products = pdata.items || [];
  page.innerHTML = `${pageHeader(`Welcome back, ${first}`, 'Discover what pairs well across the catalog', `<button class="btn btn-secondary" data-nav="/products">${icon('products',15)} Browse Products</button><button class="btn btn-primary" data-nav="/recommendations">${icon('analysis',15)} Recommendations</button>`)}
  <section class="metric-grid three">
    ${metric('PRODUCTS',num(d.total_products),'In the catalog','violet','products')}
    ${metric('PAIRINGS FOUND',num(d.association_rules),'Learned from past baskets','green','rules')}
    ${metric('STRONGEST LIFT',rules[0]?`${Number(rules[0].lift).toFixed(1)}×`:'—','Top product pairing','blue','analysis')}
  </section>
  <section class="card">
    <div class="card-head"><div><h2>Frequently bought together</h2><p>The strongest pairings in our purchase history</p></div></div>
    ${rules.length ? `<div class="recommend-grid">${rules.slice(0,3).map(r => `<article class="recommend-card"><div class="rec-top">${badge(`Lift ${Number(r.lift).toFixed(1)}×`,'primary')}<span>${pct(r.confidence,0)} of the time</span></div><div class="rec-products">${productVisual({product_name:r.antecedent[0]},'sm')}<div><b>${esc(r.antecedent.join(' + '))}</b><span>pairs with ${esc(r.consequent.join(' + '))}</span></div>${productVisual({product_name:r.consequent[0]},'sm')}</div><button class="table-action" data-seed="${esc(r.antecedent[0])}">Explore pairings</button></article>`).join('')}</div>` : emptyState('Pairings are being prepared')}
  </section>
  <section class="card">
    <div class="card-head"><div><h2>Pair finder</h2><p>Pick a product to see what shoppers usually buy with it</p></div></div>
    <div class="recommend-controls"><label>Product<select id="homeProduct"><option value="">Choose a product…</option>${products.map(p => `<option value="${esc(p.product_name)}">${esc(p.product_name)}</option>`).join('')}</select></label></div>
    <div id="homeRecs" class="top-gap" aria-live="polite"></div>
  </section>`;
  bindPageNav(page);
  page.querySelectorAll('[data-seed]').forEach(b => b.addEventListener('click', () => { sessionStorage.setItem('fc_recommend_seed', b.dataset.seed); nav('/recommendations'); }));
  document.getElementById('homeProduct').addEventListener('change', async e => {
    const target = document.getElementById('homeRecs'), name = e.target.value;
    if (!name) { target.innerHTML = ''; return; }
    target.innerHTML = `<div class="subtle">Finding pairings…</div>`;
    try {
      const r = await api(`/recommendations/${encodeURIComponent(name)}?limit=4`);
      target.innerHTML = r.recommendations.length
        ? `<div class="mini-rec-list">${r.recommendations.map(x => `<div>${productVisual({product_name:x.product},'sm')}<span><b>${esc(x.product)}</b><small>${pct(x.confidence,0)} of buyers also add this</small></span>${badge(`${Number(x.lift).toFixed(1)}×`,'primary')}</div>`).join('')}</div>`
        : emptyState('No pairings found for this product yet');
    } catch (err) { target.innerHTML = ''; toast(err.message, 'danger'); }
  });
}

async function dashboardPage(page) {
  if (state.user?.role === 'USER') return userHomePage(page);
  const d = await api('/dashboard');
  let analyses=[];
  if(roleCan('analysis')) analyses = await api('/analysis').catch(()=>[]);
  const top = d.highest_lift_rules || [];
  const latest = analyses[0] || null;
  const strongest = d.top_rule;
  page.innerHTML = `${pageHeader('Dashboard','High-velocity garment affinity & transaction basket mining',`
    ${roleCan('transactions')?`<button class="btn btn-secondary" data-nav="/transactions">${icon('upload',15)} Upload Data</button>`:''}
    ${roleCan('analysis')?`<button class="btn btn-primary" data-nav="/analysis">${icon('analysis',15)} Run Analysis</button>`:''}
  `)}
  <section class="metric-grid five">
    ${metric('TOTAL CUSTOMERS',num(d.total_customers),'<span class="trend up">Live cohort</span>','green','customers')}
    ${metric('TOTAL PRODUCTS',num(d.total_products),'<span class="trend blue">Catalog</span>','violet','products')}
    ${metric('TOTAL ORDERS',num(d.total_orders),'<span class="trend neutral">Purchase history</span>','blue','orders')}
    ${metric('TRANSACTIONS',num(d.total_transactions),'<span class="trend up">Analysis ready</span>','green','transactions')}
    ${metric('RULES FOUND',num(d.association_rules),'<span class="trend violet">Latest Apriori</span>','violet','rules')}
  </section>
  <section class="dashboard-split">
    <article class="card intelligence-card">
      <div class="card-head"><div><div class="title-row"><h2>Purchase Intelligence</h2>${strongest?badge('Strong Association','success'):badge('Awaiting Analysis','neutral')}</div><p>Highest-value affinity path from historical checkout sequences</p></div>${roleCan('rules')?`<button class="text-btn" data-nav="/rules">View rules ${icon('arrow',14)}</button>`:''}</div>
      ${strongest?`<div class="affinity-flow">
        <div class="affinity-node">${productVisual({product_name:strongest.antecedent[0]},'lg')}<b>${esc(strongest.antecedent.join(' + '))}</b><small>ANTECEDENT</small></div>
        <div class="affinity-edge"><span>Lift<br><b>${Number(strongest.lift).toFixed(2)}×</b></span><div></div><small>${pct(strongest.confidence)} CONF</small></div>
        <div class="affinity-node">${productVisual({product_name:strongest.consequent[0]},'lg')}<b>${esc(strongest.consequent.join(' + '))}</b><small>CONSEQUENT</small></div>
      </div>
      <div class="rule-summary"><span class="metric-chip blue">Support ${pct(strongest.support,1)}</span><span class="metric-chip green">Confidence ${pct(strongest.confidence,1)}</span><span class="metric-chip violet">Lift ${Number(strongest.lift).toFixed(2)}×</span><span class="subtle">Top persisted rule</span></div>`:
      `<div class="empty-inline"><div class="empty-mark">${icon('analysis',26)}</div><div><b>No association rules yet</b><span>Run Apriori to discover product affinity.</span></div>${roleCan('analysis')?`<button class="btn btn-primary" data-nav="/analysis">Run Analysis</button>`:''}</div>`}
    </article>
    <article class="card latest-card">
      <div class="card-head"><div><div class="title-row"><h2>${latest?`Analysis #${latest.id}`:'Latest Analysis'}</h2>${latest?statusBadge(latest.status):badge('Not Run','neutral')}</div><p>${latest?'Persisted Apriori execution':'No completed analysis available'}</p></div><span class="subtle">${latest?when(latest.created_at):'—'}</span></div>
      ${latest?`<div class="mini-stat-grid"><div><span>TRANSACTIONS</span><b>${num(latest.transaction_count)}</b></div><div><span>ITEMSETS</span><b>${num(latest.frequent_itemset_count)}</b></div><div><span>RULES EXTRACTED</span><b>${num(latest.association_rule_count)}</b></div><div><span>EXECUTION TIME</span><b class="primary">${num(latest.execution_time_ms)} ms</b></div></div>
      <div class="hyperparams"><span>HYPERPARAMETERS</span><div>${badge(`min_sup: ${latest.min_support}`)}${badge(`min_conf: ${latest.min_confidence}`)}${badge(`min_lift: ${latest.min_lift}`)}</div></div>
      <button class="btn btn-primary full" data-nav="/analysis/${latest.id}">View Analysis Details ${icon('arrow',14)}</button>`:
      `<div class="empty-state compact"><h3>No run yet</h3>${roleCan('analysis')?`<button class="btn btn-primary" data-nav="/analysis">Run Analysis</button>`:''}</div>`}
    </article>
  </section>
  <section class="dashboard-split lower">
    <article class="card"><div class="card-head"><div><h2>Top Product Associations</h2><p>Ranked by lift and confidence</p></div><span class="eyebrow">TOP ${Math.min(top.length,5)} RULES</span></div>
      ${top.length?`<div class="association-list">${top.map((r,i)=>`<div class="association-row"><div class="association-name">${productVisual({product_name:r.antecedent[0]},'xs')}<b>${esc(r.antecedent.join(' + '))}</b>${icon('arrow',13)}${productVisual({product_name:r.consequent[0]},'xs')}<b>${esc(r.consequent.join(' + '))}</b></div><div class="association-metrics"><span class="metric-chip green">Conf ${pct(r.confidence)}</span><span class="metric-chip violet">Lift ${Number(r.lift).toFixed(2)}</span><span>Sup ${pct(r.support)}</span></div><div class="progress"><i style="width:${Math.min(100,r.confidence*100)}%"></i></div></div>`).join('')}</div>`:emptyState('No rules available',roleCan('analysis')?'Run Analysis':'','/analysis')}
    </article>
    <article class="card health-card"><div class="card-head"><div><h2>Analysis Engine Health</h2><p>Latest persisted rule quality</p></div><i class="health-dot"></i></div>
      <div class="rings"><div class="ring" style="--p:${Math.round(d.average_support*100)}"><span><b>${pct(d.average_support,1)}</b><small>AVG SUPPORT</small></span></div><div class="ring violet" style="--p:${Math.round(d.average_confidence*100)}"><span><b>${pct(d.average_confidence,1)}</b><small>AVG CONFIDENCE</small></span></div></div>
      <div class="health-lines"><div>${icon('analysis',15)}<span>Highest Observed Lift</span><b>${strongest?Number(strongest.lift).toFixed(2)+'×':'—'}</b></div><div>${icon('check',15)}<span>Apriori Engine</span><b>Ready</b></div></div>
    </article>
  </section>
  ${top.length?`<section class="card recommendations-strip"><div class="card-head"><div><h2>Top Recommendations</h2><p>Association-rule candidates ready for checkout injection</p></div><button class="btn btn-secondary compact" data-nav="/recommendations">Explore Recommendations ${icon('arrow',14)}</button></div><div class="recommend-grid">${top.slice(0,3).map((r,i)=>`<article class="recommend-card"><div class="rec-top">${badge(i===0?'Strong Match':i===1?'Good Match':'High Affinity',i===0?'success':'primary')}<span>#R-${String(i+1).padStart(3,'0')}</span></div><div class="rec-products">${productVisual({product_name:r.antecedent[0]},'sm')}<div><b>${esc(r.antecedent.join(' + '))}</b><span>${icon('arrow',12)} ${esc(r.consequent.join(' + '))}</span></div>${productVisual({product_name:r.consequent[0]},'sm')}</div><div class="rec-metrics"><span>LIFT MULTIPLIER <b>${Number(r.lift).toFixed(2)}×</b></span><span>Confidence <b>${pct(r.confidence,1)}</b></span></div></article>`).join('')}</div></section>`:''}
  ${roleCan('analysis')?`<section class="card"><div class="card-head"><div><h2>Recent Analysis Runs</h2><p>Historical batch computation logs and association metrics</p></div><button class="icon-btn">${icon('filter',16)}</button></div>${analyses.length?`<div class="table-wrap"><table><thead><tr><th>RUN</th><th>MIN SUPPORT</th><th>MIN CONFIDENCE</th><th>MIN LIFT</th><th>TRANSACTIONS</th><th>RULES</th><th>TIME</th><th>STATUS</th><th></th></tr></thead><tbody>${analyses.slice(0,6).map(a=>`<tr><td><b>#${a.id}</b></td><td>${a.min_support}</td><td>${a.min_confidence}</td><td>${a.min_lift}</td><td>${num(a.transaction_count)}</td><td><b>${num(a.association_rule_count)}</b></td><td>${num(a.execution_time_ms)} ms</td><td>${statusBadge(a.status)}</td><td><button class="table-action" data-nav="/analysis/${a.id}">View</button></td></tr>`).join('')}</tbody></table></div>`:emptyState('No analysis history','Run Analysis','/analysis')}</section>`:''}`;
  bindPageNav(page);
}
async function productsPage(page) {
  state.pg.products = { page: 1 };
  const stats = await api('/products/stats');
  const isAdmin = state.user.role === 'ADMIN';
  page.innerHTML = `${pageHeader('Products','Catalog inventory with recommendation context',isAdmin?`<button class="btn btn-primary" data-nav="/products/new">${icon('plus',15)} New Product</button>`:'')}
  <section class="summary-bar"><span><b>${num(stats.total)}</b> Products</span><span><b>${num(stats.categories)}</b> Categories</span><span><b>${num(stats.low_stock)}</b> Low Stock</span><span><b>${num(stats.out_of_stock)}</b> Out of Stock</span></section>
  <section class="card">
    <div class="toolbar"><div class="search-field">${icon('search',15)}<input id="productSearch" placeholder="Search products..." aria-label="Search products"></div><select id="categoryFilter" aria-label="Filter by category"><option value="">All categories</option>${categories.map(c=>`<option>${esc(c)}</option>`).join('')}</select><select id="productSort" aria-label="Sort products"><option value="name">Name</option><option value="price-asc">Price ↑</option><option value="price-desc">Price ↓</option><option value="stock">Stock</option></select><div class="view-toggle" id="productViewToggle"><button type="button" class="active" data-view="table">${icon('orders',14)} Table</button><button type="button" data-view="grid">${icon('dashboard',14)} Grid</button></div></div>
    <div class="table-wrap"><table><thead><tr><th>PRODUCT</th><th>CATEGORY</th><th>BRAND</th><th>PRICE</th><th>STOCK</th><th>STATUS</th><th></th></tr></thead><tbody id="productRows"></tbody></table></div>
    <div id="productGridWrap" class="product-card-grid" hidden></div>
    <div id="productPager"></div>
  </section>`;
  const sortMap = { name:['name','asc'], 'price-asc':['price','asc'], 'price-desc':['price','desc'], stock:['stock','desc'] };
  const cfg = {
    key:'products', tbody:'productRows', pager:'productPager', cols:7, empty:'No products match',
    path:()=>{ const [by,ord]=sortMap[document.getElementById('productSort').value]||sortMap.name; const q=document.getElementById('productSearch').value.trim(), cat=document.getElementById('categoryFilter').value; return `/products?sort_by=${by}&sort_order=${ord}${q?`&search=${encodeURIComponent(q)}`:''}${cat?`&category=${encodeURIComponent(cat)}`:''}`; },
    row:p=>{const tone=p.stock_quantity===0?'danger':p.stock_quantity<20?'warn':'success';const status=p.stock_quantity===0?'Out of Stock':p.stock_quantity<20?'Low Stock':'In Stock';return `<tr><td><button class="product-cell" data-nav="/products/${p.id}">${productVisual(p,'table')}<span><b>${esc(p.product_name)}</b><small>${esc(p.subcategory||p.category)}</small></span></button></td><td>${badge(p.category,'neutral')}</td><td>${esc(p.brand||'—')}</td><td><b>${money(p.price)}</b></td><td>${num(p.stock_quantity)}</td><td>${badge(status,tone)}</td><td><div class="row-actions"><button class="table-action" data-nav="/products/${p.id}">View</button>${isAdmin?`<button class="icon-btn" data-nav="/products/${p.id}/edit" title="Edit" aria-label="Edit ${esc(p.product_name)}">${icon('edit',15)}</button><button class="icon-btn danger" data-delete-product="${p.id}" data-name="${esc(p.product_name)}" title="Delete" aria-label="Delete ${esc(p.product_name)}">${icon('trash',15)}</button>`:''}</div></td></tr>`},
    after:d=>{
      document.querySelectorAll('[data-delete-product]').forEach(btn=>btn.addEventListener('click',()=>confirmDeleteProduct(Number(btn.dataset.deleteProduct),btn.dataset.name)));
      const gridEl = document.getElementById('productGridWrap');
      if (gridEl && d?.items) {
        gridEl.innerHTML = d.items.length ? d.items.map(p => {
          const tone = p.stock_quantity === 0 ? 'danger' : p.stock_quantity < 20 ? 'warn' : 'success';
          const status = p.stock_quantity === 0 ? 'Out of Stock' : p.stock_quantity < 20 ? 'Low Stock' : 'In Stock';
          return `<article class="product-card-item"><div data-nav="/products/${p.id}" style="cursor:pointer">${productVisual(p,'card')}</div><h3>${esc(p.product_name)}</h3><div class="meta-row">${badge(p.category,'neutral')}<span class="subtle">${esc(p.brand||'—')}</span></div><div class="price-row"><div><b>${money(p.price)}</b> <span class="subtle">· ${badge(status,tone)}</span></div><div class="row-actions"><button class="table-action" data-nav="/products/${p.id}">View</button>${isAdmin?`<button class="icon-btn" data-nav="/products/${p.id}/edit" title="Edit" aria-label="Edit ${esc(p.product_name)}">${icon('edit',15)}</button><button class="icon-btn danger" data-delete-product="${p.id}" data-name="${esc(p.product_name)}" title="Delete" aria-label="Delete ${esc(p.product_name)}">${icon('trash',15)}</button>`:''}</div></div></article>`;
        }).join('') : emptyState('No products match');
        bindPageNav(gridEl);
        gridEl.querySelectorAll('[data-delete-product]').forEach(btn=>btn.addEventListener('click',()=>confirmDeleteProduct(Number(btn.dataset.deleteProduct),btn.dataset.name)));
      }
    },
  };
  const reload=()=>{ state.pg.products.page=1; loadTable(cfg); };
  document.getElementById('productSearch').addEventListener('input',debounce(reload));
  ['categoryFilter','productSort'].forEach(id=>document.getElementById(id).addEventListener('change',reload));
  document.querySelectorAll('#productViewToggle button').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('#productViewToggle button').forEach(b => b.classList.toggle('active', b === btn));
    const isGrid = btn.dataset.view === 'grid';
    document.querySelector('.table-wrap').hidden = isGrid;
    document.getElementById('productGridWrap').hidden = !isGrid;
  }));
  bindPageNav(page); loadTable(cfg);
}
function confirmDeleteProduct(id,name) {
  showModal(`<div class="modal-head"><div><span class="eyebrow danger-text">DANGER ZONE</span><h2>Delete Product?</h2></div><button class="icon-btn" data-modal-close>${icon('close')}</button></div><p class="modal-copy"><b>${esc(name)}</b> will be permanently removed. This cannot be undone.</p><div class="modal-actions"><button class="btn btn-secondary" data-modal-close>Cancel</button><button class="btn btn-danger" id="confirmDelete">Delete</button></div>`);
  document.getElementById('confirmDelete').addEventListener('click',async()=>{try{await api(`/products/${id}`,{method:'DELETE'});closeOverlay();toast('Product deleted');await renderPage();}catch(e){toast(e.message,'danger')}});
}

async function productFormPage(page,id=null) {
  if(state.user.role!=='ADMIN') throw Object.assign(new Error('Admin access required.'),{status:403});
  const p=id?await api(`/products/${id}`):null;
  page.innerHTML=`${pageHeader(id?'Edit Product':'New Product',id?'Update catalog details':'Add an item to the catalog',`<button class="btn btn-secondary" data-nav="${id?`/products/${id}`:'/products'}">${icon('back',15)} Cancel</button>`)}
  <form id="productForm" class="card form-card"><div class="form-grid two"><label>Product name<input name="product_name" required minlength="2" value="${esc(p?.product_name||'')}" placeholder="Classic T-Shirt"></label><label>Category<select name="category" required>${categories.map(c=>`<option ${p?.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label>Subcategory<input name="subcategory" value="${esc(p?.subcategory||'')}" placeholder="Crew Neck"></label><label>Brand<input name="brand" value="${esc(p?.brand||'')}" placeholder="UrbanWeave"></label><label>Price (₹)<input name="price" type="number" min="1" step="0.01" required value="${esc(p?.price||'')}" placeholder="1499"></label><label>Stock quantity<input name="stock_quantity" type="number" min="0" required value="${esc(p?.stock_quantity??'')}" placeholder="100"></label></div><div class="form-footer"><button type="button" class="btn btn-secondary" data-nav="${id?`/products/${id}`:'/products'}">Cancel</button><button type="submit" class="btn btn-primary">${id?'Save Changes':'Save Product'} ${icon('arrow',14)}</button></div></form>`;
  bindPageNav(page);
  document.getElementById('productForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const payload={product_name:f.get('product_name').trim(),category:f.get('category'),subcategory:f.get('subcategory').trim()||null,brand:f.get('brand').trim()||null,price:Number(f.get('price')),stock_quantity:Number(f.get('stock_quantity'))};try{const result=await api(id?`/products/${id}`:'/products',{method:id?'PUT':'POST',json:payload});toast(id?'Product updated':'Product created');nav(`/products/${result.id}`);}catch(err){toast(err.message,'danger')}});
}

async function productDetailPage(page,id) {
  const p=await api(`/products/${id}`);
  const [rec,orders]=await Promise.all([
    api(`/recommendations/${encodeURIComponent(p.product_name)}?limit=4`).catch(()=>({recommendations:[]})),
    roleCan('orders') ? api(`/orders?limit=5&product_id=${p.id}`).catch(()=>({items:[]})) : Promise.resolve({items:[]}),
  ]);
  const recentOrders=(orders.items||[]).slice(0,5);
  page.innerHTML=`${pageHeader(p.product_name,`${p.category} · ${p.brand||'Unbranded'}`,`<button class="btn btn-secondary" data-nav="/products">${icon('back',15)} Products</button>${state.user.role==='ADMIN'?`<button class="btn btn-primary" data-nav="/products/${p.id}/edit">${icon('edit',15)} Edit</button>`:''}`)}
  <section class="detail-grid"><article class="card product-hero">${productVisual(p,'hero')}<div><span class="eyebrow">PRODUCT #${p.id}</span><h2>${esc(p.product_name)}</h2><p>${esc(p.subcategory||p.category)}</p><div class="hero-price">${money(p.price)}</div></div></article><article class="card spec-card"><h2>Product Details</h2><dl><div><dt>Category</dt><dd>${badge(p.category)}</dd></div><div><dt>Brand</dt><dd>${esc(p.brand||'—')}</dd></div><div><dt>Subcategory</dt><dd>${esc(p.subcategory||'—')}</dd></div><div><dt>Stock</dt><dd><b>${num(p.stock_quantity)}</b> units</dd></div></dl></article><article class="card intel-panel"><div class="card-head"><div><h2>Frequently Bought With</h2><p>Stored association rules</p></div></div>${rec.recommendations.length?`<div class="mini-rec-list">${rec.recommendations.map(r=>`<div>${productVisual(r.product,'sm')}<span><b>${esc(r.product)}</b><small>Conf ${pct(r.confidence)} · Lift ${Number(r.lift).toFixed(2)}×</small></span><span class="metric-chip violet">${Number(r.lift).toFixed(2)}×</span></div>`).join('')}</div><button class="btn btn-secondary full" data-nav="/recommendations">View Recommendations</button>`:emptyState('No recommendation rules')}</article></section>${roleCan('orders')?`<section class="card"><div class="card-head"><div><h2>Recent Orders</h2><p>Historical baskets containing this product</p></div><span class="eyebrow">${recentOrders.length} SHOWN</span></div>${recentOrders.length?`<div class="table-wrap"><table><thead><tr><th>ORDER</th><th>QTY</th><th>TOTAL</th><th>STATUS</th><th>DATE</th><th></th></tr></thead><tbody>${recentOrders.map(o=>{const line=o.items.find(i=>i.product_id===p.id);return `<tr><td><b>#${o.id}</b></td><td>${line?.quantity||1}</td><td>${money(o.total_amount)}</td><td>${statusBadge(o.status)}</td><td>${dateOnly(o.order_date)}</td><td><button class="table-action" data-nav="/orders/${o.id}">View</button></td></tr>`}).join('')}</tbody></table></div>`:emptyState('No orders contain this product')}</section>`:''}`;
  bindPageNav(page);
}
async function customersPage(page) {
  if(!roleCan('customers')) throw Object.assign(new Error('Customer workspace requires analyst access.'),{status:403});
  state.pg.customers = { page: 1 };
  page.innerHTML = `${pageHeader('Customers','Profiles behind purchase baskets',`<button class="btn btn-primary" data-nav="/customers/new">${icon('plus',15)} New Customer</button>`)}
  <section class="card"><div class="toolbar"><div class="search-field">${icon('search',15)}<input id="customerSearch" placeholder="Search customers..." aria-label="Search customers"></div></div><div class="table-wrap"><table><thead><tr><th>CUSTOMER</th><th>EMAIL</th><th>AGE</th><th>GENDER</th><th>JOINED</th><th></th></tr></thead><tbody id="customerRows"></tbody></table></div><div id="customerPager"></div></section>`;
  const cfg = {
    key:'customers', tbody:'customerRows', pager:'customerPager', cols:6, empty:'No customers match',
    path:()=>{ const q=document.getElementById('customerSearch').value.trim(); return `/customers${q?`?search=${encodeURIComponent(q)}`:''}`; },
    row:c=>`<tr><td><button class="person-cell" data-nav="/customers/${c.id}"><span class="avatar">${esc(initials(c.name))}</span><b>${esc(c.name)}</b></button></td><td>${esc(c.email)}</td><td>${c.age??'—'}</td><td>${esc(c.gender||'—')}</td><td>${dateOnly(c.created_at)}</td><td><button class="table-action" data-nav="/customers/${c.id}">View</button></td></tr>`,
  };
  document.getElementById('customerSearch').addEventListener('input',debounce(()=>{state.pg.customers.page=1;loadTable(cfg)}));
  bindPageNav(page); loadTable(cfg);
}

async function customerFormPage(page) {
  if(!roleCan('customers')) throw Object.assign(new Error('Customer workspace requires analyst access.'),{status:403});
  page.innerHTML=`${pageHeader('New Customer','Create a customer profile',`<button class="btn btn-secondary" data-nav="/customers">${icon('back',15)} Cancel</button>`)}<form id="customerForm" class="card form-card"><div class="form-grid two"><label>Full name<input name="name" required minlength="2" placeholder="Ananya Rao"></label><label>Email<input name="email" type="email" required placeholder="ananya@example.com"></label><label>Age<input name="age" type="number" min="1" max="120" placeholder="28"></label><label>Gender<select name="gender"><option value="">Prefer not to say</option><option>Female</option><option>Male</option><option>Other</option></select></label></div><div class="form-footer"><button type="button" class="btn btn-secondary" data-nav="/customers">Cancel</button><button class="btn btn-primary" type="submit">Create Customer ${icon('arrow',14)}</button></div></form>`;
  bindPageNav(page);document.getElementById('customerForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{const c=await api('/customers',{method:'POST',json:{name:f.get('name').trim(),email:f.get('email'),gender:f.get('gender')||null,age:f.get('age')?Number(f.get('age')):null}});toast('Customer created');nav(`/customers/${c.id}`)}catch(err){toast(err.message,'danger')}});
}

async function customerDetailPage(page,id) {
  if(!roleCan('customers')) throw Object.assign(new Error('Customer workspace requires analyst access.'),{status:403});
  const [c,orders]=await Promise.all([api(`/customers/${id}`),api(`/customers/${id}/orders`)]);
  const total=orders.reduce((s,o)=>s+Number(o.total_amount),0), avg=orders.length?total/orders.length:0;
  page.innerHTML=`${pageHeader(c.name,c.email,`<button class="btn btn-secondary" data-nav="/customers">${icon('back',15)} Customers</button><button class="btn btn-primary" data-nav="/orders/new">${icon('plus',15)} Create Order</button>`)}<section class="metric-grid four">${metric('ORDERS',num(orders.length),'Lifetime','violet','orders')}${metric('TOTAL SPEND',money(total),'Backend totals','green','analysis')}${metric('AVG ORDER',money(avg),'Basket value','blue','orders')}${metric('LAST ORDER',orders[0]?dateOnly(orders[0].order_date):'—','Most recent','violet','calendar')}</section><section class="detail-grid customer-detail"><article class="card profile-card"><span class="avatar xl">${esc(initials(c.name))}</span><h2>${esc(c.name)}</h2><p>${esc(c.email)}</p><dl><div><dt>Age</dt><dd>${c.age??'—'}</dd></div><div><dt>Gender</dt><dd>${esc(c.gender||'—')}</dd></div><div><dt>Customer ID</dt><dd>#${c.id}</dd></div></dl></article><article class="card span-2"><div class="card-head"><div><h2>Order History</h2><p>Completed purchase baskets</p></div></div>${orders.length?`<div class="table-wrap"><table><thead><tr><th>ORDER</th><th>ITEMS</th><th>TOTAL</th><th>STATUS</th><th>DATE</th><th></th></tr></thead><tbody>${orders.map(o=>`<tr><td><b>#${o.id}</b></td><td>${o.items.length}</td><td><b>${money(o.total_amount)}</b></td><td>${statusBadge(o.status)}</td><td>${dateOnly(o.order_date)}</td><td><button class="table-action" data-nav="/orders/${o.id}">View</button></td></tr>`).join('')}</tbody></table></div>`:emptyState('No orders yet','Create Order','/orders/new')}</article></section>`;bindPageNav(page);
}

async function ordersPage(page) {
  if(!roleCan('orders')) throw Object.assign(new Error('Order workspace requires analyst access.'),{status:403});
  state.pg.orders = { page: 1 };
  const stats = await api('/orders/stats');
  page.innerHTML=`${pageHeader('Orders','Backend-calculated baskets and inventory validation',`<button class="btn btn-primary" data-nav="/orders/new">${icon('plus',15)} Create Order</button>`)}<section class="summary-bar"><span><b>${num(stats.total)}</b> Total</span><span><b>${num(stats.completed)}</b> Completed</span><span><b>${num(stats.pending)}</b> Pending</span><span><b>${num(stats.cancelled)}</b> Cancelled</span></section><section class="card"><div class="toolbar"><div class="search-field">${icon('search',15)}<input id="orderSearch" placeholder="Search order # or customer..." aria-label="Search orders"></div><select id="orderStatus" aria-label="Filter by status"><option value="">All statuses</option><option>COMPLETED</option><option>PENDING</option><option>CANCELLED</option></select></div><div class="table-wrap"><table><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>ITEMS</th><th>TOTAL</th><th>STATUS</th><th>DATE</th><th></th></tr></thead><tbody id="orderRows"></tbody></table></div><div id="orderPager"></div></section>`;
  const cfg = {
    key:'orders', tbody:'orderRows', pager:'orderPager', cols:7, empty:'No orders match',
    path:()=>{ const q=document.getElementById('orderSearch').value.trim(), st=document.getElementById('orderStatus').value; const qs=[q&&`search=${encodeURIComponent(q)}`,st&&`status=${st}`].filter(Boolean).join('&'); return `/orders${qs?`?${qs}`:''}`; },
    row:o=>`<tr><td><b>#${o.id}</b></td><td>${esc(o.customer_name||`Customer #${o.customer_id}`)}</td><td>${o.items.length}</td><td><b>${money(o.total_amount)}</b></td><td>${statusBadge(o.status)}</td><td>${dateOnly(o.order_date)}</td><td><button class="table-action" data-nav="/orders/${o.id}">View</button></td></tr>`,
  };
  const reload=()=>{state.pg.orders.page=1;loadTable(cfg)};
  document.getElementById('orderSearch').addEventListener('input',debounce(reload));
  document.getElementById('orderStatus').addEventListener('change',reload);
  bindPageNav(page); loadTable(cfg);
}

async function orderCreatePage(page) {
  if(!roleCan('orders')) throw Object.assign(new Error('Order workspace requires analyst access.'),{status:403});
  const [customers,pdata]=await Promise.all([fetchAll('/customers').then(r=>r.items),fetchAll('/products?sort_by=name')]);const products=pdata.items||[];state.basket=[];
  page.innerHTML=`${pageHeader('Create Order','Customer + products with server-side stock and total validation',`<button class="btn btn-secondary" data-nav="/orders">${icon('back',15)} Cancel</button>`)}<section class="order-builder"><article class="card"><div class="step-title"><span>1</span><div><h2>Select Customer</h2><p>Choose the basket owner</p></div></div><select id="orderCustomer" class="large-select"><option value="">Choose customer...</option>${customers.map(c=>`<option value="${c.id}">${esc(c.name)} · ${esc(c.email)}</option>`).join('')}</select><div class="step-title top-gap"><span>2</span><div><h2>Add Products</h2><p>Inventory is validated again by the backend</p></div></div><div class="product-picker"><div class="search-field">${icon('search',15)}<input id="orderProductSearch" placeholder="Search product..."></div><div id="pickerResults" class="picker-results"></div></div></article><aside class="card order-summary"><div class="step-title"><span>3</span><div><h2>Order Items</h2><p>Final total is authoritative from API</p></div></div><div id="basketItems"></div><div class="order-total"><span>Estimated subtotal</span><b id="basketTotal">₹0</b></div><button class="btn btn-primary full" id="createOrderBtn" disabled>Create Order ${icon('arrow',14)}</button></aside></section>`;
  const renderPicker=()=>{const q=document.getElementById('orderProductSearch').value.toLowerCase();const filtered=products.filter(p=>!q||p.product_name.toLowerCase().includes(q)).slice(0,8);document.getElementById('pickerResults').innerHTML=filtered.map(p=>`<button data-add-product="${p.id}" ${p.stock_quantity<=0?'disabled':''}>${productVisual(p,'xs')}<span><b>${esc(p.product_name)}</b><small>${money(p.price)} · ${p.stock_quantity} in stock</small></span>${icon('plus',16)}</button>`).join('');document.querySelectorAll('[data-add-product]').forEach(b=>b.addEventListener('click',()=>{const p=products.find(x=>x.id===Number(b.dataset.addProduct));const found=state.basket.find(x=>x.product.id===p.id);if(found){if(found.quantity<p.stock_quantity)found.quantity++}else state.basket.push({product:p,quantity:1});renderBasket();}));};
  const renderBasket=()=>{const el=document.getElementById('basketItems');if(!state.basket.length)el.innerHTML=`<div class="basket-empty">${icon('orders',24)}<span>Add products to build the basket.</span></div>`;else el.innerHTML=state.basket.map((x,i)=>`<div class="basket-row">${productVisual(x.product,'xs')}<div><b>${esc(x.product.product_name)}</b><small>${money(x.product.price)}</small></div><div class="qty"><button data-dec="${i}">−</button><b>${x.quantity}</b><button data-inc="${i}">+</button></div><button class="icon-btn danger" data-remove="${i}">${icon('trash',14)}</button></div>`).join('');const total=state.basket.reduce((s,x)=>s+Number(x.product.price)*x.quantity,0);document.getElementById('basketTotal').textContent=money(total);document.getElementById('createOrderBtn').disabled=!state.basket.length||!document.getElementById('orderCustomer').value;document.querySelectorAll('[data-dec]').forEach(b=>b.addEventListener('click',()=>{const x=state.basket[Number(b.dataset.dec)];x.quantity=Math.max(1,x.quantity-1);renderBasket()}));document.querySelectorAll('[data-inc]').forEach(b=>b.addEventListener('click',()=>{const x=state.basket[Number(b.dataset.inc)];x.quantity=Math.min(x.product.stock_quantity,x.quantity+1);renderBasket()}));document.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>{state.basket.splice(Number(b.dataset.remove),1);renderBasket()}));};
  document.getElementById('orderProductSearch').addEventListener('input',renderPicker);document.getElementById('orderCustomer').addEventListener('change',renderBasket);document.getElementById('createOrderBtn').addEventListener('click',async()=>{const customer_id=Number(document.getElementById('orderCustomer').value);try{const result=await api('/orders',{method:'POST',json:{customer_id,items:state.basket.map(x=>({product_id:x.product.id,quantity:x.quantity})),status:'COMPLETED'}});toast(`Order #${result.id} created`);nav(`/orders/${result.id}`)}catch(err){toast(err.message,'danger')}});renderPicker();renderBasket();bindPageNav(page);
}

async function orderDetailPage(page,id) {
  if(!roleCan('orders')) throw Object.assign(new Error('Order workspace requires analyst access.'),{status:403});
  const o=await api(`/orders/${id}`);const [customer,plist]=await Promise.all([api(`/customers/${o.customer_id}`).catch(()=>null),Promise.all([...new Set(o.items.map(i=>i.product_id).filter(Boolean))].map(pid=>api(`/products/${pid}`).catch(()=>null)))]);const pmap=Object.fromEntries(plist.filter(Boolean).map(p=>[p.id,p]));
  page.innerHTML=`${pageHeader(`Order #${o.id}`,customer?.name||`Customer #${o.customer_id}`,`<button class="btn btn-secondary" data-nav="/orders">${icon('back',15)} Orders</button>${statusBadge(o.status)}`)}<section class="metric-grid four">${metric('CUSTOMER',customer?.name||`#${o.customer_id}`,'Basket owner','violet','customers')}${metric('ORDER DATE',dateOnly(o.order_date),'Created','blue','calendar')}${metric('ITEMS',num(o.items.length),'Line items','green','products')}${metric('TOTAL',money(o.total_amount),'Backend calculated','violet','analysis')}</section><section class="card"><div class="card-head"><div><h2>Order Items</h2><p>Prices persisted at purchase time</p></div></div><div class="table-wrap"><table><thead><tr><th>PRODUCT</th><th>CATEGORY</th><th>PRICE</th><th>QTY</th><th>SUBTOTAL</th></tr></thead><tbody>${o.items.map(i=>{const p=pmap[i.product_id];return `<tr><td><div class="product-cell static">${productVisual(p||{product_name:`Product #${i.product_id}`},'sm')}<span><b>${esc(p?.product_name||`Product #${i.product_id}`)}</b><small>#${i.product_id}</small></span></div></td><td>${esc(p?.category||'—')}</td><td>${money(i.price)}</td><td>${i.quantity}</td><td><b>${money(Number(i.price)*i.quantity)}</b></td></tr>`}).join('')}</tbody></table></div><div class="grand-total"><span>Order Total</span><b>${money(o.total_amount)}</b></div></section>`;bindPageNav(page);
}
async function transactionsPage(page) {
  if(!roleCan('transactions')) throw Object.assign(new Error('Transaction workspace requires analyst access.'),{status:403});
  state.pg.transactions = { page: 1 };
  const stats=await api('/transactions/stats');
  page.innerHTML=`${pageHeader('Transactions','Historical baskets prepared for Apriori mining',`<button class="btn btn-secondary" id="showCsvFormat">View Format</button><button class="btn btn-primary" id="openCsvPicker">${icon('upload',15)} Upload CSV</button>`)}
  <section class="metric-grid three">${metric('TRANSACTIONS',num(stats.transactions),'Imported baskets','violet','transactions')}${metric('ROWS IMPORTED',num(stats.rows),'Valid item rows','green','check')}${metric('UNIQUE PRODUCTS',num(stats.unique_products),'Observed in CSV','blue','products')}</section>
  <section class="card upload-card"><input id="csvFile" type="file" accept=".csv,text/csv" hidden><div class="drop-zone" id="dropZone"><span class="drop-icon">${icon('upload',24)}</span><div><h3>Import Transactions</h3><p>CSV · transaction_id + product · max 10 MB</p></div><button class="btn btn-secondary" type="button">Choose File</button></div><div id="uploadResult"></div></section>
  <section class="card"><div class="card-head"><div><h2>Imported Baskets</h2><p>Transaction-level view from persisted CSV rows</p></div><span class="eyebrow">${num(stats.transactions)} TOTAL</span></div><div class="table-wrap"><table><thead><tr><th>TRANSACTION ID</th><th>PRODUCTS</th><th>ITEM COUNT</th><th>SOURCE</th><th>IMPORTED</th></tr></thead><tbody id="txRows"></tbody></table></div><div id="txPager"></div></section>`;
  bindPageNav(page);
  const txCfg={key:'transactions',tbody:'txRows',pager:'txPager',cols:5,empty:'No imported transactions',path:()=>'/transactions',row:t=>`<tr><td><b>${esc(t.transaction_id)}</b></td><td><div class="chips">${t.products.slice(0,5).map(p=>badge(p)).join('')}${t.products.length>5?badge(`+${t.products.length-5}`,'primary'):''}</div></td><td>${t.item_count}</td><td>${badge(t.source,'neutral')}</td><td>${when(t.imported_at)}</td></tr>`};
  loadTable(txCfg);
  const file=document.getElementById('csvFile'), zone=document.getElementById('dropZone');
  const handleUpload=async f=>{if(!f)return;const fd=new FormData();fd.append('file',f);document.getElementById('uploadResult').innerHTML=`<div class="upload-progress"><span></span><b>Importing ${esc(f.name)}…</b></div>`;try{const result=await api('/transactions/upload',{method:'POST',body:fd});document.getElementById('uploadResult').innerHTML=`<div class="import-result"><div class="result-icon">${icon('check',24)}</div><div><h3>Import Complete</h3><p>${esc(f.name)}</p></div><div class="import-stats"><span><b>${num(result.total_rows)}</b>Total</span><span><b>${num(result.valid_rows)}</b>Valid</span><span><b>${num(result.invalid_rows)}</b>Invalid</span><span><b>${num(result.duplicate_rows)}</b>Duplicates</span></div><button class="btn btn-primary" id="refreshTransactions">View Transactions</button></div>`;toast('CSV imported');document.getElementById('refreshTransactions').addEventListener('click',()=>renderPage());}catch(err){document.getElementById('uploadResult').innerHTML=`<div class="inline-error">${icon('close',16)} ${esc(err.message)}</div>`;toast(err.message,'danger')}};
  zone.addEventListener('click',()=>file.click());document.getElementById('openCsvPicker').addEventListener('click',()=>file.click());file.addEventListener('change',()=>handleUpload(file.files[0]));
  ['dragenter','dragover'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.add('drag')}));['dragleave','drop'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.remove('drag')}));zone.addEventListener('drop',e=>handleUpload(e.dataTransfer.files[0]));
  document.getElementById('showCsvFormat').addEventListener('click',()=>showModal(`<div class="modal-head"><div><span class="eyebrow">CSV FORMAT</span><h2>Historical Transactions</h2></div><button class="icon-btn" data-modal-close>${icon('close')}</button></div><pre class="code-sample">transaction_id,product\n1001,Classic T-Shirt\n1001,Slim Jeans\n1001,White Sneakers\n1002,Summer Dress\n1002,Leather Handbag</pre><div class="modal-actions"><button class="btn btn-primary" data-modal-close>Got it</button></div>`));
}

async function analysisPage(page) {
  if(!roleCan('analysis')) throw Object.assign(new Error('Apriori analysis requires analyst access.'),{status:403});
  const analyses=await api('/analysis');const d=await api('/dashboard');
  page.innerHTML=`${pageHeader('Apriori Analysis','Configure thresholds, execute mining, persist results')}
  <section class="analysis-layout"><article class="card analysis-config"><div class="card-head"><div><h2>Analysis Configuration</h2><p>Thresholds applied to current transaction baskets</p></div>${badge('READY','success')}</div><form id="analysisForm"><div class="param"><div><label>Minimum Support</label><output id="supportOut">0.05</output></div><input id="supportRange" name="min_support" type="range" min="0.01" max="0.5" step="0.01" value="0.05"><small>Frequency threshold</small></div><div class="param"><div><label>Minimum Confidence</label><output id="confidenceOut">0.30</output></div><input id="confidenceRange" name="min_confidence" type="range" min="0.05" max="1" step="0.05" value="0.30"><small>Conditional probability threshold</small></div><div class="param"><div><label>Minimum Lift</label><output><input id="liftInput" name="min_lift" type="number" min="0.1" step="0.1" value="1.0"></output></div><small>Positive affinity threshold</small></div><button class="btn btn-primary full big" id="runAnalysisBtn" type="submit">${icon('analysis',17)} Run Analysis</button></form></article><aside class="card data-ready"><span class="eyebrow">DATA READY</span><div class="ready-number">${num(d.total_transactions)}</div><b>Transactions</b><div class="ready-lines"><span>${icon('products',15)} ${num(d.total_products)} catalog products</span><span>${icon('transactions',15)} ${num(d.imported_transactions)} imported baskets</span><span>${icon('orders',15)} ${num(d.completed_order_transactions)} completed orders</span></div><div class="engine-state"><i></i><span><b>Apriori Engine</b><small>Ready to execute</small></span></div></aside></section>
  <section class="card"><div class="card-head"><div><h2>Analysis History</h2><p>Persisted model runs</p></div><span class="eyebrow">${analyses.length} RUNS</span></div>${analyses.length?`<div class="table-wrap"><table><thead><tr><th>RUN</th><th>SUPPORT</th><th>CONFIDENCE</th><th>LIFT</th><th>TRANSACTIONS</th><th>ITEMSETS</th><th>RULES</th><th>TIME</th><th>STATUS</th><th></th></tr></thead><tbody>${analyses.map(a=>`<tr><td><b>#${a.id}</b></td><td>${a.min_support}</td><td>${a.min_confidence}</td><td>${a.min_lift}</td><td>${num(a.transaction_count)}</td><td>${num(a.frequent_itemset_count)}</td><td><b>${num(a.association_rule_count)}</b></td><td>${num(a.execution_time_ms)} ms</td><td>${statusBadge(a.status)}</td><td><button class="table-action" data-nav="/analysis/${a.id}">View</button></td></tr>`).join('')}</tbody></table></div>`:emptyState('No analysis runs')}</section>`;
  bindPageNav(page);
  const sup=document.getElementById('supportRange'),conf=document.getElementById('confidenceRange');sup.addEventListener('input',()=>document.getElementById('supportOut').value=sup.value);conf.addEventListener('input',()=>document.getElementById('confidenceOut').value=conf.value);
  document.getElementById('analysisForm').addEventListener('submit',async e=>{e.preventDefault();const btn=document.getElementById('runAnalysisBtn');btn.disabled=true;btn.innerHTML=`<span class="spinner"></span> Mining Transactions…`;showModal(`<div class="analysis-running"><span class="spinner large"></span><span class="eyebrow">APRIORI EXECUTION</span><h2>Mining purchase patterns</h2><div class="run-steps"><span class="active">Preparing Transactions</span><span>Finding Itemsets</span><span>Generating Rules</span><span>Saving Results</span></div><p>No fake percentage — this closes when the backend finishes.</p></div>`);const steps=[...document.querySelectorAll('.run-steps span')];let step=0;const timer=setInterval(()=>{step=Math.min(step+1,steps.length-1);steps.forEach((x,i)=>x.classList.toggle('active',i<=step));},450);try{const result=await api('/analysis/run',{method:'POST',json:{min_support:Number(sup.value),min_confidence:Number(conf.value),min_lift:Number(document.getElementById('liftInput').value)}});clearInterval(timer);closeOverlay();toast(`Analysis #${result.analysis_id} completed`);nav(`/analysis/${result.analysis_id}`)}catch(err){clearInterval(timer);closeOverlay();toast(err.message,'danger');btn.disabled=false;btn.innerHTML=`${icon('analysis',17)} Run Analysis`}});
}

async function analysisDetailPage(page,id) {
  if(!roleCan('analysis')) throw Object.assign(new Error('Apriori analysis requires analyst access.'),{status:403});
  const [a,rules,itemsets]=await Promise.all([api(`/analysis/${id}`),api(`/analysis/${id}/rules`),api(`/analysis/${id}/itemsets`)]);const top=rules[0];
  page.innerHTML=`${pageHeader(`Analysis #${a.id}`,when(a.created_at),`<button class="btn btn-secondary" id="exportAnalysis">${icon('download',15)} Export</button><button class="btn btn-secondary" data-nav="/analysis">${icon('back',15)} Analysis</button>${statusBadge(a.status)}`)}<section class="metric-grid four">${metric('TRANSACTIONS',num(a.transaction_count),'Baskets processed','violet','transactions')}${metric('ITEMSETS',num(a.frequent_itemset_count),'Frequent sets','blue','analysis')}${metric('RULES',num(a.association_rule_count),'Persisted associations','green','rules')}${metric('EXECUTION',`${num(a.execution_time_ms)} ms`,'Runtime','violet','analysis')}</section><section class="analysis-detail-grid"><article class="card"><div class="card-head"><div><h2>Strongest Rule</h2><p>Ranked by lift, confidence, support</p></div></div>${top?`<div class="big-rule"><div>${productVisual(top.antecedent[0],'lg')}<b>${esc(top.antecedent.join(' + '))}</b><small>ANTECEDENT</small></div><span>${icon('arrow',24)}</span><div>${productVisual(top.consequent[0],'lg')}<b>${esc(top.consequent.join(' + '))}</b><small>CONSEQUENT</small></div></div><div class="triple-metrics"><div><span>SUPPORT</span><b>${pct(top.support,1)}</b></div><div><span>CONFIDENCE</span><b>${pct(top.confidence,1)}</b></div><div><span>LIFT</span><b>${Number(top.lift).toFixed(2)}×</b></div></div><button class="btn btn-secondary full" data-nav="/rules">View All Rules ${icon('arrow',14)}</button>`:emptyState('No rules met these thresholds')}</article><article class="card"><div class="card-head"><div><h2>Run Parameters</h2><p>Thresholds used for this persisted result</p></div></div><div class="parameter-stack"><div><span>Minimum Support</span><b>${a.min_support}</b></div><div><span>Minimum Confidence</span><b>${a.min_confidence}</b></div><div><span>Minimum Lift</span><b>${a.min_lift}</b></div></div><div class="quality-block"><span class="eyebrow">RESULT QUALITY</span><div>${badge(`${rules.length} association rules`,'success')}${badge(`${itemsets.length} frequent itemsets`,'primary')}</div></div></article></section><section class="card"><div class="card-head"><div><h2>Frequent Itemsets</h2><p>Highest-support combinations from this run</p></div><span class="eyebrow">TOP 12</span></div>${itemsets.length?`<div class="itemset-grid">${itemsets.slice(0,12).map((x,i)=>`<div class="itemset-card"><span>#${i+1}</span><b>${esc(x.items.join(' + '))}</b><div><small>SUPPORT</small><strong>${pct(x.support,1)}</strong></div></div>`).join('')}</div>`:emptyState('No frequent itemsets')}</section>`;bindPageNav(page);
  document.getElementById('exportAnalysis')?.addEventListener('click',()=>{const blob=new Blob([JSON.stringify({analysis:a,rules,itemsets},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`fashioncart-analysis-${a.id}.json`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);toast('Analysis exported')});
}

async function rulesPage(page) {
  if(!roleCan('analysis')) throw Object.assign(new Error('Association rules require analyst access.'),{status:403});
  const analyses=await api('/analysis');if(!analyses.length){page.innerHTML=`${pageHeader('Association Rules','Persisted Apriori relationships')}${emptyState('Run analysis to generate rules','Run Analysis','/analysis')}`;bindPageNav(page);return;}const latest=analyses[0];let rules=await api(`/analysis/${latest.id}/rules`);
  page.innerHTML=`${pageHeader('Association Rules',`Analysis #${latest.id} · ${rules.length} persisted relationships`, `<button class="btn btn-primary" data-nav="/analysis">${icon('analysis',15)} New Analysis</button>`)}<section class="card"><div class="toolbar"><div class="search-field">${icon('search',15)}<input id="ruleSearch" placeholder="Filter by product..."></div><label class="compact-label">Min lift<input id="ruleLift" type="number" min="0" step="0.1" value="1.0"></label><label class="compact-label">Min confidence<input id="ruleConfidence" type="number" min="0" max="1" step="0.05" value="0.30"></label><select id="ruleSort"><option value="lift">Lift ↓</option><option value="confidence">Confidence ↓</option><option value="support">Support ↓</option></select></div><div class="table-wrap"><table><thead><tr><th>ANTECEDENT</th><th></th><th>CONSEQUENT</th><th>SUPPORT</th><th>CONFIDENCE</th><th>LIFT</th><th>STRENGTH</th><th></th></tr></thead><tbody id="ruleRows"></tbody></table></div></section>`;
  const renderRules=()=>{const q=document.getElementById('ruleSearch').value.toLowerCase(),ml=Number(document.getElementById('ruleLift').value||0),mc=Number(document.getElementById('ruleConfidence').value||0),sort=document.getElementById('ruleSort').value;let filtered=rules.filter(r=>r.lift>=ml&&r.confidence>=mc&&(!q||[...r.antecedent,...r.consequent].join(' ').toLowerCase().includes(q)));filtered=[...filtered].sort((a,b)=>Number(b[sort])-Number(a[sort]));document.getElementById('ruleRows').innerHTML=filtered.length?filtered.map(r=>`<tr class="clickable" data-rule-id="${r.id}"><td><div class="chips">${r.antecedent.map(x=>badge(x)).join('')}</div></td><td class="arrow-cell">${icon('arrow',15)}</td><td><div class="chips">${r.consequent.map(x=>badge(x,'primary')).join('')}</div></td><td>${pct(r.support,1)}</td><td><b>${pct(r.confidence,1)}</b></td><td><span class="lift-pill">${Number(r.lift).toFixed(2)}×</span></td><td>${badge(r.lift>=1.3?'Strong':r.lift>1?'Positive':'Neutral',r.lift>=1.3?'success':r.lift>1?'primary':'neutral')}</td><td><button class="table-action">Inspect</button></td></tr>`).join(''):`<tr><td colspan="8">${emptyState('No rules match')}</td></tr>`;document.querySelectorAll('[data-rule-id]').forEach(row=>row.addEventListener('click',()=>openRuleDrawer(filtered.find(x=>x.id===Number(row.dataset.ruleId)))));};['ruleSearch','ruleLift','ruleConfidence'].forEach(id=>document.getElementById(id).addEventListener('input',renderRules));document.getElementById('ruleSort').addEventListener('change',renderRules);renderRules();bindPageNav(page);
}

function openRuleDrawer(r) {
  showDrawer(`<div class="drawer-head"><div><span class="eyebrow">RULE INSIGHT #${r.id}</span><h2>Association Detail</h2></div><button class="icon-btn" data-modal-close>${icon('close')}</button></div><div class="drawer-rule"><div>${productVisual(r.antecedent[0],'lg')}<b>${esc(r.antecedent.join(' + '))}</b></div><span>${icon('arrow',22)}</span><div>${productVisual(r.consequent[0],'lg')}<b>${esc(r.consequent.join(' + '))}</b></div></div><div class="drawer-metrics"><div><span>SUPPORT</span><b>${pct(r.support,1)}</b><small>Basket frequency</small></div><div><span>CONFIDENCE</span><b>${pct(r.confidence,1)}</b><small>Conditional probability</small></div><div><span>LIFT</span><b>${Number(r.lift).toFixed(2)}×</b><small>Affinity vs random</small></div></div><div class="insight-callout"><span>${icon('recommend',18)}</span><div><b>${r.lift>1?'Positive association':'Weak association'}</b><p>${esc(r.consequent.join(' + '))} appears ${r.lift>1?'more often':'at baseline frequency'} with ${esc(r.antecedent.join(' + '))} than chance.</p></div></div><div class="drawer-actions"><button class="btn btn-secondary" data-modal-close>Close</button><button class="btn btn-primary" id="recommendFromRule">Recommend From This ${icon('arrow',14)}</button></div>`);
  document.getElementById('recommendFromRule').addEventListener('click',()=>{closeOverlay();sessionStorage.setItem('fc_recommend_seed',r.antecedent[0]);nav('/recommendations')});
}
async function recommendationsPage(page) {
  const pdata=await fetchAll('/products?sort_by=name');const products=pdata.items||[];const seed=sessionStorage.getItem('fc_recommend_seed')||products[0]?.product_name||'';sessionStorage.removeItem('fc_recommend_seed');
  page.innerHTML=`${pageHeader('Recommendations','Stored association rules ranked by lift, confidence, support')}<section class="card recommendation-workspace"><div class="tabs"><button class="tab active" data-rec-tab="single">Single Item</button><button class="tab" data-rec-tab="basket">Basket</button></div><div id="recSingle"><div class="recommend-controls"><label>Product<select id="recProduct">${products.map(p=>`<option ${p.product_name===seed?'selected':''}>${esc(p.product_name)}</option>`).join('')}</select></label><button class="btn btn-primary" id="runRec">Recommend ${icon('arrow',14)}</button></div><div id="recResults"></div></div><div id="recBasket" hidden><div class="recommend-controls basket-controls"><label>Add product<select id="basketProduct"><option value="">Choose product...</option>${products.map(p=>`<option>${esc(p.product_name)}</option>`).join('')}</select></label><button class="btn btn-secondary" id="addBasketProduct">${icon('plus',15)} Add</button><button class="btn btn-primary" id="runBasketRec">Find Matches ${icon('arrow',14)}</button></div><div id="basketChips" class="chips large"></div><div id="basketResults"></div></div></section>`;
  const renderRec=async()=>{const name=document.getElementById('recProduct').value;const target=document.getElementById('recResults');target.innerHTML=`<div class="page-loading compact">${loadingRows(3)}</div>`;try{const result=await api(`/recommendations/${encodeURIComponent(name)}?limit=6`);target.innerHTML=recommendationResults(name,result.recommendations)}catch(err){target.innerHTML=err.status===404?emptyState('Run Apriori analysis first',roleCan('analysis')?'Run Analysis':'', '/analysis'):errorBlock(err.message)}};
  const basket=[];const renderBasketChips=()=>{document.getElementById('basketChips').innerHTML=basket.map((x,i)=>`<span class="choice-chip">${esc(x)}<button data-remove-basket="${i}">×</button></span>`).join('')||'<span class="subtle">Add two or more products for combination matching.</span>';document.querySelectorAll('[data-remove-basket]').forEach(b=>b.addEventListener('click',()=>{basket.splice(Number(b.dataset.removeBasket),1);renderBasketChips()}));};
  document.querySelectorAll('[data-rec-tab]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-rec-tab]').forEach(x=>x.classList.toggle('active',x===btn));const single=btn.dataset.recTab==='single';document.getElementById('recSingle').hidden=!single;document.getElementById('recBasket').hidden=single;}));
  document.getElementById('runRec').addEventListener('click',renderRec);document.getElementById('addBasketProduct').addEventListener('click',()=>{const v=document.getElementById('basketProduct').value;if(v&&!basket.includes(v)){basket.push(v);renderBasketChips()}});document.getElementById('runBasketRec').addEventListener('click',async()=>{if(!basket.length){toast('Add at least one product','danger');return}const target=document.getElementById('basketResults');target.innerHTML=`<div class="page-loading compact">${loadingRows(3)}</div>`;try{const result=await api('/recommendations',{method:'POST',json:{items:basket}});target.innerHTML=recommendationResults(basket.join(' + '),result.recommendations)}catch(err){target.innerHTML=errorBlock(err.message)}});renderBasketChips();await renderRec();
}

function recommendationResults(origin,recs) {
  if(!recs?.length)return `<div class="empty-state"><div class="empty-mark">${icon('recommend',28)}</div><h3>No strong matches</h3><p>Try another product or lower analysis thresholds.</p></div>`;
  const originItems = origin.split(/\s*\+\s*/).filter(Boolean);
  const originVisual = originItems.length > 1
    ? `<div class="origin-basket-grid" style="display:flex;gap:8px;justify-content:center;margin:10px 0;flex-wrap:wrap;">${originItems.map(item=>productVisual({product_name:item},'sm')).join('')}</div>`
    : productVisual({product_name:origin},'hero');
  return `<div class="recommendation-stage"><aside class="origin-card"><span class="eyebrow">ORIGIN</span>${originVisual}<h2>${esc(origin)}</h2><small>Selected basket input</small></aside><div class="flow-arrow">${icon('arrow',28)}</div><div class="recommendations-panel"><div class="card-head"><div><h2>Recommended Next</h2><p>Lift-first association ranking</p></div></div><div class="ranked-recs">${recs.map((r,i)=>`<article><span class="rank">${i+1}</span>${productVisual(r.product,'sm')}<div class="rank-copy"><div class="title-row"><h3>${esc(r.product)}</h3>${badge(i===0?'Strong Match':i===1?'Good Match':'Related',i===0?'success':'primary')}</div><div class="rank-bars"><div><span>Confidence</span><i><em style="width:${Math.min(100,r.confidence*100)}%"></em></i><b>${pct(r.confidence,1)}</b></div><div><span>Lift</span><i><em style="width:${Math.min(100,(r.lift/2)*100)}%"></em></i><b>${Number(r.lift).toFixed(2)}×</b></div></div></div></article>`).join('')}</div></div></div>`;
}


async function usersPage(page) {
  if(state.user?.role!=='ADMIN') { const err=new Error('Administrator access required'); err.status=403; throw err; }
  state.pg.users = { page: 1 };
  state.usersById = new Map();
  page.innerHTML=`${pageHeader('Users','Role and account access management')}<section class="card"><div class="table-toolbar"><div><b id="userTotal">Users</b><span class="subtle"> Admin-controlled access</span></div><div class="search-inline">${icon('search',15)}<input id="userSearch" placeholder="Search name or email" aria-label="Search users"></div></div><div class="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Joined</th><th></th></tr></thead><tbody id="userRows"></tbody></table></div><div id="userPager"></div></section>`;
  const cfg = {
    key:'users', tbody:'userRows', pager:'userPager', cols:5, empty:'No users match',
    path:()=>{ const q=document.getElementById('userSearch').value.trim(); return `/users${q?`?search=${encodeURIComponent(q)}`:''}`; },
    row:u=>{ state.usersById.set(u.id,u); return `<tr><td><div class="person-cell"><span class="avatar sm">${esc(initials(u.name))}</span><span><b>${esc(u.name)}</b><small>${esc(u.email)}</small></span></div></td><td>${badge(u.role,u.role==='ADMIN'?'success':u.role==='ANALYST'?'primary':'neutral')}</td><td>${badge(u.is_active?'Active':'Inactive',u.is_active?'success':'danger')}</td><td>${dateOnly(u.created_at)}</td><td class="row-actions">${u.id===state.user.id?`<span class="subtle">Current user</span>`:`<button class="icon-btn" data-manage-user="${u.id}" title="Manage user">${icon('more',17)}</button>`}</td></tr>`; },
    after:d=>{ document.getElementById('userTotal').textContent=`${num(d.total)} Users`; page.querySelectorAll('[data-manage-user]').forEach(btn=>btn.addEventListener('click',()=>openUserManager(state.usersById.get(Number(btn.dataset.manageUser))))); },
  };
  document.getElementById('userSearch').addEventListener('input',debounce(()=>{state.pg.users.page=1;loadTable(cfg)}));
  bindPageNav(page); loadTable(cfg);
}

function openUserManager(user) {
  if(!user)return;
  showModal(`<div class="modal-head"><div><span class="eyebrow">ACCOUNT ACCESS</span><h2>Manage ${esc(user.name)}</h2></div><button class="icon-btn" data-modal-close>${icon('close')}</button></div><form id="manageUserForm" class="form-stack"><label>Role<select name="role"><option ${user.role==='ADMIN'?'selected':''}>ADMIN</option><option ${user.role==='ANALYST'?'selected':''}>ANALYST</option><option ${user.role==='USER'?'selected':''}>USER</option></select></label><label>Status<select name="active"><option value="true" ${user.is_active?'selected':''}>Active</option><option value="false" ${!user.is_active?'selected':''}>Inactive</option></select></label><div class="modal-actions"><button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="submit" class="btn btn-primary">Save Access</button></div></form>`);
  document.getElementById('manageUserForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await api(`/users/${user.id}`,{method:'PUT',json:{role:f.get('role'),is_active:f.get('active')==='true'}});closeOverlay();toast('User access updated');await renderPage()}catch(err){toast(err.message,'danger')}});
}

async function profilePage(page) {
  const u=await api('/auth/me');
  page.innerHTML=`${pageHeader('Profile','Account identity and security')}<section class="profile-layout"><article class="card profile-main"><div class="profile-hero"><span class="avatar xxl">${esc(initials(u.name))}</span><div><h2>${esc(u.name)}</h2><p>${esc(u.email)}</p>${badge(u.role,u.role==='ADMIN'?'success':u.role==='ANALYST'?'primary':'neutral')}</div></div><form id="profileForm" class="form-stack"><label>Name<input name="name" value="${esc(u.name)}" required minlength="2"></label><label>Email<input name="email" type="email" value="${esc(u.email)}" required></label><button class="btn btn-primary" type="submit">Save Changes</button></form></article><article class="card security-card"><div class="card-head"><div><h2>Security</h2><p>Change your account password</p></div>${icon('lock',18)}</div><form id="passwordForm" class="form-stack"><label>Current password<input name="current_password" type="password" required></label><label>New password<input name="new_password" type="password" minlength="8" required></label><button class="btn btn-secondary" type="submit">Change Password</button></form><div class="danger-zone"><div><b>Session</b><span>End this browser session.</span></div><button class="btn btn-danger" id="profileLogout">Logout</button></div></article></section>`;
  document.getElementById('profileForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{state.user=await api('/auth/me',{method:'PUT',json:{name:f.get('name'),email:f.get('email')}});toast('Profile updated');render()}catch(err){toast(err.message,'danger')}});document.getElementById('passwordForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await api('/auth/change-password',{method:'POST',json:{current_password:f.get('current_password'),new_password:f.get('new_password')}});e.currentTarget.reset();toast('Password changed')}catch(err){toast(err.message,'danger')}});document.getElementById('profileLogout').addEventListener('click',()=>logout());
}

render();
