# Imagem do frontend (Vite dev server).
FROM node:24-alpine

WORKDIR /app

# Dependências (camada cacheável). node_modules vive em volume próprio no compose.
COPY package*.json ./
RUN npm install

# Código (sobreposto pelo bind mount em dev).
COPY . .

EXPOSE 5173

# --host expõe o dev server fora do container.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
