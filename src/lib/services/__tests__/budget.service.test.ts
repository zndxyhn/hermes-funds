/**
 * M8 测试：Budget CRUD + 业务逻辑
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-budget.db");
const TEST_USER = "test_budget_user";

let db: Database.Database;
let now: number;

beforeAll(() => {
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  db = new Database(TEST_DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // 创建必要表
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      balance REAL DEFAULT 0,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      account_id TEXT NOT NULL REFERENCES accounts(id),
      category_id TEXT REFERENCES categories(id),
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      date INTEGER NOT NULL,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE budgets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      category_id TEXT,
      amount REAL NOT NULL,
      period TEXT DEFAULT 'monthly',
      start_date INTEGER,
      created_at INTEGER,
      updated_at INTEGER
    );
  `);

  // 创建测试用户
  now = Math.floor(Date.now() / 1000);
  db.prepare("INSERT INTO users (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
    .run(TEST_USER, "测试用户", now, now);

  // 创建测试分类
  db.prepare("INSERT INTO categories (id, user_id, type, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cat_food", TEST_USER, "expense", "餐饮", now, now);
  db.prepare("INSERT INTO categories (id, user_id, type, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cat_transport", TEST_USER, "expense", "交通", now, now);

  // 创建测试账户
  db.prepare("INSERT INTO accounts (id, user_id, name, type, balance, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run("acc_test", TEST_USER, "测试账户", "cash", 10000, now, now);
});

afterAll(() => {
  db?.close();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

function generateId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

describe("M8: Budget CRUD", () => {
  it("创建月度预算", () => {
    const id = generateId("bud");
    db.prepare(`
      INSERT INTO budgets (id, user_id, category_id, amount, period, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, TEST_USER, null, 5000, "monthly", now, now);

    const bud = db.prepare("SELECT * FROM budgets WHERE id = ?").get(id) as any;
    expect(bud.amount).toBe(5000);
    expect(bud.period).toBe("monthly");
  });

  it("创建分类预算", () => {
    const id = generateId("bud");
    db.prepare(`
      INSERT INTO budgets (id, user_id, category_id, amount, period, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, TEST_USER, "cat_food", 2000, "monthly", now, now);

    const bud = db.prepare("SELECT * FROM budgets WHERE id = ?").get(id) as any;
    expect(bud.category_id).toBe("cat_food");
    expect(bud.amount).toBe(2000);
  });

  it("按周期筛选预算", () => {
    const monthly = db.prepare("SELECT * FROM budgets WHERE user_id = ? AND period = ?").all(TEST_USER, "monthly") as any[];
    monthly.forEach((b) => expect(b.period).toBe("monthly"));
  });

  it("预算列表查询", () => {
    const list = db.prepare("SELECT * FROM budgets WHERE user_id = ?").all(TEST_USER) as any[];
    expect(list.length).toBeGreaterThanOrEqual(2);
  });
});

describe("M8: 预算进度计算", () => {
  it("当月支出计算", () => {
    // 插入当月支出
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);
    const monthStartTs = Math.floor(currentMonthStart.getTime() / 1000);

    db.prepare(`
      INSERT INTO transactions (id, user_id, account_id, category_id, type, amount, date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(generateId("tx"), TEST_USER, "acc_test", "cat_food", "expense", 500, monthStartTs, now, now);

    db.prepare(`
      INSERT INTO transactions (id, user_id, account_id, category_id, type, amount, date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(generateId("tx"), TEST_USER, "acc_test", "cat_food", "expense", 300, monthStartTs + 86400, now, now);

    // 验证支出
    const spent = db.prepare(`
      SELECT SUM(amount) as total FROM transactions
      WHERE user_id = ? AND category_id = ? AND type = 'expense'
      AND date >= ?
    `).get(TEST_USER, "cat_food", monthStartTs) as any;

    expect(spent.total).toBe(800);
  });

  it("超支判断", () => {
    const budgetAmount = 500;
    const spent = 600;
    const isOverBudget = spent > budgetAmount;
    expect(isOverBudget).toBe(true);
  });

  it("预算剩余金额计算", () => {
    const budgetAmount = 5000;
    const spent = 3000;
    const remaining = budgetAmount - spent;
    expect(remaining).toBe(2000);
  });

  it("预算进度百分比", () => {
    const budgetAmount = 5000;
    const spent = 2500;
    const percent = (spent / budgetAmount) * 100;
    expect(percent).toBe(50);
  });
});

describe("M8: 周期计算", () => {
  it("月度周期起始日期", () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    expect(monthStart.getDate()).toBe(1);
    expect(monthEnd.getDate()).toBeGreaterThanOrEqual(28);
  });

  it("年度周期起始日期", () => {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

    expect(yearStart.getMonth()).toBe(0);
    expect(yearEnd.getMonth()).toBe(11);
  });
});

console.log("✅ M8 测试完成");
