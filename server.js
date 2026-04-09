const express = require("express");
const cors = require("cors");
const path = require("path");
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ===== In-memory store =====
const threads = new Map(); // id -> {title, body, replies, isPublic, isSafetyMode, isSensitive, createdAt}
let nextId = 1;
let totalCost = 12345; // mock

// ===== Ollama config =====
const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL = "hf.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF";

// ===== Context-aware 2ch reply engine =====
async function generateReplies(title, body, momentum, residentType) {
  const numReplies = Math.floor(Math.random() * 7) + 8;
  return generateFallbackReplies(title, body, numReplies);
}

function formatReplies(parsed) {
  const names = ["風吹けば名無し", "名無しさん", "名無しさん＠お腹いっぱい。", "名無し募集中。。。"];
  const now = new Date();
  const dow = ["日","月","火","水","木","金","土"][now.getDay()];
  const base = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,"0")}/${String(now.getDate()).padStart(2,"0")}(${dow})`;

  return parsed.slice(0, 20).map((r, i) => {
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    const s = String(Math.min(59, now.getSeconds() + i * 3 + Math.floor(Math.random() * 10))).padStart(2, "0");
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let id = ""; for (let j = 0; j < 9; j++) id += chars[Math.floor(Math.random() * chars.length)];
    return {
      number: i + 2,
      name: r.name || names[Math.floor(Math.random() * names.length)],
      date: `${base} ${h}時${m}分${s}秒`,
      id: id,
      body: r.body || r.text || ""
    };
  });
}

function generateFallbackReplies(title, body, count) {
  const R = s => s[Math.floor(Math.random() * s.length)];
  // amezor-x / kalobby style names
  const names = ["ヾ(ﾟдﾟ)ﾉ゛ﾊﾞｶｰ","ヾ(ﾟдﾟ)ﾉ゛ﾊﾞｶｰ","ヾ(ﾟдﾟ)ﾉ゛ｱﾎｰ","ヾ(ﾟдﾟ)ﾉ゛ｱﾎｰ","ヾ(ﾟдﾟ)ﾉ゛ﾊﾞｶｰ","DTI利用者","ヾ(ﾟдﾟ)ﾉ゛ﾊﾞｶｰ","ヾ(ﾟдﾟ)ﾉ゛ｱﾎｰ"];
  const now = new Date();
  const dow = ["日","月","火","水","木","金","土"][now.getDay()];
  const base = `${now.getFullYear()}年${String(now.getMonth()+1).padStart(2,"0")}月${String(now.getDate()).padStart(2,"0")}日(${dow})`;

  // Extract keywords from title+body for contextual replies
  const src = title + " " + body;
  const kw = src.replace(/[、。！？\s]+/g, " ").split(" ").filter(w => w.length >= 2).slice(0, 5);
  const kwStr = kw.length > 0 ? kw[0] : title.slice(0, 8);

  // kalobby-style ×10 expanded pools (all string concat to avoid backtick+kaomoji issues)
  const K = kwStr, T = title;
  const agree = ["わかる","そうなのか","なるほどね","まあそうだよな","せやな","ふーん","いいんじゃない","まあね","それはある","同意","だよね","そうだそうだ","言えてる","たしかに","間違いない","おっしゃる通り","否定はしない","そりゃそうだ","異議なし","まさにそれ","言いたいことは分かる","そう思うわ","正論だな","ごもっとも","珍しくまともなスレだ","ちょっと感心した","言い得て妙","さすがに否定できん","なるほどなぁ","そういう見方もあるか","いいこと言った","まともなこと言ってるな","激しく同意","一理ある","わかりみ"];
  const dull = ["知らんがな","ふーん","へー","そうなんだ","別にいいけど","どうでもいいけど","ほーん","で？","だから何","お、おう","はいはい","勝手にしろ","好きにしたらいい","誰も聞いてない","ふぅん","それで","そっか","まあ好きにすれば","あっそ","興味ないけど","どうぞどうぞ","関係ないけど","ま、いっか","特に言うことはない","ノーコメント","スルーで","パス","聞き流しとく","既読スルー","勝手にどうぞ"];
  const kaomoji = ["(´・ω・`)","(´・ω・`)ショボーン","(´ー`)y-~~","(^Д^)","o(^ー^)o","orz","(´_ゝ`)","(゜∀゜)","( ´∀`)","(ﾟдﾟ)","ヽ(´ー`)ノ","(´・ω・`)知らんがな","m9(^Д^)","(ノ∀`)アチャー","Σ(゜Д゜)","(´;ω;`)","ｷﾀ━(゜∀゜)━!","( ；∀；)","(・∀・)ﾆﾔﾆﾔ","(  ´_ゝ`)ﾌｰﾝ","＿|￣|○","(゜д゜)ﾎﾟｶｰﾝ"];
  const question = ["それマジ？","ソースは","いつの話？","それってどういうこと","誰が言ったんだ","マジで言ってる？","嘘だろ？","本当に？","詳しく","もうちょい説明して","で、どうすんの","何が言いたいの","結局どうなったん","続きは？","で、オチは？","根拠あるの？","どこ情報よ","誰から聞いたの","実際のところどうなん","証拠は","前も同じ話してなかった？","何回目だよその話","いくらなの","え、それ本気？","ぶっちゃけどうなの","正直なところ教えて"];
  const neg = ["埋めてから次を立てろとあれほど","無意味なサイト","くだらね","それはない","つまらん","何が面白いのか分からん","スレ立てる意味あった？","ないない","はいはいワロスワロス","無駄だろ","やめとけ","時間の無駄","お前だけだぞそう思ってるの","もう飽きた","このネタ何回目だよ","いい加減にしろ","呆れた","どうしようもないな","夢見すぎ","現実見ろ","アホか","センスない","寒い","そんなことより仕事しろ","他にやることないのか","暇すぎだろ","いい歳して何やってんだ","残念だがそうはならん"];
  const meta = ["このスレ伸びないな","過疎ってるな","誰も見てないだろこのスレ","カロビーも末期だな","別に、何人だっていいじゃないか(´ー`)y-~~","ここ何年も同じメンバーだよな","新規来ないかな","懐かしいノリだ","このスレ保存しとこ","過疎板の良さが分かるスレ","深夜のカロビーは落ち着く","ROMってたけど書き込んでみた","久しぶりに来たらまだあったこの板","昔はもっと人いたのにな","何年ぶりだこの板","あの頃は良かった","まだこの板あったのか","平日の昼間から書き込んでるお前ら","全員ニートか？","この板の平均年齢いくつだよ","おっさんしかいないだろここ","令和にもなってこの板か"];
  const firstReply = [
    "じゃあ使い物になる" + K + "を開発してみて",
    K + "ねぇ...",
    "また" + K + "の話か",
    K + "について語るスレか\n埋めてから次を立てろとあれほど",
    "お祭りの屋台のくじで一番が当たる位の可能性だろ",
    K + "とかまた微妙なスレ立てたな",
    "はいはい" + K + K,
    K + "って言葉久しぶりに聞いたわ",
    K + "かぁ...まあ語るか",
    "スレ立て乙\nで、" + K + "がどうしたの",
    "おっ、" + K + "スレじゃん",
    "またお前か",
    K + "で盛り上がれると思ってるのか？ここ過疎板だぞ",
  ];
  const contextual = [
    K + "って最近どうなん",
    "俺も" + K + "気になってたんだよな(´・ω・`)",
    K + "ってそういうことだったのか",
    "はたして" + K + "にそれほどの価値があるのかどうなのか",
    K + "ガチ勢いるのかここに",
    K + "とか言ってるやつまだいたんか",
    K + "は正直アリだと思う",
    "真面目に" + K + "について語ろうよ",
    "あたしの可能性は無限大なの(´・ω・`)",
    "物価高のこの時代に" + K + "とか言ってる場合じゃないだろ(´・ω・`)",
    K + "で検索したら何も出てこなかったんだが",
    K + "について俺より詳しいやつこの板にいるのか？",
    K + "は10年前から言われてるけどまだ解決してない",
    "結局" + K + "ってどうなったんだ",
    K + "の専門家ちょっと来てくれ",
    K + "なんてどうでもいいから飯の話しようぜ",
    "ぶっちゃけ" + K + "はもう終わってる",
    K + "について3行で説明してくれ",
    "昨日" + K + "のこと考えてたら眠れなくなった",
    K + "信者と" + K + "アンチの戦いは不毛",
    K + "ってググったら怖い結果出てきたんだが",
    "アルミ缶の上にあるミカン",
    "今朝のニュースで" + K + "やってたぞ",
    K + "好きな奴って大体あれも好きだよな",
    "俺の周りで" + K + "知ってるのは俺だけだわ",
    "インドカレー屋で" + K + "の話したら店員に笑われた",
    K + "ってもっと評価されるべきだと思うんだが",
    "職場で" + K + "の話したら引かれた",
    K + "はオワコンって言ってたやつ息してる？",
    K + "を3日間やめたら体調良くなった",
  ];
  const longerCtx = [
    "正直" + T + "って聞いてどうかと思ったけど\nまあいいんじゃない",
    ">>1が言いたいことは分かるけどさ\nそれ" + K + "の話とはちょっと違うくないか",
    "資格が本当でキャリアもそれなりに自信あるのなら\nもうちょっと吹っ掛けたら良いのに",
    "こんなつぶやき出来るくらい暇なんか。\n俺なんて忙しくて全く開く時間的余裕ないわ",
    "人生の効率をあげるサイトおねがいします",
    "スレタイに釣られて来たけど\n>>1の言ってることは割とまとも",
    "誰も見てないこのサイトのサクサク感がいい(´・ω・`)",
    "無料サーバーのおかげかたまに重くなるな(´・ω・`)",
    "この前電車で隣の人が" + K + "の話してて\n思わず聞き耳立ててしまった",
    "うちの嫁が" + K + "にハマってて\n毎日その話聞かされてる身にもなってくれ",
    "昨日コンビニで" + K + "関連の雑誌見かけたけど\n立ち読みする勇気がなかった",
    "会社の飲み会で" + K + "の話題出したら\n誰も知らなくて空気が凍った(´・ω・`)",
    "正直この板で" + K + "の話できるとは思わなかった\nお前らもっと早く言えよ",
    K + "に関しては俺も一家言あるんだが\n長くなるからやめとく",
    ">>1のレスを見て思い出したけど\n昔似たようなスレが立って500まで伸びてたな",
    "2ちゃん全盛期なら" + K + "スレは\n祭りになってただろうに",
    "深夜にこんなスレ見てる時点で\n俺もお前も同類だよ",
    "手取り22万で" + K + "とか言ってる場合じゃないんだが(´・ω・`)",
    "この板に10年いるけど\n" + K + "の話は初めてだな",
    "入院中で暇だからこのスレ見てるけど\n>>1の言いたいことは分かる",
    "転職3回目にして思うけど\n" + K + "は仕事にも通じるものがある",
  ];
  const ending = [
    "まあ結局は人それぞれってことだ","で、結論は","もう寝ろ","良スレ(過疎だけど)",
    "はい解散","こんなはずじゃなかった(´・ω・`)","生まれてきた意味あったのかしら(´・ω・`)",
    "あたしの可能性は無限大なの(´・ω・`)",
    "じゃあ俺寝るわ","また明日な","結局誰も結論出さないのがこの板らしい",
    "なんだかんだで楽しかった","過疎板なのにこんなにレスついた奇跡",
    "以上、便所の落書きでした","そろそろ飯にするわ",
    "この話題また来月も出るんだろうな","俺はもう限界だ(´・ω・`)",
    "まだこの板が生きてることが奇跡","次スレ要らないだろこの過疎っぷりじゃ",
    "おやすみ(´・ω・`)","風呂入ってくる","いい夢見ろよ",
  ];

  // 麻耶犬: 一人称「俺」、5行以上の自分語り長文。出現率 1/30
  const mayakenLong = [
    "俺さ、昔から" + kwStr + "には一家言あるんだよ。\n中学の頃からずっとこの手の話題追ってて、\n当時はネットもろくになかったから図書館で調べてたんだけど、\n結局行き着いた結論は「自分で体験しないと分からん」ってことだった。\nだから俺は実際にやってみたんだよ。そしたらまあ想像以上だったわ。\n長くなったけど要するに>>1の言ってることは半分正しい。",
    "俺が思うにさ、" + kwStr + "ってのは世間が思ってるほど単純じゃないんだよ。\n俺は20代の頃に似たような経験して痛い目見てるからさ、\nあの時は本当に何もかも失って路頭に迷いかけた。\n夜中に公園のベンチで缶コーヒー飲みながら人生について考えたりしてたわ。\nまあそういう経験があるから今の俺があるんだけどな。\nお前らも他人事だと思わない方がいいぞ。",
    "俺の持論なんだけどさ、人生ってのは結局タイミングなんだよ。\n" + kwStr + "の件もそうだけど、10年前なら全然違う結果になってた。\n俺自身、転職を3回してようやく今の仕事に落ち着いたし、\n最初の会社なんか半年で辞めたからな。上司がクソすぎて。\nでもあの経験があったから次の会社で評価されたんだと思う。\nだから>>1も焦らなくていいと思うよ。俺が保証する。",
    "俺は基本的にROMってるんだけどさ、この話題は黙ってられなくて。\n" + kwStr + "について俺ほど詳しい人間はこの板にいないと思う。\n別に自慢じゃなくて、単純に俺が一番長くこれに関わってるからだよ。\n高校の時に始めて、大学でも研究して、社会人になっても続けてる。\nかれこれ15年以上だな。嫁にも呆れられてるけど。\nまあ要するに何が言いたいかというと、もっと深く掘り下げようぜ。",
    "俺が初めてこの板に来たのは2008年くらいだったかな。\nあの頃はもっと活気があって、毎日100レスくらいついてたのに、\n今じゃこの過疎っぷりだからな。時代は変わるもんだ。\n俺自身もあの頃は若くて元気だったけど、今じゃ腰痛持ちのおっさんだよ。\nでもこうやってスレが立つと昔を思い出して書き込みたくなるんだよな。\nまだここを見てる奴がいるってだけで嬉しいよ、正直。",
  ];

  const allPools = [agree, dull, question, neg, meta, contextual, longerCtx];

  const replies = [];
  const usedTexts = new Set();

  for (let i = 0; i < count; i++) {
    const sec = Math.min(59, now.getSeconds() + i * 3 + Math.floor(Math.random() * 15));
    const h = String(now.getHours()).padStart(2,"0");
    const m = String(now.getMinutes()).padStart(2,"0");
    const s = String(sec).padStart(2,"0");
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let id = ""; for (let j = 0; j < 9; j++) id += chars[Math.floor(Math.random() * chars.length)];

    // 1/30 chance of 麻耶犬 appearing (except first/last post)
    let isMayaken = (i > 0 && i < count - 1 && Math.random() < 1/30);

    let text;
    let postName;

    if (isMayaken) {
      text = R(mayakenLong);
      postName = "麻耶犬";
    } else if (i === 0) {
      text = R(firstReply);
      postName = R(names);
    } else if (i === count - 1) {
      text = R(ending);
      postName = R(names);
    } else {
      // Pick from a weighted random pool
      const roll = Math.random();
      if (roll < 0.25) text = R(contextual);
      else if (roll < 0.35) text = R(agree);
      else if (roll < 0.45) text = R(dull);
      else if (roll < 0.55) text = R(question);
      else if (roll < 0.65) text = R(neg);
      else if (roll < 0.75) text = R(meta);
      else text = R(longerCtx);

      // Add anchor sometimes
      if (Math.random() > 0.55) {
        const ref = Math.floor(Math.random() * (i + 1)) + 1;
        text = ">>" + ref + "\n" + text;
      }

      // Occasionally append kaomoji
      if (Math.random() > 0.75) {
        text += " " + R(kaomoji);
      }

      postName = R(names);
    }

    // Avoid exact duplicates
    if (usedTexts.has(text)) {
      text = R(contextual) + (Math.random() > 0.5 ? "\n" + R(agree) : "");
    }
    usedTexts.add(text);

    replies.push({
      number: i + 2,
      name: postName,
      date: `${base} ${h}時${m}分${s}秒`,
      id: id,
      body: text
    });
  }
  return replies;
}

// ===== API Routes =====

// Generate thread
app.post("/api/bbs/generate", async (req, res) => {
  try {
    const { title, body, momentum, residentType } = req.body;
    if (!title || !body) return res.status(400).json({ error: "タイトルと本文を入力してください" });

    const replies = await generateReplies(title, body, momentum, residentType);
    res.json({ replies, isSafetyMode: false, isSensitive: false });
  } catch (err) {
    console.error("Generate error:", err);
    res.status(500).json({ error: "スレッドの生成に失敗しました" });
  }
});

// Continue thread (reply as OP)
app.post("/api/bbs/continue", async (req, res) => {
  try {
    const { title, body, context, userReply, momentum, residentType, maxReplies, currentTotal } = req.body;
    const count = Math.floor(Math.random() * 5) + 3;
    const replies = await generateReplies(title, `${body}\n\nスレ主の返信: ${userReply?.text || ""}`, momentum, residentType);
    const sliced = replies.slice(0, count).map((r, i) => ({ ...r, number: currentTotal + i + 1 }));
    res.json({ replies: sliced, reachedLimit: (currentTotal + sliced.length) >= 30 });
  } catch (err) {
    res.status(500).json({ error: "継続生成に失敗しました" });
  }
});

// Save thread log
app.post("/api/bbs/logs", (req, res) => {
  const { title, body, replies, isPublic, isSafetyMode, isSensitive } = req.body;
  const id = nextId++;
  threads.set(id, { title, body, replies: replies || [], isPublic: !!isPublic, isSafetyMode, isSensitive, createdAt: new Date().toISOString() });
  res.json({ id });
});

// Get logs
app.get("/api/bbs/logs", (req, res) => {
  const logs = [];
  threads.forEach((v, k) => logs.push({ id: k, ...v }));
  logs.sort((a, b) => b.id - a.id);
  res.json(logs);
});

// Get single log
app.get("/api/bbs/logs/:id", (req, res) => {
  const t = threads.get(Number(req.params.id));
  if (!t) return res.status(404).json({ error: "not found" });
  res.json({ id: Number(req.params.id), ...t });
});

// Delete log
app.delete("/api/bbs/logs/:id", (req, res) => {
  threads.delete(Number(req.params.id));
  res.json({ ok: true });
});

// Toggle visibility
app.patch("/api/bbs/logs/:id/visibility", (req, res) => {
  const t = threads.get(Number(req.params.id));
  if (!t) return res.status(404).json({ error: "not found" });
  t.isPublic = req.body.isPublic;
  res.json({ ok: true });
});

// Public threads
app.get("/api/bbs/public-threads", (req, res) => {
  const q = (req.query.q || "").toLowerCase();
  const list = [];
  threads.forEach((v, k) => {
    if (v.isPublic && (!q || v.title.toLowerCase().includes(q)))
      list.push({ id: k, title: v.title, body: v.body, replies: v.replies, createdAt: v.createdAt });
  });
  list.sort((a, b) => b.id - a.id);
  res.json({ threads: list });
});

app.get("/api/bbs/public-threads/:id", (req, res) => {
  const t = threads.get(Number(req.params.id));
  if (!t || !t.isPublic) return res.status(404).json({ error: "not found" });
  res.json({ id: Number(req.params.id), ...t });
});

// Config
app.get("/api/bbs/config", (req, res) => {
  res.json({ maxTitleLength: 50, maxBodyLength: 1000, maxReplies: 30, freeGenerationsPerDay: 5 });
});

// Counter (deficit)
app.get("/api/counter", (req, res) => {
  totalCost += Math.floor(Math.random() * 5);
  res.json({ deficit: totalCost });
});

// Auth stubs
app.post("/api/bbs/account/register", (req, res) => res.json({ ok: true, message: "デモ版のため未実装" }));
app.post("/api/bbs/account/login", (req, res) => res.json({ ok: true, message: "デモ版のため未実装" }));
app.post("/api/bbs/account/logout", (req, res) => res.json({ ok: true }));
app.get("/api/bbs/account/me", (req, res) => res.status(401).json({ error: "not logged in" }));
app.post("/api/bbs/contact", (req, res) => res.json({ ok: true }));
app.post("/api/bbs/share-click", (req, res) => res.json({ ok: true }));

// Report
app.post("/api/bbs/threads/:id/report", (req, res) => res.json({ ok: true }));

// SPA fallback
app.use((req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const PORT = process.env.PORT || 3456;
app.listen(PORT, () => console.log(`fakekalobby running on http://localhost:${PORT}`));
