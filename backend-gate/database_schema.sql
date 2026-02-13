-- RFID Gate System Database Schema
-- Optimized for low-latency queries

-- Products table with RFID mapping
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    rfid_uid VARCHAR(50) UNIQUE NOT NULL,
    product_name VARCHAR(255),
    user_id INTEGER,
    price DECIMAL(10, 2),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_products_rfid_uid ON products(rfid_uid);
CREATE INDEX IF NOT EXISTS idx_products_payment_status ON products(payment_status);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);

-- Activity log table (optional, for audit trail)
CREATE TABLE IF NOT EXISTS gate_access_log (
    id SERIAL PRIMARY KEY,
    rfid_uid VARCHAR(50) NOT NULL,
    payment_status_checked VARCHAR(20),
    access_granted BOOLEAN,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    esp32_ip VARCHAR(50)
);

-- Create index for logs
CREATE INDEX IF NOT EXISTS idx_gate_access_log_timestamp ON gate_access_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_gate_access_log_rfid_uid ON gate_access_log(rfid_uid);

-- Add comment explaining the table
COMMENT ON TABLE products IS 'Stores RFID UID mappings with payment status for gate access';
COMMENT ON COLUMN products.rfid_uid IS 'RFID card unique identifier (uppercase hex)';
COMMENT ON COLUMN products.payment_status IS 'Payment completion status: pending, completed, failed';
