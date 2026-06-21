# Ateliê — Frontend (Área do Cliente)

Site público (sem login) onde o cliente navega a vitrine, monta um pedido
(peça + tamanho/cor + quantidade + observação) e finaliza pelo **WhatsApp**.
Mobile-first, interface em PT-BR. Consome a API pública do backend Django/DRF.

Documentação técnica completa em [`CLAUDE.md`](./CLAUDE.md).
Guia visual em [`../STYLE.md`](../STYLE.md).

## Rodar junto com o backend (Docker Compose)

A forma mais simples é subir a stack inteira pela raiz do projeto:

```bash
cd ..          # raiz do repositório
docker compose up
```

Isso sobe banco + backend + este frontend (em http://localhost:5173) com hot reload.
Veja o [README da raiz](../README.md). As instruções abaixo são para rodar o frontend
isoladamente, sem Docker.

## Requisitos

- Node.js 18+ (testado com Node 24 LTS) e npm.

## Setup passo a passo

### 1. Instalar as dependências

```bash
cd frontend
npm install
```

### 2. Configurar as variáveis de ambiente

```bash
# Windows:
copy .env.example .env
# Linux/macOS:
cp .env.example .env
```

Edite o `.env`:

| Variável         | Descrição                                                        |
|------------------|------------------------------------------------------------------|
| `VITE_API_URL`   | URL base do backend (sem barra no final). Ex.: `http://127.0.0.1:8000` |
| `VITE_WHATSAPP`  | Número do WhatsApp do ateliê, só dígitos, formato internacional. Ex.: `5581990000000` |

> ⚠️ O `VITE_WHATSAPP` vem com um **placeholder** (`5581990000000`). Troque pelo
> número real do ateliê antes de usar.

### 3. Rodar em desenvolvimento

```bash
npm run dev
```

App em http://localhost:5173 (porta já liberada no CORS do backend).

> O backend precisa estar no ar (veja o README da raiz: `docker compose up -d`
> + `python manage.py runserver`). Use `python manage.py seed_dados` para ter
> peças de exemplo.

### Outros comandos

```bash
npm run build      # build de produção em dist/
npm run preview    # serve o build localmente
npm run lint       # ESLint
```

## Telas

- **`/`** — Vitrine: grade de peças, busca por nome e filtro por categoria; selo "Esgotado".
- **`/peca/:id`** — Detalhe: fotos, descrição, seleção de tamanho/cor e quantidade.
- **`/carrinho`** — Meu pedido: itens, observação e envio pelo WhatsApp.
