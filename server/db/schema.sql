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
  horizon TEXT NOT NULL CHECK(horizon IN ('1d', '7d', '30d')),
  predicted_price REAL NOT NULL,
  predicted_for_date TEXT NOT NULL,
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  model_params TEXT
);
