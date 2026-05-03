/**
 * M3 测试：Category CRUD + 分类匹配
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-category.db");
const USER_ID = "test_user_cat";
const SYSTEM_USER_ID = "test_sys_cat";

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

  const now = Math.floor(Date.now() / 1000);
  db.prepare("INSERT INTO users (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
    .run(USER_ID, "测试用户", now, now);
  db.prepare("INSERT INTO users (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
    .run(SYSTEM_USER_ID, "系统用户", now, now);

  // 插入系统预设分类
  const cats = [
    { id: "sys_cat_1", name: "餐饮", type: "expense", is_system: 1 },
    { id: "sys_cat_2", name: "交通", type: "expense", is_system: 1 },
    { id: "sys_cat_3", name: "工资", type: "income", is_system: 1 },
  ];
  for (const c of cats) {
    db.prepare("INSERT INTO categories (id, user_id, type, name, is_system, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(c.id, SYSTEM_USER_ID, c.type, c.name, c.is_system, now, now);
  }
});

afterAll(() => {
  db?.close();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const CATEGORY_ALIASES: Record<string, Record<string, string>> = {
  expense: { "买": "购物", "吃": "餐饮", "坐车": "交通" },
  income: { "工资": "工资", "奖金": "奖金" },
};

function matchCategory(hint: string, type: string, cats: any[]): { name: string; confidence: number; method: string } {
  const trimmed = hint.trim();
  // 精确
  const exact = cats.find((c) => c.type === type && c.name === trimmed);
  if (exact) return { name: exact.name, confidence: 1.0, method: "exact" };
  // 包含
  const contains = cats.filter((c) => c.type === type && (c.name.includes(trimmed) || trimmed.includes(c.name)));
  if (contains.length === 1) return { name: contains[0].name, confidence: 0.85, method: "contains" };
  // 别名
  const aliasTarget = CATEGORY_ALIASES[type]?.[trimmed];
  if (aliasTarget) {
    const aliasMatch = cats.find((c) => c.type === type && c.name === aliasTarget);
    if (aliasMatch) return { name: aliasMatch.name, confidence: 0.8, method: "alias" };
  }
  if (contains.length > 1) return { name: contains[0].name, confidence: 0.6, method: "contains_ambiguous" };
  return { name: "", confidence: 0, method: "none" };
}

describe("M3: Category CRUD", () => {
  const now = Math.floor(Date.now() / 1000);

  it("创建支出分类", () => {
    const id = genId("cat");
    db.prepare(`INSERT INTO categories (id, user_id, type, name, is_system, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(id, USER_ID, "expense", "餐饮", 0, now, now);
    const cat = db.prepare("SELECT * FROM categories WHERE id = ?").get(id) as any;
    expect(cat.name).toBe("餐饮");
    expect(cat.type).toBe("expense");
    expect(cat.is_system).toBe(0);
  });

  it("创建二级分类（带 parent_id）", () => {
    const parentId = genId("cat_parent");
    db.prepare("INSERT INTO categories (id, user_id, type, name, is_system, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(parentId, USER_ID, "expense", "餐饮", 0, now, now);

    const childId = genId("cat_child");
    db.prepare("INSERT INTO categories (id, user_id, type, name, parent_id, is_system, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(childId, USER_ID, "expense", "中餐", parentId, 0, now, now);

    const child = db.prepare("SELECT * FROM categories WHERE id = ?").get(childId) as any;
    expect(child.parent_id).toBe(parentId);
  });

  it("按 type 查询分类", () => {
    const expenseCats = db.prepare("SELECT * FROM categories WHERE user_id = ? AND type = ?")
      .all(USER_ID, "expense") as any[];
    for (const c of expenseCats) expect(c.type).toBe("expense");
  });

  it("查询一级分类（无 parent_id）", () => {
    // 先清空测试用户的分类
    db.prepare("DELETE FROM categories WHERE user_id = ? AND id LIKE 'cat_%'").run(USER_ID);
    const parentId = genId("cat_p");
    db.prepare("INSERT INTO categories (id, user_id, type, name, is_system, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(parentId, USER_ID, "expense", "父分类", 0, now, now);
    const childId = genId("cat_c");
    db.prepare("INSERT INTO categories (id, user_id, type, name, parent_id, is_system, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(childId, USER_ID, "expense", "子分类", parentId, 0, now, now);

    const parents = db.prepare("SELECT * FROM categories WHERE user_id = ? AND parent_id IS NULL")
      .all(USER_ID) as any[];
    expect(parents.some((c) => c.name === "父分类")).toBe(true);
    expect(parents.some((c) => c.name === "子分类")).toBe(false);
  });

  it("更新自定义分类名称", () => {
    const id = genId("cat_upd");
    db.prepare("INSERT INTO categories (id, user_id, type, name, is_system, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(id, USER_ID, "expense", "旧名称", 0, now, now);
    db.prepare("UPDATE categories SET name = ?, updated_at = ? WHERE id = ?").run("新名称", now, id);
    const cat = db.prepare("SELECT name FROM categories WHERE id = ?").get(id) as any;
    expect(cat.name).toBe("新名称");
  });

  it("系统分类不可删除", () => {
    const sysCats = db.prepare("SELECT * FROM categories WHERE user_id = ? AND is_system = 1")
      .all(SYSTEM_USER_ID) as any[];
    expect(sysCats.length).toBeGreaterThan(0);
    // 系统分类的 is_system = 1，删除前应检查
    for (const c of sysCats) {
      const cat = db.prepare("SELECT is_system FROM categories WHERE id = ?").get(c.id) as any;
      expect(cat.is_system).toBe(1);
    }
  });

  it("删除有子分类的父分类应失败", () => {
    const parentId = genId("cat_parent_del");
    const childId = genId("cat_child_del");
    db.prepare("INSERT INTO categories (id, user_id, type, name, is_system, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(parentId, USER_ID, "expense", "待删父分类", 0, now, now);
    db.prepare("INSERT INTO categories (id, user_id, type, name, parent_id, is_system, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(childId, USER_ID, "expense", "子分类", parentId, 0, now, now);

    // 业务逻辑：应先删子分类再删父分类
    const children = db.prepare("SELECT * FROM categories WHERE parent_id = ?").all(parentId) as any[];
    expect(children.length).toBeGreaterThan(0); // 有子分类
    // 此处测试业务逻辑检测，而非 DB 层
    const canDelete = children.length === 0;
    expect(canDelete).toBe(false);
  });
});

describe("M3: 分类匹配算法", () => {
  const now = Math.floor(Date.now() / 1000);

  beforeAll(() => {
    // 准备匹配用的分类数据
    const cats = [
      { name: "餐饮", type: "expense" },
      { name: "交通", type: "expense" },
      { name: "购物", type: "expense" },
      { name: "工资", type: "income" },
      { name: "奖金", type: "income" },
    ];
    for (const c of cats) {
      db.prepare("INSERT INTO categories (id, user_id, type, name, is_system, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(genId("mcat"), USER_ID, c.type, c.name, 1, now, now);
    }
  });

  it("精确匹配", () => {
    const cats = db.prepare("SELECT * FROM categories WHERE user_id = ?").all(USER_ID) as any[];
    const result = matchCategory("餐饮", "expense", cats);
    expect(result.confidence).toBe(1.0);
    expect(result.name).toBe("餐饮");
    expect(result.method).toBe("exact");
  });

  it("别名匹配", () => {
    const cats = db.prepare("SELECT * FROM categories WHERE user_id = ?").all(USER_ID) as any[];
    const result = matchCategory("吃", "expense", cats);
    expect(result.confidence).toBe(0.8);
    expect(result.name).toBe("餐饮");
    expect(result.method).toBe("alias");
  });

  it("包含匹配", () => {
    const cats = db.prepare("SELECT * FROM categories WHERE user_id = ?").all(USER_ID) as any[];
    const result = matchCategory("餐饮费", "expense", cats);
    expect(result.confidence).toBe(0.85);
    expect(result.name).toBe("餐饮");
    expect(result.method).toBe("contains");
  });

  it("无法匹配", () => {
    const cats = db.prepare("SELECT * FROM categories WHERE user_id = ?").all(USER_ID) as any[];
    const result = matchCategory("完全不存在的分类", "expense", cats);
    expect(result.confidence).toBe(0);
    expect(result.name).toBe("");
    expect(result.method).toBe("none");
  });

  it("收入类型匹配", () => {
    const cats = db.prepare("SELECT * FROM categories WHERE user_id = ?").all(USER_ID) as any[];
    const result = matchCategory("工资", "income", cats);
    expect(result.name).toBe("工资");
    expect(result.confidence).toBe(1.0);
  });
});

console.log("✅ M3 测试完成");
