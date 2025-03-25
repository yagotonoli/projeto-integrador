const API_URL = "http://localhost:3000/estoque";

let filterActive = false;
let showingMov = false;
let showingRel = false;
let editingItemId = null;
// Armazena o estado de ordenação para cada tabela (chave: table.id)
let tableSortStates = {};

/* Função para fechar todos os painéis e limpar seleções */
function closeAllPanels() {
  closeFilterPanel();
  closeAddPanel();
  cancelEdit();
  const checkboxes = document.querySelectorAll(".row-checkbox");
  checkboxes.forEach(cb => {
    cb.checked = false;
    const row = cb.closest("tr");
    if (row) row.classList.remove("selected");
  });
}

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

// Converte "DD/MM/YYYY" para Date (retorna data mínima se inválido)
function parseBrazilianDate(dateStr) {
  const parts = dateStr.split("/");
  if (parts.length !== 3) return new Date(0);
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  const parsed = new Date(year, month, day);
  return isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

/* Destaca itens com validade em até 20 dias a partir de hoje */
function getExpirationClass(dateStr) {
  if (!dateStr) return "";
  const today = new Date();
  const expDate = new Date(dateStr);
  const diff = expDate - today;
  const oneDay = 24 * 60 * 60 * 1000;
  const threshold = 20 * oneDay;
  return diff <= threshold ? "expiring" : "";
}

// Anexa listener para que, ao marcar um checkbox, a linha inteira receba a classe "selected"
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

// Carrega os itens (tabela de itens)
async function loadItems(query = "") {
  try {
    const response = await fetch(API_URL + query);
    const itens = await response.json();
    const table = document.getElementById("itemTable");
    table.innerHTML = "";
    itens.forEach(item => {
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
    attachRowSelectionListeners();
  } catch (error) {
    console.error("Erro ao carregar itens:", error);
  }
}

/* Retorna o tipo de tabela ativa */
function getActiveTableType() {
  if (document.getElementById("itemsContainer").style.display !== "none") {
    return "itens";
  } else if (document.getElementById("movContainer").style.display !== "none") {
    return "movimentacoes";
  } else if (document.getElementById("relContainer").style.display !== "none") {
    return "relatorios";
  }
  return "itens";
}

/* Configuração dos campos para cada tabela */
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

/* Atualiza o painel de filtro dinamicamente conforme a tabela ativa */
function updateFilterPanel() {
  const type = getActiveTableType();
  const config = filterConfigurations[type];
  let titleText = type === "itens" ? "Itens" : type === "movimentacoes" ? "Movimentações" : "Relatórios";
  let html = `<div class="panel-title">Filtrar ${titleText}</div>`;
  html += '<div class="edit-header">';
  config.columns.forEach(col => {
    html += `<div class="edit-cell">${col.header}</div>`;
  });
  html += '</div><div class="edit-row">';
  config.columns.forEach(col => {
    let inputType = col.type === "date" ? "date" : (col.type === "number" ? "number" : "text");
    html += `<div class="edit-cell"><input type="${inputType}" id="filter_${col.field}" placeholder="${col.header}" /></div>`;
  });
  html += '</div><div class="edit-buttons">';
  html += `<i class="fas fa-check save-icon" title="Aplicar Filtro" onclick="applyFilterPanel()"></i>`;
  html += `<i class="fas fa-times cancel-icon" title="Cancelar Filtro" onclick="toggleFilterPanel()"></i>`;
  html += '</div>';
  document.getElementById("filterPanel").innerHTML = html;
}

/* Toggle para o painel de filtro:
   - Se o filtro não estiver ativo, abre o painel, mantém o ícone ativo.
   - Se já estiver ativo, fecha e limpa o filtro.
*/
function toggleFilterPanel() {
  if (filterActive) {
    closeFilterPanel();
    loadAppropriateTable(""); // Limpa os filtros
  } else {
    closeAllPanels();
    updateFilterPanel();
    document.getElementById("filterPanel").style.display = "table";
    document.getElementById("filterIconAction").classList.add("active");
    filterActive = true;
  }
}

/* Fecha o painel de filtro */
function closeFilterPanel() {
  document.getElementById("filterPanel").style.display = "none";
  document.getElementById("filterIconAction").classList.remove("active");
  filterActive = false;
}

/* Aplica filtro sem fechar o painel, mantendo o ícone ativo */
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
  // Mantém o painel e o ícone ativo após aplicar o filtro
}

/* Ao trocar de tabela, fecha todos os painéis e limpa seleções */
function closeAllPanels() {
  closeFilterPanel();
  closeAddPanel();
  cancelEdit();
  const checkboxes = document.querySelectorAll(".row-checkbox");
  checkboxes.forEach(cb => {
    cb.checked = false;
    const row = cb.closest("tr");
    if (row) row.classList.remove("selected");
  });
}

/* Carrega a tabela ativa */
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

/* Painel de Adicionar Item */
function openAddPanel() {
  if (getActiveTableType() !== "itens") {
    alert("A adição de itens está disponível somente para a tabela de itens.");
    return;
  }
  closeAllPanels();
  document.getElementById("addPanel").style.display = "table";
  document.getElementById("addIconAction").classList.add("active");
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
  document.getElementById("addIconAction").classList.remove("active");
}
async function addItemPanel() {
  if (getActiveTableType() !== "itens") {
    alert("A adição de itens está disponível somente para a tabela de itens.");
    return;
  }
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
  document.getElementById("editIcon").classList.remove("active");
}

/* Exclusão: função ajustada para verificar sucesso de cada exclusão */
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
    const results = await Promise.all(deletePromises);
    console.log("Itens excluídos com sucesso!", results);
    loadItems("");
  } catch (error) {
    console.error("Erro ao excluir itens:", error);
    alert("Ocorreu um erro ao excluir itens.");
  }
}

/* Ordenação das Tabelas – configurada uma única vez para cada header */
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
  let asc = (sortState.key === colIndex) ? !sortState.asc : true;
  tableSortStates[tableId] = { key: colIndex, asc: asc };

  const tbody = table.querySelector("tbody");
  const rows = Array.from(tbody.querySelectorAll("tr"));
  rows.sort((a, b) => {
    let cellAElement = a.cells[colIndex];
    let cellBElement = b.cells[colIndex];
    let cellA = cellAElement.innerText.trim();
    let cellB = cellBElement.innerText.trim();
    if (type === "number") {
      let numA = parseFloat(cellA) || 0;
      let numB = parseFloat(cellB) || 0;
      return asc ? numA - numB : numB - numA;
    } else if (type === "date") {
      let rawA = cellAElement.getAttribute("data-raw");
      let rawB = cellBElement.getAttribute("data-raw");
      let dateA, dateB;
      if (rawA && rawB) {
        dateA = new Date(rawA);
        dateB = new Date(rawB);
      } else {
        dateA = parseBrazilianDate(cellA);
        dateB = parseBrazilianDate(cellB);
      }
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
         <td class="cell-date" data-raw="${m.data}">${dateStr}</td>
         <td>${m.observacao || ""}</td>
      </tr>`;
    });
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
          <td class="cell-date" data-raw="${r.data}">${dateStr}</td>
          <td>${r.observacao || ""}</td>
        </tr>`;
    });
  } catch (error) {
    console.error("Erro ao carregar relatórios:", error);
    document.getElementById("relTable").innerHTML = `<tr><td colspan="11">Erro ao carregar relatórios.</td></tr>`;
  }
}

function toggleMovView() {
  closeAllPanels();
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

function toggleRelView() {
  closeAllPanels();
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

/* Painel de Edição */
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
  document.getElementById("editIcon").classList.remove("active");
}

// Configura os event listeners para ordenação apenas uma vez na carga inicial
document.addEventListener("DOMContentLoaded", () => {
  applySortingListeners();
  loadItems("");
});