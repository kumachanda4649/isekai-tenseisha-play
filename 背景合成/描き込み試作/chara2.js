// 神様転生ゲーム：人物の部品と合成（16×32。画面にも Node にも依存しない）
// 依頼者の手本（手本_依頼者の女剣士.png）を部品に分けたもの。決まりは 見本の分析_ドットの決まり.md の 16〜20。
//   ・目と目のあいだは2ドット。白目は黒目の隣で、上が薄いグレー、下が白。
//   ・まつげ（目の上の横2ドット）は男女とも。女の子の印は、その斜め下（外側）の1ドット・ほおのピンク・髪色のあごの輪郭。
//   ・頭のてっぺんは、女は y7（ふち込み）。男は1ドット上。髪の光は共通の位置表（HAIR_LIGHTS）で入れる。
// 使い方： const img = Chara2.compose({ hair, eyes, top, bottom, hat, held, off, back, beard, build, colors });  // {w:18, h:34, px}
(function (g) {
const GW = 16, GH = 32, PAD = 4;   // 体は16×32。絵は左右に PAD ドットずつ余白を持つ（合計 26×34、ふち込み）
const mixc = (a, b, t) => { const A = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), B = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16)); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };

// ---- 部品 ----
const BODY = {     // 顔・首・手（脚の肌は下衣の部品に入れる）
  girl: { y: 11, rows: ['....TTTTTTTT', '....sssTTsss', '....ssssssss', '....ssssssss', '....sssssssS', '.....sssssS', '.......sS', '.......SS', '', '', '', '', '.4s..........sS', '.sS..........SS'] },
};
const EYES = {
  girl: { y: 12, rows: ['.....kk..kk', '....kvk..kvk', '.....we..ew', '.....o....o'] },   // まつげ横2＋斜め下の1ドット（女の子の印）。白目の真下にほお紅を1ドット
  boy: { y: 12, rows: ['.....kk..kk', '.....vk..kv', '.....we..ew'] },     // まつげ横2はある。斜め下の1ドットだけがない
};
const HAIRS = {
  long: { y: 7, rows: ['.....hhhhhh', '....h333hhhh', '...h33hhhhhhh', '...h3hhh3hhhh', '..hhhhhhhhhhHH', '..hHh......hhH', '..hH........hH', '..hh........hH', '..hhh......hhH', '..hhHH....HHhH', '..hh........hH', '..hh........hH', '..hH.........H', '..hH.........H', '..HH.........H', '...H.........H'] },
  bob: { y: 7, rows: ['.....hhhhhh', '....h333hhhh', '...h33hhhhhhh', '...h3hhh3hhhh', '..hhhhhhhhhhHH', '..hHh......hhH', '..hH........hH', '..hh........hH', '..hhh......hhH', '..hhHH....HHhH', '...HH......HH'] },   // ボブ（Claude の下描き。依頼者が直しなしで採用 2026-11-18）
  // 以下は Claude の下描き（2026-11-18、まとめて作成。依頼者の突っ込み待ち）
  pony: { y: 7, rows: ['.....hhhhhh', '....h333hhhh', '...h33hhhhhhhqh', '...h3hhh3hhhhqhH', '..hhhhhhhhhhHHhH', '..hHh......hhHhH', '..hH........hH.H', '..hh........hH.H', '..hhh......hhH', '..hhHH....HHhH', '...HH......HH'] },          // ポニーテール（右に束）
  twin: { y: 7, rows: ['.....hhhhhh', '....hhhhhhhh', '...hhhhhhhhhh', '...hhhhhhhhhh', '..hhhhhhhhhhHH', '.qhHh......hhHq', 'hHhH........hHhH', 'hHhh........hHhH', 'hHhhh......hhHhH', 'hHhhHH....HHhHhH', 'hH............hH', 'hH............hH', '.H............H'] },   // ツインテール（耳の高さで結び、束を体の横に垂らす）
  shortF: { y: 7, rows: ['.....hhhhhh', '....h333hhhh', '...h33hhhhhhh', '...h3hhh3hhhh', '..hhhhhhhhhhHH', '..hHh......hhH', '..hH........hH', '..hh........hH', '...hh......hH', '....HH....HH'] },                 // ショート
  spikyM: { y: 5, top: 6, rows: ['....h.hh.hh', '....hh3hhhhh', '....h333hhhh', '...h33hhhhhhh', '..hh3hhh3hhhhH', '..hhhhhhhhhhHH', '..hhhhhh.hhhHH', '..hH........hH', '..H..........H'] },                              // ツンツン（男）
  partM: { y: 6, rows: ['.....hhhhhh', '....hh333hhh', '...hh33hhhhhh', '..hhh3hhhhhhhH', '..hhhhhhhHhhHH', '..hhh.....HhHH', '..hH........hH', '..H..........H'] },                                               // 七三分け（男）
  oldM: { y: 7, top: 6, rows: ['.....4sssss', '....4sssssss', '..hh4sssssshH', '..hhsssssssshH', '..hH........hH', '..hH........hH', '..H..........H'] },   // 薄毛（てっぺんは肌、横に髪）
  hime: { y: 7, rows: ['.....hhhhhh', '....hhhhhhhh', '...hhhhhhhhhh', '...hhhhhhhhhh', '..hhhhhhhhhhHH', '..hHh......hhH', '..hHh......hhH', '..hhh......hhH', '..hhh......hhH', '..hhHH....HHhH', '..hh........hH', '..hh........hH', '..hH.........H', '..hH.........H', '..HH.........H', '...H.........H'] },   // 姫カット（ほおの横で切りそろえ）
  braid: { y: 7, rows: ['.....hhhhhh', '....hhhhhhhh', '...hhhhhhhhhh', '...hhhhhhhhhh', '..hhhhhhhhhhHH', '..hHh......hhH', '..hH........hH', '..hh........hH', '..hhh......hhH', '..hhHH....HHhH', '..hH........hH', '..Hh........Hh', '..hH........hH', '..Hh........Hh', '..qq........qq', '..hH........hH'] },                                                  // 三つ編み（前に2本）
  wavy: { y: 7, rows: ['.....hhhhhh', '....hhhhhhhh', '...hhhhhhhhhh', '...hhhhhhhhhh', '..hhhhhhhhhhHH', '..hHh......hhH', '..hH........hH', '.hhh........hhH', '.hhhh......hhhH', '..hhHH....HHhH', '..hh........hH', '.hhH........hhH', '.hhH........hHH', '..hH.........H', '..HH.........H'] },   // ウェーブ（ゆるく2回ふくらむ。ギザギザをやめた）
  bun: { y: 5, top: 7, rows: ['......hhhh', '......hHHH', '.....hhhhhh', '....hhhhhhhh', '...hhhhhhhhhh', '...hhhhhhhhhh', '..hhhhhhhhhhHH', '..hHh......hhH', '..hH........hH', '..hh........hH', '...hh......hH', '....HH....HH'] },   // お団子（頭の真上に小さく1つ）
  longM: { y: 6, rows: ['.....hhhhhh', '....hhhhhhhh', '...hhhhhhhhhh', '..hhhhhhhhhhhH', '..hhhhhhhhhhHH', '..hhhhhh.hhhHH', '..hH........hH', '..hH........hH', '..hh........hH', '..hh........hH', '..hH........HH', '..H..........H'] },                                                                                                        // 長髪（男）
  topknot: { y: 3, top: 6, rows: ['.......hh', '.......hH', '......hhhH', '.....hhhhhh', '....hhhhhhhh', '...hhhhhhhhhh', '..hhhhhhhhhhhH', '..hhhhhhhhhhHH', '..hhhhhh.hhhHH', '..hH........hH', '..H..........H'] },                                                                                                                           // まげ
  bowl: { y: 6, rows: ['.....hhhhhh', '....hhhhhhhh', '...hhhhhhhhhh', '..hhhhhhhhhhhH', '..hhhhhhhhhhHH', '..hhhhhhhhhhHH', '..hH........hH', '..hH........hH'] },                                                                                                                                                                              // マッシュ
  bald: { y: 7, top: 6, rows: ['.....4sssss', '....4sssssss', '...4ssssssssS', '...4ssssssssS', '...s........S', '...s........S'] },   // はげ頭（髪のふくらみがないぶん、頭を左右1ドットずつ小さく）
  highpony: { y: 6, top: 7, rows: ['............hhH', '.....hhhhhh.hhhH', '....hhhhhhhhqhhH', '...hhhhhhhhhh.hhH', '...hhhhhhhhhh.hhH', '..hhhhhhhhhhHH.hH', '..hHh......hhH.hH', '..hH........hH..H', '..hh........hH', '..hhh......hhH', '..hhHH....HHhH', '...HH......HH'] },   // ハイポニー（高い位置で結び、右上から垂らす）
  sidepony: { y: 7, rows: ['.....hhhhhh', '....hhhhhhhh', '...hhhhhhhhhh', '...hhhhhhhhhh', '..hhhhhhhhhhHH', '..hHh......hhHq', '..hH........hHhhH', '..hh........hHhhH', '..hhh......hhHhhH', '..hhHH....HHhHhhH', '...HH......HH.hhH', '...............hH', '................H'] },   // サイドテール（耳の横で結び、肩に垂らす）
  odango: { y: 5, top: 7, rows: ['...hh......hh', '..hhhH....hhhH', '.....hhhhhh', '....hhhhhhhh', '...hhhhhhhhhh', '...hhhhhhhhhh', '..hhhhhhhhhhHH', '..hHh......hhH', '..hH........hH', '..hh........hH', '...hh......hH', '....HH....HH'] },   // 左右お団子
  halfup: { y: 6, top: 7, rows: ['.......hqH', '.....hhhhhh', '....hhhhhhhh', '...hhhhhhhhhh', '...hhhhhhhhhh', '..hhhhhhhhhhHH', '..hHh......hhH', '..hH........hH', '..hh........hH', '..hhh......hhH', '..hhHH....HHhH', '..hh........hH', '..hh........hH', '..hH.........H', '..hH.........H', '..HH.........H', '...H.........H'] },   // ハーフアップ（てっぺんで小さく結ぶ）
  ahoge: { y: 5, top: 7, rows: ['.........h', '........h', '.....hhhhhh', '....hhhhhhhh', '...hhhhhhhhhh', '...hhhhhhhhhh', '..hhhhhhhhhhHH', '..hHh......hhH', '..hH........hH', '..hh........hH', '..hhh......hhH', '..hhHH....HHhH', '...HH......HH'] },   // アホ毛つきボブ
  drill: { x: -1, y: 7, rows: ['......hhhhhh', '.....hhhhhhhh', '....hhhhhhhhhh', '....hhhhhhhhhh', '...hhhhhhhhhhHH', '.hhhHh......hhHhH', '.hHhH........hHhH', '.HHhh........hHHH', '.hhhhh......hhHhH', '.hHhhHH....HHhHhH', '.HH............HH', '.hh............hH', '.hH............hH', '..H............H'] },   // 縦ロール（左右に巻き髪。3行ごとに巻きの段）
  fluffy: { y: 7, rows: ['.....hhhhhh', '....hhhhhhhh', '...hhhhhhhhhh', '...hhhhhhhhhh', '..hhhhhhhhhhHH', '..hHh......hhH', '.hhH........hHH', '.hhh........hhH', '.hhhh......hhhH', '.hhhHH....HHhhH', '..HHH......HHH'] },   // ふわボブ（下がふくらむ）
  shortM: { y: 6, rows: ['.....hhhhhh', '....h333hhhh', '...h33hhhhhhh', '..hh3hhh3hhhhH', '..hhhhhhhhhhHH', '..hhhhhh.hhhHH', '..hH........hH', '..H..........H'] },   // 男：てっぺんが1ドット上
  // 以下は追加分（2026-11-18、Sonnet が作成。依頼者の確認待ち）
  curl: { y: 7, rows: ['.....hhhhhh', '....hhhhhhhh', '...hhhhhhhhhh', '...hhhhhhhhhh', '..hhhhhhhhhhHH', '..hHh......hhH', '.hhH........hHh', '.hhh........hhH', '.hhhh......hhhH', '.hhhHH....HHhhH', '.hHhh........hhHH', '.hhHH........HhhH', '..hhHh.......hHhH', '..HhhH.......HhhH', '...HHh.......hHH'] },   // ロングの巻き髪（毛先が肩の前で2回まるくふくらむ）
  bobbang: { y: 7, rows: ['.....hhhhhh', '....hhhhhhhh', '...hhhhhhhhhh', '...hhhhhhhhhh', '..hhhhhhhhhhHH', '..hhh..hh..hhH', '..hH........hH', '..hh........hH', '..hhh......hhH', '..hhHH....HHhH', '...hHH....HHh'] },   // ショートボブ・前髪ぱっつん（まつげの行に前髪を1行かぶせる。まつげと目は残す）
  lowtwin: { y: 7, rows: ['.....hhhhhh', '....hhhhhhhh', '...hhhhhhhhhh', '...hhhhhhhhhh', '..hhhhhhhhhhHH', '..hHh......hhH', '..hH........hH', '..hh........hH', '..hhh......hhH', '..hhHH....HHhH', '..hhHh....hHhh', '..hqHh....hHqh', '.hhhHh....hHhhh', '.hhHhH....HhHhh', '.hHhhH....HhhHh', '...HHh....hHH'] },   // ゆるい二つ結び（低い位置で結び、肩の前に垂らす）
  pixie: { y: 7, rows: ['.....hhhhhh', '....hhhhhhhh', '...hhhhhhhhhh', '...hhhhhhhhhh', '..hhhhhhhhhhHH', '..hhh..hh...hH', '..hH........hH'] },   // ベリーショート（耳のうえまで。前髪は左が長い）
  slickM: { y: 6, rows: ['.....hhhhhh', '....hhHhhHhh', '...hhhHhhHhhh', '..hhhhHhhHhhhH', '..hhhhhhhhhhHH', '..hh........hH', '..hH........hH', '..H..........H'] },   // オールバック（男。ひたいを出し、後ろへなでつけた筋）
  curlyM: { y: 5, top: 6, rows: ['....hh.hh.hh', '....hhhhhhhh', '...hhHhhhhHhh', '..hhhHhhhhHhhh', '..hhhhhhhhhhhH', '..hhhhHhhhhHHH', '..hhhh.hh.hhHH', '..hH........hH', '..Hh........hH'] },   // くせ毛（男。てっぺんがもこもこ、前髪はまばら）
  tiedM: { y: 6, rows: ['.....hhhhhh', '....hhhhhhhh', '...hhhhhhhhhh', '..hhhhhhhhhhhH', '..hhhhhhhhhhHH', '..hhhh....hhHH', '..hH........hHhH', '..H..........HhH', '..............qq', '.............hhhH', '.............hhHh', '.............hhHH', '..............hHh', '..............hHH', '...............Hh'] },   // 後ろで結んだ長髪（男。右の後ろにたばを垂らす）
  // 以下は追加分その2（2026-11-18、Sonnet が作成。依頼者の確認待ち）
  outcurl: { y: 7, rows: ['.....hhhhhh', '....hhhhhhhh', '...hhhhhhhhhh', '...hhhhhhhhhh', '..hhhhhhhhhhHH', '..hHh......hhH', '..hH........hH', '..hh........hH', '..hhh......hhH', '..hhHH....HHhH', '..hh........hH', '.hhH.........HhH', 'hhhH..........hHhh', '.hhH...........hhH'] },   // 外はねミディアム（肩のあたりで毛先が外へはねる）
  sidebraid: { y: 7, rows: ['.....hhhhhh', '....hhhhhhhh', '...hhhhhhhhhh', '...hhhhhhhhhh', '..hhhhhhhhhhHH', '..hHh......hhH', '..hH........hH', '..hh........hH', '..hhh......hhH', '..hhHH....HHhH', '..hh........hhH', '..hH.........hHh', '..H.........hhH', '.............hHh', '............hhH', '............qq'] },   // 片側の三つ編み（右の肩から前へ垂らし、先を赤い紐で結ぶ）
  layered: { y: 7, rows: ['.....hhhhhh', '....hhhhhhhh', '...hhhhhhhhhh', '...hhhhhhhhhh', '..hhhhhhhhhhHH', '..hHh......hhH', '..hH........hH', '..hh........hH', '..hhh......hhH', '..hhHH....HHhH', '..hhh......hhhH', '.hhhH......HhhH', '.hhH........hHhH', '..hH.........HhH', '..hH..........HH'] },   // レイヤーロング（内側の毛先が顔の側へ、外側が長く段になる）
  inbob: { y: 7, rows: ['.....hhhhhh', '....hhhhhhhh', '...hhhhhhhhhh', '...hhhhhhhhhh', '..hhhhhhhhhhHH', '..hHh......hhH', '..hH........hH', '..hh........hH', '..hhh......hhH', '..hhHH....HHhH', '..hhhH....HhhH', '...HHh....hHH'] },   // 内巻きボブ（毛先が内側へ巻く）
  wolfM: { y: 5, top: 6, rows: ['....hh.hh.h', '.....hhhhhh', '....hhhhhhhh', '...hhhhhhhhhh', '..hhhhhhhhhhhH', '..hhhhhhhhhhHH', '..hhhhhh.hhhHH', '.hhH........hHH', '.hhH........hHH', '.hhh........hhH', '.hhH........hHH', '..hH........hHH', '..hh........hH', '..hH.........H', '...H.........H'] },   // ウルフ（男。てっぺんが逆立ち、横と襟足が外へ流れる）
  buzzM: { y: 6, rows: ['.....hhhhhh', '....hhhhhhhh', '...hhhhhhhhhh', '..hhhhhhhhhhhH', '..hhhhhhhhhhHH', '..hhhhTTTThhHH', '..hH........hH', '..hh........hH'] },   // 坊主に近い短髪（男。生えぎわが薄く、前髪の中ほどに地肌が透ける）
  sweptM: { y: 6, rows: ['.....hhhhhh', '....hhhhhhhh', '...hhhhhhhhhh', '..hhhhhhhhhhhH', '..hhhhhhhhhhHH', '..hhhhhhhhh.HH', '..hH.......hhhH', '..hH........hH', '..hh........hH', '..hh........hH', '..H..........H'] },   // 流し前髪（男。前髪を右へ流し、ひたいの右を少し出す）
  mediumM: { y: 6, rows: ['.....hhhhhh', '....hhhhhhhh', '...hhhhhhhhhh', '..hhhhhhhhhhhH', '..hhhhhhhhhhHH', '..hhhhhh.hhhHH', '..hhH.......hhH', '..hhH.......hhH', '..hhH.......hhH', '..hHh.......hHH', '..hhH.......hhH', '.hhhH........hhH', '.hhH..........hH', '.hH...........hH', '..H............H'] },   // 肩までの長髪（男。後ろで束ねず、顔のまわりに下ろす）
};
const TOPS = {
  // セーラー服（Claude の下描き。依頼者が採用 2026-11-18。直しは髪の光2ドットだけで、服はそのまま）：白い上衣、紺の襟、赤いスカーフ。腕と胴の区切りは、白い服なので灰色（V）
  sailor: { y: 17, rows: ['...wccC..CccW', '...wwcc..ccwW', '..wwVwcrrcwVwW', '..wwVwwrrwwVwW', '..wwVwwwrwwVwW', '...WVwwwwwwVWW', '.4sVwwwwwwwWVsS', '.sSVWWWWWWWWVSS'] },
  // 学ラン（Claude の下描き。依頼者の修正待ち）：詰め襟に白い線、金ボタン、前の合わせ目
  gakuran: { y: 17, rows: ['...1aaawwaaaA', '...1aaagXaaaA', '..1aXaagXaaXaA', '..1aXaaaXaaXaA', '..1aXaagXaaXaA', '...AXaaaXaaXAA', '.4sX1aagXaaAXsS', '.sSXAAAAAAAAXSS'] },
  suit: { y: 17, rows: ['...1aaXwwXaaA', '...1aAwrrwAaA', '..1aXAwrrwAXaA', '..1aXaArrAaXaA', '..1aXaaAAaaXaA', '...AXaaKaaaXAA', '.4sX1aaaaaaAXsS', '.sSXAAAAAAAAXSS'] },          // 背広：白いシャツ・ネクタイ・襟
  smock: { y: 17, rows: ['...1aaX..XaaA', '...1aaA..AaaA', '..1aXaaaaaaXaA', '..1aXaaaaaaXaA', '..1aXaaaaaaXaA', '...AXddddddXAA', '.4sX1aaaaaaAXsS', '.sSX1aaAaaaAXSS'] },         // 村人の上着：ひもの帯
  robe: { y: 17, rows: ['...1aaX..XaaA', '...1aag..gaaA', '..1aXaaggaaXaA', '..1aXaaggaaXaA', '..1aXaaggaaXaA', '...AXKKggKKXAA', '.4sX1aaggaaAXsS', '.sSX1aaggaaAXSS'] },          // ローブ：金のふち
  armor: { y: 17, rows: ['..LmmMX..XmmmM', '..LmmMm..mMmmM', '..LmXLmmmmMXmM', '..LmXLmmmmMXmM', '..1aXmmmmMMXaA', '...AXKKggKKXAA', '.LmXmmmmmmMMXmM', '.mMXMMMMMMMMXMM'] },         // 鎧：肩当て・胸当て・こて
  kimono: { y: 17, rows: ['...1awX..XwaA', '...1aaw..waaA', '..1aXaawAaaXaA', '..1aXaaaAaaXaA', '..1aXbbbbbbXaA', '...AXbBbbBbXAA', '.4sX1aaaaaaAXsS', '.sSX1aaAaaaAXSS'] },        // 着物：白い襟のV字・合わせ目・帯
  coat: { y: 17, rows: ['...wwwV..VwwW', '...wwVa..aVwW', '..wwVwVaaVwVwW', '..wwVwVaaVwVwW', '..wwVwwVVwwVwW', '...WVwwwKwwVWW', '.4sVwwwwwwwWVsS', '.sSVwwwwwwwWVSS'] },          // 白衣：中に色の服
  dress: { y: 17, rows: ['...1aaX..XaaA', '...1aaw..waaA', '..1aXaaaaaaXaA', '..1aXaaaaaaXaA', '..1aXaawwaaXaA', '...AXwwwwwwXAA', '.4sX1wwwwwwAXsS', '.sSX1wwwwwwAXSS'] },         // 村娘の服：白い襟と前掛け
  hoodie: { y: 17, rows: ['...1aaX..XaaA', '...1aaw..waaA', '..1aXawaawaXaA', '..1aXaaaaaaXaA', '..1aXaAAAAaXaA', '...AXaAAAAaXAA', '.4sX1aaaaaaAXsS', '.sSXAAAAAAAAXSS'] },        // パーカー：ひもと前ポケット
  vest: { y: 17, rows: ['...1aaX..XaaA', '...1adD..DdaA', '..1aXDddddDXaA', '..1aXDddddDXaA', '..1aXDddddDXaA', '...AXKKKKKKXAA', '.4sX1aaaaaaAXsS', '.sSXAAAAAAAAXSS'] },          // 革の胴着
  cassock: { y: 17, rows: ['...1aaXwwXaaA', '...1aaawwaaaA', '..1aXaaggaaXaA', '..1aXaggggaXaA', '..1aXaaggaaXaA', '...AXaaggaaXAA', '.4sX1aaaaaaAXsS', '.sSX1aaAaaaAXSS'] },       // 神官服：白い襟と金の十字
  royal: { y: 17, rows: ['...wwwX..XwwW', '...1awg..gwaA', '..1aXaaggaaXaA', '..1aXaaggaaXaA', '..1aXaaggaaXaA', '...AXggggggXAA', '.4sX1aaggaaAXsS', '.sSXwwwwwwwwXSS'] },         // 王の衣：白い毛皮の襟と金
  shinobi: { y: 17, rows: ['...1aaaaaaaaA', '...1aaAaaAaaA', '..1aXaaAAaaXaA', '..1aXaAaaAaXaA', '..1aXaaaaaaXaA', '...AXqqqqqqXAA', '.KKX1aaaaaaAXKK', '.KKXAAAAAAAAXKK'] },       // 忍び装束：首まで覆う・赤い帯・手甲
  tshirt: { y: 17, rows: ['...1aaX..XaaA', '...1aaa..aaaA', '..1aXaaaaaaXaA', '..4sXaaaaaaXsS', '..4sXaaaaaaXsS', '...SXaaaaaaXSS', '.4sXaaaaaaaAXsS', '.sSXAAAAAAAAXSS'] },        // Tシャツ（半袖）
  apron: { y: 17, rows: ['...1aaX..XaaA', '...1aaw..waaA', '..1aXawwwwaXaA', '..1aXwwwwwwXaA', '..1aXwwwwwwXaA', '...AXwwwwwwXAA', '.4sXwwwwwwwWXsS', '.sSXwwwwwwwWXSS'] },         // 前掛け
  // 以下は追加分（2026-11-18、Sonnet が作成。依頼者の確認待ち）
  academy: { y: 17, rows: ['...1aaXwwXaaA', '...1aagwwgaaA', '..1aXawrrwaXaA', '..1aXaArrAaXaA', '..1aXaaAAaaXaA', '...AXAAggAAXAA', '.4sX1aaggaaAXsS', '.sSXAAAAAAAAXSS'] },       // 魔法学園の制服：白いシャツ・赤いネクタイ・金の縁と紋章
  dancer: { y: 17, rows: ['...4ssS..SssS', '...4saa..aasS', '..4sSaaaaaaSsS', '..4sSggggggSsS', '..4sS4ssssSSsS', '...SSggqqggSSS', '.4sXaaaaaaaaXsS', '.sSXAgAAAAgAXSS'] },     // 踊り子の衣装：胸あて（色）と金のふち、おなかの肌、金の帯に赤い宝石
  coverall: { y: 17, rows: ['...1aaX..XaaA', '...1aaA..AaaA', '..1aXaaLmaaXaA', '..1aXaAmMAaXaA', '..1aXaaamMaXaA', '...AXddgGddXAA', '.4sX1aaLmaaAXsS', '.sSXAAaAAaaAXSS'] },     // 作業着のつなぎ：中央のファスナー・ポケット・革の帯
  dougi: { y: 17, rows: ['...wwWV..VWwW', '...wwVw..wVwW', '..wwVwWVwwwVwW', '..wwVwwWVwwVwW', '..wwVwwwWVwVwW', '...WVKKKKKKVWW', '.4sVwwwKKwwWVsS', '.sSVwwwKKwwWVSS'] },       // 道着：左前の合わせと黒帯（白い服なので区切りは灰色）
  gown: { y: 17, rows: ['...wwwX..XwwW', '...1aww..wwaA', '..1aXaagGaaXaA', '..1aXaAgGAaXaA', '..wwXaaAAaaXwA', '...AXggggggXAA', '.4sX1aaaaaaAXsS', '.sSX1aaAaaaAXSS'] },     // 貴族のドレスの上：白いレースの襟と袖口、金のひも
  traveler: { y: 17, rows: ['..ppppp..ppppP', '..ppppg..gpppP', '..ppPaDaaaaPpP', '..pPXaaDaaaXpP', '..1aXaaaDaaXaA', '...AXddggddXAA', '.4sX1aaaaaaAXsS', '.sSX1aaAaaaAXSS'] },     // 旅人の上着：肩から胸まで覆う短いマント・金の留め金・革の斜めひも
  tunic: { y: 17, rows: ['...1aaX..XaaA', '...1adn..dDaA', '..1aXnddddDXaA', '..1aXndDddDXaA', '..1aXdddddDXaA', '...AXKKggKKXAA', '.4sX1aaaaaaAXsS', '.sSX1aaAaaaAXSS'] },
  // 以下は追加分その2（2026-11-18、Sonnet が作成。依頼者の確認待ち）
  lightarmor: { y: 17, rows: ['...LmaX..XaMM', '...mMnd..dDMM', '..1aXnLmmMDXaA', '..1aXnmmmMDXaA', '..1aXdmmmMDXaA', '...AXKKggKKXAA', '.4sX1addddaAXsS', '.sSX1aDDDDaAXSS'] },   // 鎧の軽装：肩当てと革の胸当て、胸の中央に鉄板。腕と裾は布
  heavyarmor: { y: 17, rows: ['.LLmmMX..XmmMMM', '.LmmMMg..gMMmMM', '..LmXgLmmMgXmM', '..LmXLmaamMXmM', '..mMXLmaaMMXMM', '...MXKKggKKXMM', '.KKXLmmmmmMMXKK', '.KKXMMMMMMMMXKK'] },   // 鎧の重装：大きな肩当て・金のふち・胸の前掛け（色）・黒いこて
  miko: { y: 17, rows: ['...wwwV..VwwW', '...wwqV..VqwW', '..wwVwqwwqwVwW', '..wwVwwqqwwVwW', '..wwVwwwqwwVwW', '...WVqqqqqqVWW', '.4sVwwwwwwwWVsS', '.sSVqWWWWWWqVSS'] },   // 巫女：白い衣に赤い襟のV字と赤い帯、袖口に赤
  yukata: { y: 17, rows: ['...1awX..XwaA', '...1aaw..waaA', '..1aXawaaAwXaA', '..1aXaaAawaXaA', '..1aXwaaaAaXaA', '...AX2bbbbBXAA', '.4sX1aawaaaAXsS', '.sSX1aaAaaaAXSS'] },   // 浴衣：白い襟、白い花もよう、帯（下衣の色）
  bandolier: { y: 17, rows: ['...1aaX..XdDA', '...1aaa..adDA', '..1aXaaaadDXaA', '..1aXaaadDaXaA', '..1aXaadDaaXaA', '...AXKdDggKXAA', '.4sX1adDaaaAXsS', '.sSX1aDDaaaAXSS'] },   // 盗賊の革服：肩から斜めにかけた革ひも、金の留め金、腰のふくろ
  samue: { y: 17, rows: ['...1aAX..XAaA', '...1aaA..AaaA', '..1aXaaAAaaXaA', '..1aXaaaAaaXaA', '..1aXaaAaaaXaA', '...AXaAAAAaXAA', '.4sX1aaaaaaAXsS', '.sSX1aAaaAaAXSS'] },   // 作務衣：合わせ襟のV字と腰のひも、腰のポケット
  blazer: { y: 17, rows: ['...1aaXwwXaaA', '...1aArwwrAaA', '..1aXAwwwwAXaA', '..1aXgAwwAaXaA', '..1aXaaAgaaXaA', '...AXaaAgaaXAA', '.4sX1aaaaaaAXsS', '.sSXAAAAAAAAXSS'] },   // ブレザー：白いシャツ、赤いリボン、胸の紋章
  sweater: { y: 17, rows: ['...1a11..11aA', '...1aa1..1aaA', '..1aXaAaaAaXaA', '..1aXAaAAaAXaA', '..1aXaAaaAaXaA', '...AXAaAAaAXAA', '.4sX1aAaaAaAXsS', '.sSXAaAaAaAAXSS'] },   // セーター：えりの編み目と縄編み
};
const BOTTOMS = {
  skirt: { y: 25, rows: ['...2bbbbbbbbB', '...BBbBBBBbBB', '....4sSXXssS', '....4sSXXssS', '...nddDXXnddD', '...nddD..dddD', '...DDD....DDD'] },
  // プリーツスカート・白い靴下・革靴（Claude の下描き。依頼者が採用 2026-11-18）
  pleats: { y: 25, rows: ['...2bbbbbbbbB', '...BBbBBBBbBB', '....4sSKKssS', '....wwVKKwwV', '...dDDKKKdDDK', '...dDDK..dDDK', '...KKK....KKK'] },
  // 学生ズボンと黒い革靴（Claude の下描き。依頼者の修正待ち）
  slacks: { y: 25, rows: ['...2bbbbbbbbB', '...2bbbKKbbbB', '....2bbKKbbB', '....2bbKKbbB', '...dDDKKKdDDK', '...dDDK..dDDK', '...KKK....KKK'] },
  robeskirt: { y: 25, rows: ['...1aaaggaaaA', '...1aaaggaaaA', '...1aaaggaaaA', '...1aaaggaaaA', '..1aaaaggaaaaA', '..aaaaaggaaaAA', '..AAAAAggAAAAA'] },                              // ローブの裾（足もとまで）
  greaves: { y: 25, rows: ['...LmmmmmmmmM', '...2bbbKKbbbB', '....LmMKKmmM', '....LmMKKmmM', '...LmmMKKLmmM', '...mmMM..mmMM', '...MMM....MMM'] },                                // 腰当てとすね当て
  hakama: { y: 25, rows: ['...2bbbbbbbbB', '...2bbBbbBbbB', '...2bbBbbBbbB', '...2bbBbbBbbB', '...BBBBBBBBBB', '....4s....sS', '...DDD....DDD'] },                                 // 袴と草履
  kimonoskirt: { y: 25, rows: ['...1aaaAaaaaA', '....1aaAaaaA', '....1aaAaaaA', '....1aaAaaaA', '....AAAAAAAA', '....ww....wW', '...DDD....DDD'] },                              // 着物の裾・足袋・草履
  coatskirt: { y: 25, rows: ['...wwwwVwwwwW', '...WWWWVWWWWW', '....2bbKKbbB', '....2bbKKbbB', '...dDDKKKdDDK', '...dDDK..dDDK', '...KKK....KKK'] },                              // 白衣の裾とズボン
  dressskirt: { y: 25, rows: ['...1awwwwwwaA', '..1aawwwwwwaaA', '..1aaWWWWWWaaA', '..AAAAAAAAAAAA', '....wwV..wwV', '...dDDK..dDDK', '...KKK....KKK'] },                           // 前掛けつきのスカート
  jeans: { y: 25, rows: ['...2bbbbbbbbB', '...2bbbKKbbbB', '....2bbKKbbB', '....2bbKKbbB', '...wwwVKKwwwV', '...wwwV..wwwV', '...VVV....VVV'] },                                  // ズボンと白い運動靴
  shorts: { y: 25, rows: ['...2bbbbbbbbB', '...2bbbKKbbbB', '....4sSKKssS', '....4sSKKssS', '...wwwVKKwwwV', '...wwwV..wwwV', '...VVV....VVV'] },                                    // 短パンと運動靴
  longskirt: { y: 25, rows: ['...2bbbbbbbbB', '..2bbbbbbbbbbB', '..2bbBbbbbBbbB', '..2bbBbbbbBbbB', '..BBBBBBBBBBBB', '....dD....dD', '...KKK....KKK'] },                             // 長いスカート
  ninjapants: { y: 25, rows: ['...2bbbbbbbbB', '...2bbbKKbbbB', '....2bbKKbbB', '....wwVKKwwV', '...KKKKKKKKKK', '...KKKK..KKKK', '...KKK....KKK'] },                                // 忍びの下衣：脚絆と足袋
  // 以下は追加分（2026-11-18、Sonnet が作成。依頼者の確認待ち）
  plaidskirt: { y: 25, rows: ['...2bBbbBbbbB', '...BbBBbBBbBB', '....4sSKKssS', '....ccCKKccC', '...dDDKKKdDDK', '...dDDK..dDDK', '...KKK....KKK'] },     // 魔法学園のチェックのスカート・紺のハイソックス・革靴
  harem: { y: 25, rows: ['...2bbbbbbbbB', '..2bbbbKKbbbbB', '..2bbbbKKbbbBB', '...2bbBKKBbbB', '...ggGKKKggGK', '...4sSK..4ssS', '...DDD....DDD'] },     // 踊り子のゆったりしたズボン・金の足首かざり・はだし
  workpants: { y: 25, rows: ['...2bbbbbbbbB', '...2bbbKKbbbB', '....2bbKKbbB', '....2dDKKdDB', '...dmDKKKdmDK', '...dDDK..dDDK', '...KKK....KKK'] },     // 作業ズボン・ひざ当て・鉄のしめ具つきの靴
  gipants: { y: 25, rows: ['...wwwwwwwwV', '...wwwVKKwwwV', '....wwVKKwwV', '....wWVKKwWV', '....4sSKKssS', '...4ssS..4ssS', '...SSS....SSS'] },     // 道着のズボン・はだし
  pants: { y: 25, rows: ['...2bbbbbbbbB', '...2bbbXXbbbB', '....2bbXXbbB', '....2bbXXbbB', '...nddDXXnddD', '...nddD..dddD', '...DDD....DDD'] },
  // 以下は追加分その2（2026-11-18、Sonnet が作成。依頼者の確認待ち）
  cargo: { y: 25, rows: ['...2bbbbbbbbB', '...2bbbKKbbbB', '....2bBKKBbB', '....2bgKKgbB', '...dDDKKKdDDK', '...dDDK..dDDK', '...KKK....KKK'] },   // カーゴパンツ：ももの横のポケットと金のボタン・革靴
  tightsboots: { y: 25, rows: ['...2bbbbbbbbB', '...BBbBBBBbBB', '....cccKKccC', '....nddKKnddD', '...nddDKKnddD', '...nddD..dddD', '...DDD....DDD'] },   // 紺のタイツと茶色の長靴
  furkilt: { y: 25, rows: ['...nddddddddD', '...wwWwwWwwWW', '....4sSXXssS', '....4sSXXssS', '...nddDXXnddD', '...nddD..dddD', '...DDD....DDD'] },   // 毛皮の腰巻（革の帯と白い毛皮のふち）とブーツ
  yukataskirt: { y: 25, rows: ['...1aawAaaaaA', '....1aaAawaA', '....1aaAaaaA', '....AAAAAAAA', '....4s....sS', '...nddD..nddD', '...D..D..D..D'] },   // 浴衣の裾と下駄
  samuepants: { y: 25, rows: ['...2bbbbbbbbB', '..2bbbbKKbbbbB', '...2bbbKKbbbB', '....BbbKKbbB', '....4s....sS', '...dddD..dddD', '...DDD....DDD'] },   // 作務衣のゆったりしたズボン（裾をしぼる）と草履
};

// 髪の光の位置（x、頭の丸みのいちばん上の行から何行目）。手本の女の子の光と、セーラー服の絵で足された横の髪の2ドット。
//   左上のてっぺん寄りに弧（3＋2＋1）、前髪の中ほどに1点、左の横の髪に縦2ドット。
const HAIR_LIGHTS = [[5, 1], [6, 1], [7, 1], [4, 2], [5, 2], [4, 3], [8, 3], [2, 4], [2, 5]];

const HATS = {    // y は「髪のいちばん上の行」からの位置（女は髪が y7、男は y6 から始まるので、自動で合う）
  wizard: { y: -5, rows: ['.......1A', '......1aaA', '.....1aaaaA', '....1aaaaaaA', '...1aaaaaaaaA', '...gggggggggg', '.1aaaaaaaaaaaaA', '..AAAAAAAAAAAA'] },   // とんがり帽子（頭の真ん中に合わせた）
  helmet: { y: -1, hidesHair: true, rows: ['.....LLmmmm', '....Lmmmmmmm', '...LmmmmmmmmM', '..LmmmmmmmmmmM', '..LmmmmmmmmmMM', '..mMMMMMMMMMMM', '..mM........mM', '..mM........mM', '..MM........MM'] },   // かぶと（ほお当てつき。髪を隠す）
  hood: { y: 0, hidesHair: true, rows: ['.....1aaaaa', '....1aaaaaaa', '...1aaaaaaaaA', '...1aaaaaaaaA', '..aaAAAAAAAAaA', '..aA........aA', '..aA........aA', '..aa........aA', '..aaa......aaA', '..aaAA....AAaA'] },   // 頭巾（上衣と同じ色。髪を隠す）
  ninjahood: { y: 0, hidesHair: true, rows: ['.....1aaaaa', '....1aaaaaaa', '...1aaaaaaaaA', '...1aaaaaaaaA', '..aaaaaaaaaaaA', '..aA........aA', '..aA........aA', '..aaaaaaaaaaaA', '..aaaaaaaaaaaA', '..aaAAAAAAAAaA'] },  // 忍び頭巾（目だけ出す）
  chef: { y: -4, rows: ['....wwwwwwww', '....wwwwwwwW', '....wwwwwwwW', '.....wwwwwW', '....WWWWWWWW'] },                                                                                                                 // コック帽
  crown: { y: -1, rows: ['....g.gg.g.g'.slice(0, 12), '....gggggggg', '....gqggggqg'] },                                                                                                                                       // 王冠
  brim: { y: 0, rows: ['.....wwwwww'] },                                                                                                                                                                                      // メイドの白い髪飾り
  straw: { y: -1, rows: ['.....yyyyyy', '....yyyyyyyy', '.YyyyyyyyyyyyyY'] },                                                                                                                                                 // 麦わら帽子
  hardhat: { y: -1, rows: ['.....yyyyyy', '....yyyyyyyy', '...yyyyyyyyyY', '..YYYYYYYYYYYY'] },                                                                                                                               // 安全帽
  headband: { y: 3, rows: ['..qqqqqqqqqqqq'] },                                                                                                                                                                               // 鉢巻
  ribbon: { y: 0, rows: ['.........q.q', '.........qqq', '.........q.q'] },        // リボン（右上）
  band: { y: 2, rows: ['...qqqqqqqqqq'] },                                        // カチューシャ
  flower: { y: 1, rows: ['..........o', '.........oyo', '..........o'] },          // 花飾り
  // 以下は追加分（2026-11-18、Sonnet が作成。依頼者の確認待ち）
  beret: { y: -2, rows: ['.......1a', '....1aaaaaaa', '..1aaaaaaaaaaA', '...AAAAAAAAAA'] },   // ベレー帽（上衣の色。頭より左右へふくらむ）
  kerchief: { y: 0, rows: ['.....wwwwww', '....wwwwwwww', '...WwwwwwwwwwW', '.............wW', '..............W'] },   // 三角巾（頭の上3行だけを覆い、前髪を見せる。右うしろに結び目）
  flowercrown: { y: 1, rows: ['....o.w.y.q', '...fofwfyfqf'] },   // 花冠（葉の緑のあいだに、ピンク・白・黄・赤の花）
  sugegasa: { y: -3, rows: ['.......yy', '......yyyy', '.....yyyyyy', '..gyyyyyyyyyyY', '.gyyyyyyyyyyyyY', '.YYYYYYYYYYYYYY'] },   // 菅笠（円すい形で、つばが広い）
  cap: { y: 0, rows: ['.....1aaaaa', '....1aaaaaaa', '...1aaaaaaaaA', '..AAAAAAAAAAAAAA'] },                                                           // 帽子（つばが右へ出る）
  // 以下は追加分その2（2026-11-18、Sonnet が作成。依頼者の確認待ち）
  witch: { y: -5, rows: ['..........aA', '........1aaA', '.......1aaaaA', '.....1aaaaaaA', '....1aaaaaaaaA', '...AAAAAggAAAA', '.1aaaaaaaaaaaaA', '..AAAAAAAAAAAA'] },   // 魔女の帽子（先が右へ曲がる。金のバックルの帯）
  tiara: { y: -1, rows: ['.......g', '......gqg', '....gggggggG'] },   // ティアラ（中央に赤い宝石）
  catear: { y: -3, hidesHair: true, rows: ['....a......a', '...1ao....oaA', '...1aoa..aoaA', '.....1aaaaa', '....1aaaaaaa', '...1aaaaaaaaA', '...1aaaaaaaaA', '..aaAAAAAAAAaA', '..aA........aA', '..aA........aA', '..aa........aA', '..aaa......aaA', '..aaAA....AAaA'] },   // ねこ耳フード（上衣の色。内側のピンクの耳。髪は隠す）
  headphones: { y: 0, rows: ['.....LmmmmM', '....Lm....mM', '...Lm......mM', '..Lm........mM', '.oqK........KqK', '.oqK........KqK', '.oqK........KqK', '.qqK........KqK', '..KK........KK'] },   // ヘッドホン（頭の上のバンドと、赤い両耳のカップ）
  horned: { y: -4, hidesHair: true, rows: ['.w............w', '.wW..........Ww', '..wW........Ww', '...wWLLmmmMWw', '....Lmmmmmmm', '...LmmmmmmmmM', '..LmmmmmmmmmmM', '..LmmmmmmmmmMM', '..mMMMMMMMMMMM', '..mM........mM', '..mM........mM', '..MM........MM'] },   // 角つき兜（白い大きな角。髪を隠す）
  tophat: { y: -4, rows: ['.....LmKKKK', '.....LKKKKK', '.....mKKKKK', '.....mKKKKK', '.....aaaaaa', '..KKKKKKKKKKKK'] },   // シルクハット（帯は上衣の色）
};
const BEARDS = { long: { y: 15, rows: ['....wwwwwwww', '....wwwwwwwW', '.....wwwwwW', '......wwwW', '.......wW'] } };   // 長い白ひげ

// 右手の物（手は x13〜14、y23〜24）。x・y は置く位置
const pole = (n, c) => Array.from({ length: n }, () => c);
const HELD = {
  sword: { x: 13, y: 8, rows: ['..L'].concat(pole(13, '.Lm'), ['gGg']) },                 // 剣
  katana: { x: 13, y: 7, rows: pole(15, '.L').concat(['KgK']) },                          // 刀
  dagger: { x: 13, y: 17, rows: ['..L'].concat(pole(4, '.Lm'), ['gGg']) },                 // 短剣
  staff: { x: 13, y: 0, rows: ['.q', 'qLq', 'qqq', '.q'].concat(pole(27, '.n')) },                // 杖（柄は1ドット幅、先に宝玉）
  spear: { x: 13, y: 0, rows: ['.L', '.L', 'LmL', '.m'].concat(pole(27, '.n')) },                // 槍（柄は1ドット幅、穂先を大きく）
  scimitar: { x: 13, y: 10, rows: ['.....L', '....Lm', '....Lm', '...Lm', '...Lm', '..LLm', '..Lm', '..Lm', '.LLm', '.Lm', '.Lm', '.Lm', 'gGg'] },   // 曲刀（シミター。刃が外へ反る）
  rapier: { x: 13, y: 5, rows: pole(16, '.L').concat(['gLg', 'gGg']) },                                                                  // 刺突剣（レイピア。細く長い刃と、手を覆うつば）
  greatsword: { x: 13, y: 2, rows: ['..L'].concat(pole(18, '.LmM'), ['gGgGg', '..d']) },                                                 // 両手剣（幅3ドットの大きな刃）
  axe: { x: 13, y: 9, rows: ['.nLm', '.nLmm', '.nLmm', '.nMm'].concat(pole(11, '.n')) },                                                  // 斧
  battleaxe: { x: 12, y: 7, rows: ['mL.Lm', 'mLnLm', 'mmnmm', 'Mmnmm', '.MnM'].concat(pole(12, '..n')) },                                 // 両刃の大斧
  mace: { x: 13, y: 9, rows: ['.L', 'LmM', 'mmM', '.M'].concat(pole(11, '.n')) },                                                         // メイス
  hammer: { x: 12, y: 8, rows: ['mLLLm', 'mmmmM', 'MMMMM'].concat(pole(13, '..n')) },                                                     // 大槌
  club: { x: 13, y: 10, rows: ['.nn', 'nnD', 'nnD', '.nD', '.nD'].concat(pole(9, '.n')) },                                               // こん棒
  wand: { x: 13, y: 15, rows: ['.y', 'yLy', '.y'].concat(pole(5, '.n')) },                                                                // 短い杖
  naginata: { x: 13, y: 0, rows: ['..L', '.LL', '.Lm', '.Lm', '.m'].concat(pole(26, '.n')) },                                             // 薙刀
  hoe: { x: 12, y: 7, rows: ['.mmm', '.n.m'].concat(pole(23, '.n')) },                  // くわ
  bow: { x: 13, y: 14, rows: ['.nn', 'L..', 'L.n', 'L.n', 'L.n', 'L.n', 'L.n', 'L..', '.nn'] },   // 弓
  bag: { x: 12, y: 22, rows: ['..K', '.nddD', '.ddgD', '.dddD', '.DDDD'].map(r => r.slice(0, 4)) },   // かばん
  book: { x: 12, y: 21, rows: ['.ccC', '.cwC', '.ccC'] },                                 // 本
  basket: { x: 12, y: 23, rows: ['.nn', 'n..n', 'nnnn', 'DDDD'] },                        // かご
  // 以下は追加分（2026-11-18、Sonnet が作成。依頼者の確認待ち）
  broom: { x: 13, y: 9, rows: pole(17, '.n').concat(['.q', '.yY', 'yyyY', 'yyyyY', 'yYyYY', 'YYYYY']) },   // ほうき（穂は下で広がる）
  pickaxe: { x: 12, y: 9, rows: ['mmLmm', 'M.n.M'].concat(pole(16, '..n')) },   // つるはし
  fishingrod: { x: 13, y: 12, rows: ['......n', '.....nW', '.....nW', '....n.W', '....n.W', '...n..W', '...n..q', '..n', '..n', '.n', '.n'] },   // 釣り竿（右上へ斜めに伸びる細い竿。先から短い糸と赤い浮き）
  torch: { x: 12, y: 12, rows: ['..q', '.qGq', 'qGgGq', 'qGyGq', '.GgG', '.DDD'].concat(pole(6, '..n')) },   // 松明（大きな炎：赤・橙・金・芯は黄）
  bouquet: { x: 13, y: 18, rows: ['.oq', 'yqoy', 'oyqo', '.wwW', '.wwW', '.wW', '..W'] },   // 花束（白い包みの上に花）
  lantern: { x: 13, y: 22, rows: ['.K', 'yyy', 'yLy', 'yyy'] },                           // ランタン
  // 以下は追加分その2（2026-11-18、Sonnet が作成。依頼者の確認待ち）
  whip: { x: 13, y: 14, rows: ['..nnnn', '.nn..dd', '.n....d', '.n....D', '.dn..DD', '.dDDDDn', '.dD...d', '.dD..dd', '.KK..K'] },   // むち（革の輪にまとめた長い鞭、先が垂れる。握りは革ひもと黒い石突き）
  lute: { x: 13, y: 6, rows: ['..DD', '..dD', '..nd', '..nd', '..nd', '..nd', '..nd', '..nd', '..nd', '..nd', '..nd', '.nnnnd', 'nnnnnnd', 'nnnKKnD', 'nnnKKnD', 'nnnnnnD', '.dnnndD', '..DDDD'] },   // リュート（長い首と丸い胴、音の穴）
  potion: { x: 13, y: 17, rows: ['.nd', '.wW', '.wW', 'wwffF', 'wfffF', 'wffFF', '.FFF'] },   // 薬びん（緑の液体、白いガラスの照り、コルク栓）
  phone: { x: 13, y: 16, rows: ['KKKKK', 'KLLwK', 'KLccK', 'KcccK', 'KccCK', 'KcCCK', 'KKmKK', '.KKK'] },   // スマホ（黒い枠、明るい画面に照り、下にボタン）
  shinai: { x: 13, y: 6, rows: ['.nn'].concat(pole(8, '.yY'), ['.qq'], pole(4, '.yY'), ['.nn', 'KKKK', '.dD', '.dD']) },   // 竹刀（竹の色の4本、赤い結び、革の握りとつば）
  fan: { x: 12, y: 15, rows: ['...gggg', '..gqwqwg', '.gwqwqwg', '.gqwqwqg', '..gwqwqg', '...gYYg', '..dY', '..d', '..d'] },   // 扇（開いた扇：金のふち、赤と白の骨が要から広がる）
  chochin: { x: 14, y: 13, rows: ['.KKKK', 'oqqqqG', 'qqwwqG', 'qwwwqG', 'KKKKKK', 'qwwwqG', 'qqwwqG', 'oqqqqG', '.KKKK', '.nG', 'n'] },   // 提灯（赤い和紙に白い明かり、黒い輪。下の持ち手を握る）
  scroll: { x: 13, y: 16, rows: ['.dD', 'yyyY', 'wwWV', 'wwWV', 'qqqq', 'wwWV', 'wwWV', '.dD'] },   // 巻物（白い紙、赤いひも、木の軸）
};
const OFF = { shield: { x: -2, y: 19, rows: ['.mmm', 'mLccm', 'mcccm', 'mccCm', 'mcCCm', '.mCm', '..m'] } };   // 左手の盾
  const BACKS = { cape: { y: 18, rows: ['...pppppppppp'].concat(pole(10, '..ppppppppppP'), ['..PPPPPPPPPPPP']) } };  // マント（体の後ろ。腕より内側に収める）

// ---- 体格 ----  標準の体を規則で変える。数字は y 座標（首 17〜18、胸 19〜21、帯 22、裾と手 23〜24、腰 25〜26、脚 27〜28、靴 29〜31）
//   widen [y0,y1]＝その行を左右へ1ドットずつ広げる／narrow＝細める／dup＝その行をもう1行足す／del＝その行を抜く
const BODYTYPES = {
  標準: {},
  細身: { narrow: [19, 26] },
  がっしり: { widen: [17, 24] },
  ふくよか: { widen: [20, 28] },
  長身: { dup: [20, 27] },
  小柄: { del: [21, 28] },
  子ども: { narrow: [19, 24], del: [20, 21, 28] },   // 胴を2行・脚を1行短く、胴を細く
};

// ---- 色 ----  髪・肌・瞳・上衣・下衣の色を入れ替えられる
const lumOf = c => 0.299 * parseInt(c.slice(1, 3), 16) + 0.587 * parseInt(c.slice(3, 5), 16) + 0.114 * parseInt(c.slice(5, 7), 16);
function palette(o) {
  o = o || {}; const hair = o.hair || '#a8552e', skin = o.skin || '#f2c9a0', skinS = o.skinShade || '#d9a066', eye = o.eye || '#2f8a5a', top = o.top || '#3565d2', bottom = o.bottom || '#28806f';
  const base = !o.hair && !o.top && !o.bottom && !o.skin;
  const p = { s: skin, S: skinS, T: mixc(skin, skinS, 0.52), 4: mixc(skin, '#fff6e0', 0.45),
    h: hair, 3: mixc(hair, '#fff3c8', 0.45), H: mixc(hair, '#1a1535', 0.42), J: mixc(hair, '#14152e', 0.62), j: mixc(skinS, '#14152e', 0.62),
    k: '#1a1c2c', v: '#d0d0d0', w: '#ffffff', e: eye, o: '#ffb3a4',
    a: top, 1: mixc(top, '#ffffff', 0.34), A: mixc(top, '#14102a', 0.38), X: lumOf(top) < 75 ? mixc(top, '#aab4e0', 0.34) : mixc(top, '#0a0c2a', 0.62),
    n: '#d0925a', d: '#a0623a', D: '#693826', K: '#261624', g: '#ffd34d', W: '#c9d1de', V: '#9aa6bd', m: '#b9c3cc', M: '#7f8aa0', L: '#eef2f5', q: '#d8455a', G: '#d98a2a', f: '#58a04a', F: '#34793f', y: '#e8c86a', Y: '#b8923a', p: o.cape || '#b13e53', P: mixc(o.cape || '#b13e53', '#14102a', 0.42), c: '#2f3f7a', C: '#1c2550', r: '#d8455a',
    b: bottom, 2: mixc(bottom, '#ffffff', 0.22), B: mixc(bottom, '#0a1a2a', 0.4) };
  if (base) Object.assign(p, { T: '#e5b492', 4: '#f8ddbd', j: '#685959', 1: '#5f93f2', A: '#223f96', X: '#17204f', 2: '#45b094', B: '#185552' });   // 手本の色
  return p;
}
// ---- 合成 ----  look: { body, eyes, hair, top, bottom, build 体格, colors }
function compose(look) {
  const M = 1, MX = M + PAD, w = GW + 2 + PAD * 2, h = GH + 2, px = new Array(w * h).fill(null), col = palette(look.colors);   // 左右に PAD ドットずつ余白
  const put = part => part && part.rows.forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) { const c = col[row[rx]]; if (!c) continue; const x = (part.x || 0) + rx + MX, y = part.y + ry + M; if (x >= 0 && y >= 0 && x < w && y < h) px[y * w + x] = c; } });
  // 体（首から下、y17〜31）は、いったん文字の升目に重ねてから、体格の規則で形を変える。服を体格ごとに描き直さなくて済む。
  const BT = BODYTYPES[look.build || '標準'] || {}, body = BODY[look.body || 'girl'];
  let grid = Array.from({ length: 15 }, () => new Array(GW).fill('.'));   // grid[0] が y17
  const lay = part => part && part.rows.forEach((row, ry) => { const y = part.y + ry - 17; if (y < 0 || y >= 15) return; for (let rx = 0; rx < row.length; rx++) if (row[rx] !== '.') grid[y][(part.x || 0) + rx] = row[rx]; });
  lay(body); lay(BOTTOMS[look.bottom || 'skirt']); lay(TOPS[look.top || 'tunic']);
  const inRange = (r, y) => r && y >= r[0] && y <= r[1];
  grid = grid.map((row, i) => { const y = i + 17, L = row.slice(0, 8), R = row.slice(8);
    if (inRange(BT.widen, y)) return [L[1], L[2], L[3], L[4], L[5], L[6], L[6], L[7], R[0], R[1], R[1], R[2], R[3], R[4], R[5], R[6]];      // 中央寄りの列を1つずつ足して、左右へ1ドットずつ広げる
    if (inRange(BT.narrow, y)) return ['.', L[0], L[1], L[2], L[3], L[4], L[5], L[7], R[0], R[2], R[3], R[4], R[5], R[6], R[7], '.'];       // 中央寄りの列を1つずつ抜いて、左右から1ドットずつ細める
    return row; });
  const rowsOut = []; grid.forEach((row, i) => { const y = i + 17; if ((BT.del || []).includes(y)) return; rowsOut.push(row); if ((BT.dup || []).includes(y)) rowsOut.push(row.slice()); });
  const startY = GH - rowsOut.length, dy = startY - 17;                    // 足の先を y31 に固定。背が変わるぶん、頭を上下させる
  if (BACKS[look.back]) put({ y: BACKS[look.back].y + dy, rows: BACKS[look.back].rows });   // 背中の物は体より先に描く
  rowsOut.forEach((row, i) => row.forEach((ch, x) => { const c = col[ch]; if (c) px[(startY + i + M) * w + x + MX] = c; }));
  const head = p => p && { x: p.x, y: p.y + dy, rows: p.rows };
  put({ y: body.y + dy, rows: body.rows.slice(0, 6) }); put(head(EYES[look.eyes || 'girl'])); put(head(BEARDS[look.beard]));
  // 髪の光：部品ごとに描かず、共通の決まりで入れる（依頼者「同じ形状なら同じ位置に。規則性を持って」）。
  //   位置は HAIR_LIGHTS（頭の丸みのいちばん上の行からの位置）。そこに髪の地の色（h）があるときだけ、光の色（3）に替える。
  const hairPart = HAIRS[look.hair || 'long'], hy = hairPart.y + dy;
  const hat = HATS[look.hat], bare = hat && hat.hidesHair;
  if (!bare) put({ x: hairPart.x, y: hy, rows: hairPart.rows.map(r => r.replace(/3/g, 'h')) });
  const dome = (hairPart.top == null ? hairPart.y : hairPart.top) + dy;
  if (!bare) for (const [x, oy] of HAIR_LIGHTS) { const row = hairPart.rows[dome + oy - hy]; if (row && /[h3]/.test(row[x - (hairPart.x || 0)] || '')) px[(dome + oy + M) * w + x + MX] = col[3]; }
  if (hat) put({ x: hat.x, y: dome + hat.y, rows: hat.rows });
  if (OFF[look.off]) put(OFF[look.off]);
  if (HELD[look.held]) { put(HELD[look.held]); put({ x: 13, y: 23, rows: ['s'] }); }   // 持ち物の上に、握る手を1ドット
  // ふち：左と上は少し明るく、右と下は暗く（手本と同じ付け方）
  const out = px.slice(), has = (x, y) => x >= 0 && y >= 0 && x < w && y < h && px[y * w + x];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (px[y * w + x]) continue; const nb = [[1, 0], [0, 1], [-1, 0], [0, -1]].filter(([dx, dy]) => has(x + dx, y + dy)).map(([dx, dy]) => px[(y + dy) * w + x + dx]); if (nb.length) out[y * w + x] = mixc(nb[0], '#14152e', has(x + 1, y) || has(x, y + 1) ? 0.62 : 0.8); }
  return { w, h, px: out };
}

const ROLES = [
  // 異世界
  ['冒険者・女', { hair: 'long', top: 'tunic', bottom: 'skirt' }],
  ['冒険者・男', { eyes: 'boy', hair: 'spikyM', top: 'tunic', bottom: 'pants', held: 'sword', colors: { hair: '#c8862e', eye: '#3b6fd0', top: '#c23b4a', bottom: '#5a5f7a' } }],
  ['女剣士', { hair: 'pony', top: 'tunic', bottom: 'skirt', held: 'sword', back: 'cape', colors: { hair: '#e0aa3c', eye: '#3b6fd0', top: '#f0f0f5', bottom: '#3a3f6e', cape: '#3565d2' } }],
  ['魔女', { hair: 'wavy', top: 'robe', bottom: 'robeskirt', hat: 'wizard', held: 'staff', colors: { hair: '#7a4fc0', eye: '#d8455a', top: '#3a2a5a' } }],
  ['老魔法使い', { eyes: 'boy', hair: 'oldM', top: 'robe', bottom: 'robeskirt', hat: 'wizard', beard: 'long', held: 'staff', build: '細身', colors: { hair: '#d8dde6', eye: '#3b6fd0', top: '#5d2a7a' } }],
  ['神官', { eyes: 'boy', hair: 'partM', top: 'cassock', bottom: 'robeskirt', held: 'book', colors: { hair: '#e0aa3c', eye: '#3b6fd0', top: '#f0f0f5' } }],
  ['シスター', { hair: 'long', top: 'cassock', bottom: 'robeskirt', hat: 'hood', colors: { eye: '#3b6fd0', top: '#2f3f7a' } }],
  ['盗賊', { eyes: 'boy', hair: 'shortM', top: 'vest', bottom: 'pants', hat: 'hood', held: 'dagger', colors: { eye: '#5a3a2a', top: '#4a4f5a', bottom: '#3a3f4a' } }],
  ['狩人', { hair: 'braid', top: 'vest', bottom: 'pants', held: 'bow', colors: { hair: '#8a5a2e', eye: '#3f9a52', top: '#3f9a52', bottom: '#6b4a32' } }],
  ['騎士・女', { hair: 'pony', top: 'armor', bottom: 'greaves', held: 'sword', back: 'cape', colors: { hair: '#e0aa3c', eye: '#3b6fd0', top: '#3565d2', bottom: '#3565d2', cape: '#3565d2' } }],
  ['騎士・男', { eyes: 'boy', hair: 'shortM', top: 'armor', bottom: 'greaves', hat: 'helmet', held: 'spear', off: 'shield', build: 'がっしり', colors: { hair: '#6b4226', eye: '#5a3a2a', top: '#c23b4a', bottom: '#c23b4a' } }],
  ['王', { eyes: 'boy', hair: 'oldM', top: 'royal', bottom: 'robeskirt', hat: 'crown', beard: 'long', back: 'cape', build: 'ふくよか', colors: { hair: '#d8dde6', eye: '#3b6fd0', top: '#b13e53', cape: '#b13e53' } }],
  ['姫', { hair: 'hime', top: 'dress', bottom: 'longskirt', hat: 'crown', colors: { hair: '#e0aa3c', eye: '#3b6fd0', top: '#f0a0b0', bottom: '#f0a0b0' } }],
  ['村娘', { hair: 'braid', top: 'dress', bottom: 'dressskirt', held: 'basket', colors: { hair: '#c8862e', eye: '#3f9a52', top: '#3f9a52' } }],
  ['村人・男', { eyes: 'boy', hair: 'shortM', top: 'smock', bottom: 'pants', held: 'hoe', colors: { hair: '#6b4226', eye: '#5a3a2a', top: '#b8894a', bottom: '#6b4a32' } }],
  ['宿屋の女将', { hair: 'bun', top: 'apron', bottom: 'longskirt', build: 'ふくよか', colors: { hair: '#8a5a2e', eye: '#5a3a2a', top: '#c23b4a', bottom: '#6b4a32' } }],
  ['料理人', { eyes: 'boy', hair: 'shortM', top: 'apron', bottom: 'pants', hat: 'chef', build: 'ふくよか', colors: { hair: '#2e2a35', eye: '#5a3a2a', top: '#f0f0f5', bottom: '#4a4f5a' } }],
  ['鍛冶屋', { eyes: 'boy', hair: 'bald', top: 'tshirt', bottom: 'pants', beard: 'long', held: 'hammer', build: 'がっしり', colors: { eye: '#5a3a2a', top: '#8a8f9a', bottom: '#6b4a32', skin: '#e0b088', skinShade: '#b8804a' } }],
  ['メイド', { hair: 'bob', top: 'dress', bottom: 'dressskirt', hat: 'brim', colors: { hair: '#2e2a35', eye: '#7a4fc0', top: '#2e2a35' } }],
  ['商人', { eyes: 'boy', hair: 'partM', top: 'vest', bottom: 'pants', held: 'bag', build: 'ふくよか', colors: { hair: '#8a5a2e', eye: '#5a3a2a', top: '#e8c86a', bottom: '#6b4a32' } }],
  ['踊り子', { hair: 'highpony', top: 'dress', bottom: 'longskirt', hat: 'flower', colors: { hair: '#c23b4a', eye: '#e0aa3c', top: '#e0aa3c', bottom: '#c23b4a' } }],
  ['町娘', { hair: 'sidepony', top: 'dress', bottom: 'dressskirt', hat: 'ribbon', colors: { hair: '#e8607e', eye: '#3b6fd0', top: '#5fa8c8' } }],
  ['武闘家・女', { hair: 'odango', top: 'tshirt', bottom: 'pants', colors: { hair: '#2e2a35', eye: '#7a4a2e', top: '#c23b4a', bottom: '#3a3f4a' } }],
  ['貴族の娘', { hair: 'drill', top: 'dress', bottom: 'longskirt', hat: 'band', colors: { hair: '#e0aa3c', eye: '#7a4fc0', top: '#7a4fc0', bottom: '#7a4fc0' } }],
  ['見習い魔法使い', { hair: 'ahoge', top: 'robe', bottom: 'robeskirt', held: 'book', build: '小柄', colors: { hair: '#8ad0e8', eye: '#3b6fd0', top: '#3f5fa8' } }],
  ['宿屋の娘', { hair: 'fluffy', top: 'apron', bottom: 'longskirt', colors: { hair: '#c8862e', eye: '#3f9a52', top: '#3f9a52', bottom: '#6b4a32' } }],
  ['エルフ風の娘', { hair: 'halfup', top: 'smock', bottom: 'skirt', held: 'bow', colors: { hair: '#d8dde6', eye: '#3f9a52', top: '#3f9a52', bottom: '#6b4a32' } }],
  ['砂漠の剣士', { eyes: 'boy', hair: 'longM', top: 'vest', bottom: 'pants', held: 'scimitar', hat: 'headband', colors: { hair: '#2e2a35', eye: '#e0aa3c', top: '#e8c86a', bottom: '#f0f0f5', skin: '#d9a877', skinShade: '#a8703f' } }],
  ['貴族の剣士', { eyes: 'boy', hair: 'partM', top: 'suit', bottom: 'pants', held: 'rapier', back: 'cape', colors: { hair: '#e0aa3c', eye: '#3b6fd0', top: '#3a3f6e', bottom: '#f0f0f5', cape: '#7a4fc0' } }],
  ['重戦士', { eyes: 'boy', hair: 'spikyM', top: 'armor', bottom: 'greaves', held: 'greatsword', build: 'がっしり', colors: { hair: '#c23b4a', eye: '#5a3a2a', top: '#4a4f5a', bottom: '#4a4f5a' } }],
  ['蛮族の戦士', { eyes: 'boy', hair: 'longM', top: 'vest', bottom: 'pants', held: 'battleaxe', build: 'がっしり', colors: { hair: '#c8862e', eye: '#5a3a2a', top: '#8a5a3a', bottom: '#6b4a32' } }],
  ['神官戦士', { hair: 'bob', top: 'cassock', bottom: 'robeskirt', held: 'mace', off: 'shield', colors: { hair: '#d8dde6', eye: '#3b6fd0', top: '#f0f0f5' } }],
  ['木こり', { eyes: 'boy', hair: 'shortM', top: 'smock', bottom: 'pants', held: 'axe', beard: 'long', build: 'がっしり', colors: { hair: '#6b4226', eye: '#5a3a2a', top: '#c23b4a', bottom: '#6b4a32' } }],
  // 追加分（異世界）
  ['魔法学園の生徒・女', { hair: 'bobbang', top: 'academy', bottom: 'plaidskirt', held: 'broom', colors: { hair: '#8a5a2e', eye: '#7a4fc0', top: '#2f3f7a', bottom: '#2f3f7a' } }],
  ['魔法学園の生徒・男', { eyes: 'boy', hair: 'curlyM', top: 'academy', bottom: 'slacks', held: 'book', colors: { hair: '#3a2a2e', eye: '#3b6fd0', top: '#7a2f3a', bottom: '#3a3f4a' } }],
  ['オアシスの踊り子', { hair: 'curl', top: 'dancer', bottom: 'harem', colors: { hair: '#2e2a35', eye: '#e0aa3c', top: '#c23b4a', bottom: '#5fa8c8', skin: '#d9a877', skinShade: '#a8703f' } }],
  ['洞窟の旅人', { eyes: 'boy', hair: 'tiedM', top: 'traveler', bottom: 'pants', held: 'torch', colors: { hair: '#6b4226', eye: '#3f9a52', top: '#5a6b4a', bottom: '#6b4a32', cape: '#8a5a3a' } }],
  ['舞踏会の令嬢', { hair: 'curl', top: 'gown', bottom: 'longskirt', held: 'bouquet', colors: { hair: '#e8607e', eye: '#3b6fd0', top: '#7a4fc0', bottom: '#7a4fc0' } }],
  ['坑夫', { eyes: 'boy', hair: 'curlyM', top: 'coverall', bottom: 'workpants', hat: 'hardhat', held: 'pickaxe', build: 'がっしり', colors: { hair: '#2e2a35', eye: '#5a3a2a', top: '#8a5a3a', bottom: '#5a5f6a' } }],
  ['花売りの娘', { hair: 'lowtwin', top: 'dress', bottom: 'dressskirt', hat: 'flowercrown', held: 'bouquet', colors: { hair: '#c8862e', eye: '#3f9a52', top: '#f0a0b0' } }],
  // 追加分その2（異世界）
  ['吟遊詩人', { eyes: 'boy', hair: 'wolfM', top: 'bandolier', bottom: 'cargo', held: 'lute', colors: { hair: '#c8862e', eye: '#3b6fd0', top: '#7a4fc0', bottom: '#4a4f5a' } }],
  ['薬屋の魔女', { hair: 'layered', top: 'robe', bottom: 'robeskirt', hat: 'witch', held: 'potion', colors: { hair: '#3a2a2e', eye: '#3f9a52', top: '#3a2a5a' } }],
  ['サーカスの団長', { eyes: 'boy', hair: 'sweptM', top: 'suit', bottom: 'slacks', hat: 'tophat', held: 'whip', colors: { hair: '#2e2a35', eye: '#5a3a2a', top: '#c23b4a', bottom: '#2c3150' } }],
  ['北の戦士', { eyes: 'boy', hair: 'wolfM', top: 'heavyarmor', bottom: 'greaves', hat: 'horned', held: 'axe', build: 'がっしり', colors: { eye: '#5a3a2a', top: '#3565d2', bottom: '#4a4f5a' } }],
  ['猫耳の盗賊', { hair: 'outcurl', top: 'bandolier', bottom: 'tightsboots', hat: 'catear', held: 'dagger', build: '細身', colors: { eye: '#e0aa3c', top: '#3a3f6e', bottom: '#c23b4a' } }],
  ['王女', { hair: 'outcurl', top: 'gown', bottom: 'longskirt', hat: 'tiara', held: 'wand', colors: { hair: '#e0aa3c', eye: '#3b6fd0', top: '#f0a0b0', bottom: '#f0a0b0' } }],
  ['錬金術師', { eyes: 'boy', hair: 'mediumM', top: 'robe', bottom: 'robeskirt', held: 'scroll', build: '細身', colors: { hair: '#6b4226', eye: '#3f9a52', top: '#5a8a6a' } }],
  ['蛮族の女戦士', { hair: 'layered', top: 'lightarmor', bottom: 'furkilt', held: 'axe', build: 'がっしり', colors: { hair: '#c23b4a', eye: '#5a3a2a', top: '#8a5a3a', skin: '#d9a877', skinShade: '#a8703f' } }],
  // 現代
  ['女子高生', { hair: 'long', top: 'sailor', bottom: 'pleats', held: 'bag', colors: { hair: '#3a2a2e', eye: '#7a4a2e', bottom: '#2f3f7a' } }],
  ['男子高生', { eyes: 'boy', hair: 'shortM', top: 'gakuran', bottom: 'slacks', colors: { hair: '#2e2a35', eye: '#5a3a2a', top: '#2c3150', bottom: '#2c3150' } }],
  ['会社員・男', { eyes: 'boy', hair: 'partM', top: 'suit', bottom: 'slacks', held: 'bag', colors: { hair: '#2e2a35', eye: '#5a3a2a', top: '#4a5670', bottom: '#4a5670' } }],
  ['会社員・女', { hair: 'bob', top: 'suit', bottom: 'pleats', colors: { hair: '#5a3528', eye: '#7a4a2e', top: '#3a3f6e', bottom: '#3a3f6e' } }],
  ['大学生・男', { eyes: 'boy', hair: 'bowl', top: 'hoodie', bottom: 'jeans', colors: { hair: '#5a3528', eye: '#5a3a2a', top: '#d8853a', bottom: '#3f5fa8' } }],
  ['大学生・女', { hair: 'shortF', top: 'hoodie', bottom: 'pleats', colors: { hair: '#e8607e', eye: '#7a4fc0', top: '#8ad0e8', bottom: '#f0f0f5' } }],
  ['医師', { eyes: 'boy', hair: 'partM', top: 'coat', bottom: 'coatskirt', build: '長身', colors: { hair: '#8a8f9a', eye: '#3b6fd0', top: '#5fa8c8', bottom: '#4a5670' } }],
  ['看護師', { hair: 'bun', top: 'coat', bottom: 'coatskirt', colors: { hair: '#5a3528', eye: '#7a4a2e', top: '#f0a0b0', bottom: '#f0f0f5' } }],
  ['小学生・男', { eyes: 'boy', hair: 'spikyM', top: 'tshirt', bottom: 'shorts', hat: 'cap', build: '子ども', colors: { hair: '#2e2a35', eye: '#5a3a2a', top: '#e8c86a', bottom: '#3f5fa8' } }],
  ['小学生・女', { hair: 'twin', top: 'tshirt', bottom: 'pleats', build: '子ども', colors: { hair: '#5a3528', eye: '#7a4a2e', top: '#f0a0b0', bottom: '#c23b4a' } }],
  ['引きこもり', { eyes: 'boy', hair: 'longM', top: 'hoodie', bottom: 'jeans', build: '細身', colors: { hair: '#2e2a35', eye: '#5a3a2a', top: '#5a5f6a', bottom: '#3a3f4a' } }],
  ['作業員', { eyes: 'boy', hair: 'shortM', top: 'smock', bottom: 'pants', hat: 'hardhat', build: 'がっしり', colors: { hair: '#2e2a35', eye: '#5a3a2a', top: '#5a8a6a', bottom: '#5a8a6a' } }],
  ['農家', { eyes: 'boy', hair: 'oldM', top: 'smock', bottom: 'pants', hat: 'straw', held: 'hoe', colors: { hair: '#d8dde6', eye: '#5a3a2a', top: '#5fa8c8', bottom: '#3f5fa8' } }],
  ['主婦', { hair: 'bun', top: 'apron', bottom: 'longskirt', held: 'basket', colors: { hair: '#5a3528', eye: '#7a4a2e', top: '#f0a0b0', bottom: '#3a3f6e' } }],
  // 追加分（現代）
  ['整備士・女', { hair: 'pixie', top: 'coverall', bottom: 'workpants', colors: { hair: '#2e2a35', eye: '#7a4a2e', top: '#3f5fa8', bottom: '#3f5fa8' } }],
  ['空手部の主将', { eyes: 'boy', hair: 'slickM', top: 'dougi', bottom: 'gipants', build: 'がっしり', colors: { hair: '#2e2a35', eye: '#5a3a2a' } }],
  ['週末の釣り人', { eyes: 'boy', hair: 'curlyM', top: 'tshirt', bottom: 'shorts', hat: 'straw', held: 'fishingrod', colors: { hair: '#5a3528', eye: '#5a3a2a', top: '#5fa8c8', bottom: '#6b4a32' } }],
  ['花屋の店員', { hair: 'lowtwin', top: 'apron', bottom: 'jeans', held: 'bouquet', colors: { hair: '#5a3528', eye: '#3f9a52', top: '#3f9a52', bottom: '#3f5fa8' } }],
  ['美術部の女子', { hair: 'bobbang', top: 'hoodie', bottom: 'plaidskirt', hat: 'beret', colors: { hair: '#2e2a35', eye: '#7a4fc0', top: '#c23b4a', bottom: '#3a3f6e' } }],
  ['給食当番', { hair: 'shortF', top: 'apron', bottom: 'jeans', hat: 'kerchief', colors: { hair: '#5a3528', eye: '#7a4a2e', top: '#f0f0f5', bottom: '#4a5670' } }],
  ['清掃員', { eyes: 'boy', hair: 'oldM', top: 'coverall', bottom: 'workpants', hat: 'kerchief', held: 'broom', colors: { hair: '#d8dde6', eye: '#5a3a2a', top: '#5a8a6a', bottom: '#5a8a6a' } }],
  // 追加分その2（現代）
  ['音楽好きの大学生', { eyes: 'boy', hair: 'wolfM', top: 'sweater', bottom: 'cargo', hat: 'headphones', held: 'phone', colors: { hair: '#2e2a35', eye: '#5a3a2a', top: '#5a7a9a', bottom: '#6b5a3a' } }],
  ['ブレザーの女子高生', { hair: 'outcurl', top: 'blazer', bottom: 'pleats', held: 'phone', colors: { hair: '#5a3528', eye: '#7a4a2e', top: '#3a3f6e', bottom: '#4a5670' } }],
  ['ブレザーの男子高生', { eyes: 'boy', hair: 'sweptM', top: 'blazer', bottom: 'slacks', held: 'book', colors: { hair: '#2e2a35', eye: '#5a3a2a', top: '#3a3f6e', bottom: '#4a4f5a' } }],
  ['剣道部の女子', { hair: 'inbob', top: 'dougi', bottom: 'hakama', held: 'shinai', colors: { hair: '#2e2a35', eye: '#7a4a2e', bottom: '#2c3150' } }],
  ['自転車の配達員', { eyes: 'boy', hair: 'buzzM', top: 'hoodie', bottom: 'cargo', hat: 'cap', held: 'bag', build: '細身', colors: { hair: '#2e2a35', eye: '#5a3a2a', top: '#3f9a52', bottom: '#4a4f5a' } }],
  ['大学院生', { hair: 'layered', top: 'sweater', bottom: 'jeans', held: 'book', colors: { hair: '#5a3528', eye: '#7a4a2e', top: '#d8c8a0', bottom: '#3f5fa8' } }],
  ['ライブ帰りの会社員', { hair: 'sidebraid', top: 'sweater', bottom: 'tightsboots', hat: 'headphones', held: 'phone', colors: { hair: '#e8607e', eye: '#7a4fc0', top: '#c23b4a', bottom: '#3a3f6e' } }],
  ['ラーメン屋の店主', { eyes: 'boy', hair: 'buzzM', top: 'samue', bottom: 'samuepants', hat: 'headband', build: 'ふくよか', colors: { hair: '#2e2a35', eye: '#5a3a2a', top: '#2c3150', bottom: '#2c3150' } }],
  // 過去の日本
  ['町人・女', { hair: 'bun', top: 'kimono', bottom: 'kimonoskirt', colors: { hair: '#2e2a35', eye: '#5a3a2a', top: '#c23b4a', bottom: '#e8c84a' } }],
  ['女武者', { hair: 'pony', top: 'kimono', bottom: 'hakama', held: 'naginata', hat: 'headband', colors: { hair: '#2e2a35', eye: '#5a3a2a', top: '#7a4fc0', bottom: '#3a3f6e' } }],
  ['武士', { eyes: 'boy', hair: 'topknot', top: 'kimono', bottom: 'hakama', held: 'katana', colors: { hair: '#2e2a35', eye: '#5a3a2a', top: '#2f3f7a', bottom: '#6a6f7a' } }],
  ['忍者', { eyes: 'boy', hair: 'shortM', top: 'shinobi', bottom: 'ninjapants', hat: 'ninjahood', held: 'katana', colors: { eye: '#5a3a2a', top: '#2c3150', bottom: '#2c3150' } }],
  ['くノ一', { hair: 'pony', top: 'shinobi', bottom: 'ninjapants', hat: 'headband', held: 'dagger', colors: { hair: '#2e2a35', eye: '#7a4fc0', top: '#5d2a7a', bottom: '#5d2a7a' } }],
  ['巫女', { hair: 'hime', top: 'kimono', bottom: 'hakama', colors: { hair: '#2e2a35', eye: '#5a3a2a', top: '#f0f0f5', bottom: '#c23b4a' } }],
  ['僧侶', { eyes: 'boy', hair: 'bald', top: 'kimono', bottom: 'kimonoskirt', held: 'staff', colors: { eye: '#5a3a2a', top: '#3a3f4a', bottom: '#e8c84a' } }],
  ['姫（戦国）', { hair: 'hime', top: 'kimono', bottom: 'kimonoskirt', colors: { hair: '#2e2a35', eye: '#5a3a2a', top: '#f0a0b0', bottom: '#e8c84a' } }],
  ['百姓', { eyes: 'boy', hair: 'topknot', top: 'smock', bottom: 'shorts', hat: 'straw', held: 'hoe', colors: { hair: '#2e2a35', eye: '#5a3a2a', top: '#8a7a5a', bottom: '#6b4a32' } }],
  // 追加分（過去の日本）
  ['漁師', { eyes: 'boy', hair: 'curlyM', top: 'smock', bottom: 'shorts', hat: 'sugegasa', held: 'fishingrod', colors: { hair: '#2e2a35', eye: '#5a3a2a', top: '#5a7a9a', bottom: '#8a7a5a', skin: '#d9a877', skinShade: '#a8703f' } }],
  ['旅の浪人', { eyes: 'boy', hair: 'tiedM', top: 'traveler', bottom: 'hakama', hat: 'sugegasa', held: 'katana', colors: { hair: '#2e2a35', eye: '#5a3a2a', top: '#6a6f7a', bottom: '#3a3f4a', cape: '#5a4a3a' } }],
  ['柔道家（明治）', { eyes: 'boy', hair: 'slickM', top: 'dougi', bottom: 'gipants', colors: { hair: '#2e2a35', eye: '#5a3a2a' } }],
  ['寺の小坊主', { eyes: 'boy', hair: 'bald', top: 'smock', bottom: 'shorts', held: 'broom', build: '子ども', colors: { eye: '#5a3a2a', top: '#8a7a5a', bottom: '#8a7a5a' } }],
  ['花売り娘（江戸）', { hair: 'lowtwin', top: 'kimono', bottom: 'kimonoskirt', held: 'bouquet', colors: { hair: '#2e2a35', eye: '#5a3a2a', top: '#5fa8c8', bottom: '#e8c84a' } }],
  ['女中', { hair: 'bobbang', top: 'kimono', bottom: 'kimonoskirt', hat: 'kerchief', held: 'broom', colors: { hair: '#2e2a35', eye: '#5a3a2a', top: '#8a7a5a', bottom: '#6b4a32' } }],
  // 追加分その2（過去の日本）
  ['社務所の巫女', { hair: 'inbob', top: 'miko', bottom: 'hakama', colors: { hair: '#2e2a35', eye: '#5a3a2a', bottom: '#c23b4a' } }],
  ['神主', { eyes: 'boy', hair: 'sweptM', top: 'dougi', bottom: 'hakama', colors: { hair: '#2e2a35', eye: '#5a3a2a', bottom: '#5a7a9a' } }],
  ['縁日の浴衣の娘', { hair: 'sidebraid', top: 'yukata', bottom: 'yukataskirt', held: 'fan', colors: { hair: '#2e2a35', eye: '#5a3a2a', top: '#5fa8c8', bottom: '#c23b4a' } }],
  ['縁日の浴衣の青年', { eyes: 'boy', hair: 'sweptM', top: 'yukata', bottom: 'yukataskirt', held: 'fan', colors: { hair: '#2e2a35', eye: '#5a3a2a', top: '#2c3150', bottom: '#c8a870' } }],
  ['夜回りの町人', { eyes: 'boy', hair: 'buzzM', top: 'samue', bottom: 'samuepants', hat: 'headband', held: 'chochin', colors: { hair: '#2e2a35', eye: '#5a3a2a', top: '#5a6b4a', bottom: '#5a6b4a' } }],
  ['琵琶法師', { eyes: 'boy', hair: 'bald', top: 'kimono', bottom: 'kimonoskirt', hat: 'sugegasa', held: 'lute', colors: { eye: '#5a3a2a', top: '#3a3f4a', bottom: '#6a6f7a' } }],
  ['道場の娘', { hair: 'pony', top: 'dougi', bottom: 'hakama', hat: 'headband', held: 'shinai', colors: { hair: '#2e2a35', eye: '#7a4a2e', bottom: '#3a3f6e' } }],
  ['瓦版売り', { eyes: 'boy', hair: 'topknot', top: 'smock', bottom: 'shorts', hat: 'headband', held: 'scroll', colors: { hair: '#2e2a35', eye: '#5a3a2a', top: '#8a7a5a', bottom: '#6b4a32' } }],
  ['芸妓', { hair: 'bun', top: 'kimono', bottom: 'kimonoskirt', hat: 'flower', held: 'fan', colors: { hair: '#2e2a35', eye: '#5a3a2a', top: '#c23b4a', bottom: '#2c3150' } }],
];
  const LABELS = {
    hair: { long: 'ロング', bob: 'ボブ', pony: 'ポニーテール', twin: 'ツインテール', shortF: 'ショート', hime: '姫カット', braid: '三つ編み', wavy: 'ウェーブ', bun: 'お団子（1つ）', odango: '左右お団子', highpony: 'ハイポニー', sidepony: 'サイドテール', halfup: 'ハーフアップ', ahoge: 'アホ毛ボブ', drill: '縦ロール', fluffy: 'ふわボブ',
      shortM: '短髪（男）', spikyM: 'ツンツン（男）', partM: '七三分け（男）', oldM: '薄毛（男）', longM: '長髪（男）', topknot: 'まげ', bowl: 'マッシュ（男）', bald: 'はげ頭',
      curl: 'ロングの巻き髪', bobbang: 'ぱっつんボブ', lowtwin: 'ゆるい二つ結び', pixie: 'ベリーショート', slickM: 'オールバック（男）', curlyM: 'くせ毛（男）', tiedM: '結んだ長髪（男）',
      outcurl: '外はねミディアム', sidebraid: 'サイドの三つ編み', layered: 'レイヤーロング', inbob: '内巻きボブ', wolfM: 'ウルフ（男）', buzzM: '坊主に近い短髪（男）', sweptM: '流し前髪（男）', mediumM: '肩までの長髪（男）' },
    top: { tunic: '冒険者の上着', sailor: 'セーラー服', gakuran: '学ラン', suit: '背広', smock: '村人の上着', robe: 'ローブ', armor: '鎧', kimono: '着物', coat: '白衣', dress: '村娘の服', hoodie: 'パーカー', vest: '革の胴着', cassock: '神官服', royal: '王の衣', shinobi: '忍び装束', tshirt: 'Tシャツ', apron: '前掛け',
      academy: '魔法学園の制服', dancer: '踊り子の衣装', coverall: '作業着のつなぎ', dougi: '道着', gown: '貴族のドレスの上', traveler: '旅人のマント付き上着',
      lightarmor: '鎧の軽装', heavyarmor: '鎧の重装', miko: '巫女の衣', yukata: '浴衣', bandolier: '盗賊の革服', samue: '作務衣', blazer: 'ブレザー', sweater: 'セーター' },
    bottom: { skirt: 'スカートと長靴', pleats: 'プリーツスカート', slacks: '学生ズボン', pants: 'ズボン', robeskirt: 'ローブの裾', greaves: 'すね当て', hakama: '袴', kimonoskirt: '着物の裾', coatskirt: '白衣の裾', dressskirt: '前掛けスカート', jeans: 'ズボンと運動靴', shorts: '短パン', longskirt: '長いスカート', ninjapants: '忍びの下衣',
      plaidskirt: 'チェックのスカート', harem: '踊り子のズボン', workpants: '作業ズボン', gipants: '道着のズボン',
      cargo: 'カーゴパンツ', tightsboots: 'タイツと長靴', furkilt: '毛皮の腰巻', yukataskirt: '浴衣の裾と下駄', samuepants: '作務衣のズボン' },
    hat: { wizard: 'とんがり帽子', helmet: 'かぶと', cap: '帽子', hood: '頭巾', ninjahood: '忍び頭巾', chef: 'コック帽', crown: '王冠', brim: 'メイドの髪飾り', straw: '麦わら帽子', hardhat: '安全帽', headband: '鉢巻', ribbon: 'リボン', band: 'カチューシャ', flower: '花飾り',
      beret: 'ベレー帽', kerchief: '三角巾', flowercrown: '花冠', sugegasa: '菅笠',
      witch: '魔女の帽子', tiara: 'ティアラ', catear: 'ねこ耳フード', headphones: 'ヘッドホン', horned: '角つき兜', tophat: 'シルクハット' },
    held: { scimitar: '曲刀（シミター）', rapier: '刺突剣（レイピア）', greatsword: '両手剣', axe: '斧', battleaxe: '両刃の大斧', mace: 'メイス', hammer: '大槌', club: 'こん棒', wand: '短い杖', naginata: '薙刀', sword: '剣', katana: '刀', dagger: '短剣', staff: '杖', spear: '槍', hoe: 'くわ', bow: '弓', bag: 'かばん', book: '本', basket: 'かご', lantern: 'ランタン',
      broom: 'ほうき', pickaxe: 'つるはし', fishingrod: '釣り竿', torch: '松明', bouquet: '花束',
      whip: 'むち', lute: 'リュート', potion: '薬びん', phone: 'スマホ', shinai: '竹刀', fan: '扇', chochin: '提灯', scroll: '巻物' },
    off: { shield: '盾' }, back: { cape: 'マント' }, beard: { long: '長い白ひげ' }, eyes: { girl: '女の子の目', boy: '男の目' },
  };
  // 役柄の分類（一覧での並び）
  const GROUPS = [['異世界', 0, 48], ['現代', 48, 77], ['過去の日本', 77, ROLES.length]];
  g.Chara2 = { GW, GH, PAD, LABELS, mixc, BODY, EYES, HAIRS, TOPS, BOTTOMS, HATS, BEARDS, HELD, OFF, BACKS, HAIR_LIGHTS, BODYTYPES, palette, compose, ROLES, GROUPS };
})(typeof globalThis !== 'undefined' ? globalThis : window);
