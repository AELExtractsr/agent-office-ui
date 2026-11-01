<!--OFFICE_CONFIG-->
<script>
"use strict";
/* ==========================================================================
   AGENT OFFICE — single-file page (built from office/src/*)
   Runtime config is injected by the server as window.OFFICE_CONFIG:
     { title, apiBase, sign?:{left,right,leftColor?,rightColor?,mark?}|false, roster:[{ id, name, short?, role?, color, shape, aliases?, primary?, desk?, idleNote?, tasks? }] }
   ========================================================================== */
const OFFICE_CONFIG = Object.assign({ title:'Agent Office', apiBase:'/api/office', roster:null }, window.OFFICE_CONFIG || {});
const API = OFFICE_CONFIG.apiBase.replace(/\/+$/,'');

/* ========================= 1) SETTINGS (theme) ============================ */
const SETTINGS = {
  theme: {
    status: { working:'#3ddc84', needs:'#ff9d2e', idle:'#a78bfa', error:'#ff4d5e' },
    eyes:   { working:'#9ff3ff', needs:'#ffd08a', idle:'#b8a3ff', error:'#ff6b78' },
    neonTeal:'#19f0d8', neonMagenta:'#ff3fb4',
    bottleA:'#2fbf71', bottleB:'#e39a2d',        // decorative bottle colours
    floor:'#b6b1a6', wallA:'#2c4750', wallB:'#33505a',
    accentGradient:['#ffd23f','#ff9a3c','#ff4f9a']
  },
  sim: { minMs:10000, maxMs:20000, chatterMinMs:3200, chatterMaxMs:6200, maxNeeds:3 },
  camera: { focusZoom:1.5, parallax:1 },
  startMode:'now'          // 'now' | 'day' | 'evening' | 'night'
};

/* ============================ 2) BOTS (from roster) ======================== */
/* Roster entries come from the OS agent list or roster.json (see CLAUDE.md). Only id/name/color/shape are needed.
   9 desks (3×3). Bots beyond 9 share a desk (two seats). tasks[] are only used by the Demo simulation. */
const SHAPES = ['circle','square','rounded','hexagon','triangle','diamond','star','pill'];
const DEFAULT_ROSTER = [
  { id:'assistant', name:'Assistant', role:'Primary assistant', color:'#4c8dff', shape:'circle', primary:true },
  { id:'researcher', name:'Researcher', role:'Web research', color:'#ff8a3d', shape:'hexagon' },
  { id:'writer', name:'Writer', role:'Drafts & copy', color:'#38d27a', shape:'rounded' },
  { id:'analyst', name:'Analyst', role:'Data & reports', color:'#8e5cff', shape:'diamond' },
  { id:'social', name:'Social Manager', short:'Social', role:'Posting & engagement', color:'#19d3c5', shape:'triangle' },
  { id:'inbox', name:'Inbox Triage', short:'Inbox', role:'Email triage', color:'#ffc93c', shape:'square' }
];
const DEMO_TASKS = [
  { name:'Daily briefing', steps:['Collecting updates','Summarizing','Drafting briefing','Sending briefing'], chatter:['fetched 12 items','summary: 180 words','draft ready'] },
  { name:'Research request', steps:['Searching sources','Reading results','Comparing findings','Writing summary'], chatter:['search → 24 results','read 6 pages','3 key findings'],
    needs:{ atStep:4, title:'Review summary', detail:'Summary is ready for your review before it is shared.', bubble:'Review the summary?', approveLog:'summary shared', declineLog:'summary held for edits', ok:'Approved ✓ sharing…', no:'Okay — revising…', altStep:'Revising summary' } },
  { name:'Routine check', steps:['Loading checklist','Running checks','Logging results','Reporting'], chatter:['check 1/5 ok','check 3/5 ok'] }
];
const safeId = s => String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40) || 'bot';
const BOTS = (Array.isArray(OFFICE_CONFIG.roster) && OFFICE_CONFIG.roster.length ? OFFICE_CONFIG.roster : DEFAULT_ROSTER).slice(0,18).map((r,i)=>{
  const id = safeId(r.id || r.name) + (i ? '' : '');
  return { id, name:String(r.name||id), short:r.short, role:r.role||'Agent', color:/^#[0-9a-f]{6}$/i.test(r.color||'')?r.color:'#4c8dff',
    shape:SHAPES.includes(r.shape)?r.shape:'circle', aliases:r.aliases||[], primary:!!r.primary, desk:Number.isInteger(r.desk)?r.desk:null,
    start:{ status:i%3===2?'idle':'working', task:0, step:1+(i%3) }, idleNote:r.idleNote||'Waiting for the next task',
    tasks:Array.isArray(r.tasks)&&r.tasks.length ? r.tasks : DEMO_TASKS };
});
(function assignDesks(){ // 9 desks; 10+ bots double up (seat .85 / 1.95)
  const used = {}; BOTS.forEach(b=>{ if(b.desk!=null && b.desk>=0 && b.desk<9) used[b.desk]=(used[b.desk]||0)+1; else b.desk=null; });
  BOTS.forEach(b=>{ if(b.desk!=null) return; let d=[...Array(9).keys()].find(k=>!used[k]); if(d==null) d=[...Array(9).keys()].find(k=>used[k]<2); if(d==null) d=8; b.desk=d; used[d]=(used[d]||0)+1; });
  for(let d=0; d<9; d++){ const at = BOTS.filter(b=>b.desk===d); if(at.length>1){ at[0].seat=.85; at[1].seat=1.95; at[1].sleepX=2.45; } }
})();
if(!BOTS.some(b=>b.primary) && BOTS[0]) BOTS[0].primary = true;
/* ============ 3) FEED HOOK ============
   LiveFeed (05_runtime.js) polls API+"/status" every 5s and calls Office.applyUpdate; MockFeed is only the Demo fallback.
   Anything that can call Office.applyUpdate({id, status, task, step, ...}) and Office.log(id, text)
   can drive the office (websocket, polling, SSE…). `MockFeed` below is the demo simulation. */
