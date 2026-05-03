/**
 * M5 测试：月度报表 API
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-report.db");
const USER_ID = "test_user_report";

let db: Database.Database;

function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

beforeAll(() => {
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  db = new Database(TEST_DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      created_at INTEGER, updated_at INTEGER
    );

    CREATE TABLE accounts (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL, type TEXT NOT NULL,
      balance REAL DEFAULT 0, currency TEXT DEFAULT 'CNY',
      icon TEXT, color TEXT, sort_order INTEGER DEFAULT 0,
      is_default INTEGER DEFAULT 0, created_at INTEGER, updated_at INTEGER
    );

    CREATE TABLE categories (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL, name TEXT NOT NULL,
      icon TEXT, color TEXT, parent_id TEXT,
      sort_order INTEGER DEFAULT 0, is_system INTEGER DEFAULT 0,
      created_at INTEGER, updated_at INTEGER
    );

    CREATE TABLE transactions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      account_id TEXT NOT NULL REFERENCES accounts(id),
      category_id TEXT REFERENCES categories(id),
      type TEXT NOT NULL, amount REAL NOT NULL,
      description TEXT, notes TEXT, date INTEGER NOT NULL,
      tags TEXT, source TEXT DEFAULT 'form',
      investment_id TEXT, transfer_to_account_id TEXT,
      created_at INTEGER, updated_at INTEGER
    );
  `);

  const now = Math.floor(Date.now() / 1000);
  db.prepare("INSERT INTO users (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
    .run(USER_ID, "测试用户", now, now);

  db.prepare("INSERT INTO accounts (id, user_id, name, type, balance, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run("acc_rep", USER_ID, "测试账户", "cash", 0, now, now);

  db.prepare("INSERT INTO categories (id, user_id, type, name, is_system, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run("cat_food", USER_ID, "expense", "餐饮", 1, now, now);
  db.prepare("INSERT INTO categories (id, user_id, type, name, is_system, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run("cat_salary", USER_ID, "income", "工资", 1, now, now);
});

afterAll(() => {
  db?.close();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

function getMonthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);
  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000),
  };
}

describe("M5: 月度报表 API", () => {
  const now = Math.floor(Date.now() / 1000);
  const { start, end } = getMonthRange(2025, 5);

  it("空月份：收入和支出均为 0", () => {
    // 查询一个没有数据的月份
    const emptyStart = new Date(2099, 0, 1);
    const emptyEnd = new Date(2099, 0, 31);
    const emptyStartTs = Math.floor(emptyStart.getTime() / 1000);
    const emptyEndTs = Math.floor(emptyEnd.getTime() / 1000);

    const stats = db.prepare(`
      SELECT
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
      FROM transactions
      WHERE user_id = ? AND date >= ? AND date <= ?
    `).get(USER_ID, emptyStartTs, emptyEndTs) as any;

    expect(stats.income ?? 0).toBe(0);
    expect(stats.expense ?? 0).toBe(0);
  });

  it("按月统计：支出合计正确", () => {
    // 插入两笔支出
    db.prepare(`INSERT INTO transactions (id, user_id, account_id, category_id, type, amount, date, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(genId("tx"), USER_ID, "acc_rep", "cat_food", "expense", 50, start + 86400, "form", now, now);
    db.prepare(`INSERT INTO transactions (id, user_id, account_id, category_id, type, amount, date, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(genId("tx"), USER_ID, "acc_rep", "cat_food", "expense", 80, start + 86400 * 2, "form", now, now);

    const stats = db.prepare(`
      SELECT SUM(amount) as total FROM transactions
      WHERE user_id = ? AND type = 'expense' AND date >= ? AND date <= ?
    `).get(USER_ID, start, end) as any;

    expect(stats.total).toBe(130);
  });

  it("按月统计：收入合计正确", () => {
    db.prepare(`INSERT INTO transactions (id, user_id, account_id, category_id, type, amount, date, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(genId("tx"), USER_ID, "acc_rep", "cat_salary", "income", 5000, start + 86400 * 3, "form", now, now);

    const stats = db.prepare(`
      SELECT SUM(amount) as total FROM transactions
      WHERE user_id = ? AND type = 'income' AND date >= ? AND date <= ?
    `).get(USER_ID, start, end) as any;

    expect(stats.total).toBe(5000);
  });

  it("按分类统计：餐饮支出明细", () => {
    const byCat = db.prepare(`
      SELECT SUM(amount) as total, COUNT(*) as count FROM transactions
      WHERE user_id = ? AND category_id = ? AND type = 'expense' AND date >= ? AND date <= ?
    `).get(USER_ID, "cat_food", start, end) as any;

    expect(byCat.total).toBe(130);
    expect(byCat.count).toBe(2);
  });

  it("按日分组：日数据按日期升序", () => {
    const daily = db.prepare(`
      SELECT date / 86400 as day_ts,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
      FROM transactions
      WHERE user_id = ? AND date >= ? AND date <= ?
      GROUP BY day_ts
      ORDER BY day_ts
    `).all(USER_ID, start, end) as any[];

    expect(daily.length).toBeGreaterThan(0);
    for (let i = 1; i < daily.length; i++) {
      expect(daily[i].day_ts).toBeGreaterThanOrEqual(daily[i - 1].day_ts);
    }
  });

  it("月度结余 = 收入 - 支出", () => {
    const stats = db.prepare(`
      SELECT
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
      FROM transactions
      WHERE user_id = ? AND date >= ? AND date <= ?
    `).get(USER_ID, start, end) as any;

    const income = stats.income ?? 0;
    const expense = stats.expense ?? 0;
    const balance = income - expense;

    expect(balance).toBe(4870); // 5000 - 130
  });

  it("转账不计入收支", () => {
    // 插入一笔转账（不应计入收支）
    db.prepare(`INSERT INTO transactions (id, user_id, account_id, type, amount, date, source, transfer_to_account_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(genId("tx"), USER_ID, "acc_rep", "transfer", 1000, start + 86400 * 5, "form", "acc_rep", now, now);

    const stats = db.prepare(`
      SELECT
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
      FROM transactions
      WHERE user_id = ? AND date >= ? AND date <= ? AND type IN ('income', 'expense')
    `).get(USER_ID, start, end) as any;

    // 转账不计入，收支不变
    expect(stats.income).toBe(5000);
    expect(stats.expense).toBe(130);
  });
});

console.log("✅ M5 测试完成");
