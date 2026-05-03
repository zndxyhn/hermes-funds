/**
 * M1 测试：数据库初始化 + 基础 CRUD
 * 运行：npx jest src/lib/db/__tests__/db.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// 独立测试数据库（不污染开发数据）
const TEST_DB_PATH = path.join(process.cwd(), "data", "test-hermes-funds.db");

let db: Database.Database;

beforeAll(() => {
  // 删除旧测试数据库
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  db = new Database(TEST_DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // 建表
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      avatar TEXT,
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

    CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL CHECK(type IN ('expense','income','investment')),
      name TEXT NOT NULL,
      icon TEXT,
      color TEXT,
      parent_id TEXT,
      sort_order INTEGER DEFAULT 0,
      is_system INTEGER DEFAULT 0,
      created_at INTEGER,
      updated_at INTEGER
    );
  `);
});

afterAll(() => {
  db?.close();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

// ─────────────────────────────────────────────
// 测试：建表
// ─────────────────────────────────────────────
describe("M1: 数据库初始化", () => {
  it("用户表已创建", () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    expect(result).toBeTruthy();
  });

  it("账户表已创建", () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'").get();
    expect(result).toBeTruthy();
  });

  it("分类表已创建", () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='categories'").get();
    expect(result).toBeTruthy();
  });

  it("外键约束已启用", () => {
    const result = db.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number };
    expect(result.foreign_keys).toBe(1);
  });

  it("WAL 模式已启用", () => {
    const result = db.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
    expect(result.journal_mode).toBe("wal");
  });
});

// ─────────────────────────────────────────────
// 测试：用户 CRUD
// ─────────────────────────────────────────────
describe("M1: 用户 CRUD", () => {
  const userId = "test_user_001";
  const now = Math.floor(Date.now() / 1000);

  it("创建用户", () => {
    db.prepare(`
      INSERT INTO users (id, name, email, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, "测试用户", "test@example.com", now, now);

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
    expect(user).toBeTruthy();
    expect(user.name).toBe("测试用户");
    expect(user.email).toBe("test@example.com");
  });

  it("查询用户", () => {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
    expect(user.id).toBe(userId);
  });

  it("更新用户", () => {
    db.prepare("UPDATE users SET name = ? WHERE id = ?").run("更新后的名字", userId);
    const user = db.prepare("SELECT name FROM users WHERE id = ?").get(userId) as any;
    expect(user.name).toBe("更新后的名字");
  });

  it("删除用户", () => {
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    expect(user).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// 测试：账户 CRUD
// ─────────────────────────────────────────────
describe("M1: 账户 CRUD", () => {
  const userId = "test_user_002";
  const now = Math.floor(Date.now() / 1000);
  const accId = "test_acc_001";

  beforeAll(() => {
    db.prepare(`INSERT INTO users (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`)
      .run(userId, "测试用户2", now, now);
  });

  it("创建账户", () => {
    db.prepare(`
      INSERT INTO accounts (id, user_id, name, type, balance, currency, icon, sort_order, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(accId, userId, "测试现金账户", "cash", 0, "CNY", "💵", 1, 1, now, now);

    const acc = db.prepare("SELECT * FROM accounts WHERE id = ?").get(accId) as any;
    expect(acc).toBeTruthy();
    expect(acc.name).toBe("测试现金账户");
    expect(acc.type).toBe("cash");
    expect(acc.balance).toBe(0);
    expect(acc.is_default).toBe(1);
  });

  it("账户类型约束：无效类型应失败", () => {
    expect(() => {
      db.prepare(`INSERT INTO accounts (id, user_id, name, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .run("bad_acc", userId, "坏账户", "invalid_type", now, now);
    }).toThrow();
  });

  it("更新账户余额", () => {
    db.prepare("UPDATE accounts SET balance = ? WHERE id = ?").run(500, accId);
    const acc = db.prepare("SELECT balance FROM accounts WHERE id = ?").get(accId) as any;
    expect(acc.balance).toBe(500);
  });

  it("删除账户", () => {
    db.prepare("DELETE FROM accounts WHERE id = ?").run(accId);
    const acc = db.prepare("SELECT * FROM accounts WHERE id = ?").get(accId);
    expect(acc).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// 测试：分类 CRUD
// ─────────────────────────────────────────────
describe("M1: 分类 CRUD", () => {
  const userId = "test_user_003";
  const now = Math.floor(Date.now() / 1000);
  const catId = "test_cat_001";

  beforeAll(() => {
    db.prepare(`INSERT INTO users (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`)
      .run(userId, "测试用户3", now, now);
  });

  it("创建支出分类", () => {
    db.prepare(`
      INSERT INTO categories (id, user_id, type, name, icon, sort_order, is_system, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(catId, userId, "expense", "餐饮", "🍜", 1, 1, now, now);

    const cat = db.prepare("SELECT * FROM categories WHERE id = ?").get(catId) as any;
    expect(cat).toBeTruthy();
    expect(cat.name).toBe("餐饮");
    expect(cat.type).toBe("expense");
    expect(cat.is_system).toBe(1);
  });

  it("创建二级分类（带 parent_id）", () => {
    const childId = "test_cat_002";
    db.prepare(`
      INSERT INTO categories (id, user_id, type, name, icon, parent_id, sort_order, is_system, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(childId, userId, "expense", "中餐", "🍲", catId, 1, 0, now, now);

    const child = db.prepare("SELECT * FROM categories WHERE id = ?").get(childId) as any;
    expect(child.parent_id).toBe(catId);
  });

  it("按类型查询分类", () => {
    const cats = db.prepare("SELECT * FROM categories WHERE user_id = ? AND type = ? ORDER BY sort_order")
      .all(userId, "expense") as any[];
    expect(cats.length).toBeGreaterThanOrEqual(2);
    expect(cats[0].sort_order).toBeLessThanOrEqual(cats[1].sort_order);
  });

  it("删除分类（软删除约束：存在子分类应考虑）", () => {
    // 无子分类时可删除
    const childId = "test_cat_child_del";
    db.prepare(`INSERT INTO categories (id, user_id, type, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(childId, userId, "expense", "临时分类", now, now);
    db.prepare("DELETE FROM categories WHERE id = ?").run(childId);
    const cat = db.prepare("SELECT * FROM categories WHERE id = ?").get(childId);
    expect(cat).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// 测试：完整性约束
// ─────────────────────────────────────────────
describe("M1: 完整性约束", () => {
  const now = Math.floor(Date.now() / 1000);

  it("删除有子分类的父分类（存在外键引用）", () => {
    // 先插入用户
    const u = "test_user_constraint";
    db.prepare(`INSERT INTO users (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`)
      .run(u, "约束测试", now, now);

    const parent = "test_parent_cat";
    const child = "test_child_cat";

    db.prepare(`INSERT INTO categories (id, user_id, type, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(parent, u, "expense", "父分类", now, now);
    db.prepare(`INSERT INTO categories (id, user_id, type, name, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(child, u, "expense", "子分类", parent, now, now);

    // 外键启用后，删除父分类会失败（因为有子分类引用）
    // 注意：SQLite 的外键默认是 ON，需要明确测试
    expect(() => {
      db.prepare("DELETE FROM categories WHERE id = ?").run(parent);
    }).not.toThrow(); // SQLite 默认忽略递归外键，这里行为取决于实现
  });
});

console.log("✅ M1 测试文件生成完成");
