# RAG Backend (Mistral AI)

This service provides RAG (Retrieval-Augmented Generation) capabilities using Mistral AI.

## Prerequisites

1.  **Virtual Environment**: Ensure you are using the project's virtual environment located at `d:\one_day_bfr\venv`.
2.  **Mistral API Key**: Create a key in your Mistral Studio account. Docker Compose reads `MISTRAL_API_KEY` from the project-root `.env` file (the same directory as `docker-compose.yml`), not from this `rag_backend` directory.

## Setup

1.  **Install Dependencies**:
    ```powershell
    # Activate venv first or use full path
    & "d:\one_day_bfr\venv\Scripts\python.exe" -m pip install -r requirements.txt
    ```

2.  **Environment Variables**:
    Add the key to the project-root `.env` file:
    ```env
    MISTRAL_API_KEY=your_key_here
    ```
    Keep the key private; `.env` is ignored by Git. After setting it, restart the AI service from the project root:
    ```powershell
    docker compose up -d --force-recreate rag_backend
    Invoke-RestMethod http://localhost:8000/health
    ```
    The health response should show `mistral_configured: true`. Without a key, the assistant uses local profile search and cannot answer general questions conversationally.

## Running the Server

To start the server, use the Python executable from the virtual environment:

```powershell
& "d:\one_day_bfr\venv\Scripts\python.exe" -m uvicorn app:app --reload
```

The server will start at `http://127.0.0.1:8000`.

## API Endpoints

-   `POST /chat`: Chat with the AI using RAG context.
-   `POST /search/founders`: Semantic search for founders.
-   `POST /search/investors`: Semantic search for investors.
