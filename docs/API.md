# API Design

Base URL: `http://localhost:5000`

All routes except `/auth/register`, `/auth/login`, and `/health` require `Authorization: Bearer <token>`.

## POST /auth/register

Request:
```json
{ "name": "Asha Rao", "email": "asha@example.com", "password": "Password@123" }
```

Response:
```json
{ "user": { "id": 3, "name": "Asha Rao", "email": "asha@example.com", "role": "user" }, "token": "jwt" }
```

## POST /auth/login

Request:
```json
{ "email": "admin@example.com", "password": "Password@123" }
```

## GET /products

Response:
```json
{ "products": [{ "id": 1, "name": "Classic Kurta", "category": "kurta", "price": "699.00" }] }
```

## GET /orders

Admins receive all recent orders. Normal users receive only their own orders.

Response:
```json
{ "orders": [{ "id": 1, "date": "2022-03-12", "customer": "Demo Customer", "revenue": "3995.00" }] }
```

## POST /orders

Admin only. Creates an order and emits a Socket.io `order:created` event.

Request:
```json
{ "userId": 2, "date": "2026-05-05", "items": [{ "productId": 1, "quantity": 1 }] }
```

## GET /users

Admin only.

Response:
```json
{ "users": [{ "id": 1, "name": "Admin User", "email": "admin@example.com", "role": "admin", "totalOrders": 0 }] }
```

## GET /analytics

Query filters: `startDate=2022-04-01&endDate=2022-06-30&category=kurta`

Response includes KPIs, monthly revenue, category revenue, top products, and categories.

## GET /predict

Query: `months=6`

Response includes actual revenue, fitted values, future predictions, and model metadata.

The response also includes:
```json
{
  "explanation": "Sales are predicted to rise because the historical monthly revenue trend is upward.",
  "model": {
    "featureImportance": [{ "feature": "month_index", "importance": 1250.5 }]
  }
}
```

## POST /chat

Request:
```json
{ "question": "Which category performs best?", "filters": { "category": "kurta" } }
```

Response:
```json
{ "answer": "The strongest category is kurta...", "groundedIn": { "generatedAt": "..." } }
```
