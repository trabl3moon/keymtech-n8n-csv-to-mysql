-- Demo target table. Any table works: the workflow maps CSV columns to whatever columns you list in its Settings node.
CREATE TABLE IF NOT EXISTS customers (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  external_id   INT          NOT NULL UNIQUE,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(190) NOT NULL,
  signup_date   DATE         NULL,
  credit_limit  DECIMAL(12,2) NULL,
  imported_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);
