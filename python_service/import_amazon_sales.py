import argparse
import os
import re

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

def engine():
    user = os.getenv("MYSQL_USER", os.getenv("DB_USER", "root"))
    password = os.getenv("MYSQL_PASSWORD", os.getenv("DB_PASSWORD", ""))
    host = os.getenv("MYSQL_HOST", os.getenv("DB_HOST", "localhost"))
    port = os.getenv("MYSQL_PORT", os.getenv("DB_PORT", "3306"))
    db = os.getenv("MYSQL_DATABASE", os.getenv("DB_NAME", "sales_analytics"))
    ca_path = os.getenv("MYSQL_SSL_CA_PATH", os.getenv("DB_SSL_CA_PATH"))
    connect_args = {"ssl": {"ca": ca_path}} if ca_path else {}
    return create_engine(f"mysql+pymysql://{user}:{password}@{host}:{port}/{db}", pool_pre_ping=True, connect_args=connect_args)

def clean_name(value, fallback):
    text_value = str(value).strip() if pd.notna(value) else ""
    return re.sub(r"\s+", " ", text_value)[:180] or fallback

def import_csv(csv_path: str, limit: int | None = None):
    df = pd.read_csv(csv_path, low_memory=False)
    df.columns = [c.strip() for c in df.columns]
    df = df.rename(columns={"Qty": "quantity", "Amount": "amount", "Date": "date", "SKU": "sku", "Category": "category", "Order ID": "order_id"})
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["quantity"] = pd.to_numeric(df["quantity"], errors="coerce").fillna(0).astype(int)
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce")
    df = df.dropna(subset=["date", "order_id", "sku", "category", "amount"])
    df = df[(df["quantity"] > 0) & (df["amount"] > 0)]
    df = df[~df["Status"].astype(str).str.contains("Cancelled", case=False, na=False)]
    if limit:
        df = df.head(limit)

    db = engine()
    with db.begin() as conn:
        user_result = conn.execute(text("""
            INSERT INTO users (name, email, password, role)
            VALUES ('Amazon Marketplace Customer', 'marketplace@example.com', '$2a$12$xD6cxMNM3KHPxIarDTxotuQkjHBySTO6uR/8v7yggjjEPiR23ZQwS', 'user')
            ON DUPLICATE KEY UPDATE name = VALUES(name)
        """))
        user_id = conn.execute(text("SELECT id FROM users WHERE email = 'marketplace@example.com'")).scalar_one()

        product_ids = {}
        for _, row in df.drop_duplicates("sku").iterrows():
            price = float(row["amount"]) / max(int(row["quantity"]), 1)
            name = clean_name(row.get("Style"), clean_name(row["sku"], "Amazon SKU"))
            category = clean_name(row["category"], "Uncategorized")
            conn.execute(text("""
                INSERT INTO products (name, category, price, sku)
                VALUES (:name, :category, :price, :sku)
                ON DUPLICATE KEY UPDATE name = VALUES(name), category = VALUES(category), price = VALUES(price)
            """), {"name": name, "category": category, "price": round(price, 2), "sku": row["sku"]})
        for product in conn.execute(text("SELECT id, sku FROM products WHERE sku IS NOT NULL")):
            product_ids[product.sku] = product.id

        for order_id, group in df.groupby("order_id"):
            first = group.iloc[0]
            conn.execute(text("""
                INSERT INTO orders (external_order_id, user_id, date, status, sales_channel, ship_city, ship_state)
                VALUES (:external_order_id, :user_id, :date, :status, :sales_channel, :ship_city, :ship_state)
                ON DUPLICATE KEY UPDATE status = VALUES(status), date = VALUES(date)
            """), {
                "external_order_id": order_id,
                "user_id": user_id,
                "date": first["date"].date(),
                "status": clean_name(first.get("Status"), "Unknown"),
                "sales_channel": clean_name(first.get("Sales Channel"), "Amazon"),
                "ship_city": clean_name(first.get("ship-city"), ""),
                "ship_state": clean_name(first.get("ship-state"), "")
            })
            db_order_id = conn.execute(text("SELECT id FROM orders WHERE external_order_id = :oid"), {"oid": order_id}).scalar_one()
            conn.execute(text("DELETE FROM order_items WHERE order_id = :order_id"), {"order_id": db_order_id})
            grouped_items = group.groupby("sku", as_index=False)["quantity"].sum()
            for _, item in grouped_items.iterrows():
                conn.execute(text("""
                    INSERT INTO order_items (order_id, product_id, quantity)
                    VALUES (:order_id, :product_id, :quantity)
                """), {"order_id": db_order_id, "product_id": product_ids[item["sku"]], "quantity": int(item["quantity"])})
    print(f"Imported {len(df)} cleaned sales rows from {csv_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", default=r"D:\Trigent_internship\Amazon Sale Report.csv")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()
    import_csv(args.csv, args.limit)
