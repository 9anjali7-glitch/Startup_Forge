const express = require('express');
const router = express.Router();
const pool = require('./db');

function parseFundingAmount(value) {
    if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : NaN;
    if (typeof value !== 'string') return NaN;
    const cleaned = value.trim().toLowerCase().replace(/[$,\s]/g, '');
    const match = cleaned.match(/^([0-9]*\.?[0-9]+)(billion|million|bn|m|k)?$/);
    if (!match) return NaN;
    const scale = { billion: 1e9, bn: 1e9, million: 1e6, m: 1e6, k: 1e3 }[match[2]] || 1;
    const amount = Number(match[1]) * scale;
    return Number.isFinite(amount) && amount > 0 ? amount : NaN;
}

// GET Growth Prediction for a Founder
router.get('/growth/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const query = `SELECT * FROM founders WHERE id = $1`;
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Founder not found" });
        }

        const founder = result.rows[0];
        const history = Array.isArray(founder.past_funding)
            ? founder.past_funding
            : founder.past_funding && typeof founder.past_funding === 'object' ? [founder.past_funding] : [];
        const observations = history.map((round) => ({
            round: String(round.round || 'Funding round'),
            year: Number(round.year),
            amount: parseFundingAmount(round.amount),
        })).filter((round) => Number.isFinite(round.year) && round.year > 1900 && Number.isFinite(round.amount) && round.amount > 0)
          .sort((a, b) => a.year - b.year);
        if (!observations.length) {
            return res.status(422).json({ error: 'No dated funding round with a numeric amount is recorded for this founder.' });
        }
        const distinctYears = [...new Set(observations.map((round) => round.year))];
        let annualizedChange = null;
        let trend = 'Not enough dated rounds to establish a trend';
        if (observations.length >= 2 && distinctYears.length >= 2) {
            const first = observations[0];
            const latest = observations[observations.length - 1];
            const elapsedYears = latest.year - first.year;
            if (elapsedYears > 0) {
                annualizedChange = Math.pow(latest.amount / first.amount, 1 / elapsedYears) - 1;
                if (!Number.isFinite(annualizedChange)) return res.status(422).json({ error: 'Recorded round amounts are outside a usable numeric range.' });
                trend = annualizedChange > 0.05 ? 'Increasing round sizes' : annualizedChange < -0.05 ? 'Decreasing round sizes' : 'Broadly stable round sizes';
            }
        }
        res.json({
            company: founder.company,
            annualized_change: annualizedChange,
            trend,
            basis: 'Funding-round amounts stored in the founder profile; not independently verified. This is not revenue growth or a valuation forecast.',
            observations,
            as_of: new Date().toISOString(),
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Server Error" });
    }
});

module.exports = router;
