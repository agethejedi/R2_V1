CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  active_asset TEXT NOT NULL DEFAULT 'ETH-USD',
  mode TEXT NOT NULL DEFAULT 'paper',
  aggressiveness TEXT NOT NULL DEFAULT 'balanced',
  live_switch_enabled INTEGER NOT NULL DEFAULT 0,
  kill_switch_enabled INTEGER NOT NULL DEFAULT 0,
  max_trade_amount_usd REAL NOT NULL DEFAULT 100,
  max_loss_per_trade_usd REAL NOT NULL DEFAULT 10,
  desired_profit_per_trade_usd REAL NOT NULL DEFAULT 15,
  max_daily_loss_usd REAL NOT NULL DEFAULT 30,
  trade_amount_mode TEXT NOT NULL DEFAULT 'manual',
  profit_target_mode TEXT NOT NULL DEFAULT 'manual',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  asset TEXT NOT NULL,
  mode TEXT NOT NULL,
  quantity REAL NOT NULL,
  avg_entry_price REAL NOT NULL,
  stop_price REAL,
  target_price REAL,
  peak_price REAL,
  last_price REAL,
  status TEXT NOT NULL,
  realized_pnl REAL NOT NULL DEFAULT 0,
  unrealized_pnl REAL NOT NULL DEFAULT 0,
  entry_reason TEXT,
  exit_reason TEXT,
  opened_at TEXT NOT NULL,
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  exchange_order_id TEXT,
  asset TEXT NOT NULL,
  mode TEXT NOT NULL,
  side TEXT NOT NULL,
  order_type TEXT NOT NULL,
  requested_notional_usd REAL,
  requested_quantity REAL,
  filled_quantity REAL NOT NULL DEFAULT 0,
  avg_fill_price REAL,
  fee_usd REAL NOT NULL DEFAULT 0,
  slippage_usd REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  strategy_tag TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fills (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  asset TEXT NOT NULL,
  side TEXT NOT NULL,
  fill_quantity REAL NOT NULL,
  fill_price REAL NOT NULL,
  fee_usd REAL NOT NULL DEFAULT 0,
  timestamp TEXT NOT NULL,
  FOREIGN KEY(order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,
  asset TEXT NOT NULL,
  regime TEXT,
  regime_confidence REAL,
  vwap_delta REAL,
  ema_fast REAL,
  ema_slow REAL,
  orderbook_imbalance REAL,
  tradeflow_imbalance REAL,
  momentum_score REAL,
  volume_score REAL,
  relative_strength_fast REAL,
  relative_strength_slow REAL,
  composite_score REAL,
  recommendation TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  asset TEXT NOT NULL,
  mode TEXT NOT NULL,
  allowed INTEGER NOT NULL,
  reason TEXT NOT NULL,
  setup_type TEXT,
  aggressiveness TEXT,
  score REAL,
  regime TEXT,
  commentary TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_risk (
  id TEXT PRIMARY KEY,
  trade_date TEXT NOT NULL,
  asset TEXT NOT NULL,
  mode TEXT NOT NULL,
  realized_loss_usd REAL NOT NULL DEFAULT 0,
  realized_gain_usd REAL NOT NULL DEFAULT 0,
  trades_count INTEGER NOT NULL DEFAULT 0,
  max_daily_loss_hit INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS app_logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL,
  area TEXT NOT NULL,
  message TEXT NOT NULL,
  data_json TEXT,
  created_at TEXT NOT NULL
);
