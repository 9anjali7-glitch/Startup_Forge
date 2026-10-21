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
        console.log("🛠 Creating chat_rooms table...");

        await pool.query(`
            CREATE TABLE IF NOT EXISTS chat_rooms (
                id SERIAL PRIMARY KEY,
                connection_id INTEGER REFERENCES connections(id) ON DELETE CASCADE,
                room_key TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT unique_connection_id UNIQUE (connection_id)
            );
        `);

        console.log("✅ Table 'chat_rooms' created successfully.");
    } catch (e) {
        console.error("Error creating table:", e);
    } finally {
        await pool.end();
    }
}

createTable();
