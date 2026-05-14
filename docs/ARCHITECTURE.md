# System Architecture

## Components

- Frontend dashboard: static HTML/CSS/JavaScript with React and Chart.js. It handles login, filters, dashboard charts, loading states, errors, CSV export link, and AI chat.
- Backend API: Node.js + Express. It owns authentication, protected REST routes, request validation, logging, and secure AI calls.
- Database: MySQL. Normalized tables prevent duplicated customer/product/order data.
- Python analytics service: FastAPI. It loads MySQL data with SQLAlchemy, cleans it with Pandas, computes KPIs, and trains the Linear Regression model.
- AI service: OpenAI API. The backend sends only compact KPI/trend context to the model so answers are grounded in actual data.
- Real-time service: Socket.io runs inside the Express server and broadcasts order insert events to connected dashboards.

## Data Flow

1. `import_amazon_sales.py` reads `Amazon Sale Report.csv`.
2. The importer removes cancelled, missing, zero-quantity, and invalid amount rows.
3. Products are upserted by SKU, orders by external Amazon order id, and quantities into `order_items`.
4. The frontend requests `/analytics` from Express with optional date/category filters.
5. Express validates the JWT and forwards filters to the Python service.
6. Python queries MySQL, computes `revenue = quantity * price`, aggregates monthly revenue, category revenue, and top products.
7. Express returns the JSON to the dashboard, which renders KPIs and charts.
8. When an admin creates a new order through `/orders`, Express emits `order:created`; the frontend receives it and reloads dashboard data.

## Role-Based Access

Admins see full analytics, all recent orders, all users, and can insert orders. Normal users see only orders and analytics scoped to their own `user_id`; the same user scope is sent to the Python service for analytics, forecasting, and AI summaries.

## ML Integration

`/predict` in Express calls `/predict` in the Python service. The Python service groups historical revenue by month, encodes each month as a numeric `month_index`, trains `LinearRegression`, and predicts the next 3-6 months. It also returns an explanation such as "Sales are predicted to rise because the historical monthly revenue trend is upward" and a simple feature importance value showing the approximate revenue change per month.

## AI Integration

`/chat` accepts a natural-language question. Express asks Python for `/summary`, then sends that compact JSON to OpenAI with strict instructions to answer only from supplied context. If `OPENAI_API_KEY` is missing, the app returns a deterministic fallback insight from the same data.
