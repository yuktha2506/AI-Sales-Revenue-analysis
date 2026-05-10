USE sales_analytics;

CREATE INDEX idx_orders_user_date ON orders(user_id, date);
CREATE INDEX idx_order_items_product ON order_items(product_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_products_category_name ON products(category, name);
