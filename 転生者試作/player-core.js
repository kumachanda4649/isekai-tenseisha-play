// 転生者試作の規則（エンジンの上にかぶせる薄い層）。DOM を使わない。Node でもブラウザでも動く。
// エンジン（../物語試作/story-core.js）と台本（../物語試作/episodes/*.js）は書き換えず、そのまま使う。
// 分かれ目で選ぶのは神ではなくプレイヤー。気質×信条×過去は「心の声」になり、選んだ道が人柄を育てる。
//   Player.newWorld(seed, 候補) / Player.choose(w, 道) / Player.pray(w, 'blessing'|'voice') / Player.custom(条件)
//   Player.save(w) / Player.load(文字列) / Player.hints(w) / Player.growth(w) / Player.profile(w) …
// 乱数は使わない（決める所はエンジンの w.rng だけ）。同じ操作なら同じ人生になる。
(function (g) {
  const Story = g.Story, D = g.StoryData, PD = g.PersonaData;
  if (!Story || !D || !PD) throw new Error('player-core.js は story-core.js のあとに読み込む');

  // ---------- 調整値 ----------
  const T = { kokoro0: 3, kokoroMax: 9, prayers0: 5, shift: 8, omakasePicks: 3, ageMin: 16, ageMax: 60 };
  const SAVE_KEY = 'tenseisha-save';
  const MALE = new Set(D.MALE_ROLES);
  const hero = w => w.people[w.heroId];
  const chOf = st => ((st.choice && typeof st.choice === 'object') ? st.choice : { id: st.choice, q: st.q, opts: st.opts });
  const sexOfLook = look => (MALE.has(look) ? '男' : '女');
  const hashStr = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // 文中の主人公の呼び名を「あなた」に置き換える（助詞が続くところだけ。1文字の名前が他の語を壊さないように）
  const toYou = (text, nick) => (nick ? String(text).replace(new RegExp(esc(nick) + '(?=[はがをにのへとももで、。])', 'g'), 'あなた') : String(text));
  const s1Name = k => (PD.S1[k] || {}).n || k;
  const s2Name = k => (PD.S2[k] || {}).n || k;

  // ---------- 心の声が隠れているか（おまかせで、まだ決まっていない間） ----------
  function hidden(w) {
    const P = w && w.player;
    if (!P || !P.omakase || P.decided) return { s1: false, s2: false, any: false };
    const f = P.omakaseFields || [];
    return { s1: f.includes('s1'), s2: f.includes('s2'), any: f.length > 0 };
  }

  // ---------- 新しい世界 ----------
  function newWorld(seed, cand, opts) {
    const w = Story.newWorld(seed, cand, opts);
    const om = cand && Array.isArray(cand.omakase) ? cand.omakase.filter(x => x === 's1' || x === 's2') : [];
    w.player = { lean1: {}, lean2: {}, kokoro: T.kokoro0, prayers: T.prayers0, picks: [], trueToSelf: 0, againstSelf: 0, held: 0, prayed: 0, s2History: [], omakase: om.length > 0,
      omakaseFields: om, decided: om.length === 0, s1Start: w.people[w.heroId].persona.s1, s2Start: w.people[w.heroId].persona.s2 };
    return w;
  }

  // ---------- 分かれ目の道を、台本のもとの形で引く（気質・信条の重みは全部ここにある） ----------
  function rawOpt(w, c, key) {
    const ep = Story._getEp(c.epId), ch = c.choice;
    if (!ep || !ep.steps) return null;
    for (const st of ep.steps) { if (!st || !st.choice) continue; const cd = chOf(st); if (cd.id === ch.id) return (cd.opts || []).find(o => o.key === key) || null; }
    return null;
  }
  function addLine(w, res, line) {
    res.lines.push(line);
    if (w.cur) w.cur.lines.push(line);
    else { const ev = w.log[w.log.length - 1]; if (ev) ev.lines.push(Object.assign({}, line)); }
  }
  function topKey(map, keep) {
    const ks = Object.keys(map).filter(k => map[k] > 0);
    if (!ks.length) return keep;
    ks.sort((a, b) => map[b] - map[a] || (a === keep ? -1 : b === keep ? 1 : 0) || (a < b ? -1 : 1));
    return ks[0];
  }

  // ---------- 選ぶ ----------
  // 押した道を確定して、エンジンの decide を呼ぶ。引き金のとき instinct 以外を押すと心を1使う（0なら断る）。
  function choose(w, key) {
    const c = w.cur, ch = c && c.choice, P = w.player;
    if (!P) return { ok: false, reason: 'この世界は転生者試作のものではない' };
    if (!ch || ch.decided) return { ok: false, reason: 'いまは分かれ目ではない' };
    const o = ch.opts.find(x => x.key === key);
    if (!o) return { ok: false, reason: 'そんな道はない' };
    const hold = !!(ch.trig && key !== ch.trig.instinct);
    if (hold && P.kokoro < 1) return { ok: false, reason: '心が足りず、踏みとどまれない（心 0）' };
    const h = hero(w), hid = hidden(w), raw = rawOpt(w, c, key);
    // 「らしさ」：いまの気質・信条の合わせ点（s1＋s2）がいちばん高い道を選べば「らしい」、いちばん低い道を選べば「らしくない」
    let like = 0;
    if (!hid.any && ch.opts.length > 1) {
      const sc = ch.opts.map(x => x.s1 + x.s2), mx = Math.max(...sc), mn = Math.min(...sc), mine = o.s1 + o.s2;
      if (mx > mn) like = mine === mx ? 1 : mine === mn ? -1 : 0;
    }
    const kokoroBefore = h.stats.心;
    if (hold) { P.kokoro -= 1; P.held += 1; }
    ch.final = key;
    const turn = c.turn, epId = c.epId, qid = ch.id;
    const res = Story.decide(w);
    if (!res || !res.ok) { if (hold) { P.kokoro += 1; P.held -= 1; } return res || { ok: false, reason: '決められなかった' }; }
    // 積み上げ
    if (raw) {
      Object.keys(raw.s1 || {}).forEach(k => { P.lean1[k] = (P.lean1[k] || 0) + raw.s1[k]; });
      Object.keys(raw.s2 || {}).forEach(k => { P.lean2[k] = (P.lean2[k] || 0) + raw.s2[k]; });
    }
    if (like > 0) P.trueToSelf += 1; else if (like < 0) P.againstSelf += 1;
    P.picks.push({ turn, ep: epId, id: qid, key, label: res.label, like, held: hold, outcome: res.outcome });
    // 能力値の「心」が台本で増えたら、踏みとどまる心もその分増える
    const gain = hero(w).stats.心 - kokoroBefore;
    if (gain > 0) P.kokoro = Math.min(T.kokoroMax, P.kokoro + gain);
    res.held = hold; res.like = like; res.changed = null; res.decidedPersona = null;
    // おまかせ：最初の3つの分かれ目で決まる
    const wasHidden = hid.any;
    if (wasHidden && P.picks.length >= T.omakasePicks) {
      const hh = hero(w), parts = [];
      if (P.omakaseFields.includes('s1')) { hh.persona.s1 = topKey(P.lean1, hh.persona.s1); parts.push(s1Name(hh.persona.s1) + '気質'); }
      if (P.omakaseFields.includes('s2')) { hh.persona.s2 = topKey(P.lean2, hh.persona.s2); parts.push((PD.S2[hh.persona.s2] || {}).noun || s2Name(hh.persona.s2)); }
      P.decided = true;
      addLine(w, res, { k: 'n', t: '◇ あなたは、' + parts.join('で、') + 'らしい', persona: true });
      res.decidedPersona = { s1: hh.persona.s1, s2: hh.persona.s2 };
    } else if (!wasHidden || P.decided) {
      // 信条が変わる：いまの信条とは別の信条の積み上げが、いまの信条より shift 以上多くなったら
      const hh = hero(w), cur = hh.persona.s2, base = P.lean2[cur] || 0;
      let best = null;
      Object.keys(P.lean2).forEach(k => { if (k !== cur && P.lean2[k] - base >= T.shift && (!best || P.lean2[k] > P.lean2[best])) best = k; });
      if (best) {
        P.s2History.push({ turn, from: cur, to: best });
        hh.persona.s2 = best;
        addLine(w, res, { k: 'n', t: '◇ 生き方が変わった：' + s2Name(cur) + ' → ' + s2Name(best), persona: true });
        res.changed = { from: cur, to: best };
      }
    }
    return res;
  }

  // ---------- 祈る ----------
  function bumpChance(ch, add) {
    ch.opts.forEach(o => {
      if (o.chance == null || !o.parts) return;
      const body = o.parts.filter(p => p.name !== '上限' && p.name !== '下限');
      let raw = body.reduce((a, p) => a + p.d, 0);
      const card = body.find(p => p.name === '札');
      if (card) card.d += add; else body.push({ name: '札', d: add });
      raw += add;
      const chance = Math.max(5, Math.min(95, raw));
      if (chance !== raw) body.push({ name: raw > chance ? '上限' : '下限', d: chance - raw });
      o.parts = body; o.chance = chance;
    });
  }
  function ensureCard(w, name) {
    const cd = D.CARDS[name];
    w.god.hand.push(name);                       // 手札の札を使わないよう、いつも1枚足す（使えば取り除かれる）
    if (w.god.power < cd.cost) w.god.power = cd.cost;   // 神力が足りないときだけ足す
  }
  function pray(w, kind) {
    const c = w.cur, ch = c && c.choice, P = w.player, h = w.people[w.heroId];
    if (!P) return { ok: false, reason: 'この世界は転生者試作のものではない' };
    if (!ch || ch.decided) return { ok: false, reason: 'いまは分かれ目ではない' };
    if (kind !== 'blessing' && kind !== 'voice') return { ok: false, reason: '祈り方が分からない' };
    if (P.prayers < 1) return { ok: false, reason: '祈りは、もう残っていない' };
    if (ch.prayed) return { ok: false, reason: 'この分かれ目では、もう祈った' };
    if (kind === 'voice') {
      const t = toYou(ch.hint || '', h.nick).trim();
      ch.voice = t || '神は何も語らず、ただ静かに、あなたを見守っている。';
      ch.prayed = 'voice'; P.prayers -= 1; P.prayed += 1;
      return { ok: true, kind, text: ch.voice };
    }
    if (ch.card) return { ok: false, reason: 'この分かれ目では、すでに加護がある' };
    const hasCheck = ch.opts.some(o => o.chance != null), bondBefore = w.people[w.heroId].stats.絆;
    // 判定のない分かれ目では、エンジンは「小さな加護」を断る（2026-11-20 物語試作のエンジン変更）。そのときは「励まし」だけを願う
    const firstCard = hasCheck ? '小さな加護' : '励まし';
    ensureCard(w, firstCard);
    const r1 = Story.playCard(w, firstCard);
    if (!r1.ok) { w.god.hand.splice(w.god.hand.lastIndexOf(firstCard), 1); return { ok: false, reason: r1.reason }; }
    const c1 = ch.cardChance, b1 = ch.bondDelta, t1 = ch.cardText, g1 = ch.guard;
    let texts = [t1], chance = c1, bond = b1;
    if (hasCheck) {
      // エンジンは1つの分かれ目に札を1枚しか使えない。「励まし」は、いったん札の記録を外して続けて使う（成功率・絆は足し合わせる）
      ch.card = null;
      ensureCard(w, '励まし');
      const r2 = Story.playCard(w, '励まし');
      if (r2.ok) { texts.push(ch.cardText); chance = c1 + ch.cardChance; bond = b1 + ch.bondDelta; }
      else { w.god.hand.splice(w.god.hand.lastIndexOf('励まし'), 1); }
      ch.card = '小さな加護'; ch.guard = g1; ch.cardChance = chance; ch.bondDelta = bond; ch.refused = false;
      bumpChance(ch, r2.ok ? c1 : 0);   // 2枚目の playCard が表を作り直したので、1枚目の分を足す
    }
    ch.cardText = '祈りが届いた。' + texts.map(x => toYou(x, h.nick)).join('');
    ch.prayed = 'blessing'; P.prayers -= 1; P.prayed += 1;
    return { ok: true, kind, text: ch.cardText, bondDelta: bond, chance, guard: !!ch.guard };
  }

  // ---------- 心の声（選択肢の印） ----------
  // 返す：{ key: { body, creed, hide } }。body＝体が先に動く（first）、creed＝あなたの信条ならこれ（then）。隠れている間は両方 false
  function hints(w) {
    const c = w.cur, ch = c && c.choice, out = {}; if (!ch) return out;
    const hid = hidden(w);
    ch.opts.forEach(o => { out[o.key] = { body: !hid.any && ch.first === o.key, creed: !hid.any && ch.then === o.key, hide: hid.any, instinct: !!(ch.trig && ch.trig.instinct === o.key) }; });
    return out;
  }
  const chanceWord = n => (n == null ? '' : n >= 70 ? 'たぶんうまくいく' : n >= 40 ? '五分五分' : '分が悪い');

  // ---------- 育っている人柄 ----------
  function growth(w) {
    const P = w.player, top = (m, nm) => Object.keys(m).filter(k => m[k] > 0).sort((a, b) => m[b] - m[a] || (a < b ? -1 : 1)).slice(0, 3).map(k => ({ key: k, name: nm(k), v: m[k] }));
    return { s1: top(P.lean1, s1Name), s2: top(P.lean2, s2Name) };
  }
  function profile(w) {
    const P = w.player, h = hero(w), p = h.persona;
    const changed = P.s2History.length > 0;
    const text2 = changed
      ? 'あなたは、' + [s2Name(P.s2History[0].from)].concat(P.s2History.map(x => s2Name(x.to))).join(' から ') + ' へ変わっていった。'
      : 'あなたは、' + s1Name(p.s1) + '気質のまま、' + s2Name(p.s2) + 'らしく生きた。';
    return { s1: p.s1, s2: p.s2, s1Name: s1Name(p.s1), s2Name: s2Name(p.s2), changed, history: P.s2History.map(x => ({ turn: x.turn, from: s2Name(x.from), to: s2Name(x.to) })), text: text2,
      rashii: P.trueToSelf, rashikunai: P.againstSelf, held: P.held, prayed: P.prayed, picks: P.picks.length, hidden: hidden(w).any };
  }

  // ---------- 自分で作る ----------
  const heroPastOk = (k, group, job) => {
    const PR = D.PAST_RULE, j = String(job || '').replace(/（.*?）/g, '');
    if (PR.group[k] && PR.group[k] !== group) return false;
    if (PR.only[k] && !PR.only[k].includes(j)) return false;
    if (PR.ban[k] && PR.ban[k].includes(j)) return false;
    return true;
  };
  // 前世の仕事の一覧（性別ごと）：[{ era, job, ar:[最小,最大], looks:[…] }]
  function jobs(sex) {
    const out = [];
    ['modern', 'past'].forEach(era => (D.HERO_LOOKS[era] || []).forEach(([look, job, ar]) => {
      if (sex && sexOfLook(look) !== sex) return;
      let e = out.find(x => x.era === era && x.job === job);
      if (!e) { e = { era, job, ar: [ar[0], ar[1]], looks: [] }; out.push(e); } else { e.ar = [Math.min(e.ar[0], ar[0]), Math.max(e.ar[1], ar[1])]; }
      e.looks.push(look);
    }));
    return out;
  }
  // 過去が選べるか：{ ok, reason }
  function pastCheck(past, era, job, age) {
    if (!PD.PAST[past]) return { ok: false, reason: 'そんな過去はない' };
    const PR = D.PAST_RULE, j = String(job || '').replace(/（.*?）/g, '');
    if (PR.group[past] && PR.group[past] !== era) return { ok: false, reason: '昔の日本の人だけが持つ過去' };
    if (PR.only[past] && !PR.only[past].includes(j)) return { ok: false, reason: PR.only[past].join('・') + 'だけが持つ過去' };
    if (PR.ban[past] && PR.ban[past].includes(j)) return { ok: false, reason: '前世の仕事（' + j + '）とは合わない' };
    const mn = D.PAST_MIN_AGE[past] || 0;
    if (age != null && age < mn) return { ok: false, reason: mn + '歳から' };
    return { ok: true, reason: '' };
  }
  function options() {
    return {
      surnames: D.SURNAMES.slice(), given: { 男: D.GIVEN['男'].slice(), 女: D.GIVEN['女'].slice() },
      s1: Object.keys(PD.S1).map(k => ({ key: k, name: PD.S1[k].n, feel: PD.S1[k].feel })), s2: Object.keys(PD.S2).map(k => ({ key: k, name: PD.S2[k].n, motto: PD.S2[k].motto })),
      pasts: Object.keys(PD.PAST).map(k => ({ key: k, name: PD.PAST[k].n || PD.PAST[k].event || k, event: PD.PAST[k].event, minAge: D.PAST_MIN_AGE[k] || 0 })),
      gifts: D.SKILLS.filter(s => s.cheat === true).map(s => ({ id: s.id, name: s.name, desc: s.desc })), age: [T.ageMin, T.ageMax],
    };
  }
  // 条件：{ surname, given, sex, age, era, job, past, s1（キーまたは 'omakase'）, s2（同）, cheat }
  // 返す：{ ok:true, cand } または { ok:false, error }。cand は Story.candidates が返す物と同じ形（omakase だけ足し）
  function custom(c) {
    c = c || {};
    const err = m => ({ ok: false, error: m });
    const given = String(c.given || '').trim(), surname = String(c.surname || '').trim();
    if (!given) return err('名前（名）を入れてください');
    if (c.sex !== '男' && c.sex !== '女') return err('性別を選んでください');
    const age = Math.floor(+c.age);
    if (!Number.isFinite(age) || age < T.ageMin || age > T.ageMax) return err('年齢は' + T.ageMin + '〜' + T.ageMax + '歳で選んでください');
    const entry = jobs(c.sex).find(x => x.era === c.era && x.job === c.job);
    if (!entry) return err('前世の仕事を選んでください（この性別・時代にその仕事はありません）');
    const pc = pastCheck(c.past, entry.era, entry.job, age);
    if (!pc.ok) return err('その過去は選べません：' + pc.reason);
    const om = [];
    let s1 = c.s1, s2 = c.s2;
    if (s1 === 'omakase' || !s1) { om.push('s1'); s1 = Object.keys(PD.S1)[hashStr(given + '|s1') % Object.keys(PD.S1).length]; }
    else if (!PD.S1[s1]) return err('気質を選んでください');
    if (s2 === 'omakase' || !s2) { om.push('s2'); s2 = Object.keys(PD.S2)[hashStr(given + '|s2') % Object.keys(PD.S2).length]; }
    else if (!PD.S2[s2]) return err('信条を選んでください');
    const gift = D.SKILLS.find(s => s.id === c.cheat && s.cheat === true);
    if (!gift) return err('授かった力を選んでください');
    const look = entry.looks[hashStr(surname + given + entry.job) % entry.looks.length];   // 前世の仕事と性別から見た目の役柄を決める
    const cand = { name: (surname ? surname + ' ' : '') + given, nick: given, sex: c.sex, age, prevJob: entry.job, look, era: entry.era, persona: { s1, s2, past: c.past }, cheat: gift.id, custom: true };
    if (om.length) cand.omakase = om;
    return { ok: true, cand };
  }

  // ---------- 保存・読み込み ----------
  const save = w => Story.save(w);
  function load(s) {
    const w = Story.load(s);
    if (!w.player) throw new Error('この保存データは物語試作のものです。転生者試作では読み込めません。新しい人生を始めてください。');
    if (w.town) throw new Error('この保存データは「ゆっくり続ける版」のものです。「物語だけを読む（最初の版）」では読み込めません。');
    return w;
  }

  g.Player = { T, SAVE_KEY, newWorld, choose, pray, custom, jobs, pastCheck, options, hints, chanceWord, growth, profile, hidden, save, load, toYou, s1Name, s2Name, _heroPastOk: heroPastOk };
})(typeof globalThis !== 'undefined' ? globalThis : window);
