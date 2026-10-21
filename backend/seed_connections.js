const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password',
    database: 'startupforge_db'
});

async function seed() {
    try {
        console.log("🌱 Seeding Connections...");

        // 1. Get Investors and Founders
        const investors = (await pool.query('SELECT id, name FROM investors')).rows;
        const founders = (await pool.query('SELECT id, name FROM founders')).rows;

        if (investors.length === 0 || founders.length === 0) {
            console.error("❌ Not enough data to seed connections.");
            return;
        }

        // Define Target Users to seed connections FOR
        const markSuster = investors.find(i => i.name.includes("Mark Suster")) || investors[0];
        const oneUpHealth = founders.find(f => f.name.includes("1upHealth")) || founders[0];

        // Use UPPERCASE roles for Enum compatibility
        const targets = [
            { user: markSuster, role: 'INVESTOR', connectionsNeeded: 4 },
            { user: oneUpHealth, role: 'FOUNDER', connectionsNeeded: 4 }
        ];

        console.log(`🎯 Seeding connections for: ${targets.map(t => `${t.user.name} (${t.role})`).join(', ')}`);

        for (const target of targets) {
            let count = 0;
            // Connect to random Founders
            for (const f of founders) {
                if (String(f.id) === String(target.user.id)) continue;
                if (count >= target.connectionsNeeded) break;

                const exists = await pool.query(`SELECT 1 FROM connections WHERE (user_a_id=$1 AND user_b_id=$2) OR (user_a_id=$2 AND user_b_id=$1)`, [target.user.id, f.id]);
                if (exists.rowCount > 0) continue;

                const reqRes = await pool.query(`
                    INSERT INTO connection_requests (sender_id, sender_role, receiver_id, receiver_role, message, status, created_at, responded_at)
                    VALUES ($1, $2, $3, $4, 'Start connection', 'ACCEPTED', NOW(), NOW())
                    RETURNING id
                `, [target.user.id, target.role, f.id, 'FOUNDER']);

                const reqId = reqRes.rows[0].id;

                await pool.query(`
                    INSERT INTO connections (connection_request_id, user_a_id, user_a_role, user_b_id, user_b_role, created_at)
                    VALUES ($1, $2, $3, $4, $5, NOW())
                `, [reqId, target.user.id, target.role, f.id, 'FOUNDER']);

                console.log(`   ✅ Connected ${target.user.name} <-> ${f.name}`);
                count++;
            }

            // Connect to Investors
            for (const i of investors) {
                if (String(i.id) === String(target.user.id)) continue;
                if (count >= target.connectionsNeeded) break;

                const exists = await pool.query(`SELECT 1 FROM connections WHERE (user_a_id=$1 AND user_b_id=$2) OR (user_a_id=$2 AND user_b_id=$1)`, [target.user.id, i.id]);
                if (exists.rowCount > 0) continue;

                const reqRes = await pool.query(`
                    INSERT INTO connection_requests (sender_id, sender_role, receiver_id, receiver_role, message, status, created_at, responded_at)
                    VALUES ($1, $2, $3, $4, 'Start connection', 'ACCEPTED', NOW(), NOW())
                    RETURNING id
                `, [target.user.id, target.role, i.id, 'INVESTOR']);

                const reqId = reqRes.rows[0].id;

                await pool.query(`
                    INSERT INTO connections (connection_request_id, user_a_id, user_a_role, user_b_id, user_b_role, created_at)
                    VALUES ($1, $2, $3, $4, $5, NOW())
                `, [reqId, target.user.id, target.role, i.id, 'INVESTOR']);

                console.log(`   ✅ Connected ${target.user.name} <-> ${i.name}`);
                count++;
            }
        }

        console.log("🏁 Seeding Complete.");

    } catch (e) {
        console.error("Error seeding:", e);
    } finally {
        await pool.end();
    }
}

seed();
