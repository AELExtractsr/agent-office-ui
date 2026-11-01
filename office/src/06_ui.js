
/* ================================ UI ====================================== */
const $ = id => document.getElementById(id);
const statusLabel = { working:'Working', needs:'Needs you', idle:'Idle', error:'Error' };
function iconSvg(b, size=20){
  ensureArtDefs(b); const A = artFor(b), pid = 'ba'+b.idx, ec = lighten(EY[b.status],.55), s2 = size*1.22;
  return `<svg width="${s2.toFixed(1)}" height="${s2.toFixed(1)}" viewBox="-25 -63 50 66" overflow="visible">${A.body(pid,true)}<circle cx="${-b.ex}" cy="${b.ey}" r="4.6" fill="rgba(6,8,18,.7)"/><circle cx="${b.ex}" cy="${b.ey}" r="4.6" fill="rgba(6,8,18,.7)"/><circle cx="${-b.ex}" cy="${b.ey}" r="3.2" fill="${ec}"/><circle cx="${b.ex}" cy="${b.ey}" r="3.2" fill="${ec}"/></svg>`;
}
function statusText(b){
  if(b.live){ const l=b.live; if(l.stale||b.status==='idle') return l.none ? 'No status reported — asleep' : 'Asleep · '+(l.task||'idle')+(l.age!=null?' · '+ago(l.age):''); return l.task||statusLabel[b.status]; }
  const t = b.task();
  if(b.status==='working') return (b.altLabel || t.steps[clamp(b.step,1,4)-1]);
  if(b.status==='needs') return t.needs ? t.needs.title : 'Waiting for you';
  if(b.status==='error') return b.errorMsg;
  return b.cfg.idleNote;
}
function renderPills(){
  const c = { working:0, needs:0, idle:0, error:0 }; STATE.bots.forEach(b=>c[b.status]++);
  const free = DESKS.filter(d=>!d.owner).length;
  $('pills').innerHTML =
    `<span class="pill"><i style="--c:${ST.working}"></i><b>${c.working}</b> working</span>
     <span class="pill"><i style="--c:${ST.needs}"></i><b>${c.needs}</b> need you</span>
     <span class="pill"><i style="--c:${ST.idle}"></i><b>${c.idle}</b> idle</span>
     <span class="pill err ${c.error?'on':''}"><i style="--c:${ST.error}"></i><b>${c.error}</b> error</span>
     <span class="pill free"><i></i><b>${free}</b> free desks</span>`;
}
function renderTeam(){
  $('teamN').textContent = STATE.bots.length+' bots';
  $('teamList').innerHTML = STATE.bots.map(b=>`<div class="row ${STATE.selected===b.id?'sel':''}" data-id="${b.id}" style="--bc:${b.color}">
    <div class="ico">${iconSvg(b,20)}</div>
    <div class="mid"><div class="nm">${esc(b.cfg.name)}</div><div class="rl">${esc(statusText(b))}</div></div>
    <span class="badge st-${b.status}"><i></i>${statusLabel[b.status]}</span></div>`).join('');
}
function renderTask(){
  const el = $('task'), ae = document.activeElement;
  if(ae && ae.id==='nudgeTxt' && el.contains(ae)) return; // don't clobber typing; refresh on blur
  renderTaskInner();
}
function renderTaskInner(){
  const el = $('task'), b = STATE.byId[STATE.selected];
  if(!b){ el.innerHTML = `<div class="ph"><span>Task</span></div><div class="empty">Select a bot to see its task.</div>`; return; }
  if(b.live){ renderLiveTask(el,b); return; }
  const t = b.task(); el.style.setProperty('--bc', b.color);
  const needsAtt = b.status==='needs', err = b.status==='error', idle = b.status==='idle';
  const cur = clamp(b.step,1,4);
  const items = t.steps.map((s,i)=>{ const n=i+1; let cls='';
    if(idle) cls = ''; else if(n<cur) cls='d'; else if(n===cur) cls = needsAtt?'w':err?'e':'c'; 
    const ic = cls==='d'?'✓':cls==='w'?'!':cls==='e'?'×':'';
    return `<li class="${cls}"><span class="ic">${ic}</span><span>${esc((n===cur&&b.altLabel&&b.status==='working')?b.altLabel:s)}</span></li>`; }).join('');
  const bars = t.steps.map((s,i)=>{ const n=i+1; let cls=''; if(!idle){ if(n<cur) cls='d'; else if(n===cur) cls = needsAtt?'w':err?'e':'c'; } return `<i class="${cls}"></i>`; }).join('');
  let callout = '', btns = '';
  if(needsAtt && t.needs){
    callout = `<div class="callout" style="--cc:${ST.needs}"><b>${esc(t.needs.title)}</b>${esc(t.needs.detail)}</div>`;
    btns = `<div class="btns"><button class="btn ap" data-act="approve">Approve</button><button class="btn dc" data-act="decline">Decline</button></div>`;
  } else if(err){
    const f = t.fail; callout = `<div class="callout" style="--cc:${ST.error}"><b>${esc(b.errorMsg)}</b>${esc(f?f.detail:'The task stopped unexpectedly.')}</div>`;
    btns = `<div class="btns"><button class="btn dc" data-act="retry">Retry task</button></div>`;
  } else if(idle){
    callout = `<div class="callout" style="--cc:${ST.idle}"><b>Sleeping</b>${esc(b.cfg.idleNote)}</div>`;
  }
  el.innerHTML = `<div class="tk-h"><div class="ico">${iconSvg(b,22)}</div><div class="t"><b>${esc(b.cfg.name)}</b><span>${esc(b.cfg.role)}</span></div><span class="badge st-${b.status}"><i></i>${statusLabel[b.status]}</span></div>
    <div class="tk-name">${esc(idle?'Next up: '+t.name:t.name)}</div>
    <div class="stepline"><span>${idle?'Not started':`<b>Step ${cur} of 4</b>`}</span><span>${idle?'':needsAtt?'Waiting on you':err?'Stopped':'In progress'}</span></div>
    <div class="bars">${bars}</div><ul class="chk">${items}</ul>${callout}${btns}`;
}
function renderLiveTask(el,b){
  const l=b.live, st=b.status; el.style.setProperty('--bc', b.color);
  const hasStep = l.step!=null && l.total, cur = hasStep ? clamp(l.step,0,l.total) : 0;
  const bars = hasStep ? Array.from({length:Math.min(l.total,12)},(_,i)=>{ const n=i+1; let cls=''; if(st!=='idle'){ if(n<=cur-1+(st==='working'||st==='needs'||st==='error'?0:1)) cls='d'; else if(n===cur) cls = st==='needs'?'w':st==='error'?'e':'c'; } return `<i class="${cls}"></i>`; }).join('') : '';
  const cc = st==='needs'?ST.needs:st==='error'?ST.error:ST.idle;
  let callout='';
  if(st==='needs') callout = `<div class="callout" style="--cc:${cc}"><b>Needs you</b>${esc(l.task)}</div>`;
  else if(st==='error') callout = `<div class="callout" style="--cc:${cc}"><b>Error</b>${esc(l.task)}</div>`;
  else if(st==='idle') callout = `<div class="callout" style="--cc:${cc}"><b>Sleeping</b>${esc(l.none?'No status file for this bot yet.':l.stale?'No update for a while (last: '+(l.task||'—')+').':'Idle.')}</div>`;
  el.innerHTML = `<div class="tk-h"><div class="ico">${iconSvg(b,22)}</div><div class="t"><b>${esc(b.cfg.name)}</b><span>${esc(b.cfg.role)}</span></div><span class="badge st-${st}"><i></i>${statusLabel[st]}</span></div>
    <div class="tk-name">${esc(l.task || (l.none?'No status reported yet':'Idle'))}</div>
    <div class="stepline"><span>${hasStep?`<b>Step ${cur} of ${l.total}</b>`:(l.none?'':'Live status')}</span><span>${l.age!=null?'Updated '+ago(l.age):''}</span></div>
    ${bars?`<div class="bars">${bars}</div>`:''}${callout}${controlsHtml(b)}`;
}
/* ---- two-way control (live mode): POST /api/command, delivery state from /api/commands ---- */
const CMD = { list:[], seen:{} };
const cmdStateLabel = { queued:'queued', delivered:'delivered to box', seen:'seen by bot' };
function controlsHtml(b){
  const st = b.status, mine = CMD.list.filter(c=>c.bot===b.cfg.name).slice(-3).reverse();
  const ap = st==='needs' ? `<div class="btns"><button class="btn ap" data-act="cmd-approve">Approve</button><button class="btn dc" data-act="cmd-decline">Decline</button></div>` : '';
  const hist = mine.length ? `<ul class="cmdh">${mine.map(c=>`<li><b>${esc(c.action)}</b>${c.text?' · '+esc(c.text.slice(0,60)):''}<span class="cs cs-${c.state}">${cmdStateLabel[c.state]||esc(c.state)}</span></li>`).join('')}</ul>` : '';
  return `${ap}<div class="nudge"><textarea id="nudgeTxt" maxlength="500" rows="2" placeholder="Nudge ${esc(b.cfg.short||b.cfg.name)}… (sent to the bot's inbox)">${esc(b.draft||'')}</textarea><button class="btn dc" data-act="cmd-nudge">Send nudge</button></div>${hist}`;
}
async function sendCommand(b, action, text){
  try{
    const r = await fetch(API+'/command', { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json','X-Office':'1'}, body: JSON.stringify({ bot:b.cfg.name, action, text:text||'' }) });
    if(r.status===401){ location.href=OFFICE_CONFIG.loginUrl||'/'; return false; }
    if(!r.ok){ toast('Command failed ('+r.status+')','warn'); return false; }
    const c = await r.json(); CMD.list.push(c); CMD.seen[c.id] = c.state;
    log(b, `${action}${text?' “'+text.slice(0,80)+'”':''} → queued`, 'ok'); toast(`${action[0].toUpperCase()+action.slice(1)} queued for ${b.cfg.short||b.cfg.name}`,'ok'); refreshUI(); return true;
  }catch(e){ toast('Command failed (network)','warn'); return false; }
}
async function pollCommands(){
  try{ const r = await fetch(API+'/commands', { cache:'no-store', credentials:'same-origin' }); if(!r.ok) return; const arr = await r.json(); if(!Array.isArray(arr)) return;
    const first = !CMD.loaded; CMD.loaded = true; let ch = false;
    arr.forEach(c=>{ const prev = CMD.seen[c.id]; if(prev!==c.state){ ch = true; CMD.seen[c.id]=c.state;
      const b = STATE.bots.find(x=>x.cfg.name===c.bot) || null;
      if(first || prev) log(b, `${first?'recent ':''}command ${c.action}${c.text?' “'+c.text.slice(0,60)+'”':''}: ${cmdStateLabel[c.state]||c.state}`, c.state==='seen'?'ok':''); } });
    CMD.list = arr; if(ch) refreshUI();
  }catch(e){}
}
function refreshUI(){ renderPills(); renderTeam(); renderTask(); STATE.bots.forEach(updateTag); }

function selectBot(id, focus){
  if(id===STATE.selected && focus && STATE.focus){ STATE.focus = false; }
  else { STATE.selected = id; STATE.focus = !!focus; }
  refreshUI();
}
function deselect(){ STATE.focus = false; STATE.selected = null; refreshUI(); }

function resolveMode(m){ if(m!=='now') return m; const h = new Date().getHours(); return (h>=6&&h<17)?'day':(h>=17&&h<20)?'evening':'night'; }
function setMode(m){
  STATE.mode = m; const r = resolveMode(m);
  document.body.classList.remove('mode-day','mode-evening','mode-night'); document.body.classList.add('mode-'+r);
  document.querySelectorAll('#seg button').forEach(b=>{ b.classList.toggle('on', b.dataset.mode===m); });
  const nb = document.querySelector('#seg button[data-mode="now"]'); nb.innerHTML = 'Now' + (m==='now'?`<small>${r[0].toUpperCase()+r.slice(1)}</small>`:'');
}
function setShowAll(v){ STATE.showAll = v; $('tgAll').classList.toggle('on',v); $('tgAll').setAttribute('aria-checked',v); STATE.bots.forEach(updateTag); }

/* ============================== CAMERA / LOOP ============================== */
const BOUNDS = { x0:OX-D*S-36, x1:OX+W*S+36, y0:OY-WH*ZS-26, y1:P(W,D,-.5)[1]+30 };
const cam = { s:1, x:0, y:0, tx:0, ty:0, ts:1, init:false };
const mouse = { x:0, y:0, tx:0, ty:0 };
let area = { l:0, t:0, w:1000, h:700 };
function measure(){
  const vw = innerWidth, vh = innerHeight, sb = vw<1250?300:340;
  area = { l:0, t:70, w: vw - sb - 28, h: vh - 70 - 78 };
  document.documentElement.style.setProperty('--sb', sb+'px');
  ['stageA','stageB'].forEach(id=>{ const e=$(id); e.style.width=SCENE_W+'px'; e.style.height=SCENE_H+'px'; });
}
function fitScale(){ return Math.min((area.w+14)/(BOUNDS.x1-BOUNDS.x0), (area.h+10)/(BOUNDS.y1-BOUNDS.y0)); }
function updateCameraTarget(){
  const fs = fitScale(), b = STATE.focus && STATE.byId[STATE.selected];
  if(b){ const p = b.scr || P(b.x,b.y,b.z); const s = fs*SETTINGS.camera.focusZoom;
    cam.ts = s; const cx = clamp(p[0], BOUNDS.x0+ area.w/(2*s)*.9, BOUNDS.x1- area.w/(2*s)*.9), cy = clamp(p[1]-36, BOUNDS.y0+area.h/(2*s)*.85, BOUNDS.y1-area.h/(2*s)*.85);
    cam.tx = area.l + area.w/2 - cx*s; cam.ty = area.t + area.h/2 - cy*s;
  } else { cam.ts = fs; const cx=(BOUNDS.x0+BOUNDS.x1)/2, cy=(BOUNDS.y0+BOUNDS.y1)/2; cam.tx = area.l+area.w/2-cx*fs; cam.ty = area.t+area.h/2-cy*fs+4; }
}

const botList = [];
let lastSort = 0, dirty = true, lastT = 0, fpsAcc = 0, fpsN = 0, lastCamSig = '';
function frame(t){
  const dt = Math.min(.05, (t-lastT)/1000 || .016); lastT = t; const ts = t/1000;
  let moved = false;
  for(const b of STATE.bots){
    // follow-ups
    if(b.follow && t>=b.follow.at) runFollow(b);
    if(b.temp && t>b.temp.until){ b.temp=null; updateTag(b); }
    // movement
    let moving = false;
    if(b.path.length){ const w=b.path[0], dx=w.x-b.x, dy=w.y-b.y, dist=Math.hypot(dx,dy), last=b.path.length===1;
      const sp = last ? clamp(dist*3.2+.5, .5, 3.6) : 3.6; b.v = lerp(b.v, sp, 1-Math.exp(-dt*7));
      const step = Math.min(dist, b.v*dt); if(dist>.001){ b.x += dx/dist*step; b.y += dy/dist*step; b.face = dx; }
      if(dist-step<.04){ b.path.shift(); } moving = true; moved = true; }
    else b.v = lerp(b.v,0,1-Math.exp(-dt*8));
    const tz = (b.path.length<=1) ? b.dest.z : .04; b.z = lerp(b.z, tz, 1-Math.exp(-dt*(b.path.length<=1?7:5)));
    b.moving = moving;
    // anim
    b.phase += dt*(moving?10.5:2.1+b.idx*.07);
    const sleeping = b.status==='idle' && !moving;
    b.lie = lerp(b.lie, sleeping?1:0, 1-Math.exp(-dt*3.2)); b.dim = lerp(b.dim, b.status==='idle'?1:0, 1-Math.exp(-dt*2.5));
    const seated = b.z>.3 && !moving, base = seated?3.5:9;
    let hov = base + (moving ? Math.abs(Math.sin(b.phase))*8 : Math.sin(b.phase)*(seated?1.2:2.6));
    hov *= (1-b.lie*.95);
    const pul = Math.sin(b.phase*(moving?1:1)); let sy = 1 + (moving?pul*.05:pul*.025), sx = 1/Math.sqrt(sy);
    sx *= 1+.26*b.lie; sy *= 1-.34*b.lie; sy *= 1 + Math.sin(ts*1.6+b.idx)*.012*b.lie;
    const lean = moving ? clamp((b.face||0)*3,-1,1)*5 : 0 - b.lie*7;
    b.blinkT -= dt; if(b.blinkT<0){ b.blinkT = rand(2.2,5.5); b.blinkK = .16; } b.blinkK = Math.max(0, (b.blinkK||0)-dt); b.blink = b.blinkK>0 ? .1 : 1;
    const p = P(b.x,b.y,b.z); b.scr = p; b.hovPx = hov; b.sy = sy;
    // alert wobble for errors
    const shake = b.status==='error' ? Math.sin(ts*38)*(0.9+Math.sin(ts*3)*.4) : 0;
    b.el.root.setAttribute('transform', `translate(${(p[0]+shake).toFixed(1)} ${p[1].toFixed(1)})`);
    b.el.body.setAttribute('transform', `translate(0 ${(-hov).toFixed(1)}) rotate(${lean.toFixed(1)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`);
    const gs = 1 - hov*.018; b.el.gsh.setAttribute('transform', `scale(${(gs*(1+.1*b.lie)).toFixed(3)} ${gs.toFixed(3)})`); b.el.gsh.setAttribute('opacity', (clamp(1-hov*.03,.5,1)).toFixed(2));
    b.el.dim.setAttribute('opacity', (b.dim*.5).toFixed(2));
    const open = (1-b.lie), eo = b.el.eyesO;
    eo.setAttribute('opacity', clamp(open*1.4-.2,0,1)); b.el.eyesS.setAttribute('opacity', clamp(b.lie*1.4-.2,0,1));
    eo.setAttribute('transform', `translate(0 ${b.ey}) scale(1 ${b.blink}) translate(0 ${-b.ey})`);
    const ringOn = STATE.selected===b.id || b.status==='needs' || b.status==='error';
    const rp = 1+Math.sin(ts*3.2+b.idx)*.06; b.el.ring.setAttribute('opacity', ringOn?(STATE.selected===b.id?.95:.5)*(b.status==='idle'?0:1):0);
    b.el.ring.setAttribute('transform', `scale(${rp.toFixed(3)})`); b.el.ring2.setAttribute('opacity', STATE.selected===b.id?.9:0); b.el.ring2.setAttribute('transform', `scale(${rp.toFixed(3)})`);
    // bounds for sorting
    const it = b.item; it.x0=b.x-.32; it.x1=b.x+.32; it.y0=b.y-.32; it.y1=b.y+.32;
    // glow layer
    const gl = b.gl; gl.root.setAttribute('transform', `translate(${(p[0]+shake).toFixed(1)} ${p[1].toFixed(1)})`);
    gl.slrb.setAttribute('transform', b.el.body.getAttribute('transform')); gl.slu.setAttribute('opacity', ((artFor(b).lit||.5)*(1-b.dim*.7)).toFixed(2));
    gl.eg.setAttribute('transform', `translate(0 ${(-hov-(b.ey*(1-sy))*0).toFixed(1)}) translate(0 ${(b.ey*(sy-1)).toFixed(1)})`);
    gl.eg.setAttribute('opacity', (b.status==='idle'?(1-b.dim*.85):1)*b.blink*(.85+Math.sin(ts*2+b.idx)*.1)*(1-b.lie*.7));
    gl.wg.setAttribute('transform', `translate(0 ${(-hov).toFixed(1)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`); gl.wg.setAttribute('opacity', (1-b.dim*.65).toFixed(2));
    gl.aura.setAttribute('opacity', (.55*(1-b.dim*.6)).toFixed(2));
    const atDesk = (b.status==='working'||b.status==='error') && !moving && b.dest.kind==='desk';
    gl.mon.setAttribute('opacity', atDesk ? (b.status==='error'?.0:1) : 0);
    // glow screens
    if(b.gsOn !== (atDesk && b.status==='working') || b.gsErr !== (atDesk && b.status==='error')){
      b.gsOn = atDesk && b.status==='working'; b.gsErr = atDesk && b.status==='error';
      const dd = document.querySelector(`#svgObjs .desk[data-d="${b.desk.idx}"]`); if(dd) dd.setAttribute('data-s', b.gsOn?'on':b.gsErr?'err':'off');
      const on = document.querySelector(`#glowScreens .gs-on[data-d="${b.desk.idx}"]`), er = document.querySelector(`#glowScreens .gs-err[data-d="${b.desk.idx}"]`);
      if(on) on.style.opacity = b.gsOn?1:0; if(er) er.style.opacity = b.gsErr?1:0; }
  }
  // depth sort
  if(moved || dirty){ const order = sortScene(ITEMS.concat(botList)); 
    const og = $('objs'); for(let i=order.length-1;i>=0;i--){ const o=order[i]; if(!o.bot) continue; const nxt = order[i+1] ? order[i+1].node : null; if(o.node.nextSibling!==nxt || o.node.parentNode!==og) og.insertBefore(o.node, nxt); }
    dirty = false; }
  // camera
  updateCameraTarget();
  if(!cam.init){ cam.s=cam.ts; cam.x=cam.tx; cam.y=cam.ty; cam.init=true; }
  const k = 1-Math.exp(-dt*(STATE.focus?4.2:3.4)); cam.s += (cam.ts-cam.s)*k; cam.x += (cam.tx-cam.x)*k; cam.y += (cam.ty-cam.y)*k;
  mouse.x += (mouse.tx-mouse.x)*(1-Math.exp(-dt*4)); mouse.y += (mouse.ty-mouse.y)*(1-Math.exp(-dt*4));
  const par = SETTINGS.camera.parallax, px = -mouse.x*8*par, py = -mouse.y*5*par;
  const sig = [cam.s,cam.x,cam.y,px,py].map(v=>v.toFixed(2)).join(',');
  if(sig!==lastCamSig){ lastCamSig = sig;
    const tr = `translate3d(${(cam.x+px).toFixed(2)}px,${(cam.y+py).toFixed(2)}px,0) scale(${cam.s.toFixed(4)})`;
    $('stageA').style.transform = tr; $('stageB').style.transform = tr;
    $('bg').style.transform = `translate3d(${(-mouse.x*5*par+ (cam.x-cam.tx)*.1).toFixed(1)}px,${(-mouse.y*3*par).toFixed(1)}px,0)`;
    $('motes').style.transform = `translate3d(${(-mouse.x*22*par).toFixed(1)}px,${(-mouse.y*14*par).toFixed(1)}px,0)`;
  }
  // labels
  layoutLabels(px, py);
  requestAnimationFrame(frame);
}
/* keep-out zone for the neon sign: projected wall-plane parallelogram, tested against label rects with SAT */
function signPoly(px, py){
  const S0 = SIGN, pad = .12;
  return [P(S0.x0-pad,0,S0.z1+pad), P(S0.x0+S0.w+pad,0,S0.z1+pad), P(S0.x0+S0.w+pad,0,S0.z1-S0.h-pad), P(S0.x0-pad,0,S0.z1-S0.h-pad)]
    .map(q=>[cam.x+px+q[0]*cam.s, cam.y+py+q[1]*cam.s]);
}
function rectHitsPoly(r, poly, m=0){
  const rx0=r.x-m, rx1=r.x+r.w+m, ry0=r.y-m, ry1=r.y+r.h+m;
  let mnx=1e9,mxx=-1e9,mny=1e9,mxy=-1e9; for(const q of poly){ mnx=Math.min(mnx,q[0]); mxx=Math.max(mxx,q[0]); mny=Math.min(mny,q[1]); mxy=Math.max(mxy,q[1]); }
  if(rx1<mnx || rx0>mxx || ry1<mny || ry0>mxy) return false;
  const rc = [[rx0,ry0],[rx1,ry0],[rx1,ry1],[rx0,ry1]];
  for(let i=0;i<4;i++){ const a=poly[i], b=poly[(i+1)%4], nx=-(b[1]-a[1]), ny=b[0]-a[0];
    let pmin=1e9,pmax=-1e9,rmin=1e9,rmax=-1e9;
    for(const q of poly){ const d=q[0]*nx+q[1]*ny; pmin=Math.min(pmin,d); pmax=Math.max(pmax,d); }
    for(const q of rc){ const d=q[0]*nx+q[1]*ny; rmin=Math.min(rmin,d); rmax=Math.max(rmax,d); }
    if(rmax<pmin || rmin>pmax) return false; }
  return true;
}
function layoutLabels(px, py){
  const list = STATE.bots.slice().sort((a,b)=>b.scr[1]-a.scr[1]), plates = [], placed = [];
  const zs = clamp(cam.s*.55+.45, .85, 1.18), pos = [], sign = signPoly(px, py);
  for(const b of list){
    const tg = b.tag;
    if(tg.measureT<=0){ tg.pw = tg.plate.offsetWidth; tg.ph = tg.plate.offsetHeight; if(tg.vis){ tg.bwid = tg.bubble.offsetWidth; tg.bhei = tg.bubble.offsetHeight+9; } tg.measureT = 20; } tg.measureT--;
    if(tg.vis && !tg.bwid){ tg.bwid = tg.bubble.offsetWidth; tg.bhei = tg.bubble.offsetHeight+9; }
    const headS = BH*(b.sy||1);
    const sx = cam.x+px + b.scr[0]*cam.s, sy = cam.y+py + (b.scr[1]-b.hovPx-headS-5)*cam.s, sf = cam.y+py + (b.scr[1]+3)*cam.s;
    const pw = (tg.pw||90)*zs, ph = (tg.ph||22)*zs, bw=(tg.bwid||150)*zs, bh=(tg.bhei||50)*zs;
    // would the upright nameplate / bubble cover the sign?  (sticky: needs a clear margin to flip back up)
    const upP = { x:sx-pw/2-3, y:sy-ph-2, w:pw+6, h:ph+4 }, upB = { x:sx-bw/2, y:sy-ph-5*zs-bh, w:bw, h:bh };
    const hit = m => rectHitsPoly(upP, sign, m) || (tg.vis && rectHitsPoly(upB, sign, m));
    const flip = tg.flip ? hit(26) : hit(0);
    if(flip !== !!tg.flip){ tg.flip = flip; tg.bx = 0; tg.by = 0; tg.el.classList.toggle('below', flip); }
    pos.push({b, tg, sx, sy, sf, pw, ph, flip});
    plates.push(flip ? { x:sx-pw/2-3, y:sf-2, w:pw+6, h:ph+4 } : upP);
  }
  placed.push(...plates);
  for(const o of pos){ const {b,tg,sx,sy,sf,pw,ph,flip} = o; let bx=0, by=0;
    if(tg.vis){
      const bw=(tg.bwid||150)*zs, bh=(tg.bhei||50)*zs, lim = Math.max(10,bw/2-22);
      const top0 = flip ? sf+ph+5*zs : sy-ph-5*zs-bh;           // bubble top before collision nudges
      for(let it=0; it<14; it++){ let hit=null; const x0=sx-bw/2+bx, y0=top0+by;
        for(const r of placed){ if(x0 < r.x+r.w && x0+bw > r.x && y0 < r.y+r.h && y0+bh > r.y && r.own!==b.id){ hit=r; break; } }
        if(!hit) break;
        const optR = hit.x+hit.w+4-(sx-bw/2), optL = hit.x-4-(sx+bw/2);
        const optV = flip ? hit.y+hit.h+4-top0 : hit.y-4-bh-top0;   // push down (below mode) / up (normal)
        const cands = []; if(Math.abs(optR)<=lim) cands.push([Math.abs(optR),'x',optR]); if(Math.abs(optL)<=lim) cands.push([Math.abs(optL),'x',optL]); cands.push([Math.abs(optV)*1.0+8,'y',optV]);
        cands.sort((a,c)=>a[0]-c[0]); const c = cands[0]; if(c[1]==='x') bx = c[2]; else by = c[2]; }
      placed.push({ x:sx-bw/2+bx, y:top0+by, w:bw, h:bh, own:b.id });
      // a nudged upright bubble that still lands on the sign flips below the bot next frame
      if(!flip && rectHitsPoly({ x:sx-bw/2+bx, y:top0+by, w:bw, h:bh }, sign, 0)) tg.flip = true, tg.bx = 0, tg.by = 0, tg.el.classList.add('below');
    }
    tg.bx = lerp(tg.bx, bx, .2); tg.by = lerp(tg.by, by, .2);
    tg.bw.style.setProperty('--bx', tg.bx.toFixed(1)+'px'); tg.bw.style.setProperty('--by', tg.by.toFixed(1)+'px');
    tg.el.style.transform = `translate3d(${sx.toFixed(1)}px,${(flip?sf:sy).toFixed(1)}px,0)`;
    tg.in.style.scale = zs.toFixed(3); tg.in.style.transformOrigin = flip ? '50% 0%' : '50% 100%';
  }
}

/* ================================ INIT ==================================== */
function init(){
  buildAll();
  BOTS.forEach((cfg,i)=>{ const b = new RBot(cfg,i); STATE.bots.push(b); STATE.byId[b.id]=b; });
  STATE.bots.forEach(b=>{ buildBotSprite(b); buildTag(b); botList.push(b.item); });
  // static depth order once (statics only), then bots slot in each frame
  const order = sortScene(ITEMS.slice()); const og = $('objs'); order.forEach(o=>og.appendChild(o.node));
  STATE.bots.forEach(b=>{ b.item.x0=b.x-.32; b.item.x1=b.x+.32; b.item.y0=b.y-.32; b.item.y1=b.y+.32; });
  // initial log
  const t0 = Date.now();
  log(null,'office online — '+BOTS.length+' agents','ok',new Date(t0));
  document.title = OFFICE_CONFIG.title; const ot=document.getElementById('officeTitle'); if(ot){ const w=String(OFFICE_CONFIG.title).split(' '); ot.innerHTML = esc(w.slice(0,-1).join(' ')||w[0])+(w.length>1?' <span>'+esc(w[w.length-1])+'</span>':''); }
  // UI events
  $('teamList').addEventListener('click', e=>{ const r=e.target.closest('.row'); if(r) selectBot(r.dataset.id, true); });
  $('task').addEventListener('click', e=>{ const bt=e.target.closest('[data-act]'); if(!bt) return; const b=STATE.byId[STATE.selected]; if(!b) return;
    if(bt.dataset.act.startsWith('cmd-')){ const a = bt.dataset.act.slice(4), ta = $('nudgeTxt'), tx = a==='nudge' ? (ta?ta.value.trim():'') : '';
      if(a==='nudge' && !tx){ toast('Type a nudge first','warn'); return; }
      bt.disabled = true; sendCommand(b, a, tx).then(ok=>{ bt.disabled=false; if(ok && a==='nudge'){ b.draft=''; if(ta) ta.value=''; renderTaskInner(); } }); return; }
    if(bt.dataset.act==='approve') approveBot(b); else if(bt.dataset.act==='decline') declineBot(b); else if(bt.dataset.act==='retry') retryBot(b); });
  $('task').addEventListener('input', e=>{ if(e.target.id==='nudgeTxt'){ const b=STATE.byId[STATE.selected]; if(b) b.draft=e.target.value; } });
  $('task').addEventListener('focusout', e=>{ if(e.target.id==='nudgeTxt') setTimeout(()=>{ if(document.activeElement?.id!=='nudgeTxt') renderTaskInner(); }, 150); });
  $('seg').addEventListener('click', e=>{ const bt=e.target.closest('button[data-mode]'); if(bt) setMode(bt.dataset.mode); });
  $('tgAll').addEventListener('click', ()=>setShowAll(!STATE.showAll));
  $('tgAll').addEventListener('keydown', e=>{ if(e.key===' '||e.key==='Enter'){ e.preventDefault(); setShowAll(!STATE.showAll); } });
  $('viewport').addEventListener('click', ()=>{ if(STATE.focus) { STATE.focus=false; } });
  addEventListener('keydown', e=>{ if(e.key==='Escape'){ if(STATE.focus) STATE.focus=false; else deselect(); } });
  addEventListener('mousemove', e=>{ mouse.tx = (e.clientX/innerWidth-.5)*2; mouse.ty = (e.clientY/innerHeight-.5)*2; });
  addEventListener('resize', ()=>{ measure(); lastCamSig=''; });
  // motes
  const mt = $('motes'); for(let i=0;i<18;i++){ const b=document.createElement('b'), sz=1.5+Math.random()*2.5; b.style.cssText=`left:${(Math.random()*100).toFixed(1)}%;top:${(20+Math.random()*80).toFixed(1)}%;width:${sz}px;height:${sz}px;animation-duration:${(9+Math.random()*12).toFixed(1)}s;animation-delay:${(-Math.random()*20).toFixed(1)}s`; mt.appendChild(b); }
  measure(); setMode(STATE.mode); STATE.selected = (BOTS.find(c=>c.primary)||BOTS[0]).id; refreshUI();
  setInterval(()=>{ if(STATE.mode==='now') setMode('now'); }, 60000);
  MockFeed.start(); LiveFeed.start(); Alerts.start(); setIndicator();
  requestAnimationFrame(t=>{ lastT=t; frame(t); });
}
/* Public API — a real data source can drive the office through this */
window.Office = { Alerts, BOTS, SETTINGS, STATE, setMode, selectBot, setShowAll, toast, log:(id,text,kind)=>log(STATE.byId[id],text,kind),
  applyUpdate(u){ const b=STATE.byId[u.id]; if(!b) return; if(u.live){ b.live=u.live; b.follow=null; b.temp=null; b.altLabel=null; buildLiveTask(b); } else if(b.live){ b.live=null; b.liveTask=null; } if(u.task!=null) b.taskIdx=u.task; if(u.step!=null) b.step=u.step; if(u.errorMsg) b.errorMsg=u.errorMsg; if(u.status) setStatus(b,u.status); else refreshUI(); },
  approve:id=>approveBot(STATE.byId[id]), decline:id=>declineBot(STATE.byId[id]), tick:()=>MockFeed.tick() };
init();
/* ---------- collaborations: status 'with' → glowing arc between desks + side-panel strip ---------- */
const Collab = { arcs:{}, sig:'' };
function collabPairs(){
  const out = {}, find = n => (typeof LiveFeed!=='undefined' ? LiveFeed.botFor(n) : null);
  STATE.bots.forEach(b=>{
    const stale = b.live && b.live.stale, list = b.live ? (b.live.with||[]) : (b.cfg.with||[]);
    if(stale || b.status==='idle' || !list.length) return;
    list.forEach(n=>{ const o = find(n); if(!o || o===b) return;
      const k = [b.id,o.id].sort().join('~'); if(!out[k]) out[k] = { k, a:b, b:o, task: (b.live? b.live.task : (b.task()||{}).name) || statusText(b) }; });
  });
  return out;
}
function collabTick(){
  const svg = document.getElementById('glowCollab'); if(!svg) return;
  const pairs = collabPairs(), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  for(const k in pairs){
    let A = Collab.arcs[k];
    if(!A){ const p = pairs[k], id = 'cg'+Object.keys(Collab.arcs).length+Math.floor(Math.random()*1e4);
      const g = document.createElementNS('http://www.w3.org/2000/svg','g'); g.setAttribute('class','arc'); g.setAttribute('opacity','0');
      g.innerHTML = `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${p.a.cfg.color}"/><stop offset="1" stop-color="${p.b.cfg.color}"/></linearGradient></defs>
        <path class="h" fill="none" stroke="url(#${id})" stroke-width="7" stroke-linecap="round" opacity=".16" filter="url(#fBlur8)"/>
        <path class="c" fill="none" stroke="url(#${id})" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>
        <path class="pulse" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".7" pathLength="100" stroke-dasharray="12 100" filter="url(#fBlur3)"/>`;
      svg.appendChild(g); A = Collab.arcs[k] = { g, grad:g.querySelector('linearGradient') };
      requestAnimationFrame(()=>requestAnimationFrame(()=>g.setAttribute('opacity','1')));
    }
    A.pair = pairs[k]; A.dead = false; clearTimeout(A.kill);
    const end = b => { const q = b.scr || P(b.x,b.y,b.z); return [q[0], q[1]-(b.hovPx||6)-34]; }, pa = end(A.pair.a), pb = end(A.pair.b);
    const mx=(pa[0]+pb[0])/2, my=Math.min(pa[1],pb[1]) - (Math.hypot(pb[0]-pa[0],pb[1]-pa[1])*.38 + 70);
    const d = `M${pa[0].toFixed(0)},${pa[1].toFixed(0)} Q${mx.toFixed(0)},${my.toFixed(0)} ${pb[0].toFixed(0)},${pb[1].toFixed(0)}`, _u = `M${pa[0].toFixed(1)},${pa[1].toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${pb[0].toFixed(1)},${pb[1].toFixed(1)}`;
    if(A.d!==d){ A.d=d; A.g.querySelectorAll('path').forEach(p=>p.setAttribute('d',d));
      A.grad.setAttribute('x1',pa[0]); A.grad.setAttribute('y1',pa[1]); A.grad.setAttribute('x2',pb[0]); A.grad.setAttribute('y2',pb[1]); }
  }
  for(const k in Collab.arcs){ const A = Collab.arcs[k]; if(!pairs[k] && !A.dead){ A.dead = true; A.g.setAttribute('opacity','0'); A.kill = setTimeout(()=>{ A.g.remove(); delete Collab.arcs[k]; }, reduce?0:1300); } }
  // side strip
  const keys = Object.keys(pairs).sort(), sig = keys.map(k=>k+'|'+pairs[k].task).join('#');
  if(sig!==Collab.sig){ Collab.sig = sig; const box = document.getElementById('collabs'); if(!box) return;
    box.hidden = !keys.length; document.getElementById('collabN').textContent = keys.length ? keys.length+' active' : '';
    const esc = t => String(t).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
    document.getElementById('collabList').innerHTML = keys.map(k=>{ const p = pairs[k];
      return `<div class="cp"><div class="pr"><span style="color:${p.a.cfg.color}">●</span> ${esc(p.a.cfg.short||p.a.cfg.name)}<i>⇄</i><span style="color:${p.b.cfg.color}">●</span> ${esc(p.b.cfg.short||p.b.cfg.name)}</div><div class="tk">${esc(p.task)}</div></div>`; }).join(''); }
}
setInterval(collabTick, 500);

</script>
</body>
</html>
