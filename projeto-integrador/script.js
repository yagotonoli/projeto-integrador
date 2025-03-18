const API_URL = "http://localhost:3000/estoque";

// Objeto para armazenar os filtros ativos (Nome e Categoria)
let activeFilters = { name: "", category: "" };
let isEditing = false;  // Controle do modo de edição

// Carrega os itens ao carregar a página
document.addEventListener("DOMContentLoaded", () => loadItems());

/**
 * Carrega os itens do estoque e os exibe na tabela.
 * Permite aplicar filtros via query string.
 */
async function loadItems(query = '') {
  const url = API_URL + query;
  try {
    const response = await fetch(url);
    const items = await response.json();
    const table = document.getElementById("itemTable");
    table.innerHTML = ""; // Limpa a tabela

    // Cria a linha para cada item – todos os campos exibidos como texto
    items.forEach(item => {
      let row = `<tr data-id="${item.id}">
          <td class="cell-codigo_item">${item.codigo_item}</td>
          <td class="cell-name">${item.name}</td>
          <td class="cell-brand">${item.brand}</td>
          <td class="cell-category">${item.category}</td>
          <td class="cell-quantity">${item.quantity}</td>
          <td class="cell-lot">${item.lot}</td>
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
 * Fecha o modal de adicionar item e limpa os inputs.
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
 * Alterna o filtro combinado para Nome e Categoria.
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
 */
function toggleSelectAll(masterCheckbox) {
  const checkboxes = document.querySelectorAll(".row-checkbox");
  checkboxes.forEach(checkbox => {
    checkbox.checked = masterCheckbox.checked;
  });
}

/**
 * Função para editar itens selecionados.
 * Ao clicar em "Editar", os campos dos itens selecionados são transformados em inputs.
 * Ao clicar em "Salvar", os dados modificados são enviados via PUT para atualizar o banco de dados.
 * Após salvar, a tabela é recarregada para refletir os dados atualizados do banco.
 */
function editSelectedItems() {
  const checkboxes = document.querySelectorAll(".row-checkbox:checked");
  if (checkboxes.length === 0) {
    alert("Nenhum item selecionado para edição.");
    return;
  }

  if (!isEditing) {
    // Entra no modo de edição: transforma as células dos itens selecionados em inputs
    isEditing = true;
    document.getElementById("editButton").innerText = "Salvar";
    checkboxes.forEach(checkbox => {
      const row = checkbox.closest("tr");
      const cellCodigo = row.querySelector(".cell-codigo_item");
      const cellName = row.querySelector(".cell-name");
      const cellBrand = row.querySelector(".cell-brand");
      const cellCategory = row.querySelector(".cell-category");
      const cellQuantity = row.querySelector(".cell-quantity");
      const cellLot = row.querySelector(".cell-lot");

      cellCodigo.innerHTML = `<input type="text" value="${cellCodigo.innerText}" />`;
      cellName.innerHTML = `<input type="text" value="${cellName.innerText}" />`;
      cellBrand.innerHTML = `<input type="text" value="${cellBrand.innerText}" />`;
      cellCategory.innerHTML = `<input type="text" value="${cellCategory.innerText}" />`;
      cellQuantity.innerHTML = `<input type="number" value="${cellQuantity.innerText}" />`;
      cellLot.innerHTML = `<input type="text" value="${cellLot.innerText}" />`;
    });
  } else {
    // Salva as alterações: envia PUT para cada item e recarrega os dados do banco
    isEditing = false;
    document.getElementById("editButton").innerText = "Editar";
    const updatePromises = [];

    checkboxes.forEach(checkbox => {
      const row = checkbox.closest("tr");
      const id = row.getAttribute("data-id");
      const newCodigo = row.querySelector(".cell-codigo_item input").value;
      const newName = row.querySelector(".cell-name input").value;
      const newBrand = row.querySelector(".cell-brand input").value;
      const newCategory = row.querySelector(".cell-category input").value;
      const newQuantity = row.querySelector(".cell-quantity input").value;
      const newLot = row.querySelector(".cell-lot input").value;

      const payload = {
        codigo_item: newCodigo,
        name: newName,
        brand: newBrand,
        category: newCategory,
        quantity: newQuantity,
        lot: newLot
      };

      updatePromises.push(
        fetch(`${API_URL}/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
          .then(response => response.json())
          .catch(err => console.error(err))
      );
    });

    Promise.all(updatePromises)
      .then(results => {
        console.log("Itens atualizados com sucesso!", results);
        // Após atualizar, recarrega os itens do banco para garantir que as mudanças ficaram salvas
        loadItems();
      })
      .catch(error => console.error("Erro ao atualizar itens:", error));
  }
}