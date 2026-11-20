// 神様転生ゲーム：背景合成 第3版「描き込み版」（2026-11-18 依頼者承認「背景ちょうどいい」）
// 192×108 ドット。色は6段の濃淡（影は青紫寄り、光は黄寄り）。光は左上から。画像生成は使わない。
// 使い方：
//   RichCore.stage({ place: 'village', time: 'night' }, [人物の絵, 人物の絵])  →  {w,h,px}   time: day / dusk / night
//   RichCore.shadeSprite(SpriteCore.composeCharacter(look))                       →  影と光を足した人物の絵
// 場面を足すとき：PLACES に { n, slots, draw(K, time) } を書く。K は下の「道具」。靴底の線は y=93、立ち位置は slots。
(function (g) {
  const W = 192, H = 108, FOOT = 93;
  const R = {
    grass: ['#1f4a3a', '#2f6b3f', '#4a9440', '#76b947', '#a8d65a', '#d4ee84'],
    leaf: ['#173b36', '#22573e', '#34793f', '#58a04a', '#8cc653', '#c3e37a'],
    wood: ['#3a2233', '#5a3340', '#7f4a42', '#a86b4a', '#cf9560', '#ecc385'],
    stone: ['#2e3147', '#474c66', '#676f88', '#8f99ac', '#b9c3cc', '#e3e9ea'],
    roof: ['#4a1f3a', '#7a2a40', '#ad3b3f', '#d55a3e', '#ee8a4b', '#f7bd6c'],
    dirt: ['#4a2f33', '#6e4538', '#96633f', '#bd8a52', '#dcb36f', '#f0d79a'],
    sky: ['#3a6fd0', '#4f93e3', '#6fb8ee', '#9ad8f4', '#c9eef8', '#f1fbf6'],
    dusk: ['#3b2a63', '#7a3a78', '#c4506f', '#f0825a', '#fbb968', '#ffe9a8'],
    night: ['#0f1230', '#161b45', '#1f2a62', '#2c3f85', '#3f5aa8', '#5f7fc8'],
    wall: ['#8a6f6b', '#b99a84', '#dcc3a2', '#f2e3c4', '#fdf6e0'],
    far: ['#6f8fc9', '#8aa8d8', '#a9c2e6', '#c8dcf1'],
    hill: ['#2f6f66', '#3f8a6a', '#57a56c', '#7dbf78'],
    rock: ['#1b1a33', '#2a2a4a', '#3d4066', '#565c85', '#7880a6', '#a3aecb'],
    gem: ['#1b3a6b', '#2a6fb0', '#3fb6e0', '#8ae6f2', '#e3fbff'],
  };
  const FLOWERS = ['#ffffff', '#ffd24a', '#e8506e', '#b07be0', '#ff9f5a'];
  const ALL = Object.values(R);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + (s || 0) * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const noise = (x, y, sc, s) => { const fx = x / sc, fy = y / sc, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, sm = t => t * t * (3 - 2 * t);
    const a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), c = hash(x0, y0 + 1, s), d = hash(x0 + 1, y0 + 1, s); return a + (b - a) * sm(tx) + (c - a) * sm(ty) + (a - b - c + d) * sm(tx) * sm(ty); };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const dith = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
  const rgb = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const hex = (r, gg, b) => '#' + [r, gg, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };

  // ---- 道具 ----
  function kit() {
    const px = new Array(W * H).fill('#000000'), glow = [], emit = new Uint8Array(W * H), stand = new Uint8Array(W * H), fore = [];
    const K = { W, H, FOOT, R, FLOWERS, px, glow, emit, stand, fore, clamp, hash, noise, dith, mix };
    const set = K.set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H && c) { px[y * W + x] = c; emit[y * W + x] = 0; } };
    const get = K.get = (x, y) => px[clamp(Math.round(y), 0, H - 1) * W + clamp(Math.round(x), 0, W - 1)];
    const rect = K.rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); };
    // 濃淡の段から値 v（0〜1）に合う色。ramp＝網点でなじませる（空向き）、rampN＝粒でなじませる（草・土・岩向き）
    const ramp = K.ramp = (r, v, x, y) => { const f = clamp(v, 0, 0.999) * (r.length - 1), i = Math.floor(f); return r[f - i > dith(x, y) ? i + 1 : i]; };
    const rampN = K.rampN = (r, v, x, y, s) => { const f = clamp(v, 0, 0.999) * (r.length - 1), i = Math.floor(f); return r[f - i > 0.25 + hash(x, y, s) * 0.5 ? i + 1 : i]; };
    const shade = K.shade = (r, c, d) => { const i = r.indexOf(c); return i < 0 ? c : r[clamp(i + d, 0, r.length - 1)]; };
    const darker = K.darker = (c, d) => { for (const r of ALL) { const i = r.indexOf(c); if (i >= 0) return r[clamp(i - (d || 1), 0, r.length - 1)]; } return mix(c, '#12132a', 0.3 * (d || 1)); };
    const isIn = K.isIn = (r, x, y) => r.includes(get(x, y));
    // 光るもの：その色のまま光り、まわりを照らす（夜・洞窟で効く）
    const lit = K.lit = (x, y, c) => { set(x, y, c); x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) emit[y * W + x] = 1; };
    K.lamp = (x, y, r, color, power) => glow.push({ x, y, r, color: color || '#ffb347', power: power == null ? 1 : power });
    K.floor = (x0, x1, y0) => { for (let y = y0; y < H; y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) stand[y * W + x] = 1; }; // 立てる面
    K.solid = (x0, y0, x1, y1) => { for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) stand[y * W + x] = 0; }; // 物：その上には立てない

    // 空（時間で変わる）と雲・星・月
    K.sky = (time, bottom) => {
      const r = time === 'night' ? R.night : time === 'dusk' ? R.dusk : R.sky;
      for (let y = 0; y < bottom; y++) for (let x = 0; x < W; x++) set(x, y, ramp(r, (time === 'night' ? 0.02 : 0.08) + y / bottom * (time === 'night' ? 0.6 : 0.86), x, y));
      if (time === 'night') { for (let i = 0; i < 70; i++) { const x = Math.floor(hash(i, 1, 201) * W), y = Math.floor(hash(i, 2, 201) * bottom * 0.8), b = hash(i, 3, 201); set(x, y, b > 0.8 ? '#ffffff' : b > 0.4 ? '#c8dcf1' : '#8aa8d8'); if (b > 0.93) { set(x - 1, y, '#8aa8d8'); set(x + 1, y, '#8aa8d8'); set(x, y - 1, '#8aa8d8'); set(x, y + 1, '#8aa8d8'); } }
        for (const [mx, my, mr, c1, c2] of [[104, 15, 8, '#fdf6e0', '#dcc3a2'], [124, 30, 4, '#c9eef8', '#8aa8d8']]) for (let y = -mr; y <= mr; y++) for (let x = -mr; x <= mr; x++) if (x * x + y * y <= mr * mr) lit(mx + x, my + y, (x - 2) * (x - 2) + (y + 2) * (y + 2) > mr * mr * 0.9 || hash(mx + x, my + y, 202) < 0.08 ? c2 : c1); } // 月は2つ
      if (time === 'dusk') for (let y = -9; y <= 9; y++) for (let x = -9; x <= 9; x++) if (x * x + y * y <= 81) lit(96 + x, bottom - 6 + y, x * x + y * y < 36 ? '#fff3b8' : '#ffd873');
    };
    K.cloud = (cx, cy, s, time) => { const cols = time === 'dusk' ? ['#c4506f', '#f0825a', '#ffe9a8'] : time === 'night' ? ['#161b45', '#1f2a62', '#2c3f85'] : ['#b7cfe6', '#dbe9f3', '#ffffff'];
      const blobs = [[0, 0, 11, 5], [-9, 2, 7, 4], [9, 2, 8, 4], [-3, -3, 6, 4], [5, -2, 5, 3]].map(([dx, dy, rx, ry]) => [cx + dx * s, cy + dy * s, rx * s, ry * s]);
      for (let y = Math.floor(cy - 10 * s); y < cy + 8 * s; y++) for (let x = Math.floor(cx - 20 * s); x < cx + 20 * s; x++) { let best = -1, hy = 0; for (const [bx, by, rx, ry] of blobs) { const d = ((x - bx) / rx) ** 2 + ((y - by) / ry) ** 2; if (d <= 1 && 1 - d > best) { best = 1 - d; hy = (y - by) / ry; } }
        if (best >= 0) set(x, y, hy > 0.35 ? cols[0] : hy > -0.1 || best < 0.25 ? (dith(x, y) > 0.5 || hy > 0.15 ? cols[1] : cols[2]) : cols[2]); } };
    // 遠い山（とがった峰。左の斜面が明るい。高い峰に雪）
    K.mountains = (base, peaks, seed) => { const peak = x => { let h = 0; for (const [cx, hh, w] of peaks) h = Math.max(h, hh * (1 - Math.abs(x - cx) / w)); return h + (noise(x, 0, 5, seed) - 0.5) * 4; };
      for (let x = 0; x < W; x++) { const h = peak(x), top = Math.round(base - h), left = peak(x + 1) > peak(x - 1);
        for (let y = top; y < base + 6; y++) { const d = y - top; set(x, y, h > 23 && d < (h - 23) * 0.9 + (left ? 1 : -1) + hash(x, y, seed + 1) * 2 ? (left ? '#f1fbf6' : '#c8dcf1') : R.far[clamp((left ? 2 : 0) + (d > 14 ? 1 : 0) + (hash(x, y, seed + 2) < 0.1 ? 1 : 0), 0, 3)]); } } };
    // 近い丘と、その上の森
    K.hills = (base, amp, seed) => { const f = x => 0.55 * Math.sin(x * 0.03 + seed) + 0.3 * Math.sin(x * 0.09 + seed * 2.3) + 0.3 * (noise(x, 0, 9, seed * 7) - 0.5);
      for (let x = 0; x < W; x++) { const top = Math.round(base - amp * (0.5 + 0.5 * f(x))); for (let y = top; y < base + 12; y++) set(x, y, rampN(R.hill, 0.75 - (y - top) / 16 + (noise(x, y, 5, 11) - 0.5) * 0.5, x, y, 12)); }
      for (let x = -3; x < W + 3; x += 5) { const cy = base + 4 + Math.round(2 * Math.sin(x * 0.7)), r = 4 + Math.round(hash(x, 1, 5) * 2); for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r) set(x + xx, cy + yy, R.leaf[clamp(Math.round(2.2 - (xx + yy) * 0.35 + (hash(x + xx, cy + yy, 9) - 0.5) * 1.6), 0, 4)]); } };
    // 草の地面
    K.grass = (top, seed) => { for (let y = top; y < H; y++) for (let x = 0; x < W; x++) set(x, y, rampN(R.grass, 0.42 + (noise(x, y * 1.6, 9, seed) - 0.5) * 0.5 + (noise(x, y, 3, seed + 1) - 0.5) * 0.18 + (y - top) / (H - top) * 0.12, x, y, seed + 2)); K.floor(0, W - 1, top); };
    // 土の道：fx(y) が道の中心。手前ほど広い
    K.path = (y0, fx, w0, grow, seed) => { for (let y = y0; y < H; y++) { const cx = fx(y), half = w0 + (y - y0) * grow; for (let x = 0; x < W; x++) { const d = Math.abs(x - cx) + (noise(x, y, 4, seed) - 0.5) * 5; if (d < half) set(x, y, rampN(R.dirt, 0.55 + (noise(x, y, 6, seed + 1) - 0.5) * 0.5 - (d > half - 2 ? 0.25 : 0) + (hash(x, y, seed + 2) < 0.05 ? 0.3 : 0), x, y, seed + 3)); else if (d < half + 1.5 && isIn(R.grass, x, y)) set(x, y, R.grass[1]); } }
      for (let i = 0; i < 26; i++) { const y = y0 + 2 + Math.floor(hash(i, 1, seed + 4) * (H - y0 - 3)), x = Math.round(fx(y) + (hash(i, 2, seed + 4) - 0.5) * (w0 * 1.6 + (y - y0) * grow * 1.4)); if (isIn(R.dirt, x, y)) { set(x, y, R.stone[4]); set(x + 1, y, R.stone[3]); set(x, y + 1, R.dirt[1]); set(x + 1, y + 1, R.dirt[1]); } } };
    // 草の穂と花（地面の飾り）
    K.tufts = (top, n, seed) => { for (let i = 0; i < n; i++) { const x = Math.floor(hash(i, 1, seed) * W), y = top + 3 + Math.floor(hash(i, 2, seed) * (H - top - 4)), c = get(x, y); if (!R.grass.includes(c)) continue; const li = shade(R.grass, c, 1), dk = shade(R.grass, c, -1); set(x, y - 1, li); set(x - 1, y, li); set(x + 1, y - 1, li); set(x, y + 1, dk); set(x + 1, y + 1, dk); } };
    K.flowers = (top, n, seed) => { for (let i = 0; i < n; i++) { const x = Math.floor(hash(i, 1, seed) * W), y = top + 5 + Math.floor(hash(i, 2, seed) * (H - top - 7)); if (!isIn(R.grass, x, y) || !isIn(R.grass, x + 1, y + 1)) continue; const col = FLOWERS[Math.floor(hash(i, 3, seed) * 5)]; set(x, y, col); if (hash(i, 4, seed) > 0.5) { set(x - 1, y, col); set(x + 1, y, col); set(x, y - 1, col); set(x, y, '#ffd24a'); } set(x, y + 1, R.grass[1]); } };
    // 丸みのある物（葉のかたまり・茂み）。blobs: [[x, y, 半径], …]
    K.foliage = (blobs, r, seed) => { let x0 = W, x1 = 0, y0 = H, y1 = 0; for (const [bx, by, br] of blobs) { x0 = Math.min(x0, bx - br); x1 = Math.max(x1, bx + br); y0 = Math.min(y0, by - br); y1 = Math.max(y1, by + br); }
      for (let y = Math.floor(y0); y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) { let best = null, bd = 9; for (const b of blobs) { const d = Math.hypot(x - b[0], (y - b[1]) * 1.12) / b[2]; if (d <= 1 && d < bd) { bd = d; best = b; } } if (!best) continue;
        const nx = (x - best[0]) / best[2], ny = (y - best[1]) / best[2], v = 0.47 - (nx * 0.62 + ny * 0.78) * 0.42 + (noise(x, y, 2.2, seed) - 0.5) * 0.34 - (bd > 0.86 ? 0.16 : 0) - clamp((y - y0) / (y1 - y0) - 0.55, 0, 1) * 0.28;
        set(x, y, r[clamp(Math.round(v * (r.length - 1)), 0, r.length - 1)]); } };
    // 影を落とす（楕円）。草・土・岩の上だけ暗くする
    K.shadow = (cx, cy, rx, ry, d) => { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1) set(x, y, darker(get(x, y), d || (dith(x, y) > 0.3 ? 2 : 1))); };
    // 大きな木。x＝幹の中心、base＝根もと
    K.tree = (x, base, seed) => { K.shadow(x + 2, base + 2, 28, 4.5);
      for (let y = base - 42; y <= base; y++) { const w = 5 + (y > base - 7 ? (y - (base - 7)) * 0.9 : 0) + (y < base - 32 ? (base - 32 - y) * 0.3 : 0); for (let xx = Math.round(x - w); xx <= Math.round(x + w); xx++) { const t = (xx - (x - w)) / (2 * w); set(xx, y, R.wood[clamp(Math.round(4 - t * 3.4 + (hash(xx >> 1, y >> 2, seed) - 0.5) * 1.3 - ((xx + (y >> 3)) % 4 === 0 ? 1 : 0)), 0, 4)]); } }
      for (const [rx, d] of [[-9, -1], [9, 1]]) for (let k = 0; k < 6; k++) { set(x + rx + d * k, base - 1 + (k > 2 ? 1 : 0), R.wood[2]); set(x + rx + d * k, base + (k > 2 ? 1 : 0), R.wood[1]); }
      K.foliage([[-16, -46, 12], [15, -48, 13], [-2, -40, 11], [-22, -58, 11], [22, -61, 12], [-8, -64, 13], [8, -70, 13], [-15, -74, 10], [20, -76, 9], [1, -56, 13], [2, -81, 10]].map(([dx, dy, r]) => [x + dx, base + dy, r]), R.leaf, seed + 1);
      for (let i = 0; i < 46; i++) { const xx = x - 30 + Math.floor(hash(i, 1, seed + 2) * 62), yy = base - 86 + Math.floor(hash(i, 2, seed + 2) * 52); if (R.leaf.indexOf(get(xx, yy)) >= 3) { set(xx, yy, R.leaf[5]); set(xx + 1, yy, R.leaf[4]); } }
      for (const [dx, dy] of [[-13, -52], [10, -55], [24, -50], [-4, -68]]) { set(x + dx, base + dy, '#e8506e'); set(x + dx + 1, base + dy, '#e8506e'); set(x + dx, base + dy + 1, '#ad3b3f'); }
      K.solid(x - 9, base - 86, x + 9, base); };
    // 木組みの家。x＝左端、base＝地面、w＝幅。扉は人物がくぐれる大きさ（高さ29）
    K.cottage = (x, base, w, opt) => { opt = opt || {}; const wallH = 32, wt = base - wallH, seed = opt.seed || 51;
      for (let y = base - 2; y < base + 6; y++) for (let xx = x + 4; xx < x + w + 10 + (y - base); xx++) if (isIn(R.grass, xx, y)) set(xx, y, shade(R.grass, get(xx, y), -1));
      for (let y = wt; y < base; y++) for (let xx = x; xx < x + w; xx++) set(xx, y, ramp(R.wall, 0.78 + (noise(xx, y, 7, seed) - 0.5) * 0.3 - (y < wt + 5 ? 0.3 - (y - wt) * 0.05 : 0) - (xx > x + w - 6 ? 0.12 : 0), xx, y));
      for (let y = base - 6; y < base; y++) for (let xx = x; xx < x + w; xx++) { const row = Math.floor((y - (base - 6)) / 3), bx = (xx + row * 4) % 8, by = (y - (base - 6)) % 3; set(xx, y, bx === 0 || by === 2 ? R.stone[1] : R.stone[clamp(3 + (by === 0 ? 1 : 0) - (hash(Math.floor((xx + row * 4) / 8), row, seed + 1) < 0.3 ? 1 : 0), 0, 5)]); }
      const beam = (bx, by, bw, bh) => { for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) set(bx + i, by + j, R.wood[i === 0 || j === 0 ? 3 : (bw > bh ? j === bh - 1 : i === bw - 1) ? 1 : 2]); };
      beam(x, wt, 3, wallH - 6); beam(x + w - 3, wt, 3, wallH - 6); beam(x + 44, wt, 3, wallH - 6); beam(x, wt, w, 3); beam(x, wt + 13, 44, 2);
      for (let k = 0; k < 12; k++) { set(x + 3 + k, wt + 3 + Math.round(k * 0.85), R.wood[2]); set(x + 4 + k, wt + 3 + Math.round(k * 0.85), R.wood[1]); set(x + 43 - k, wt + 3 + Math.round(k * 0.85), R.wood[2]); set(x + 42 - k, wt + 3 + Math.round(k * 0.85), R.wood[1]); }
      const wx = x + 14, wy = wt + 16; rect(wx - 2, wy - 2, 20, 16, R.wood[1]); rect(wx - 1, wy - 1, 18, 14, R.wood[3]);
      for (let y = 0; y < 12; y++) for (let xx = 0; xx < 16; xx++) lit(wx + xx, wy + y, xx + y < 9 ? '#fff3b8' : xx + y < 17 ? '#ffd873' : '#ffb347');
      rect(wx + 7, wy, 2, 12, R.wood[2]); rect(wx, wy + 5, 16, 2, R.wood[2]); K.lamp(wx + 8, wy + 6, 26, '#ffb347', 0.9);
      for (const sx of [wx - 8, wx + 18]) { rect(sx, wy - 2, 6, 16, R.leaf[1]); rect(sx + 1, wy - 1, 4, 14, R.leaf[2]); for (let y = wy; y < wy + 13; y += 2) rect(sx + 1, y, 4, 1, R.leaf[3]); rect(sx, wy - 2, 1, 16, R.leaf[0]); }
      rect(wx - 3, wy + 14, 22, 4, R.wood[2]); rect(wx - 3, wy + 14, 22, 1, R.wood[4]); rect(wx - 3, wy + 17, 22, 1, R.wood[0]);
      for (let xx = wx - 2; xx < wx + 18; xx++) { set(xx, wy + 13, R.leaf[2 + (hash(xx, 1, 61) > 0.5 ? 1 : 0)]); if (hash(xx, 2, 61) > 0.45) set(xx, wy + 12, FLOWERS[Math.floor(hash(xx, 3, 61) * 5)]); if (hash(xx, 4, 61) > 0.7) set(xx, wy + 11, R.leaf[4]); }
      const dx = x + 50, dh = 29, dy = base - dh; rect(dx - 2, dy - 2, 18, dh + 2, R.wood[1]);
      for (let y = 0; y < dh; y++) for (let xx = 0; xx < 14; xx++) set(dx + xx, dy + y, xx % 5 === 4 ? R.wood[1] : R.wood[clamp(3 + (xx % 5 === 0 ? 1 : 0) - (hash(xx, y >> 2, 71) < 0.25 ? 1 : 0) - (y > dh - 5 ? 1 : 0), 0, 5)]);
      rect(dx, dy + 6, 14, 2, R.stone[1]); rect(dx, dy + 20, 14, 2, R.stone[1]); rect(dx + 10, dy + 14, 2, 3, '#ffd873'); set(dx + 10, dy + 14, '#fff3b8');
      rect(dx - 4, base - 1, 22, 3, R.stone[4]); rect(dx - 4, base + 2, 22, 1, R.stone[1]); rect(dx - 4, base - 1, 22, 1, R.stone[5]);
      for (let y = wt; y < wt + 3; y++) for (let xx = x; xx < x + w; xx++) set(xx, y, darker(get(xx, y), 1));
      K.tiledRoof(x, wt + 3, w, 35);
      const cx = x + 50, ct = wt - 44; for (let y = ct; y < ct + 20; y++) for (let xx = 0; xx < 9; xx++) { const row = Math.floor(y / 3), bx = (xx + row * 3) % 6; set(cx + xx, y, bx === 0 || (y % 3 + 3) % 3 === 2 ? R.stone[1] : R.stone[xx < 2 ? 4 : xx > 6 ? 2 : 3]); }
      rect(cx - 1, ct - 2, 11, 3, R.stone[2]); rect(cx - 1, ct - 2, 11, 1, R.stone[4]);
      if (opt.smoke !== false) for (const [sx, sy, r] of [[cx + 6, ct - 7, 3], [cx + 11, ct - 11, 4], [cx + 17, ct - 14, 4]]) for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r && dith(sx + xx, sy + yy + 8) < 0.72) set(sx + xx, sy + yy + 4, xx + yy < 0 ? '#f1fbf6' : '#dbe9f3');
      K.solid(x - 7, wt - 46, x + w + 7, base + 2); };
    // 瓦屋根（1枚ずつ：上が明るく下が暗い）。x・w＝壁の左端と幅、bottom＝軒の高さ、h＝屋根の高さ
    K.tiledRoof = (x, bottom, w, h, rr) => { const top = bottom - h, RF = rr || R.roof;
      for (let y = top; y < bottom; y++) { const t = (y - top) / h, x0 = Math.round(x + 12 - 18 * t), x1 = Math.round(x + w - 10 + 16 * t), row = Math.floor((y - top) / 4), ry = (y - top) % 4;
        for (let xx = x0; xx < x1; xx++) { const tx = (xx + row * 3) % 7, id = Math.floor((xx + row * 3) / 7), b = 2.6 + (hash(id, row, 81) - 0.5) * 1.6 - t * 0.8 + (xx - x0 < 4 ? 1 : 0) - (x1 - xx < 5 ? 1 : 0); set(xx, y, tx === 0 || ry === 3 ? RF[clamp(Math.round(b) - 2, 0, 5)] : RF[clamp(Math.round(b) + (ry === 0 ? 1 : 0), 0, 5)]); } }
      for (let xx = x + 11; xx < x + w - 9; xx++) { set(xx, top - 1, RF[5]); set(xx, top, RF[4]); }
      for (let xx = x - 7; xx < x + w + 7; xx++) { set(xx, bottom, RF[0]); set(xx, bottom + 1, R.wood[0]); } };
    // 柵（x0〜x1）、樽
    K.fence = (x0, x1, y) => { for (let x = x0; x < x1; x++) for (const yy of [y, y + 4]) { set(x, yy, R.wood[4]); set(x, yy + 1, R.wood[2]); }
      for (let x = x0; x <= x1; x += 10) { for (let yy = y - 4; yy < y + 10; yy++) { set(x, yy, R.wood[4]); set(x + 1, yy, R.wood[3]); set(x + 2, yy, R.wood[1]); } set(x, y - 5, R.wood[5]); set(x + 1, y - 5, R.wood[4]); for (let k = 0; k < 4; k++) if (isIn(R.grass, x + 3 + k, y + 10)) set(x + 3 + k, y + 10, shade(R.grass, get(x + 3 + k, y + 10), -1)); } K.solid(x0, y - 5, x1 + 2, y + 9); };
    K.barrel = (x, base) => { for (let y = base - 16; y < base; y++) { const bulge = Math.round(1.6 * Math.sin((y - base + 16) / 16 * Math.PI)); for (let xx = x - bulge; xx < x + 10 + bulge; xx++) { const t = (xx - (x - bulge)) / (10 + bulge * 2); set(xx, y, y === base - 13 || y === base - 4 ? R.stone[t < 0.3 ? 4 : t > 0.75 ? 1 : 2] : R.wood[clamp(Math.round(4.4 - t * 3.6) - ((xx - x) % 3 === 0 ? 1 : 0), 0, 5)]); } }
      rect(x, base - 17, 10, 1, R.wood[5]); for (let xx = x - 1; xx < x + 13; xx++) if (isIn(R.grass, xx, base)) set(xx, base, shade(R.grass, get(xx, base), -1)); K.solid(x - 2, base - 17, x + 12, base); };
    // 岩の面（洞窟の壁・床）
    K.rockFill = (x0, y0, x1, y1, lo, hi, seed) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, rampN(R.rock, lo + (noise(x, y, 11, seed) * 0.6 + noise(x, y, 4, seed + 1) * 0.4) * (hi - lo) - (hash(x >> 2, y, seed + 2) < 0.04 ? 0.15 : 0), x, y, seed + 3)); };
    // 水晶（面ごとに明暗。光る）
    K.crystal = (x, base, h, w) => { for (let y = 0; y < h; y++) { const t = y / h, half = t < 0.28 ? (t / 0.28) * w : w; for (let xx = -Math.round(half); xx <= Math.round(half); xx++) { const f = xx / (half + 0.01); lit(x + xx, base - h + y, R.gem[clamp(Math.round(f < -0.25 ? 4 - t * 1.2 : f < 0.3 ? 3 - t : 1.6 - t * 0.8), 0, 4)]); } }
      K.lamp(x, base - h * 0.55, h * 1.7 + 8, '#3fb6e0', 0.85); K.solid(x - w, base - h, x + w, base); };
    // 松明（壁掛け）
    K.torch = (x, y) => { rect(x - 1, y, 3, 8, R.wood[2]); rect(x - 1, y, 1, 8, R.wood[4]); rect(x - 2, y - 1, 5, 2, R.stone[2]);
      for (const [dx, dy, c] of [[0, -2, '#fff3b8'], [-1, -2, '#ffd873'], [1, -2, '#ffd873'], [0, -3, '#fff3b8'], [-1, -3, '#ffb347'], [1, -3, '#ffb347'], [0, -4, '#ffd873'], [0, -5, '#ffb347'], [-2, -2, '#f0825a'], [2, -2, '#f0825a'], [1, -5, '#f0825a'], [0, -6, '#f0825a']]) lit(x + dx, y + dy, c);
      K.lamp(x, y - 3, 34, '#ff9f5a', 1); };
    // 手前の草むら（人物より前に描く）
    K.foreGrass = (n, seed, skip) => fore.push(() => { for (let i = 0; i < n; i++) { const x = Math.floor(hash(i, 1, seed) * W), h = 3 + Math.floor(hash(i, 2, seed) * 6), lean = hash(i, 3, seed) > 0.5 ? 1 : -1; if (skip && skip(x)) continue; for (let k = 0; k < h; k++) set(x + (k > h - 3 ? lean : 0), H - 1 - k, R.grass[k > h - 2 ? 4 : k > 1 ? 3 : 1]); if (hash(i, 4, seed) > 0.82) set(x + lean, H - 1 - h, FLOWERS[i % 3]); } });
    // 町の家。x＝左端、base＝地面、w＝幅、wallH＝壁の高さ、roofH＝屋根の高さ。o: wall(色の並び) roof(色の並び) windows[[dx,dy,幅,高さ]] door(dx) sign([dx,dy,色])
    K.house = (x, base, w, wallH, roofH, o) => { o = o || {}; const wt = base - wallH, wr = o.wall || R.wall, seed = o.seed || 7;
      for (let y = wt; y < base; y++) for (let xx = x; xx < x + w; xx++) set(xx, y, ramp(wr, 0.78 + (noise(xx, y, 7, seed) - 0.5) * 0.3 - (y < wt + 6 ? 0.3 - (y - wt) * 0.05 : 0) - (xx > x + w - 6 ? 0.12 : 0), xx, y));
      for (let y = base - 5; y < base; y++) for (let xx = x; xx < x + w; xx++) { const row = Math.floor((y - (base - 5)) / 3), bx = (xx + row * 4) % 8, by = (y - (base - 5)) % 3; set(xx, y, bx === 0 || by === 2 ? R.stone[1] : R.stone[clamp(3 + (by === 0 ? 1 : 0) - (hash(Math.floor((xx + row * 4) / 8), row, seed + 1) < 0.3 ? 1 : 0), 0, 5)]); }
      const beam = (bx, by, bw, bh) => { for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) set(bx + i, by + j, R.wood[i === 0 || j === 0 ? 3 : (bw > bh ? j === bh - 1 : i === bw - 1) ? 1 : 2]); };
      beam(x, wt, 3, wallH - 5); beam(x + w - 3, wt, 3, wallH - 5); beam(x, wt, w, 3); if (wallH > 38) beam(x, wt + wallH - 34, w, 2);
      for (const [dx, dy, ww, hh] of o.windows || []) { const wx = x + dx, wy = wt + dy; rect(wx - 2, wy - 2, ww + 4, hh + 4, R.wood[1]); rect(wx - 1, wy - 1, ww + 2, hh + 2, R.wood[3]);
        for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) lit(wx + i, wy + j, i + j < ww * 0.55 ? '#fff3b8' : i + j < ww * 1.1 ? '#ffd873' : '#ffb347');
        rect(wx + (ww >> 1) - 1, wy, 2, hh, R.wood[2]); rect(wx, wy + (hh >> 1) - 1, ww, 1, R.wood[2]); rect(wx - 3, wy + hh + 2, ww + 6, 2, R.wood[2]); rect(wx - 3, wy + hh + 2, ww + 6, 1, R.wood[4]); K.lamp(wx + ww / 2, wy + hh / 2, 20, '#ffb347', 0.75); }
      if (o.door != null) { const dx = x + o.door, dh = 28, dy = base - dh; rect(dx - 2, dy - 2, 18, dh + 2, R.wood[1]);
        for (let y = 0; y < dh; y++) for (let xx = 0; xx < 14; xx++) set(dx + xx, dy + y, xx % 5 === 4 ? R.wood[1] : R.wood[clamp(3 + (xx % 5 === 0 ? 1 : 0) - (hash(xx, y >> 2, seed + 3) < 0.25 ? 1 : 0) - (y > dh - 5 ? 1 : 0), 0, 5)]);
        rect(dx, dy + 6, 14, 2, R.stone[1]); rect(dx, dy + 19, 14, 2, R.stone[1]); rect(dx + 10, dy + 13, 2, 3, '#ffd873'); set(dx + 10, dy + 13, '#fff3b8');
        rect(dx - 4, base - 1, 22, 3, R.stone[4]); rect(dx - 4, base + 2, 22, 1, R.stone[1]); rect(dx - 4, base - 1, 22, 1, R.stone[5]); }
      if (o.sign) { const [dx, dy, col] = o.sign, sx = x + dx, sy = wt + dy; rect(sx - 1, sy - 4, 14, 1, R.stone[1]); rect(sx + 1, sy - 3, 1, 3, R.stone[2]); rect(sx + 10, sy - 3, 1, 3, R.stone[2]);
        rect(sx, sy, 12, 9, R.wood[1]); rect(sx + 1, sy + 1, 10, 7, R.wood[4]); rect(sx + 1, sy + 1, 10, 1, R.wood[5]); rect(sx + 4, sy + 3, 4, 4, col); set(sx + 4, sy + 3, mix(col, '#ffffff', 0.5)); set(sx + 7, sy + 6, mix(col, '#1a1535', 0.4)); }
      for (let y = wt; y < wt + 3; y++) for (let xx = x; xx < x + w; xx++) set(xx, y, darker(get(xx, y), 1));
      K.tiledRoof(x, wt + 3, w, roofH, o.roof); K.solid(x - 7, wt - roofH, x + w + 7, base + 1); };
    // 街灯。x＝柱の左、base＝根もと
    K.post = (x, base, h) => { h = h || 30; rect(x, base - h, 2, h, R.stone[1]); rect(x, base - h, 1, h, R.stone[3]); rect(x - 1, base - 2, 4, 2, R.stone[2]); rect(x - 2, base - h - 1, 6, 1, R.stone[1]);
      for (let j = 0; j < 6; j++) for (let i = 0; i < 4; i++) lit(x - 1 + i, base - h - 7 + j, i === 0 || j === 0 ? '#fff3b8' : i === 3 || j === 5 ? '#ffb347' : '#ffd873'); rect(x - 2, base - h - 8, 6, 1, R.stone[1]); set(x, base - h - 9, R.stone[2]); set(x + 1, base - h - 9, R.stone[2]);
      K.lamp(x + 1, base - h - 4, 30, '#ffb347', 1); K.solid(x - 1, base - 3, x + 2, base); };
    // 石畳（top から下ぜんぶ）
    K.cobble = (top, seed) => { for (let y = top; y < H; y++) for (let x = 0; x < W; x++) { const row = Math.floor((y - top) / 4), ry = (y - top) % 4, ox = (row % 2) * 4 + Math.floor(hash(row, 1, seed) * 3), bx = (x + ox) % 8, id = Math.floor((x + ox) / 8), v = 2.9 + (hash(id, row, seed + 1) - 0.5) * 2.4 + (noise(x, y, 14, seed + 2) - 0.5) * 1.2;
        set(x, y, bx === 0 || ry === 3 ? R.stone[2] : hash(id, row, seed + 3) < 0.05 ? R.dirt[4] : R.stone[clamp(Math.round(3.3 + (v - 2.9) * 0.45) + (ry === 0 && bx < 6 ? 1 : 0), 3, 5)]); } K.floor(0, W - 1, top); };
    // 板の面。dir 'v'＝たて板（壁）、'h'＝よこ板（床）。lo〜hi＝明るさ
    K.planks = (x0, y0, x1, y1, dir, size, lo, hi, seed) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const a = dir === 'v' ? x : y, b = dir === 'v' ? y : x, id = Math.floor(a / size), off = Math.floor(hash(id, 3, seed) * 30), seam = a % size === 0 || (b + off) % 34 === 0;
        set(x, y, seam ? R.wood[clamp(Math.round(lo * 5) - 1, 0, 5)] : rampN(R.wood, lo + (hash(id, 1, seed) * 0.6 + noise(dir === 'v' ? x * 3 : x, dir === 'v' ? y : y * 3, 7, seed + 1) * 0.4) * (hi - lo) + (a % size === 1 ? 0.08 : 0), x, y, seed + 2)); } };
    // 炎（下が広く、芯が明るい）。x＝中心、base＝根もと
    K.flame = (x, base, w, h, seed) => { for (let y = 0; y < h; y++) { const t = y / h, half = w * (1 - t) * (0.8 + 0.3 * Math.sin(y * 1.7 + seed)); for (let xx = -Math.ceil(half); xx <= Math.ceil(half); xx++) { const d = Math.abs(xx + Math.sin(y * 0.9 + seed) * t * 2) / (half + 0.01); if (d <= 1) lit(x + xx, base - y, d < 0.3 && t < 0.6 ? '#fff3b8' : d < 0.6 && t < 0.8 ? '#ffd873' : d < 0.85 ? '#ffb347' : '#f0825a'); } } };
    return K;
  }

  // ---- 場面 ----  n 名前／slots 立ち位置（人物の中心 x）／inside 屋内（空なし・暗い）／draw(K, time)
  const PLACES = {
    village: { n: '村はずれ', slots: { 1: [112], 2: [104, 128], 3: [100, 118, 136] }, draw(K, time) {
      K.sky(time, 66); if (time !== 'night') { K.cloud(38, 14, 1.3, time); K.cloud(112, 9, 0.9, time); K.cloud(168, 22, 1.1, time); K.cloud(84, 30, 0.6, time); }
      K.mountains(60, [[20, 20, 30], [58, 30, 34], [96, 22, 28], [126, 34, 36], [168, 24, 32], [200, 28, 30], [-8, 26, 30]], 3); K.hills(56, 6, 4.2);
      K.grass(64, 21); const fx = y => 104 - 46 * Math.pow(K.clamp((H - y) / (H - 84), 0, 1), 2.15) + 6 * Math.sin(y * 0.16); K.path(84, fx, 5, 0.42, 31);
      K.cottage(12, 84, 70, { smoke: true }); K.tree(156, 92, 91); K.fence(96, 136, 77); K.barrel(85, 86);
      K.foliage([[16, 82, 6], [10, 84, 5], [21, 85, 4]], K.R.leaf, 111); K.foliage([[140, 86, 5], [146, 88, 4]], K.R.leaf, 112);
      for (const [x, y] of [[14, 79], [18, 82], [10, 83], [141, 84], [145, 87]]) { K.set(x, y, '#ffffff'); K.set(x + 1, y, '#ffd24a'); }
      K.tufts(64, 150, 121); K.flowers(64, 44, 131); K.foreGrass(70, 141, x => Math.abs(x - fx(H - 1)) < 22); } },
    cave: { n: '洞窟', inside: true, slots: { 1: [70], 2: [62, 132], 3: [50, 76, 136] }, draw(K) {
      const R = K.R;
      K.rockFill(0, 0, W - 1, 81, 0.05, 0.5, 301);
      for (let x = 0; x < W; x++) { const top = 34 + Math.round(5 * Math.sin(x * 0.07) + 3 * Math.sin(x * 0.19)); for (let y = top; y < 82; y++) K.set(x, y, K.rampN(R.rock, 0.3 + (K.noise(x, y, 9, 305) - 0.5) * 0.3 + (y - top) / 60 * 0.25, x, y, 306)); } // 奥の壁（下ほど少し明るい）
      for (let i = 0; i < 22; i++) { const x = Math.floor(K.hash(i, 1, 310) * W), y = 30 + Math.floor(K.hash(i, 2, 310) * 46), w = 4 + Math.floor(K.hash(i, 3, 310) * 12); for (let k = 0; k < w; k++) K.set(x + k, y + Math.round(Math.sin(k * 0.6)), R.rock[1]); } // 地層のひび
      for (let x = 0; x < W; x++) { const h = 6 + Math.round(4 * Math.abs(Math.sin(x * 0.21))) + (K.hash(x >> 2, 1, 311) > 0.7 ? Math.round(6 + K.hash(x >> 2, 2, 311) * 16) * (1 - Math.abs((x % 4) - 1.5) / 2.2) : 0); for (let y = 0; y < h; y++) K.set(x, y, y > h - 2 ? R.rock[2] : R.rock[x % 4 === 0 ? 1 : 0]); } // 天井とつらら石
      for (let y = 0; y < 82; y++) { const a = 7 + Math.round(4 * Math.sin(y * 0.16) + 2 * Math.sin(y * 0.41)), b = 8 + Math.round(4 * Math.sin(y * 0.13 + 2) + 2 * Math.sin(y * 0.37)); for (let x = 0; x < a; x++) K.set(x, y, R.rock[x > a - 2 ? 2 : x % 3 ? 0 : 1]); for (let x = W - b; x < W; x++) K.set(x, y, R.rock[x < W - b + 2 ? 2 : x % 3 ? 0 : 1]); }
      for (let y = 82; y < H; y++) for (let x = 0; x < W; x++) K.set(x, y, K.rampN(R.rock, 0.5 + (K.noise(x, y * 2, 8, 320) - 0.5) * 0.4 + (y - 82) / 26 * 0.12, x, y, 321)); // 床
      for (let x = 0; x < W; x++) { K.set(x, 82, R.rock[5]); if (x % 3) K.set(x, 83, R.rock[4]); } K.floor(0, W - 1, 82);
      for (let i = 0; i < 30; i++) { const x = Math.floor(K.hash(i, 1, 330) * W), y = 86 + Math.floor(K.hash(i, 2, 330) * 20); K.set(x, y, R.rock[5]); K.set(x + 1, y, R.rock[4]); K.set(x, y + 1, R.rock[1]); K.set(x + 1, y + 1, R.rock[1]); }
      for (let y = 96; y < 103; y++) for (let x = 20; x < 46; x++) if (((x - 33) / 13) ** 2 + ((y - 99) / 3.2) ** 2 < 1) K.set(x, y, y < 98 ? '#2a6fb0' : (x + y) % 5 === 0 ? '#8ae6f2' : '#1b3a6b'); K.solid(20, 96, 46, 103); // 水たまり
      K.crystal(96, 88, 30, 6); K.crystal(86, 90, 18, 4); K.crystal(107, 91, 22, 5); K.crystal(100, 93, 10, 3); K.crystal(164, 86, 12, 3); K.crystal(170, 88, 8, 2);
      K.torch(28, 52); K.torch(152, 50);
      K.fore.push(() => { for (const [cx, w, h] of [[4, 22, 12], [182, 26, 15], [150, 10, 5]]) for (let y = 0; y < h; y++) { const half = w * Math.sqrt(1 - (1 - y / h) ** 2) / 2; for (let x = Math.round(cx - half); x <= cx + half; x++) K.set(x, H - h + y, R.rock[y < 2 && x < cx ? 2 : x < cx - half * 0.3 ? 1 : 0]); } }); } },
    town: { n: '町の広場', slots: { 1: [96], 2: [82, 112], 3: [70, 96, 122] }, draw(K, time) {
      const R = K.R, SLATE = ['#1f2440', '#2f3a66', '#42558c', '#5a76ad', '#7f9fcb', '#a9c6e3'], STONEWALL = ['#676f88', '#8f99ac', '#b9c3cc', '#d3dbe0', '#e3e9ea'];
      K.sky(time, 80); if (time !== 'night') { K.cloud(30, 8, 0.9, time); K.cloud(150, 6, 1.0, time); }
      K.mountains(70, [[64, 30, 30], [132, 36, 34], [-4, 24, 26], [196, 26, 28]], 5);
      K.cobble(78, 501);
      K.house(68, 78, 56, 46, 24, { seed: 511, roof: SLATE, windows: [[7, 7, 10, 10], [23, 7, 10, 10], [39, 7, 10, 10], [7, 26, 12, 11]], door: 30, sign: [-13, 22, '#ffd24a'] });
      K.house(2, 78, 54, 34, 26, { seed: 521, windows: [[8, 9, 12, 11]], door: 30 });
      K.house(136, 78, 56, 36, 28, { seed: 531, wall: STONEWALL, windows: [[6, 10, 11, 11], [40, 10, 11, 11]], door: 21, sign: [44, 28, '#e8506e'] });
      for (let x = 0; x < W; x++) for (let y = 78; y < 81; y++) K.set(x, y, K.darker(K.get(x, y), y === 78 ? 2 : 1));                      // 家の足もとの影
      K.post(62, 86); K.post(130, 86); K.barrel(8, 90); K.barrel(20, 92);
      for (const [x, y] of [[176, 90], [164, 92]]) { K.rect(x, y - 10, 12, 10, R.wood[2]); K.rect(x, y - 10, 12, 1, R.wood[5]); K.rect(x, y - 10, 1, 10, R.wood[4]); K.rect(x + 11, y - 10, 1, 10, R.wood[0]); K.rect(x, y - 1, 12, 1, R.wood[0]); for (let k = 0; k < 8; k++) { K.set(x + 2 + k, y - 8 + k, R.wood[1]); K.set(x + 9 - k, y - 8 + k, R.wood[3]); } K.solid(x, y - 10, x + 12, y); } // 木箱
      K.foliage([[181, 76, 5], [186, 79, 4]], R.leaf, 541); K.set(180, 74, '#e8506e'); K.set(184, 76, '#ffd24a'); K.set(187, 78, '#ffffff');
      for (let i = 0; i < 16; i++) { const x = Math.floor(K.hash(i, 1, 551) * W), y = 84 + Math.floor(K.hash(i, 2, 551) * 22); if (R.stone.includes(K.get(x, y)) && K.get(x, y) !== R.stone[1]) { K.set(x, y, R.grass[2]); K.set(x + 1, y, R.grass[3]); K.set(x, y - 1, R.grass[4]); } } } }, // 石のすきまの草
    inn: { n: '宿屋の中', inside: true, slots: { 1: [100], 2: [88, 116], 3: [76, 100, 124] }, draw(K) {
      const R = K.R;
      for (let y = 0; y < 52; y++) for (let x = 0; x < W; x++) K.set(x, y, K.ramp(R.wall, 0.62 + (K.noise(x, y, 9, 601) - 0.5) * 0.3 - (y < 10 ? 0.25 : 0), x, y));                       // しっくいの壁
      K.planks(0, 52, W - 1, 71, 'v', 8, 0.3, 0.62, 611); K.rect(0, 50, W, 3, R.wood[1]); K.rect(0, 50, W, 1, R.wood[4]);                                                               // 腰板
      for (const x of [0, 62, 124, 188]) { K.rect(x, 0, 4, 52, R.wood[2]); K.rect(x, 0, 1, 52, R.wood[4]); K.rect(x + 3, 0, 1, 52, R.wood[0]); } K.rect(0, 0, W, 6, R.wood[1]); K.rect(0, 5, W, 1, R.wood[0]); K.rect(0, 0, W, 1, R.wood[3]); // 柱とはり
      K.planks(0, 72, W - 1, H - 1, 'h', 6, 0.42, 0.8, 621); K.rect(0, 72, W, 1, R.wood[0]); K.floor(0, W - 1, 73);                                                                    // 床
      { const wx = 84, wy = 14; K.rect(wx - 3, wy - 3, 30, 28, R.wood[1]); K.rect(wx - 2, wy - 2, 28, 26, R.wood[3]); for (let j = 0; j < 22; j++) for (let i = 0; i < 24; i++) K.set(wx + i, wy + j, j > 15 ? R.hill[j > 18 ? 1 : 2] : R.sky[K.clamp(1 + Math.floor(j / 4), 0, 5)]);
        for (const [cx, cy] of [[5, 5], [6, 5], [7, 5], [6, 4], [16, 9], [17, 9], [18, 9], [17, 8]]) K.set(wx + cx, wy + cy, '#ffffff'); K.rect(wx + 11, wy, 2, 22, R.wood[2]); K.rect(wx, wy + 10, 24, 2, R.wood[2]); K.rect(wx - 4, wy + 24, 32, 3, R.wood[2]); K.rect(wx - 4, wy + 24, 32, 1, R.wood[5]);
        for (const sx of [wx - 9, wx + 27]) { K.rect(sx, wy - 4, 6, 30, R.roof[2]); K.rect(sx, wy - 4, 2, 30, R.roof[3]); K.rect(sx + 5, wy - 4, 1, 30, R.roof[1]); K.rect(sx, wy + 14, 6, 2, '#ffd24a'); } }                              // 窓とカーテン
      { const fx = 10; for (let y = 16; y < 72; y++) for (let x = fx; x < fx + 40; x++) { const row = Math.floor(y / 5), bx = (x + row * 5) % 10, by = y % 5; K.set(x, y, bx === 0 || by === 4 ? R.stone[1] : R.stone[K.clamp(3 + (by === 0 ? 1 : 0) - (K.hash(Math.floor((x + row * 5) / 10), row, 631) < 0.35 ? 1 : 0) - (x > fx + 34 ? 1 : 0), 0, 5)]); }
        K.rect(fx - 3, 36, 46, 4, R.wood[2]); K.rect(fx - 3, 36, 46, 1, R.wood[5]); K.rect(fx - 3, 39, 46, 1, R.wood[0]);
        for (let y = 46; y < 72; y++) for (let x = fx + 8; x < fx + 32; x++) if (y > 50 || Math.abs(x - (fx + 20)) < 12 - (50 - y) * 1.6) K.set(x, y, y > 68 ? R.rock[1] : R.rock[0]);
        K.rect(fx + 10, 67, 20, 2, R.wood[1]); K.rect(fx + 12, 65, 16, 2, R.wood[2]); K.flame(fx + 20, 66, 7, 15, 1); K.flame(fx + 15, 66, 3, 8, 2); K.flame(fx + 25, 66, 3, 7, 3); K.lamp(fx + 20, 60, 62, '#ff9f5a', 1.25);
        K.rect(fx + 4, 30, 3, 6, '#3fb6e0'); K.set(fx + 5, 29, '#e3fbff'); K.rect(fx + 30, 29, 5, 7, R.dirt[4]); K.rect(fx + 30, 29, 5, 1, R.dirt[5]); K.rect(fx + 16, 32, 8, 4, R.stone[4]); K.rect(fx + 18, 30, 4, 2, R.stone[5]); K.solid(fx - 3, 16, fx + 43, 74); } // 暖炉
      { const cx = 134; for (const sy of [18, 32]) { K.rect(cx, sy, 52, 2, R.wood[3]); K.rect(cx, sy, 52, 1, R.wood[5]); K.rect(cx, sy + 2, 52, 1, R.wood[0]); for (let i = 0; i < 9; i++) { const bx = cx + 2 + i * 5 + Math.floor(K.hash(i, sy, 641) * 2), col = ['#3f9a52', '#ad3b3f', '#3fb6e0', '#ffd24a', '#b07be0'][Math.floor(K.hash(i, sy, 642) * 5)], hh = 5 + Math.floor(K.hash(i, sy, 643) * 3); K.rect(bx, sy - hh, 3, hh, col); K.rect(bx, sy - hh, 1, hh, K.mix(col, '#ffffff', 0.45)); K.set(bx + 1, sy - hh - 1, R.dirt[4]); } }
        K.rect(cx - 6, 54, 64, 3, R.wood[5]); K.rect(cx - 6, 56, 64, 1, R.wood[3]); K.planks(cx - 4, 57, W - 1, 79, 'v', 10, 0.35, 0.7, 651); K.rect(cx - 4, 57, 62, 1, R.wood[0]); K.rect(cx - 4, 79, 62, 1, R.wood[0]); K.rect(cx - 4, 57, 1, 23, R.wood[4]);
        for (const [mx, col] of [[cx + 4, R.stone[4]], [cx + 20, R.dirt[4]], [cx + 40, R.stone[4]]]) { K.rect(mx, 49, 5, 5, col); K.rect(mx, 49, 1, 5, '#ffffff'); K.rect(mx + 5, 50, 1, 3, col); K.rect(mx, 48, 5, 1, '#fdf6e0'); }
        K.solid(cx - 6, 50, W - 1, 80); }                                                                                                                                           // 棚と帳場
      { const tx = 50; K.rect(tx, 70, 22, 3, R.wood[4]); K.rect(tx, 70, 22, 1, R.wood[5]); K.rect(tx, 72, 22, 1, R.wood[1]); K.rect(tx + 2, 73, 2, 11, R.wood[2]); K.rect(tx + 18, 73, 2, 11, R.wood[1]); K.rect(tx + 8, 66, 4, 4, R.stone[4]); K.rect(tx + 8, 66, 1, 4, '#ffffff'); K.rect(tx + 14, 68, 5, 2, R.dirt[5]); K.solid(tx, 70, tx + 22, 84); } // 机
      for (const lx of [44, 150]) { K.rect(lx, 6, 1, 8, R.stone[1]); K.rect(lx - 3, 14, 7, 1, R.stone[1]); for (let j = 0; j < 6; j++) for (let i = 0; i < 5; i++) K.lit(lx - 2 + i, 15 + j, i === 0 || j === 0 ? '#fff3b8' : i === 4 || j === 5 ? '#ffb347' : '#ffd873'); K.rect(lx - 3, 21, 7, 1, R.stone[1]); K.lamp(lx, 18, 44, '#ffb347', 1); } // つり灯り
      for (let y = 88; y < 106; y++) for (let x = 48; x < 152; x++) { const d = ((x - 100) / 52) ** 2 + ((y - 97) / 9) ** 2; if (d < 1) K.set(x, y, d > 0.86 ? '#ffd24a' : d > 0.72 ? R.roof[1] : (x + y * 2) % 12 < 2 && d < 0.6 ? R.roof[4] : R.roof[K.hash(x >> 1, y, 661) < 0.2 ? 3 : 2]); }                    // 敷物
      K.barrel(176, 98); } },
    forest: { n: '森の小道', slots: { 1: [96], 2: [84, 110], 3: [76, 96, 116] }, draw(K, time) {
      const R = K.R, DEEP = [R.leaf[0], R.leaf[0], R.leaf[1], R.leaf[1], R.leaf[2], R.leaf[3]];
      K.sky(time, 30);
      for (let y = 10; y < 66; y++) for (let x = 0; x < W; x++) K.set(x, y, K.rampN([R.leaf[0], R.hill[0], R.hill[1], R.hill[2]], 0.2 + (K.noise(x, y, 10, 701) - 0.5) * 0.6 + (y - 10) / 56 * 0.45, x, y, 702)); // 奥のかすむ森
      for (const [x, w, b] of [[10, 4, 64], [40, 5, 65], [66, 3, 63], [88, 4, 64], [112, 3, 63], [134, 5, 65], [158, 4, 64], [182, 4, 65]]) { for (let y = 16; y < b; y++) for (let i = 0; i < w; i++) K.set(x + i, y, i === 0 ? R.wood[2] : i === w - 1 ? R.wood[0] : R.wood[1]); for (let k = 1; k < 4; k++) { K.set(x - k, b - 1 + (k > 1 ? 1 : 0), R.wood[1]); K.set(x + w - 1 + k, b - 1 + (k > 1 ? 1 : 0), R.wood[0]); } } // 奥の幹
      { const blobs = []; for (let x = -6; x < W + 8; x += 10) { blobs.push([x, 6 + Math.round(4 * Math.sin(x * 0.4)), 11]); blobs.push([x + 5, 22 + Math.round(5 * Math.sin(x * 0.23 + 1)), 12]); if (K.hash(x, 1, 711) > 0.35) blobs.push([x + 2, 38 + Math.round(4 * Math.sin(x * 0.31)), 9]); } K.foliage(blobs, DEEP, 712); }
      if (time === 'day') for (const [sx, wd] of [[58, 7], [104, 5], [128, 8]]) for (let y = 0; y < 66; y++) for (let i = 0; i < wd; i++) { const x = sx + i + Math.round(y * 0.35); if ((x + y) % 2 === 0) { const c = K.get(x, y); for (const r of [DEEP, R.hill, R.leaf, R.wood]) { const j = r.lastIndexOf(c); if (j >= 0) { K.set(x, y, r[Math.min(j + 1, r.length - 1)]); break; } } } } // 木もれ日のすじ
      K.grass(64, 721); const fx = y => 96 + 9 * Math.sin(y * 0.13) - (H - y) * 0.12; K.path(68, fx, 6, 0.46, 731);
      K.tree(24, 92, 741); K.tree(172, 89, 742);
      K.foliage([[56, 79, 6], [63, 81, 5], [50, 82, 4]], R.leaf, 751); K.foliage([[134, 77, 6], [141, 80, 5], [128, 80, 4]], R.leaf, 752); K.solid(46, 73, 68, 86); K.solid(124, 71, 146, 85);
      for (const [x, y] of [[54, 76], [60, 80], [136, 75], [140, 79]]) { K.set(x, y, '#e8506e'); K.set(x + 1, y, '#ad3b3f'); }
      for (const [x, y, c] of [[122, 99, '#e8506e'], [46, 101, '#ff9f5a'], [150, 97, '#e8506e']]) { K.rect(x - 2, y - 3, 5, 2, c); K.rect(x - 1, y - 4, 3, 1, c); K.set(x - 1, y - 3, '#ffffff'); K.set(x + 1, y - 4, '#ffffff'); K.rect(x, y - 1, 1, 2, '#fdf6e0'); K.set(x - 2, y - 2, K.mix(c, '#1a1535', 0.35)); K.set(x + 2, y - 2, K.mix(c, '#1a1535', 0.35)); } // きのこ
      { const x = 138, y = 100; for (let j = 0; j < 6; j++) for (let i = 0; i < 18; i++) if (!((i < 2 || i > 15) && (j === 0 || j === 5))) K.set(x + i, y + j, i < 3 ? (j > 0 && j < 5 ? R.wood[i === 1 ? 5 : 4] : R.wood[3]) : R.wood[K.clamp(4 - j + (K.hash(i, j, 761) < 0.2 ? 1 : 0), 0, 4)]); K.set(x + 1, y + 2, R.wood[3]); K.set(x + 1, y + 3, R.wood[3]); K.rect(x + 6, y - 1, 5, 1, R.leaf[4]); K.solid(x, y, x + 18, y + 6); } // 倒木
      K.tufts(64, 170, 771); K.flowers(64, 36, 781); K.foreGrass(80, 791, x => Math.abs(x - fx(H - 1)) < 20); } },
    classroom: { n: '教室', slots: { 1: [96], 2: [82, 112], 3: [70, 96, 122] }, draw(K, time) {
      const R = K.R, SKY = time === 'night' ? R.night : time === 'dusk' ? R.dusk : R.sky;
      for (let y = 0; y < 66; y++) for (let x = 0; x < W; x++) K.set(x, y, K.ramp(R.wall, 0.8 + (K.noise(x, y, 12, 801) - 0.5) * 0.16 - (y < 6 ? 0.2 : 0) - (y > 56 ? 0.12 : 0), x, y));       // 壁
      K.rect(0, 62, W, 4, R.wood[3]); K.rect(0, 62, W, 1, R.wood[5]); K.rect(0, 65, W, 1, R.wood[1]);                                                                             // はば木
      K.planks(0, 66, W - 1, H - 1, 'h', 7, 0.62, 0.95, 811); K.floor(0, W - 1, 67);                                                                                              // 床
      { const bx = 52, by = 14, bw = 88, bh = 32; K.rect(bx - 3, by - 3, bw + 6, bh + 6, R.wood[2]); K.rect(bx - 3, by - 3, bw + 6, 1, R.wood[5]); K.rect(bx - 3, by - 3, 1, bh + 6, R.wood[4]); K.rect(bx + bw + 2, by - 3, 1, bh + 6, R.wood[0]);
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) K.set(bx + x, by + y, K.rampN(['#173b36', '#1f4a3a', '#22573e', '#2f6b3f'], 0.45 + (K.noise(x, y, 9, 821) - 0.5) * 0.7 - (x + y < 8 ? -0.2 : 0), x, y, 822));
        for (const [x0, y0, n] of [[8, 6, 22], [8, 11, 30], [8, 16, 16], [50, 8, 26], [54, 14, 20]]) for (let i = 0; i < n; i++) if (K.hash(i, y0, 823) > 0.22) K.set(bx + x0 + i, by + y0 + (K.hash(i, y0, 824) > 0.8 ? 1 : 0), i % 7 === 3 ? '#ffd24a' : '#e3e9ea');
        K.rect(bx - 3, by + bh + 3, bw + 6, 2, R.wood[4]); K.rect(bx - 3, by + bh + 4, bw + 6, 1, R.wood[1]); K.rect(bx + 6, by + bh + 2, 3, 1, '#ffffff'); K.rect(bx + 12, by + bh + 2, 3, 1, '#e8506e'); K.rect(bx + 70, by + bh + 1, 8, 2, R.stone[2]); K.rect(bx + 70, by + bh + 1, 8, 1, R.dirt[4]); } // 黒板・チョーク・黒板消し
      { const cx = 96, cy = 5; for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) if (x * x + y * y <= 17) K.set(cx + x, cy + y, x * x + y * y > 10 ? R.stone[1] : '#fdf6e0'); K.set(cx, cy, R.stone[0]); K.set(cx, cy - 1, R.stone[0]); K.set(cx, cy - 2, R.stone[0]); K.set(cx + 1, cy, R.stone[0]); K.set(cx + 2, cy + 1, R.stone[0]); } // 時計
      for (const wx of [4, 26]) { K.rect(wx - 1, 11, 20, 38, R.stone[2]); K.rect(wx - 1, 11, 20, 1, R.stone[5]); for (let j = 0; j < 36; j++) for (let i = 0; i < 18; i++) { const c = j > 27 ? R.hill[j > 31 ? 1 : 2] : SKY[K.clamp(1 + Math.floor(j / 6), 0, 5)]; if (time === 'night') K.set(wx + i, 12 + j, c); else K.lit(wx + i, 12 + j, c); }
        K.rect(wx + 8, 12, 2, 36, R.stone[3]); K.rect(wx, 29, 18, 2, R.stone[3]); for (let k = 0; k < 7; k++) { K.set(wx + 2 + k, 20 - k, '#f1fbf6'); K.set(wx + 11 + k, 44 - k, '#f1fbf6'); } K.rect(wx - 2, 49, 22, 2, R.stone[4]); K.rect(wx - 2, 50, 22, 1, R.stone[1]); if (time !== 'night') K.lamp(wx + 9, 30, 30, time === 'dusk' ? '#ff9f5a' : '#fff3b8', 0.5); } // 窓
      if (time !== 'night') for (const wx of [4, 26]) for (let y = 67; y < 100; y++) for (let i = 0; i < 16; i++) { const x = wx + 6 + i + Math.round((y - 67) * 0.9); if (x < W) { const c = K.get(x, y), j = R.wood.indexOf(c); if (j >= 0 && j < 5) K.set(x, y, R.wood[j + 1]); } } // 床に落ちる窓の光
      { const dx = 156, dy = 20; K.rect(dx - 2, dy - 2, 28, 46, R.wood[1]); for (let y = 0; y < 42; y++) for (let x = 0; x < 24; x++) K.set(dx + x, dy + y, x === 11 || x === 12 ? R.wood[1] : R.wood[K.clamp(4 - (K.hash(x >> 2, y >> 3, 831) < 0.3 ? 1 : 0) - (x > 20 ? 1 : 0), 0, 5)]);
        for (const ox of [2, 14]) { K.rect(dx + ox, dy + 4, 8, 12, R.stone[1]); for (let j = 0; j < 10; j++) for (let i = 0; i < 6; i++) K.set(dx + ox + 1 + i, dy + 5 + j, i + j < 6 ? R.sky[5] : R.sky[4]); } K.rect(dx + 9, dy + 22, 1, 5, R.stone[4]); K.rect(dx + 14, dy + 22, 1, 5, R.stone[4]);
        K.rect(dx + 4, dy - 10, 16, 6, '#fdf6e0'); K.rect(dx + 4, dy - 10, 16, 1, R.stone[2]); K.rect(dx + 4, dy - 5, 16, 1, R.stone[2]); K.rect(dx + 7, dy - 8, 4, 2, R.stone[1]); K.rect(dx + 13, dy - 8, 4, 2, R.stone[1]); } // 引き戸と札
      { const tx = 84; K.rect(tx, 64, 24, 3, R.wood[4]); K.rect(tx, 64, 24, 1, R.wood[5]); K.rect(tx + 1, 67, 22, 12, R.wood[3]); K.rect(tx + 1, 67, 1, 12, R.wood[4]); K.rect(tx + 22, 67, 1, 12, R.wood[1]); K.rect(tx + 1, 78, 22, 1, R.wood[1]); K.rect(tx + 4, 61, 7, 3, '#fdf6e0'); K.rect(tx + 4, 63, 7, 1, R.stone[3]); K.rect(tx + 16, 60, 2, 4, '#3fb6e0'); K.solid(tx, 64, tx + 24, 80); } // 教卓
      for (const [x, y] of [[18, 84], [150, 84], [168, 96], [4, 98]]) { K.rect(x, y, 22, 3, R.wood[5]); K.rect(x, y + 2, 22, 1, R.wood[3]); K.rect(x + 1, y + 3, 20, 4, R.wood[4]); K.rect(x + 1, y + 6, 20, 1, R.wood[2]); K.rect(x + 1, y + 7, 2, 9, R.stone[3]); K.rect(x + 19, y + 7, 2, 9, R.stone[2]); K.rect(x + 3, y + 12, 16, 1, R.stone[2]); K.solid(x, y, x + 22, y + 16); } // 机
      K.fore.push(() => { for (const x of [36, 132]) { K.rect(x, H - 9, 26, 3, R.wood[5]); K.rect(x, H - 7, 26, 1, R.wood[3]); K.rect(x + 1, H - 6, 24, 6, R.wood[4]); K.rect(x + 1, H - 6, 1, 6, R.wood[5]); K.rect(x + 24, H - 6, 1, 6, R.wood[2]); K.rect(x + 6, H - 11, 9, 2, '#fdf6e0'); K.rect(x + 18, H - 10, 5, 1, '#e8506e'); } }); } }, // 手前の机
    edo: { n: '江戸の町', slots: { 1: [96], 2: [82, 112], 3: [70, 96, 122] }, draw(K, time) {
      const R = K.R;
      K.sky(time, 78); if (time !== 'night') { K.cloud(40, 10, 1.0, time); K.cloud(120, 6, 0.8, time); }
      K.mountains(72, [[130, 44, 46], [10, 20, 30], [196, 18, 26]], 9);
      for (let y = 76; y < H; y++) for (let x = 0; x < W; x++) K.set(x, y, K.rampN(R.dirt, 0.62 + (K.noise(x, y * 1.8, 10, 901) - 0.5) * 0.4 + (K.noise(x, y, 3, 902) - 0.5) * 0.14 + (y - 76) / 32 * 0.1, x, y, 903)); K.floor(0, W - 1, 76); // 土の道
      for (let i = 0; i < 34; i++) { const x = Math.floor(K.hash(i, 1, 904) * W), y = 82 + Math.floor(K.hash(i, 2, 904) * 24); K.set(x, y, R.stone[4]); K.set(x + 1, y, R.stone[3]); K.set(x, y + 1, R.dirt[1]); K.set(x + 1, y + 1, R.dirt[1]); }
      const machiya = (x, base, w, wallH, roofH, noren, seed, two) => { const wt = base - wallH, ex = x + (w >> 1) - 10;
        for (let y = wt; y < wt + 12; y++) for (let xx = x; xx < x + w; xx++) K.set(xx, y, K.ramp(R.wall, 0.86 + (K.noise(xx, y, 8, seed) - 0.5) * 0.2 - (y < wt + 5 ? 0.28 : 0), xx, y));
        for (let i = 7; i < w - 9; i += 3) K.rect(x + i, wt + 5, 1, 5, R.wood[1]); K.rect(x + 5, wt + 4, w - 10, 1, R.wood[2]); K.rect(x + 5, wt + 10, w - 10, 1, R.wood[2]);                           // 虫籠窓
        K.planks(x, wt + 12, x + w - 1, base - 1, 'v', 4, 0.22, 0.6, seed + 1); K.rect(x, wt + 12, w, 2, R.wood[1]); K.rect(x, wt + 12, w, 1, R.wood[3]);
        if (two) { K.rect(x, wt + 26, w, 3, R.rock[2]); K.rect(x - 3, wt + 28, w + 6, 2, R.rock[1]); K.rect(x - 3, wt + 28, w + 6, 1, R.rock[4]); }                                               // ひさし
        for (const px of [x, x + w - 3]) { K.rect(px, wt, 3, wallH, R.wood[1]); K.rect(px, wt, 1, wallH, R.wood[3]); }
        const et = base - 26; K.rect(ex - 2, et - 2, 24, 28, R.wood[1]); for (let y = et; y < base; y++) for (let xx = ex; xx < ex + 20; xx++) K.set(xx, y, R.rock[(xx + y) % 7 === 0 ? 1 : 0]);
        for (let j = 0; j < 10; j++) for (let i = 0; i < 20; i++) K.set(ex + i, et + j, i % 7 === 6 ? K.mix(noren, '#12132a', 0.55) : j === 0 ? K.mix(noren, '#ffffff', 0.3) : j === 9 ? K.mix(noren, '#12132a', 0.3) : i % 7 === 0 ? K.mix(noren, '#ffffff', 0.15) : noren);
        for (const mx of [ex + 2, ex + 9, ex + 16]) { K.rect(mx, et + 3, 2, 3, '#fdf6e0'); K.set(mx - 1, et + 4, '#fdf6e0'); K.set(mx + 2, et + 4, '#fdf6e0'); }                                    // のれんと紋
        K.rect(ex - 3, base - 1, 26, 2, R.stone[3]); K.rect(ex - 3, base - 1, 26, 1, R.stone[5]);
        { const lx = ex - 8, ly = et + 2; K.rect(lx + 1, ly - 3, 1, 3, R.wood[1]); K.rect(lx, ly, 4, 1, R.rock[1]); for (let j = 0; j < 7; j++) for (let i = 0; i < 4; i++) K.lit(lx + i, ly + 1 + j, j === 3 ? '#e8506e' : i === 0 ? '#fff3b8' : i === 3 ? '#ffd873' : '#fdf6e0'); K.rect(lx, ly + 8, 4, 1, R.rock[1]); K.lamp(lx + 2, ly + 4, 24, '#ffb347', 0.9); } // ちょうちん
        for (let y = wt; y < wt + 3; y++) for (let xx = x; xx < x + w; xx++) K.set(xx, y, K.darker(K.get(xx, y), 1));
        K.tiledRoof(x, wt + 3, w, roofH, R.rock); K.solid(x - 7, wt - roofH, x + w + 7, base + 1); };
      machiya(66, 76, 62, 44, 20, '#2f3a66', 911, true); machiya(0, 76, 60, 34, 20, '#ad3b3f', 921); machiya(134, 76, 60, 36, 22, '#34793f', 931);
      for (let x = 0; x < W; x++) for (let y = 76; y < 79; y++) K.set(x, y, K.darker(K.get(x, y), y === 76 ? 2 : 1));
      K.barrel(4, 88); { const x = 6, y = 71; K.rect(x - 1, y - 6, 8, 6, R.wood[3]); K.rect(x - 1, y - 6, 8, 1, R.wood[5]); K.rect(x, y - 9, 6, 3, R.wood[2]); K.rect(x + 1, y - 11, 4, 2, R.wood[3]); }             // 天水桶と手桶
      { const x = 170, base = 90; K.rect(x, base - 12, 20, 2, R.wood[4]); K.rect(x, base - 11, 20, 1, R.wood[2]); K.rect(x + 1, base - 10, 2, 10, R.wood[2]); K.rect(x + 17, base - 10, 2, 10, R.wood[1]); K.rect(x - 1, base - 13, 22, 1, '#ad3b3f'); K.rect(x - 1, base - 12, 22, 1, '#7a2a40'); K.rect(x + 4, base - 16, 4, 3, R.stone[4]); K.rect(x + 12, base - 15, 3, 2, '#3f9a52'); K.solid(x - 1, base - 13, x + 21, base); } // 縁台
      for (const [x, y] of [[62, 80], [130, 79], [150, 100], [30, 102]]) { K.set(x, y, R.grass[3]); K.set(x + 1, y - 1, R.grass[4]); K.set(x + 2, y, R.grass[2]); K.set(x - 1, y - 1, R.grass[3]); } } },
  };

  // ---- 時間の色合い（塗ったあとに全体へかける）と、明かりのにじみ ----
  function grade(K, time, inside) {
    const m = inside ? [0.62, 0.62, 0.78, 6, 6, 16] : time === 'night' ? [0.36, 0.46, 0.74, 6, 9, 30] : time === 'dusk' ? [1.0, 0.8, 0.74, 18, 4, 10] : null;
    const out = K.px.map((c, i) => { if (!m || K.emit[i]) return rgb(c); const [r, gg, b] = rgb(c); return [r * m[0] + m[3], gg * m[1] + m[4], b * m[2] + m[5]]; });
    const strength = inside ? 1 : time === 'night' ? 1 : time === 'dusk' ? 0.45 : 0;
    if (strength) for (const L of K.glow) { const [lr, lg, lb] = rgb(L.color), r = L.r;
      for (let y = Math.max(0, Math.floor(L.y - r)); y <= Math.min(H - 1, L.y + r); y++) for (let x = Math.max(0, Math.floor(L.x - r)); x <= Math.min(W - 1, L.x + r); x++) { const d = Math.hypot(x - L.x, y - L.y) / r; if (d >= 1) continue; const i = y * W + x; if (K.emit[i]) continue;
        let a = (1 - d) * (1 - d) * 0.75 * L.power * strength; a = Math.floor(a * 6 + dith(x, y) * 0.9) / 6; // 段をつけてドット絵らしく
        const o = out[i]; out[i] = [o[0] + (lr - o[0] * 0.35) * a, o[1] + (lg - o[1] * 0.35) * a, o[2] + (lb - o[2] * 0.35) * a]; } }
    return out.map(([r, gg, b]) => hex(Math.round(r / 6) * 6, Math.round(gg / 6) * 6, Math.round(b / 6) * 6));
  }

  // 人物に影と光を足す：黒いふちを「隣の色を暗くした色」に変え、右下を1段暗く、左上を少し明るくする
  function shadeSprite(img, tone) {
    const w = img.w, h = img.h, src = img.px, out = src.slice(), OUT = '#1a1c2c', at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? null : src[y * w + x], body = c => c && c !== OUT;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = at(x, y); if (!c) continue;
      if (c === OUT) { const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy) == null); if (!edge) continue; // 目や模様の黒はそのまま
        const nb = [at(x + 1, y), at(x, y + 1), at(x - 1, y), at(x, y - 1)].filter(body), lightSide = body(at(x + 1, y)) || body(at(x, y + 1)); // ふちの右か下に体がある＝左上のふち
        if (nb.length) out[y * w + x] = mix(nb[0], '#14152e', lightSide ? 0.72 : 0.9); continue; }
      const isEdge = (xx, yy) => at(xx, yy) === OUT && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(xx + dx, yy + dy) == null);
      const rimDark = isEdge(x + 1, y) || isEdge(x, y + 1), rimLight = (isEdge(x - 1, y) || isEdge(x, y - 1)) && !rimDark;
      out[y * w + x] = rimDark ? mix(c, '#2a1f4a', 0.26) : rimLight ? mix(c, '#fff3c8', 0.2) : c; }
    if (tone) for (let i = 0; i < out.length; i++) if (out[i]) { const [r, gg, b] = rgb(out[i]); out[i] = hex(r * tone[0] + tone[3], gg * tone[1] + tone[4], b * tone[2] + tone[5]); }
    return { w, h, px: out };
  }
  // 人物の描き込み：部品の重なり（img.ly）を見て陰影を付ける。光は左上から。
  //   ・部品ごとに、左と上のへりを明るく、右と下のへりを暗くする（金属は強く光らせる）
  //   ・上に重なった部品の真下は影にする（髪の影が額に、帽子の影が髪に、あごの影が胸に落ちる）
  //   ・黒いふちは「隣の色を暗くした色」にする。目は残し、縦2ドットの目は下を瞳の色にする
  function richSprite(img, tone) {
    if (!img.ly) return shadeSprite(img, tone);
    const w = img.w, h = img.h, px = img.px, ly = img.ly, ch = img.ch, out = px.slice(), OUT = '#1a1c2c';
    const inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h, P = (x, y) => inb(x, y) ? px[y * w + x] : null, L = (x, y) => inb(x, y) && px[y * w + x] ? ly[y * w + x] : -1, CH = (x, y) => inb(x, y) ? ch[y * w + x] : null;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, c = px[i]; if (!c) continue; const l = ly[i], letter = ch[i];
      if (l === 0) { const body = (xx, yy) => L(xx, yy) > 0, nb = [[1, 0], [0, 1], [-1, 0], [0, -1]].filter(([dx, dy]) => body(x + dx, y + dy)).map(([dx, dy]) => P(x + dx, y + dy));
        if (nb.length) out[i] = mix(nb[0], '#14152e', body(x + 1, y) || body(x, y + 1) ? 0.7 : 0.88); continue; }
      if (l === 3) { if (letter === 'k' && L(x, y - 1) === 3 && CH(x, y - 1) === 'k') out[i] = '#3d3f86'; continue; } // 目：下のドットを瞳の色に
      const same = (dx, dy) => L(x + dx, y + dy) === l; let v = 0;
      if (!same(1, 0)) v -= 1; if (!same(0, 1)) v -= 0.5;
      if (!same(-1, 0)) v += 1; else if (!same(0, -1)) v += 0.5;
      const up = L(x, y - 1); if (up > l && up !== 3 && up !== 14) v -= 1.2;                              // 上に重なった部品の影
      if (l >= 4 && l <= 6 && up === 2 && /[sS]/.test(CH(x, y - 1) || '')) v -= 1;                         // あごの影
      const shadeTone = /[A-Z]/.test(letter || ''), metal = /[mMgG]/.test(letter || ''), skin = /[sS]/.test(letter || '');
      const hi = metal ? mix(c, '#ffffff', 0.6) : skin ? mix(c, '#fff1d6', 0.24) : mix(c, '#fff3c8', 0.3);
      const sh = metal ? mix(c, '#1f2a55', 0.38) : skin ? mix(c, '#9a4a52', 0.28) : mix(c, '#2a1f4a', 0.3), deep = metal ? mix(c, '#141a3a', 0.55) : mix(c, '#1a1535', 0.48);
      out[i] = v >= 1 && !shadeTone ? hi : v <= -1.6 ? deep : v <= -0.9 ? sh : c; }
    if (tone) for (let i = 0; i < out.length; i++) if (out[i]) { const [r, gg, b] = rgb(out[i]); out[i] = hex(r * tone[0] + tone[3], gg * tone[1] + tone[4], b * tone[2] + tone[5]); }
    return { w, h, px: out };
  }
  const TONE = { night: [0.62, 0.68, 0.86, 4, 6, 18], dusk: [1.0, 0.9, 0.84, 10, 2, 4], inside: [0.82, 0.82, 0.9, 4, 4, 10] };

  // opts: place／time（day dusk night）。actors: 人物の絵の配列（左から）。opts.plain=true で人物を元の絵のまま置く。
  function stage(opts, actors) {
    opts = opts || {}; actors = (actors || []).filter(Boolean);
    const place = PLACES[opts.place] || PLACES.village, time = opts.time || 'day', K = kit();
    place.draw(K, time);
    const xs = (place.slots && place.slots[actors.length]) || [W / 2];
    actors.forEach((a, i) => K.shadow(xs[i], FOOT + 0.5, 9, 2, 2));
    const px = grade(K, time, place.inside), tone = place.inside ? TONE.inside : TONE[time] || null;
    // 新しい人物（chara2.js。ふちと陰影は描き込み済みで ly を持たない）は、時間の色合いだけかける
    const toneOnly = (img, t) => t ? { w: img.w, h: img.h, px: img.px.map(c => { if (!c) return c; const [r, gg, b] = rgb(c); return hex(r * t[0] + t[3], gg * t[1] + t[4], b * t[2] + t[5]); }) } : img;
    actors.forEach((a0, i) => { const a = opts.plain ? a0 : a0.ly ? richSprite(a0, tone) : toneOnly(a0, tone), x0 = xs[i] - (a.w >> 1), top = FOOT - (a.h - 2);
      for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) { const c = a.px[y * a.w + x], X = x0 + x, Y = top + y; if (c && X >= 0 && Y >= 0 && X < W && Y < H) px[Y * W + X] = c; } });
    if (K.fore.length) { const before = K.px.slice(); K.fore.forEach(f => f()); const m = place.inside ? TONE.inside : TONE[time]; for (let i = 0; i < px.length; i++) if (K.px[i] !== before[i]) { const [r, gg, b] = rgb(K.px[i]); px[i] = m ? hex(r * m[0] + m[3], gg * m[1] + m[4], b * m[2] + m[5]) : K.px[i]; } }
    return { w: W, h: H, px, name: place.n, slots: xs };
  }
  // 検査：立ち位置の足の下が、立てる面か
  function validate() { const errors = []; for (const key in PLACES) { const place = PLACES[key], K = kit(); place.draw(K, 'day'); const used = new Set(); for (const n in place.slots) for (const cx of place.slots[n]) used.add(cx);
    for (const cx of used) { let bad = 0; for (let y = FOOT; y <= FOOT + 2; y++) for (let x = cx - 6; x <= cx + 6; x++) if (!K.stand[y * W + x]) bad++; if (bad) errors.push(place.n + '（' + key + '）: 立ち位置 x=' + cx + ' の足の下に、立てない所が ' + bad + ' ドットある'); } } return errors; }

  g.RichCore = { W, H, FOOT, R, PLACES, stage, shadeSprite, richSprite, validate, kit };
})(typeof globalThis !== 'undefined' ? globalThis : window);
