CREATE TABLE IF NOT EXISTS app_counters (
  name VARCHAR(40) PRIMARY KEY,
  value BIGINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO app_counters (name, value) VALUES
  ('order_number', 0),
  ('package_number', 0);

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  phone VARCHAR(40),
  password_hash TEXT NOT NULL,
  role ENUM('customer', 'staff', 'admin') NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  package_number VARCHAR(32) NOT NULL UNIQUE,
  customer_id INT NOT NULL,
  service_type ENUM('ai_similarity') NOT NULL DEFAULT 'ai_similarity',
  package_file_count INT NOT NULL,
  used_file_count INT NOT NULL DEFAULT 0,
  price_per_file_lkr DECIMAL(10, 2) NOT NULL,
  total_amount_lkr DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'LKR',
  payment_status ENUM('pending', 'paid', 'failed', 'cancelled', 'refunded') NOT NULL DEFAULT 'paid',
  status ENUM('active', 'used', 'cancelled') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_customer_packages_customer FOREIGN KEY (customer_id) REFERENCES users(id),
  CONSTRAINT chk_customer_packages_file_count CHECK (package_file_count > 0),
  CONSTRAINT chk_customer_packages_used_count CHECK (used_file_count >= 0),
  INDEX idx_customer_packages_customer_id (customer_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(32) NOT NULL UNIQUE,
  customer_package_id INT,
  customer_id INT NOT NULL,
  service_type ENUM('similarity_only', 'ai_similarity') NOT NULL,
  file_count INT NOT NULL,
  price_per_file_lkr DECIMAL(10, 2) NOT NULL,
  total_amount_lkr DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'LKR',
  payment_status ENUM('pending', 'paid', 'failed', 'cancelled', 'refunded') NOT NULL DEFAULT 'pending',
  order_status ENUM('pending_payment', 'paid', 'available', 'accepted', 'checking', 'report_uploaded', 'completed', 'cancelled') NOT NULL DEFAULT 'pending_payment',
  accepted_by_staff_id INT,
  accepted_at DATETIME,
  completed_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_customer_package FOREIGN KEY (customer_package_id) REFERENCES customer_packages(id),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES users(id),
  CONSTRAINT fk_orders_staff FOREIGN KEY (accepted_by_staff_id) REFERENCES users(id),
  CONSTRAINT chk_orders_file_count CHECK (file_count > 0),
  INDEX idx_orders_customer_id (customer_id),
  INDEX idx_orders_customer_package_id (customer_package_id),
  INDEX idx_orders_status (order_status, payment_status),
  INDEX idx_orders_staff_id (accepted_by_staff_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  original_file_name TEXT NOT NULL,
  stored_file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type VARCHAR(120),
  file_size BIGINT NOT NULL,
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_files_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_order_files_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS report_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  uploaded_by_staff_id INT NOT NULL,
  original_file_name TEXT NOT NULL,
  stored_file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type VARCHAR(120),
  file_size BIGINT NOT NULL,
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_report_files_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_files_staff FOREIGN KEY (uploaded_by_staff_id) REFERENCES users(id),
  INDEX idx_report_files_order_id (order_id),
  INDEX idx_report_files_staff_id (uploaded_by_staff_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS staff_earnings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  staff_id INT NOT NULL,
  order_id INT NOT NULL UNIQUE,
  completed_file_count INT NOT NULL,
  rate_per_file_usd DECIMAL(8, 2) NOT NULL DEFAULT 0.55,
  total_earning_usd DECIMAL(10, 2) NOT NULL,
  status ENUM('unpaid', 'paid') NOT NULL DEFAULT 'unpaid',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME,
  CONSTRAINT fk_staff_earnings_staff FOREIGN KEY (staff_id) REFERENCES users(id),
  CONSTRAINT fk_staff_earnings_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT chk_staff_earnings_file_count CHECK (completed_file_count > 0),
  INDEX idx_staff_earnings_staff_id (staff_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  order_id INT,
  action VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  ip_address VARCHAR(80),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_activity_logs_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_activity_logs_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  INDEX idx_activity_logs_created_at (created_at),
  INDEX idx_activity_logs_user_id (user_id),
  INDEX idx_activity_logs_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  order_id INT,
  type VARCHAR(60) NOT NULL,
  title VARCHAR(140) NOT NULL,
  message TEXT NOT NULL,
  link_path TEXT,
  read_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  INDEX idx_notifications_user_created (user_id, created_at),
  INDEX idx_notifications_user_unread (user_id, read_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
