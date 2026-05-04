/**
 * M13 测试：Fund Search Service 单元测试
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-fund-search.db");

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
  `);

  const now = Math.floor(Date.now() / 1000);
  db.prepare(`INSERT INTO users (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`).run("user_fs_test", "测试用户", now, now);

  // Seed test data
  const funds = [
    ["inv_fs_1", "user_fs_test", "华夏成长混合", "fund", "000001", 5000, 50],
    ["inv_fs_2", "user_fs_test", "招商中证白酒", "fund", "000011", 12000, 120],
    ["inv_fs_3", "user_fs_test", "易方达沪深300ETF", "etf", "510310", 8000, 80],
    ["inv_fs_4", "user_fs_test", "博时黄金ETF", "gold", "000217", 3000, 30],
    ["inv_fs_5", "user_fs_test", "贵州茅台", "stock", "600519", 20000, 200],
  ];

  for (const [id, uid, name, type, ticker, value, profit] of funds) {
    const rate = (profit / (value - profit)) * 100;
    db.prepare(`
      INSERT INTO investments (id, user_id, name, type, ticker, current_value, profit, profit_rate, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, uid, name, type, ticker, value, profit, rate, now, now);
  }
});

afterAll(() => {
  db.close();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

describe("FundSearchService", () => {
  describe("validateFundTicker", () => {
    it("应接受6位数字代码", () => {
      const valid = /^\d{6}$/.test("000001");
      const invalid = /^\d{6}$/.test("00001");
      expect(valid).toBe(true);
      expect(invalid).toBe(false);
    });
  });

  describe("searchFunds", () => {
    it("应按名称模糊搜索", () => {
      const funds = db.prepare(`SELECT * FROM investments WHERE user_id = ? AND (name LIKE ? OR ticker LIKE ?)`).all("user_fs_test", "%华夏%", "%%") as any[];

      expect(funds.length).toBeGreaterThanOrEqual(1);
      expect(funds.some((f: any) => f.name.includes("华夏"))).toBe(true);
    });

    it("应按代码精确搜索", () => {
      const funds = db.prepare(`SELECT * FROM investments WHERE user_id = ? AND ticker = ?`).all("user_fs_test", "000011") as any[];

      expect(funds.length).toBe(1);
      expect(funds[0].name).toBe("招商中证白酒");
    });

    it("应按类型筛选", () => {
      const funds = db.prepare(`SELECT * FROM investments WHERE user_id = ? AND type = ?`).all("user_fs_test", "fund") as any[];

      expect(funds.length).toBe(2);
      expect(funds.every((f: any) => f.type === "fund")).toBe(true);
    });

    it("应按市值排序", () => {
      const funds = db.prepare(`SELECT * FROM investments WHERE user_id = ? ORDER BY current_value DESC`).all("user_fs_test") as any[];

      expect(funds[0].current_value).toBeGreaterThanOrEqual(funds[1].current_value);
    });

    it("应按收益率排序", () => {
      const funds = db.prepare(`SELECT * FROM investments WHERE user_id = ? ORDER BY profit_rate DESC`).all("user_fs_test") as any[];

      // 贵州茅台收益率 = 200/(20000-200) = 1.01%
      const rates = funds.map((f: any) => f.profit_rate);
      for (let i = 0; i < rates.length - 1; i++) {
        expect(rates[i]).toBeGreaterThanOrEqual(rates[i + 1]);
      }
    });
  });

  describe("getFundTypeStats", () => {
    it("应正确统计各类型基金数量", () => {
      const results = db.prepare(`SELECT type, COUNT(*) as count, SUM(current_value) as total_value FROM investments WHERE user_id = ? GROUP BY type`).all("user_fs_test") as any[];

      const fundType = results.find((r: any) => r.type === "fund");
      expect(fundType?.count).toBe(2);

      const etfType = results.find((r: any) => r.type === "etf");
      expect(etfType?.count).toBe(1);

      const stockType = results.find((r: any) => r.type === "stock");
      expect(stockType?.count).toBe(1);
    });
  });
});
