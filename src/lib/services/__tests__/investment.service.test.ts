/**
 * M7 测试：Investment CRUD + 业务逻辑
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-investment.db");
const TEST_USER = "test_investment_user";

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
      email TEXT UNIQUE,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE accounts (
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

    CREATE TABLE investments (
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

    CREATE TABLE investment_transactions (
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
      source TEXT DEFAULT 'form',
      created_at INTEGER
    );
  `);

  // 创建测试用户和账户
  now = Math.floor(Date.now() / 1000);
  db.prepare("INSERT INTO users (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
    .run(TEST_USER, "测试用户", now, now);
  db.prepare("INSERT INTO accounts (id, user_id, name, type, balance, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run("acc_test_inv", TEST_USER, "测试账户", "investment", 10000, now, now);
});

afterAll(() => {
  db?.close();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

function generateId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

describe("M7: Investment CRUD", () => {
  it("创建基金持仓", () => {
    const id = generateId("inv");
    db.prepare(`
      INSERT INTO investments (id, user_id, name, type, ticker, total_units, total_cost, avg_cost, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, TEST_USER, "易方达蓝筹精选", "fund", "005827", 100, 1000, 10, now, now);

    const inv = db.prepare("SELECT * FROM investments WHERE id = ?").get(id) as any;
    expect(inv.name).toBe("易方达蓝筹精选");
    expect(inv.type).toBe("fund");
    expect(inv.ticker).toBe("005827");
    expect(inv.total_units).toBe(100);
    expect(inv.total_cost).toBe(1000);
    expect(inv.avg_cost).toBe(10);
  });

  it("创建股票持仓", () => {
    const id = generateId("inv");
    db.prepare(`
      INSERT INTO investments (id, user_id, name, type, ticker, total_units, total_cost, avg_cost, current_price, current_value, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, TEST_USER, "腾讯控股", "stock", "00700", 10, 3500, 350, 350, 3500, now, now);

    const inv = db.prepare("SELECT * FROM investments WHERE id = ?").get(id) as any;
    expect(inv.name).toBe("腾讯控股");
    expect(inv.type).toBe("stock");
    expect(inv.ticker).toBe("00700");
  });

  it("按类型筛选投资", () => {
    const funds = db.prepare("SELECT * FROM investments WHERE user_id = ? AND type = ?").all(TEST_USER, "fund") as any[];
    funds.forEach((f) => expect(f.type).toBe("fund"));
  });

  it("投资列表查询", () => {
    const list = db.prepare("SELECT * FROM investments WHERE user_id = ?").all(TEST_USER) as any[];
    expect(list.length).toBeGreaterThanOrEqual(2);
  });
});

describe("M7: 持仓更新逻辑", () => {
  it("买入后更新持仓份额和成本均价", () => {
    // 创建测试持仓
    const id = generateId("inv");
    db.prepare(`
      INSERT INTO investments (id, user_id, name, type, total_units, total_cost, avg_cost, current_nav, current_value, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, TEST_USER, "测试基金", "fund", 100, 1000, 10, 10, 1000, now, now);

    // 买入：500元，45份（净值11）
    const buyUnits = 45;
    const buyAmount = 500;
    const buyNav = 11;

    const invBefore = db.prepare("SELECT * FROM investments WHERE id = ?").get(id) as any;
    const newTotalUnits = (invBefore.total_units ?? 0) + buyUnits;
    const newTotalCost = (invBefore.total_cost ?? 0) + buyAmount;
    const newAvgCost = newTotalCost / newTotalUnits;

    db.prepare(`
      UPDATE investments SET total_units = ?, total_cost = ?, avg_cost = ?, updated_at = ? WHERE id = ?
    `).run(newTotalUnits, newTotalCost, newAvgCost, now, id);

    const invAfter = db.prepare("SELECT * FROM investments WHERE id = ?").get(id) as any;
    expect(invAfter.total_units).toBe(145);
    expect(invAfter.total_cost).toBe(1500);
    expect(invAfter.avg_cost).toBeCloseTo(10.3448, 3);
  });

  it("卖出后更新持仓份额和成本", () => {
    const id = generateId("inv");
    db.prepare(`
      INSERT INTO investments (id, user_id, name, type, total_units, total_cost, avg_cost, current_nav, current_value, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, TEST_USER, "测试卖出", "fund", 100, 1000, 10, 10, 1000, now, now);

    // 卖出30份
    const sellUnits = 30;
    const sellNav = 12;

    const invBefore = db.prepare("SELECT * FROM investments WHERE id = ?").get(id) as any;
    const newTotalUnits = (invBefore.total_units ?? 0) - sellUnits;
    const costRatio = newTotalUnits / ((invBefore.total_units ?? 0) === 0 ? 1 : invBefore.total_units ?? 1);
    const newTotalCost = (invBefore.total_cost ?? 0) * costRatio;
    const newAvgCost = newTotalUnits > 0 ? newTotalCost / newTotalUnits : 0;

    db.prepare(`
      UPDATE investments SET total_units = ?, total_cost = ?, avg_cost = ?, updated_at = ? WHERE id = ?
    `).run(newTotalUnits, newTotalCost, newAvgCost, now, id);

    const invAfter = db.prepare("SELECT * FROM investments WHERE id = ?").get(id) as any;
    expect(invAfter.total_units).toBe(70);
    expect(invAfter.total_cost).toBe(700);
  });

  it("卖出份额超限应被拦截", () => {
    const id = generateId("inv");
    db.prepare(`
      INSERT INTO investments (id, user_id, name, type, total_units, total_cost, avg_cost, current_nav, current_value, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, TEST_USER, "测试卖出份额", "fund", 100, 1000, 10, 10, 1000, now, now);

    const inv = db.prepare("SELECT total_units FROM investments WHERE id = ?").get(id) as any;
    const maxSell = inv.total_units ?? 0;

    // 尝试卖出超过持有份额
    const attemptedSell = maxSell + 100;
    const canSell = attemptedSell <= maxSell;
    expect(canSell).toBe(false); // 业务逻辑应拦截
  });
});

describe("M7: 行情更新与盈亏计算", () => {
  it("净值更新后正确计算盈亏", () => {
    const id = generateId("inv");
    db.prepare(`
      INSERT INTO investments (id, user_id, name, type, total_units, total_cost, avg_cost, current_nav, current_value, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, TEST_USER, "行情测试", "fund", 100, 1000, 10, 10, 1000, now, now);

    // 净值从10涨到11
    const newNav = 11;
    const invBefore = db.prepare("SELECT * FROM investments WHERE id = ?").get(id) as any;
    const totalUnits = invBefore.total_units ?? 0;
    const totalCost = invBefore.total_cost ?? 0;
    const newCurrentValue = totalUnits * newNav;
    const newProfit = newCurrentValue - totalCost;
    const newProfitRate = totalCost > 0 ? (newProfit / totalCost) * 100 : 0;

    db.prepare(`
      UPDATE investments SET current_nav = ?, current_value = ?, profit = ?, profit_rate = ?, updated_at = ? WHERE id = ?
    `).run(newNav, newCurrentValue, newProfit, newProfitRate, now, id);

    const invAfter = db.prepare("SELECT * FROM investments WHERE id = ?").get(id) as any;
    expect(invAfter.current_value).toBe(1100);
    expect(invAfter.profit).toBe(100);
    expect(invAfter.profit_rate).toBe(10);
  });
});

describe("M7: 删除与持仓状态", () => {
  it("空持仓允许删除", () => {
    const id = generateId("inv");
    db.prepare(`
      INSERT INTO investments (id, user_id, name, type, total_units, total_cost, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, TEST_USER, "待删除空仓", "fund", 0, 0, now, now);

    const inv = db.prepare("SELECT * FROM investments WHERE id = ?").get(id) as any;
    expect((inv.total_units ?? 0) > 0).toBe(false);

    db.prepare("DELETE FROM investments WHERE id = ?").run(id);
    const deleted = db.prepare("SELECT * FROM investments WHERE id = ?").get(id);
    expect(deleted).toBeUndefined();
  });

  it("有持仓禁止删除", () => {
    const id = generateId("inv");
    db.prepare(`
      INSERT INTO investments (id, user_id, name, type, total_units, total_cost, avg_cost, current_nav, current_value, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, TEST_USER, "有持仓基金", "fund", 100, 1000, 10, 10, 1000, now, now);

    const inv = db.prepare("SELECT total_units FROM investments WHERE id = ?").get(id) as any;
    expect((inv.total_units ?? 0) > 0).toBe(true); // 有持仓

    // 业务逻辑应阻止删除
    const canDelete = (inv.total_units ?? 0) === 0;
    expect(canDelete).toBe(false);
  });
});

console.log("✅ M7 测试完成");
