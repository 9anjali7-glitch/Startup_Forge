const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password',
    database: 'startupforge_db'
});

async function debugSQL() {
    try {
        console.log("🐞 Debugging SQL Query...");
        const userId = 3;

        // The query from server.js
        const query = `
            SELECT 
                f.id, 
                f.name, 
                f.company AS headline, 
                'founder' as role,
                'https://cdn-icons-png.flaticon.com/512/149/149071.png' as avatar,
                (SELECT COUNT(*) FROM connections WHERE user_a_id = f.id OR user_b_id = f.id) as connections,
                CASE 
                    WHEN $1::int IS NOT NULL THEN (
                        SELECT 1 FROM connections 
                        WHERE (user_a_id = $1::int AND user_b_id = f.id) 
                           OR (user_a_id = f.id AND user_b_id = $1::int)
                    )
                    ELSE NULL
                END as is_connected
            FROM founders f
            ORDER BY f.id DESC
            LIMIT 100
        `;

        console.log("Running query with param:", userId);
        const result = await pool.query(query, [userId]);
        console.log("✅ Success! Rows:", result.rowCount);
    } catch (e) {
        console.error("❌ SQL Error Full Details:", e);
    } finally {
        await pool.end();
    }
}

debugSQL();
