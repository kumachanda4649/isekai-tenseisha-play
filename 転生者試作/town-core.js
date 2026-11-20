// 転生者試作・ゆっくり続ける版の規則（自由な時間・時間・会話・噂と依頼・小さな場面）。DOM を使わない。Node でもブラウザでも動く。
// 物語試作のエンジン（story-core.js）と player-core.js は書き換えず、上にかぶせる。エピソードの中は、エンジンがそのまま演じる。
//   Town.newWorld(seed, 候補) / Town.start(w) / Town.mode(w) / Town.view(w)
//   Town.act(w, 'rest'|'shop'|'train'|'rumor'|'pray'|'travel'|'talk', 引数) / Town.goRumor / Town.passRumor / Town.takeQuest
//   Town.advance(w) / Town.choose(w, 道) / Town.pray(w, 祈り方)（エピソードの中）  Town.leaveWrap(w)
//   Town.talkReply(w, 番号) / Town.talkEnd(w) / Town.buy / Town.sell / Town.leaveShop
//   Town.wish(w, 'end'|'go') / Town.retire(w) / Town.save(w) / Town.load(文字列) / Town.recap(w)
// 乱数は w.town.rng（会話・噂・小さな場面）とエンジンの w.rng だけ。同じ操作なら同じ人生になる。Math.random は使わない。
// 台本の拡張：
//   globalThis.MomentEpisodes（moments\*.js が push する）＝小さな場面。エピソードの台本の形に kind:'moment'・on・repeat を足したもの
//   globalThis.TalkLines（talks\*.js が push する）＝会話。{ id, who:{s1,s2,past,rel}, trust:[下,上], time?, place?, lines, reply, confide }
(function (g) {
  'use strict';
  const Story = g.Story, Player = g.Player, D = g.StoryData, PD = g.PersonaData, V = g.PersonaVoice, IT = g.LifeItems;
  if (!Story || !Player || !D || !IT) throw new Error('town-core.js は story-core.js と player-core.js のあとに読み込む');
  g.MomentEpisodes = g.MomentEpisodes || []; g.TalkLines = g.TalkLines || [];

  // ---------- 調整値 ----------
  const VER = 3;                         // ゆっくり続ける版の保存の版（版2＝抽象的な場所の版。版3＝世界の場所をつないだ版。最初の版の保存には w.town が無い）
  const SAVE_KEY2 = 'tenseisha-save-3';
  const SLOT_NAME = ['朝', '昼', '夕方', '夜'], SLOT_ENG = ['day', 'day', 'dusk', 'night'];
  const TN = { retireDays: 360, innCost: 2, maxRumors: 3, rumorLife: 7, passedLife: 3, maxBoard: 3, boardEvery: 3, healNights: 3, healNatural: 14, momentGap: 30, momentMinActions: 3,
    maxReach: 5, diaryMax: 400, shopSize: 8, kokoroRest: 2, listenChance: 0.45, talkIdleLine: 'とりとめのない話をした。', confideChance: 0.7 };
  // 小さな場面が起きる割合：直前の小さな場面から行動 momentMinActions 回以上あいて、その日にまだ起きていないときだけ振る（行動の3〜4回に1回・1日に多くて1回）
  const MOMENT_P = { rest: 0.55, shop: 0.5, train: 0.5, rumor: 0.5, pray: 0.55, travel: 0.8, talk: 0.4 };
  // 会話の「出会ってからの日数」「同じエピソード＋会話の回数」の既定（信頼の段階 1〜4 の順）
  const TALK_SINCE = [0, 7, 20, 45], TALK_MET = [0, 2, 4, 6];
  const WORK = { gold: [2, 3], slots: 2 };
  const TALK_TYPES = ['companion', 'lover', 'acquaintance', 'mentor', 'patron', 'grateful'];
  const HUB_NAME = { village: '村', town: '町', seaport: '港町', camp: '野外', home: '住まい' };   // 場所の分類（いる場所の種類）。具体的な場所の名前は世界のデータから
  const SETTLE = ['village', 'town', 'seaport'];
  const HUB_BG = { village: 'village', town: 'town', seaport: 'town', camp: 'inn', home: 'inn' };
  const PLACE_SET = {
    village: ['village', 'field', 'flower', 'lake', 'plains', 'hill'], town: ['town', 'tavern', 'castle', 'temple', 'bridge', 'throne'],
    seaport: ['seaport', 'town', 'tavern', 'temple', 'bridge'], home: ['home', 'tavern', 'village', 'town', 'field'], camp: ['camp', 'road', 'plains', 'forest', 'hill', 'mountain', 'lake', 'bridge', 'field'],
    travel: ['road', 'camp', 'plains', 'forest', 'hill', 'mountain', 'lake', 'bridge'] };
  const QUEST_TYPE = { first_battle: 6, dungeon: 14, boss: 22, rescue: 10, tournament: 12 };   // 依頼になる危機の型 → 報酬の目安
  const TYPE_RUMOR = {
    arrival: ['{場所}の先の道で、行き倒れかけた旅人が見つかったらしい。', '見慣れない身なりの者が、この辺りをさまよっているという。'],
    first_cheat: ['妙な力を使う者がいるという話が、{場所}に流れている。', '「あいつ、ふつうじゃない」と、人々が噂している。'],
    first_battle: ['街道に魔物が出て、旅人が足止めされているらしい。', '{場所}の外れで、獣の群れが見られたという。'],
    dungeon: ['古い迷宮の入口が、また開いたらしい。腕に覚えのある者が集まっている。', '迷宮の奥から、戻らない者が出ているという話だ。'],
    boss: ['この辺りを荒らす強い魔物がいる。討伐の声が上がっている。', '山のほうで、恐ろしい咆哮を聞いた者がいるらしい。'],
    tournament: ['近く、腕試しの催しがあるらしい。参加者を募っている。', '力自慢が集まる試験があると、掲示に出ていた。'],
    rescue: ['人が戻らず、探している家があるらしい。', '助けを求める声が、{場所}の外れから届いたという。'],
    noble_conflict: ['お偉方の揉めごとが、こちらにも飛び火しそうだという。', '領主の使いが、何かを探して回っているらしい。'],
    betrayal_revenge: ['誰かが裏で糸を引いている、という話が耳に入った。', '「あいつは信用ならない」と、声をひそめる者がいた。'],
    guild_register: ['冒険者の組合で、新しい登録を受け付けているらしい。', '身分を証す札があれば、仕事が回してもらえるという。'],
    companion_join: ['腕の立つ者が、組む相手を探しているらしい。', '一人旅に疲れた様子の者が、{場所}にいるという。'],
    growth: ['人里離れた場所に、鍛錬にうってつけの場があるらしい。', '腕を磨ける機会があると、人づてに聞いた。'],
    development: ['{場所}で、ひと儲けできそうな話が出ているらしい。', '商いを広げたい者が、手伝いを探している。'],
    daily_life: ['{場所}で、ちょっとした頼みごとがあるらしい。', 'たいした話ではないが、人手が欲しいと聞いた。'],
    festival: ['近く、祭りがあるらしい。準備に人が足りないという。', '{場所}の広場で、にぎやかな支度が始まっている。'],
    romance: ['気になる人がいる、という話をちらりと耳にした。', '水辺のほうで、人目を避けて会う影があるらしい。'],
    loss: ['誰かの具合が、よくないらしい。', '知っている名前が出た。胸の奥がざわつく話だった。'],
    reveal: ['あの人について、聞き捨てならない話があるという。', '隠されていたことが、明るみに出るかもしれない。'] };
  // 行動の結果の文：場所ごと（village 村／town 町／seaport 港町／home 拠点＝住まい／camp 野営地）。無い場所は town のものを使う
  const FLAVOR = {
    rest: {
      village: ['藁を敷いた寝床で、朝まで眠った。', '遠くで犬が鳴くのを聞きながら、いつのまにか眠っていた。', '毛布にくるまって、深く眠った。夢は見なかった。'],
      town: ['宿の硬い寝台で、朝まで眠った。', '窓の外の物音を聞きながら、いつのまにか眠っていた。', '階下の酒場のざわめきが静まるころ、眠りに落ちた。'],
      seaport: ['潮騒を聞きながら、宿の寝台で眠った。', '船の鐘の音を遠くに聞いて、いつのまにか眠っていた。', '潮の匂いのする毛布にくるまって、朝まで眠った。'],
      home: ['住み慣れた寝床で、ぐっすり眠った。', '自分の部屋の匂いに包まれて、朝まで眠った。', '戸締まりを確かめて横になると、すぐに眠りが来た。'],
      camp: ['焚き火のそばで、外套にくるまって眠った。', '火の番を考えながら浅く眠り、朝を迎えた。', '星を見上げているうちに、いつのまにか眠っていた。'] },
    shop: {
      village: ['行商の荷を、ひと通りのぞいた。', '雑貨屋の主人と世間話をしながら、棚を眺めた。'],
      town: ['店先をひと回りして、品物の値段を頭に入れた。', '店主と世間話をしながら、棚を眺めた。'],
      seaport: ['異国の品が並ぶ店先を、ひと回りした。', '船荷の木箱が積まれた店の奥まで、のぞいてみた。'],
      home: ['近所の店で、日用品を見て回った。'], camp: ['荷物を広げて、持ち物を数え直した。'] },
    train: {
      village: ['畑の脇の空き地で、同じ動きを繰り返した。体が少しずつ覚えていく気がした。', '汗をぬぐって空を見上げると、雲がゆっくり流れていた。'],
      town: ['裏通りの空き地で、同じ動きを繰り返した。体が少しずつ覚えていく気がした。', '汗をぬぐって空を見上げると、屋根の上を雲が流れていた。'],
      seaport: ['桟橋の端で、潮風を受けながら体を動かした。', '波止場の石畳で、同じ動きを繰り返した。'],
      home: ['庭先で、同じ動きを繰り返した。', '家の裏手で、汗が出るまで体を動かした。'],
      camp: ['野営地の脇で、枯れ枝を相手に体を動かした。', '汗をぬぐって空を見上げると、雲がゆっくり流れていた。'] },
    rumor: {
      village: ['井戸端の話は、三軒隣の猫のことで持ちきりだった。', '畑仕事の合間の立ち話は、天気と収穫の話ばかりだった。'],
      town: ['酒場の隅で耳をそばだてたが、聞こえたのは天気の話ばかりだった。', '市場の人だかりに混じってみたが、値段の話しか聞こえなかった。'],
      seaport: ['桟橋の男たちの話は、魚の値と風向きのことばかりだった。', '船乗りたちの噂話は、聞き覚えのある与太話ばかりだった。'],
      home: ['近所の立ち話に耳を傾けたが、世間話ばかりだった。'],
      camp: ['通りがかりの旅人は、道のぬかるみの愚痴をこぼしただけだった。', '焚き火を囲んだ旅人たちの話は、故郷の自慢話ばかりだった。'] },
    pray: {
      village: ['小さな祠の前で手を合わせた。何も起きなかったが、心は少し軽くなった。', '畦道で目を閉じて、息を整えた。どこかで鳥が鳴いた。'],
      town: ['静かに手を合わせた。何も起きなかったが、心は少し軽くなった。', '神殿の隅で、目を閉じて息を整えた。どこかで鐘が鳴った。'],
      seaport: ['海のほうを向いて手を合わせた。波の音が、静かに続いていた。', '目を閉じて、息を整えた。かもめの声が遠くに聞こえた。'],
      home: ['部屋の隅で、静かに手を合わせた。', '窓辺で目を閉じて、息を整えた。'],
      camp: ['焚き火のそばで手を合わせた。火の爆ぜる音だけが返ってきた。', '星空の下で目を閉じて、息を整えた。'] },
    travel: {
      village: ['道すがら、これといった出来事はなかった。'], town: ['道すがら、これといった出来事はなかった。'], seaport: ['道すがら、これといった出来事はなかった。'], home: ['道すがら、これといった出来事はなかった。'],
      camp: ['足を動かしているうちに、景色がゆっくり変わっていった。'] },
    work: {
      village: ['農家の手伝いで、荷車の藁を積み下ろした。', '畑の石拾いを手伝って、日当をもらった。'],
      town: ['市場の荷運びを手伝って、日当をもらった。', '店先の掃除と荷の整理を手伝って、日当をもらった。', '宿の水汲みと薪割りを手伝って、日当をもらった。'],
      seaport: ['桟橋で荷の積み下ろしを手伝って、日当をもらった。', '干物の仕分けを手伝って、日当をもらった。'],
      home: [], camp: [] } };
  const flavorOf = (kind, place, R) => { const t = FLAVOR[kind] || {}, a = t[place] && t[place].length ? t[place] : (t.town || ['時間が過ぎた。']); return a[Math.floor(R() * a.length)]; };
  // 小さな場面が起きなかったときの短い1文：場所×時間帯（0朝 1昼 2夕方 3夜）
  const NOQ = {
    village: [['朝の畑に、霧が薄く残っているだけだった。', '鶏の声のほかは、何事もない朝だった。', '何事もなく、朝が過ぎた。'], ['昼の日差しの下、村は静かだった。', '何事もなく、昼が過ぎていった。', '遠くで牛の鳴く声がしただけだった。'], ['夕焼けの畦道を、人々が家路についていった。', '何事もなく、夕方になった。', '炊ぎの煙が、あちこちの屋根から立ちのぼっていた。'], ['虫の音のほかは、何も聞こえない夜だった。', '何事もなく、夜が更けた。', '月明かりの村は、ひっそりと静まっていた。']],
    town: [['朝の通りに、店を開ける音が響いていた。', '何事もなく、朝が過ぎた。', 'パン屋の前に並ぶ人々を眺めただけで、朝が過ぎた。'], ['昼の町は人通りが多く、何事もなく過ぎていった。', '市場のにぎわいを聞き流しているうちに、昼が過ぎた。', '何事もなく、昼が過ぎていった。'], ['夕方の通りは、仕事帰りの人で混み合っていた。', '何事もなく、夕方になった。', '家路を急ぐ人々の足音の中で、日が傾いた。'], ['酒場の灯りが、夜の通りをぼんやり照らしていた。', '何事もなく、夜が更けた。', '見回りの足音が遠ざかっていっただけの夜だった。']],
    seaport: [['朝の港に、漁船が次々と戻ってきていた。', '何事もなく、朝が過ぎた。', '潮の匂いの朝は、何事もなく過ぎた。'], ['昼の波止場は、荷役の掛け声でにぎわっていた。', '何事もなく、昼が過ぎていった。', 'かもめが帆柱の上を回っているうちに、昼が過ぎた。'], ['夕焼けに染まる海を、しばらく眺めた。', '何事もなく、夕方になった。', '船の灯がともり始めるのを見ているうちに、日が暮れた。'], ['波の音だけが続く夜だった。', '何事もなく、夜が更けた。', '桟橋の灯が、暗い水面に揺れていた。']],
    home: [['朝の光が、窓から静かに差し込んでいた。', '何事もなく、朝が過ぎた。', '家の中の朝は、何事もなく過ぎた。'], ['昼の家は静かで、何事もなく過ぎていった。', '何事もなく、昼が過ぎていった。', '窓の外の日差しを眺めているうちに、昼が過ぎた。'], ['夕方の光が、部屋の隅まで伸びてきた。', '何事もなく、夕方になった。', '夕飯の支度の匂いがして、一日が傾いた。'], ['灯りを落とした家は、静かだった。', '何事もなく、夜が更けた。', '戸の隙間から、夜風が入ってくるだけの夜だった。']],
    camp: [['朝露に濡れた草の匂いがしていた。', '何事もなく、朝が過ぎた。', '鳥の声のほかは、何も聞こえない朝だった。'], ['昼の街道は、旅人もまばらで静かだった。', '何事もなく、昼が過ぎていった。', '風が草を鳴らす音だけが続いていた。'], ['日が傾き、長い影が草原に伸びていった。', '何事もなく、夕方になった。', '野営の支度をしているうちに、夕暮れが来た。'], ['焚き火の爆ぜる音のほかは、何事もない夜だった。', '何事もなく、夜が更けた。', '星が瞬くのを眺めているうちに、夜が更けていった。']] };
  const SHOP_CATS = {
    village: { cats: ['回復薬・ポーション', '料理・食材', '収納・生活魔道具', '素材・ドロップ品'], tier: 0 },
    town: { cats: ['回復薬・ポーション', '状態異常回復', '剣', 'その他の武器', '防具', 'アクセサリー', '杖・魔導具', '鑑定・探索・情報', '料理・食材', '移動・脱出・転移', '収納・生活魔道具'], tier: 1 },
    seaport: { cats: ['移動・脱出・転移', '料理・食材', '素材・ドロップ品', 'アクセサリー', '鑑定・探索・情報', '回復薬・ポーション'], tier: 1 } };
  const UNSELLABLE = new Set(['貴重品・鍵・イベント']);

  // ---------- 小さな道具 ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hashStr = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const localRng = seed => { let a = seed | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const hero = w => w.people[w.heroId];
  const TW = w => w.town;
  const CK = w => w.player.clock;
  const listOf = x => (x == null ? [] : [].concat(x));
  const pickFrom = (R, a) => a[Math.floor(R() * a.length)];
  function trng(w) { const T = w.town; return function () { let a = (T.rng | 0); a = (a + 0x6d2b79f5) | 0; T.rng = a; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function wpick(R, arr, wf) {
    let tot = 0; const ws = arr.map(x => { const v = Math.max(0, wf(x)); tot += v; return v; });
    if (tot <= 0) return arr[Math.floor(R() * arr.length)];
    let r = R() * tot; for (let i = 0; i < arr.length; i++) { r -= ws[i]; if (r < 0) return arr[i]; } return arr[arr.length - 1];
  }
  function fmt(s, m) { return String(s).replace(/\{([^}]+)\}/g, (all, k) => (k === '私' || k === '君') ? all : (m[k] != null ? m[k] : all)); }
  const placeName = k => D.PLACE_NAME[k] || HUB_NAME[k] || k;
  const stageOfTrust = t => (t < 20 ? 0 : t < 40 ? 1 : t < 60 ? 2 : 3);
  const personAny = (w, id) => (w.people && w.people[id]) || null;
  // 小さな場面の置き場は2つ読む：MomentEpisodes（設計書の名前）と StoryMoments（書き手 Opus の第1集が使っている名前）
  const momentList = () => (g.MomentEpisodes || []).concat(g.StoryMoments || []);
  const moments = () => momentList().filter(m => m && m.id);
  const momentById = id => momentList().find(m => m && m.id === id) || null;
  const talks = () => (g.TalkLines || []).filter(t => t && t.id);
  const epsAll = () => (g.StoryEpisodes || []).filter(e => e && e.id && e.kind !== 'moment' && !momentById(e.id));
  const marks = w => (w.marks || (w.marks = []));
  const SK = {}; D.SKILLS.forEach(s => { SK[s.id] = s; });
  const statWord = { 力: '力', 技: '技', 心: '心' };

  // ---------- 世界（場所・道・施設）：物語試作の world\（StoryWorld）をそのまま使う ----------
  // いる場所は w.town.loc（世界の場所のID）。T.afield＝その場所のそばの野外にいる（町の外・遺跡の近くなど）。T.place は「場所の分類」（village・town・seaport・camp）で、行動の文や店の品揃えを決める。T.base＝最後にいた人里のID。
  const SW = g.StoryWorld;
  if (!SW) throw new Error('town-core.js は世界のデータ（物語試作の world の world-data.js・story-world.js）を読み込んだあとに読み込む');
  const WB = SW.byId;
  const HUB_OF_KIND = { village: 'village', hamlet: 'village', large_village: 'village', frontier: 'village', beast_village: 'village', elf_village: 'village', port: 'seaport',
    town: 'town', city: 'town', metropolis: 'town', arena_town: 'town', mining_town: 'town', fortress_town: 'town', pilgrim_town: 'town', capital: 'town', tree_city: 'town', demon_city: 'town', underground_city: 'town', monastery: 'town' };
  const KIND_JA = { village: '村', hamlet: '集落', large_village: '大きな村', frontier: '開拓村', beast_village: '獣人の里', elf_village: 'エルフの里', port: '港町', town: '町', city: '宿場町', metropolis: '学都', arena_town: '闘技の町', mining_town: '鉱山町',
    fortress_town: '城塞都市', pilgrim_town: '門前町', capital: '都', tree_city: '樹上都市', demon_city: '魔族の町', underground_city: '地下都市', monastery: '修道院', demon_castle: '魔王城', dungeon: '迷宮', arena_dungeon: '闘技迷宮', ruins: '遺跡',
    teleport_gate: '転移門', grave: '墓所', catacomb: '地下墓所', abandoned_mine: '廃坑', dragon_lair: '竜の巣', sealed_door: '封印の扉', altar: '祭壇', cursed_forest: '呪われた森', world_tree: '世界樹', sunken_city: '沈んだ港', battlefield: '古戦場',
    sacred_site: '聖地', pirate_quarter: '海賊通り', noble_district: '貴族街', slum: 'スラム', arena: '闘技場', black_market: '闇市', slave_market: '奴隷市場', red_light: '歓楽街', execution: '処刑場', summon_altar: '召喚の祭壇', inquisition: '異端審問所', cathedral: '大聖堂' };
  const RE_SHOP = /市場|道具屋|武器屋|防具屋|薬屋|魔道具店|鍛冶|商人ギルド|取引所|エルフの市|魔族の市場|弓の工房|土産物屋|商館/, RE_INN = /宿/, RE_TAVERN = /酒場/, RE_GUILD = /冒険者ギルド/, RE_WELL = /井戸/, RE_ORG = /ギルド|騎士団|兵団|組合|漁協|詰所|氏族|評議|学校|神殿|修道院|礼拝堂/;
  const offOf = w => w.contentOff || [];
  const INSIDE_G = ['tavern', 'temple', 'castle', 'throne'];   // 「〇〇の酒場」「〇〇の神殿」は、その人里の中の場所（「〇〇近くの街道」は、人里の外）
  const isHab = p => !!p && !p.parent && !!HUB_OF_KIND[p.kind];
  const habOf = id => { const p = WB[id]; if (!p) return null; if (p.parent) return isHab(WB[p.parent]) ? p.parent : null; return isHab(p) ? p.id : null; };
  const ADJ = {}; SW.data.conns.forEach(([a, b, kind, days]) => { (ADJ[a] = ADJ[a] || []).push([b, +days || 1, kind]); (ADJ[b] = ADJ[b] || []).push([a, +days || 1, kind]); });
  const COMP = {}; { let n = 0; Object.keys(WB).forEach(id => { if (COMP[id] != null) return; n++; const q = [id]; COMP[id] = n; while (q.length) { const c = q.pop(); (ADJ[c] || []).forEach(([m]) => { if (COMP[m] == null) { COMP[m] = n; q.push(m); } }); } }); }
  const habList = off => SW.data.places.filter(p => isHab(p) && SW.visible(p, off));
  function nearestHab(id, off, hubs) {
    let best = null, bd = 1e9; habList(off).forEach(p => { if (COMP[p.id] !== COMP[id] || (hubs && !hubs.includes(HUB_OF_KIND[p.kind]))) return; const d = SW.dist(id, p.id); if (d < bd) { bd = d; best = p.id; } });
    return best;
  }
  const hubOfLoc = (id, afield) => { if (afield) return 'camp'; const h = habOf(id); return h ? HUB_OF_KIND[WB[h].kind] : 'camp'; };
  const facOf = (id, off) => (WB[id] ? SW.facilities(id, off) : []);
  function hasFac(w, re) { const T = TW(w); return !T.afield && facOf(T.loc, offOf(w)).some(f => re.test(f)); }
  const locName = w => { const p = WB[TW(w).loc]; return p ? p.name : ''; };
  const locLabel = w => { const T = TW(w), p = WB[T.loc]; if (!p) return ''; return T.afield && isHab(p) ? p.name + '近くの野外' : p.name; };
  const homeHab = w => { if (!marks(w).includes('home')) return null; const id = w.homeLoc; if (!id) return null; return habOf(id) || nearestHab(id, offOf(w)); };
  const atHome = w => { const T = TW(w); return !T.afield && !!T.loc && homeHab(w) === T.loc; };
  const placeKey = w => (atHome(w) ? 'home' : TW(w).place);   // 行動の文・会話・小さな場面の「場所」の条件（住まいにいるときは home）
  // いる場所を変える。id が区画（貴族街など）なら、その町の中にいることにする
  function setLoc(w, id, afield) {
    const T = TW(w), h = habOf(id);
    if (WB[id] && WB[id].parent && h) id = h;
    if (afield == null) afield = false;
    if (!afield && !h) afield = true;   // 人里でない場所（迷宮・森・遺跡など）の「中」にはいられない：そのそばの野外にいることにする
    T.loc = id; T.afield = !!afield; T.place = hubOfLoc(id, T.afield);
    if (!T.afield && h) { T.base = h; visit(w, T.place); }
    T.seen[id] = (T.seen[id] || 0) + 1;
    w.loc = id; if (!w.path) w.path = []; if (w.path[w.path.length - 1] !== id) w.path.push(id);
  }
  // 行き先：いまの場所から道でつながった人里。野外にいるときは、そばの人里（1日）とその隣。住まいは遠くても帰れる
  function destinations(w) {
    const T = TW(w), off = offOf(w), out = [], cur = WB[T.loc], hh = homeHab(w);
    const add = (id, days, home) => {
      const p = WB[id]; if (!p || !isHab(p) || !SW.visible(p, off) || COMP[id] !== COMP[T.loc]) return;
      if (id === T.loc && !T.afield) return;
      const ex = out.find(o => o.to === id); if (ex) { if (home) ex.home = true; return; }
      out.push({ to: id, name: p.name, nation: SW.nationName(p), kind: p.kind, kindName: KIND_JA[p.kind] || '', days: Math.round(days * 10) / 10, home: !!home, x: p.x, y: p.y });
    };
    if (T.afield) { if (isHab(cur)) { add(cur.id, 1); (ADJ[cur.id] || []).forEach(([n, d]) => add(n, d + 1)); } else (ADJ[cur.id] || []).forEach(([n, d]) => add(n, d)); }
    else (ADJ[cur.id] || []).forEach(([n, d]) => add(n, d));
    if (!out.length) { const n = nearestHab(T.loc, off); if (n) add(n, Math.max(1, SW.dist(T.loc, n))); }
    if (hh && !(hh === T.loc && !T.afield)) add(hh, hh === T.loc ? 1 : Math.max(1, SW.dist(T.loc, hh)), true);
    out.forEach(o => { if (o.to === hh) o.home = true; });
    return out;
  }
  // 台本の place の組から、場所を1つ選ぶ（物語試作の SW.choose：近い所・その型が起きやすい所＝hooks・まだ行っていない所が選ばれやすい）。遠すぎる所・道でつながらない所は選ばない
  function pickLoc(w, ep, R) {
    const T = TW(w), o = { gens: listOf(ep.place).length ? listOf(ep.place) : ['village'], type: ep.type, from: T.loc, home: marks(w).includes('home') ? homeHab(w) : null, visits: T.seen, off: offOf(w) };
    let anyComp = null;
    for (let i = 0; i < 8; i++) {
      const r = SW.choose(R, o); if (!r) return null;
      if (COMP[r.loc.id] !== COMP[T.loc]) continue;
      if (SW.dist(T.loc, r.loc.id) <= TN.maxReach) return r;
      anyComp = anyComp || r;
    }
    return anyComp;
  }
  // 小さな場面・旅の道中の場所の記述
  function momentLoc(w, gkey, travel) {
    const T = TW(w), p = WB[T.loc];
    if (travel && travel.from && WB[travel.from] && travel.to === T.loc) return SW.desc(p, 'road', travel.from === T.loc ? p.name + '近くの街道' : WB[travel.from].name + 'と' + p.name + 'をつなぐ道', true);
    if (T.afield) return SW.desc(p, gkey, isHab(p) ? p.name + '近くの' + (SW.NAME[gkey] || '野外') : p.name, isHab(p));
    return SW.desc(p, gkey, p.name, false);
  }
  // 場所の説明（地図で場所を押したとき）
  function placeInfo(w, id) {
    const T = TW(w), off = offOf(w), p = WB[id]; if (!p || !SW.visible(p, off)) return null;
    const fac = SW.facilities(id, off), tags = SW.tags(id, off), dest = destinations(w).find(d => d.to === id) || null;
    const rumors = T.rumors.filter(r => r.loc && r.loc.id === id).map(r => ({ id: r.id, text: r.text, name: r.loc.name })).concat(T.board.filter(q => q.loc && q.loc.id === id).map(q => ({ id: q.id, text: q.text, name: q.loc.name, quest: true })));
    return { id, name: p.name, nation: SW.nationName(p), kind: p.kind, kindName: KIND_JA[p.kind] || p.kind, facilities: fac, orgs: fac.filter(f => RE_ORG.test(f)), tags, here: id === T.loc, afieldHere: id === T.loc && T.afield, seen: !!T.seen[id], home: homeHab(w) === id, canGo: !!dest, days: dest ? dest.days : null, rumors };
  }
  function mapView(w) {
    const T = TW(w), off = offOf(w), meta = SW.data.meta, dests = destinations(w);
    const rl = {}; T.rumors.concat(T.board).forEach(r => { if (r.loc && WB[r.loc.id]) rl[r.loc.id] = (rl[r.loc.id] || 0) + 1; });
    const pt = id => { const p = WB[id]; return { id, name: p.name, x: p.x, y: p.y, kind: p.kind, kindName: KIND_JA[p.kind] || p.kind, nation: SW.nationName(p) }; };
    const seen = Object.keys(T.seen).filter(id => WB[id] && SW.visible(WB[id], off)).map(pt);
    return { W: meta.W, H: meta.H, here: Object.assign(pt(T.loc), { afield: T.afield, label: locLabel(w) }), seen, rumors: Object.keys(rl).filter(id => SW.visible(WB[id], off)).map(id => Object.assign(pt(id), { n: rl[id] })), dests: dests.map(d => Object.assign(pt(d.to), { days: d.days, home: d.home })),
      places: SW.data.places.filter(p => !p.parent && SW.visible(p, off)).map(p => ({ id: p.id, name: p.name, x: p.x, y: p.y, kind: p.kind, hab: isHab(p) })), path: (w.path || []).filter(id => WB[id]) };
  }

  // ---------- 暦 ----------
  const seasonOfMonth = mon => D.SEASONS[Math.floor(((mon + 9) % 12) / 3)];
  function calendar(w, day) {
    const c = CK(w), Dd = c.d0 + (day == null ? c.day : day), mon = Math.floor(Dd / 30) % 12 + 1, dom = Dd % 30 + 1;
    return { year: Math.floor((day == null ? c.day : day) / 360) + 1, mon, dom, season: seasonOfMonth(mon) };
  }
  function dateParts(w) { const c = CK(w), cal = calendar(w); return { year: cal.year, season: cal.season, mon: cal.mon, dom: cal.dom, slot: c.slot, slotName: SLOT_NAME[c.slot], day: c.day, text: cal.year + '年目・' + cal.season + '・' + cal.mon + '月' + cal.dom + '日・' + (SLOT_NAME[c.slot] === '夕方' ? '夕' : SLOT_NAME[c.slot]) }; }
  const dateOf = (w, day, slot) => { const cal = calendar(w, day); return cal.year + '年目・' + cal.season + '・' + cal.mon + '月' + cal.dom + '日' + (slot == null ? '' : '・' + (SLOT_NAME[slot] === '夕方' ? '夕' : SLOT_NAME[slot])); };
  const absSlot = w => CK(w).day * 4 + CK(w).slot;
  // 時間の条件：エンジンの day・dusk・night、または 朝・昼・夕・夜（morning・noon・evening・night も）
  function timeOk(spec, slot) {
    const l = listOf(spec); if (!l.length) return true;
    return l.some(x => { x = String(x); return x === SLOT_ENG[slot] || x === SLOT_NAME[slot] || (x === '夕' && slot === 2) || (x === 'morning' && slot === 0) || (x === 'noon' && slot === 1) || (x === 'evening' && slot === 2) || x === 'any'; });
  }
  function syncEngine(w) {   // エンジンの時間を、こちらの日付に合わせる（{時} の文が「◯か月ほどたった」と言わないように）
    const c = CK(w), startDom = c.d0 - w.mo0 * 30;
    w.mo = (startDom + c.day) / 30;
    const abs = w.mo0 + Math.floor(w.mo);
    w.lastAbs = abs; w.lastYi = Math.floor(abs / 12); w.lastForm = 'plain';
    hero(w).age = w.age0 + (c.day + c.slot / 4) / 360;
    if (w.town && w.town.loc) w.loc = w.town.loc;   // エンジンの「いま居る場所」を、こちらのいる場所に合わせる（場所を選ぶときの出発点・移動の日数を、エンジンに足させない）
  }
  function tick(w, slots) {
    slots = Math.max(0, Math.round(slots)); if (!slots) return;
    const c = CK(w), total = c.day * 4 + c.slot + slots, nd = Math.floor(total / 4);
    for (let d = c.day + 1; d <= nd; d++) onNewDay(w, d);
    c.day = nd; c.slot = total % 4;
    const dy = slots / 4 / 360, h = hero(w);
    Object.keys(w.people).forEach(id => { const P = w.people[id]; if (P.alive && id !== w.heroId) P.age += dy; });
    h.age = w.age0 + (c.day + c.slot / 4) / 360;
  }

  // ---------- 新しい世界・始まり ----------
  function newWorld(seed, cand, opts) {
    const w = Player.newWorld(seed, cand, opts);
    w.maxEp = 1e9;   // 「10〜14話で余生」は使わない
    const startDom = hashStr(String(seed) + '|dom') % 30;
    w.player.clock = { day: 0, slot: 1, d0: w.mo0 * 30 + startDom };
    w.player.visited = [];   // 訪れたことのある町・村・港町（'village'・'town'・'seaport'）。「最初の街への道中」のような話が、もう町を知っている人に出ないために持つ
    const st0 = w.loc && WB[w.loc] ? w.loc : (habList(offOf(w))[0] || {}).id;   // 転生して目を覚ます場所：世界の出発点（人里のそばの野外）
    w.town = { ver: VER, rng: (w.rng ^ 0x7a31c5e3) | 0, place: 'camp', loc: st0, afield: true, base: null, seen: {}, lastTravel: null, feed: [], diary: [], rumors: [], board: [], serial: 1, momSeq: 0, realTurn: null, momentLast: {}, today: { prayed: false, rumors: 0 }, boardDay: -99,
      injured: null, restNights: 0, train: {}, talkState: {}, metDay: {}, lastMomentDay: -1, talk: null, shop: null, cur: null, wrap: null, wishPending: false, declinedWish: false, lastEpEnd: null, actionNo: 0, lastMomentAction: -9, noteOn: false,
      stats: { acts: {}, moments: 0, momentIds: {}, rumorsHeard: 0, rumorEps: 0, questEps: 0, firstEps: 0, talks: 0, idleTalks: 0, confides: 0, trustGain: 0, trustLoss: 0, epGaps: [], expired: 0, trainGains: 0, bought: 0, sold: 0, rumorsScript: 0, rumorsFallback: 0, works: 0, earned: 0, moves: 0 } };
    if (st0) { w.loc = st0; w.town.seen[st0] = 1; if (!w.path) w.path = [st0]; }
    trackMeet(w, 0);
    return w;
  }
  function start(w) {
    if (w.cur || w.log.length) return w.cur;
    syncEngine(w);
    const c = Story.next(w); if (!c) return null;
    stampEp(w, c, true);
    TW(w).cur = { kind: 'ep', origin: 'first', day0: CK(w).day, slot0: CK(w).slot, mo0: w.mo };
    TW(w).stats.firstEps++;
    return c;
  }
  // エピソードの頭に、こちらの日付を書く。first＝最初の話：時間帯は台本に合わせて今日の中で決める
  function stampEp(w, c, first) {
    const ck = CK(w), want = c.time0 || c.time;
    // 台本の時間帯に合わせる（待つ分だけ時計を進める）。朝・昼は day、夕は dusk、夜は night
    const tgt = want === 'night' ? 3 : want === 'dusk' ? 2 : null;
    let waited = 0;
    if (first) { ck.slot = tgt != null ? tgt : 1; }
    else if (tgt != null) { waited = tgt >= ck.slot ? tgt - ck.slot : 4 - ck.slot + tgt; }
    else if (ck.slot > 1) { waited = 4 - ck.slot; }   // day：翌朝まで待つ
    if (waited) { tick(w, waited); TW(w).feed.push({ k: 't', t: SLOT_ENG[ck.slot] === 'night' ? '日が暮れるのを待って、向かった。' : ck.slot === 0 ? '夜が明けるのを待って、向かった。' : '時が来るのを待って、向かった。' }); }
    syncEngine(w);
    const cal = calendar(w);
    c.when = cal.season + 'の' + SLOT_NAME[ck.slot]; c.season = cal.season; c.month = cal.mon; c.year = cal.year; c.dom = cal.dom; c.mo = w.mo; c.age = Math.floor(hero(w).age);
    c.time = c.time0 = SLOT_ENG[ck.slot]; c.day0 = ck.day; c.slot0 = ck.slot;
  }
  function healGuard(w) {   // エンジンは、けがを時間で治す（flagHeal。2026-11-20 物語試作の変更。以前は「2話で治る」）。こちらでは日数で治すので、エンジンの回復を止める
    const h = hero(w);
    if (h.flags.includes('けが')) { h.flagAt = h.flagAt || {}; h.flagAt['けが'] = 1e9; h.flagHeal = { at: 1e9, days: 0 }; if (!TW(w).injured) TW(w).injured = { day: CK(w).day }; }
  }
  function trackInjury(w) {
    const h = hero(w), T = TW(w);
    if (h.flags.includes('けが')) { h.flagAt = h.flagAt || {}; h.flagAt['けが'] = 1e9; h.flagHeal = { at: 1e9, days: 0 }; if (!T.injured) { T.injured = { day: CK(w).day }; T.restNights = 0; } }
    else T.injured = null;
  }
  function heal(w, why) {
    const h = hero(w), T = TW(w), i = h.flags.indexOf('けが');
    if (i < 0) return null;
    h.flags.splice(i, 1); if (h.flagAt) delete h.flagAt['けが']; h.flagHeal = null; T.injured = null; T.restNights = 0;
    const l = { k: 'n', t: h.nick + 'のけがが治った。' + (why || '') };
    diary(w, 'note', l.t); return l;
  }

  // ---------- 日記・日が変わる ----------
  function diary(w, kind, text, extra) {
    const T = TW(w), c = CK(w);
    T.diary.push(Object.assign({ day: c.day, slot: c.slot, kind, text, where: locLabel(w) }, extra || {}));
    if (T.diary.length > TN.diaryMax) T.diary.splice(0, T.diary.length - TN.diaryMax);
  }
  function onNewDay(w, day) {
    const T = TW(w);
    T.today = { prayed: false, rumors: 0 };
    const before = T.rumors.length;
    T.rumors = T.rumors.filter(r => r.expire >= day); T.stats.expired += before - T.rumors.length;
    T.board = T.board.filter(q => q.expire >= day);
    if (T.injured && day - T.injured.day >= TN.healNatural && !w.over) heal(w, '（日がたって、自然に癒えた）');
    if (marks(w).includes('registered') && (day - T.boardDay >= TN.boardEvery || !T.board.length && day - T.boardDay >= 1)) { T.boardDay = day; refreshBoard(w, day); }
  }

  // ---------- 台本の候補（噂・依頼） ----------
  // 近くの場所の hooks（その型が起きやすい）の濃さ：道のりが近い場所ほど濃い。噂の台本を選ぶ重みに使う
  function nearScore(w) {
    const T = TW(w), sc = {}, off = offOf(w);
    SW.data.places.forEach(p => { if (!SW.visible(p, off) || COMP[p.id] !== COMP[T.loc]) return; const d = SW.dist(T.loc, p.id); if (d > 8) return; const k = 1 / Math.pow(1 + d / 2, 2); (p.hooks || []).forEach(h => { sc[h] = (sc[h] || 0) + k; }); });
    return sc;
  }
  function rumorWeight(w, ep, near) {
    const turn = w.turn + 1, st = turn <= 4 ? 0 : turn <= 9 ? 1 : 2, ty = D.TYPES[ep.type] || { stage: [1, 1, 1] }, prev = w.log[w.log.length - 1];
    let x = Math.max(0.1, ty.stage[st]);
    if (turn >= 2 && turn <= 5 && (ep.type === 'first_cheat' || ep.type === 'guild_register')) x *= 2.5;
    if (prev && prev.type === ep.type) x *= 0.5;
    const need = ep.need || {}, thr = listOf(need.threads).concat(ep.cast ? ep.cast.filter(e => e.pick && e.pick.thread).map(e => e.pick.thread) : []);
    if (thr.some(id => w.threads.some(t => !t.closed && t.id === id))) x *= 2.5;   // 糸が引ける
    if (near) x *= 1 + Math.min(2, near[ep.type] || 0);   // 近くに、この型が起きやすい場所がある（世界の hooks）
    return x;
  }
  // ---------- 台本の前提と、いまの状態 ----------
  const visitedOf = w => (w.player.visited || (w.player.visited = []));
  function visit(w, hub) { if (SETTLE.includes(hub)) { const v = visitedOf(w); if (!v.includes(hub)) v.push(hub); } }
  // 台本の place（場所の種類）の組。場所そのものは、世界の場所から選ぶ（pickLoc）
  function allowedPlaces(w, ep) { return listOf(ep.place).length ? listOf(ep.place) : ['village']; }
  // 台本の前提：arrival 型（初めて町へ向かう話など）は、町・港町をまだ訪れていないときだけ。世界のどこにも始められる場所が無ければ出ない
  function premiseOk(w, ep) {
    if (ep.type === 'arrival') { const v = visitedOf(w); if (v.includes('town') || v.includes('seaport')) return false; }
    return !!pickLoc(w, ep, () => 0.5);
  }
  function candidates(w, relax, filter) {
    const T = TW(w), taken = new Set(T.rumors.map(r => r.ep).concat(T.board.map(q => q.ep)));
    return epsAll().filter(e => !taken.has(e.id) && !w.used.includes(e.id) && (!filter || filter(e)) && premiseOk(w, e) && Story._feasible(w, e, w.turn + 1, relax));
  }
  // 噂の文：その台本の噂の文（rumors\*.js の StoryRumors）から選ぶ。無い台本だけ、台本の rumor、それも無ければ型ごとの決まり文句。{場所} は世界の具体的な場所の名前
  function scriptRumors(id) { const a = g.StoryRumors && g.StoryRumors[id]; return Array.isArray(a) ? a.filter(x => typeof x === 'string' && x.trim()) : []; }
  function rumorText(w, ep, loc, R) {
    const m = { 場所: loc.name, 名: hero(w).nick }, h = hash2(ep.id);
    const sr = scriptRumors(ep.id).map(x => fmt(x, m)).filter(x => !/[{}]/.test(x));   // 差し込みが残る文は使わない
    if (sr.length) return { text: pickFrom(R, sr), src: 'script' };
    if (typeof ep.rumor === 'string' && ep.rumor.trim()) { const t = fmt(ep.rumor, m); if (!/[{}]/.test(t)) return { text: t, src: 'ep' }; }
    const arr = TYPE_RUMOR[ep.type] || ['気になる話を耳にした。'];
    return { text: fmt(arr[h % arr.length], m), src: 'type' };
  }
  const hash2 = s => hashStr(s) >>> 0;
  function genRumor(w) {
    const T = TW(w), R = trng(w);
    let list = candidates(w, false), relaxed = false;
    if (!list.length) { list = candidates(w, true); relaxed = true; }
    if (!list.length) return null;
    const near = nearScore(w);
    const ep = wpick(R, list, e => rumorWeight(w, e, near) * (relaxed ? 0.5 : 1));
    const sel = pickLoc(w, ep, R); if (!sel) return null;
    const day = CK(w).day, tx = rumorText(w, ep, sel.loc, R);
    const r = { id: 'r' + (T.serial++), ep: ep.id, type: ep.type, place: sel.g, loc: sel.loc, heard: day, expire: day + TN.rumorLife, passed: false, text: tx.text, src: tx.src };
    T.rumors.push(r); T.stats.rumorsHeard++; if (tx.src === 'script') T.stats.rumorsScript++; else T.stats.rumorsFallback++;
    return r;
  }
  function refreshBoard(w, day) {
    const T = TW(w), R = trng(w), near = nearScore(w);
    while (T.board.length < TN.maxBoard) {
      const list = candidates(w, false, e => !!e.quest || QUEST_TYPE[e.type] != null);
      if (!list.length) break;
      const ep = wpick(R, list, e => rumorWeight(w, e, near)), q = ep.quest || {}, sel = pickLoc(w, ep, R); if (!sel) break;
      T.board.push({ id: 'q' + (T.serial++), ep: ep.id, type: ep.type, place: sel.g, loc: sel.loc, expire: day + 8, reward: typeof q.reward === 'number' ? q.reward : QUEST_TYPE[ep.type] || 8, text: rumorText(w, ep, sel.loc, R).text, title: ep.title });
    }
  }
  const hubOfPlace = w => TW(w).place;

  // ---------- 場所と行動 ----------
  function placeActions(w) {
    const T = TW(w), p = T.place, h = hero(w), reg = marks(w).includes('registered'), afield = T.afield || p === 'camp', settled = !afield;
    const out = [];
    const add = (id, label, hint, ok, why) => out.push({ id, label, hint: hint || '', ok: ok !== false, why: why || '' });
    const lodging = marks(w).includes('lodging') || atHome(w), inn = hasFac(w, RE_INN);
    add('rest', '休む', afield ? '野宿・翌朝まで' : lodging ? '宿・翌朝まで' : inn ? '宿代' + TN.innCost + '・翌朝まで' : '宿は無い・軒先を借りる・翌朝まで');
    if (settled && SHOP_CATS[p] && hasFac(w, RE_SHOP)) add('shop', '買う・売る', '店をのぞく・1時間帯');
    add('train', '鍛える', '力・技・心とスキル・1時間帯');
    if (settled) add('work', '手伝い仕事', '半日・金' + WORK.gold[0] + '〜' + WORK.gold[1] + '（登録しなくてもできる）', CK(w).slot < 3, '夜は仕事がない');
    add('rumor', '噂を聞く', afield ? '通りがかりの旅人から' : rumorSrc(w).replace(/から$|で$/, ''));
    if (reg && settled && hasFac(w, RE_GUILD)) add('quest', '依頼の掲示板', '冒険者ギルドの掲示板・登録済みの人だけ', true);
    add('pray', '祈る', '祈りが1つ戻る（1日1回）', !T.today.prayed, T.today.prayed ? '今日はもう祈った' : '');
    add('travel', '出かける', '地図から、道でつながった場所へ（日数がかかる）');
    if (CK(w).day >= TN.retireDays) add('end', '旅を終える', '静かな余生へ');
    return out;
  }
  // 噂を聞く場所：その場所の施設から（港なら桟橋・酒場があれば酒場・井戸・市場）
  function rumorSrc(w) {
    const T = TW(w); if (T.afield || T.place === 'camp') return '通りがかりの旅人から';
    if (T.place === 'seaport') return '桟橋の男たちから';
    if (hasFac(w, RE_TAVERN)) return '酒場の隅で';
    if (T.place === 'village' && hasFac(w, RE_WELL)) return '井戸端で';
    if (hasFac(w, /市場/)) return '市場で';
    return '土地の者から';
  }
  const ACTS = {
    rest(w, arg, feed) {
      const h = hero(w), T = TW(w), c = CK(w), p = T.place, R = trng(w), lodging = marks(w).includes('lodging') || atHome(w), outdoors = T.afield || p === 'camp', hasInn = hasFac(w, RE_INN), fk = placeKey(w);
      let inn = false, paid = 0;
      if (!outdoors && !lodging) { if (hasInn && (h.stats.金 || 0) >= TN.innCost) { h.stats.金 -= TN.innCost; paid = TN.innCost; inn = true; } }
      else if (!outdoors) inn = true;
      const lifeBefore = h.stats.命, P = w.player;
      h.stats.命 = Math.min(D.TUNE.maxLife, h.stats.命 + (inn ? 2 : 1));
      P.kokoro = Math.min(Player.T.kokoroMax, P.kokoro + (inn ? TN.kokoroRest : 1));
      const slots = c.slot === 0 ? 4 : 4 - c.slot;   // 翌朝まで
      feed.push({ k: 't', t: (outdoors ? flavorOf('rest', 'camp', R) : inn ? flavorOf('rest', fk, R) : hasInn ? '宿代が足りず、軒先を借りて眠った。' : '宿が無く、軒先を借りて眠った。') + (paid ? '（宿代 ' + paid + '）' : '') });
      if (h.stats.命 > lifeBefore) feed.push({ k: 'n', t: '命が戻った。' });
      if (h.flags.includes('けが')) { T.restNights++; if (T.restNights >= TN.healNights) { const l = heal(w, '（' + TN.healNights + '日休んだ）'); if (l) feed.push(l); } else feed.push({ k: 'n', t: 'けがが、少しずつ癒えている。（あと' + (TN.healNights - T.restNights) + '日）' }); }
      return { ok: true, slots };
    },
    shop(w, arg, feed) {
      const T = TW(w), p = T.place; if (!SHOP_CATS[p] || !hasFac(w, RE_SHOP)) return { ok: false, reason: 'ここには店がない' };
      T.shop = { place: p, loc: T.loc, week: Math.floor(CK(w).day / 7) };
      feed.push({ k: 't', t: locName(w) + 'の店に入った。' });
      return { ok: true, slots: 1, noMoment: true };
    },
    train(w, arg, feed) {
      const h = hero(w), T = TW(w), R = trng(w);
      if (!arg) return { ok: false, reason: '何を鍛えるか選んでください' };
      const opt = trainTargets(w).find(x => x.target === arg); if (!opt) return { ok: false, reason: 'それは鍛えられない' };
      if (h.flags.includes('けが')) { feed.push({ k: 't', t: 'けがが痛んで、まともに鍛えられなかった。休めば、治りが早い。' }); return { ok: true, slots: 1 }; }
      const key = opt.key, mentor = mentorOf(w), add = 1 + (mentor && (opt.kind === 'stat' || (mentor.skills || []).some(s => s.id === opt.target)) ? 1 : 0);
      T.train[key] = (T.train[key] || 0) + add;
      feed.push({ k: 't', t: opt.kind === 'stat' ? '「' + opt.label + '」を鍛えた。' + flavorOf('train', placeKey(w), R) : 'スキル「' + opt.label + '」の鍛錬を積んだ。' });
      if (mentor && add > 1) feed.push({ k: 't', t: mentor.nick + 'が、横から手ほどきをしてくれた。' });
      if (T.train[key] >= opt.need) {
        T.train[key] = 0; T.stats.trainGains++;
        if (opt.kind === 'stat') { h.stats[opt.target] = clamp((h.stats[opt.target] || 0) + 1, 0, 20); feed.push({ k: 'n', t: '◇ ' + opt.label + 'が 1 上がった（' + h.stats[opt.target] + '）', up: true }); diary(w, 'act', opt.label + 'が 1 上がった'); }
        else { const s = h.skills.find(x => x.id === opt.target); s.lv = Math.min(5, s.lv + 1); feed.push({ k: 'n', t: '◇ ' + opt.label + 'が Lv' + s.lv + ' になった', up: true }); diary(w, 'act', opt.label + 'が Lv' + s.lv + ' になった'); }
      }
      return { ok: true, slots: 1 };
    },
    rumor(w, arg, feed) {
      const T = TW(w), R = trng(w), p = T.place, src = rumorSrc(w);
      T.today.rumors++;
      if (T.rumors.length >= TN.maxRumors) feed.push({ k: 't', t: src + '耳に入るのは、すでに知っている噂ばかりだった。' });
      else if (R() < TN.listenChance) {
        const r = genRumor(w);
        // 「思い立つ」形の台本（rumors の StoryRumorKind が 'think'）は、噂としてではなく、ふと思い立ったこととして出す
        if (r && g.StoryRumorKind && g.StoryRumorKind[r.ep] === 'think') { r.think = true; feed.push({ k: 't', t: flavorOf('rumor', p, R) }); feed.push({ k: 'n', t: 'ふと思い立った：' + r.text, rumor: r.id }); }
        else if (r) { feed.push({ k: 't', t: src + '、こんな話を聞いた。' }); feed.push({ k: 'n', t: '噂：' + r.text, rumor: r.id }); }
        else feed.push({ k: 't', t: src + '話を聞いて回ったが、新しい噂はなかった。' });
      } else feed.push({ k: 't', t: flavorOf('rumor', p, R) });
      return { ok: true, slots: 1 };
    },
    work(w, arg, feed) {
      const h = hero(w), T = TW(w), R = trng(w);
      if (CK(w).slot >= 3) return { ok: false, reason: '夜は仕事がない' };
      if (h.flags.includes('けが')) { feed.push({ k: 't', t: 'けがが痛んで、働けなかった。休めば、治りが早い。' }); return { ok: true, slots: 1, noMoment: true }; }
      const gold = WORK.gold[0] + Math.floor(R() * (WORK.gold[1] - WORK.gold[0] + 1));
      h.stats.金 = (h.stats.金 || 0) + gold; T.stats.works++; T.stats.earned += gold;
      feed.push({ k: 't', t: flavorOf('work', T.place, R) }); feed.push({ k: 'n', t: '◇ 日当 ' + gold + ' 金を受け取った', up: true });
      diary(w, 'act', '手伝い仕事で ' + gold + ' 金を稼いだ');
      return { ok: true, slots: WORK.slots };
    },
    pray(w, arg, feed) {
      const T = TW(w), P = w.player, R = trng(w);
      if (T.today.prayed) return { ok: false, reason: '今日はもう祈った' };
      T.today.prayed = true;
      if (P.prayers < Player.T.prayers0) { P.prayers++; P.prayed = Math.max(0, P.prayed - 1); feed.push({ k: 't', t: '静かに祈った。祈りの力が、ひとつ戻ってきた。（残り' + P.prayers + '回）' }); }
      else feed.push({ k: 't', t: flavorOf('pray', placeKey(w), R) });
      return { ok: true, slots: 1 };
    },
    travel(w, arg, feed) {
      const T = TW(w), d = destinations(w).find(x => x.to === arg); if (!d) return { ok: false, reason: 'そこへは行けない' };
      const from = T.loc, fromAfield = T.afield, fromName = fromAfield && isHab(WB[from]) ? WB[from].name + 'のそば' : WB[from].name;
      setLoc(w, d.to, false); T.lastTravel = { from, to: d.to };
      const home = marks(w).includes('home') && homeHab(w) === d.to;
      feed.push({ k: 't', t: home ? (d.days ? d.days + '日歩いて、住まいのある' + d.name + 'に戻った。' : '住まいに帰った。') : fromName + 'から' + d.name + 'へ。' + d.days + '日の道のりだった。' });
      diary(w, 'note', fromName + 'から' + d.name + 'へ出かけた（' + d.days + '日）');
      T.stats.moves++;
      return { ok: true, slots: Math.max(1, Math.round(d.days * 4)), moveOn: 'travel' };
    },
  };
  // 鍛えられるもの：力・技・心と、覚えたスキル（Lv5未満）
  function trainTargets(w) {
    const h = hero(w), T = TW(w), out = [];
    ['力', '技', '心'].forEach(s => out.push({ target: s, key: 'st:' + s, kind: 'stat', label: s, cur: h.stats[s] || 0, need: 2 + (h.stats[s] || 0), prog: T.train['st:' + s] || 0 }));
    h.skills.filter(s => s.lv < 5 && SK[s.id]).forEach(s => out.push({ target: s.id, key: 'sk:' + s.id, kind: 'skill', label: SK[s.id].name, cur: s.lv, need: 3 + 2 * s.lv, prog: T.train['sk:' + s.id] || 0 }));
    return out;
  }
  function mentorOf(w) { const h = hero(w); const id = Object.keys(h.relations).find(i => { const r = h.relations[i], p = w.people[i]; return r.type === 'mentor' && p && p.alive && !p.missing && !p.away; }); return id ? w.people[id] : null; }

  function modeOf(w) {
    if (w.over) return 'over';
    if (w.cur) return 'ep';
    const T = TW(w);
    if (T.wishPending) return 'wish';
    if (T.wrap) return 'wrap';
    if (T.talk) return 'talk';
    if (T.shop) return 'shop';
    return 'hub';
  }

  // ---------- 行動 ----------
  function act(w, kind, arg) {
    if (modeOf(w) !== 'hub') return { ok: false, reason: 'いまは自由な時間ではない' };
    const T = TW(w);
    if (kind === 'end') return { ok: false, reason: '旅を終えるには retire を使う' };
    if (kind === 'talk') return startTalk(w, arg);
    if (kind === 'quest') return { ok: false, reason: '依頼は受けるものを選ぶ（takeQuest）' };
    const fn = ACTS[kind]; if (!fn) return { ok: false, reason: 'そんな行動はない' };
    const pa = placeActions(w).find(a => a.id === kind); if (!pa) return { ok: false, reason: 'ここではできない' };
    if (!pa.ok) return { ok: false, reason: pa.why };
    const feed = [];
    const r = fn(w, arg, feed); if (!r.ok) return r;
    T.actionNo++; T.stats.acts[kind] = (T.stats.acts[kind] || 0) + 1;
    tick(w, r.slots);
    syncEngine(w);
    T.feed = feed;
    let moment = null;
    if (!r.noMoment) moment = maybeMoment(w, kind, r.moveOn);
    if (!moment && !r.noMoment) feed.push({ k: 't', t: quietLine(w) });
    return { ok: true, lines: feed, moment };
  }

  // 小さな場面が起きなかったときの短い1文（場所×時間帯）
  function quietLine(w) { const a = NOQ[placeKey(w)] || NOQ.town; return pickFrom(trng(w), a[CK(w).slot]); }

  // ---------- 小さな場面（モーメント） ----------
  function ensureReg(w) {
    const c = w.cur; if (!c) return;
    const m = momentById(c.epId);
    if (m) { const a = g.StoryEpisodes || (g.StoryEpisodes = []); if (!a.includes(m)) a.push(m); }
  }
  function cleanup() { const a = g.StoryEpisodes; if (!a) return; momentList().forEach(m => { const i = a.indexOf(m); if (i >= 0) a.splice(i, 1); }); }   // 途中で止めたときなどに、エンジンの台本の一覧から小さな場面を外す
  function unreg(m) { const a = g.StoryEpisodes; if (!a) return; const i = a.indexOf(m); if (i >= 0) a.splice(i, 1); }
  function maybeMoment(w, on, moveOn) {
    const T = TW(w), R = trng(w);
    if (w.over || w.cur) return null;
    const day = CK(w).day;
    if (T.lastMomentDay === day) return null;                                      // 1日に多くて1回
    if (T.actionNo - T.lastMomentAction < TN.momentMinActions) return null;        // 行動の3〜4回に1回くらい
    const p = MOMENT_P[on] != null ? MOMENT_P[on] : 0.3;
    T.stats.mGate = (T.stats.mGate || 0) + 1;
    const roll = R(); if (roll >= p) return null;
    T.stats.mRoll = (T.stats.mRoll || 0) + 1;
    const hub = hubOfPlace(w), trav = on === 'travel' || moveOn === 'travel', pset = trav ? PLACE_SET.travel : (atHome(w) ? PLACE_SET.home.concat(PLACE_SET[T.place] || []) : (PLACE_SET[T.place] || [])), slot = CK(w).slot, turn = w.turn + 1;
    const list = moments().filter(m => {
      if (!listOf(m.on).includes(on)) return false;
      if (listOf(m.place).length && !listOf(m.place).some(x => pset.includes(x) || x === 'any' || x === hub)) return false;
      if (!timeOk(m.time, slot)) return false;
      if (m.repeat) { if (day - (T.momentLast[m.id] == null ? -999 : T.momentLast[m.id]) < TN.momentGap) return false; }   // くり返しは、同じ場面が前に出てから30日以上たってから
      else if (w.used.includes(m.id)) return false;
      return Story._feasible(w, Object.assign({}, m, { id: m.repeat ? '__rep__' + m.id : m.id }), turn, true);
    });
    if (!list.length) { T.stats.mEmpty = (T.stats.mEmpty || 0) + 1; return null; }
    const m = wpick(R, list, x => (x.repeat ? 0.5 : 1));
    return startMoment(w, m, pset, hub, trav ? T.lastTravel : null);
  }
  // エンジンが場所を選ぶ代わりに、こちらで決めた場所を返させる（エンジンの SW.choose を、この呼び出しの間だけ差し替える）。移動の日数・年齢を、エンジンに足させないため
  function withLoc(locd, gk, fn) {
    const orig = SW.choose; SW.choose = () => ({ loc: locd, g: gk, travel: 0 });
    try { return fn(); } finally { SW.choose = orig; }
  }
  function startMoment(w, m, pset, hub, travel) {
    const T = TW(w);
    const reg = g.StoryEpisodes || (g.StoryEpisodes = []); if (!reg.includes(m)) reg.push(m);
    healGuard(w);
    T.realTurn = w.turn; T.momSeq++; w.turn = 999 + T.momSeq;
    syncEngine(w);
    const mo0 = w.mo;
    const inter = listOf(m.place).filter(x => pset.includes(x) && D.PLACE_NAME[x]);
    let place = inter.length ? inter[Math.floor(trng(w)() * inter.length)] : ({ camp: 'camp' }[hub] || hub);
    if (!D.BG[place]) place = 'tavern';
    if (atHome(w) && !inter.length) place = 'tavern';
    const locd = momentLoc(w, place, travel);
    const c = withLoc(locd, place, () => Story._begin(w, m, {}));
    if (!c) { w.turn = T.realTurn; T.realTurn = null; unreg(m); T.momSeq--; return null; }
    syncEngine(w);
    const ck = CK(w), cal = calendar(w);
    c.place = place; c.bg = D.BG[place] || 'village'; if (!c.loc) c.loc = locd;
    c.when = cal.season + 'の' + SLOT_NAME[ck.slot]; c.season = cal.season; c.month = cal.mon; c.year = cal.year; c.dom = cal.dom; c.mo = w.mo; c.age = Math.floor(hero(w).age);
    c.time = c.time0 = SLOT_ENG[ck.slot]; c.day0 = ck.day; c.slot0 = ck.slot;
    T.cur = { kind: 'moment', day0: ck.day, slot0: ck.slot, mo0, repeat: !!m.repeat };
    T.lastMomentAction = T.actionNo; T.lastMomentDay = ck.day;
    return c;
  }
  function afterMoment(w, ev, cur) {
    const T = TW(w), m = momentById(ev.epId), h = hero(w);
    if (w.log[w.log.length - 1] === ev) w.log.pop();
    const rt = T.realTurn; T.realTurn = null;
    if (rt != null) w.turn = rt;
    if (m) { unreg(m); if (cur.repeat || m.repeat) { const i = w.used.lastIndexOf(m.id); if (i >= 0) w.used.splice(i, 1); } T.momentLast[m.id] = CK(w).day; T.stats.momentIds[m.id] = (T.stats.momentIds[m.id] || 0) + 1; const md = T.stats.momentDays || (T.stats.momentDays = {}); (md[m.id] || (md[m.id] = [])).push(cur.day0); }
    T.stats.moments++;
    fixTurns(w, rt, cur);
    trackMeet(w, cur.day0);
    // エンジンが足した時間（4〜8か月）を、こちらの日付に戻す。ほかの人の年齢も、足された分を引く
    const engineDm = w.mo - cur.mo0;
    Object.keys(w.people).forEach(id => { const P = w.people[id]; if (P.alive && id !== w.heroId) P.age -= engineDm / 12; });
    syncEngine(w);
    trackInjury(w);
    ev.day = cur.day0; ev.slot = cur.slot0; ev.dateText = dateOf(w, cur.day0, cur.slot0); ev.mdText = mdOf(w, cur.day0); ev.moment = true;
    diary(w, 'moment', '「' + ev.title + '」' + (ev.payoff ? '――' + ev.payoff : ''), { title: ev.title, where: ev.loc ? ev.loc.name : locLabel(w) });
    T.wrap = { kind: 'moment', ev: JSON.parse(JSON.stringify(ev)) };
    interceptEnd(w, ev);
  }
  // 小さな場面で付いた大きな番号（1000〜）の turn を、いまの話数に直す。糸は、番号の代わりに「◯月◯日」を持たせる（画面に中の番号が出ないように）
  const mdOf = (w, day) => { const cal = calendar(w, day); return cal.mon + '月' + cal.dom + '日'; };
  function fixTurns(w, rt, cur) {
    const h = hero(w), real = rt != null ? rt : w.turn, fix = v => (v >= 1000 ? real : v), md = mdOf(w, cur ? cur.day0 : CK(w).day);
    h.items.forEach(i => { i.turn = fix(i.turn); }); h.skills.forEach(s => { s.turn = fix(s.turn); });
    Object.keys(h.relations).forEach(id => { const r = h.relations[id]; r.since = fix(r.since); const o = w.people[id]; if (o && o.relations[h.id]) o.relations[h.id].since = fix(o.relations[h.id].since); if (o && o.met != null) o.met = fix(o.met); });
    w.threads.forEach(t => { if (t.turn >= 1000) t.openDate = md; if (typeof t.closed === 'number' && t.closed >= 1000) { t.closedDate = md; t.closed = real; } t.turn = fix(t.turn); });
    w.player.picks.forEach(p => { p.turn = fix(p.turn); }); w.player.s2History.forEach(x => { x.turn = fix(x.turn); });
  }

  // ---------- エピソードを始める ----------
  const isOutside = locd => !habOf(locd.id) || (!!locd.anchored && !INSIDE_G.includes(locd.g));   // 人里の外（そば・迷宮・遺跡など）の場所か
  // 始まる場所までの移動：別の場所なら、道のりの日数をかけて向かう（日記に残す）。人里の外（そば・迷宮・遺跡など）へは、人里からなら1日。返す：日数
  function moveForEp(w, locd) {
    const T = TW(w), from = T.loc, p = WB[locd.id], h = habOf(locd.id), outside = isOutside(locd);
    let days = 0;
    if (locd.id === from) days = (!!T.afield === outside) ? 0 : 1;
    else if (p.parent && h === from) days = T.afield ? 1 : 0;
    else days = Math.max(1, Math.round(SW.dist(from, locd.id)));
    if (days) { diary(w, 'note', locd.name + 'へ向かった（' + days + '日）'); tick(w, days * 4); T.stats.moves++; }
    setLoc(w, locd.id, outside);
    return days;
  }
  function startEp(w, ep, meta) {
    const T = TW(w);
    const sel = meta && meta.loc ? { loc: meta.loc, g: meta.place || (meta.loc && meta.loc.g) } : pickLoc(w, ep, trng(w)); if (!sel) return null;
    healGuard(w);
    syncEngine(w);
    const from = T.loc;
    const c = withLoc(sel.loc, sel.g, () => Story._begin(w, Object.assign({}, ep, { place: [sel.g] }), {}));   // 始まる場所は、噂・依頼で決めた場所
    if (!c) return null;
    syncEngine(w);
    const days = moveForEp(w, sel.loc);
    if (!c.loc) c.loc = sel.loc;
    c.from = from; c.travelRaw = days; c.travel = days;
    const start = absSlot(w);
    stampEp(w, c, false);
    if (T.lastEpEnd != null) { T.stats.epGaps.push(Math.round((start - T.lastEpEnd) / 4 * 10) / 10); if (T.stats.epGaps.length > 300) T.stats.epGaps.shift(); }
    T.cur = Object.assign({ kind: 'ep', day0: CK(w).day, slot0: CK(w).slot, mo0: w.mo }, meta || {});
    delete T.cur.loc;
    T.wrap = null; T.talk = null; T.shop = null;
    if (meta && meta.origin === 'rumor') T.stats.rumorEps++; else if (meta && meta.origin === 'quest') T.stats.questEps++;
    return c;
  }
  function goRumor(w, rid) {
    if (modeOf(w) !== 'hub') return { ok: false, reason: 'いまは自由な時間ではない' };
    const T = TW(w), i = T.rumors.findIndex(r => r.id === rid); if (i < 0) return { ok: false, reason: 'その噂は、もう消えていた' };
    const r = T.rumors.splice(i, 1)[0], ep = Story._getEp(r.ep);
    if (!ep || w.used.includes(ep.id) || !premiseOk(w, ep) || !Story._feasible(w, ep, w.turn + 1, true)) { T.feed = [{ k: 't', t: 'その話は、もう立ち消えになっていた。' }]; return { ok: false, reason: 'その話は、もう立ち消えになっていた。' }; }
    T.feed = [];
    const c = startEp(w, ep, { origin: 'rumor', place: r.place, loc: r.loc });
    if (!c) { T.feed = [{ k: 't', t: '行ってみたが、話はもう立ち消えになっていた。' }]; return { ok: false, reason: '話は立ち消えになっていた' }; }
    T.rumors = T.rumors.filter(x => x.ep !== ep.id);
    return { ok: true };
  }
  function passRumor(w, rid) {
    const T = TW(w), r = T.rumors.find(x => x.id === rid); if (!r) return { ok: false, reason: 'その噂は、もう消えていた' };
    r.passed = true; r.expire = Math.min(r.expire, CK(w).day + TN.passedLife);
    return { ok: true };
  }
  function takeQuest(w, qid) {
    if (modeOf(w) !== 'hub') return { ok: false, reason: 'いまは自由な時間ではない' };
    const T = TW(w), i = T.board.findIndex(q => q.id === qid); if (i < 0) return { ok: false, reason: 'その依頼は、もう無い' };
    if (!marks(w).includes('registered')) return { ok: false, reason: '登録済みの人だけが受けられる' };
    const q = T.board.splice(i, 1)[0], ep = Story._getEp(q.ep);
    if (!ep || w.used.includes(ep.id) || !premiseOk(w, ep) || !Story._feasible(w, ep, w.turn + 1, true)) { T.feed = [{ k: 't', t: 'その依頼は、取り下げられていた。' }]; return { ok: false, reason: 'その依頼は、取り下げられていた。' }; }
    T.feed = [];
    const c = startEp(w, ep, { origin: 'quest', reward: q.reward, place: q.place, loc: q.loc });
    if (!c) { T.feed = [{ k: 't', t: 'その依頼は、取り下げられていた。' }]; return { ok: false, reason: '取り下げられていた' }; }
    return { ok: true };
  }

  // ---------- エピソードの中（エンジンへの取り次ぎ） ----------
  function post(w, r) {
    const T = TW(w);
    if (r && r.end) afterFinish(w, r.end); else trackInjury(w);
  }
  function advance(w) {
    if (w.over || !w.cur) return null;
    ensureReg(w); healGuard(w);
    const r = Story.advance(w); post(w, r); return r;
  }
  function choose(w, key) {
    if (w.over || !w.cur) return { ok: false, reason: 'いまは分かれ目ではない' };
    ensureReg(w); healGuard(w);
    const r = Player.choose(w, key);
    if (r && r.ok) { if (r.changed) { const last = w.player.s2History[w.player.s2History.length - 1]; if (last) { last.day = CK(w).day; last.date = dateOf(w, CK(w).day); } } post(w, r); }
    return r;
  }
  function pray(w, kind) { if (!w.cur) return { ok: false, reason: 'いまは分かれ目ではない' }; ensureReg(w); return Player.pray(w, kind); }

  // エピソードが終わったあとのいる場所
  function afterPlace(w, ev) {
    const T = TW(w), off = offOf(w), ld = ev.loc, p = (ld && WB[ld.id]) || WB[T.loc], h = habOf(p.id);
    if (h && !(ld && isOutside(ld))) return { loc: h, afield: false, backDays: 0 };   // 人里の中（区画・酒場・神殿を含む）の話
    if (ev.type === 'arrival' && ev.turn > 1) { const t = nearestHab(p.id, off, ['town', 'seaport']) || h || nearestHab(p.id, off); if (t) return { loc: t, afield: false, backDays: 0 }; }   // 「最初の街への道中」のような話は、町の門をくぐって終わる
    if (!T.base || !WB[T.base]) return { loc: p.id, afield: true, backDays: 0 };   // まだ人里に着いたことがない：そのまま野外
    if (ld && ld.anchored && h) return { loc: h, afield: false, backDays: 1 };   // そばの人里へ
    const near = COMP[T.base] === COMP[p.id] && SW.dist(p.id, T.base) <= TN.maxReach ? T.base : (nearestHab(p.id, off) || T.base);
    return { loc: near, afield: false, backDays: Math.max(1, Math.round(SW.dist(p.id, near))) };
  }
  function afterFinish(w, ev) {
    const T = TW(w), cur = T.cur || { kind: 'ep', day0: CK(w).day, slot0: CK(w).slot, mo0: w.mo }; T.cur = null;
    if (cur.kind === 'moment') return afterMoment(w, ev, cur);
    const h = hero(w), c = CK(w), feed = [];
    // 年齢：エンジンが足した分（4〜8か月）を引き、実際にたった日数に直す
    const engineDm = w.mo - cur.mo0;
    // 時間：エピソードがふさぐ時間帯 ＋ 台本の span（日）
    const slot0 = cur.slot0, endEng = ev.time, endSlot = endEng === 'night' ? 3 : endEng === 'dusk' ? 2 : (slot0 <= 1 ? 1 : slot0);
    const occupy = Math.max(1, endSlot - slot0 + 1), span = ev.span || 0;
    ev.day = cur.day0; ev.slot = slot0; ev.dateText = dateOf(w, cur.day0, slot0); ev.origin = cur.origin || null;
    // 場所：人里の中の話ならそのまま、人里の外（そば・迷宮・遺跡など）の話なら、そばの人里・来た人里へ戻る（帰り道の日数がかかる）
    const dest = afterPlace(w, ev), back = dest.backDays * 4;
    // engine が足した年齢を一度戻す
    Object.keys(w.people).forEach(id => { const P = w.people[id]; if (P.alive && id !== w.heroId) P.age -= engineDm / 12; });
    tick(w, occupy + span * 4 + back);
    if (span > 0) feed.push({ k: 't', t: span + '日がたった。' });
    setLoc(w, dest.loc, dest.afield);
    if (dest.backDays) feed.push({ k: 't', t: WB[dest.loc].name + 'へ戻る帰り道で、' + (dest.backDays > 1 ? dest.backDays + '日' : '一日') + 'がたった。' });
    syncEngine(w);
    T.lastEpEnd = absSlot(w);
    trackMeet(w, cur.day0);
    trackInjury(w);
    // 依頼の報酬
    if (cur.origin === 'quest' && cur.reward && h.stats.命 > 0 && !w.over) { h.stats.金 = (h.stats.金 || 0) + cur.reward; feed.push({ k: 'n', t: '◇ 依頼の報酬 ' + cur.reward + ' 金を受け取った', up: true }); }
    // 出た話の噂は消える
    T.rumors = T.rumors.filter(r => r.ep !== ev.epId); T.board = T.board.filter(q => q.ep !== ev.epId);
    diary(w, 'ep', '「' + ev.title + '」' + (ev.payoff ? '――' + ev.payoff : ''), { title: ev.title, turn: ev.turn, day: cur.day0, slot: slot0, where: ev.loc ? ev.loc.name : locLabel(w) });
    T.feed = feed; T.wrap = { kind: 'ep' };
    interceptEnd(w, ev);
  }
  // 「望みを成就」はプレイヤーが区切るか続けるかを選ぶ。それ以外の終わりはエンジンのまま
  function interceptEnd(w, ev) {
    const T = TW(w);
    if (w.over && w.over.ending === 'wish') {
      w.over = null; if (ev) ev.over = null;
      if (!T.declinedWish) T.wishPending = true;
    }
  }
  function wish(w, choice) {
    const T = TW(w); if (!T.wishPending) return { ok: false, reason: 'いまは選ぶときではない' };
    T.wishPending = false;
    if (choice === 'end') { w.over = { ending: 'wish', text: Story._ending(w, 'wish') }; const ev = w.log[w.log.length - 1]; if (ev) ev.over = 'wish'; diary(w, 'note', '望みを成就して、人生に区切りをつけた'); return { ok: true, ended: true }; }
    T.declinedWish = true; diary(w, 'note', '望みは叶った。それでも、旅を続けることにした');
    T.feed = (T.feed || []).concat([{ k: 'n', t: '◇ 望みは叶った。それでも、あなたは旅を続ける。' }]);
    return { ok: true, ended: false };
  }
  function retire(w) {
    if (modeOf(w) !== 'hub') return { ok: false, reason: 'いまは自由な時間ではない' };
    if (CK(w).day < TN.retireDays) return { ok: false, reason: '転生から1年たつと、旅を終えられる' };
    w.over = { ending: 'peace', text: Story._ending(w, 'peace') }; diary(w, 'note', '旅を終えて、静かに暮らすことにした');
    return { ok: true };
  }
  function leaveWrap(w) {
    const T = TW(w); if (!T.wrap) return { ok: false };
    T.wrap = null;
    return { ok: true };
  }

  // ---------- 仲間と話す ----------
  function partners(w) {
    const h = hero(w);
    return Object.keys(h.relations).map(id => ({ id, rel: h.relations[id], p: w.people[id] })).filter(x => x.p && x.p.alive && !x.p.missing && !x.p.away && TALK_TYPES.includes(x.rel.type));
  }
  const hasKey = (spec, val) => { const l = listOf(spec); return !l.length || l.includes(val); };
  function tstate(w, pid) { const T = TW(w); return T.talkState[pid] || (T.talkState[pid] = { done: [], confide: {}, last: -99 }); }
  // 出会ってからの日数と、同じエピソード＋会話の回数
  function trackMeet(w, day) {   // 主人公と関係ができた人の「出会った日」を、初めて見たときに記録する
    const T = TW(w), h = hero(w); T.metDay = T.metDay || {};
    Object.keys(h.relations).forEach(id => { if (id !== h.id && T.metDay[id] == null) T.metDay[id] = day; });
  }
  function metInfo(w, pid) {
    const T = TW(w), p = w.people[pid], ts = tstate(w, pid), md = T.metDay && T.metDay[pid] != null ? T.metDay[pid] : 0;
    return { since: CK(w).day - md, met: new Set(p && p.life || []).size + (ts.n || 0) };
  }
  // 日数と回数が足りている最高の段階（0〜3）。信頼が高くても、ここを超える段階の会話は出ない
  function capStage(w, pid, rel) {
    const mi = metInfo(w, pid); let st = stageOfTrust(rel.trust);
    while (st > 0 && !(mi.since >= TALK_SINCE[st] && mi.met >= TALK_MET[st])) st--;
    return st;
  }
  // 会話ごとの条件：since（日数の下限）・met（回数の下限）。省略時は、会話の信頼の下限の段階で決める
  function talkReq(t) { const st = stageOfTrust(t.trust ? t.trust[0] : 0); return { since: t.since != null ? t.since : TALK_SINCE[st], met: t.met != null ? t.met : TALK_MET[st] }; }
  function sinceMetOk(w, t, pid) { const mi = metInfo(w, pid), rq = talkReq(t); return mi.since >= rq.since && mi.met >= rq.met; }
  // 出せる会話か。出せるなら { tv }（信頼の範囲を見るのに使った信頼の値）、出せないなら null。
  // 信頼が段階を上がっていても日数・回数が足りないときは、足りている段階までの信頼として扱う（一つ下の段階の会話が出る）
  function talkEligible(w, t, p, rel) {
    const ts = tstate(w, p.id), wh = t.who || {}, lo = t.trust ? t.trust[0] : -100, hi = t.trust ? t.trust[1] : 100;
    if (ts.done.includes(t.id)) return null;
    if (!hasKey(wh.s1, p.persona.s1) || !hasKey(wh.s2, p.persona.s2) || !hasKey(wh.past, p.persona.past) || !hasKey(wh.rel, rel.type)) return null;
    if (!timeOk(t.time, CK(w).slot)) return null;
    if (listOf(t.place).length) { const hub = hubOfPlace(w), pl = placeKey(w); if (!listOf(t.place).some(x => x === pl || x === hub || x === 'any')) return null; }
    if (!sinceMetOk(w, t, p.id)) return null;
    let tv = null;
    if (rel.trust >= lo && rel.trust <= hi) tv = rel.trust;
    else { const cs = capStage(w, p.id, rel); if (cs < stageOfTrust(rel.trust)) { const capT = Math.min(rel.trust, 20 * (cs + 1) - 1); if (capT >= lo && capT <= hi) tv = capT; } }
    return tv == null ? null : { tv };
  }
  function confideLeft(w, pid) {
    const p = w.people[pid], rel = hero(w).relations[pid]; if (!p || !rel) return 0;
    const st = capStage(w, pid, rel), ts = tstate(w, pid); let n = 0;
    for (let s = 0; s <= st; s++) {
      if (ts.confide[s]) continue;
      const any = talks().some(t => t.confide && !ts.done.includes(t.id) && hasKey((t.who || {}).s1, p.persona.s1) && hasKey((t.who || {}).s2, p.persona.s2) && hasKey((t.who || {}).past, p.persona.past) && hasKey((t.who || {}).rel, rel.type)
        && sinceMetOk(w, t, pid) && (t.trust ? t.trust[0] <= 20 * s + 19 && t.trust[1] >= 20 * s : true));
      if (any) n++;
    }
    return n;
  }
  function youFor(w, sp, lst) {
    if (!V || !V.pickYou || !sp) return null;
    const h = hero(w), other = sp.id === h.id ? lst : sp, r = other && h.relations[other.id], ty = r ? r.type : null;
    const rel = ty === 'enemy' || ty === 'nemesis' ? 'foe' : ty === 'companion' || ty === 'lover' || ty === 'mentor' || ty === 'patron' || (r && r.trust >= 40) ? 'close' : ((lst && lst.age - sp.age >= 15) || sp.age < 12) ? 'up' : 'plain';
    return V.pickYou(sp, lst || null, rel);
  }
  const TONES = ['normal', 'grave', 'tense'];
  function speak(w, person, da, desu, listener, map, mono, tone) {
    const vk = person.voice, ok = V && vk && V.VOICES && V.VOICES[vk], R = trng(w);
    const raw = fmt(ok && V.VOICES[vk].base === 'desu' ? (desu || da) : (da || desu), map);
    if (mono) { const t = ok ? V.apply(raw, vk, R, person.me, '', { tone: TONES.includes(tone) ? tone : 'normal', mono: true }) : raw.replace(/{私}/g, person.me || '自分'); return t.replace(/{君}/g, ''); }
    const you = youFor(w, person, listener);
    return ok ? V.apply(raw, vk, R, person.me, you, { tone: TONES.includes(tone) ? tone : 'normal', mono: false }) : raw.replace(/\{私\}/g, person.me || '自分').replace(/\{君\}/g, you || 'あなた');
  }
  function startTalk(w, pid) {
    const T = TW(w), h = hero(w), x = partners(w).find(q => q.id === pid);
    if (!x) return { ok: false, reason: 'その人とは、いま話せない' };
    const p = x.p, rel = x.rel, R = trng(w), ts = tstate(w, pid), st = stageOfTrust(rel.trust);
    const elig = talks().map(t => ({ t, e: talkEligible(w, t, p, rel) })).filter(x => x.e);
    const conf = elig.filter(x => x.t.confide && !ts.confide[stageOfTrust(x.e.tv)]), norm = elig.filter(x => !x.t.confide);
    let pk = null;
    if (conf.length && (R() < TN.confideChance || !norm.length)) pk = pickFrom(R, conf);
    else if (norm.length) pk = pickFrom(R, norm);
    else if (conf.length) pk = pickFrom(R, conf);
    const t = pk ? pk.t : null, cst = pk ? stageOfTrust(pk.e.tv) : st;
    ts.n = (ts.n || 0) + 1;   // 会話の回数（「会った回数」に数える）
    T.actionNo++; T.stats.acts.talk = (T.stats.acts.talk || 0) + 1; T.stats.talks++;
    const map = { 名: h.nick, A: p.nick, 相手: p.nick, 場所: HUB_NAME[T.place] || '', 前職: String(h.prevJob || '').replace(/（.*?）/g, '') || '旅の者' };
    let talk;
    if (!t) {
      T.stats.idleTalks++;
      talk = { pid, id: null, idle: true, script: [{ k: 't', t: p.nick + 'と、' + TN.talkIdleLine }], replies: [], picked: null, delta: null, stageBefore: st, stageAfter: st, confide: false };
    } else {
      ts.done.push(t.id); if (t.confide) { ts.confide[cst] = t.id; T.stats.confides++; }
      const script = (t.lines || []).map(l => {
        if (l.t != null) return { k: 't', t: fmt(l.t, map) };
        const sp = (!l.who || l.who === 'A') ? p : (l.who === 'H' || l.who === '名') ? h : null; if (!sp) return null;
        return { k: 's', who: sp.id, name: sp.nick, t: speak(w, sp, l.da, l.desu, sp === p ? h : p, map, !!l.mono && sp === h, l.tone) };
      }).filter(Boolean);
      const replies = (t.reply || []).map((r, i) => {
        let d = (r.tr && typeof r.tr.base === 'number' ? r.tr.base : 0) + (r.tr && r.tr.s2 && r.tr.s2[p.persona.s2] || 0); d = clamp(d, -4, 4);
        return { idx: i, label: fmt(r.label, map), sayText: r.say ? speak(w, h, r.say.da, r.say.desu, p, map, false, r.say.tone || r.tone) : '', delta: d,
          after: r.after ? { k: 's', who: p.id, name: p.nick, t: speak(w, p, r.after.da, r.after.desu, h, map, false, r.after.tone) } : null };
      });
      talk = { pid, id: t.id, idle: false, script, replies, picked: null, delta: null, stageBefore: st, stageAfter: st, confide: !!t.confide };
    }
    ts.last = CK(w).day;
    T.talk = talk;
    tick(w, 1);   // 話すと時間帯が1つ進む
    syncEngine(w);
    T.feed = [];
    if (!talk.replies.length) finishTalk(w);   // 返事のない会話はそのまま終わる（画面は T.talk の「終わった」状態を見せる）
    return { ok: true, talk: T.talk };
  }
  function adjTrust(w, pid, d) {
    const h = hero(w), p = w.people[pid], r = h.relations[pid]; if (!r || !d) return;
    r.trust = clamp(r.trust + d, -100, 100);
    if (p && p.relations[h.id]) p.relations[h.id].trust = r.trust;
  }
  function talkReply(w, idx) {
    const T = TW(w), talk = T.talk; if (!talk || talk.picked != null || !talk.replies.length) return { ok: false, reason: 'いまは返事を選ぶときではない' };
    const r = talk.replies[idx]; if (!r) return { ok: false, reason: 'そんな返事はない' };
    const h = hero(w), p = w.people[talk.pid], rel = h.relations[talk.pid], before = stageOfTrust(rel.trust);
    adjTrust(w, talk.pid, r.delta);
    talk.picked = idx; talk.delta = r.delta; talk.stageAfter = stageOfTrust(rel.trust);
    if (r.delta > 0) T.stats.trustGain += r.delta; else T.stats.trustLoss += -r.delta;
    finishTalk(w);
    return { ok: true, delta: r.delta, stageUp: talk.stageAfter > before, talk };
  }
  function finishTalk(w) {
    const T = TW(w), talk = T.talk; if (!talk || talk.done) return;
    talk.done = true;
    const h = hero(w), p = w.people[talk.pid], rel = h.relations[talk.pid];
    if (talk.stageAfter > talk.stageBefore) diary(w, 'note', p.nick + 'との距離が縮まった（信頼の段階 ' + (talk.stageAfter + 1) + '）');
    diary(w, 'talk', p.nick + 'と話した' + (talk.idle ? '（とりとめのない話）' : talk.confide ? '（打ち明け話）' : '') + (talk.delta ? '　信頼 ' + (talk.delta > 0 ? '+' : '') + talk.delta : ''), { pid: talk.pid });
  }
  // 会話を閉じて、自由な時間に戻る
  function talkEnd(w) {
    const T = TW(w), talk = T.talk; if (!talk) return { ok: false };
    if (talk.replies.length && talk.picked == null) return { ok: false, reason: '返事を選んでください' };
    if (!talk.done) finishTalk(w);
    T.talk = null;
    const m = maybeMoment(w, 'talk');
    if (!m) T.feed = [{ k: 't', t: quietLine(w) }];
    return { ok: true, moment: m };
  }

  // ---------- 店 ----------
  function shopStock(w) {
    const T = TW(w), s = T.shop; if (!s) return [];
    const cfg = SHOP_CATS[s.place], R = localRng(hashStr(w.seed + '|' + s.place + '|' + s.week));
    const pool = IT.items.filter(it => cfg.cats.includes(it.cat) && tierOf(it) <= cfg.tier && !RE_BAN.test(it.name) && !(it.cat === '通貨・身分・取引'));
    const out = [], used = new Set();
    for (let i = 0; i < TN.shopSize && pool.length > out.length; i++) { const it = pool[Math.floor(R() * pool.length)]; if (used.has(it.no)) continue; used.add(it.no); out.push(it.no); }
    return out.sort((a, b) => a - b);
  }
  const RE_BAN = new RegExp(D.ITEM_BAN), RE_HIGH = new RegExp(D.ITEM_HIGH), RE_MID = new RegExp(D.ITEM_MID);
  const tierOf = it => (RE_HIGH.test(it.name) ? 2 : RE_MID.test(it.name) ? 1 : 0);
  const ITEM = {}; IT.items.forEach(it => { ITEM[it.no] = it; });
  const priceOf = it => { const t = tierOf(it); return t === 0 ? 3 + (it.no * 7) % 6 : t === 1 ? 16 + (it.no * 7) % 11 : 70 + (it.no * 7) % 30; };
  const sellOf = it => Math.max(1, Math.floor(priceOf(it) / 2));
  function shopView(w) {
    const T = TW(w), h = hero(w); if (!T.shop) return null;
    return { place: T.shop.place, gold: h.stats.金 || 0,
      stock: shopStock(w).map(no => { const it = ITEM[no]; return { no, name: it.name, cat: it.cat, look: it.look, effect: it.effect, price: priceOf(it), have: (h.items.find(i => i.no === no) || { n: 0 }).n }; }),
      mine: h.items.filter(i => i.n > 0 && ITEM[i.no] && !UNSELLABLE.has(ITEM[i.no].cat)).map(i => { const it = ITEM[i.no]; return { no: i.no, name: it.name, n: i.n, price: sellOf(it) }; }) };
  }
  function buy(w, no) {
    const T = TW(w), h = hero(w); if (!T.shop) return { ok: false, reason: 'いまは店にいない' };
    if (!shopStock(w).includes(no)) return { ok: false, reason: 'その品は置いていない' };
    const it = ITEM[no], pr = priceOf(it);
    if ((h.stats.金 || 0) < pr) return { ok: false, reason: '金が足りない（' + pr + '金）' };
    h.stats.金 -= pr; const cur = h.items.find(i => i.no === no);
    if (cur) cur.n += 1; else h.items.push({ no, n: 1, turn: w.turn, from: 'shop' });
    T.stats.bought++; diary(w, 'act', it.name + 'を買った（' + pr + '金）');
    return { ok: true, text: it.name + 'を買った（' + pr + '金）' };
  }
  function sell(w, no) {
    const T = TW(w), h = hero(w); if (!T.shop) return { ok: false, reason: 'いまは店にいない' };
    const cur = h.items.find(i => i.no === no && i.n > 0), it = ITEM[no];
    if (!cur || !it) return { ok: false, reason: '持っていない' };
    if (UNSELLABLE.has(it.cat)) return { ok: false, reason: 'それは売れない' };
    const pr = sellOf(it); h.stats.金 = (h.stats.金 || 0) + pr; cur.n -= 1; if (cur.n <= 0) h.items.splice(h.items.indexOf(cur), 1);
    T.stats.sold++; diary(w, 'act', it.name + 'を売った（' + pr + '金）');
    return { ok: true, text: it.name + 'を売った（' + pr + '金）' };
  }
  function leaveShop(w) { const T = TW(w); if (!T.shop) return { ok: false }; T.shop = null; const m = maybeMoment(w, 'shop'); if (!m) T.feed = [{ k: 't', t: quietLine(w) }]; return { ok: true, moment: m }; }

  // ---------- 見せる ----------
  function view(w) {
    const T = TW(w), mode = modeOf(w), d = dateParts(w), h = hero(w);
    const hub = hubOfPlace(w), pl = T.place;
    const lp = WB[T.loc], out = { mode, date: d, hub: pl, hubName: HUB_NAME[pl], bg: HUB_BG[pl] || 'village', timeEng: SLOT_ENG[d.slot], feed: T.feed || [],
      loc: { id: T.loc, name: lp ? lp.name : '', label: locLabel(w), nation: lp ? SW.nationName(lp) : '', kind: lp ? lp.kind : '', kindName: lp ? KIND_JA[lp.kind] || '' : '', afield: !!T.afield, atHome: atHome(w) } };
    if (mode === 'hub' || mode === 'wish') {
      out.actions = placeActions(w);
      out.rumors = T.rumors.map(r => ({ id: r.id, text: r.text, passed: r.passed, left: Math.max(0, r.expire - d.day), type: r.type, place: r.place, loc: r.loc ? { id: r.loc.id, name: r.loc.name, nation: r.loc.nation } : null }));
      out.board = hasFac(w, RE_GUILD) ? T.board.map(q => ({ id: q.id, text: q.text, reward: q.reward, left: Math.max(0, q.expire - d.day), title: q.title, type: q.type, loc: q.loc ? { id: q.loc.id, name: q.loc.name, nation: q.loc.nation } : null })) : [];
      out.allies = alliesView(w);
      out.train = trainTargets(w);
      out.travel = destinations(w);
    }
    if (mode === 'talk') out.talk = T.talk;
    if (mode === 'shop') out.shop = shopView(w);
    if (mode === 'wrap') out.wrap = T.wrap;
    return out;
  }
  function alliesView(w) {
    const h = hero(w), T = TW(w);
    return partners(w).map(x => {
      const p = x.p, ts = tstate(w, p.id), elig = talks().filter(t => talkEligible(w, t, p, x.rel)).length, mi = metInfo(w, p.id);
      return { id: p.id, nick: p.nick, look: p.look, build: p.build || null, type: x.rel.type, typeName: (D.REL_TYPES[x.rel.type] || {}).name || x.rel.type, trust: x.rel.trust, stage: stageOfTrust(x.rel.trust), confideLeft: confideLeft(w, p.id), talked: ts.done.length, exhausted: elig === 0, since: mi.since, met: mi.met, talkStage: capStage(w, p.id, x.rel), talkedToday: ts.last === CK(w).day, job: p.job };
    });
  }
  // 前回までのあらすじ
  function recap(w) {
    const T = TW(w), eps = w.log.slice(-3), d = dateParts(w), h = hero(w);
    const lines = eps.map(e => (e.dateText || '') + '　' + (e.loc && e.loc.name ? e.loc.name + '　' : '') + '「' + e.title + '」' + (e.payoff ? '――' + e.payoff : ''));
    const threads = w.threads.filter(t => !t.closed).map(t => (t.who && w.people[t.who] && t.who !== w.heroId ? w.people[t.who].nick + 'のこと' : 'まだ引かれていない糸') + (t.memo ? '：' + t.memo : ''));
    const allies = alliesView(w).map(a => a.nick + '（' + a.typeName + '）');
    return { eps: lines, now: d.text + '、' + locLabel(w) + (atHome(w) ? '（住まい）' : '') + 'にいる', allies, threads, loc: { id: T.loc, label: locLabel(w), nation: WB[T.loc] ? SW.nationName(WB[T.loc]) : '' }, age: Math.floor(h.age), gold: h.stats.金 || 0, rumors: T.rumors.length };
  }

  // ---------- 保存・読み込み ----------
  const save = w => Story.save(w);
  function load(s) {
    let w; try { w = JSON.parse(s); } catch (e) { throw new Error('保存データが壊れていて、読み込めません。新しい人生を始めてください。'); }
    if (!w || typeof w !== 'object' || w.v !== 4) throw new Error('この保存データは古い形式（版' + (w && w.v != null ? w.v : '不明') + '）のため、読み込めません。新しい人生を始めてください。');
    if (!w.player) throw new Error('この保存データは物語試作のものです。ゆっくり続ける版では読み込めません。新しい人生を始めてください。');
    if (!w.town || w.town.ver !== VER) throw new Error('この保存データは最初の版（物語だけを読む）のものです。ゆっくり続ける版では読み込めません。新しい人生を始めてください。');
    ensureReg(w);
    return w;
  }

  g.Town = { VER, cleanup, SAVE_KEY2, TN, SLOT_NAME, SLOT_ENG, HUB_NAME, newWorld, start, mode: modeOf, view, act, goRumor, passRumor, takeQuest, advance, choose, pray, leaveWrap, talkReply, talkEnd, buy, sell, leaveShop, wish, retire,
    save, load, recap, dateParts, dateOf, calendar, trainTargets, destinations, mapView, isOutside, placeInfo, locLabel, placeKey, setLoc, nearestHab, habOf, isHab, KIND_JA, HUB_OF_KIND, COMP, alliesView, shopView, tstate, confideLeft, stageOfTrust, ensureReg, premiseOk, allowedPlaces, metInfo, capStage, talkReq, talkEligible, TALK_SINCE, TALK_MET, FLAVOR, NOQ, scriptRumors, mdOf, priceOf, sellOf, _tick: tick, _sync: syncEngine, _hash: hashStr };
})(typeof globalThis !== 'undefined' ? globalThis : window);
