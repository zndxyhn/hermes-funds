/**
 * Category Service — 分类业务逻辑层
 * 职责：分类 CRUD、二级分类管理、分类匹配（用于 NLU）
 */
import { getDb } from "../db";
import { categories, type Category, type NewCategory } from "../db/schema";
import { eq, and, like, desc, isNull } from "drizzle-orm";
import { generateId } from "../utils/id";

export type CategoryType = "expense" | "income" | "investment";

// ─────────────────────────────────────────────
// 创建分类
// ─────────────────────────────────────────────
export async function createCategory(params: {
  userId: string;
  name: string;
  type: CategoryType;
  icon?: string;
  color?: string;
  parentId?: string;
  sortOrder?: number;
  isSystem?: boolean;
}): Promise<Category> {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const id = generateId("cat");
  const values: NewCategory = {
    id,
    userId: params.userId,
    name: params.name,
    type: params.type,
    icon: params.icon ?? null,
    color: params.color ?? null,
    parentId: params.parentId ?? null,
    sortOrder: params.sortOrder ?? 0,
    isSystem: params.isSystem ?? false,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(categories).values(values);
  const created = await db.select().from(categories).where(eq(categories.id, id)).get();
  if (!created) throw new Error("创建分类失败");
  return created;
}

// ─────────────────────────────────────────────
// 查询分类列表
// ─────────────────────────────────────────────
export async function listCategories(
  userId: string,
  options?: {
    type?: CategoryType;
    parentId?: string | null; // null = 仅一级分类
  }
): Promise<Category[]> {
  const db = getDb();
  const conditions = [eq(categories.userId, userId)];

  if (options?.type) {
    conditions.push(eq(categories.type, options.type));
  }

  if (options?.parentId !== undefined) {
    if (options.parentId === null) {
      // 仅一级分类（无父分类）— 使用 isNull
      return await db
        .select()
        .from(categories)
        .where(and(...conditions, isNull(categories.parentId)))
        .orderBy(categories.sortOrder)
        .all();
    } else {
      // 特定父分类下的子分类
      return await db
        .select()
        .from(categories)
        .where(and(...conditions, eq(categories.parentId, options.parentId)))
        .orderBy(categories.sortOrder)
        .all();
    }
  }

  return await db.select().from(categories).where(and(...conditions)).orderBy(categories.sortOrder).all();
}

// ─────────────────────────────────────────────
// 按 ID 查询
// ─────────────────────────────────────────────
export async function getCategoryById(id: string, userId: string): Promise<Category | null> {
  const db = getDb();
  return await db.select().from(categories).where(and(eq(categories.id, id), eq(categories.userId, userId))).get() ?? null;
}

// ─────────────────────────────────────────────
// 更新分类
// ─────────────────────────────────────────────
export async function updateCategory(
  id: string,
  userId: string,
  updates: Partial<{
    name: string;
    icon: string;
    color: string;
    sortOrder: number;
  }>
): Promise<Category> {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const existing = await getCategoryById(id, userId);
  if (!existing) throw new Error("分类不存在或无权限");

  // 系统分类不可改名称
  if (existing.isSystem && updates.name && updates.name !== existing.name) {
    throw new Error("系统预设分类不可修改名称");
  }

  const updateData: Record<string, any> = { updatedAt: now };
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.icon !== undefined) updateData.icon = updates.icon;
  if (updates.color !== undefined) updateData.color = updates.color;
  if (updates.sortOrder !== undefined) updateData.sortOrder = updates.sortOrder;

  await db.update(categories).set(updateData).where(and(eq(categories.id, id), eq(categories.userId, userId)));

  const updated = await getCategoryById(id, userId);
  if (!updated) throw new Error("更新分类失败");
  return updated;
}

// ─────────────────────────────────────────────
// 删除分类（仅自定义分类可删除）
// ─────────────────────────────────────────────
export async function deleteCategory(id: string, userId: string): Promise<void> {
  const db = getDb();

  const existing = await getCategoryById(id, userId);
  if (!existing) throw new Error("分类不存在或无权限");

  if (existing.isSystem) {
    throw new Error("系统预设分类不可删除");
  }

  // 检查是否有子分类
  const children = await listCategories(userId, { parentId: id });
  if (children.length > 0) {
    throw new Error("请先删除子分类");
  }

  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)));
}

// ─────────────────────────────────────────────
// 分类匹配（NLU 使用）
// 支持：精确匹配 → 模糊匹配（包含）→ 别名匹配
// ─────────────────────────────────────────────

// 别名映射表
const CATEGORY_ALIASES: Record<string, Record<string, string>> = {
  expense: {
    "买": "购物",
    "吃": "餐饮",
    "坐车": "交通",
    "打车": "交通",
    "加油": "交通",
    "房租": "居住",
    "水电": "居住",
    "看病": "医疗",
    "买书": "书籍",
    "看电影": "娱乐",
    "游戏": "娱乐",
    "话费": "通讯",
    "流量": "通讯",
    "旅游": "旅行",
    "酒店": "旅行",
    "衣服": "购物",
    "化妆品": "购物",
    "日用品": "日用",
  },
  income: {
    "工资": "工资",
    "月薪": "工资",
    "奖金": "奖金",
    "年终奖": "奖金",
    "兼职": "兼职",
    "外快": "兼职",
    "分红": "理财收益",
    "利息": "利息",
  },
};

export async function matchCategory(
  userId: string,
  hint: string,
  type?: CategoryType
): Promise<{ category: Category | null; confidence: number; method: string }> {
  const db = getDb();
  const trimmed = hint.trim();

  const conditions = [eq(categories.userId, userId)];
  if (type) conditions.push(eq(categories.type, type));

  // Step 1: 精确匹配
  const exact = await db
    .select()
    .from(categories)
    .where(and(...conditions, eq(categories.name, trimmed)))
    .get();
  if (exact) return { category: exact, confidence: 1.0, method: "exact" };

  // Step 2: 模糊匹配（包含）
  const allCats = await db.select().from(categories).where(and(...conditions)).all();
  const contains = allCats.filter((c) => c.name.includes(trimmed) || trimmed.includes(c.name));
  if (contains.length === 1) {
    return { category: contains[0], confidence: 0.85, method: "contains" };
  }

  // Step 3: 别名匹配
  const typeAliases = CATEGORY_ALIASES[type ?? "expense"] ?? {};
  const aliasTarget = typeAliases[trimmed];
  if (aliasTarget) {
    const aliasMatch = allCats.find((c) => c.name === aliasTarget);
    if (aliasMatch) {
      return { category: aliasMatch, confidence: 0.8, method: "alias" };
    }
  }

  // Step 4: 模糊匹配多个结果
  if (contains.length > 1) {
    return { category: contains[0], confidence: 0.6, method: "contains_ambiguous" };
  }

  return { category: null, confidence: 0, method: "none" };
}
