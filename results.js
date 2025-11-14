const raw = localStorage.getItem("collectiveData");
if (!raw) {
  alert("Немає даних. Спочатку заповніть ранжування на collective.html");
  window.location.href = "collective.html";
}
const { machines, expertNames, rankingsByName, expertDeleted } =
  JSON.parse(raw);

const metricSel = document.getElementById("metricSelect");
const criterionSel = document.getElementById("criterionSelect");
const recalcBtn = document.getElementById("recalcBtn");
const permsDiv = document.getElementById("permsTable");
const noteDiv = document.getElementById("note");
const btnJson = document.getElementById("exportPermsJson");
const btnCsv = document.getElementById("exportPermsCsv");

const urlParams = new URLSearchParams(window.location.search);
metricSel.value = urlParams.get("metric") || "cook";
criterionSel.value = urlParams.get("criterion") || "sum";

function idsIntersection() {
  const ids = machines.map((m) => m.id);
  return ids.filter((id) =>
    expertNames.every((n) => !(expertDeleted[n] || []).includes(id))
  );
}

function cookDistance(orderA, orderB, ids) {
  let d = 0;
  ids.forEach((id) => {
    const a = orderA.indexOf(id),
      b = orderB.indexOf(id);
    if (a >= 0 && b >= 0) d += Math.abs(a + 1 - (b + 1));
  });
  return d;
}

function pairwiseVector(order, ids) {
  const pos = new Map();
  ids.forEach((id) => pos.set(id, order.indexOf(id)));
  const v = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const pi = pos.get(ids[i]),
        pj = pos.get(ids[j]);
      v.push(pi >= 0 && pj >= 0 ? (pi < pj ? 1 : -1) : 0);
    }
  }
  return v;
}
function hammingDistance(orderA, orderB, ids) {
  const a = pairwiseVector(orderA, ids),
    b = pairwiseVector(orderB, ids);
  let s = 0;
  for (let t = 0; t < a.length; t++) s += Math.abs(a[t] - b[t]);
  return s;
}

function permutations(arr, cap = Infinity) {
  const out = [];
  (function bt(a, l) {
    if (out.length >= cap) return;
    if (l === a.length) {
      out.push(a.slice());
      return;
    }
    for (let i = l; i < a.length; i++) {
      [a[l], a[i]] = [a[i], a[l]];
      bt(a, l + 1);
      [a[l], a[i]] = [a[i], a[l]];
      if (out.length >= cap) return;
    }
  })(arr.slice(), 0);
  return out;
}
function factorialSafe(n) {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

let bestRowsUnified = [];

function renderBestPermutations(metric, criterion, ids) {
  permsDiv.innerHTML = "";
  noteDiv.textContent = "";
  bestRowsUnified = [];

  const titles = {
    cook: { name: "Cook", sumLabel: "Sum Cook", maxLabel: "Max Cook" },
    hamming: { name: "Hamming", sumLabel: "Sum Ham", maxLabel: "Max Ham" },
  };

  const distFn = metric === "cook" ? cookDistance : hammingDistance;

  const n = ids.length;
  const hardCap = 40000000;
  const softCap = 10000;
  const total = factorialSafe(n);
  const cap = Math.min(total, hardCap);
  if (total > softCap) {
    noteDiv.textContent = `Увага: n=${n}, всього перестановок ${total.toLocaleString()} — аналізуємо ${cap.toLocaleString()}.`;
  }

  const perms = permutations(ids, cap);

  let bestVal = Infinity;
  let bestRows = [];

  perms.forEach((perm, idx) => {
    const dists = expertNames.map((nm) =>
      distFn(perm, rankingsByName[nm], ids)
    );
    const sum = dists.reduce((a, b) => a + b, 0);
    const max = Math.max(...dists);
    const score = criterion === "sum" ? sum : max;

    const row = {
      index: idx + 1,
      combination: perm.join(" "),
      ...Object.fromEntries(expertNames.map((nm, i) => [nm, dists[i]])),
      sum,
      max,
    };

    if (score < bestVal) {
      bestVal = score;
      bestRows = [row];
    } else if (score === bestVal) {
      bestRows.push(row);
    }
  });

  bestRowsUnified = bestRows.slice();

  const { name, sumLabel, maxLabel } = titles[metric];
  let html = `<h2>Найкращі перестановки — ${name} (${
    criterion === "sum" ? "адитивний" : "мінімакс"
  })</h2>`;
  html += "<table><thead><tr>";
  html += "<th>#</th><th>Комбінація (порядок id)</th>";
  expertNames.forEach((nm) => (html += `<th>${nm} (${name})</th>`));
  html += `<th style="background:#e6ffe6">${sumLabel}</th>`;
  html += `<th style="background:#fff4cc">${maxLabel}</th>`;
  html += "</tr></thead><tbody>";

  bestRowsUnified.sort(
    (a, b) =>
      (criterion === "sum" ? a.max - b.max : a.sum - b.sum) || a.index - b.index
  );

  bestRowsUnified.forEach((r) => {
    html += "<tr>";
    html += `<td>${r.index}</td>`;
    html += `<td>${r.combination}</td>`;
    expertNames.forEach((nm) => (html += `<td>${r[nm]}</td>`));
    html += `<td style="background:#e6ffe6">${r.sum}</td>`;
    html += `<td style="background:#fff4cc">${r.max}</td>`;
    html += "</tr>";
  });
  html += "</tbody></table>";

  const label = criterion === "sum" ? sumLabel : maxLabel;
  const val =
    criterion === "sum"
      ? Math.min(...bestRowsUnified.map((r) => r.sum))
      : Math.min(...bestRowsUnified.map((r) => r.max));
  const list = bestRowsUnified.map((r) => `[${r.combination}]`).join(", ");

  const box = document.createElement("div");
  box.style.margin = "10px 0";
  box.style.textAlign = "center";
  box.innerHTML = `<strong>Мінімальне ${label}:</strong> ${list} = ${val}.`;
  permsDiv.appendChild(box);
  permsDiv.insertAdjacentHTML("beforeend", html);
}

btnJson.addEventListener("click", () => {
  if (!bestRowsUnified.length) {
    alert("Немає даних для експорту.");
    return;
  }
  const blob = new Blob([JSON.stringify(bestRowsUnified, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "best_permutations.json";
  a.click();
});

btnCsv.addEventListener("click", () => {
  if (!bestRowsUnified.length) {
    alert("Немає даних для експорту.");
    return;
  }
  const sep = ";";
  const headers = ["#", "Комбінація", ...expertNames, "Sum", "Max"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  const rows = bestRowsUnified.map((r) => {
    const base = [r.index, r.combination];
    const perExperts = expertNames.map((n) => r[n]);
    return [...base, ...perExperts, r.sum, r.max];
  });

  let csv = "\uFEFF" + headers.map(esc).join(sep) + "\r\n";
  rows.forEach((arr) => {
    csv += arr.map(esc).join(sep) + "\r\n";
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "best_permutations.csv";
  a.click();
});

function recalcAll() {
  const ids = idsIntersection();
  renderBestPermutations(metricSel.value, criterionSel.value, ids);
}
recalcAll();
recalcBtn.addEventListener("click", recalcAll);
