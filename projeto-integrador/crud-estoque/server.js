// Importa as bibliotecas necessárias
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();

// Habilita CORS para permitir requisições de outras origens
app.use(cors());
// Middleware para interpretar JSON nas requisições
app.use(express.json());

// Configuração da conexão com o MySQL
const db = mysql.createConnection({
  host: 'localhost',      // Endereço do servidor MySQL
  user: 'root',           // Usuário do MySQL
  password: 'sCCp@1910#',   // Substitua pela sua senha do MySQL
  database: 'estoque'      // Nome do banco de dados utilizado
});

// Conecta ao MySQL e registra erros ou sucesso na conexão
db.connect((err) => {
  if (err) {
    console.error('Erro ao conectar ao MySQL:', err);
  } else {
    console.log('Conectado ao MySQL!');
  }
});

/**
 * Rota GET /estoque
 * Retorna todos os itens cadastrados, permitindo filtrar por "name" e "category" via query string.
 */
app.get('/estoque', (req, res) => {
  let { name, category } = req.query;
  let sql = 'SELECT * FROM items';
  let conditions = [];
  let values = [];
  
  if (name) {
    conditions.push('name LIKE ?');
    values.push(`%${name}%`);
  }
  if (category) {
    conditions.push('category LIKE ?');
    values.push(`%${category}%`);
  }
  
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  
  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("Erro ao buscar itens:", err);
      return res.status(500).send('Erro ao buscar itens');
    }
    res.json(result);
  });
});

/**
 * Rota POST /estoque
 * Adiciona um novo item ao estoque.
 * Se já existir um item com o mesmo codigo_item, name e category, soma as quantidades.
 * Exige os parâmetros: codigo_item, name, brand, category, quantity e lot.
 */
app.post('/estoque', (req, res) => {
  const { codigo_item, name, brand, category, quantity, lot } = req.body;
  
  if (!codigo_item || !name || !brand || !category || !quantity || !lot) {
    return res.status(400).send('Código do item, nome, marca, quantidade, categoria e lote são obrigatórios');
  }
  
  // Verifica se já existe um item com o mesmo codigo_item, name e category
  const queryCheck = 'SELECT * FROM items WHERE codigo_item = ? AND name = ? AND category = ?';
  db.query(queryCheck, [codigo_item, name, category], (err, results) => {
    if (err) {
      console.error("Erro ao verificar item:", err);
      return res.status(500).send('Erro ao verificar item');
    }
    
    if (results.length > 0) {
      // Se já existir, soma a quantidade nova à existente
      const existingItem = results[0];
      const newQuantity = parseInt(existingItem.quantity) + parseInt(quantity);
      const queryUpdate = 'UPDATE items SET quantity = ? WHERE id = ?';
      db.query(queryUpdate, [newQuantity, existingItem.id], (err, result) => {
        if (err) {
          console.error("Erro ao atualizar quantidade:", err);
          return res.status(500).send('Erro ao atualizar quantidade');
        }
        return res.status(200).send({ message: 'Quantidade atualizada com sucesso!' });
      });
    } else {
      // Insere um novo item
      const queryInsert = 'INSERT INTO items (codigo_item, name, brand, category, quantity, lot) VALUES (?, ?, ?, ?, ?, ?)';
      db.query(queryInsert, [codigo_item, name, brand, category, quantity, lot], (err, result) => {
        if (err) {
          console.error("Erro ao adicionar item:", err);
          return res.status(500).send('Erro ao adicionar item');
        }
        return res.status(201).send({ message: 'Item adicionado com sucesso!' });
      });
    }
  });
});

/**
 * Rota PUT /estoque/:id
 * Atualiza a quantidade de um item específico.
 * Exige o parâmetro "quantity" no corpo da requisição.
 */
app.put('/estoque/:id', (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;
  
  if (quantity === undefined) {
    return res.status(400).send('Quantidade é obrigatória');
  }
  
  const query = 'UPDATE items SET quantity = ? WHERE id = ?';
  
  db.query(query, [quantity, id], (err, result) => {
    if (err) {
      console.error("Erro ao atualizar quantidade:", err);
      return res.status(500).send('Erro ao atualizar quantidade');
    }
    console.log(`Item ${id} atualizado para quantidade ${quantity}`);
    res.status(200).send({ message: 'Quantidade atualizada com sucesso!' });
  });
});

/**
 * Rota DELETE /estoque/:id
 * Exclui um item do estoque com base no seu ID.
 */
app.delete('/estoque/:id', (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM items WHERE id = ?';
  
  db.query(query, [id], (err, result) => {
    if (err) {
      console.error("Erro ao excluir item:", err);
      return res.status(500).send('Erro ao excluir item');
    }
    res.status(200).send({ message: 'Item excluído com sucesso!' });
  });
});

// Rota catch-all para requisições não mapeadas
app.use((req, res) => {
  res.status(404).send('Rota não encontrada');
});

// Inicia o servidor na porta 3000
app.listen(3000, () => {
  console.log('Servidor rodando na porta 3000');
});