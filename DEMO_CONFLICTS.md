# Conflict screening demo data

The page offers synthetic graph fixtures and public-company screening examples backed by dated public sources. The public-company example displays Berkshire Hathaway's institutional profile and wordmark; no executive headshot is used as a substitute for a firm identity. The Berkshire-to-Apple link is a reported public-equity holding, not venture funding, board rights, or proof of an actual legal or investment conflict. Public-company examples demonstrate how the graph handles a dated portfolio holding, ownership, and market overlap.

## One-time setup

Start Docker Desktop and the app, then seed the conflict records with `docker compose exec backend node seed_coi_data.js`. This merges the demo and public-source example nodes; it does not clear the graph. If the database has not been initialized yet, open <http://localhost:3000/setup-db> first.

## Values to enter manually

| Scenario | Investor or fund | Target company | Expected finding |
| --- | --- | --- | --- |
| Direct portfolio competitor | `Jordan Lee (Demo Investor)` | `Northstar Care Systems` | Level 1, 90/100. Jordan is invested in `Harbor Health Analytics`, which has an explicit `COMPETES_WITH` relationship to the target. |
| Indirect ownership path | `Jordan Lee (Demo Investor)` | `Cedarline Health` | Level 2. Jordan is invested in `Summit Digital Holdings` → it owns `Summit Care Networks` → that subsidiary competes with the target. |
| Public-company direct screening example | `Berkshire Hathaway Inc. (Public Example)` | `Samsung Electronics Co., Ltd.` | Level 1. The Berkshire Q2 2026 Form 13F-HR (period ended June 30; filed August 14) reports 227,917,808 Apple shares with a filed value of USD 65,950,296,923 as of June 30; the 2026 Samsung filing identifies Apple as a mobile-phone competitor. |
| Public-company indirect screening example | `Berkshire Hathaway Inc. (Public Example)` | `Bose Corporation` | Level 2. Berkshire Q2 2026 reported holding of 227,917,808 Apple shares (filed value USD 65,950,296,923) → Apple announced acquiring Beats Electronics → European Commission market evidence places Beats and Bose among close headphone alternatives. |

Open **Institutional Conflict Check** from the app navigation and select a quick-run card, or enter its exact investor and target values and press **Run conflict check**. The result includes a relationship graph, a plain-English explanation, risk summary, PDF screening record, and graph JSON export.

## Export the conflict graph

After running a check, use **Compliance Actions → Export Graph JSON**. The downloaded JSON contains the graph nodes and relationship edges returned by the database, plus edge evidence properties such as `evidence_type`, `source_url`, and `source_as_of` where recorded. Synthetic fixtures have no public-source URL. The export records the screening graph; it does not certify the underlying information.

## What the result means

- **Direct portfolio competition** means an explicit portfolio-company-to-target `COMPETES_WITH` relationship exists in the graph. The result still asks the reviewer to verify the evidence source and current status.
- **Indirect ownership path** means the investor has exposure to a parent with a subsidiary recorded as competing with the target.
- **Sector overlap** is shown as a lower-confidence screening signal. A shared sector alone does not establish that two companies compete.
- The displayed screening priority is a heuristic for demo triage, not a probability or legal risk assessment.
- The fictional records are marked synthetic. Public-company examples carry the cited source URL and source date on graph relationships. Those sources establish only the reported holding, ownership, or market context described; they do not establish a real conflict, current exposure, or a legal conclusion. Recheck holdings and competitive relationships before using them outside a demonstration.


## Public-source references

- Berkshire Hathaway company logo (Wikimedia Commons, public-domain wordmark): <https://commons.wikimedia.org/wiki/File:Berkshire-Hathaway-Logo.svg>
- Berkshire leadership change (company news release, 2026-09-18): <https://www.berkshirehathaway.com/news/sep1826.pdf>
- Berkshire Hathaway Q2 2026 Form 13F-HR (holdings as of June 30, filed August 14): <https://www.sec.gov/Archives/edgar/data/1067983/000119312526352200/0001193125-26-352200-index.htm>
- Samsung Electronics filing identifying Apple as a mobile-phone competitor (2026-03-12): <https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0312/2026031200834.pdf>
- Apple announcement to acquire Beats Electronics (2014-05-28): <https://www.apple.com/gr/newsroom/2014/05/28Apple-to-Acquire-Beats-Music-Beats-Electronics/>
- European Commission merger decision discussing headphone alternatives including Beats and Bose (2014-07-25): <https://ec.europa.eu/competition/mergers/cases/decisions/m7290_20140725_20310_3804651_EN.pdf>
Run this from the project root after `docker compose up -d`; it merges the fixtures without clearing the graph:

```powershell
docker compose exec backend node seed_coi_data.js
```

The seeder only merges its demo nodes and relationships; it does not delete database data.


