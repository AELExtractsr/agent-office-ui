
/* -------------------------- floor, walls, neon strips --------------------- */
function buildFloor(){
  const th = SETTINGS.theme; let s = '';
  // walls first (far), then slab on top so wall parallax/overlap hides seams
  const wa = tone(th.wallA), wb = tone(th.wallB);
  s += box({x:-.35,y:-.35,w:W+.35,d:.35,z:-.1,h:WH+.1,tn:{t:'#6d8b93',l:wa.l,r:wa.r},noAO:true});
  s += box({x:-.35,y:0,w:.35,d:D,z:-.1,h:WH+.1,tn:{t:'#5d7a84',l:wb.l,r:wb.r},noAO:true});
  // wall A decorations (plane y=0)
  const wallFace = (m, len, lenKey) => `<g transform="${m}">
     <rect width="${len}" height=".95" fill="rgba(6,14,18,.20)"/><rect y=".93" width="${len}" height=".05" fill="rgba(255,255,255,.14)"/><rect width="${len}" height=".13" fill="rgba(0,0,0,.28)"/>
     ${Array.from({length:Math.floor(len/1.55)},(_,i)=>`<rect x="${((i+1)*1.55).toFixed(2)}" y=".98" width=".02" height="${(WH-.98-.12).toFixed(2)}" fill="rgba(0,0,0,.13)"/><rect x="${((i+1)*1.55+.02).toFixed(2)}" y=".98" width=".012" height="${(WH-.98-.12).toFixed(2)}" fill="rgba(255,255,255,.06)"/>`).join('')}
     <rect width="${len}" height="1.6" fill="url(#gWallAO)"/><rect y="${(WH-.9).toFixed(2)}" width="${len}" height=".9" fill="url(#gWallTop)" transform="translate(0 0)" opacity="0"/>
     <rect y="${(WH-.55).toFixed(2)}" width="${len}" height=".55" fill="url(#gWallAO)" transform="translate(0 ${(WH-.55).toFixed(2)}) scale(1 -1) translate(0 ${(-(WH-.55)).toFixed(2)})" opacity=".0"/></g>`;
  s += wallFace(mY(0,0,0), W);
  s += wallFace(mX(0,0,0), D);
  // corner AO
  s += `<g transform="${mY(0,0,0)}"><rect width="1.6" height="${WH}" fill="url(#gFloorAOx)" opacity=".55"/></g>`;
  // neon strips on wall tops
  const T=th.neonTeal, M=th.neonMagenta, za=WH-.16;
  const la = `${pp(P(.1,0,za))} ${pp(P(W-.1,0,za))}`, lb = `${pp(P(0,.1,za))} ${pp(P(0,D-.1,za))}`;
  s += `<polyline points="${la}" stroke="${T}" stroke-width="2.4" stroke-linecap="round" fill="none"/><polyline points="${la}" stroke="#eafffb" stroke-width=".9" fill="none"/>`;
  s += `<polyline points="${lb}" stroke="${M}" stroke-width="2.4" stroke-linecap="round" fill="none"/><polyline points="${lb}" stroke="#ffe6f6" stroke-width=".9" fill="none"/>`;
  GLOW.neon.push(`<g filter="url(#fBlur8)" opacity=".9"><polyline points="${la}" stroke="${T}" stroke-width="6" fill="none"/><polyline points="${lb}" stroke="${M}" stroke-width="6" fill="none"/></g>
     <polygon points="${pts(P(0,0,za),P(W,0,za),P(W,0,za-1.1),P(0,0,za-1.1))}" fill="${alpha(T,.10)}"/><polygon points="${pts(P(0,0,za),P(0,D,za),P(0,D,za-1.1),P(0,0,za-1.1))}" fill="${alpha(M,.10)}"/>`);
  // floor slab
  const ft = tone(th.floor);
  s += box({x:0,y:0,w:W,d:D,z:-.5,h:.5,c:th.floor,tn:{t:ft.t,l:'#8f8a80',r:'#6c675f'},noAO:false,noSheen:true});
  const top = pts(P(0,0,0),P(W,0,0),P(W,D,0),P(0,D,0));
  let tiles = ''; for(let x=0;x<Math.ceil(W);x++) for(let y=0;y<Math.ceil(D);y++){ if((x+y)%2===0){ const w=Math.min(1,W-x), d=Math.min(1,D-y); tiles += `M${x},${y}h${w}v${d}h${-w}z`; } }
  let grid=''; for(let x=1;x<Math.ceil(W);x++) grid += `M${x},0V${D}`; for(let y=1;y<Math.ceil(D);y++) grid += `M0,${y}H${W}`;
  s += `<g transform="${mT(0,0,0)}">
    <path d="${tiles}" fill="rgba(0,0,0,.055)"/><path d="${grid}" stroke="rgba(0,0,0,.07)" stroke-width=".018" fill="none"/>
    <rect x=".85" y="1.35" width="11.6" height="10.9" rx=".25" fill="#46506a" opacity=".5"/><rect x=".92" y="1.42" width="11.46" height="10.76" rx=".2" fill="none" stroke="rgba(255,255,255,.16)" stroke-width=".035"/>
    <rect x="13.0" y="5.75" width="5.2" height="6.2" rx=".18" fill="#252f4a"/><rect x="13.0" y="5.75" width="5.2" height="6.2" rx=".18" fill="url(#gSheen)" opacity=".35"/>
    <rect x="13.14" y="5.89" width="4.92" height="5.92" rx=".12" fill="none" stroke="${T}" stroke-width=".07" opacity=".85"/>
    <rect x="13.32" y="6.07" width="4.56" height="5.56" rx=".08" fill="none" stroke="${M}" stroke-width=".045" opacity=".8"/>
    <path d="M15.6,7.2 L17.3,8.85 L15.6,10.5 L13.9,8.85 Z" fill="none" stroke="${T}" stroke-width=".04" opacity=".5"/><path d="M15.6,7.9 L16.55,8.85 L15.6,9.8 L14.65,8.85 Z" fill="${alpha(M,.25)}" stroke="${M}" stroke-width=".035" opacity=".7"/>
    ${Array.from({length:21},(_,i)=>`<rect x="${(13.2+i*.24).toFixed(2)}" y="11.95" width=".06" height=".22" fill="#cfd7e6" opacity=".35"/>`).join('')}
    <rect x="0" y="0" width="${W}" height="1.4" fill="url(#gFloorAO)"/><rect x="0" y="0" width="1.4" height="${D}" fill="url(#gFloorAOx)"/>
  </g>`;
  s += `<polygon points="${top}" fill="${rgrad('#ffffff',.22)}" opacity="0"/>`;
  document.getElementById('svgFloor').setAttribute('viewBox',`0 0 ${SCENE_W} ${SCENE_H}`);
  document.getElementById('svgFloor').innerHTML = s;
}

function buildAll(){
  buildFloor();
  DESKS.forEach(buildDesk);
  buildBookshelf(); buildBench(); buildBottleShelves(); buildWhiteboard(); buildWindow(); buildNeonSign(); buildCoffeeBar(); buildBreakout();
  [[.85,5.45],[17.55,1.95],[18.1,5.55],[18.05,11.7]].forEach((p,i)=> addItem([p[0]-.3,p[1]-.3,p[0]+.3,p[1]+.3], lamp(p[0],p[1],i===1?2.5:2.3), 'lamp'));
  [[.85,12.0,'fan',1.15,1,'#c46f45'],[12.5,12.1,'snake',1.1,2,'#e6e1d6'],[18.1,1.2,'bush',1.05,3,'#e6e1d6'],[13.1,4.5,'fan',1,4,'#3a4048'],[18.0,12.2,'snake',1.2,5,'#c46f45'],[.8,11.0,'bush',.95,6,'#3a4048'],[14.8,5.2,'bush',.7,8,'#c46f45']]
    .forEach(a=> addItem([a[0]-.35,a[1]-.35,a[0]+.35,a[1]+.35], plant(...a), 'plant'));
  // shipping boxes by the bookshelf
  let bx=''; shadowBox(16.7,.15,1.6,1.4,1.3,.4);
  bx += box({x:16.75,y:.2,w:1.2,d:.9,z:0,h:.7,c:'#c9a46e'}) + box({x:17.0,y:.3,w:1.2,d:.9,z:.7,h:.55,c:'#d4b07a'}) + box({x:16.8,y:1.08,w:.8,d:.6,z:0,h:.5,c:'#c29a62'});
  bx += `<g transform="${mY(16.75,1.1,.1)}"><rect x=".2" y=".18" width=".8" height=".3" rx=".03" fill="#0e1a1f"/><text x=".6" y=".38" font-size=".16" font-weight="800" text-anchor="middle" fill="#19f0d8" font-family="Arial,sans-serif">OPS</text></g>`;
  addItem([16.7,.15,18.3,1.7], bx, 'crates');

  // ---- write SVGs ----
  const vb = `0 0 ${SCENE_W} ${SCENE_H}`;
  ['svgShadowCast','svgShadowContact','svgObjs','glowDay','glowNeon','glowLamps','glowScreens','glowCollab','glowBots'].forEach(id=>document.getElementById(id).setAttribute('viewBox',vb));
  document.getElementById('svgShadowCast').innerHTML = `<g fill="#000">${SH_CAST.join('')}</g>`;
  document.getElementById('svgShadowContact').innerHTML = `<g fill="#000">${SH_CONTACT.join('')}</g>`;
  document.getElementById('glowDay').innerHTML = GLOW.day.join('');
  document.getElementById('glowNeon').innerHTML = GLOW.neon.join('');
  document.getElementById('glowLamps').innerHTML = GLOW.lamps.join('');
  document.getElementById('glowScreens').innerHTML = GLOW.screens.join('');
  const objs = document.getElementById('svgObjs'); objs.innerHTML = '<g id="objs"></g>';
  const og = document.getElementById('objs');
  ITEMS.forEach(it => { const g = document.createElementNS('http://www.w3.org/2000/svg','g'); g.setAttribute('class','it'); g.innerHTML = it.svg; it.node = g; og.appendChild(g); });
  document.getElementById('glowBots').innerHTML = '<g id="gbots"></g>';
}

/* ------------------------ painter's-order topological sort ---------------- */
let lastOrderSig = '';
function sortScene(list){
  const n = list.length, EPS = .001, before = [], indeg = new Array(n).fill(0);
  for(let i=0;i<n;i++) before.push([]);
  for(let i=0;i<n;i++){ const a=list[i];
    for(let j=i+1;j<n;j++){ const b=list[j];
      const aB = a.x1<=b.x0+EPS || a.y1<=b.y0+EPS, bB = b.x1<=a.x0+EPS || b.y1<=a.y0+EPS;
      let ord = 0;                       // -1: a first, 1: b first
      if(aB && !bB) ord = -1; else if(bB && !aB) ord = 1;
      else if(!aB && !bB){ ord = a.bot===b.bot ? ((a.x0+a.x1+a.y0+a.y1) <= (b.x0+b.x1+b.y0+b.y1) ? -1 : 1) : (a.bot ? 1 : -1); }
      if(ord===-1){ before[i].push(j); indeg[j]++; } else if(ord===1){ before[j].push(i); indeg[i]++; } } }
  const key = it => it.x0+it.x1+it.y0+it.y1, done = new Array(n).fill(false), out = [];
  for(let c=0;c<n;c++){ let pick=-1, best=1e9;
    for(let i=0;i<n;i++) if(!done[i] && indeg[i]===0){ const k=key(list[i]); if(k<best){ best=k; pick=i; } }
    if(pick<0){ for(let i=0;i<n;i++) if(!done[i]){ const k=key(list[i]); if(k<best){ best=k; pick=i; } } }
    done[pick]=true; out.push(list[pick]); before[pick].forEach(j=>{ indeg[j]--; }); }
  return out;
}
function applyOrder(order){
  const sig = order.map(o=>o.id).join(','); if(sig===lastOrderSig) return; lastOrderSig = sig;
  const og = document.getElementById('objs'); order.forEach(o=>og.appendChild(o.node));
}
