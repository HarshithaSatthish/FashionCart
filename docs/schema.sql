CREATE DATABASE IF NOT EXISTS fashioncart;
USE fashioncart;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'USER',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX ix_users_role (role)
);

CREATE TABLE customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  gender VARCHAR(30),
  age INT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX ix_customers_name (name)
);

CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_name VARCHAR(120) NOT NULL,
  category VARCHAR(80) NOT NULL,
  subcategory VARCHAR(80),
  brand VARCHAR(80),
  price DECIMAL(10,2) NOT NULL,
  stock_quantity INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX ix_products_name (product_name),
  INDEX ix_products_category_price (category, price)
);

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  order_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  INDEX ix_orders_customer_status_date (customer_id, status, order_date)
);

CREATE TABLE order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT uq_order_product UNIQUE (order_id, product_id),
  INDEX ix_order_items_product (product_id)
);

CREATE TABLE imported_transaction_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_id VARCHAR(100) NOT NULL,
  product VARCHAR(120) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_import_tx_product UNIQUE (transaction_id, product),
  INDEX ix_import_transaction (transaction_id),
  INDEX ix_import_product (product)
);

CREATE TABLE analysis_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  min_support DOUBLE NOT NULL,
  min_confidence DOUBLE NOT NULL,
  min_lift DOUBLE NOT NULL,
  transaction_count INT NOT NULL DEFAULT 0,
  frequent_itemset_count INT NOT NULL DEFAULT 0,
  association_rule_count INT NOT NULL DEFAULT 0,
  execution_time_ms INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL,
  error_message TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX ix_analysis_status_created (status, created_at)
);

CREATE TABLE frequent_itemsets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  analysis_id INT NOT NULL,
  items TEXT NOT NULL,
  support DOUBLE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_itemsets_analysis FOREIGN KEY (analysis_id) REFERENCES analysis_runs(id) ON DELETE CASCADE,
  INDEX ix_itemsets_analysis (analysis_id),
  INDEX ix_itemsets_support (support)
);

CREATE TABLE association_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  analysis_id INT NOT NULL,
  antecedent TEXT NOT NULL,
  consequent TEXT NOT NULL,
  support DOUBLE NOT NULL,
  confidence DOUBLE NOT NULL,
  lift DOUBLE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rules_analysis FOREIGN KEY (analysis_id) REFERENCES analysis_runs(id) ON DELETE CASCADE,
  INDEX ix_rules_analysis_lift (analysis_id, lift),
  INDEX ix_rules_analysis_confidence (analysis_id, confidence)
);
