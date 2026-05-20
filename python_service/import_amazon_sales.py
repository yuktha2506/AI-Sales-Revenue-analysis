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
    connect_args = {"connect_timeout": 20, "read_timeout": 120, "write_timeout": 120}
    if ca_path:
        connect_args["ssl"] = {"ca": ca_path}
    return create_engine(f"mysql+pymysql://{user}:{password}@{host}:{port}/{db}", pool_pre_ping=True, connect_args=connect_args)

def clean_name(value, fallback):
    text_value = str(value).strip() if pd.notna(value) else ""
    return re.sub(r"\s+", " ", text_value)[:180] or fallback

def chunks(items, size=1000):
    for index in range(0, len(items), size):
        yield items[index:index + size]

def fetch_id_map(conn, table, id_column, lookup_column, values):
    result = {}
    values = [value for value in values if pd.notna(value)]
    for batch in chunks(values):
        params = {f"value_{i}": value for i, value in enumerate(batch)}
        placeholders = ", ".join(f":value_{i}" for i in range(len(batch)))
        rows = conn.execute(text(f"SELECT {id_column}, {lookup_column} FROM {table} WHERE {lookup_column} IN ({placeholders})"), params)
        for row in rows:
            result[getattr(row, lookup_column)] = getattr(row, id_column)
    return result

def import_csv(csv_path: str, limit: int | None = None):
    df = pd.read_csv(csv_path, low_memory=False)
    df.columns = [c.strip() for c in df.columns]
    df = df.rename(columns={"Qty": "quantity", "Amount": "amount", "Date": "date", "SKU": "sku", "Category": "category", "Order ID": "order_id"})
    df["date"] = pd.to_datetime(df["date"], format="%m-%d-%y", errors="coerce")
    df["quantity"] = pd.to_numeric(df["quantity"], errors="coerce").fillna(0).astype(int)
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce")
    df = df.dropna(subset=["date", "order_id", "sku", "category", "amount"])
    df = df[(df["quantity"] > 0) & (df["amount"] > 0)]
    df = df[~df["Status"].astype(str).str.contains("Cancelled", case=False, na=False)]
    if limit:
        df = df.head(limit)

    db = engine()
    with db.begin() as conn:
        conn.execute(text("""
            INSERT INTO users (name, email, password, role)
            VALUES ('Amazon Marketplace Customer', 'marketplace@example.com', '$2a$12$xD6cxMNM3KHPxIarDTxotuQkjHBySTO6uR/8v7yggjjEPiR23ZQwS', 'user')
            ON DUPLICATE KEY UPDATE name = VALUES(name)
        """))
        user_id = conn.execute(text("SELECT id FROM users WHERE email = 'marketplace@example.com'")).scalar_one()

    product_rows = []
    for _, row in df.drop_duplicates("sku").iterrows():
        price = float(row["amount"]) / max(int(row["quantity"]), 1)
        product_rows.append({
            "name": clean_name(row.get("Style"), clean_name(row["sku"], "Amazon SKU")),
            "category": clean_name(row["category"], "Uncategorized"),
            "price": round(price, 2),
            "sku": row["sku"]
        })

    with db.begin() as conn:
        for batch in chunks(product_rows):
            conn.execute(text("""
                INSERT INTO products (name, category, price, sku)
                VALUES (:name, :category, :price, :sku)
                ON DUPLICATE KEY UPDATE name = VALUES(name), category = VALUES(category), price = VALUES(price)
            """), batch)
        product_ids = fetch_id_map(conn, "products", "id", "sku", df["sku"].dropna().unique().tolist())

    order_rows = []
    for order_id, group in df.groupby("order_id", sort=False):
        first = group.iloc[0]
        order_rows.append({
            "external_order_id": order_id,
            "user_id": user_id,
            "date": first["date"].date(),
            "status": clean_name(first.get("Status"), "Unknown"),
            "sales_channel": clean_name(first.get("Sales Channel"), "Amazon"),
            "ship_city": clean_name(first.get("ship-city"), ""),
            "ship_state": clean_name(first.get("ship-state"), "")
        })

    with db.begin() as conn:
        for batch in chunks(order_rows):
            conn.execute(text("""
                INSERT INTO orders (external_order_id, user_id, date, status, sales_channel, ship_city, ship_state)
                VALUES (:external_order_id, :user_id, :date, :status, :sales_channel, :ship_city, :ship_state)
                ON DUPLICATE KEY UPDATE status = VALUES(status), date = VALUES(date), user_id = VALUES(user_id)
            """), batch)
        order_ids = fetch_id_map(conn, "orders", "id", "external_order_id", df["order_id"].dropna().unique().tolist())

    grouped_items = df.groupby(["order_id", "sku"], as_index=False)["quantity"].sum()
    item_rows = []
    for _, item in grouped_items.iterrows():
        order_id = order_ids.get(item["order_id"])
        product_id = product_ids.get(item["sku"])
        if order_id and product_id:
            item_rows.append({"order_id": order_id, "product_id": product_id, "quantity": int(item["quantity"])})

    with db.begin() as conn:
        for batch in chunks(list(order_ids.values())):
            params = {f"id_{i}": value for i, value in enumerate(batch)}
            placeholders = ", ".join(f":id_{i}" for i in range(len(batch)))
            conn.execute(text(f"DELETE FROM order_items WHERE order_id IN ({placeholders})"), params)
        for batch in chunks(item_rows):
            conn.execute(text("""
                INSERT INTO order_items (order_id, product_id, quantity)
                VALUES (:order_id, :product_id, :quantity)
            """), batch)
    print(f"Imported {len(df)} cleaned sales rows from {csv_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", default=r"D:\Trigent_internship\Amazon Sale Report.csv")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()
    import_csv(args.csv, args.limit)
