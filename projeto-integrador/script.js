// URL da API (servidor local)
const API_URL = "http://localhost:3000/estoque";

// Variáveis de estado da aplicação
let filterActive = false;
let showingMov = false;
let showingReports = false;
let editingItemId = null;
let tableSortStates = {};

/* =============================== */
/* FUNÇÕES DE UTILIDADE            */
/* =============================== */

/**
 * Fecha todos os painéis e limpa a seleção das linhas.
 */
function closeAllPanels() {
  closeFilterPanel();
  closeAddPanel();
  cancelEdit();
  document.querySelectorAll(".row-checkbox").forEach(cb => {
    cb.checked = false;
    const row = cb.closest("tr");
    if (row) row.classList.remove("selected");
  });
}

/**
 * Formata uma data para o formato DD/MM/YYYY para exibição.
 * Concatena "T00:00:00" para forçar a interpretação como horário local.
 * @param {string} dateStr - Data em formato ISO ("YYYY-MM-DD").
 * @returns {string} Data formatada.
 */
function formatDateToDisplay(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  if (isNaN(date)) return "";
  const day = ("0" + date.getDate()).slice(-2);
  const month = ("0" + (date.getMonth() + 1)).slice(-2);
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formata uma data para o formato YYYY-MM-DD para inputs.
 * Concatena "T00:00:00" para forçar a interpretação como local.
 * @param {string} dateStr - Data em formato ISO ("YYYY-MM-DD").
 * @returns {string} Data formatada.
 */
function formatDateForInput(dateStr) {
  if (!dateStr) return "";
  // Força a interpretação local adicionando "T00:00:00"
  const date = new Date(dateStr + "T00:00:00");
  if (isNaN(date)) return "";
  const yyyy = date.getFullYear();
  const mm = ("0" + (date.getMonth() + 1)).slice(-2);
  const dd = ("0" + date.getDate()).slice(-2);
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Converte data no formato brasileiro (DD/MM/YYYY) para objeto Date.
 * @param {string} dateStr - Data em formato DD/MM/YYYY.
 * @returns {Date} Objeto Date.
 */
function parseBrazilianDate(dateStr) {
  const parts = dateStr.split("/");
  if (parts.length !== 3) return new Date(0);
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  const parsed = new Date(year, month, day);
  return isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

/**
 * Retorna a classe para itens com validade próxima.
 * @param {string} dateStr - Data de validade.
 * @returns {string} Classe CSS se a validade estiver próxima.
 */
function getExpirationClass(dateStr) {
  if (!dateStr) return "";
  const today = new Date();
  const expDate = new Date(dateStr + "T00:00:00");
  const diff = expDate - today;
  const threshold = 20 * 24 * 60 * 60 * 1000; // 20 dias em milissegundos
  return diff <= threshold ? "expiring" : "";
}

/**
 * Adiciona os event listeners para seleção de linhas na tabela.
 */
function attachRowSelectionListeners() {
  document.querySelectorAll(".row-checkbox").forEach(checkbox => {
    checkbox.addEventListener("change", function () {
      const row = this.closest("tr");
      if (this.checked) {
        row.classList.add("selected");
      } else {
        row.classList.remove("selected");
      }
    });
  });
}

/* =============================== */
/* FUNÇÕES DE CARREGAMENTO DE TABELAS */
/* =============================== */

/**
 * Carrega os itens da tabela através da API.
 * @param {string} query - Parâmetros de query para filtragem.
 */
async function loadItems(query = "") {
  try {
    const response = await fetch(API_URL + query);
    const itens = await response.json();
    const tableBody = document.getElementById("items-body");
    tableBody.innerHTML = "";
    itens.forEach(item => {
      const formattedValidade = formatDateToDisplay(item.validade);
      const expClass = getExpirationClass(item.validade);
      // Cria a linha da tabela com os dados do item
      const rowHTML = `
        <tr data-id="${item.id}">
          <td><input type="checkbox" class="row-checkbox" data-id="${item.id}"></td>
          <td class="cell-codigo_item">${item.codigo_item}</td>
          <td class="cell-name">${item.name}</td>
          <td class="cell-brand">${item.brand}</td>
          <td class="cell-category">${item.category}</td>
          <td class="cell-supplier">${item.fornecedor || ""}</td>
          <td class="cell-validity ${expClass}" data-raw="${item.validade || ''}">${formattedValidade}</td>
          <td class="cell-quantity">${item.quantity}</td>
        </tr>
      `;
      tableBody.innerHTML += rowHTML;
    });
    attachRowSelectionListeners();
  } catch (error) {
    console.error("Erro ao carregar itens:", error);
  }
}

/**
 * Retorna o tipo de tabela ativo: "itens", "movimentacoes" ou "relatorios".
 * @returns {string} Tipo da tabela ativa.
 */
function getActiveTableType() {
  if (document.getElementById("items-container").style.display !== "none") {
    return "itens";
  } else if (document.getElementById("mov-container").style.display !== "none") {
    return "movimentacoes";
  } else if (document.getElementById("reports-container").style.display !== "none") {
    return "relatorios";
  }
  return "itens";
}

/* =============================== */
/* CONFIGURAÇÃO DO PAINEL DE FILTRO  */
/* =============================== */

const filterConfigurations = {
  itens: {
    columns: [
      { header: "Código", field: "codigo_item", type: "text" },
      { header: "Nome", field: "name", type: "text" },
      { header: "Marca", field: "brand", type: "text" },
      { header: "Categoria", field: "category", type: "text" },
      { header: "Fornecedor", field: "fornecedor", type: "text" },
      { header: "Validade", field: "validade", type: "date" },
      { header: "Quantidade", field: "quantity", type: "number" }
    ]
  },
  movimentacoes: {
    columns: [
      { header: "ID", field: "id", type: "number" },
      { header: "Item", field: "item", type: "text" },
      { header: "Nome", field: "nome", type: "text" },
      { header: "Marca", field: "marca", type: "text" },
      { header: "Categoria", field: "categoria", type: "text" },
      { header: "Validade", field: "validade", type: "date" },
      { header: "Fornecedor", field: "fornecedor", type: "text" },
      { header: "Quantidade Atual", field: "quantidade_atual", type: "number" },
      { header: "Quantidade Anterior", field: "quantidade_anterior", type: "number" },
      { header: "Data", field: "data", type: "date" },
      { header: "Observação", field: "observacao", type: "text" }
    ]
  },
  relatorios: {
    columns: [
      { header: "ID", field: "id", type: "number" },
      { header: "Item", field: "item", type: "text" },
      { header: "Nome", field: "nome", type: "text" },
      { header: "Marca", field: "marca", type: "text" },
      { header: "Categoria", field: "categoria", type: "text" },
      { header: "Validade", field: "validade", type: "date" },
      { header: "Fornecedor", field: "fornecedor", type: "text" },
      { header: "Quantidade Entrada", field: "quantidade_entrada", type: "number" },
      { header: "Quantidade Saída", field: "quantidade_saida", type: "number" },
      { header: "Data", field: "data", type: "date" },
      { header: "Observação", field: "observacao", type: "text" }
    ]
  }
};

function updateFilterPanel() {
  const type = getActiveTableType();
  const config = filterConfigurations[type];
  const titleText = type === "itens" ? "Itens" : type === "movimentacoes" ? "Movimentações" : "Relatórios";
  let html = `<div class="panel-title">Filtrar ${titleText}</div>`;
  html += `<div class="panel-wrapper">`;
  html += '<div class="panel-row panel-header">';
  config.columns.forEach(col => {
    html += `<div class="panel-cell">${col.header}</div>`;
  });
  html += '</div><div class="panel-row">';
  config.columns.forEach(col => {
    const inputType = col.type === "date" ? "date" : (col.type === "number" ? "number" : "text");
    html += `<div class="panel-cell"><input type="${inputType}" id="filter_${col.field}" placeholder="${col.header}" /></div>`;
  });
  html += '</div></div>';
  html += '<div class="panel-actions">';
  html += `<i class="fas fa-check action-confirm" title="Aplicar Filtro" onclick="applyFilterPanel()"></i>`;
  html += `<i class="fas fa-times action-cancel" title="Cancelar Filtro" onclick="toggleFilterPanel()"></i>`;
  html += '</div>';
  document.getElementById("filter-panel").innerHTML = html;
}

function toggleFilterPanel() {
  if (filterActive) {
    closeFilterPanel();
    loadAppropriateTable("");
  } else {
    closeAllPanels();
    updateFilterPanel();
    document.getElementById("filter-panel").style.display = "block";
    document.getElementById("btn-filter").classList.add("active");
    filterActive = true;
  }
}

function closeFilterPanel() {
  document.getElementById("filter-panel").style.display = "none";
  document.getElementById("btn-filter").classList.remove("active");
  filterActive = false;
}

function applyFilterPanel() {
  const config = filterConfigurations[getActiveTableType()];
  let queryParams = [];
  config.columns.forEach(col => {
    const value = document.getElementById("filter_" + col.field)?.value;
    if (value) {
      queryParams.push(`${col.field}=${encodeURIComponent(value)}`);
    }
  });
  const queryString = queryParams.length > 0 ? "?" + queryParams.join("&") : "";
  const type = getActiveTableType();
  if (type === "itens") {
    loadItems(queryString);
  } else if (type === "movimentacoes") {
    loadMovimentacoes(queryString);
  } else if (type === "relatorios") {
    loadRelatorios(queryString);
  }
}

function loadAppropriateTable(query = "") {
  closeAllPanels();
  const type = getActiveTableType();
  if (type === "itens") {
    loadItems(query);
  } else if (type === "movimentacoes") {
    loadMovimentacoes(query);
  } else if (type === "relatorios") {
    loadRelatorios(query);
  }
}

/* =============================== */
/* FUNÇÕES DE PAINÉIS DE ADIÇÃO/EDIÇÃO */
/* =============================== */

function openAddPanel() {
  if (getActiveTableType() !== "itens") {
    alert("A adição de itens está disponível somente para a tabela de itens.");
    return;
  }
  closeAllPanels();
  document.getElementById("add-panel").style.display = "block";
  document.getElementById("btn-add").classList.add("active");
}

function closeAddPanel() {
  document.getElementById("add-panel").style.display = "none";
  document.getElementById("add-code").value = "";
  document.getElementById("add-name").value = "";
  document.getElementById("add-brand").value = "";
  document.getElementById("add-category").value = "";
  document.getElementById("add-supplier").value = "";
  document.getElementById("add-validity").value = "";
  document.getElementById("add-quantity").value = "";
  document.getElementById("btn-add").classList.remove("active");
}

async function addItemPanel() {
  if (getActiveTableType() !== "itens") {
    alert("A adição de itens está disponível somente para a tabela de itens.");
    return;
  }
  const codigo_item = document.getElementById("add-code").value;
  const name = document.getElementById("add-name").value;
  const brand = document.getElementById("add-brand").value;
  const category = document.getElementById("add-category").value;
  const supplier = document.getElementById("add-supplier").value;
  const validade = document.getElementById("add-validity").value;
  const quantity = document.getElementById("add-quantity").value;
  if (!codigo_item || !name || !brand || !category || !supplier || !validade || !quantity) {
    console.log("Preencha todos os campos no painel de adicionar item!");
    return;
  }
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigo_item,
        name,
        brand,
        category,
        fornecedor: supplier,
        validade,
        quantity
      })
    });
    if (response.ok) {
      console.log("Item adicionado/atualizado com sucesso!");
      loadItems("");
      closeAddPanel();
    } else {
      console.error("Erro ao adicionar/atualizar item. Status:", response.status);
    }
  } catch (error) {
    console.error("Erro na requisição:", error);
  }
}

function editSelectedItem() {
  if (getActiveTableType() !== "itens") {
    alert("A edição está disponível somente para a tabela de itens.");
    return;
  }
  closeFilterPanel();
  closeAddPanel();
  const checkboxes = document.querySelectorAll(".row-checkbox:checked");
  if (checkboxes.length === 0) {
    alert("Nenhum item selecionado para edição.");
    return;
  }
  if (checkboxes.length > 1) {
    alert("Selecione apenas um item para edição.");
    return;
  }
  const row = checkboxes[0].closest("tr");
  row.classList.add("editing");
  editingItemId = row.getAttribute("data-id");
  const codigo = row.querySelector(".cell-codigo_item").innerText;
  const name = row.querySelector(".cell-name").innerText;
  const brand = row.querySelector(".cell-brand").innerText;
  const category = row.querySelector(".cell-category").innerText;
  const supplier = row.querySelector(".cell-supplier").innerText;
  const validadeRaw = row.querySelector(".cell-validity").getAttribute("data-raw");
  const validade = formatDateForInput(validadeRaw);
  const quantity = row.querySelector(".cell-quantity").innerText;
  document.getElementById("edit-code").value = codigo;
  document.getElementById("edit-name").value = name;
  document.getElementById("edit-brand").value = brand;
  document.getElementById("edit-category").value = category;
  document.getElementById("edit-supplier").value = supplier;
  document.getElementById("edit-validity").value = validade;
  document.getElementById("edit-quantity").value = quantity;
  document.getElementById("btn-edit").classList.add("active");
  document.getElementById("edit-panel").style.display = "block";
}

async function saveEdit() {
  if (!editingItemId) {
    alert("Nenhum item em edição.");
    return;
  }
  const codigo_item = document.getElementById("edit-code").value;
  const name = document.getElementById("edit-name").value;
  const brand = document.getElementById("edit-brand").value;
  const category = document.getElementById("edit-category").value;
  const supplier = document.getElementById("edit-supplier").value;
  const validade = document.getElementById("edit-validity").value;
  const quantity = document.getElementById("edit-quantity").value;
  if (!codigo_item || !name || !brand || !category || !supplier || !validade || !quantity) {
    alert("Preencha todos os campos para edição.");
    return;
  }
  try {
    const response = await fetch(`${API_URL}/${editingItemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigo_item,
        name,
        brand,
        category,
        fornecedor: supplier,
        validade,
        quantity
      })
    });
    if (response.ok) {
      alert("Item atualizado com sucesso!");
      cancelEdit();
      loadItems("");
    } else {
      alert("Erro ao atualizar item.");
    }
  } catch (error) {
    console.error("Erro na atualização do item:", error);
  }
}

function cancelEdit() {
  editingItemId = null;
  document.getElementById("edit-panel").style.display = "none";
  document.querySelectorAll("tr.editing").forEach(row => row.classList.remove("editing"));
  document.getElementById("btn-edit").classList.remove("active");
}

/* =============================== */
/* FUNÇÃO DE EXCLUSÃO DE ITENS     */
/* =============================== */

async function deleteSelectedItems() {
  const checkboxes = document.querySelectorAll(".row-checkbox:checked");
  if (checkboxes.length === 0) {
    alert("Nenhum item selecionado para exclusão.");
    return;
  }
  if (!confirm("A ação irá excluir os itens selecionados. Deseja continuar?")) return;
  let deletePromises = [];
  checkboxes.forEach(checkbox => {
    const id = checkbox.getAttribute("data-id");
    deletePromises.push(
      fetch(`${API_URL}/${id}`, { method: "DELETE" }).then(response => {
        if (!response.ok) {
          throw new Error(`Erro ao excluir o item com ID ${id}`);
        }
        return response.json();
      })
    );
  });
  try {
    await Promise.all(deletePromises);
    console.log("Itens excluídos com sucesso!");
    loadItems("");
  } catch (error) {
    console.error("Erro ao excluir itens:", error);
    alert("Ocorreu um erro ao excluir itens.");
  }
}

/* =============================== */
/* FUNÇÕES DE ORDENAÇÃO DE TABELAS  */
/* =============================== */

function applySortingListeners() {
  document.querySelectorAll("table.sortable thead th[data-type]").forEach(th => {
    th.addEventListener("click", () => {
      const table = th.closest("table");
      const colIndex = parseInt(th.getAttribute("data-sort-index"));
      const type = th.getAttribute("data-type");
      sortTable(table, colIndex, type);
    });
  });
}

function sortTable(table, colIndex, type) {
  const tableId = table.id;
  table.querySelectorAll("th[data-type]").forEach(th => {
    const currentIndex = parseInt(th.getAttribute("data-sort-index"));
    if (currentIndex !== colIndex) {
      const icon = th.querySelector(".sort-icon i");
      if (icon) icon.className = "fas fa-sort";
    }
  });
  let sortState = tableSortStates[tableId] || { key: null, asc: true };
  let asc = sortState.key === colIndex ? !sortState.asc : true;
  tableSortStates[tableId] = { key: colIndex, asc: asc };

  const tbody = table.querySelector("tbody");
  const rows = Array.from(tbody.querySelectorAll("tr"));
  rows.sort((a, b) => {
    let cellA = a.cells[colIndex].innerText.trim();
    let cellB = b.cells[colIndex].innerText.trim();
    if (type === "number") {
      let numA = parseFloat(cellA) || 0;
      let numB = parseFloat(cellB) || 0;
      return asc ? numA - numB : numB - numA;
    } else if (type === "date") {
      let rawA = a.cells[colIndex].getAttribute("data-raw");
      let rawB = b.cells[colIndex].getAttribute("data-raw");
      let dateA = rawA ? new Date(rawA.replace(" ", "T")) : parseBrazilianDate(cellA);
      let dateB = rawB ? new Date(rawB.replace(" ", "T")) : parseBrazilianDate(cellB);
      return asc ? dateA - dateB : dateB - dateA;
    } else {
      return asc ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
    }
  });
  rows.forEach(row => tbody.appendChild(row));
  table.querySelectorAll("th[data-type]").forEach(th => {
    const thIndex = parseInt(th.getAttribute("data-sort-index"));
    const icon = th.querySelector(".sort-icon i");
    if (thIndex === colIndex) {
      icon.className = asc ? "fas fa-sort-up" : "fas fa-sort-down";
    } else {
      icon.className = "fas fa-sort";
    }
  });
}

/* =============================== */
/* FUNÇÕES DE MOVIMENTAÇÕES E RELATÓRIOS (Filtragem Client-Side) */
/* =============================== */

async function loadMovimentacoes(query = "") {
  try {
    const response = await fetch(`${API_URL.replace('/estoque', '')}/movimentacoes` + query);
    let movimentacoes = await response.json();
    if (query) {
      const params = new URLSearchParams(query);
      movimentacoes = movimentacoes.filter(item => {
        let match = true;
        for (let [key, value] of params.entries()) {
          value = value.toLowerCase();
          if (item[key] === null) { match = false; break; }
          if (key === "validade" || key === "data") {
            let itemDate = formatDateForInput(item[key]);
            if (itemDate !== value) { match = false; break; }
          } else if (typeof item[key] === "number") {
            if (item[key].toString() !== value) { match = false; break; }
          } else {
            if (!item[key].toLowerCase().includes(value)) { match = false; break; }
          }
        }
        return match;
      });
    }
    const movBody = document.getElementById("mov-body");
    movBody.innerHTML = "";
    movimentacoes.forEach(m => {
      // Para o campo "data", converte o formato "YYYY-MM-DD HH:MM:SS" para "YYYY-MM-DDTHH:MM:SS"
      const dateStr = new Date(m.data.replace(" ", "T")).toLocaleString();
      movBody.innerHTML += `
        <tr>
          <td>${m.id}</td>
          <td>${m.item}</td>
          <td>${m.nome}</td>
          <td>${m.marca}</td>
          <td>${m.categoria}</td>
          <td>${m.validade ? formatDateToDisplay(m.validade) : ""}</td>
          <td>${m.fornecedor}</td>
          <td>${m.quantidade_atual}</td>
          <td>${m.quantidade_anterior}</td>
          <td class="cell-date" data-raw="${m.data}">${dateStr}</td>
          <td>${m.observacao || ""}</td>
        </tr>
      `;
    });
  } catch (error) {
    console.error("Erro ao carregar movimentações:", error);
    document.getElementById("mov-body").innerHTML = `<tr><td colspan="11">Erro ao carregar movimentações.</td></tr>`;
  }
}

async function loadRelatorios(query = "") {
  try {
    const response = await fetch(`${API_URL.replace('/estoque', '')}/relatorios` + query);
    let relatorios = await response.json();
    if (query) {
      const params = new URLSearchParams(query);
      relatorios = relatorios.filter(item => {
        let match = true;
        for (let [key, value] of params.entries()) {
          value = value.toLowerCase();
          if (item[key] === null) { match = false; break; }
          if (key === "validade" || key === "data") {
            let itemDate = formatDateForInput(item[key]);
            if (itemDate !== value) { match = false; break; }
          } else if (typeof item[key] === "number") {
            if (item[key].toString() !== value) { match = false; break; }
          } else {
            if (!item[key].toLowerCase().includes(value)) { match = false; break; }
          }
        }
        return match;
      });
    }
    const reportsBody = document.getElementById("reports-body");
    reportsBody.innerHTML = "";
    relatorios.forEach(r => {
      const dateStr = new Date(r.data.replace(" ", "T")).toLocaleString();
      reportsBody.innerHTML += `
        <tr>
          <td>${r.id}</td>
          <td>${r.item}</td>
          <td>${r.nome}</td>
          <td>${r.marca}</td>
          <td>${r.categoria}</td>
          <td>${r.validade ? formatDateToDisplay(r.validade) : ""}</td>
          <td>${r.fornecedor}</td>
          <td>${r.quantidade_entrada}</td>
          <td>${r.quantidade_saida}</td>
          <td class="cell-date" data-raw="${r.data}">${dateStr}</td>
          <td>${r.observacao || ""}</td>
        </tr>
      `;
    });
  } catch (error) {
    console.error("Erro ao carregar relatórios:", error);
    document.getElementById("reports-body").innerHTML = `<tr><td colspan="11">Erro ao carregar relatórios.</td></tr>`;
  }
}

/* =============================== */
/* FUNÇÕES DE ALTERNÂNCIA DE VISÃO  */
/* =============================== */

function toggleMovView() {
  closeAllPanels();
  if (showingReports) {
    showingReports = false;
    document.getElementById("btn-reports").classList.remove("active");
    document.getElementById("reports-container").style.display = "none";
  }
  showingMov = !showingMov;
  const movBtn = document.getElementById("btn-mov");
  if (showingMov) {
    movBtn.classList.add("active");
    document.getElementById("items-container").style.display = "none";
    document.getElementById("mov-container").style.display = "block";
    loadMovimentacoes("");
  } else {
    movBtn.classList.remove("active");
    document.getElementById("mov-container").style.display = "none";
    document.getElementById("items-container").style.display = "block";
    loadItems("");
  }
}

function toggleRelView() {
  closeAllPanels();
  if (showingMov) {
    showingMov = false;
    document.getElementById("btn-mov").classList.remove("active");
    document.getElementById("mov-container").style.display = "none";
  }
  showingReports = !showingReports;
  const reportsBtn = document.getElementById("btn-reports");
  if (showingReports) {
    reportsBtn.classList.add("active");
    document.getElementById("items-container").style.display = "none";
    document.getElementById("reports-container").style.display = "block";
    loadRelatorios("");
  } else {
    reportsBtn.classList.remove("active");
    document.getElementById("reports-container").style.display = "none";
    document.getElementById("items-container").style.display = "block";
    loadItems("");
  }
}

function getScrollbarHeight() {
  const outer = document.createElement("div");
  outer.style.visibility = "hidden";
  outer.style.overflow = "scroll";
  outer.style.msOverflowStyle = "scrollbar";
  document.body.appendChild(outer);
  const inner = document.createElement("div");
  outer.appendChild(inner);
  const scrollbarHeight = outer.offsetHeight - inner.offsetHeight;
  outer.parentNode.removeChild(outer);
  return scrollbarHeight;
}

function adjustPanelActionsMargin() {
  const scrollbarHeight = getScrollbarHeight();
  document.querySelectorAll('.panel').forEach(panel => {
    const panelActions = panel.querySelector('.panel-actions');
    if (panel.scrollWidth > panel.clientWidth) {
      panelActions.style.marginTop = scrollbarHeight + 'px';
    } else {
      panelActions.style.marginTop = '0';
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  applySortingListeners();
  loadItems("");
  adjustPanelActionsMargin();
});

window.addEventListener("resize", () => {
  adjustHeading();
  adjustPanelActionsMargin();
});

function adjustHeading() {
  const container = document.getElementById("main-container");
  const heading = container.querySelector("h2");
  const containerWidth = container.clientWidth;
  const span = document.createElement("span");
  span.style.visibility = "hidden";
  span.style.whiteSpace = "nowrap";
  const computedStyle = window.getComputedStyle(heading);
  span.style.fontFamily = computedStyle.fontFamily;
  span.style.fontWeight = computedStyle.fontWeight;
  span.style.letterSpacing = computedStyle.letterSpacing;
  span.innerText = heading.innerText;
  document.body.appendChild(span);
  let low = 10,
    high = 1000,
    bestSize = low;
  for (let i = 0; i < 20; i++) {
    let mid = (low + high) / 2;
    span.style.fontSize = mid + "px";
    if (span.offsetWidth > containerWidth) {
      high = mid;
    } else {
      low = mid;
      bestSize = mid;
    }
  }
  heading.style.fontSize = bestSize * 0.95 + "px";
  document.body.removeChild(span);
}