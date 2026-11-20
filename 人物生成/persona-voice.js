// 話し方の型。言い回しの部品（persona-lines.js）の文を、型ごとの「一人称・文末の付け替え・決め語尾」で話し方にする。AIは使わない。
//   PersonaVoice.pick(person, rand)        → 合う型のキー（性別・年齢・仕事で絞り、気質・信条・仕事との相性でくじ引き）
//   PersonaVoice.pickMe(person, 型, rand)  → その人の一人称（人ごとに1回だけ決める）
//   PersonaVoice.apply(文, 型キー, rand, 一人称, 二人称, opts)
//        ①{私}を一人称に ②文を「。！？……」で区切り、文ごとに文末の種類を見分けて conv で付け替え ③tailRate の確率で最後の文に決め語尾
//        opts（省略可）：tone＝'normal'（既定）／'grave'（深刻・静か：芯の付け替えだけ）／'tense'（切迫：間のびする飾りを外す）、mono＝独り言（決め語尾と相手向けの語尾を外す）、up＝相手が目上（true。opts.rel==='up' でも可。〜って・〜じゃん・〜やん を付けない）
//        口ぐせ止め：kuse に挙げた規則（西・老人・武人・姫・王者・南の「〜てほしい」→ほしいんや 等）は、1つの台詞で2回目から付けない（規則なしの形に戻す）
//        動詞の活用（来る＝来・こ／する＝し／ていない／一段と五段）は naiOfDict・dictOfNai・NEG（TEFORM）に集めてある
//        乱数は、決め語尾を持つ型では必ず2回、持たない型では0回（入力・tone・mono によらず一定）
//   規則の「芯」と「飾り」：conv の各規則は、既定では芯（その人がその人であるための文末：〜じゃ・〜でござる・〜ですわ・〜や・〜どす・西や北の否定など）。
//        cls[規則] に 'L'（軽さ・決め：さ・ないさ・だよっ・っす 等）／'D'（間のび：ぉ・ですわね・のである 等）／'R'（相手に向ける：よ・ね・でしょ 等）の印を付けた規則と、
//        tails（決め語尾）・bang（「。」を「！」にする）が飾り。飾りは1つの台詞に多くて1文（最後の文を優先）。grave は飾りを全部外し、tense は D と K（切迫で外す軽い飾り）を外し、mono は R と tails を外す。
//        conv の規則は、文字列のほかに関数 (head, c)=>文 でもよい。人生第4回から、軽い語尾・方言の終止形は関数にして「文の中身（短さ・深刻さ・文の目印 HS）」で付けるかを決める（乱数は使わない）：SERIOUS／softOk／gate／NATTE／OTT／OTN／WF／NAI_MID
//        tailExp＝説明・伝聞に聞こえる決め語尾（のさ・のである・のじゃ）。動詞の終止形（意志かもしれない文）には付けない。tailCls＝決め語尾ごとの印。
//   依頼・命令の言い換え：req＝型ごとの頼み方（rough 荒い男／soft やわらかい女／neutral 性別によらない大人／…）。conv に imp・te・tekure・nasai を書かなければ req の規則が効く
//   PersonaVoice.classify(文の本体, 'da'|'desu') → 文末の種類。PersonaVoice.kinds(文, 'da'|'desu') → 文ごとの種類の配列
//
// 文末の種類（常体）：copneg「〜ではない」／negverb「動詞＋ない（行かない・見ない・しない）」／negadj「形容詞のない（金がない・はずがない・悪くない）」／
//   noda「〜のだ」／datta「〜だった」／darou「〜だろう」／dana「〜だな」／da「〜だ」／ka「〜か」／imp「命令・禁止」／vol「〜よう・〜おう」／
//   rec「〜がいい」／te「〜て・〜で」／ta「〜た」／v「動詞の終止形」／adj「形容詞の終止形」／other
//   細かい種類（conv に書いていなければ親の種類の規則が効く）：teiru「〜ている」（親 v）／teita「〜ていた」（親 ta）／teshimau「〜てしまう」（親 v）／
//   tehoshii「〜てほしい」（親 adj）／nasai「〜なさい」（親 adj）／tekure「〜てくれ」（親なし）／negta「〜なかった」（動詞の否定の過去：行かなかった・思っていなかった。親 ta）
// 文末の種類（敬体）：copneg／masenka／masuka／desuka／mashita／deshita／desune／mashou／deshou／masen／masu／desu／kudasai／other
//   細かい種類：teimasu「〜ています」（親 masu）／teimashita「〜ていました」（親 mashita）／tehoshiidesu「〜てほしいです」（親 desu）／masendeshita「〜ませんでした」（親 deshita）
// 規則：conv[種類] が文字列なら、その種類の末尾（SUF）を置き換える（v・adj・ta・vol などは末尾が空なので足すだけ）。関数なら (head, c)=>文 または [文, 句読点]。
//   conv に書いていない種類は「何もしない」。「？」で終わる文は q に書いた種類だけ付け替える。
// 追加の項目：tailKinds＝決め語尾を足してよい文末の種類（既定 v・adj）／w＝相性の重み／jobOnly＝この仕事の人だけ／jobBan＝この仕事の人には出ない／
//   noNoble＝貴族・王族・宮廷の人には出ない／jobAge＝[[仕事の正規表現, 上限年齢]]／noImp＝命令形を付け替えられない型（言わせる文から命令形を外す）
//   人生第6回の追加：q＝問いの文末の規則（下の「疑問文」）／ng＝気質・信条との相性が悪いときの重みの減点（pick）／wjob＝仕事による減点／bangSoft＝「！」を文末が変わった短い文にだけ付ける（元気な娘）／urgentSkip＝命令・警告の文で付け替えない文末の種類
//   疑問文：looksQuestion（PersonaVoice.isQuestion）が問いと見た文（「？」で終わる・「〜か」で終わる・疑問詞を含む）には、飾り（印のある規則・決め語尾・bang・方言の標識）を付けない。付けるのは q の規則（芯）だけ。q に無い種類は付け替えない
(function (g) {
  // ---------- 文の区切りと、文末の種類 ----------
  const PCH = '。！？…';
  function splitS(text) {
    const out = []; let i = 0; const n = text.length;
    while (i < n) { let j = i; while (j < n && PCH.indexOf(text[j]) < 0) j++; let k = j; while (k < n && PCH.indexOf(text[k]) >= 0) k++; out.push({ body: text.slice(i, j), punct: text.slice(j, k) }); i = k; }
    return out;
  }
  const IMP_END = /(?:言え|聞け|来い|こい|話せ|よこせ|寄越せ|黙れ|待て|退け|行け|動け|並べ|守れ|倒せ|走れ|従え|戻れ|頼め|叩け|出せ|貸せ|返せ|選べ|組め|進め|続け|笑え|飲め|食え|立て|取れ|放せ|離せ|急げ|やれ|落ち着け|構え|下がれ|さがれ|ろ)$/;
  const PROHIB = /(?:(?<![ろそよ])う|[るくぐすつぬぶむ])な$/;
  const NAI_LEX = /(?:ざるを得|やむを得|あり得|仕方|しかた|しょうが|情け|頼り|ぎこち|だらし|申し訳|もったい|つまら|くだら|少|危|あぶ|切|はかな|みっとも|あどけ|せわし|忙し)ない$/;
  const NAI_ADJ = /(?:(?<![泳防急脱稼騒注凌漕嗅担仰])が|は|も|の|しか|ほか|く|なんて|なんか)、?ない$|^ない$/;
  const VSTEM = /[かがさたなばまらわしいきみえけせてねべめれげじびりちぎこ見着居出寝来得似煮射経]$/;   // こ＝来ない（こない・連れてこない）
  function classifyDa(b) {
    if (/(?:ではない|じゃない)$/.test(b)) return 'copneg';
    if (/である$/.test(b)) return 'dearu';   // 〜である・〜のである（硬い断定。動詞の終止形ではない）
    if (/(?:なければ|なくては|なくちゃ|ねば)(?:ならない|いけない)$/.test(b)) return 'nakereba';   // 〜なければならない（義務）
    if (/[てで]は(?:ならない|いけない)$/.test(b)) return 'tewa';   // 〜てはならない（禁止）
    if (/(?:違い|ちがい)ない$/.test(b)) return 'chigai';   // 〜に違いない（確信）
    if (/(?:がいい|がよい|ばいい|ばよい|といい|とよい)$/.test(b)) return 'rec';   // 〜がいい・〜ばいい・〜といい（おすすめ。決め語尾や「ね」を足さない）
    if (/なかった$/.test(b)) return classifyDa(b.slice(0, -3) + 'い') === 'negverb' ? 'negta' : 'ta';   // 〜なかった（行かなかった・思っていなかった）。形容詞（高くなかった）・名詞（金がなかった）は ta のまま
    if (/ない$/.test(b)) { if (NAI_LEX.test(b)) return 'adj'; if (NAI_ADJ.test(b)) return 'negadj'; return VSTEM.test(b.slice(0, -2)) ? 'negverb' : 'negother'; }
    if (IMP_END.test(b) || PROHIB.test(b)) return 'imp';
    if (/[てで]ほしい$/.test(b)) return 'tehoshii';
    if (/[てで]くれ$/.test(b)) return 'tekure';
    if (/なさい$/.test(b)) return 'nasai';
    if (/[てで]いる$/.test(b)) return 'teiru';
    if (/[てで]いた$/.test(b)) return 'teita';
    if (/[てで]しまう$/.test(b)) return 'teshimau';
    if (/(?<!も)のだ$/.test(b)) return 'noda';
    if (/だった$/.test(b)) return 'datta';
    if (/だろう$/.test(b)) return 'darou';
    if (/だな$/.test(b)) return 'dana';
    if (/なんだ$/.test(b)) return 'noda';   // 〜なんだ（そうなんだ）は説明の形。過去形の「んだ」ではない（第6回）
    if (/(?:ん|(?:[泳急脱騒注継嗅担稼防凌仰漕研繋濯]|ぬ|およ|いそ|かつ|つな|ふせ|かせ|しの|あお|そそ|さわ)い)だ$/.test(b)) return 'ta';   // 第6回：「匂いだ」「狙いだ」「違いだ」のような名詞＋だ を過去形にしない（西の「いい匂いだ」が付け替わらなかった）。過去形（読んだ・泳いだ）。「せいだ」「あいだ」は名詞＋だ
    if (/だ$/.test(b)) return 'da';
    if (/か$/.test(b)) return 'ka';
    if (/(?:ありがと|おはよ)う$/.test(b)) return 'other';
    if (/[しきちりみびにぎじいえけせてねべめれげで]そう$/.test(b)) return 'other';   // 落としそう（様態）
    if (/(?:[おこそとのもよろごぞぼ]う|よう)$/.test(b)) return 'vol';
    if (/[てで]$/.test(b)) return 'te';
    if (/た$/.test(b)) return 'ta';
    if (/[るうくぐすつぬぶむ]$/.test(b)) return 'v';
    if (/い$/.test(b)) return 'adj';
    return 'other';
  }
  const DESU_K = [['teimashita', /[てで]いました$/], ['teimasu', /[てで]います$/], ['tehoshiidesu', /[てで]ほしいです$/], ['copneg', /(?:ではありません|じゃありません)$/], ['masenka', /ませんか$/], ['masuka', /ますか$/], ['desuka', /ですか$/], ['masendeshita', /ませんでした$/], ['narimasen', /(?:なければ|なくては|ねば|ては|では)(?:なりません|いけません)$/], ['mashita', /ました$/], ['deshita', /でした$/], ['desune', /ですね$/],
    ['mashou', /ましょう$/], ['deshou', /でしょう$/], ['masen', /ません$/], ['masu', /ます$/], ['desu', /です$/], ['kudasai', /ください$/]];
  function classifyDesu(b) { for (const [k, re] of DESU_K) if (re.test(b)) return k; return 'other'; }
  const classify = (b, base) => base === 'desu' ? classifyDesu(b) : classifyDa(b);
  function kinds(text, base) { return splitS(String(text)).filter(s => s.body).map(s => classify(s.body, base || 'da')); }
  // 種類ごとの末尾（conv の文字列が置き換える部分）
  const SUF = { dearu: '', nakereba: '', tewa: '', narimasen: '', chigai: 'ない', da: 'だ', dana: 'だな', darou: 'だろう', noda: 'のだ', datta: 'だった', negverb: 'ない', negadj: 'ない', ka: 'か',
    masenka: 'ませんか', masuka: 'ますか', desuka: 'ですか', mashita: 'ました', deshita: 'でした', desune: 'ですね', mashou: 'ましょう', deshou: 'でしょう', masen: 'ません', masu: 'ます', desu: 'です', kudasai: 'ください',
    negta: 'なかった', masendeshita: 'ませんでした', teiru: 'いる', teita: 'いた', teshimau: 'しまう', tehoshii: 'ほしい', tekure: 'くれ', nasai: 'なさい', teimasu: 'います', teimashita: 'いました', tehoshiidesu: 'ほしいです' };
  // 細かい種類の親（conv にその種類の規則が無ければ、親の規則を使う）
  const PARENT = { nakereba: 'negverb', tewa: 'negverb', chigai: 'negadj', narimasen: 'masen', negta: 'ta', masendeshita: 'deshita', teiru: 'v', teita: 'ta', teshimau: 'v', tehoshii: 'adj', nasai: 'adj', teimasu: 'masu', teimashita: 'mashita', tehoshiidesu: 'desu' };
  const COP_SUF = /(?:ではありません|じゃありません|ではない|じゃない)$/;

  // 動詞の否定の付け替え：NEG('へん', { suru:'せえ', deki:'でけ' })。しない→せえへん／できない→でけへん／行かない→行かへん
  // いない→おらぬ／おらへん、ていない（聞いてない）→ておらぬ／てへん。drop＝「ていない」の「い」を落とす型（へん・ねえ）
  // い抜きの「ていない」の見分け：て・で＋ない。手前が「い・っ・ん・し」や、い段・え段のかな、見・寝・出・来・着…（一段動詞の語幹）なら「〜ている」の否定。
  //   捨てない・立てない（語幹が「て」で終わる動詞）は、手前が漢字（見寝出来着得似煮射経居でない）なので当てはまらない
  const TEFORM = /(?:[いっんしじちにひみびりぎきえけげせぜてでねべめれ]て|[んい]で|[見寝出来着得似煮射経居]て)$/;
  const NEG = (sfx, o) => {
    o = o || {};
    return h => {
      if (TEFORM.test(h)) h += 'い';   // 聞いてない＝聞いていない／見てない＝見ていない／食べてない＝食べていない
      if (/い$/.test(h) && !/[かがさたなばまらわ]い$/.test(h)) { const keep = h.slice(0, -1); return /て$/.test(keep) && o.drop ? keep + sfx : keep + (o.iru || 'おら') + sfx; }
      if (o.deki && /でき$/.test(h)) return h.slice(0, -2) + o.deki + sfx;
      if (/し$/.test(h)) return h.slice(0, -1) + (o.suru == null ? 'し' : o.suru) + sfx;
      return h + sfx;
    };
  };
  // 命令形（言え・話せ・聞け…）の付け替え：e段→い段／あ段に直して語尾を付ける。命令の「ろ」（見ろ・逃げろ・しろ）は型ごとに別に書く。禁止（〜な）は付け替えない
  const E2I = { え: 'い', け: 'き', せ: 'し', て: 'ち', ね: 'に', べ: 'び', め: 'み', れ: 'り', げ: 'ぎ' }, E2A = { え: 'わ', け: 'か', せ: 'さ', て: 'た', ね: 'な', べ: 'ば', め: 'ま', れ: 'ら', げ: 'が' };
  const eImp = (map, sfx, b) => { const c = b.slice(-1); return map[c] && b.length > 1 && !/[ろな]$/.test(b) ? b.slice(0, -1) + map[c] + sfx : b; };
  // 「〜ないで」（行かないで・しないで）の付け替え
  const TE_NAI = (sfx, suru) => b => /しないで$/.test(b) ? b.slice(0, -4) + suru : /ないで$/.test(b) ? b.slice(0, -3) + sfx : b;
  // 西のことばの命令
  const W_IMP = b => /ていろ$/.test(b) ? b.replace(/ていろ$/, 'とき') : /しろ$/.test(b) ? b.replace(/しろ$/, 'せえ') : /見ろ$/.test(b) ? b.replace(/見ろ$/, '見い') : /[えけげせてねべめれ]ろ$/.test(b) ? b.replace(/ろ$/, 'え') : eImp(E2I, 'や', b);
  // 下町のことばの命令
  const E_IMP = b => /ていろ$/.test(b) ? b.replace(/ていろ$/, 'ていな') : /しろ$/.test(b) ? b.replace(/しろ$/, 'しな') : /[えけげせてねべめれ見]ろ$/.test(b) ? b.replace(/ろ$/, 'な') : eImp(E2I, 'な', b);
  // 南のことばの命令
  const K_IMP = b => /ていろ$/.test(b) ? b.replace(/ていろ$/, 'とれ') : /しろ$/.test(b) ? b.replace(/しろ$/, 'せんね') : eImp(E2A, 'んか', b);

  // ---------- 依頼・命令の言い換え（話し手の型と性別に合わせる） ----------
  // 台本の常体は「〜ないで」「〜していろ」「〜しろ」「〜てくれ」「〜なさい」「〜な」のどれでも書かれうる。
  // 型の req に応じて、荒い男は「〜な」「〜していろ」、やわらかい女は「〜ないで」「〜していて」、武人は「〜でない」「〜しておれ」…に言い換える。
  const A2U = { か: 'く', が: 'ぐ', さ: 'す', た: 'つ', な: 'ぬ', ば: 'ぶ', ま: 'む', ら: 'る', わ: 'う' }, U2A = { く: 'か', ぐ: 'が', す: 'さ', つ: 'た', ぬ: 'な', ぶ: 'ば', む: 'ま', う: 'わ' };
  const GODAN_TE = { え: 'って', け: 'いて', せ: 'して', て: 'って', ね: 'んで', べ: 'んで', め: 'んで', れ: 'って', げ: 'いで' };
  const ICHI_KANJI = /[見着居出寝来得似煮射経]$/, ICHI_KANA = /[えけげせてねべめれきぎじちにびみりい]$/;
  // 動詞の「ない」の前の形（未然形）⇔ 辞書形。カ変（来る＝来・こ）・サ変（する＝し）・五段/一段の見分けをここに集める
  //   カ変：来る→来／くる→こ（「〜てくる」「〜でくる」「くる」単独。つくる・まくる・めくる は五段なので別）／こ→くる
  //   サ変：する→し。五段か一段か：かなの手前がい段・え段なら一段（見る・食べる・起きる）、それ以外は五段（行く→行か・帰る→帰ら）
  //   かな書きの五段で手前がい段・え段のもの（はいる・はしる・にぎる 等）は GODAN_RU で五段にする
  const GODAN_RU = /(?:はい|はし|にぎ|すべ|しゃべ|まい|かぎ|ひね|ちぎ|つね|ねじ|いじ|ほじ)る$/;
  const KURU_KANA = /(?:^|[てでへにとをはがもや、。…！？「」\s]|[一-龠])くる$/;   // 「くる」が来るの意味になる並び（寄ってくる／ここへくる）
  const dictOfNai = st => /し$/.test(st) ? st.slice(0, -1) + 'する' : /こ$/.test(st) ? st.slice(0, -1) + 'くる' : A2U[st.slice(-1)] ? st.slice(0, -1) + A2U[st.slice(-1)] : st + 'る';   // 行か→行く／し→する／こ→くる／見→見る
  const naiOfDict = d => {   // 行く→行か／見る→見／する→し／来る→来／くる→こ（「ない」を付ける前の形）
    if (/する$/.test(d)) return d.slice(0, -2) + 'し';
    if (/来る$/.test(d)) return d.slice(0, -1);
    if (KURU_KANA.test(d)) return d.slice(0, -2) + 'こ';
    const c = d.slice(-1);
    if (c === 'る') { if (GODAN_RU.test(d)) return d.slice(0, -1) + 'ら'; const p = d.slice(-2, -1); return ICHI_KANA.test(p) || ICHI_KANJI.test(p) ? d.slice(0, -1) : d.slice(0, -1) + 'ら'; }
    return U2A[c] ? d.slice(0, -1) + U2A[c] : d;
  };
  const teOfImp = (st, c) => (st === '行' && c === 'け') ? '行って' : st + GODAN_TE[c];
  // 依頼・命令の文を分解する。te＝「〜て／〜で」まで
  function parseReq(b, kind) {
    if (kind === 'te') return /ないで$/.test(b) ? { t: 'naide', st: b.slice(0, -3) } : null;
    if (kind === 'tekure') return { t: 'tekure', te: b.slice(0, -2) };
    if (kind === 'tehoshii') return { t: 'tehoshii', te: b.slice(0, -3) };
    if (kind === 'nasai') return { t: 'nasai', hd: b.slice(0, -3) };
    if (kind === 'imp') {
      if (/ていろ$/.test(b)) return { t: 'teiro', te: b.slice(0, -2) };
      if (/(?:来い|こい)$/.test(b)) return { t: 'koi', te: b.slice(0, -2) + (/来い$/.test(b) ? '来て' : 'きて'), st: b.slice(0, -2) + (/来い$/.test(b) ? '来' : 'き') };   // 来い・寄ってこい
      if (PROHIB.test(b)) return { t: 'prohib', d: b.slice(0, -1) };
      if (/(?:し|[えけげせてねべめれきぎじちにびみりい見着居出寝来得似煮射経])ろ$/.test(b)) return { t: 'ro', st: b.slice(0, -1) };
      if (/[えけげせてねべめれ]$/.test(b) && b.length > 1) return { t: 'e', st: b.slice(0, -1), c: b.slice(-1) };
    }
    return null;
  }
  const suruTo = (st, sfx, suruSfx) => /し$/.test(st) ? st.slice(0, -1) + suruSfx : st + sfx;
  const REQ_STYLES = {
    // 荒い男（熱血少年・ぶっきらぼう・男まさり・今どきの男・軍人・北のことば）：禁止は「〜するな」。命令・「〜ていろ」はそのまま
    rough: { tehoshii: p => p.te + 'くれ', naide: p => dictOfNai(p.st) + 'な', nasai: p => /(?:し|[えけげせてねべめれ])$/.test(p.hd) ? p.hd + 'ろ' : null },
    // やわらかい女（元気・おっとり・今どきの女）：「〜していて」「〜して」「〜ないで」
    soft: { tehoshii: p => p.te + (HS(p.te) % 2 ? 'ね' : 'ほしいな'), teiro: p => p.te + 'いて', ro: p => p.st + 'て', e: p => teOfImp(p.st, p.c), koi: p => p.te, prohib: p => naiOfDict(p.d) + 'ないで', tekure: p => p.te },
    // 性別によらない落ち着いた大人：「〜してほしい」「〜ないでほしい」
    neutral: { teiro: p => p.te + 'いてほしい', ro: p => p.st + 'てほしい', e: p => teOfImp(p.st, p.c) + 'ほしい', koi: p => p.te + 'ほしい', prohib: p => naiOfDict(p.d) + 'ないでほしい', naide: p => p.st + 'ないでほしい', tekure: p => p.te + 'ほしい' },
    // 気取り屋：「〜していてくれ」「〜ないでくれ」
    kidori: { tehoshii: p => p.te + 'くれないか', teiro: p => p.te + 'いてくれないか', ro: p => p.st + 'てくれないか', e: p => teOfImp(p.st, p.c) + 'くれないか', koi: p => p.te + 'くれないか', prohib: p => naiOfDict(p.d) + 'ないでくれないか', naide: p => p.st + 'ないでくれないか', tekure: p => p.te + 'くれないか' },   // 第6回：荒っぽい「〜してくれ」でなく「〜してくれないか」（hydrogen 7）
    // 姉御：「〜しな」「〜ていな」
    anego: { teiro: p => p.te + 'いな', ro: p => p.st + 'な', e: p => p.st + E2I[p.c] + 'な', koi: p => p.st + 'な' },
    // 学者：「〜たまえ」
    gakusha: { teiro: p => p.te + 'いたまえ', ro: p => p.st + 'たまえ', e: p => p.st + E2I[p.c] + 'たまえ', koi: p => p.st + 'たまえ', prohib: p => naiOfDict(p.d) + 'ないでくれたまえ', naide: p => p.st + 'ないでくれたまえ', tekure: p => p.te + 'くれたまえ', nasai: p => p.hd + 'たまえ' },
    // 子ども：「〜しててね」「〜ないでね」
    kodomo: { teiro: p => p.te + 'いてね', ro: p => p.st + 'てね', e: p => teOfImp(p.st, p.c) + 'ね', koi: p => p.te + 'ね', prohib: p => naiOfDict(p.d) + 'ないでね', naide: p => p.st + 'ないでね', tekure: p => p.te + 'ね' },
    // 下っ端：目上に向けて「〜てほしい」
    shitappa: { teiro: p => p.te + 'いてほしい', ro: p => p.st + 'てほしい', e: p => teOfImp(p.st, p.c) + 'ほしい', koi: p => p.te + 'ほしい', prohib: p => naiOfDict(p.d) + 'ないでほしい', naide: p => p.st + 'ないでほしい', tekure: p => p.te + 'ほしい' },
    // 武人：「〜するでない」「〜しておれ」
    bujin: { teiro: p => p.te + 'おれ', prohib: p => p.d + 'でない', naide: p => dictOfNai(p.st) + 'でない', tekure: p => p.te + 'くだされ', nasai: p => p.hd + 'なされ' },
    // 老人：「〜するでない」「〜しておれ」「〜せい」
    roujin: { teiro: p => p.te + 'おれ', ro: p => /し$/.test(p.st) ? p.st.slice(0, -1) + 'せい' : null, prohib: p => p.d + 'でない', nasai: p => p.hd + 'なされ' },
    // 高貴な姫：「〜するがよい」「〜しておれ」「〜てたもれ」
    kouki: { teiro: p => p.te + 'おれ', ro: p => suruTo(p.st, 'るがよい', 'するがよい'), prohib: p => p.d + 'でない', naide: p => dictOfNai(p.st) + 'でない', tekure: p => p.te + 'たもれ', nasai: p => p.hd + 'なされ' },
    // 王者：「〜せよ」「〜しておれ」「〜するでない」
    ouja: { teiro: p => p.te + 'おれ', ro: p => suruTo(p.st, 'よ', 'せよ'), prohib: p => p.d + 'でない', naide: p => dictOfNai(p.st) + 'でない', tekure: p => p.te + 'くれぬか', nasai: p => p.hd + 'なされ' },
  };
  const mkReq = S => {
    const go = (b, kind) => { const p = parseReq(b, kind), f = p && S[p.t], o = f ? f(p) : null; return o == null ? b : o; };
    return { imp: (h, c) => go(c.body, 'imp'), te: (h, c) => go(c.body, 'te'), tekure: (h, c) => go(c.body, 'tekure'), tehoshii: (h, c) => go(c.body, 'tehoshii'), nasai: (h, c) => go(c.body, 'nasai') };
  };
  const REQ = {}; Object.keys(REQ_STYLES).forEach(k => { REQ[k] = mkReq(REQ_STYLES[k]); });
  // 「ている」「ていた」を「とる」「とった」に、「てしまう」を「ちまう」に
  const TO = end => h => h.replace(/て$/, 'と').replace(/で$/, 'ど') + end;
  const TIMAU = h => h.replace(/て$/, 'ち').replace(/で$/, 'じ') + 'まう';
  // 「〜てほしい」「〜てくれ」の頭（h＝「〜て」または「〜ないで」）を方言に直す。
  //   ないで：NAIDE(h, 「ないで」の替え, 「しないで」の替え)。当てはまらなければ null（行かないで→行かんといて／しないで→せんといて）
  //   ていて（待っていて）：西・南は「待っとって」、北・下町は「待ってて」（待っていてんか→待っとってんか）
  const NAIDE = (h, nei, suru) => /しないで$/.test(h) ? h.slice(0, -4) + suru : /ないで$/.test(h) ? h.slice(0, -3) + nei : null;
  const TEITE_W = h => h.replace(/ていて$/, 'とって').replace(/でいて$/, 'どって').replace(/(?<=[にへ])いて$/, 'おって');   // 「そこにいて」＝居て→「そこにおって」（第6回 opus 8）
  const TEITE_E = h => h.replace(/([てで])いて$/, '$1て');
  const HS = s => { let a = 0; for (const c of s) a += c.charCodeAt(0); return a; };   // 同じ文には同じ答えを返す目印（乱数は使わない）
  // 西のことばの「〜てほしい」：「ほしいんや」ばかりにならないよう、文の中身で4通りに振る。ないで形は「〜んといて」
  const W_HOSHII = h => { const m = NAIDE(h, 'んといて', 'せんといて'); if (m != null) return m; const k = HS(h) % 4; return k === 0 ? h + 'ほしいんや' : k === 1 ? h + 'ほしい' : k === 2 ? TEITE_W(h) + 'んか' : h + 'ほしいんやけど'; };   // 第7回：「貸してほしいねん」は頼みに使わない（argon 19）。「〜ほしいんやけど」
  const W_KURE = h => { const m = NAIDE(h, 'んといて', 'せんといて'); return m != null ? m : TEITE_W(h) + 'んか'; };
  const reqTail = (nei, suru, tail, teite) => h => { const m = NAIDE(h, nei, suru); return (m != null ? m : teite ? teite(h) : h) + tail; };

  // ---------- 人生第4回の直し：場面に合わない飾りを控える ----------
  //   SERIOUS＝深刻・危険な中身の文（間のび・軽い語尾を付けない）／softOk＝軽い語尾を付けてよい文（短く、深刻でない）
  //   gate(n, 語尾)＝文の中身で決まる「n 回に 1 回は付けない」（乱数は使わない。同じ文には同じ答え）。方言の終止形など、付けすぎないための規則に使う
  const SERIOUS = /死|殺|血|危|魔獣|魔物|獣|狼|熊|敵|逃げ|襲|戦|命|傷|痛|倒|斬|刃|罠|裏切|毒|崖|火事|燃|病|熱|頼む|急げ|足跡|跡/;
  const softOk = (b, n) => [...String(b)].length <= (n || 14) && !SERIOUS.test(b);
  const gate = (n, yes) => (h, c) => HS(c.body) % n === 0 ? c.body : h + yes;
  //   NATTE＝今どきの若者（男）の「〜って」：短い否定の文のうち 6 回に 1 回だけ（独り言・grave・tense・目上では付かない）
  //   OTT＝おっとりした娘の間のび（ぉ・ぇ）：短く深刻でない文の半分だけ。ほかは間のびしない柔らかい語尾（わ・ね）。深刻な文は付け替えない
  //   OTN＝落ち着いた大人の「だよ・だろうね」：短く深刻でない文の半分だけ
  //   WF＝今どきの若者（女）の「よ・ね」：16 字までの深刻でない文だけ（警告・頼みごと・長い硬い文には付けない）
  const NATTE = (h, c) => [...c.body].length <= 12 && !SERIOUS.test(c.body) && HS(c.body) % 6 === 0 ? c.body + 'って' : c.body;
  const OTT = (yes, mid) => (h, c) => SERIOUS.test(c.body) ? c.body : (softOk(c.body) && HS(c.body) % 2 === 0 ? h + yes : h + mid);
  const OTN = yes => (h, c) => softOk(c.body) && HS(c.body) % 2 === 0 ? h + yes : c.body;
  const WF = yes => (h, c) => softOk(c.body, 16) ? h + yes : c.body;
  // 第7回（opus 712・11、argon 7、neon 13）：今どきの若者（女）の動詞に「ね」だけを付けると「何とかするね」「払うね」「包めるね」「あるね」と壊れた。ありさまの動詞は「〜んだ／〜よ」、するつもりの動詞は「〜から／〜よ／〜ね」。過去は「〜んだ／〜の」。飾りなので1つの台詞に1文だけ。長さは16字まで（これまでどおり）
  const WFV = (h, c) => { const b = c.body; if (!softOk(b, 16)) return b; if (STATE_V.test(b)) return b + (HS(b) % 2 ? 'んだ' : 'よ'); return b + (HS(b) % 2 ? 'から' : 'よ'); };
  const WFL = yes => (h, c) => softOk(c.body, 16) ? h + yes : c.body;
  const ADJ_KA = (h, c) => c.body.replace(/(?<!かわ)いい$/, 'よか').replace(/い$/, 'か');   // 南のことばの形容詞：寒い→寒か
  // 文の途中の「〜ない＋なら・から・ので…」（払えないなら）を方言に直す。文末の否定は conv が直すので、ここは文の中だけ
  const NAI_LEX_RE = '仕方|しかた|しょうが|情け|頼り|ぎこち|だらし|申し訳|もったい|つまら|くだら|少|危|あぶ|切|はかな|みっとも|あどけ|せわし|忙し|しか|ほか|なんて|なんか';
  const NAI_MID = (sfx, o) => {
    const neg = NEG(sfx, o), re = new RegExp('(.?(?:[かさたなばまらわしいきみえけせてねべめれげじびりちぎこ見着居出寝来得似煮射経]|(?<=[泳防急脱稼騒注凌漕嗅担仰])が))(?<!(?:' + NAI_LEX_RE + '))ない(?=なら|から|ので|のに|けど|けれど|が)', 'g');
    return [re, (m, st) => neg(st)];
  };

  // ---- 硬い言い回し（である・なければならない・てはならない・に違いない）の方言化と、疑問・勧誘の言い換え（人生第5回） ----
  const DEARU = (noda, da) => (h, c) => /のである$/.test(c.body) ? c.body.replace(/のである$/, noda) : c.body.replace(/である$/, da);
  const NAKE_RE = /(?:なければ|なくては|なくちゃ|ねば)(?:ならない|いけない)$/, TEWA_RE = /([てで])は(?:ならない|いけない)$/;
  const NAKEREBA = to => (h, c) => c.body.replace(NAKE_RE, to);
  const TEWA = f => (h, c) => c.body.replace(TEWA_RE, (m, t) => f(t));
  const HARD_INLINE = [[/この者/g, 'この人'], [/その者/g, 'その人'], [/あの者/g, 'あの人'], [/それゆえ|ゆえに/g, 'だから']];   // 硬い書き言葉の口語化
  //   意向形（戻ろう）→終止形＋「っす」（戻るっす）：下っ端の「戻ろうっす」（活用の崩れ）を避ける。敬体にはしない
  const VOL_DICT = (end) => (h, c) => { const b = c.body, m = { お: 'う', こ: 'く', そ: 'す', と: 'つ', の: 'ぬ', も: 'む', ろ: 'る', ご: 'ぐ', ぼ: 'ぶ' }, k = b.slice(-2, -1); if (/しよう$/.test(b)) return b.replace(/しよう$/, 'する') + end; if (/よう$/.test(b)) return b.replace(/よう$/, 'る') + end; return m[k] ? b.slice(0, -2) + m[k] + end : b; };
  //   女性の「〜のか。」「〜ないか。」→「〜の？」「〜ない？」（男言葉の問いにならないように）
  const FEM_KA = (h, c) => /だろうか$/.test(c.body) ? [h.replace(/だろう$/, '') + 'かな', '？'] : [h, '？'];
  const KI_TAI = (h, c) => c.punct[0] === '！' ? h + 'ばい' : /[気体隊待態帯耐対大台]$/.test(h) ? h + 'ばい' : h + 'たい';   // 「悪い気たい」（気体）のような読み違いを避ける

  // ---- 人生第6回：疑問文（「？」でなく「。」で書かれた問いも含む）の付け替え ----
  //   台本の問いは「あの言葉を、どこで覚えた。」のように「。」で終わる。決め語尾・終助詞・方言の標識（ぜ・で・でい・よ・っす…）を付けると「どこで覚えたぜ」と壊れる。
  //   looksQuestion＝問いの文：「？」で終わる／「〜か」で終わる／疑問詞（どこ・だれ・何・なぜ・いつ・どう…）を含み、動詞・形容詞・名詞の文末で終わる（「どこにも」「何でもない」「どう思おうと」のような疑問詞でない使い方は除く）
  //   問いの文には、飾り（印のある規則・決め語尾・bang）を付けない。付けるのは型ごとの q の規則（芯＝問いの文末：元気な娘「〜の？」・下町「〜んだい？」・武人「〜か」…）だけ
  const Q_INDEF = /(?:どこ|だれ|誰|なに|何|いつ|どれ|どちら|どっち|いくつ|いくら|どなた|どう|どの|どんな|なぜ|なんで)(?:に|へ|で|を|が|と|から|まで)?(?:も|でも|か(?!ら))|どうか|どうぞ|どうも|どうやら|どうせ|どうしても|どうにか|どうにも|なぜか|なんだか|なんとなく|なんと|何度|何人も|何年も|何日も|何回も|何しろ|なにしろ|何より|何とか|何かと|どんなに|どのみち|どの道|どのよう|いつまでも|いつの間にか|いつのまにか|どこまでも/g;
  const Q_WH = /(?:(?<=^|[をがはにでともへやの、一-龠])(?:どこ|だれ|なに|なぜ|なんで|どう|いつ(?![きくけこ])|どれ|どちら|どっち|いくつ|いくら|どなた|どの|どんな)|何|誰)/;   // かな書きの疑問詞は、文頭・読点・助詞のあとだけ（「ほどの者」「あいつ」を拾わない）
  const Q_KIND = /^(?:v|ta|da|adj|datta|noda|darou|dana|negverb|negadj|copneg|teiru|teita|teshimau|negta|rec|masu|desu|mashita|deshita|masen|teimasu|teimashita|masendeshita|deshou|desune)$/;
  const Q_NOT = /(?:何気|何事|何者か|何千|何万|何十|何百|何一つ|何ひとつ|(?:どこ|だれ|誰|何|なに|いつ|どれ|どちら|どっち|いくつ|いくら|どなた|どの|どんな)[^、。！？]{0,8}も|[てで]も|と(?:言|聞|訊|尋|思|問|答|考|呼|い[うっ])|(?:知ら|分から|わから|知れ|しら)(?:ない|ぬ|ません)|どころ)/;
  const Q_EMB = /[のんるたいうぬ]か(?!った|ら|な$|も|ず|っ|ん|ぎ|げ|べ|ね)[^。！？]/;
  const Q_KA = /^(?:ka|masuka|desuka|masenka)$/;
  function looksQuestion(b, kind, punct) {
    if (punct[0] === '？' || Q_KA.test(kind)) return true;
    if (punct[0] !== '。' || !Q_KIND.test(kind) || [...b].length > 40) return false;
    const t = b.replace(Q_INDEF, '');
    return Q_WH.test(t) && !Q_NOT.test(t) && !Q_EMB.test(t);
  }
  //   問いの語尾の部品。QA＝語尾を付けて「。」を「？」に（元気な娘「〜の？」・下町「〜んだい？」）／QB＝語尾を付けるだけ（武人「〜か。」）／QP＝「？」にするだけ
  const qPunct = c => /^[。]/.test(c.punct) ? '？' + c.punct.slice(1) : c.punct;
  const QA = sfx => (h, c) => [h + sfx, qPunct(c)];
  const QB = sfx => (h, c) => h + sfx;
  const QP = (h, c) => [c.body, qPunct(c)];
  const QNEG = (neg, sfx, q) => (h, c) => { const o = neg(h); return q === false ? o + sfx : [o + sfx, qPunct(c)]; };
  // 女性・子どもの問い：「どこで覚えたの？」「なぜ来ないの？」（FEM_KA は conv.ka の「〜のか」→「〜の？」）
  const Q_FEM = { v: QA('の'), ta: QA('の'), adj: QA('の'), da: QA('なの'), datta: QA('だったの'), noda: QA('の'), negverb: QA('ないの'), negadj: QA('ないの'), copneg: QA('じゃないの'), darou: QA('のかな'), dana: QA('のかな') };
  // 「〜かい？」の型（姉御・気取り屋・下町）：「どこで覚えたんだい？」
  const Q_KAI = { v: QA('んだい'), ta: QA('んだい'), adj: QA('んだい'), da: QA('なんだい'), datta: QA('だったんだい'), noda: QA('んだい'), negverb: QA('ないのかい'), negadj: QA('ないのかい'), copneg: QA('じゃないのかい'), ka: QA('かい') };
  // 元気な娘（第6回）：文末の種類ごとに、文の中身（HS＝同じ文には同じ答え）で言い方を振り分ける。「！」は文末が変わった短い文にだけ（bangSoft）
  const HV = (...xs) => (h, c) => h + xs[HS(c.body) % xs.length];
  const GENKI_REC = (h, c) => softOk(c.body, 18) ? c.body + 'よ' : c.body;
  const GENKI_HOSHII = (h, c) => softOk(c.body, 18) ? c.body + 'な' : c.body;   // 「〜してほしいな」（第7回：「ほしいの！」は甘えた響きなので外した）。長い・深刻な文（裁きの場の願い出など）は付け替えない
  // 第7回（argon 3〜6・16、neon 9、hydrogen 11、opus 11）：「〜ね」は自分がこれからすることにだけ。ありさま・できる・分かるの動詞（ある・いる・なる・助かる・押している・包める）に「ね」を付けると、他人事の念押しに聞こえる
  const STATE_V = /(?:ある|いる|なる|できる|分かる|わかる|要る|見える|聞こえる|足りる|違う|かかる|[えけげせてねべめれ]る|助かる|思う|気がする)$/;
  const GENKI_V = (h, c) => { const b = c.body; if (/助かる$/.test(b)) return b + 'な'; if (STATE_V.test(b)) return b + (HS(b) % 2 ? 'んだ' : 'よ'); return b + ['よ', 'ね', 'よ'][HS(b) % 3]; };
  const GENKI_TEIRU = (h, c) => h + (HS(c.body) % 2 ? 'るよ' : 'るんだ');   // 「押している」→「押してるよ」（「押しているね」にしない）
  const GENKI_ADJ = (h, c) => /たい$/.test(c.body) ? c.body + 'な' : c.body + ['よ', 'ね', 'よ'][HS(c.body) % 3];   // 「組みたいな」「頼みたいな」（「〜たいね」は相手への念押しになる）
  const GENKI_NEG = (h, c) => /(?:分から|わから)$/.test(h) ? h + 'ないな' : h + 'ないよ';   // 「分からないな」（「分からないね」は他人事）
  const VOICES = {
    nekketsu: { n: '熱血少年', hint: '真っすぐで暑苦しい少年。勢いで動く', base: 'da', me: 'オレ', bang: true,
      conv: { copneg: 'じゃねえ', negverb: NEG('ねえ', { drop: true }), negadj: 'ねえ' },
      tails: ['ぜっ', 'ぞっ'], tailRate: 0.35, sex: '男', age: [10, 25], ex: 'ここで退けば名が廃るぜっ！',
      w: { s1: { okorippoi: 3, tanoshii: 2, mie: 1 }, s2: { meiyo: 2, chikara: 1, giri: 1 }, job: [] } },
    bukkira: { n: 'ぶっきらぼう', hint: '口数が少なく、飾らない。男女どちらでも。女性の一人称は「あたし」「自分」', base: 'da', me: 'オレ',
      conv: { copneg: 'じゃない', darou: 'だろ', noda: 'んだ' },
      tails: [], tailRate: 0, sex: null, age: [15, 75], ex: '……面倒だな。話は聞く。',
      w: { s1: { samete: 3, okorippoi: 2, higai: 1 }, s2: { jiyuu: 1, kane: 1, chikara: 1 }, job: [] } },
    otona: { n: '落ち着いた大人', hint: '穏やかで、感情を表に出さない大人', base: 'da', me: '私',
      conv: { darou: OTN('だろうね'), da: OTN('だよ'), noda: OTN('んだよ'), datta: OTN('だったよ') },
      tails: [], tailRate: 0, sex: null, age: [28, 65], ex: '命あっての物種だよ。逃げ道を数える。', noImp: true,
      w: { s1: { nonki: 1, kanpeki: 1, samete: 1 }, s2: { kouhei: 2, giri: 1, jiyuu: 1 }, job: [] } },
    seinen: { n: '丁寧な青年', hint: '礼儀正しく、誰にでも敬語の青年', base: 'desu', me: '僕',
      conv: { deshou: 'でしょうね' },
      tails: [], tailRate: 0, sex: '男', age: [16, 40], ex: '順番に片づけます。まず右からです。',
      w: { s1: { kanpeki: 2, kowagari: 1, sewa: 1 }, s2: { genri: 1, kouhei: 1, shinkou: 1 }, job: [] } },
    ojou: { n: 'お嬢様', hint: '上品で気位が高い、育ちのよい娘。貴族・令嬢・姫など', base: 'desu', me: 'わたくし',
      conv: { masen: 'ませんわ', masu: 'ますわ', desu: 'ですわ', copneg: 'ではありませんわ', deshou: 'でしょうね', mashou: 'ましょうね', desune: 'ですわね', mashita: 'ましたわ', deshita: 'でしたわ', kudasai: 'くださいませ' },
      jobOnly: /貴族|令嬢|お嬢|王女|姫|後援者/, jobAge: [[/王女|姫|令嬢|娘/, 35]],
      tails: [], tailRate: 0, sex: '女', age: [12, 35], ex: '取り乱すのは見苦しいですわ。きれいに勝ちますわ。',
      w: { s1: { mie: 3, kanpeki: 1 }, s2: { bi: 3, meiyo: 2 }, job: [[/貴族|姫|令嬢|お嬢|王/, 3]] } },
    genki: { n: '元気な娘', hint: '明るくはつらつとした娘', base: 'da', me: 'あたし', bang: true,
      conv: { ka: FEM_KA, da: HV('だよ', 'なの', 'だね', 'だよ'), dana: 'だね', darou: 'でしょ', v: GENKI_V, teiru: GENKI_TEIRU, adj: GENKI_ADJ, ta: HV('の', 'んだ'), negverb: GENKI_NEG, negadj: HV('ないよ', 'ないの', 'ないよ'), copneg: HV('じゃないよ', 'じゃないの'), noda: HV('んだよ', 'のよ'), datta: HV('だったの', 'だったんだ'), rec: GENKI_REC, tehoshii: GENKI_HOSHII },   // 第6回：文末の種類ごとに言い方を替える。第7回：飾り（1つの台詞に1文・独り言と切迫では付けない）にした
      inline: [[/([たるだ])が、/g, '$1けど、'], [/ではない$/, 'じゃない'], [/のだ$/, 'んだ']],   // 第7回：飾りの付かない文も、男言葉の「ではない」「のだ」は女の子の言い方に
      tails: ['よっ'], tailKinds: ['_'], tailRate: 0.4, bangSoft: true, sex: '女', age: [10, 28], ex: 'みんなの分も用意するね！', noImp: true,
      w: { s1: { hitonatsukkoi: 3, tanoshii: 2, sewa: 1 }, s2: { jiyuu: 1, kouhei: 1 }, job: [] } },
    ottori: { n: 'おっとりした娘', hint: 'のんびりしてやわらかい女性', base: 'da', me: 'わたし',
      conv: { ka: FEM_KA, dana: OTT('だねぇ', 'だね'), darou: OTT('だろうねぇ', 'だろうね'), negverb: OTT('ないよぉ', 'ないわ'), negadj: OTT('ないよぉ', 'ないわ'), copneg: OTT('じゃないよぉ', 'じゃないわ'), da: OTT('だよぉ', 'だわ'), datta: OTT('だったよぉ', 'だったわ'), noda: OTT('んだよぉ', 'のよ'), adj: OTT('ねぇ', 'わ'), v: OTT('よぉ', 'わ') },
      inline: [[/([たるだ])が、/g, '$1けど、']],
      tails: [], tailRate: 0, sex: '女', age: [12, 34], ex: 'まあ、何とかなるでしょ。ひまだよぉ。', noImp: true,
      w: { s1: { nonki: 3, hitonatsukkoi: 1, kowagari: 1 }, s2: { shinkou: 1, kazoku: 1 }, job: [] } },
    anego: { n: '姉御', hint: '面倒見がよく、さっぱりした気風の女性', base: 'da', me: 'あたし',
      conv: { dana: 'だね', darou: 'だろうさ', negverb: 'ないよ', negadj: 'ないよ', copneg: 'じゃないよ', da: 'だよ', noda: 'んだよ', datta: 'だったよ', v: 'よ', adj: 'よ' },
      jobBan: /貴族|令嬢|王|姫|宮廷/,
      tails: [], tailRate: 0, sex: '女', age: [24, 55], ex: '借りは返すよ。最後まで。',
      w: { s1: { sewa: 2, okorippoi: 1, hitonatsukkoi: 1 }, s2: { giri: 3, kazoku: 2 }, job: [[/酒場|女将|親分|傭兵|頭|団長|宿/, 3]] } },
    roujin: { n: '老人', hint: '年寄りの話し方。「わし」「〜じゃ」', base: 'da', me: 'わし',
      conv: { negverb: NEG('ん', { suru: 'せ' }), negadj: 'ないのう', da: 'じゃ', dana: 'じゃな', darou: 'じゃろう', noda: 'んじゃ', datta: 'じゃった', te: TE_NAI('んでくれ', 'せんでくれ') }, q: { da: 'じゃ' },
      inline: [[/だから/g, 'じゃから'], [/だが/g, 'じゃが']],
      tails: ['わい', 'のう'], tailRate: 0.4, sex: null, age: [60, 99], ex: '縁は大事にするのう。',
      w: { s1: { nonki: 1, samete: 1 }, s2: { shinkou: 1, kazoku: 1, giri: 1 }, job: [[/長老|隠居|村長/, 3]] } },
    bujin: { n: '武人', hint: '古風な武士の言葉。「拙者」「〜でござる」。騎士・剣士・武士など', base: 'da', me: '拙者',
      conv: { negverb: NEG('ぬ', { suru: 'せ' }), negadj: (h) => /く$/.test(h) ? h + 'はござらぬ' : h + 'ござらぬ', copneg: 'ではござらぬ', da: 'でござる', dana: 'でござるな', darou: 'でござろう', noda: 'のでござる', datta: 'でござった', v: (h, c) => /^[。！]/.test(c.punct) ? h + 'でござる' : c.body, adj: (h, c) => /^[。！]/.test(c.punct) ? h + 'でござる' : c.body, dearu: DEARU('のでござる', 'でござる') },
      jobOnly: /騎士|剣士|武士|武者|浪人|忍者|くノ一|武闘家|剣の師|武術の師|柔道/,
      tails: ['でござる'], tailKinds: ['_'], tailRate: 0.35, sex: null, age: [22, 65], ex: '堂々と立ち向かうでござる。',
      w: { s1: { mie: 1, okorippoi: 1 }, s2: { meiyo: 3, giri: 2, chikara: 2 }, job: [[/武士|武者|浪人|忍者|くノ一|柔道/, 3]] } },
    gakusha: { n: '学者', hint: '理屈っぽい、書斎の人の言葉。学者・魔術師・賢者・医者・錬金術師', base: 'da', me: '私',
      conv: { da: (h, c) => c.punct[0] === '。' ? h + 'である' : h + 'だ', dana: 'であるな', darou: 'であろう', noda: 'のである', datta: 'であった' },
      jobOnly: /学者|研究|魔術|魔法使い|魔法の師|賢者|医|薬師|薬屋|錬金/, jobBan: /見習い|生徒/, noImp: true,
      tails: ['のである'], tailRate: 0.2, sex: null, age: [25, 80], ex: 'なぜ群れるのか。習性を見ておく。',
      w: { s1: { kanpeki: 2, tanoshii: 1, samete: 1 }, s2: { genri: 3 }, job: [] } },
    shitappa: { n: '下っ端', hint: '親分に付き従う小者。「オイラ」「〜っす」。下男・見習い・弟子・荷運びなど', base: 'da', me: 'オイラ',
      conv: { da: 'っす', dana: 'っすね', darou: 'っすよね', noda: 'んすよ', datta: 'だったっす', copneg: 'じゃないっす', negverb: 'ないっす', negadj: 'ないっす', v: 'っす', adj: 'っす', ta: 'っす', ka: (h) => /だろう$/.test(h) ? h + 'か' : /の$/.test(h) ? h.slice(0, -1) + 'んすか' : h + 'っすか', vol: VOL_DICT('っす'), dearu: DEARU('んすよ', 'っす') },
      inline: [[/([たる])が、/g, '$1んすけど、']],
      jobOnly: /下男|見習い|弟子|荷|使い走り|雑用|新人冒険者|坑夫|斥候|盗賊/, noNoble: true, noImp: true, urgentPlain: true,
      tails: [], tailRate: 0, sex: '男', age: [14, 40], ex: '先に行ってくださいじゃなくて、先に行くっす。',
      w: { s1: { kowagari: 2, hitonatsukkoi: 1, higai: 1 }, s2: { kane: 1, chikara: 1 }, job: [] } },
    kodomo: { n: '子ども', hint: '幼い子どもの言葉', base: 'da', me: 'ぼく', bang: true,
      conv: { da: 'だよ', dana: 'だね', darou: 'かもね', negverb: 'ないよ', negadj: 'ないよ', copneg: 'じゃないよ', noda: 'んだよ', datta: 'だったよ' },
      tails: ['もん'], tailRate: 0.4, sex: null, age: [0, 11], ex: 'ひとりは怖いもん！', noImp: true,
      w: { s1: {}, s2: {}, job: [] } },
    shounin: { n: '商人', hint: '客あしらいに慣れた商売人の男。「手前」「〜でございます」', base: 'desu', me: '手前',
      conv: { desu: (h, c) => /[いの]$/.test(h) ? c.body : h + 'でございます', deshou: 'でございましょう', desuka: (h, c) => /の$/.test(h) ? c.body : h + 'でございますか', desune: 'ですな' },   // 「〜のです」は「のでございます」にしない（過剰）。「くださいまし」は女性の響きなので持たない
      jobOnly: /商|店主|行商|ラーメン屋/, jobBonus: 14,
      tails: [], tailRate: 0, sex: '男', age: [22, 70], ex: '値打ちを調べます。損のない話でございますなら乗りましょう。',
      w: { s1: { hitonatsukkoi: 1, samete: 1 }, s2: { kane: 3 }, job: [] } },
    seishoku: { n: '聖職者', hint: '神に仕える人の説き方。「〜なのです」', base: 'desu', me: '私',
      conv: { desu: (h) => /[のいたうつん]$/.test(h) ? h + 'です' : h + 'なのです' },   // 名詞＋です だけを「なのです」に（怖いです・面白そうです・五つです は替えない）
      jobOnly: /僧|神官|司祭|巫女|聖|シスター|神主/,
      tails: [], tailRate: 0, sex: null, age: [22, 85], ex: 'これも神が与えた試しなのです。',
      w: { s1: { kowagari: 1, sewa: 1 }, s2: { shinkou: 3 }, job: [] } },
    kidori: { n: '気取り屋', hint: '格好をつける伊達者。「僕」「〜さ」', base: 'da', me: '僕',
      conv: { da: 'さ', dana: 'だね', darou: 'だろうね', noda: 'のさ', datta: 'だったのさ', negverb: 'ないのさ', negadj: 'ないのさ', copneg: 'じゃないのさ' },
      tails: ['のさ'], tailRate: 0.3, sex: '男', age: [16, 45], ex: '取り乱すのは見苦しいのさ。', noImp: true,
      w: { s1: { mie: 3 }, s2: { bi: 3, meiyo: 1 }, job: [[/詩人|芸|踊り|役者/, 3]] } },
    josei: { n: '丁寧な女性', hint: '穏やかで礼儀正しい大人の女性', base: 'desu', me: 'わたし',
      conv: { deshou: 'でしょうね', mashou: 'ましょうね' },   // 「〜くださいね」は人生第5回で廃止（緊迫した場面・売買交渉で間が抜ける）
      tails: [], tailRate: 0, sex: '女', age: [20, 70], ex: '話を整理してください。最初から順にお願いしますね。',
      w: { s1: { kanpeki: 1, sewa: 1 }, s2: { kouhei: 1, shinkou: 1 }, job: [[/ギルド職員|商|宿|店|女将|薬/, 3]] } },
    wakamono_m: { n: '今どきの若者（男）', hint: 'くだけた普通の男の子の言葉。「俺」「〜だろ」「〜だよな」', base: 'da', me: '俺',
      conv: { copneg: 'じゃない', darou: 'だろ', dana: 'だよな', negverb: NATTE, negadj: NATTE, noda: 'んだ' },
      inline: [[/([たるだ])が、/g, '$1けど、']],
      tails: [], tailRate: 0, sex: '男', age: [13, 32], modern: 3, ex: '命あっての物種だろ。逃げ道を数える。',
      w: { s1: { samete: 1, kowagari: 1, nonki: 1, higai: 1 }, s2: { jiyuu: 1, kazoku: 1 }, job: [] } },
    wakamono_f: { n: '今どきの若者（女）', hint: 'くだけた普通の女の子の言葉。「私」「〜だよね」「〜でしょ」', base: 'da', me: '私',
      conv: { ka: FEM_KA, copneg: 'じゃない', darou: 'でしょ', dana: 'だよね', negverb: WFL('ないよ'), negadj: WFL('ないよ'), da: WFL('だよ'), noda: WFL('んだよ'), datta: WFL('だったよ'), v: WFV, ta: (h, c) => softOk(c.body, 16) ? c.body + (HS(c.body) % 2 ? 'んだ' : 'の') : c.body },
      inline: [[/([たるだ])が、/g, '$1けど、']],
      tails: [], tailRate: 0, sex: '女', age: [13, 32], modern: 3, ex: '命あっての物種だよね。逃げ道を数えるね。',
      w: { s1: { samete: 1, kowagari: 1, higai: 1, kanpeki: 1 }, s2: { jiyuu: 1, kazoku: 1, kouhei: 1 }, job: [] } },
    otokomasari: { n: '男まさり', hint: '荒っぽい男言葉を使う女性。「あたい」「あたし」「〜だぜ」', base: 'da', me: 'あたい',
      conv: { copneg: 'じゃねえ', darou: 'だろ', negverb: NEG('ねえ', { drop: true }), negadj: 'ねえ', noda: 'んだ' },
      tails: ['ぜ'], tailRate: 0.3, sex: '女', age: [14, 50], ex: '力のある言葉しか誰も聞かねえ。前に出るぜ。',
      w: { s1: { okorippoi: 3, tanoshii: 1 }, s2: { chikara: 3, jiyuu: 2 }, job: [[/戦士|傭兵|盗賊|斥候|蛮族|武闘|海賊|狩人/, 3]] } },
    kouki: { n: '高貴な姫', hint: '古風で位の高い女性の言葉。「わらわ」「〜じゃ」「〜のじゃ」。姫・王女・女王・王妃だけ', base: 'da', me: 'わらわ', old: true, needJob: true,
      conv: { negverb: NEG('ぬ', { suru: 'せ' }), negadj: 'ないのじゃ', da: 'じゃ', dana: 'じゃな', darou: 'であろう', noda: 'のじゃ', datta: 'であった' }, q: { da: 'じゃ' },
      jobOnly: /姫|王女|女王|王妃|皇/, jobAge: [[/姫|王女/, 35]], noImp: true,
      inline: [[/だから/g, 'じゃから'], [/だが/g, 'じゃが']],
      tails: ['のじゃ'], tailRate: 0.35, sex: '女', age: [8, 70], ex: '取り乱すのは見苦しいのじゃ。',
      w: { s1: { mie: 1 }, s2: { meiyo: 1 }, job: [[/姫|王女|女王|王妃|皇/, 8]] } },
    ouja: { n: '王者', hint: '人の上に立つ者の尊大な言葉。「余」「我」「〜である」「〜ぞ」。王・皇帝・魔王・領主・将軍だけ', base: 'da', me: '余', old: true, needJob: true,
      conv: { negverb: NEG('ぬ', { suru: 'せ' }), da: 'である', dana: 'であるな', darou: 'であろう', datta: 'であった' },
      jobOnly: /^王$|国王|皇帝|魔王|領主|将軍/,
      tails: ['ぞ'], tailRate: 0.35, sex: null, age: [18, 90], ex: '強い者が場を決めるぞ。',
      w: { s1: { mie: 1 }, s2: { chikara: 1, meiyo: 1 }, job: [[/^王$|国王|皇帝|魔王|領主|将軍/, 8]] } },
    // ---- 方言の型。出身（home）で決まる。気質や信条ではなく「どこで育ったか」の印 ----
    kansai: { n: '西のことば', hint: '西の商都の言葉（関西風）。「うち」「わい」「〜や」「〜やで」「〜へん」', base: 'da', me: 'わい', home: 'west', homeRate: 0.8,
      conv: { copneg: 'やない', dearu: DEARU('んや', 'や'), nakereba: NAKEREBA('なあかん'), tewa: TEWA(t => (t === 'て' ? 'たら' : 'だら') + 'あかん'), chigai: h => h + 'あらへん', negverb: NEG('へん', { suru: 'せえ', deki: 'でけ', drop: true }), da: 'や', dana: 'やな', darou: 'やろ', noda: 'んや', datta: 'やった',
        imp: W_IMP, te: TE_NAI('んといて', 'せんといて'), vol: (h, c) => c.body.replace(/([よこそとのもろごぞぼ])う$/, '$1か') }, q: { da: 'や' },
      inline: [...HARD_INLINE, [/だから/g, 'やから'], [/だが/g, 'やけど'], [/だけど/g, 'やけど'], NAI_MID('へん', { suru: 'せえ', deki: 'でけ', drop: true }), [/ほんとうに/g, 'ほんまに'], [/どうして(?=い|お)/g, 'どないして'], [/どうして/g, 'なんで']],
      tails: ['で', 'わ'], tailKinds: ['adj'], tailRate: 0.35, sex: null, age: [12, 90], ex: '命あっての物種や。逃げ道を数えるで。',
      w: { s1: {}, s2: {}, job: [] } },
    tohoku: { n: '北のことば', hint: '北の山里の言葉（東北風）。「おら」「〜だべ」「〜ねえ」', base: 'da', me: 'おら', home: 'north', homeRate: 0.6, thick: true, noNoble: true, localJob: /村|百姓|農|木こり|漁|坑夫|猟|狩人|宿|料理|花売り|使用人|町の人|女将|下男|荷/, light: null,
      conv: { copneg: 'でねえ', dearu: DEARU('んだ', 'だ'), nakereba: NAKEREBA('ねばなんねえ'), tewa: TEWA(t => t + 'はなんねえ'), negverb: NEG('ねえ', { drop: true }), negadj: 'ねえ', darou: 'だべ', dana: 'だなあ', noda: 'んだ', te: TE_NAI('ねえで', 'しねえで') },
      inline: [...HARD_INLINE, NAI_MID('ねえ', { drop: true })],
      tails: ['べ'], tailKinds: ['adj'], tailRate: 0.4, sex: null, age: [12, 90], ex: '命あっての物種だ。逃げ道を数えるべ。',
      w: { s1: {}, s2: {}, job: [] } },
    kyushu: { n: '南のことば', hint: '南の港町の言葉（九州風）。「おい」「うち」「〜たい」「〜ばい」「〜ん」', base: 'da', me: 'おい', home: 'south', homeRate: 0.6, thick: true, noNoble: true, localJob: /村|百姓|農|木こり|漁|坑夫|猟|狩人|宿|料理|花売り|使用人|町の人|女将|下男|荷/, light: 'kyushu_w',
      conv: { copneg: 'じゃなか', negverb: NEG('ん', { suru: 'せ' }), negadj: 'なか', da: KI_TAI, dana: 'やね', darou: (h, c) => h.replace(/の$/, 'と') + 'やろ', noda: 'とよ', datta: 'やった', v: 'ばい', dearu: DEARU('とよ', 'たい'), nakereba: NAKEREBA('ねばならん'), tewa: TEWA(t => t + 'はならん'),
        imp: K_IMP, te: TE_NAI('んで', 'せんで') },
      inline: [...HARD_INLINE, [/だから/g, 'やけん'], [/だが/g, 'ばってん'], [/だけど/g, 'ばってん'], NAI_MID('ん', { suru: 'せ' })],
      tails: [], tailRate: 0, sex: null, age: [12, 90], ex: '命あっての物種たい。逃げ道を数えるばい。',
      w: { s1: {}, s2: {}, job: [] } },
    kyoto: { n: '都のことば', hint: '古い都のはんなりした言葉（京都風）。女性。「うち」「〜どす」「〜まへん」「〜ますえ」「〜まひょ」', base: 'desu', me: 'うち', home: 'kyo', homeRate: 0.6, thick: true, localJob: /芸妓|舞妓|女将|巫女|踊り子/, light: 'kansai',
      conv: { copneg: 'やおへん', narimasen: (h, c) => c.body.replace(/(?:なければ|なくては|ねば)(?:なりません|いけません)$/, 'なあきまへん').replace(/([てで])は(?:なりません|いけません)$/, '$1はあきまへん'), masen: 'まへん', masenka: 'まへんか', desune: 'どすなあ', deshou: 'どすやろ', mashou: 'まひょ', desu: 'どす', desuka: 'どすか', deshita: 'どした', masendeshita: 'まへんどした', mashita: 'ましたえ', masu: 'ますえ',
        kudasai: (h) => /しないで$/.test(h) ? h.slice(0, -4) + 'せんといておくれやす' : /ないで$/.test(h) ? h.slice(0, -3) + 'んといておくれやす' : /[てで]$/.test(h) ? h + 'おくれやす' : h + 'ください' },
      inline: [...HARD_INLINE, [/ですから/g, 'どすさかい'], [/ですが/g, 'どすけど'], NAI_MID('へん', { suru: 'せえ', deki: 'でけ', drop: true })],
      tails: [], tailRate: 0, sex: '女', age: [14, 90], ex: '命あっての物種どす。逃げ道を数えますえ。',
      w: { s1: {}, s2: {}, job: [] } },
    kyushu_w: { n: '南のことば（若い世代）', hint: '南の港町の若い人の言葉（九州風・薄め）。「うち」「俺」「〜やけん」「〜ん」「〜やろ」。「ばい」「たい」は使わない', base: 'da', me: '俺', home: 'south', homeRate: 0.6, noNoble: true,
      conv: { negverb: NEG('ん', { suru: 'せ' }), da: 'なんよ', dearu: DEARU('とよ', 'なんよ'), nakereba: NAKEREBA('んといかん'), tewa: TEWA(t => t + 'はいかん'), dana: 'やね', darou: (h, c) => h.replace(/の$/, 'と') + 'やろ', noda: 'とよ', datta: 'やった', imp: K_IMP, te: TE_NAI('んで', 'せんで') },
      inline: [...HARD_INLINE, [/だから/g, 'やけん'], [/だが/g, 'けど'], [/だけど/g, 'けど'], NAI_MID('ん', { suru: 'せ' })],
      tails: [], tailRate: 0, sex: null, age: [12, 49], ex: '命あっての物種やけん。逃げ道を数える。',
      w: { s1: {}, s2: {}, job: [] } },
    edo: { n: '下町のことば', hint: '下町の威勢のいい言葉（江戸風）。男性。「あっし」「オイラ」「〜でい」「〜ねえ」', base: 'da', me: 'あっし', home: 'shita', homeRate: 0.5, old: true, thick: true, noNoble: true, localJob: /職人|鍛冶|大工|料理|漁|団長|商|坑夫|木こり/, light: null,
      conv: { copneg: 'じゃねえ', dearu: DEARU('んでい', 'でい'), nakereba: NAKEREBA('なきゃならねえ'), tewa: TEWA(t => (t === 'て' ? 'ちゃ' : 'じゃ') + 'ならねえ'), negverb: NEG('ねえ', { drop: true }), negadj: 'ねえ', darou: 'だろうよ', da: 'でい', noda: 'んでい', vol: 'ぜ', datta: 'だったぜ', v: 'ぜ', adj: 'ぜ', ta: 'ぜ', imp: E_IMP, te: TE_NAI('ねえで', 'しねえで') }, q: { da: 'でい' },
      inline: [...HARD_INLINE, NAI_MID('ねえ', { drop: true })],
      tails: [], tailRate: 0, sex: '男', age: [14, 90], ex: '命あっての物種でい。逃げ道を数える。',
      w: { s1: {}, s2: {}, job: [] } },
    // ---- あとから足した型（番号を変えないよう末尾に置く） ----
    gunjin: { n: '軍人', hint: '兵隊のきまじめな言葉。「自分」「〜であります」。兵・戦士・傭兵など', base: 'da', me: '自分',
      conv: { da: 'であります', dana: 'でありますな', darou: 'でありましょう', noda: 'のであります', datta: 'でありました', copneg: 'ではありません', negverb: 'ないであります', negadj: 'ないであります', v: 'であります', adj: 'であります', ta: 'であります', dearu: DEARU('のであります', 'であります') },
      jobOnly: /兵|戦士|傭兵/, jobBonus: 14,
      tails: [], tailRate: 0, sex: '男', age: [18, 65], ex: '先に逃げ道を確認するであります。',
      w: { s1: { kanpeki: 2, kowagari: 1 }, s2: { giri: 2, chikara: 1, kouhei: 1 }, job: [] } },
  };

  // ---------- 規則の「芯」と「飾り」・依頼の型・細かい文末 ----------
  // cls[規則] の印：K＝切迫（tense）で外す（だよ・ないって・よ 等。人生第4回）／L＝軽さ・決め（さ・ないさ・だよっ・もん 等。下っ端の「っす」は第4回から芯）／D＝間のび（ぉ・ですわね・のである 等）／R＝相手に向ける（よ・ね・でしょ 等）。印の無い規則は芯。
  //   芯＝その人がその人であるための最小限の文末（じゃ・でござる・ですわ・や・どす・西や北の否定・である 等）。いつも全部の文に効く。
  //   飾り＝印のある規則、tails（決め語尾）、bang（「。」を「！」に）。1つの台詞に多くて1文。grave では全部外す。tense は D を外す。mono は R と tails を外す。
  // tailCls＝決め語尾ごとの印（無ければ L）。tailExp＝説明・伝聞に聞こえる決め語尾（動詞の終止形＝意志かもしれない文には付けない）
  const VOICE_PATCH = {
    nekketsu: { req: 'rough' },
    bukkira: { req: 'rough' },
    otona: { req: 'neutral', cls: { darou: 'RK', da: 'RK', noda: 'RK', datta: 'RK' } },
    seinen: { cls: { deshou: 'R' } },
    ojou: { cls: { desune: 'D', deshou: 'R', mashou: 'R' }, conv: { tehoshiidesu: 'いただきたいですわ' } },
    genki: { req: 'soft', cls: { tehoshii: 'RK', da: 'RK', v: 'RK', teiru: 'RK', adj: 'RK', ta: 'RK', negverb: 'RK', negadj: 'RK', copneg: 'RK', noda: 'RK', datta: 'RK', rec: 'RK' }, tailCls: { よっ: 'LR' } },   // 第7回：文末の「よ・ね・の」は飾り（1つの台詞に1文だけ。独り言・切迫・深刻な場面では付けない）。全部の文に付けると「探すね！」「押しているね」と機械的に聞こえた（argon 3〜6、neon 9）
    ottori: { req: 'soft', cls: { dana: 'D', darou: 'D', negverb: 'D', negadj: 'D', copneg: 'D', da: 'D', datta: 'D', noda: 'D', adj: 'DR', v: 'DR' } },
    anego: { req: 'anego', cls: { dana: 'R', darou: 'L', negverb: 'R', negadj: 'R', copneg: 'R', da: 'R', noda: 'R', datta: 'R', v: 'R', adj: 'R' } },
    roujin: { req: 'roujin', cls: { negadj: 'LDR' }, kuse: ['tehoshii'], conv: { teiru: 'おる', teita: 'おった', tehoshii: reqTail('んで', 'せんで', 'ほしいんじゃ') }, tailCls: { のう: 'D' } },
    bujin: { kuse: ['tehoshii'], conv: { teiru: 'おる', teita: 'おった', tehoshii: 'ほしゅうござる' }, req: 'bujin' },
    gakusha: { req: 'gakusha', conv: { tehoshii: 'もらいたい' }, tailCls: { のである: 'D' }, tailExp: ['のである'] },
    shitappa: { req: 'shitappa', conv: { teiru: 'るっす', teita: 'たっす', teshimau: h => TIMAU(h) + 'っす', nasai: 'なさい' } },   // 「〜っす」は芯（全部の文に付く。第4回：後半の文にしか付かない不ぞろいを解消）
    kodomo: { req: 'kodomo', cls: { da: 'LR', dana: 'R', darou: 'R', negverb: 'LR', negadj: 'LR', copneg: 'LR', noda: 'LR', datta: 'LR' } },
    shounin: { cls: { desu: 'LR', deshou: 'LR', desuka: 'LR', desune: 'LR' }, conv: { teimasu: 'おります', teimashita: 'おりました', tehoshiidesu: 'いただきたいです' } },   // 「でございます」は飾り（1つの台詞に多くて1文）
    kidori: { req: 'kidori', cls: { da: 'LK', dana: 'R', darou: 'R', noda: 'LK', datta: 'LK', negverb: 'LK', negadj: 'LK', copneg: 'LK' }, tailExp: ['のさ'], tailCls: { のさ: 'LK' } },
    josei: { cls: { deshou: 'R', mashou: 'R' } },
    wakamono_m: { req: 'rough', cls: { dana: 'R', negverb: 'LRK', negadj: 'LRK' } },
    wakamono_f: { req: 'soft', cls: { darou: 'RK', dana: 'RK', negverb: 'RK', negadj: 'RK', da: 'RK', noda: 'RK', datta: 'RK', v: 'RK', ta: 'RK' } },
    otokomasari: { req: 'rough' },
    kouki: { req: 'kouki', kuse: ['tehoshii'], conv: { teiru: 'おる', teita: 'おった', tehoshii: 'ほしいのじゃ' }, tailExp: ['のじゃ'] },
    ouja: { req: 'ouja', kuse: ['tehoshii'], conv: { teiru: 'おる', teita: 'おった', tehoshii: 'ほしいのである' } },
    kansai: { quiet: { v: 'んや', adj: 'んや', ta: 'んや', negadj: 'んや', tehoshii: null }, tailKinds: ['_'], cls: { tehoshii: 'G', v: 'G', adj: 'G', ta: 'G', negadj: 'G' }, kuse: ['tehoshii'], conv: { negadj: h => h + 'ないねん', v: 'で', adj: (h, c) => /(?:たい|ほしい)$/.test(c.body) ? c.body + 'んや' : c.body + 'で', ta: 'で', negta: NEG('へんかった', { suru: 'せえ', deki: 'でけ', drop: true }), teiru: TO('る'), teita: TO('った'), teshimau: 'まう', tehoshii: W_HOSHII, tekure: W_KURE, nasai: 'なはれ', rec: (h, c) => c.body.replace(/い[いよ]$/, 'ええ') } },
    tohoku: { req: 'rough', quiet: { v: 'んだ', adj: 'んだ', ta: 'んだ', da: 'なんだ', datta: 'んだ', vol: null }, tailKinds: ['_'], cls: { v: 'G', da: 'G', adj: 'G', ta: 'G', datta: 'G', vol: 'G' }, conv: { vol: VOL_DICT('べ'), datta: 'だったべ', v: 'べ', da: 'だべ', adj: 'べ', ta: 'べ', negta: NEG('ねがった', { drop: true }), teiru: 'る', teita: 'た', teshimau: TIMAU, tehoshii: reqTail('ねえで', 'しねえで', 'けろ', TEITE_E), tekure: reqTail('ねえで', 'しねえで', 'けろ', TEITE_E), nasai: 'なんせ' } },
    kyushu: { quiet: { v: 'とよ', ta: 'とよ', vol: null }, cls: { v: 'G', ta: 'G', vol: 'G' }, kuse: ['tehoshii'], conv: { vol: 'ばい', adj: ADJ_KA, ta: 'ばい', negta: NEG('んかった', { suru: 'せ' }), teiru: TO('る'), teita: TO('った'), tehoshii: reqTail('んで', 'せんで', 'ほしか'), tekure: reqTail('んで', 'せんで', 'くれんか', TEITE_W), nasai: 'なっせ' } },
    kyushu_w: { quiet: { v: 'とよ', adj: 'とよ', negadj: 'とよ', vol: null }, cls: { v: 'G', adj: 'G', ta: 'G', negadj: 'G', vol: 'G' }, conv: { vol: 'や', negadj: h => h + 'ないっちゃ', v: 'っちゃ', adj: 'っちゃ', ta: 'とよ', tehoshii: (h, c) => c.body, nasai: (h, c) => c.body, negta: NEG('んかった', { suru: 'せ' }), teiru: TO('る'), teita: TO('った') } },
    kyoto: { quiet: { mashita: null }, cls: { mashita: 'G' } },
    edo: { quiet: { v: 'んでい', adj: 'んでい', ta: 'んでい', datta: 'んでい', vol: null }, cls: { v: 'G', adj: 'G', ta: 'G', datta: 'G', vol: 'G' }, conv: { teiru: 'る', teita: 'た', teshimau: TIMAU, tehoshii: reqTail('ねえで', 'しねえで', 'くんな', TEITE_E), tekure: reqTail('ねえで', 'しねえで', 'くんな', TEITE_E), nasai: 'なせえ' } },
    gunjin: { req: 'rough', conv: { nasai: 'なさい' }, cls: { da: 'L', dana: 'L', darou: 'L', noda: 'L', datta: 'L', negverb: 'L', negadj: 'L', v: 'L', adj: 'L', ta: 'L' } },
  };
  Object.keys(VOICE_PATCH).forEach(k => { const v = VOICES[k], o = VOICE_PATCH[k]; Object.keys(o).forEach(f => { v[f] = (f === 'conv' || f === 'cls' || f === 'tailCls') ? Object.assign({}, v[f], o[f]) : o[f]; }); });

  // ---------- 人生第6回の追加 ----------
  //   q＝問いの文末（疑問文の付け替え。上の looksQuestion の説明）。規則の無い種類は付け替えない（飾りも付かない）
  //   ng＝気質（s1）・信条（s2）との相性が悪い型の減点（pick で重みから引く。0.1 を下回らない）：物静か・冷めた人に熱血少年、など真逆の口調を出にくくする
  //   wjob＝仕事による減点（神官に荒っぽい型・ギルド職員に熱血少年や今どきの若者・豪商にぶっきらぼう、など。禁止にすると若い神官などで年齢に合う型が尽きるので、0.1 まで下げるだけ）
  const PRIEST = '僧|神官|司祭|巫女|聖職|シスター|神主', CLERK = 'ギルド職員|受付|窓口|職員';
  const jb = (...xs) => new RegExp(xs.join('|'));
  const kansaiKa = (h, c) => /の$/.test(h) ? [h.slice(0, -1) + 'んか', qPunct(c)] : /だろう$/.test(h) ? [h.replace(/だろう$/, 'やろ') + 'か', qPunct(c)] : [c.body, c.punct];
  const tohokuKa = (h, c) => /の$/.test(h) ? [h.slice(0, -1) + 'んだべ', qPunct(c)] : [c.body, c.punct];
  const kyushuKa = (h, c) => /の$/.test(h) ? [h.slice(0, -1) + 'と', qPunct(c)] : [c.body, c.punct];
  const Q_JA = (nv, da, darou) => ({ da: QA(da), datta: QA(da === 'じゃ' ? 'じゃった' : 'であった'), v: QA('のじゃ'), ta: QA('のじゃ'), adj: QA('のじゃ'), noda: QA('のじゃ'), negverb: QNEG(NEG(nv, { suru: 'せ' }), 'のか'), negadj: QA('ないのか'), copneg: QA('ではないのか'), darou: QA(darou) });
  const VOICE_PATCH6 = {
    nekketsu: { wjob: [[jb(PRIEST, CLERK), -9]], ng: { s1: { samete: 1, kowagari: 1, nonki: 1, higai: 1 }, s2: { kane: 1 } } },
    bukkira: { wjob: [[jb('貴族|令嬢|王|姫|皇帝|領主|将軍|宮廷|後援者|豪商'), -9], [jb(PRIEST), -9]], ng: { s1: { hitonatsukkoi: 1 } } },
    otona: { ng: { s1: { okorippoi: 1, mie: 0.5 } }, q: { v: QB('のか'), ta: QB('のか'), adj: QB('のか'), da: QB('なのか'), datta: QB('だったのか'), noda: QB('のか'), negverb: QB('ないのか'), negadj: QB('ないのか'), copneg: QB('ではないのか') } },
    seinen: { ng: { s1: { okorippoi: 1 }, s2: { chikara: 0.5 } } },
    genki: { ng: { s1: { samete: 1, higai: 1, kowagari: 0.5 } }, wjob: [[jb(PRIEST), -9]], urgentSkip: /^(?:v|adj|ta|da|datta|noda|negverb|negadj|copneg|rec|tehoshii)$/, q: Q_FEM },
    ottori: { ng: { s1: { okorippoi: 1, kanpeki: 0.5 }, s2: { chikara: 1 } }, cls: { tehoshii: 'RK' }, conv: { tehoshii: (h, c) => c.body + (HS(c.body) % 2 ? 'な' : 'の') }, q: Q_FEM },   // 「ほしいねぇ」（年寄りの響き）でなく「ほしいな／ほしいの」（neon 11）
    anego: { ng: { s1: { kowagari: 1, higai: 1 } }, wjob: [[jb(PRIEST), -9]], cls: { tehoshii: 'R' }, conv: { tehoshii: (h, c) => c.body + (HS(c.body) % 2 ? 'ね' : 'んだが') }, q: Q_KAI },   // 姉御の「ほしいよ」は甘えた響き（neon 18）→「ほしいね／ほしいんだが」
    roujin: { q: Q_JA('ん', 'じゃ', 'じゃろうか') },
    bujin: { ng: { s1: { kowagari: 1, nonki: 0.5 } }, q: { v: QB('か'), ta: QB('か'), adj: QB('か'), da: QB('でござるか'), datta: QB('でござったか'), noda: QB('のでござるか'), negverb: QNEG(NEG('ぬ', { suru: 'せ' }), 'か', false), negadj: QB('ないか'), copneg: QB('ではござらぬか') } },
    gakusha: { q: { v: QB('のか'), ta: QB('のか'), adj: QB('のか'), da: QB('なのか'), datta: QB('だったのか'), noda: QB('のか'), negverb: QB('ないのか'), negadj: QB('ないのか'), copneg: QB('ではないのか') } },
    shitappa: { ng: { s1: { mie: 1 } }, q: { v: QA('んすか'), ta: QA('んすか'), adj: QA('んすか'), noda: QA('んすか'), da: QA('なんすか'), datta: QA('だったんすか'), negverb: QA('ないんすか'), negadj: QA('ないんすか'), copneg: QA('じゃないんすか') } },
    kodomo: { conv: { ka: FEM_KA }, q: Q_FEM },
    seishoku: { ng: { s2: { chikara: 1, kane: 1 } } },
    kidori: { wjob: [[jb(PRIEST, '村人|パン屋|農|百姓|木こり|坑夫|漁|下男|荷運|高校生|学生|生徒|薬草|大工|鍛冶|職人|宿'), -9]], ng: { s1: { hitonatsukkoi: 0.5, nonki: 0.5 } }, q: Object.assign({}, Q_KAI) },   // 気取り屋は貴族・商人・芸人向き（村人・職人・高校生には出ない。argon 13）
    josei: { ng: { s1: { okorippoi: 1 } } },
    wakamono_m: { wjob: [[jb(PRIEST, CLERK), -9]], q: { v: QP, ta: QP, adj: QP, da: QP, datta: QP, noda: QP, negverb: QP, negadj: QP, copneg: QP } },
    wakamono_f: { wjob: [[jb(PRIEST, CLERK), -9]], q: Q_FEM },
    otokomasari: { wjob: [[jb(PRIEST), -9]], ng: { s1: { kowagari: 1 } }, q: { v: QA('んだ'), ta: QA('んだ'), adj: QA('んだ'), noda: QA('んだ'), da: QA('なんだ'), datta: QA('だったんだ'), negverb: QNEG(NEG('ねえ', { drop: true }), 'んだ'), negadj: QA('ねえんだ'), copneg: QA('じゃねえのか') } },
    kouki: { q: Q_JA('ぬ', 'じゃ', 'であろうか') },
    ouja: { q: { v: QB('か'), ta: QB('か'), adj: QB('か'), da: QB('であるか'), datta: QB('であったか'), noda: QB('のか'), negverb: QNEG(NEG('ぬ', { suru: 'せ' }), 'か', false), negadj: QB('ないか'), copneg: QB('ではないか') } },
    gunjin: { ng: { s1: { nonki: 1 } }, q: { v: QA('のでありますか'), ta: QA('のでありますか'), adj: QA('のでありますか'), noda: QA('のでありますか'), da: QA('でありますか'), datta: QA('でありましたか'), negverb: QA('ないのでありますか'), negadj: QA('ないのでありますか'), copneg: QA('ではありませんか'), ka: (h, c) => [/だろう$/.test(h) ? h.replace(/だろう$/, 'でありましょう') + 'か' : h + 'でありますか', qPunct(c)] } },
    kansai: { q: { da: QA('や'), datta: QA('やった'), v: QA('んや'), ta: QA('んや'), adj: QA('んや'), noda: QA('んや'), darou: QA('やろ'), negverb: QNEG(NEG('へん', { suru: 'せえ', deki: 'でけ', drop: true }), 'のや'), negadj: QA('ないんや'), copneg: QA('やないんか'), teiru: (h, c) => [TO('る')(h) + 'んや', qPunct(c)], teita: (h, c) => [TO('った')(h) + 'んや', qPunct(c)], ka: kansaiKa } },
    tohoku: { q: { da: QA('だべ'), datta: QA('だったべ'), v: QA('んだべ'), ta: QA('んだべ'), adj: QA('んだべ'), noda: QA('んだべ'), darou: QA('んだべ'), negverb: QNEG(NEG('ねえ', { drop: true }), 'んだべ'), negadj: QA('ねえんだべ'), copneg: QA('でねえんだべ'), teiru: QA('るんだべ'), teita: QA('たんだべ'), ka: tohokuKa } },
    kyushu: { q: { da: QA('ね'), datta: QA('やったと'), v: QA('と'), ta: QA('と'), adj: (h, c) => [ADJ_KA(h, c) + 'と', qPunct(c)], noda: QA('とね'), darou: QA('やろか'), negverb: QNEG(NEG('ん', { suru: 'せ' }), 'と'), negadj: QA('なかと'), copneg: QA('じゃなかと'), teiru: (h, c) => [TO('る')(h) + 'と', qPunct(c)], teita: (h, c) => [TO('った')(h) + 'と', qPunct(c)], ka: kyushuKa } },
    kyushu_w: { q: { da: QA('ね'), datta: QA('やったと'), v: QA('と'), ta: QA('と'), adj: QA('と'), noda: QA('とね'), darou: QA('やろか'), negverb: QNEG(NEG('ん', { suru: 'せ' }), 'と'), negadj: QA('ないと'), copneg: QA('じゃないと'), teiru: (h, c) => [TO('る')(h) + 'と', qPunct(c)], teita: (h, c) => [TO('った')(h) + 'と', qPunct(c)], ka: kyushuKa } },
    edo: { conv: { da: (h, c) => [...c.body].length <= 6 ? h + 'でい' : h + 'だぜ' }, q: Object.assign({}, Q_KAI, { da: QA('でい'), negverb: QNEG(NEG('ねえ', { drop: true }), 'のかい'), negadj: QA('ねえのかい'), copneg: QA('じゃねえのかい') }) },   // 「悪い空気でい」のような長い文の「でい」は「だぜ」に（argon 3）
  };
  Object.keys(VOICE_PATCH6).forEach(k => { const v = VOICES[k], o = VOICE_PATCH6[k]; if (o.wjob) v.w = Object.assign({}, v.w, { job: ((v.w && v.w.job) || []).concat(o.wjob) }); Object.keys(o).forEach(f => { if (f === 'wjob') return; v[f] = (f === 'conv' || f === 'cls' || f === 'tailCls') ? Object.assign({}, v[f], o[f]) : o[f]; }); });

  // ---------- 出身 ----------
  // 方言の型は、出身で決まる。w＝その出身になる割合。voice＝その土地の言葉の型（VOICES の home と対）。
  //   modern＝現代の日本から来た主人公での呼び名／isekai＝異世界の人での呼び名
  const HOMES = {
    std:   { modern: '関東', isekai: '王都のあたり', w: 60, voice: null },
    west:  { modern: '関西', isekai: '西の商都', w: 12, voice: 'kansai' },
    north: { modern: '東北', isekai: '北の山里', w: 8, voice: 'tohoku' },
    south: { modern: '九州', isekai: '南の港町', w: 8, voice: 'kyushu' },
    kyo:   { modern: '京都', isekai: '古い都', w: 5, voice: 'kyoto' },
    shita: { modern: '東京の下町', isekai: '王都の下町', w: 7, voice: 'edo' },
  };
  //   pickHome(rand, place, memo)：乱数は必ず1回。place＝その人の居場所（'村'・'町'・'山すその村' など、同じ場所の人は同じ文字列）。
  //   同じ place の人は、先に決まった人と同じ出身になりやすい（SAME_HOME の確率。乱数の同じ1回を使い回すので回数は変わらない）。
  //   memo＝出身を覚えておく入れ物（{}）。呼ぶ側（エンジン）が1つの人生ごとに作って渡す。渡さなければ PersonaVoice.homeMemo を使う（resetHomeMemo() で空にする）
  const SAME_HOME = 0.8;
  const homeMemo = {};
  function pickHome(rand, place, memo) {
    const r = rand || Math.random, ks = Object.keys(HOMES), total = ks.reduce((a, k) => a + HOMES[k].w, 0), tbl = memo || homeMemo;
    let x = r();
    if (place && tbl[place] && HOMES[tbl[place]]) { if (x < SAME_HOME) return tbl[place]; x = (x - SAME_HOME) / (1 - SAME_HOME); }
    let t = x * total, got = 'std';
    for (const k of ks) { t -= HOMES[k].w; if (t < 0) { got = k; break; } }
    if (place && !tbl[place]) tbl[place] = got;
    return got;
  }
  const resetHomeMemo = () => { Object.keys(homeMemo).forEach(k => delete homeMemo[k]); };
  const homeName = person => { const h = HOMES[person.home]; return h ? (person.era === 'modern' || person.era === 'past' ? h.modern : h.isekai) : ''; };

  // ---------- 二人称の表 ----------
  // 相手をどう呼ぶか。話し手の型と、相手との間柄（親しい・ふつう・目上・敵）で変わる。
  const YOU = {
    'お前': 'くだけた男言葉。対等か目下に', 'あんた': 'くだけた呼び方。気さく、または突き放し', '君': '穏やかに目下か対等を呼ぶ。少し気取った響き', 'あなた': '丁寧でよそゆき',
    'お前さん': '年かさの人が親しみをこめて', 'お主': '古風。武人や老人が対等に', '貴殿': '武人が敬意をこめて', 'そなた': '位の高い人が目下に',
    '貴様': '敵に向ける', 'てめえ': '荒っぽく敵に向ける', '（名前）': '名前を呼び捨て。親しい', '（名前）さん': '丁寧で親しい', '（名前）殿': '武人の敬称', '（名前）様': 'もっとも改まった敬称',
    '（名前）はん': '西や都のことばの敬称', 'お兄ちゃん・お姉ちゃん': '子どもが年上を呼ぶ', '旦那・お嬢さん': '商売人が客を呼ぶ', 'おめえ': '北や下町のくだけた呼び方', 'あんさん': '西のことばで丁寧に',
  };
  // 型ごとの二人称：[親しい相手, ふつう, 目上, 敵]。{ m, f } は話し手の性別で分ける。{名}＝相手の呼び名、{兄姉}＝相手の性別でお兄ちゃん／お姉ちゃん、{旦那}＝旦那／お嬢さん
  const YOU_BY_VOICE = {
    nekketsu: ['お前', 'お前', 'あんた', 'てめえ'], bukkira: [{ m: 'お前', f: 'あんた' }, 'あんた', 'あんた', '貴様'], otona: ['君', { m: '君', f: 'あなた' }, 'あなた', '君'],
    seinen: ['{名}さん', 'あなた', '{名}さん', 'あなた'], ojou: ['あなた', 'あなた', '{名}様', 'あなた'], genki: ['{名}', '{名}', '{名}さん', 'あんた'],
    ottori: ['{名}さん', '{名}さん', '{名}さん', 'あなた'], anego: ['あんた', 'あんた', 'あんた', 'あんた'], roujin: ['お前さん', 'お主', 'お主', '貴様'],
    bujin: ['お主', '貴殿', '{名}殿', '貴様'], gakusha: ['君', '君', 'あなた', '君'], shitappa: ['{名}さん', 'あんた', '{名}さん', 'てめえ'],
    kodomo: ['{名}', '{兄姉}', '{兄姉}', 'お前'], shounin: ['{名}さん', '{旦那}', '{旦那}', 'あなた'], seishoku: ['あなた', 'あなた', 'あなた', 'あなた'],
    kidori: ['君', '君', 'あなた', '君'], josei: ['{名}さん', 'あなた', '{名}さん', 'あなた'], wakamono_m: ['お前', '{名}', '{名}さん', 'お前'], wakamono_f: ['{名}', '{名}さん', '{名}さん', 'あんた'],
    otokomasari: ['あんた', 'あんた', 'あんた', 'てめえ'], kouki: ['そなた', 'そなた', 'そなた', 'そなた'], ouja: ['そなた', 'そなた', 'そなた', '貴様'],
    kansai: ['あんた', 'あんた', 'あんさん', 'あんた'], tohoku: ['おめえ', 'おめえ', 'あんた', 'おめえ'], kyushu: ['あんた', 'あんた', 'あんた', 'あんた'], kyushu_w: ['{名}', 'あんた', '{名}さん', 'あんた'],
    kyoto: ['{名}はん', '{名}はん', '{名}はん', 'あんた'], edo: ['おめえ', 'おめえ', '{旦那}', 'てめえ'], gunjin: ['お前', 'あなた', '{名}殿', '貴様'],
  };
  const REL_IDX = { close: 0, plain: 1, up: 2, foe: 3 };
  const jobOf = p => (p && (p.job || p.prevJob)) || '';   // 今の身分は job。無ければ前世の仕事
  const ROUGH_VOICE = /^(?:nekketsu|bukkira|otokomasari|wakamono_m|edo|tohoku|kyushu|kyushu_w|shitappa|gunjin|kodomo)$/;   // 荒っぽい・くだけた型は、貴族にも「〜様」と言わない
  // 話し手 speaker が、相手 listener を呼ぶ言葉。rel＝'close'（仲間・恋仲・信頼が厚い）／'plain'／'up'（相手が目上）／'foe'（敵）
  function pickYou(speaker, listener, rel) {
    const row = YOU_BY_VOICE[speaker.voice] || ['あなた', 'あなた', 'あなた', 'あなた'];
    let y = row[REL_IDX[rel] == null ? 1 : REL_IDX[rel]]; if (typeof y === 'object') y = speaker.sex === '女' ? y.f : y.m;
    const nick = (listener && (listener.nick || listener.name)) || '', fem = listener && listener.sex === '女';
    if (/\{名\}/.test(y) && !nick) return 'あなた';
    // 商売人・下町の「旦那」は客への呼びかけ。相手が雇い人・若者（話し手より15歳以上若い、または20歳未満）なら「お前さん」（旦那と呼ぶと上下が逆になる）
    if (/\{旦那\}/.test(y) && rel !== 'up' && listener && typeof listener.age === 'number' && (listener.age < 20 || (typeof speaker.age === 'number' && speaker.age - listener.age >= 15))) return speaker.voice === 'shounin' ? 'あなた' : 'お前さん';   // 商人は敬体なので「お前さん」と混ぜない（第5回 opus 17）
    // 身分（仕事から見る）：貴族が年上の平民を「〜さん」「君」と呼ぶと、見下しているのに丁寧という妙な響きになる→「あなた」。平民が貴族を呼ぶときは「〜様」。敵・仲間の間柄は変えない
    if (rel === 'plain' || rel === 'up' || rel == null) {
      const sN = NOBLE.test(jobOf(speaker)), lN = NOBLE.test(jobOf(listener));
      if (sN && !lN && listener && typeof listener.age === 'number' && typeof speaker.age === 'number' && listener.age - speaker.age >= 8 && /^(?:\{名\}さん|\{名\}はん|\{名\}|君)$/.test(y)) return 'あなた';
      if (!sN && lN && !ROUGH_VOICE.test(speaker.voice || '') && /^(?:\{名\}さん|\{名\}|あなた|君)$/.test(y)) return nick ? nick + '様' : 'あなた様';
    }
    return y.replace('{名}', nick).replace('{兄姉}', fem ? 'お姉ちゃん' : 'お兄ちゃん').replace('{旦那}', fem ? 'お嬢さん' : '旦那');
  }

  // ---------- どういう人がその型になるか（言葉での定義。くじ引きの条件は VOICES の sex・age・home・jobOnly・jobBan・noNoble・jobAge・old・w） ----------
  const WHO = {
    nekketsu: '10〜25歳の男。怒りっぽい・楽しいか気質で、名誉や力を信じる少年', bukkira: '15歳以上の男女。冷めている・怒りっぽい・被害的な気質の人。女性の一人称は「あたし」「自分」',
    otona: '28〜65歳の男女。公平や義理を重んじる、感情を出さない大人', seinen: '16〜40歳の男。きっちり・怖がりで、だれにでも敬語を使う人',
    ojou: '12〜35歳の女。仕事が貴族・令嬢・王女・姫の人だけ。見栄っぱりで美学や名誉を信じる', genki: '10〜28歳の女。人懐っこい・楽しいか気質の娘',
    ottori: '12〜34歳の女。のんきな気質の人（30代半ば以上の大人は「〜よぉ」と語尾を伸ばさない）', anego: '24〜55歳の女。世話焼きで義理や身内を大事にする人。酒場の女将や傭兵の頭。貴族・王族にはならない',
    roujin: '60歳以上の男女。長老・隠居・村長', bujin: '22〜65歳。仕事が騎士・剣士・武士・武者・浪人・忍者・武闘家・剣や武術の師の人だけ。名誉・義理・力を信じる（現代から来た人は使わない）',
    gakusha: '25〜80歳。仕事が学者・魔術師・魔法使い・賢者・医者・薬師・錬金術師の人だけ（見習い・生徒は除く）。原理を追う人（現代から来た人は使わない）',
    shitappa: '14〜40歳の男。仕事が下男・見習い・弟子・荷運び・新人冒険者・坑夫・斥候・盗賊の人だけ。貴族・王族にはならない。怖がりで人懐っこい小者',
    kodomo: '11歳までの子ども全員', shounin: '22〜70歳の男。仕事が商人・店主・行商の人だけ。金銭の合理主義（現代から来た人は使わない）',
    seishoku: '22〜85歳。仕事が僧・神官・司祭・巫女・シスター・神主の人だけ。信仰を信じる人', kidori: '16〜45歳の男。見栄っぱりで美学を信じる伊達者。詩人や芸人',
    josei: '20〜70歳の女。きっちり・世話焼きで礼儀正しい人。ギルド職員・店・宿の人は出やすい', wakamono_m: '13〜32歳の男。現代の日本から来た若者はまずこれ。異世界のふつうの若者にも',
    wakamono_f: '13〜32歳の女。現代の日本から来た若者はまずこれ。異世界のふつうの若者にも', otokomasari: '14〜50歳の女。怒りっぽく、力や自由を信じる。戦士・傭兵・盗賊・蛮族',
    kouki: '仕事が姫・王女・女王・王妃の女だけ（姫・王女は35歳まで）', ouja: '仕事が王・皇帝・魔王・領主・将軍の人だけ',
    kansai: '出身が「西の商都」（現代なら関西）の人の8割。12歳以上の男女。若い世代でも保たれる。「古い都」（京都）の若い人もこれ', tohoku: '出身が「北の山里」（現代なら東北）で、50歳以上か、村人・農夫・木こり・漁師・宿の人など土地で暮らす人。その6割。現代の日本から来た50歳未満は使わない（標準の言葉になる）。貴族・王族にはならない',
    kyushu: '出身が「南の港町」（現代なら九州）で、50歳以上か、土地で暮らす仕事の人。その6割。貴族・王族にはならない', kyushu_w: '出身が「南の港町」（現代なら九州）の49歳までの人で、濃い方言に当てはまらない人。その6割', kyoto: '出身が「古い都」（現代なら京都）の女性で、50歳以上か、芸妓・女将・巫女・踊り子。その6割。若い人は「西のことば」になる',
    edo: '出身が「王都の下町」の男性で、50歳以上か、職人・鍛冶・料理人・商人など。その5割（現代から来た人は使わない）。貴族・王族にはならない',
    gunjin: '18〜65歳の男。仕事が兵・戦士・傭兵の人だけ。きまじめな兵隊の言葉',
  };
  // 時代がかった型。現代の日本から来た主人公には使わない
  ['bujin', 'shounin', 'gakusha', 'roujin', 'gunjin'].forEach(k => { VOICES[k].old = k !== 'roujin'; });
  Object.keys(VOICES).forEach((k, i) => { VOICES[k].no = i + 1; });   // 類型の番号（タイプ1〜）

  // ---------- 一人称の表 ----------
  // 日本語は、一人称だけで性別・年齢・立場・人柄が伝わる。話し方の型とは別の部品として、人ごとに1つ決める。
  //   sex：使える性別（null は男女とも）／age：使える年齢／old：時代がかった言葉（現代人は使わない）／note：聞き手が受ける印象
  const ME = {
    '俺': { sex: '男', age: [12, 75], note: 'くだけた男言葉。ふつうの男性' },
    'オレ': { sex: '男', age: [8, 30], note: '少年らしい。勢いがある' },
    '僕': { sex: '男', age: [8, 50], note: 'やわらかい。育ちがよい、控えめ' },
    'ボク': { sex: null, age: [6, 24], note: '幼い、または中性的。女の子が使うと「ボクっ娘」' },
    'ぼく': { sex: '男', age: [0, 12], note: '小さな男の子' },
    '私': { sex: null, age: [14, 99], note: '改まった言葉。大人なら男女とも' },
    'わたし': { sex: '女', age: [4, 99], note: 'やわらかい女性の言葉' },
    'あたし': { sex: '女', age: [6, 60], note: 'くだけた女言葉。気さく' },
    'あたい': { sex: '女', age: [12, 55], old: true, note: '下町風で蓮っ葉。気が強い' },
    'うち': { sex: '女', age: [8, 40], note: '若い娘。西の言葉の響き' },
    'わたくし': { sex: null, age: [10, 99], note: 'もっとも改まった言葉。上品、身分が高い' },
    'わし': { sex: null, age: [45, 99], note: '年寄り。貫禄。西のことばでは壮年の男も使う' },
    '拙者': { sex: null, age: [16, 80], old: true, note: '武士がへりくだって言う' },
    '某': { sex: null, age: [18, 80], old: true, note: '「それがし」。硬い武人' },
    'わらわ': { sex: '女', age: [8, 99], old: true, note: '位の高い女性。古風' },
    '余': { sex: null, age: [16, 99], old: true, note: '王や君主' },
    '我': { sex: null, age: [16, 99], old: true, note: '尊大。人を超えた者' },
    '吾輩': { sex: '男', age: [30, 99], old: true, note: '尊大でもったいぶった男' },
    '小生': { sex: '男', age: [25, 99], old: true, note: '学のある男がへりくだって言う' },
    'あっし': { sex: '男', age: [16, 80], old: true, note: '職人や下町の人。下っ端も使う' },
    '手前': { sex: '男', age: [22, 80], old: true, note: '「てまえ」。商売人がへりくだって言う' },
    'オイラ': { sex: '男', age: [8, 40], old: true, note: '気のいい少年、小者' },
    '自分': { sex: null, age: [14, 60], note: '体育会や兵隊。きまじめ' },
    '（名前）': { sex: '女', age: [0, 15], note: '自分を名前で呼ぶ。幼い娘' },
    'わい': { sex: '男', age: [35, 99], note: '西のことばの年かさの男。若い人は「俺」' },
    'おら': { sex: null, age: [6, 99], note: '北のことば。素朴' },
    'おい': { sex: '男', age: [12, 99], note: '南のことばの男' },
  };
  // 型ごとに、合う一人称と重み。[一人称, 男のときの重み, 女のときの重み]
  const ME_BY_VOICE = {
    nekketsu: [['オレ', 5, 0], ['俺', 3, 0]],
    bukkira: [['俺', 5, 0], ['オレ', 1, 0], ['自分', 1, 1], ['あたし', 0, 4]],
    otona: [['私', 5, 5], ['俺', 1, 0], ['僕', 1, 0], ['わたし', 0, 2]],
    seinen: [['僕', 5, 0], ['私', 2, 0], ['自分', 1, 0]],
    ojou: [['わたくし', 0, 6], ['私', 0, 1]],
    genki: [['あたし', 0, 4], ['わたし', 0, 2], ['ボク', 0, 1], ['うち', 0, 1], ['（名前）', 0, 2]],
    ottori: [['わたし', 0, 5], ['私', 0, 1], ['うち', 0, 1]],
    anego: [['あたし', 0, 4], ['あたい', 0, 2], ['私', 0, 1]],
    roujin: [['わし', 6, 2], ['私', 1, 2], ['わたし', 0, 3]],
    bujin: [['拙者', 4, 1], ['某', 3, 2], ['私', 0, 3]],
    gakusha: [['私', 4, 5], ['吾輩', 2, 0], ['小生', 1, 0], ['僕', 1, 0]],
    shitappa: [['オイラ', 3, 0], ['あっし', 2, 0], ['自分', 2, 0], ['俺', 1, 0]],
    kodomo: [['ぼく', 5, 0], ['オレ', 2, 0], ['わたし', 0, 3], ['あたし', 0, 2], ['（名前）', 0, 3]],
    shounin: [['手前', 4, 0], ['私', 2, 0]],
    seishoku: [['私', 5, 5], ['わたくし', 1, 1]],
    kidori: [['僕', 5, 0], ['私', 1, 0]],
    josei: [['わたし', 0, 4], ['私', 0, 4], ['わたくし', 0, 1]],
    wakamono_m: [['俺', 5, 0], ['僕', 2, 0], ['自分', 1, 0]],
    wakamono_f: [['私', 0, 4], ['あたし', 0, 3], ['うち', 0, 2]],
    kansai: [['わい', 3, 0], ['俺', 3, 0], ['わし', 2, 0], ['うち', 0, 5], ['あたし', 0, 2], ['わたし', 0, 1]],
    tohoku: [['おら', 5, 4], ['俺', 2, 0], ['わたし', 0, 2]],
    kyushu: [['おい', 4, 0], ['俺', 3, 0], ['うち', 0, 4], ['あたし', 0, 2], ['わたし', 0, 1]],
    kyoto: [['うち', 0, 5], ['わたし', 0, 2]],
    kyushu_w: [['俺', 5, 0], ['自分', 1, 0], ['うち', 0, 4], ['私', 0, 3], ['あたし', 0, 2]],
    edo: [['あっし', 3, 0], ['オイラ', 2, 0], ['俺', 3, 0]],
    otokomasari: [['あたい', 0, 4], ['あたし', 0, 3], ['オレ', 0, 1]],   // 第4回：女性の「俺」はやめた（「俺」＋「〜あるぜ」で男性と取り違えられる）。カタカナ「オレ」だけ少し残す
    kouki: [['わらわ', 0, 6]],
    ouja: [['余', 4, 2], ['我', 3, 3], ['私', 0, 2]],
    gunjin: [['自分', 5, 0], ['私', 1, 0]],
  };
  // その人の一人称を決める。型に合う候補から、性別・年齢・時代で絞ってくじ引き。「（名前）」はその人の呼び名になる。
  function pickMe(person, key, rand) {
    const r = rand || Math.random, v = VOICES[key], x = r();   // 乱数は必ず1回だけ使う
    if (!v) return '自分';
    const age = typeof person.age === 'number' ? person.age : 30, female = person.sex === '女', modern = person.era === 'modern';
    const list = (ME_BY_VOICE[key] || []).map(([m, wm, wf]) => [m, female ? wf : wm]).filter(([m, w]) => { const d = ME[m]; return w > 0 && d && !(modern && d.old) && age >= d.age[0] && age <= d.age[1]; });
    if (!list.length) { const d = ME[v.me]; return d && d.sex && d.sex !== person.sex ? (female ? 'わたし' : '俺') : v.me; }   // 候補が尽きたら、性別に合う無難な一人称
    let t = x * list.reduce((a, b) => a + b[1], 0), out = list[list.length - 1][0];
    for (const [m, w] of list) { t -= w; if (t < 0) { out = m; break; } }
    return out === '（名前）' ? (person.nick || person.name || v.me) : out;
  }

  // ---------- 型のくじ引き ----------
  // 貴族・王族・宮廷の人（下っ端・下町・土地の濃い方言の型にならない）
  const NOBLE = /貴族|令嬢|王|姫|皇帝|領主|将軍|宮廷|後援者|豪商/;
  // その型を使ってよい仕事か。jobOnly＝この仕事の人だけ／jobBan＝この仕事の人は除く／noNoble＝貴族・王族・宮廷は除く／jobAge＝仕事ごとの年齢の上限
  function jobOk(v, job, age) {
    if (v.jobOnly && !(job && v.jobOnly.test(job))) return false;
    if (v.jobBan && job && v.jobBan.test(job)) return false;
    if (v.noNoble && job && NOBLE.test(job)) return false;
    if (v.jobAge && job) for (const [re, mx] of v.jobAge) if (re.test(job) && age > mx) return false;
    return true;
  }
  // 性別・年齢・仕事で絞り、気質・信条・仕事との相性で重みをつけて、くじ引きする。同じ人に同じ rand を渡せば同じ型。乱数は必ず2回使う。
  function pick(person, rand) {
    // 主人公は「転生者」ではなく前世の仕事で見る。era＝'modern'（現代の日本から来た人）には時代がかった型を使わない
    const r = rand || Math.random, p = person.persona || {}, age = typeof person.age === 'number' ? person.age : 30, job = person.prevJob || person.job || '', modern = person.era === 'modern';
    const x0 = r(), x1 = r();
    const fit = k => { const v = VOICES[k]; return !!v && (!v.sex || v.sex === person.sex) && !(modern && v.old) && jobOk(v, job, age); };
    // 方言：出身の土地の言葉が合えば、決まった割合でそれになる（昔の日本から来た武士などは半分の割合）
    const hv = person.home && HOMES[person.home] ? HOMES[person.home].voice : null, dv = hv && VOICES[hv];
    if (dv && x0 < dv.homeRate * (person.era === 'past' ? 0.5 : 1)) {
      // 濃い方言（thick）は、年配の人（50歳以上）か、土地を離れずに暮らす仕事の人だけ。現代の日本から来た50歳未満は使わない。
      // 当てはまらない人は、その土地の「若い世代の言葉」（light）があればそれ、なければ標準の言葉（下のくじ引き）になる。
      const useThick = !dv.thick || ((age >= 50 || (dv.localJob && dv.localJob.test(job))) && !(modern && age < 50));
      const k = useThick ? hv : dv.light, v = k && VOICES[k];
      if (v && fit(k) && age >= v.age[0] && age <= v.age[1]) return k;
    }
    let keys = Object.keys(VOICES).filter(k => !VOICES[k].home && fit(k) && age >= VOICES[k].age[0] && age <= VOICES[k].age[1]);
    if (!keys.length) keys = Object.keys(VOICES).filter(k => !VOICES[k].home && fit(k));
    if (!keys.length) return 'bukkira';
    const wt = keys.map(k => {
      const v = VOICES[k], w = v.w || {};
      let x = (v.w0 == null ? 1 : v.w0) + ((w.s1 && w.s1[p.s1]) || 0) + ((w.s2 && w.s2[p.s2]) || 0) + (modern ? v.modern || 0 : 0);
      if (v.jobOnly) x += v.jobBonus || 8;   // その仕事の人なら、その型が出やすい
      for (const [re, n] of (w.job || [])) if (job && re.test(job)) x += n;
      if (v.ng) x -= ((v.ng.s1 && v.ng.s1[p.s1]) || 0) + ((v.ng.s2 && v.ng.s2[p.s2]) || 0);
      if (v.ng || (w.job || []).some(e => e[1] < 0)) x = Math.max(0.1, x);   // 第6回：気質・信条と真逆の型（物静かな人に熱血少年、など）を出にくくする
      return x;
    });
    let t = x1 * wt.reduce((a, b) => a + b, 0);
    for (let i = 0; i < keys.length; i++) { t -= wt[i]; if (t < 0) return keys[i]; }
    return keys[keys.length - 1];
  }

  // ---------- 付け替え ----------
  // me＝その人の一人称（pickMe で決めたもの）。渡さなければ型の代表の一人称
  // you＝相手の呼び方（pickYou で決めたもの）。文の中の {君} に入る。渡さなければ「あなた」
  const TONES = ['normal', 'grave', 'tense'];
  // その文末の規則を探す。conv（なければ親の種類）→ req（依頼・命令の言い換え）の順。？の文は q だけ
  function getRule(v, kind, isQ) {
    const tbl = isQ ? v.q : v.conv, pk = PARENT[kind];
    if (tbl) { const key = tbl[kind] != null ? kind : (pk && tbl[pk] != null ? pk : null); if (key) return { key, f: tbl[key], cls: isQ ? '' : ((v.cls && v.cls[key]) || '') }; }
    if (isQ && Q_KA.test(kind) && v.conv && v.conv[kind] != null) return { key: kind, f: v.conv[kind], cls: (v.cls && v.cls[kind]) || '' };   // 問いの「〜か」（のか・ますか・ですか）は conv の規則（「〜の？」「〜っすか」「〜どすか」）
    if (!isQ && v.req && REQ[v.req] && REQ[v.req][kind]) return { key: kind, f: REQ[v.req][kind], cls: v.req === 'soft' && kind === 'tehoshii' ? 'RK' : '' };   // やわらかい女の「〜してね」は相手に向ける飾り（独り言・grave では「ほしい」のまま）
    return null;
  }
  // その印の飾りを、この tone・mono で付けてよいか
  const decoOk = (cls, tone, mono) => !(tone === 'grave' || (tone === 'tense' && /[DK]/.test(cls)) || (mono && /R/.test(cls)));   // K＝切迫（tense）のとき外す飾り
  // 1文ぶんの付け替え。base＝芯だけ／full＝飾りも付けた形（付けてよい tone のとき）。deco＝2つが違う（飾りが付く候補）
  //   urgent＝命令・警告・短い叫び（伏せて・来るな・逃げて・危ない！）：軽さを足す飾り（よぉ・だよっ・のさ・ね 等）を付けない（人生第5回）。方言の標識（G）と芯は付く
  const URGENT_KIND = /^(?:imp|te|tekure|nasai|kudasai)$/;
  const URGENT_WORD = /(?:伏せ|逃げ|にげ|避け|よけ|離れ|隠れ|かくれ|走っ|待っ|つかまっ|しゃがん|下がっ|気をつけ)て$|(?:伏せろ|逃げろ|避けろ|走れ|急げ|待て|止まれ|下がれ|隠れろ|構えろ|気をつけろ)$|(?:危ない|あぶない|危ねえ)$/;
  const isUrgent = (b, kind, punct) => URGENT_KIND.test(kind) || ([...b].length <= 10 && URGENT_WORD.test(b)) ? 2 : ([...b].length <= 6 && punct[0] === '！' ? 1 : 0);   // 2＝命令・警告（芯の軽い語尾も外す型がある）／1＝短い叫び
  function convSentence(v, s, tone, mono) {
    tone = tone || 'normal';
    const kind = classify(s.body, v.base), isQ = looksQuestion(s.body, kind, s.punct), urgent = isUrgent(s.body, kind, s.punct);
    let rule = getRule(v, kind, isQ);
    let base = { body: s.body, punct: s.punct }, full = base, core = false, isG = false;
    if (rule && /G/.test(rule.cls) && tone === 'grave' && v.quiet && v.quiet[rule.key] !== undefined) {   // 深刻・静かな場面の方言の標識は、軽い語尾（で・べ・ぜ）でなく説明の形（〜んや・〜んだ）に。null なら付けない
      rule = v.quiet[rule.key] === null ? null : Object.assign({}, rule, { f: v.quiet[rule.key] });
    }
    if (rule) {
      const sfx = rule.key === 'copneg' ? (s.body.match(COP_SUF) || [''])[0] : (SUF[rule.key] || ''), head = s.body.slice(0, s.body.length - sfx.length);
      const out = typeof rule.f === 'function' ? rule.f(head, { kind: rule.key, body: s.body, punct: s.punct, last: head.slice(-1) }) : head + rule.f;
      let o = Array.isArray(out) ? { body: out[0], punct: out[1] } : out != null ? { body: out, punct: s.punct } : base;
      isG = /G/.test(rule.cls);   // G＝方言の標識：tone・mono によらず付けてよい。ただし apply が「その台詞に核（芯）が1つも出なかったとき」だけ、最後の1文に付ける
      if (!rule.cls) { if (urgent === 2 && (v.urgentPlain || (v.urgentSkip && v.urgentSkip.test(rule.key))) && !isQ) o = null; if (o) { base = full = o; core = o.body !== s.body; } }
      else if (isG) full = o;
      else if (!urgent && decoOk(rule.cls, tone, mono)) full = o;
    }
    if (v.inline) for (const e of v.inline) {
      const re = e[0], to = e[1], nb = base.body.replace(re, to);
      base = { body: nb, punct: base.punct }; full = full === base ? base : { body: full.body.replace(re, to), punct: full.punct };
    }
    if (v.bang && !isQ && decoOk('L', tone, mono) && full.punct[0] === '。' && (!v.bangSoft || (full.body !== s.body && softOk(s.body, 16)))) full = { body: full.body, punct: '！' + full.punct.slice(1) };
    // plain＝規則を使わない形（方言の inline だけ効かせた文）。口ぐせ止め（kuse）で、2回目以降の文をこれに戻す
    let plain = { body: s.body, punct: s.punct };
    if (v.inline) for (const e of v.inline) plain = { body: plain.body.replace(e[0], e[1]), punct: plain.punct };
    return { kind, rule, base, full, plain, src: s, urgent, isQ, core, g: isG && (full.body !== base.body || full.punct !== base.punct), deco: full.body !== base.body || full.punct !== base.punct };
  }
  // 目上に向けて言うときに外す、くだけすぎる語尾（〜って・〜じゃん・〜やん）。元の文にあったものは外さない
  const UP_BAN = /(?:(?<=ない)って|じゃん|やん)$/;   // 第7回：「待って」の「って」を外して「待。」になった（hydrogen 6）。外すのは「〜ないって」だけ
  const upFix = (body, src) => UP_BAN.test(body) && !UP_BAN.test(src) ? body.replace(/(?<=ない)って$/, '').replace(/(?:じゃん|やん)$/, 'だ') : body;
  function apply(text, key, rand, me, you, opts) {
    const v = VOICES[key];
    text = String(text).replace(/\{君\}/g, you || 'あなた');
    if (!v) return text.replace(/\{私\}/g, me || '自分');
    const r = rand || Math.random, tone = opts && TONES.indexOf(opts.tone) >= 0 ? opts.tone : 'normal', mono = !!(opts && opts.mono), up = !!(opts && (opts.up === true || opts.rel === 'up'));
    const ss = splitS(text.replace(/\{私\}/g, me || v.me)).map(s => convSentence(v, s, tone, mono));
    // 口ぐせ止め：kuse に挙げた規則（ほしいんや 等）が1つの台詞で2回目以降に出るときは、その文を規則なしの形に戻す
    if (v.kuse) { const seenK = {}; ss.forEach(s => { const key = s.rule && s.rule.key; if (!key || v.kuse.indexOf(key) < 0) return; const o = s.rule.cls ? s.full : s.base; if (o.body === s.src.body) return; if (seenK[key]) { s.base = s.full = s.plain; s.deco = false; } else seenK[key] = 1; }); }
    let last = -1; ss.forEach((s, i) => { if (s.base.body) last = i; });
    // 決め語尾：乱数は、決め語尾を持つ型では必ず2回（付けるかどうかが入力や tone で変わっても、乱数の進み方は同じ）
    let tailAt = -1, tail = '';
    if (v.tails.length && v.tailRate > 0) {
      const x0 = r(), x1 = r();
      if (tone !== 'grave' && !mono && x0 < v.tailRate && last >= 0) {
        const s = ss[last], tk = v.tailKinds || ['v', 'adj'], pk = PARENT[s.kind] || s.kind, t = v.tails[Math.floor(x1 * v.tails.length)], tcls = (v.tailCls && v.tailCls[t]) || 'L';
        // 決め語尾は、その文の元の種類が tk で、conv が付け替えていない文にだけ。「。」「！」で終わる文の前に足す。
        // 説明・伝聞に聞こえる語尾（tailExp）は動詞の終止形（意志かもしれない文）には付けない。tense では間のびする語尾を付けない
        if (tk.indexOf(pk) >= 0 && !s.rule && !s.urgent && !s.isQ && /^[。！]/.test(s.base.punct) && !(v.tailExp && v.tailExp.indexOf(t) >= 0 && pk === 'v') && decoOk(tcls, tone, mono)) { tailAt = last; tail = t; }
      }
    }
    // 飾りは1つの台詞に多くて1文：飾りが付く候補のうち、最後の文だけ（決め語尾が付くなら、その文）。芯は全部の文に効く
    //   方言の標識（G）：その台詞に核が1つも出なかったときだけ、G の付く最後の1文に付ける（毎回かならず1つは方言が出る。核が出ているときは足さない）。ほかの飾りは、そのとき付けない
    let keep = -1; ss.forEach((s, i) => { if (s.deco && !s.g) keep = i; });
    if (v.home && !ss.some(s => s.core)) ss.forEach((s, i) => { if (s.g) keep = i; });
    if (tailAt >= 0) keep = tailAt;
    return ss.map((s, i) => {
      const o = i === keep ? s.full : s.base; let body = up ? upFix(o.body, s.src.body) : o.body, punct = o.punct;
      if (i === tailAt) { body += tail; if (/っ$/.test(tail)) punct = '！' + punct.slice(1); }
      return body + punct;
    }).join('');
  }
  // 型の「芯」と「飾り」の一覧（人が読む用）：{ core:[規則の種類], deco:{規則の種類:印}, tails:{語尾:印}, bang }
  function rulesOf(key) {
    const v = VOICES[key], core = [], deco = {};
    Object.keys(v.conv || {}).forEach(k => { if (v.cls && v.cls[k]) deco[k] = v.cls[k]; else core.push(k); });
    const tails = {}; (v.tails || []).forEach(t => { tails[t] = (v.tailCls && v.tailCls[t]) || 'L'; });
    return { core, deco, tails, bang: !!v.bang, req: v.req || null, tailExp: v.tailExp || [] };
  }

  g.PersonaVoice = { TONES, PARENT, SERIOUS, softOk, isUrgent, isQuestion: looksQuestion, rulesOf, VOICES, ME, ME_BY_VOICE, YOU, YOU_BY_VOICE, HOMES, WHO, NOBLE, pick, pickMe, pickYou, pickHome, resetHomeMemo, homeMemo, homeName, apply, classify, kinds, splitS };
})(typeof globalThis !== 'undefined' ? globalThis : window);
