# Database Design

## Tables

- `users(id, name, email, password, role)`: application users and imported marketplace customer.
- `products(id, name, category, price, sku)`: SKU-level product master data.
- `orders(id, external_order_id, user_id, date, status, sales_channel, ship_city, ship_state)`: order header.
- `order_items(order_id, product_id, quantity)`: line items. Composite primary key prevents duplicate products inside an order.

## Relationships

- One user has many orders.
- One order has many order items.
- One product appears in many order items.
- Revenue is not stored as a base field because it is derivable: `quantity * price`.

## Scripts

- `database/schema.sql`: creates database, tables, indexes, foreign keys, and `order_revenue` view.
- `database/seed.sql`: inserts demo users, products, and orders.
- `python_service/import_amazon_sales.py`: imports the Amazon Sale Report into the normalized schema.
