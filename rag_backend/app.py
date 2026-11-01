import os

from fastapi import FastAPI
from pydantic import BaseModel, Field
from rag import ingest_data, query_founders, query_investors, chat_with_rag

app = FastAPI(title="Startup Forge RAG Backend")

from fastapi.middleware.cors import CORSMiddleware

allowed_origins = [origin.strip() for origin in os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Models ----------
class QueryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=20)

class ChatRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    history: list[dict] = Field(default_factory=list, max_length=12)


# ---------- Startup ----------
@app.on_event("startup")
def load_data():
    ingest_data()


@app.get("/health")
def health_check():
    import os
    import httpx
    ollama_url = os.getenv("OLLAMA_BASE_URL", "").rstrip("/")
    ollama_model = os.getenv("OLLAMA_MODEL", "qwen3:0.6b")
    local_model_ready = False
    if ollama_url:
        try:
            response = httpx.get(f"{ollama_url}/api/tags", timeout=2.0)
            response.raise_for_status()
            local_model_ready = any(
                item.get("name") == ollama_model or item.get("model") == ollama_model
                for item in response.json().get("models", [])
            )
        except Exception:
            pass
    return {
        "status": "ok",
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY")),
        "gemini_model": os.getenv("GEMINI_MODEL", "gemini-3.8-flash"),
        "mistral_configured": bool(os.getenv("MISTRAL_API_KEY")) and os.getenv("ENABLE_MISTRAL_API", "false").lower() == "true",
        "local_model_configured": bool(ollama_url),
        "local_model_ready": local_model_ready,
        "local_model": ollama_model if ollama_url else None,
        "ai_provider": "gemini" if os.getenv("GEMINI_API_KEY") else ("ollama" if local_model_ready else ("mistral" if os.getenv("MISTRAL_API_KEY") and os.getenv("ENABLE_MISTRAL_API", "false").lower() == "true" else "profile_search")),
    }

# ---------- APIs ----------
@app.post("/search/founders")
def search_founders(req: QueryRequest):
    res = query_founders(req.query, req.top_k)
    results = []
    if res["documents"] and res["metadatas"]:
        docs = res["documents"][0]
        metas = res["metadatas"][0]
        for i in range(len(docs)):
            results.append({
                "text": docs[i],
                "id": metas[i].get("id")
            })
            
    return {
        "query": req.query,
        "results": results
    }


@app.post("/search/investors")
def search_investors(req: QueryRequest):
    res = query_investors(req.query, req.top_k)
    results = []
    if res["documents"] and res["metadatas"]:
        docs = res["documents"][0]
        metas = res["metadatas"][0]
        for i in range(len(docs)):
            results.append({
                "text": docs[i],
                "id": metas[i].get("id")
            })

    return {
        "query": req.query,
        "results": results
    }


@app.post("/chat")
def chat_endpoint(req: ChatRequest):
    answer = chat_with_rag(req.query, req.history)
    return {"response": answer}

# ---------- Autocomplete Endpoint ----------
class AutocompleteRequest(BaseModel):
    history: list[dict] = Field(default_factory=list, max_length=12)
    userContext: str = Field(default="Standard User", max_length=1000)

from rag import generate_chat_reply

@app.post("/chat/autocomplete")
def chat_autocomplete(req: AutocompleteRequest):
    reply = generate_chat_reply(req.history, req.userContext)
    return {"reply": reply}

@app.get("/")
def root_status():
    return {"status": "ok"}
