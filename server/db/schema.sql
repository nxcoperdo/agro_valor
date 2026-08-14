CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS coffee_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  price REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  unit TEXT NOT NULL DEFAULT 'cents_per_lb',
  source TEXT NOT NULL CHECK(source IN ('real', 'simulated')),
  provider TEXT,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_coffee_prices_fetched_at ON coffee_prices(fetched_at);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rate REAL NOT NULL,
  pair TEXT NOT NULL DEFAULT 'USD/COP',
  source TEXT NOT NULL CHECK(source IN ('real', 'simulated')),
  provider TEXT,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_fetched_at ON exchange_rates(fetched_at);

CREATE TABLE IF NOT EXISTS fnc_reference_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  price_cop_carga REAL NOT NULL,
  scraped_at TEXT NOT NULL DEFAULT (datetime('now')),
  source_url TEXT NOT NULL,
  raw_label TEXT
);
CREATE INDEX IF NOT EXISTS idx_fnc_scraped_at ON fnc_reference_prices(scraped_at);

CREATE TABLE IF NOT EXISTS cooperatives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  region TEXT,
  differential_pct REAL NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS forecast_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  granularity TEXT NOT NULL CHECK(granularity IN ('day', 'week', 'month')),
  step INTEGER NOT NULL,
  predicted_price REAL NOT NULL,
  predicted_for_date TEXT NOT NULL,
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  model_params TEXT
);

/* Alertas configuradas por el usuario (se entregan por WhatsApp). */
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('above', 'below', 'daily', 'weekly')),
  threshold_cop_carga REAL,
  active INTEGER NOT NULL DEFAULT 1,
  last_triggered_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);

CREATE TABLE IF NOT EXISTS alert_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_id INTEGER REFERENCES alerts(id) ON DELETE SET NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('sent', 'failed', 'queued')),
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_created ON alert_deliveries(created_at);

/* Precios reportados por los propios usuarios: la fuente real por cooperativa. */
CREATE TABLE IF NOT EXISTS price_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  cooperative_id INTEGER REFERENCES cooperatives(id) ON DELETE CASCADE,
  municipality TEXT,
  price_cop_carga REAL NOT NULL,
  factor REAL,
  humidity REAL,
  reported_for_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_price_reports_coop_date ON price_reports(cooperative_id, reported_for_date);

/* Registro de ventas del usuario, para su historial y para medir si vendió bien. */
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cooperative_id INTEGER REFERENCES cooperatives(id) ON DELETE SET NULL,
  cooperative_name TEXT,
  cargas REAL NOT NULL,
  price_cop_carga REAL NOT NULL,
  factor REAL,
  humidity REAL,
  sold_on TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sales_user_date ON sales(user_id, sold_on);
