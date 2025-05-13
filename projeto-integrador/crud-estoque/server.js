// server.js

// Importa módulos
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos
const root = path.join(__dirname, '..');
app.get('/', (req, res) => res.sendFile(path.join(root, 'index.html')));
app.get('/style.css', (req, res) => res.sendFile(path.join(root, 'style.css')));
app.get('/script.js', (req, res) => res.sendFile(path.join(root, 'script.js')));

// Conexão MySQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'SccP@1910#',
  database: 'estoque',
  dateStrings: true
});
db.connect(err => err ? console.error('MySQL:', err) : console.log('MySQL conectado'));

/**
 * Formata data "YYYY-MM-DD" → "DD/MM/YYYY"
 */
function formatDateDDMMYYYY(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

/* ============================
   ROTAS DO SISTEMA DE ESTOQUE
   ============================ */

/**
 * GET /estoque
 * Só retorna itens com deleted = 0 e aplica filtros via query string
 */
app.get('/estoque', (req, res) => {
  const { codigo_item, name, brand, category, quantity, validade, fornecedor } = req.query;
  let sql = 'SELECT * FROM itens WHERE deleted = 0';
  const cond = [], vals = [];

  if (codigo_item) { cond.push('codigo_item LIKE ?'); vals.push(`%${codigo_item}%`); }
  if (name) { cond.push('name       LIKE ?'); vals.push(`%${name}%`); }
  if (brand) { cond.push('brand      LIKE ?'); vals.push(`%${brand}%`); }
  if (category) { cond.push('category   LIKE ?'); vals.push(`%${category}%`); }
  if (quantity) { cond.push('quantity   =   ?'); vals.push(quantity); }
  if (validade) { cond.push('validade   =   ?'); vals.push(validade); }
  if (fornecedor) { cond.push('fornecedor LIKE ?'); vals.push(`%${fornecedor}%`); }

  if (cond.length) {
    sql += ' AND ' + cond.join(' AND ');
  }

  db.query(sql, vals, (err, rows) => {
    if (err) return res.status(500).send('Erro ao buscar itens');
    res.json(rows);
  });
});

/**
 * POST /estoque
 * Insere novo item ou agrega quantidade
 */
app.post('/estoque', (req, res) => {
  let { codigo_item, name, brand, category, quantity, validade, fornecedor } = req.body;
  if (!codigo_item || !name || !brand || !category || !quantity || !validade || !fornecedor) {
    return res.status(400).send('Campos obrigatórios faltando');
  }
  quantity = parseInt(quantity);
  const now = new Date();

  const checkSql = `
    SELECT * FROM itens 
    WHERE codigo_item=? AND name=? AND brand=? AND category=? AND validade=? AND fornecedor=?`;
  db.query(checkSql,
    [codigo_item, name, brand, category, validade, fornecedor],
    (e, rows) => {
      if (e) return res.status(500).send('Erro ao verificar item');
      if (rows.length) {
        // Já existe: atualiza quantidade
        const oldQ = parseInt(rows[0].quantity);
        const newQ = oldQ + quantity;
        db.query('UPDATE itens SET quantity=? WHERE id=?',
          [newQ, rows[0].id],
          err => {
            if (err) return res.status(500).send('Erro ao atualizar quantidade');
            const movSql = `
              INSERT INTO movimentacoes
                (item_id,tipo,quantidade,quantidade_anterior,quantidade_atual,data_movimento,observacao)
              VALUES (?,?,?,?,?,?,?)`;
            db.query(movSql,
              [rows[0].id, 'entrada', quantity, oldQ, newQ, now, 'Atualização de quantidade por adição'],
              () => res.status(200).send({ message: 'Quantidade atualizada com sucesso!' })
            );
          }
        );
      } else {
        // Novo item
        db.query(
          `INSERT INTO itens 
             (codigo_item,name,brand,category,quantity,validade,fornecedor,deleted) 
           VALUES (?,?,?,?,?,?,?,0)`,
          [codigo_item, name, brand, category, quantity, validade, fornecedor],
          (err, result) => {
            if (err) return res.status(500).send('Erro ao adicionar item');
            const movSql = `
              INSERT INTO movimentacoes
                (item_id,tipo,quantidade,quantidade_anterior,quantidade_atual,data_movimento,observacao)
              VALUES (?,?,?,?,?,?,?)`;
            db.query(movSql,
              [result.insertId, 'entrada', quantity, 0, quantity, now, 'Item adicionado'],
              () => res.status(201).send({ message: 'Item adicionado com sucesso!' })
            );
          }
        );
      }
    }
  );
});

/**
 * PUT /estoque/:id
 * Atualiza item e registra movimentação de edição ou ajuste
 */
app.put('/estoque/:id', (req, res) => {
  const id = req.params.id;
  let { codigo_item, name, brand, category, quantity, validade, fornecedor } = req.body;
  let newVal = (validade && validade.trim() !== "") ? validade.trim() : null;
  quantity = quantity === "" ? null : parseInt(quantity);

  db.query('SELECT * FROM itens WHERE id=?', [id], (e, rows) => {
    if (e) return res.status(500).send('Erro ao buscar item');
    if (!rows.length) return res.status(404).send('Item não encontrado');
    const old = rows[0], oldQ = parseInt(old.quantity);
    if (newVal === null) newVal = old.validade;

    const sqlUpdate = `
      UPDATE itens 
      SET codigo_item=?, name=?, brand=?, category=?, quantity=?, validade=?, fornecedor=? 
      WHERE id=?`;
    db.query(sqlUpdate,
      [codigo_item || "", name || "", brand || "", category || "", quantity, newVal, fornecedor || "", id],
      err => {
        if (err) return res.status(500).send('Erro ao atualizar item');
        // Monta observações de alterações
        const changes = [];
        if (codigo_item !== old.codigo_item)
          changes.push(`Código "${old.codigo_item}" → "${codigo_item}"`);
        if (name !== old.name)
          changes.push(`Nome "${old.name}" → "${name}"`);
        if (brand !== old.brand)
          changes.push(`Marca "${old.brand}" → "${brand}"`);
        if (category !== old.category)
          changes.push(`Categoria "${old.category}" → "${category}"`);
        if (fornecedor !== old.fornecedor)
          changes.push(`Fornecedor "${old.fornecedor}" → "${fornecedor}"`);
        if (newVal !== old.validade)
          changes.push(`Validade "${formatDateDDMMYYYY(old.validade)}" → "${formatDateDDMMYYYY(newVal)}"`);
        if (quantity !== oldQ)
          changes.push(`Quantidade ${oldQ} → ${quantity}`);

        const obs = changes.length ? changes.join('; ') : 'Nenhuma alteração';
        const tipo = quantity > oldQ ? 'entrada'
          : quantity < oldQ ? 'saída'
            : 'edição';
        const movSql = `
          INSERT INTO movimentacoes
            (item_id,tipo,quantidade,quantidade_anterior,quantidade_atual,data_movimento,observacao)
          VALUES (?,?,?,?,?,?,?)`;
        db.query(movSql,
          [id, tipo, Math.abs(quantity - oldQ), oldQ, quantity, new Date(), obs],
          () => res.status(200).send({ message: 'Item atualizado com sucesso!' })
        );
      }
    );
  });
});

/**
 * DELETE /estoque/:id
 * Soft-delete em itens e registra movimentação de exclusão
 */
app.delete('/estoque/:id', (req, res) => {
  const id = req.params.id;
  db.query('SELECT * FROM itens WHERE id=?', [id], (e, rows) => {
    if (e) return res.status(500).send('Erro ao buscar item para exclusão');
    if (!rows.length) return res.status(404).send('Item não encontrado');
    const qty = parseInt(rows[0].quantity);

    db.query('UPDATE itens SET quantity=0, deleted=1 WHERE id=?', [id], err => {
      if (err) return res.status(500).send('Erro ao marcar como excluído');
      const movSql = `
        INSERT INTO movimentacoes
          (item_id,tipo,quantidade,quantidade_anterior,quantidade_atual,data_movimento,observacao)
        VALUES (?,?,?,?,?,?,?)`;
      db.query(movSql,
        [id, 'exclusão', qty, qty, 0, new Date(), 'Item excluído'],
        () => res.status(200).send({ message: 'Item excluído com sucesso!' })
      );
    });
  });
});

/**
 * POST /movimentacoes
 * Registra movimentação manual (entrada ou saída)
 */
app.post('/movimentacoes', (req, res) => {
  const { item_id, tipo, quantidade, data } = req.body;
  if (!item_id || !tipo || !quantidade) {
    return res.status(400).send("item_id, tipo e quantidade são obrigatórios.");
  }
  db.query('SELECT quantity FROM itens WHERE id=?', [item_id], (err, rows) => {
    if (err) return res.status(500).send("Erro ao buscar item");
    if (!rows.length) return res.status(404).send("Item não encontrado");
    const oldQ = parseInt(rows[0].quantity);
    let sqlUp;
    if (tipo === 'entrada') sqlUp = 'UPDATE itens SET quantity=quantity+? WHERE id=?';
    else if (['saída', 'saida'].includes(tipo)) sqlUp = 'UPDATE itens SET quantity=quantity-? WHERE id=?';
    else return res.status(400).send("Tipo inválido.");
    db.query(sqlUp, [quantidade, item_id], err2 => {
      if (err2) return res.status(500).send("Erro ao atualizar item");
      const newQ = tipo === 'entrada' ? oldQ + parseInt(quantidade) : oldQ - parseInt(quantidade);
      const movSql = `
        INSERT INTO movimentacoes
          (item_id,tipo,quantidade,quantidade_anterior,quantidade_atual,data_movimento,observacao)
        VALUES (?,?,?,?,?,?,?)`;
      db.query(movSql,
        [item_id, tipo, quantidade, oldQ, newQ, data || new Date(), 'Movimentação manual'],
        () => res.status(200).send({ message: 'Movimentação registrada com sucesso!' })
      );
    });
  });
});

/**
 * GET /movimentacoes
 * Retorna histórico com filtros via query string
 */
app.get('/movimentacoes', (req, res) => {
  const {
    id, item, nome, marca, categoria,
    validade, fornecedor,
    quantidade_atual, quantidade_anterior,
    data, observacao
  } = req.query;

  let sql = `
    SELECT
      m.id,
      i.codigo_item AS item,
      i.name        AS nome,
      i.brand       AS marca,
      i.category    AS categoria,
      i.validade    AS validade,
      i.fornecedor  AS fornecedor,
      m.quantidade_anterior,
      m.quantidade_atual,
      m.data_movimento AS data,
      m.observacao,
      m.tipo
    FROM movimentacoes m
    LEFT JOIN itens i ON m.item_id = i.id
    WHERE 1=1`;
  const cond = [], vals = [];

  if (id) { cond.push('m.id = ?'); vals.push(id); }
  if (item) { cond.push('i.codigo_item LIKE ?'); vals.push(`%${item}%`); }
  if (nome) { cond.push('i.name LIKE ?'); vals.push(`%${nome}%`); }
  if (marca) { cond.push('i.brand LIKE ?'); vals.push(`%${marca}%`); }
  if (categoria) { cond.push('i.category LIKE ?'); vals.push(`%${categoria}%`); }
  if (validade) { cond.push('i.validade = ?'); vals.push(validade); }
  if (fornecedor) { cond.push('i.fornecedor LIKE ?'); vals.push(`%${fornecedor}%`); }
  if (quantidade_atual) { cond.push('m.quantidade_atual = ?'); vals.push(quantidade_atual); }
  if (quantidade_anterior) { cond.push('m.quantidade_anterior = ?'); vals.push(quantidade_anterior); }
  if (data) { cond.push('DATE(m.data_movimento) = ?'); vals.push(data); }
  if (observacao) { cond.push('m.observacao LIKE ?'); vals.push(`%${observacao}%`); }

  if (cond.length) {
    sql += ' AND ' + cond.join(' AND ');
  }
  sql += ' ORDER BY m.data_movimento, m.id';

  db.query(sql, vals, (err, rows) => {
    if (err) return res.status(500).send("Erro ao buscar movimentações");
    res.json(rows);
  });
});

/**
 * GET /relatorios
 * Gera relatório com filtros via query string
 */
app.get('/relatorios', (req, res) => {
  const {
    id, item, nome, marca, categoria,
    validade, fornecedor,
    quantidade_entrada, quantidade_saida,
    data, observacao
  } = req.query;

  let sql = `
    SELECT
      m.id,
      i.codigo_item AS item,
      i.name        AS nome,
      i.brand       AS marca,
      i.category    AS categoria,
      i.validade    AS validade,
      i.fornecedor  AS fornecedor,
      CASE WHEN m.tipo='entrada' THEN m.quantidade ELSE 0 END   AS quantidade_entrada,
      CASE WHEN m.tipo IN ('saída','saida','exclusão') THEN m.quantidade ELSE 0 END AS quantidade_saida,
      m.data_movimento AS data,
      m.observacao,
      m.tipo
    FROM movimentacoes m
    LEFT JOIN itens i ON m.item_id = i.id
    WHERE 1=1`;
  const cond = [], vals = [];

  if (id) { cond.push('m.id = ?'); vals.push(id); }
  if (item) { cond.push('i.codigo_item LIKE ?'); vals.push(`%${item}%`); }
  if (nome) { cond.push('i.name LIKE ?'); vals.push(`%${nome}%`); }
  if (marca) { cond.push('i.brand LIKE ?'); vals.push(`%${marca}%`); }
  if (categoria) { cond.push('i.category LIKE ?'); vals.push(`%${categoria}%`); }
  if (validade) { cond.push('i.validade = ?'); vals.push(validade); }
  if (fornecedor) { cond.push('i.fornecedor LIKE ?'); vals.push(`%${fornecedor}%`); }
  if (quantidade_entrada) { cond.push('quantidade_entrada = ?'); vals.push(quantidade_entrada); }
  if (quantidade_saida) { cond.push('quantidade_saida = ?'); vals.push(quantidade_saida); }
  if (data) { cond.push('DATE(m.data_movimento) = ?'); vals.push(data); }
  if (observacao) { cond.push('m.observacao LIKE ?'); vals.push(`%${observacao}%`); }

  if (cond.length) {
    sql += ' AND ' + cond.join(' AND ');
  }
  sql += ' ORDER BY m.data_movimento, m.id';

  db.query(sql, vals, (err, rows) => {
    if (err) return res.status(500).send("Erro ao gerar relatório");
    res.json(rows);
  });
});

/**
 * GET /fornecedores
 * Lista de fornecedores distintos
 */
app.get('/fornecedores', (req, res) => {
  db.query('SELECT DISTINCT fornecedor FROM itens', (err, rows) => {
    if (err) return res.status(500).send("Erro ao buscar fornecedores");
    res.json(rows);
  });
});

// Rota 404
app.use((req, res) => res.status(404).send('Rota não encontrada'));

// Inicia o servidor
app.listen(3000, () => console.log('Servidor rodando na porta 3000'));
