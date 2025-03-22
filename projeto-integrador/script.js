const API_URL = "http://localhost:3000/estoque";

let filterActive = false;
let showingMov = false;
let showingRel = false;
let editingItemId = null;
let sortDirections = {}; // Guarda a direção de ordenação para cada tabela/coluna

// Formatação de datas
function formatDateToDisplay(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date)) return "";
  const day = ("0" + date.getDate()).slice(-2);
  const month = ("0" + (date.getMonth() + 1)).slice(-2);
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatDateForInput(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date)) return "";
  const yyyy = date.getFullYear();
  const mm = ("0" + (date.getMonth() + 1)).slice(-2);
  const dd = ("0" + date.getDate()).slice(-2);
  return `${yyyy}-${mm}-${dd}`;
}

// Converte "DD/MM/YYYY" para objeto Date
function parseBrazilianDate(dateStr) {
  const parts = dateStr.split("/");
  if (parts.length !== 3) return new Date(dateStr);
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  return new Date(year, month, day);
}

function getExpirationClass(dateStr) {
  if (!dateStr) return "";
  const today = new Date();
  const expDate = new Date(dateStr);
  const diff = expDate - today;
  const oneDay = 24 * 60 * 60 * 1000;
  return diff <= 7 * oneDay ? "expiring" : "";
}

// Carrega os itens (tabela de itens via servidor)
async function loadItems(query = "") {
  try {
    const response = await fetch(API_URL + query);
    const items = await response.json();
    const table = document.getElementById("itemTable");
    table.innerHTML = "";
    items.forEach(item => {
      const formattedValidade = formatDateToDisplay(item.validade);
      const expClass = getExpirationClass(item.validade);
      const row = `<tr data-id="${item.id}">
          <td><input type="checkbox" class="row-checkbox" data-id="${item.id}"></td>
          <td class="cell-codigo_item">${item.codigo_item}</td>
          <td class="cell-name">${item.name}</td>
          <td class="cell-brand">${item.brand}</td>
          <td class="cell-category">${item.category}</td>
          <td class="cell-fornecedor">${item.fornecedor || ""}</td>
          <td class="cell-validade ${expClass}" data-raw="${item.validade || ''}">${formattedValidade}</td>
          <td class="cell-quantity">${item.quantity}</td>
        </tr>`;
      table.innerHTML += row;
    });
    applySortingListeners();
  } catch (error) {
    console.error("Erro ao carregar itens:", error);
  }
}

/* Filtro Dinâmico: Configurações para cada tabela */
function getActiveTableType() {
  if (document.getElementById("itemsContainer").style.display !== "none") {
    return "items";
  } else if (document.getElementById("movContainer").style.display !== "none") {
    return "movimentacoes";
  } else if (document.getElementById("relContainer").style.display !== "none") {
    return "relatorios";
  }
  return "items";
}

const filterConfigurations = {
  items: {
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
  const tableType = getActiveTableType();
  const config = filterConfigurations[tableType];
  let html = `<div class="edit-header">`;
  config.columns.forEach((col, index) => {
    html += `<div class="edit-cell" data-type="${col.type}" data-sort-index="${index + 1}">${col.header} <span class="sort-icon"><i class="fas fa-sort"></i></span></div>`;
  });
  html += `</div><div class="edit-row">`;
  config.columns.forEach((col) => {
    let inputType = col.type === "date" ? "date" : (col.type === "number" ? "number" : "text");
    html += `<div class="edit-cell"><input type="${inputType}" id="filter_${col.field}" placeholder="${col.header}" /></div>`;
  });
  html += `</div>
  <div class="edit-buttons">
    <i class="fas fa-check save-icon" title="Aplicar Filtro" onclick="applyFilterPanel()"></i>
    <i class="fas fa-times cancel-icon" title="Cancelar Filtro" onclick="closeFilterPanelAndClearAndResetItems()"></i>
  </div>`;
  document.getElementById("filterPanel").innerHTML = html;
}

function openFilterPanel() {
  // Sempre que abrir o painel de filtro, limpar se estiver ativo
  if (filterActive) {
    closeFilterPanelAndClearAndResetItems();
  } else {
    updateFilterPanel();
    document.getElementById("filterPanel").style.display = "table";
  }
}

function closeFilterPanel() {
  document.getElementById("filterPanel").style.display = "none";
  const tableType = getActiveTableType();
  const config = filterConfigurations[tableType];
  config.columns.forEach(col => {
    document.getElementById("filter_" + col.field).value = "";
  });
}

function closeFilterPanelAndClearAndResetItems() {
  closeFilterPanel();
  filterActive = false;
  document.getElementById("filterIconAction").classList.remove("active");
  // Ao limpar filtro, recarregar a tabela de itens completa
  loadItems("");
}

function applyFilterPanel() {
  const tableType = getActiveTableType();
  const config = filterConfigurations[tableType];
  let queryParams = [];
  config.columns.forEach(col => {
    const value = document.getElementById("filter_" + col.field).value;
    if (value) {
      queryParams.push(`${col.field}=${encodeURIComponent(value)}`);
    }
  });
  const queryString = queryParams.length > 0 ? "?" + queryParams.join("&") : "";
  filterActive = true;
  document.getElementById("filterIconAction").classList.add("active");
  closeFilterPanel();
  loadAppropriateTable(queryString);
}

function loadAppropriateTable(query = "") {
  const tableType = getActiveTableType();
  if (tableType === "items") {
    loadItems(query);
  } else if (tableType === "movimentacoes") {
    loadMovimentacoes(query);
  } else if (tableType === "relatorios") {
    loadRelatorios(query);
  }
}

/* Painel de Adicionar Item */
function openAddPanel() {
  if (filterActive) { closeFilterPanelAndClearAndResetItems(); }
  document.getElementById("addPanel").style.display = "table";
}
function closeAddPanel() {
  document.getElementById("addPanel").style.display = "none";
  document.getElementById("addItemCode").value = "";
  document.getElementById("addItemName").value = "";
  document.getElementById("addItemBrand").value = "";
  document.getElementById("addItemCategory").value = "";
  document.getElementById("addItemSupplier").value = "";
  document.getElementById("addItemValidity").value = "";
  document.getElementById("addItemQuantity").value = "";
}
async function addItemPanel() {
  const codigo_item = document.getElementById("addItemCode").value;
  const name = document.getElementById("addItemName").value;
  const brand = document.getElementById("addItemBrand").value;
  const category = document.getElementById("addItemCategory").value;
  const supplier = document.getElementById("addItemSupplier").value;
  const validade = document.getElementById("addItemValidity").value;
  const quantity = document.getElementById("addItemQuantity").value;
  if (!codigo_item || !name || !brand || !category || !supplier || !validade || !quantity) {
    console.log("Preencha todos os campos no painel de adicionar item!");
    return;
  }
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo_item, name, brand, category, fornecedor: supplier, validade, quantity })
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

/* Painel de Edição */
function editSelectedItem() {
  document.querySelectorAll("tr.editing").forEach(row => row.classList.remove("editing"));
  const checkboxes = document.querySelectorAll(".row-checkbox:checked");
  if (checkboxes.length === 0) {
    alert("Nenhum item selecionado para edição.");
    return;
  }
  if (checkboxes.length > 1) {
    alert("Por favor, selecione apenas um item para edição.");
    return;
  }
  const checkbox = checkboxes[0];
  const row = checkbox.closest("tr");
  row.classList.add("editing");
  editingItemId = row.getAttribute("data-id");
  const codigo = row.querySelector(".cell-codigo_item").innerText;
  const name = row.querySelector(".cell-name").innerText;
  const brand = row.querySelector(".cell-brand").innerText;
  const category = row.querySelector(".cell-category").innerText;
  const supplier = row.querySelector(".cell-fornecedor").innerText;
  const validadeRaw = row.querySelector(".cell-validade").getAttribute("data-raw");
  const validade = formatDateForInput(validadeRaw);
  const quantity = row.querySelector(".cell-quantity").innerText;
  document.getElementById("editItemCode").value = codigo;
  document.getElementById("editItemName").value = name;
  document.getElementById("editItemBrand").value = brand;
  document.getElementById("editItemCategory").value = category;
  document.getElementById("editItemSupplier").value = supplier;
  document.getElementById("editItemValidity").value = validade;
  document.getElementById("editItemQuantity").value = quantity;
  if (filterActive) { closeFilterPanelAndClearAndResetItems(); }
  // Adiciona estilo ativo ao ícone de edição
  document.getElementById("editIcon").classList.add("active");
  document.getElementById("editPanel").style.display = "table";
}

async function saveEdit() {
  if (!editingItemId) {
    alert("Nenhum item em edição.");
    return;
  }
  const codigo_item = document.getElementById("editItemCode").value;
  const name = document.getElementById("editItemName").value;
  const brand = document.getElementById("editItemBrand").value;
  const category = document.getElementById("editItemCategory").value;
  const supplier = document.getElementById("editItemSupplier").value;
  const validade = document.getElementById("editItemValidity").value;
  const quantity = document.getElementById("editItemQuantity").value;
  if (!codigo_item || !name || !brand || !category || !supplier || !validade || !quantity) {
    alert("Preencha todos os campos para edição.");
    return;
  }
  try {
    const response = await fetch(`${API_URL}/${editingItemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo_item, name, brand, category, fornecedor: supplier, validade, quantity })
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
  document.getElementById("editPanel").style.display = "none";
  document.querySelectorAll("tr.editing").forEach(row => row.classList.remove("editing"));
  // Remove o estilo ativo do ícone de edição
  document.getElementById("editIcon").classList.remove("active");
}

/* Excluir Itens Selecionados */
async function deleteSelectedItems() {
  const checkboxes = document.querySelectorAll(".row-checkbox:checked");
  if (checkboxes.length === 0) {
    alert("Nenhum item selecionado para exclusão.");
    return;
  }
  if (!confirm("A ação irá excluir os itens selecionados. Deseja continuar?")) return;
  const deletePromises = [];
  checkboxes.forEach(checkbox => {
    const id = checkbox.getAttribute("data-id");
    deletePromises.push(fetch(`${API_URL}/${id}`, { method: "DELETE" }));
  });
  try {
    await Promise.all(deletePromises);
    console.log("Itens excluídos com sucesso!");
    loadItems("");
  } catch (error) {
    console.error("Erro ao excluir itens:", error);
  }
}

function toggleSelectAll(masterCheckbox) {
  const checkboxes = document.querySelectorAll(".row-checkbox");
  checkboxes.forEach(checkbox => { checkbox.checked = masterCheckbox.checked; });
}

/* Ordenação de Tabelas */
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
  const tbody = table.querySelector("tbody");
  const rows = Array.from(tbody.querySelectorAll("tr"));
  const key = table.id + "_" + colIndex;
  let asc = true;
  if (sortDirections[key] !== undefined) {
    asc = !sortDirections[key];
  }
  sortDirections[key] = asc;
  rows.sort((a, b) => {
    let cellA = a.cells[colIndex].innerText.trim();
    let cellB = b.cells[colIndex].innerText.trim();
    if (type === "number") {
      let numA = parseFloat(cellA) || 0;
      let numB = parseFloat(cellB) || 0;
      return asc ? numA - numB : numB - numA;
    } else if (type === "date") {
      let dateA = parseBrazilianDate(cellA);
      let dateB = parseBrazilianDate(cellB);
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

/* Filtragem Client-Side para Movimentações */
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
    const movTable = document.getElementById("movTable");
    movTable.innerHTML = "";
    movimentacoes.forEach(m => {
      const dateStr = new Date(m.data).toLocaleString();
      movTable.innerHTML += `<tr>
         <td>${m.id}</td>
         <td>${m.item}</td>
         <td>${m.nome}</td>
         <td>${m.marca}</td>
         <td>${m.categoria}</td>
         <td>${m.validade ? formatDateToDisplay(m.validade) : ""}</td>
         <td>${m.fornecedor}</td>
         <td>${m.quantidade_atual}</td>
         <td>${m.quantidade_anterior}</td>
         <td>${dateStr}</td>
         <td>${m.observacao || ""}</td>
      </tr>`;
    });
    applySortingListeners();
  } catch (error) {
    console.error("Erro ao carregar movimentações:", error);
    document.getElementById("movTable").innerHTML = `<tr><td colspan="11">Erro ao carregar movimentações.</td></tr>`;
  }
}

/* Filtragem Client-Side para Relatórios */
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
    const relTable = document.getElementById("relTable");
    relTable.innerHTML = "";
    relatorios.forEach(r => {
      const dateStr = new Date(r.data).toLocaleString();
      relTable.innerHTML += `<tr>
          <td>${r.id}</td>
          <td>${r.item}</td>
          <td>${r.nome}</td>
          <td>${r.marca}</td>
          <td>${r.categoria}</td>
          <td>${r.validade ? formatDateToDisplay(r.validade) : ""}</td>
          <td>${r.fornecedor}</td>
          <td>${r.quantidade_entrada}</td>
          <td>${r.quantidade_saida}</td>
          <td>${dateStr}</td>
          <td>${r.observacao || ""}</td>
        </tr>`;
    });
    applySortingListeners();
  } catch (error) {
    console.error("Erro ao carregar relatórios:", error);
    document.getElementById("relTable").innerHTML = `<tr><td colspan="11">Erro ao carregar relatórios.</td></tr>`;
  }
}

function loadAppropriateTable(query = "") {
  const tableType = getActiveTableType();
  if (tableType === "items") {
    loadItems(query);
  } else if (tableType === "movimentacoes") {
    loadMovimentacoes(query);
  } else if (tableType === "relatorios") {
    loadRelatorios(query);
  }
}

/* Alterna a visualização para Movimentações */
function toggleMovView() {
  // Limpa filtro sempre que alternar de tabela
  if (filterActive) { closeFilterPanelAndClearAndResetItems(); }
  if (showingRel) {
    showingRel = false;
    document.getElementById("relIconAction").classList.remove("active");
    document.getElementById("relContainer").style.display = "none";
  }
  showingMov = !showingMov;
  const movIcon = document.getElementById("movIconAction");
  if (showingMov) {
    movIcon.classList.add("active");
    document.getElementById("itemsContainer").style.display = "none";
    document.getElementById("movContainer").style.display = "block";
    loadMovimentacoes("");
  } else {
    movIcon.classList.remove("active");
    document.getElementById("movContainer").style.display = "none";
    document.getElementById("itemsContainer").style.display = "block";
    loadItems("");
  }
}

/* Alterna a visualização para Relatórios */
function toggleRelView() {
  // Limpa filtro sempre que alternar de tabela
  if (filterActive) { closeFilterPanelAndClearAndResetItems(); }
  if (showingMov) {
    showingMov = false;
    document.getElementById("movIconAction").classList.remove("active");
    document.getElementById("movContainer").style.display = "none";
  }
  showingRel = !showingRel;
  const relIcon = document.getElementById("relIconAction");
  if (showingRel) {
    relIcon.classList.add("active");
    document.getElementById("itemsContainer").style.display = "none";
    document.getElementById("relContainer").style.display = "block";
    loadRelatorios("");
  } else {
    relIcon.classList.remove("active");
    document.getElementById("relContainer").style.display = "none";
    document.getElementById("itemsContainer").style.display = "block";
    loadItems("");
  }
}

/* Ordenação de Tabelas */
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
  const tbody = table.querySelector("tbody");
  const rows = Array.from(tbody.querySelectorAll("tr"));
  const key = table.id + "_" + colIndex;
  let asc = true;
  if (sortDirections[key] !== undefined) {
    asc = !sortDirections[key];
  }
  sortDirections[key] = asc;
  rows.sort((a, b) => {
    let cellA = a.cells[colIndex].innerText.trim();
    let cellB = b.cells[colIndex].innerText.trim();
    if (type === "number") {
      let numA = parseFloat(cellA) || 0;
      let numB = parseFloat(cellB) || 0;
      return asc ? numA - numB : numB - numA;
    } else if (type === "date") {
      let dateA = parseBrazilianDate(cellA);
      let dateB = parseBrazilianDate(cellB);
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

document.addEventListener("DOMContentLoaded", () => {
  loadItems("");
});