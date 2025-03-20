// server.js
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');

const app = express();

// Habilitar CORS e interpretar JSON e URL-encoded
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Definir o caminho raiz (a pasta "projeto-integrador")
const rootPath = path.join(__dirname, '..');

// Servir os arquivos estáticos específicos
app.get('/', (req, res) => {
  res.sendFile(path.join(rootPath, 'index.html'));
});

app.get('/style.css', (req, res) => {
  res.sendFile(path.join(rootPath, 'style.css'));
});

app.get('/script.js', (req, res) => {
  res.sendFile(path.join(rootPath, 'script.js'));
});

// Rota de teste para confirmar que o servidor está ativo
app.get('/test', (req, res) => {
  console.log('Rota /test acessada.');
  res.json({ message: 'Servidor funcionando corretamente!' });
});

// Configuração do MySQL
const db = mysql.createConnection({
  host: 'localhost',      // Se o MySQL estiver em outra máquina, altere para o IP correspondente.
  user: 'root',
  password: 'SccP@1910#',
  database: 'estoque'
});

// Conectar ao MySQL
db.connect((err) => {
  if (err) {
    console.error('Erro ao conectar ao MySQL:', err);
  } else {
    console.log('Conectado ao MySQL!');
  }
});

// API: GET /estoque - Filtra itens conforme parâmetros
app.get('/estoque', (req, res) => {
  console.log('Requisição GET /estoque recebida com query:', req.query);
  const { codigo_item, name, brand, category, quantity, lot, validade, fornecedor } = req.query;
  let sql = 'SELECT * FROM items';
  let conditions = [];
  let values = [];

  if (codigo_item) { conditions.push('codigo_item LIKE ?'); values.push(`%${codigo_item}%`); }
  if (name) { conditions.push('name LIKE ?'); values.push(`%${name}%`); }
  if (brand) { conditions.push('brand LIKE ?'); values.push(`%${brand}%`); }
  if (category) { conditions.push('category LIKE ?'); values.push(`%${category}%`); }
  if (quantity) { conditions.push('quantity = ?'); values.push(quantity); }
  if (lot) { conditions.push('lot LIKE ?'); values.push(`%${lot}%`); }
  if (validade) { conditions.push('validade = ?'); values.push(validade); }
  if (fornecedor) { conditions.push('fornecedor LIKE ?'); values.push(`%${fornecedor}%`); }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  console.log('SQL executado:', sql, 'com valores:', values);
  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("Erro ao buscar itens:", err);
      return res.status(500).send('Erro ao buscar itens');
    }
    console.log('Itens retornados:', result.length);
    res.json(result);
  });
});

// API: POST /estoque - Adiciona ou atualiza item (acrescentando quantidade se já existir)
app.post('/estoque', (req, res) => {
  console.log('Requisição POST /estoque recebida com body:', req.body);
  const { codigo_item, name, brand, category, quantity, lot, validade, fornecedor } = req.body;
  if (!codigo_item || !name || !brand || !category || !quantity || !lot || !validade || !fornecedor) {
    return res.status(400).send('Todos os campos são obrigatórios.');
  }

  const queryCheck = 'SELECT * FROM items WHERE codigo_item = ? AND name = ? AND brand = ? AND category = ? AND lot = ? AND validade = ? AND fornecedor = ?';
  db.query(queryCheck, [codigo_item, name, brand, category, lot, validade, fornecedor], (err, results) => {
    if (err) {
      console.error("Erro ao verificar item:", err);
      return res.status(500).send('Erro ao verificar item');
    }
    const movimentoData = new Date();
    if (results.length > 0) {
      const existingItem = results[0];
      const newQuantity = parseInt(existingItem.quantity) + parseInt(quantity);
      const queryUpdate = 'UPDATE items SET quantity = ? WHERE id = ?';
      db.query(queryUpdate, [newQuantity, existingItem.id], (err, result) => {
        if (err) {
          console.error("Erro ao atualizar quantidade:", err);
          return res.status(500).send('Erro ao atualizar quantidade');
        }
        const sqlMov = 'INSERT INTO movimentacoes_estoque (item_id, tipo, quantidade, data_movimento, observacao) VALUES (?, ?, ?, ?, ?)';
        db.query(sqlMov, [existingItem.id, 'entrada', quantity, movimentoData, 'Atualização de quantidade por adição'], (errMov, resultMov) => {
          if (errMov) console.error("Erro ao registrar movimentação:", errMov);
          return res.status(200).send({ message: 'Quantidade atualizada com sucesso!' });
        });
      });
    } else {
      const queryInsert = 'INSERT INTO items (codigo_item, name, brand, category, quantity, lot, validade, fornecedor) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
      db.query(queryInsert, [codigo_item, name, brand, category, quantity, lot, validade, fornecedor], (err, result) => {
        if (err) {
          console.error("Erro ao adicionar item:", err);
          return res.status(500).send('Erro ao adicionar item');
        }
        const sqlMov = 'INSERT INTO movimentacoes_estoque (item_id, tipo, quantidade, data_movimento, observacao) VALUES (?, ?, ?, ?, ?)';
        db.query(sqlMov, [result.insertId, 'entrada', quantity, movimentoData, 'Item adicionado'], (errMov, resultMov) => {
          if (errMov) console.error("Erro ao registrar movimentação:", errMov);
          return res.status(201).send({ message: 'Item adicionado com sucesso!' });
        });
      });
    }
  });
});

// API: PUT /estoque/:id - Atualiza item e registra alteração de quantidade
app.put('/estoque/:id', (req, res) => {
  console.log('Requisição PUT /estoque/:id recebida. ID:', req.params.id, 'Body:', req.body);
  const { id } = req.params;
  let { codigo_item, name, brand, category, quantity, lot, validade, fornecedor } = req.body;
  validade = (validade === "") ? null : validade;
  quantity = (quantity === "") ? null : parseInt(quantity);
  codigo_item = codigo_item === undefined ? "" : codigo_item;
  name = name === undefined ? "" : name;
  brand = brand === undefined ? "" : brand;
  category = category === undefined ? "" : category;
  lot = lot === undefined ? "" : lot;
  fornecedor = fornecedor === undefined ? "" : fornecedor;

  const querySelect = 'SELECT quantity FROM items WHERE id = ?';
  db.query(querySelect, [id], (err, results) => {
    if (err) {
      console.error("Erro ao buscar item:", err);
      return res.status(500).send('Erro ao buscar item');
    }
    if (results.length === 0) {
      return res.status(404).send('Item não encontrado');
    }
    const oldQuantity = parseInt(results[0].quantity);
    const sql = 'UPDATE items SET codigo_item = ?, name = ?, brand = ?, category = ?, quantity = ?, lot = ?, validade = ?, fornecedor = ? WHERE id = ?';
    db.query(sql, [codigo_item, name, brand, category, quantity, lot, validade, fornecedor, id], (err, result) => {
      if (err) {
        console.error("Erro ao atualizar item:", err);
        return res.status(500).send('Erro ao atualizar item');
      }
      let diff = quantity - oldQuantity;
      if (diff !== 0) {
        const tipo = diff > 0 ? 'entrada' : 'saída';
        const movimentacaoQuantidade = Math.abs(diff);
        const movimentoData = new Date();
        const sqlMov = 'INSERT INTO movimentacoes_estoque (item_id, tipo, quantidade, data_movimento, observacao) VALUES (?, ?, ?, ?, ?)';
        db.query(sqlMov, [id, tipo, movimentacaoQuantidade, movimentoData, 'Item editado'], (errMov, resultMov) => {
          if (errMov) console.error("Erro ao registrar movimentação:", errMov);
          return res.status(200).send({ message: 'Item atualizado com sucesso!' });
        });
      } else {
        return res.status(200).send({ message: 'Item atualizado com sucesso!' });
      }
    });
  });
});

// API: DELETE /estoque/:id - Exclui item e registra movimentação de saída
app.delete('/estoque/:id', (req, res) => {
  console.log('Requisição DELETE /estoque/:id recebida. ID:', req.params.id);
  const { id } = req.params;
  const querySelect = 'SELECT * FROM items WHERE id = ?';
  db.query(querySelect, [id], (err, results) => {
    if (err) {
      console.error("Erro ao buscar item para exclusão:", err);
      return res.status(500).send('Erro ao buscar item');
    }
    if (results.length === 0) {
      return res.status(404).send('Item não encontrado');
    }
    const item = results[0];
    const itemQuantity = parseInt(item.quantity);
    const queryDelete = 'DELETE FROM items WHERE id = ?';
    db.query(queryDelete, [id], (err, result) => {
      if (err) {
        console.error("Erro ao excluir item:", err);
        return res.status(500).send('Erro ao excluir item');
      }
      const movimentoData = new Date();
      const sqlMov = 'INSERT INTO movimentacoes_estoque (item_id, tipo, quantidade, data_movimento, observacao) VALUES (?, ?, ?, ?, ?)';
      db.query(sqlMov, [id, 'saída', itemQuantity, movimentoData, 'Item excluído'], (errMov, resultMov) => {
        if (errMov) console.error("Erro ao registrar movimentação:", errMov);
        res.status(200).send({ message: 'Item excluído com sucesso!' });
      });
    });
  });
});

// API: POST /movimentacoes - Registro de movimentação (não utilizado manualmente)
app.post('/movimentacoes', (req, res) => {
  console.log('Requisição POST /movimentacoes recebida com body:', req.body);
  const { item_id, tipo, quantidade, data } = req.body;
  if (!item_id || !tipo || !quantidade) {
    return res.status(400).send("Campos item_id, tipo e quantidade são obrigatórios.");
  }
  let sqlUpdate;
  if (tipo === 'entrada') {
    sqlUpdate = 'UPDATE items SET quantity = quantity + ? WHERE id = ?';
  } else if (tipo === 'saída' || tipo === 'saida') {
    sqlUpdate = 'UPDATE items SET quantity = quantity - ? WHERE id = ?';
  } else {
    return res.status(400).send("Tipo inválido. Use 'entrada' ou 'saída'.");
  }
  db.query(sqlUpdate, [quantidade, item_id], (err, result) => {
    if (err) {
      console.error("Erro ao atualizar item para movimentação:", err);
      return res.status(500).send("Erro ao atualizar item");
    }
    const movimentoData = data || new Date();
    const sqlInsert = 'INSERT INTO movimentacoes_estoque (item_id, tipo, quantidade, data_movimento) VALUES (?, ?, ?, ?)';
    db.query(sqlInsert, [item_id, tipo, quantidade, movimentoData], (err2, result2) => {
      if (err2) {
        console.error("Erro ao registrar movimentação:", err2);
        return res.status(500).send("Erro ao registrar movimentação");
      }
      return res.status(200).send({ message: 'Movimentação registrada com sucesso!' });
    });
  });
});

// API: GET /movimentacoes - Lista movimentos com detalhes
app.get('/movimentacoes', (req, res) => {
  console.log('Requisição GET /movimentacoes recebida.');
  const sql = `
    SELECT 
      m.id,
      i.codigo_item AS item,
      i.name AS nome,
      i.brand AS marca,
      i.category AS categoria,
      i.lot AS lote,
      i.validade AS validade,
      i.fornecedor AS fornecedor,
      SUM(CASE WHEN m.tipo = 'entrada' THEN m.quantidade ELSE -m.quantidade END)
         OVER (PARTITION BY m.item_id ORDER BY m.data_movimento, m.id) AS quantidade_atual,
      COALESCE(
         SUM(CASE WHEN m.tipo = 'entrada' THEN m.quantidade ELSE -m.quantidade END)
         OVER (PARTITION BY m.item_id ORDER BY m.data_movimento, m.id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0
      ) AS quantidade_anterior,
      m.data_movimento AS data,
      m.observacao AS observacao
    FROM movimentacoes_estoque m
    JOIN items i ON m.item_id = i.id
    ORDER BY m.item_id, m.data_movimento, m.id;
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Erro ao buscar movimentações:", err);
      return res.status(500).send("Erro ao buscar movimentações");
    }
    res.json(results);
  });
});

// API: GET /relatorios - Gera relatório de movimentações
app.get('/relatorios', (req, res) => {
  console.log('Requisição GET /relatorios recebida.');
  const sql = `
    SELECT 
      m.id,
      i.codigo_item AS item,
      i.name AS nome,
      i.brand AS marca,
      i.category AS categoria,
      i.lot AS lote,
      i.validade AS validade,
      i.fornecedor AS fornecedor,
      CASE WHEN m.tipo = 'entrada' THEN m.quantidade ELSE 0 END AS quantidade_entrada,
      CASE WHEN m.tipo = 'saída' OR m.tipo = 'saida' THEN m.quantidade ELSE 0 END AS quantidade_saida,
      m.data_movimento AS data,
      m.observacao AS observacao
    FROM movimentacoes_estoque m
    JOIN items i ON m.item_id = i.id
    ORDER BY m.data_movimento, m.id;
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Erro ao gerar relatório:", err);
      return res.status(500).send("Erro ao gerar relatório");
    }
    res.json(results);
  });
});

// API: GET /fornecedores - Lista fornecedores distintos
app.get('/fornecedores', (req, res) => {
  console.log('Requisição GET /fornecedores recebida.');
  const sql = 'SELECT DISTINCT fornecedor FROM items';
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Erro ao buscar fornecedores:", err);
      return res.status(500).send("Erro ao buscar fornecedores");
    }
    res.json(results);
  });
});

// Middleware para tratar rotas não encontradas
app.use((req, res) => {
  console.warn('Rota não encontrada:', req.originalUrl);
  res.status(404).send('Rota não encontrada');
});

// Iniciar o servidor na porta 3000
app.listen(3000, () => {
  console.log('Servidor rodando na porta 3000');
});