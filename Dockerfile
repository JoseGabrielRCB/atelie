# Imagem do backend Django (desenvolvimento).
FROM python:3.13-slim

# Saída sem buffer e sem .pyc — melhor para logs em container.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Dependências Python (camada cacheável).
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Código (em dev é sobreposto pelo bind mount do compose).
COPY . .

# Entrypoint: espera o banco, migra, popula e cria o superuser.
COPY docker/backend-entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
