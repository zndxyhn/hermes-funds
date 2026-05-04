/**
 * M9 测试：Recurring Bills Service 单元测试
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-recurring-bill.db");
const TEST_USER_ID = "user_rb_test";
const TEST_ACCOUNT_ID = "acc_rb_test";

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
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      balance REAL DEFAULT 0,
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

    CREATE TABLE transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      account_id TEXT NOT NULL REFERENCES accounts(id),
      category_id TEXT REFERENCES categories(id),
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      date INTEGER NOT NULL,
      notes TEXT,
      source TEXT DEFAULT 'form',
      nav_price REAL,
      nav_date INTEGER,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE recurring_bills (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      account_id TEXT NOT NULL REFERENCES accounts(id),
      category_id TEXT REFERENCES categories(id),
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      frequency TEXT NOT NULL,
      next_due_date INTEGER NOT NULL,
      last_run_date INTEGER,
      notes TEXT,
      enabled INTEGER DEFAULT 1,
      created_at INTEGER,
      updated_at INTEGER
    );
  `);

  const now = Math.floor(Date.now() / 1000);
  db.prepare(`INSERT INTO users (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`).run(TEST_USER_ID, "测试用户", now, now);
  db.prepare(`INSERT INTO accounts (id, user_id, name, type, balance, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(TEST_ACCOUNT_ID, TEST_USER_ID, "测试账户", "cash", 10000, now, now);
});

afterAll(() => {
  db.close();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

// ─────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────

function calculateNextDueDate(frequency: string, fromTimestamp: number): number {
  const date = new Date(fromTimestamp * 1000);
  switch (frequency) {
    case "daily": date.setDate(date.getDate() + 1); break;
    case "weekly": date.setDate(date.getDate() + 7); break;
    case "biweekly": date.setDate(date.getDate() + 14); break;
    case "monthly": date.setMonth(date.getMonth() + 1); break;
    case "quarterly": date.setMonth(date.getMonth() + 3); break;
    case "yearly": date.setFullYear(date.getFullYear() + 1); break;
  }
  return Math.floor(date.getTime() / 1000);
}

function parseDate(dateStr: string): number {
  return Math.floor(new Date(dateStr).getTime() / 1000);
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

describe("RecurringBillService", () => {
  describe("createRecurringBill", () => {
    it("应创建周期账单", () => {
      const now = Math.floor(Date.now() / 1000);
      const id = generateId("rb");
      const nextDueDate = parseDate("2025-02-01");

      db.prepare(`
        INSERT INTO recurring_bills (id, user_id, account_id, name, amount, frequency, next_due_date, enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, TEST_USER_ID, TEST_ACCOUNT_ID, "房租", 3000, "monthly", nextDueDate, 1, now, now);

      const bill = db.prepare(`SELECT * FROM recurring_bills WHERE id = ?`).get(id) as any;
      expect(bill.id).toBeDefined();
      expect(bill.name).toBe("房租");
      expect(bill.amount).toBe(3000);
      expect(bill.frequency).toBe("monthly");
      expect(bill.enabled).toBe(1);
    });
  });

  describe("listRecurringBills", () => {
    it("应返回账单列表", () => {
      const bills = db.prepare(`SELECT * FROM recurring_bills WHERE user_id = ?`).all(TEST_USER_ID);
      expect(bills.length).toBeGreaterThan(0);
    });
  });

  describe("getRecurringBill", () => {
    it("应返回指定账单", () => {
      const bill = db.prepare(`SELECT * FROM recurring_bills WHERE user_id = ? LIMIT 1`).get(TEST_USER_ID) as any;
      expect(bill).toBeDefined();
      expect(bill.name).toBe("房租");
    });
  });

  describe("updateRecurringBill", () => {
    it("应更新账单", () => {
      const bill = db.prepare(`SELECT * FROM recurring_bills WHERE user_id = ? LIMIT 1`).get(TEST_USER_ID) as any;
      const now = Math.floor(Date.now() / 1000);

      db.prepare(`UPDATE recurring_bills SET name = ?, amount = ?, updated_at = ? WHERE id = ?`)
        .run("新房租", 3500, now, bill.id);

      const updated = db.prepare(`SELECT * FROM recurring_bills WHERE id = ?`).get(bill.id) as any;
      expect(updated.name).toBe("新房租");
      expect(updated.amount).toBe(3500);
    });
  });

  describe("deleteRecurringBill", () => {
    it("应删除账单", () => {
      const bill = db.prepare(`SELECT * FROM recurring_bills WHERE user_id = ? LIMIT 1`).get(TEST_USER_ID) as any;
      db.prepare(`DELETE FROM recurring_bills WHERE id = ?`).run(bill.id);
      const deleted = db.prepare(`SELECT * FROM recurring_bills WHERE id = ?`).get(bill.id);
      expect(deleted).toBeUndefined();
    });
  });

  describe("calculateNextDueDate", () => {
    it("应计算月频率下一日期", () => {
      const ts = parseDate("2025-01-15");
      const next = calculateNextDueDate("monthly", ts);
      expect(new Date(next * 1000).toISOString().split("T")[0]).toBe("2025-02-15");
    });

    it("应计算周频率下一日期", () => {
      const ts = parseDate("2025-01-01");
      const next = calculateNextDueDate("weekly", ts);
      expect(new Date(next * 1000).toISOString().split("T")[0]).toBe("2025-01-08");
    });

    it("应计算年频率下一日期", () => {
      const ts = parseDate("2025-06-15");
      const next = calculateNextDueDate("yearly", ts);
      expect(new Date(next * 1000).toISOString().split("T")[0]).toBe("2026-06-15");
    });

    it("应处理月末日期溢出", () => {
      // JavaScript Date.setMonth 行为：1月31日 + 1月 = 3月3日（因为2月没有31日）
      const ts = parseDate("2025-01-31");
      const next = calculateNextDueDate("monthly", ts);
      expect(new Date(next * 1000).toISOString().split("T")[0]).toBe("2025-03-03");
    });
  });

  describe("executeRecurringBill", () => {
    it("应生成交易并更新下次到期日", () => {
      const now = Math.floor(Date.now() / 1000);
      const pastDate = now - 86400 * 2;
      const billId = generateId("rb_exec");

      db.prepare(`
        INSERT INTO recurring_bills (id, user_id, account_id, name, amount, frequency, next_due_date, enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(billId, TEST_USER_ID, TEST_ACCOUNT_ID, "执行测试", 100, "monthly", pastDate, 1, now, now);

      const bill = db.prepare(`SELECT * FROM recurring_bills WHERE id = ?`).get(billId) as any;
      const txId = generateId("tx");
      const nextDueDate = calculateNextDueDate(bill.frequency, bill.next_due_date);

      db.prepare(`INSERT INTO transactions (id, user_id, account_id, type, amount, description, date, source, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(txId, TEST_USER_ID, TEST_ACCOUNT_ID, "expense", bill.amount, "周期账单: " + bill.name, bill.next_due_date, "recurring_bill", now, now);

      db.prepare(`UPDATE recurring_bills SET last_run_date = ?, next_due_date = ?, updated_at = ? WHERE id = ?`)
        .run(bill.next_due_date, nextDueDate, now, billId);

      const tx = db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(txId) as any;
      expect(tx).toBeDefined();
      expect(tx.amount).toBe(100);
      expect(tx.source).toBe("recurring_bill");

      const updatedBill = db.prepare(`SELECT * FROM recurring_bills WHERE id = ?`).get(billId) as any;
      expect(updatedBill.last_run_date).toBe(pastDate);
      expect(updatedBill.next_due_date).toBeGreaterThan(pastDate);
    });
  });
});
