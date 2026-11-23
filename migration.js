// Cria (ou recria) o banco, as tabelas e popula com dados de exemplo.
// As imagens NÃO ficam no GitHub: são URLs externas gravadas no banco.
require("dotenv").config();
const bcrypt = require("bcrypt");
const mysql = require("mysql2/promise");
const db = require("./db");

const img = (id) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=500&q=80`;

async function criar_tabelas() {
  const senhaPadrao = bcrypt.hashSync("123456", 10); // senha de teste dos clientes abaixo

  try {
    // Cria o banco caso ele ainda não exista (conectando sem selecioná-lo)
    const nomeBanco = String(process.env.DB_NAME || "2triDSC").replace(/[^a-zA-Z0-9_]/g, "");
    const admin = mysql.createPool({
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "escola",
    });
    await admin.query(
      `CREATE DATABASE IF NOT EXISTS \`${nomeBanco}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`
    );
    await admin.end();

    await db.pool.query(`
      DROP TABLE IF EXISTS item_compra;
      DROP TABLE IF EXISTS compra;
      DROP TABLE IF EXISTS produto;
      DROP TABLE IF EXISTS cliente;

      CREATE TABLE cliente (
        id int NOT NULL AUTO_INCREMENT,
        nome varchar(100) NOT NULL,
        cpf char(14) NOT NULL,
        celular varchar(15) NOT NULL,
        email varchar(100) NOT NULL,
        senha varchar(512) NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY cpf (cpf),
        UNIQUE KEY email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

      CREATE TABLE produto (
        id int NOT NULL AUTO_INCREMENT,
        nome varchar(150) NOT NULL,
        categoria varchar(100) NOT NULL,
        preco decimal(10,2) NOT NULL,
        descricao varchar(255),
        imagem varchar(1000),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

      CREATE TABLE compra (
        id int NOT NULL AUTO_INCREMENT,
        cliente_id int NOT NULL,
        data_compra datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        total decimal(10,2) NOT NULL,
        PRIMARY KEY (id),
        KEY cliente_id (cliente_id),
        CONSTRAINT fk_compra_cliente FOREIGN KEY (cliente_id) REFERENCES cliente (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

      CREATE TABLE item_compra (
        id int NOT NULL AUTO_INCREMENT,
        compra_id int NOT NULL,
        produto_id int NOT NULL,
        quantidade int NOT NULL,
        preco_unitario decimal(10,2) NOT NULL,
        PRIMARY KEY (id),
        KEY compra_id (compra_id),
        CONSTRAINT fk_item_compra FOREIGN KEY (compra_id) REFERENCES compra (id) ON DELETE CASCADE,
        CONSTRAINT fk_item_produto FOREIGN KEY (produto_id) REFERENCES produto (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    await db.pool.query(
      `INSERT INTO cliente (nome, cpf, celular, email, senha) VALUES
        ('Eduardo Henrique', '111.222.333-44', '(42)99999-4444', 'eduardo@gmail.com', ?),
        ('Lucas Silva', '222.333.444-55', '(42)99888-1111', 'lucas.silva@gmail.com', ?),
        ('Mariana Costa', '333.444.555-66', '(41)99777-2222', 'mari.costa@hotmail.com', ?)`,
      [senhaPadrao, senhaPadrao, senhaPadrao]
    );

    await db.pool.query(
      `INSERT INTO produto (nome, categoria, preco, descricao, imagem) VALUES
        ('Kimono Branco', 'kimono', 299.90, 'Kimono para treino', ?),
        ('Kimono Azul', 'kimono', 349.90, 'Kimono profissional', ?),
        ('Luva de Muay Thai', 'luva', 199.90, 'Luva 10oz', ?),
        ('Luva de Boxe', 'luva', 249.90, 'Luva 12oz', ?),
        ('Protetor Bucal', 'protetor', 29.90, 'Protetor moldável', ?),
        ('Caneleira', 'protetor', 89.90, 'Caneleira reforçada', ?),
        ('Faixa Branca', 'faixa', 39.90, 'Faixa para iniciantes', ?),
        ('Faixa Preta', 'faixa', 59.90, 'Faixa avançada', ?),
        ('Abafador Auricular', 'acessorio', 49.90, 'Proteção auditiva', ?),
        ('Saco de Pancada', 'saco', 499.90, 'Saco para treino', ?),
        ('Shorts MMA', 'shorts', 129.90, 'Shorts de treino', ?),
        ('Rashguard', 'camiseta', 159.90, 'Camiseta compressiva', ?),
        ('Tornozeleira', 'protetor', 69.90, 'Proteção para treino', ?)`,
      [
        img("photo-1517836357463-d25dfeac3438"),
        img("photo-1534438327276-14e5300c3a48"),
        img("photo-1583454110551-21f2fa2afe61"),
        img("photo-1598971639058-fab3c3109a00"),
        img("photo-1571019614242-c5c5dee9f50b"),
        img("photo-1517649763962-0c623066013b"),
        img("photo-1552674605-db6ffd4facb5"),
        img("photo-1538805060514-97d9cc17730c"),
        img("photo-1523275335684-37898b6baf30"),
        img("photo-1540497077202-7c8a3999166f"),
        img("photo-1518611012118-696072aa579a"),
        img("photo-1526506118085-60ce8714f8c5"),
        img("photo-1530549387789-4c1017266635"),
      ]
    );

    console.log("Banco configurado! Login de teste: eduardo@gmail.com / 123456");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
}

criar_tabelas();
