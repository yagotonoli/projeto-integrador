// URL da API (servidor local)
const API_URL = "http://localhost:3000/estoque";

// Variáveis de estado
let filterActive = false;
let showingMov = false;
let showingReports = false;
let editingItemId = null;
let tableSortStates = {};

/* ================= Utility Functions ================= */

/**
 * Limpa todos os campos do painel de filtro.
 */
function clearFilterInputs() {
  document.querySelectorAll('#filter-panel input').forEach(i => i.value = '');
}

/**
 * Fecha apenas o painel de filtro, sem recarregar nada.
 */
function closeFilterPanel() {
  clearFilterInputs();
  document.getElementById("filter-panel").style.display = "none";
  document.getElementById("btn-filter").classList.remove("active");
  filterActive = false;
}

/**
 * Fecha todos os painéis (filtro, adicionar, editar) e limpa seleções.
 */
function closeAllPanels() {
  closeFilterPanel();
  closeAddPanel();
  cancelEdit();
  document.querySelectorAll(".row-checkbox").forEach(cb => {
    cb.checked = false;
    const tr = cb.closest("tr");
    if (tr) tr.classList.remove("selected");
  });
}

/**
 * Retorna qual tabela está ativa: "itens", "movimentacoes" ou "relatorios".
 */
function getActiveTableType() {
  if (showingMov) return "movimentacoes";
  if (showingReports) return "relatorios";
  return "itens";
}

/**
 * Carrega a tabela correspondente, opcionalmente com query string.
 */
function loadAppropriateTable(qs = "") {
  const type = getActiveTableType();
  if (type === "itens") loadItems(qs);
  else if (type === "movimentacoes") loadMovimentacoes();      // sempre recarrega tudo para client-side filter
  else if (type === "relatorios") loadRelatorios();            // idem
}

/* ================= Filter Panel ================= */

const filterConfigs = {
  itens: [
    { header: "Código", fieldIndex: 1, type: "text" },
    { header: "Nome", fieldIndex: 2, type: "text" },
    { header: "Marca", fieldIndex: 3, type: "text" },
    { header: "Categoria", fieldIndex: 4, type: "text" },
    { header: "Fornecedor", fieldIndex: 5, type: "text" },
    { header: "Validade", fieldIndex: 6, type: "date" },
    { header: "Quantidade", fieldIndex: 7, type: "number" }
  ],
  movimentacoes: [
    { header: "ID", fieldIndex: 0, type: "number" },
    { header: "Item", fieldIndex: 1, type: "text" },
    { header: "Nome", fieldIndex: 2, type: "text" },
    { header: "Marca", fieldIndex: 3, type: "text" },
    { header: "Categoria", fieldIndex: 4, type: "text" },
    { header: "Validade", fieldIndex: 5, type: "date" },
    { header: "Fornecedor", fieldIndex: 6, type: "text" },
    { header: "Qtde Atual", fieldIndex: 7, type: "number" },
    { header: "Qtde Anterior", fieldIndex: 8, type: "number" },
    { header: "Data", fieldIndex: 9, type: "date" },
    { header: "Observação", fieldIndex: 10, type: "text" }
  ],
  relatorios: [
    { header: "ID", fieldIndex: 0, type: "number" },
    { header: "Item", fieldIndex: 1, type: "text" },
    { header: "Nome", fieldIndex: 2, type: "text" },
    { header: "Marca", fieldIndex: 3, type: "text" },
    { header: "Categoria", fieldIndex: 4, type: "text" },
    { header: "Validade", fieldIndex: 5, type: "date" },
    { header: "Fornecedor", fieldIndex: 6, type: "text" },
    { header: "Qtde Entrada", fieldIndex: 7, type: "number" },
    { header: "Qtde Saída", fieldIndex: 8, type: "number" },
    { header: "Data", fieldIndex: 9, type: "date" },
    { header: "Observação", fieldIndex: 10, type: "text" }
  ]
};

/**
 * Mostra ou oculta o painel de filtro, reconstruindo campos conforme a tabela ativa.
 */
function toggleFilterPanel() {
  if (filterActive) {
    closeFilterPanel();
    // ao fechar, limpa e reexibe tudo
    const type = getActiveTableType();
    if (type === "itens") loadItems();
    if (type === "movimentacoes") loadMovimentacoes();
    if (type === "relatorios") loadRelatorios();
  } else {
    closeAllPanels();
    const type = getActiveTableType();
    const cfg = filterConfigs[type];
    let html = `<div class="panel-title">Filtrar ${type === "itens" ? "Itens" : type === "movimentacoes" ? "Movimentações" : "Relatórios"}</div>`;
    html += `<div class="panel-wrapper"><div class="panel-row panel-header">`;
    cfg.forEach(col => html += `<div class="panel-cell">${col.header}</div>`);
    html += `</div><div class="panel-row">`;
    cfg.forEach(col => {
      const inputType = col.type === "date" ? "date" : col.type === "number" ? "number" : "text";
      html += `<div class="panel-cell"><input type="${inputType}" id="filter_${col.fieldIndex}" placeholder="${col.header}" onfocus="this.select()" /></div>`;
    });
    html += `</div></div><div class="panel-actions">
        <i class="fas fa-check action-confirm" title="Aplicar Filtro" onclick="applyFilterPanel()"></i>
        <i class="fas fa-times action-cancel"  title="Cancelar" onclick="toggleFilterPanel()"></i>
      </div>`;
    document.getElementById("filter-panel").innerHTML = html;
    document.getElementById("filter-panel").style.display = "block";
    document.getElementById("btn-filter").classList.add("active");
    filterActive = true;
    setTimeout(() => {
      const f = document.querySelector("#filter-panel input");
      if (f) { f.focus(); f.select(); }
    }, 100);
  }
}

/**
 * Aplica o filtro client-side a qualquer tabela visível.
 */
function applyFilterPanel() {
  const type = getActiveTableType();
  const cfg = filterConfigs[type];
  const tbodyId = type === "itens" ? "items-body" : type === "movimentacoes" ? "mov-body" : "reports-body";
  const rows = Array.from(document.getElementById(tbodyId).querySelectorAll("tr"));
  // coleta valores
  const filters = cfg.map(col => {
    const el = document.getElementById("filter_" + col.fieldIndex);
    return el && el.value.trim() !== "" ? { index: col.fieldIndex, type: col.type, value: el.value.trim() } : null;
  }).filter(f => f);

  rows.forEach(row => {
    let show = true;
    filters.forEach(f => {
      const cell = row.children[f.index];
      let text = cell ? cell.innerText.trim() : "";
      if (f.type === "text") {
        if (!text.toLowerCase().includes(f.value.toLowerCase())) show = false;
      } else if (f.type === "number") {
        if (text !== f.value) show = false;
      } else if (f.type === "date") {
        // comparar formatos YYYY-MM-DD input vs DD/MM/YYYY display
        const parts = text.split("/");
        const disp = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : "";
        if (disp !== f.value) show = false;
      }
    });
    row.style.display = show ? "" : "none";
  });
}

/* ================= Remaining Utilities ================= */

/**
 * Ajusta dinamicamente tamanho do título.
 */
function adjustHeading() {
  const container = document.getElementById("main-container");
  const heading = container.querySelector("h2");
  const containerWidth = container.clientWidth;
  const span = document.createElement("span");
  span.style.visibility = "hidden";
  span.style.whiteSpace = "nowrap";
  const computed = window.getComputedStyle(heading);
  span.style.fontFamily = computed.fontFamily;
  span.style.fontWeight = computed.fontWeight;
  span.style.letterSpacing = computed.letterSpacing;
  span.innerText = heading.innerText;
  document.body.appendChild(span);
  let low = 10, high = 1000, best = low;
  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2;
    span.style.fontSize = mid + "px";
    if (span.offsetWidth > containerWidth) high = mid;
    else { low = mid; best = mid; }
  }
  heading.style.fontSize = best * 0.95 + "px";
  document.body.removeChild(span);
}

function formatDateToDisplay(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  if (isNaN(date)) return "";
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function getExpirationClass(dateStr) {
  if (!dateStr) return "";
  const today = new Date();
  const exp = new Date(dateStr + "T00:00:00");
  const threshold = 20 * 24 * 60 * 60 * 1000;
  if (exp < today) return "expired";
  if (exp - today <= threshold) return "expiring";
  return "";
}

function getExpirationMessage(dateStr) {
  if (!dateStr) return "";
  const today = new Date();
  const exp = new Date(dateStr + "T00:00:00");
  if (exp < today) return "Produto vencido, descarte!";
  if (exp - today <= 20 * 24 * 60 * 60 * 1000) return "Alerta de produto próximo ao vencimento!";
  return "";
}

function attachRowSelectionListeners() {
  document.querySelectorAll(".row-checkbox").forEach(cb => {
    cb.addEventListener("change", function() {
      const tr = this.closest("tr");
      if (this.checked) tr.classList.add("selected");
      else tr.classList.remove("selected");
    });
  });
}

/* ================= Load Items ================= */

async function loadItems() {
  try {
    const res = await fetch(API_URL);
    const itens = await res.json();
    const body = document.getElementById("items-body");
    body.innerHTML = "";
    itens.forEach(item => {
      const expClass = getExpirationClass(item.validade);
      const expMsg   = getExpirationMessage(item.validade);
      const lowStock = parseInt(item.quantity) < 10;
      const lowMsg   = lowStock ? "Alerta de baixa quantidade em estoque!" : "";
      body.innerHTML += `
        <tr data-id="${item.id}">
          <td><input type="checkbox" class="row-checkbox" data-id="${item.id}"></td>
          <td>${item.codigo_item}</td>
          <td>${item.name}</td>
          <td>${item.brand}</td>
          <td>${item.category}</td>
          <td>${item.fornecedor || ""}</td>
          <td class="${expClass}" title="${expMsg}">${formatDateToDisplay(item.validade)}</td>
          <td class="${lowStock ? 'low-stock' : ''}" title="${lowMsg}">${item.quantity}</td>
        </tr>`;
    });
    attachRowSelectionListeners();
  } catch (e) {
    console.error("Erro ao carregar itens:", e);
  }
}

/* ================= Load Movimentações ================= */

function formatMovDate(dateTimeStr) {
  const d = new Date(dateTimeStr.replace(" ", "T"));
  return isNaN(d) ? "" : d.toLocaleString();
}

async function loadMovimentacoes() {
  try {
    const res = await fetch(API_URL.replace("/estoque", "") + "/movimentacoes");
    const movs = await res.json();
    const body = document.getElementById("mov-body");
    body.innerHTML = "";
    movs.forEach(m => {
      const cls     = m.tipo === "exclusão" ? "deleted" : "";
      const dateStr = formatMovDate(m.data);
      body.innerHTML += `
        <tr class="${cls}">
          <td>${m.id}</td>
          <td>${m.item || ""}</td>
          <td>${m.nome || ""}</td>
          <td>${m.marca || ""}</td>
          <td>${m.categoria || ""}</td>
          <td>${m.validade ? formatDateToDisplay(m.validade) : ""}</td>
          <td>${m.fornecedor || ""}</td>
          <td>${m.quantidade_atual}</td>
          <td>${m.quantidade_anterior}</td>
          <td class="cell-date">${dateStr}</td>
          <td>${m.observacao || ""}</td>
        </tr>`;
    });
  } catch (e) {
    console.error("Erro ao carregar movimentações:", e);
  }
}

/* ================= Load Relatórios ================= */

async function loadRelatorios() {
  try {
    const res = await fetch(API_URL.replace("/estoque", "") + "/relatorios");
    const reps = await res.json();
    const body = document.getElementById("reports-body");
    body.innerHTML = "";
    reps.forEach(r => {
      const cls     = r.tipo === "exclusão" ? "deleted" : "";
      const dateStr = formatMovDate(r.data);
      body.innerHTML += `
        <tr class="${cls}">
          <td>${r.id}</td>
          <td>${r.item || ""}</td>
          <td>${r.nome || ""}</td>
          <td>${r.marca || ""}</td>
          <td>${r.categoria || ""}</td>
          <td>${r.validade ? formatDateToDisplay(r.validade) : ""}</td>
          <td>${r.fornecedor || ""}</td>
          <td>${r.quantidade_entrada}</td>
          <td>${r.quantidade_saida}</td>
          <td class="cell-date">${dateStr}</td>
          <td>${r.observacao || ""}</td>
        </tr>`;
    });
  } catch (e) {
    console.error("Erro ao carregar relatórios:", e);
  }
}

/* ================= Add/Edit Panels ================= */

function openAddPanel() {
  if (getActiveTableType() !== "itens") { alert("Disponível apenas na tabela de itens."); return; }
  closeAllPanels();
  document.getElementById("add-panel").style.display = "block";
  document.getElementById("btn-add").classList.add("active");
  setTimeout(() => { const e = document.getElementById("add-code"); if (e) { e.focus(); e.select(); } }, 100);
}

function closeAddPanel() {
  ["code", "name", "brand", "category", "supplier", "validity", "quantity"].forEach(id => {
    document.getElementById("add-" + id).value = "";
  });
  document.getElementById("add-panel").style.display = "none";
  document.getElementById("btn-add").classList.remove("active");
}

async function addItemPanel() {
  if (getActiveTableType() !== "itens") { alert("Disponível apenas na tabela de itens."); return; }
  const c = document.getElementById("add-code").value.trim();
  const n = document.getElementById("add-name").value.trim();
  const b = document.getElementById("add-brand").value.trim();
  const cat = document.getElementById("add-category").value.trim();
  const sup = document.getElementById("add-supplier").value.trim();
  const val = document.getElementById("add-validity").value;
  const qty = document.getElementById("add-quantity").value;
  if (!c || !n || !b || !cat || !sup || !val || !qty) { alert("Preencha todos os campos."); return; }
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo_item: c, name: n, brand: b, category: cat, fornecedor: sup, validade: val, quantity: qty })
    });
    if (res.ok) { loadItems(""); closeAddPanel(); }
    else console.error("Erro status", res.status);
  } catch (e) {
    console.error(e);
  }
}

function editSelectedItem() {
  if (getActiveTableType() !== "itens") { alert("Disponível apenas na tabela de itens."); return; }
  closeFilterPanel(); closeAddPanel();
  const sel = document.querySelectorAll(".row-checkbox:checked");
  if (sel.length === 0) { alert("Selecione um item."); return; }
  if (sel.length > 1) { alert("Selecione apenas um item."); return; }
  const row = sel[0].closest("tr");
  editingItemId = row.dataset.id;
  document.getElementById("edit-code").value = row.cells[1].innerText;
  document.getElementById("edit-name").value = row.cells[2].innerText;
  document.getElementById("edit-brand").value = row.cells[3].innerText;
  document.getElementById("edit-category").value = row.cells[4].innerText;
  document.getElementById("edit-supplier").value = row.cells[5].innerText;
  const raw = row.cells[6].getAttribute("data-raw") || "";
  document.getElementById("edit-validity").value = raw;
  document.getElementById("edit-quantity").value = row.cells[7].innerText;
  document.getElementById("btn-edit").classList.add("active");
  document.getElementById("edit-panel").style.display = "block";
  setTimeout(() => { const e = document.getElementById("edit-code"); if (e) { e.focus(); e.select(); } }, 100);
}

async function saveEdit() {
  if (!editingItemId) { alert("Nenhum item em edição."); return; }
  const c = document.getElementById("edit-code").value.trim();
  const n = document.getElementById("edit-name").value.trim();
  const b = document.getElementById("edit-brand").value.trim();
  const cat = document.getElementById("edit-category").value.trim();
  const sup = document.getElementById("edit-supplier").value.trim();
  const val = document.getElementById("edit-validity").value;
  const qty = document.getElementById("edit-quantity").value;
  if (!c || !n || !b || !cat || !sup || !val || !qty) { alert("Preencha todos os campos."); return; }
  try {
    const res = await fetch(`${API_URL}/${editingItemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo_item: c, name: n, brand: b, category: cat, fornecedor: sup, validade: val, quantity: qty })
    });
    if (res.ok) {
      alert("Item atualizado!");
      cancelEdit();
      loadItems("");
    } else alert("Erro ao atualizar.");
  } catch (e) {
    console.error(e);
  }
}

function cancelEdit() {
  editingItemId = null;
  document.getElementById("edit-panel").style.display = "none";
  document.getElementById("btn-edit").classList.remove("active");
}

/* ================ Delete Items ================ */

async function deleteSelectedItems() {
  const sel = Array.from(document.querySelectorAll(".row-checkbox:checked"));
  if (sel.length === 0) { alert("Selecione itens."); return; }
  if (!confirm("Excluir selecionados?")) return;
  try {
    await Promise.all(sel.map(cb => fetch(`${API_URL}/${cb.dataset.id}`, { method: "DELETE" })));
    loadItems("");
  } catch (e) {
    console.error(e);
    alert("Erro ao excluir.");
  }
}

/* ================ Sorting ================= */

function applySortingListeners() {
  document.querySelectorAll("table.sortable th[data-type]").forEach(th => {
    th.addEventListener("click", () => {
      const table = th.closest("table");
      const idx = parseInt(th.dataset.sortIndex);
      const type = th.dataset.type;
      sortTable(table, idx, type);
    });
  });
}

function sortTable(table, colIndex, type) {
  const id = table.id;
  const state = tableSortStates[id] || { key: null, asc: true };
  const asc = (state.key === colIndex) ? !state.asc : true;
  tableSortStates[id] = { key: colIndex, asc };
  const rows = Array.from(table.querySelectorAll("tbody tr"));
  rows.sort((a, b) => {
    let A = a.cells[colIndex].innerText.trim();
    let B = b.cells[colIndex].innerText.trim();
    if (type === "number") {
      return asc ? (parseFloat(A) || 0) - (parseFloat(B) || 0) : (parseFloat(B) || 0) - (parseFloat(A) || 0);
    }
    if (type === "date") {
      const rawA = a.cells[colIndex].dataset.raw || A.replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1");
      const rawB = b.cells[colIndex].dataset.raw || B.replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1");
      const dA = new Date(rawA + "T00:00:00");
      const dB = new Date(rawB + "T00:00:00");
      return asc ? dA - dB : dB - dA;
    }
    return asc ? A.localeCompare(B) : B.localeCompare(A);
  });
  const tbody = table.querySelector("tbody");
  rows.forEach(r => tbody.appendChild(r));
  table.querySelectorAll("th[data-type]").forEach(th => {
    const icon = th.querySelector(".sort-icon i");
    const idx2 = parseInt(th.dataset.sortIndex);
    icon.className = idx2 === colIndex ? (asc ? "fas fa-sort-up" : "fas fa-sort-down") : "fas fa-sort";
  });
}

/* ================ View Toggles ================= */

function toggleMovView() {
  closeAllPanels();
  if (showingReports) {
    showingReports = false;
    document.getElementById("btn-reports").classList.remove("active");
    document.getElementById("reports-container").style.display = "none";
  }
  showingMov = !showingMov;
  document.getElementById("btn-mov").classList.toggle("active", showingMov);
  document.getElementById("mov-container").style.display = showingMov ? "block" : "none";
  document.getElementById("items-container").style.display = showingMov ? "none" : "block";
  if (showingMov) loadMovimentacoes(""); else loadItems("");
}

function toggleRelView() {
  closeAllPanels();
  if (showingMov) {
    showingMov = false;
    document.getElementById("btn-mov").classList.remove("active");
    document.getElementById("mov-container").style.display = "none";
  }
  showingReports = !showingReports;
  document.getElementById("btn-reports").classList.toggle("active", showingReports);
  document.getElementById("reports-container").style.display = showingReports ? "block" : "none";
  document.getElementById("items-container").style.display = showingReports ? "none" : "block";
  if (showingReports) loadRelatorios(""); else loadItems("");
}

/* ================ Layout Helpers ================= */

function getScrollbarHeight() {
  const o = document.createElement("div");
  o.style.visibility = "hidden";
  o.style.overflow = "scroll";
  document.body.appendChild(o);
  const i = document.createElement("div");
  o.appendChild(i);
  const h = o.offsetHeight - i.offsetHeight;
  o.remove();
  return h;
}

function adjustPanelActionsMargin() {
  const sh = getScrollbarHeight();
  document.querySelectorAll(".panel").forEach(panel => {
    const pa = panel.querySelector(".panel-actions");
    pa.style.marginTop = panel.scrollWidth > panel.clientWidth ? sh + "px" : "0";
  });
}

/* ================ Initialization ================= */

document.addEventListener("DOMContentLoaded", () => {
  applySortingListeners();
  loadItems("");
  adjustPanelActionsMargin();
});

window.addEventListener("resize", () => {
  adjustHeading();
  adjustPanelActionsMargin();
});
