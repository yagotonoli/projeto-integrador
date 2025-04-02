// Importa os módulos necessários
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');

const app = express();

// Configura o CORS e o parsing de JSON e URL-encoded
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Define o caminho raiz para os arquivos estáticos
const rootPath = path.join(__dirname, '..');

// Rota principal: envia o arquivo index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(rootPath, 'index.html'));
});

// Rotas para servir o CSS e o JavaScript
app.get('/style.css', (req, res) => {
  res.sendFile(path.join(rootPath, 'style.css'));
});
app.get('/script.js', (req, res) => {
  res.sendFile(path.join(rootPath, 'script.js'));
});

// Rota de teste para verificar se o servidor está funcionando
app.get('/test', (req, res) => {
  console.log('Rota /test acessada.');
  res.json({ message: 'Servidor funcionando corretamente!' });
});

// Configura a conexão com o banco de dados MySQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'SccP@1910#',
  database: 'estoque',
  // Faz com que os campos do tipo DATE sejam retornados como strings no formato "YYYY-MM-DD"
  dateStrings: true
});

// Conecta ao MySQL e loga o status da conexão
db.connect((err) => {
  if (err) {
    console.error('Erro ao conectar ao MySQL:', err);
  } else {
    console.log('Conectado ao MySQL!');
  }
});

/**
 * Função auxiliar para converter uma data do formato "YYYY-MM-DD" para "DD/MM/YYYY".
 * Trabalha apenas com strings, sem conversão para objeto Date.
 * @param {string} dateStr - Data no formato "YYYY-MM-DD".
 * @returns {string} Data formatada.
 */
function formatDateDDMMYYYY(dateStr) {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

/* =============================== */
/* ROTAS PARA O SISTEMA DE ESTOQUE   */
/* =============================== */

/**
 * GET /estoque
 * Busca os itens no banco de dados, com opção de filtros via query string.
 */
app.get('/estoque', (req, res) => {
  console.log('Requisição GET /estoque com query:', req.query);
  const { codigo_item, name, brand, category, quantity, validade, fornecedor } = req.query;
  let sql = 'SELECT * FROM itens';
  let conditions = [];
  let values = [];
  if (codigo_item) { conditions.push('codigo_item LIKE ?'); values.push(`%${codigo_item}%`); }
  if (name) { conditions.push('name LIKE ?'); values.push(`%${name}%`); }
  if (brand) { conditions.push('brand LIKE ?'); values.push(`%${brand}%`); }
  if (category) { conditions.push('category LIKE ?'); values.push(`%${category}%`); }
  if (quantity) { conditions.push('quantity = ?'); values.push(quantity); }
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

/**
 * POST /estoque
 * Adiciona um novo item ou atualiza a quantidade se o item já existir.
 * Registra a movimentação informando o valor anterior (0 se novo) e o valor atual.
 */
app.post('/estoque', (req, res) => {
  console.log('Requisição POST /estoque com body:', req.body);
  let { codigo_item, name, brand, category, quantity, validade, fornecedor } = req.body;
  if (!codigo_item || !name || !brand || !category || !quantity || !validade || !fornecedor) {
    return res.status(400).send('Todos os campos são obrigatórios.');
  }
  quantity = parseInt(quantity);
  const movimentoData = new Date();
  const queryCheck = 'SELECT * FROM itens WHERE codigo_item = ? AND name = ? AND brand = ? AND category = ? AND validade = ? AND fornecedor = ?';
  db.query(queryCheck, [codigo_item, name, brand, category, validade, fornecedor], (err, results) => {
    if (err) {
      console.error("Erro ao verificar item:", err);
      return res.status(500).send('Erro ao verificar item');
    }
    if (results.length > 0) {
      // Se o item existir, atualiza a quantidade e registra movimentação
      const existingItem = results[0];
      const oldQuantity = parseInt(existingItem.quantity);
      const newQuantity = oldQuantity + quantity;
      const queryUpdate = 'UPDATE itens SET quantity = ? WHERE id = ?';
      db.query(queryUpdate, [newQuantity, existingItem.id], (err, result) => {
        if (err) {
          console.error("Erro ao atualizar quantidade:", err);
          return res.status(500).send('Erro ao atualizar quantidade');
        }
        const sqlMov = `INSERT INTO movimentacoes 
          (item_id, tipo, quantidade, quantidade_anterior, quantidade_atual, data_movimento, observacao)
          VALUES (?, ?, ?, ?, ?, ?, ?)`;
        db.query(sqlMov, [existingItem.id, 'entrada', quantity, oldQuantity, newQuantity, movimentoData, 'Atualização de quantidade por adição'], (errMov, resultMov) => {
          if (errMov) console.error("Erro ao registrar movimentação:", errMov);
          return res.status(200).send({ message: 'Quantidade atualizada com sucesso!' });
        });
      });
    } else {
      // Se o item não existir, insere um novo registro e registra movimentação
      const queryInsert = 'INSERT INTO itens (codigo_item, name, brand, category, quantity, validade, fornecedor) VALUES (?, ?, ?, ?, ?, ?, ?)';
      db.query(queryInsert, [codigo_item, name, brand, category, quantity, validade, fornecedor], (err, result) => {
        if (err) {
          console.error("Erro ao adicionar item:", err);
          return res.status(500).send('Erro ao adicionar item');
        }
        const newQuantity = quantity;
        const sqlMov = `INSERT INTO movimentacoes 
          (item_id, tipo, quantidade, quantidade_anterior, quantidade_atual, data_movimento, observacao)
          VALUES (?, ?, ?, ?, ?, ?, ?)`;
        db.query(sqlMov, [result.insertId, 'entrada', quantity, 0, newQuantity, movimentoData, 'Item adicionado'], (errMov, resultMov) => {
          if (errMov) console.error("Erro ao registrar movimentação:", errMov);
          return res.status(201).send({ message: 'Item adicionado com sucesso!' });
        });
      });
    }
  });
});

/**
 * PUT /estoque/:id
 * Atualiza os dados de um item e registra uma movimentação com:
 * - Quantidade anterior e atual.
 * - Tipo de movimentação conforme a variação (entrada, saída ou edição).
 * - Observação detalhando todas as alterações efetuadas.
 *
 * Importante: O campo "validade" só é atualizado se o usuário informar um novo valor.
 * Se o campo "validade" estiver vazio ou não for enviado, o valor antigo será mantido exatamente.
 * A mensagem de observação exibirá a data no formato dd/mm/aaaa.
 */
app.put('/estoque/:id', (req, res) => {
  console.log('Requisição PUT /estoque/:id. ID:', req.params.id, 'Body:', req.body);
  const { id } = req.params;
  let { codigo_item, name, brand, category, quantity, validade, fornecedor } = req.body;

  // Se o campo "validade" for enviado e não estiver vazio, utiliza o valor com trim; caso contrário, manterá o antigo.
  let newValidityStr = (validade && validade.trim() !== "") ? validade.trim() : null;

  quantity = (quantity === "") ? null : parseInt(quantity);
  codigo_item = codigo_item || "";
  name = name || "";
  brand = brand || "";
  category = category || "";
  fornecedor = fornecedor || "";

  // Seleciona o item antigo para obter os valores atuais
  const querySelect = 'SELECT * FROM itens WHERE id = ?';
  db.query(querySelect, [id], (err, results) => {
    if (err) {
      console.error("Erro ao buscar item:", err);
      return res.status(500).send('Erro ao buscar item');
    }
    if (results.length === 0) {
      return res.status(404).send('Item não encontrado');
    }
    const oldItem = results[0];
    const oldQuantity = parseInt(oldItem.quantity);

    // Se a validade não foi enviada, mantém o valor antigo exatamente (string "YYYY-MM-DD")
    if (newValidityStr === null) {
      newValidityStr = oldItem.validade;
    }

    // Atualiza o item no banco de dados
    const sql = 'UPDATE itens SET codigo_item = ?, name = ?, brand = ?, category = ?, quantity = ?, validade = ?, fornecedor = ? WHERE id = ?';
    db.query(sql, [codigo_item, name, brand, category, quantity, newValidityStr, fornecedor, id], (err, result) => {
      if (err) {
        console.error("Erro ao atualizar item:", err);
        return res.status(500).send('Erro ao atualizar item');
      }

      // Monta a mensagem de observação detalhando as alterações
      let changes = [];
      if (codigo_item !== oldItem.codigo_item) {
        changes.push(`Código alterado de "${oldItem.codigo_item}" para "${codigo_item}"`);
      }
      if (name !== oldItem.name) {
        changes.push(`Nome alterado de "${oldItem.name}" para "${name}"`);
      }
      if (brand !== oldItem.brand) {
        changes.push(`Marca alterada de "${oldItem.brand}" para "${brand}"`);
      }
      if (category !== oldItem.category) {
        changes.push(`Categoria alterada de "${oldItem.category}" para "${category}"`);
      }
      if (fornecedor !== oldItem.fornecedor) {
        changes.push(`Fornecedor alterado de "${oldItem.fornecedor}" para "${fornecedor}"`);
      }
      // Compara as strings de validade diretamente e utiliza a formatação dd/mm/aaaa na mensagem
      if (newValidityStr !== oldItem.validade) {
        changes.push(`Validade alterada de "${formatDateDDMMYYYY(oldItem.validade)}" para "${formatDateDDMMYYYY(newValidityStr)}"`);
      }
      if (quantity !== oldQuantity) {
        changes.push(`Quantidade alterada de ${oldQuantity} para ${quantity}`);
      }

      const observacao = changes.join('; ') || 'Nenhuma alteração detectada';

      // Define o tipo da movimentação baseado na variação da quantidade
      let tipo;
      if (quantity > oldQuantity) {
        tipo = 'entrada';
      } else if (quantity < oldQuantity) {
        tipo = 'saída';
      } else {
        tipo = 'edição';
      }

      const movimentoData = new Date(); // Data e hora atuais para a movimentação
      const sqlMov = `INSERT INTO movimentacoes 
        (item_id, tipo, quantidade, quantidade_anterior, quantidade_atual, data_movimento, observacao)
        VALUES (?, ?, ?, ?, ?, ?, ?)`;
      db.query(sqlMov, [id, tipo, Math.abs(quantity - oldQuantity), oldQuantity, quantity, movimentoData, observacao], (errMov, resultMov) => {
        if (errMov) {
          console.error("Erro ao registrar movimentação:", errMov);
        }
        return res.status(200).send({ message: 'Item atualizado com sucesso!' });
      });
    });
  });
});

/**
 * DELETE /estoque/:id
 * Exclui um item e registra uma movimentação de exclusão,
 * onde a quantidade anterior é o valor do item antes da exclusão e a quantidade atual passa a ser 0.
 */
app.delete('/estoque/:id', (req, res) => {
  console.log('Requisição DELETE /estoque/:id. ID:', req.params.id);
  const { id } = req.params;
  const querySelect = 'SELECT * FROM itens WHERE id = ?';
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
    const queryDelete = 'DELETE FROM itens WHERE id = ?';
    db.query(queryDelete, [id], (err, result) => {
      if (err) {
        console.error("Erro ao excluir item:", err);
        return res.status(500).send('Erro ao excluir item');
      }
      const movimentoData = new Date();
      const sqlMov = `INSERT INTO movimentacoes 
        (item_id, tipo, quantidade, quantidade_anterior, quantidade_atual, data_movimento, observacao)
        VALUES (?, ?, ?, ?, ?, ?, ?)`;
      db.query(sqlMov, [id, 'exclusão', itemQuantity, itemQuantity, 0, movimentoData, 'Item excluído'], (errMov, resultMov) => {
        if (errMov) console.error("Erro ao registrar movimentação:", errMov);
        res.status(200).send({ message: 'Item excluído com sucesso!' });
      });
    });
  });
});

/**
 * POST /movimentacoes
 * Registra uma nova movimentação manual e atualiza a quantidade do item.
 * A movimentação é registrada com o valor anterior e o valor atual em estoque.
 */
app.post('/movimentacoes', (req, res) => {
  console.log('Requisição POST /movimentacoes com body:', req.body);
  const { item_id, tipo, quantidade, data } = req.body;
  if (!item_id || !tipo || !quantidade) {
    return res.status(400).send("Campos item_id, tipo e quantidade são obrigatórios.");
  }
  db.query('SELECT quantity FROM itens WHERE id = ?', [item_id], (err, results) => {
    if (err) {
      console.error("Erro ao buscar item para movimentação:", err);
      return res.status(500).send("Erro ao buscar item");
    }
    if (results.length === 0) {
      return res.status(404).send("Item não encontrado");
    }
    const oldQuantity = parseInt(results[0].quantity);
    let sqlUpdate;
    if (tipo === 'entrada') {
      sqlUpdate = 'UPDATE itens SET quantity = quantity + ? WHERE id = ?';
    } else if (tipo === 'saída' || tipo === 'saida') {
      sqlUpdate = 'UPDATE itens SET quantity = quantity - ? WHERE id = ?';
    } else {
      return res.status(400).send("Tipo inválido. Use 'entrada' ou 'saída'.");
    }
    db.query(sqlUpdate, [quantidade, item_id], (err, result) => {
      if (err) {
        console.error("Erro ao atualizar item para movimentação:", err);
        return res.status(500).send("Erro ao atualizar item");
      }
      const newQuantity = tipo === 'entrada' ? oldQuantity + parseInt(quantidade) : oldQuantity - parseInt(quantidade);
      const movimentoData = data || new Date();
      const sqlInsert = `INSERT INTO movimentacoes 
        (item_id, tipo, quantidade, quantidade_anterior, quantidade_atual, data_movimento, observacao)
        VALUES (?, ?, ?, ?, ?, ?, ?)`;
      db.query(sqlInsert, [item_id, tipo, quantidade, oldQuantity, newQuantity, movimentoData, 'Movimentação manual'], (err2, result2) => {
        if (err2) {
          console.error("Erro ao registrar movimentação:", err2);
          return res.status(500).send("Erro ao registrar movimentação");
        }
        return res.status(200).send({ message: 'Movimentação registrada com sucesso!' });
      });
    });
  });
});

/**
 * GET /movimentacoes
 * Retorna a lista de movimentações registradas.
 */
app.get('/movimentacoes', (req, res) => {
  console.log('Requisição GET /movimentacoes recebida.');
  const sql = `
    SELECT 
      m.id,
      i.codigo_item AS item,
      i.name AS nome,
      i.brand AS marca,
      i.category AS categoria,
      i.validade AS validade,
      i.fornecedor AS fornecedor,
      m.quantidade_atual,
      m.quantidade_anterior,
      m.data_movimento AS data,
      m.observacao AS observacao
    FROM movimentacoes m
    JOIN itens i ON m.item_id = i.id
    ORDER BY m.data_movimento, m.id;
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Erro ao buscar movimentações:", err);
      return res.status(500).send("Erro ao buscar movimentações");
    }
    res.json(results);
  });
});

/**
 * GET /relatorios
 * Retorna os relatórios com os dados de movimentação.
 */
app.get('/relatorios', (req, res) => {
  console.log('Requisição GET /relatorios recebida.');
  const sql = `
    SELECT 
      m.id,
      i.codigo_item AS item,
      i.name AS nome,
      i.brand AS marca,
      i.category AS categoria,
      i.validade AS validade,
      i.fornecedor AS fornecedor,
      CASE WHEN m.tipo = 'entrada' THEN m.quantidade ELSE 0 END AS quantidade_entrada,
      CASE WHEN m.tipo = 'saída' OR m.tipo = 'saida' THEN m.quantidade ELSE 0 END AS quantidade_saida,
      m.data_movimento AS data,
      m.observacao AS observacao
    FROM movimentacoes m
    JOIN itens i ON m.item_id = i.id
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

/**
 * GET /fornecedores
 * Retorna uma lista dos fornecedores distintos.
 */
app.get('/fornecedores', (req, res) => {
  console.log('Requisição GET /fornecedores recebida.');
  const sql = 'SELECT DISTINCT fornecedor FROM itens';
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Erro ao buscar fornecedores:", err);
      return res.status(500).send("Erro ao buscar fornecedores");
    }
    res.json(results);
  });
});

// Rota para tratar URLs não encontradas
app.use((req, res) => {
  console.warn('Rota não encontrada:', req.originalUrl);
  res.status(404).send('Rota não encontrada');
});

// Inicia o servidor na porta 3000
app.listen(3000, () => {
  console.log('Servidor rodando na porta 3000');
});