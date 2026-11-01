# StartupForge

StartupForge is a startup and investor matching application. The local stack contains a React frontend, Node API, PostgreSQL, Neo4j, Gun relay, RAG service, and prediction service.

## Run the full stack (recommended)

Prerequisites: Docker Desktop with Docker Compose enabled.

1. In the project root, copy `.env.example` to `.env`. The local compose stack allows browser requests from `localhost:5173` by default. If you want to call the protected setup endpoints, set a private `ADMIN_API_KEY`. To use generated replies, configure a supported provider key as `GEMINI_API_KEY`; the assistant falls back to the configured local Ollama model. Paid Mistral calls are disabled unless `ENABLE_MISTRAL_API=true` is explicitly set.
2. Start the services in the background:

   ```powershell
   docker compose up -d --build
   ```

3. Download the local Qwen model once (about 2.5 GB):

   ```powershell
   docker compose exec ollama ollama pull qwen3:0.6b
   ```

   Ollama keeps the model in a Docker volume. The assistant continues to use profile search while the local model downloads or whenever no AI provider is configured.
4. Open <http://localhost:5173>. The API is at <http://localhost:3000>; PostgreSQL is on `5432`, Neo4j Browser on `7474`, Gun on `8765`, RAG on `8000`, and prediction on `8002`.
5. Set a private `ADMIN_API_KEY` in `.env`, restart Compose so the backend receives it, then initialize the database and sync profiles to Neo4j with the protected POST endpoint:

   ```powershell
   $adminKey = Read-Host "ADMIN_API_KEY from .env"
   Invoke-RestMethod -Method Post -Uri "http://localhost:3000/setup-db" -Headers @{ "x-admin-api-key" = $adminKey }
   ```

   The legacy setup URL is no longer a public GET route. The `/seed-full` route is also a protected POST. Sign in with an exact person name or company/fund name, such as 1upHealth (founder) or Mark Suster (investor).
6. Demo workflows after setup: Mark Suster and 1upHealth have an accepted inbox connection. For direct and indirect conflict screening, open [DEMO_CONFLICTS.md](DEMO_CONFLICTS.md) for exact synthetic data and click-through instructions. The demo conflict records are clearly identified as synthetic and the setup route can be rerun safely.

## Security and deployment status

- Production sign-up and sign-in use email/password accounts, scrypt password hashes, random server-issued sessions, and server-side user-ID authorization for messaging, connections, investment, and conflict APIs. Session tokens are stored in the browser's per-tab session storage and expire after seven days.
- Email ownership verification, password recovery, and professional/accreditation verification are not implemented yet. Account profile claims are self-reported and must not be treated as verified diligence evidence. Do not use the deployment for real investment decisions until those controls and a privacy review are complete.
- Name-only sign-in remains a local demo flow and is disabled by default when `NODE_ENV=production`; do not set `ALLOW_INSECURE_DEMO_LOGIN=true` on a public deployment.
- The Render blueprint requires the exact frontend origins in `CORS_ORIGINS` and a reachable Neo4j service in `NEO4J_URI`, `NEO4J_USER`, and `NEO4J_PASSWORD`. Render does not provision Neo4j in this blueprint; the backend health check stays degraded until it can reach both PostgreSQL and Neo4j.
- Keep database dumps and graph backups under `backupdb/backups/`; that directory is git-ignored.

Stop the stack with `Ctrl+C`, or run `docker compose down`. Persistent database data is kept in Docker volumes. To remove the data volumes as well, run `docker compose down -v`.

## Run services without Docker

Use Node.js 18 or newer, Python 3.10 or newer, PostgreSQL, and Neo4j. Install the Node dependencies in `backend`, `gun_server`, and `frontend` with `npm install`. Install Python dependencies from each service's `requirements.txt`, then start PostgreSQL and Neo4j with credentials matching `.env`.

Start the API with `npm start` in `backend`, the relay with `npm start` in `gun_server`, the RAG service with `python -m uvicorn app:app --host 0.0.0.0 --port 8000` in `rag_backend`, the prediction service with `python -m uvicorn app:app --host 0.0.0.0 --port 8002` in `growth_predict/models/investor_backend`, and the UI with `npm run dev` in `frontend`. Open the Vite URL printed in the terminal.

If a port is already in use, stop the process using that port or change the published port in `docker-compose.yml`.
