# RAG Backend (Gemini free tier or local Ollama)

This service answers chat questions using the SQL records and the curated founder/investor directory used by the frontend. The curated directory adds profile biography, education, career history, sources, and uncertainty notes. The Inbox conversational helper uses Gemini (`GEMINI_API_KEY`) or OpenAI (`OPENAI_API_KEY`); use `AI_PROVIDER` to choose when both are configured. It reports clearly when no hosted model is connected and does not substitute the small local model for general-purpose answers. Local Qwen 3 0.6B through Ollama remains available for profile/search features. Paid Mistral is opt-in only through `ENABLE_MISTRAL_API=true`.

## Docker setup

From the repository root:

```powershell
docker compose up -d --build
docker compose exec ollama ollama pull qwen3:0.6b
```

The local model is downloaded once into the persistent `ollama_data` volume (about 500 MB). Health at `http://localhost:8000/health` reports the active provider. If all models are unavailable, `/chat` still answers common onboarding, conflict-screening, and fundraising-term questions locally, and searches profile records for entity lookups.

## Optional Gemini free tier

Docker Compose reads `GEMINI_API_KEY`, `GEMINI_MODEL`, and optional `GEMINI_FALLBACK_MODEL` from the repository-root `.env` file. Gemini 3.5 Flash-Lite is the default, with Gemini 3.6 Flash as a fallback for temporary model failures. Keep keys out of source control. The free tier has rate limits and may use prompts to improve Google products. Docker Compose mounts the two curated JSON profile files read-only into `/app/data`; rebuilding/recreating the RAG service refreshes its in-memory search index from those files and SQL.

The assistant explains where to find Home, Network / Find Investors, profiles, Deep Analysis / Conflict, Alerts, and Inbox; it distinguishes recorded facts from general education and inference. Conflict paths are screening leads, not legal conclusions. Investor matches do not imply current interest or available capital. Transaction-specific legal, tax, and investment questions should be checked with qualified professionals.

## Optional paid Mistral

Mistral is disabled by default to avoid unexpected charges. To explicitly enable it, set both `MISTRAL_API_KEY` and `ENABLE_MISTRAL_API=true` in the project-root `.env` file.

## Running outside Docker

Set `OLLAMA_BASE_URL` to the address of an Ollama server and `OLLAMA_MODEL` to a downloaded model name, then run:

```powershell
& "d:\one_day_bfr\venv\Scripts\python.exe" -m uvicorn app:app --reload
```

The server will start at `http://127.0.0.1:8000`.

## API Endpoints

-   `POST /chat`: Chat with the AI using RAG context.
-   `POST /search/founders`: Semantic search for founders.
-   `POST /search/investors`: Search for investors.
