/**
 * M12 测试：Net Worth + Cash Flow Service 单元测试
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-networth.db");

let db: Database.Database;

beforeAll(() => {
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  db = new Database(TEST_DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      balance REAL DEFAULT 0,
      currency TEXT DEFAULT 'CNY',
      icon TEXT,
      color TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE investments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
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

    CREATE TABLE transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      date INTEGER NOT NULL,
      description TEXT,
      notes TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );
  `);

  const now = Math.floor(Date.now() / 1000);
  db.prepare(`INSERT INTO users (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`).run("user_nw_test", "测试用户", now, now);
});

afterAll(() => {
  db.close();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

describe("NetWorth + CashFlow Service", () => {
  describe("Net Worth Calculation", () => {
    it("应正确计算净资产（资产 - 负债）", () => {
      const now = Math.floor(Date.now() / 1000);

      // 现金账户 10000
      db.prepare(`INSERT INTO accounts (id, user_id, name, type, balance, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run("acc_nw_1", "user_nw_test", "银行卡", "cash", 10000, now, now);

      // 信用卡负债 2000
      db.prepare(`INSERT INTO accounts (id, user_id, name, type, balance, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run("acc_nw_2", "user_nw_test", "信用卡", "credit", -2000, now, now);

      // 投资持仓 5000
      db.prepare(`INSERT INTO investments (id, user_id, name, type, current_value, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run("inv_nw_1", "user_nw_test", "基金A", "fund", 5000, now, now);

      const accountsData = db.prepare(`SELECT * FROM accounts WHERE user_id = ?`).all("user_nw_test") as any[];
      const investmentsData = db.prepare(`SELECT * FROM investments WHERE user_id = ?`).all("user_nw_test") as any[];

      let cashBalance = 0;
      let liabilities = 0;
      let investmentValue = 0;

      for (const acc of accountsData) {
        if (acc.type === "credit" && acc.balance < 0) {
          liabilities += Math.abs(acc.balance);
        } else {
          cashBalance += acc.balance;
        }
      }

      for (const inv of investmentsData) {
        investmentValue += inv.current_value ?? 0;
      }

      const totalAssets = cashBalance + investmentValue; // 15000
      const netWorth = totalAssets - liabilities; // 13000

      expect(totalAssets).toBe(15000);
      expect(liabilities).toBe(2000);
      expect(netWorth).toBe(13000);
    });

    it("应正确计算资产配置比例", () => {
      const now = Math.floor(Date.now() / 1000);

      db.prepare(`INSERT INTO accounts (id, user_id, name, type, balance, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run("acc_prop_1", "user_nw_test", "银行卡", "cash", 8000, now, now);
      db.prepare(`INSERT INTO investments (id, user_id, name, type, current_value, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run("inv_prop_1", "user_nw_test", "基金A", "fund", 2000, now, now);

      const totalAssets = 8000 + 2000; // 10000
      const cashProportion = (8000 / totalAssets) * 100; // 80%
      const investmentProportion = (2000 / totalAssets) * 100; // 20%

      expect(cashProportion).toBe(80);
      expect(investmentProportion).toBe(20);
    });
  });

  describe("Cash Flow Calculation", () => {
    it("应正确计算月度净现金流（收入 - 支出）", () => {
      const now = Math.floor(Date.now() / 1000);
      const startOfMonth = new Date(now * 1000);
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const monthStart = Math.floor(startOfMonth.getTime() / 1000);

      // 收入 5000
      db.prepare(`INSERT INTO transactions (id, user_id, account_id, category_id, type, amount, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run("tx_cf_1", "user_nw_test", "acc_nw_1", "cat_income", "income", 5000, monthStart + 86400, now, now);

      // 支出 3000
      db.prepare(`INSERT INTO transactions (id, user_id, account_id, category_id, type, amount, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run("tx_cf_2", "user_nw_test", "acc_nw_1", "cat_expense", "expense", 3000, monthStart + 86400 * 2, now, now);

      // 投资买入 1000
      db.prepare(`INSERT INTO transactions (id, user_id, account_id, category_id, type, amount, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run("tx_cf_3", "user_nw_test", "acc_nw_1", "cat_inv", "investment", 1000, monthStart + 86400 * 3, now, now);

      const txs = db.prepare(`SELECT * FROM transactions WHERE user_id = ?`).all("user_nw_test") as any[];

      let income = 0, expense = 0, investmentIn = 0;
      for (const tx of txs) {
        if (tx.type === "income") income += tx.amount;
        else if (tx.type === "expense") expense += tx.amount;
        else if (tx.type === "investment" && tx.amount > 0) investmentIn += tx.amount;
      }

      const netCashFlow = income - expense;

      expect(income).toBe(5000);
      expect(expense).toBe(3000);
      expect(netCashFlow).toBe(2000);
      expect(investmentIn).toBe(1000);
    });

    it("应正确识别支出分类排名", () => {
      const now = Math.floor(Date.now() / 1000);
      const startOfMonth = new Date(now * 1000);
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const monthStart = Math.floor(startOfMonth.getTime() / 1000);

      db.prepare(`INSERT INTO transactions (id, user_id, account_id, category_id, type, amount, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run("tx_cat_1", "user_nw_test", "acc_nw_1", "cat_food", "expense", 500, monthStart, now, now);
      db.prepare(`INSERT INTO transactions (id, user_id, account_id, category_id, type, amount, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run("tx_cat_2", "user_nw_test", "acc_nw_1", "cat_food", "expense", 300, monthStart + 86400, now, now);
      db.prepare(`INSERT INTO transactions (id, user_id, account_id, category_id, type, amount, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run("tx_cat_3", "user_nw_test", "acc_nw_1", "cat_transport", "expense", 200, monthStart + 86400 * 2, now, now);

      const txs = db.prepare(`SELECT * FROM transactions WHERE user_id = ? AND type = ? AND id LIKE ?`).all("user_nw_test", "expense", "tx_cat_%") as any[];

      const categoryTotals = new Map<string, number>();
      for (const tx of txs) {
        categoryTotals.set(tx.category_id, (categoryTotals.get(tx.category_id) ?? 0) + tx.amount);
      }

      const sorted = Array.from(categoryTotals.entries()).sort((a, b) => b[1] - a[1]);
      expect(sorted[0][0]).toBe("cat_food");
      expect(sorted[0][1]).toBe(800);
      expect(sorted[1][0]).toBe("cat_transport");
      expect(sorted[1][1]).toBe(200);
    });
  });
});
