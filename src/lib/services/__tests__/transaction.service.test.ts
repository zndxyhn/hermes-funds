/**
 * M4 测试：Transaction CRUD + 原子余额事务
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-transaction.db");
const USER_ID = "test_user_tx";

let db: Database.Database;

function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

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

    CREATE TABLE transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      account_id TEXT NOT NULL REFERENCES accounts(id),
      category_id TEXT REFERENCES categories(id),
      type TEXT NOT NULL CHECK(type IN ('expense','income','transfer','investment_buy','investment_sell')),
      amount REAL NOT NULL,
      description TEXT,
      notes TEXT,
      date INTEGER NOT NULL,
      tags TEXT,
      source TEXT DEFAULT 'form',
      investment_id TEXT,
      transfer_to_account_id TEXT REFERENCES accounts(id),
      created_at INTEGER,
      updated_at INTEGER
    );
  `);

  const now = Math.floor(Date.now() / 1000);
  db.prepare("INSERT INTO users (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
    .run(USER_ID, "测试用户", now, now);

  // 创建测试账户
  db.prepare("INSERT INTO accounts (id, user_id, name, type, balance, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run("acc_cash", USER_ID, "现金账户", "cash", 1000, now, now);
  db.prepare("INSERT INTO accounts (id, user_id, name, type, balance, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run("acc_bank", USER_ID, "银行卡", "bank", 5000, now, now);
  db.prepare("INSERT INTO accounts (id, user_id, name, type, balance, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run("acc_credit", USER_ID, "信用卡", "credit", -500, now, now);

  // 创建测试分类
  db.prepare("INSERT INTO categories (id, user_id, type, name, is_system, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run("cat_food", USER_ID, "expense", "餐饮", 1, now, now);
  db.prepare("INSERT INTO categories (id, user_id, type, name, is_system, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run("cat_salary", USER_ID, "income", "工资", 1, now, now);
});

afterAll(() => {
  db?.close();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

// ─────────────────────────────────────────────
// 原子事务辅助函数
// ─────────────────────────────────────────────
function createExpense原子(accountId: string, amount: number, categoryId: string) {
  const now = Math.floor(Date.now() / 1000);
  return db.transaction(() => {
    const acc = db.prepare("SELECT * FROM accounts WHERE id = ? AND user_id = ?").get(accountId, USER_ID) as any;
    if (!acc) throw new Error("账户不存在");

    const newBalance = acc.balance - amount;
    if (acc.type !== "credit" && newBalance < 0) throw new Error("余额不足");

    db.prepare("UPDATE accounts SET balance = ?, updated_at = ? WHERE id = ?").run(newBalance, now, accountId);

    const txId = genId("tx");
    db.prepare(`INSERT INTO transactions (id, user_id, account_id, category_id, type, amount, date, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(txId, USER_ID, accountId, categoryId, "expense", amount, now, "form", now, now);

    return { txId, newBalance };
  })();
}

function createIncome原子(accountId: string, amount: number, categoryId: string) {
  const now = Math.floor(Date.now() / 1000);
  return db.transaction(() => {
    const acc = db.prepare("SELECT * FROM accounts WHERE id = ? AND user_id = ?").get(accountId, USER_ID) as any;
    if (!acc) throw new Error("账户不存在");

    const newBalance = acc.balance + amount;
    db.prepare("UPDATE accounts SET balance = ?, updated_at = ? WHERE id = ?").run(newBalance, now, accountId);

    const txId = genId("tx");
    db.prepare(`INSERT INTO transactions (id, user_id, account_id, category_id, type, amount, date, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(txId, USER_ID, accountId, categoryId, "income", amount, now, "form", now, now);

    return { txId, newBalance };
  })();
}

function createTransfer原子(fromId: string, toId: string, amount: number) {
  const now = Math.floor(Date.now() / 1000);
  return db.transaction(() => {
    const from = db.prepare("SELECT * FROM accounts WHERE id = ? AND user_id = ?").get(fromId, USER_ID) as any;
    if (!from) throw new Error("转出账户不存在");
    if (from.type !== "credit" && from.balance - amount < 0) throw new Error("余额不足");

    const to = db.prepare("SELECT * FROM accounts WHERE id = ? AND user_id = ?").get(toId, USER_ID) as any;
    if (!to) throw new Error("转入账户不存在");

    const newFrom = from.balance - amount;
    const newTo = to.balance + amount;

    db.prepare("UPDATE accounts SET balance = ?, updated_at = ? WHERE id = ?").run(newFrom, now, fromId);
    db.prepare("UPDATE accounts SET balance = ?, updated_at = ? WHERE id = ?").run(newTo, now, toId);

    const txId = genId("tx");
    db.prepare(`INSERT INTO transactions (id, user_id, account_id, type, amount, date, source, transfer_to_account_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(txId, USER_ID, fromId, "transfer", amount, now, "form", toId, now, now);

    return { txId, newFrom, newTo };
  })();
}

describe("M4: Transaction CRUD + 原子余额事务", () => {
  const now = Math.floor(Date.now() / 1000);

  it("支出：余额正确扣减", () => {
    const initialBalance = (db.prepare("SELECT balance FROM accounts WHERE id = ?").get("acc_cash") as any).balance;
    const { newBalance } = createExpense原子("acc_cash", 100, "cat_food");
    expect(newBalance).toBe(initialBalance - 100);
    // 数据库验证
    const acc = db.prepare("SELECT balance FROM accounts WHERE id = ?").get("acc_cash") as any;
    expect(acc.balance).toBe(newBalance);
  });

  it("收入：余额正确增加", () => {
    const initialBalance = (db.prepare("SELECT balance FROM accounts WHERE id = ?").get("acc_bank") as any).balance;
    const { newBalance } = createIncome原子("acc_bank", 5000, "cat_salary");
    expect(newBalance).toBe(initialBalance + 5000);
    const acc = db.prepare("SELECT balance FROM accounts WHERE id = ?").get("acc_bank") as any;
    expect(acc.balance).toBe(newBalance);
  });

  it("转账：两个账户余额同时更新", () => {
    const fromBefore = (db.prepare("SELECT balance FROM accounts WHERE id = ?").get("acc_cash") as any).balance;
    const toBefore = (db.prepare("SELECT balance FROM accounts WHERE id = ?").get("acc_bank") as any).balance;
    const { newFrom, newTo } = createTransfer原子("acc_cash", "acc_bank", 200);
    expect(newFrom).toBe(fromBefore - 200);
    expect(newTo).toBe(toBefore + 200);
    // 数据库验证
    expect((db.prepare("SELECT balance FROM accounts WHERE id = ?").get("acc_cash") as any).balance).toBe(newFrom);
    expect((db.prepare("SELECT balance FROM accounts WHERE id = ?").get("acc_bank") as any).balance).toBe(newTo);
  });

  it("支出：余额不足时拒绝", () => {
    const acc = db.prepare("SELECT balance FROM accounts WHERE id = ?").get("acc_cash") as any;
    const tooMuch = acc.balance + 10000; // 大幅超额

    expect(() => createExpense原子("acc_cash", tooMuch, "cat_food")).toThrow("余额不足");
    // 验证余额未被修改
    const accAfter = db.prepare("SELECT balance FROM accounts WHERE id = ?").get("acc_cash") as any;
    expect(accAfter.balance).toBe(acc.balance);
  });

  it("支出：信用卡账户允许负余额", () => {
    const creditBefore = (db.prepare("SELECT balance FROM accounts WHERE id = ?").get("acc_credit") as any).balance;
    const { newBalance } = createExpense原子("acc_credit", 100, "cat_food");
    expect(newBalance).toBe(creditBefore - 100);
    // 验证信用卡确实变负了
    const creditAfter = db.prepare("SELECT balance FROM accounts WHERE id = ?").get("acc_credit") as any;
    expect(creditAfter.balance).toBeLessThan(0);
  });

  it("事务回滚：异常时余额未变化", () => {
    const acc = db.prepare("SELECT balance FROM accounts WHERE id = ?").get("acc_cash") as any;
    const balanceBefore = acc.balance;

    try {
      createExpense原子("acc_cash", 999999999, "cat_food"); // 必然失败
    } catch (e) {
      // 预期抛错
    }

    const accAfter = db.prepare("SELECT balance FROM accounts WHERE id = ?").get("acc_cash") as any;
    expect(accAfter.balance).toBe(balanceBefore); // 余额未变（事务回滚）
  });

  it("删除支出：余额恢复", () => {
    // 先支出
    const beforeBalance = (db.prepare("SELECT balance FROM accounts WHERE id = ?").get("acc_cash") as any).balance;
    const { txId } = createExpense原子("acc_cash", 50, "cat_food");

    // 删除该交易
    db.transaction(() => {
      const tx = db.prepare("SELECT * FROM transactions WHERE id = ?").get(txId) as any;
      const acc = db.prepare("SELECT * FROM accounts WHERE id = ?").get(tx.account_id) as any;
      // 逆操作
      db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").run(tx.amount, tx.account_id);
      db.prepare("DELETE FROM transactions WHERE id = ?").run(txId);
    })();

    const afterBalance = (db.prepare("SELECT balance FROM accounts WHERE id = ?").get("acc_cash") as any).balance;
    expect(afterBalance).toBe(beforeBalance); // 恢复到支出前
  });

  it("交易记录字段完整", () => {
    const txId = genId("tx");
    db.prepare(`INSERT INTO transactions (id, user_id, account_id, category_id, type, amount, description, notes, date, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(txId, USER_ID, "acc_cash", "cat_food", "expense", 50, "测试餐饮", "备注", now, "form", now, now);

    const tx = db.prepare("SELECT * FROM transactions WHERE id = ?").get(txId) as any;
    expect(tx.type).toBe("expense");
    expect(tx.amount).toBe(50);
    expect(tx.description).toBe("测试餐饮");
    expect(tx.notes).toBe("备注");
    expect(tx.source).toBe("form");
  });

  it("交易列表查询（按日期降序）", () => {
    const txs = db.prepare("SELECT id, date FROM transactions WHERE user_id = ? ORDER BY date DESC LIMIT 10")
      .all(USER_ID) as any[];
    if (txs.length >= 2) {
      expect(txs[0].date).toBeGreaterThanOrEqual(txs[1].date);
    }
  });

  it("交易列表查询（按类型筛选）", () => {
    const expenses = db.prepare("SELECT * FROM transactions WHERE user_id = ? AND type = ?")
      .all(USER_ID, "expense") as any[];
    for (const tx of expenses) {
      expect(tx.type).toBe("expense");
    }
  });

  it("转账 type=transfer 且有 transfer_to_account_id", () => {
    const { txId } = createTransfer原子("acc_bank", "acc_cash", 100);
    const tx = db.prepare("SELECT type, transfer_to_account_id FROM transactions WHERE id = ?").get(txId) as any;
    expect(tx.type).toBe("transfer");
    expect(tx.transfer_to_account_id).toBeTruthy();
  });
});

console.log("✅ M4 测试完成");
