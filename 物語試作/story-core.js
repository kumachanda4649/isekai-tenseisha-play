// 物語試作の規則（エンジン）。台本（エピソード）を順に演じる。DOM を使わない。Node でもブラウザでも動く。AIは使わない。
// 部品表は story-data.js（人生試作の life-data.js から写した表と、型紙）、台本は episodes\*.js（globalThis.StoryEpisodes）。
// 乱数は world.rng だけ。同じ種・同じ操作なら同じ人生になる。Math.random は使わない。
//   Story.candidates(seed, n) / Story.newWorld(seed, 候補) / Story.next(w) / Story.advance(w) / Story.playCard(w, 札) / Story.decide(w)
//   Story.auto(w, 方針) / Story.person(w, id) / Story.item(no) / Story.save(w) / Story.load(文字列) / Story.validate()
(function (g) {
  const D = g.StoryData, TPLS = g.StoryTemplates, PS = g.Persona, PD = g.PersonaData, IT = g.LifeItems, TN = D.TUNE;
  const warns = [];
  const warn = m => { if (warns.length < 200) warns.push(m); };

  // ---------- 部品の索引 ----------
  const SK = {}; D.SKILLS.forEach(s => { SK[s.id] = s; });
  const BYCAT = {}; IT.items.forEach(it => { (BYCAT[it.cat] = BYCAT[it.cat] || []).push(it); });
  const RE_BAN = new RegExp(D.ITEM_BAN), RE_HIGH = new RegExp(D.ITEM_HIGH), RE_MID = new RegExp(D.ITEM_MID);
  const TIER = {}; IT.items.forEach(it => { TIER[it.no] = RE_HIGH.test(it.name) ? 2 : RE_MID.test(it.name) ? 1 : 0; });
  const ITEM_BYNAME = {}; IT.items.forEach(it => { ITEM_BYNAME[it.name] = it; });
  const INFO = {}; IT.items.forEach(it => { INFO[it.no] = { no: it.no, name: it.name, cat: it.cat, look: it.look, effect: it.effect }; });
  const STACK_CATS = new Set(['回復薬・ポーション', '攻撃用消耗品', '料理・食材', '素材・ドロップ品', '移動・脱出・転移']);
  const SKILL_CATS = [...new Set(D.SKILLS.map(s => s.cat))];
  const MALE = new Set(D.MALE_ROLES);
  const CHILD_LOOKS = [['村娘', '迷子の子'], ['花売りの娘', '迷子の子'], ['村人・男', '迷子の子'], ['宿屋の娘', '迷子の子']];
  const ELDER_ROLE = /古株|長老|重鎮|親方|ベテラン|頭領|当主|ご隠居|老/;   // 重みのある役（話し方の型の組み合わせを見る）
  const LOWLY_VOICE = ['shitappa', 'nekketsu', 'wakamono_m', 'wakamono_f', 'genki', 'ottori', 'kidori', 'ojou', 'kodomo', 'seinen'];   // 若い型・小者の型
  const NOKID_TYPES = new Set(['romance', 'first_battle', 'dungeon', 'boss', 'tournament', 'betrayal_revenge']);   // 子ども（14歳未満）を配役にしない型
  const STATS = ['力', '技', '心', '名声'];
  const FLAGS = ['けが', '呪い', '喪失'];
  const VIAS = ['thanks', 'gift', 'reward', 'buy', 'find', 'drop', 'prize', 'pass', 'make', 'legacy', 'farewell'];
  const TIMES = ['day', 'dusk', 'night'];
  const GOAL_MUL = 1.9;   // 第5回：望みに合う道が選ばれやすくなった分、2.2→1.9（成就＋望みが形を変えた 約27〜30%）。以前の記述：望みの進みの倍率（総指揮 2026-11-20：台本の数字のままでは平均29で成就が0%だった。61本になった 11/20 に 2.2（成就 約25%）へ）
  const WISH_NAMES = ['strong', 'help', 'quiet', 'home'];
  const TRIG_TAGS = [...new Set(Object.keys(D.TRIGGERS).map(k => D.TRIGGERS[k].tag))];   // 過去の引き金の tag（TRIGGERS の tag の一覧）
  const YOUNG_LOOKS = new Set(['村娘', '花売りの娘', '宿屋の娘', '町娘', '見習い魔法使い', '魔法学園の生徒・女', '魔法学園の生徒・男', '貴族の娘', '舞踏会の令嬢', '王女', '姫']);   // 「大人の見た目」から外す絵
  // 第3版：事実の印（世界の旗）。台本が fx の set／unset で立てる・下ろす。画面の「人」の欄に日本語で出す
  const MARKS = { registered: '登録済み', lodging: '宿あり', home: '住まいあり', party: '仲間と組んでいる', shop: '店を持っている', cheat_known: '授かった力を自覚している', mourned: '師を弔った', trained: '丘で稽古を続けた', seen_alive: '行方の知れない人が生きていた跡を見た', power_shown: '力を人前で見せた' };
  // 印が立った／外れたときに画面・読み物・見本へ出す文（第7回の直し：印の名に「になった」を付けると「授かった力を自覚しているになった」のように壊れた）。
  // null＝読み手に見せない内部の印（話の文で既に書かれている）。見せる印は、立ったときと外れたときの文を印ごとに持つ
  const MARK_SAY = { registered: ['ギルドに登録した', 'ギルドの登録が切れた'], lodging: ['町に宿を得た', '宿を失った'], home: ['住まいを得た', '住まいを失った'], party: ['仲間と組んだ', '仲間との組みが解けた'], shop: ['店を持った', '店を手放した'], cheat_known: null, mourned: null, trained: null, seen_alive: null, power_shown: null };
  const markSay = (name, on) => { const m = MARK_SAY[name]; if (m === null) return null; return m ? m[on ? 0 : 1] : (MARKS[name] || name) + (on ? 'が立った' : 'が外れた'); };
  const TONES = ['normal', 'grave', 'tense'];
  const INN_TOWNS = ['village', 'town', 'seaport'];
  const WISH_BONUS = 1.2;   // 望みと同じ種類の goal を進める道を選びやすくする上乗せ（校閲5回目：世話焼き・守り切る望みの人が、責められる給仕を見守った）
  const CHEAT_BONUS = 1.0;   // 授かった力の選択肢が出た分かれ目で、主人公がそれを選びやすくする上乗せ（とっさ・考え直しの重みに足す）
  const TYPE_GAP = 2, TYPE_MAX = 3;   // 同じ型の台本は、2話以内に続けて出ない／1つの人生で3本まで（転生 arrival は、転生のあとの道中があるので数えない）
  const ALLY_W = 4, ALLY_BATTLE_P = 0.35;   // 仲間が必ず要る台本の重み／仲間と組んで初めて守る戦いを、仲間ができたあと来やすくする確率
  const THREAD_EXTRA = 2;   // 予定の話数（maxEp）に来ても、張られた糸を引く台本が起こせるなら、最大この話数だけ人生を延ばす（引ける糸が引かれないまま終わる原因の1つだった）
  const EARLY_GAP_TURNS = 2;   // 第1・第2話の終わりの時間の進みは、ひと月〜三か月
  const GUIDE_DROP = 10;   // 神の札で道を変えるとき（道しるべ・神託で命じる）、変える先の成功率が、いまの道より、これ以上（ポイント）下がるときは変えない（校閲4回目：18ポイント下げて負けさせた。20→10）
  const SETTLE = ['village', 'town', 'seaport', 'field'];   // 余生を暮らせる所（街道・森・砦などは暮らす場所にしない）
  // 型の順番の既定（台本が need.before を書き忘れても、エンジンが守る）：初めての戦い・登録は、強敵・迷宮・試合より前
  const ENGINE_BEFORE = { first_battle: ['boss', 'dungeon', 'tournament'], guild_register: ['boss', 'dungeon', 'tournament'] };
  const EARLY_TYPES = ['first_cheat', 'guild_register'];   // 転生のあと2〜3話のうちに来やすくする型
  const marksOf = w => (w.marks || (w.marks = []));
  // 世界（world\story-world.js）。無ければ null＝場所の種類だけの従来の動き。読み込みの順番に左右されないよう、使うたびに g から取る
  const SWd = () => g.StoryWorld || null;
  const offOf = w => w.contentOff || [];   // 切ったきわどい要素のコード（人生ごとに持つ。保存される）
  const SYS_KEYS = ['名', '場所', '前職', '死', '力', '国', '場所の種類'];   // 台本が使える差し込みの名前（配役の key 以外）
  // 第6回の校閲の直し：重い糸・危険な話・敵だった人・久しぶりの再会・望みを思い出す回数
  const HEAVY = D.HEAVY_THREADS || [];   // 主人公にとって重い糸（恨み・行方知れず・別れ…）。引く台本があれば、型の続き（TYPE_GAP）も緩めて引く
  const HEAVY_EXTRA = 2;   // 重い糸が開いていて引く台本があるときの延長（話数の上限から数えて最大この話数。ふつうの糸と同じ2話。引く台本の型の続き制限は外す）
  const DANGER_TYPES = ['first_battle', 'boss', 'dungeon', 'betrayal_revenge', 'rescue', 'tournament'];   // 命が尽きる終わりは、この型の話の中でだけ（暮らしの話・後日談の直後の急死を避ける）
  const HOSTILE_T = ['enemy', 'nemesis'];
  const RE_BOND = (D.ROLE_BOND || []).map(x => ({ re: new RegExp(x.re), minMet: x.minMet, years: x.years, floor: x.floor == null ? 0 : x.floor })), RE_HOSTILE_ROLE = D.ROLE_HOSTILE ? new RegExp(D.ROLE_HOSTILE) : null;
  const REUNION_TURNS = 4, REUNION_YEARS = 2, FOE_COOL = 4;   // 久しぶり＝最後に会ってから4話以上、または2年以上／敵だった人が親しい役に選ばれるまでの話数
  const REMIND_MAX = 2, REMIND_MIN = 1, REMIND_GAP = 2, REMIND_BIG = 8, JOBHINT_MAX = 1;   // 第7回：望みの一文は2回まで・前世の仕事の一文は1回まで（以前は4回・2回）。深刻（grave）・切迫（tense）な話と、失敗の直後には出さない。以前の記述→   // 望みを思い出す文：1人生2〜4回まで・前の文から2話あける・望みの進みが8以上動いた話の終わりに（2回に満たないときは4以上でも）
  const TRIG_HIT = '{名}の胸の奥で、あの日のことがよみがえった。', TRIG_ACT = '考えるより先に、体が動いていた。', TRIG_HOLD = '{名}は、よみがえった記憶をいったん押し戻し、息を整えた。';

  // ---------- 小さな道具 ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r2 = v => Math.round(v * 100) / 100;
  const pick = (R, a) => a[Math.floor(R() * a.length)];
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  function wpick(R, arr, wf) {
    let tot = 0; const ws = arr.map(x => { const v = Math.max(0, wf(x)); tot += v; return v; });
    if (tot <= 0) return arr[Math.floor(R() * arr.length)];
    let r = R() * tot; for (let i = 0; i < arr.length; i++) { r -= ws[i]; if (r < 0) return arr[i]; } return arr[arr.length - 1];
  }
  // 差し込み。{私}{君}は話し方の付け替えに任せるので残す。知らない名前は {名前} のまま残して、検査で見つける
  // {糸} を使う文は、差し込んだ後に 5文字以上の同じ語句が続けて2回出たら1つにする（糸の memo の末尾と、受ける側の文の頭が重なるとき：「行方の知れなくなった行方の知れなくなったグレン」）
  const DUP_RE = /(.{5,}?)\1+/g;
  function fmt(s, m) {
    const src = String(s), out = src.replace(/\{([^}]+)\}/g, (all, k) => (k === '私' || k === '君') ? all : (m[k] != null ? m[k] : all));
    return src.indexOf('{糸}') >= 0 ? out.replace(DUP_RE, '$1') : out;
  }
  function hashSeed(s) {
    if (typeof s === 'number' && isFinite(s)) { let a = (s | 0) ^ 0x5bd1e995; a = Math.imul(a ^ (a >>> 15), 0x85ebca6b); a = Math.imul(a ^ (a >>> 13), 0xc2b2ae35); return (a ^ (a >>> 16)) | 0; }
    let h = 2166136261; const str = String(s); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0;
  }
  function rngOf(w) { return function () { let a = (w.rng | 0); a = (a + 0x6d2b79f5) | 0; w.rng = a; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function localRng(seed) { let a = seed | 0; return function () { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  const hero = w => w.people[w.heroId];
  const pmCache = {};
  const pm = p => { const k = p.persona.s1 + '|' + p.persona.s2 + '|' + p.persona.past; return pmCache[k] || (pmCache[k] = PS.make(p.persona)); };
  const stageOf = turn => (turn <= 4 ? 0 : turn <= 9 ? 1 : 2);
  const personAny = (w, id) => (w.people && w.people[id]) || null;
  const nickOf = (w, id) => { const p = personAny(w, id); return p ? p.nick : '？'; };
  const lineText = l => (l.k === 's' ? l.name + '：『' + l.t + '』' : l.t);

  // ---------- 人の作成 ----------
  function blank(id, o) {
    return { id, name: o.name, nick: o.nick, kind: o.kind, sex: o.sex, age: o.age, look: o.look, persona: o.persona, voice: null, job: o.job, alive: true, place: o.place || 'village',
      stats: o.stats, skills: [], items: [], relations: {}, goal: o.goal || null, flags: [], life: [] };
  }
  // homeKey＝同じ場所の人を同じ出身になりやすくする鍵（話し方の担当の依頼：pickHome(rand, place, memo)。memo は人生ごとの入れ物 w.homeMemo）。無ければ従来どおり
  function setVoice(p, R, w, homeKey) { if (g.PersonaVoice && typeof g.PersonaVoice.pick === 'function') { try { if (g.PersonaVoice.pickHome) p.home = homeKey && w ? g.PersonaVoice.pickHome(R, homeKey, w.homeMemo || (w.homeMemo = {})) : g.PersonaVoice.pickHome(R); p.voice = g.PersonaVoice.pick(p, R) || null; p.me = p.voice && g.PersonaVoice.pickMe ? g.PersonaVoice.pickMe(p, p.voice, R) : null; } catch (e) { p.voice = null; p.me = null; } } }
  // 主人公の前世（時代と仕事）で、その過去が成り立つか
  function heroPastOk(k, group, job) {
    const PR = D.PAST_RULE, j = String(job || '').replace(/（.*?）/g, '');
    if (PR.group[k] && PR.group[k] !== group) return false;
    if (PR.only[k] && !PR.only[k].includes(j)) return false;
    if (PR.ban[k] && PR.ban[k].includes(j)) return false;
    return true;
  }
  function randomPersona(R, minAge, okPast) {
    const s1 = pick(R, Object.keys(PD.S1)), s2 = pick(R, Object.keys(PD.S2));
    const pasts = Object.keys(PD.PAST).filter(k => (D.PAST_MIN_AGE[k] || 0) <= (minAge || 99) && (!okPast || okPast(k)));
    return { s1, s2, past: pick(R, pasts.length ? pasts : Object.keys(PD.PAST)) };
  }
  function usedNicks(w) { const s = new Set(); Object.keys(w.people).forEach(id => s.add(w.people[id].nick)); return s; }
  // 異世界で会う人。pool は POOLS のキー、または 'child'
  // spec＝台本の pick（job・minAge・maxAge）。job が部品表に無い職なら、その職の名のまま、大人の見た目から選ぶ
  function newNpc(w, R, poolKey, turn, spec, extra) {
    spec = spec || {}; extra = extra || {};
    const child = poolKey === 'child', pk = child ? 'rescued' : poolKey, pool = D.POOLS[pk], meta = D.POOL_META[pk];
    const jl = spec.job != null ? [].concat(spec.job) : null;
    let sel = jl ? pool.filter(x => jl.includes(x[1])) : pool, ownJob = null;   // 台本の pick.job＝その職の人だけ
    if (jl && !sel.length && !child) { ownJob = pick(R, jl); sel = pool.filter(x => !YOUNG_LOOKS.has(x[0])); }
    else if (!child && (spec.minAge || 0) >= 20) { const a = sel.filter(x => !YOUNG_LOOKS.has(x[0])); if (a.length) sel = a; }
    const [look, job0] = child ? pick(R, CHILD_LOOKS) : pick(R, sel.length ? sel : pool), job = ownJob || job0;
    const sex = MALE.has(look) ? '男' : '女';
    const used = usedNicks(w), names = D.ISEKAI_NAMES[sex].filter(n => !used.has(n));
    const nick = names.length ? pick(R, names) : pick(R, D.ISEKAI_NAMES[sex]) + 'ニ世';
    const lo0 = child ? 8 : meta.age[0], hi0 = child ? 13 : meta.age[1];
    let lo = spec.minAge != null ? Math.max(lo0, spec.minAge) : lo0, hi = spec.maxAge != null ? Math.min(hi0, spec.maxAge) : hi0;
    if (lo > hi) { if (spec.minAge != null && spec.minAge > hi0) { lo = spec.minAge; hi = spec.maxAge != null ? Math.max(lo, spec.maxAge) : lo + 12; } else { hi = spec.maxAge; lo = Math.max(spec.minAge != null ? spec.minAge : 1, hi - 8); } }
    const age = ri(R, lo, hi);
    const base = 2 + Math.floor(turn / 3);
    const p = blank('p' + (w.nid++), { name: nick, nick, kind: 'npc', sex, age, look, job,
      persona: child ? Object.assign(randomPersona(R, 9), { past: pick(R, ['hinkon', 'ijime', 'mitomerarezu', 'kage', 'kokyou', 'yamai']) }) : randomPersona(R, age),
      stats: { 力: base + ri(R, 0, 3), 技: base + ri(R, 0, 3), 心: base + ri(R, 0, 3), 名声: ri(R, 0, 2), 金: ri(R, 0, 6) } });
    const n = child ? 0 : ri(R, 1, 2);
    for (let i = 0; i < n; i++) { const cat = pick(R, meta.items), allow = turn >= 9 ? 2 : turn >= 4 ? 1 : 0, list = BYCAT[cat].filter(x => TIER[x.no] <= allow && !RE_BAN.test(x.name)), it = list[Math.floor(R() * list.length * 0.5)]; if (it && !p.items.find(x => x.no === it.no)) p.items.push({ no: it.no, n: 1, turn: 0, from: 'birth' }); }
    if (age <= 13) p.build = '子ども';
    setVoice(p, R, w, extra.homeKey);
    // 古株・長老・親方・当主など「重みのある役」に、若い型・小者の型（下っ端・熱血少年・今どきの若者・お嬢様…）を当てない。世界の乱数は使わず、人の番号から決めた別の乱数で引き直す
    if (extra.role && ELDER_ROLE.test(extra.role) && p.voice && LOWLY_VOICE.includes(p.voice)) {
      const lr = localRng(hashSeed(w.seed) ^ Math.imul(+String(p.id).replace(/D/g, '') + 1, 0x9e3779b1));
      for (let i = 0; i < 12 && LOWLY_VOICE.includes(p.voice); i++) { try { p.voice = g.PersonaVoice.pick(Object.assign({}, p, { home: null }), lr) || p.voice; } catch (e) { break; } }
      if (LOWLY_VOICE.includes(p.voice)) p.voice = p.sex === '女' ? 'josei' : 'otona';
      try { if (g.PersonaVoice.pickMe) p.me = g.PersonaVoice.pickMe(p, p.voice, lr); } catch (e) { /* 一人称は元のまま */ }
    }
    return p;
  }

  // ---------- 候補・新しい世界 ----------
  // 生まれたときに授かった力：チートの印のあるスキルから1つ。候補の番号 i ごとに別の乱数で決める（ほかの乱数の流れは変えない）
  const CHEATS = D.SKILLS.filter(s => s.cheat === true);
  const giftFor = (seed, i) => CHEATS[Math.floor(localRng(hashSeed(seed) ^ 0x3c6ef372 ^ Math.imul(i + 1, 0x9e3779b1))() * CHEATS.length)].id;
  function candidates(seed, n) {
    const R = localRng(hashSeed(seed) ^ 0x2468ace), out = [], usedNames = new Set();
    n = n || 3;
    for (let i = 0; i < n; i++) {
      const group = R() < 0.84 ? 'modern' : 'past';
      let c = null, guard = 0;
      while (!c && guard++ < 20) {
        const [look, prevJob, ar] = pick(R, D.HERO_LOOKS[group]);
        const sex = MALE.has(look) ? '男' : '女', age = ri(R, ar[0], ar[1]);
        let name, nick;
        if (R() < 0.8) { nick = pick(R, D.GIVEN[sex]); name = pick(R, D.SURNAMES) + ' ' + nick; }
        else { nick = pick(R, D.FOREIGN[sex]); name = nick + '・' + pick(R, D.FOREIGN.surname); }
        if (usedNames.has(nick)) continue;
        usedNames.add(nick);
        c = { name, nick, sex, age, prevJob, look, era: group, persona: randomPersona(R, age, k => heroPastOk(k, group, prevJob)), cheat: giftFor(seed, i) };
      }
      out.push(c);
    }
    return out;
  }
  const S1_STAT = { okorippoi: { 力: 1 }, kanpeki: { 技: 1 }, sewa: { 心: 1 }, mie: { 名声: 1 }, hitonatsukkoi: { 心: 1 }, higai: { 技: 1 }, nonki: { 心: 1 }, kowagari: { 技: 1 }, tanoshii: { 技: 1 }, samete: { 技: 1 } };
  const S2_STAT = { kane: { 金: 3 }, genri: { 技: 1 }, chikara: { 力: 1 }, shinkou: { 心: 1 }, meiyo: { 名声: 1, 力: 1 }, giri: { 心: 1 }, kouhei: { 心: 1 }, jiyuu: { 技: 1 }, kazoku: { 力: 1 }, bi: { 名声: 1 } };
  function newWorld(seed, cand, opts) {
    if (!cand) cand = candidates(seed, 1)[0];
    const w = { v: 4, homeMemo: {}, seed, turn: 0, heroId: 'p0', people: {}, log: [], god: { power: TN.startPower, hand: [], followers: 0 }, threads: [], used: [], cur: null, over: null, rng: hashSeed(seed) ^ 0x1f3d5b79, nid: 1, age0: cand.age, mo: 0, mo0: 0, gap: 4, lastYi: 0, lastForm: '', maxEp: 12, marks: [], fillerUsed: [], fillerWho: [], homePlace: null, lastTown: null };
    const R = rngOf(w);
    // 世界：出発点の村を種で決める（乱数の本流とは別の流れなので、世界の有無で人物・台本の選びは変わらない）。切るきわどい要素は opts.contentOff
    if (SWd()) { w.contentOff = ((opts && opts.contentOff) || []).slice(); const st = SWd().start(localRng(hashSeed(seed) ^ 0x6d2b79f5), w.contentOff); if (st) { w.loc = st.id; w.startLoc = st.id; w.path = [st.id]; } }
    w.mo0 = Math.floor(R() * 12);
    w.maxEp = ri(R, TN.minEp, TN.maxEp);
    const stats = { 力: 3, 技: 3, 心: 3, 名声: 0, 金: 5, 命: TN.startLife, 絆: TN.startBond };
    [S1_STAT[cand.persona.s1], S2_STAT[cand.persona.s2]].forEach(o => { if (o) Object.keys(o).forEach(k => { stats[k] += o[k]; }); });
    const goal = { text: PD.PAST[cand.persona.past].goal, progress: 0 };
    const h = blank('p0', { name: cand.name, nick: cand.nick || cand.name, kind: 'hero', sex: cand.sex, age: cand.age, look: cand.look, persona: cand.persona, job: '転生者', place: 'plains', stats, goal });
    h.prevJob = cand.prevJob; h.era = cand.era || 'modern';
    if (cand.cheat && SK[cand.cheat]) { h.gift = cand.cheat; h.skills.push({ id: cand.cheat, lv: 1, turn: 0, from: 'birth' }); }   // 生まれたときに授かった力（Lv1）
    setVoice(h, R);
    w.people.p0 = h;
    for (let i = 0; i < TN.handSize; i++) w.god.hand.push(pick(R, PD.CARD_NAMES));
    return w;
  }

  // ---------- 台本の索引 ----------
  // 埋め草の文。人生の状態（引かれていない糸・行方知れずの人・残った用事）を決めつけない言い方だけを書く（「用事がない」「追ってくる者もない」とは言わない）。
  // 1つの人生で同じ組は2回出ない（w.fillerUsed）。引かれていない糸に結びついた人がいるときは、その人に触れる1文（c.fillerExtra）を足す（糸の memo は使わない）
  // kind：any＝どこでも／home＝住まいがある人（家・町まわり）／lodge＝宿に泊まっている人／travel＝旅の空（住まいも宿も無い人だけ）
  const FILLER_SETS = [
    { k: 'any', s: ['{時}、{名}は{場所}で、ことさら大きな出来事のない日を過ごした。', '同じ道を歩き、同じ人にあいさつをして、日が暮れれば眠る。それだけの繰り返しが、ふしぎと心地よかった。'] },
    { k: 'any', s: ['{時}、{名}は{場所}で、のんびりと日を送った。', '風の匂いを確かめているうちに、一日がゆっくりと暮れていった。'] },
    { k: 'any', s: ['{時}、{名}は{場所}で、静かな日々を過ごしていた。', 'ふと、{前職}だった頃のことを思い出した。ずいぶん遠い昔のようで、それでも胸の奥には、まだはっきり残っている。'] },
    { k: 'travel', s: ['{時}、{名}は{場所}に腰を落ち着けて、しばらく旅の疲れを癒やした。', '温かいものを口にすると、体の芯からゆるむような気がした。'] },
    { k: 'travel', s: ['{時}、{名}は{場所}で、その日は旅を休んだ。', '風に当たりながら、これまで歩いてきた道と、これから向かう先を、ゆっくり思い浮かべた。'] },
    { k: 'any', s: ['{時}、{名}は{場所}で、一日を静かに過ごした。', '道ばたの草の色や、遠くの鐘の音。いつもなら通り過ぎてしまうものが、その日はよく見えた。'] },
    { k: 'travel', s: ['{時}、{名}は{場所}で、少し足を止めた。', '焚き火のはぜる音を聞きながら、{名}は、しばらくなにも考えずにいた。'] },
    { k: 'travel', s: ['{時}、{名}は{場所}で、のんびりと過ごした。', '日が傾くころには、次の朝のことを考えながら、早めに眠る支度をした。'] },
    // 住まいがある人（home の印）：家と町まわりだけ
    { k: 'home', s: ['{時}、{名}は{場所}の自分の家で、いつもの暮らしを送った。', '窓を開けて風を入れ、湯を沸かして、ゆっくりと茶を飲む。そんな一日が、ふしぎと心地よかった。'] },
    { k: 'home', s: ['{時}、{名}は{場所}で、買い物をしながら一日を過ごした。', '顔なじみの店で足を止めて、とりとめのない話をした。帰り道には、家の窓に灯りがともるのが見えた。'] },
    { k: 'home', s: ['{時}、{名}は{場所}の家で、部屋の片づけをした。', 'しまいこんでいた物を一つずつ取り出して眺めるうちに、ここまで歩いてきた道が、ふと胸によみがえった。'] },
    // 宿に泊まっている人（lodging の印・住まいは無い）
    { k: 'lodge', s: ['{時}、{名}は{場所}の宿で、のんびりと日を送った。', '朝は宿の食堂で温かい汁を飲み、昼は通りをぶらぶら歩いた。夜は、屋根の下で眠れることがありがたかった。'] },
    { k: 'lodge', s: ['{時}、{名}は{場所}で、宿の窓から通りを眺めて過ごした。', '行き交う人の声や、荷車の音。ここにいる人たちの暮らしが、少しだけ自分に近づいた気がした。'] },
  ];
  // 暮らしに合う埋め草の種類：住まいがあれば家と町まわり、宿だけなら宿と町まわり、どちらも無ければ旅の文もよい
  const fillerKinds = w => (marksOf(w).includes('home') ? ['any', 'home'] : marksOf(w).includes('lodging') ? ['any', 'lodge'] : ['any', 'travel']);
  const FILLER = { id: 'filler-quiet', tpl: null, type: 'daily_life', title: '静かな日々', stage: [0, 1, 2], place: ['village', 'town', 'field', 'road', 'plains'], time: ['day'], cast: [], need: {}, stake: 'ささやかな日常', steps: [], payoff: '何も起きないことの安らぎ。', opens: [], closes: [], filler: true };
  const epsAll = () => g.StoryEpisodes || [];
  let idxLen = -1, idxLast = null, idxMap = {};
  function epMap() { const a = epsAll(); if (a.length !== idxLen || a[a.length - 1] !== idxLast) { idxMap = {}; a.forEach(e => { if (e && e.id && !idxMap[e.id]) idxMap[e.id] = e; }); idxLen = a.length; idxLast = a[a.length - 1]; } return idxMap; }
  const getEp = id => (id === FILLER.id ? FILLER : epMap()[id]);
  // 分かれ目の step は { choice: 'c1', q, opts }（choice は id）。{ choice: { id, q, opts } } の形も読む
  const chOf = st => ((st.choice && typeof st.choice === 'object') ? st.choice : { id: st.choice, q: st.q, opts: st.opts });
  const stepsOf = (c, ep) => (ep.filler ? FILLER_SETS[c.fv || 0].s.map(t => ({ t })).concat(c.fillerExtra ? [{ t: c.fillerExtra }] : []) : ep.steps);
  // 台本が糸を張る場所をすべて：台本全体の opens・step の opens・選択肢の win / lose の opens（検査と _prepare が使う）
  function allOpens(ep) {
    const out = [], add = (arr, where) => listOf(arr).forEach((o, i) => out.push({ o, where: where + '[' + i + ']' }));
    add(ep && ep.opens, 'opens');
    ((ep && ep.steps) || []).forEach((st, si) => {
      if (!st || typeof st !== 'object') return;
      add(st.opens, 'step[' + si + '] opens');
      if (st.choice) (chOf(st).opts || []).forEach(op => { if (!op) return; ['win', 'lose'].forEach(k => { if (op[k]) add(op[k].opens, 'step[' + si + '] ' + chOf(st).id + ':' + op.key + ' ' + k + '.opens'); }); if (!op.win) add(op.opens, 'step[' + si + '] ' + chOf(st).id + ':' + op.key + ' opens'); });
    });
    return out;
  }
  const listOf = x => (x == null ? [] : [].concat(x));
  // 任意の配役：ent.optional（いなければ配役なし）／pick.thread＋optional（その糸が無ければ配役なし。pick.fallback={new,job…} があれば新しい人）
  const fbOf = e => (e && e.pick && e.pick.thread != null && e.pick.optional) ? (e.pick.fallback || e.fallback || null) : null;
  const canDrop = e => !!(e && (e.optional || (e.pick && e.pick.thread != null && e.pick.optional)));   // 検査が「外した道」を作れる配役
  const isOptEnt = e => !!(e && (e.optional || (e.pick && e.pick.thread != null && e.pick.optional && !fbOf(e))));   // 不在になりうる配役（文には if:'キー' が要る）

  // ---------- 関係・糸の調べ物 ----------
  const relList = (w, types) => { const h = hero(w); return Object.keys(h.relations).map(id => ({ id, rel: h.relations[id], p: w.people[id] })).filter(x => x.p && x.p.alive && !x.p.missing && !x.p.away && x.rel.type !== 'parted' && (!types || types.includes(x.rel.type))); };   // 行方知れずの人は、ふつうの配役・仲間には数えない
  const allies = w => relList(w, D.ALLY_TYPES);
  const openThreads = (w, id) => w.threads.filter(t => !t.closed && (!id || t.id === id));
  const metCount = p => p.life.length;
  // 敵だった人（敵・仇になったことがある／恨みの糸がある）・和解した人（もう敵・仇ではないが、かつて敵だった／恨みの糸を閉じた）
  const foeOf = (w, id) => { const r = hero(w).relations[id]; return !!(r && (r.foe != null || HOSTILE_T.includes(r.type))) || w.threads.some(t => t.id === 'grudge' && t.who === id); };
  const reconciled = (w, id) => { const r = hero(w).relations[id]; return !!r && !HOSTILE_T.includes(r.type) && (r.foe != null || w.threads.some(t => t.id === 'grudge' && t.who === id && t.closed) ); };
  const evMoOf = (w, evId) => { const t = +String(evId).slice(1), ev = w.log[t - 1]; return ev && ev.id === evId ? ev.mo : null; };
  const lastSeen = (w, p) => { const id = p.life[p.life.length - 1], t = +String(id || '').slice(1); return /^e[0-9]+$/.test(id || '') && w.log[t - 1] && w.log[t - 1].id === id ? { turn: t, mo: w.log[t - 1].mo } : null; };
  const yearsKnown = (w, p) => { const m = evMoOf(w, p.life[0] || ''); return m == null ? Infinity : (w.mo - m) / 12; };   // 最初に会ってからの年数（記録が無い人＝検査用に作った人は十分長いことにする）
  const bondDef = ent => { const role = (ent && ent.role) || ''; return RE_BOND.find(x => x.re.test(role)) || null; };
  const hostileRole = ent => !!(ent && ((ent.pick && (ent.pick.thread === 'grudge' || listOf(ent.pick.rel).some(t => HOSTILE_T.includes(t)))) || (RE_HOSTILE_ROLE && RE_HOSTILE_ROLE.test(ent.role || ''))));
  // 配役の候補（すでに関係のある人・糸に結びついた人）。used＝この台本で先に選んだ人
  // 糸は人ごとに別の糸。pick.thread は、その糸が張られて2話以上たった人から選ぶ。亡くなった人・別れた人は、台本が need.threadDead のときだけ（そのときは、その人たちだけ）
  // 恋の型（romance）の配役は、主人公との年齢差が小さい人に限る（主人公が25歳以下なら±6歳、それより上なら±12歳）。台本が自分で年上・年下を指定した配役
  // （pick.minAge が窓の上より大きい／pick.maxAge が窓の下より小さい。例：指摘する年長の第三者）には窓をかけない。戻り値＝[下限, 上限]、かけないときは null
  function romanceWin(w, ep, pk) {
    if (ep.type !== 'romance') return null;
    const a = hero(w).age, tol = a <= 25 ? 6 : 12, lo = Math.max(16, Math.ceil(a - tol)), hi = Math.floor(a + tol);
    if ((pk.minAge != null && pk.minAge > hi) || (pk.maxAge != null && pk.maxAge < lo)) return null;
    return [lo, hi];
  }
  function candsFor(w, ep, ent, used, turn) {
    const h = hero(w), pk = ent.pick || {}, noKid = NOKID_TYPES.has(ep.type), dead = !!(ep.need || {}).threadDead, miss = !!(ep.need || {}).threadMissing, away = !!(ep.need || {}).threadAway;
    let list = [];
    if (pk.rel) list = relList(w, pk.rel).filter(x => x.rel.trust >= (pk.minTrust == null ? -100 : pk.minTrust) && metCount(x.p) >= (pk.minMet == null ? 0 : pk.minMet)).map(x => x.p);
    else if (pk.thread) {
      const seen = new Set();
      openThreads(w, pk.thread).forEach(t => {
        const p = w.people[t.who]; if (!p || p.id === h.id || seen.has(p.id) || !h.relations[p.id] || turn - t.turn < 2) return;
        const gone = !p.alive || h.relations[p.id].type === 'parted', lost = !!p.missing && p.alive, off = !!p.away && p.alive && !lost;
        // 亡くなった人・別れた人は threadDead の台本だけ／行方知れずの人は threadMissing の台本だけ／旅に出ている人は threadAway の台本だけ／それ以外はふつうの台本
        if (away ? off : miss ? lost : dead ? gone : (!gone && !lost && !off)) { seen.add(p.id); list.push(p); }
      });
    }
    const rw = romanceWin(w, ep, pk);
    // 第6回：①和解した人は、敵役に選ばない ②役の既定の条件（看取り・形見・打ち明け・恋仲に、昨日会ったばかりの人・会って間もない人を選ばない。台本の pick.minMet が先）③敵だった人は、和解して4話たつまで親しい役に選ばない
    const hostile = hostileRole(ent), def = bondDef(ent), h2 = hero(w);
    return list.filter(p => {
      if (used.has(p.id) || (noKid && p.age < 14) || (pk.minAge != null && p.age < pk.minAge) || (pk.maxAge != null && p.age > pk.maxAge) || (rw && (p.age < rw[0] || p.age > rw[1]))) return false;
      if (hostile) return !reconciled(w, p.id);
      if (def) {
        // 会ったのが1回きりで、最初に会ってから1年たたない人（昨日会ったばかりの人）は、看取り・形見・打ち明けなどの役に選ばない。糸で結ばれた人は、糸の分の時がたっているので回数は問わない
        const yk = yearsKnown(w, p), need2 = pk.minMet == null ? def.minMet : 0;
        if (yk < (pk.minYears != null ? pk.minYears : def.floor)) return false;
        if (!pk.thread && metCount(p) < need2 && yk < def.years) return false;
      }
      if (def || ent.role && /恋|想う|最愛/.test(ent.role)) { const r = h2.relations[p.id]; if (r && r.foe != null && !HOSTILE_T.includes(r.type) && turn - (r.typeSince || r.since || 0) < FOE_COOL) return false; }
      return true;
    });
  }
  // 仲間（companion・lover）が必ず要る台本（任意の配役ではなく、pick.rel に仲間の種類を含む）。仲間がいる人生では出やすくする・型の once の外にする、に使う
  const allyCast = ep => !!(ep && (ep.cast || []).some(e => e && !e.optional && e.pick && e.pick.rel && listOf(e.pick.rel).some(t => D.ALLY_TYPES.includes(t))));
  // 台本が起こせるか（配役・糸・時期）。乱数は使わない
  // 型紙の typical_position：序盤＝第9話まで（stage 0・1）／中盤以降＝第5話から（stage 1・2）
  // 台本が stage を書いていれば、それが優先（型紙の位置は、台本が stage を書かないときの既定）
  function posOk(ep, turn) {
    if (Array.isArray(ep.stage) && ep.stage.length) return true;
    const pos = ep.tpl && TPLS[ep.tpl] && TPLS[ep.tpl].pos, st = stageOf(turn);
    return !(pos === '序盤' && st === 2) && !(pos === '中盤以降' && st === 0);
  }
  // relax＝時期（stage・型紙の位置）だけ見ない（埋め草が続くのを避けるときの引き直し）。順番・印・糸・配役は緩めない
  function feasible(w, ep, turn, relax) {
    const h = hero(w), need = ep.need || {};
    if (w.used.includes(ep.id)) return false;
    if (!relax && !(ep.stage || [0, 1, 2]).includes(stageOf(turn))) return false;
    if (!relax && !posOk(ep, turn)) return false;
    if (need.has && !listOf(need.has).every(m => marksOf(w).includes(m))) return false;
    if (need.hasAny && listOf(need.hasAny).length && !listOf(need.hasAny).some(m => marksOf(w).includes(m))) return false;   // どれか1つが立っていればよい
    if (need.not && listOf(need.not).some(m => marksOf(w).includes(m))) return false;
    const own = listOf(need.after).length > 0 || listOf(need.has).length > 0 || listOf(need.hasAny).length > 0;   // 台本が自分で順番・前提を書いている：エンジンの既定（ENGINE_BEFORE・型の once）は効かせない
    if (need.before || need.after || (!own && ENGINE_BEFORE[ep.type])) {
      const done = new Set(w.log.map(e => e.type));
      if (need.before && listOf(need.before).some(t => done.has(t))) return false;   // その型がもう起きていたら出ない
      if (need.after && !listOf(need.after).some(t => done.has(t))) return false;    // どれかが起きた後にだけ出る
      if (!own && ENGINE_BEFORE[ep.type] && ENGINE_BEFORE[ep.type].some(t => done.has(t))) return false;
    }
    if (need.minTurn != null && turn < need.minTurn) return false;
    if (need.maxTurn != null && turn > need.maxTurn) return false;
    if (D.TYPES[ep.type] && D.TYPES[ep.type].once && !own && !allyCast(ep) && w.log.some(e => e.type === ep.type)) return false;   // 仲間（companion・lover）が必ず要る台本（first_battle-04a 粉ひき小屋の夜＝仲間と組んでから初めて守る戦い）は、仲間のいらない初戦が先に済んでいても出られる（第5回：300人生で一度も出なかった）   // 「登録」のあとの「昇格試験」のように、台本が need.after／has を書いた同じ型は、2本目以降も出られる
    if (ep.type === 'arrival' && turn !== 1 && !listOf(need.after).length) return false;   // 転生は第1話だけ。ただし need.after を持つ arrival（転生のあとの道中など）は第2話以降に出られる
    if (ep.type === 'romance' && h.age < 16) return false;
    for (const id of (need.threads || [])) { const t = openThreads(w, id).find(x => turn - x.turn >= 2); if (!t) return false; }
    for (const id of (need.noThreads || [])) if (openThreads(w, id).length) return false;
    if (need.cheat && !listOf(need.cheat).some(id => h.skills.some(s => s.id === id))) return false;   // 授かった力（チートの印のあるスキル）
    if (need.skill && !listOf(need.skill).some(id => h.skills.some(s => s.id === id))) return false;
    if (need.minGold != null && (h.stats.金 || 0) < need.minGold) return false;
    const used = new Set([h.id]);
    for (const ent of (ep.cast || [])) {
      const pk = ent.pick || {};
      if (pk.rel || pk.thread) {
        const l = candsFor(w, ep, ent, used, turn);
        if (!l.length) { if (ent.optional || pk.optional) continue; return false; }
        used.add(l[0].id);
      }
    }
    return true;
  }

  // ---------- 暦 ----------
  const SEASON_OF = k => D.SEASONS[Math.floor(k / 3)];
  // 第3版の直し：「N年目」は、物語のはじめの暦から数えた暦の年（1月に変わる）。以前は「はじめから12か月ごと」で数えていたので、
  // 同じ「2年目」の中で 夏の終わり→春のなかば（暦では翌年の春）と並び、時が戻ったように読めた。いまは月が年の中で必ず進み、年が変わるのは年をまたいだときだけ。
  // 第7回の直し：「N年目」は、転生してからの満年数（転生した月の月日から12か月ごと）で数える。年齢も同じ区切りで上がるので、「三年目の冬」(25歳)→「3年目の夏」(26歳) のように、年目が同じなのに年齢が上がることが無い。月は年の中で（転生の月から）必ず進む
  // abs＝はじめの月から数えた通し月（mo0＋たった月数）。月＝abs%12+1、年＝floor(abs/12)
  function whenOf(w, R, turn) {
    const abs = w.mo0 + Math.floor(w.mo), gap0 = abs - (w.lastAbs == null ? abs : w.lastAbs), mon = abs % 12 + 1, k = (mon + 9) % 12, s = SEASON_OF(k), ph = D.PHASES[k % 3], yi = Math.floor(Math.floor(w.mo) / 12), base = s + 'の' + ph;
    let form, text;
    if (turn === 1) { form = 'first'; text = base; }
    else if (yi > (w.lastYi || 0)) { form = 'year'; text = (yi === 1 ? '翌年の' : (D.KANJI_NUM[yi + 1] || (yi + 1)) + '年目の') + base; }
    else { form = w.lastForm === 'gap' || gap0 < 2 ? 'plain' : (R() < 0.5 ? 'gap' : 'plain'); text = form === 'gap' ? (D.KANJI_NUM[gap0] || gap0) + 'か月ほどたった' + base : base; }
    w.lastYi = yi; w.lastForm = form; w.lastAbs = abs;
    return { text, season: s, month: mon, year: yi + 1 };
  }

  // ---------- 話し方 ----------
  // 話し手 sp が聞き手 lst をどう呼ぶか。間柄：敵・仇＝foe／仲間・恋仲・師・後ろ盾・信頼40以上＝close／聞き手が15歳以上年上、または話し手が子ども＝up／ほか＝plain
  function relFor(w, sp, lst) {
    const h = hero(w), other = sp.id === h.id ? lst : sp, r = other && h.relations[other.id], ty = r ? r.type : null;
    return ty === 'enemy' || ty === 'nemesis' ? 'foe' : ty === 'companion' || ty === 'lover' || ty === 'mentor' || ty === 'patron' || (r && r.trust >= 40) ? 'close' : ((lst && lst.age - sp.age >= 15) || sp.age < 12) ? 'up' : 'plain';
  }
  function youFor(w, sp, lst) {
    const V = g.PersonaVoice; if (!V || !V.pickYou || !sp) return null;
    return V.pickYou(sp, lst || null, relFor(w, sp, lst));
  }
  // mono＝独り言（決め語尾の付け替えをしない・{君}を使わない）
  function saySpeak(w, R, person, da, desu, listener, map, mono, tone) {
    const V = g.PersonaVoice, vk = person.voice, ok = V && vk && V.VOICES && V.VOICES[vk];
    const raw = fmt(!mono && ok && V.VOICES[vk].base === 'desu' ? (desu || da) : (da || desu), map);   // 独り言（mono）は話し手の型が desu でも、台本の da の文を使う
    if (mono) { const t = ok ? V.apply(raw, vk, R, person.me, '', { tone: TONES.includes(tone) ? tone : 'normal', mono: true }) : raw.replace(/{私}/g, person.me || '自分'); return t.replace(/{君}/g, ''); }   // 独り言：決め語尾・相手向けの語尾は付かず、一人称と芯（じゃ・でござる）だけ効く
    const you = youFor(w, person, listener), up = !!person && relFor(w, person, listener) === 'up';   // 目上に言うとき（up）は、〜って・〜じゃん・〜やん を付けない
    // 第6引数 opts＝{ tone: 場面の調子（normal・grave・tense）, mono }。受け取る側が未対応でも、余分な引数は無視されるので壊れない
    return ok ? V.apply(raw, vk, R, person.me, you, { tone: TONES.includes(tone) ? tone : 'normal', mono: false, up }) : raw.replace(/\{私\}/g, person.me || '自分').replace(/\{君\}/g, you || 'あなた');
  }
  // 台本の step が台詞か：{ who, da, desu }／{ who, say:{da,desu} }／{ say:{ who, da, desu } } のどれでも読む
  function speechOf(st) {
    if (!st || st.choice) return null;
    if (st.say && typeof st.say === 'object') return { who: st.who || st.say.who || null, da: st.say.da, desu: st.say.desu, mono: !!(st.say.mono || st.mono), tone: st.say.tone || st.tone || null, to: st.to || st.say.to || null };
    if (st.da != null || st.desu != null) return { who: st.who || null, da: st.da, desu: st.desu, mono: !!st.mono, tone: st.tone || null, to: st.to || null };
    return null;
  }

  // ---------- 条件 if ----------
  // 主人公の状態を見る条件（世界 w が要る）：'skill:fire'（そのスキルを覚えている）・'cheat:c_growth'（その授かった力を持つ）・'gold>=5'（所持金）・'flag:けが'・'has:registered'（事実の印）・
  // 'hasThread:debt'（その糸が、いま張られている＝閉じていない糸が1本でもある。need.threads に書かなくてよい）・'trust:A>=30'（配役 A の主人公への信頼。A がいないときは偽）。
  // w が無いとき（検査の道の追跡）は、どちらもありうるものとして、常に真にする。
  const GOLD_RE = /^gold(>=|<=|>|<)(\d+)$/;
  const TRUST_RE = /^trust:([A-Za-z][A-Za-z0-9_]*)(>=|<=|>|<)(-?\d+)$/;   // 'trust:A>=30'（配役 A の主人公への信頼）
  const RAND_RE = /^rand:([0-9]+):([0-9]+)$/;   // 'rand:3:0'＝道を無作為に3つに分けたうちの0番目（人生の種と台本の id から決まる。同じ種なら同じ。1つの台本の中では、どの文・選択肢でも同じ答え）
  const randPick = (w, epId, n) => Math.floor(localRng(hashSeed(w.seed) ^ hashSeed('rand:' + epId + ':' + n))() * n);
  const WORLD_KINDS = ['skill', 'cheat', 'flag', 'has', 'hasAny', 'hasThread'];   // 'hasAny:shop,home'＝事実の印のどれか1つが立っている
  function ifOk(c, cond, w) {
    if (cond == null || cond === '') return true;
    if (Array.isArray(cond)) return cond.every(x => ifOk(c, x, w));
    let s = String(cond), neg = false;
    if (s[0] === '!') { neg = true; s = s.slice(1); }
    let v;
    const rm = RAND_RE.exec(s);
    if (rm) { if (!w) return true; v = randPick(w, c.epId, +rm[1]) === +rm[2]; return neg ? !v : v; }   // 検査の道の追跡（w が無い）では、どの道もありうる
    const gm = GOLD_RE.exec(s), tm = TRUST_RE.exec(s), wk = s.split(':');
    if (wk.length === 2 && wk[0] === 'reunion') { if (!w) return true; v = !!(c.reunion && c.reunion[wk[1]]); return neg ? !v : v; }   // 'reunion:A'＝配役 A は、最後に会ってから久しい（4話以上、または2年以上）。道の追跡ではどちらもありうる
    if (gm || tm || (wk.length === 2 && WORLD_KINDS.includes(wk[0]))) {
      if (tm && !c.cast[tm[1]]) return neg;   // その配役がいなければ、信頼の条件は偽（道の追跡でも同じ）
      if (!w) return true;
      const h = hero(w);
      if (tm) { const pid = c.cast[tm[1]]; if (!pid) return neg; const tr = (h.relations[pid] || { trust: 0 }).trust, n = +tm[3]; v = tm[2] === '>=' ? tr >= n : tm[2] === '<=' ? tr <= n : tm[2] === '>' ? tr > n : tr < n; return neg ? !v : v; }
      if (gm) { const g0 = h.stats.金 || 0, n = +gm[2]; v = gm[1] === '>=' ? g0 >= n : gm[1] === '<=' ? g0 <= n : gm[1] === '>' ? g0 > n : g0 < n; }
      else if (wk[0] === 'flag') v = h.flags.includes(wk[1]);
      else if (wk[0] === 'has') v = marksOf(w).includes(wk[1]);   // 事実の印（世界の旗）
      else if (wk[0] === 'hasAny') v = wk[1].split(',').some(m => marksOf(w).includes(m));
      else if (wk[0] === 'hasThread') v = openThreads(w, wk[1]).length > 0;   // いま張られている糸
      else v = h.skills.some(x => x.id === wk[1] && x.lv >= 1);   // skill・cheat（cheat は授かった力＝チートの印のあるスキルを持つこと）
      return neg ? !v : v;
    }
    if (s === 'touch') v = !!c.touchHit;   // 主人公の過去が、この台本の touch に当たる
    else if (s.indexOf(':') < 0) v = !!c.cast[s];
    else {
      const p = s.split(':');
      if (p[0] === 'thread') v = (c.threadsAt || []).includes(p[1]);
      else if (p.length === 2) v = c.picked[p[0]] === p[1] || c.out[p[0]] === p[1];
      else v = c.picked[p[0]] === p[1] && c.out[p[0]] === p[2];
    }
    return neg ? !v : v;
  }

  // ---------- 効果 ----------
  function statNow(w, who, key) { return w.people[who].stats[key] || 0; }
  function clampStat(key, v) { return key === '力' || key === '技' || key === '心' ? clamp(v, 0, 20) : key === '名声' ? clamp(v, 0, 99) : key === '金' ? Math.max(0, v) : key === '命' ? Math.min(v, TN.maxLife) : key === '絆' ? clamp(v, 0, 100) : v; }
  function applyEffect(w, ev, e) {
    const h = hero(w);
    switch (e.t) {
      case 'meet': { const P = w.people[e.id]; if (P) P.met = ev.turn; return; }
      case 'item': {
        const P = w.people[e.who]; if (!P) { warn('item: 人がいない'); return; }
        const cur = P.items.find(i => i.no === e.no);
        if (e.n > 0) { if (cur) cur.n += e.n; else P.items.push({ no: e.no, n: e.n, turn: ev.turn, from: ev.id }); }
        else { if (!cur || cur.n < -e.n) { warn('item: 持っていない物を失う ' + e.no); return; } cur.n += e.n; if (cur.n <= 0) P.items.splice(P.items.indexOf(cur), 1); }
        return;
      }
      case 'skill': { const P = w.people[e.who]; const cur = P.skills.find(s => s.id === e.id); if (cur) cur.lv = Math.max(cur.lv, e.lv); else P.skills.push({ id: e.id, lv: e.lv, turn: ev.turn, from: ev.id }); return; }
      case 'stat': { const P = w.people[e.who]; P.stats[e.key] = clampStat(e.key, (P.stats[e.key] || 0) + e.d); return; }
      case 'rel': {
        const A = w.people[e.a], B = w.people[e.b]; if (!A || !B) { warn('rel: 人がいない ' + JSON.stringify(e)); return; }
        let r = A.relations[e.b];
        if (e.type) { if (!r) r = { type: e.type, trust: e.trust || 0, since: ev.turn, typeSince: ev.turn, notes: [] }; else if (r.type !== e.type) { r.type = e.type; r.trust = e.trust || 0; r.typeSince = ev.turn; } else r.trust = Math.max(r.trust, e.trust || 0); if (HOSTILE_T.includes(e.type) && r.foe == null) r.foe = ev.turn; }   // typeSince＝いまの関係の種類になった話／foe＝敵・仇になったことがある話（和解したあとも残す）
        else if (r) r.trust += e.d || 0;
        else { warn('rel: 関係が無い ' + JSON.stringify(e)); return; }
        r.trust = clamp(r.trust, -100, 100); if (e.known) r.known = true; if (!r.notes.includes(ev.id)) r.notes.push(ev.id);
        A.relations[e.b] = r; B.relations[e.a] = JSON.parse(JSON.stringify(r)); return;
      }
      case 'death': { const P = w.people[e.id]; if (!P) { warn('death: 人がいない'); return; } P.alive = false; P.missing = false; P.away = false; return; }
      case 'mark': { const m = marksOf(w), i = m.indexOf(e.name); if (e.on && i < 0) m.push(e.name); if (!e.on && i >= 0) m.splice(i, 1); return; }
      case 'missing': { const P = w.people[e.id]; if (P) { P.missing = true; P.away = false; } return; }
      case 'found': { const P = w.people[e.id]; if (P) P.missing = false; return; }
      case 'away': { const P = w.people[e.id]; if (P) { P.away = true; P.missing = false; } return; }   // 旅に出ている（行方知れずではない。糸は残る）
      case 'back': { const P = w.people[e.id]; if (P) P.away = false; return; }
      case 'flag': { const P = w.people[e.who], i = P.flags.indexOf(e.flag); if (e.on && i < 0) P.flags.push(e.flag); if (!e.on && i >= 0) P.flags.splice(i, 1); P.flagAt = P.flagAt || {}; if (e.on) P.flagAt[e.flag] = ev.turn; else delete P.flagAt[e.flag]; return; }   // flagAt＝負った話の番号（けがの回復に使う）
      case 'goal': h.goal.progress = clamp(h.goal.progress + e.d, 0, 100); return;
      case 'job': { w.people[e.who].job = e.job; return; }
      default: warn('知らない効果: ' + e.t);
    }
  }
  function pickItem(w, R, spec) {
    if (spec.name) return ITEM_BYNAME[spec.name] || null;
    const tier = spec.tier == null ? 0 : spec.tier, h = hero(w);
    let list = (BYCAT[spec.cat] || []).filter(it => !RE_BAN.test(it.name) && !(it.cat === '通貨・身分・取引' && it.no <= 468));
    if (!list.length) return null;
    let l2 = list.filter(it => TIER[it.no] === tier); if (!l2.length) l2 = list.filter(it => TIER[it.no] <= tier); if (!l2.length) l2 = list;
    if (!STACK_CATS.has(spec.cat)) { const l3 = l2.filter(it => !h.items.some(i => i.no === it.no)); if (l3.length) l2 = l3; }
    return pick(R, l2);
  }
  // fx（台本の書き方）を効果の一覧に直し、一つずつ適用する。戻り値＝この fx で起きた効果
  function doFx(w, R, c, list) {
    const h = hero(w), out = [], ev = { id: 'e' + c.turn, turn: c.turn };
    const idOf = k => (k == null ? null : k === 'H' ? h.id : c.cast[k] || null);
    const emit = e => { applyEffect(w, ev, e); c.eff.push(e); out.push(e); };
    // 命が尽きる終わりは、危険な話（戦い・迷宮・強敵・救出・裏切りと報い・試合）の中でだけ。暮らし・商い・祭り・恋などの話では、命が0になる減り方をしても1で踏みとどまり、けがを負う
    // （校閲6回目：石鹸づくりの過労の話で、後日談まで書いたあとに急死した）
    const stat = (key, d, why) => {
      const cur = statNow(w, h.id, key); let nv = clampStat(key, cur + d);
      if (key === '命' && nv <= 0 && cur > 0 && !DANGER_TYPES.includes(c.type)) { nv = 1; if (!h.flags.includes('けが')) emit({ t: 'flag', who: h.id, flag: 'けが', on: true }); }
      const dd = nv - cur; if (dd) emit({ t: 'stat', who: h.id, key, d: dd });
    };
    (list || []).forEach(f => {
      if (!Array.isArray(f)) { warn('fx が配列でない'); return; }
      const op = f[0];
      if (op === 'stat') stat(f[1], f[2]);
      else if (op === 'gold') stat('金', f[1]);
      else if (op === 'life') stat('命', f[1]);
      else if (op === 'bond') stat('絆', f[1]);
      else if (op === 'goal') {
        // 第3版：['goal', n, 望みの種類]。主人公の望みと合えば n、合わなければ n の3分の1（四捨五入・最低1）。3つ目が無い古い書き方は n の6割（最低1）。'any'＝種類を問わない（エンジンの札が使う）
        const n = +f[1] * (n0 => n0 > 0 ? GOAL_MUL : 1)(+f[1]); let d;   // GOAL_MUL：台本の数字を、1つの人生（約12話）で成就に届く大きさに引き伸ばす
        if (f[2] === 'any') d = Math.round(n);
        else if (WISH_NAMES.includes(f[2])) d = pm(h).wish === f[2] ? Math.round(n) : (n > 0 ? Math.max(1, Math.round(n / 3)) : Math.round(n));
        else d = n > 0 ? Math.max(1, Math.round(n * 0.6)) : Math.round(n);
        const cur = h.goal.progress, dd = clamp(cur + d, 0, 100) - cur; if (dd) emit(f[2] === pm(h).wish ? { t: 'goal', d: dd, m: 1 } : { t: 'goal', d: dd });   // m＝望みの種類が合った進み（終わりの文が、望みと人生のずれを見る）
      }
      else if (op === 'set' || op === 'unset') { const on = op === 'set', name = String(f[1]); if (on !== marksOf(w).includes(name)) emit({ t: 'mark', name, on }); if (on && name === 'home') w.homePlace = c.place; if (c.loc) { const k = { home: 'homeLoc', shop: 'shopLoc', lodging: 'lodgeLoc' }[name]; if (k) w[k] = on ? c.loc.id : null; } }
      else if (op === 'missing') { const id = idOf(f[1]); if (id && id !== h.id && w.people[id] && w.people[id].alive && !w.people[id].missing) emit({ t: 'missing', id }); }
      else if (op === 'found') { const id = idOf(f[1]); if (id && w.people[id] && w.people[id].missing) emit({ t: 'found', id }); }
      else if (op === 'away') { const id = idOf(f[1]); if (id && id !== h.id && w.people[id] && w.people[id].alive && !w.people[id].away) emit({ t: 'away', id }); }
      else if (op === 'back') { const id = idOf(f[1]); if (id && w.people[id] && w.people[id].away) emit({ t: 'back', id }); }
      else if (op === 'flag') { const on = !!f[2], has = h.flags.includes(f[1]); if (on !== has) emit({ t: 'flag', who: h.id, flag: f[1], on }); else if (on) { h.flagAt = h.flagAt || {}; h.flagAt[f[1]] = c.turn; } }   // 負っているところにまた負ったら、数え直す
      else if (op === 'item') {
        const it = pickItem(w, R, f[1] || {}); if (!it) { warn('item: 物が見つからない ' + JSON.stringify(f[1])); return; }
        const src = idOf(f[2]); emit({ t: 'item', who: h.id, no: it.no, n: 1, via: f[3] || 'find', src: src || null });
      }
      else if (op === 'lose') {
        const spec = f[1] || {}; let no = null;
        if (spec.name) { const it = ITEM_BYNAME[spec.name]; if (it && h.items.some(i => i.no === it.no && i.n > 0)) no = it.no; }
        else { const l = h.items.filter(i => i.n > 0 && INFO[i.no].cat === spec.cat).sort((a, b) => a.no - b.no); if (l.length) no = l[0].no; }
        if (no != null) emit({ t: 'item', who: h.id, no, n: -1, lost: true });
      }
      else if (op === 'skill') {
        const spec = f[1] || {}; let s = null;
        if (spec.id) s = SK[spec.id];
        else { const cand = D.SKILLS.filter(x => x.cat === spec.cat && ((h.skills.find(y => y.id === x.id) || { lv: 0 }).lv < 5)); if (cand.length) s = wpick(R, cand, x => (h.skills.some(y => y.id === x.id) ? 0.7 : 1)); }
        if (s) { const have = (h.skills.find(y => y.id === s.id) || { lv: 0 }).lv; if (have < 5) { const e = { t: 'skill', who: h.id, id: s.id, lv: have + 1 }, tid = idOf(f[2]); if (tid) e.teacher = tid; emit(e); } }
      }
      else if (op === 'rel') { const id = idOf(f[1]); if (id) emit({ t: 'rel', a: h.id, b: id, type: f[2], trust: f[3] == null ? 0 : f[3] }); }
      else if (op === 'trust') { const id = idOf(f[1]); if (id && h.relations[id]) emit({ t: 'rel', a: h.id, b: id, type: null, d: f[2] }); }
      else if (op === 'known') { const id = idOf(f[1]); if (id && h.relations[id]) emit({ t: 'rel', a: h.id, b: id, type: null, d: 0, known: true }); }
      else if (op === 'death') { const id = idOf(f[1]); if (id && id !== h.id && w.people[id].alive) emit({ t: 'death', id }); }
      else if (op === 'job') emit({ t: 'job', who: h.id, job: String(f[1]) });
      else warn('知らない fx: ' + op);
    });
    return out;
  }

  // 糸を張る約束（台本全体の opens・step の opens・選択肢の win/lose の opens）。memo はいまの値で埋めて持つ。実際に張るのは台本の終わり
  function recordOpens(w, c, list, map) {
    listOf(list).forEach(o => {
      if (!o || !o.id || !ifOk(c, o.if, w)) return;
      const who = o.who ? c.cast[o.who] : null; if (o.who && !who) return;
      c.opensNow.push({ id: o.id, who: who || null, memo: o.memo != null ? fmt(o.memo, map) : null });
    });
  }

  // ---------- 台本を始める ----------
  // {死}＝主人公の前世の終わり方の2文（過去ごと。段落として使える形）。{糸}＝引いている糸の memo（張った時点の値で埋めてある）
  function deathText(h) {
    const a = D.ARRIVAL_DEATH && D.ARRIVAL_DEATH[h.persona.past], pj = String(h.prevJob || '').replace(/（.*?）/g, '') || '旅の者';
    return fmt(a ? a.join('') : '{前職}として過ごした前の世の記憶は、そこで途切れていた。', { 前職: pj, 名: h.nick });
  }
  // 配役の職→武器の言葉（表は build-story-data.mjs の ARMS）。職が分からない・表に無い人は「得物」
  function armsOf(p) { const j = p ? String(p.job || '').replace(/（.*?）/g, '') : ''; return (D.ARMS.job[j]) || '得物'; }
  // {力}＝授かった力の名前（保存に gift が無い古い世界では、チートの印のあるスキルの先頭）
  function giftName(h) { const id = h.gift || (h.skills.find(x => SK[x.id] && SK[x.id].cheat) || {}).id; return id && SK[id] ? SK[id].name : '授かった力'; }
  function castMap(w, c) {
    const h = hero(w), m = { 名: h.nick, 場所: (c.loc && c.loc.name) || D.PLACE_NAME[c.place] || c.place, 国: (c.loc && c.loc.nation) || 'この国', 場所の種類: D.PLACE_NAME[c.place] || c.place, 時: c.when, 前職: String(h.prevJob || '').replace(/（.*?）/g, '') || '旅の者', 死: deathText(h), 力: giftName(h) };
    if (c.threadMemo != null) m['糸'] = c.threadMemo;
    Object.keys(c.castAll).forEach(k => {
      m[k] = c.cast[k] ? nickOf(w, c.cast[k]) : '【?' + k + '】';
      const arm = armsOf(c.cast[k] ? personAny(w, c.cast[k]) : null);   // {A武器}（剣・杖・弓…）{A戦い方}（「剣を抜いた」「杖をかまえた」…）：配役の職から。職が表に無ければ「得物」
      m[k + '武器'] = arm; m[k + '戦い方'] = (D.ARMS.style[arm] || arm + 'をかまえた');
    });
    return m;
  }
  // 埋め草の組：この人生でまだ使っていない組から選ぶ（使い切っていたら全部から）
  function fillerVariant(w, R) {
    const kinds = fillerKinds(w), all = FILLER_SETS.map((_, i) => i).filter(i => kinds.includes(FILLER_SETS[i].k));
    const used = w.fillerUsed || (w.fillerUsed = []), free = all.filter(i => !used.includes(i)), v = pick(R, free.length ? free : all);
    used.push(v); return v;
  }
  // 埋め草の場所：住まいがあれば（home の場所→最後にいた町・村→町）、宿だけなら最後にいた町・村、どちらも無ければ最後にいた所（旅の空でよい所ならそのまま）
  function fillerPlace(w, R, ep) {
    const marks = marksOf(w), h = hero(w);
    if (marks.includes('home')) return SETTLE.includes(w.homePlace) ? w.homePlace : SETTLE.includes(w.lastTown) ? w.lastTown : 'town';
    if (marks.includes('lodging')) return INN_TOWNS.includes(w.lastTown) ? w.lastTown : 'town';   // 宿がある所（村・町・港町。畑のそばには宿が無い）
    return ep.place.includes(h.place) ? h.place : pick(R, ep.place);
  }
  // 引かれていない糸に結びついた人（まだ触れていない人）に触れる1文。糸の memo は使わない。状態（亡くなった・行方知れず）も決めつけない
  function fillerExtraFor(w) {
    const h = hero(w), who = w.fillerWho || (w.fillerWho = []);
    const t = w.threads.filter(x => !x.closed && x.who && x.who !== h.id && w.people[x.who] && !who.includes(x.who)).sort((a, b) => a.turn - b.turn)[0];
    if (!t) return null;
    who.push(t.who); return w.people[t.who].nick + 'のことを、ふと思い出した。';
  }
  const _ur = {};
  function usesReunion(ep) { if (!(ep.id in _ur)) _ur[ep.id] = /reunion:/.test(JSON.stringify(ep.steps || [])); return _ur[ep.id]; }
  // 月を進める（年齢も進む）。場所を移る日数など、話の間以外の時間の経過に使う
  function addMonths(w, dm) { w.mo += dm; const dt = dm / 12; Object.keys(w.people).forEach(pid => { const P = w.people[pid]; if (P.alive) P.age = P.id === w.heroId ? w.age0 + w.mo / 12 : r2(P.age + dt); }); }
  // 世界の上で場所を選ぶ。世界が無い・場所が決められない人生は null（従来の、場所の種類だけの動き）
  function chooseLoc(w, R, ep, turn) {
    const SW = SWd(); if (!SW || !w.loc) return null;
    const marks = marksOf(w), visits = {}; w.log.forEach(e => { if (e.loc) visits[e.loc.id] = (visits[e.loc.id] || 0) + 1; });
    const o = { gens: ep.place && ep.place.length ? ep.place : ['village'], type: ep.type, from: w.loc, home: marks.includes('home') ? w.homeLoc : marks.includes('shop') ? w.shopLoc : null, visits, off: offOf(w), first: turn === 1 };
    if (ep.filler) { const fx = marks.includes('home') && w.homeLoc ? w.homeLoc : marks.includes('lodging') ? (w.lodgeLoc || w.lastTownLoc) : null; if (fx) o.fixed = fx; }   // 埋め草は、住まい・宿のある所で
    let r = SW.choose(R, o);
    if (!r && o.fixed) { delete o.fixed; r = SW.choose(R, o); }
    return r;
  }
  // ep を始める。配役が決まらなければ null（乱数と人の番号は元に戻す）。o.dropOptional＝任意の配役を外す（検査用）
  function begin(w, ep, o) {
    o = o || {};
    const rng0 = w.rng, nid0 = w.nid, R = rngOf(w), h = hero(w), turn = w.turn + 1, cast = {}, used = new Set([h.id]), ents = ep.cast || [];
    // 既存の人の配役を先に決める
    for (const ent of ents) {
      const pk = ent.pick || {};
      if (!(pk.rel || pk.thread)) continue;
      if (ent.optional && o.dropOptional) continue;
      const l = (pk.thread && pk.optional && o.dropOptional) ? [] : candsFor(w, ep, ent, used, turn);
      if (!l.length) { if (ent.optional || pk.optional) continue; w.rng = rng0; w.nid = nid0; return null; }
      const p = wpick(R, l, x => 1 + Math.max(0, (h.relations[x.id] || { trust: 0 }).trust) / 25);
      cast[ent.key] = p.id; used.add(p.id);
    }
    // 新しく出会う人
    const newIds = [];
    for (const ent of ents) {
      const pk = ent.pick || {}, fb = pk.new ? pk : (pk.thread && pk.optional && !cast[ent.key]) ? fbOf(ent) : null;   // fallback＝その糸の人がいないときの新しい人
      if (!fb) continue;
      if (ent.optional && o.dropOptional) continue;
      const rw = romanceWin(w, ep, fb), spec = rw ? Object.assign({}, fb, { minAge: Math.max(fb.minAge || 0, rw[0]), maxAge: Math.min(fb.maxAge != null ? fb.maxAge : 99, rw[1]) }) : fb;   // 恋の型は主人公に年の近い人だけ
      const np = newNpc(w, R, fb.new, turn, spec, { role: ent.role, homeKey: ep.place && ep.place.length === 1 ? (D.PLACE_NAME[ep.place[0]] || ep.place[0]) : ep.id }); np.met = turn; w.people[np.id] = np; cast[ent.key] = np.id; newIds.push(np.id);
    }
    // 再会：もとからいた人（新しく出会った人ではない）で、最後に会ってから久しい（4話以上、または2年以上）人。台本は条件 'reunion:A' で文を分けられる。使っていない台本には、エンジンが再会の一文を足す（pick.rel の配役だけ。糸の人は台本が書く）
    const reunion = {};
    for (const ent of ents) {
      const id = cast[ent.key]; if (!id || newIds.includes(id) || id === h.id) continue;
      const ls = lastSeen(w, w.people[id]); if (!ls) continue;
      const gt = turn - ls.turn, yr = (w.mo - ls.mo) / 12;
      if (gt >= REUNION_TURNS || yr >= REUNION_YEARS) reunion[ent.key] = { turns: gt, years: Math.round(yr * 10) / 10 };
    }
    // 世界があれば、場所は地図の上から選ぶ（いまの場所に近い所・その型が起きやすい所・家のある人は暮らしの話を家の近くで）。遠い所へ移る日数は、次の {時} に足す（話の始まりの前に進める）
    const sel = chooseLoc(w, R, ep, turn);
    if (sel && sel.travel >= 1) addMonths(w, sel.travel / 30);
    const wh = whenOf(w, R, turn);
    let place = sel ? sel.g : pick(R, ep.place && ep.place.length ? ep.place : ['village']);
    if (ep.filler && !sel) place = fillerPlace(w, R, ep);   // 埋め草は、住まい・宿の印と最後にいた場所に合わせる
    const time = pick(R, ep.time && ep.time.length ? ep.time : ['day']);
    const castAll = {}; ents.forEach(e => { castAll[e.key] = e.role; });
    const need = ep.need || {};
    // 引く糸（pick.thread の人の糸、無ければ need.threads の先頭の、いちばん古い糸）
    let th = null; const tent = ents.find(e => e.pick && e.pick.thread && cast[e.key]);
    if (tent) th = openThreads(w, tent.pick.thread).find(t => t.who === cast[tent.key]) || null;
    else if (need.threads && need.threads[0]) th = openThreads(w, need.threads[0]).filter(t => turn - t.turn >= 2).sort((a, b) => a.turn - b.turn)[0] || null;
    const tg0 = D.TRIGGERS[h.persona.past], touchAll = listOf(ep.touch).concat(...(ep.steps || []).map(x => listOf(x && x.touch)));
    const c = { epId: ep.id, turn, title: ep.title, type: ep.type, tpl: ep.tpl || null, stake: ep.stake || '', payoff: ep.payoff || '', payoffLose: ep.payoffLose || '', filler: !!ep.filler, fv: ep.filler ? fillerVariant(w, R) : 0, fillerExtra: ep.filler ? fillerExtraFor(w) : null, mo: w.mo, relaxed: !!o.relaxed,
      place, time, bg: D.BG[place] || 'village', season: wh.season, month: wh.month, year: wh.year, when: wh.text, cast, castAll, i: 0, lines: [], eff: [], choices: [], choice: null, picked: {}, out: {}, trigger: null,
      threadsAt: openThreads(w).map(t => t.id), pulled: th ? th.id : (need.threads && need.threads.length) ? need.threads[0] : null, threadId: th ? th.id : null, threadWho: th ? th.who : null, threadMemo: th && th.memo != null ? th.memo : null,
      time0: time, touchHit: !!(tg0 && touchAll.includes(tg0.tag)), reunion, opensNow: [], done: false, age: Math.floor(h.age), force: o.force || null };
    if (sel) { c.loc = sel.loc; c.travel = sel.travel >= 1 ? Math.round(sel.travel) : 0; c.from = w.loc || null; if (sel.loc.bg) c.bg = sel.loc.bg; }
    newIds.forEach(id => c.eff.push({ t: 'meet', id }));
    // 治るときが来たけがは、この話の頭で治す（1文）。古い保存など、治る時刻が無いけがは、いまから90日で治る
    if (h.flags.includes('けが') && h.stats.命 > 0) {
      if (!h.flagHeal) h.flagHeal = { at: w.mo + 3, days: 90 };
      if (w.mo >= h.flagHeal.at - 1e-9) {
        const e = { t: 'flag', who: h.id, flag: 'けが', on: false }; applyEffect(w, { id: 'e' + turn, turn }, e); c.eff.push(e);
        c.lines.push({ k: 'n', t: h.nick + 'のけがは、すっかり治っていた。', fx: [e] }); c.healed = { days: h.flagHeal.days }; h.flagHeal = null;
      }
    }
    // 台本が 'reunion:' の条件を使っていなければ、エンジンが再会の一文を足す（pick.rel の配役で、久しぶりの人。敵役・親しくない役は除く。最大2人）
    if (!ep.filler && Object.keys(reunion).length && !usesReunion(ep)) {
      Object.keys(reunion).filter(k => { const en = ents.find(e => e.key === k); return en && en.pick && en.pick.rel && !hostileRole(en); }).slice(0, 2).forEach(k => {
        const rn = reunion[k], nm = w.people[cast[k]].nick, yrs = Math.round(rn.years);
        const t = yrs >= 2 ? pick(R, ['{n}と顔を合わせるのは、{y}年ぶりだった。', '{n}とは、{y}年ぶりの再会だった。']) : pick(R, ['{n}と顔を合わせるのは、ずいぶん久しぶりだった。', '{n}とは、しばらく会っていなかった。']);
        c.lines.push({ k: 'n', t: t.replace('{n}', nm).replace('{y}', D.KANJI_NUM[yrs] || String(yrs)) }); c.reunionLine = true;
      });
    }
    if (c.stake.indexOf('{') >= 0) c.stake = fmt(c.stake, castMap(w, c));   // stake にも {名}{場所}{A} などを差し込む
    w.cur = c;
    return c;
  }

  // ---------- 次の台本を選ぶ ----------
  // 同じ型の台本の続き・出すぎを避ける（校閲4回目：同じ展開の話がくり返された）。直近の TYPE_GAP 話に同じ型があれば出ない／その型が TYPE_MAX 本を超えたら出ない。埋め草は数えない
  // lenient＝重い糸を引く台本（いまは通常と同じ。型の続き・本数の制限は緩めない：校閲4回目の検査と食い違うため）
  function typeOk(w, e, lenient) {
    if (e.type === 'arrival') return true;
    const sc = w.log.filter(x => !x.filler);
    return !w.log.slice(-TYPE_GAP).some(x => !x.filler && x.type === e.type) && sc.filter(x => x.type === e.type).length < TYPE_MAX + (lenient ? 0 : 0);
  }
  const pullsIds = (e, ids) => listOf((e.need || {}).threads).some(i => ids.has(i)) || (e.cast || []).some(c => c && c.pick && ids.has(c.pick.thread));
  function chooseEpisode(w, R, turn, exclude, relax, info) {
    const h = hero(w), wish = pm(h).wish, prev = w.log[w.log.length - 1], all = epsAll().filter(e => e && e.id && !exclude.has(e.id) && typeOk(w, e) && feasible(w, e, turn, relax));
    const allT = relax ? all : epsAll().filter(e => e && e.id && !exclude.has(e.id) && typeOk(w, e) && feasible(w, e, turn, true));   // 糸を引く台本の候補（時期の縛りを緩めたもの）
    if (!all.length && !allT.length) return null;
    const tplUsed = {}; w.log.forEach(e => { if (e.tpl) tplUsed[e.tpl] = (tplUsed[e.tpl] || 0) + 1; });
    const epW = e => ((e.tpl && TPLS[e.tpl] && TPLS[e.tpl].wish.includes(wish)) ? 2 : 1) * (e.tpl && tplUsed[e.tpl] ? 0.3 : 1) * (allyCast(e) ? ALLY_W : 1);   // 仲間が必ず要る台本は、仲間がいる人生（feasible が通ったとき）では出やすい
    let pool = all;
    if (turn === 1) { const a = all.filter(e => e.type === 'arrival'); if (a.length) return wpick(R, a, epW); }
    // 0a) 転生のあとの道中：need.after を持つ arrival の台本（最初の街への道中など）は、第2話・第3話で来やすくする（1人生に1本まで。型の割合に任せると、転生の直後で重みが小さく、ほとんど出ない）
    if (turn >= 2 && turn <= 3) {
      const route = pool.filter(e => e.type === 'arrival' && listOf((e.need || {}).after).length);
      if (route.length && !w.log.some(e => e.type === 'arrival' && e.turn >= 2) && R() < (turn === 2 ? 0.3 : 0.15)) return wpick(R, route, epW);
    }
    // 0b) 仲間と組んでから初めて守る戦い（仲間が必ず要る first_battle の台本）：仲間ができて、強敵・迷宮・試合の前なら、来やすくする（仲間のいらない初戦が先に出ても出られる）
    if (turn >= 3 && allies(w).length) {
      const ab = pool.filter(e => e.type === 'first_battle' && allyCast(e));
      if (ab.length && R() < ALLY_BATTLE_P) return wpick(R, ab, epW);
    }
    // 0) 人生の頭：転生のあと2〜4話のうちに、力の発見と登録が来やすいようにする（その人に合う台本があるときだけ。feasible が授かった力を見ている）
    if (turn >= 2 && turn <= 4) {
      const miss = EARLY_TYPES.filter(t => !w.log.some(e => e.type === t) && pool.some(e => e.type === t));
      if (miss.length && R() < (turn === 2 ? 0.7 : turn === 3 ? 0.85 : 1)) { const t = pick(R, miss); return wpick(R, pool.filter(e => e.type === t), epW); }
    }
    // 1) 引ける糸があれば、その糸を引く台本を優先する
    const ready = w.threads.filter(t => !t.closed && turn - t.turn >= 2).sort((a, b) => a.turn - b.turn);
    // 引く台本は、台本の stage・型紙の位置（序盤など）の外でも出られる（人生の後半に糸が残るのは、引く台本の時期が合わないのが主な原因だった）。順番・印・糸・配役は緩めない
    const heavyIds = new Set(ready.filter(t => HEAVY.includes(t.id)).map(t => t.id)), allH = heavyIds.size ? epsAll().filter(e => e && e.id && !exclude.has(e.id) && typeOk(w, e, true) && feasible(w, e, turn, true)) : [];
    for (const t of ready) {
      const eps = (HEAVY.includes(t.id) ? allH : allT).filter(e => ((e.need || {}).threads || []).includes(t.id));
      if (eps.length) { const ep = wpick(R, eps, epW); if (info && !all.includes(ep)) info.relaxed = true; return ep; }   // 引ける糸があれば必ず引く（以前は85%。引ける糸が人生の終わりまで残って引かれない原因の1つだった）
    }
    // 1b) pick.thread（optional を含む）で糸を受ける台本も、その糸の人が実際に引ける（配役が立つ）ときは優先する。need.threads よりは少し低い優先（85%）
    if (R() < 0.85 || heavyIds.size) {   // 重い糸が引ける間は、この優先を必ず効かせる
      for (const t of ready) {
        const eps = (HEAVY.includes(t.id) ? allH : allT).filter(e => !((e.need || {}).threads || []).includes(t.id) && (e.cast || []).some(en => en && en.pick && en.pick.thread === t.id && candsFor(w, e, en, new Set([h.id]), turn).length > 0));
        if (eps.length) { const ep = wpick(R, eps, epW); if (info && !all.includes(ep)) info.relaxed = true; return ep; }
      }
    }
    // 2) 前の台本の型紙の next_types の割合で型を引く
    const shares = {}; if (prev && prev.tpl && TPLS[prev.tpl]) TPLS[prev.tpl].next.forEach(n => { shares[n.type] = n.share; });
    if (!pool.length) return null;
    const stage = stageOf(turn), recent = w.log.slice(-3).map(e => e.type), types = [...new Set(pool.map(e => e.type))];
    const ty = wpick(R, types, t => {
      const T = D.TYPES[t] || { stage: [1, 1, 1] }; let x = (shares[t] || 0.03) * Math.max(0.05, T.stage[stage]);
      if (pool.some(e => e.type === t && e.tpl && TPLS[e.tpl] && TPLS[e.tpl].wish.includes(wish))) x *= 2;
      if (pool.some(e => e.type === t && listOf((e.need || {}).after).includes(t))) x *= 2.5;   // 同じ型の続き（登録のあとの昇格試験など：台本が need.after に自分の型を書いている）は、型の割合が小さくて出にくいので、型を選ぶ重みを上げる
      if (prev && t === prev.type) x *= 0.5;
      recent.forEach(r => { if (r === t) x *= 0.75; });
      return x;
    });
    return wpick(R, pool.filter(e => e.type === ty), epW);
  }

  // 張られた糸のうち、引く台本が次の話（または、その次の話）で起こせるものがあるか
  function pullableThread(w, heavyOnly) {
    const open = w.threads.filter(t => !t.closed && (!heavyOnly || HEAVY.includes(t.id))); if (!open.length) return false;
    const ids = new Set(open.map(t => t.id)), hv = new Set(open.filter(t => HEAVY.includes(t.id)).map(t => t.id));
    // 型の続き（TYPE_GAP）：次の話では出られなくても、その次の話（直前の話の型でなければ）なら出られる
    const lastEv = w.log[w.log.length - 1], soon = e => e.type === 'arrival' || (!(lastEv && !lastEv.filler && lastEv.type === e.type) && w.log.filter(x => !x.filler && x.type === e.type).length < TYPE_MAX);
    return epsAll().some(e => e && e.id && pullsIds(e, ids) && ((typeOk(w, e) && (feasible(w, e, w.turn + 1, true) || feasible(w, e, w.turn + 2, true))) || (soon(e) && feasible(w, e, w.turn + 2, true))));
  }
  function next(w) {
    if (w.over) return null;
    if (w.cur) return w.cur;
    const R = rngOf(w), turn = w.turn + 1, prev = w.log[w.log.length - 1];
    // 埋め草は続けて出さない：前の話が埋め草なら、時期（stage）の縛りだけ緩めて引き直し、それでも無ければ人生を終える
    for (const relax of (prev && prev.filler ? [false, true] : [false])) {
      const exclude = new Set();
      for (let k = 0; k < 12; k++) {
        const info = {}, ep = chooseEpisode(w, R, turn, exclude, relax, info); if (!ep) break;
        const c = begin(w, ep, { relaxed: relax || !!info.relaxed });
        if (c) return c;
        exclude.add(ep.id);   // 配役が決まらなかった台本は除いて、引き直す
      }
    }
    if (prev && prev.filler) { unGap(w); prev.over = 'peace'; w.over = overOf(w, 'peace'); return null; }
    // 条件に合う台本が1つも無い：埋め草の短いエピソード
    return begin(w, FILLER, null);
  }

  // ---------- 分かれ目 ----------
  function skillBonus(h, appr, named) {
    let c = 0; h.skills.forEach(s => { const d = SK[s.id]; if (!d) return; if (appr && d.boost.includes(appr)) c += s.lv * d.per; if (named && named.includes(s.id)) c += s.lv * 3; });
    return Math.min(12, c);
  }
  function chanceCalc(w, c, opt, cardCh) {
    const ck = opt.check; if (!ck) return null;
    const h = hero(w), S = h.stats, st = S[ck.stat] || 0, named = ck.skill ? [].concat(ck.skill) : null;
    let state = 0; if (h.flags.includes('けが')) state -= 5; if (h.flags.includes('呪い')) state -= 5; if (h.flags.includes('喪失')) state -= 2;
    const rows = [['基礎', 55], [ck.stat + '（目安' + ck.diff + '）', 5 * (st - ck.diff)], ['スキル', skillBonus(h, opt.appr, named)], ['仲間', Math.min(6, 2 * allies(w).length)], ['祈り', opt.appr === 'pray' ? Math.round(S.絆 / 12) - 1 : 0], ['状態', state], ['札', cardCh || 0]];
    const raw = Math.round(rows.reduce((a, r) => a + r[1], 0)), chance = clamp(raw, 5, 95);
    const parts = rows.filter((r, i) => i === 0 || r[1] !== 0).map(r => ({ name: r[0], d: r[1] }));
    const sum = parts.reduce((a, p) => a + p.d, 0); if (sum !== raw) parts.push({ name: '端数', d: raw - sum });
    if (chance !== raw) parts.push({ name: raw > chance ? '上限' : '下限', d: chance - raw });
    return { chance, parts };
  }
  function setChances(w, c) {
    const ch = c.choice, ep = getEp(c.epId), st = stepsOf(c, ep).find(s => s.choice && chOf(s).id === ch.id);
    ch.opts.forEach(o => { const src = chOf(st).opts.find(x => x.key === o.key), r = chanceCalc(w, c, src, ch.cardChance); o.chance = r ? r.chance : null; o.parts = r ? r.parts : null; });
  }
  function makeChoice(w, R, c, ep, st) {
    const h = hero(w), P = pm(h), s1 = h.persona.s1, s2 = h.persona.s2, cd0 = chOf(st), fq = c.force && c.force[cd0.id];
    // 選択肢の if：合わない選択肢は、画面にも、気質・信条の選択にも出さない（検査の force で指された選択肢だけは、条件に関わらず残す）
    const opts = cd0.opts.filter(o => ifOk(c, o.if, w) || (fq && fq.opt === o.key));
    const tg = D.TRIGGERS[h.persona.past], listener = Object.keys(c.cast).map(k => w.people[c.cast[k]]).find(p => p && p.id !== h.id) || null, map = castMap(w, c);
    const sc1 = opts.map(o => (o.s1 || {})[s1] || 0), sc2 = opts.map(o => (o.s2 || {})[s2] || 0);
    // 授かった力の選択肢（if が 'cheat:…' の選択肢）：主人公は選びやすい。とっさ・考え直しの重みに上乗せする（表示の点 s1・s2 や、札の寄せ先の判断には足さない）
    const cb = opts.map(o => (listOf(o.if).some(x => /^cheat:/.test(String(x))) ? CHEAT_BONUS : 0));
    // 第5回：主人公の望み（wish）と同じ種類の goal を進める道（成功したときの fx に ['goal', 正の数, 望みの種類]）は、少し選びやすい（とっさ・考え直しの重みに上乗せ。表示の点には足さない）
    const wishK = P.wish, wb = opts.map(o => (listOf((o.win || o).fx).some(f => Array.isArray(f) && f[0] === 'goal' && f[2] === wishK && +f[1] > 0) ? WISH_BONUS : 0));
    // 過去の引き金。第2版：分かれ目の step の touch に主人公の過去の tag が当たるとき、「とっさ」は instinct の選択肢になる（考え直し・札で別の道へ行く余地は残る）。
    // 第1版の台本全体の touch（instinct が無い）は、従来どおり型の合う向き合い方へ確率で我を忘れる。どちらでもなければ、その型のとき少しだけ寄る
    let trig = null, trigIdx = -1;
    if (tg) {
      const idx = opts.findIndex(o => o.appr === tg.approach), idx2 = opts.findIndex(o => o.appr === tg.fall);
      if (ep.type === tg.type && opts.some(o => o.appr === tg.approach)) opts.forEach((o, i) => { if (o.appr === tg.approach) sc1[i] += 1.5; });
      if (st.touch != null) {
        const ii = opts.findIndex(o => o.instinct);
        if (ii >= 0 && listOf(st.touch).includes(tg.tag)) { trig = { tag: tg.tag, instinct: opts[ii].key, legacy: false }; trigIdx = ii; }
      } else {
        const ti0 = idx >= 0 ? idx : idx2;
        if (ti0 >= 0 && listOf(ep.touch).includes(tg.tag) && w.log.filter(e => e.trigger).length < 2 && !(w.log.length && w.log[w.log.length - 1].trigger) && R() < TN.trigChance) { trig = { tag: tg.tag, line: tg.line, instinct: opts[ti0].key, legacy: true }; trigIdx = ti0; }
      }
    }
    let fi, ti;
    if (trig && trig.legacy) { fi = ti = trigIdx; }
    else {
      const idx = opts.map((_, i) => i);
      fi = trig ? trigIdx : wpick(R, idx, i => { let x = Math.exp(0.6 * (sc1[i] + cb[i] + wb[i])); if (h.stats.命 <= 1 && opts[i].appr === 'flee') x *= 2; if (h.flags.includes('けが') && opts[i].appr === 'fight') x *= 0.5; return x; });
      const s2p = wpick(R, idx, i => Math.exp(0.6 * (sc2[i] + cb[i] + wb[i])));
      ti = (sc2[s2p] + cb[s2p] + wb[s2p]) - (sc2[fi] + cb[fi] + wb[fi]) >= 1 ? s2p : fi;
    }
    const ch = { id: cd0.id, q: fmt(cd0.q || '', map), opts: opts.map((o, i) => ({ key: o.key, label: fmt(o.label, map), appr: o.appr || null, s1: sc1[i], s2: sc2[i], sayText: o.say ? saySpeak(w, R, h, o.say.da, o.say.desu, (o.to || o.say.to) && c.cast[o.to || o.say.to] ? w.people[c.cast[o.to || o.say.to]] : listener, map, !!o.say.mono, o.say.tone || st.tone || ep.tone) : '', instinct: !!o.instinct, chance: null, parts: null })),
      first: opts[fi].key, then: opts[ti].key, final: opts[ti].key, trig, card: null, cardText: '', cardScore: 0, cardChance: 0, bondDelta: 0, refused: false, guard: false, decided: false, hint: '' };
    // ヒント
    const good = P.cards.filter(x => x.score >= 2).sort((a, b) => b.score - a.score).slice(0, 2), bad = P.cards.filter(x => x.score <= -2), tp = c.tpl && TPLS[c.tpl] ? TPLS[c.tpl].cards.slice(0, 2) : [];
    ch.hint = (tp.length ? 'この場面では' + tp.map(x => '「' + x + '」').join('・') + 'が役に立ちそうだ。' : '') + (good.length ? h.nick + 'には' + good.map(x => '「' + x.name + '」').join('・') + 'がよく効く。' : '') + (bad.length ? bad.map(x => '「' + x.name + '」').join('・') + 'は逆効果になりそうだ。' : '') + (trig ? (trig.legacy ? h.nick + 'の古い傷に触れる場面だ。我を忘れて動いてしまうだろう。' : h.nick + 'の古い傷に触れる場面だ。過去がよみがえり、とっさには、考えるより先に体が動くだろう。') : '');
    c.choice = ch; setChances(w, c);
    return ch;
  }
  const optOf = (c, key) => c.choice.opts.find(o => o.key === key);
  function bestByS2(ch) { return ch.opts.slice().sort((a, b) => b.s2 - a.s2)[0].key; }

  const NOCHECK_CARDS = ['励まし', '試練', '道しるべ'];
  function playCard(w, name) {
    const c = w.cur, ch = c && c.choice, h = hero(w);
    if (!ch || ch.decided) return { ok: false, reason: 'いまは分かれ目ではない', text: '', bondDelta: 0 };
    if (ch.card) return { ok: false, reason: 'この分かれ目では、もう札を使った', text: '', bondDelta: 0 };
    const cd = D.CARDS[name];
    if (!cd) return { ok: false, reason: 'そんな札はない', text: '', bondDelta: 0 };
    if (!w.god.hand.includes(name)) return { ok: false, reason: '手札にない', text: '', bondDelta: 0 };
    if (w.god.power < cd.cost) return { ok: false, reason: '神力が足りない（必要' + cd.cost + '・いま' + w.god.power + '）', text: '', bondDelta: 0 };
    const hasCheck = ch.opts.some(o => o.chance != null);
    // 第7回：判定の無い分かれ目で、効くのは「励まし（心＋1）」「試練（力＋1）」「道しるべ（道を寄せる・望み＋3）」だけ。ほかの札は何にも効かず、使った意味が読み手に分からないので使えない
    if (!hasCheck && !NOCHECK_CARDS.includes(name)) return { ok: false, reason: 'この札は、判定のない分かれ目では効かない（効くのは ' + NOCHECK_CARDS.join('・') + '）', text: '', bondDelta: 0 };
    if (name === '天罰' && !hasCheck) return { ok: false, reason: '罰を下す相手がいない', text: '', bondDelta: 0 };
    const ce = pm(h).cards.find(x => x.name === name), score = ce.score;
    let bond = cd.bond + score * 4, chance = cd.chance >= 0 ? cd.chance * (1 + 0.25 * score) : cd.chance * (1 - 0.25 * score);
    if (cd.chance >= 0) chance = Math.max(0, chance);
    if (hasCheck && c.tpl && TPLS[c.tpl] && TPLS[c.tpl].cards.includes(name)) chance += 3;
    if (!hasCheck) chance = 0;
    let refused = false, changed = false, held = false;
    // 札の説明：気質・信条の理由を、効き目の向きごとに別の文にする（以前は「、」でつないだので、正反対の理由が1文になって意味が通らなかった）
    const sp = [(PD.S1[h.persona.s1] || {}).cards, (PD.S2[h.persona.s2] || {}).cards].map(cs => (cs && cs[name]) || null).filter(Boolean), goodW = sp.filter(x => x[0] > 0).map(x => x[1]), badW = sp.filter(x => x[0] < 0).map(x => x[1]);
    const say = arr => (arr.length ? '心の内では、' + arr.map((x, i) => (i ? 'また、' : '') + x + '。').join('') : '');
    const good = say(goodW), bad = say(badW);
    if (ch.trig && ch.trig.legacy && (name === '神託で命じる' || name === '道しるべ')) { if (name === '神託で命じる') { refused = true; chance = 0; bond -= 3; } }
    else if (name === '神託で命じる') {
      const f = ch.opts.find(o => o.appr === 'fight'), rate0 = o => (o.chance == null ? 100 : o.chance), cur0 = ch.opts.find(o => o.key === ch.final);
      if (h.stats.絆 <= 30 || score <= -2 || !f) { refused = true; chance = 0; bond -= 3; }
      else if (ch.final !== f.key) { if (rate0(cur0) - rate0(f) >= GUIDE_DROP) held = true; else { ch.final = f.key; changed = true; } }   // 戦う道へ変える。ただし成功率が GUIDE_DROP ポイント以上下がるなら変えない
    } else if (name === '道しるべ') {
      // 信条に合う道へ寄せる。ただし、いまの道より成功率が大きく（GUIDE_DROP ポイント以上）下がる道へは寄せない（判定の無い道は、成功率100として比べる）
      const cur = ch.opts.find(o => o.key === ch.final), rate = o => (o.chance == null ? 100 : o.chance);
      const ok = ch.opts.filter(o => rate(cur) - rate(o) < GUIDE_DROP), best = ok.reduce((b, o) => (o.s2 > b.s2 ? o : b), cur), want = bestByS2(ch);
      if (score <= -2) { refused = true; chance = 0; }
      else if (best.key !== ch.final) { ch.final = best.key; changed = true; }
      else if (want !== ch.final && !ok.some(o => o.key === want)) held = true;   // 寄せたい道はあったが、成功率が大きく下がるので寄せなかった
    }
    bond = Math.round(bond); chance = Math.round(chance);
    w.god.hand.splice(w.god.hand.indexOf(name), 1); w.god.power -= cd.cost;
    ch.card = name; ch.cardScore = score; ch.cardChance = chance; ch.bondDelta = bond; ch.refused = refused; ch.guard = name === '小さな加護' && !refused && score > -2;
    setChances(w, c);
    const n = h.nick; let text;
    if (refused) text = n + 'は「' + name + '」の意図をはねつけた。' + bad;
    else if (score >= 2) text = n + 'は「' + name + '」に背中を押された。' + good;
    else if (score <= -2) text = '「' + name + '」は' + n + 'の心に逆効果だった。' + bad;
    else if (score < 0) text = '「' + name + '」は' + n + 'に、あまり届かなかった。' + bad;
    else if (score === 0 && goodW.length && badW.length) text = '「' + name + '」は' + n + 'の中で、良い面と悪い面が打ち消し合った。心の内では、' + goodW[0] + '。一方で、' + badW[0] + '。';
    else if (score === 1) text = '「' + name + '」は' + n + 'の背中を、そっと押した。' + good;
    else text = '「' + name + '」は' + n + 'に、ほどほどに届いた。';
    if (changed) text += n + 'は選ぶ道を「' + optOf(c, ch.final).label + '」に変えた。';
    else if (held) text += n + 'は、いまの道のほうが確かだと感じ、選ぶ道を変えなかった。';
    else if (ch.trig && ch.trig.legacy && (name === '神託で命じる' || name === '道しるべ')) text += n + 'は我を忘れていて、神の意図は届かなかった。';
    ch.cardText = text;
    return { ok: true, reason: '', text, bondDelta: bond, final: ch.final, refused, changed };
  }

  function decide(w) {
    const c = w.cur, ch = c && c.choice;
    if (!ch || ch.decided) return { ok: false, reason: 'いまは分かれ目ではない' };
    const R = rngOf(w), h = hero(w), ep = getEp(c.epId), st = stepsOf(c, ep).find(s => s.choice && chOf(s).id === ch.id), map = castMap(w, c);
    let key = ch.final, forced = null;
    if (c.force && c.force[ch.id]) { forced = c.force[ch.id]; if (forced.opt) key = forced.opt; }
    const opt = chOf(st).opts.find(o => o.key === key), oc = optOf(c, key), lines = [{ k: 'c', t: '選んだ道：' + oc.label }], effs = [];
    if (ch.trig && ch.trig.legacy && key === ch.final && !forced) lines.push({ k: 't', t: fmt(ch.trig.line, map) });
    if (ch.trig && !ch.trig.legacy) { lines.push({ k: 'n', t: fmt(TRIG_HIT, map), trig: ch.trig.tag }); lines.push({ k: 'n', t: fmt(key === ch.trig.instinct ? TRIG_ACT : TRIG_HOLD, map) }); }
    if (opt.say) lines.push({ k: 's', who: h.id, name: h.nick, t: oc.sayText });
    let outcome = 'win';
    if (opt.check) { outcome = (forced && forced.outcome) ? forced.outcome : (R() * 100 < oc.chance ? 'win' : 'lose'); }
    const res = (outcome === 'win' ? (opt.win || (opt.t || opt.fx || opt.opens ? { t: opt.t, fx: opt.fx, opens: opt.opens } : null)) : opt.lose) || { t: [], fx: [] };
    recordOpens(w, c, res.opens, map);
    if (res.payoff) (c.payoffs || (c.payoffs = [])).push({ outcome, t: String(res.payoff) });   // 道ごとの余韻（選択肢の win／lose に書く）
    if (res.span && res.span.days > 0) c.spanDays = res.span.days;   // 道ごとの日数（台本の span より優先）
    let fx = (res.fx || []).slice();
    if (outcome === 'lose' && ch.guard) { const neg = fx.some(f => f[0] === 'life' && f[1] < 0); if (neg) { fx = fx.filter(f => !(f[0] === 'life' && f[1] < 0)); lines.push({ k: 'n', t: '小さな加護に守られ、命を落とさずにすんだ。' }); } }
    [].concat(res.t || []).forEach(t => lines.push({ k: 't', t: fmt(t, map) }));
    // 札の効果（絆の変化は効果に書く。日常的な分かれ目では、少しだけ本人に返る）
    const pre = [];
    if (ch.card && ch.bondDelta) pre.push(['bond', ch.bondDelta]);
    if (ch.card && !ch.refused && ch.cardScore > -2 && !opt.check) { if (ch.card === '励まし') pre.push(['stat', '心', 1]); else if (ch.card === '試練') pre.push(['stat', '力', 1]); else if (ch.card === '道しるべ' && ch.final === key) pre.push(['goal', 3, 'any']); }
    // 判定の無い分かれ目で札が効いたときは、何が起きたかを1文で書く（札を使った意味が読み手に分かるように）
    if (pre.some(f => f[0] === 'stat' || f[0] === 'goal')) { const n = h.nick; lines.push({ k: 'n', t: ch.card === '励まし' ? '「励まし」に押されて、' + n + 'の心はわずかに強くなった。' : ch.card === '試練' ? '「試練」を受けて、' + n + 'の力はわずかについた。' : '「道しるべ」が、' + n + 'を望みのほうへわずかに近づけた。' }); }
    effs.push(...doFx(w, R, c, pre), ...doFx(w, R, c, fx));
    if (effs.length) lines[lines.length - 1].fx = effs;
    lines.forEach(l => c.lines.push(l));
    ch.decided = true; c.picked[ch.id] = key; c.out[ch.id] = outcome;
    c.choices.push({ id: ch.id, q: ch.q, opts: ch.opts.map(o => ({ key: o.key, label: o.label, chance: o.chance })), first: ch.first, then: ch.then, picked: key, label: oc.label, outcome, chance: oc.chance, parts: oc.parts, card: ch.card, cardText: ch.cardText, bondDelta: ch.bondDelta, refused: ch.refused, trig: ch.trig ? ch.trig.tag : null, instinct: ch.trig ? ch.trig.instinct : null, say: oc.sayText });
    if (ch.trig && (ch.trig.legacy ? key === ch.final : key === ch.trig.instinct)) c.trigger = ch.trig.tag;   // 体が先に動いた（引き金のまま選んだ）
    c.choice = null;
    const res2 = { ok: true, key, label: opt.label, outcome, chance: oc.chance, lines, effects: effs, end: null };
    afterStep(w, c, res2);
    return res2;
  }

  // ---------- 進める ----------
  function hasMore(w, c, steps) { for (let j = c.i; j < steps.length; j++) if (ifOk(c, steps[j].if, w)) return true; return false; }
  // 命が尽きたら、台本の残りは飛ばして終える。残りが無ければ終わりまで進める
  function afterStep(w, c, res) {
    const h = hero(w), ep = getEp(c.epId), steps = stepsOf(c, ep);
    if (h.stats.命 <= 0 && !c.diedNote) { c.diedNote = true; const l = { k: 'n', t: h.nick + 'は、ここで力尽きた。' }; c.lines.push(l); res.lines.push(l); c.i = steps.length; }
    if (!c.choice && !hasMore(w, c, steps)) { addRemind(w, c, res); res.end = finish(w); }
  }
  // 望みと前世の仕事を思い出す一文（第6回：望みが第1話のあと置き去りになる／前世が使われない）。話の終わりに、望みの進みが大きく動いた話で、1人生に2〜4回まで（前の文から2話あける）。
  // 前世の仕事（{前職}）が手がかりになる文は、話の型と前職の組み合わせが合うときだけ、1人生に2回まで。命が尽きた話・埋め草・第1話には付けない
  function addRemind(w, c, res) {
    const h = hero(w); if (c.filler || h.stats.命 <= 0 || c.turn <= 1 || c.diedNote) return;
    // 第7回：深刻な話（grave）・切迫した話（tense）・失敗した話、またはその直後の話には出さない（場面の感情を壊す）
    { const ep0 = getEp(c.epId), tn = [ep0 && ep0.tone].concat(stepsOf(c, ep0).map(x => x && x.tone)), prev = w.log[w.log.length - 1];
      if (tn.some(t => t === 'grave' || t === 'tense') || c.choices.some(x => x.outcome === 'lose') || (prev && prev.choices.some(x => x.outcome === 'lose'))) return; }
    const rm = w.remind || (w.remind = { n: 0, last: -9, job: 0, jlast: -9 }), E3 = D.END3, R = rngOf(w);
    const gain = c.eff.filter(e => e.t === 'goal' && e.d > 0).reduce((a, e) => a + e.d, 0), wk = pm(h).wish, pj = String(h.prevJob || '').replace(/（.*?）/g, '') || '旅の者', pj0 = String(h.prevJob || '');
    let text = null, kind = null;
    if (rm.n < REMIND_MAX && c.turn - rm.last >= REMIND_GAP && h.goal.progress < 100 && (gain >= REMIND_BIG || (rm.n < REMIND_MIN && c.turn >= 5 && gain >= 4))) {
      const arr = E3.wishMind[wk] || E3.wishMind.strong, used = rm.used || (rm.used = []), fresh = arr.map((_, i) => i).filter(i => !used.includes(i)), ix = pick(R, fresh.length ? fresh : arr.map((_, i) => i)); used.push(ix);   // 同じ人生で同じ言い回しをくり返さない
      text = fmt(arr[ix], { 名: h.nick, goal: h.goal.text }); kind = 'goal'; rm.n++; rm.last = c.turn;
    } else if (rm.job < JOBHINT_MAX && c.turn - rm.jlast >= 3 && c.turn >= 3 && R() < 0.5) {
      const hit = E3.jobHint.find(x => x.types.includes(c.type) && new RegExp('^(' + x.job + ')$').test(pj0) || (x.types.includes(c.type) && new RegExp('^(' + x.job + ')$').test(pj)));
      if (hit) { const ju = rm.jused || (rm.jused = []), jf = hit.t.filter(x => !ju.includes(x)); const jt = pick(R, jf.length ? jf : hit.t); ju.push(jt); text = fmt(jt, { 名: h.nick, 前職: pj }); kind = 'job'; rm.job++; rm.jlast = c.turn; }
    }
    if (text) { const l = { k: 'n', t: text, remind: kind }; c.lines.push(l); res.lines.push(l); }
  }
  function advance(w) {
    if (w.over) return null;
    if (!w.cur) next(w);
    const c = w.cur; if (!c) return null;
    const h = hero(w), ep = getEp(c.epId), steps = stepsOf(c, ep), R = rngOf(w);
    if (c.choice) return { kind: 'choice', choice: c.choice };
    while (c.i < steps.length) {
      const st = steps[c.i++];
      if (!ifOk(c, st.if, w)) continue;
      const tm = st.time && TIMES.includes(st.time) && st.time !== c.time ? st.time : null; if (st.time && TIMES.includes(st.time)) c.time = st.time;   // その step 以後の時間帯（絵も切り替わる）
      if (st.choice) { const ch = makeChoice(w, R, c, ep, st); return { kind: 'choice', choice: ch }; }
      const map = castMap(w, c), sp = speechOf(st);
      let lines = [];
      if (sp) {
        const pid = !sp.who || sp.who === 'H' || sp.who === '名' ? h.id : c.cast[sp.who];
        if (!pid) continue;   // その人がいない（任意の配役）
        const P = w.people[pid], toP = sp.to && c.cast[sp.to] ? w.people[c.cast[sp.to]] : null;   // to＝聞き手の配役の key（台本が指定すれば {君} はその人の呼び方。無ければ、主人公は先に決まった配役の人に、ほかの人は主人公に話す）
        const listener = toP || (P.id === h.id ? (Object.keys(c.cast).map(k => w.people[c.cast[k]]).find(p => p && p.id !== h.id) || null) : h);
        lines.push({ k: 's', who: pid, name: P.nick, t: saySpeak(w, R, P, sp.da, sp.desu, listener, map, sp.mono && pid === h.id, sp.tone || ep.tone) });
        if (!P.alive) lines[0].dead = true;   // 亡くなった人が話した（検査が見つける）
      } else {
        const ts = Array.isArray(st.t) ? st.t : [st.t == null ? '' : st.t];
        lines = ts.map(t => ({ k: 't', t: fmt(t, map) }));
      }
      if (tm && lines.length) lines[0].tm = tm;
      lines.forEach(l => c.lines.push(l));
      const effects = doFx(w, R, c, st.fx);
      if (st.opens) recordOpens(w, c, st.opens, map);
      if (effects.length) lines[lines.length - 1].fx = effects;
      const res = { kind: sp ? 'say' : 'text', line: lines[0], lines, effects, end: null };
      afterStep(w, c, res);
      return res;
    }
    return { kind: 'end', end: finish(w) };
  }

  // ---------- 終わり ----------
  // 余生と言ってよい年齢（50歳以上）。それより若い人が peace で終わるときは、名前を「物語はここまで」にし、結びの文も年齢に合わせる
  const YOUNG_END = 50;
  const isYoungEnd = (w, kind) => kind === 'peace' && hero(w).age < YOUNG_END;
  // 終わり方の見出し。changed＝「元の世界に帰る」望みの人が、人（恋仲・仲間・師など）を置いては行けず、望みが形を変えて成就したとき（第5回の校閲：帰らないのに「望みを成就」は食い違う）
  const endLabel = (w, kind) => (kind === 'peace' ? (isYoungEnd(w, kind) ? '物語はここまで' : '静かな余生') : kind === 'changed' ? '望みが形を変えた' : null);
  // 終わりでは、最後の話のあとの「次の話までの間」を進めない（第7回の直し）。年齢も戻す
  const unGap = w => { const back = w.gapMo || 0; if (back > 0) { w.mo -= back; w.gapMo = 0; w.gap = 0; Object.keys(w.people).forEach(pid => { const P = w.people[pid]; if (P.alive) P.age = P.id === w.heroId ? w.age0 + w.mo / 12 : r2(P.age - back / 12); }); } };
  const overOf = (w, kind) => ({ ending: kind, text: endingText(w, kind), label: endLabel(w, kind) });
  // 終わりの文の材料（第4回の校閲の直し）：望みの種類（wish）・暮らしの印（店・家・仲間と組む）・最後まで縁が続いた人・人生でいちばん多く関わった人
  // 第5回：stayNames＝帰らない理由にできる「人」（恋仲・仲間・信頼30以上の師／後ろ盾・信頼50以上の人）。家・店だけの人は含めない
  function endCtx(w) {
    const h = hero(w), marks = marksOf(w), lv = relList(w, ['lover'])[0], cs = relList(w, ['companion']).slice(0, 2), mn = relList(w, ['mentor', 'patron']).filter(x => x.rel.trust >= 30)[0], names = [], nameIds = new Set();
    if (lv) { names.push('恋仲の' + lv.p.nick); nameIds.add(lv.id); }
    if (cs.length) { names.push('仲間の' + cs.map(x => x.p.nick).join('と')); cs.forEach(x => nameIds.add(x.id)); }
    if (!names.length && mn) { names.push(D.REL_TYPES[mn.rel.type].name + 'の' + mn.p.nick); nameIds.add(mn.id); }
    // いちばん多く関わった人（敵・仇は除く。2話以上に出た人だけ）。状態：いまも縁が続く／亡くなった／別れた／行方知れず／旅に出ている
    let top = null;
    Object.keys(h.relations).forEach(id => {
      const p = w.people[id], r = h.relations[id]; if (!p || r.type === 'nemesis' || r.type === 'enemy' || p.life.length < 2 || foeOf(w, id)) return;   // 敵・仇・恨みの相手（和解した人も）は、結びに「いちばん長く行き来した縁」として出さない（校閲6回目）
      if (!top || p.life.length > top.n || (p.life.length === top.n && r.trust > top.rel.trust)) top = { id, p, rel: r, n: p.life.length };
    });
    if (top) top.state = !top.p.alive ? 'gone' : top.rel.type === 'parted' ? 'parted' : top.p.missing ? 'missing' : top.p.away ? 'away' : 'with';
    // 結びに名を挙げる「縁のある人」は、出番の多い人（2話以上に出た人）を先に。出番の回数が同じなら信頼が高い人。どの人も1話にしか出ていないときは、名を挙げずに crowd（出会った人たちの顔）とまとめる
    const others0 = Object.keys(h.relations).map(id => ({ id, rel: h.relations[id], p: w.people[id] })).filter(x => x.p && x.p.alive && !x.p.missing && !x.p.away && !['parted', 'nemesis', 'enemy'].includes(x.rel.type) && !foeOf(w, x.id) && x.rel.trust >= 15 && !nameIds.has(x.id)).sort((a, b) => (b.p.life.length - a.p.life.length) || (b.rel.trust - a.rel.trust)), others = others0.filter(x => x.p.life.length >= 2).slice(0, 2), crowd = others0.length > 0 && !others.length;
    const sw = marks.includes('shop') && marks.includes('home') ? '店と家' : marks.includes('shop') ? '店' : marks.includes('home') ? '家' : '';
    const anchors = !!(lv || cs.length || sw || marks.includes('party'));
    const strong = others0.filter(x => x.rel.trust >= 50).slice(0, 2), stayNames = names.length ? names.join('と') : strong.map(x => relWord(x.rel) + x.p.nick).join('と');
    // 重い糸（恨み・行方知れず・別れ）が開いたまま：結びで一文触れる
    const ut = w.threads.filter(t => !t.closed && HEAVY.includes(t.id) && t.who !== h.id && w.people[t.who]).sort((a, b) => a.turn - b.turn)[0] || null;   // 相手の人がいる糸だけ（盗賊・魔物など、相手のいない恨みは数えない）
    const unsettled = ut ? { id: ut.id, who: ut.who } : null;
    // 影：重い糸が開いている／最後の話が別れ・裏切りの型／直近の話の題が疑い・別れ・喪の言葉／最後の分かれ目が失敗。「長い戦いのあとの静かな朝」「胸を張って」などを使わない
    const last = w.log[w.log.length - 1], titles = w.log.slice(-2).map(e => e.title || '').join('/');
    const shadow = !!(unsettled || (last && (['loss', 'betrayal_revenge'].includes(last.type) || (last.choices || []).some(x => x.outcome === 'lose'))) || /濡れ衣|疑|告発|裏切|取り立て|追わ|別れ|喪|墓|行方|知らせ|毒|悲鳴/.test(titles));
    // 望みを進めた話：望みの種類が合った進み（m）が最も大きい話（無ければ進みが最大の話）。望みの進みの何割が、望みに合った進みか（ratio）
    let top1 = null, gt = 0, gm = 0;
    w.log.forEach(e => { let a = 0, b = 0; (e.effects || []).forEach(x => { if (x.t === 'goal' && x.d > 0) { a += x.d; if (x.m) b += x.d; } }); gt += a; gm += b; const sc = b * 1000 + a; if (a > 0 && (!top1 || sc > top1.sc)) top1 = { ev: e, sc, a, b }; });
    const gtext = h.goal.text || '', travelWish = /世界の端|見に行く|旅/.test(gtext), roamed = w.log.filter(e => !e.filler && e.type !== 'arrival' && e.place && !SETTLE.includes(e.place)).length;
    const goalOff = gt > 0 && (gm / gt < 0.45 || (travelWish && (roamed < 3 || !!sw)));   // 望みの言葉と実際の人生がずれている（望みに合った進みが半分に満たない／旅の望みなのに、遠出の話が3本に満たない・家や店を構えて落ち着いた）
    const goalTop = top1 ? { title: top1.ev.title, place: top1.ev.place, loc: top1.ev.loc || null, who: (top1.ev.cast || []).map(x => x.id).find(id => id !== h.id && w.people[id] && w.people[id].alive && !foeOf(w, id)) || null } : null;
    return { names, nameIds, top, others, crowd, sw, anchors, stayNames, unsettled, shadow, goalOff, goalTop, gm, gt, ties: names.length ? names.join('と') : (sw || '仲間') };
  }
  const relWord = rel => (['companion', 'lover', 'mentor', 'patron', 'rival'].includes(rel.type) ? D.REL_TYPES[rel.type].name + 'の' : '');
  // 第5回：暮らしている所＝home の印の場所、無ければ人生でいちばん長くいた村・町（同数なら後のほう）、無ければ最後にいた村・町（以前は「最後の話の場所」だったので、町暮らしの人が最後の話の村で「村で静かに暮らす」と結ばれた）
  function restPlace(w) {
    if (SETTLE.includes(w.homePlace)) return w.homePlace;
    const cnt = {}, last = {}; w.log.forEach((e, i) => { if (SETTLE.includes(e.place)) { cnt[e.place] = (cnt[e.place] || 0) + 1; last[e.place] = i; } });
    const ks = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a] || last[b] - last[a]);
    return ks[0] || (SETTLE.includes(w.lastTown) ? w.lastTown : 'town');
  }
  // 世界の上の暮らしの場所：home の印の場所、無ければ人生でいちばん長くいた村・町（同数なら後のほう）、無ければ最後にいた村・町。地図に名のある場所そのもの（「〇〇近くの街道」でなく）
  function restLoc(w) {
    const SW = SWd(); if (!SW) return null;
    if (w.homeLoc && SW.plain(w.homeLoc)) return SW.plain(w.homeLoc, restPlace(w));
    const cnt = {}, last = {}; w.log.forEach((e, i) => { if (e.loc && SETTLE.includes(e.place)) { cnt[e.loc.id] = (cnt[e.loc.id] || 0) + 1; last[e.loc.id] = i; } });
    const ks = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a] || last[b] - last[a]);
    const id = ks[0] || w.lastTownLoc || null; return id ? SW.plain(id, restPlace(w)) : null;
  }
  // 戦いの話（初めての戦い・強敵・迷宮・裏切りと報い）の数。「戦いから退き」「長い戦いのあと」は2本以上あった人にだけ言う
  const FIGHT_TYPES = ['first_battle', 'boss', 'dungeon', 'betrayal_revenge'];
  const fightCount = w => w.log.filter(e => !e.filler && FIGHT_TYPES.includes(e.type)).length;
  // 結びの「手が届きそうなところまで来ていた」などの高い段（望みの進み60以上）は、名声が2未満、または直近4つの分かれ目で2つ以上失敗している人には使わず、ひとつ下の段にする
  function recentLosses(w) { const cs = []; w.log.slice(-4).forEach(e => (e.choices || []).forEach(c => cs.push(c))); return cs.slice(-4).filter(c => c.outcome === 'lose').length; }
  const pickOf = (R, x) => (Array.isArray(x) ? pick(R, x) : x);
  function tierText(w, R, arr, pr) {
    let i = arr.findIndex(x => pr >= x[0]); if (i < 0) i = arr.length - 1;
    if (i === 0 && arr.length > 1 && ((hero(w).stats.名声 || 0) < 2 || recentLosses(w) >= 2)) i = 1;
    return pickOf(R, arr[i][1]);
  }
  function endingText(w, kind) {
    const h = hero(w), pr = h.goal.progress, E = D.ENDING, E2 = D.END2, R = rngOf(w), P = PD.PAST[h.persona.past], young = isYoungEnd(w, kind), EY = D.ENDING_YOUNG, wk = pm(h).wish, X = endCtx(w), fame = h.stats.名声 || 0;
    // 余生・成就の場所は暮らせる所（home の印の場所→人生でいちばん長くいた村・町）。力尽きた場所だけは最後にいた所
    const home = restPlace(w), fought = fightCount(w) >= 2;
    // 世界があれば、暮らしの場所・力尽きた場所は、その場所の名前と国で言う
    const SW = SWd(), lastEv = w.log[w.log.length - 1], restL = SW ? restLoc(w) : null, atL = kind === 'death' ? (lastEv && lastEv.loc) : restL;
    // 成就のとき「元の世界に帰る」望みの人は、人（恋仲・仲間・師など）がいれば「帰ることより大事なものができた」（見出しは「望みが形を変えた」＝kind 'changed'）、
    // 人がいなければ（家・店だけでも）帰還（光の中を歩き出す。家・店を後にする一文を添える）
    const wishChanged = kind === 'changed' && wk === 'home', wishReturn = (kind === 'wish' || kind === 'changed') && wk === 'home' && !wishChanged, tk = kind === 'changed' ? 'wish' : kind;
    const healSrc = (kind === 'death' ? D.HEAL_DEATH : D.HEAL) || {}, E3 = D.END3;
    const healArr = [].concat(healSrc[wk] || []), calmArr = healArr.filter(x => !/胸を張|誇らし|満ち足り/.test(x));   // 直前に重い出来事（疑い・別れ・負け・開いたままの糸）があるとき、胸を張る・誇らしい・満ち足りた、とは言わない
    let heal = pickOf(R, X.shadow && calmArr.length ? calmArr : healArr) || 'ここで生きていてよかった';
    if (wk === 'home' && !wishChanged) heal = X.anchors ? E2.healHomeAnchor : E2.healHomeFree;   // 「ここが、帰る場所だ」は、望みが形を変えたときだけ
    const m = { 名: h.nick, goal: h.goal.text, at: (SW && atL) ? SW.at(atL) : (D.PLACE_AT[kind === 'death' ? h.place : home] || ''), left: (D.LEFT_END && D.LEFT_END[h.persona.past]) || P.left, value: P.value, heal, sw: X.sw, ties: wishChanged ? (X.stayNames || X.ties) : X.ties, homeName: (SW && restL) ? restL.name : (D.PLACE_NAME[home] || '町') }, parts = [];
    if (kind === 'death') {
      // 住まい・店を持った人に「旅は…終わりを迎えた」は言わない。家のある所の外で力尽きたときは、戻れなかったことを添える
      const lead = X.sw ? E.death.filter(t => !/旅/.test(t)) : E.death;
      parts.push(fmt(pick(R, lead), m), fmt(tierText(w, R, E.deathGoal, pr), m));
      if (X.sw && !SETTLE.includes(h.place)) parts.push(fmt(E2.deathAway, m));
    }
    else if (kind === 'wish' || kind === 'changed') {
      if (wishChanged) parts.push(fmt(E2.wishHomeChanged, m));
      else if (wk === 'home') { parts.push(fmt(E.wish.home, m)); if (X.sw) parts.push(fmt(pick(R, E2.wishHomeLeave), m)); }   // 家・店だけの人は帰る：後にする一文
      else if (wk === 'quiet') parts.push(fmt(pick(R, fought && !X.shadow ? E2.wishQuiet.fight : E2.wishQuiet.plain), m));   // 「長い戦いのあとの静かな朝」は、戦いの話が2本以上あり、直前に重い出来事が無い人だけ
      else if (wk === 'strong') parts.push(fmt(pick(R, fame >= 4 ? (/守/.test(h.goal.text) ? E2.wishStrong.guard : E2.wishStrong.big) : E2.wishStrong.small), m));   // 「守りたいものを守れる」は、望みの文に「守」がある人だけ
      else if (wk === 'help') parts.push(fmt(pick(R, Object.keys(w.people).length - 1 >= 12 ? E2.wishHelp.many : E2.wishHelp.few), m));
      else parts.push(fmt(E.wish[wk], m));
      // 望みの言葉と実際の人生がずれているときは「ついにかなえた」と言わず、思い描いた形とは違ったと添える。望みを実際にいちばん進めた話を名指しする
      if (!wishChanged && wk !== 'home' && X.goalOff) parts[parts.length - 1] = fmt(pick(R, E3.wishOff), m);
      if (!wishChanged && X.goalTop && E3) {
        const gt0 = X.goalTop, who = gt0.who ? w.people[gt0.who].nick : null;
        parts.push(fmt(pick(R, E3.wishTop), { 名: h.nick, at: SETTLE.includes(gt0.place) && SW && gt0.loc ? SW.at(SW.plain(gt0.loc.id, gt0.place) || gt0.loc) + 'の' : SETTLE.includes(gt0.place) && D.PLACE_AT[gt0.place] ? D.PLACE_AT[gt0.place] + 'の' : '', title: gt0.title, 人句: who ? '、' + who + 'と過ごした日々' : 'の日々' }));
      }
    }
    else if (kind === 'peace') {
      const homeG = wk === 'home' ? (X.anchors ? E2.peaceGoalHomeAnchor : E2.peaceGoalHomeFree) : (X.sw && !young ? E2.peaceGoalSettled : null);
      // 「戦いから退き」は戦いの話が2本以上あった人だけ。それ以外は穏やかな言い回しから選ぶ
      const lead = X.sw ? (young ? E2.peaceYoungSettled : (fought ? E2.peaceSettled : [E2.peaceSettled[0]].concat(E2.peaceSettledCalm))) : (young ? EY.peace : (fought ? E.peace : [E.peace[0]].concat(E2.peaceCalm)));
      parts.push(fmt(pick(R, lead), m), fmt(tierText(w, R, homeG || (young ? EY.peaceGoal : E.peaceGoal), pr), m));
    }
    else parts.push(fmt(E.abandon, m));
    if (kind !== 'abandon') {
      const nem = relList(w, ['nemesis'])[0], T = X.top;
      if (X.names.length) parts.push(fmt(wishReturn ? E2.wishHomeReturnNear : E.near[tk], { 人: X.names.join('と') }));
      // いちばん多く関わった人：恋仲・仲間として並べた人でなければ、結びに一度は出す（亡くなった・行方知れず・旅に出ている・別れた、の言い方も）
      if (T && !X.nameIds.has(T.id)) parts.push(fmt(pickOf(R, E2.top[T.state][tk]), { 名: h.nick, 関: relWord(T.rel), 名前: T.p.nick }));
      else if (!X.names.length && X.others.length) parts.push(fmt(E2.some[tk], { 人: X.others.map(x => relWord(x.rel) + x.p.nick).join('と') }));
      else if (!X.names.length && X.crowd) parts.push(E2.crowd[tk]);   // 縁のある人はいるが、どの人も1話にしか出ていない
      else if (!X.names.length && !T && !nem) parts.push(fmt(E.alone[tk], m));   // ひとりきり：縁のある人が誰もいないときだけ
      if (nem) parts.push(fmt(E.nemesis[tk], { 名: h.nick, 仇: nem.p.nick }));
      // 引かれないまま残った重い糸（恨み・行方知れず・別れ）：一文だけ触れる。いちばん関わった人が行方知れずの言い方で出ているときは重ねない
      if (X.unsettled && !(T && X.unsettled.who === T.id && T.state === 'missing')) { const who = X.unsettled.who ? w.people[X.unsettled.who].nick : null, arr0 = E3.unsettled[X.unsettled.id] || E3.unsettled._, arr = who ? arr0 : arr0.filter(x => !/{人}/.test(x)), pool = arr.length ? arr : E3.unsettled._;
        parts.push(fmt(pick(R, pool), { 人: who || '' })); }
      parts.push(wishReturn ? fmt(E2.pastWishReturn, m) : fmt(pick(R, E2.pastVar[tk]), m));
      if (young) parts.push(EY.tail);   // 若い人の結び：「この先も、日々は続いていく。」
    }
    parts.push(fmt(E.tail, { fame: h.stats.名声, items: h.items.length, skills: h.skills.length, people: Object.keys(w.people).length - 1 }));
    let txt = parts.join('');
    if (/消え/.test(P.left)) txt = txt.replace('いまも消えない', 'いまも残っている');   // 「消えない後ろめたさは、いまも消えない」の重なりを避ける
    if (/[{}]/.test(txt)) { warn('終わりの文に差し込みが残った: ' + txt.slice(0, 40)); txt = txt.replace(/{[^{}]*}/g, ''); }
    return txt;
  }
  // 台本の終わり：糸を張る・引く、年表に残す、時間を進める、人生の終わりを確かめる
  function finish(w) {
    const c = w.cur; if (!c) return null;
    const R = rngOf(w), h = hero(w), ep = getEp(c.epId), id = 'e' + c.turn, opened = [], closed = [];
    // 糸を引き終える：人ごとに別の糸なので、引いた人の糸の1本だけを閉じる
    (ep.closes || []).forEach(cl => {
      const tid = typeof cl === 'string' ? cl : cl.id; if (typeof cl !== 'string' && !ifOk(c, cl.if, w)) return;
      const pid = (ep.cast || []).filter(e => e.pick && e.pick.thread === tid).map(e => c.cast[e.key]).find(Boolean) || (c.threadId === tid ? c.threadWho : null);
      const t = pid ? w.threads.find(x => !x.closed && x.id === tid && x.who === pid) : w.threads.find(x => !x.closed && x.id === tid);
      if (t) { t.closed = c.turn; t.closedBy = ep.id; closed.push({ id: t.id, who: t.who, opened: t.turn, ep: t.ep, memo: t.memo == null ? null : t.memo }); }
    });
    // 糸を張る：台本全体の opens（if つき）と、step・選択肢で記録した opens
    const pend = (c.opensNow || []).slice(), map0 = castMap(w, c);
    (ep.opens || []).forEach(o => {
      if (!o || !ifOk(c, o.if, w)) return; const who = o.who ? c.cast[o.who] : null;
      if (o.who && !who) return;
      pend.push({ id: o.id, who: who || null, memo: o.memo != null ? fmt(o.memo, map0) : null });
    });
    pend.forEach(o => {
      const who = o.who || h.id;
      if (w.threads.some(t => !t.closed && t.id === o.id && t.who === who)) return;
      if (o.id === 'grudge' && who !== h.id && reconciled(w, who)) return;   // 和解した（恨みの糸を閉じた）相手に、また恨みの糸を張らない
      // 糸を張った相手に主人公との関係が無ければ、最低限の関係（知人・信頼0）を付ける（無いと、糸を引く配役に選ばれない）
      if (who !== h.id && w.people[who] && !h.relations[who]) { const e = { t: 'rel', a: h.id, b: who, type: 'acquaintance', trust: 0, auto: true }; applyEffect(w, { id: 'e' + c.turn, turn: c.turn }, e); c.eff.push(e); w.autoRel = (w.autoRel || 0) + 1; }
      w.threads.push({ id: o.id, who, turn: c.turn, ep: ep.id, memo: o.memo == null ? null : o.memo }); opened.push({ id: o.id, who, memo: o.memo == null ? null : o.memo });
    });
    // けがの回復（校閲4回目の直し）：話の数ではなく時間で治る。この話で負ったけがは、ひと月半〜三か月（45〜90日）で治る時刻を決めておき、
    // それを過ぎて最初に始まる次の話の頭で「けがが治った」と1文出す（begin）。台本が先に治してもよい。呪い・喪失は台本が解くまで残る
    if (h.flags.includes('けが') && h.stats.命 > 0 && (h.flagAt || {}).けが === c.turn) {
      const lenMo = 1.5 + 1.5 * localRng(hashSeed(w.seed) ^ Math.imul(c.turn, 0x2545f491))();
      h.flagHeal = { at: c.mo + (c.spanDays != null ? c.spanDays : (ep.span && ep.span.days) || 0) / 30 + lenMo, days: Math.round(lenMo * 30) };
    }
    // 余韻：分かれ目で成功した道（判定の無い道を含む）を通ったときだけ ep.payoff を出す。失敗した分かれ目がある（命が尽きた場合も含む）ときは payoffLose があればそれ、無ければ出さない
    const lostWay = !c.filler && (c.choices.some(x => x.outcome === 'lose') || h.stats.命 <= 0);
    // 第7回：選択肢の win／lose に payoff があれば、それが先（失敗の道の余韻があればそれ、無ければ成功の道の余韻。失敗した話に成功の道の余韻は出さない）
    const pp = c.payoffs || [], pLose = pp.filter(x => x.outcome === 'lose').pop(), pWin = pp.filter(x => x.outcome === 'win').pop();
    const payoff = pLose ? pLose.t : (!lostWay && pWin) ? pWin.t : lostWay ? (c.payoffLose || '') : c.payoff;
    const spanDays = c.spanDays != null ? c.spanDays : (ep.span && ep.span.days ? ep.span.days : 0);   // 道ごとの日数が先
    if (SETTLE.includes(c.place)) { w.lastTown = c.place; if (c.loc) w.lastTownLoc = c.loc.id; }
    const cast = Object.keys(c.cast).map(k => ({ key: k, id: c.cast[k], role: c.castAll[k] }));
    const ev = { id, turn: c.turn, age: c.age, year: c.year, season: c.season, month: c.month, when: c.when, place: c.place, loc: c.loc || null, travel: c.travel || 0, from: c.from || null, time: c.time, time0: c.time0, span: spanDays, mo: c.mo, relaxed: c.relaxed, bg: c.bg, type: c.type, tpl: c.tpl, epId: c.epId, title: c.title, stake: c.stake, payoff, filler: c.filler,
      cast, lines: c.lines.map(l => Object.assign({}, l)), choices: c.choices, effects: c.eff, opened, closed, pulled: c.pulled, threadMemo: c.threadMemo, trigger: c.trigger, healed: c.healed || null, over: null };
    [h.id].concat(cast.map(x => x.id)).forEach(pid => { const P = w.people[pid]; if (P && !P.life.includes(id)) P.life.push(id); });
    h.place = c.place;
    if (c.loc) { w.loc = c.loc.id; (w.path || (w.path = [])).push(c.loc.id); }
    // 台本の中で変わった items の from を、年表の id に合わせる（doFx が 'e'+turn を使っているので一致している）
    // 転生のあと最初の2つの間（第1→2話、第2→3話）は、ひと月〜三か月。以後は4〜8か月（以前は最初から4〜8か月で、第2話で1年半たって「目を覚ましてから、まだ日は浅い」と読めた）
    const dm = (c.turn <= EARLY_GAP_TURNS ? 1 + 2 * R() : 4 + 4 * R()) + (spanDays > 0 ? spanDays / 30 : 0), dt = dm / 12;   // 台本の中でたった日数（span）は、次の {時} に足す
    w.mo += dm; w.gap = Math.round(dm); w.gapMo = dm - (spanDays > 0 ? spanDays / 30 : 0);
    Object.keys(w.people).forEach(pid => { const P = w.people[pid]; if (P.alive) P.age = P.id === h.id ? w.age0 + w.mo / 12 : r2(P.age + dt); });
    w.turn = c.turn; w.log.push(ev); w.cur = null; if (!ep.filler) w.used.push(ep.id);
    w.god.power = Math.min(TN.maxPower, w.god.power + 2);
    w.god.hand.push(pick(R, PD.CARD_NAMES)); while (w.god.hand.length > TN.handSize) w.god.hand.shift();
    let end = null;
    if (h.stats.命 <= 0) end = 'death';
    else if (h.stats.絆 <= 0) end = 'abandon';
    else if (h.goal.progress >= 100 && w.turn >= 8) {
      // 重い糸（恨み・行方知れず・別れ）が開いていて、引く台本が起こせるときは、望みが成就しても最大 HEAVY_EXTRA 話まで終わりを先に延ばして糸を引く（校閲6回目：成就で人生が終わり、引ける重い糸が残った）
      if ((w.wishDelay || 0) < HEAVY_EXTRA && pullableThread(w, true)) w.wishDelay = (w.wishDelay || 0) + 1;
      else end = (pm(h).wish === 'home' && endCtx(w).stayNames) ? 'changed' : 'wish';
    }   // 「元の世界に帰る」望みで、置いては行けない人がいる＝望みが形を変えた（見出しも別）
    else if (w.turn >= w.maxEp && !(w.turn < w.maxEp + THREAD_EXTRA && pullableThread(w))) end = 'peace';   // 予定の話数に来ても、引ける糸と、それを引く台本があるうちは、最大 THREAD_EXTRA 話まで続ける
    else if (ep.filler && !epsAll().some(e => e && e.id && typeOk(w, e) && feasible(w, e, w.turn + 1, true))) end = 'peace';   // 埋め草のあと、もう起こせる台本が無い：続けて埋め草を出さず、ここで終える
    if (end) {
      // 第7回の直し（終わりの年齢が最後の話より1つ多い・第5回の再発）：話のあとの「次の話までの間」（dm のうち台本の日数を除いた分）は、終わりでは次の話が無いので進めない。
      // 終わりの年齢は、最後の話が終わった時点（話の始まり＋台本の日数）の年齢になる。台本の日数で誕生日をまたぐときだけ最後の話より1つ多くなる
      unGap(w);
      w.over = overOf(w, end); ev.over = end;
    }
    return ev;
  }

  // 自動で1つの台本を最後まで演じる。policy＝'none'（札を使わない）／'best'（効く札を使う）／'random'（札を気ままに使う）
  function auto(w, policy) {
    if (w.over) return null;
    if (!w.cur) next(w);
    let guard = 0, end = null;
    while (w.cur && guard++ < 200) {
      const r = w.cur.choice ? { kind: 'choice' } : advance(w);
      if (!r) break;
      if (r.kind === 'choice') {
        if (policy && policy !== 'none') autoCard(w, policy);
        const d = decide(w); if (d.end) { end = d.end; break; }
      } else if (r.end) { end = r.end; break; }
    }
    return end;
  }
  function autoCard(w, policy) {
    const ch = w.cur.choice, h = hero(w), per = pm(h);
    if (!ch || ch.card) return;
    const hasCheck = ch.opts.some(o => o.chance != null);
    const R = rngOf(w);
    if (policy === 'random') { const names = w.god.hand.filter(n => w.god.power >= D.CARDS[n].cost && (n !== '天罰' || hasCheck)); if (names.length && R() < 0.7) playCard(w, pick(R, names)); return; }
    const best = w.god.hand.map(n => ({ n, s: per.cards.find(x => x.name === n).score })).filter(x => w.god.power >= D.CARDS[x.n].cost && x.n !== '天罰' && x.s >= 1).sort((a, b) => b.s - a.s)[0];
    if (best && (hasCheck || R() < 0.4)) playCard(w, best.n);
  }

  // ---------- 表示用 ----------
  function person(w, id) {
    const P = personAny(w, id || w.heroId); if (!P) return null;
    const evBy = {}; w.log.forEach(e => { evBy[e.id] = e; }); if (w.cur) evBy['e' + w.cur.turn] = { title: w.cur.title, turn: w.cur.turn };
    const rels = Object.keys(P.relations).map(rid => { const r = P.relations[rid], o = personAny(w, rid); return { id: rid, name: o ? o.nick : '？', type: r.type, typeName: (D.REL_TYPES[r.type] || {}).name || r.type, trust: r.trust, since: r.since, look: o ? o.look : null, build: o ? o.build || null : null, alive: o ? o.alive : false, job: o ? o.job : '', known: !!r.known, missing: !!(o && o.missing && o.alive), away: !!(o && o.away && o.alive && !o.missing), sinceTitle: evBy['e' + r.since] ? evBy['e' + r.since].title : '' }; });
    return {
      person: P, persona: pm(P), marks: P.id === w.heroId ? marksOf(w).map(m => ({ id: m, name: MARKS[m] || m })) : [],
      items: P.items.map(i => { const f = INFO[i.no]; return { no: i.no, name: f.name, category: f.cat, look: f.look, effect: f.effect, n: i.n, turn: i.turn, from: i.from, fromTitle: i.from === 'birth' ? '最初から持っていた' : (evBy[i.from] ? evBy[i.from].title : '') }; }),
      skills: P.skills.map(s => { const d = SK[s.id]; return { id: s.id, name: d.name, category: d.cat, lv: s.lv, desc: d.desc, turn: s.turn, fromTitle: s.from === 'birth' ? '生まれたときに授かった' : (evBy[s.from] ? evBy[s.from].title : '') }; }),
      relations: rels, life: P.life.map(eid => evBy[eid]).filter(e => e && e.lines),
    };
  }
  function item(no) { const f = INFO[no]; return f ? { no: f.no, name: f.name, category: f.cat, look: f.look, effect: f.effect } : null; }
  const save = w => JSON.stringify(w);
  // 保存の版：3（第2版の形式。糸に memo、時間 time0 など）。古い保存・壊れた保存は、日本語の理由を付けて投げる（画面は「読み込めなかった」と出して落ちない）
  function load(s) {
    let w; try { w = JSON.parse(s); } catch (e) { throw new Error('保存データが壊れていて、読み込めません。新しい人生を始めてください。'); }
    if (!w || typeof w !== 'object' || w.v !== 4) throw new Error('この保存データは古い形式（版' + (w && w.v != null ? w.v : '不明') + '）のため、読み込めません。新しい人生を始めてください。');
    return w;
  }

  // ---------- 台本の検査 ----------
  // 台本の道を全部数える（検査用）。分かれ目の step を順に読み、その時点の状態で step の if・選択肢の if が合うものだけを辿る
  // （任意の配役が不在なら、その配役を要る選択肢・step は辿らない。状態を見る条件は、どちらもありうるものとして辿る）。drop＝任意の配役を外す。戻り値＝[{id,opt,outcome}…] の配列の配列（300 を超えたら間引く）
  function enumPaths(ep, drop) {
    const steps = ep.steps || [], res = [], cast = {};
    (ep.cast || []).forEach(e => { if (e && !(isOptEnt(e) && drop)) cast[e.key] = 'x'; });
    const threadsAt = listOf((ep.need || {}).threads);
    const rec = (si, picked, out, path) => {
      if (res.length >= 20000) return;
      for (; si < steps.length; si++) {
        const st = steps[si]; if (!st || typeof st !== 'object') continue;
        const c = { cast, picked, out, threadsAt, touchHit: false };
        if (!ifOk(c, st.if)) continue;
        if (st.choice) {
          const ch = chOf(st);
          (ch.opts || []).forEach(op => {
            if (!op || !ifOk(c, op.if)) return;
            [['win']].concat(op.check ? [['lose']] : []).forEach(([oc]) => rec(si + 1, Object.assign({}, picked, { [ch.id]: op.key }), Object.assign({}, out, { [ch.id]: oc }), path.concat([{ id: ch.id, opt: op.key, outcome: oc }])));
          });
          return;
        }
      }
      res.push(path);
    };
    rec(0, {}, {}, []);
    if (res.length > 300) { const stride = Math.ceil(res.length / 300); return res.filter((_, i) => i % stride === 0); }
    return res;
  }
  // 台本を、分かれ目×選択肢×成否の道ごとに追う（検査用）。亡くなった人が話す道と、道によって有る・無い効果（合流の要確認）を返す
  function analyzePaths(ep) {
    const out = { dead: [], merge: [] }, steps = ep.steps || [];
    const hasOpt = (ep.cast || []).some(e => e && isOptEnt(e)), label = p => p.map(x => x.id + ':' + x.opt + ':' + x.outcome).join(',') || '（分かれ目なし）';
    const sigText = sg => sg.startsWith('item ') ? '物を渡す ' + sg.slice(5) : sg.startsWith('lose ') ? '物を失う ' + sg.slice(5) : sg.startsWith('death ') ? "['death','" + sg.slice(6) + "']" : '金の増減（' + sg.slice(5) + '）';
    const deadSeen = new Set(), reported = new Set();
    [false, true].forEach(drop => {
      if (drop && !hasOpt) return;
      const sigs = {}, all = enumPaths(ep, drop);
      all.forEach((p, pi) => {
        const force = {}; p.forEach(x => { force[x.id] = x; });
        const c = { cast: {}, picked: {}, out: {}, threadsAt: listOf((ep.need || {}).threads), touchHit: false }, dead = new Set();
        (ep.cast || []).forEach(e => { if (e && !(isOptEnt(e) && drop)) c.cast[e.key] = 'x'; });
        const add = (sg, si) => { const o = sigs[sg] = sigs[sg] || { paths: new Set(), min: 1e9, ex: label(p) }; o.paths.add(pi); o.min = Math.min(o.min, si); };
        const fxs = (list, si) => listOf(list).forEach(f => {
          if (!Array.isArray(f)) return; const op = f[0];
          if (op === 'item') add('item ' + JSON.stringify(f[1]), si); else if (op === 'lose') add('lose ' + JSON.stringify(f[1]), si);
          else if (op === 'death') { add('death ' + f[1], si); dead.add(f[1]); } else if (op === 'gold') add('gold ' + (f[1] >= 0 ? '+' : '-'), si);
        });
        steps.forEach((st, si) => {
          if (!st || typeof st !== 'object' || !ifOk(c, st.if)) return;
          if (st.choice) {
            const ch = chOf(st), f = force[ch.id]; if (!f) return; const op = (ch.opts || []).find(o => o && o.key === f.opt); if (!op) return;
            c.picked[ch.id] = f.opt; c.out[ch.id] = f.outcome;
            const res = f.outcome === 'win' ? (op.win || (op.t || op.fx ? { fx: op.fx } : null)) : op.lose; fxs(res && res.fx, si);
          } else {
            const sp = speechOf(st);
            if (sp && sp.who && sp.who !== 'H' && sp.who !== '名' && c.cast[sp.who] && dead.has(sp.who)) { const k = si + ':' + sp.who; if (!deadSeen.has(k)) { deadSeen.add(k); out.dead.push({ si, who: sp.who, path: label(p) }); } }
            fxs(st.fx, si);
          }
        });
      });
      Object.keys(sigs).forEach(sg => {
        const o = sigs[sg]; if (o.paths.size === 0 || o.paths.size === all.length || reported.has(sg)) return;
        const k = steps.findIndex((st, i) => i > o.min && st && typeof st === 'object' && !st.choice && (st.if == null || (Array.isArray(st.if) && !st.if.length)));
        if (k < 0) return;
        const no = all.findIndex((_, pi) => !o.paths.has(pi)); reported.add(sg);
        out.merge.push('要確認（合流）台本「' + ep.id + '」' + (drop ? '（任意の配役なし）' : '') + '：' + sigText(sg) + ' が、道によって有る・無い（有る道の例＝' + o.ex + '／無い道の例＝' + label(all[no]) + '）。その後ろの step[' + k + ']（if なし）は全部の道で読まれる');
      });
    });
    return out;
  }
  function validate() {
    const E = [], W = [], UJ = [], ok = (cond, m) => { if (!cond) E.push(m); };
    const eps = epsAll(), PK1 = Object.keys(PD.S1), PK2 = Object.keys(PD.S2), TYPEKEYS = Object.keys(D.TYPES), allSkillIds = new Set(D.SKILLS.map(s => s.id));
    const opened = new Set(), needed = new Set(), seen = new Set(), noMemo = {}, merge = [], mustMemo = [], setMarks = new Set(), needMarks = [];
    eps.forEach(ep => allOpens(ep).forEach(x => opened.add(x.o && x.o.id)));
    eps.forEach(ep => ((ep.need || {}).threads || []).forEach(t => needed.add(t)));
    eps.forEach(ep => ((ep && ep.cast) || []).forEach(e => { if (e && e.pick && typeof e.pick.thread === 'string') needed.add(e.pick.thread); }));   // pick.thread で引く糸も「引く台本がある」
    eps.forEach((ep, ei) => {
      const L = 'エピソード「' + (ep && ep.id) + '」', P = where => L + where + '：';
      if (!ep || typeof ep !== 'object') { E.push('台本' + ei + '番目がオブジェクトでない'); return; }
      ok(typeof ep.id === 'string' && ep.id, '台本' + ei + '番目に id が無い');
      ok(!seen.has(ep.id), L + 'の id が重複している'); seen.add(ep.id);
      ok(TPLS[ep.tpl], P('') + 'tpl が型紙に無い（' + ep.tpl + '）');
      ok(TYPEKEYS.includes(ep.type), P('') + 'type が18型に無い（' + ep.type + '）');
      if (TPLS[ep.tpl] && TYPEKEYS.includes(ep.type)) ok(TPLS[ep.tpl].type === ep.type, P('') + 'type（' + ep.type + '）が型紙 ' + ep.tpl + ' の型（' + TPLS[ep.tpl].type + '）と違う');
      ok(typeof ep.title === 'string' && ep.title, P('') + 'title が無い');
      ok(Array.isArray(ep.stage) && ep.stage.length && ep.stage.every(s => s === 0 || s === 1 || s === 2), P('') + 'stage は 0・1・2 の配列');
      ok(Array.isArray(ep.place) && ep.place.length && ep.place.every(p => D.BG[p] && D.PLACE_NAME[p]), P('') + 'place に知らない場所がある（' + JSON.stringify(ep.place) + '）');
      ok(Array.isArray(ep.time) && ep.time.length && ep.time.every(t => TIMES.includes(t)), P('') + 'time は day・dusk・night の配列');
      ok(typeof ep.stake === 'string' && ep.stake, P('') + 'stake が無い');
      if (typeof ep.stake === 'string') {
        if (/[{}]/.test(ep.stake.replace(/\{[^{}]*\}/g, ''))) E.push(P('') + 'stake の { } の対応が崩れている');
        (ep.stake.match(/\{[^{}]*\}/g) || []).forEach(tok => { const k = tok.slice(1, -1); if (SYS_KEYS.includes(k)) return; const ent = (ep.cast || []).find(e => e && e.key === k); if (ent) { ok(!isOptEnt(ent), P('') + 'stake に任意の配役 {' + k + '} は使えない'); return; } E.push(P('') + 'stake の差し込み ' + tok + ' が知らない名前（使えるのは {名}{場所}{前職}{死}{力} と配役の key）'); });
      }
      ok(typeof ep.payoff === 'string' && ep.payoff, P('') + 'payoff が無い');
      ok(ep.payoffLose == null || (typeof ep.payoffLose === 'string' && ep.payoffLose.trim()), P('') + 'payoffLose は、失敗の道を通ったときの余韻（空でない文字列）');
      ok(Array.isArray(ep.steps) && ep.steps.length, P('') + 'steps が無い');
      // 配役
      const cast = ep.cast || [], keys = {}, optional = new Set();
      ok(Array.isArray(ep.cast), P('') + 'cast が配列でない');
      cast.forEach((ent, i) => {
        ok(ent && /^[A-Za-z][A-Za-z0-9_]*$/.test(ent.key || ''), P('cast[' + i + ']') + 'key が不正');
        ok(!keys[ent.key], P('cast') + 'key が重複（' + ent.key + '）'); keys[ent.key] = true;
        ok(!/^(c\d+|H|thread|touch|skill|cheat|flag|gold|trust|hasThread)$/.test(ent.key || ''), P('cast') + 'key に使えない名前（' + ent.key + '）');
        ok(typeof ent.role === 'string' && ent.role, P('cast ' + ent.key) + 'role が無い');
        const pk = ent.pick || {};
        const kinds = ['new', 'rel', 'thread'].filter(k => pk[k] != null);
        ok(kinds.length === 1, P('cast ' + ent.key) + 'pick は new・rel・thread のどれか1つ');
        if (pk.new != null) { ok(D.POOLS[pk.new] || pk.new === 'child', P('cast ' + ent.key) + 'pick.new が知らない（' + pk.new + '）'); if (pk.job != null) { ok(typeof pk.job === 'string' ? !!pk.job : (Array.isArray(pk.job) && pk.job.length && pk.job.every(x => typeof x === 'string' && x)), P('cast ' + ent.key) + 'pick.job は職の名（文字列か、その配列）'); if (pk.new !== 'child' && D.POOLS[pk.new]) listOf(pk.job).forEach(j => { if (!D.POOLS[pk.new].some(x => x[1] === j)) UJ.push(ep.id + ' ' + ent.key + '：' + j); }); if (pk.new === 'child') W.push(L + '：cast ' + ent.key + ' は子どもなので pick.job は使われない'); } ok(!(pk.new === 'child' && NOKID_TYPES.has(ep.type)), P('cast ' + ent.key) + '子どもを恋愛・戦いの型の配役にしている'); }
        if (pk.rel != null) { ok(Array.isArray(pk.rel) && pk.rel.length && pk.rel.every(t => D.REL_TYPES[t]), P('cast ' + ent.key) + 'pick.rel が不正（' + JSON.stringify(pk.rel) + '）'); }
        if (pk.thread != null) { ok(typeof pk.thread === 'string', P('cast ' + ent.key) + 'pick.thread が不正'); ok(opened.has(pk.thread), P('cast ' + ent.key) + '糸「' + pk.thread + '」を張る台本がどこにも無い'); ok(pk.optional || ((ep.need || {}).threads || []).includes(pk.thread), P('cast ' + ent.key) + 'pick.thread の糸が need.threads に無い（need.threads に書かないなら、pick に optional: true を付ける）'); }
        ok(pk.optional == null || (typeof pk.optional === 'boolean' && pk.thread != null), P('cast ' + ent.key) + 'pick.optional は pick.thread と一緒に使う true / false');
        { const fbk = pk.fallback != null ? pk.fallback : ent.fallback;
          if (fbk != null) { ok(pk.thread != null && pk.optional, P('cast ' + ent.key) + 'fallback は pick.thread＋optional: true のときだけ書ける'); ok(fbk && typeof fbk === 'object' && (D.POOLS[fbk.new] || fbk.new === 'child'), P('cast ' + ent.key) + 'fallback は { new: 配役の元 … } の形（new が知らない：' + (fbk && fbk.new) + '）'); if (fbk && typeof fbk === 'object') { ok(!(fbk.new === 'child' && NOKID_TYPES.has(ep.type)), P('cast ' + ent.key) + '子どもを恋愛・戦いの型の配役にしている'); ['minAge', 'maxAge'].forEach(k => ok(fbk[k] == null || (typeof fbk[k] === 'number' && fbk[k] >= 0 && fbk[k] <= 100), P('cast ' + ent.key) + 'fallback.' + k + ' は 0〜100 の数')); if (fbk.job != null) ok(typeof fbk.job === 'string' ? !!fbk.job : (Array.isArray(fbk.job) && fbk.job.length && fbk.job.every(x => typeof x === 'string' && x)), P('cast ' + ent.key) + 'fallback.job は職の名（文字列か、その配列）'); } } }
        ok(pk.job == null || pk.new != null, P('cast ' + ent.key) + 'pick.job は pick.new（新しい人）だけに書ける');
        ['minAge', 'maxAge'].forEach(k => ok(pk[k] == null || (typeof pk[k] === 'number' && pk[k] >= 0 && pk[k] <= 100), P('cast ' + ent.key) + 'pick.' + k + ' は 0〜100 の数'));
        ok(pk.minAge == null || pk.maxAge == null || pk.minAge <= pk.maxAge, P('cast ' + ent.key) + 'pick.minAge が maxAge より大きい');
        if (isOptEnt(ent)) optional.add(ent.key);
      });
      const need = ep.need || {};
      ok(Array.isArray(need.threads || []) && Array.isArray(need.noThreads || []), P('need') + 'threads / noThreads は配列');
      (need.threads || []).forEach(t => ok(opened.has(t), P('need') + '糸「' + t + '」を張る台本がどこにも無い'));
      listOf(need.cheat).forEach(id => ok(SK[id] && SK[id].cheat === true, P('need') + 'cheat「' + id + '」は、スキルに無いか、チートの印（cheat:true）が無い'));
      listOf(need.skill).forEach(id => ok(SK[id], P('need') + 'skill「' + id + '」が実在のスキルでない'));
      ok(need.minGold == null || (typeof need.minGold === 'number' && need.minGold >= 0), P('need') + 'minGold は 0 以上の数');
      ok(need.threadDead == null || typeof need.threadDead === 'boolean', P('need') + 'threadDead は true / false');
      // 第3版：印・順番・行方知れず
      if (need.hasAny != null) { ok(Array.isArray(need.hasAny) && need.hasAny.length && need.hasAny.every(x => typeof x === 'string' && x), P('need') + 'hasAny は印の名の配列（どれか1つが立っていればよい）'); listOf(need.hasAny).forEach(m => { if (!MARKS[m]) W.push(L + '：need.hasAny の印「' + m + '」は決まった印に無い'); }); if (listOf(need.hasAny).length && listOf(need.hasAny).every(m => typeof m === 'string')) needMarks.push({ ep: ep.id, m: listOf(need.hasAny), any: true }); }
      ['has', 'not'].forEach(k => { if (need[k] != null) { ok(Array.isArray(need[k]) && need[k].every(x => typeof x === 'string' && x), P('need') + k + ' は印の名の配列'); listOf(need[k]).forEach(m => { if (!MARKS[m]) W.push(L + '：need.' + k + ' の印「' + m + '」は決まった印（' + Object.keys(MARKS).join('・') + '）に無い'); if (k === 'has') needMarks.push({ ep: ep.id, m }); }); } });
      ['before', 'after'].forEach(k => { if (need[k] != null) { ok(Array.isArray(need[k]) && need[k].length && need[k].every(t => TYPEKEYS.includes(t)), P('need') + k + ' は型（' + TYPEKEYS.slice(0, 3).join('・') + '…）の配列。知らない型がある（' + JSON.stringify(need[k]) + '）'); } });
      ok(need.threadMissing == null || typeof need.threadMissing === 'boolean', P('need') + 'threadMissing は true / false');
      ok(need.threadAway == null || typeof need.threadAway === 'boolean', P('need') + 'threadAway は true / false');
      if (need.threadAway) { ok(cast.some(e => e && e.pick && e.pick.thread), P('need') + 'threadAway は pick.thread の配役が要る（旅に出ている人の糸を引く台本）'); ok(!need.threadDead && !need.threadMissing, P('need') + 'threadAway は threadDead・threadMissing と同時に使えない'); }
      if (need.threadMissing) { ok(cast.some(e => e && e.pick && e.pick.thread), P('need') + 'threadMissing は pick.thread の配役が要る（行方知れずの人の糸を引く台本）'); ok(!need.threadDead, P('need') + 'threadDead と threadMissing は同時に使えない'); }
      ok(ep.tone == null || TONES.includes(ep.tone), P('') + 'tone は normal・grave・tense のどれか（' + ep.tone + '）');
      if (need.threadDead) ok(cast.some(e => e && e.pick && e.pick.thread), P('need') + 'threadDead は pick.thread の配役が要る（亡くなった人の糸を引く台本）');
      ok(ep.span == null || (typeof ep.span === 'object' && Number.isInteger(ep.span.days) && ep.span.days >= 1 && ep.span.days <= 365), P('') + 'span は { days: 1〜365 の整数 }');
      const epTouch = listOf(ep.touch).concat(...(ep.steps || []).map(x => listOf(x && x.touch))); let usesThreadText = false, usesTouchIf = false;
      listOf(ep.touch).forEach(t => ok(TRIG_TAGS.includes(t), P('') + 'touch の tag「' + t + '」が実在しない（' + TRIG_TAGS.join('・') + '）'));
      (ep.closes || []).forEach((cl, i) => { const t = typeof cl === 'string' ? cl : cl && cl.id; ok(t, P('closes[' + i + ']') + 'id が無い'); ok(opened.has(t), P('closes') + '糸「' + t + '」を張る台本がどこにも無い'); });
      // step
      const choiceKeys = {}, doneChoices = {};
      const checkIf = (cond, where, stepIdx) => {
        if (cond == null) return [];
        const arr = Array.isArray(cond) ? cond : [cond], req = [];
        arr.forEach(raw => {
          if (typeof raw !== 'string') { E.push(P(where) + 'if が文字列でない'); return; }
          let s = raw[0] === '!' ? raw.slice(1) : raw; const neg = raw[0] === '!';
          if (s === 'touch') { usesTouchIf = true; return; }
          if (/^rand:/.test(s)) { const rm = RAND_RE.exec(s); ok(!!rm && +rm[1] >= 2 && +rm[1] <= 9 && +rm[2] < +rm[1], P(where) + 'if のくじの形が不正（' + raw + '。rand:3:0 のように、分け数（2〜9）と、その何番目か（0から分け数-1））'); return; }
          if (/^gold/.test(s)) { ok(GOLD_RE.test(s), P(where) + 'if の所持金の形が不正（' + raw + '。gold>=5 のように、>=・<=・>・< と整数）'); return; }
          if (/^hasThread:/.test(s)) { const q = s.split(':'); ok(q.length === 2 && q[1], P(where) + 'if の形が不正（' + raw + '）'); if (q[1]) { ok(opened.has(q[1]), P(where) + 'if の糸「' + q[1] + '」を張る台本がどこにも無い（' + raw + '）'); needed.add(q[1]); } return; }
          if (/^trust:/.test(s)) { const tm = TRUST_RE.exec(s); ok(!!tm, P(where) + 'if の信頼の形が不正（' + raw + '。trust:A>=30 のように、配役の key と >=・<=・>・< と整数）'); if (tm) { ok(keys[tm[1]], P(where) + 'if の配役「' + tm[1] + '」が cast に無い（' + raw + '）'); if (!neg && keys[tm[1]]) req.push(tm[1]); } return; }
          if (/^reunion:/.test(s)) { const q = s.split(':'); ok(q.length === 2 && keys[q[1]], P(where) + 'if の形が不正（' + raw + '。reunion:A のように、cast にある配役の key。最後に会ってから久しい人の文を分ける）'); return; }
          if (/^hasAny:/.test(s)) { const q = s.split(':'), ms = (q[1] || '').split(',').filter(Boolean); ok(q.length === 2 && ms.length, P(where) + 'if の形が不正（' + raw + '。hasAny:shop,home のように、印の名をコンマで並べる）'); ms.forEach(m => { if (!MARKS[m]) W.push(L + '：' + where + ' の if「' + raw + '」の印「' + m + '」は決まった印に無い'); }); if (ms.length) needMarks.push({ ep: ep.id, m: ms, any: true }); return; }
          if (/^has:/.test(s)) { const q = s.split(':'); ok(q.length === 2 && q[1], P(where) + 'if の形が不正（' + raw + '）'); if (q[1] && !MARKS[q[1]]) W.push(L + '：' + where + ' の if「' + raw + '」の印は決まった印に無い'); if (q[1]) needMarks.push({ ep: ep.id, m: q[1] }); return; }
          if (/^(skill|cheat|flag):/.test(s)) {
            const q = s.split(':'); ok(q.length === 2, P(where) + 'if の形が不正（' + raw + '）');
            if (q[0] === 'skill') ok(SK[q[1]], P(where) + "if の skill「" + q[1] + "」が実在のスキルでない（" + raw + '）');
            else if (q[0] === 'cheat') ok(SK[q[1]] && SK[q[1]].cheat === true, P(where) + "if の cheat「" + q[1] + "」は、スキルに無いか、チートの印（cheat:true）が無い（" + raw + '）');
            else ok(FLAGS.includes(q[1]), P(where) + "if の flag「" + q[1] + "」は けが・呪い・喪失 のどれか（" + raw + '）');
            return;
          }
          if (s.indexOf(':') < 0) { ok(keys[s], P(where) + 'if の配役「' + s + '」が cast に無い'); if (!neg) req.push(s); return; }
          const p = s.split(':');
          if (p[0] === 'thread') { ok(p.length === 2 && opened.has(p[1]), P(where) + 'if の糸「' + p[1] + '」を張る台本が無い'); ok(((ep.need || {}).threads || []).includes(p[1]), P(where) + 'if thread:' + p[1] + ' は need.threads にある糸だけ使える'); return; }
          ok(p.length === 2 || p.length === 3, P(where) + 'if の形が不正（' + raw + '）');
          const ch = choiceKeys[p[0]];
          if (!ch) { ok(false, P(where) + 'if の分かれ目「' + p[0] + '」が、この文より前に無い（' + raw + '）'); return; }
          if (p.length === 2) ok(p[1] === 'win' || p[1] === 'lose' || ch.includes(p[1]), P(where) + 'if の選択肢「' + p[1] + '」が分かれ目 ' + p[0] + ' に無い（' + raw + '）');
          else { ok(ch.includes(p[1]), P(where) + 'if の選択肢「' + p[1] + '」が分かれ目 ' + p[0] + ' に無い（' + raw + '）'); ok(p[2] === 'win' || p[2] === 'lose', P(where) + 'if の成否が win/lose でない（' + raw + '）'); }
        });
        return req;
      };
      const castKeyOk = (k, where) => { ok(k == null || k === 'H' || keys[k], P(where) + '配役「' + k + '」が cast に無い'); };
      const checkFx = (fx, where) => {
        if (fx == null) return; if (!Array.isArray(fx)) { E.push(P(where) + 'fx が配列でない'); return; }
        fx.forEach((f, i) => {
          const w2 = where + ' fx[' + i + ']';
          if (!Array.isArray(f)) { E.push(P(w2) + 'fx の要素が配列でない'); return; }
          const op = f[0], num = x => typeof x === 'number' && isFinite(x);
          if (op === 'stat') { ok(STATS.includes(f[1]) && num(f[2]), P(w2) + "stat は ['stat','力|技|心|名声',数]"); }
          else if (op === 'goal') { ok(num(f[1]), P(w2) + 'goal は数'); ok(f[2] == null || WISH_NAMES.includes(f[2]), P(w2) + "goal の3つ目は望みの種類（strong・help・quiet・home）。'" + f[2] + "' は不正"); }
          else if (op === 'gold' || op === 'life' || op === 'bond') ok(num(f[1]), P(w2) + op + ' は数');
          else if (op === 'set' || op === 'unset') { ok(typeof f[1] === 'string' && f[1], P(w2) + op + ' は印の名（文字列）'); if (typeof f[1] === 'string' && f[1]) { if (op === 'set') setMarks.add(f[1]); if (!MARKS[f[1]]) W.push(L + '：' + w2 + ' の印「' + f[1] + '」は決まった印（' + Object.keys(MARKS).join('・') + '）に無い'); } }
          else if (op === 'missing' || op === 'found' || op === 'away' || op === 'back') { castKeyOk(f[1], w2); ok(f[1] !== 'H' && f[1] != null, P(w2) + op + ' に主人公は使えない'); }
          else if (op === 'flag') ok(FLAGS.includes(f[1]) && typeof f[2] === 'boolean', P(w2) + "flag は ['flag','けが|呪い|喪失',true|false]");
          else if (op === 'item') {
            const s = f[1] || {};
            if (s.name != null) ok(ITEM_BYNAME[s.name], P(w2) + 'item の name「' + s.name + '」が物の表に無い');
            else { ok(s.cat && BYCAT[s.cat], P(w2) + 'item の cat「' + s.cat + '」が無い'); ok(s.tier == null || [0, 1, 2].includes(s.tier), P(w2) + 'item の tier は 0〜2'); }
            ok(f[2] == null || keys[f[2]], P(w2) + 'item の配役「' + f[2] + '」が cast に無い'); ok(f[3] == null || VIAS.includes(f[3]), P(w2) + 'item の出どころ「' + f[3] + '」が不正');
          }
          else if (op === 'lose') { const s = f[1] || {}; ok((s.name && ITEM_BYNAME[s.name]) || (s.cat && BYCAT[s.cat]), P(w2) + 'lose の指定が不正'); }
          else if (op === 'skill') { const s = f[1] || {}; ok((s.id && allSkillIds.has(s.id)) || (s.cat && SKILL_CATS.includes(s.cat)), P(w2) + 'skill の id / cat が実在しない（' + JSON.stringify(s) + '）'); ok(f[2] == null || keys[f[2]], P(w2) + 'skill の教えた人「' + f[2] + '」が cast に無い'); }
          else if (op === 'rel') { castKeyOk(f[1], w2); ok(f[1] !== 'H' && D.REL_TYPES[f[2]], P(w2) + 'rel の種類「' + f[2] + '」が不正'); ok(num(f[3]), P(w2) + 'rel の信頼の初期値が数でない'); }
          else if (op === 'trust') { castKeyOk(f[1], w2); ok(num(f[2]), P(w2) + 'trust は数'); }
          else if (op === 'death' || op === 'known') { castKeyOk(f[1], w2); ok(f[1] !== 'H', P(w2) + op + ' に主人公は使えない'); }
          else if (op === 'job') ok(typeof f[1] === 'string' && f[1], P(w2) + 'job は職の名');
          else E.push(P(w2) + 'fx の語彙にない「' + op + '」');
        });
      };
      // 文の中の {…}
      const checkText = (t, where, o) => {
        if (typeof t !== 'string' || !t.trim()) { E.push(P(where) + '文が空'); return; }
        if (/undefined|NaN/.test(t)) E.push(P(where) + '文に undefined / NaN がある');
        if (/[{}]/.test(t.replace(/\{[^{}]*\}/g, ''))) E.push(P(where) + '差し込みの { } の対応が崩れている：' + t.slice(0, 30));
        (t.match(/\{[^{}]*\}/g) || []).forEach(tok => {
          const k = tok.slice(1, -1);
          if (SYS_KEYS.includes(k)) return;
          if (k === '糸') { usesThreadText = true; return; }
          if (k === '時') { ok(o.first, P(where) + '{時} は最初の step の頭にだけ使える'); ok(t.indexOf('{時}') === 0, P(where) + '{時} は文の頭に書く'); return; }
          if (k === '私' || k === '君') { ok(o.say, P(where) + '{' + k + '} は台詞の中だけ'); return; }
          { const am = /^([A-Za-z][A-Za-z0-9_]*)(武器|戦い方)$/.exec(k); if (am && keys[am[1]]) { if (optional.has(am[1]) && !(o.req || []).includes(am[1])) E.push(P(where) + '任意の配役 {' + k + '} を使う文に if:\'' + am[1] + '\' が無い'); return; } }   // {A武器}{A戦い方}：配役 A の職から差し込む
          if (keys[k]) { if (optional.has(k) && !(o.req || []).includes(k)) E.push(P(where) + '任意の配役 {' + k + '} を使う文に if:\'' + k + '\' が無い'); return; }
          E.push(P(where) + '知らない差し込み ' + tok + '（綴りの誤り？）');
        });
      };
      const checkSay = (say, where, o) => {
        ok(say && typeof say === 'object', P(where) + 'say が無い'); if (!say) return;
        ok(say.mono == null || typeof say.mono === 'boolean', P(where) + 'say.mono は true / false');
        ok(say.to == null || (typeof say.to === 'string' && keys[say.to]), P(where) + 'say.to（聞き手）が cast に無い（' + say.to + '）');
        if (o && o.to != null) ok(typeof o.to === 'string' && keys[o.to], P(where) + 'to（聞き手）が cast に無い（' + o.to + '）');
        ok(typeof say.da === 'string' && say.da.trim() && (say.mono ? (say.desu == null || typeof say.desu === 'string') : (typeof say.desu === 'string' && say.desu.trim())), P(where) + 'say に da と desu の両方が要る（mono の独り言は da だけでよい）');
        if (say.mono) ok(!/\{君\}/.test(String(say.da) + String(say.desu || '')), P(where) + '独り言（mono）に {君} は使えない');
        checkText(say.da, where + ' say.da', Object.assign({ say: true }, o)); if (say.desu != null) checkText(say.desu, where + ' say.desu', Object.assign({ say: true }, o));
      };
      (ep.steps || []).forEach((st, si) => {
        const where = 'step[' + si + ']', first = si === 0;
        if (!st || typeof st !== 'object') { E.push(P(where) + 'step がオブジェクトでない'); return; }
        const req = checkIf(st.if, where, si), o = { first, req };
        ok(st.time == null || TIMES.includes(st.time), P(where) + 'time は day・dusk・night のどれか（' + st.time + '）');
        ok(st.tone == null || TONES.includes(st.tone), P(where) + 'tone は normal・grave・tense のどれか（' + st.tone + '）');
        if (st.say && typeof st.say === 'object') ok(st.say.tone == null || TONES.includes(st.say.tone), P(where) + 'say.tone は normal・grave・tense のどれか（' + st.say.tone + '）');
        if (st.touch != null) { ok(!!st.choice, P(where) + 'touch は分かれ目の step に書く'); ok(Array.isArray(st.touch) && st.touch.length && st.touch.every(t => TRIG_TAGS.includes(t)), P(where) + 'touch の tag が実在しない（' + JSON.stringify(st.touch) + '。使える tag：' + TRIG_TAGS.join('・') + '）'); }
        if (st.choice) {
          const ch = chOf(st), w2 = where + ' 分かれ目 ' + ch.id;
          ok(ch.id && /^c\d+$/.test(ch.id), P(where) + '分かれ目の id は c1・c2… の形'); ok(!choiceKeys[ch.id], P(w2) + 'id が重複');
          ok(typeof ch.q === 'string' && ch.q, P(w2) + 'q が無い'); if (typeof ch.q === 'string' && ch.q) checkText(ch.q, w2 + ' q', Object.assign({}, o, { first: false }));
          ok(Array.isArray(ch.opts) && ch.opts.length >= 2, P(w2) + '選択肢が2つ未満');
          const okeys = (ch.opts || []).map(x => x && x.key);
          choiceKeys[ch.id] = okeys;
          ok(new Set(okeys).size === okeys.length, P(w2) + '選択肢の key が重複');
          const inst = (ch.opts || []).filter(x => x && x.instinct);
          ok(inst.length <= 1, P(w2) + 'instinct の選択肢が' + inst.length + '個ある（1つの分かれ目に1つまで）');
          if (st.touch != null) ok(inst.length === 1, P(w2) + 'touch があるのに instinct の選択肢が無い（とっさに選ぶ道を1つ決める）'); else ok(!inst.length || listOf(ep.touch).length > 0, P(w2) + 'instinct の選択肢があるのに、この step に touch が無い');
          // 選択肢の if：条件の無い選択肢が2つ以上（条件で選択肢が1つも残らない・1つしか残らない分かれ目を作らない）
          const plain = (ch.opts || []).filter(x => x && (x.if == null || (Array.isArray(x.if) && !x.if.length) || x.if === ''));
          ok(plain.length >= 2, P(w2) + '条件（if）の無い選択肢が' + plain.length + '個しかない（2つ以上要る。条件で選択肢が残らなくなるのを防ぐ）');
          (ch.opts || []).forEach(op => {
            ok(op.instinct == null || typeof op.instinct === 'boolean', P(w2 + ' 選択肢 ' + op.key) + 'instinct は true / false');
            const w3 = w2 + ' 選択肢 ' + op.key;
            let oReq = [];
            if (op.if != null) {
              ok(!op.instinct, P(w3) + 'とっさに選ぶ道（instinct）には if を付けられない');
              const saved = choiceKeys[ch.id]; delete choiceKeys[ch.id]; oReq = checkIf(op.if, w3 + ' if', si); choiceKeys[ch.id] = saved;   // 自分の分かれ目の結果は、その選択肢の条件に使えない
            }
            const oo = oReq.length ? Object.assign({}, o, { req: (o.req || []).concat(oReq) }) : o;
            ok(op.key && !['win', 'lose'].includes(op.key) && /^[A-Za-z0-9_]+$/.test(op.key), P(w3) + 'key が不正');
            ok(typeof op.label === 'string' && op.label, P(w3) + 'label が無い');
            ok(D.AKEYS.includes(op.appr), P(w3) + 'appr が7つの向き合い方に無い（' + op.appr + '）');
            ['s1', 's2'].forEach(f => { const m = op[f]; ok(m && typeof m === 'object', P(w3) + f + ' が無い'); if (m) Object.keys(m).forEach(k => { ok((f === 's1' ? PK1 : PK2).includes(k), P(w3) + f + ' のキー「' + k + '」が実在しない'); ok(typeof m[k] === 'number', P(w3) + f + ' の値が数でない'); }); });
            if (op.say && typeof op.say === 'object') ok(op.say.tone == null || TONES.includes(op.say.tone), P(w3) + 'say.tone は normal・grave・tense のどれか（' + op.say.tone + '）');
            { const pays = [op.win, op.lose, op].some(r => r && listOf(r.fx).some(f => Array.isArray(f) && f[0] === 'gold' && f[1] < 0));
              if (pays && !listOf(op.if).some(c => typeof c === 'string' && /^gold>=/.test(c))) W.push(L + '：' + w3 + ' は金を払う（gold が負）のに、if: gold>=n が無い（払えない人にも出る）'); }
            ['win', 'lose'].forEach(f => { const r = op[f]; if (r && r.span != null) ok(typeof r.span === 'object' && Number.isInteger(r.span.days) && r.span.days >= 1 && r.span.days <= 365, P(w3) + f + '.span は { days: 1〜365 の整数 }'); });
            checkSay(op.say, w3, oo); checkText(op.label, w3 + ' label', Object.assign({}, oo, { first: false }));
            if (op.check) {
              ok(STATS.includes(op.check.stat) && typeof op.check.diff === 'number', P(w3) + 'check は { stat:力|技|心|名声, diff:数 }');
              if (op.check.skill != null) [].concat(op.check.skill).forEach(id => ok(allSkillIds.has(id), P(w3) + 'check.skill の id「' + id + '」が実在しない'));
              ok(op.lose && ([].concat(op.lose.t || []).length || (op.lose.fx || []).length), P(w3) + 'check があるのに lose が無い');
              ok(op.win, P(w3) + 'check があるのに win が無い');
            } else ok(op.win || op.t || op.fx, P(w3) + '成否の判定が無い選択肢に win（または t/fx）が無い');
            ['win', 'lose'].forEach(f => { const r = op[f]; if (!r) return; ok(r && typeof r === 'object', P(w3) + f + ' がオブジェクトでない'); ok(r.payoff == null || (typeof r.payoff === 'string' && r.payoff.trim()), P(w3) + f + '.payoff は、その道を通ったときの余韻（空でない文字列）'); [].concat(r.t || []).forEach((t, ti) => checkText(t, w3 + ' ' + f + '.t[' + ti + ']', Object.assign({}, oo, { first: false }))); checkFx(r.fx, w3 + ' ' + f); });
            if (!op.win && (op.t || op.fx)) { [].concat(op.t || []).forEach((t, ti) => checkText(t, w3 + ' t[' + ti + ']', Object.assign({}, oo, { first: false }))); checkFx(op.fx, w3); }
          });
          if (ch.opts && ch.opts.length > 4) W.push(L + '：分かれ目 ' + ch.id + ' の選択肢が多い（' + ch.opts.length + '）');
        } else {
          const sp = speechOf(st);
          if (sp) {
            ok(!sp.who || sp.who === 'H' || keys[sp.who], P(where) + '台詞の話し手「' + sp.who + '」が cast に無い');
            ok(sp.to == null || (typeof sp.to === 'string' && keys[sp.to]), P(where) + '台詞の聞き手 to「' + sp.to + '」が cast に無い');
            if (sp.who && optional.has(sp.who) && !req.includes(sp.who)) E.push(P(where) + '任意の配役 ' + sp.who + ' の台詞に if:\'' + sp.who + '\' が無い');
            ok(typeof sp.da === 'string' && sp.da.trim() && (sp.mono ? (sp.desu == null || typeof sp.desu === 'string') : (typeof sp.desu === 'string' && sp.desu.trim())), P(where) + '台詞に da と desu の両方が要る（mono の独り言は da だけでよい）');
            if (sp.mono) { ok(!sp.who || sp.who === 'H' || sp.who === '名', P(where) + '独り言（mono）は主人公だけ'); ok(!/\{君\}/.test(String(sp.da) + String(sp.desu || '')), P(where) + '独り言（mono）に {君} は使えない'); }
            if (need.threadDead && cast.some(e => e && e.key === sp.who && e.pick && e.pick.thread)) E.push(P(where) + '亡くなった人の糸を引く台本（threadDead）で、その人（' + sp.who + '）が話している');
            checkText(sp.da, where + ' da', Object.assign({ say: true }, o, { first: false })); if (sp.desu != null) checkText(sp.desu, where + ' desu', Object.assign({ say: true }, o, { first: false }));
          } else {
            const ts = Array.isArray(st.t) ? st.t : [st.t];
            ok(st.t != null, P(where) + 't（文）が無い');
            ts.forEach((t, ti) => checkText(t, where + ' t' + (ts.length > 1 ? '[' + ti + ']' : ''), o));
          }
        }
        checkFx(st.fx, where);
      });
      // 糸を張る場所（opens）：who・memo・if
      allOpens(ep).forEach(x => {
        const o = x.o, wh = x.where; ok(o && typeof o === 'object' && typeof o.id === 'string' && o.id, P(wh) + 'id が無い'); if (!o || typeof o !== 'object') return;
        ok(!o.who || keys[o.who], P(wh) + 'who が配役に無い（' + o.who + '）');
        if (o.if != null) checkIf(o.if, wh, -1);
        if (o.memo != null) {
          ok(typeof o.memo === 'string' && o.memo.trim(), P(wh) + 'memo は短い句（文字列）');
          if (typeof o.memo === 'string') {
            if (/[{}]/.test(o.memo.replace(/\{[^{}]*\}/g, ''))) E.push(P(wh) + 'memo の { } の対応が崩れている');
            (o.memo.match(/\{[^{}]*\}/g) || []).forEach(tok => { const k = tok.slice(1, -1); if (SYS_KEYS.includes(k)) return; if (keys[k]) { ok(!optional.has(k), P(wh) + 'memo に任意の配役 {' + k + '} は使えない'); return; } E.push(P(wh) + 'memo の差し込み ' + tok + ' が知らない名前（使えるのは {名}{場所}{前職}{死}{力} と配役の key）'); });
          }
        } else if (o.id) (noMemo[o.id] = noMemo[o.id] || []).push(ep.id + ' ' + wh);
      });
      // 関係を付けずに糸を張っている（エンジンが知人・信頼0を自動で付けるが、台本で rel を付けるのが望ましい）
      { const relKeys = new Set(); const walk = fx => listOf(fx).forEach(f => { if (Array.isArray(f) && f[0] === 'rel') relKeys.add(f[1]); });
        (ep.steps || []).forEach(st => { if (!st) return; walk(st.fx); if (st.choice) (chOf(st).opts || []).forEach(op => { if (!op) return; walk(op.fx); if (op.win) walk(op.win.fx); if (op.lose) walk(op.lose.fx); }); });
        const pre = new Set(cast.filter(e => e && e.pick && (e.pick.rel || e.pick.thread)).map(e => e.key)), done = new Set();
        allOpens(ep).forEach(x => { const k = x.o && x.o.who; if (k && !pre.has(k) && !relKeys.has(k) && !done.has(k + x.o.id)) { done.add(k + x.o.id); W.push(L + '：糸「' + x.o.id + '」を張る相手 ' + k + ' に、rel の fx で関係を付けていない（エンジンが知人・信頼0を自動で付ける）'); } }); }
      // {糸}：糸を引く台本（need.threads か pick.thread）だけが使える。引く糸の張り手は、全部 memo を持つこと
      const pulledIds = (() => { const e = cast.find(x => x && x.pick && x.pick.thread); return e ? [e.pick.thread] : listOf(need.threads).slice(0, 1); })();
      if (usesThreadText) { ok(pulledIds.length > 0, L + '：{糸} を使っているが、need.threads も pick.thread も無い'); pulledIds.forEach(id => { mustMemo.push({ ep: ep.id, id }); }); }
      ok(!usesTouchIf || epTouch.length > 0, L + "：if 'touch' を使っているが、step にも台本にも touch が無い");
      // 道ごとの追跡：亡くなった人が話す道・合流の要確認
      try { const an = analyzePaths(ep); an.dead.forEach(d => E.push(L + '：step[' + d.si + '] の話し手 ' + d.who + ' は、この道ではすでに亡くなっている（' + d.path + '）')); an.merge.forEach(m => merge.push(m)); } catch (e) { E.push(L + '：道の追跡で例外 ' + e.message); }
      if (ep.steps && ep.steps[0] && ep.steps[0].if) W.push(L + '：最初の step に if がある（{時} が出ないことがある）');
      if (ep.steps && ep.steps[0] && !st0hasTime(ep.steps[0])) W.push(L + '：最初の文に {時} が無い');
      if (ep.steps && !ep.steps.some(s => s.choice)) W.push(L + '：分かれ目が無い');
    });
    eps.forEach(ep => allOpens(ep).forEach(x => { const o = x.o; if (o && o.id && !needed.has(o.id)) W.push('糸「' + o.id + '」（' + ep.id + ' が張る）を引く台本が無い（need.threads に無い）'); }));
    mustMemo.forEach(m => { if (noMemo[m.id]) E.push('台本「' + m.ep + '」は {糸} を使うが、糸「' + m.id + '」を張る所に memo が無い：' + noMemo[m.id].join('、')); });
    needMarks.forEach(x => { if (x.any ? !x.m.some(m => setMarks.has(m)) : !setMarks.has(x.m)) W.push('台本「' + x.ep + '」は印「' + x.m + '」を前提にするが、どの台本も set していない'); });
    validate.warnings = W; validate.merge = merge; validate.unknownJobs = UJ;
    return E;
  }
  const st0hasTime = st => { const t = Array.isArray(st.t) ? st.t.join('') : st.t; return typeof t === 'string' && t.indexOf('{時}') === 0; };

  // ---------- 検査用（story-test.mjs が使う） ----------
  // 指定した台本の配役が成り立つように、世界に人と関係を足す
  function _prepare(w, ep) {
    const R = rngOf(w), h = hero(w), need = ep.need || {}, hasThread = (need.threads || []).length || (ep.cast || []).some(e => e.pick && e.pick.thread);
    w.turn = Math.max(w.turn, (need.minTurn || 1) - 1, ep.stage && ep.stage[0] ? [0, 4, 9][ep.stage[0]] : 0, hasThread ? 3 : 0, ep.tpl && TPLS[ep.tpl] && TPLS[ep.tpl].pos === '中盤以降' ? 4 : 0);
    // 糸の memo：その糸を張る台本の memo を、仮の値で埋めたもの
    const memoOf = id => { for (const e of epsAll()) { for (const x of allOpens(e)) if (x.o && x.o.id === id && x.o.memo != null) return fmt(x.o.memo, new Proxy({ 名: h.nick, 場所: '町', 国: 'この国', 場所の種類: '町', 前職: '旅の者', 死: '', 力: '授かった力' }, { get: (t, k) => (k in t ? t[k] : '誰か') })); } return null; };
    const mk = (types, o) => {
      const np = newNpc(w, R, 'companion', w.turn + 1, o); np.met = 1; w.people[np.id] = np;
      h.relations[np.id] = { type: types[0], trust: Math.max(60, o.minTrust || 0), since: 1, notes: [] }; np.relations[h.id] = JSON.parse(JSON.stringify(h.relations[np.id]));
      for (let i = 0; i < Math.max(3, o.minMet || 0); i++) np.life.push('x' + i);
      if (o.minAge != null && np.age < o.minAge) np.age = o.minAge; if (o.maxAge != null && np.age > o.maxAge) np.age = o.maxAge;
      const rw = romanceWin(w, ep, o); if (rw) np.age = clamp(np.age, rw[0], rw[1]);   // 恋の型：主人公に年の近い人にする
      return np;
    };
    (ep.cast || []).forEach(ent => {
      const pk = ent.pick || {};
      if (pk.rel) mk(pk.rel, pk);
      else if (pk.thread) { const np = mk(['grateful'], pk); if (need.threadDead) np.alive = false; if (need.threadMissing) np.missing = true; if (need.threadAway) np.away = true; w.threads.push({ id: pk.thread, who: np.id, turn: Math.max(0, w.turn - 3), ep: 'prep', memo: memoOf(pk.thread) }); }
    });
    (need.threads || []).forEach(t => { if (!w.threads.some(x => x.id === t && !x.closed)) w.threads.push({ id: t, who: h.id, turn: Math.max(0, w.turn - 3), ep: 'prep', memo: memoOf(t) }); });
    // 前提の印・順番（need.has／after）
    listOf(need.has).forEach(m => { if (!marksOf(w).includes(m)) marksOf(w).push(m); });
    if (listOf(need.hasAny).length && !listOf(need.hasAny).some(m => marksOf(w).includes(m))) marksOf(w).push(listOf(need.hasAny)[0]);
    if (need.after && !w.log.some(e => listOf(need.after).includes(e.type))) w.log.push({ id: 'prep', turn: 0, type: listOf(need.after)[0], lines: [], choices: [], effects: [], cast: [] });
    // 授かった力・スキル・金
    listOf(need.cheat).slice(0, 1).concat(listOf(need.skill).slice(0, 1)).forEach(id => { if (SK[id] && !h.skills.some(x => x.id === id)) h.skills.push({ id, lv: 1, turn: 0, from: 'prep' }); });
    if (need.minGold != null) h.stats.金 = Math.max(h.stats.金 || 0, need.minGold);
  }
  function _begin(w, ep, o) { return begin(w, ep, o); }

  g.Story = { markSay, MARK_SAY, candidates, newWorld, next, advance, playCard, decide, auto, person, item, save, load, validate, lineText, TYPE_NAME: t => (D.TYPES[t] || {}).name || t, _warn: warns, MARKS, _ending: (w, kind) => endingText(w, kind), _endCtx: endCtx, _foeOf: foeOf, _reconciled: reconciled, _candsFor: candsFor, _prepare, _begin, _paths: enumPaths, _feasible: feasible, _getEp: getEp, FILLER, STATS, GOAL_MUL };
})(typeof globalThis !== 'undefined' ? globalThis : window);
