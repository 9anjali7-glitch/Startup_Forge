const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password', // Assuming same as Neo4j for now, or maybe empty? Try user's env logic?
    // Wait, db.js didn't have a password. It might be passwordless or Env var.
    // I will try adding password from common patterns or Env if db.js fails. 
    // Let's assume standard local dev: 'postgres'/'postgres' or 'postgres'/'password'
    // Actually, db.js had NO password.
    database: 'startupforge_db'
});

// Try to handle password from env if exists, or try default
// But `db.js` showed explicit object without password. 
// If `db.js` works for the app, it must work here.
// But `db.js` might have relied on PGPASSWORD env var being set in the shell?
// Or maybe it's "trust" auth.

async function inspect() {
    try {
        console.log("🔌 Connecting to Postgres...");
        const res = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log("📂 Tables found:");
        const tables = res.rows.map(r => r.table_name);
        console.log(tables.join(", "));

        for (const table of tables) {
            console.log(`\n📄 Schema for table: ${table}`);
            const cols = await pool.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = $1
            `, [table]);
            cols.rows.forEach(c => console.log(`   - ${c.column_name} (${c.data_type})`));

            // Sample data
            const sample = await pool.query(`SELECT * FROM "${table}" LIMIT 1`);
            if (sample.rows.length > 0) {
                console.log(`   📝 Sample Row:`, JSON.stringify(sample.rows[0]));
            } else {
                console.log(`   📝 Table is empty.`);
            }
        }

    } catch (err) {
        console.error("❌ Postgres Error:", err.message);
    } finally {
        await pool.end();
    }
}

inspect();
