import os
from datetime import datetime
from typing import Optional

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, Query
from sklearn.linear_model import LinearRegression
from sqlalchemy import create_engine, text

load_dotenv()
app = FastAPI(title="Sales Analytics Python Service", version="1.0.0")

def engine():
    user = os.getenv("MYSQL_USER", os.getenv("DB_USER", "root"))
    password = os.getenv("MYSQL_PASSWORD", os.getenv("DB_PASSWORD", ""))
    host = os.getenv("MYSQL_HOST", os.getenv("DB_HOST", "localhost"))
    port = os.getenv("MYSQL_PORT", os.getenv("DB_PORT", "3306"))
    db = os.getenv("MYSQL_DATABASE", os.getenv("DB_NAME", "sales_analytics"))
    return create_engine(f"mysql+pymysql://{user}:{password}@{host}:{port}/{db}", pool_pre_ping=True)

DB_ENGINE = engine()

def sales_filters(start_date: Optional[str] = None, end_date: Optional[str] = None, category: Optional[str] = None, user_id: Optional[int] = None):
    return {"start_date": start_date, "end_date": end_date, "category": category, "user_id": user_id}

BASE_WHERE = """
  WHERE (:start_date IS NULL OR o.date >= :start_date)
    AND (:end_date IS NULL OR o.date <= :end_date)
    AND (:category IS NULL OR p.category = :category)
    AND (:user_id IS NULL OR o.user_id = :user_id)
"""

def load_sales(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category: Optional[str] = None,
    user_id: Optional[int] = None
) -> pd.DataFrame:
    query = """
      SELECT o.id AS order_id, o.user_id, o.date, p.name, p.category, p.price, oi.quantity,
             (oi.quantity * p.price) AS revenue
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      WHERE (:start_date IS NULL OR o.date >= :start_date)
        AND (:end_date IS NULL OR o.date <= :end_date)
        AND (:category IS NULL OR p.category = :category)
        AND (:user_id IS NULL OR o.user_id = :user_id)
    """
    df = pd.read_sql(
        text(query),
        DB_ENGINE,
        params={"start_date": start_date, "end_date": end_date, "category": category, "user_id": user_id}
    )
    if df.empty:
        return pd.DataFrame(columns=["order_id", "user_id", "date", "name", "category", "price", "quantity", "revenue", "month"])
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date", "price", "quantity"])
    df = df[(df["price"] >= 0) & (df["quantity"] > 0)]
    df["revenue"] = df["quantity"].astype(float) * df["price"].astype(float)
    df["month"] = df["date"].dt.to_period("M").astype(str)
    return df

@app.get("/health")
def health():
    return {"status": "ok", "service": "python-analytics"}

@app.get("/analytics")
def analytics(startDate: Optional[str] = None, endDate: Optional[str] = None, category: Optional[str] = None, userId: Optional[int] = None):
    params = sales_filters(startDate, endDate, category, userId)
    kpi_query = f"""
      SELECT
        COALESCE(SUM(oi.quantity * p.price), 0) AS totalRevenue,
        COUNT(DISTINCT o.id) AS totalOrders
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      {BASE_WHERE}
    """
    monthly_query = f"""
      SELECT DATE_FORMAT(o.date, '%Y-%m') AS month, SUM(oi.quantity * p.price) AS revenue
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      {BASE_WHERE}
      GROUP BY DATE_FORMAT(o.date, '%Y-%m')
      ORDER BY month
    """
    category_query = f"""
      SELECT p.category, SUM(oi.quantity * p.price) AS revenue
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      {BASE_WHERE}
      GROUP BY p.category
      ORDER BY revenue DESC
    """
    products_query = f"""
      SELECT p.name, SUM(oi.quantity * p.price) AS revenue, SUM(oi.quantity) AS quantity
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      {BASE_WHERE}
      GROUP BY p.name
      ORDER BY revenue DESC
      LIMIT 10
    """
    categories_query = "SELECT DISTINCT category FROM products ORDER BY category"

    with DB_ENGINE.connect() as conn:
        kpi = conn.execute(text(kpi_query), params).mappings().first()
        monthly = pd.read_sql(text(monthly_query), conn, params=params)
        categories = pd.read_sql(text(category_query), conn, params=params)
        top_products = pd.read_sql(text(products_query), conn, params=params)
        all_categories = [row[0] for row in conn.execute(text(categories_query)).all()]

    total_revenue = float(kpi["totalRevenue"] or 0)
    total_orders = int(kpi["totalOrders"] or 0)
    if total_orders == 0:
        return {"kpis": {"totalRevenue": 0, "totalOrders": 0, "averageOrderValue": 0}, "monthlyRevenue": [], "categoryRevenue": [], "topProducts": [], "categories": []}

    avg_order_value = total_revenue / total_orders if total_orders else 0

    return {
        "kpis": {"totalRevenue": round(total_revenue, 2), "totalOrders": total_orders, "averageOrderValue": round(avg_order_value, 2), "currency": "INR"},
        "monthlyRevenue": monthly.round(2).to_dict(orient="records"),
        "categoryRevenue": categories.round(2).to_dict(orient="records"),
        "topProducts": top_products.round(2).to_dict(orient="records"),
        "categories": all_categories
    }

@app.get("/summary")
def summary(startDate: Optional[str] = None, endDate: Optional[str] = None, category: Optional[str] = None, userId: Optional[int] = None):
    data = analytics(startDate, endDate, category, userId)
    monthly = data["monthlyRevenue"]
    latest = monthly[-1] if monthly else None
    previous = monthly[-2] if len(monthly) > 1 else None
    month_over_month_change = None
    if latest and previous and previous["revenue"]:
        month_over_month_change = round(((latest["revenue"] - previous["revenue"]) / previous["revenue"]) * 100, 2)
    return {
        "currency": data["kpis"]["currency"],
        "totalRevenue": data["kpis"]["totalRevenue"],
        "totalOrders": data["kpis"]["totalOrders"],
        "averageOrderValue": data["kpis"]["averageOrderValue"],
        "latestMonth": latest,
        "previousMonth": previous,
        "monthOverMonthChangePct": month_over_month_change,
        "categoryRevenue": data["categoryRevenue"][:5],
        "topProducts": data["topProducts"][:5],
        "monthlyRevenue": monthly[-12:],
        "businessRules": [
            "Revenue is quantity multiplied by normalized product price.",
            "Cancelled or zero-quantity imported rows are excluded during ingestion.",
            "All assistant answers must be grounded in this summary."
        ]
    }

@app.get("/predict")
def predict(months: int = Query(6, ge=3, le=6), userId: Optional[int] = None):
    if not isinstance(months, int):
        months = 6
    params = sales_filters(user_id=userId)
    monthly_query = f"""
      SELECT DATE_FORMAT(o.date, '%Y-%m') AS month, SUM(oi.quantity * p.price) AS revenue
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      {BASE_WHERE}
      GROUP BY DATE_FORMAT(o.date, '%Y-%m')
      ORDER BY month
    """
    monthly = pd.read_sql(text(monthly_query), DB_ENGINE, params=params)
    if monthly.empty:
        return {"actual": [], "forecast": [], "explanation": "No historical data is available for this user/filter, so no forecast can be produced.", "model": {"name": "LinearRegression", "features": ["month_index"], "limitations": ["No historical data available"]}}
    monthly["month_date"] = pd.to_datetime(monthly["month"] + "-01")
    monthly["month_index"] = np.arange(len(monthly))

    X = monthly[["month_index"]]
    y = monthly["revenue"]
    model = LinearRegression()
    model.fit(X, y)

    future_index = np.arange(len(monthly), len(monthly) + months).reshape(-1, 1)
    last_month = monthly["month_date"].max()
    future_months = pd.date_range(last_month + pd.offsets.MonthBegin(1), periods=months, freq="MS")
    predictions = np.maximum(model.predict(future_index), 0)

    fitted = model.predict(X)
    actual = [{"month": row.month, "revenue": round(float(row.revenue), 2), "fitted": round(float(fitted[i]), 2)} for i, row in monthly.iterrows()]
    forecast = [{"month": m.strftime("%Y-%m"), "predictedRevenue": round(float(predictions[i]), 2)} for i, m in enumerate(future_months)]
    slope = float(model.coef_[0])
    if slope > 0:
        direction = "rise"
        reason = "the historical monthly revenue trend is upward"
    elif slope < 0:
        direction = "decrease"
        reason = "the historical monthly revenue trend is downward"
    else:
        direction = "remain stable"
        reason = "monthly revenue has a flat trend"
    explanation = f"Sales are predicted to {direction} because {reason}. The month_index feature changes the forecast by about INR {abs(slope):,.2f} per month."

    return {
        "actual": actual,
        "forecast": forecast,
        "explanation": explanation,
        "model": {
            "name": "LinearRegression",
            "features": ["month_index"],
            "featureImportance": [{"feature": "month_index", "importance": round(abs(slope), 2), "meaning": "Approximate revenue change per month learned from historical monthly totals."}],
            "assumptions": ["Historical monthly revenue has an approximately linear trend.", "Future operating conditions remain similar to the training period."],
            "limitations": ["Does not capture promotions, stockouts, holidays, or nonlinear seasonality.", "Use as directional planning input, not a finance-grade forecast."],
            "coefficient": round(slope, 4),
            "intercept": round(float(model.intercept_), 4)
        }
    }
