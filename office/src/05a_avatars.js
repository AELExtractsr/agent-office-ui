
/* ============================== SIMPLE AVATARS ============================== */
/* Each bot = one flat shape in its own colour (matches the shape + colour set for the agent in the OS).
   Interface used by the renderer: ex/ey = eye offsets (base at y=0, ~58 tall, ±21 wide), defs(p), body(p), sil(p). */
const AV_PATHS = {
  circle:   'M0,-56 A24,24 0 1,1 0,-8 A24,24 0 1,1 0,-56 Z',
  square:   'M-22,-54 L22,-54 L22,-8 L-22,-8 Z',
  rounded:  'M-12,-54 L12,-54 Q22,-54 22,-44 L22,-18 Q22,-8 12,-8 L-12,-8 Q-22,-8 -22,-18 L-22,-44 Q-22,-54 -12,-54 Z',
  hexagon:  'M0,-58 L23,-45 L23,-19 L0,-6 L-23,-19 L-23,-45 Z',
  triangle: 'M0,-60 L26,-8 L-26,-8 Z',
  diamond:  'M0,-60 L25,-33 L0,-6 L-25,-33 Z',
  star:     'M0,-60 L7.6,-41.5 L27,-40.5 L12,-27.5 L17,-8.5 L0,-19 L-17,-8.5 L-12,-27.5 L-27,-40.5 L-7.6,-41.5 Z',
  pill:     'M-14,-56 L14,-56 A14,14 0 0,1 14,-28 L14,-22 A14,14 0 0,1 -14,-22 L-14,-28 Z'
};
const AV_EYES = { circle:[7,-33], square:[8,-33], rounded:[8,-33], hexagon:[8,-33], triangle:[6,-24], diamond:[7,-33], star:[5.5,-31], pill:[6,-38] };
const shadeHex = (c,t) => { const n=[1,3,5].map(i=>parseInt(c.substr(i,2),16)); return '#'+n.map(v=>Math.round(t<0? v*(1+t) : v+(255-v)*t).toString(16).padStart(2,'0')).join(''); };
function avatarArt(shape, color){
  const d = AV_PATHS[shape] || AV_PATHS.circle, e = AV_EYES[shape] || AV_EYES.circle;
  return { ex:e[0], ey:e[1], rimO:.8, lit:.4,
    defs:p=> `<linearGradient id="${p}f" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="${shadeHex(color,.28)}"/><stop offset="1" stop-color="${shadeHex(color,-.28)}"/></linearGradient>`,
    sil:p=> `<path d="${d}"/>`,
    body:p=> `<path d="M0,-1 L0,-9" stroke="${shadeHex(color,-.45)}" stroke-width="4" stroke-linecap="round"/><ellipse cx="0" cy="-1.2" rx="7" ry="2.3" fill="${shadeHex(color,-.45)}"/>
      <path d="${d}" fill="url(#${p}f)" stroke="${shadeHex(color,-.35)}" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="${d}" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1" stroke-linejoin="round" transform="translate(-.6 -.8)" opacity=".7"/>` };
}
const BOT_ART = {}; BOTS.forEach(c=>{ BOT_ART[c.id] = avatarArt(c.shape, c.color); });
const _artDefsDone = {};
function artFor(b){ return BOT_ART[b.id] || avatarArt('circle', b.color||'#4c8dff'); }
function ensureArtDefs(b){ if(_artDefsDone[b.id]) return; _artDefsDone[b.id]=1; defsEl.insertAdjacentHTML('beforeend', artFor(b).defs('ba'+b.idx)); }
