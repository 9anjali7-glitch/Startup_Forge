import os
import csv
import uuid
import math
import time
import re
import psycopg2
from psycopg2.extras import RealDictCursor
from mistralai.client import MistralClient
from mistralai.models.chat_completion import ChatMessage
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

# ---------- Mistral Init ----------
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")
MISTRAL_CLIENT = MistralClient(api_key=MISTRAL_API_KEY) if MISTRAL_API_KEY else None
MISTRAL_MODEL = "mistral-small-latest"

# ---------- In-Memory Store ----------
# Structure: [ { "id": str, "text": str, "embedding": List[float], "metadata": dict } ]
FOUNDER_STORE = []
INVESTOR_STORE = []

# ---------- Helpers ----------
def get_embedding(text):
    if not text or not text.strip():
        return None
    try:
        resp = MISTRAL_CLIENT.embeddings.create(
            model="mistral-embed",
            inputs=[text]
        )
        return resp.data[0].embedding
    except Exception as e:
        print(f"Embedding error: {e}")
        return None

def cosine_similarity(v1, v2):
    if not v1 or not v2: return 0.0
    dot_product = sum(a * b for a, b in zip(v1, v2))
    magnitude1 = math.sqrt(sum(a * a for a in v1))
    magnitude2 = math.sqrt(sum(b * b for b in v2))
    if magnitude1 == 0 or magnitude2 == 0: return 0.0
    return dot_product / (magnitude1 * magnitude2)

def row_to_text(row, role):
    parts = []
    if role == "founder":
        if row.get("company"): parts.append(f"Company: {row['company']}.")
        if row.get("name"): parts.append(f"Founder: {row['name']}.")
        if row.get("funding_round") or row.get("round"): parts.append(f"Funding round: {row.get('funding_round') or row.get('round')}.")
        for field, label in (("domain", "Domain"), ("domain_clean", "Domain"), ("location", "Location"), ("description", "Description"), ("valuation", "Valuation"), ("funding_year", "Funding year"), ("funding_amount", "Funding amount"), ("round", "Round"), ("past_funding", "Past funding")):
            if row.get(field): parts.append(f"{label}: {row[field]}.")
    else:
        if row.get("name"): parts.append(f"Investor name: {row['name']}.")
        if row.get("firm_name"): parts.append(f"Firm: {row['firm_name']}.")
        if row.get("investment_stage_pref"): parts.append(f"Preferred stage: {row['investment_stage_pref']}.")
        if row.get("primary_domain"): parts.append(f"Domain: {row['primary_domain']}.")
        for field, label in (("location", "Location"), ("investment_thesis", "Investment thesis"), ("notable_investments", "Notable investments"), ("secondary_domains", "Other domains"), ("tags", "Tags")):
            if row.get(field): parts.append(f"{label}: {row[field]}.")
    return " ".join(parts)

# ---------- Ingest ----------
def ingest_data():
    global FOUNDER_STORE, INVESTOR_STORE

    if FOUNDER_STORE or INVESTOR_STORE:
        return "Already ingested"

    print("Starting data ingestion...")
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST", "localhost"), port=os.getenv("DB_PORT", "5432"),
            user=os.getenv("DB_USER", "postgres"), password=os.getenv("DB_PASSWORD", "password"),
            dbname=os.getenv("DB_NAME", "startupforge_db"), connect_timeout=8
        )
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM founders ORDER BY id")
                founder_rows = [dict(row) for row in cur.fetchall()]
                cur.execute("SELECT * FROM investors ORDER BY id")
                investor_rows = [dict(row) for row in cur.fetchall()]
        finally:
            conn.close()

        for role, rows, store in (("founder", founder_rows, FOUNDER_STORE), ("investor", investor_rows, INVESTOR_STORE)):
            for row in rows:
                text = row_to_text(row, role)
                if not text.strip(): continue
                emb = get_embedding(text) if MISTRAL_API_KEY else None
                store.append({"id": str(row.get("id", uuid.uuid4())), "text": text,
                              "embedding": emb, "metadata": row})
                if emb: time.sleep(1.0)

        print(f"Ingested {len(FOUNDER_STORE)} founders and {len(INVESTOR_STORE)} investors.")
        return "Ingestion complete"
    except Exception as e:
        print(f"Ingestion failed: {e}")
        return f"Ingestion failed: {e}"

# ---------- Query ----------
STOP_WORDS = {
    "a", "an", "and", "are", "about", "can", "could", "do", "for", "from", "give", "i", "in", "is", "it",
    "me", "my", "of", "on", "or", "please", "show", "tell", "the", "to", "what", "which", "who", "with", "you", "your",
    "find", "list", "looking", "want", "recommend", "suggest", "startup", "startups", "company", "companies",
    "founder", "founders", "investor", "investors", "vc", "venture", "angel", "angels"
}


def search_store(query, store, k=5):
    q_emb = get_embedding(query) if MISTRAL_API_KEY else None
    query_terms = set(re.findall(r"[a-z0-9]+", query.lower())) - STOP_WORDS
    expansions = {
        "healthcare": {"health", "healthtech", "medical"}, "healthtech": {"healthcare", "health", "medical"},
        "health": {"healthcare", "healthtech", "medical"}, "fintech": {"finance", "financial"},
        "finance": {"fintech", "financial"},
        "investors": set(), "investor": set(), "founder": set(), "founders": set(),
        "nyc": {"new", "york"}, "usa": {"united", "states", "us"}
    }
    query_terms |= set().union(*(expansions.get(term, set()) for term in list(query_terms)))
    scored = []
    for item in store:
        doc_terms = set(re.findall(r"[a-z0-9]+", item["text"].lower()))
        if q_emb and item["embedding"]:
            score = cosine_similarity(q_emb, item["embedding"])
        else:
            matched = query_terms & doc_terms
            # Avoid returning a profile for one coincidental token in a specific query.
            score = len(matched) / max(1, len(query_terms))
            if len(query_terms) >= 3 and len(matched) < 2:
                continue
        if score >= 0.12:
            scored.append((score, item))
    scored.sort(key=lambda x: x[0], reverse=True)
    top_k = scored[:k]
    return {"documents": [[item["text"] for _, item in top_k]],
            "metadatas": [[item["metadata"] for _, item in top_k]]}

def query_founders(query: str, k: int = 5):
    return search_store(query, FOUNDER_STORE, k)

def query_investors(query: str, k: int = 5):
    return search_store(query, INVESTOR_STORE, k)

def _profile_summary(doc: str, category: str) -> str:
    fields = {}
    for part in doc.split(". "):
        if ":" not in part:
            continue
        key, value = part.split(":", 1)
        fields[key.strip().lower()] = value.strip().rstrip(".")
    if category == "investor":
        name = fields.get("investor name", "Investor profile")
        firm = fields.get("firm")
        details = [f"**{name}**" + (f" ({firm})" if firm else "")]
        for key, label in (("preferred stage", "Stage"), ("domain", "Focus"), ("location", "Location"), ("investment thesis", "Thesis"), ("notable investments", "Notable investments")):
            if fields.get(key): details.append(f"{label}: {fields[key]}")
        return " — ".join(details)
    name = fields.get("company", "Company profile")
    founder = fields.get("founder")
    details = [f"**{name}**" + (f" (founded by {founder})" if founder and founder != name else "")]
    for key, label in (("funding round", "Current round"), ("round", "Reported round"), ("funding amount", "Amount"), ("funding year", "Year"), ("past funding", "Past funding"), ("domain", "Sector / domain"), ("location", "Location"), ("description", "Profile")):
        if fields.get(key): details.append(f"{label}: {fields[key]}")
    return " — ".join(details)


def chat_with_rag(query: str):
    f_res = query_founders(query, k=4)
    i_res = query_investors(query, k=4)
    f_docs = f_res.get("documents", [[]])[0]
    i_docs = i_res.get("documents", [[]])[0]
    q_lower = query.lower()
    # Honor explicit facets instead of allowing a loose keyword match to masquerade as a fit.
    def field_value(doc: str, field: str) -> str:
        match = re.search(r"(?:^|\s)" + re.escape(field) + r":\s*(.*?)(?=\s+[A-Za-z /_-]+:|$)", doc, re.I)
        return match.group(1) if match else ""

    if any(term in q_lower for term in ("fintech", "finance", "financial technology")):
        def sector_match(doc: str) -> bool:
            values = " ".join(field_value(doc, field) for field in ("Domain", "Other domains", "Investment thesis", "Description", "Tags", "Focus"))
            return bool(re.search(r"\b(fintech|finance|financial|financial technology)\b", values, re.I))
        f_docs = [d for d in f_docs if sector_match(d)]
        i_docs = [d for d in i_docs if sector_match(d)]
    if "healthcare" in q_lower or "health tech" in q_lower or "healthtech" in q_lower:
        def health_match(doc: str) -> bool:
            values = " ".join((field_value(doc, "Company"), field_value(doc, "Domain"), field_value(doc, "Other domains"), field_value(doc, "Description"), field_value(doc, "Investment thesis")))
            return bool(re.search(r"\b(health|healthcare|healthtech|medical)\b", values, re.I))
        f_docs = [d for d in f_docs if health_match(d)]
        i_docs = [d for d in i_docs if health_match(d)]
    if "new york" in q_lower or "nyc" in q_lower:
        f_docs = [d for d in f_docs if re.search(r"new york|\bnyc\b", field_value(d, "Location"), re.I)]
        i_docs = [d for d in i_docs if re.search(r"new york|\bnyc\b", field_value(d, "Location"), re.I)]
    # A named company/person lookup should show that entity, not unrelated cross-category matches.
    query_names = [term for term in re.findall(r"[a-z0-9]+", q_lower) if term not in STOP_WORDS and len(term) > 2]
    exact_f = [d for d in f_docs if query_names and any(term in d.lower() for term in query_names)]
    exact_i = [d for d in i_docs if query_names and any(term in d.lower() for term in query_names)]
    if exact_f or exact_i:
        f_docs, i_docs = exact_f, exact_i
    context_str = "\n".join([*("Founder: " + d for d in f_docs), *("Investor: " + d for d in i_docs)])
    system_prompt = (
        "You are StartupForge's investment research assistant. Answer the exact question using only supplied profile records. "
        "Name the supporting company or investor, separate record facts from inference, and do not invent performance, current availability, "
        "returns, valuation, or investment terms. Be concise and give a useful next question."
    )
    user_prompt = f"Profile records:\n{context_str}\n\nQuestion: {query}"
    if MISTRAL_CLIENT:
        try:
            response = MISTRAL_CLIENT.chat.complete(
                model=MISTRAL_MODEL,
                messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
                temperature=0.4
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Mistral chat failed; using grounded local response: {e}")

    if not f_docs and not i_docs:
        return ("I couldn’t find a relevant profile for that query in the StartupForge records. "
                "Try a specific company or investor name, sector, funding stage, or location. "
                "The assistant currently uses local record search; generated analysis needs MISTRAL_API_KEY.")

    q = query.lower()
    wants_investor = any(word in q for word in ("investor", "investors", "vc", "venture", "angel", "fund", "funding source"))
    wants_founder = any(word in q for word in ("founder", "founders", "startup", "startups", "company", "companies", "raised", "round"))
    if wants_investor and not wants_founder:
        chosen = [("Potential investor matches", i_docs, "investor")]
        if not i_docs and f_docs:
            chosen = [("Related company records", f_docs, "founder")]
    elif wants_founder and not wants_investor:
        chosen = [("Founder and company matches", f_docs, "founder")]
        if not f_docs and i_docs:
            chosen = [("Related investor records", i_docs, "investor")]
    else:
        chosen = [("Founder and company matches", f_docs, "founder"), ("Investor matches", i_docs, "investor")]
    chosen = [(label, docs, kind) for label, docs, kind in chosen if docs]
    lines = [f"## Results for: {query}"]
    for label, docs, kind in chosen:
        lines.append(f"### {label}")
        lines.extend(f"{idx}. {_profile_summary(doc, kind)}" for idx, doc in enumerate(docs[:3], 1))
    if wants_investor:
        lines.append("**How to interpret this:** These profiles share terms with your query. That suggests a lead to investigate, not confirmed investment interest or current availability. Ask about mandate, check size, geography, and whether the round is open.")
    elif wants_founder:
        lines.append("**How to interpret this:** Funding details reflect the profile record and may be historical. Confirm the current round, amount raised, and company status directly.")
    else:
        lines.append("**How to interpret this:** Results are matches in profile data, not verified diligence or a recommendation. Tell me a stage, geography, or check size to narrow the list.")
    lines.append("*Using local profile search. For free-form generated analysis, configure MISTRAL_API_KEY.*")
    return "\n\n".join(lines)

def generate_chat_reply(history: list, user_context: str):
    # Retrieve My Data
    my_data_res = query_founders(f"Details about {user_context}", k=1)
    my_facts = my_data_res["documents"][0][0] if my_data_res["documents"][0] else "No data."

    conversation_text = ""
    for msg in history[-10:]:
        sender = "Me" if msg.get("isMe") else "Them"
        conversation_text += f"{sender}: {msg.get('content')}\n"

    system_prompt = (
        "Draft a professional executive reply. Use the provided company data for facts."
    )
    user_prompt = f"My Data: {my_facts}\nContext: {user_context}\nHistory:\n{conversation_text}\nDraft reply:"

    if not MISTRAL_CLIENT:
        last_message = next((str(msg.get("content", "")).strip() for msg in reversed(history) if msg.get("content")), "")
        if not last_message:
            return "Thanks for reaching out. Could you share a little more context so I can respond usefully?"
        return f"Thanks for sharing that. I’m interested in learning more. Could you tell me about the current round, target amount, and timeline?\n\nContext: {last_message[:280]}\n\n(Add MISTRAL_API_KEY to enable a fully generated draft.)"
    try:
        response = MISTRAL_CLIENT.chat.complete(
            model=MISTRAL_MODEL,
            messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
            temperature=0.2
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"Error: {e}"
