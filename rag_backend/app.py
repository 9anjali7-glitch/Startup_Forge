import os
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

from fastapi import FastAPI
from pydantic import BaseModel, Field
from rag import ingest_data, query_founders, query_investors, chat_with_rag

app = FastAPI(title="Startup Forge RAG Backend")

SEC_FEED_URL = "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=D&owner=include&count=40&output=atom"
SEC_CACHE_TTL_SECONDS = 300
sec_feed_cache = {"entries": [], "fetchedAt": None, "expiresAt": 0}

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

class AssistantChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[dict] = Field(default_factory=list, max_length=12)
    userContext: str = Field(default="", max_length=3000)


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
        "openai_configured": bool(os.getenv("OPENAI_API_KEY")),
        "openai_model": os.getenv("OPENAI_MODEL", "chat-latest"),
        "assistant_provider": (
            "openai" if os.getenv("AI_PROVIDER", "gemini").lower() in ("openai", "chatgpt") and os.getenv("OPENAI_API_KEY")
            else "gemini" if os.getenv("GEMINI_API_KEY")
            else "openai" if os.getenv("OPENAI_API_KEY")
            else "mistral" if os.getenv("MISTRAL_API_KEY") and os.getenv("ENABLE_MISTRAL_API", "false").lower() == "true"
            else "unconfigured"
        ),
        "mistral_configured": bool(os.getenv("MISTRAL_API_KEY")) and os.getenv("ENABLE_MISTRAL_API", "false").lower() == "true",
        "local_model_configured": bool(ollama_url),
        "local_model_ready": local_model_ready,
        "local_model": ollama_model if ollama_url else None,
        "ai_provider": "gemini" if os.getenv("GEMINI_API_KEY") else ("ollama" if local_model_ready else ("mistral" if os.getenv("MISTRAL_API_KEY") and os.getenv("ENABLE_MISTRAL_API", "false").lower() == "true" else "profile_search")),
    }


@app.get("/market/updates")
def market_updates():
    """Public, read-only SEC Form D feed for the dashboard."""
    global sec_feed_cache
    if sec_feed_cache["entries"] and time.time() < sec_feed_cache["expiresAt"]:
        return {
            "source": "SEC EDGAR",
            "sourceUrl": "https://www.sec.gov/search-filings",
            "fetchedAt": sec_feed_cache["fetchedAt"],
            "stale": False,
            "entries": sec_feed_cache["entries"],
        }

    try:
        import httpx

        response = httpx.get(
            SEC_FEED_URL,
            headers={
                "User-Agent": os.getenv("SEC_USER_AGENT", "StartupForge/1.0 market feed"),
                "Accept": "application/atom+xml, application/xml, text/xml",
            },
            timeout=8.0,
        )
        response.raise_for_status()
        root = ET.fromstring(response.text)
        atom = "{http://www.w3.org/2005/Atom}"
        entries = []
        for item in root.findall(f"{atom}entry"):
            title = (item.findtext(f"{atom}title") or "").strip()
            updated = (item.findtext(f"{atom}updated") or item.findtext(f"{atom}published") or "").strip()
            summary = " ".join("".join(item.findtext(f"{atom}summary") or "").split())
            link = item.find(f"{atom}link")
            href = link.attrib.get("href", "") if link is not None else ""
            if title and href:
                entries.append({"title": title, "url": href, "filedAt": updated or None, "summary": summary[:600], "form": "D"})
        if not entries:
            raise ValueError("SEC filing feed contained no entries")
        fetched_at = datetime.now(timezone.utc).isoformat()
        sec_feed_cache = {"entries": entries[:30], "fetchedAt": fetched_at, "expiresAt": time.time() + SEC_CACHE_TTL_SECONDS}
        return {
            "source": "SEC EDGAR",
            "sourceUrl": "https://www.sec.gov/search-filings",
            "fetchedAt": fetched_at,
            "stale": False,
            "entries": sec_feed_cache["entries"],
        }
    except Exception as error:
        return {
            "source": "SEC EDGAR",
            "sourceUrl": "https://www.sec.gov/search-filings",
            "fetchedAt": sec_feed_cache["fetchedAt"],
            "stale": bool(sec_feed_cache["entries"]),
            "entries": sec_feed_cache["entries"],
            "error": "SEC filing feed is temporarily unavailable.",
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

@app.post("/assistant/chat")
def assistant_chat_endpoint(req: AssistantChatRequest):
    from rag import assist_with_chat
    answer = assist_with_chat(req.message, req.history, req.userContext)
    return {"response": answer}

# ---------- Autocomplete Endpoint ----------
class AutocompleteRequest(BaseModel):
    history: list[dict] = Field(default_factory=list, max_length=12)
    userContext: str = Field(default="Standard User", max_length=1000)
    draftText: str = Field(default="", max_length=2000)

from rag import generate_chat_reply

@app.post("/chat/autocomplete")
def chat_autocomplete(req: AutocompleteRequest):
    reply = generate_chat_reply(req.history, req.userContext, req.draftText)
    return {"reply": reply}

@app.get("/")
def root_status():
    return {"status": "ok"}

