from fastapi import FastAPI
from pydantic import BaseModel
from rag import ingest_data, query_founders, query_investors, chat_with_rag

app = FastAPI(title="Startup Forge RAG Backend")

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Models ----------
class QueryRequest(BaseModel):
    query: str
    top_k: int = 5


# ---------- Startup ----------
@app.on_event("startup")
def load_data():
    ingest_data()


@app.get("/health")
def health_check():
    import os
    return {"status": "ok", "mistral_configured": bool(os.getenv("MISTRAL_API_KEY"))}

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
def chat_endpoint(req: QueryRequest):
    answer = chat_with_rag(req.query)
    return {"response": answer}

# ---------- Autocomplete Endpoint ----------
class AutocompleteRequest(BaseModel):
    history: list # List of objects
    userContext: str = "Standard User"

from rag import generate_chat_reply

@app.post("/chat/autocomplete")
def chat_autocomplete(req: AutocompleteRequest):
    reply = generate_chat_reply(req.history, req.userContext)
    return {"reply": reply}

@app.get("/")
def health_check():
    return {"status": "ok"}
    return {"status": "ok"}
