FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 wfvuser && chown -R wfvuser:wfvuser /app

COPY --chown=wfvuser:wfvuser requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=wfvuser:wfvuser . .

USER wfvuser

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD curl -f http://127.0.0.1:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
