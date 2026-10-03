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

/* Alertas configuradas por el usuario (se entregan por WhatsApp y/o notificación push). */
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

/* Teléfonos con la app instalada: a cada uno le llegan las notificaciones push (Firebase Cloud Messaging). */
CREATE TABLE IF NOT EXISTS push_devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_push_devices_user ON push_devices(user_id);

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

/* Códigos de un solo uso para restablecer contraseña, enviados por WhatsApp. */
CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);

/* Historial de cobros de la suscripción de Mercado Pago (idempotencia: un cobro no se aplica dos veces). */
CREATE TABLE IF NOT EXISTS mp_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mp_payment_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  amount_cop INTEGER NOT NULL,
  billing_period_start TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mp_payments_user ON mp_payments(user_id);

/* ============================================================================
   Módulo comercial de café (compras → lotes → procesamiento → inventario → ventas).
   Todo pertenece a un negocio (businesses); los usuarios entran como miembros con rol.
   Dinero: pesos COP enteros. Kilos: REAL (2 decimales). Fechas de negocio: YYYY-MM-DD.
   ============================================================================ */
CREATE TABLE IF NOT EXISTS businesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  nit TEXT,
  address TEXT,
  phone TEXT,
  logo_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS business_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('admin', 'operador', 'contador')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(business_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_business_members_user ON business_members(user_id);

/* Consecutivos por negocio, tipo y periodo (año o día). Se incrementan en transacción. */
CREATE TABLE IF NOT EXISTS sequences (
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  period TEXT NOT NULL,
  last_value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, key, period)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id INTEGER,
  changes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(business_id, entity, entity_id);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  id_type TEXT NOT NULL DEFAULT 'CC',
  id_number TEXT NOT NULL,
  name TEXT NOT NULL,
  legal_name TEXT,
  phone TEXT,
  address TEXT,
  municipality TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(business_id, id_type, id_number)
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  id_type TEXT NOT NULL DEFAULT 'NIT',
  id_number TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  municipality TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(business_id, id_type, id_number)
);

CREATE TABLE IF NOT EXISTS purchase_workdays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  work_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ABIERTA' CHECK(status IN ('ABIERTA', 'CERRADA')),
  opened_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  closed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(business_id, code)
);

CREATE TABLE IF NOT EXISTS lots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CREADO' CHECK(status IN
    ('CREADO','EN_TRANSPORTE','EN_SECADO','SECADO_FINALIZADO','DISPONIBLE_PARA_VENTA','PARCIALMENTE_VENDIDO','VENDIDO','CERRADO')),
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(business_id, code)
);

CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  receipt_code TEXT NOT NULL,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  workday_id INTEGER REFERENCES purchase_workdays(id) ON DELETE SET NULL,
  lot_id INTEGER REFERENCES lots(id) ON DELETE SET NULL,
  coffee_type TEXT NOT NULL DEFAULT 'cafe_verde',
  merma_inicial_pct REAL NOT NULL DEFAULT 0,
  peso_total_kg REAL NOT NULL,
  kg_descontados REAL NOT NULL,
  peso_pagable_kg REAL NOT NULL,
  precio_carga INTEGER NOT NULL,
  precio_kg REAL NOT NULL,
  total_compra INTEGER NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'efectivo' CHECK(payment_method IN ('efectivo','transferencia','credito','otro')),
  payment_reference TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVA' CHECK(status IN ('ACTIVA','ANULADA')),
  void_reason TEXT,
  voided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  voided_at TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  purchased_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(business_id, code),
  UNIQUE(business_id, receipt_code)
);
CREATE INDEX IF NOT EXISTS idx_purchases_business_date ON purchases(business_id, purchased_at);
CREATE INDEX IF NOT EXISTS idx_purchases_lot ON purchases(lot_id);
CREATE INDEX IF NOT EXISTS idx_purchases_workday ON purchases(workday_id);

CREATE TABLE IF NOT EXISTS purchase_weighings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  weight_kg REAL NOT NULL,
  weighed_at TEXT NOT NULL DEFAULT (datetime('now')),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_weighings_purchase ON purchase_weighings(purchase_id);

/* Costos internos de la compra (transporte, cargue, báscula...). Nunca van en el comprobante. */
CREATE TABLE IF NOT EXISTS purchase_costs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  concept TEXT NOT NULL,
  amount INTEGER NOT NULL,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_purchase_costs_purchase ON purchase_costs(purchase_id);

/* Abonos de compras a crédito (estructura lista; la UI llega después). */
CREATE TABLE IF NOT EXISTS purchase_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  method TEXT,
  reference TEXT,
  paid_at TEXT NOT NULL DEFAULT (datetime('now')),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS purchase_projections (
  purchase_id INTEGER PRIMARY KEY REFERENCES purchases(id) ON DELETE CASCADE,
  rendimiento_secado_pct REAL NOT NULL DEFAULT 55,
  kilos_secos REAL NOT NULL,
  destare_kg REAL NOT NULL DEFAULT 0,
  kilos_netos REAL NOT NULL,
  costos_procesamiento INTEGER NOT NULL DEFAULT 0,
  costos_json TEXT,
  costo_total INTEGER NOT NULL,
  costo_minimo_kg INTEGER,
  costo_minimo_carga INTEGER,
  precio_venta_carga INTEGER,
  ingreso INTEGER,
  utilidad INTEGER,
  margen REAL
);

CREATE TABLE IF NOT EXISTS lot_purchases (
  lot_id INTEGER NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id),
  PRIMARY KEY (lot_id, purchase_id)
);

CREATE TABLE IF NOT EXISTS lot_processing (
  lot_id INTEGER PRIMARY KEY REFERENCES lots(id) ON DELETE CASCADE,
  sent_on TEXT,
  place TEXT,
  kg_sent REAL,
  kilos_secos_reales REAL,
  destare_real_kg REAL NOT NULL DEFAULT 0,
  kilos_netos_reales REAL,
  rendimiento_real_pct REAL,
  finished_on TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lot_processing_costs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lot_id INTEGER NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  concept TEXT NOT NULL,
  amount INTEGER NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS inventory_lots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  lot_id INTEGER NOT NULL UNIQUE REFERENCES lots(id),
  kg_initial REAL NOT NULL,
  kg_sold REAL NOT NULL DEFAULT 0,
  location TEXT,
  entered_on TEXT NOT NULL,
  cost_kg INTEGER NOT NULL,
  cost_carga INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inventory_lot_id INTEGER NOT NULL REFERENCES inventory_lots(id),
  type TEXT NOT NULL CHECK(type IN ('ENTRADA','SALIDA_VENTA','AJUSTE')),
  kg REAL NOT NULL,
  ref_type TEXT,
  ref_id INTEGER,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS trade_sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  sold_on TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'efectivo',
  payment_reference TEXT,
  notes TEXT,
  total INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVA' CHECK(status IN ('ACTIVA','ANULADA')),
  void_reason TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(business_id, code)
);

CREATE TABLE IF NOT EXISTS trade_sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES trade_sales(id) ON DELETE CASCADE,
  inventory_lot_id INTEGER NOT NULL REFERENCES inventory_lots(id),
  kg REAL NOT NULL,
  factor REAL,
  precio_kg REAL NOT NULL,
  precio_carga INTEGER NOT NULL,
  subtotal INTEGER NOT NULL,
  cost_kg_frozen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON trade_sale_items(sale_id);
