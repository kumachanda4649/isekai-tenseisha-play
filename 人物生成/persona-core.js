// 人の組み立て（規則）。部品表は persona-data.js。AIは使わない。
//   Persona.make({ s1, s2, past })      → 指定した部品で1人
//   Persona.random(seed)                → 種から1人（同じ種なら同じ人）
//   Persona.prompt(person, 場面の文)    → 軽いAIに台詞を1〜2文書かせるための頼み文（AIがなければ person.scenes の定型文を使う）
(function (g) {
  const D = g.PersonaData;
  const rng = seed => { let a = (seed >>> 0) || 1; return () => { a |= 0; a = a + 0x6d2b79f5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

  // 札の効き方：気質と信条の点を足す。＋2以上＝よく効く／＋1＝効く／−1＝効きにくい／−2以下＝逆効果
  function cardEffects(s1, s2) {
    return D.CARD_NAMES.map(name => { const a = s1.cards[name], b = s2.cards[name], score = (a ? a[0] : 0) + (b ? b[0] : 0), why = [a && a[1], b && b[1]].filter(Boolean);
      return { name, score, why, label: score >= 2 ? 'よく効く' : score === 1 ? '効く' : score === 0 ? (why.length ? '打ち消し合う' : 'ふつう') : score === -1 ? '効きにくい' : '逆効果' }; });
  }

  function make(o) {
    const s1 = D.S1[o.s1], s2 = D.S2[o.s2], past = D.PAST[o.past];
    if (!s1 || !s2 || !past) throw new Error('部品が見つからない: ' + JSON.stringify(o));
    const cards = cardEffects(s1, s2);
    return {
      keys: { s1: o.s1, s2: o.s2, past: o.past },
      title: D.ARCHETYPES[o.s1 + '+' + o.s2] || s1.adj + s2.noun,                                   // 呼び名
      s1: { name: s1.n, feel: s1.feel, body: s1.body },                                             // とっさの反応
      s2: { name: s2.n, motto: s2.motto },                                                          // 考えて出す原理
      past: { event: past.n, left: past.left },                                                     // 過去と、残ったもの
      wish: past.wish, wishName: D.WISH_NAMES[past.wish], goal: past.goal,                          // 望み
      drive: past.goal + '。そのために、' + s2.way + '。',                                           // 行動原理（過去→望み、信条→やり方）
      conflict: '頭では「' + s2.motto + '」と考えるが、体は先に動く。' + s1.feel + '。うまくいかないと、' + s1.fail + '。', // 矛盾
      kuse: [s1.kuse, s2.kuse],                                                                     // 口癖（とっさに出るほう／理屈を言うときのほう）
      values: s2.values.concat(past.value),                                                         // 価値観
      trigger: past.trigger, avoid: past.avoid,                                                     // 我を忘れる引き金／避けるもの
      cards, good: cards.filter(c => c.score >= 1).sort((a, b) => b.score - a.score), bad: cards.filter(c => c.score <= -1).sort((a, b) => a.score - b.score),
      scenes: D.SITUATIONS.map((sit, i) => ({ situation: sit, first: s1.react[i], then: s2.think[i] })), // 場面ごと：とっさの声 → あとから考えること
    };
  }
  function random(seed) { const r = rng(seed); return make({ s1: pick(r, Object.keys(D.S1)), s2: pick(r, Object.keys(D.S2)), past: pick(r, Object.keys(D.PAST)) }); }

  // 軽いAIに渡す頼み文。骨組み（誰が・なぜ・どう動く）はここで決まっているので、AIの仕事は言い回しだけ。
  function prompt(p, situation, name) {
    return ['あなたはゲームの台詞を書く係です。次の人物が、次の場面で口にする台詞を、日本語で1〜2文だけ書いてください。説明や前置きは書かず、かぎかっこの中身だけを出してください。',
      '人物：' + (name || 'この人') + '（' + p.title + '）',
      'とっさの反応：' + p.s1.feel, '信条：' + p.s2.motto, '過去：' + p.past.event, '望み：' + p.goal,
      '口癖：「' + p.kuse[0] + '」「' + p.kuse[1] + '」（毎回は使わない）', '場面：' + situation,
      '書き方：前半はとっさの反応、後半は信条にもとづく判断。30〜60字。'].join('\n');
  }
  // 人物の説明（読み物）。一覧やボードで使う。
  function describe(p, name) {
    const L = [];
    L.push('### ' + (name ? name + '｜' : '') + p.title);
    L.push('部品：' + p.s1.name + ' × ' + p.s2.name + ' × ' + p.past.event);
    L.push('');
    L.push('- **とっさの反応**：' + p.s1.feel + '。' + p.s1.body + '。');
    L.push('- **信条**：' + p.s2.motto + '。');
    L.push('- **過去**：' + p.past.event + '。残ったのは、' + p.past.left + '。');
    L.push('- **望み**：' + p.goal + '。（ゲーム上の望み：' + p.wishName + '）');
    L.push('- **行動原理**：' + p.drive);
    L.push('- **矛盾**：' + p.conflict);
    L.push('- **口癖**：「' + p.kuse[0] + '」「' + p.kuse[1] + '」');
    L.push('- **価値観**：' + p.values.join('／'));
    L.push('- **我を忘れる引き金**：' + p.trigger + '。**避けるもの**：' + p.avoid + '。');
    L.push('- **効く札**：' + (p.good.map(c => c.name + '（' + c.label + '：' + c.why.join('、') + '）').join('　') || 'とくになし'));
    L.push('- **向かない札**：' + (p.bad.map(c => c.name + '（' + c.label + '：' + c.why.join('、') + '）').join('　') || 'とくになし'));
    L.push('- **場面での反応**');
    for (const s of p.scenes) L.push('  - ' + s.situation + '：「' + s.first + '」→ ' + s.then + '。');
    return L.join('\n');
  }
  // 場面キーごとの台詞。persona-lines.js（事前に作った言い回し）があればそこから、なければ部品表の3場面の文から選ぶ。
  //   場面キー：danger 危機（魔物・戦い・迷宮の危険）／gain 得た（物・金・褒美）／power 授かった力を試す・鍛える／plea 助けを求められた／meet 出会い・誘い／
  //             loss 別れ・喪失／betray 裏切り・不正を見た／calm 日常・祭り・食卓／truth 隠されていた真実を知った／contest 命のかからない勝負・駆け引き
  //   → { first: とっさの声, then: あとから考えること }
  const FALLBACK = { danger: 0, gain: 1, power: 1, plea: 2, meet: 2, loss: 0, betray: 0, calm: 1, truth: 2, contest: 0 };
  //   voice＝話し方のキー（persona-voice.js。口調の型＋一人称＋決め語尾）。依頼者の案「言い回しの型 プラス 語尾」。
  //   言い回しは1つにつき { da: 常体, desu: 敬体, act?: 行動の印 } で持ち、話し方の型がどちらかを選んでから、一人称と語尾を付け替える。
  //   me＝その人の一人称（PersonaVoice.pickMe で決めたもの。省くと型の代表の一人称）
  //   opts.act＝そのあとの向き合い方（fight/flee/talk/pay/study/pray/rely）。行動の印（act）が付いた言い回しは、印が合うときだけ選ばれる
  //     （印は '!flee'＝逃げる以外ならよい、のように否定でも書ける）。opts を省くか act を渡さないと、印のない言い回しだけから選ぶ。
  //   opts.you＝相手の呼び方（{君} に入る）
  //   opts.tone＝場面の調子（'normal' 既定／'grave' 深刻・静か／'tense' 切迫）、opts.mono＝独り言。PersonaVoice.apply の opts にそのまま渡る
  const actOk = (tag, act) => {
    if (tag == null) return true;
    if (!act) return false;
    return (Array.isArray(tag) ? tag : [tag]).some(t => t.charAt(0) === '!' ? act !== t.slice(1) : act === t);
  };
  function line(p, sit, rand, voice, me, opts) {
    const L = g.PersonaLines, V = g.PersonaVoice, r = rand || Math.random, a = L && L.S1[p.keys.s1] && L.S1[p.keys.s1][sit], b = L && L.S2[p.keys.s2] && L.S2[p.keys.s2][sit], i = FALLBACK[sit] == null ? 0 : FALLBACK[sit];
    const vv = V && voice && V.VOICES[voice], act = opts && opts.act, you = opts && opts.you;
    const base = vv ? vv.base : 'da', one = x => typeof x === 'string' ? x : (x[base] || x.da);
    // 行動の印が合い、その型が付け替えられる文だけに絞る（絞って空になったら、印の合う文、それも無ければ印のない文、全部）
    const usable = arr => {
      const okAct = arr.filter(x => actOk(x.act, act));
      const okVoice = okAct.filter(x => !(vv && vv.noImp && V.kinds(one(x), base).indexOf('imp') >= 0));
      const plain = arr.filter(x => x.act == null);
      return okVoice.length ? okVoice : okAct.length ? okAct : plain.length ? plain : arr;
    };
    const tn = opts && (opts.tone || opts.mono) ? { tone: opts.tone, mono: opts.mono } : undefined;
    const say = t => V && vv ? V.apply(t, voice, r, me, you, tn) : t.replace(/\{私\}/g, me || '自分');
    const pickOf = arr => { const u = usable(arr); return one(u[Math.floor(r() * u.length)]); };
    return { first: say(a && a.length ? pickOf(a) : D.S1[p.keys.s1].react[i]), then: say(b && b.length ? pickOf(b) : D.S2[p.keys.s2].think[i]) };
  }
  const count = () => Object.keys(D.S1).length * Object.keys(D.S2).length * Object.keys(D.PAST).length;

  g.Persona = { make, random, prompt, describe, cardEffects, count, line };
})(typeof globalThis !== 'undefined' ? globalThis : window);
