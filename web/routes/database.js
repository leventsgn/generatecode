const express = require('express');
const router = express.Router();

router.post('/test-connection', async (req, res) => {
  const { provider, host, port, database, user, password } = req.body;

  try {
    if (provider === 'postgresql') {
      const { Client } = require('pg');
      const client = new Client({ host, port: port || 5432, database, user, password });
      await client.connect();
      await client.end();
      return res.json({ success: true, message: 'PostgreSQL bağlantısı başarılı!' });
    }

    if (provider === 'mysql') {
      const mysql = require('mysql2/promise');
      const conn = await mysql.createConnection({ host, port: port || 3306, database, user, password });
      await conn.end();
      return res.json({ success: true, message: 'MySQL bağlantısı başarılı!' });
    }

    if (provider === 'mssql') {
      const sql = require('mssql');
      const config = {
        server: host,
        port: port || 1433,
        database,
        user,
        password,
        options: { encrypt: false, trustServerCertificate: true }
      };
      const pool = await sql.connect(config);
      await pool.close();
      return res.json({ success: true, message: 'SQL Server bağlantısı başarılı!' });
    }

    return res.status(400).json({ success: false, message: 'Desteklenmeyen veritabanı sağlayıcısı.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: `Bağlantı hatası: ${err.message}` });
  }
});

router.post('/tables', async (req, res) => {
  const { provider, host, port, database, user, password } = req.body;

  try {
    let tables = [];

    if (provider === 'postgresql') {
      const { Client } = require('pg');
      const client = new Client({ host, port: port || 5432, database, user, password });
      await client.connect();
      const result = await client.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
      );
      tables = result.rows.map(r => r.table_name);
      await client.end();
    } else if (provider === 'mysql') {
      const mysql = require('mysql2/promise');
      const conn = await mysql.createConnection({ host, port: port || 3306, database, user, password });
      const [rows] = await conn.query('SHOW TABLES');
      tables = rows.map(r => Object.values(r)[0]);
      await conn.end();
    } else if (provider === 'mssql') {
      const sql = require('mssql');
      const config = {
        server: host, port: port || 1433, database, user, password,
        options: { encrypt: false, trustServerCertificate: true }
      };
      const pool = await sql.connect(config);
      const result = await pool.query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME");
      tables = result.recordset.map(r => r.TABLE_NAME);
      await pool.close();
    }

    return res.json({ success: true, tables });
  } catch (err) {
    return res.status(500).json({ success: false, message: `Hata: ${err.message}` });
  }
});

router.post('/columns', async (req, res) => {
  const { provider, host, port, database, user, password, tableName } = req.body;

  try {
    let columns = [];

    if (provider === 'postgresql') {
      const { Client } = require('pg');
      const client = new Client({ host, port: port || 5432, database, user, password });
      await client.connect();

      const colResult = await client.query(`
        SELECT c.column_name, c.data_type, c.is_nullable, c.character_maximum_length,
               CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN true ELSE false END as is_primary_key
        FROM information_schema.columns c
        LEFT JOIN information_schema.key_column_usage kcu ON c.column_name = kcu.column_name AND c.table_name = kcu.table_name
        LEFT JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name AND tc.constraint_type = 'PRIMARY KEY'
        WHERE c.table_name = $1 AND c.table_schema = 'public'
        ORDER BY c.ordinal_position
      `, [tableName]);

      columns = colResult.rows.map(r => ({
        name: r.column_name,
        dataType: mapPostgresType(r.data_type),
        isNullable: r.is_nullable === 'YES',
        maxLength: r.character_maximum_length,
        isPrimaryKey: r.is_primary_key || false
      }));
      await client.end();
    } else if (provider === 'mysql') {
      const mysql = require('mysql2/promise');
      const conn = await mysql.createConnection({ host, port: port || 3306, database, user, password });
      const [rows] = await conn.query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH, COLUMN_KEY
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `, [database, tableName]);
      columns = rows.map(r => ({
        name: r.COLUMN_NAME,
        dataType: mapMysqlType(r.DATA_TYPE),
        isNullable: r.IS_NULLABLE === 'YES',
        maxLength: r.CHARACTER_MAXIMUM_LENGTH,
        isPrimaryKey: r.COLUMN_KEY === 'PRI'
      }));
      await conn.end();
    } else if (provider === 'mssql') {
      const sql = require('mssql');
      const config = {
        server: host, port: port || 1433, database, user, password,
        options: { encrypt: false, trustServerCertificate: true }
      };
      const pool = await sql.connect(config);
      const result = await pool.query(`
        SELECT c.COLUMN_NAME, c.DATA_TYPE, c.IS_NULLABLE, c.CHARACTER_MAXIMUM_LENGTH,
               CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS IS_PRIMARY_KEY
        FROM INFORMATION_SCHEMA.COLUMNS c
        LEFT JOIN (
          SELECT ku.TABLE_NAME, ku.COLUMN_NAME
          FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
          JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
          WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
        ) pk ON c.TABLE_NAME = pk.TABLE_NAME AND c.COLUMN_NAME = pk.COLUMN_NAME
        WHERE c.TABLE_NAME = '${tableName}'
        ORDER BY c.ORDINAL_POSITION
      `);
      columns = result.recordset.map(r => ({
        name: r.COLUMN_NAME,
        dataType: mapMssqlType(r.DATA_TYPE),
        isNullable: r.IS_NULLABLE === 'YES',
        maxLength: r.CHARACTER_MAXIMUM_LENGTH,
        isPrimaryKey: r.IS_PRIMARY_KEY === 1
      }));
      await pool.close();
    }

    return res.json({ success: true, columns });
  } catch (err) {
    return res.status(500).json({ success: false, message: `Hata: ${err.message}` });
  }
});

function mapPostgresType(dbType) {
  const map = {
    'integer': 'int', 'bigint': 'long', 'smallint': 'short',
    'boolean': 'bool', 'character varying': 'string', 'text': 'string',
    'numeric': 'decimal', 'real': 'float', 'double precision': 'double',
    'timestamp without time zone': 'DateTime', 'timestamp with time zone': 'DateTime',
    'date': 'DateTime', 'uuid': 'Guid', 'bytea': 'byte[]',
  };
  return map[dbType] || 'string';
}

function mapMysqlType(dbType) {
  const map = {
    'int': 'int', 'bigint': 'long', 'smallint': 'short', 'tinyint': 'bool',
    'varchar': 'string', 'text': 'string', 'char': 'string', 'longtext': 'string',
    'decimal': 'decimal', 'float': 'float', 'double': 'double',
    'datetime': 'DateTime', 'date': 'DateTime', 'timestamp': 'DateTime',
    'bit': 'bool', 'blob': 'byte[]',
  };
  return map[dbType] || 'string';
}

function mapMssqlType(dbType) {
  const map = {
    'int': 'int', 'bigint': 'long', 'smallint': 'short', 'tinyint': 'byte',
    'nvarchar': 'string', 'varchar': 'string', 'ntext': 'string', 'text': 'string', 'char': 'string',
    'decimal': 'decimal', 'money': 'decimal', 'float': 'double', 'real': 'float',
    'datetime': 'DateTime', 'datetime2': 'DateTime', 'date': 'DateTime',
    'bit': 'bool', 'uniqueidentifier': 'Guid', 'varbinary': 'byte[]',
  };
  return map[dbType] || 'string';
}

module.exports = router;
