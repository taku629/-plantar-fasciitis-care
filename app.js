/* 足底腱膜炎ケア手帳 — local-first PWA */
"use strict";

const LS_KEY = "sokuteiData";
// バックエンドAPIのURL。空ならフィードはPubMedを直接取得し、テレメトリは無効。
const API_BASE = "";

const EXERCISES = [
  {
    id: "fascia",
    name: "足底筋膜ストレッチ",
    sets: 3, seconds: 30, perSet: "30秒",
    desc: "椅子に座って片方の足を反対の膝に乗せ、つま先を手で体の方へゆっくり反らせます。かかとの下〜土踏まずが伸びるのを感じましょう。左右各30秒。",
    tip: "起床直後と、長く座ったあと歩き出す前にやると特に効果的です。",
  },
  {
    id: "gastroc",
    name: "ふくらはぎストレッチ(膝を伸ばす)",
    sets: 3, seconds: 30, perSet: "30秒",
    desc: "壁に両手をつき、伸ばす方の足を後ろへ引きます。かかとを床につけたまま膝を伸ばし、ふくらはぎを伸ばします。左右各30秒。",
    tip: "ふくらはぎの硬さは足底腱膜炎の大きな要因です。",
  },
  {
    id: "soleus",
    name: "ヒラメ筋ストレッチ(膝を曲げる)",
    sets: 3, seconds: 30, perSet: "30秒",
    desc: "同じ壁の前の姿勢で、後ろ足の膝を軽く曲げます。かかとは床につけたまま。アキレス腱の近くが伸びます。左右各30秒。",
    tip: "上のストレッチとセットで行いましょう。",
  },
  {
    id: "towel",
    name: "タオルつまみ",
    sets: 1, seconds: 0, perSet: "10回",
    desc: "床に置いたタオルを足の指で手繰り寄せるようにしてつまみます。10回を左右で。",
    tip: "足の指の筋肉を鍛えて土踏まずを支えます。",
  },
  {
    id: "heelraise",
    name: "ヒールレイズ(段差で)",
    sets: 3, seconds: 0, perSet: "12回",
    desc: "階段や踏み台の縁に前足部を乗せ、かかとを3秒かけて上げ→2秒キープ→3秒かけて下げます。12回×3セット。週3日が目安。",
    tip: "少し痛くても構いませんが、翌日に痛みが増す場合は休みましょう。",
  },
  {
    id: "ice",
    name: "足裏アイシング(ペットボトル)",
    sets: 1, seconds: 300, perSet: "5〜10分",
    desc: "冷凍したペットボトルを床に置き、足裏でゆっくり前後に転がします。5〜10分。",
    tip: "歩いたあとや痛みが強いときに。直接氷を当てるより安全です。",
  },
];

const TIPS = [
  "朝の最初の一歩が痛むのが足底腱膜炎の特徴です。起きる前に足底筋膜ストレッチをすると楽になります。",
  "長時間の立ち仕事や急な歩数増加は負担になります。痛みが強い日は20分ごとに座って休憩を。",
  "かかとが安定するクッション性のある靴や、土踏まずを支えるインソールが有効です。",
  "裸足や薄いスリッパでの生活は症状を悪化させやすいです。室内でも靴かクッションスリッパを。",
  "体重が1kg減ると足への負担も減ります。無理のない範囲で体重管理も助けになります。",
  "痛みが数週間続く、歩けないほど強い、腫れや熱がある場合は整形外科の受診をおすすめします。",
];

const STEP_PRESETS = [
  { label: "少なめ(〜2千)", value: 1500 },
  { label: "ふつう(3〜5千)", value: 4000 },
  { label: "多め(6千〜)", value: 7000 },
];
const STANDING_OPTS = [
  { id: "little", label: "ほぼ座り" },
  { id: "normal", label: "ふつう" },
  { id: "much", label: "長時間立った" },
];
const DEFAULT_SHOES = ["運動靴", "インソール付き靴", "革靴", "サンダル", "室内履き"];

/* ---------- state ---------- */
function blankDay() {
  return { morningPain: null, eveningPain: null, steps: null, standing: null, shoes: [], notes: "", exercises: {}, weight: null, meds: false, clinic: false, photos: [] };
}
function defaultSettings() {
  return { name: "", shoePresets: DEFAULT_SHOES.slice(), font: "normal", hc: false, simple: false, share: false, remind: false, hideWeight: true, anonId: null, lastTelemetry: null };
}
function clampPain(v) {
  return (typeof v === "number" && isFinite(v)) ? Math.min(Math.max(Math.round(v), 0), 10) : null;
}
function sanitizeDay(x) {
  const d = blankDay();
  if (!x || typeof x !== "object" || Array.isArray(x)) return d;
  d.morningPain = clampPain(x.morningPain);
  d.eveningPain = clampPain(x.eveningPain);
  d.steps = (typeof x.steps === "number" && isFinite(x.steps) && x.steps >= 0) ? Math.min(Math.round(x.steps), 200000) : null;
  d.standing = STANDING_OPTS.some(o => o.id === x.standing) ? x.standing : null;
  d.shoes = Array.isArray(x.shoes) ? x.shoes.filter(s => typeof s === "string").slice(0, 10) : [];
  d.notes = typeof x.notes === "string" ? x.notes.slice(0, 5000) : "";
  if (x.exercises && typeof x.exercises === "object" && !Array.isArray(x.exercises)) {
    for (const [k, v] of Object.entries(x.exercises)) {
      if (EXERCISES.some(e => e.id === k) && typeof v === "number" && isFinite(v))
        d.exercises[k] = Math.min(Math.max(Math.round(v), 0), 20);
    }
  }
  d.weight = (typeof x.weight === "number" && isFinite(x.weight) && x.weight >= 20 && x.weight <= 300)
    ? Math.round(x.weight * 10) / 10 : null;
  d.meds = !!x.meds;
  d.clinic = !!x.clinic;
  d.photos = Array.isArray(x.photos)
    ? x.photos.filter(p => typeof p === "string" && p.startsWith("data:image/")).slice(0, 4) : [];
  return d;
}
function sanitizeHospital(h) {
  if (!h || typeof h !== "object" || Array.isArray(h)) return null;
  const name = typeof h.name === "string" ? h.name.trim().slice(0, 60) : "";
  if (!name) return null;
  return {
    id: typeof h.id === "string" && h.id ? h.id.slice(0, 40) : "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    name,
    rating: Number.isInteger(h.rating) && h.rating >= 1 && h.rating <= 5 ? h.rating : 3,
    cost: typeof h.cost === "string" ? h.cost.slice(0, 60) : "",
    phone: typeof h.phone === "string" ? h.phone.replace(/[^\d+()\-\s]/g, "").slice(0, 20) : "",
    url: typeof h.url === "string" && /^https?:\/\//.test(h.url) ? h.url.slice(0, 300) : "",
    memo: typeof h.memo === "string" ? h.memo.slice(0, 200) : "",
    lastVisit: typeof h.lastVisit === "string" && /^\d{4}-\d{2}-\d{2}$/.test(h.lastVisit) ? h.lastVisit : null,
  };
}
function normalizeState(s) {
  if (!s || typeof s !== "object" || Array.isArray(s)) return null;
  if (!("settings" in s) && !("days" in s)) return null; // 形の違うJSONは拒否
  const raw = (s.settings && typeof s.settings === "object" && !Array.isArray(s.settings)) ? s.settings : {};
  const settings = { ...defaultSettings(), ...raw };
  settings.name = typeof settings.name === "string" ? settings.name.slice(0, 100) : "";
  settings.shoePresets = Array.isArray(settings.shoePresets)
    ? settings.shoePresets.filter(t => typeof t === "string" && t.trim()).map(t => t.trim()).slice(0, 20)
    : DEFAULT_SHOES.slice();
  if (!settings.shoePresets.length) settings.shoePresets = DEFAULT_SHOES.slice();
  if (!["normal", "large", "huge"].includes(settings.font)) settings.font = "normal";
  settings.hc = !!settings.hc;
  settings.simple = !!settings.simple;
  settings.share = !!settings.share;
  settings.remind = !!settings.remind;
  settings.hideWeight = "hideWeight" in settings ? !!settings.hideWeight : true;
  settings.anonId = typeof settings.anonId === "string" ? settings.anonId.slice(0, 64) : null;
  settings.lastTelemetry = typeof settings.lastTelemetry === "string" ? settings.lastTelemetry : null;
  const days = {};
  if (s.days && typeof s.days === "object" && !Array.isArray(s.days)) {
    for (const [k, v] of Object.entries(s.days)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k)) days[k] = sanitizeDay(v);
    }
  }
  const hospitals = Array.isArray(s.hospitals)
    ? s.hospitals.map(sanitizeHospital).filter(Boolean).slice(0, 50) : [];
  return { settings, days, hospitals };
}
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { settings: defaultSettings(), days: {}, hospitals: [] };
    const s = normalizeState(JSON.parse(raw));
    if (s) return s;
    localStorage.removeItem(LS_KEY); // 形が違うデータは破棄して復旧
    return { settings: defaultSettings(), days: {}, hospitals: [] };
  } catch (e) {
    try { localStorage.removeItem(LS_KEY); } catch (e2) { /* ignore */ }
    return { settings: defaultSettings(), days: {}, hospitals: [] };
  }
}
let state = loadState();
function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    toast("保存できませんでした(端末の容量不足の可能性があります)");
    return false;
  }
}
function dayKey(d) { return d.toISOString().slice(0, 10); }
function todayKey() { return dayKey(new Date()); }
function getDay(key) {
  if (!state.days[key]) state.days[key] = blankDay();
  return state.days[key];
}

/* ---------- personalization (on-device) ---------- */
function recentDayKeys(n) {
  const keys = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const dd = new Date(d); dd.setDate(d.getDate() - i);
    keys.push(dayKey(dd));
  }
  return keys;
}
function generateAdvice() {
  const keys = recentDayKeys(30);
  const rec = keys.map(k => ({ k, d: state.days[k] })).filter(x => x.d && x.d.morningPain !== null && x.d.morningPain !== undefined);
  const adv = [];
  if (rec.length < 3) {
    adv.push("まずは毎日の記録を続けましょう。3〜4日たつと、あなたの痛みの傾向が見えてきます。");
    return adv;
  }
  // 痛み悪化トレンド(直近3記録 vs その前3記録)
  if (rec.length >= 6) {
    const last3 = rec.slice(0, 3).reduce((s, x) => s + x.d.morningPain, 0) / 3;
    const prev3 = rec.slice(3, 6).reduce((s, x) => s + x.d.morningPain, 0) / 3;
    if (last3 - prev3 >= 1.5)
      adv.push("朝の痛みが増える傾向があります。ヒールレイズなど負荷の強い体操は休み、ストレッチとアイシング中心に。2週間以上続くなら受診を検討してください。");
    else if (prev3 - last3 >= 1.5)
      adv.push("朝の痛みが減る傾向です。この調子で体操を続けましょう。");
  }
  // 強い痛みが続く
  if (rec.slice(0, 3).every(x => x.d.morningPain >= 7))
    adv.push("朝の痛みが強い状態(7以上)が続いています。無理せず、早めに整形外科を受診してください。");
  // 靴と痛みの相関
  const byShoe = {};
  rec.forEach(x => (x.d.shoes || []).forEach(s => { (byShoe[s] = byShoe[s] || []).push(x.d.morningPain); }));
  const shoeAvg = Object.entries(byShoe).filter(([, v]) => v.length >= 2)
    .map(([s, v]) => ({ s, avg: v.reduce((a, b) => a + b) / v.length, n: v.length }));
  if (shoeAvg.length >= 2) {
    shoeAvg.sort((a, b) => b.avg - a.avg);
    const worst = shoeAvg[0], best = shoeAvg[shoeAvg.length - 1];
    if (worst.avg - best.avg >= 1.5)
      adv.push(`「${worst.s}」の日は痛みが強め(平均${worst.avg.toFixed(1)})。「${best.s}」(平均${best.avg.toFixed(1)})が合っているかもしれません。`);
  }
  // 体操の翌朝効果
  const map = {}; rec.forEach(x => map[x.k] = x.d);
  const afterEx = [], afterNo = [];
  for (let i = 0; i < keys.length - 1; i++) {
    const next = map[keys[i]], cur = state.days[keys[i + 1]];
    if (next && cur && next.morningPain !== null && next.morningPain !== undefined) {
      (Object.keys(cur.exercises || {}).length > 0 ? afterEx : afterNo).push(next.morningPain);
    }
  }
  if (afterEx.length >= 3 && afterNo.length >= 3) {
    const a = afterEx.reduce((x, y) => x + y) / afterEx.length;
    const b = afterNo.reduce((x, y) => x + y) / afterNo.length;
    if (b - a >= 1) adv.push("体操をした日の翌朝は痛みが軽い傾向にあります。体操が効いています。");
    else if (a - b >= 1.5) adv.push("体操をした日の翌朝に痛みが強めです。ヒールレイズの回数を減らす等、量を調整しましょう。");
  }
  // 歩きすぎ傾向
  const heavyNext = [], lightNext = [];
  for (let i = 0; i < keys.length - 1; i++) {
    const next = map[keys[i]], cur = state.days[keys[i + 1]];
    if (next && cur && next.morningPain !== null && cur.steps) {
      (cur.steps >= 6000 ? heavyNext : lightNext).push(next.morningPain);
    }
  }
  if (heavyNext.length >= 2 && lightNext.length >= 2) {
    const a = heavyNext.reduce((x, y) => x + y) / heavyNext.length;
    const b = lightNext.reduce((x, y) => x + y) / lightNext.length;
    if (a - b >= 1) adv.push("たくさん歩いた日の翌朝は痛みが強い傾向です。長く歩く日は30分ごとに休憩を入れましょう。");
  }
  // 体操の継続率
  const last7 = recentDayKeys(7);
  const exDays7 = last7.filter(k => state.days[k] && Object.keys(state.days[k].exercises).length > 0).length;
  if (exDays7 >= 5) adv.push(`この1週間で${exDays7}日体操できています。とても良いペースです。`);
  else if (rec.length >= 7 && exDays7 <= 1)
    adv.push("体操があまりできていません。まずは「足底筋膜ストレッチ」1種類だけでも毎朝やってみましょう。");
  // 記録ストリーク
  let streak = 0;
  for (const k of recentDayKeys(60)) { if (state.days[k] && state.days[k].morningPain !== null && state.days[k].morningPain !== undefined) streak++; else break; }
  if (streak >= 7) adv.push(`${streak}日連続で記録中! この記録は診察時にも役立ちます。`);
  return adv;
}

/* ---------- helpers ---------- */
const $ = (sel, el) => (el || document).querySelector(sel);
const WD = ["日", "月", "火", "水", "木", "金", "土"];
function fmtJP(key) {
  const d = new Date(key + "T00:00:00");
  return `${d.getMonth() + 1}月${d.getDate()}日(${WD[d.getDay()]})`;
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function painColor(v) {
  if (v <= 2) return "#66BB6A";
  if (v <= 4) return "#9CCC65";
  if (v <= 6) return "#FFB300";
  if (v <= 8) return "#F4511E";
  return "#D32F2F";
}
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.add("hidden"), 1800);
}
const FONT_SIZES = { normal: 18, large: 21, huge: 24 };
function applyUi() {
  const s = state.settings;
  document.documentElement.style.fontSize = (FONT_SIZES[s.font] || 18) + "px";
  document.body.classList.toggle("hc", !!s.hc);
  document.body.classList.toggle("simple", !!s.simple);
}
function exercisesDoneCount(day) {
  return EXERCISES.filter(e => (day.exercises[e.id] || 0) >= e.sets).length;
}

/* ---------- pain scale renderer ---------- */
function painScaleHTML(current, name) {
  let btns = "";
  for (let i = 0; i <= 10; i++) {
    btns += `<button type="button" class="pain-btn${current === i ? " selected" : ""}" data-pain-name="${name}" data-pain="${i}" style="background:${painColor(i)}">${i}</button>`;
  }
  return `<div class="pain-grid">${btns}</div>
  <div class="pain-legend"><span>0:痛くない</span><span>5:かなり痛い</span><span>10:耐えられない</span></div>`;
}

/* ---------- 今日のアイテム ---------- */
const ITEMS = [
  { name: "土踏まずサポートインソール", cat: "インソール", desc: "縦アーチを支えて、歩く時の足底筋膜への負担を軽くします。", kw: "足底腱膜炎 インソール アーチサポート" },
  { name: "ナイトスプリント(夜用装具)", cat: "装具", desc: "寝ている間に足首を直角に保ち、朝の一歩目の痛みを和らげます。", kw: "足底腱膜炎 ナイトスプリント" },
  { name: "フットローラー", cat: "マッサージ", desc: "足裏を転がして筋膜をほぐす道具。朝の体操の前後に。", kw: "フットローラー 足裏 マッサージ" },
  { name: "アイスローラー(冷却タイプ)", cat: "冷却", desc: "凍らせたペットボトルでも代用できます。痛みが強い日に10分ほど。", kw: "アイスマッサージ ローラー 足裏" },
  { name: "クッションスリッパ", cat: "室内履き", desc: "家の中での裸足や硬い床は痛みを悪化させます。厚底の室内履きを。", kw: "クッション スリッパ 室内履き 厚底" },
  { name: "ストレッチベルト", cat: "ストレッチ", desc: "寝転んだままつま先を手前に引けて、ふくらはぎと筋膜を伸ばせます。", kw: "ストレッチベルト 足首 ストレッチ" },
  { name: "カーフストレッチャー(傾斜台)", cat: "ストレッチ", desc: "立つだけでふくらはぎが伸びる傾斜ボード。壁の近くで使いましょう。", kw: "カーフストレッチャー 傾斜ボード" },
  { name: "ジェルヒールカップ", cat: "インソール", desc: "かかとの衝撃を吸収するカップ型。痛みがかかと中心の人に。", kw: "ヒールカップ かかと ジェル" },
  { name: "リカバリーサンダル", cat: "靴", desc: "衝撃吸収に優れた厚底サンダル。室内履きや近所への外出に。", kw: "リカバリーサンダル 厚底" },
  { name: "アーチサポートスニーカー", cat: "靴", desc: "土踏まずの支えが強い歩きやすい靴。薄い靴・硬い靴は避けて。", kw: "アーチサポート スニーカー 歩きやすい" },
  { name: "キネシオロジーテープ", cat: "テーピング", desc: "足裏に貼って筋膜を補強。短期間の痛み軽減に有効とされます。", kw: "キネシオロジーテープ 足裏" },
  { name: "タオルつまみ専用タオル", cat: "体操グッズ", desc: "タオルつまみ体操に。普通のバスタオルでももちろんできます。", kw: "足指 トレーニング タオル" },
  { name: "マッサージボール", cat: "マッサージ", desc: "固めのボールで土踏まずをピンポイントにほぐせます。テニスボールでも可。", kw: "マッサージボール 足裏" },
  { name: "足底腱膜炎サポートソックス", cat: "靴下", desc: "アーチを圧迫サポートする靴下。立ち仕事の日に向いています。", kw: "足底腱膜炎 ソックス 着圧" },
  { name: "足つぼマット", cat: "マッサージ", desc: "踏むだけで足裏を刺激。痛みが強い日は無理をしないで。", kw: "足つぼマット 足裏" },
  { name: "フォームローラー", cat: "ストレッチ", desc: "ふくらはぎを転がして筋肉の緊張を緩める道具。", kw: "フォームローラー ふくらはぎ" },
  { name: "小型マッサージガン", cat: "マッサージ", desc: "振動でふくらはぎ・足裏の深い筋肉をほぐします。骨には当てないで。", kw: "マッサージガン 小型" },
  { name: "繰り返し使えるアイスパック", cat: "冷却", desc: "運動や長時間歩行のあと、足裏・かかとを冷やすのに便利です。", kw: "アイスパック 冷却 繰り返し" },
  { name: "薄型ヒールパッド", cat: "インソール", desc: "かかと部分だけの薄いパッド。窮屈な靴にも入れやすいタイプ。", kw: "ヒールパッド かかと 中敷き" },
  { name: "五本指ソックス", cat: "靴下", desc: "足指が開いて踏み込みが安定します。室内履きにも。", kw: "五本指ソックス" },
  { name: "アーチサポートバンド", cat: "サポーター", desc: "靴下の上からでも巻ける土踏まず支持バンド。手軽に試せます。", kw: "アーチサポーター 土踏まず バンド" },
  { name: "革靴用の薄型インソール", cat: "インソール", desc: "革靴・パンプスにも入る薄型。お出かけ用の靴にも支えを。", kw: "足底腱膜炎 インソール 薄型 革靴" },
  { name: "バランスボード", cat: "体操グッズ", desc: "足首周りの筋肉を鍛えて再発予防に。必ず壁や手すりの近くで。", kw: "バランスボード 足首 トレーニング" },
  { name: "フットマッサージクリーム", cat: "ケア", desc: "夜のケア習慣づけに。痛み止めではありませんが続けやすくなります。", kw: "フットクリーム マッサージ" },
  { name: "シリコンかかとサポーター", cat: "サポーター", desc: "靴下の下に履くシリコン型。かかとの衝撃を分散します。", kw: "シリコン かかとサポーター" },
  { name: "厚めのヨガマット", cat: "体操グッズ", desc: "床で行う体操の滑り止めと衝撃吸収に。", kw: "ヨガマット 厚手 滑り止め" },
  { name: "足指ストレッチリング", cat: "体操グッズ", desc: "足指の間にはめて伸ばす小さなリング。外反母趾気味の人にも。", kw: "足指 ストレッチ リング" },
  { name: "フットバス(足浴)", cat: "ケア", desc: "夜に温めて血流を促進。腫れや痛みが強い時は避けてください。", kw: "フットバス 足浴 保温" },
  { name: "簡単な歩数計", cat: "記録", desc: "このアプリの歩数記録と合わせて、1日の活動量の目安に。", kw: "歩数計 シンプル 高齢者" },
  { name: "クッション性の高いウォーキングシューズ", cat: "靴", desc: "かかとと土踏まずを守る厚底タイプ。靴選びは痛み対策の基本です。", kw: "ウォーキングシューズ クッション アーチサポート" }
];
function todayItem() {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const doy = Math.floor((Date.now() - start.getTime()) / 86400000);
  return ITEMS[doy % ITEMS.length];
}

/* ---------- 継続支援 ---------- */
const MISSIONS = [
  { text: "今朝の痛みを記録しよう", done: d => d.morningPain !== null },
  { text: "体操を1セットだけやろう", done: d => Object.values(d.exercises).some(v => v > 0) },
  { text: "歩数を記録しよう", done: d => d.steps !== null },
  { text: "好きな体操を1つやろう", done: d => Object.values(d.exercises).some(v => v > 0) },
  { text: "足の写真を1枚撮ろう", done: d => d.photos.length > 0 },
  { text: "体重を記録しよう", done: d => d.weight !== null },
  { text: "夜の痛みを記録しよう", done: d => d.eveningPain !== null },
];
function dayOfYear() {
  const start = new Date(new Date().getFullYear(), 0, 0);
  return Math.floor((Date.now() - start.getTime()) / 86400000);
}
function todayMission(day) {
  const m = MISSIONS[dayOfYear() % MISSIONS.length];
  return { text: m.text, done: m.done(day) };
}
function calendarHTML() {
  const now = new Date(), y = now.getFullYear(), mo = now.getMonth();
  const first = new Date(y, mo, 1).getDay();
  const daysIn = new Date(y, mo + 1, 0).getDate();
  let cells = "";
  for (let i = 0; i < first; i++) cells += `<span class="cal-day empty"></span>`;
  for (let d = 1; d <= daysIn; d++) {
    const k = `${y}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const rec = state.days[k] && state.days[k].morningPain !== null && state.days[k].morningPain !== undefined;
    cells += `<button type="button" class="cal-day${rec ? " rec" : ""}${k === todayKey() ? " today" : ""}" data-cal="${k}">${d}</button>`;
  }
  return `<div class="cal-grid">
    ${["日","月","火","水","木","金","土"].map(w => `<span class="cal-w">${w}</span>`).join("")}${cells}</div>`;
}
function celebrate() {
  const wrap = document.createElement("div");
  wrap.className = "confetti";
  const colors = ["#2E7D5B", "#E8B04B", "#D66", "#7B9ED6", "#8BC34A"];
  for (let i = 0; i < 36; i++) {
    const s = document.createElement("i");
    s.style.left = Math.random() * 100 + "vw";
    s.style.background = colors[i % colors.length];
    const sz = 6 + Math.random() * 8;
    s.style.width = sz + "px"; s.style.height = sz + "px";
    s.style.animationDelay = Math.random() * 0.5 + "s";
    wrap.appendChild(s);
  }
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 2400);
}

/* ---------- HOME ---------- */
function renderHome() {
  const el = $("#tab-home");
  const key = todayKey();
  const day = getDay(key);
  const done = exercisesDoneCount(day);
  const tip = TIPS[new Date().getDate() % TIPS.length];
  const advice = generateAdvice();

  // 継続バッジ
  let streak = 0;
  for (const k of recentDayKeys(365)) {
    const dd = state.days[k];
    if (dd && dd.morningPain !== null && dd.morningPain !== undefined) streak++; else break;
  }
  const wk7 = recentDayKeys(7);
  const exDays7 = wk7.filter(k => state.days[k] && Object.keys(state.days[k].exercises).length > 0).length;
  const latestWeight = [...recentDayKeys(60)].map(k => state.days[k]).find(d => d && d.weight);

  const dots = recentDayKeys(14).reverse().map(k => {
    const dd = state.days[k];
    const rec = dd && dd.morningPain !== null && dd.morningPain !== undefined;
    return `<span class="dot${rec ? " on" : ""}"></span>`;
  }).join("");
  const mission = todayMission(day);
  const yk = dayKey(new Date(Date.now() - 86400000));
  const yd = state.days[yk];
  const delta = (day.morningPain !== null && day.morningPain !== undefined && yd && yd.morningPain !== null && yd.morningPain !== undefined)
    ? day.morningPain - yd.morningPain : null;

  el.innerHTML = `
    <div class="card">
      <div class="big-date">${fmtJP(key)}</div>
      ${state.settings.name ? `<div class="muted">${esc(state.settings.name)}さんの記録</div>` : ""}
      <div class="badge-row">
        ${streak >= 3 ? `<span class="badge gold">記録 ${streak}日連続</span>` : ""}
        ${exDays7 >= 3 ? `<span class="badge">今週 ${exDays7}日 体操</span>` : ""}
        ${latestWeight && !state.settings.hideWeight ? `<span class="badge">体重 ${latestWeight.weight}kg</span>` : ""}
      </div>
      <div class="dot-row">${dots}</div>
      <div class="muted" style="font-size:.72rem">直近14日 ●=記録あり</div>
    </div>

    <div class="card mission-card${mission.done ? " done" : ""}">
      <h2>今日のミッション</h2>
      <div style="font-weight:700">${mission.done ? "達成! " : ""}${mission.text}</div>
      ${mission.done ? `<div class="muted">よくできました。この調子です。</div>` : ""}
    </div>

    ${advice.length ? `<div class="card"><h2>あなたへの提案</h2>
      ${advice.map(a => `<p style="margin-bottom:8px">・${a}</p>`).join("")}</div>` : ""}

    <div class="card">
      <h2>今朝の一歩目の痛み</h2>
      <p class="muted">起きて最初に床へ足をついた時の痛みは?</p>
      ${painScaleHTML(day.morningPain, "morningPain")}
      ${day.morningPain !== null ? `<p class="muted">記録済み: <strong>${day.morningPain}</strong></p>` : ""}
      ${delta !== null ? `<p class="delta ${delta < 0 ? "good" : delta > 0 ? "bad" : ""}">昨日より ${delta === 0 ? "同じ" : delta < 0 ? `${delta}(楽になった)` : `+${delta}(悪化)`}</p>` : ""}
    </div>

    <div class="card">
      <h2>今日の体操 <span class="streak">${done}/${EXERCISES.length} 完了</span></h2>
      ${EXERCISES.map(ex => {
        const c = day.exercises[ex.id] || 0;
        return `<div class="ex-head" style="padding:6px 0">
          <span>${c >= ex.sets ? "✔" : "・"} ${ex.name}</span>
          <span class="ex-count">${c}/${ex.sets}</span>
        </div>`;
      }).join("")}
      <button class="btn btn-primary" data-goto="exercise" style="width:100%;margin-top:10px">体操を始める</button>
    </div>

    <div class="card">
      <h2>記録カレンダー</h2>
      ${calendarHTML()}
      <p class="muted" style="font-size:.75rem;margin-top:6px">緑=記録した日。日付をタップするとその日の記録を開けます。</p>
    </div>

    <div class="card">
      <h2>夜の痛み(寝る前に)</h2>
      ${painScaleHTML(day.eveningPain, "eveningPain")}
    </div>

    <div class="tip-card">${tip}</div>

    ${(() => { const it = todayItem(); return `
    <div class="card">
      <h2>今日のアイテム</h2>
      <div style="font-weight:700">${esc(it.name)} <span class="feed-tag">${esc(it.cat)}</span></div>
      <p class="muted">${esc(it.desc)}</p>
      <div class="item-links">
        <a class="item-link" href="https://www.amazon.co.jp/s?k=${encodeURIComponent(it.kw)}" target="_blank" rel="noopener">Amazon</a>
        <a class="item-link" href="https://search.rakuten.co.jp/search/mall/${encodeURIComponent(it.kw)}/" target="_blank" rel="noopener">楽天</a>
        <a class="item-link" href="https://jp.mercari.com/search?keyword=${encodeURIComponent(it.kw)}" target="_blank" rel="noopener">メルカリ</a>
        <a class="item-link" href="https://shopping.yahoo.co.jp/search?p=${encodeURIComponent(it.kw)}" target="_blank" rel="noopener">Yahoo!</a>
      </div>
      <p class="muted" style="font-size:.72rem;margin-top:8px">購入は任意です。効果には個人差があります。</p>
    </div>`; })()}

    <div class="card">
      <h2>かかりつけ・病院メモ</h2>
      <div class="item-links" style="margin-top:0;margin-bottom:10px">
        <a class="item-link" href="https://www.google.com/maps/search/${encodeURIComponent("整形外科 足底腱膜炎")}" target="_blank" rel="noopener">地図で近くの整形外科</a>
        <a class="item-link" href="https://www.google.com/maps/search/${encodeURIComponent("リハビリ科 足底腱膜炎")}" target="_blank" rel="noopener">リハビリ科を探す</a>
      </div>
      ${state.hospitals.length
        ? state.hospitals.slice().sort((a, b) => b.rating - a.rating).map(hospRow).join("")
        : `<p class="muted">行ったことのある病院を登録すると、評価・費用・予約リンクがここに並びます。</p>`}
      <details class="ex-item">
        <summary><span style="font-weight:700">病院を追加する</span></summary>
        <div style="padding:0 14px 14px">
          <label class="field"><span>病院名</span><input type="text" id="hospName" maxlength="60" placeholder="例: ○○整形外科"></label>
          <label class="field"><span>評価(タップで選ぶ)</span></label>
          <div class="hosp-stars" id="hospStars">
            ${[1,2,3,4,5].map(i => `<button type="button" class="hosp-star" data-hstar="${i}">★</button>`).join("")}
          </div>
          <label class="field" style="margin-top:10px"><span>費用メモ(例: 初診3,500円)</span><input type="text" id="hospCost" maxlength="60"></label>
          <label class="field"><span>電話番号</span><input type="text" id="hospPhone" maxlength="20" inputmode="tel"></label>
          <label class="field"><span>予約・サイトのURL</span><input type="text" id="hospUrl" maxlength="300" inputmode="url" placeholder="https://"></label>
          <label class="field"><span>メモ</span><input type="text" id="hospMemo" maxlength="200"></label>
          <button class="btn btn-primary" id="addHospBtn" style="width:100%">追加する</button>
        </div>
      </details>
    </div>

    <div class="card" id="feedCard">
      <h2>足底腱膜炎の最新情報</h2>
      <p class="muted" id="feedBody">読み込み中…</p>
    </div>
    <div class="card" id="insightsCard"></div>`;
  updateHospStars();
  const MS = [7, 14, 30, 60, 100];
  if (MS.includes(streak) && state.settings.celebrateStreak !== streak) {
    state.settings.celebrateStreak = streak; save();
    setTimeout(() => { celebrate(); toast(`記録 ${streak}日連続、すごい!`); }, 400);
  }
  if (!state.settings.simple) loadFeed();
}

/* ---------- feed & insights ---------- */
const FEED_TIPS = [
  { title: "朝イチストレッチが効く理由", summary: "睡眠中に足底筋膜は縮みます。起きてすぐ足をつく前にストレッチすると、つっぱり感と痛みを抑えられます。", url: "", source: "ケア手帳 編集" },
  { title: "高負荷ストレッチ(ヒールレイズ)の研究", summary: "段差でのヒールレイズを週3回行うプログラムで、3ヶ月後の痛み改善がストレッチのみより大きかった報告があります(Rathleffら 2015)。", url: "https://pubmed.ncbi.nlm.nih.gov/25145882/", source: "研究紹介" },
  { title: "靴とインソール", summary: "土踏まずを支えるインソールやクッション性のある靴は痛み軽減に有効とされています。薄い靴・裸足は避けましょう。", url: "", source: "ケア手帳 編集" },
];
let feedLoaded = false;
async function fetchPubMedItems() {
  const q = encodeURIComponent("plantar fasciitis");
  const r1 = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${q}&sort=pubdate&retmax=5&retmode=json`);
  const ids = (await r1.json()).esearchresult.idlist;
  if (!ids || !ids.length) return [];
  const r2 = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`);
  const data = (await r2.json()).result;
  return ids.map(pmid => {
    const r = data[pmid] || {};
    return {
      title: (r.title || "").replace(/\.$/, ""),
      summary: `${r.source || ""} ${r.pubdate || ""}`.trim(),
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      source: "PubMed 最新論文",
    };
  });
}
const ARTICLE_TAGS = [
  [/stretch|exercise|rehabilit|physical therapy/i, "ストレッチ・体操の研究"],
  [/orthos|insole|footwear|shoe/i, "インソール・靴の研究"],
  [/inject|corticosteroid|prp|platelet/i, "注射治療の研究"],
  [/surg|fasciotom|operat/i, "手術の研究"],
  [/shock.?wave|eswt|laser|ultrasound therapy/i, "機器治療の研究"],
  [/meta.?analysis|systematic review|review/i, "複数研究のまとめ"],
  [/risk factor|prevalence|epidemiol|associat/i, "原因・疫学の研究"],
  [/mri|ultraso|radiograph|imaging|thickness/i, "画像検査の研究"],
  [/taping|tape/i, "テーピングの研究"],
];
function articleTag(title) {
  for (const [re, tag] of ARTICLE_TAGS) if (re.test(title)) return tag;
  return "足底腱膜炎の研究";
}
let hospRating = 3;
function hospRow(h) {
  return `<div class="hosp-item">
    <div class="ex-head">
      <span style="font-weight:700">${esc(h.name)}</span>
      <span class="hosp-rate">${"★".repeat(h.rating)}<span class="hosp-rate-off">${"★".repeat(5 - h.rating)}</span></span>
    </div>
    <div class="muted" style="font-size:.82rem;margin-top:2px">
      ${h.cost ? `費用: ${esc(h.cost)}　` : ""}${h.lastVisit ? `最終受診: ${h.lastVisit.slice(5).replace("-", "/")}　` : ""}${h.memo ? esc(h.memo) : ""}
    </div>
    <div class="hosp-actions">
      <a class="hosp-action" href="https://www.google.com/maps/search/${encodeURIComponent(h.name)}" target="_blank" rel="noopener">地図</a>
      ${h.phone ? `<a class="hosp-action" href="tel:${h.phone}">電話</a>` : ""}
      ${h.url ? `<a class="hosp-action" href="${esc(h.url)}" target="_blank" rel="noopener">予約/サイト</a>` : ""}
      <button type="button" class="hosp-action" data-hvisit="${esc(h.id)}">今日行った</button>
      <button type="button" class="hosp-action del" data-hdel="${esc(h.id)}">削除</button>
    </div>
  </div>`;
}
function updateHospStars() {
  document.querySelectorAll("#hospStars .hosp-star").forEach(b => {
    b.classList.toggle("on", Number(b.dataset.hstar) <= hospRating);
  });
}
function loadFeed() {
  if (feedLoaded) return;
  feedLoaded = true;
  const render = items => {
    const body = $("#feedBody");
    if (!body) return;
    body.outerHTML = items.slice(0, 5).map(i =>
      `<div style="padding:8px 0;border-bottom:1px solid var(--line)">
        <div style="font-weight:700;font-size:.92rem">${i.url ? `<a href="${esc(i.url)}" target="_blank" rel="noopener" style="color:var(--accent)">${esc(i.title)}</a>` : esc(i.title)}</div>
        <div class="muted">${esc(i.summary)}</div>
        <div class="muted" style="font-size:.75rem">${esc(i.source)}${i.kind === "research" || /pubmed/i.test(i.source) ? ` <span class="feed-tag">${articleTag(i.title)}</span>` : ""}</div>
      </div>`).join("") || `<p class="muted">情報を取得できませんでした</p>`;
  };
  const load = API_BASE
    ? fetch(`${API_BASE}/feed`).then(r => r.json()).then(d => d.items)
    : fetchPubMedItems().then(items => FEED_TIPS.concat(items));
  load.then(render).catch(() => {
    const body = $("#feedBody");
    if (body) body.outerHTML = FEED_TIPS.map(i =>
      `<div style="padding:8px 0"><div style="font-weight:700;font-size:.92rem">${esc(i.title)}</div><div class="muted">${esc(i.summary)}</div></div>`).join("");
  });
  if (!API_BASE) return;
  fetch(`${API_BASE}/insights`).then(r => r.json()).then(d => {
    const card = $("#insightsCard");
    if (!card || d.users < 3) { if (card) card.style.display = "none"; return; }
    card.innerHTML = `<h2>みんなの傾向(匿名集計)</h2>
      <p class="muted">参加者 ${d.users}人・朝の痛みの平均 ${d.avg_morning_pain ?? "—"}</p>
      ${d.shoe_stats.length ? `<p class="muted">履物ごとの平均痛み: ${d.shoe_stats.map(s => `${esc(s.shoe)} ${s.avg_pain}(n=${s.n})`).join(" / ")}</p>` : ""}`;
  }).catch(() => { const c = $("#insightsCard"); if (c) c.style.display = "none"; });
}

/* ---------- anonymous telemetry (opt-in) ---------- */
function sendTelemetry() {
  if (!API_BASE || !state.settings.share || !state.settings.anonId) return;
  const today = todayKey();
  if (state.settings.lastTelemetry === today) return;
  const day = state.days[today];
  if (!day) return;
  const payload = {
    anon_id: state.settings.anonId,
    date: today,
    morning_pain: day.morningPain,
    evening_pain: day.eveningPain,
    steps: day.steps,
    standing: day.standing,
    shoes: day.shoes || [],
    ex_done: exercisesDoneCount(day),
    ex_total: EXERCISES.length,
  };
  fetch(`${API_BASE}/telemetry`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }).then(r => { if (r.ok) { state.settings.lastTelemetry = today; save(); } }).catch(() => {});
}

/* ---------- EXERCISE ---------- */
const EX_ART = {
  fascia:   { img: "art/fascia.jpg",   dir: "up",    hint: "つま先を手前に反らす" },
  gastroc:  { img: "art/gastroc.jpg",  dir: "right", hint: "体を壁へゆっくり寄せる" },
  soleus:   { img: "art/soleus.jpg",   dir: "down",  hint: "後ろ足の膝を曲げて沈む" },
  towel:    { img: "art/towel.jpg",    dir: "left",  hint: "タオルを指でたぐり寄せる" },
  heelraise:{ img: "art/heelraise.jpg",dir: "up",    hint: "かかとを上げて下げる" },
  ice:      { img: "art/ice.jpg",      dir: "both",  hint: "足の裏で前後にころころ" },
};
const MOTION_ARROWS = {
  up:    '<path d="M12 22 V6" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M5 11 L12 4 L19 11" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  down:  '<path d="M12 2 V18" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M5 13 L12 20 L19 13" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  right: '<path d="M2 12 H18" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M13 5 L20 12 L13 19" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  left:  '<path d="M22 12 H6" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M11 5 L4 12 L11 19" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  both:  '<path d="M3 12 H12" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M9 8 L4 12 L9 16" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 12 H21" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M15 8 L20 12 L15 16" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
};
function exArt(id) {
  const a = EX_ART[id];
  if (!a) return "";
  const imgB = a.img.replace(".jpg", "-b.jpg");
  return `<div class="ex-art">
    <img src="${a.img}" alt="${a.hint}のイラスト" loading="lazy">
    <img class="frame-b" src="${imgB}" alt="" loading="lazy" aria-hidden="true">
    <div class="ex-motion"><svg viewBox="0 0 24 24" class="dir-${a.dir}" stroke="#E8845B">${MOTION_ARROWS[a.dir]}</svg><span>${a.hint}</span></div>
  </div>`;
}

const openEx = new Set();
let timer = { id: null, exId: null, remain: 0, running: false };

function renderExercises() {
  const el = $("#tab-exercise");
  const day = getDay(todayKey());
  el.innerHTML = `
    <div class="card"><h2>今日のリハビリ体操</h2>
      <p class="muted">全部やらなくてもOK。毎日少しずつ続けることが一番の治療です。</p></div>
    ${EXERCISES.map(ex => {
      const c = day.exercises[ex.id] || 0;
      const done = c >= ex.sets;
      return `<details class="ex-item${done ? " done" : ""}" data-exid="${ex.id}"${openEx.has(ex.id) ? " open" : ""}>
        <summary class="ex-head">
          <span class="ex-name">${done ? "✔ " : ""}${ex.name}</span>
          <span class="ex-sets">${c}/${ex.sets}セット${done ? " 完了" : ""}</span>
        </summary>
        ${exArt(ex.id)}
        <div class="ex-desc">${ex.desc}</div>
        <div class="ex-tip">${ex.tip}</div>
        <div class="ex-actions">
          ${ex.seconds ? `<button class="btn" data-timer="${ex.id}">タイマー(${ex.seconds}秒)</button>` : ""}
          <button class="btn ${done ? "" : "btn-primary"}" data-didset="${ex.id}" ${done ? "disabled" : ""}>
            ${done ? "完了 ✔" : `1セット完了(${c}/${ex.sets})`}
          </button>
        </div>
      </details>`;
    }).join("")}`;
}

function openTimer(exId) {
  const ex = EXERCISES.find(e => e.id === exId);
  const day = getDay(todayKey());
  const setsLeft = ex.sets - (day.exercises[exId] || 0);
  if (setsLeft <= 0) return;
  timer.exId = exId;
  timer.remain = ex.seconds;
  timer.running = false;
  timer.setsLeft = setsLeft;
  $("#timerName").textContent = ex.name;
  $("#timerOverlay").classList.remove("hidden");
  updateTimerView();
}
function updateTimerView() {
  $("#timerDisplay").textContent = timer.remain;
  $("#timerPhase").textContent = `残り ${timer.setsLeft} セット`;
  $("#timerStartPause").textContent = timer.running ? "一時停止" : "開始";
}
function tickTimer() {
  timer.remain--;
  if (timer.remain <= 0) {
    stopTick();
    markSet(timer.exId);
    timer.setsLeft--;
    if (timer.setsLeft > 0) {
      const ex = EXERCISES.find(e => e.id === timer.exId);
      timer.remain = ex.seconds;
      beep();
      toast("セット完了! 次のセットへ");
    } else {
      beep();
      closeTimer();
      toast("完了! おつかれさまでした");
      return;
    }
  }
  updateTimerView();
}
function startTick() { stopTick(); timer.id = setInterval(tickTimer, 1000); timer.running = true; updateTimerView(); }
function stopTick() { if (timer.id) clearInterval(timer.id); timer.id = null; timer.running = false; }
function closeTimer() { stopTick(); $("#timerOverlay").classList.add("hidden"); }
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880; g.gain.value = 0.15;
    o.start(); o.stop(ctx.currentTime + 0.25);
  } catch (e) { /* audio unavailable */ }
}
function markSet(exId) {
  const day = getDay(todayKey());
  day.exercises[exId] = (day.exercises[exId] || 0) + 1;
  save();
  if (exercisesDoneCount(day) === EXERCISES.length && state.settings.celebrateDate !== todayKey()) {
    state.settings.celebrateDate = todayKey(); save();
    celebrate(); toast("6種類すべて完了!すばらしい!");
  }
  if (activeTab === "exercise") renderExercises();
  if (activeTab === "home") renderHome();
}

/* ---------- LOG ---------- */
let logDate = todayKey();
function renderLog() {
  const el = $("#tab-log");
  const day = getDay(logDate);
  el.innerHTML = `
    <div class="card">
      <label class="field"><span>記録する日</span>
        <input type="date" id="logDateInput" value="${logDate}" max="${todayKey()}"></label>
    </div>
    <div class="card">
      <h2>${fmtJP(logDate)} の記録</h2>
      <h3>朝の一歩目の痛み</h3>
      ${painScaleHTML(day.morningPain, "morningPain")}
      <h3>夜の痛み</h3>
      ${painScaleHTML(day.eveningPain, "eveningPain")}
    </div>
    <div class="card">
      <h3>歩数の目安</h3>
      <div class="chips">${STEP_PRESETS.map(p =>
        `<button class="chip${day.steps === p.value ? " on" : ""}" data-step="${p.value}">${p.label}</button>`).join("")}
      </div>
      <label class="field"><span>正確な歩数(任意)</span>
        <input type="number" id="stepsInput" inputmode="numeric" value="${day.steps ?? ""}" placeholder="例: 3500"></label>
      <h3>立っていた時間</h3>
      <div class="chips">${STANDING_OPTS.map(o =>
        `<button class="chip${day.standing === o.id ? " on" : ""}" data-standing="${o.id}">${o.label}</button>`).join("")}
      </div>
      <h3>体重(任意・kg)</h3>
      <input type="number" id="weightInput" inputmode="decimal" step="0.1" value="${day.weight ?? ""}" placeholder="例: 65.5">
      <div class="muted" style="font-size:.78rem">この端末にのみ保存されます。誰にも送信されません。</div>
      <h3>薬・通院</h3>
      <div class="chips">
        <button class="chip${day.meds ? " on" : ""}" data-flag="meds">薬を飲んだ</button>
        <button class="chip${day.clinic ? " on" : ""}" data-flag="clinic">通院した</button>
      </div>
      <h3>足の写真(腫れ・見た目の記録)</h3>
      <div class="photo-row">${(day.photos || []).map((p, i) =>
        `<span class="photo-cell"><img src="${p}" alt="足の写真${i + 1}"><button class="photo-del" data-delphoto="${i}" aria-label="削除">×</button></span>`).join("")}
      </div>
      <input type="file" id="photoInput" accept="image/*" class="hidden">
      <button class="btn" id="addPhotoBtn" ${(day.photos || []).length >= 4 ? "disabled" : ""}>写真を追加(1日4枚まで)</button>
      <div class="muted" style="font-size:.78rem">写真もこの端末にのみ保存されます。</div>
      <h3>履いていたもの</h3>
      <div class="chips">${state.settings.shoePresets.map(s =>
        `<button class="chip${day.shoes.includes(s) ? " on" : ""}" data-shoe="${esc(s)}">${esc(s)}</button>`).join("")}
      </div>
      <label class="field"><span>メモ(痛む動作・できごとなど)</span>
        <textarea id="notesInput">${esc(day.notes)}</textarea></label>
      <button class="btn btn-primary" id="saveLogBtn" style="width:100%">保存する</button>
    </div>`;
}

/* ---------- CHART ---------- */
function renderChart() {
  const el = $("#tab-chart");
  const range = el.dataset.range || "14";
  const n = range === "30" ? 30 : 14;
  const days = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const dd = new Date(d); dd.setDate(d.getDate() - i);
    days.push(dayKey(dd));
  }
  const W = 340, H = 190, padL = 28, padB = 22, padT = 10;
  const iw = W - padL - 8, ih = H - padT - padB;
  const x = i => padL + (i + 0.5) * (iw / n);
  const y = v => padT + ih - (v / 10) * ih;
  const maxSteps = Math.max(1, ...days.map(k => state.days[k]?.steps || 0));

  let bars = "", lineM = "", lineE = "", dots = "", labels = "";
  days.forEach((k, i) => {
    const day = state.days[k];
    const bw = Math.max(4, iw / n - 6);
    if (day && day.steps) {
      const bh = (day.steps / maxSteps) * (ih * 0.45);
      bars += `<rect x="${x(i) - bw / 2}" y="${padT + ih - bh}" width="${bw}" height="${bh}" fill="#D8CBB8" rx="2"/>`;
    }
    if (day) {
      const done = exercisesDoneCount(day);
      if (done > 0) dots += `<circle cx="${x(i)}" cy="${padT + ih + 6}" r="3.5" fill="#2F8C6E" opacity="${0.3 + 0.7 * done / EXERCISES.length}"/>`;
    }
    if (day && day.morningPain !== null && day.morningPain !== undefined)
      lineM += `${lineM ? " L" : "M"}${x(i).toFixed(1)},${y(day.morningPain).toFixed(1)} `;
    if (day && day.eveningPain !== null && day.eveningPain !== undefined)
      lineE += `${lineE ? " L" : "M"}${x(i).toFixed(1)},${y(day.eveningPain).toFixed(1)} `;
    if (i % (n === 30 ? 5 : 2) === 0) {
      const dd = new Date(k + "T00:00:00");
      labels += `<text x="${x(i)}" y="${H - 8}" font-size="9" text-anchor="middle" fill="#9a958c">${dd.getMonth() + 1}/${dd.getDate()}</text>`;
    }
  });
  const yAxis = [0, 2, 4, 6, 8, 10].map(v =>
    `<text x="2" y="${y(v) + 3}" font-size="9" fill="#9a958c">${v}</text>
     <line x1="${padL}" y1="${y(v)}" x2="${W - 4}" y2="${y(v)}" stroke="#F0E8DC" stroke-width="1"/>`).join("");

  const recorded = days.filter(k => state.days[k] && state.days[k].morningPain !== null && state.days[k].morningPain !== undefined);
  const avg = recorded.length
    ? (recorded.reduce((s, k) => s + state.days[k].morningPain, 0) / recorded.length).toFixed(1)
    : "—";

  el.innerHTML = `
    <div class="card">
      <h2>痛みと活動の推移</h2>
      <div class="chips no-print">
        <button class="chip${range === "14" ? " on" : ""}" data-range="14">14日</button>
        <button class="chip${range === "30" ? " on" : ""}" data-range="30">30日</button>
      </div>
      <div class="chart-wrap"><svg viewBox="0 0 ${W} ${H}">
        ${yAxis}${bars}
        <path d="${lineM}" fill="none" stroke="#2F8C6E" stroke-width="2.5"/>
        <path d="${lineE}" fill="none" stroke="#F4511E" stroke-width="2" stroke-dasharray="5,4"/>
        ${dots}${labels}
      </svg></div>
      <div class="legend">
        <span><i style="background:#2F8C6E"></i>朝の痛み</span>
        <span><i style="background:#F4511E"></i>夜の痛み</span>
        <span><i style="background:#D8CBB8;height:10px"></i>歩数</span>
        <span><i style="background:#2F8C6E;height:7px;width:7px;border-radius:50%"></i>体操した日</span>
      </div>
    </div>
    <div class="card">
      <h2>この期間の朝の痛み 平均: <strong>${avg}</strong></h2>
      <p class="muted">記録日数: ${recorded.length}日 / ${n}日</p>
    </div>`;
}

/* ---------- REPORT ---------- */
function weekKeys(offset) {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7; // Monday=0
  const mon = new Date(now); mon.setDate(now.getDate() - dow - 7 * offset);
  const keys = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon); d.setDate(mon.getDate() + i);
    keys.push(dayKey(d));
  }
  return keys;
}
let reportOffset = 0;
function renderReport() {
  const el = $("#tab-report");
  const keys = weekKeys(reportOffset);
  const days = keys.map(k => ({ k, d: state.days[k] }));
  const withM = days.filter(x => x.d && x.d.morningPain !== null && x.d.morningPain !== undefined);
  const withE = days.filter(x => x.d && x.d.eveningPain !== null && x.d.eveningPain !== undefined);
  const avg = a => a.length ? (a.reduce((s, x) => s + x.v, 0) / a.length).toFixed(1) : "—";
  const mAvg = avg(withM.map(x => ({ v: x.d.morningPain })));
  const eAvg = avg(withE.map(x => ({ v: x.d.eveningPain })));
  const mMax = withM.length ? Math.max(...withM.map(x => x.d.morningPain)) : "—";
  const exSets = days.reduce((s, x) => s + (x.d ? Object.values(x.d.exercises).reduce((a, b) => a + b, 0) : 0), 0);
  const exDays = days.filter(x => x.d && Object.keys(x.d.exercises).length > 0).length;
  const stepsSum = days.reduce((s, x) => s + (x.d?.steps || 0), 0);
  const shoeCount = {};
  days.forEach(x => (x.d?.shoes || []).forEach(s => shoeCount[s] = (shoeCount[s] || 0) + 1));
  const notes = days.filter(x => x.d && x.d.notes.trim());
  const weights = days.filter(x => x.d && x.d.weight !== null);
  const medsDays = days.filter(x => x.d && x.d.meds).length;
  const clinicDays = days.filter(x => x.d && x.d.clinic).length;
  const photoCount = days.reduce((s, x) => s + (x.d?.photos?.length || 0), 0);

  el.innerHTML = `
    <div class="card">
      <h2>週間レポート(診察用)</h2>
      <div class="chips no-print">
        <button class="chip${reportOffset === 0 ? " on" : ""}" data-week="0">今週</button>
        <button class="chip${reportOffset === 1 ? " on" : ""}" data-week="1">先週</button>
      </div>
      <p class="muted">${fmtJP(keys[0])} 〜 ${fmtJP(keys[6])}</p>
    </div>
    <div class="card report-block">
      ${state.settings.name ? `<p><strong>名前:</strong> ${esc(state.settings.name)}</p>` : ""}
      <table>
        <tr><th>朝の痛み(0-10)</th><td>平均 ${mAvg} / 最大 ${mMax}</td></tr>
        <tr><th>夜の痛み(0-10)</th><td>平均 ${eAvg}</td></tr>
        <tr><th>体操をした日</th><td>${exDays}日(計${exSets}セット)</td></tr>
        <tr><th>歩数の合計</th><td>${stepsSum ? stepsSum.toLocaleString() + "歩" : "—"}</td></tr>
        <tr><th>履物の内訳</th><td>${Object.entries(shoeCount).map(([s, c]) => `${esc(s)}×${c}日`).join("、") || "—"}</td></tr>
        <tr><th>体重</th><td>${weights.length ? `最新 ${weights[weights.length - 1].d.weight}kg` + (weights.length > 1 ? ` (${weights[0].d.weight}kg → ${weights[weights.length - 1].d.weight}kg)` : "") : "—"}</td></tr>
        <tr><th>服薬</th><td>${medsDays}日</td></tr>
        <tr><th>通院</th><td>${clinicDays}日${clinicDays ? " (" + days.filter(x => x.d && x.d.clinic).map(x => fmtJP(x.k)).join("、") + ")" : ""}</td></tr>
        ${photoCount ? `<tr><th>足の写真</th><td>${photoCount}枚(端末内保存)</td></tr>` : ""}
      </table>
      ${notes.length ? `<h3>メモ</h3>${notes.map(x => `<p class="muted">・${fmtJP(x.k)}: ${esc(x.d.notes)}</p>`).join("")}` : ""}
      <h3>日ごとの記録</h3>
      <table>
        <tr><th>日付</th><th>朝</th><th>夜</th><th>歩数</th><th>体操</th></tr>
        ${days.map(x => `<tr>
          <td>${fmtJP(x.k)}</td>
          <td>${x.d?.morningPain ?? "—"}</td>
          <td>${x.d?.eveningPain ?? "—"}</td>
          <td>${x.d?.steps ? x.d.steps.toLocaleString() : "—"}</td>
          <td>${x.d ? exercisesDoneCount(x.d) + "/" + EXERCISES.length : "—"}</td>
        </tr>`).join("")}
      </table>
    </div>
    <div class="card no-print">
      <div class="btn-row">
        <button class="btn btn-primary" id="printBtn">印刷 / PDF保存</button>
        <button class="btn" id="copyReportBtn">テキストをコピー</button>
        <button class="btn" id="lineShareBtn">LINEで週報を送る</button>
      </div>
      <p class="muted" style="margin-top:8px">印刷画面は医師に見せる用。コピーしたテキストはLINEやメールで送れます。</p>
    </div>
    <p class="muted" style="margin-top:8px">※このアプリは医療機器ではありません。症状の記録と自己管理を助けるものです。痛みが続く・悪化する場合は医療機関を受診してください。</p>`;
}

function reportText() {
  const keys = weekKeys(reportOffset);
  const days = keys.map(k => ({ k, d: state.days[k] }));
  const withM = days.filter(x => x.d && x.d.morningPain !== null && x.d.morningPain !== undefined);
  const mAvg = withM.length ? (withM.reduce((s, x) => s + x.d.morningPain, 0) / withM.length).toFixed(1) : "—";
  const exDays = days.filter(x => x.d && Object.keys(x.d.exercises).length > 0).length;
  let t = `【足底腱膜炎ケア手帳 週間レポート】${fmtJP(keys[0])}〜${fmtJP(keys[6])}\n`;
  t += `朝の痛み 平均:${mAvg}  体操実施:${exDays}日\n`;
  days.forEach(x => {
    if (x.d) {
      t += `${fmtJP(x.k)} 朝:${x.d.morningPain ?? "-"} 夜:${x.d.eveningPain ?? "-"} 歩数:${x.d.steps ?? "-"} 体操:${exercisesDoneCount(x.d)}/${EXERCISES.length}`;
      if (x.d.weight) t += ` 体重:${x.d.weight}kg`;
      if (x.d.meds) t += " 服薬"; if (x.d.clinic) t += " 通院";
      if (x.d.notes) t += " メモ:" + x.d.notes;
      t += "\n";
    }
  });
  return t;
}

/* ---------- SETTINGS ---------- */
function renderSettings() {
  const el = $("#tab-settings");
  el.innerHTML = `
    <div class="card">
      <h2>使いやすさ</h2>
      <h3>文字の大きさ</h3>
      <div class="chips">
        <button class="chip${(state.settings.font || "normal") === "normal" ? " on" : ""}" data-font="normal">ふつう</button>
        <button class="chip${state.settings.font === "large" ? " on" : ""}" data-font="large">大きい</button>
        <button class="chip${state.settings.font === "huge" ? " on" : ""}" data-font="huge">とても大きい</button>
      </div>
      <h3>見やすさ</h3>
      <div class="chips">
        <button class="chip${state.settings.hc ? " on" : ""}" id="hcToggle">${state.settings.hc ? "高コントラスト ON" : "高コントラスト OFF"}</button>
        <button class="chip${state.settings.simple ? " on" : ""}" id="simpleToggle">${state.settings.simple ? "シンプルモード ON" : "シンプルモード OFF"}</button>
      </div>
      <p class="muted" style="margin-top:8px">シンプルモード: 「ホーム」と「体操」だけに絞った表示にします。</p>
      <h3>プライバシー</h3>
      <button class="chip${state.settings.hideWeight ? " on" : ""}" id="hideWeightToggle">
        ${state.settings.hideWeight ? "体重は画面に出さない ON" : "体重は画面に出さない OFF"}
      </button>
      <p class="muted" style="margin-top:6px">ONにするとホームに体重バッジが出なくなります(体重・写真はどちらも端末内のみ保存で、誰にも送信されません)。</p>
    </div>
    <div class="card">
      <h2>リマインド通知</h2>
      <p class="muted">「ホーム画面に追加」したアプリで通知を許可すると、1日1回ほどストレッチと記録のリマインドが届きます(通知タイミングはブラウザが調整します)。</p>
      <button class="chip${state.settings.remind ? " on" : ""}" id="remindToggle" style="margin-top:8px">
        ${state.settings.remind ? "リマインド ON(タップでOFF)" : "リマインド OFF(タップでON)"}
      </button>
    </div>
    <div class="card">
      <h2>設定</h2>
      <label class="field"><span>お名前(レポートに表示・任意)</span>
        <input type="text" id="nameInput" value="${esc(state.settings.name)}" placeholder="例: 山田 花子"></label>
      <label class="field"><span>履物の候補(カンマ区切り)</span>
        <input type="text" id="shoesInput" value="${esc(state.settings.shoePresets.join(","))}"></label>
      <button class="btn btn-primary" id="saveSettingsBtn" style="width:100%">保存</button>
    </div>
    <div class="card">
      <h2>データの共有(任意)</h2>
      <p class="muted">ONにすると痛みスコア・歩数・体操実施の統計だけが匿名ID付きで送信され、「みんなの傾向」の集計とアプリ改善に使われます。<strong>名前・メモ・日付の詳細は送信されません</strong>。いつでもOFFにできます。${API_BASE ? "" : "(現在サーバー未接続のため無効)"}</p>
      <button class="chip${state.settings.share ? " on" : ""}" id="shareToggle" style="margin-top:8px">
        ${state.settings.share ? "共有中(タップでOFF)" : "共有はOFF(タップでON)"}
      </button>
      ${state.settings.anonId && state.settings.share ? `<p class="muted" style="margin-top:6px">匿名ID: ${state.settings.anonId.slice(0, 8)}…</p>` : ""}
    </div>
    <div class="card">
      <h2>データのバックアップ</h2>
      <p class="muted">記録はこのスマホの中だけに保存されます。機種変更前にバックアップを。</p>
      <div class="btn-row">
        <button class="btn" id="exportBtn">バックアップ(コピー)</button>
        <button class="btn" id="importBtn">復元</button>
      </div>
    </div>
    <div class="card">
      <h2>アプリについて</h2>
      <p class="muted">足底腱膜炎ケア手帳 v1.0<br>記録は端末内に保存され、外部には送信されません。<br>このアプリは医療機器ではありません。診断・治療は医療機関へ。</p>
      <button class="btn" id="wipeBtn" style="border-color:var(--warn);color:var(--warn);margin-top:10px">全データを削除</button>
    </div>`;
}

/* ---------- routing & events ---------- */
let activeTab = "home";
const renderers = { home: renderHome, exercise: renderExercises, log: renderLog, chart: renderChart, report: renderReport, settings: renderSettings };
function switchTab(tab) {
  if (state.settings.simple && ["log", "chart", "report"].includes(tab)) tab = "home";
  activeTab = tab;
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.add("hidden"));
  $("#tab-" + tab).classList.remove("hidden");
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  renderers[tab]();
  window.scrollTo(0, 0);
}

document.addEventListener("click", e => {
  const nav = e.target.closest(".nav-btn");
  if (nav) return switchTab(nav.dataset.tab);
  const goto = e.target.closest("[data-goto]");
  if (goto) return switchTab(goto.dataset.goto);
  const pain = e.target.closest("[data-pain]");
  if (pain) {
    const day = getDay(activeTab === "log" ? logDate : todayKey());
    day[pain.dataset.painName] = Number(pain.dataset.pain);
    const ok = save();
    renderers[activeTab]();
    if (ok) toast("記録しました");
    return;
  }
  const t = e.target.closest("[data-timer]");
  if (t) return openTimer(t.dataset.timer);
  const ds = e.target.closest("[data-didset]");
  if (ds) { markSet(ds.dataset.didset); toast("おつかれさま!"); return; }
  const step = e.target.closest("[data-step]");
  if (step) { getDay(logDate).steps = Number(step.dataset.step); save(); renderLog(); return; }
  const st = e.target.closest("[data-standing]");
  if (st) { getDay(logDate).standing = st.dataset.standing; save(); renderLog(); return; }
  const fl = e.target.closest("[data-flag]");
  if (fl) {
    const day = getDay(logDate);
    day[fl.dataset.flag] = !day[fl.dataset.flag];
    save(); renderLog(); return;
  }
  const hs = e.target.closest("[data-hstar]");
  if (hs) { hospRating = Number(hs.dataset.hstar); updateHospStars(); return; }
  if (e.target.id === "addHospBtn") {
    const h = sanitizeHospital({
      name: $("#hospName").value,
      rating: hospRating,
      cost: $("#hospCost").value,
      phone: $("#hospPhone").value,
      url: $("#hospUrl").value,
      memo: $("#hospMemo").value,
    });
    if (!h) { toast("病院名を入力してください"); return; }
    state.hospitals.push(h);
    if (save()) { hospRating = 3; renderHome(); toast("病院を登録しました"); }
    return;
  }
  const hv = e.target.closest("[data-hvisit]");
  if (hv) {
    const h = state.hospitals.find(x => x.id === hv.dataset.hvisit);
    if (h) {
      h.lastVisit = todayKey();
      getDay(todayKey()).clinic = true;
      if (save()) { renderHome(); toast(`${h.name} の受診を記録しました`); }
    }
    return;
  }
  const hd = e.target.closest("[data-hdel]");
  if (hd) {
    const i = state.hospitals.findIndex(x => x.id === hd.dataset.hdel);
    if (i >= 0) { state.hospitals.splice(i, 1); save(); renderHome(); }
    return;
  }
  const cal = e.target.closest("[data-cal]");
  if (cal) { logDate = cal.dataset.cal; switchTab("log"); return; }
  if (e.target.id === "addPhotoBtn") { $("#photoInput").click(); return; }
  const dp = e.target.closest("[data-delphoto]");
  if (dp) {
    const day = getDay(logDate);
    day.photos.splice(Number(dp.dataset.delphoto), 1);
    save(); renderLog(); return;
  }
  const sh = e.target.closest("[data-shoe]");
  if (sh) {
    const day = getDay(logDate), s = sh.dataset.shoe, i = day.shoes.indexOf(s);
    if (i >= 0) day.shoes.splice(i, 1); else day.shoes.push(s);
    save(); renderLog(); return;
  }
  const rg = e.target.closest("[data-range]");
  if (rg) { $("#tab-chart").dataset.range = rg.dataset.range; renderChart(); return; }
  const wk = e.target.closest("[data-week]");
  if (wk) { reportOffset = Number(wk.dataset.week); renderReport(); return; }
  if (e.target.closest("#btnSettings")) return switchTab("settings");
  if (e.target.id === "saveLogBtn") {
    const day = getDay(logDate);
    const v = $("#stepsInput").value.trim();
    if (v === "") day.steps = null;
    else {
      const n = Number(v);
      if (!isFinite(n) || n < 0 || n > 200000) { toast("歩数は0〜200000で入力してください"); return; }
      day.steps = Math.round(n);
    }
    const wv = $("#weightInput") ? $("#weightInput").value.trim() : "";
    if (wv === "") day.weight = null;
    else {
      const w = Number(wv);
      if (!isFinite(w) || w < 20 || w > 300) { toast("体重は20〜300kgで入力してください"); return; }
      day.weight = Math.round(w * 10) / 10;
    }
    day.notes = $("#notesInput").value.slice(0, 5000);
    if (save()) toast("保存しました");
    return;
  }
  const fontBtn = e.target.closest("[data-font]");
  if (fontBtn) { state.settings.font = fontBtn.dataset.font; save(); applyUi(); renderSettings(); return; }
  if (e.target.id === "hcToggle") { state.settings.hc = !state.settings.hc; save(); applyUi(); renderSettings(); return; }
  if (e.target.id === "hideWeightToggle") { state.settings.hideWeight = !state.settings.hideWeight; save(); renderSettings(); return; }
  if (e.target.id === "simpleToggle") {
    state.settings.simple = !state.settings.simple;
    save(); applyUi(); renderSettings();
    if (state.settings.simple && ["log", "chart", "report"].includes(activeTab)) switchTab("home");
    return;
  }
  if (e.target.id === "remindToggle") {
    if (state.settings.remind) {
      state.settings.remind = false; save(); renderSettings();
      navigator.serviceWorker && navigator.serviceWorker.ready
        .then(r => r.periodicSync && r.periodicSync.unregister("daily-reminder"));
      toast("リマインドOFF");
      return;
    }
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      toast("このブラウザは通知に対応していません"); return;
    }
    Notification.requestPermission().then(p => {
      if (p !== "granted") { toast("通知が許可されませんでした"); return; }
      Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, rej) => setTimeout(() => rej(new Error("sw-timeout")), 5000)),
      ]).then(reg => {
        const done = () => {
          state.settings.remind = true; save(); renderSettings();
          reg.showNotification("足底腱膜炎ケア手帳", { body: "リマインドを設定しました", icon: "icons/icon-192.png" });
        };
        if (reg.periodicSync)
          reg.periodicSync.register("daily-reminder", { minInterval: 12 * 3600 * 1000 })
            .then(done)
            .catch(() => { done(); toast("定期通知の登録に失敗(ホーム画面追加済み?)"); });
        else { done(); toast("この環境はアプリ内通知のみ対応"); }
      }).catch(() => toast("通知の準備ができません。ホーム画面に追加してから再度お試しください"));
    });
    return;
  }
  if (e.target.id === "shareToggle") {
    state.settings.share = !state.settings.share;
    if (state.settings.share && !state.settings.anonId && crypto.randomUUID)
      state.settings.anonId = crypto.randomUUID();
    if (!state.settings.share) state.settings.lastTelemetry = null;
    save(); renderSettings(); sendTelemetry();
    return;
  }
  if (e.target.id === "saveSettingsBtn") {
    state.settings.name = $("#nameInput").value.trim();
    state.settings.shoePresets = $("#shoesInput").value.split(/[,、]/).map(s => s.trim()).filter(Boolean);
    if (!state.settings.shoePresets.length) state.settings.shoePresets = DEFAULT_SHOES.slice();
    if (save()) toast("保存しました");
    return;
  }
  if (e.target.id === "printBtn") return window.print();
  if (e.target.id === "lineShareBtn") {
    const text = reportText();
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      window.open("https://line.me/R/msg/text/?" + encodeURIComponent(text), "_blank");
    }
    return;
  }
  if (e.target.id === "copyReportBtn") {
    navigator.clipboard.writeText(reportText()).then(() => toast("コピーしました"), () => toast("コピーできませんでした"));
    return;
  }
  if (e.target.id === "exportBtn") {
    navigator.clipboard.writeText(JSON.stringify(state)).then(() => toast("バックアップをコピーしました"), () => toast("コピーできませんでした"));
    return;
  }
  if (e.target.id === "importBtn") {
    const txt = prompt("バックアップした文字列を貼り付けてください:");
    if (txt) {
      try {
        const parsed = normalizeState(JSON.parse(txt));
        if (!parsed) { toast("データの形式が正しくありません"); return; }
        state = parsed;
        if (save()) { applyUi(); renderers[activeTab](); toast("復元しました"); }
      } catch (err) { toast("データが読めませんでした"); }
    }
    return;
  }
  if (e.target.id === "wipeBtn") {
    if (confirm("本当に全データを削除しますか? 元に戻せません。")) {
      state = { settings: defaultSettings(), days: {} };
      if (save()) { applyUi(); renderers[activeTab](); toast("削除しました"); }
    }
    return;
  }
  if (e.target.id === "timerStartPause") {
    if (timer.running) { stopTick(); updateTimerView(); } else startTick();
    return;
  }
  if (e.target.id === "timerSkip") {
    markSet(timer.exId); timer.setsLeft--;
    if (timer.setsLeft <= 0) { closeTimer(); toast("完了!"); return; }
    const ex = EXERCISES.find(x => x.id === timer.exId);
    timer.remain = ex.seconds; timer.running = false; stopTick(); updateTimerView(); return;
  }
  if (e.target.id === "timerClose") return closeTimer();
});

document.addEventListener("toggle", e => {
  const d = e.target.closest("details.ex-item[data-exid]");
  if (d) { d.open ? openEx.add(d.dataset.exid) : openEx.delete(d.dataset.exid); }
}, true);

document.addEventListener("change", e => {
  if (e.target.id === "logDateInput") { logDate = e.target.value || todayKey(); renderLog(); }
  if (e.target.id === "photoInput" && e.target.files && e.target.files[0]) addPhoto(e.target.files[0]);
});

function addPhoto(file) {
  if (!file.type.startsWith("image/")) { toast("画像ファイルを選んでください"); return; }
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement("canvas");
      const s = Math.min(1, 640 / Math.max(img.width, img.height));
      cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      const url = cv.toDataURL("image/jpeg", 0.75);
      const day = getDay(logDate);
      if (!Array.isArray(day.photos)) day.photos = [];
      if (day.photos.length >= 4) { toast("1日4枚までです"); return; }
      day.photos.push(url);
      if (save()) { renderLog(); toast("写真を保存しました"); }
      else day.photos.pop();
    };
    img.onerror = () => toast("画像を読み込めませんでした");
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !$("#timerOverlay").classList.contains("hidden")) closeTimer();
});

/* ---------- init ---------- */
const qp = new URLSearchParams(location.search);
if (["normal", "large", "huge"].includes(qp.get("font"))) state.settings.font = qp.get("font");
if (qp.get("hc") === "1") state.settings.hc = true;
if (qp.get("simple") === "1") state.settings.simple = true;
save();
applyUi();
const tabParam = qp.get("tab");
switchTab(tabParam && renderers[tabParam] && !(state.settings.simple && ["log", "chart", "report"].includes(tabParam)) ? tabParam : "home");
sendTelemetry();
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
