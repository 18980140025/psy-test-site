let DATA = null;
let currentTest = null;
let idx = 0;
let answers = {}; // qid -> optionIndex
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
  DATA.tests.forEach(t => {
    const div = document.createElement("div");
    div.className = "card testItem";
    div.innerHTML = `
      <div class="testTitle">${escapeHtml(t.title)}</div>
      <div class="muted testSub">${escapeHtml(t.subtitle || "")}</div>
    `;
    div.onclick = () => startTest(t.id);
    list.appendChild(div);
  });
  show("viewHome");
}

function startTest(testId){
  currentTest = DATA.tests.find(t => t.id === testId);
  idx = 0;
  answers = {};
  scores = {};
  (currentTest.dimensions || []).forEach(d => scores[d.key] = 0);

  $("quizTitle").textContent = currentTest.title;
  $("quizSubtitle").textContent = currentTest.subtitle || "";
  show("viewQuiz");
  renderQuestion();
}

function renderQuestion(){
  const qs = currentTest.questions;
  const q = qs[idx];

  $("questionText").textContent = q.text;

  const total = qs.length;
  $("progressText").textContent = `${idx+1} / ${total}`;
  $("progressFill").style.width = `${Math.round(((idx+1)/total)*100)}%`;

  $("btnPrev").disabled = (idx === 0);
  $("btnNext").textContent = (idx === total-1) ? "查看结果" : "下一步";

  const options = $("options");
  options.innerHTML = "";
  q.options.forEach((opt, i) => {
    const d = document.createElement("div");
    d.className = "opt" + (answers[q.id] === i ? " active" : "");
    d.textContent = opt.text;
    d.onclick = () => {
      answers[q.id] = i;
      [...options.children].forEach(x => x.classList.remove("active"));
      d.classList.add("active");
    };
    options.appendChild(d);
  });
}

function calcScores(){
  // reset
  Object.keys(scores).forEach(k => scores[k] = 0);

  currentTest.questions.forEach(q => {
    const chosen = answers[q.id];
    if (chosen === undefined) return;
    const sc = q.options[chosen].scores || {};
    Object.keys(sc).forEach(dim => {
      scores[dim] = (scores[dim] || 0) + sc[dim];
    });
  });
}

function getResultKey(){
  const logic = currentTest.resultLogic;
  if (!logic || logic.type !== "quadrant") {
    // fallback: first result
    return Object.keys(currentTest.results)[0];
  }

  const x = logic.x, y = logic.y;
  const threshold = logic.threshold ?? 0.5;

  // compute max possible for dims based on chosen scale
  const max = {};
  currentTest.questions.forEach(q => {
    q.options.forEach(opt => {
      const sc = opt.scores || {};
      Object.keys(sc).forEach(dim => {
        max[dim] = Math.max(max[dim] || 0, sc[dim]);
      });
    });
  });

  // approximate max total per dim = maxPerQuestion * numberOfQuestionsThatTouchDim
  const dimQCount = {};
  currentTest.questions.forEach(q => {
    let touches = new Set();
    q.options.forEach(opt => Object.keys(opt.scores || {}).forEach(d => touches.add(d)));
    touches.forEach(d => dimQCount[d] = (dimQCount[d] || 0) + 1);
  });

  const maxTotalX = (max[x] || 0) * (dimQCount[x] || 1);
  const maxTotalY = (max[y] || 0) * (dimQCount[y] || 1);

  const rx = maxTotalX ? (scores[x] / maxTotalX) : 0;
  const ry = maxTotalY ? (scores[y] / maxTotalY) : 0;

  const highX = rx >= threshold;
  const highY = ry >= threshold;

  // Map: highY -> H, lowY -> L ; highX -> D, lowX -> E?（这里只是示例键名）
  // 你可以在 results 里自定义键，只要一致即可
  // 我们按当前 tests.json：x=D 代表 Directness；y=E 代表 Empathy
  const key = (highY ? "H" : "L") + (highX ? "D" : "E");
  return currentTest.results[key] ? key : Object.keys(currentTest.results)[0];
}

function renderResult(){
  calcScores();
  const key = getResultKey();
  const r = currentTest.results[key];

  $("resultName").textContent = r.name || "你的类型";
  $("resultOneLiner").textContent = r.oneLiner || "";

  $("resultStrengths").innerHTML = (r.strengths || []).map(x => `<li>${escapeHtml(x)}</li>`).join("");
  $("resultPitfalls").innerHTML  = (r.pitfalls || []).map(x => `<li>${escapeHtml(x)}</li>`).join("");
  $("resultTips").textContent = r.tips || "";

  const share = [
    `【${currentTest.title}】`,
    `我的结果：${r.name}`,
    r.oneLiner ? `一句话：${r.oneLiner}` : "",
    r.tips ? `建议：${r.tips}` : "",
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
