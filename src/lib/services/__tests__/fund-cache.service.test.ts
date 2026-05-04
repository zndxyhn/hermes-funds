/**
 * M10 测试：Fund Cache Service 单元测试
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-fund-cache.db");

let db: Database.Database;

beforeAll(() => {
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  db = new Database(TEST_DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE fund_cache (
      ticker TEXT PRIMARY KEY,
      name TEXT,
      nav REAL,
      nav_date TEXT,
      est_nav REAL,
      est_nav_time TEXT,
      day_change REAL,
      updated_at INTEGER
    );
  `);
});

afterAll(() => {
  db.close();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

// ─────────────────────────────────────────────
// 测试缓存操作（模拟 service 中的逻辑）
// ─────────────────────────────────────────────

describe("FundCacheService", () => {
  describe("缓存写入与读取", () => {
    it("应能写入基金缓存", () => {
      const now = Math.floor(Date.now() / 1000);
      db.prepare(`
        INSERT OR REPLACE INTO fund_cache (ticker, name, nav, nav_date, est_nav, est_nav_time, day_change, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run("000001", "平安沪深300ETF", 3.85, "2025-05-03", 3.87, "2025-05-04 10:30", 0.52, now);

      const row = db.prepare(`SELECT * FROM fund_cache WHERE ticker = ?`).get("000001") as any;
      expect(row.ticker).toBe("000001");
      expect(row.nav).toBe(3.85);
      expect(row.day_change).toBe(0.52);
    });

    it("应能读取缓存的基金列表", () => {
      db.prepare(`INSERT OR REPLACE INTO fund_cache (ticker, name, nav, updated_at) VALUES (?, ?, ?, ?)`)
        .run("000002", "测试基金2", 2.5, Math.floor(Date.now() / 1000));

      const rows = db.prepare(`SELECT * FROM fund_cache`).all();
      expect(rows.length).toBeGreaterThanOrEqual(2);
    });

    it("INSERT OR REPLACE 应更新已有记录", () => {
      const now = Math.floor(Date.now() / 1000);

      // 第一次写入
      db.prepare(`INSERT OR REPLACE INTO fund_cache (ticker, name, nav, updated_at) VALUES (?, ?, ?, ?)`)
        .run("000003", "初始名称", 1.0, now);

      // 第二次写入（更新）
      db.prepare(`INSERT OR REPLACE INTO fund_cache (ticker, name, nav, updated_at) VALUES (?, ?, ?, ?)`)
        .run("000003", "更新名称", 1.5, now + 10);

      const row = db.prepare(`SELECT * FROM fund_cache WHERE ticker = ?`).get("000003") as any;
      expect(row.name).toBe("更新名称");
      expect(row.nav).toBe(1.5);
    });
  });

  describe("缓存过期判断", () => {
    it("应正确判断缓存是否过期", () => {
      const now = Math.floor(Date.now() / 1000);

      // 未过期（刚刚写入）
      db.prepare(`INSERT OR REPLACE INTO fund_cache (ticker, name, nav, updated_at) VALUES (?, ?, ?, ?)`)
        .run("000010", "测试", 1.0, now);
      const fresh = db.prepare(`SELECT * FROM fund_cache WHERE ticker = ?`).get("000010") as any;
      expect(now - fresh.updated_at < 5 * 60).toBe(true);

      // 已过期（写入时间超过5分钟）
      db.prepare(`INSERT OR REPLACE INTO fund_cache (ticker, name, nav, updated_at) VALUES (?, ?, ?, ?)`)
        .run("000011", "过期", 1.0, now - 400);
      const stale = db.prepare(`SELECT * FROM fund_cache WHERE ticker = ?`).get("000011") as any;
      expect(now - stale.updated_at > 5 * 60).toBe(true);
    });
  });

  describe("批量操作", () => {
    it("应支持批量写入基金", () => {
      const now = Math.floor(Date.now() / 1000);
      const funds = [
        ["000020", "基金A", 2.0, 0.5],
        ["000021", "基金B", 3.0, -0.3],
        ["000022", "基金C", 1.5, 1.2],
      ];

      const insert = db.prepare(`
        INSERT OR REPLACE INTO fund_cache (ticker, name, nav, day_change, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const [ticker, name, nav, change] of funds) {
        insert.run(ticker, name, nav, change, now);
      }

      const rows = db.prepare(`SELECT * FROM fund_cache WHERE ticker IN (?, ?, ?)`)
        .all("000020", "000021", "000022") as any[];

      expect(rows.length).toBe(3);
      const changes = rows.map((r) => r.day_change);
      expect(changes).toContain(0.5);
      expect(changes).toContain(-0.3);
    });
  });

  describe("删除缓存", () => {
    it("应能删除指定基金的缓存", () => {
      const now = Math.floor(Date.now() / 1000);
      db.prepare(`INSERT OR REPLACE INTO fund_cache (ticker, name, nav, updated_at) VALUES (?, ?, ?, ?)`)
        .run("000099", "待删除", 1.0, now);

      const before = db.prepare(`SELECT * FROM fund_cache WHERE ticker = ?`).get("000099");
      expect(before).toBeDefined();

      db.prepare(`DELETE FROM fund_cache WHERE ticker = ?`).run("000099");

      const after = db.prepare(`SELECT * FROM fund_cache WHERE ticker = ?`).get("000099");
      expect(after).toBeUndefined();
    });
  });
});
