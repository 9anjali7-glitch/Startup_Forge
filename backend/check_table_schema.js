
const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password',
    database: 'startupforge_db'
});

async function inspect() {
    try {
        console.log("🔌 Connecting to Postgres...");

        // 1. Get Columns
        const cols = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'connections'
        `);
        console.log("\nFounders Columns:");
        cols.rows.forEach(c => console.log(`   - ${c.column_name}: ${c.data_type}`));

        // 2. Get Enums if any
        const enums = await pool.query(`
            SELECT t.typname, e.enumlabel
            FROM pg_type t 
            JOIN pg_enum e ON t.oid = e.enumtypid
            WHERE t.typname LIKE '%role%' OR t.typname LIKE '%status%'
            ORDER BY t.typname
        `);
        console.log("\n📄 Enum Definitions:");
        enums.rows.forEach(r => console.log(`   - ${r.typname}: '${r.enumlabel}'`));

    } catch (err) {
        console.error("❌ Postgres Error:", err.message);
    } finally {
        await pool.end();
    }
}

inspect();
