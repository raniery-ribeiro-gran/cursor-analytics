# Cursor Analytics

Sistema interno da Gran para análise de uso do Cursor pela engenharia, com métricas para gestores.

Base estrutural herdada de `priorizacao-demandas` (template, login por e-mail/código e logs de acesso), com banco **SQLite**.

## Stack

- Next.js 15 + React 19 + TypeScript
- Tailwind CSS
- SQLite (`better-sqlite3`)
- Autenticação por código enviado por e-mail (`@gran.com` + organograma)

## Setup local

```bash
cp .env.example .env
# edite AUTH_SECRET (mín. 16 chars) e SMTP se desejar

npm install
npm run db:migrate
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

Sem SMTP configurado, o código de login aparece no log do servidor.

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `start` | Build e produção |
| `npm run db:migrate` | Aplica migrations SQLite |
| `npm run lint` | ESLint |

## Docker

```bash
docker compose -f docker-compose.dev.yml up --build
# ou produção:
docker compose up --build
```

## Escopo atual

- Template (shell, sidebar, branding)
- Login (request/verify token + sessão) via organograma de Tecnologia
- Logs de acesso (admin)
- Home placeholder para futuras métricas

## Organograma de Tecnologia

A hierarquia (nome, cargo, e-mail, líder, tribo, gestor legado) fica na tabela `tech_organogram`.
A carga é seed da migration `supabase/migrations/002_tech_organogram.sql` (fonte: `data/organograma_tecnologia.csv`).

```bash
npm run db:migrate
```
