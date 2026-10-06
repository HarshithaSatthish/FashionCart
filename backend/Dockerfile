FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PIP_NO_CACHE_DIR=1

RUN addgroup --system fashioncart && adduser --system --ingroup fashioncart fashioncart
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY --chown=fashioncart:fashioncart . .
USER fashioncart
EXPOSE 8000
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8000","--proxy-headers","--forwarded-allow-ips=*"]
