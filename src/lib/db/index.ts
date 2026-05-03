import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

// ─────────────────────────────────────────────
// 单例模式：确保数据库实例全局唯一
// ─────────────────────────────────────────────
let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (_db) return _db;

  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "hermes-funds.db");
  const sqlite = new Database(dbPath);

  // 开发环境启用 WAL 模式
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON"); // 启用外键约束

  _db = drizzle(sqlite, { schema });
  return _db;
}

// 兼容旧写法
export const db = getDb();

// ─────────────────────────────────────────────
// 数据库初始化（建表）
// ─────────────────────────────────────────────
export function initDatabase() {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "hermes-funds.db");
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  // 建表 SQL（严格匹配 schema.ts）
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      avatar TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('cash','bank','digital','investment','credit','other')),
      balance REAL DEFAULT 0,
      currency TEXT DEFAULT 'CNY',
      icon TEXT,
      color TEXT,
      sort_order INTEGER DEFAULT 0,
      is_default INTEGER DEFAULT 0,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL CHECK(type IN ('expense','income','investment')),
      name TEXT NOT NULL,
      icon TEXT,
      color TEXT,
      parent_id TEXT,
      sort_order INTEGER DEFAULT 0,
      is_system INTEGER DEFAULT 0,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      account_id TEXT NOT NULL REFERENCES accounts(id),
      category_id TEXT REFERENCES categories(id),
      type TEXT NOT NULL CHECK(type IN ('expense','income','transfer','investment_buy','investment_sell')),
      amount REAL NOT NULL,
      description TEXT,
      notes TEXT,
      date INTEGER NOT NULL,
      tags TEXT,
      source TEXT DEFAULT 'form' CHECK(source IN ('dialog','form','import','sip')),
      investment_id TEXT,
      transfer_to_account_id TEXT REFERENCES accounts(id),
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS investments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('fund','stock','etf','gold','bond','mmf','cb','reits','private','other')),
      ticker TEXT,
      total_units REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      avg_cost REAL DEFAULT 0,
      current_nav REAL,
      current_price REAL,
      current_value REAL DEFAULT 0,
      profit REAL DEFAULT 0,
      profit_rate REAL DEFAULT 0,
      last_nav_update INTEGER,
      notes TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS investment_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      investment_id TEXT NOT NULL REFERENCES investments(id),
      account_id TEXT NOT NULL REFERENCES accounts(id),
      type TEXT NOT NULL CHECK(type IN ('buy','sell','dividend','split')),
      amount REAL NOT NULL,
      units REAL NOT NULL,
      nav_price REAL NOT NULL,
      date INTEGER NOT NULL,
      notes TEXT,
      source TEXT DEFAULT 'form' CHECK(source IN ('dialog','form','sip')),
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS fund_cache (
      ticker TEXT PRIMARY KEY,
      name TEXT,
      nav REAL,
      nav_date TEXT,
      est_nav REAL,
      est_nav_time TEXT,
      day_change REAL,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS sip_plans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      investment_id TEXT NOT NULL REFERENCES investments(id),
      account_id TEXT NOT NULL REFERENCES accounts(id),
      amount REAL NOT NULL,
      frequency TEXT NOT NULL CHECK(frequency IN ('daily','weekly','biweekly','monthly','quarterly')),
      next_run_date INTEGER NOT NULL,
      last_run_date INTEGER,
      enabled INTEGER DEFAULT 1,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      category_id TEXT REFERENCES categories(id),
      amount REAL NOT NULL,
      period TEXT DEFAULT 'monthly' CHECK(period IN ('weekly','monthly','yearly')),
      start_date INTEGER,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS asset_snapshots (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      total_net_worth REAL DEFAULT 0,
      total_investments REAL DEFAULT 0,
      total_cash REAL DEFAULT 0,
      total_debt REAL DEFAULT 0,
      snapshot_date INTEGER,
      created_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id);
    CREATE INDEX IF NOT EXISTS idx_inv_user ON investments(user_id);
    CREATE INDEX IF NOT EXISTS idx_inv_ticker ON investments(ticker);
    CREATE INDEX IF NOT EXISTS idx_invtx_investment ON investment_transactions(investment_id);
    CREATE INDEX IF NOT EXISTS idx_invtx_date ON investment_transactions(date);
    CREATE INDEX IF NOT EXISTS idx_snap_user ON asset_snapshots(user_id);
  `);

  sqlite.close();
}

// 仅在直接运行时执行初始化
if (require.main === module) {
  initDatabase();
  console.log("✅ 数据库初始化完成");
}
