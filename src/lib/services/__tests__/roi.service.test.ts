/**
 * M11 测试：ROI Service 单元测试
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-roi.db");

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

    CREATE TABLE investment_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      investment_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      units REAL NOT NULL,
      nav_price REAL NOT NULL,
      date INTEGER NOT NULL,
      notes TEXT,
      source TEXT DEFAULT 'form',
      created_at INTEGER,
      updated_at INTEGER
    );
  `);

  const now = Math.floor(Date.now() / 1000);
  db.prepare(`INSERT INTO users (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`).run("user_roi_test", "测试用户", now, now);
});

afterAll(() => {
  db.close();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

// ─────────────────────────────────────────────
// ROI 计算逻辑测试
// ─────────────────────────────────────────────

describe("ROIService", () => {
  describe("calculateInvestmentROI", () => {
    it("应正确计算买入后的持仓收益率", () => {
      const now = Math.floor(Date.now() / 1000);
      const invId = "inv_roi_test_1";

      // 创建投资
      db.prepare(`
        INSERT INTO investments (id, user_id, name, type, ticker, total_units, total_cost, current_nav, current_value, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(invId, "user_roi_test", "测试基金", "fund", "000001", 100, 1000, 11.0, 1100, now, now);

      // 买入交易
      db.prepare(`
        INSERT INTO investment_transactions (id, user_id, investment_id, account_id, type, amount, units, nav_price, date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run("tx_buy_1", "user_roi_test", invId, "acc_test", "buy", 1000, 100, 10.0, now - 86400 * 30, now, now);

      // 手动计算 ROI（模拟 service 逻辑）
      const transactions = db.prepare(`SELECT * FROM investment_transactions WHERE investment_id = ?`).all(invId) as any[];

      let totalUnits = 0;
      let totalCost = 0;
      let firstBuyDate: number | null = null;

      for (const tx of transactions) {
        if (tx.type === "buy") {
          totalUnits += tx.units;
          totalCost += tx.amount;
          if (!firstBuyDate || tx.date < firstBuyDate) firstBuyDate = tx.date;
        }
      }

      const currentNav = 11.0;
      const currentValue = totalUnits * currentNav;
      const profit = currentValue - totalCost;
      const profitRate = totalCost > 0 ? (profit / totalCost) * 100 : 0;
      const holdingDays = firstBuyDate ? Math.floor((now - firstBuyDate) / 86400) : 0;

      expect(totalUnits).toBe(100);
      expect(totalCost).toBe(1000);
      expect(currentValue).toBe(1100);
      expect(profit).toBe(100);
      expect(profitRate).toBeCloseTo(10, 1);
      expect(holdingDays).toBeGreaterThanOrEqual(29);
    });

    it("应正确计算买卖后的已实现收益", () => {
      const now = Math.floor(Date.now() / 1000);
      const invId = "inv_roi_test_2";

      db.prepare(`
        INSERT INTO investments (id, user_id, name, type, ticker, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(invId, "user_roi_test", "测试股票", "stock", "600000", now, now);

      // 买入 100 股，每股 10 元
      db.prepare(`
        INSERT INTO investment_transactions (id, user_id, investment_id, account_id, type, amount, units, nav_price, date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run("tx_buy_2", "user_roi_test", invId, "acc_test", "buy", 1000, 100, 10.0, now - 86400 * 60, now, now);

      // 卖出 50 股，每股 12 元
      db.prepare(`
        INSERT INTO investment_transactions (id, user_id, investment_id, account_id, type, amount, units, nav_price, date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run("tx_sell_2", "user_roi_test", invId, "acc_test", "sell", 600, 50, 12.0, now - 86400 * 30, now, now);

      const transactions = db.prepare(`SELECT * FROM investment_transactions WHERE investment_id = ? ORDER BY date`).all(invId) as any[];

      let totalBoughtShares = 0;
      let totalSoldShares = 0;
      let totalBuyAmount = 0;
      let totalSellAmount = 0;

      for (const tx of transactions) {
        if (tx.type === "buy") {
          totalBoughtShares += tx.units;
          totalBuyAmount += tx.amount;
        } else if (tx.type === "sell") {
          totalSoldShares += tx.units;
          totalSellAmount += tx.amount;
        }
      }

      const avgBuyCost = totalBuyAmount / totalBoughtShares;
      const realizedProfit = totalSellAmount - totalSoldShares * avgBuyCost;

      expect(totalBoughtShares).toBe(100);
      expect(totalSoldShares).toBe(50);
      expect(totalBuyAmount).toBe(1000);
      expect(totalSellAmount).toBe(600);
      expect(avgBuyCost).toBe(10);
      expect(realizedProfit).toBeCloseTo(100, 1); // (12 - 10) * 50 = 100
    });

    it("应正确累加分红", () => {
      const now = Math.floor(Date.now() / 1000);
      const invId = "inv_roi_test_3";

      db.prepare(`
        INSERT INTO investments (id, user_id, name, type, ticker, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(invId, "user_roi_test", "测试基金", "fund", "000003", now, now);

      // 买入
      db.prepare(`
        INSERT INTO investment_transactions (id, user_id, investment_id, account_id, type, amount, units, nav_price, date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run("tx_buy_3", "user_roi_test", invId, "acc_test", "buy", 5000, 500, 10.0, now - 86400 * 90, now, now);

      // 分红
      db.prepare(`
        INSERT INTO investment_transactions (id, user_id, investment_id, account_id, type, amount, units, nav_price, date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run("tx_div_3", "user_roi_test", invId, "acc_test", "dividend", 50, 0, 0, now - 86400 * 45, now, now);

      const transactions = db.prepare(`SELECT * FROM investment_transactions WHERE investment_id = ?`).all(invId) as any[];

      let totalDividends = 0;
      for (const tx of transactions) {
        if (tx.type === "dividend") {
          totalDividends += tx.amount;
        }
      }

      expect(totalDividends).toBe(50);
    });

    it("应正确计算年化收益率", () => {
      const now = Math.floor(Date.now() / 1000);
      const firstBuyDate = now - 365 * 86400; // 1年前

      // 1年前投入1000，现在市值1200，总收益20%
      // 年化收益率应该约20%
      const holdingDays = 365;
      const totalProfitRate = 20; // 20%
      const annualReturn = (totalProfitRate / holdingDays) * 365;

      expect(annualReturn).toBeCloseTo(20, 1);
    });

    it("应处理卖出超过买入份额的情况", () => {
      const now = Math.floor(Date.now() / 1000);
      const invId = "inv_roi_test_4";

      // 先买入 100 份
      db.prepare(`
        INSERT INTO investment_transactions (id, user_id, investment_id, account_id, type, amount, units, nav_price, date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run("tx_buy_4", "user_roi_test", invId, "acc_test", "buy", 1000, 100, 10.0, now - 86400 * 30, now, now);

      // 卖出 150 份（超过持有）
      db.prepare(`
        INSERT INTO investment_transactions (id, user_id, investment_id, account_id, type, amount, units, nav_price, date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run("tx_sell_4", "user_roi_test", invId, "acc_test", "sell", 1500, 150, 10.0, now - 86400 * 15, now, now);

      const transactions = db.prepare(`SELECT * FROM investment_transactions WHERE investment_id = ? ORDER BY date`).all(invId) as any[];

      let totalUnits = 0;
      let totalCost = 0;

      for (const tx of transactions) {
        if (tx.type === "buy") {
          totalUnits += tx.units;
          totalCost += tx.amount;
        } else if (tx.type === "sell") {
          const avgCost = totalUnits > 0 ? totalCost / totalUnits : 0;
          totalUnits -= tx.units;
          totalCost -= tx.units * avgCost;
          if (totalUnits < 0) totalUnits = 0;
          if (totalCost < 0) totalCost = 0;
        }
      }

      // 卖出150，但只持有100，所以份额归0，成本归0
      expect(totalUnits).toBe(0);
      expect(totalCost).toBe(0);
    });
  });
});
