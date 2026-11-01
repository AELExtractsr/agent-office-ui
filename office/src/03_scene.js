
/* ============================== GEOMETRY ================================== */
const S = 33, ZS = 35;                       // px per world unit (horizontal half-width) / vertical unit
const W = 18.6, D = 12.6, WH = 3.7;          // floor width (x), depth (y), wall height (z)
const OX = Math.round(D*S + 70), OY = Math.round(WH*ZS + 50);
const SCENE_W = Math.round((W+D)*S + 140), SCENE_H = Math.round(OY + (W+D)*S/2 + .5*ZS + 60);
const P = (x,y,z=0) => [OX + (x-y)*S, OY + (x+y)*S/2 - z*ZS];
const pp = p => p[0].toFixed(1)+','+p[1].toFixed(1);
const pts = (...a) => a.map(pp).join(' ');
const mY  = (x,y,z) => { const p=P(x,y,z); return `matrix(${S} ${S/2} 0 ${-ZS} ${p[0].toFixed(2)} ${p[1].toFixed(2)})`; };  // plane y=c, u→+x, v up
const mYt = (x,y,z) => { const p=P(x,y,z); return `matrix(${S} ${S/2} 0 ${ZS} ${p[0].toFixed(2)} ${p[1].toFixed(2)})`; };   // v down (text)
const mX  = (x,y,z) => { const p=P(x,y,z); return `matrix(${-S} ${S/2} 0 ${-ZS} ${p[0].toFixed(2)} ${p[1].toFixed(2)})`; }; // plane x=c, u→+y, v up
const mXr = (x,y,z) => { const p=P(x,y,z); return `matrix(${S} ${-S/2} 0 ${ZS} ${p[0].toFixed(2)} ${p[1].toFixed(2)})`; };  // plane x=c, u→-y (reads left→right), v down
const mXt = (x,y,z) => { const p=P(x,y,z); return `matrix(${-S} ${S/2} 0 ${ZS} ${p[0].toFixed(2)} ${p[1].toFixed(2)})`; };
const mT  = (x,y,z) => { const p=P(x,y,z); return `matrix(${S} ${S/2} ${-S} ${S/2} ${p[0].toFixed(2)} ${p[1].toFixed(2)})`; };   // top plane: u→x, v→y
const mul32 = a => () => { a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const lerp = (a,b,t) => a+(b-a)*t;

/* colour helpers */
const hex = h => { h=h.replace('#',''); return [0,2,4].map(i=>parseInt(h.substr(i,2),16)); };
const rgbs = c => `rgb(${c.map(v=>clamp(Math.round(v),0,255)).join(',')})`;
const mixc = (a,b,t) => a.map((v,i)=>v+(b[i]-v)*t);
const lighten = (h,t) => rgbs(mixc(hex(h),[255,255,255],t));
const darken  = (h,t) => rgbs(mixc(hex(h),[8,6,24],t));
const alpha = (h,a) => { const c=hex(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
const tone = base => { const c = hex(base);
  return { t: rgbs(mixc(c,[255,250,240],.07)), l: rgbs(mixc(c.map(v=>v*.80),[24,34,80],.10)), r: rgbs(mixc(c.map(v=>v*.58),[22,26,76],.18)) }; };

/* dynamic gradients */
const defsEl = document.getElementById('defs'); let gN = 0; const gCache = {};
function rgrad(color, op=1, kind='soft'){
  const k = color+'|'+op+'|'+kind; if(gCache[k]) return gCache[k];
  const id = 'dg'+(gN++);
  const st = kind==='soft' ? `<stop offset="0" stop-color="${color}" stop-opacity="${op}"/><stop offset=".35" stop-color="${color}" stop-opacity="${op*.55}"/><stop offset=".7" stop-color="${color}" stop-opacity="${op*.14}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/>`
    : `<stop offset="0" stop-color="${color}" stop-opacity="${op}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/>`;
  defsEl.insertAdjacentHTML('beforeend', `<radialGradient id="${id}" cx=".5" cy=".5" r=".5">${st}</radialGradient>`);
  return gCache[k] = `url(#${id})`;
}
const lgrad = (c1,c2,vert=true) => { const id='dg'+(gN++); defsEl.insertAdjacentHTML('beforeend', `<linearGradient id="${id}" x1="0" y1="0" x2="${vert?0:1}" y2="${vert?1:0}"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`); return `url(#${id})`; };

/* =========================== scene registries ============================== */
const SH_CAST = [], SH_CONTACT = [], ITEMS = [], GLOW = { day:[], neon:[], lamps:[], screens:[] };
let itemSeq = 0;
function addItem(box, svg, tag){ ITEMS.push({ id:'it'+(itemSeq++), x0:box[0], y0:box[1], x1:box[2], y1:box[3], svg, tag, bot:false }); }

function box(o){
  const x=o.x, y=o.y, w=o.w, d=o.d, h=o.h, z=o.z||0, t=o.tn||tone(o.c);
  const T = pts(P(x,y,z+h),P(x+w,y,z+h),P(x+w,y+d,z+h),P(x,y+d,z+h));
  const L = pts(P(x,y+d,z+h),P(x+w,y+d,z+h),P(x+w,y+d,z),P(x,y+d,z));
  const R = pts(P(x+w,y,z+h),P(x+w,y+d,z+h),P(x+w,y+d,z),P(x+w,y,z));
  let s = `<polygon points="${L}" fill="${t.l}"/>`;
  if(h>.28 && !o.noAO) s += `<polygon points="${L}" fill="url(#gShadeVL)"/>`;
  s += `<polygon points="${R}" fill="${t.r}"/>`;
  if(h>.28 && !o.noAO) s += `<polygon points="${R}" fill="url(#gShadeV)"/>`;
  s += `<polygon points="${T}" fill="${o.topFill||t.t}"/>`;
  if(!o.noSheen) s += `<polygon points="${T}" fill="url(#gSheen)"/>`;
  if(!o.noEdge){
    s += `<path d="M${pp(P(x,y+d,z+h))} L${pp(P(x+w,y+d,z+h))} L${pp(P(x+w,y,z+h))}" fill="none" stroke="rgba(255,255,255,.30)" stroke-width="1" stroke-linejoin="round"/>`;
    if(h>.2) s += `<path d="M${pp(P(x+w,y+d,z+h))} L${pp(P(x+w,y+d,z))}" stroke="rgba(255,255,255,.14)" stroke-width="1" fill="none"/>`;
  }
  return s;
}
function shadowBox(x,y,w,d,h,k=.5){
  const len = Math.min(h*k, 3.2);
  SH_CAST.push(`<polygon points="${pts(P(x,y),P(x+w+len,y+len*.12),P(x+w+len,y+d+len*.22),P(x,y+d))}"/>`);
  SH_CONTACT.push(`<polygon points="${pts(P(x-.07,y-.07),P(x+w+.12,y-.07),P(x+w+.12,y+d+.1),P(x-.07,y+d+.1))}"/>`);
}
function shadowDisc(x,y,r,h,k=.5){
  const c=P(x+h*k*.5,y+h*k*.1), len=h*k;
  SH_CAST.push(`<ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${(r*S*1.41+len*S*.5).toFixed(1)}" ry="${(r*S*.72+len*S*.22).toFixed(1)}"/>`);
  const c2=P(x,y); SH_CONTACT.push(`<ellipse cx="${c2[0].toFixed(1)}" cy="${(c2[1]+1).toFixed(1)}" rx="${(r*S*1.5).toFixed(1)}" ry="${(r*S*.76).toFixed(1)}"/>`);
}
function ellipseAt(x,y,z,r,fill,extra=''){ const p=P(x,y,z); return `<ellipse cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" rx="${(r*S*1.41).toFixed(1)}" ry="${(r*S*.705).toFixed(1)}" fill="${fill}" ${extra}/>`; }

/* ------------------------------ small props ------------------------------ */
function bottle(x,y,z,color,sc=1){
  const p = P(x,y,z), kind = color, c = kind, lt = lighten(c,.45), dk = darken(c,.5);
  const g = lgrad(lt,c,false);
  return `<g transform="translate(${p[0].toFixed(1)} ${p[1].toFixed(1)}) scale(${sc})">
    <ellipse cx="0" cy="0" rx="6.4" ry="2.7" fill="${dk}"/>
    <path d="M-6.4,0 L-6.4,-23 Q-6.4,-25 -4.6,-26 L-2.6,-28 L2.6,-28 L4.6,-26 Q6.4,-25 6.4,-23 L6.4,0 A6.4,2.7 0 0 1 -6.4,0 Z" fill="${c}"/>
    <path d="M-6.4,0 L-6.4,-23 Q-6.4,-25 -4.6,-26 L-2.6,-28 L2.6,-28 L4.6,-26 Q6.4,-25 6.4,-23 L6.4,0 A6.4,2.7 0 0 1 -6.4,0 Z" fill="url(#gCyl)"/>
    <ellipse cx="0" cy="-23" rx="6.4" ry="2.5" fill="${lt}" opacity=".35"/>
    <rect x="-6.4" y="-19" width="12.8" height="11" fill="#f4efe3"/><rect x="-6.4" y="-19" width="12.8" height="11" fill="url(#gCyl)" opacity=".8"/>
    <rect x="-6.4" y="-19" width="12.8" height="2.6" fill="${dk}"/><rect x="-3.6" y="-14" width="7.2" height="1.5" rx=".7" fill="${c}"/><rect x="-4.6" y="-11.5" width="9.2" height="1.1" rx=".5" fill="#9a958a"/>
    <rect x="-3" y="-31" width="6" height="3.6" rx="1" fill="#f1f1f1"/><rect x="-3" y="-31" width="6" height="3.6" rx="1" fill="url(#gCyl)"/>
    <rect x="-1.6" y="-36" width="3.2" height="5.4" rx="1" fill="#e9e9e9"/><rect x="-2.6" y="-38" width="9" height="3" rx="1.4" fill="#d7d7d7"/><rect x="3.8" y="-37.4" width="2.8" height="4.4" rx="1" fill="#cfcfcf"/>
  </g>`;
}
function mug(x,y,z,color){ const p=P(x,y,z);
  return `<g transform="translate(${pp(p)})"><ellipse rx="4.4" ry="2" fill="${darken(color,.4)}"/><path d="M-4.4,0 L-4.4,-7 A4.4,2 0 0 1 4.4,-7 L4.4,0 A4.4,2 0 0 1 -4.4,0Z" fill="${color}"/><path d="M-4.4,0 L-4.4,-7 A4.4,2 0 0 1 4.4,-7 L4.4,0 A4.4,2 0 0 1 -4.4,0Z" fill="url(#gCyl)"/><ellipse cy="-7" rx="4.4" ry="2" fill="#2a1a12"/><path d="M4.4,-5 q4,0 4,3 t-4,3" stroke="${color}" stroke-width="1.4" fill="none"/></g>`; }

let cpN=0;
function erlenmeyer(x,y,z,col,sc=1.2){ const p=P(x,y,z);
  return `<g transform="translate(${pp(p)}) scale(${sc})">
   <ellipse rx="9.5" ry="3.2" fill="rgba(0,0,0,.25)"/>
   <path d="M-9,0 L-3.6,-18 L-3.6,-25 L3.6,-25 L3.6,-18 L9,0 Z" fill="rgba(210,245,255,.22)" stroke="rgba(235,255,255,.65)" stroke-width=".9"/>
   <path d="M-8.2,-1 L-5.6,-9.5 L5.6,-9.5 L8.2,-1 Z" fill="${col}" opacity=".92"/>
   <ellipse cy="-9.5" rx="5.6" ry="1.4" fill="${lighten(col,.5)}" opacity=".8"/>
   <path d="M-6.8,-3 L-4.6,-14" stroke="#fff" stroke-opacity=".5" stroke-width="1.4" stroke-linecap="round"/>
   <rect x="-4.6" y="-28.5" width="9.2" height="4.6" rx="1.4" fill="#b8844e"/>
   <g class="bubbles" fill="#eafff6"><circle cx="-2" cy="-6" r="1.3"/><circle cx="2.2" cy="-7" r="1.1"/><circle cx="0" cy="-5" r="1.5"/><circle cx="3.4" cy="-4" r="1"/></g></g>`; }
function roundFlask(x,y,z,col,sc=1.15){ const p=P(x,y,z); const id='cp'+(cpN++);
  return `<g transform="translate(${pp(p)}) scale(${sc})"><clipPath id="${id}"><rect x="-14" y="-14" width="28" height="20"/></clipPath>
   <ellipse rx="10" ry="3.4" fill="rgba(0,0,0,.25)"/>
   <rect x="-3.4" y="-38" width="6.8" height="16" rx="1.5" fill="rgba(210,245,255,.22)" stroke="rgba(235,255,255,.65)" stroke-width=".9"/>
   <circle cy="-13" r="11" fill="rgba(210,245,255,.22)" stroke="rgba(235,255,255,.65)" stroke-width=".9"/>
   <circle cy="-13" r="10" fill="${col}" clip-path="url(#${id})" opacity=".92"/>
   <ellipse cy="-14" rx="9.7" ry="2" fill="${lighten(col,.5)}" opacity=".7" clip-path="url(#${id})"/>
   <path d="M-7,-9 Q-8,-14 -4,-18" stroke="#fff" stroke-opacity=".5" stroke-width="1.5" fill="none" stroke-linecap="round"/>
   <rect x="-4.4" y="-41.5" width="8.8" height="4.4" rx="1.4" fill="#b8844e"/>
   <g class="bubbles" fill="#eafff6"><circle cx="-3" cy="-7" r="1.4"/><circle cx="2" cy="-9" r="1.2"/><circle cx="0" cy="-6" r="1.6"/><circle cx="4" cy="-6" r="1"/></g></g>`; }
function glassColumn(x,y,z,col,sc=1.1){ const p=P(x,y,z);
  return `<g transform="translate(${pp(p)}) scale(${sc})"><ellipse rx="8" ry="2.8" fill="rgba(0,0,0,.25)"/>
   <rect x="-5.5" y="-40" width="11" height="40" rx="3" fill="rgba(210,245,255,.20)" stroke="rgba(235,255,255,.65)" stroke-width=".9"/>
   <rect x="-4.6" y="-22" width="9.2" height="21" rx="2.4" fill="${col}" opacity=".9"/><ellipse cy="-22" rx="4.6" ry="1.2" fill="${lighten(col,.5)}" opacity=".85"/>
   <path d="M-3,-3 L-3,-35" stroke="#fff" stroke-opacity=".5" stroke-width="1.4" stroke-linecap="round"/>
   <g class="bubbles" fill="#fff0fb"><circle cx="-1.5" cy="-8" r="1.2"/><circle cx="1.6" cy="-12" r="1"/><circle cx="0" cy="-5" r="1.4"/><circle cx="2.4" cy="-16" r=".9"/></g>
   <rect x="-4" y="-44" width="8" height="4.4" rx="1.4" fill="#2a2f38"/></g>`; }
function testTube(x,y,z,col,sc=1){ const p=P(x,y,z);
  return `<g transform="translate(${pp(p)}) scale(${sc})"><rect x="-2.6" y="-17" width="5.2" height="17" rx="2.6" fill="rgba(210,245,255,.25)" stroke="rgba(235,255,255,.6)" stroke-width=".7"/><rect x="-1.9" y="-10" width="3.8" height="9.6" rx="1.9" fill="${col}"/></g>`; }

/* ------------------------------- plants ---------------------------------- */
function plant(x,y,kind='fan',sc=1,seed=1,potc='#c46f45'){
  const r = mul32(seed), p = P(x,y,0); let lv = '';
  const potW = 13*sc, potH = 21*sc;
  const gs = ['#2e8f55','#3aa866','#4cbd78','#256f45'];
  if(kind==='snake'){
    for(let i=0;i<9;i++){ const ang=(i-4)*7+(r()-.5)*8, L=(46+r()*34)*sc, wd=(5+r()*2.4)*sc;
      lv += `<g transform="rotate(${ang.toFixed(1)})"><path d="M${-wd},0 C${-wd*1.1},${-L*.4} ${-wd*.6},${-L*.85} 0,${-L} C${wd*.6},${-L*.85} ${wd*1.1},${-L*.4} ${wd},0 Z" fill="${gs[i%4]}"/><path d="M0,0 L0,${-L*.95}" stroke="rgba(255,255,255,.22)" stroke-width="1"/><path d="M${-wd},0 C${-wd*1.1},${-L*.4} ${-wd*.6},${-L*.85} 0,${-L} L0,0Z" fill="rgba(0,0,0,.14)"/><path d="M${-wd*.9},-4 C${-wd*.8},${-L*.5} ${-wd*.4},${-L*.8} 0,${-L*.97}" stroke="#d6e86a" stroke-width="1.1" fill="none" opacity=".6"/></g>`; }
  } else if(kind==='bush'){
    for(let i=0;i<12;i++){ const ang=-80+i*14.5+(r()-.5)*8, L=(24+r()*16)*sc, wd=(8+r()*3)*sc;
      lv += `<g transform="translate(0 ${-potH*.1}) rotate(${ang.toFixed(1)})"><path d="M0,0 C${-wd},${-L*.35} ${-wd*.8},${-L*.8} 0,${-L} C${wd*.8},${-L*.8} ${wd},${-L*.35} 0,0Z" fill="${gs[i%4]}"/><path d="M0,0 L0,${-L*.9}" stroke="rgba(255,255,255,.25)" stroke-width=".9"/><path d="M0,0 C${-wd},${-L*.35} ${-wd*.8},${-L*.8} 0,${-L} Z" fill="rgba(0,0,0,.14)"/></g>`; }
  } else { // fan (broad leaves)
    for(let i=0;i<8;i++){ const ang=-68+i*19+(r()-.5)*10, L=(36+r()*20)*sc, wd=(14+r()*4)*sc;
      lv += `<g transform="rotate(${ang.toFixed(1)})"><path d="M0,0 C${-wd},${-L*.25} ${-wd*1.05},${-L*.75} 0,${-L} C${wd*1.05},${-L*.75} ${wd},${-L*.25} 0,0Z" fill="${gs[i%4]}"/><path d="M0,0 C${-wd},${-L*.25} ${-wd*1.05},${-L*.75} 0,${-L} L0,0Z" fill="rgba(0,0,0,.15)"/><path d="M0,0 L0,${-L*.92}" stroke="rgba(255,255,255,.3)" stroke-width="1"/></g>`; }
  }
  shadowDisc(x,y,.34*sc,1.6*sc,.3);
  return `<g transform="translate(${pp(p)})">
    <g class="leafs ${seed%2?'':'b'}" transform="translate(0 ${-potH+3})"><g>${lv}</g></g>
    <path d="M${-potW},${-potH} L${-potW*.72},0 A${potW*.72},${potW*.34} 0 0 0 ${potW*.72},0 L${potW},${-potH} Z" fill="${potc}"/>
    <path d="M${-potW},${-potH} L${-potW*.72},0 A${potW*.72},${potW*.34} 0 0 0 ${potW*.72},0 L${potW},${-potH} Z" fill="url(#gCyl)"/>
    <ellipse cy="${-potH}" rx="${potW}" ry="${potW*.45}" fill="${lighten(potc,.18)}"/><ellipse cy="${-potH+.6}" rx="${potW*.84}" ry="${potW*.34}" fill="#2a1d16"/></g>`;
}

/* ------------------------------- lamp ------------------------------------ */
function lamp(x,y,h=2.35){
  const b=P(x,y,0), t=P(x,y,h); shadowDisc(x,y,.25,h*.5,.25);
  const top=t[1]-17;
  // lighting (glow layer)
  const pool = rgrad('#ffc27a',.55), bloom = rgrad('#ffd9a0',.9);
  GLOW.lamps.push(`<polygon points="${t[0]-14},${t[1]} ${t[0]+14},${t[1]} ${b[0]+78},${b[1]+8} ${b[0]-78},${b[1]+8}" fill="url(#gCone)"/>
    <ellipse cx="${b[0]}" cy="${b[1]+4}" rx="130" ry="64" fill="${pool}"/>
    <circle cx="${t[0]}" cy="${t[1]-6}" r="46" fill="${bloom}"/>`);
  return `<g>
    <ellipse cx="${b[0]}" cy="${b[1]}" rx="14" ry="6.6" fill="#242830"/><ellipse cx="${b[0]}" cy="${b[1]-2}" rx="14" ry="6.6" fill="#3b414c"/><ellipse cx="${b[0]}" cy="${b[1]-3}" rx="10" ry="4.6" fill="#4a5160"/>
    <rect x="${b[0]-1.7}" y="${t[1]}" width="3.4" height="${(b[1]-t[1]-3).toFixed(1)}" fill="#2b3038"/><rect x="${b[0]-.4}" y="${t[1]}" width="1.1" height="${(b[1]-t[1]-3).toFixed(1)}" fill="rgba(255,255,255,.25)"/>
    <path d="M${t[0]-9},${top} L${t[0]+9},${top} L${t[0]+16},${t[1]} L${t[0]-16},${t[1]} Z" fill="#f2e4c6"/>
    <path d="M${t[0]+3},${top} L${t[0]+9},${top} L${t[0]+16},${t[1]} L${t[0]+6},${t[1]} Z" fill="rgba(120,80,30,.28)"/>
    <ellipse cx="${t[0]}" cy="${top}" rx="9" ry="3" fill="#e4d2ac"/>
    <ellipse cx="${t[0]}" cy="${t[1]}" rx="16" ry="5.2" fill="#8a6a3c"/><ellipse class="bulb" cx="${t[0]}" cy="${t[1]+.4}" rx="13.5" ry="4.2" fill="#ffe2a8"/>
    <path d="M${t[0]-9},${top} L${t[0]-16},${t[1]}" stroke="rgba(255,255,255,.55)" stroke-width="1"/></g>`;
}

/* --------------------------- chairs & desks ------------------------------- */
function chair(cx,cy,accent){
  shadowDisc(cx,cy,.45,.9,.35);
  const b=P(cx,cy,.1); let s='';
  s += `<ellipse cx="${b[0]}" cy="${b[1]+1}" rx="17" ry="7.6" fill="#1b1e24"/>`;
  for(let i=0;i<5;i++){ const a=i*Math.PI*2/5+.3; s += `<circle cx="${(b[0]+Math.cos(a)*15).toFixed(1)}" cy="${(b[1]+3+Math.sin(a)*6.6).toFixed(1)}" r="2.1" fill="#0f1115"/>`; }
  s += `<rect x="${b[0]-2}" y="${P(cx,cy,.48)[1]}" width="4" height="${(b[1]-P(cx,cy,.48)[1]).toFixed(1)}" fill="#22262d"/>`;
  s += box({x:cx-.42,y:cy-.7,w:.84,d:.12,z:.62,h:.82,c:'#3a4351',noAO:false});
  s += box({x:cx-.42,y:cy-.7,w:.84,d:.12,z:1.38,h:.08,c:accent,noSheen:true});
  s += box({x:cx-.44,y:cy-.42,w:.88,d:.86,z:.44,h:.16,c:'#4b5566'});
  return s;
}
const SCR_COLORS = ['#59f0ff','#8affc8','#ffb6ec','#ffe58a','#a9c7ff'];
function screenFace(x,y,z,w,h,seed,small=false){
  const r = mul32(seed); let on='', err='';
  const lh = small ? .06 : .075, th = small ? .028 : .035;
  for(let i=0;;i++){ const yy=h-.1-i*lh; if(yy<.06) break; let xx=.07+(r()<.3?.1:0), n=1+Math.floor(r()*3);
    for(let k=0;k<n;k++){ const ww=.07+r()*(w*.28); if(xx+ww>w-.06) break; on+=`<rect class="ln" x="${xx.toFixed(3)}" y="${yy.toFixed(3)}" width="${ww.toFixed(3)}" height="${th}" rx=".012" fill="${SCR_COLORS[Math.floor(r()*5)]}"/>`; xx+=ww+.045; } }
  if(!small){ for(let i=0;i<5;i++){ const bh=.06+r()*.2; on+=`<rect x="${(w-.38+i*.065).toFixed(3)}" y=".07" width=".045" height="${bh.toFixed(3)}" fill="#7fffd0" opacity=".85"/>`; } }
  for(let i=0;i<(small?3:5);i++){ const yy=h-.1-i*lh-(small?0:.1); err+=`<rect x=".07" y="${yy.toFixed(3)}" width="${(.1+r()*w*.4).toFixed(3)}" height="${th}" rx=".012" fill="#ff7a86" opacity=".85"/>`; }
  err += `<g class="blink"><rect x="${(w*.5-.12).toFixed(3)}" y="${(h*.3).toFixed(3)}" width=".24" height=".2" rx=".03" fill="#ff4d5e"/><rect x="${(w*.5-.012).toFixed(3)}" y="${(h*.3+.07).toFixed(3)}" width=".024" height=".08" fill="#fff"/><rect x="${(w*.5-.012).toFixed(3)}" y="${(h*.3+.035).toFixed(3)}" width=".024" height=".02" fill="#fff"/></g>`;
  return `<g transform="${mY(x,y,z)}"><rect width="${w}" height="${h}" fill="#070b10"/><g class="scr-on"><rect width="${w}" height="${h}" fill="url(#gScr)"/>${on}</g><g class="scr-err"><rect width="${w}" height="${h}" fill="url(#gScrE)"/>${err}</g><rect width="${w}" height="${h}" fill="url(#gGlass)" opacity=".55"/></g>`;
}
const DESK_COLS=[1.5,5.1,8.7], DESK_ROWS=[2.2,5.7,9.2];
const DESKS = [];
for(let r=0;r<3;r++) for(let c=0;c<3;c++){ const dx=DESK_COLS[c], dy=DESK_ROWS[r];
  DESKS.push({ idx:r*3+c, x:dx, y:dy, w:3.2, d:1.3, spot:{x:dx+1.3,y:dy+2.0,z:.6,kind:'desk',lane:dy+2.78,row:r}, sleep:{x:dx+2.75,y:dy+2.15,z:.04,kind:'desk',lane:dy+2.78,row:r}, owner:null }); }
BOTS.forEach(b => { if(b.desk==null){ const f = DESKS.find(d=>!BOTS.some(o=>o.desk===d.idx)); b.desk = f ? f.idx : 0; } });
BOTS.forEach(b => { const d = DESKS[b.desk]; if(!d.owner) d.owner = b.id; });

function buildDesk(d){
  const bot = BOTS.find(b=>b.id===d.owner), accent = bot ? bot.color : '#6b7686';
  const dx=d.x, dy=d.y; let s='';
  shadowBox(dx,dy,3.2,1.3,.95,.42);
  s += box({x:dx+.14,y:dy+.12,w:2.92,d:.06,z:.16,h:.56,c:'#262b33',noEdge:true});
  s += box({x:dx+.05,y:dy+.06,w:.12,d:1.18,z:0,h:.72,c:'#3a414d'});
  s += box({x:dx+3.03,y:dy+.06,w:.12,d:1.18,z:0,h:.72,c:'#3a414d'});
  s += box({x:dx,y:dy,w:3.2,d:1.3,z:.72,h:.11,c:'#dcc7a4'});
  // accent plaque on front lip
  s += `<polygon points="${pts(P(dx+1.2,dy+1.3,.74),P(dx+2.0,dy+1.3,.74),P(dx+2.0,dy+1.3,.8),P(dx+1.2,dy+1.3,.8))}" fill="${accent}" opacity=".9"/>`;
  const z0=.83;
  // monitors
  for(let m=0;m<2;m++){ const mx=dx+.16+m*1.12;
    s += box({x:mx+.4,y:dy+.34,w:.22,d:.12,z:z0,h:.24,c:'#23272e',noAO:true,noEdge:true});
    s += box({x:mx+.24,y:dy+.28,w:.54,d:.26,z:z0,h:.035,c:'#2a2f37',noAO:true,noEdge:true});
    s += box({x:mx,y:dy+.3,w:1.02,d:.07,z:z0+.22,h:.66,c:'#1b1e24',noAO:true});
    s += screenFace(mx+.045,dy+.37,z0+.265,.93,.57,d.idx*11+m*5+3);
  }
  // keyboard / mouse / mug
  s += box({x:dx+.7,y:dy+.84,w:1.1,d:.3,z:z0,h:.03,c:'#2d323a',noAO:true});
  s += box({x:dx+1.95,y:dy+.92,w:.14,d:.2,z:z0,h:.04,c:'#2d323a',noAO:true,noEdge:true});
  // laptop
  s += box({x:dx+2.3,y:dy+.58,w:.72,d:.5,z:z0,h:.045,c:'#aab1bd'});
  s += box({x:dx+2.3,y:dy+.55,w:.72,d:.045,z:z0+.04,h:.46,c:'#9aa2af',noAO:true});
  s += screenFace(dx+2.34,dy+.595,z0+.08,.64,.38,d.idx*7+2,true);
  s += mug(dx+.4,dy+1.0,z0,accent);
  if(!bot){ // FREE sticky tag
    s += `<g transform="${mT(dx+1.05,dy+.72,z0+.002)}"><rect width="1.1" height=".5" rx=".04" fill="#7dffb1"/><rect width="1.1" height=".5" rx=".04" fill="url(#gSheen)"/><text x=".55" y=".34" font-size=".28" font-weight="800" text-anchor="middle" fill="#0b3a22" font-family="Arial,Helvetica,sans-serif" letter-spacing=".04">FREE</text></g>`;
  }
  // glows
  const m1=P(dx+.67,dy+.4,1.45), m2=P(dx+1.79,dy+.4,1.45);
  const cy = rgrad('#4cf0ff',.85), rd = rgrad('#ff4d5e',.85), fl=P(dx+1.6,dy+1.9,0), tp=P(dx+1.6,dy+1.0,.84);
  const mk = (col,grad) => `<g class="gs-${col}" data-d="${d.idx}" style="opacity:0;transition:opacity .9s ease">
     <ellipse cx="${m1[0]}" cy="${m1[1]}" rx="52" ry="46" fill="${grad}"/><ellipse cx="${m2[0]}" cy="${m2[1]}" rx="52" ry="46" fill="${grad}"/>
     <ellipse cx="${tp[0]}" cy="${tp[1]}" rx="92" ry="34" fill="${grad}" opacity=".7"/><ellipse cx="${fl[0]}" cy="${fl[1]}" rx="108" ry="52" fill="${grad}" opacity=".62"/></g>`;
  GLOW.screens.push(mk('on',cy)+mk('err',rd));
  addItem([dx,dy,dx+3.2,dy+1.3], `<g class="desk" data-s="off" data-d="${d.idx}">${s}</g>`, 'desk');
  const seated = BOTS.filter(b=>b.desk===d.idx && b.seat!=null);
  if(seated.length) seated.forEach(b=>{ const cx=d.x+b.seat, cy=d.spot.y; addItem([cx-.42,cy-.72,cx+.42,cy+.44], chair(cx,cy,b.color), 'chair'); });
  else addItem([d.spot.x-.42,d.spot.y-.72,d.spot.x+.42,d.spot.y+.44], chair(d.spot.x,d.spot.y,accent), 'chair');
}

/* ---------------------------- big furniture ------------------------------- */
function buildBookshelf(){
  const x=14.1, y=.08, w=2.45, d=.78, h=2.75; let s=''; const r=mul32(77);
  shadowBox(x,y,w,d,h,.4);
  s += box({x,y,w,d,h,c:'#5a4436'});
  const f=y+d+.002; s += `<g transform="${mY(x+.12,f,.12)}"><rect width="${w-.24}" height="${h-.24}" fill="#1b1411"/><rect width="${w-.24}" height="${h-.24}" fill="url(#gShadeVL)" opacity=".7"/>`;
  const rows=[.02,.64,1.26,1.88]; const palette=['#d36b52','#3f8f9c','#e0b04a','#6e5aa8','#c9d0d6','#7aa56a','#b8466f','#2c5e74'];
  rows.forEach((v,ri)=>{ let u=.08;
    while(u<w-.5){ const bw=.07+r()*.1, bh=.34+r()*.18; if(ri===3 && u>1.1 && u<2.1){ u+=.95; break; }
      s += `<rect x="${u.toFixed(3)}" y="${(v+.05).toFixed(3)}" width="${bw.toFixed(3)}" height="${bh.toFixed(3)}" fill="${palette[Math.floor(r()*palette.length)]}"/><rect x="${u.toFixed(3)}" y="${(v+.05).toFixed(3)}" width="${bw.toFixed(3)}" height="${bh.toFixed(3)}" fill="url(#gCyl)" opacity=".5"/>`;
      u += bw+.012; if(r()<.12) u+=.2; }
    s += `<rect x="0" y="${v.toFixed(2)}" width="${w-.24}" height=".055" fill="#7d6350"/>`; });
  s += `<rect x="0" y="${(2.5).toFixed(2)}" width="${w-.24}" height=".055" fill="#7d6350"/>`;
  s += `</g>`;
  // little bottles on the upper shelf
  const zz=.12+1.88+.055+.02;
  s += bottle(x+1.25,f+.02,zz,SETTINGS.theme.bottleA,.82) + bottle(x+1.6,f+.02,zz,SETTINGS.theme.bottleB,.82) + bottle(x+1.95,f+.02,zz,SETTINGS.theme.bottleA,.82);
  addItem([x,y,x+w,y+d], s, 'bookshelf');
}
function buildBench(){
  const x=.12, y=.95, w=1.05, d=3.5; let s=''; shadowBox(x,y,w,d,1.8,.35);
  s += box({x:x+.04,y:y+.04,w:w-.08,d:d-.08,z:0,h:1.0,c:'#cfd6dc'});
  // cabinet doors lines (on +x face)
  s += `<g transform="${mX(x+w-.04,y+.04,.08)}">${[0,1,2].map(i=>`<rect x="${(.1+i*1.14).toFixed(2)}" y=".1" width="1.0" height=".74" rx=".03" fill="rgba(0,0,0,.12)" stroke="rgba(0,0,0,.2)" stroke-width=".02"/><rect x="${(.86+i*1.14).toFixed(2)}" y=".52" width=".05" height=".2" rx=".02" fill="#7c8793"/>`).join('')}</g>`;
  s += box({x,y,w,d,z:1.0,h:.07,c:'#1f2d33'});
  const bz=1.08, xc=x+w/2;
  s += box({x:xc-.3,y:y+1.1,w:.6,d:.6,z:bz,h:.06,c:'#2c333b',noAO:true}); // heating mantle
  s += `<ellipse cx="${P(xc,y+1.4,bz+.07)[0]}" cy="${P(xc,y+1.4,bz+.07)[1]}" rx="14" ry="6" fill="#ff7a2a" class="heat" opacity=".9"/>`;
  s += erlenmeyer(xc,y+.5,bz,'#35ffb0');
  s += roundFlask(xc,y+1.4,bz+.06,'#20e6d4');
  s += glassColumn(xc,y+2.35,bz,'#ff3fb4');
  // test tube rack
  s += box({x:xc-.28,y:y+2.9,w:.56,d:.45,z:bz,h:.05,c:'#7a5a3a',noAO:true});
  ['#35ffb0','#ff3fb4','#ffbc4a','#59f0ff'].forEach((c,i)=>{ s += testTube(xc-.15+(i%2)*.3, y+2.98+(i>>1)*.3, bz+.05, c); });
  const g1=P(xc,y+.5,bz+.5), g2=P(xc,y+1.4,bz+.5), g3=P(xc,y+2.35,bz+.6), g4=P(xc,y+1.4,bz);
  GLOW.lamps.push(`<circle cx="${g1[0]}" cy="${g1[1]}" r="34" fill="${rgrad('#35ffb0',.55)}"/><circle cx="${g2[0]}" cy="${g2[1]}" r="38" fill="${rgrad('#20e6d4',.5)}"/><circle cx="${g3[0]}" cy="${g3[1]}" r="32" fill="${rgrad('#ff3fb4',.5)}"/><ellipse cx="${g4[0]}" cy="${g4[1]+4}" rx="40" ry="18" fill="${rgrad('#ff7a2a',.6)}"/>`);
  addItem([x,y,x+w,y+d], s, 'bench');
}
function buildBottleShelves(){
  let s=''; const th=SETTINGS.theme, xs=.03, y0=1.0, y1=4.5;
  [[2.05,0],[2.8,1]].forEach(([z,row])=>{
    s += box({x:xs,y:y0,w:.5,d:y1-y0,z,h:.06,c:'#5b4635'});
    [y0+.15,y1-.25].forEach(yy=>{ s += box({x:xs,y:yy,w:.04,d:.1,z:z-.2,h:.2,c:'#2a2f37',noAO:true,noEdge:true}); });
    const n=8; for(let i=0;i<n;i++){ const yy=y0+.28+i*((y1-y0-.5)/(n-1)); const c=((i+row)%3===1)? th.bottleB : th.bottleA; s += bottle(xs+.26,yy,z+.06,c,.9); }
  });
  // label plaque
  addItem([xs,y0,xs+.5,y1], s, 'shelves');
}
function buildWhiteboard(){
  const y0=6.3, bw=4.2, z1=1.15, bh=1.75; let s='';
  s += box({x:0,y:y0-.06,w:.07,d:bw+.12,z:z1-.06,h:bh+.12,c:'#9aa4ad',noAO:true});
  s += `<g transform="${mXr(.075,y0+bw,z1+bh)}"><rect width="${bw}" height="${bh}" fill="#eef2f4"/><rect width="${bw}" height="${bh}" fill="url(#gSheen)" opacity=".6"/>
    <text x=".14" y=".28" font-size=".2" font-weight="800" fill="#1f3a44" font-family="Arial,Helvetica,sans-serif" letter-spacing=".05">THIS WEEK</text>
    <rect x=".14" y=".36" width="3.9" height=".02" fill="#c5ced4"/>
    ${[['TO DO','#ff9d2e'],['DOING','#19d3c5'],['DONE','#3ddc84']].map((c,i)=>`<text x="${(.16+i*1.38).toFixed(2)}" y=".6" font-size=".14" font-weight="700" fill="${c[1]}" font-family="Arial,Helvetica,sans-serif">${c[0]}</text>`).join('')}
    ${[0,1,2].map(i=>[0,1,2].slice(0,3-(i===2?1:0)).map(j=>`<rect x="${(.14+i*1.38).toFixed(2)}" y="${(.7+j*.34).toFixed(2)}" width="1.14" height=".28" rx=".03" fill="${['#ffe58a','#ffb6ec','#a9e8ff','#b8ffd0'][(i+j)%4]}"/><rect x="${(.22+i*1.38).toFixed(2)}" y="${(.8+j*.34).toFixed(2)}" width="${(.5+((i*3+j*5)%4)*.12).toFixed(2)}" height=".035" fill="rgba(0,0,0,.35)"/><rect x="${(.22+i*1.38).toFixed(2)}" y="${(.88+j*.34).toFixed(2)}" width=".4" height=".03" fill="rgba(0,0,0,.2)"/>`).join('')).join('')}
    </g>`;
  addItem([0,y0-.06,.1,y0+bw+.06], s, 'whiteboard');
}
function buildWindow(){
  const x0=1.3, w=3.8, z0=1.15, h=2.1; let s=''; const f=-.002;
  s += `<g transform="${mY(x0-.12,0,z0-.12)}"><rect width="${w+.24}" height="${h+.24}" rx=".05" fill="#1b2227"/></g>`;
  s += `<g transform="${mY(x0,0,z0)}"><clipPath id="winclip"><rect width="${w}" height="${h}"/></clipPath><g clip-path="url(#winclip)">
    <rect class="sky-day" width="${w}" height="${h}" fill="url(#gSkyD)"/><rect class="sky-eve" width="${w}" height="${h}" fill="url(#gSkyE)"/><rect class="sky-night" width="${w}" height="${h}" fill="url(#gSkyN)"/>
    <g class="sky-night"><circle cx="3.0" cy="1.55" r=".2" fill="#f4f1d8"/><circle cx="3.08" cy="1.6" r=".17" fill="#1b2564"/>${[[.4,1.7],[1.0,1.4],[1.5,1.8],[2.2,1.35],[.7,1.1],[2.6,.95],[3.3,.7],[1.9,.6]].map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r=".025" fill="#fff"/>`).join('')}</g>
    <g class="sky-day"><ellipse cx=".8" cy="1.5" rx=".5" ry=".14" fill="#fff" opacity=".9"/><ellipse cx="1.1" cy="1.6" rx=".4" ry=".12" fill="#fff" opacity=".9"/><ellipse cx="2.8" cy="1.2" rx=".45" ry=".12" fill="#fff" opacity=".85"/></g>
    <path d="M0,.0 L${w},.0 L${w},.5 L2.8,.34 L1.9,.5 L1.1,.32 L.4,.48 L0,.4Z" fill="#14202b" opacity=".85"/>
    <rect width="${w}" height="${h}" fill="url(#gGlass)"/></g>
    <rect x="${w/2-.03}" width=".06" height="${h}" fill="#1b2227"/><rect y="${h/2-.03}" width="${w}" height=".06" fill="#1b2227"/></g>`;
  s += box({x:x0-.2,y:-.02,w:w+.4,d:.3,z:z0-.14,h:.07,c:'#cfd3d6',noAO:true});
  // daylight shafts onto floor
  const shaft=(cls,grad)=>`<polygon class="${cls}" points="${pts(P(x0+.1,0,0),P(x0+w-.1,0,0),P(x0+w+3.4,6.6,0),P(x0+3.4,6.6,0))}" fill="url(${grad})"/>`;
  GLOW.day.push(shaft('gd-day','#gBeamD')+shaft('gd-eve','#gBeamE')+shaft('gd-night','#gBeamN'));
  addItem([x0-.2,-.1,x0+w+.2,.3], s, 'window');
}
/* sign placement on the back wall (also read by the label layout so bubbles/nameplates keep clear of it) */
const SIGN = { x0:5.2, w:8.0, z1:3.52, h:2.3 };
/* single-stroke neon tube font: unit box (x 0..1, y 0 top .. 1 baseline); NW = relative glyph width */
const NEON_FONT = {
  A:'M0,1 L.5,0 L1,1 M.2,.64 L.8,.64', B:'M0,0 L0,1 L.58,1 C1,1 1,.5 .58,.5 L0,.5 M.58,.5 C.96,.5 .96,0 .55,0 L0,0',
  C:'M1,.14 C.85,0 .65,0 .5,0 C.15,0 0,.2 0,.5 C0,.8 .15,1 .5,1 C.65,1 .85,1 1,.86', D:'M0,0 L.42,0 C.88,0 1,.25 1,.5 C1,.75 .88,1 .42,1 L0,1 Z',
  E:'M1,0 L0,0 L0,1 L1,1 M0,.5 L.76,.5', F:'M1,0 L0,0 L0,1 M0,.5 L.76,.5',
  G:'M1,.14 C.85,0 .65,0 .5,0 C.15,0 0,.2 0,.5 C0,.8 .15,1 .5,1 C.8,1 1,.85 1,.62 L1,.52 L.58,.52', H:'M0,0 L0,1 M1,0 L1,1 M0,.5 L1,.5',
  I:'M.5,0 L.5,1', J:'M1,0 L1,.7 C1,.92 .85,1 .5,1 C.18,1 0,.9 0,.7', K:'M0,0 L0,1 M1,0 L.08,.6 M.36,.42 L1,1', L:'M0,0 L0,1 L1,1',
  M:'M0,1 L0,0 L.5,.62 L1,0 L1,1', N:'M0,1 L0,0 L1,1 L1,0',
  O:'M.3,0 L.7,0 C.92,0 1,.15 1,.35 L1,.65 C1,.85 .92,1 .7,1 L.3,1 C.08,1 0,.85 0,.65 L0,.35 C0,.15 .08,0 .3,0 Z',
  P:'M0,1 L0,0 L.6,0 C.97,0 .97,.52 .6,.52 L0,.52', Q:'M.3,0 L.7,0 C.92,0 1,.15 1,.35 L1,.65 C1,.85 .92,1 .7,1 L.3,1 C.08,1 0,.85 0,.65 L0,.35 C0,.15 .08,0 .3,0 Z M.62,.7 L1,1.04',
  R:'M0,1 L0,0 L.6,0 C.97,0 .97,.52 .6,.52 L0,.52 M.55,.52 L1,1', S:'M1,.1 C.8,0 .25,0 .12,.2 C0,.4 .3,.46 .5,.5 C.78,.56 1,.6 .88,.8 C.76,1 .2,1 0,.9',
  T:'M0,0 L1,0 M.5,0 L.5,1', U:'M0,0 L0,.68 C0,.9 .18,1 .5,1 C.82,1 1,.9 1,.68 L1,0', V:'M0,0 L.5,1 L1,0', W:'M0,0 L.25,1 L.5,.4 L.75,1 L1,0',
  X:'M0,0 L1,1 M1,0 L0,1', Y:'M0,0 L.5,.52 L1,0 M.5,.52 L.5,1', Z:'M0,0 L1,0 L0,1 L1,1',
  0:'M.5,0 C.1,0 0,.3 0,.5 C0,.7 .1,1 .5,1 C.9,1 1,.7 1,.5 C1,.3 .9,0 .5,0 Z', 1:'M.2,.2 L.55,0 L.55,1', 2:'M0,.2 C.1,0 .9,0 .95,.25 C1,.5 .3,.7 0,1 L1,1',
  3:'M0,.08 C.4,-.05 1,0 .95,.27 C.9,.47 .5,.48 .4,.48 C.6,.48 1,.52 1,.75 C1,1 .4,1.04 0,.92', 4:'M.75,1 L.75,0 L0,.7 L1,.7', 5:'M1,0 L.1,0 L0,.45 C.4,.35 1,.4 1,.7 C1,1 .3,1.02 0,.9',
  6:'M.9,.05 C.4,-.05 0,.25 0,.65 C0,.9 .2,1 .5,1 C.85,1 1,.85 1,.68 C1,.45 .75,.38 .5,.38 C.25,.38 .05,.5 0,.62', 7:'M0,0 L1,0 L.35,1',
  8:'M.5,.48 C.1,.48 .05,.3 .1,.18 C.18,0 .82,0 .9,.18 C.95,.3 .9,.48 .5,.48 C.05,.48 0,.68 0,.75 C0,.95 .25,1 .5,1 C.75,1 1,.95 1,.75 C1,.68 .95,.48 .5,.48 Z',
  9:'M.1,.95 C.6,1.05 1,.75 1,.35 C1,.1 .8,0 .5,0 C.15,0 0,.15 0,.32 C0,.55 .25,.62 .5,.62 C.75,.62 .95,.5 1,.38',
  '&':'M1,1 L.2,.35 C0,.15 .2,0 .4,0 C.6,0 .7,.15 .55,.32 L.1,.65 C-.05,.8 .1,1 .35,1 C.6,1 .8,.85 .95,.6', '-':'M.1,.55 L.9,.55', '.':'M.5,.96 L.5,1', '+':'M.5,.25 L.5,.85 M.15,.55 L.85,.55', '!':'M.5,0 L.5,.7 M.5,.96 L.5,1' };
const NW = { I:.06, J:.5, L:.5, T:.6, E:.52, F:.5, S:.54, M:.8, W:.86, O:.72, Q:.72, '1':.3, '.':.06, '!':.06, '-':.42, '+':.5, '&':.62 };
/* one line of tube text, left edge u0, cap top v0, cap height hh; returns {els, width} (letter gap = .2·hh, space = .55·hh) */
function neonLine(str, u0, v0, hh, sw){
  const els=[]; let u=u0;
  [...str].forEach((c,i)=>{
    if(c===' '){ u += hh*.55; return; }
    const d=NEON_FONT[c]; if(!d) return;
    const ww=(NW[c]??.62)*hh; let k=0;
    els.push({ d:d.replace(/-?\d*\.?\d+/g, n=>{ const v=parseFloat(n); return ((k++%2===0)? u+v*ww : v0+v*hh).toFixed(3); }), sw });
    u += ww + hh*.2;
  });
  return { els, width: Math.max(0, u-u0-hh*.2) };
}
/* one line by default; stack=true puts the first word big and the rest small underneath (like the original collab sign) */
function neonBlock(text, u0, vTop, H, sw, stack){
  const t=String(text||'').toUpperCase().replace(/\s+/g,' ').trim().slice(0,24), sp=stack ? t.indexOf(' ') : -1;
  const big = sp<0 ? t : t.slice(0,sp), small = sp<0 ? '' : t.slice(sp+1);
  const a = neonLine(big, u0, vTop, H, sw), hs=H*.42, b = neonLine(small, u0, vTop+H+H*.36, hs, sw*.5);
  const wMax = Math.max(a.width, b.width);   // center the small line under the big one
  const shift = (a.width-b.width)/2, dx=(els,s)=>els.map(e=>({sw:e.sw, d:(()=>{let k=0;return e.d.replace(/-?\d*\.?\d+/g,n=>{const v=parseFloat(n);return ((k++%2===0)? v+s : v).toFixed(3);});})()}));
  return { big:dx(a.els, a.width<wMax? (wMax-a.width)/2 : 0), small:dx(b.els, shift>0? shift : 0), width:wMax, hasSmall:!!small };
}
function buildNeonSign(){
  /* Neon wall sign: <signLeft> (primary tube, default AGENTIC OS) × <signRight> (ice-blue, default GROK BOT, with a small bot-head mark).
     Config: OFFICE_CONFIG.sign = { left, right, leftColor?, rightColor?, mark?:true|false, stack?:false } or sign:false for the plain title panel. */
  const cfg = OFFICE_CONFIG.sign, x0=SIGN.x0, w=SIGN.w, z1=SIGN.z1, h=SIGN.h;
  if (cfg === false || cfg === 'off') {
    const t=esc(String(OFFICE_CONFIG.title||'Agent Office').toUpperCase().slice(0,28));
    const s = `<g transform="${mYt(x0,0,z1)}"><rect x=".6" y=".55" width="${w-1.2}" height="${h-1.1}" rx=".12" fill="#0d151c" opacity=".88" stroke="#2b3a45" stroke-width=".035"/>
      <text x="${w/2}" y="${(h/2+.16).toFixed(2)}" text-anchor="middle" font-size=".46" font-weight="800" letter-spacing=".08" fill="#e8eef3" font-family="Inter,Arial,Helvetica,sans-serif">${t}</text></g>`;
    addItem([x0-.1,-.1,x0+w+.1,.3], s, 'sign'); return;
  }
  const c = Object.assign({ left:'AGENTIC OS', right:'GROK BOT', leftColor:'#18ff62', rightColor:'#8fd8ff', mark:true, stack:false }, typeof cfg==='object' && cfg ? cfg : {});
  const hex = v => /^#[0-9a-f]{6}$/i.test(String(v)) ? v : null;
  const G = hex(c.leftColor)||'#18ff62', ICE = hex(c.rightColor)||'#8fd8ff', CORE='#f2fff6', ICORE='#f2fbff', XW='#fff4ea', XCORE='#ffffff';
  /* layout in a 1-unit cap-height space, then fit to the panel */
  const H=1, SW=.24, GAP=.62, L=neonBlock(c.left,0,0,H,SW,c.stack===true), R0=neonBlock(c.right,0,0,H,SW,c.stack===true);
  const markW = c.mark===false ? 0 : 1.0, xW=1.05;
  const totalW = L.width + GAP + xW + GAP + markW + (markW? .3:0) + R0.width;
  const totalH = (L.hasSmall||R0.hasSmall) ? H*1.78 : H;
  const k = Math.min((w-.8)/totalW, (h-.62)/totalH), u0=(w-totalW*k)/2, v0=(h-totalH*k)/2;
  const T = (els,du) => els.map(e=>({ sw:e.sw*k, d:(()=>{let i=0;return e.d.replace(/-?\d*\.?\d+/g,n=>{const v=parseFloat(n);return ((i++%2===0)? u0+(v+du)*k : v0+v*k).toFixed(3);});})() }));
  const left = [...T(L.big,0), ...T(L.small,0)];
  const xc = L.width+GAP+xW/2, xs=.46;   // bigger × at the big-word mid-height
  const xel = T([{d:`M${xc-xs},${.5-xs} L${xc+xs},${.5+xs} M${xc+xs},${.5-xs} L${xc-xs},${.5+xs}`, sw:SW*.5}],0);
  const rU = L.width+GAP+xW+GAP, right=[];
  if (markW){ // bot head: rounded head, visor eyes, antenna; sits on the big-word baseline
    const m=(d)=>{let i=0;return d.replace(/-?\d*\.?\d+/g,n=>{const v=parseFloat(n);return ((i++%2===0)? rU+.5+v : v).toFixed(3);});};
    right.push({d:m('M-.34,.3 L.34,.3 C.46,.3 .5,.36 .5,.48 L.5,.86 C.5,.96 .46,1 .34,1 L-.34,1 C-.46,1 -.5,.96 -.5,.86 L-.5,.48 C-.5,.36 -.46,.3 -.34,.3 Z'), sw:SW*.55});
    right.push({d:m('M0,.3 L0,.1'), sw:SW*.4}); right.push({d:m('M0,.05 L0,.051'), sw:SW*.75});
    right.push({d:m('M-.22,.64 L-.1,.64 M.1,.64 L.22,.64'), sw:SW*.6});
  }
  const rightAll = [...T(right,0), ...T(R0.big, rU+markW+(markW?.3:0)), ...T(R0.small, rU+markW+(markW?.3:0))];
  const lay = (els,c1,c2,kk) => els.map(e=>`<path d="${e.d}" fill="none" stroke="${c1}" stroke-width="${(e.sw*kk).toFixed(3)}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')
      + (c2? els.map(e=>`<path d="${e.d}" fill="none" stroke="${c2}" stroke-width="${(e.sw*.38).toFixed(3)}" stroke-linecap="round" stroke-linejoin="round"/>`).join('') : '');
  const dim = (hx,f) => '#'+[1,3,5].map(i=>Math.round(parseInt(hx.slice(i,i+2),16)*f).toString(16).padStart(2,'0')).join('');
  const unlit = lay(left,dim(G,.45),dim(G,.8),1) + lay(xel,'#6d6a66','#bdb8b0',1) + lay(rightAll,dim(ICE,.4),dim(ICE,.75),1);
  const clips = `<g stroke="#5b6b72" stroke-width=".03" stroke-linecap="round"><path d="M1.4,0 L1.4,-.3 M${w-1.4},0 L${w-1.4},-.3"/></g>`;
  const s = `<g transform="${mYt(x0,0,z1)}"><rect width="${w}" height="${h}" rx=".16" fill="#07120e" opacity=".82" stroke="#14382a" stroke-width=".035"/>${unlit}${clips}</g>`;
  addItem([x0-.1,-.1,x0+w+.1,.3], s, 'neon');
  const m = mYt(x0,0,z1);
  const glowStack = (draw,col,core,halo=1) => `<g filter="url(#fBlur18)" opacity="${.85*halo}"><g transform="${m}">${draw(col,null,1.5)}</g></g>
    <g filter="url(#fBlur8)" opacity=".95"><g transform="${m}">${draw(col,null,1.15)}</g></g>
    <g filter="url(#fBlur3)" opacity=".9"><g transform="${m}">${draw(col,null,1)}</g></g>
    <g transform="${m}">${draw(col,core,1)}</g>`;
  const aU=u0+L.width*k/2, gU=u0+(rU+(markW+R0.width)/2)*k, xU=u0+xc*k, mid=z1-(v0+.5*k);
  const pa=P(x0+aU,0,z1-h*.45), pg=P(x0+gU,0,z1-h*.45), fa=P(x0+aU,1.6,0), fa2=P(x0+aU,3.0,0), fg=P(x0+gU,1.6,0), px=P(x0+xU,0,mid);
  const aw=Math.max(2.4,L.width*k), gw=Math.max(2.4,(markW+R0.width)*k);
  GLOW.neon.push(`<g class="neon-left"><g class="flick">
    <ellipse cx="${pa[0]}" cy="${pa[1]}" rx="${(aw*S*.8).toFixed(0)}" ry="${(h*ZS*1.05).toFixed(0)}" fill="${rgrad(G,.55)}" opacity=".6"/>
    <ellipse cx="${fa[0]}" cy="${fa[1]}" rx="${(aw*S*.62).toFixed(0)}" ry="${(aw*S*.2).toFixed(0)}" fill="${rgrad(G,.5)}" opacity=".42"/>
    <ellipse cx="${fa2[0]}" cy="${fa2[1]}" rx="${(aw*S*.8).toFixed(0)}" ry="${(aw*S*.3).toFixed(0)}" fill="${rgrad(G,.55)}" opacity=".22"/>
    ${glowStack((a,b,kk)=>lay(left,a,b,kk),G,CORE)}</g></g>
  <g class="neon-right"><g class="flick2">
    <ellipse cx="${pg[0]}" cy="${pg[1]}" rx="${(gw*S*.8).toFixed(0)}" ry="${(h*ZS*1.0).toFixed(0)}" fill="${rgrad(ICE,.5)}" opacity=".5"/>
    <ellipse cx="${fg[0]}" cy="${fg[1]}" rx="${(gw*S*.62).toFixed(0)}" ry="${(gw*S*.2).toFixed(0)}" fill="${rgrad(ICE,.45)}" opacity=".3"/>
    ${glowStack((a,b,kk)=>lay(rightAll,a,b,kk),ICE,ICORE)}</g></g>
  <g class="neon-x"><g class="flick3"><ellipse cx="${px[0]}" cy="${px[1]}" rx="${(.8*S).toFixed(0)}" ry="${(.8*ZS).toFixed(0)}" fill="${rgrad(XW,.35)}" opacity=".35"/>${glowStack((a,b,kk)=>lay(xel,a,b,kk),XW,XCORE,1)}</g></g>`);
}
function buildCoffeeBar(){
  const x=15.6, y=2.4, w=2.5, d=1.0; let s=''; shadowBox(x,y,w,d,1.5,.4);
  s += box({x,y,w,d,z:0,h:1.0,c:'#2e3b42'});
  s += `<g transform="${mY(x+.1,y+d,.12)}">${[0,1,2].map(i=>`<rect x="${(.05+i*.78).toFixed(2)}" y=".05" width=".68" height=".7" rx=".03" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.12)" stroke-width=".02"/><rect x="${(.58+i*.78).toFixed(2)}" y=".38" width=".04" height=".14" rx=".02" fill="#19f0d8"/>`).join('')}</g>`;
  s += box({x:x-.05,y:y-.04,w:w+.1,d:d+.1,z:1.0,h:.07,c:'#d8c9ae'});
  const z=1.07;
  s += box({x:x+.2,y:y+.15,w:.6,d:.55,z,h:.58,c:'#262b33'});
  s += `<g transform="${mY(x+.26,y+.7,z+.28)}"><rect width=".48" height=".2" fill="#0b0e12"/><rect x=".05" y=".07" width=".12" height=".06" rx=".02" fill="#19f0d8"/><rect x=".22" y=".07" width=".12" height=".06" rx=".02" fill="#ff3fb4"/></g>`;
  s += mug(x+.5,y+.62,z,'#f1ece0');
  for(let i=0;i<3;i++) s += bottle(x+1.0+i*.38,y+.55,z,i===1?SETTINGS.theme.bottleB:SETTINGS.theme.bottleA,.8);
  s += mug(x+2.2,y+.55,z,'#19d3c5');
  addItem([x-.05,y-.04,x+w+.05,y+d+.06], s, 'coffeebar');
}
function buildBreakout(){
  const th = SETTINGS.theme;
  // rug lives in the floor svg (see buildFloor)
  const cb = '#3b4d6b', cc = '#476184', pil = ['#ff3fb4','#ffbf3c','#19d3c5'];
  let s = ''; shadowBox(13.35,6.15,4.2,1.7,.9,.35); shadowBox(16.25,7.8,1.4,2.7,.9,.35);
  // L-shaped sectional, built back→front
  s += box({x:13.2,y:6.1,w:.28,d:1.78,z:0,h:.9,c:cb});                     // left arm
  s += box({x:13.48,y:6.1,w:4.12,d:.45,z:0,h:1.28,c:cb});                  // back
  s += box({x:17.32,y:6.55,w:.28,d:3.95,z:0,h:1.28,c:cb});                 // right back (chaise side)
  s += box({x:13.48,y:6.55,w:3.84,d:1.33,z:0,h:.42,c:cb});                 // main base
  s += box({x:16.1,y:7.88,w:1.22,d:2.62,z:0,h:.42,c:cb});                  // chaise base
  [[13.52,1.26],[14.8,1.26],[16.08,1.2]].forEach(a=>{ s += box({x:a[0]+.02,y:6.6,w:a[1]-.04,d:1.26,z:.42,h:.2,c:cc}); });
  s += box({x:16.14,y:7.92,w:1.14,d:1.25,z:.42,h:.2,c:cc});
  s += box({x:16.14,y:9.2,w:1.14,d:1.25,z:.42,h:.2,c:cc});
  // pillows
  s += box({x:13.65,y:6.62,w:.5,d:.16,z:.62,h:.46,c:pil[0],noAO:true});
  s += box({x:16.55,y:6.62,w:.5,d:.16,z:.62,h:.46,c:pil[1],noAO:true});
  s += box({x:17.12,y:8.5,w:.16,d:.5,z:.62,h:.44,c:pil[2],noAO:true});
  addItem([13.2,6.1,17.6,10.5], s, 'couch');
  // coffee table
  let t=''; shadowBox(14.05,9.0,1.5,1.0,.5,.3);
  [[14.1,9.05],[15.4,9.05],[14.1,9.85],[15.4,9.85]].forEach(a=>{ t += box({x:a[0],y:a[1],w:.08,d:.08,z:0,h:.4,c:'#2a2f37',noAO:true,noEdge:true}); });
  t += box({x:14.0,y:8.98,w:1.55,d:1.0,z:.4,h:.07,c:'#8f6b45'});
  t += box({x:14.12,y:9.1,w:1.31,d:.76,z:.47,h:.015,c:'#a98258',noEdge:true,noAO:true});
  t += mug(14.45,9.45,.485,'#19d3c5') + bottle(15.0,9.6,.485,SETTINGS.theme.bottleA,.62);
  addItem([14.0,8.98,15.55,9.98], t, 'table');
}
