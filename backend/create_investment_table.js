
const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password',
    database: 'startupforge_db'
});

async function createTable() {
    try {
        console.log("🔌 Connecting to Postgres...");

        await pool.query(`
            CREATE TABLE IF NOT EXISTS investment_reports (
                id SERIAL PRIMARY KEY,
                connection_id INTEGER NOT NULL REFERENCES connections(id),
                submitted_by VARCHAR(50) NOT NULL,
                role VARCHAR(20) NOT NULL,
                round VARCHAR(50),
                year INTEGER,
                amount NUMERIC,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("✅ Table 'investment_reports' created successfully.");

        // Add indexes
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_inv_connection ON investment_reports(connection_id);`);

    } catch (err) {
        console.error("❌ Error creating table:", err.message);
    } finally {
        await pool.end();
    }
}

createTable();
