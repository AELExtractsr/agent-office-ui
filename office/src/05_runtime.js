
/* ============================== BOT SPRITES =============================== */
const BR = 21, BH = 58;
const BODY_D = `M${-BR+6},0 L${BR-6},0 Q${BR},0 ${BR},-10 C${BR},${-BH*.62} ${BR*.62},${-BH} 0,${-BH} C${-BR*.62},${-BH} ${-BR},${-BH*.62} ${-BR},-10 Q${-BR},0 ${-BR+6},0 Z`;

const ST = SETTINGS.theme.status, EY = SETTINGS.theme.eyes;
const STATE = { bots:[], byId:{}, selected:null, focus:false, mode:SETTINGS.startMode, showAll:false, hover:null, toastT:0 };
const nowMs = () => performance.now();
const rand = (a,b) => a + Math.random()*(b-a);
const pick = a => a[Math.floor(Math.random()*a.length)];

class RBot {
  constructor(cfg, i){
    this.cfg = cfg; this.id = cfg.id; this.idx = i; this.color = cfg.color;
    const st = cfg.start; this.status = st.status; this.taskIdx = st.task; this.step = st.step; this.approved = false; this.failed = {}; this.errorMsg = st.errorMsg || 'Error';
    if(st.status==='error') this.failed[st.task] = true;
    this.since = nowMs() - 30000; this.temp = null; this.altLabel = null; this.follow = null;
    this.phase = Math.random()*6; this.blinkT = rand(2,5); this.blink = 1; this.lie = 0; this.dim = 0; this.v = 0; this.path = []; this.moving = false; this.hover = 6; this.spotIdx = -1;
    const d = DESKS[cfg.desk]; this.desk = d;
    this.mySpot = cfg.seat!=null ? Object.assign({}, d.spot, { x:d.x+cfg.seat }) : d.spot;
    this.mySleep = cfg.sleepX!=null ? Object.assign({}, d.sleep, { x:d.x+cfg.sleepX }) : d.sleep;
    this.live = null; this.liveTask = null;
    const sp = this.destFor(); this.x = sp.x; this.y = sp.y; this.z = sp.z; this.dest = sp;
    this.tag = null; this.offY = 0;
  }
  task(){ return this.live ? this.liveTask : this.cfg.tasks[this.taskIdx]; }
  destFor(){
    if(this.status==='needs'){ if(this.spotIdx<0) this.spotIdx = claimSpot(this); return COUCH_SPOTS[this.spotIdx]; }
    releaseSpot(this);
    return this.status==='idle' ? this.mySleep : this.mySpot;
  }
}
const COUCH_SPOTS = [ {x:14.15,y:7.28,z:.66,kind:'couch'},{x:15.45,y:7.28,z:.66,kind:'couch'},{x:16.72,y:7.28,z:.66,kind:'couch'},
  {x:16.72,y:8.6,z:.66,kind:'couch'},{x:16.72,y:9.9,z:.66,kind:'couch'},{x:13.45,y:9.5,z:.04,kind:'floor'},{x:15.0,y:10.95,z:.04,kind:'floor'},{x:13.6,y:10.9,z:.04,kind:'floor'} ];
const spotClaims = [];
function claimSpot(b){ for(let i=0;i<COUCH_SPOTS.length;i++) if(!spotClaims[i]){ spotClaims[i]=b.id; return i; } return COUCH_SPOTS.length-1; }
function releaseSpot(b){ if(b.spotIdx>=0){ spotClaims[b.spotIdx]=null; b.spotIdx=-1; } }
const CORR_X = 12.5, LANES = [DESKS[0].spot.lane, DESKS[3].spot.lane, DESKS[6].spot.lane];
function route(from, dest){
  const out = [], inDesk = from.x < 12.1, lane = LANES.reduce((a,l)=>Math.abs(l-from.y)<Math.abs(a-from.y)?l:a, LANES[0]);
  if(dest.kind==='desk' && inDesk && Math.abs(dest.lane-lane)<.01 && Math.abs(from.y-dest.y)<1.6){ out.push(dest); return out; }
  if(inDesk){ out.push({x:from.x,y:lane}); out.push({x:CORR_X,y:lane}); } else out.push({x:CORR_X,y:from.y});
  if(dest.kind==='desk'){ out.push({x:CORR_X,y:dest.lane}); out.push({x:dest.x,y:dest.lane}); out.push(dest); }
  else { out.push({x:CORR_X,y:dest.y}); out.push(dest); }
  return out;
}
function sendTo(b){ const d = b.destFor(); b.dest = d; b.path = route({x:b.x,y:b.y}, d); }

function buildBotSprite(b){
  const c = b.color, A = artFor(b), pid = 'ba'+b.idx; ensureArtDefs(b);
  b.ex = A.ex; b.ey = A.ey; const EX = b.ex, EYv = b.ey;
  const g = document.createElementNS('http://www.w3.org/2000/svg','g'); g.setAttribute('class','bot'); g.setAttribute('data-id',b.id); g.style.cursor='pointer';
  const eye = x => `<circle cx="${x}" cy="${EYv}" r="5.6" fill="rgba(6,8,18,.62)"/><circle cx="${x}" cy="${EYv}" r="5.6" fill="none" stroke="rgba(255,255,255,.16)" stroke-width=".7"/><circle class="eh" cx="${x}" cy="${EYv}" r="6" fill="#9ff3ff" opacity=".3"/><circle class="ec" cx="${x}" cy="${EYv}" r="3.1" fill="#e9ffff"/>`;
  g.innerHTML = `
   <ellipse class="ring" cx="0" cy="0" rx="40" ry="20" fill="none" stroke="${c}" stroke-width="2.2" opacity="0"/>
   <ellipse class="ring2" cx="0" cy="0" rx="40" ry="20" fill="${alpha(c,.18)}" opacity="0"/>
   <ellipse class="gsh" cx="0" cy="2" rx="25" ry="10" fill="url(#gGround)"/>
   <g class="body">
     ${A.body(pid)}
     <g class="dimP" fill="#150a35" opacity="0">${A.sil(pid)}</g>
     <g class="eyesO"><g class="eL">${eye(-EX)}</g><g class="eR">${eye(EX)}</g></g>
     <g class="eyesS" opacity="0" fill="none" stroke="#b8a3ff" stroke-width="1.8" stroke-linecap="round"><path d="M${-EX-3.4},${EYv} q3.4,2.6 6.8,0" /><path d="M${EX-3.4},${EYv} q3.4,2.6 6.8,0"/></g>
   </g>
   <ellipse class="hit" cx="0" cy="-30" rx="26" ry="36" fill="transparent"/>`;
  b.el = { root:g, body:g.querySelector('.body'), gsh:g.querySelector('.gsh'), ring:g.querySelector('.ring'), ring2:g.querySelector('.ring2'), dim:g.querySelector('.dimP'),
           eyesO:g.querySelector('.eyesO'), eyesS:g.querySelector('.eyesS'), ehs:g.querySelectorAll('.eh'), ecs:g.querySelectorAll('.ec'), eL:g.querySelector('.eL'), eR:g.querySelector('.eR') };
  g.addEventListener('click', e => { e.stopPropagation(); selectBot(b.id, true); });
  g.addEventListener('mouseenter', ()=>{ STATE.hover = b.id; updateTag(b); });
  g.addEventListener('mouseleave', ()=>{ if(STATE.hover===b.id) STATE.hover=null; updateTag(b); });
  document.getElementById('objs').appendChild(g);
  b.item = { id:'bot_'+b.id, node:g, x0:0,x1:0,y0:0,y1:0, bot:true };
  // glow layer group
  const gb = document.createElementNS('http://www.w3.org/2000/svg','g');
  gb.innerHTML = `<ellipse class="aura" cx="0" cy="0" rx="46" ry="20" fill="${rgrad(c,.4)}"/><g class="wg"><ellipse class="wash" cx="0" cy="-27" rx="25" ry="33" fill="${rgrad(c,.62)}"/></g><g class="mon" opacity="0"><ellipse cx="0" cy="-26" rx="26" ry="26" fill="${rgrad('#4cf0ff',.16)}"/></g>
    <g class="eg"><circle class="g1" cx="${-EX}" cy="${EYv}" r="12" fill="${rgrad(EY.working,.9)}"/><circle class="g2" cx="${EX}" cy="${EYv}" r="12" fill="${rgrad(EY.working,.9)}"/></g>`;
  // night/evening self-illumination: a screen-blended copy of the avatar art (keeps its shading/colour) + a soft rim light in the bot colour
  b.el.body.setAttribute('id','bbody'+b.idx);
  gb.insertAdjacentHTML('beforeend', `<g class="selflit"><g filter="url(#fSat)"><use class="slu" href="#bbody${b.idx}"/></g><g class="slr" opacity="${A.rimO||.9}" fill="none" stroke="${A.rim||lighten(c,.45)}" stroke-width="${A.rimW||2.4}" stroke-linejoin="round" filter="url(#fBlur1)"><g class="slrb">${A.sil(pid)}</g></g></g>`);
  document.getElementById('gbots').appendChild(gb);
  b.gl = { root:gb, aura:gb.querySelector('.aura'), mon:gb.querySelector('.mon'), wg:gb.querySelector('.wg'), eg:gb.querySelector('.eg'), g1:gb.querySelector('.g1'), slrb:gb.querySelector('.slrb'), slu:gb.querySelector('.slu'), g2:gb.querySelector('.g2') };
  applyEyeColors(b);
}
function applyEyeColors(b){
  const col = EY[b.status]; const dimE = b.status==='idle';
  b.el.ehs.forEach(e=>{ e.setAttribute('fill',col); }); b.el.ecs.forEach(e=>{ e.setAttribute('fill', lighten(col,.7)); });
  b.el.eyesS.setAttribute('stroke', col);
  const gg = rgrad(col,.85); b.gl.g1.setAttribute('fill',gg); b.gl.g2.setAttribute('fill',gg);
}

/* ---------------------------- floating labels ----------------------------- */
function buildTag(b){
  const t = document.createElement('div'); t.className = 'tag'; t.style.setProperty('--bc', b.color);
  t.innerHTML = `<div class="in"><div class="bw"><div class="bubble"></div><div class="tail"></div></div><div class="plate" data-id="${b.id}"><i></i><span>${b.cfg.short||b.cfg.name}</span><em></em><b class="al" title="Alert">!</b></div><span class="zzz">z z z</span></div>`;
  document.getElementById('labels').appendChild(t);
  b.tag = { el:t, in:t.querySelector('.in'), bw:t.querySelector('.bw'), plate:t.querySelector('.plate'), bx:0, by:0, bubble:t.querySelector('.bubble'), tail:t.querySelector('.tail'), w:90, h:24, measureT:0 };
  t.querySelector('.plate').addEventListener('click', e=>{ e.stopPropagation(); selectBot(b.id, true); });
}
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function bubbleSpec(b){
  const t = b.task(), tm = nowMs();
  if(b.temp && tm < b.temp.until) return b.temp;
  if(b.alert && b.alert.kind==='stuck') return { kind:'speech', label:'Looks stuck', text:(b.alert.task||'No update')+' — no update for '+ago(Math.max(0,Math.floor(Date.now()/1000)-(b.alert.updated||0))).replace(' ago',''), color:'#ff3b4e' };
  if(b.status==='needs') return { kind:'speech', label:'Needs you', text:t.needs ? t.needs.bubble : 'Waiting for your input', color:ST.needs };
  if(b.status==='error') return { kind:'speech', label:'Error', text:b.errorMsg+' — waiting to retry', color:ST.error };
  if(b.status==='working') return { kind:'thought', label:null, text:b.altLabel || t.steps[clamp(b.step,1,4)-1], color:b.color, dots:true };
  return { kind:'thought', label:'Sleeping', text:b.cfg.idleNote, color:ST.idle };
}
function bubbleVisible(b){
  if(STATE.showAll || STATE.hover===b.id || STATE.selected===b.id) return true;
  if(b.temp && nowMs() < b.temp.until) return true;
  return b.status==='needs' || b.status==='error' || !!b.alert;
}
function updateTag(b){
  const tg = b.tag, sp = bubbleSpec(b), vis = bubbleVisible(b), el = tg.el;
  el.style.setProperty('--sc', ST[b.status]);
  el.classList.toggle('sleeping', b.status==='idle');
  el.classList.toggle('sel', STATE.selected===b.id);
  el.classList.toggle('alert', !!b.alert);
  tg.vis = vis; el.classList.toggle('hasb', vis); el.classList.toggle('showb', vis);
  if(vis){
    const cmp = !(STATE.hover===b.id || STATE.selected===b.id || (b.temp && nowMs() < b.temp.until)); el.classList.toggle('cmp', cmp);
    const sig = sp.kind+'|'+sp.label+'|'+sp.text+'|'+cmp;
    if(tg.sig !== sig){ tg.sig = sig;
      tg.bubble.style.setProperty('--bc', sp.color||b.color); tg.tail.style.setProperty('--bc', sp.color||b.color);
      tg.bubble.innerHTML = (sp.label?`<b>${esc(sp.label)}</b>`:'') + esc(sp.text) + (sp.dots?' <span class="dots"><i></i><i></i><i></i></span>':'');
      tg.tail.className = 'tail'+(sp.kind==='thought'?' thought':''); tg.tail.innerHTML = sp.kind==='thought'?'<i></i><i></i>':'';
      tg.bubble.style.setProperty('--bc', sp.color||b.color); tg.measureT = 0; tg.bwid = 0; }
  }
  b.el.ring.setAttribute('stroke', b.status==='needs'?ST.needs : b.status==='error'?ST.error : b.color);
}

/* =========================== STATE TRANSITIONS ============================ */
const fmtT = d => d.toTimeString().slice(0,8);
function log(b, text, kind='', t){
  const el = document.getElementById('feedList'), d = document.createElement('div'); const time = t || new Date();
  const who = b ? (b.cfg.short||b.cfg.name) : 'office';
  d.innerHTML = `<span class="t">[${fmtT(time)}]</span><span class="who" style="color:${b?b.color:'#9aa'}">${esc(who)}</span><span class="${kind?'k-'+kind:''}">${esc(text)}</span>`;
  el.appendChild(d); while(el.children.length>80) el.removeChild(el.firstChild); el.scrollTop = el.scrollHeight;
}
function setStatus(b, status, opts={}){
  const prev = b.status; b.status = status; b.since = nowMs(); if(opts.errorMsg) b.errorMsg = opts.errorMsg;
  applyEyeColors(b); sendTo(b); updateTag(b); refreshUI();
}
function needsCount(){ return STATE.bots.filter(b=>b.status==='needs').length; }
function startTask(b, idx, why){
  b.taskIdx = idx; b.step = 1; b.approved = false; b.altLabel = null; b.follow = null;
  setStatus(b,'working'); log(b, `${why}: ${b.task().name}`, '');
}
function nextTaskIdx(b){ const n=b.cfg.tasks.length; return (b.taskIdx + 1 + Math.floor(Math.random()*(n-1))) % n; }
function completeTask(b){
  log(b, `✓ completed “${b.task().name}”`, 'ok');
  if(!b.cfg.primary && Math.random()<.4){ b.taskIdx = nextTaskIdx(b); b.step=1; b.approved=false; b.altLabel=null; setStatus(b,'idle'); log(b,'going to sleep — '+b.cfg.idleNote.toLowerCase(),''); }
  else startTask(b, nextTaskIdx(b), 'picked up');
}
function progress(b){
  const t = b.task();
  log(b, `step ${b.step}/4 done — ${t.steps[b.step-1]}`, '');
  b.step++; b.altLabel = null;
  if(b.step>4){ completeTask(b); return; }
  if(t.needs && b.step===t.needs.atStep && !b.approved){
    if(needsCount()>=SETTINGS.sim.maxNeeds){ b.step--; return; }
    setStatus(b,'needs'); log(b, `waiting for you: ${t.needs.title}`, 'warn'); return; }
  if(t.fail && b.step===t.fail.step && !b.failed[b.taskIdx]){
    b.failed[b.taskIdx] = true; b.errorMsg = t.fail.msg; setStatus(b,'error'); log(b, `${t.fail.msg} — ${t.fail.detail}`, 'err'); return; }
  setStatus(b,'working');
}
function recoverError(b){
  log(b, 'retry succeeded — reconnected, resuming', 'ok'); setStatus(b,'working');
}
function toast(msg, kind='ok'){
  const t = document.getElementById('toast'); t.querySelector('span').textContent = msg;
  const i = t.querySelector('i'); i.textContent = kind==='ok'?'✓':kind==='warn'?'↺':'!'; i.style.setProperty('--tc', kind==='ok'?'#3ddc84':kind==='warn'?'#ffb23f':'#ff6b78');
  t.classList.add('on'); clearTimeout(STATE.toastT); STATE.toastT = setTimeout(()=>t.classList.remove('on'), 2900);
}
function approveBot(b){
  const n = b.task().needs; if(!n) return; b.approved = true; b.altLabel = null;
  b.temp = { kind:'speech', label:'Approved', text:n.ok, until:nowMs()+4800, color:ST.working };
  log(b, n.approveLog, 'ok'); setStatus(b,'working'); toast('Approved, the bot is continuing','ok');
  b.follow = { at: nowMs()+9000, type:'approved' };
}
function declineBot(b){
  const n = b.task().needs; if(!n) return; b.approved = true; b.altLabel = n.altStep;
  b.temp = { kind:'speech', label:'Declined', text:n.no, until:nowMs()+4800, color:ST.needs };
  log(b, n.declineLog, 'warn'); setStatus(b,'working'); toast('Declined, the bot is looking for another option','warn');
  b.follow = { at: nowMs()+11000, type:'declined' };
}
function retryBot(b){ log(b,'manual retry requested','warn'); b.temp = { kind:'speech', label:'Retrying', text:'Reconnecting to '+(b.errorMsg.includes('Redis')?'Redis':'service')+'…', until:nowMs()+3500, color:ST.working }; setStatus(b,'working'); toast('Retrying the task','warn'); b.follow = { at: nowMs()+7000, type:'retry' }; }
function runFollow(b){
  const f = b.follow; b.follow = null;
  if(f.type==='declined'){ log(b, 'alternative drafted — queued for tomorrow’s review', ''); completeTask(b); }
  else if(f.type==='retry'){ log(b, 'retry succeeded — reconnected, resuming', 'ok'); progress(b); }
  else progress(b);
}


/* ========================= LIVE FEED (real status) ========================= */
/* Polls API+'/status' (JSON array of reported statuses).
   If it returns >=1 entry -> "Live" (mock paused, every bot driven by real data; bots with no file / stale = asleep).
   If 401 / no files / network error -> "Demo" (mock simulation runs). */
const normName = s => String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
const LiveFeed = {
  on:false, started:false, lastKey:{}, first:true, misses:0,
  botFor(name){
    const n = normName(name); if(!n) return null;
    let hit = STATE.bots.find(b=>[b.cfg.name, b.cfg.short, b.id].concat(b.cfg.aliases||[]).some(x=>normName(x)===n));
    if(!hit) hit = STATE.bots.find(b=>{ const k=normName(b.cfg.name); return k.length>5 && (n.includes(k)||k.includes(n)); });
    return hit||null;
  },
  start(){ if(this.started) return; this.started = true; this.poll(); setInterval(()=>this.poll(), 5000); },
  async poll(){
    let arr = null, code = 0;
    if(!/^https?:/.test(location.protocol)){ this.setLive(false); return; }
    try{ const r = await fetch(API+'/status', { cache:'no-store', credentials:'same-origin' }); code = r.status;
      if(r.ok){ const j = await r.json(); arr = Array.isArray(j) ? j : null; } }catch(e){ code = 0; }
    if(code===401 && /^https?:/.test(location.protocol)){ location.href = OFFICE_CONFIG.loginUrl||'/'; return; }
    if(arr && arr.length){ this.misses = 0; this.apply(arr); pollCommands(); }
    else { this.misses++; if(this.on && this.misses>=3) this.setLive(false); else if(!this.on) this.setLive(false); }
  },
  setLive(v){
    if(v===this.on && !this.first) { setIndicator(); return; }
    const was = this.on; this.on = v; this.first = false;
    if(v){ const f = document.getElementById('feedList'); f.innerHTML = ''; log(null,'connected to live status feed','ok'); }
    else { STATE.bots.forEach(b=>{ b.live = null; b.liveTask = null; }); if(was){ log(null,'live feed lost — showing demo','warn'); STATE.bots.forEach(b=>{ b.step = clamp(b.step,1,4); }); refreshUI(); } }
    setIndicator();
  },
  apply(arr){
    this.setLive(true);
    const seen = {};
    arr.forEach(e=>{ const b = this.botFor(e.name); if(!b){ return; } if(!seen[b.id] || (e.updated||0) > (seen[b.id].updated||0)) seen[b.id] = e; });
    STATE.bots.forEach(b=>{
      const e = seen[b.id];
      let u;
      if(!e) u = { id:b.id, status:'idle', live:{ state:'idle', task:'', none:true, stale:true, age:null } };
      else {
        const stale = !!e.stale || (e.age!=null && e.age>900);
        let st = ({working:'working', needs_you:'needs', needs:'needs', idle:'idle', error:'error'})[e.state] || 'idle';
        if(stale) st = 'idle';
        u = { id:b.id, status:st, errorMsg: st==='error' ? (e.task||'Error') : undefined,
              live:{ state:e.state, task:e.task||'', with:Array.isArray(e.with)?e.with:(e.with?[e.with]:[]), step:e.step, total:e.total, stale, age:e.age, updated:e.updated, none:false } };
      }
      const key = u.status+'|'+u.live.task+'|'+u.live.step+'|'+u.live.total+'|'+u.live.stale;
      const changed = this.lastKey[b.id] !== key; const firstSeen = this.lastKey[b.id]===undefined;
      this.lastKey[b.id] = key;
      Office.applyUpdate(u);
      if(changed && (u.live.task || !firstSeen)){
        const k = u.status==='error'?'err':u.status==='needs'?'warn':'';
        const tail = u.live.step ? ` (${u.live.step}${u.live.total?'/'+u.live.total:''})` : '';
        log(b, u.live.stale ? (u.live.none ? 'no status reported — asleep' : 'status stale — asleep · last: '+u.live.task) : (statusLabel[u.status]+': '+u.live.task+tail), k);
      }
    });
    setIndicator();
  }
};
/* ============================ ALERTS (lean) ===============================
   Worker detects needs_you / stuck and dedupes (one alert per state change, cooldown; phone push via ntfy).
   Page polls /api/alerts every 15s: red badge on the desk plate, banner, optional browser Notification. */
const Alerts = {
  list:[], known:{}, dismissed:JSON.parse(localStorage.getItem('officeAlertsDismissed')||'{}'), started:false,
  key:a=>a.slug+'|'+a.kind+'|'+a.since,
  start(){ if(this.started) return; this.started = true; this.poll(); setInterval(()=>this.poll(), 15000); },
  async poll(){
    if(!/^https?:/.test(location.protocol)) return;
    try{ const r = await fetch(API+'/alerts', { cache:'no-store', credentials:'same-origin' }); if(!r.ok) return; const j = await r.json(); this.set(Array.isArray(j.alerts)?j.alerts:[]); }catch(e){}
  },
  set(arr){
    const first = !Object.keys(this.known).length && !this.list.length; this.list = arr;
    const live = {}; arr.forEach(a=>{ const k = this.key(a); live[k] = 1;
      if(!this.known[k] && !first){ const b = LiveFeed.botFor(a.name); log(b, a.kind==='stuck'?'looks stuck — no update for a while':'needs you: '+(a.task||'waiting'), 'err'); this.notify(a); } });
    this.known = live; Object.keys(this.dismissed).forEach(k=>{ if(!live[k]) delete this.dismissed[k]; }); this.save();
    STATE.bots.forEach(b=>{ b.alert = null; });
    arr.forEach(a=>{ const b = LiveFeed.botFor(a.name); if(b && !this.dismissed[this.key(a)]) b.alert = a; });
    STATE.bots.forEach(b=>updateTag(b)); this.render();
  },
  save(){ try{ localStorage.setItem('officeAlertsDismissed', JSON.stringify(this.dismissed)); }catch(e){} },
  dismiss(k){ this.dismissed[k] = 1; this.save(); this.set(this.list); },
  render(){
    const el = document.getElementById('alertBar'); if(!el) return;
    const vis = this.list.filter(a=>!this.dismissed[this.key(a)]);
    el.classList.toggle('on', vis.length>0);
    el.innerHTML = vis.slice(0,3).map(a=>{ const b = LiveFeed.botFor(a.name), nm = b ? (b.cfg.short||b.cfg.name) : a.name;
      return `<div class="al-i" data-k="${esc(this.key(a))}" data-id="${b?b.id:''}"><i class="k">${a.kind==='stuck'?'Stuck?':'Needs you'}</i><span><b>${esc(nm)}</b> · ${esc(a.task||(a.kind==='stuck'?'No update for a while':'Waiting for your input'))}</span><button title="Dismiss" data-x="1">✕</button></div>`; }).join('')
      + (vis.length>3 ? `<div class="al-n">+${vis.length-3} more</div>` : '')
      + (('Notification' in window) && Notification.permission==='default' ? `<button class="al-n" data-perm="1">Enable desktop notifications</button>` : '');
    el.onclick = e=>{ const t = e.target;
      if(t.dataset.perm){ Notification.requestPermission().then(()=>this.render()); return; }
      const it = t.closest('.al-i'); if(!it) return;
      if(t.dataset.x){ e.stopPropagation(); this.dismiss(it.dataset.k); return; }
      if(it.dataset.id) selectBot(it.dataset.id, true); };
  },
  notify(a){
    if(!('Notification' in window) || Notification.permission!=='granted') return;
    try{ const n = new Notification(a.kind==='stuck' ? a.name+' looks stuck' : a.name+' needs you', { body:a.task||'', tag:'office-'+a.slug }); n.onclick = ()=>{ window.focus(); const b = LiveFeed.botFor(a.name); if(b) selectBot(b.id, true); }; }catch(e){}
  }
};
function buildLiveTask(b){
  const l = b.live, nm = l.task || (l.none ? 'No status reported yet' : 'Idle');
  b.liveTask = { name:nm, steps:[nm,nm,nm,nm], chatter:[],
    needs:{ title:'Needs you', detail:nm, bubble:nm } };
}
function ago(sec){ if(sec==null) return ''; if(sec<60) return sec+'s ago'; if(sec<3600) return Math.round(sec/60)+' min ago'; if(sec<86400) return Math.round(sec/3600)+' h ago'; return Math.round(sec/86400)+' d ago'; }
function setIndicator(){
  const el = document.getElementById('liveInd'); if(!el) return;
  const on = LiveFeed.on; el.className = 'pill live '+(on?'on':'demo');
  el.innerHTML = `<i></i><b>${on?'Live':'Demo'}</b>`;
  el.title = on ? 'Showing real bot status (updates every 5s)' : 'Showing simulated demo data — no live status available';
  const fl = document.getElementById('feedLive'); if(fl) fl.innerHTML = `<span class="dot${on?'':' demo'}"></span>${on?'live':'demo'}`;
}

/* ========================= MOCK FEED (simulation) ========================= */
const MockFeed = {
  started:false,
  start(){
    if(this.started) return; this.started = true;
    const tick = () => { this.tick(); setTimeout(tick, rand(SETTINGS.sim.minMs, SETTINGS.sim.maxMs)); };
    const chat = () => { this.chatter(); setTimeout(chat, rand(SETTINGS.sim.chatterMinMs, SETTINGS.sim.chatterMaxMs)); };
    setTimeout(tick, rand(6000,10000)); setTimeout(chat, 2500);
  },
  tick(){
    if(LiveFeed.on) return;
    const w = [], tm = nowMs();
    STATE.bots.forEach(b=>{ if(b.follow) return; if(b.status==='working') w.push([b,3]); else if(b.status==='idle') w.push([b,1.3]); else if(b.status==='error' && tm-b.since>22000) w.push([b,2.5]); });
    if(!w.length) return; let r = Math.random()*w.reduce((a,x)=>a+x[1],0), b = w[0][0]; for(const x of w){ r-=x[1]; if(r<=0){ b=x[0]; break; } }
    if(b.status==='working') progress(b); else if(b.status==='idle') startTask(b, b.taskIdx, 'woke up'); else if(b.status==='error') recoverError(b);
  },
  chatter(){
    if(LiveFeed.on) return;
    const ws = STATE.bots.filter(b=>b.status==='working'); if(!ws.length) return; const b = pick(ws), c = b.task().chatter;
    log(b, c && c.length ? pick(c) : b.task().steps[b.step-1]);
  }
};
