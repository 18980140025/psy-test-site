let DATA = null;
let currentTest = null;
let idx = 0;

// 现在 answers 存的是 1-5 分，而不是 optionIndex
let answers = {}; // qid -> number(1..5)

// scores 存维度平均分：dimId -> avg
let scores = {};  // dimKey -> number

const $ = (id) => document.getElementById(id);

function show(view){
  ["viewHome","viewQuiz","viewResult"].forEach(v => $(v).classList.add("hidden"));
  $(view).classList.remove("hidden");
}

async function loadData(){
  const res = await fetch("./tests.json");
  DATA = await res.json();

  $("siteTitle").textContent = DATA.siteTitle || "心理测试";
  renderHome();
}

function renderHome(){
  const list = $("testList");
  list.innerHTML = "";
  (DATA.tests || []).forEach(t => {
    const div = document.createElement("div");
    div.className = "card testItem";
    div.innerHTML = `
      <div class="testTitle">${escapeHtml(t.title)}</div>
      <div class="muted testSub">${escapeHtml(t.subtitle || t.description || "")}</div>
    `;
    div.onclick = () => startTest(t.id);
    list.appendChild(div);
  });
  show("viewHome");
}

function startTest(testId){
  currentTest = (DATA.tests || []).find(t => t.id === testId);
  idx = 0;
  answers = {};
  scores = {};

  // 维度初始化（兼容 id/key）
  (currentTest.dimensions || []).forEach(d => {
    const k = d.id ?? d.key;
    if (k) scores[k] = 0;
  });

  $("quizTitle").textContent = currentTest.title;
  $("quizSubtitle").textContent = currentTest.subtitle || currentTest.description || "";
  show("viewQuiz");
  renderQuestion();
}

function renderQuestion(){
  const qs = currentTest.questions || [];
  const q = qs[idx];

  $("questionText").textContent = q.text;

  const total = qs.length;
  $("progressText").textContent = `${idx+1} / ${total}`;
  $("progressFill").style.width = `${Math.round(((idx+1)/total)*100)}%`;

  $("btnPrev").disabled = (idx === 0);
  $("btnNext").textContent = (idx === total-1) ? "查看结果" : "下一步";

  // 统一用 1-5 李克特量表生成选项
  const options = $("options");
  options.innerHTML = "";

  const scale = DATA.scale || {};
  const min = Number(scale.min ?? 1);
  const max = Number(scale.max ?? 5);
  const labels = scale.labels || {};

  for (let val = min; val <= max; val++) {
    const d = document.createElement("div");
    const isActive = (answers[q.id] === val);
    d.className = "opt" + (isActive ? " active" : "");

    // 显示：文案优先，其次显示数字
    const label = labels[String(val)] || String(val);
    d.textContent = label;

    d.onclick = () => {
      answers[q.id] = val;
      [...options.children].forEach(x => x.classList.remove("active"));
      d.classList.add("active");
    };

    options.appendChild(d);
  }
}

// 计算每个维度平均分，并写入 scores
function calcScores(){
  const dimAgg = {}; // dim -> {total,count}

  (currentTest.questions || []).forEach(q => {
    const chosenVal = answers[q.id]; // 1..5
    if (chosenVal === undefined) return;

    const dim = q.dimension; // 例如 "M" "N" "P"
    if (!dim) return;

    if (!dimAgg[dim]) dimAgg[dim] = { total: 0, count: 0 };
    dimAgg[dim].total += chosenVal;
    dimAgg[dim].count += 1;
  });

  // 写回 scores（平均分）
  scores = {};
  Object.keys(dimAgg).forEach(dim => {
    scores[dim] = dimAgg[dim].count ? (dimAgg[dim].total / dimAgg[dim].count) : 0;
  });
}

// 计算 overall（维度平均的平均）
function getOverallScore(){
  const vals = Object.values(scores);
  if (!vals.length) return 0;
  return vals.reduce((a,b)=>a+b,0) / vals.length;
}

function pickBand(overall){
  const bands = currentTest?.scoring?.bands || [];
  return bands.find(b => overall >= b.min && overall <= b.max) || bands[bands.length - 1] || null;
}

function getDominantDimension(){
  let bestDim = null;
  let bestVal = -Infinity;
  Object.keys(scores).forEach(dim => {
    const v = scores[dim];
    if (typeof v === "number" && v > bestVal) {
      bestVal = v;
      bestDim = dim;
    }
  });
  return { dim: bestDim, val: bestVal };
}

function getDominantTips(dominant){
  const tipsCfg = currentTest?.scoring?.dimension_tips || {};
  const dimTips = dominant?.dim ? tipsCfg[dominant.dim] : null;
  if (!dimTips) return [];

  if (dominant.val >= 3.7 && Array.isArray(dimTips.when_high)) return dimTips.when_high;
  if (dominant.val <= 2.4 && Array.isArray(dimTips.when_low)) return dimTips.when_low;
  return [];
}

function formatLines(title, arr){
  if (!arr || !arr.length) return "";
  return `${title}\n- ${arr.join("\n- ")}`;
}

function renderResult(){
  calcScores();

  const overall = getOverallScore();
  const band = pickBand(overall);
  const dominant = getDominantDimension();
  const dominantTips = getDominantTips(dominant);

  // ===== 结果展示（复用你现有的 DOM 结构） =====
  // 你原来：resultName / resultOneLiner / strengths(list) / pitfalls(list) / tips(text)
  $("resultName").textContent = band?.title || "你的结果";
  $("resultOneLiner").textContent = band?.summary || "";

  $("resultStrengths").innerHTML = (band?.strengths || []).map(x => `<li>${escapeHtml(x)}</li>`).join("");
  $("resultPitfalls").innerHTML  = (band?.risks || []).map(x => `<li>${escapeHtml(x)}</li>`).join("");

  // tips：把 advice + notes + dominantTips 合并成可读文本
  const tipsTextParts = [];
  if (band?.advice?.length) tipsTextParts.push(formatLines("未来建议", band.advice));
  if (band?.notes?.length) tipsTextParts.push(formatLines("生活中需要注意", band.notes));
  if (dominantTips?.length) tipsTextParts.push(formatLines("你的主导维度提醒", dominantTips));

  $("resultTips").textContent = tipsTextParts.filter(Boolean).join("\n\n");

  // ===== 分享文案 =====
  const dimStr = Object.keys(scores).length
    ? Object.keys(scores).map(k => `${k}:${(Math.round(scores[k]*100)/100).toFixed(2)}`).join("  ")
    : "";

  const share = [
    `【${currentTest.title}】`,
    `结果：${band?.title || "完成测试"}`,
    band?.summary ? `一句话：${band.summary}` : "",
    dimStr ? `维度分：${dimStr}` : "",
    band?.advice?.length ? `建议：${band.advice.slice(0,2).join("；")}` : "",
    `（非诊断，仅供参考）`
  ].filter(Boolean).join("\n");

  $("shareText").value = share;

  show("viewResult");
}

$("btnHome").onclick = () => renderHome();

$("btnPrev").onclick = () => {
  if (idx > 0) { idx--; renderQuestion(); }
};

$("btnNext").onclick = () => {
  const q = currentTest.questions[idx];
  if (answers[q.id] === undefined) {
    alert("先选一个选项再继续～");
    return;
  }
  if (idx < currentTest.questions.length - 1) {
    idx++;
    renderQuestion();
  } else {
    renderResult();
  }
};

$("btnRestart").onclick = () => startTest(currentTest.id);

$("btnCopy").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("shareText").value);
    $("btnCopy").textContent = "已复制";
    setTimeout(()=> $("btnCopy").textContent = "复制结果", 900);
  } catch {
    $("shareText").select();
    document.execCommand("copy");
  }
};

function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

loadData();
