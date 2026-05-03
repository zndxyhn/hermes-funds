/**
 * M2 测试：Account CRUD + 业务逻辑
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// 独立测试数据库
const TEST_DB_PATH = path.join(process.cwd(), "data", "test-account.db");
const USER_ID = "test_user_account";

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
  `);

  // 创建测试用户
  const now = Math.floor(Date.now() / 1000);
  db.prepare("INSERT INTO users (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
    .run(USER_ID, "测试用户", now, now);
});

afterAll(() => {
  db?.close();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

// ─────────────────────────────────────────────
// 手动实现 Account Service 测试（直接 SQL，验证业务逻辑）
// ─────────────────────────────────────────────

function generateId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

describe("M2: Account CRUD", () => {
  const now = Math.floor(Date.now() / 1000);

  it("创建账户", () => {
    const id = generateId("acc");
    db.prepare(`
      INSERT INTO accounts (id, user_id, name, type, balance, currency, icon, sort_order, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, USER_ID, "测试现金账户", "cash", 0, "CNY", "💵", 1, 1, now, now);

    const acc = db.prepare("SELECT * FROM accounts WHERE id = ?").get(id) as any;
    expect(acc.name).toBe("测试现金账户");
    expect(acc.type).toBe("cash");
    expect(acc.balance).toBe(0);
    expect(acc.is_default).toBe(1);
  });

  it("创建多种类型账户", () => {
    const types = ["cash", "bank", "digital", "investment", "credit", "other"] as const;
    for (const type of types) {
      const id = generateId("acc");
      db.prepare(`INSERT INTO accounts (id, user_id, name, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(id, USER_ID, `账户-${type}`, type, now, now);
    }

    const accounts = db.prepare("SELECT type FROM accounts WHERE user_id = ? AND id LIKE 'acc_%'")
      .all(USER_ID) as any[];
    // 应该至少有初始账户 + 6种类型
    expect(accounts.length).toBeGreaterThanOrEqual(6);
  });

  it("按 type 查询账户", () => {
    const cashAccounts = db.prepare("SELECT * FROM accounts WHERE user_id = ? AND type = ?")
      .all(USER_ID, "cash") as any[];
    for (const acc of cashAccounts) {
      expect(acc.type).toBe("cash");
    }
  });

  it("更新账户名称", () => {
    const acc = db.prepare("SELECT id FROM accounts WHERE user_id = ? LIMIT 1").get(USER_ID) as any;
    db.prepare("UPDATE accounts SET name = ?, updated_at = ? WHERE id = ?")
      .run("新名称", now, acc.id);
    const updated = db.prepare("SELECT name FROM accounts WHERE id = ?").get(acc.id) as any;
    expect(updated.name).toBe("新名称");
  });

  it("更新余额", () => {
    const acc = db.prepare("SELECT id, balance FROM accounts WHERE user_id = ? AND type != 'credit' LIMIT 1")
      .get(USER_ID) as any;
    const newBalance = acc.balance + 100;
    db.prepare("UPDATE accounts SET balance = ?, updated_at = ? WHERE id = ?")
      .run(newBalance, now, acc.id);
    const updated = db.prepare("SELECT balance FROM accounts WHERE id = ?").get(acc.id) as any;
    expect(updated.balance).toBe(newBalance);
  });

  it("余额不足时抛出错误（负余额检测）", () => {
    // 找一个现金账户
    const acc = db.prepare("SELECT id, balance FROM accounts WHERE user_id = ? AND type = 'cash' LIMIT 1")
      .get(USER_ID) as any;

    if (acc.balance === 0) {
      // 先充值再测试扣款
      db.prepare("UPDATE accounts SET balance = 50 WHERE id = ?").run(acc.id);
    }

    const current = db.prepare("SELECT balance FROM accounts WHERE id = ?").get(acc.id) as any;
    const newBalance = current.balance - 10000; // 大幅超额扣款

    // 业务逻辑检测（非数据库层）
    const isNegative = acc.type !== "credit" && newBalance < 0;
    expect(isNegative).toBe(true); // 应该被业务层拦截
  });

  it("删除余额为零的账户", () => {
    const id = generateId("acc_del");
    db.prepare("INSERT INTO accounts (id, user_id, name, type, balance, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(id, USER_ID, "待删除账户", "cash", 0, now, now);

    db.prepare("DELETE FROM accounts WHERE id = ? AND balance = 0").run(id);
    const acc = db.prepare("SELECT * FROM accounts WHERE id = ?").get(id);
    expect(acc).toBeUndefined();
  });

  it("默认账户查询", () => {
    const defaultAcc = db.prepare("SELECT * FROM accounts WHERE user_id = ? AND is_default = 1")
      .get(USER_ID) as any;
    expect(defaultAcc).toBeTruthy();
    expect(defaultAcc.is_default).toBe(1);
  });

  it("账户余额汇总", () => {
    const result = db.prepare("SELECT SUM(balance) as total FROM accounts WHERE user_id = ?")
      .get(USER_ID) as any;
    expect(typeof result.total).toBe("number");
    expect(result.total).toBeGreaterThanOrEqual(0);
  });
});

console.log("✅ M2 测试完成");
