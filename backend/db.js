const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';
const connectionString = process.env.DATABASE_URL;

const pool = new Pool(
  connectionString
    ? {
      connectionString,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
    }
    : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'startupforge_db',
    }
);

module.exports = pool;
