# StartupForge

StartupForge is a startup and investor matching application. The local stack contains a React frontend, Node API, PostgreSQL, Neo4j, Gun relay, RAG service, and prediction service.

## Run the full stack (recommended)

Prerequisites: Docker Desktop with Docker Compose enabled.

1. In the project root, copy `.env.example` to `.env` if you want to change the local Neo4j password or enable Mistral AI features. Founder and investor keyword search works without a Mistral key; semantic ranking and generated AI replies need `MISTRAL_API_KEY`.
2. Start the services:

   ```powershell
   docker compose up --build
   ```

3. Open <http://localhost:5173>. The API is at <http://localhost:3000>; PostgreSQL is on `5432`, Neo4j Browser on `7474`, Gun on `8765`, RAG on `8000`, and prediction on `8002`.
4. Initialize the PostgreSQL tables and synchronize founder and investor profiles into Neo4j by opening <http://localhost:3000/setup-db>. Sign in with 1upHealth (founder) or Mark Suster (investor). PostgreSQL currently contains 159 founders and 53 investors; Neo4j also includes the restored company, investor, and domain graph.
5. Demo workflows after setup: Mark Suster and 1upHealth have an accepted inbox connection; the conflict checker includes `Demo Direct Conflict Co` (direct portfolio/sector overlap) and `Demo Indirect Conflict Co` (invested parent → subsidiary → competitor). The setup route uses `MERGE`, so it can be rerun safely.

Stop the stack with `Ctrl+C`, or run `docker compose down`. Persistent database data is kept in Docker volumes. To remove the data volumes as well, run `docker compose down -v`.

## Run services without Docker

Use Node.js 18 or newer, Python 3.10 or newer, PostgreSQL, and Neo4j. Install the Node dependencies in `backend`, `gun_server`, and `frontend` with `npm install`. Install Python dependencies from each service's `requirements.txt`, then start PostgreSQL and Neo4j with credentials matching `.env`.

Start the API with `npm start` in `backend`, the relay with `npm start` in `gun_server`, the RAG service with `python -m uvicorn app:app --host 0.0.0.0 --port 8000` in `rag_backend`, the prediction service with `python -m uvicorn app:app --host 0.0.0.0 --port 8002` in `growth_predict/models/investor_backend`, and the UI with `npm run dev` in `frontend`. Open the Vite URL printed in the terminal.

If a port is already in use, stop the process using that port or change the published port in `docker-compose.yml`.
