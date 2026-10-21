const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const csv = require('csv-parser');

// Use existing connection from db.js logic or create new
const pool = require('./db');

async function seedFullDatabase(res) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        console.log("🌱 Starting Full Database Seed from CSVs...");

        // 1. Clear existing data (Optional: good for clean slate during debugging)
        // await client.query('TRUNCATE founders, investors, connections RESTART IDENTITY CASCADE;');

        // --- SEED INVESTORS ---
        const investorsCsvPath = path.join(__dirname, '../rag_backend/investors_cleaned.csv');
        if (fs.existsSync(investorsCsvPath)) {
            const investors = [];

            await new Promise((resolve, reject) => {
                fs.createReadStream(investorsCsvPath)
                    .pipe(csv())
                    .on('data', (data) => investors.push(data))
                    .on('end', resolve)
                    .on('error', reject);
            });

            console.log(`Processing ${investors.length} investors...`);

            for (const inv of investors) {
                if (!inv.name) continue;

                // Check duplicate by investor name
                const check = await client.query(
                    "SELECT id FROM investors WHERE name = $1",
                    [inv.name]
                );

                if (check.rows.length === 0) {
                    await client.query(`
                        INSERT INTO investors
                        (name, firm_name, short_bio, location, profile_url, primary_domain)
                        VALUES ($1, $2, $3, $4, $5, $6)
                    `, [
                        inv.name,
                        inv.firm_name || null,
                        inv.short_bio || null,
                        inv.location || null,
                        inv.profile_url || null,
                        inv.primary_domain || null
                    ]);
                }
            }
        } else {
            console.log("⚠️ investors_cleaned.csv not found.");
        }

        // --- SEED FOUNDERS ---
        const foundersCsvPath = path.join(__dirname, '../rag_backend/founders_cleaned.csv');

        if (fs.existsSync(foundersCsvPath)) {
            const founders = [];

            await new Promise((resolve, reject) => {
                fs.createReadStream(foundersCsvPath)
                    .pipe(csv())
                    .on('data', (data) => founders.push(data))
                    .on('end', resolve)
                    .on('error', reject);
            });

            console.log(`Processing ${founders.length} founders...`);

            for (const f of founders) {
                if (!f.name) continue;

                // IMPORTANT:
                // Check duplicate by COMPANY, not founder name.
                // Multiple companies can have the same founder name,
                // such as "John Smith", "Bing", etc.
                const check = await client.query(
                    "SELECT id FROM founders WHERE company = $1",
                    [f.company || f.name]
                );

                if (check.rows.length === 0) {
                    let pastFundingJson = '[]';

                    try {
                        if (f.past_funding) {
                            let cleanJson = f.past_funding.replace(/'/g, '"');
                            JSON.parse(cleanJson);
                            pastFundingJson = cleanJson;
                        }
                    } catch (e) {
                        pastFundingJson = '[]';
                    }

                    await client.query(`
                        INSERT INTO founders
                        (name, company, description, location, domain, valuation, round, year, past_funding)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    `, [
                        f.name,
                        f.company || f.name,
                        f.description || `Founder of ${f.company}`,
                        f.location || 'Global',
                        f.domain || null,
                        parseFloat(f.valuation) || 0,
                        f.round || 'Seed',
                        parseInt(f.funding_year) || 2022,
                        pastFundingJson
                    ]);
                }
            }
        } else {
            console.log("⚠️ founders_cleaned.csv not found.");
        }

        await client.query('COMMIT');

        if (res) {
            res.send(`
                <h1>Full Seed Complete ✅</h1>
                <p>Imported data from CSVs.</p>
                <a href="/">Go Home</a>
            `);
        } else {
            console.log("✅ Seed completed via CLI");
        }

    } catch (e) {
        await client.query('ROLLBACK');
        console.error("❌ Seed Failed:", e);

        if (res) {
            res.status(500).send("Seed Failed: " + e.message);
        }
    } finally {
        client.release();
    }
}

module.exports = seedFullDatabase;