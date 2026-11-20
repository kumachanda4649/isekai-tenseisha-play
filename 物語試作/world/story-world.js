// 物語試作の「世界」：world-data.js（window.WORLD。最小試作の世界を build-world.mjs で写したもの）を、エンジンが使える形にする。DOM・localStorage・Math.random は使わない。
// 世界のデータが無ければ g.StoryWorld は null（エンジンは場所の種類だけの従来の動きに戻る）。乱数は呼び出し側が渡す R だけ。
(function (g) {
  const D = g.WORLD;
  if (!D || !D.places) { g.StoryWorld = null; return; }
  const byId = {}; D.places.forEach(p => { byId[p.id] = p; });
  const nation = {}; D.nations.forEach(n => { nation[n.id] = n; });

  // 世界の場所の種類(kind) → 台本の place キー（D.PLACE_NAME のキー）。1つの場所が複数の台本の place に当てはまってよい
  const GEN = {
    village: ['village'], hamlet: ['village'], large_village: ['village'], frontier: ['village'], beast_village: ['village'], elf_village: ['village', 'forest'],
    town: ['town'], city: ['town'], metropolis: ['town'], arena_town: ['town'], mining_town: ['town'], demon_city: ['town'], tree_city: ['town', 'forest'], underground_city: ['town', 'cave'],
    capital: ['town', 'castle'], fortress_town: ['town', 'fort'], pilgrim_town: ['town', 'temple'], port: ['seaport', 'town'], pirate_quarter: ['seaport'],
    monastery: ['temple'], cathedral: ['temple'], sacred_site: ['temple', 'hill'], demon_castle: ['castle', 'throne', 'town'],
    dungeon: ['dungeon'], arena_dungeon: ['dungeon'], ruins: ['ruins'], teleport_gate: ['ruins'], grave: ['grave'], catacomb: ['grave'],
    abandoned_mine: ['cave'], dragon_lair: ['cave'], sealed_door: ['demonhome', 'cave'], altar: ['demonhome'], cursed_forest: ['forest'], world_tree: ['forest'], sunken_city: ['lake'], battlefield: ['plains'],
    noble_district: ['town'], slum: ['town'], arena: ['town'], black_market: ['town'], slave_market: ['town'], red_light: ['town'], execution: ['town'], summon_altar: ['town'], inquisition: ['town'],
  };
  // 世界の場所の種類 → 背景の絵（RichCore の7つ：village・cave・town・inn・forest・classroom・edo）
  const BG7 = {
    village: 'village', hamlet: 'village', large_village: 'village', frontier: 'village', beast_village: 'village', elf_village: 'forest', sunken_city: 'cave', battlefield: 'village', sacred_site: 'village',
    town: 'town', city: 'town', metropolis: 'town', arena_town: 'town', mining_town: 'town', demon_city: 'town', capital: 'town', fortress_town: 'town', pilgrim_town: 'town', port: 'town', monastery: 'town', cathedral: 'town',
    demon_castle: 'town', noble_district: 'town', slum: 'town', arena: 'town', black_market: 'town', slave_market: 'town', execution: 'town', summon_altar: 'town', inquisition: 'town',
    pirate_quarter: 'inn', red_light: 'inn', tree_city: 'forest', cursed_forest: 'forest', world_tree: 'forest',
    underground_city: 'cave', dungeon: 'cave', arena_dungeon: 'cave', ruins: 'cave', teleport_gate: 'cave', grave: 'cave', catacomb: 'cave', abandoned_mine: 'cave', dragon_lair: 'cave', sealed_door: 'cave', altar: 'cave',
  };
  const SETTLED_KIND = ['village', 'hamlet', 'large_village', 'frontier', 'beast_village', 'elf_village', 'town', 'city', 'metropolis', 'arena_town', 'mining_town', 'fortress_town', 'pilgrim_town', 'port', 'capital', 'tree_city'];
  const START_KIND = ['village', 'hamlet', 'large_village', 'frontier'];
  // 地図の場所そのものでなく、「〇〇近くの街道」のように近くの町・村に結びつける種類（直に当てはまる場所が無い種類の穴埋めにもなる）
  const ANCHOR_G = ['road', 'field', 'plains', 'hill', 'mountain', 'lake', 'bridge', 'camp', 'flower', 'tavern', 'forest', 'castle', 'throne', 'temple', 'fort'];
  const TERRAIN = { mountain: ['mountain', 'highland'], hill: ['hill', 'highland', 'mountain'], forest: ['forest'], lake: ['coast'] };
  const LIFE_TYPES = ['daily_life', 'development', 'romance', 'festival', 'growth', 'companion_join'];   // 暮らしの話：家のある人は、家の近くで起きやすい
  const NAME = { road: '街道', field: '畑', plains: '草原', hill: '丘', mountain: '山', lake: '湖', bridge: '橋', camp: '野営地', flower: '花畑', forest: '森', castle: '城', throne: '玉座の間', temple: '神殿', fort: '砦', tavern: '酒場' };

  // ---- きわどい要素：off＝切ったコードの配列。場所・施設の content（カンマ区切り）のどれかが切られていれば見せない ----
  const hidden = (content, off) => !!off && !!off.length && String(content || '').split(',').filter(Boolean).some(c => off.includes(c));
  const visible = (p, off) => !!p && !hidden(p.content, off) && !(p.parent && byId[p.parent] && hidden(byId[p.parent].content, off));

  // ---- 道のりの日数（全部の道・航路・区画の行き来で、最短を求める）----
  const ids = D.places.map(p => p.id), N = ids.length, idx = {}; ids.forEach((id, i) => { idx[id] = i; });
  const dm = ids.map(() => ids.map(() => Infinity)); for (let i = 0; i < N; i++) dm[i][i] = 0;
  D.conns.forEach(([a, b, , days]) => { const i = idx[a], j = idx[b]; if (i == null || j == null) return; const d = Math.max(0.1, +days || 1); if (d < dm[i][j]) { dm[i][j] = d; dm[j][i] = d; } });
  for (let k = 0; k < N; k++) for (let i = 0; i < N; i++) { const dik = dm[i][k]; if (dik === Infinity) continue; for (let j = 0; j < N; j++) { const v = dik + dm[k][j]; if (v < dm[i][j]) dm[i][j] = v; } }
  function dist(a, b) {
    if (a === b) return 0; const i = idx[a], j = idx[b]; if (i == null || j == null) return 0;
    if (dm[i][j] !== Infinity) return Math.round(dm[i][j] * 10) / 10;
    const pa = byId[a], pb = byId[b]; return Math.round(Math.hypot(pa.x - pb.x, pa.y - pb.y) * 0.35 * 10) / 10;   // つながらない所（検査では起きない）は、地図の距離から
  }

  const nationName = p => (nation[p.nation] || {}).name || '';
  const genOf = p => GEN[p.kind] || ['town'];
  const bgOf = p => BG7[p.kind] || null;
  // 場所の記述（エンジンが c.loc に持つ。保存できる素のオブジェクト）
  function desc(p, g, name, anchored) {
    return { id: p.id, name, g, nation: nationName(p), nationId: p.nation, kind: p.kind, x: p.x, y: p.y, anchored: !!anchored, bg: anchored ? null : bgOf(p), anchor: anchored ? p.name : null };
  }
  const settledList = off => D.places.filter(p => !p.parent && SETTLED_KIND.includes(p.kind) && visible(p, off));
  const anchorName = (p, g) => g === 'tavern' ? p.name + 'の酒場' : (g === 'temple' || g === 'castle' || g === 'throne') ? p.name + 'の' + NAME[g] : p.name + '近くの' + NAME[g];

  // 出発点：人の住む小さな場所（村）から、種で決める
  function start(R, off) {
    const c = D.places.filter(p => START_KIND.includes(p.kind) && !p.parent && visible(p, off));
    return c.length ? c[Math.floor(R() * c.length)] : null;
  }
  // 場所を選ぶ。o＝{ gens（台本の place の配列）, type（型）, from（いま居る場所のID）, home（住まいの場所のID）, visits（{ID:回数}）, off, first（第1話：出発点にとどまる）, fixed（場所のID。埋め草が住まい・宿に合わせるとき）}
  // 戻り＝{ loc（記述）, g（台本の place キー）, travel（いま居る所からの日数）} か null
  function choose(R, o) {
    const off = o.off, from = o.from && byId[o.from] ? o.from : null, homeT = LIFE_TYPES.includes(o.type) && o.home && byId[o.home];
    const pairs = [];
    const add = (p, g, anchored) => {
      let w = 1;
      const hk = (p.hooks || []).includes(o.type);
      if (p.parent) { if (!hk) return; w *= 2; }   // 区画（貴族街・闘技場・奴隷市場など）は、その型が hooks にあるときだけ
      else if (!anchored && hk) w *= 3;
      const d = from ? dist(from, p.id) : 0;
      w *= 1 / (1 + d / 2.5);
      if (homeT) w *= 1 + 4 / (1 + dist(o.home, p.id) / 2.5); else w *= Math.pow(0.7, (o.visits || {})[p.id] || 0);
      if (anchored && TERRAIN[g]) w *= TERRAIN[g].includes(p.terrain) ? 3 : 0.4;
      if (anchored) w *= 0.5;   // 地図に名のある場所そのものを優先（穴埋めの「近くの〜」はそのつぎ）
      if (o.first && anchored && p.id !== o.from) return;
      pairs.push({ p, g, anchored, w });
    };
    D.places.forEach(p => {
      if (!visible(p, off)) return;
      if (o.fixed) { if (p.id === o.fixed) { const g = o.gens.find(x => genOf(p).includes(x)) || genOf(p)[0]; add(p, g, false); } return; }
      genOf(p).forEach(g => { if (o.gens.includes(g)) add(p, g, false); });
    });
    if (!o.fixed) {
      const set = settledList(off);
      o.gens.filter(g => ANCHOR_G.includes(g)).forEach(g => { set.forEach(p => add(p, g, true)); });
    }
    if (!pairs.length) return null;
    const s = pairs.reduce((a, x) => a + x.w, 0); let r = R() * s, sel = pairs[pairs.length - 1];
    for (const x of pairs) { r -= x.w; if (r <= 0) { sel = x; break; } }
    const p = sel.p, par = p.parent && byId[p.parent];
    const name = sel.anchored ? anchorName(p, sel.g) : (par && p.name.indexOf(par.name) < 0 ? par.name + 'の' + p.name : p.name);
    return { loc: desc(p, sel.g, name, sel.anchored), g: sel.g, travel: from && !o.first ? dist(from, p.id) : 0 };
  }
  // 場所のIDから、記述（「〇〇近くの街道」でない、場所そのもの）
  function plain(id, g) { const p = byId[id]; return p ? desc(p, g || genOf(p)[0], p.name, false) : null; }
  // 施設・特徴（きわどいものを除く）
  const facilities = (id, off) => { const p = byId[id]; return p ? (p.fac || []).filter(f => !hidden(f[1], off)).map(f => f[0]) : []; };
  const tags = (id, off) => { const p = byId[id]; return p ? (p.tags || []).filter(f => !hidden(f[1], off)).map(f => f[0]) : []; };
  const contentFlags = () => D.content.map(c => ({ code: c.code, label: c.label }));
  // 「〇〇国の△△で」（終わりの文の暮らしの場所）
  const at = loc => loc ? (loc.nation ? loc.nation + 'の' : '') + loc.name + 'で' : '';

  g.StoryWorld = { data: D, byId, nation, GEN, BG7, ANCHOR_G, dist, start, choose, plain, facilities, tags, contentFlags, at, visible, hidden, nationName, genOf, bgOf, desc, settledList, NAME };
})(globalThis);
