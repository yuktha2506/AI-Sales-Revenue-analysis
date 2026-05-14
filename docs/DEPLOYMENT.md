# Deployment Guide

## 1. Cloud MySQL

Use Railway, PlanetScale-compatible MySQL, Aiven, or AWS RDS.

1. Create a MySQL database named `sales_analytics`.
2. Run `database/schema.sql`.
3. Run `database/seed.sql`.
4. Set host, port, username, password, and database in backend and Python service environment variables.
5. Run `python_service/import_amazon_sales.py` locally once against the cloud DB, or run it as a one-off job on the provider.

## 2. Python Service on Render

1. Create a new Web Service from this repo.
2. Root directory: `python_service`.
3. Build command: `pip install -r requirements.txt`.
4. Start command: `uvicorn app:app --host 0.0.0.0 --port $PORT`.
5. Add `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`.

## 3. Backend on Render or Railway

1. Root directory: `backend`.
2. Build command: `npm install`.
3. Start command: `npm start`.
4. Add `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
5. Add `JWT_SECRET`, `PYTHON_SERVICE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`.
6. Set `FRONTEND_ORIGIN` to the deployed Vercel URL.

## 4. Frontend on Vercel

1. Import the repo in Vercel.
2. Set project root to `frontend`.
3. Framework preset: Other.
4. No build command required for static files.
5. Update `API_BASE` in `frontend/app.js` or set localStorage:

```js
localStorage.setItem("apiBase", "https://your-backend.onrender.com")
```

## Environment Variables

Never commit real secrets. Use `.env.example` as the checklist for local and cloud deployment.
