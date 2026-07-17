/* 足底腱膜炎ケア手帳 — local-first PWA */
"use strict";

const LS_KEY = "sokuteiData";
const API_BASE = "http://127.0.0.1:8791"; // デプロイ後のAPI URL

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
  return { morningPain: null, eveningPain: null, steps: null, standing: null, shoes: [], notes: "", exercises: {} };
}
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* corrupted data falls through to fresh state */ }
  return { settings: { name: "", shoePresets: DEFAULT_SHOES.slice() }, days: {} };
}
let state = loadState();
function save() { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
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

/* ---------- HOME ---------- */
function renderHome() {
  const el = $("#tab-home");
  const key = todayKey();
  const day = getDay(key);
  const done = exercisesDoneCount(day);
  const tip = TIPS[new Date().getDate() % TIPS.length];
  const advice = generateAdvice();

  el.innerHTML = `
    <div class="card">
      <div class="big-date">${fmtJP(key)}</div>
      ${state.settings.name ? `<div class="muted">${esc(state.settings.name)}さんの記録</div>` : ""}
    </div>

    ${advice.length ? `<div class="card"><h2>あなたへの提案</h2>
      ${advice.map(a => `<p style="margin-bottom:8px">・${a}</p>`).join("")}</div>` : ""}

    <div class="card">
      <h2>今朝の一歩目の痛み</h2>
      <p class="muted">起きて最初に床へ足をついた時の痛みは?</p>
      ${painScaleHTML(day.morningPain, "morningPain")}
      ${day.morningPain !== null ? `<p class="muted">記録済み: <strong>${day.morningPain}</strong></p>` : ""}
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
      <h2>夜の痛み(寝る前に)</h2>
      ${painScaleHTML(day.eveningPain, "eveningPain")}
    </div>

    <div class="tip-card">${tip}</div>

    <div class="card" id="feedCard">
      <h2>足底腱膜炎の最新情報</h2>
      <p class="muted" id="feedBody">読み込み中…</p>
    </div>
    <div class="card" id="insightsCard"></div>`;
  loadFeed();
}

/* ---------- feed & insights ---------- */
let feedLoaded = false;
function loadFeed() {
  if (feedLoaded) return;
  feedLoaded = true;
  fetch(`${API_BASE}/feed`).then(r => r.json()).then(d => {
    const body = $("#feedBody");
    if (!body) return;
    body.outerHTML = d.items.slice(0, 5).map(i =>
      `<div style="padding:8px 0;border-bottom:1px solid var(--line)">
        <div style="font-weight:700;font-size:.92rem">${i.url ? `<a href="${esc(i.url)}" target="_blank" rel="noopener" style="color:var(--accent)">${esc(i.title)}</a>` : esc(i.title)}</div>
        <div class="muted">${esc(i.summary)}</div>
        <div class="muted" style="font-size:.75rem">${esc(i.source)}</div>
      </div>`).join("") || `<p class="muted">情報を取得できませんでした</p>`;
  }).catch(() => {
    const body = $("#feedBody");
    if (body) body.textContent = "情報を取得できませんでした(オフライン?)";
  });
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
  if (!state.settings.share || !state.settings.anonId) return;
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
      return `<div class="ex-item${done ? " done" : ""}">
        <div class="ex-head">
          <span class="ex-name">${ex.name}</span>
          <span class="ex-sets">${ex.perSet} × ${ex.sets}セット</span>
        </div>
        <div class="ex-desc">${ex.desc}</div>
        <div class="ex-tip">${ex.tip}</div>
        <div class="ex-actions">
          ${ex.seconds ? `<button class="btn" data-timer="${ex.id}">タイマー(${ex.seconds}秒)</button>` : ""}
          <button class="btn ${done ? "" : "btn-primary"}" data-didset="${ex.id}" ${done ? "disabled" : ""}>
            ${done ? "完了 ✔" : `1セット完了(${c}/${ex.sets})`}
          </button>
        </div>
      </div>`;
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
    if (x.d) t += `${fmtJP(x.k)} 朝:${x.d.morningPain ?? "-"} 夜:${x.d.eveningPain ?? "-"} 歩数:${x.d.steps ?? "-"} 体操:${exercisesDoneCount(x.d)}/${EXERCISES.length}${x.d.notes ? " メモ:" + x.d.notes : ""}\n`;
  });
  return t;
}

/* ---------- SETTINGS ---------- */
function renderSettings() {
  const el = $("#tab-settings");
  el.innerHTML = `
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
      <p class="muted">ONにすると痛みスコア・歩数・体操実施の統計だけが匿名ID付きで送信され、「みんなの傾向」の集計とアプリ改善に使われます。<strong>名前・メモ・日付の詳細は送信されません</strong>。いつでもOFFにできます。</p>
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
    save();
    renderers[activeTab]();
    toast("記録しました");
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
  if (e.target.id === "btnSettings") return switchTab("settings");
  if (e.target.id === "saveLogBtn") {
    const day = getDay(logDate);
    const v = $("#stepsInput").value;
    day.steps = v === "" ? null : Number(v);
    day.notes = $("#notesInput").value;
    save(); toast("保存しました"); return;
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
    save(); toast("保存しました"); return;
  }
  if (e.target.id === "printBtn") return window.print();
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
      try { state = JSON.parse(txt); save(); renderers[activeTab](); toast("復元しました"); }
      catch (err) { toast("データが読めませんでした"); }
    }
    return;
  }
  if (e.target.id === "wipeBtn") {
    if (confirm("本当に全データを削除しますか? 元に戻せません。")) {
      state = { settings: { name: "", shoePresets: DEFAULT_SHOES.slice() }, days: {} };
      save(); renderers[activeTab](); toast("削除しました");
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

document.addEventListener("change", e => {
  if (e.target.id === "logDateInput") { logDate = e.target.value || todayKey(); renderLog(); }
});

/* ---------- init ---------- */
switchTab("home");
sendTelemetry();
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
