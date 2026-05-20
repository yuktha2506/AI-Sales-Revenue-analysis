
INSERT INTO users (name, email, password, role) VALUES
('Admin User', 'admin@example.com', '$2a$12$dFEV5RsF7tQwt7Dv8QFm5uTJ0b4m6PDtAOrZnHXc3hiicmTaMPRD.', 'admin'),
('Demo Customer', 'customer@example.com', '$2a$12$dFEV5RsF7tQwt7Dv8QFm5uTJ0b4m6PDtAOrZnHXc3hiicmTaMPRD.', 'user')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO products (name, category, price, sku) VALUES
('Classic Kurta', 'kurta', 699.00, 'DEMO-KURTA'),
('Ethnic Set', 'Set', 1199.00, 'DEMO-SET'),
('Western Dress', 'Dress', 1499.00, 'DEMO-DRESS'),
('Blouse', 'Blouse', 549.00, 'DEMO-BLOUSE')
ON DUPLICATE KEY UPDATE price = VALUES(price);

INSERT INTO orders (external_order_id, user_id, date, status, sales_channel, ship_city, ship_state) VALUES
('DEMO-1001', 2, '2022-03-12', 'Shipped', 'Demo', 'Mumbai', 'Maharashtra'),
('DEMO-1002', 2, '2022-04-18', 'Shipped', 'Demo', 'Bengaluru', 'Karnataka'),
('DEMO-1003', 2, '2022-05-21', 'Shipped', 'Demo', 'Delhi', 'Delhi'),
('DEMO-1004', 2, '2022-06-09', 'Shipped', 'Demo', 'Chennai', 'Tamil Nadu')
ON DUPLICATE KEY UPDATE status = VALUES(status);

INSERT IGNORE INTO order_items (order_id, product_id, quantity) VALUES
(1, 1, 4), (1, 2, 1), (2, 2, 3), (2, 3, 1), (3, 1, 6), (3, 4, 4), (4, 3, 2);
