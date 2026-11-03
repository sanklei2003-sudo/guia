// Mascote do GUIA: um explorador novo nascido do Sanso (Sanso Tattoo).
// Traço "rubber hose" retrô dos desenhos dos anos 30, desenhado à mão em SVG.
// DNA do Sanso: amanita vermelho #C20D02 com sombra #8D0000, bolinhas creme,
// contorno preto grosso, olhos "pie-eye", bochechas com bolinhas, luvas brancas
// de 4 dedos com sombra azul-clara, meião com duas listras e tênis amarelo cano alto.
// Novo (explorador): óculos de aviador no topo do chapéu e cachecol laranja.

const C = {
  cap: '#C20D02', capDark: '#8D0000', spot: '#FEF4E3', line: '#141010', white: '#FFFFFF',
  glove: '#FFFFFF', gloveShade: '#A9D8FF', gill: '#FEF4E3', gillLine: '#D9C7A8',
  shoe: '#FFC006', shoeDark: '#E09A00', tongue: '#FFA7FA', blue: '#0094FF', orange: '#FFA900',
  strap: '#6B3F22', lens: '#7FD0FF', rim: '#C98A2E', scarf: '#FFA900', scarfDark: '#D97E00',
};

export const MOODS = ['happy', 'excited', 'thinking', 'focused', 'proud', 'confused', 'sleepy', 'surprised',
  'angry', 'disappointed', 'worried', 'celebrating', 'resting', 'wink', 'love'];

export const MOOD_LABEL = {
  happy: 'Feliz', excited: 'Empolgado', thinking: 'Pensativo', focused: 'Concentrado', proud: 'Orgulhoso',
  confused: 'Confuso', sleepy: 'Sonolento', surprised: 'Surpreso', angry: 'Bravo (de mentira)',
  disappointed: 'Decepcionado', worried: 'Preocupado', celebrating: 'Comemorando', resting: 'Descansando',
  wink: 'Travesso', love: 'Apaixonado',
};

const FACE = {
  happy: { eyes: 'open', mouth: 'smile' },
  excited: { eyes: 'sparkle', mouth: 'grin', brows: 'raised', fx: 'sparks', arms: 'wave' },
  thinking: { eyes: 'look', mouth: 'hmm', brows: 'think', fx: 'dots', arms: 'chin' },
  focused: { eyes: 'focused', mouth: 'flat', brows: 'firm', goggles: 'down' },
  proud: { eyes: 'happy', mouth: 'smirk', fx: 'sparks', arms: 'thumb' },
  confused: { eyes: 'confused', mouth: 'wavy', brows: 'think', fx: 'question' },
  sleepy: { eyes: 'closed', mouth: 'o', fx: 'zzz' },
  surprised: { eyes: 'wide', mouth: 'o', brows: 'raised', fx: 'bang', arms: 'up' },
  angry: { eyes: 'angry', mouth: 'teeth', brows: 'angry', fx: 'vein', arms: 'hips' },
  disappointed: { eyes: 'half', mouth: 'frown', brows: 'worried', fx: 'tear' },
  worried: { eyes: 'open', mouth: 'wavy', brows: 'worried', fx: 'sweat' },
  celebrating: { eyes: 'happy', mouth: 'grin', brows: 'raised', fx: 'confetti', arms: 'up' },
  resting: { eyes: 'closed', mouth: 'smile', fx: 'zzz' },
  wink: { eyes: 'wink', mouth: 'smirk', arms: 'thumb' },
  love: { eyes: 'hearts', mouth: 'grin', fx: 'hearts' },
};

const LX = 81; const RX = 119; const EY = 78;
const S = (w = 4) => `stroke="${C.line}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;

function pieEye(x, y, { dx = 0, dy = 0, rx = 11, ry = 17, pupil = 1 } = {}) {
  const px = x + dx; const py = y + 5 + dy;
  const prx = 7.2 * pupil; const pry = 10.5 * pupil;
  return `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${C.white}" ${S(3.5)}/>
    <ellipse cx="${px}" cy="${py}" rx="${prx}" ry="${pry}" fill="${C.line}"/>
    <path d="M${px + 1} ${py - pry * 0.25} L${px + prx * 0.9} ${py - pry * 0.75} A${prx} ${pry} 0 0 1 ${px + prx} ${py - pry * 0.1} Z" fill="${C.white}"/>`;
}
const heart = (x, y, s = 1, fill = C.cap) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 6 C-10 -2 -8 -12 0 -6 C8 -12 10 -2 0 6Z" fill="${fill}" ${S(2.5 / s)}/>`;

function eyes(type) {
  const lid = (x, cut) => `<path d="M${x - 13} ${EY - 19} H${x + 13} V${EY - 19 + cut} Q${x} ${EY - 16 + cut} ${x - 13} ${EY - 19 + cut} Z" fill="${C.cap}"/><path d="M${x - 11} ${EY - 19 + cut} Q${x} ${EY - 17 + cut} ${x + 11} ${EY - 19 + cut}" fill="none" ${S(3.5)}/>`;
  const happyArc = (x) => `<path d="M${x - 11} ${EY + 6} Q${x} ${EY - 14} ${x + 11} ${EY + 6}" fill="none" ${S(4.5)}/>`;
  const closedArc = (x) => `<path d="M${x - 11} ${EY + 2} Q${x} ${EY + 12} ${x + 11} ${EY + 2}" fill="none" ${S(4.5)}/>`;
  switch (type) {
    case 'sparkle': return `<g class="m-eyes">${pieEye(LX, EY, { pupil: 1.12 })}${pieEye(RX, EY, { pupil: 1.12 })}<circle cx="${LX - 3}" cy="${EY + 11}" r="2" fill="#fff"/><circle cx="${RX - 3}" cy="${EY + 11}" r="2" fill="#fff"/></g>`;
    case 'look': return `<g class="m-eyes">${pieEye(LX, EY, { dx: 3, dy: -9 })}${pieEye(RX, EY, { dx: 3, dy: -9 })}</g>`;
    case 'confused': return `<g class="m-eyes">${pieEye(LX, EY, { pupil: 0.75, dx: 2 })}${pieEye(RX, EY, { rx: 13, ry: 19, pupil: 1.05, dx: -2, dy: -4 })}</g>`;
    case 'wide': return `<g class="m-eyes">${pieEye(LX, EY, { rx: 13, ry: 20, pupil: 0.55, dy: -4 })}${pieEye(RX, EY, { rx: 13, ry: 20, pupil: 0.55, dy: -4 })}</g>`;
    case 'happy': return happyArc(LX) + happyArc(RX);
    case 'closed': return closedArc(LX) + closedArc(RX);
    case 'wink': return `<g class="m-eyes">${pieEye(LX, EY)}</g>${happyArc(RX)}`;
    case 'hearts': return `${heart(LX, EY, 1.6)}${heart(RX, EY, 1.6)}`;
    case 'focused': return `<g class="m-eyes">${pieEye(LX, EY, { dy: 3 })}${pieEye(RX, EY, { dy: 3 })}</g>${lid(LX, 14)}${lid(RX, 14)}`;
    case 'half': return `<g class="m-eyes">${pieEye(LX, EY, { dy: 5 })}${pieEye(RX, EY, { dy: 5 })}</g>${lid(LX, 18)}${lid(RX, 18)}`;
    case 'angry': return `<g class="m-eyes">${pieEye(LX, EY, { dx: 2, dy: 3 })}${pieEye(RX, EY, { dx: -2, dy: 3 })}</g><path d="M${LX - 14} ${EY - 21} L${LX + 14} ${EY - 7} L${LX + 14} ${EY - 23}Z" fill="${C.cap}"/><path d="M${RX + 14} ${EY - 21} L${RX - 14} ${EY - 7} L${RX - 14} ${EY - 23}Z" fill="${C.cap}"/>`;
    default: return `<g class="m-eyes">${pieEye(LX, EY)}${pieEye(RX, EY)}</g>`;
  }
}

function brows(type) {
  switch (type) {
    case 'raised': return `<path d="M${LX - 10} ${EY - 25} Q${LX} ${EY - 31} ${LX + 10} ${EY - 26}" fill="none" ${S()}/><path d="M${RX - 10} ${EY - 26} Q${RX} ${EY - 31} ${RX + 10} ${EY - 25}" fill="none" ${S()}/>`;
    case 'think': return `<path d="M${LX - 10} ${EY - 23} L${LX + 10} ${EY - 23}" fill="none" ${S()}/><path d="M${RX - 10} ${EY - 25} Q${RX} ${EY - 32} ${RX + 10} ${EY - 27}" fill="none" ${S()}/>`;
    case 'angry': return `<path d="M${LX - 13} ${EY - 24} L${LX + 13} ${EY - 10}" fill="none" ${S(5)}/><path d="M${RX + 13} ${EY - 24} L${RX - 13} ${EY - 10}" fill="none" ${S(5)}/>`;
    case 'worried': return `<path d="M${LX - 11} ${EY - 19} L${LX + 9} ${EY - 27}" fill="none" ${S()}/><path d="M${RX - 9} ${EY - 27} L${RX + 11} ${EY - 19}" fill="none" ${S()}/>`;
    case 'firm': return `<path d="M${LX - 11} ${EY - 24} L${LX + 11} ${EY - 21}" fill="none" ${S()}/><path d="M${RX - 11} ${EY - 21} L${RX + 11} ${EY - 24}" fill="none" ${S()}/>`;
    default: return '';
  }
}

function mouth(type) {
  const y = 110;
  switch (type) {
    case 'grin': return `<path d="M86 ${y - 4} Q100 ${y + 20} 114 ${y - 4} Z" fill="${C.line}" ${S(3.5)}/><path d="M91 ${y - 3} h18 v4 h-18z" fill="#fff"/><path d="M93 ${y + 7} Q100 ${y + 3} 107 ${y + 7} Q100 ${y + 13} 93 ${y + 7}Z" fill="${C.tongue}"/>`;
    case 'teeth': return `<path d="M87 ${y + 6} Q100 ${y - 6} 113 ${y + 6} Q100 ${y + 2} 87 ${y + 6}Z" fill="#fff" ${S(3.5)}/><path d="M95 ${y + 1} v4 M100 ${y} v4 M105 ${y + 1} v4" ${S(1.8)}/>`;
    case 'smirk': return `<path d="M88 ${y} Q100 ${y + 9} 113 ${y - 4}" fill="none" ${S()}/>`;
    case 'hmm': return `<path d="M93 ${y + 2} L108 ${y}" fill="none" ${S()}/>`;
    case 'flat': return `<path d="M91 ${y + 1} L109 ${y + 1}" fill="none" ${S()}/>`;
    case 'wavy': return `<path d="M87 ${y + 2} Q91 ${y - 3} 95 ${y + 2} T103 ${y + 2} T111 ${y + 2}" fill="none" ${S()}/>`;
    case 'o': return `<ellipse cx="100" cy="${y + 2}" rx="5.5" ry="7" fill="${C.line}"/><ellipse cx="100" cy="${y + 5}" rx="3" ry="2.5" fill="${C.tongue}"/>`;
    case 'frown': return `<path d="M89 ${y + 6} Q100 ${y - 5} 111 ${y + 6}" fill="none" ${S()}/>`;
    default: return `<path d="M87 ${y - 2} Q100 ${y + 12} 113 ${y - 2}" fill="none" ${S()}/>`;
  }
}

function cheeks() {
  const c = (x) => `<circle cx="${x}" cy="101" r="14" fill="${C.cap}" ${S(3.5)}/><circle cx="${x - 4}" cy="97" r="2.6" fill="${C.spot}"/><circle cx="${x + 4}" cy="100" r="2.2" fill="${C.spot}"/><circle cx="${x - 1}" cy="106" r="2" fill="${C.spot}"/>`;
  return c(57) + c(143);
}

// Óculos de aviador: no topo do chapéu (padrão) ou sobre os olhos (modo foco)
function goggles(pos) {
  if (pos === 'down') {
    return `<path d="M24 82 Q100 66 176 82" stroke="${C.strap}" stroke-width="8" fill="none" ${''}/><path d="M24 82 Q100 66 176 82" fill="none" ${S(2)} opacity=".5"/>
      <circle cx="${LX}" cy="${EY + 2}" r="17" fill="${C.lens}" fill-opacity=".45" stroke="${C.rim}" stroke-width="6"/><circle cx="${LX}" cy="${EY + 2}" r="20" fill="none" ${S(2.5)}/>
      <circle cx="${RX}" cy="${EY + 2}" r="17" fill="${C.lens}" fill-opacity=".45" stroke="${C.rim}" stroke-width="6"/><circle cx="${RX}" cy="${EY + 2}" r="20" fill="none" ${S(2.5)}/>
      <rect x="95" y="${EY - 2}" width="10" height="7" rx="3" fill="${C.rim}" ${S(2)}/>`;
  }
  return `<g class="m-goggles"><path d="M44 50 Q100 22 156 50" stroke="${C.strap}" stroke-width="8" fill="none"/>
    <circle cx="86" cy="36" r="11" fill="${C.lens}" stroke="${C.rim}" stroke-width="5"/><circle cx="86" cy="36" r="13.5" fill="none" ${S(2.5)}/>
    <circle cx="114" cy="36" r="11" fill="${C.lens}" stroke="${C.rim}" stroke-width="5"/><circle cx="114" cy="36" r="13.5" fill="none" ${S(2.5)}/>
    <path d="M81 32 Q84 29 88 30 M109 32 Q112 29 116 30" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <rect x="96" y="33" width="8" height="6" rx="2.5" fill="${C.rim}" ${S(2)}/></g>`;
}

function fx(type) {
  switch (type) {
    case 'sparks': return `<g class="m-fx m-sparks" fill="${C.orange}" ${S(2.5)}><path d="M12 36 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z"/><path d="M184 24 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z"/></g>`;
    case 'dots': return `<g class="m-fx m-dots" fill="${C.line}"><circle cx="172" cy="34" r="3"/><circle cx="182" cy="20" r="4.5"/><circle cx="193" cy="3" r="6"/></g>`;
    case 'question': return `<text class="m-fx m-pop" x="168" y="28" font-size="38" font-weight="900" fill="${C.blue}" stroke="${C.line}" stroke-width="2" font-family="Georgia, serif">?</text>`;
    case 'zzz': return `<g class="m-fx m-zzz" fill="${C.blue}" stroke="${C.line}" stroke-width="1.5" font-family="Georgia, serif" font-weight="900"><text x="156" y="34" font-size="16">z</text><text x="168" y="18" font-size="22">z</text><text x="181" y="-2" font-size="28">Z</text></g>`;
    case 'bang': return `<text class="m-fx m-pop" x="172" y="28" font-size="38" font-weight="900" fill="${C.orange}" stroke="${C.line}" stroke-width="2" font-family="Georgia, serif">!</text>`;
    case 'vein': return `<g class="m-fx m-pop" stroke="${C.capDark}" stroke-width="4" stroke-linecap="round" fill="none"><path d="M168 6 q6 4 0 9"/><path d="M174 2 q4 6 9 0"/><path d="M180 12 q-6 4 0 9"/><path d="M172 22 q4 -6 9 0"/></g>`;
    case 'sweat': return `<path class="m-fx m-drip" d="M160 54 q7 10 0 16 q-7 -6 0 -16z" fill="${C.blue}" ${S(2)}/>`;
    case 'tear': return `<path class="m-fx m-drip" d="M72 96 q6 9 0 14 q-6 -5 0 -14z" fill="${C.blue}" ${S(2)}/>`;
    case 'hearts': return `<g class="m-fx m-sparks">${heart(20, 40, 1.3)}${heart(182, 26, 1)}</g>`;
    case 'confetti': return `<g class="m-fx m-confetti">${[[18, 18, C.cap], [176, 12, C.blue], [6, 68, C.orange], [192, 58, C.cap], [40, -6, C.blue], [150, -8, C.shoe]].map(([x, y, c], i) => `<rect x="${x}" y="${y}" width="7" height="12" rx="2" fill="${c}" stroke="${C.line}" stroke-width="1.5" transform="rotate(${i * 37} ${x} ${y})"/>`).join('')}</g>`;
    default: return '';
  }
}

function hat(type) {
  switch (type) {
    case 'chapeu-explorador': return `<g><ellipse cx="100" cy="22" rx="44" ry="8" fill="#C9A36B" ${S(3.5)}/><path d="M74 22 Q76 -6 100 -6 Q124 -6 126 22Z" fill="#D9B77E" ${S(3.5)}/><rect x="75" y="11" width="50" height="7" fill="${C.capDark}"/></g>`;
    case 'coroa': return `<path d="M80 22 L84 -2 L93 12 L100 -6 L107 12 L116 -2 L120 22Z" fill="${C.shoe}" ${S(3.5)}/><circle cx="100" cy="13" r="3.5" fill="${C.blue}"/>`;
    case 'chapeu-pirata': return `<path d="M52 24 Q64 -12 100 -16 Q136 -12 148 24 Q100 8 52 24Z" fill="${C.line}" ${S(3)}/><circle cx="100" cy="0" r="6" fill="#fff"/><path d="M95 -5 l10 10 M105 -5 l-10 10" stroke="${C.line}" stroke-width="2"/>`;
    case 'festa': return `<g><path d="M88 22 L104 -22 L118 20Z" fill="${C.blue}" ${S(3.5)}/><path d="M93 9 L112 5 M98 -5 L108 -7" stroke="${C.cap}" stroke-width="5"/><circle cx="104" cy="-22" r="5" fill="${C.cap}" ${S(2.5)}/></g>`;
    default: return '';
  }
}

function accessory(type) {
  switch (type) {
    case 'flor': return `<g transform="translate(152 44)"><circle r="5" fill="${C.shoe}"/>${[0, 72, 144, 216, 288].map((a) => `<ellipse rx="5" ry="8" cy="-9" fill="#fff" stroke="${C.line}" stroke-width="2" transform="rotate(${a})"/>`).join('')}<circle r="5" fill="${C.shoe}" stroke="${C.line}" stroke-width="2"/></g>`;
    case 'bussola': return `<g transform="translate(118 162)"><path d="M-14 -16 L-2 -8" stroke="${C.strap}" stroke-width="2.5"/><circle r="9" fill="${C.shoe}" stroke="${C.line}" stroke-width="3"/><path d="M0 -6 L2.5 0 L0 6 L-2.5 0Z" fill="${C.cap}"/></g>`;
    case 'lanterna': return `<g transform="translate(176 172)"><rect x="-6" y="-10" width="12" height="16" rx="3" fill="${C.shoe}" stroke="${C.line}" stroke-width="2.5"/><path d="M-4 -10 Q0 -18 4 -10" stroke="${C.line}" stroke-width="2" fill="none"/><circle r="3" cy="-2" fill="#fff"/></g>`;
    default: return '';
  }
}

function glove(x, y, rot = 0, pose = 'open') {
  const thumbUp = pose === 'thumb';
  const fist = pose === 'fist';
  return `<g transform="translate(${x} ${y}) rotate(${rot})">
    ${thumbUp ? `<rect x="-5" y="-24" width="10" height="18" rx="5" fill="${C.glove}" ${S(3.5)}/>` : ''}
    <path d="M-12 -6 Q-15 8 -6 13 Q6 16 12 8 Q16 -2 10 -9 Q0 -14 -12 -6Z" fill="${C.glove}" ${S(3.5)}/>
    <path d="M-6 9 Q4 12 9 5" stroke="${C.gloveShade}" stroke-width="4" fill="none" stroke-linecap="round"/>
    ${fist || thumbUp ? `<path d="M-6 -4 v6 M0 -6 v7 M6 -4 v6" ${S(2.2)}/>` : `<path d="M-13 -5 Q-22 -10 -18 -16 Q-12 -14 -8 -9" fill="${C.glove}" ${S(3)}/><path d="M-3 -9 v-2 M3 -9 v-2" ${S(2)}/>`}
  </g>`;
}

const SHOES = { amarelo: [C.shoe, C.shoeDark], azul: ['#0094FF', '#006BC0'], vinho: ['#8D0000', '#5E0000'] };

/** Gera o SVG do mascote. look: { hat, accessory, scarf (cor do tênis) } */
export function mascotSVG(mood = 'happy', look = {}) {
  const f = FACE[mood] || FACE.happy;
  const [sh, shD] = SHOES[look.scarf] || SHOES.amarelo;
  const arms = f.arms || 'down';
  const hose = (d) => `<path d="${d}" stroke="${C.line}" stroke-width="12" stroke-linecap="round" fill="none"/><path d="${d}" stroke="${C.white}" stroke-width="6" stroke-linecap="round" fill="none"/>`;
  const leftArm = {
    up: `${hose('M42 126 Q20 104 18 78')}${glove(18, 70, 180, 'fist')}`,
    hips: `${hose('M42 128 Q20 136 36 152')}${glove(40, 154, 120, 'fist')}`,
  }[arms] || `${hose('M42 128 Q24 142 22 162')}${glove(22, 168, 10)}`;
  const rightArm = {
    up: `${hose('M158 126 Q180 104 182 78')}${glove(182, 70, 180, 'fist')}`,
    wave: `${hose('M158 126 Q182 108 184 84')}${glove(184, 76, 170)}`,
    chin: `${hose('M158 128 Q186 142 158 146')}${glove(152, 142, 70, 'fist')}`,
    thumb: `${hose('M158 128 Q182 136 182 150')}${glove(182, 154, 0, 'thumb')}`,
    hips: `${hose('M158 128 Q180 136 164 152')}${glove(160, 154, -120, 'fist')}`,
  }[arms] || `${hose('M158 128 Q176 142 178 162')}${glove(178, 168, -10)}`;

  return `<svg class="mascot-svg mood-${mood}" viewBox="0 -22 200 244" overflow="visible" role="img" aria-label="Guia, o cogumelo explorador, ${MOOD_LABEL[mood] || ''}">
  <ellipse class="m-shadow" cx="100" cy="214" rx="54" ry="7" fill="${C.line}" opacity=".18"/>
  <g class="m-body">
    <g class="m-legs">
      <rect x="80" y="136" width="16" height="54" rx="7" fill="${C.white}" ${S(3.5)}/>
      <rect x="104" y="136" width="16" height="54" rx="7" fill="${C.white}" ${S(3.5)}/>
      <path d="M81 168 h14 M81 174 h14 M105 168 h14 M105 174 h14" stroke="${C.cap}" stroke-width="3"/>
      <path d="M92 146 v38 M116 146 v38" stroke="${C.gloveShade}" stroke-width="3" opacity=".7"/>
      <path d="M64 208 Q60 196 72 190 L78 182 H98 V200 Q98 210 88 210 H68 Q63 210 64 208Z" fill="${sh}" ${S(3.5)}/>
      <path d="M65 205 H97" stroke="${C.white}" stroke-width="3.5"/><path d="M84 186 l6 4 M82 192 l8 3" ${S(2)}/><path d="M70 197 Q74 191 80 191" stroke="${shD}" stroke-width="3" fill="none"/>
      <path d="M136 208 Q140 196 128 190 L122 182 H102 V200 Q102 210 112 210 H132 Q137 210 136 208Z" fill="${sh}" ${S(3.5)}/>
      <path d="M103 205 H135" stroke="${C.white}" stroke-width="3.5"/><path d="M116 186 l-6 4 M118 192 l-8 3" ${S(2)}/><path d="M130 197 Q126 191 120 191" stroke="${shD}" stroke-width="3" fill="none"/>
    </g>
    <g class="m-scarf">
      <path d="M68 132 Q100 146 132 132 L134 142 Q100 156 66 142 Z" fill="${C.scarf}" ${S(3.5)}/>
      <path d="M80 138 l-2 7 M96 141 l-1 7 M112 140 l1 7" stroke="${C.scarfDark}" stroke-width="2.5"/>
      <path class="m-scarf-tail" d="M122 142 Q136 156 146 170 L134 174 Q126 160 114 148 Z" fill="${C.scarfDark}" ${S(3)}/>
    </g>
    <g class="m-arm m-arm-l ${arms === 'up' ? 'up' : ''}">${leftArm}</g>
    <g class="m-arm m-arm-r ${arms === 'up' ? 'up' : ''}">${rightArm}</g>
    <g class="m-cap">
      <path d="M44 126 Q100 150 156 126 Q150 142 100 146 Q50 142 44 126Z" fill="${C.gill}" ${S(3.5)}/>
      <path d="M60 132 L66 142 M74 135 L77 144 M88 137 L89 145 M100 138 V146 M112 137 L111 145 M126 135 L123 144 M140 132 L134 142" stroke="${C.gillLine}" stroke-width="2"/>
      <path d="M20 124 C 14 84, 52 22, 100 20 C 148 22, 186 84, 180 124 Q 100 142 20 124 Z" fill="${C.cap}" ${S(4.5)}/>
      <path d="M26 120 Q100 138 174 120 Q172 128 100 134 Q30 128 26 120Z" fill="${C.capDark}"/>
      <path d="M154 54 Q170 80 172 112" stroke="${C.capDark}" stroke-width="10" fill="none" stroke-linecap="round" opacity=".55"/>
      <g fill="${C.spot}" ${S(2.5)}>
        <circle cx="38" cy="86" r="5"/><circle cx="32" cy="106" r="3.5"/><circle cx="162" cy="84" r="5.5"/><circle cx="170" cy="104" r="3.5"/>
        <circle cx="54" cy="62" r="4"/><circle cx="148" cy="62" r="3.5"/><circle cx="100" cy="56" r="3"/>
      </g>
      <g class="m-face">
        ${cheeks()}
        <g class="m-eyelids">${eyes(f.eyes)}</g>
        ${brows(f.brows)}
        <path d="M96 95 Q100 99 104 95" fill="none" ${S(3)}/>
        ${mouth(f.mouth)}
      </g>
      ${goggles(f.goggles)}
      ${hat(look.hat)}
    </g>
    ${accessory(look.accessory)}
  </g>
  ${fx(f.fx)}
</svg>`;
}
