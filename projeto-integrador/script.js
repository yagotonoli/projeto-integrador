const API_URL = "http://localhost:3000/estoque";

let filterActive = false;
let isEditing = false;
let showingMov = false;
let showingRel = false;

// Formata a data para "DD/MM/AAAA"
function formatDateToDisplay(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date)) return "";
  const day = ("0" + date.getDate()).slice(-2);
  const month = ("0" + (date.getMonth() + 1)).slice(-2);
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Formata o lote para exibir somente números
function formatLot(lotStr) {
  if (!lotStr) return "";
  return lotStr.toString().replace(/\D/g, "");
}

// Converte a data para o formato "yyyy-mm-dd" (para input type="date")
function formatDateForInput(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date)) return "";
  const yyyy = date.getFullYear();
  const mm = ("0" + (date.getMonth() + 1)).slice(-2);
  const dd = ("0" + date.getDate()).slice(-2);
  return `${yyyy}-${mm}-${dd}`;
}

// Retorna a classe para expiração
function getExpirationClass(dateStr) {
  if (!dateStr) return "";
  const today = new Date();
  const expDate = new Date(dateStr);
  const diff = expDate - today;
  const oneDay = 24 * 60 * 60 * 1000;
  return diff <= 7 * oneDay ? "expiring" : "";
}

// Carrega os itens e preenche a tabela de itens
async function loadItems(query = "") {
  try {
    const response = await fetch(API_URL + query);
    const items = await response.json();
    const table = document.getElementById("itemTable");
    table.innerHTML = "";
    items.forEach(item => {
      const formattedValidade = formatDateToDisplay(item.validade);
      const formattedLot = formatLot(item.lot);
      const expClass = getExpirationClass(item.validade);
      const row = `<tr data-id="${item.id}">
          <td class="cell-codigo_item">${item.codigo_item}</td>
          <td class="cell-name">${item.name}</td>
          <td class="cell-brand">${item.brand}</td>
          <td class="cell-category">${item.category}</td>
          <td class="cell-quantity">${item.quantity}</td>
          <td class="cell-lot">${formattedLot}</td>
          <td class="cell-validade ${expClass}" data-raw="${item.validade || ''}">${formattedValidade}</td>
          <td class="cell-fornecedor">${item.fornecedor || ""}</td>
          <td>
            <input type="checkbox" class="row-checkbox" data-id="${item.id}">
          </td>
        </tr>`;
      table.innerHTML += row;
    });
  } catch (error) {
    console.error("Erro ao carregar itens:", error);
  }
}

/* Funções de Filtro */
function openFilterModal() {
  document.getElementById("modalFilter").style.display = "block";
}
function closeFilterModal() {
  document.getElementById("modalFilter").style.display = "none";
  document.getElementById("filterCodigo").value = "";
  document.getElementById("filterName").value = "";
  document.getElementById("filterBrand").value = "";
  document.getElementById("filterCategory").value = "";
  document.getElementById("filterQuantity").value = "";
  document.getElementById("filterLot").value = "";
  document.getElementById("filterValidity").value = "";
  document.getElementById("filterSupplier").value = "";
}
function applyFilter() {
  const codigo = document.getElementById("filterCodigo").value;
  const name = document.getElementById("filterName").value;
  const brand = document.getElementById("filterBrand").value;
  const category = document.getElementById("filterCategory").value;
  const quantity = document.getElementById("filterQuantity").value;
  const lot = document.getElementById("filterLot").value;
  const validity = document.getElementById("filterValidity").value;
  const supplier = document.getElementById("filterSupplier").value;
  let queryParams = [];
  if (codigo) queryParams.push(`codigo_item=${encodeURIComponent(codigo)}`);
  if (name) queryParams.push(`name=${encodeURIComponent(name)}`);
  if (brand) queryParams.push(`brand=${encodeURIComponent(brand)}`);
  if (category) queryParams.push(`category=${encodeURIComponent(category)}`);
  if (quantity) queryParams.push(`quantity=${encodeURIComponent(quantity)}`);
  if (lot) queryParams.push(`lot=${encodeURIComponent(lot)}`);
  if (validity) queryParams.push(`validade=${encodeURIComponent(validity)}`);
  if (supplier) queryParams.push(`fornecedor=${encodeURIComponent(supplier)}`);
  const queryString = queryParams.length > 0 ? "?" + queryParams.join("&") : "";
  closeFilterModal();
  filterActive = true;
  document.getElementById("filterIconAction").classList.add("active");
  loadItems(queryString);
}
function toggleFilter() {
  const filterIconEl = document.getElementById("filterIconAction");
  if (filterActive) {
    filterActive = false;
    filterIconEl.classList.remove("active");
    closeFilterModal();
    loadItems();
  } else {
    openFilterModal();
  }
}

/* Modal: Adicionar Item */
function openModal() {
  document.getElementById("modalAdd").style.display = "block";
}
function closeModal() {
  document.getElementById("modalAdd").style.display = "none";
  document.getElementById("modalItemCode").value = "";
  document.getElementById("modalItemName").value = "";
  document.getElementById("modalItemBrand").value = "";
  document.getElementById("modalItemCategory").value = "";
  document.getElementById("modalItemQuantity").value = "";
  document.getElementById("modalItemLot").value = "";
  document.getElementById("modalItemValidity").value = "";
  document.getElementById("modalItemSupplier").value = "";
}
async function addItemModal() {
  const codigo_item = document.getElementById("modalItemCode").value;
  const name = document.getElementById("modalItemName").value;
  const brand = document.getElementById("modalItemBrand").value;
  const category = document.getElementById("modalItemCategory").value;
  const quantity = document.getElementById("modalItemQuantity").value;
  const lot = formatLot(document.getElementById("modalItemLot").value);
  const validade = document.getElementById("modalItemValidity").value;
  const fornecedor = document.getElementById("modalItemSupplier").value;
  if (!codigo_item || !name || !brand || !category || !quantity || !lot || !validade || !fornecedor) {
    console.log("Preencha todos os campos no modal!");
    return;
  }
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo_item, name, brand, category, quantity, lot, validade, fornecedor })
    });
    if (response.ok) {
      console.log("Item adicionado/atualizado com sucesso!");
      loadItems();
      closeModal();
    } else {
      console.error("Erro ao adicionar/atualizar item. Status:", response.status);
    }
  } catch (error) {
    console.error("Erro na requisição:", error);
  }
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
    loadItems();
  } catch (error) {
    console.error("Erro ao excluir itens:", error);
  }
}
function toggleSelectAll(masterCheckbox) {
  const checkboxes = document.querySelectorAll(".row-checkbox");
  checkboxes.forEach(checkbox => { checkbox.checked = masterCheckbox.checked; });
}

/* Edição dos Itens Selecionados */
function editSelectedItems() {
  const checkboxes = document.querySelectorAll(".row-checkbox:checked");
  if (checkboxes.length === 0) {
    alert("Nenhum item selecionado para edição.");
    return;
  }
  if (!isEditing) {
    isEditing = true;
    document.getElementById("editIcon").classList.add("active");
    document.getElementById("editIcon").title = "Salvar Itens Editados";
    checkboxes.forEach(checkbox => {
      const row = checkbox.closest("tr");
      row.querySelector(".cell-codigo_item").innerHTML = `<input type="text" class="edit-input" value="${row.querySelector(".cell-codigo_item").innerText}" />`;
      row.querySelector(".cell-name").innerHTML = `<input type="text" class="edit-input" value="${row.querySelector(".cell-name").innerText}" />`;
      row.querySelector(".cell-brand").innerHTML = `<input type="text" class="edit-input" value="${row.querySelector(".cell-brand").innerText}" />`;
      row.querySelector(".cell-category").innerHTML = `<input type="text" class="edit-input" value="${row.querySelector(".cell-category").innerText}" />`;
      row.querySelector(".cell-quantity").innerHTML = `<input type="number" class="edit-input" value="${row.querySelector(".cell-quantity").innerText}" />`;
      row.querySelector(".cell-lot").innerHTML = `<input type="text" class="edit-input" value="${row.querySelector(".cell-lot").innerText}" />`;
      row.querySelector(".cell-validade").innerHTML = `<input type="date" class="edit-input" value="${formatDateForInput(row.querySelector(".cell-validade").getAttribute('data-raw'))}" />`;
      row.querySelector(".cell-fornecedor").innerHTML = `<input type="text" class="edit-input" value="${row.querySelector(".cell-fornecedor").innerText}" />`;
    });
  } else {
    isEditing = false;
    document.getElementById("editIcon").classList.remove("active");
    document.getElementById("editIcon").title = "Editar Itens Selecionados";
    const updatePromises = [];
    checkboxes.forEach(checkbox => {
      const row = checkbox.closest("tr");
      const id = row.getAttribute("data-id");
      const newCodigo = row.querySelector(".cell-codigo_item input").value.trim();
      const newName = row.querySelector(".cell-name input").value.trim();
      const newBrand = row.querySelector(".cell-brand input").value.trim();
      const newCategory = row.querySelector(".cell-category input").value.trim();
      const newQuantityVal = row.querySelector(".cell-quantity input").value.trim();
      const newQuantity = newQuantityVal === "" ? "" : parseInt(newQuantityVal);
      const newLot = row.querySelector(".cell-lot input").value.trim();
      const newValidade = row.querySelector(".cell-validade input").value.trim();
      const newFornecedor = row.querySelector(".cell-fornecedor input").value.trim();
      const payload = {
        codigo_item: newCodigo,
        name: newName,
        brand: newBrand,
        category: newCategory,
        quantity: newQuantity,
        lot: newLot,
        validade: newValidade === "" ? null : newValidade,
        fornecedor: newFornecedor
      };
      updatePromises.push(
        fetch(`${API_URL}/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }).then(response => response.json()).catch(err => console.error(err))
      );
    });
    Promise.all(updatePromises)
      .then(results => {
        console.log("Itens atualizados com sucesso!", results);
        loadItems();
      })
      .catch(error => console.error("Erro ao atualizar itens:", error));
  }
}

/* Alterna a visualização para Movimentações */
function toggleMovView() {
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
    loadMovimentacoes();
  } else {
    movIcon.classList.remove("active");
    document.getElementById("movContainer").style.display = "none";
    document.getElementById("itemsContainer").style.display = "block";
  }
}

/* Alterna a visualização para Relatórios */
function toggleRelView() {
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
    loadRelatorios();
  } else {
    relIcon.classList.remove("active");
    document.getElementById("relContainer").style.display = "none";
    document.getElementById("itemsContainer").style.display = "block";
  }
}

/* Carrega as movimentações e preenche a tabela de Movimentações */
async function loadMovimentacoes() {
  try {
    const response = await fetch(`${API_URL.replace('/estoque', '')}/movimentacoes`);
    const movimentacoes = await response.json();
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
         <td>${m.lote}</td>
         <td>${m.validade ? formatDateToDisplay(m.validade) : ""}</td>
         <td>${m.fornecedor}</td>
         <td>${m.quantidade_atual}</td>
         <td>${m.quantidade_anterior}</td>
         <td>${dateStr}</td>
         <td>${m.observacao || ""}</td>
      </tr>`;
    });
  } catch (error) {
    console.error("Erro ao carregar movimentações:", error);
    document.getElementById("movTable").innerHTML = `<tr><td colspan="12">Erro ao carregar movimentações.</td></tr>`;
  }
}

/* Carrega os relatórios e preenche a tabela de Relatórios */
async function loadRelatorios() {
  try {
    const response = await fetch(`${API_URL.replace('/estoque', '')}/relatorios`);
    const relatorios = await response.json();
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
          <td>${r.lote}</td>
          <td>${r.validade ? formatDateToDisplay(r.validade) : ""}</td>
          <td>${r.fornecedor}</td>
          <td>${r.quantidade_entrada}</td>
          <td>${r.quantidade_saida}</td>
          <td>${dateStr}</td>
          <td>${r.observacao || ""}</td>
        </tr>`;
    });
  } catch (error) {
    console.error("Erro ao carregar relatórios:", error);
    document.getElementById("relTable").innerHTML = `<tr><td colspan="12">Erro ao carregar relatórios.</td></tr>`;
  }
}

/* Modal: Registrar Consumo de Receita */
function openConsumoModal() {
  document.getElementById("modalConsumo").style.display = "block";
}
function closeConsumoModal() {
  document.getElementById("modalConsumo").style.display = "none";
  document.getElementById("consumoReceitaNome").value = "";
  document.getElementById("consumoIngredientes").value = "";
}
async function registerConsumo() {
  const receita_nome = document.getElementById("consumoReceitaNome").value;
  const ingredientesStr = document.getElementById("consumoIngredientes").value;
  if (!receita_nome || !ingredientesStr) {
    alert("Preencha os campos obrigatórios.");
    return;
  }
  const ingredientes = ingredientesStr.split(",").map(pair => {
    const [id, qty] = pair.split(":");
    return { item_id: id.trim(), quantidade: qty.trim() };
  });
  try {
    const response = await fetch(`${API_URL.replace('/estoque', '')}/consumo_receita`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receita_nome, ingredientes })
    });
    if (response.ok) {
      alert("Consumo registrado com sucesso!");
      closeConsumoModal();
      loadItems();
    } else {
      alert("Erro ao registrar consumo.");
    }
  } catch (error) {
    console.error("Erro na requisição de consumo:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => loadItems());