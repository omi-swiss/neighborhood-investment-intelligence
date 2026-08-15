FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml requirements.lock ./
RUN pip install --no-cache-dir -r requirements.lock
COPY src ./src
COPY config ./config
COPY migrations ./migrations
ENV PYTHONPATH=/app/src
ENTRYPOINT ["python", "-m", "neighborhood_intelligence.cli"]
