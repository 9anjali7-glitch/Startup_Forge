FROM python:3.10-slim

WORKDIR /app

COPY rag_backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY rag_backend/ ./
RUN mkdir -p /app/data
COPY frontend/src/data/founders.json /app/data/founders.json
COPY frontend/src/data/investors.json /app/data/investors.json

ENV MALLOC_ARENA_MAX=2

EXPOSE 8000

CMD sh -c "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"
