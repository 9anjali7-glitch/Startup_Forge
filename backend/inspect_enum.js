const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password',
    database: 'startupforge_db'
});

async function checkEnum() {
    try {
        console.log("🔍 Checking user_role_enum...");
        const res = await pool.query(`
            SELECT unnest(enum_range(NULL::user_role_enum)) AS role_value
        `);
        console.log("Enum Values:", res.rows.map(r => r.role_value));

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await pool.end();
    }
}

checkEnum();
