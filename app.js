let DATA = null;
let currentTest = null;
let idx = 0;
let answers = {};
let scores = {};
let radarChart = null;

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
  currentTest = DATA.tests.find(t => t.id === testId);
  idx = 0;
  answers = {};
  scores = {};

  (currentTest.dimensions || []).forEach(d => {
    const key = d.id ?? d.key;
    scores[key] = 0;
  });

  $("quizTitle").textContent = currentTest.title;
  $("quizSubtitle").textContent = currentTest.subtitle || currentTest.description || "";
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

  const min = Number(DATA.scale?.min ?? 1);
  const max = Number(DATA.scale?.max ?? 5);
  const labels = DATA.scale?.labels || {};

  for (let val = min; val <= max; val++) {
    const d = document.createElement("div");
    const isActive = (answers[q.id] === val);
    d.className = "opt" + (isActive ? " active" : "");
    d.textContent = labels[String(val)] || val;

    d.onclick = () => {
      answers[q.id] = val;
      [...options.children].forEach(x => x.classList.remove("active"));
      d.classList.add("active");
    };

    options.appendChild(d);
  }
}

function calcScores(){
  const temp = {};

  currentTest.questions.forEach(q => {
    const val = answers[q.id];
    if (val === undefined) return;

    const dim = q.dimension;
    if (!temp[dim]) temp[dim] = { total: 0, count: 0 };
    temp[dim].total += val;
    temp[dim].count++;
  });

  scores = {};
  Object.keys(temp).forEach(dim => {
    const avg = temp[dim].total / temp[dim].count;
    scores[dim] = avg;
  });
}

function getOverall(){
  const vals = Object.values(scores);
  if (!vals.length) return 0;
  return vals.reduce((a,b)=>a+b,0) / vals.length;
}

function getBand(overall){
  const bands = currentTest.scoring?.bands || [];
  return bands.find(b => overall >= b.min && overall <= b.max) || bands[bands.length-1];
}

function renderRadarChart(){

  const canvas = $("radarChart");
  if (!canvas || !window.Chart) return;

  const dims = currentTest.dimensions || [];
  const maxScore = Number(DATA.scale?.max ?? 5);

  const labels = dims.map(d => d.name || d.id || d.key);

  // ⭐ 满分100分计算
  const values = dims.map(d => {
    const key = d.id ?? d.key;
    const avg = scores[key] || 0;
    return Math.round((avg / maxScore) * 100);
  });

  if (radarChart) {
    radarChart.destroy();
  }

  radarChart = new Chart(canvas, {
    type: "radar",
    data: {
      labels,
      datasets: [{
        label: "你的得分（满分100）",
        data: values,
        fill: true,
        backgroundColor: "rgba(54,162,235,0.2)",
        borderColor: "rgba(54,162,235,1)",
        pointBackgroundColor: "rgba(54,162,235,1)"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: {
            stepSize: 20
          }
        }
      }
    }
  });
}

function renderResult(){
  calcScores();

  const overall = getOverall();
  const band = getBand(overall);

  $("resultName").textContent = band?.title || "你的结果";
  $("resultOneLiner").textContent = band?.summary || "";

  $("resultStrengths").innerHTML =
    (band?.strengths || []).map(x => `<li>${escapeHtml(x)}</li>`).join("");

  $("resultPitfalls").innerHTML =
    (band?.risks || []).map(x => `<li>${escapeHtml(x)}</li>`).join("");

  const tips = [
    ...(band?.advice || []),
    ...(band?.notes || [])
  ].join("；");

  $("resultTips").textContent = tips;

  show("viewResult");

  // ⭐ 渲染雷达图
  renderRadarChart();
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

function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

loadData();
