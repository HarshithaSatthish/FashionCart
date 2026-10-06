import { JSDOM } from 'jsdom';
import fs from 'fs';
import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import path from 'path';

// Frontend smoke test: runs the real SPA in jsdom against a live, SEEDED backend.
//   API_URL=http://127.0.0.1:8000/api npm run smoke        (default)
//   API_URL=http://localhost:3000/api npm run smoke        (through Nginx / Docker)
const API = process.env.API_URL || 'http://127.0.0.1:8000/api';
const here = path.dirname(fileURLToPath(import.meta.url));
const fe = path.resolve(here, '..');
const html=fs.readFileSync(path.join(fe,'index.html'),'utf8').replace(/<script[^>]*><\/script>/g,'');
const bundle=(await build({entryPoints:[path.join(fe,'app.js')],bundle:true,format:'iife',write:false,logLevel:'error'})).outputFiles[0].text;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// Ensure an Apriori run exists so rules/recommendation views have data.
{ const r=await fetch(API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'analyst@fashioncart.dev',password:'Analyst@123'})});
  const t=(await r.json()).access_token;
  await fetch(API+'/analysis/run',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+t},body:JSON.stringify({min_support:0.05,min_confidence:0.3,min_lift:1.0})}); }
let fails=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)fails++;};
async function login(email,password){const r=await fetch(API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});return (await r.json()).access_token;}
async function boot(email,password,hash){
  const token=await login(email,password);
  const errors=[];
  const dom=new JSDOM(html,{url:'http://127.0.0.1:3000/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;
  w.FASHIONCART_API_URL=API;
  w.localStorage.setItem('fashioncart_token',token);
  w.location.hash=hash;
  w.fetch=(u,o)=>fetch(new URL(u,'http://127.0.0.1:3000/').href,o);
  w.FormData=FormData; w.scrollTo=()=>{}; w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.addEventListener('error',e=>errors.push(String(e.message)));
  w.addEventListener('unhandledrejection',e=>errors.push('unhandled:'+e.reason));
  w.eval(bundle);
  return {w,doc:w.document,errors};
}
async function until(fn,ms=6000){const t=Date.now();while(Date.now()-t<ms){try{if(fn())return true}catch{}await sleep(80)}return false}
const txt=(d,sel)=>d.querySelector(sel)?.textContent.replace(/\s+/g,' ').trim()||'';
const rows=(d,id)=>d.querySelectorAll(`#${id} tr`).length;

// ---------- ANALYST ----------
{
  const {w,doc,errors}=await boot('analyst@fashioncart.dev','Analyst@123','#/orders');
  ok(await until(()=>rows(doc,'orderRows')>=25),'orders: first page renders 25 rows');
  ok(rows(doc,'orderRows')===25,'orders: exactly 25 rows, not 100');
  const info=txt(doc,'#orderPager .pager-info'); console.log('   pager:',info);
  ok(/of 550/.test(info),'orders: pager shows true total 550 (previously capped at 100)');
  const firstId=txt(doc,'#orderRows tr td b');
  doc.querySelector('#orderPager [data-pg=next]').click();
  ok(await until(()=>txt(doc,'#orderRows tr td b')!==firstId),'orders: Next moves to a different page');
  ok(/Page 2 \/ 22/.test(txt(doc,'#orderPager')),'orders: shows Page 2 / 22');
  doc.querySelector('#orderPager [data-pg=last]').click();
  ok(await until(()=>/Page 22 \/ 22/.test(txt(doc,'#orderPager'))),'orders: Last page works');
  ok(rows(doc,'orderRows')===550-21*25,'orders: last page has remaining 25 rows');
  const si=doc.getElementById('orderSearch'); si.value='zzzz-no-such'; si.dispatchEvent(new w.Event('input'));
  ok(await until(()=>/No orders match/.test(doc.getElementById('orderRows').textContent)),'orders: search with no match shows empty state');
  ok(errors.length===0,'orders: no runtime errors '+errors.join('|'));
}
{
  const {w,doc,errors}=await boot('analyst@fashioncart.dev','Analyst@123','#/customers');
  ok(await until(()=>rows(doc,'customerRows')>0),'customers: renders');
  console.log('   pager:',txt(doc,'#customerPager .pager-info'));
  ok(/of \d+/.test(txt(doc,'#customerPager .pager-info')),'customers: pager present');
  const nm=txt(doc,'#customerRows tr .person-cell b');
  const si=doc.getElementById('customerSearch'); si.value=nm.split(' ')[0]; si.dispatchEvent(new w.Event('input'));
  ok(await until(()=>rows(doc,'customerRows')>0 && !/No customers/.test(doc.getElementById('customerRows').textContent)),'customers: server search returns matches');
  ok(errors.length===0,'customers: no runtime errors '+errors.join('|'));
}
{
  const {w,doc,errors}=await boot('analyst@fashioncart.dev','Analyst@123','#/products');
  ok(await until(()=>rows(doc,'productRows')>0),'products: renders');
  console.log('   summary:',txt(doc,'.summary-bar'),'| pager:',txt(doc,'#productPager .pager-info'));
  const sel=doc.getElementById('productSort'); sel.value='price-desc'; sel.dispatchEvent(new w.Event('change'));
  await sleep(600);
  const prices=[...doc.querySelectorAll('#productRows tr td:nth-child(4) b')].map(b=>Number(b.textContent.replace(/[^0-9.]/g,'')));
  ok(prices.length>1 && prices.every((p,i)=>i===0||prices[i-1]>=p),'products: price-desc sorted server-side '+prices.slice(0,4));
  const cat=doc.getElementById('categoryFilter'); cat.value=cat.options[1].value; cat.dispatchEvent(new w.Event('change'));
  await sleep(600);
  ok([...doc.querySelectorAll('#productRows tr td:nth-child(2)')].every(td=>td.textContent.trim().length>0),'products: category filter renders');
  ok(errors.length===0,'products: no runtime errors '+errors.join('|'));
}
for (const [hash,probe] of [['#/transactions','txRows'],['#/dashboard','.metric-grid'],['#/analysis','.analysis-layout'],['#/rules',null],['#/recommendations',null]]){
  const {doc,errors}=await boot('analyst@fashioncart.dev','Analyst@123',hash);
  const found=await until(()=>probe? (probe.startsWith('#')||probe.startsWith('.')?doc.querySelector(probe):doc.getElementById(probe)) : doc.querySelector('#page, main, .page')?.textContent.length>200);
  const t=probe==='txRows'? await until(()=>rows(doc,'txRows')>0):true;
  ok(found&&t&&errors.length===0,`analyst ${hash}: renders without errors ${errors.join('|')}`);
}
{
  const {doc,errors}=await boot('analyst@fashioncart.dev','Analyst@123','#/orders/5');
  ok(await until(()=>/Order #5/.test(doc.body.textContent)),'order detail: renders with single-record lookups');
  ok(errors.length===0,'order detail: no errors '+errors.join('|'));
}
{
  const {doc,errors}=await boot('analyst@fashioncart.dev','Analyst@123','#/products/1');
  ok(await until(()=>doc.body.textContent.includes('Product Details')),'product detail: renders');
  ok(errors.length===0,'product detail: no errors '+errors.join('|'));
}
// ---------- ADMIN ----------
{
  const {w,doc,errors}=await boot('admin@fashioncart.dev','Admin@123','#/users');
  ok(await until(()=>rows(doc,'userRows')>=3),'users (admin): renders');
  ok(/Users/.test(txt(doc,'#userTotal')),'users: total label '+txt(doc,'#userTotal'));
  doc.querySelector('[data-manage-user]')?.click();
  ok(await until(()=>doc.querySelector('.modal,.drawer')),'users: manage dialog opens');
  ok(errors.length===0,'users: no errors '+errors.join('|'));
}
// ---------- USER ----------
{
  const {w,doc,errors}=await boot('user@fashioncart.dev','User@123','#/dashboard');
  ok(await until(()=>/Welcome back/.test(doc.body.textContent)),'USER: gets purpose-built home');
  const body=doc.body.textContent;
  ok(!/TOTAL CUSTOMERS|TOTAL ORDERS|RULES FOUND/.test(body),'USER: no admin KPIs shown');
  ok(/Frequently bought together/.test(body)&&doc.querySelectorAll('.recommend-card').length>0,'USER: sees pairing cards ('+doc.querySelectorAll('.recommend-card').length+')');
  const sel=doc.getElementById('homeProduct'); sel.value='Belt'; sel.dispatchEvent(new w.Event('change'));
  ok(await until(()=>/No pairings found/.test(doc.getElementById('homeRecs').textContent)),'USER: pair finder shows friendly empty state for product without rules');
  sel.value='Classic T-Shirt'; sel.dispatchEvent(new w.Event('change'));
  ok(await until(()=>doc.querySelectorAll('#homeRecs .mini-rec-list > div').length>0),'USER: pair finder returns recommendations');
  ok(errors.length===0,'USER: no errors '+errors.join('|'));
}
console.log(fails?`\n${fails} FAILURE(S)`:'\nALL FRONTEND SMOKE CHECKS PASSED'); process.exit(fails?1:0);
