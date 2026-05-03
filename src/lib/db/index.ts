import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

// 确保数据目录存在
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "hermes-funds.db");
const sqlite = new Database(dbPath);

// 开发环境：每次重启重置数据库（可选，上线前删除）
if (process.env.NODE_ENV === "development") {
  // 启用 WAL 模式获得更好的并发性能
  sqlite.pragma("journal_mode = WAL");
}

export const db = drizzle(sqlite, { schema });

// 初始化数据库表
export function initDb() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      avatar TEXT,
      role TEXT DEFAULT 'member',
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      balance REAL DEFAULT 0,
      currency TEXT DEFAULT 'CNY',
      icon TEXT,
      color TEXT,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      icon TEXT,
      color TEXT,
      parent_id TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      account_id TEXT NOT NULL REFERENCES accounts(id),
      category_id TEXT REFERENCES categories(id),
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      notes TEXT,
      date INTEGER NOT NULL,
      tags TEXT,
      investment_id TEXT REFERENCES investments(id),
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS investments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      ticker TEXT,
      purchase_price REAL NOT NULL,
      current_nav REAL,
      current_price REAL,
      units REAL NOT NULL,
      purchase_date INTEGER NOT NULL,
      notes TEXT,
      last_price_update INTEGER,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      category_id TEXT REFERENCES categories(id),
      amount REAL NOT NULL,
      period TEXT DEFAULT 'monthly',
      start_date INTEGER,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS asset_snapshots (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      total_net_worth REAL DEFAULT 0,
      total_investments REAL DEFAULT 0,
      total_cash REAL DEFAULT 0,
      total_debt REAL DEFAULT 0,
      snapshot_date INTEGER
    );
  `);
}

// 初始化
initDb();
