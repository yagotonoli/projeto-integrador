// URL base da API
const API_URL = "http://localhost:3000/estoque";

// Objeto para armazenar os filtros ativos (para Nome e Categoria)
let activeFilters = { name: "", category: "" };

// Carrega os itens quando a página é carregada
document.addEventListener("DOMContentLoaded", () => loadItems());

/**
 * Carrega os itens do estoque e os exibe na tabela.
 * Permite aplicar filtros via query string.
 * @param {string} query - Query string opcional (ex.: ?name=xyz&category=abc)
 */
async function loadItems(query = '') {
  const url = API_URL + query;
  console.log("Chamando:", url);
  try {
    const response = await fetch(url);
    const items = await response.json();
    const table = document.getElementById("itemTable");
    table.innerHTML = ""; // Limpa a tabela
    
    // Para cada item, cria uma linha na tabela com as novas colunas
    items.forEach(item => {
      let row = `<tr>
          <td>${item.codigo_item}</td>
          <td>${item.name}</td>
          <td>${item.brand}</td>
          <td>${item.category}</td>
          <td>
            <input type="number" value="${item.quantity}" onblur="updateQuantity(${item.id}, this.value)">
          </td>
          <td>${item.lot}</td>
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

/**
 * Abre o modal de adicionar item.
 */
function openModal() {
  document.getElementById("modalAdd").style.display = "block";
}

/**
 * Fecha o modal de adicionar item e limpa os inputs do modal.
 */
function closeModal() {
  document.getElementById("modalAdd").style.display = "none";
  document.getElementById("modalItemCode").value = "";
  document.getElementById("modalItemName").value = "";
  document.getElementById("modalItemBrand").value = "";
  document.getElementById("modalItemCategory").value = "";
  document.getElementById("modalItemQuantity").value = "";
  document.getElementById("modalItemLot").value = "";
}

/**
 * Adiciona um novo item usando os dados do modal.
 * Se já existir um item com o mesmo código, nome e categoria, soma as quantidades.
 */
async function addItemModal() {
  let codigo_item = document.getElementById("modalItemCode").value;
  let name = document.getElementById("modalItemName").value;
  let brand = document.getElementById("modalItemBrand").value;
  let category = document.getElementById("modalItemCategory").value;
  let quantity = document.getElementById("modalItemQuantity").value;
  let lot = document.getElementById("modalItemLot").value;
  
  if (!codigo_item || !name || !brand || !category || !quantity || !lot) {
    console.log("Preencha todos os campos no modal!");
    return;
  }
  
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo_item, name, brand, category, quantity, lot })
    });
    if (response.ok) {
      console.log("Item adicionado com sucesso!");
      loadItems();
      closeModal();
    } else {
      console.error("Erro ao adicionar item. Status:", response.status);
    }
  } catch (error) {
    console.error("Erro na requisição:", error);
  }
}

/**
 * Exclui os itens selecionados na tabela.
 */
async function deleteSelectedItems() {
  const checkboxes = document.querySelectorAll(".row-checkbox:checked");
  if (checkboxes.length === 0) {
    alert("Nenhum item selecionado para exclusão.");
    return;
  }
  if (!confirm("A ação irá excluir os itens selecionados. Deseja continuar?")) {
    return;
  }
  const deletePromises = [];
  checkboxes.forEach(checkbox => {
    const id = checkbox.getAttribute("data-id");
    deletePromises.push(
      fetch(`${API_URL}/${id}`, { method: "DELETE" })
    );
  });
  try {
    await Promise.all(deletePromises);
    console.log("Itens excluídos com sucesso!");
    loadItems();
  } catch (error) {
    console.error("Erro ao excluir itens:", error);
  }
}

/**
 * Atualiza a quantidade de um item.
 * @param {number} id - ID do item.
 * @param {string|number} newQuantity - Nova quantidade informada.
 */
async function updateQuantity(id, newQuantity) {
  newQuantity = parseInt(newQuantity);
  if (isNaN(newQuantity)) {
    console.error("Quantidade inválida para o item " + id);
    return;
  }
  console.log(`Atualizando item ${id} para quantidade ${newQuantity}`);
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: newQuantity })
    });
    if (response.ok) {
      console.log(`Quantidade do item ${id} atualizada para ${newQuantity}`);
      loadItems();
    } else {
      console.error("Erro ao atualizar quantidade. Status:", response.status);
    }
  } catch (error) {
    console.error("Erro na requisição:", error);
  }
}

/**
 * Alterna o estado do filtro para os inputs de "Nome" e "Categoria" (filtro combinado).
 * Se houver valor e o filtro não estiver ativo, ativa-o; caso contrário, desativa e limpa os inputs.
 */
function toggleCombinedFilter() {
  const nameInput = document.getElementById("itemName");
  const categoryInput = document.getElementById("itemCategory");
  const filterIcon = document.getElementById("filterIcon");
  
  if (!activeFilters.name && !activeFilters.category && (nameInput.value.trim() || categoryInput.value.trim())) {
    activeFilters.name = nameInput.value.trim();
    activeFilters.category = categoryInput.value.trim();
    filterIcon.classList.add("active");
  } else {
    activeFilters.name = "";
    activeFilters.category = "";
    nameInput.value = "";
    categoryInput.value = "";
    filterIcon.classList.remove("active");
  }
  
  let query = "";
  if (activeFilters.name) {
    query += `?name=${encodeURIComponent(activeFilters.name)}`;
  }
  if (activeFilters.category) {
    query += query ? `&category=${encodeURIComponent(activeFilters.category)}` : `?category=${encodeURIComponent(activeFilters.category)}`;
  }
  
  loadItems(query);
}

/**
 * Seleciona ou desmarca todos os checkboxes da tabela.
 * @param {HTMLElement} masterCheckbox - Checkbox mestre.
 */
function toggleSelectAll(masterCheckbox) {
  const checkboxes = document.querySelectorAll(".row-checkbox");
  checkboxes.forEach(checkbox => {
    checkbox.checked = masterCheckbox.checked;
  });
}