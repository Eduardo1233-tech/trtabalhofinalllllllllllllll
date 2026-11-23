// Conexão com o MySQL (mysql2/promise)
require("dotenv").config();
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "escola",
  database: process.env.DB_NAME || "2triDSC",
  waitForConnections: true,
  connectionLimit: 10,
  multipleStatements: true, // necessário apenas para a migration
});

module.exports = Object.freeze({ pool });
