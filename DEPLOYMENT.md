# Deployment Guide

The entire system is containerized using Docker. This allows you to run all services with a single command.

## Prerequisites
- Docker Desktop installed.

## Services Overview

| Service | Container Name | Local Port |
| :--- | :--- | :--- |
| **Database** | `startupforge-postgres` | `5432` |
| **Backend** | `startupforge-backend` | `3000` |
| **Gun Relay** | `startupforge-gun` | `8765` |
| **RAG AI** | `startupforge-rag` | `8000` |
| **Prediction** | `startupforge-prediction` | `8002` |
| **Frontend** | `startupforge-frontend` | `5173` |

## How to Run

1.  **Environment Variables**:
    Copy `.env.example` to `.env`. Mistral is optional and disabled by default; configure Gemini or the local Ollama model for generated answers. Keep database backups local and do not commit `.env` or credentials.

2.  **Build and Start**:
    ```bash
    docker-compose up --build
    ```

3.  **Access the App**:
    Open [http://localhost:5173](http://localhost:5173) in your browser.

## Notes
- The database volume `postgres_data` persists data even if containers are stopped.
- Browser API origins are restricted by `CORS_ORIGINS`; use exact origins without a trailing slash.
- `/setup-db` and `/seed-full` accept POST only and require `x-admin-api-key` matching `ADMIN_API_KEY`.
- Production account routes require a server-issued bearer session and reject mismatched client-supplied user IDs. Name-only demo login is disabled in production. Accounts use passwords but email ownership and professional details are not verified; do not present profile claims as verified diligence evidence.
- A deployable cloud backend also needs an externally reachable Neo4j service; the Render blueprint only provisions PostgreSQL.
