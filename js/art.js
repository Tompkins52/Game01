// Everything is drawn in code: dogs, the cat, kids, Bad Owners and props.
// Top-down sprites face "up" (toward the finish). Sizes are in world units.

const TAU = Math.PI * 2;
export const OUT = 'rgba(34,24,44,0.9)';

const rgbCache = {};
function rgb(hex) {
  if (rgbCache[hex]) return rgbCache[hex];
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return (rgbCache[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
}
export function mix(a, b, t) {
  const A = rgb(a), B = rgb(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}
export const darker = (hex, t) => mix(hex, '#000000', t);
export const lighter = (hex, t) => mix(hex, '#ffffff', t);

function ell(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
}
function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}
function rrect(ctx, x, y, w, h, r) {
  const q = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + q, y);
  ctx.arcTo(x + w, y, x + w, y + h, q);
  ctx.arcTo(x + w, y + h, x, y + h, q);
  ctx.arcTo(x, y + h, x, y, q);
  ctx.arcTo(x, y, x + w, y, q);
  ctx.closePath();
}
function fs(ctx, fill, lw = 1.6, stroke = OUT) {
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}
export function star(ctx, x, y, r, n = 5, inner = 0.45, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const rr = i % 2 ? r * inner : r;
    const a = rot + (i / (n * 2)) * TAU;
    if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}
export function heart(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.7, y - s * 1.1, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
  ctx.closePath();
}

const HEADS = {
  broad: { rx: 12.5, ry: 11, mw: 12.5, ml: 8 },
  long: { rx: 8.6, ry: 11.5, mw: 6.8, ml: 13 },
  round: { rx: 11, ry: 11, mw: 9.6, ml: 8 },
  wedge: { rx: 10.6, ry: 11, mw: 8.4, ml: 11 }
};
const lightFace = (p) => p === 'corgi' || p === 'mask' || p === 'blaze';
const whiteSocks = (p) => p === 'corgi' || p === 'chest' || p === 'mask' || p === 'blaze';

function muzzleColor(look) {
  if (look.muzzle) return look.muzzle;
  if (look.pattern === 'saddle') return look.shade;
  if (lightFace(look.pattern)) return look.light;
  return mix(look.coat, look.light, 0.3);
}

function tailTop(ctx, look, BL, wag) {
  ctx.save();
  ctx.translate(0, BL - 2);
  ctx.rotate(wag);
  const c = look.tail === 'bush' && look.pattern === 'saddle' ? look.shade : look.coat;
  switch (look.tail) {
    case 'otter':
      poly(ctx, [-4.5, 0, 4.5, 0, 1.5, 19, -1.5, 19]);
      fs(ctx, c);
      break;
    case 'bush':
      ell(ctx, 0, 11, 6, 13);
      fs(ctx, c);
      ell(ctx, 0, 19, 3, 4.5);
      ctx.fillStyle = look.pattern === 'blaze' ? look.light : lighter(look.coat, 0.25);
      ctx.fill();
      break;
    case 'nub':
      ell(ctx, 0, 2, 4.5, 4.5);
      fs(ctx, look.light);
      break;
    case 'curl':
      ctx.beginPath();
      ctx.arc(3.5, 3, 6, Math.PI * 0.9, Math.PI * 2.6);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 7.5;
      ctx.stroke();
      ctx.strokeStyle = look.pattern === 'mask' ? look.light : c;
      ctx.lineWidth = 4.8;
      ctx.stroke();
      break;
    default:
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(4, 10, 0, 20);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 5.4;
      ctx.stroke();
      ctx.strokeStyle = c;
      ctx.lineWidth = 3;
      ctx.stroke();
  }
  ctx.restore();
}

function headTop(ctx, look, o) {
  const H = HEADS[look.head] || HEADS.round;
  const { rx, ry, mw, ml } = H;
  const ec = look.earColor || look.shade;
  // tongue first so the muzzle covers its root
  if (o.tongue) {
    ctx.save();
    ctx.translate(mw * 0.2, -ry * 0.45 - ml + 1);
    ctx.rotate(0.5 + Math.sin((o.run || 0) * 2) * 0.25);
    rrect(ctx, -2.4, -9, 4.8, 10, 2.4);
    fs(ctx, '#ff7d95', 1.1);
    ctx.restore();
  }
  // muzzle
  const my = -ry * 0.45;
  ctx.beginPath();
  ctx.moveTo(-mw / 2, my + 2);
  ctx.quadraticCurveTo(-mw * 0.5, my - ml * 0.7, -mw * 0.3, my - ml);
  ctx.quadraticCurveTo(0, my - ml - 3.2, mw * 0.3, my - ml);
  ctx.quadraticCurveTo(mw * 0.5, my - ml * 0.7, mw / 2, my + 2);
  ctx.closePath();
  fs(ctx, muzzleColor(look));
  ell(ctx, 0, my - ml - 0.3, 3, 2.3);
  ctx.fillStyle = look.nose;
  ctx.fill();
  // ears that sit behind the skull
  if (look.ear === 'flop') {
    for (const s of [-1, 1]) {
      ell(ctx, s * (rx + 0.5), 3, 5, 9.5, s * -0.28);
      fs(ctx, ec);
    }
  }
  // skull
  ell(ctx, 0, 0, rx, ry);
  fs(ctx, look.pattern === 'mask' ? look.shade : look.coat);
  // markings on the head
  ctx.save();
  ell(ctx, 0, 0, rx - 0.8, ry - 0.8);
  ctx.clip();
  if (look.pattern === 'mask') {
    ell(ctx, -rx * 0.55, -ry * 0.55, rx * 0.5, ry * 0.75);
    ctx.fillStyle = look.light;
    ctx.fill();
    ell(ctx, rx * 0.55, -ry * 0.55, rx * 0.5, ry * 0.75);
    ctx.fill();
  }
  if (look.pattern === 'chest' || look.pattern === 'blaze' || look.pattern === 'corgi') {
    poly(ctx, [-2.2, -ry, 2.2, -ry, 1.2, ry * 0.25, -1.2, ry * 0.25]);
    ctx.fillStyle = look.light;
    ctx.fill();
  }
  if (look.pattern === 'brindle') {
    ctx.strokeStyle = look.shade;
    ctx.lineWidth = 1.4;
    for (const yy of [-2, 3]) {
      ctx.beginPath();
      ctx.moveTo(-rx, yy);
      ctx.lineTo(-rx * 0.3, yy + 1.5);
      ctx.moveTo(rx, yy);
      ctx.lineTo(rx * 0.3, yy + 1.5);
      ctx.stroke();
    }
  }
  ctx.restore();
  // ears on top
  if (look.ear === 'rose') {
    for (const s of [-1, 1]) {
      poly(ctx, [s * rx * 0.55, 2, s * (rx + 5.5), 7, s * rx * 0.75, 9.5]);
      fs(ctx, ec, 1.4);
    }
  } else if (look.ear === 'point') {
    for (const s of [-1, 1]) {
      poly(ctx, [s * rx * 0.95, 5, s * (rx + 3), -6.5, s * rx * 0.25, 1.5]);
      fs(ctx, ec, 1.4);
    }
  } else if (look.ear === 'bat') {
    for (const s of [-1, 1]) {
      poly(ctx, [s * rx * 0.95, 6, s * (rx + 9.5), -7, s * rx * 0.2, 1.5]);
      fs(ctx, ec, 1.4);
      poly(ctx, [s * rx * 0.95, 4, s * (rx + 6.5), -4, s * rx * 0.5, 2]);
      ctx.fillStyle = '#f4b6a6';
      ctx.fill();
    }
  }
  // eyes
  const ex = rx * 0.5, ey = -ry * 0.3;
  for (const s of [-1, 1]) {
    if (o.mood === 'dizzy') {
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(s * ex - 2, ey - 2);
      ctx.lineTo(s * ex + 2, ey + 2);
      ctx.moveTo(s * ex + 2, ey - 2);
      ctx.lineTo(s * ex - 2, ey + 2);
      ctx.stroke();
    } else if (o.mood === 'happy') {
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(s * ex, ey + 1, 2.2, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else {
      ell(ctx, s * ex, ey, 2.2, 2.4);
      ctx.fillStyle = look.eye === '#4fb3e8' ? '#4fb3e8' : '#1d1620';
      ctx.fill();
      ell(ctx, s * ex - 0.6, ey - 0.8, 0.8, 0.8);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
    if (look.brow) {
      ell(ctx, s * ex, ey - 4, 1.6, 1.2);
      ctx.fillStyle = look.brow;
      ctx.fill();
    }
  }
}

// o: { size, run, speed (0..1), collar, t, belly, tongue, mood, wag }
export function drawDogTop(ctx, look, o = {}) {
  const size = o.size || 1, run = o.run || 0, sp = o.speed || 0;
  const BL = 25 * (look.len || 1), BW = 13.5 * (look.wid || 1);
  const sw = Math.sin(run);
  ctx.save();
  ctx.scale(size, size);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (!o.noShadow) {
    ell(ctx, 3, 6, BW + 5, BL + 12);
    ctx.fillStyle = 'rgba(0,0,0,0.17)';
    ctx.fill();
  }
  const wag = o.wag != null ? o.wag : Math.sin(run * 1.3 + (o.t || 0) * 10) * (0.3 + sp * 0.3);
  tailTop(ctx, look, BL, wag);
  const stride = 2.5 + sp * 6.5;
  const pawCol = whiteSocks(look.pattern) ? look.light : look.shade;
  for (const [sx, sy, ph] of [[-1, -1, 1], [1, -1, -1], [-1, 1, -1], [1, 1, 1]]) {
    ell(ctx, sx * (BW - 1.5), sy * BL * 0.56 + ph * sw * stride + (sy < 0 ? -4 : 3), 4.6, 7.5);
    fs(ctx, pawCol);
  }
  const bulge = 1 + (o.belly || 0) * 0.32;
  ell(ctx, 0, 0, BW * bulge, BL);
  fs(ctx, look.coat);
  ctx.save();
  ell(ctx, 0, 0, BW * bulge - 0.8, BL - 0.8);
  ctx.clip();
  switch (look.pattern) {
    case 'saddle':
      ell(ctx, 0, 3, BW * 0.82, BL * 0.74);
      ctx.fillStyle = look.shade;
      ctx.fill();
      break;
    case 'mask':
      ell(ctx, 0, 2, BW * 0.78, BL * 0.9);
      ctx.fillStyle = look.shade;
      ctx.fill();
      break;
    case 'brindle':
      ctx.strokeStyle = look.shade;
      ctx.lineWidth = 2;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-BW, i * 7 - 2);
        ctx.quadraticCurveTo(0, i * 7 + 3, BW, i * 7 - 2);
        ctx.stroke();
      }
      break;
    case 'corgi':
      ell(ctx, 0, BL, BW, BL * 0.34);
      ctx.fillStyle = look.light;
      ctx.fill();
      ell(ctx, 0, -BL, BW, BL * 0.3);
      ctx.fill();
      break;
    case 'blaze':
      ell(ctx, 0, -BL, BW, BL * 0.3);
      ctx.fillStyle = look.light;
      ctx.fill();
      break;
  }
  ctx.restore();
  if (look.extra === 'cape') {
    const fl = Math.sin(run * 1.1 + (o.t || 0) * 6) * 3;
    poly(ctx, [-BW * 0.85, -BL + 5, BW * 0.85, -BL + 5, BW * 1.2 + fl, BL * 0.78, 0 + fl, BL * 0.62, -BW * 1.2 + fl, BL * 0.78]);
    fs(ctx, '#d62839');
    star(ctx, fl * 0.5, 0, 6.2);
    ctx.fillStyle = '#ffd23f';
    ctx.fill();
  }
  // collar
  rrect(ctx, -BW * 0.86, -BL + 1.5, BW * 1.72, 5.4, 2.4);
  fs(ctx, o.collar || '#e5383b', 1.2);
  if (look.extra === 'scarf') {
    poly(ctx, [-3, -BL + 6, 8, -BL + 6, 6, -BL + 16]);
    fs(ctx, o.collar || '#e5383b', 1.2);
  }
  ctx.save();
  ctx.translate(0, -BL - 5);
  ctx.rotate(sw * 0.07 * (0.4 + sp));
  headTop(ctx, look, o);
  ctx.restore();
  ctx.restore();
}

// Front-facing portrait for menus and the HUD. Draws inside a circle of radius r at 0,0.
export function drawDogFace(ctx, look, r, o = {}) {
  const k = r / 50;
  const t = o.t || 0;
  ctx.save();
  ctx.scale(k, k);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const head = look.head;
  const rx = head === 'broad' ? 34 : head === 'long' ? 24 : head === 'wedge' ? 28 : 30;
  const ry = head === 'long' ? 33 : 29;
  const ec = look.earColor || look.shade;
  const cy = 2;
  // collar and neck
  ell(ctx, 0, cy + ry + 6, rx * 0.72, 13);
  fs(ctx, whiteSocks(look.pattern) ? look.light : look.coat, 2.4);
  if (look.extra === 'cape') {
    poly(ctx, [-rx * 0.95, cy + ry + 2, rx * 0.95, cy + ry + 2, rx * 1.25, 52, -rx * 1.25, 52]);
    fs(ctx, '#d62839', 2.4);
  }
  rrect(ctx, -rx * 0.74, cy + ry - 2, rx * 1.48, 10, 5);
  fs(ctx, o.collar || '#e5383b', 2.2);
  if (look.extra === 'scarf') {
    poly(ctx, [-8, cy + ry + 6, 16, cy + ry + 6, 10, cy + ry + 24]);
    fs(ctx, o.collar || '#e5383b', 2.2);
  } else {
    if (look.extra === 'cape') star(ctx, 0, cy + ry + 11, 8);
    else ell(ctx, 0, cy + ry + 10, 5.5, 5.5);
    fs(ctx, '#ffd23f', 1.8);
  }
  // ears behind the head
  const wob = Math.sin(t * 3) * 0.04;
  const ear = (s) => {
    ctx.save();
    ctx.scale(s, 1);
    ctx.rotate(wob * s);
    if (look.ear === 'flop') {
      ctx.beginPath();
      ctx.moveTo(rx * 0.55, cy - ry * 0.75);
      ctx.quadraticCurveTo(rx + 14, cy - ry * 0.7, rx + 9, cy + 16);
      ctx.quadraticCurveTo(rx + 2, cy + 26, rx - 6, cy + 6);
      ctx.closePath();
      fs(ctx, ec, 2.4);
    } else if (look.ear === 'rose') {
      ctx.beginPath();
      ctx.moveTo(rx * 0.45, cy - ry * 0.85);
      ctx.quadraticCurveTo(rx + 2, cy - ry - 12, rx + 13, cy - ry * 0.55);
      ctx.quadraticCurveTo(rx + 4, cy - ry * 0.3, rx * 0.85, cy - ry * 0.3);
      ctx.closePath();
      fs(ctx, ec, 2.4);
    } else if (look.ear === 'point') {
      poly(ctx, [rx * 0.25, cy - ry * 0.8, rx * 0.78, cy - ry - 24, rx * 1.02, cy - ry * 0.35]);
      fs(ctx, ec, 2.4);
      poly(ctx, [rx * 0.48, cy - ry * 0.8, rx * 0.76, cy - ry - 13, rx * 0.9, cy - ry * 0.55]);
      ctx.fillStyle = '#f4b6a6';
      ctx.fill();
    } else {
      poly(ctx, [rx * 0.2, cy - ry * 0.7, rx * 1.32, cy - ry - 22, rx * 1.08, cy - ry * 0.1]);
      fs(ctx, ec, 2.4);
      poly(ctx, [rx * 0.5, cy - ry * 0.65, rx * 1.16, cy - ry - 11, rx * 1.0, cy - ry * 0.3]);
      ctx.fillStyle = '#f4b6a6';
      ctx.fill();
    }
    ctx.restore();
  };
  ear(-1);
  ear(1);
  // head
  ctx.beginPath();
  if (head === 'broad') {
    ctx.moveTo(-rx, cy - 4);
    ctx.bezierCurveTo(-rx, cy - ry - 6, rx, cy - ry - 6, rx, cy - 4);
    ctx.bezierCurveTo(rx + 3, cy + ry * 0.9, rx * 0.5, cy + ry + 4, 0, cy + ry + 4);
    ctx.bezierCurveTo(-rx * 0.5, cy + ry + 4, -rx - 3, cy + ry * 0.9, -rx, cy - 4);
  } else if (head === 'wedge') {
    ctx.moveTo(-rx, cy - 6);
    ctx.bezierCurveTo(-rx, cy - ry - 6, rx, cy - ry - 6, rx, cy - 6);
    ctx.bezierCurveTo(rx, cy + ry * 0.6, rx * 0.45, cy + ry + 3, 0, cy + ry + 3);
    ctx.bezierCurveTo(-rx * 0.45, cy + ry + 3, -rx, cy + ry * 0.6, -rx, cy - 6);
  } else {
    ctx.ellipse(0, cy, rx, ry, 0, 0, TAU);
  }
  ctx.closePath();
  const base = look.pattern === 'mask' ? look.shade : look.coat;
  fs(ctx, base, 2.6);
  ctx.save();
  ctx.clip();
  if (look.pattern === 'mask') {
    ell(ctx, -rx * 0.42, cy + 8, rx * 0.5, ry * 0.95);
    ctx.fillStyle = look.light;
    ctx.fill();
    ell(ctx, rx * 0.42, cy + 8, rx * 0.5, ry * 0.95);
    ctx.fill();
    ell(ctx, 0, cy + ry * 0.7, rx * 0.8, ry * 0.6);
    ctx.fill();
  }
  if (look.pattern === 'saddle') {
    ell(ctx, 0, cy - ry * 0.95, rx * 0.7, ry * 0.5);
    ctx.fillStyle = look.shade;
    ctx.fill();
  }
  if (look.pattern === 'chest' || look.pattern === 'blaze' || look.pattern === 'corgi') {
    ctx.beginPath();
    ctx.moveTo(-4, cy - ry - 4);
    ctx.lineTo(4, cy - ry - 4);
    ctx.quadraticCurveTo(7, cy, 13, cy + ry * 0.4);
    ctx.lineTo(-13, cy + ry * 0.4);
    ctx.quadraticCurveTo(-7, cy, -4, cy - ry - 4);
    ctx.fillStyle = look.light;
    ctx.fill();
  }
  if (look.pattern === 'brindle') {
    ctx.strokeStyle = look.shade;
    ctx.lineWidth = 2.4;
    for (const yy of [-20, -13, -6]) {
      ctx.beginPath();
      ctx.moveTo(-rx, cy + yy + 6);
      ctx.lineTo(-rx * 0.45, cy + yy);
      ctx.moveTo(rx, cy + yy + 6);
      ctx.lineTo(rx * 0.45, cy + yy);
      ctx.stroke();
    }
  }
  ctx.restore();
  // muzzle
  const mw = head === 'broad' ? 21 : head === 'long' ? 13 : head === 'wedge' ? 15 : 17;
  const mY = cy + ry * 0.42;
  ell(ctx, 0, mY, mw, 13.5);
  fs(ctx, muzzleColor(look), 2.2);
  // mouth and tongue
  if (o.mouth !== 'closed') {
    ctx.beginPath();
    ctx.moveTo(-mw * 0.62, mY + 2);
    ctx.quadraticCurveTo(0, mY + 19, mw * 0.62, mY + 2);
    ctx.closePath();
    fs(ctx, '#5a2230', 2);
    ell(ctx, 0, mY + 10 + Math.sin(t * 8) * 1.2, mw * 0.3, 7);
    fs(ctx, '#ff7d95', 1.6);
  }
  ctx.beginPath();
  ctx.moveTo(-mw * 0.62, mY + 2);
  ctx.quadraticCurveTo(-mw * 0.3, mY + 7, 0, mY + 1);
  ctx.quadraticCurveTo(mw * 0.3, mY + 7, mw * 0.62, mY + 2);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  // nose
  ctx.beginPath();
  ctx.moveTo(-6.5, mY - 9);
  ctx.quadraticCurveTo(0, mY - 12, 6.5, mY - 9);
  ctx.quadraticCurveTo(4, mY - 1, 0, mY);
  ctx.quadraticCurveTo(-4, mY - 1, -6.5, mY - 9);
  ctx.closePath();
  fs(ctx, look.nose, 1.6);
  ell(ctx, -2, mY - 8, 1.8, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
  // eyes
  const ex = rx * 0.46, ey = cy - ry * 0.22;
  const blink = o.blink || (Math.sin(t * 1.7) > 0.985);
  for (const s of [-1, 1]) {
    if (blink) {
      ctx.beginPath();
      ctx.moveTo(s * ex - 5, ey);
      ctx.lineTo(s * ex + 5, ey);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2.4;
      ctx.stroke();
    } else {
      ell(ctx, s * ex, ey, 5.4, 6.2);
      fs(ctx, look.eye === '#4fb3e8' ? '#4fb3e8' : '#2a1c16', 1.8);
      ell(ctx, s * ex, ey + 0.5, 2.6, 3.2);
      ctx.fillStyle = '#120c10';
      ctx.fill();
      ell(ctx, s * ex - 1.6, ey - 2.2, 1.7, 1.7);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
    if (look.brow) {
      ell(ctx, s * ex, ey - 11, 4, 3);
      ctx.fillStyle = look.brow;
      ctx.fill();
    } else if (look.pattern === 'mask') {
      ell(ctx, s * ex, ey - 10.5, 3.2, 2.6);
      ctx.fillStyle = look.light;
      ctx.fill();
    }
  }
  ctx.restore();
}

export const CAT = { coat: '#fbf7ef', patch: '#f08a24', dark: '#c96a12' };

// o: { run, state ('run' | 'sit'), t, toy }
export function drawCatTop(ctx, o = {}) {
  const run = o.run || 0, t = o.t || 0;
  const sit = o.state === 'sit';
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ell(ctx, 2, 5, sit ? 14 : 11, sit ? 15 : 22);
  ctx.fillStyle = 'rgba(0,0,0,0.17)';
  ctx.fill();
  // tail
  ctx.save();
  ctx.translate(0, sit ? 9 : 15);
  const sway = Math.sin(t * (sit ? 4 : 9) + run) * (sit ? 0.9 : 0.5);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(8 * sway, 8, -12 * sway, 16, 9 * sway, sit ? 20 : 26);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 6.4;
  ctx.stroke();
  ctx.strokeStyle = CAT.patch;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = CAT.dark;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  if (!sit) {
    const sw = Math.sin(run) * 6;
    for (const [sx, sy, ph] of [[-1, -1, 1], [1, -1, -1], [-1, 1, -1], [1, 1, 1]]) {
      ell(ctx, sx * 6.5, sy * 10 + ph * sw, 3, 5.5);
      fs(ctx, CAT.coat, 1.3);
    }
  }
  ell(ctx, 0, 0, sit ? 11.5 : 8.6, sit ? 12 : 17);
  fs(ctx, CAT.coat);
  ctx.save();
  ell(ctx, 0, 0, sit ? 11 : 8, sit ? 11.5 : 16.5);
  ctx.clip();
  ell(ctx, 4, 5, 7, 8);
  ctx.fillStyle = CAT.patch;
  ctx.fill();
  ell(ctx, -6, -6, 5, 5);
  ctx.fill();
  ctx.restore();
  // head (looks back at the dogs when sitting)
  ctx.save();
  ctx.translate(0, sit ? -9 : -18);
  if (sit) ctx.rotate(Math.PI + Math.sin(t * 2) * 0.15);
  for (const s of [-1, 1]) {
    poly(ctx, [s * 3, -5, s * 9.5, -11, s * 8.5, -1]);
    fs(ctx, s < 0 ? CAT.patch : CAT.coat, 1.4);
  }
  ell(ctx, 0, 0, 8.8, 7.8);
  fs(ctx, CAT.coat);
  ctx.save();
  ell(ctx, 0, 0, 8.2, 7.2);
  ctx.clip();
  ell(ctx, -6, -3, 6, 6);
  ctx.fillStyle = CAT.patch;
  ctx.fill();
  ctx.restore();
  for (const s of [-1, 1]) {
    ell(ctx, s * 3.6, -2.2, 1.7, 2.1);
    ctx.fillStyle = '#2f9e44';
    ctx.fill();
    ell(ctx, s * 3.6, -2.2, 0.6, 1.8);
    ctx.fillStyle = '#111';
    ctx.fill();
  }
  ell(ctx, 0, -6.2, 1.5, 1.1);
  ctx.fillStyle = '#ff8fa3';
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,30,40,0.6)';
  ctx.lineWidth = 0.7;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 3, -5.4);
    ctx.lineTo(s * 12, -7);
    ctx.moveTo(s * 3, -4.8);
    ctx.lineTo(s * 12, -3.4);
    ctx.stroke();
  }
  if (o.toy !== false) {
    // the Golden Squeaky
    ell(ctx, 0, -10.5, 4.6, 3.8);
    fs(ctx, '#ffd23f', 1.2);
    star(ctx, 0, -10.5, 2.4);
    ctx.fillStyle = '#fff3b0';
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();
}

export function drawCatFace(ctx, r) {
  const k = r / 20;
  ctx.save();
  ctx.scale(k, k);
  ctx.lineJoin = 'round';
  for (const s of [-1, 1]) {
    poly(ctx, [s * 5, -11, s * 17, -21, s * 17, -3]);
    fs(ctx, s < 0 ? CAT.patch : CAT.coat, 2);
  }
  ell(ctx, 0, 0, 17, 14.5);
  fs(ctx, CAT.coat, 2);
  ctx.save();
  ell(ctx, 0, 0, 16, 13.5);
  ctx.clip();
  ell(ctx, -12, -8, 11, 10);
  ctx.fillStyle = CAT.patch;
  ctx.fill();
  ctx.restore();
  for (const s of [-1, 1]) {
    ell(ctx, s * 6.5, -2, 3, 3.6);
    ctx.fillStyle = '#2f9e44';
    ctx.fill();
    ell(ctx, s * 6.5, -2, 1, 3);
    ctx.fillStyle = '#111';
    ctx.fill();
  }
  poly(ctx, [-2, 3.5, 2, 3.5, 0, 6]);
  ctx.fillStyle = '#ff8fa3';
  ctx.fill();
  ctx.restore();
}

// Kids face the dogs running up the track, so their faces point down the screen.
// o: { t, hug (0..1), done }
export function drawKid(ctx, look, o = {}) {
  const t = o.t || 0, hug = o.hug || 0;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ell(ctx, 2, 6, 13, 9);
  ctx.fillStyle = 'rgba(0,0,0,0.17)';
  ctx.fill();
  for (const s of [-1, 1]) {
    ell(ctx, s * 4.5, 9, 3.4, 4.6);
    fs(ctx, '#3b4252', 1.3);
  }
  // arms: open wide and waving, or wrapped in for the hug
  const wave = o.done ? 0.15 : Math.sin(t * 5) * 0.25;
  for (const s of [-1, 1]) {
    const a = hug > 0 ? 1.15 - hug * 0.75 : 0.35 + wave * s;
    const len = 13;
    const x0 = s * 9, y0 = 1;
    const x1 = x0 + Math.cos(a) * len * s, y1 = y0 + Math.sin(a) * len;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 6.6;
    ctx.stroke();
    ctx.strokeStyle = look.shirt;
    ctx.lineWidth = 4.2;
    ctx.stroke();
    ell(ctx, x1, y1, 2.8, 2.8);
    fs(ctx, look.skin, 1.2);
  }
  ell(ctx, 0, 1, 10.5, 7.5);
  fs(ctx, look.shirt);
  // head
  ctx.save();
  ctx.translate(0, -2);
  if (look.style === 1) {
    for (const s of [-1, 1]) {
      ell(ctx, s * 10.5, -1, 3.6, 4.4);
      fs(ctx, look.hair, 1.3);
    }
  }
  ell(ctx, 0, 0, 9, 9);
  fs(ctx, look.skin);
  ctx.save();
  ell(ctx, 0, 0, 8.4, 8.4);
  ctx.clip();
  if (look.style === 3) {
    ell(ctx, 0, -5.5, 10, 7);
    ctx.fillStyle = look.shirt === '#ff6b6b' ? '#4dabf7' : '#ff6b6b';
    ctx.fill();
  } else {
    ell(ctx, 0, -6, 10.5, look.style === 2 ? 8 : 6.6);
    ctx.fillStyle = look.hair;
    ctx.fill();
  }
  ctx.restore();
  if (look.style === 2) {
    for (let i = -2; i <= 2; i++) {
      ell(ctx, i * 3.6, -7.2 + Math.abs(i) * 0.9, 2.6, 2.6);
      ctx.fillStyle = look.hair;
      ctx.fill();
    }
  }
  for (const s of [-1, 1]) {
    ell(ctx, s * 3.2, 1.6, 1.25, 1.5);
    ctx.fillStyle = '#2a1c16';
    ctx.fill();
    ell(ctx, s * 5.4, 4, 1.6, 1.1);
    ctx.fillStyle = 'rgba(255,120,120,0.45)';
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 3.2, 3, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.strokeStyle = '#2a1c16';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// A Bad Owner seen from above, facing down the screen toward the dogs.
// o: { t, state, flinch, charge, throwing, boss, face (aim angle for the hose) }
export function drawVillain(ctx, look, o = {}) {
  const t = o.t || 0;
  const s = o.boss ? 1.42 : 1;
  ctx.save();
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const shake = o.flinch ? Math.sin(t * 40) * 1.6 : 0;
  ctx.translate(shake, 0);
  ell(ctx, 3, 7, 17, 12);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fill();
  for (const sd of [-1, 1]) {
    ell(ctx, sd * 6, 11, 4.4, 6);
    fs(ctx, '#1f2229', 1.4);
  }
  // arms
  const up = o.state === 'windup' ? -0.9 : o.throwing ? -1.1 : o.flinch ? -1.3 : 0.5;
  for (const sd of [-1, 1]) {
    const a = sd > 0 ? up : 0.7;
    const x0 = sd * 13, y0 = 2;
    const x1 = x0 + Math.cos(a) * 12 * sd, y1 = y0 + Math.sin(a) * 12;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.strokeStyle = look.shirt;
    ctx.lineWidth = 5.4;
    ctx.stroke();
    ell(ctx, x1, y1, 3.4, 3.4);
    fs(ctx, look.skin, 1.3);
    if (sd > 0) {
      o.handX = x1 * s;
      o.handY = y1 * s;
    }
  }
  ell(ctx, 0, 2, 15, 10.5);
  fs(ctx, look.shirt);
  ell(ctx, 0, 6, 9, 3.5);
  ctx.fillStyle = darker(look.shirt, 0.25);
  ctx.fill();
  // props held in the right hand
  const hx = o.handX / s, hy = o.handY / s;
  if (look.prop === 'megaphone') {
    ctx.save();
    ctx.translate(4, 9);
    poly(ctx, [-4, 0, 4, 0, 10, 15, -10, 15]);
    fs(ctx, o.charge > 0 ? mix('#f2f2f2', '#ff4d4d', o.charge) : '#f2f2f2', 1.5);
    ell(ctx, 0, 15, 10, 3);
    fs(ctx, '#c0392b', 1.3);
    ctx.restore();
  } else if (look.prop === 'firecracker') {
    ctx.save();
    ctx.translate(hx, hy);
    rrect(ctx, -2.5, -9, 5, 11, 2);
    fs(ctx, '#e03131', 1.2);
    star(ctx, 0, -11 + Math.sin(t * 30), 3.2, 4);
    ctx.fillStyle = '#ffd23f';
    ctx.fill();
    ctx.restore();
  } else if (look.prop === 'hose') {
    ctx.save();
    ctx.translate(hx, hy);
    rrect(ctx, -3, -3, 6, 9, 2);
    fs(ctx, '#f2c94c', 1.2);
    ctx.restore();
  }
  // head
  ctx.save();
  ctx.translate(0, -3);
  ell(ctx, 0, 0, 10, 10);
  fs(ctx, look.skin);
  // angry or scared face
  ctx.strokeStyle = '#2a1c16';
  ctx.lineWidth = 1.6;
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    if (o.flinch) {
      ctx.moveTo(sd * 1.6, -0.5);
      ctx.lineTo(sd * 5.6, 1.4);
    } else {
      ctx.moveTo(sd * 1.6, 1.6);
      ctx.lineTo(sd * 5.8, -0.6);
    }
    ctx.stroke();
    ell(ctx, sd * 3.6, 3, 1.3, o.flinch ? 2 : 1.4);
    ctx.fillStyle = '#2a1c16';
    ctx.fill();
  }
  ctx.beginPath();
  if (o.flinch) ctx.ellipse(0, 6.6, 2.2, 1.8, 0, 0, TAU);
  else ctx.arc(0, 8.4, 3, 1.15 * Math.PI, 1.85 * Math.PI);
  ctx.stroke();
  // hats
  switch (look.hatStyle) {
    case 'cap':
      ell(ctx, 0, -3, 10.4, 8);
      fs(ctx, look.hat, 1.5);
      ell(ctx, 0, 4, 7, 3.2);
      fs(ctx, darker(look.hat, 0.2), 1.3);
      break;
    case 'brim':
      ell(ctx, 0, -1, 14.5, 12);
      fs(ctx, look.hat, 1.5);
      ell(ctx, 0, -2, 8, 7);
      fs(ctx, lighter(look.hat, 0.14), 1.3);
      break;
    case 'beanie':
      ell(ctx, 0, -4, 10.4, 7.4);
      fs(ctx, look.hat, 1.5);
      ell(ctx, 0, -9.5, 2.6, 2.6);
      fs(ctx, lighter(look.hat, 0.3), 1.2);
      break;
    case 'spike':
      for (let i = -2; i <= 2; i++) {
        poly(ctx, [i * 4 - 2.6, -5, i * 4, -14 + Math.abs(i) * 2, i * 4 + 2.6, -5]);
        fs(ctx, look.hat, 1.2);
      }
      break;
    case 'tophat':
      ell(ctx, 0, -2, 14, 11);
      fs(ctx, look.hat, 1.5);
      ell(ctx, 0, -3, 8.6, 7.6);
      fs(ctx, '#2c2c34', 1.3);
      ctx.beginPath();
      ctx.arc(0, -3, 8.6, 0.1, Math.PI - 0.1);
      ctx.strokeStyle = '#d62839';
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
  }
  ctx.restore();
  if (o.flinch) {
    for (let i = 0; i < 3; i++) {
      const a = t * 7 + (i / 3) * TAU;
      star(ctx, Math.cos(a) * 15, -16 + Math.sin(a) * 5, 3.4);
      ctx.fillStyle = '#ffd23f';
      ctx.fill();
    }
  }
  ctx.restore();
}

// A tiny rescued pup. Six coat colours picked by index.
const PUPS = ['#c98a52', '#e9c46a', '#8794a6', '#3a3340', '#f3f1ea', '#b06a3b'];
const pupLooks = PUPS.map((c) => ({
  coat: c, shade: darker(c, 0.25), light: '#fbf7ef', pattern: 'chest', ear: 'flop', earColor: darker(c, 0.3),
  tail: 'whip', head: 'round', nose: '#2a2a33', eye: '#1d1620', len: 0.82, wid: 1.05
}));
export function drawPup(ctx, i, o = {}) {
  drawDogTop(ctx, pupLooks[i % pupLooks.length], Object.assign({ size: 0.5, collar: '#ffd23f' }, o));
}

export function drawBone(ctx, s = 1, glow = 0) {
  ctx.save();
  ctx.scale(s, s);
  ctx.rotate(-0.6);
  if (glow > 0) {
    ell(ctx, 0, 0, 16, 11);
    ctx.fillStyle = `rgba(255,244,190,${0.25 * glow})`;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(-8, -3, 3.6, 0, TAU);
  ctx.arc(-8, 3, 3.6, 0, TAU);
  ctx.arc(8, -3, 3.6, 0, TAU);
  ctx.arc(8, 3, 3.6, 0, TAU);
  ctx.rect(-8, -2.6, 16, 5.2);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.6;
  ctx.stroke();
  ctx.fillStyle = '#fffaf0';
  ctx.fill();
  ctx.restore();
}

export function drawCage(ctx, open, t = 0, pup = 0) {
  ctx.save();
  ctx.lineJoin = 'round';
  rrect(ctx, -13, -11, 26, 22, 3);
  fs(ctx, 'rgba(40,40,52,0.55)', 1.6);
  if (!open) {
    ctx.save();
    ctx.translate(0, 3 + Math.sin(t * 6) * 0.6);
    drawPup(ctx, pup, { noShadow: true, size: 0.42, wag: Math.sin(t * 3) * 0.2 });
    ctx.restore();
  }
  ctx.strokeStyle = '#aab0bd';
  ctx.lineWidth = 1.8;
  for (let i = -2; i <= 2; i++) {
    if (open && i > -2) continue;
    ctx.beginPath();
    ctx.moveTo(i * 5.2, -11);
    ctx.lineTo(i * 5.2, 11);
    ctx.stroke();
  }
  ctx.restore();
}

// Things you can knock over or bump into.
export function drawProp(ctx, kind, t = 0) {
  ctx.save();
  ctx.lineJoin = 'round';
  switch (kind) {
    case 'can':
      ell(ctx, 2, 3, 17, 15);
      ctx.fillStyle = 'rgba(0,0,0,0.17)';
      ctx.fill();
      ell(ctx, 0, 0, 16, 16);
      fs(ctx, '#9aa3b2', 1.8);
      ell(ctx, 0, 0, 11, 11);
      fs(ctx, '#7f8898', 1.4);
      rrect(ctx, -5, -2, 10, 4, 2);
      fs(ctx, '#c9cfdb', 1.2);
      break;
    case 'cone':
      ell(ctx, 2, 3, 16, 14);
      ctx.fillStyle = 'rgba(0,0,0,0.17)';
      ctx.fill();
      rrect(ctx, -15, -15, 30, 30, 5);
      fs(ctx, '#f76707', 1.8);
      ell(ctx, 0, 0, 10, 10);
      fs(ctx, '#fff', 1.2);
      ell(ctx, 0, 0, 5.5, 5.5);
      fs(ctx, '#f76707', 1.2);
      break;
    case 'ball':
      ell(ctx, 2, 3, 15, 13);
      ctx.fillStyle = 'rgba(0,0,0,0.17)';
      ctx.fill();
      ell(ctx, 0, 0, 15, 15);
      fs(ctx, '#fff', 1.8);
      ctx.save();
      ell(ctx, 0, 0, 14.2, 14.2);
      ctx.clip();
      ['#ff6b6b', '#ffd43b', '#4dabf7'].forEach((c, i) => {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 16, (i * 2 * TAU) / 6, ((i * 2 + 1) * TAU) / 6);
        ctx.closePath();
        ctx.fillStyle = c;
        ctx.fill();
      });
      ctx.restore();
      break;
    case 'barrel':
      ell(ctx, 2, 3, 17, 15);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fill();
      ell(ctx, 0, 0, 16, 16);
      fs(ctx, '#9c6b3f', 1.8);
      ell(ctx, 0, 0, 12, 12);
      fs(ctx, '#7d5330', 1.3);
      ell(ctx, 0, 0, 3, 3);
      fs(ctx, '#2f2a26', 1);
      break;
    case 'crate':
      rrect(ctx, -21, -19, 46, 46, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fill();
      rrect(ctx, -23, -23, 46, 46, 3);
      fs(ctx, '#b98950', 2);
      ctx.strokeStyle = '#8a6234';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-19, -19);
      ctx.lineTo(19, 19);
      ctx.moveTo(19, -19);
      ctx.lineTo(-19, 19);
      ctx.stroke();
      ctx.strokeRect(-19, -19, 38, 38);
      break;
  }
  ctx.restore();
}

// Scenery at the edges of the track. Drawn at (0,0), pointing into the track from side (+1 right, -1 left).
export function drawDecor(ctx, kind, side, v, night) {
  ctx.save();
  ctx.lineJoin = 'round';
  switch (kind) {
    case 'tree': {
      const g = ['#2f9e44', '#37b24d', '#2b8a3e', '#40a44b'][v % 4];
      ell(ctx, 5, 8, 44, 40);
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.fill();
      ell(ctx, 0, 0, 42, 40);
      fs(ctx, g, 2);
      ell(ctx, -10, -10, 22, 20);
      ctx.fillStyle = lighter(g, 0.14);
      ctx.fill();
      ell(ctx, 12, 8, 14, 12);
      ctx.fillStyle = darker(g, 0.1);
      ctx.fill();
      break;
    }
    case 'bush':
      ell(ctx, 0, 0, 26, 20);
      fs(ctx, '#3f8f4a', 2);
      ell(ctx, -7, -5, 10, 8);
      ctx.fillStyle = '#58ab60';
      ctx.fill();
      break;
    case 'flowers': {
      const cols = ['#ff6b6b', '#ffd43b', '#da77f2', '#fff'];
      for (let i = 0; i < 7; i++) {
        const a = i * 2.4, r = 6 + ((i * 7) % 14);
        ell(ctx, Math.cos(a) * r, Math.sin(a) * r, 4.4, 4.4);
        fs(ctx, cols[(i + v) % 4], 1.2);
        ell(ctx, Math.cos(a) * r, Math.sin(a) * r, 1.5, 1.5);
        ctx.fillStyle = '#f59f00';
        ctx.fill();
      }
      break;
    }
    case 'house': {
      const roof = ['#c0392b', '#8e5b3a', '#4a6fa5', '#6b4f9e'][v % 4];
      rrect(ctx, -60, -52, 120, 104, 4);
      fs(ctx, roof, 2.4);
      ctx.strokeStyle = darker(roof, 0.25);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -52);
      ctx.lineTo(0, 52);
      ctx.stroke();
      rrect(ctx, -side * 60 - 6, -9, 12, 18, 2);
      fs(ctx, '#f4ecd8', 1.6);
      break;
    }
    case 'mailbox':
      rrect(ctx, -side * 20 - 6, -8, 12, 16, 3);
      fs(ctx, '#4dabf7', 1.6);
      rrect(ctx, -side * 20 - 2, -12, 4, 6, 1);
      fs(ctx, '#e03131', 1);
      break;
    case 'bench':
      rrect(ctx, -side * 14 - 9, -24, 18, 48, 3);
      fs(ctx, '#9c6b3f', 1.8);
      ctx.strokeStyle = '#7d5330';
      ctx.lineWidth = 1.6;
      for (const y of [-12, 0, 12]) {
        ctx.beginPath();
        ctx.moveTo(-side * 14 - 9, y);
        ctx.lineTo(-side * 14 + 9, y);
        ctx.stroke();
      }
      break;
    case 'building': {
      const c = ['#5c677d', '#7d6b5d', '#4f5d75', '#6d597a'][v % 4];
      rrect(ctx, -64, -70, 128, 140, 3);
      fs(ctx, c, 2.4);
      ctx.fillStyle = night > 0.1 ? '#ffe08a' : '#cfe3f5';
      for (let y = -56; y < 60; y += 28) {
        rrect(ctx, -side * 58 - 5, y, 10, 16, 2);
        ctx.fill();
      }
      break;
    }
    case 'lamp':
      if (night > 0.05) {
        const g = ctx.createRadialGradient(-side * 34, 0, 4, -side * 34, 0, 120);
        g.addColorStop(0, `rgba(255,224,138,${0.5 * Math.min(1, night * 2.4)})`);
        g.addColorStop(1, 'rgba(255,224,138,0)');
        ell(ctx, -side * 34, 0, 120, 120);
        ctx.fillStyle = g;
        ctx.fill();
      }
      ell(ctx, -side * 24, 0, 5, 5);
      fs(ctx, '#2f3440', 1.6);
      ell(ctx, -side * 34, 0, 7, 7);
      fs(ctx, '#ffe08a', 1.6);
      break;
    case 'hydrant':
      ell(ctx, -side * 22, 0, 8, 8);
      fs(ctx, '#e03131', 1.8);
      ell(ctx, -side * 22, 0, 3.4, 3.4);
      fs(ctx, '#ff8787', 1.2);
      break;
    case 'planter':
      rrect(ctx, -side * 22 - 12, -12, 24, 24, 4);
      fs(ctx, '#8d6e63', 1.8);
      ell(ctx, -side * 22, 0, 9, 9);
      fs(ctx, '#37b24d', 1.4);
      break;
    case 'boat': {
      ctx.save();
      ctx.translate(side * 16, 0);
      ctx.beginPath();
      ctx.moveTo(-18, -44);
      ctx.quadraticCurveTo(0, -66, 18, -44);
      ctx.lineTo(18, 40);
      ctx.quadraticCurveTo(0, 50, -18, 40);
      ctx.closePath();
      fs(ctx, ['#f1f3f5', '#ffd43b', '#ff8787', '#74c0fc'][v % 4], 2.2);
      rrect(ctx, -10, -18, 20, 34, 3);
      fs(ctx, '#9c6b3f', 1.6);
      ctx.restore();
      break;
    }
    case 'bollard':
      ell(ctx, -side * 26, 0, 8, 8);
      fs(ctx, '#495057', 1.8);
      ell(ctx, -side * 26, 0, 4, 4);
      fs(ctx, '#ffd43b', 1.2);
      break;
    case 'crates':
      ctx.translate(-side * 6, 0);
      ctx.scale(0.8, 0.8);
      drawProp(ctx, 'crate');
      ctx.translate(side * 20, 40);
      drawProp(ctx, 'crate');
      break;
  }
  ctx.restore();
}
