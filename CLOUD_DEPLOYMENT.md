# Cloud Deployment Guide

To get a link that anyone can open, you need to host your application on the cloud. We will use **Render** for the backends/database and **Vercel** for the frontend.

## Prerequisites
1.  **GitHub Account**: Your code must be pushed to a GitHub repository.
2.  **Render Account**: Sign up at [render.com](https://render.com).
3.  **Vercel Account**: Sign up at [vercel.com](https://vercel.com).
4.  **Supabase and Neo4j Aura accounts**: the free Render Postgres database expires after 30 days, so this blueprint expects an external Supabase Postgres connection. Create an AuraDB Free graph for Neo4j.

---

## Part 1: Deploy API services and database (Render)

We have created a `render.yaml` file that automates this.

1.  **Push your code** to GitHub.
2.  Log in to **Render dashboard**.
3.  Click **"New +"** -> **"Blueprint"**.
4.  Connect your GitHub repository.
5.  Render will detect the `render.yaml` file.
6.  Click **"Apply"**. Set the exact production frontend origin in `CORS_ORIGINS` for the API and RAG services.
7.  Set `DATABASE_URL` on both the backend and RAG service to your Supabase Postgres **Session pooler** connection string. Set `NEO4J_URI`, `NEO4J_USER`, and `NEO4J_PASSWORD` for your AuraDB instance. Add `GEMINI_API_KEY` to the RAG service for generated assistant answers.
8.  Set a strong `ADMIN_API_KEY` and leave `ALLOW_INSECURE_DEMO_LOGIN=false`. The API health check remains degraded until Postgres and Neo4j are reachable.

Render will now deploy:
*   Node.js Backend
*   RAG AI Backend
*   Prediction Backend
*   Gun Relay Server

Once finished, copy the URL for the **Node.js Backend** (e.g., `https://startupforge-backend.onrender.com`). You will need this for the frontend.

---

## Part 2: Deploy Frontend (Vercel)

1.  Log in to **Vercel**.
2.  Click **"Add New..."** -> **"Project"**.
3.  Import your GitHub repository.
4.  **Framework Preset**: Select "Vite".
5.  **Root Directory**: Click "Edit" and select `frontend`.
6.  **Environment Variables**:
    Add these variables so the frontend can reach each backend service:
    *   **Name**: `VITE_API_URL`
    *   **Value**: Your Render Backend URL - *Do not include the trailing slash*.
    *   **Name**: `VITE_RAG_API_URL`
    *   **Value**: Your Render RAG service URL - *Do not include the trailing slash*.
    *   **Name**: `VITE_GUN_URL`
    *   **Value**: Your Render Gun relay URL.
    *   **Name**: `VITE_PREDICTION_URL`
    *   **Value**: Your Render prediction service URL.

7.  Set all four deployed service URLs, then click **"Deploy"**. The frontend build embeds these URLs, so redeploy after changing them. The `frontend/vercel.json` file supports client-side SPA routes.

---

## Public deployment readiness

Vercel will give you a public domain (e.g., `https://startup-forge.vercel.app`).
Production registration and sign-in now use server-issued sessions, and protected account APIs authorize the user from that session. Keep `ALLOW_INSECURE_DEMO_LOGIN=false`. Email ownership, password recovery, and founder/investor identity verification are not implemented; user-entered profile claims remain unverified and should not be used as diligence evidence. Add those controls and complete a privacy review before real investment use.

The blueprint selects free plans for evaluation and uses Supabase for Postgres because Render free Postgres expires after 30 days. Supabase Free may pause after a week of low activity; keep periodic database exports outside GitHub. Render free services sleep after 15 minutes idle and share 750 instance hours per workspace per month, so cold starts and downtime are expected. These free tiers do not guarantee always-on production service. Do not store real user or investment data here.

### Troubleshooting
*   **Database Data**: The cloud database starts empty. You will need to run your seed scripts or manually add data.
*   **Cold Starts**: On the free tier, services spin down after inactivity. The first request might take 30-50 seconds.
