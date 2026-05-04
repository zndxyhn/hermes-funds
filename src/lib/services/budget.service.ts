/**
 * Budget Service — 预算业务逻辑层
 * 职责：预算 CRUD、预算进度查询、超支检测
 */
import { getDb } from "../db";
import { budgets, categories, transactions, type Budget, type NewBudget } from "../db/schema";
import { eq, and, desc, asc, sql, gte, lte } from "drizzle-orm";
import { generateId } from "../utils/id";

export type BudgetPeriod = "weekly" | "monthly" | "yearly";

// ─────────────────────────────────────────────
// 预算 CRUD
// ─────────────────────────────────────────────

export async function createBudget(params: {
  userId: string;
  categoryId?: string;
  amount: number;
  period?: BudgetPeriod;
  startDate?: number;
}): Promise<Budget> {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const id = generateId("bud");
  const values: NewBudget = {
    id,
    userId: params.userId,
    categoryId: params.categoryId ?? null,
    amount: params.amount,
    period: params.period ?? "monthly",
    startDate: params.startDate ?? now,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(budgets).values(values);
  const created = await db.select().from(budgets).where(eq(budgets.id, id)).get();
  if (!created) throw new Error("创建预算失败");
  return created;
}

export async function getBudgetById(id: string, userId: string): Promise<Budget | null> {
  const db = getDb();
  const result = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
    .get();
  return result ?? null;
}

export async function listBudgets(
  userId: string,
  options?: {
    period?: BudgetPeriod;
    limit?: number;
  }
): Promise<Budget[]> {
  const db = getDb();
  const conditions = [eq(budgets.userId, userId)];

  if (options?.period) {
    conditions.push(eq(budgets.period, options.period));
  }

  const results = await db
    .select()
    .from(budgets)
    .where(and(...conditions))
    .orderBy(desc(budgets.createdAt))
    .limit(options?.limit ?? 100)
    .all();

  return results;
}

export async function updateBudget(
  id: string,
  userId: string,
  updates: Partial<{
    categoryId: string;
    amount: number;
    period: BudgetPeriod;
    startDate: number;
  }>
): Promise<Budget> {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const existing = await getBudgetById(id, userId);
  if (!existing) throw new Error("预算不存在或无权限");

  const updateData: Record<string, any> = { updatedAt: now };
  if (updates.categoryId !== undefined) updateData.categoryId = updates.categoryId;
  if (updates.amount !== undefined) updateData.amount = updates.amount;
  if (updates.period !== undefined) updateData.period = updates.period;
  if (updates.startDate !== undefined) updateData.startDate = updates.startDate;

  await db.update(budgets).set(updateData).where(and(eq(budgets.id, id), eq(budgets.userId, userId)));

  const updated = await getBudgetById(id, userId);
  if (!updated) throw new Error("更新预算失败");
  return updated;
}

export async function deleteBudget(id: string, userId: string): Promise<void> {
  const db = getDb();

  const existing = await getBudgetById(id, userId);
  if (!existing) throw new Error("预算不存在或无权限");

  await db.delete(budgets).where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
}

// ─────────────────────────────────────────────
// 预算进度查询
// ─────────────────────────────────────────────

/**
 * 获取时间范围（根据 period 计算）
 */
function getPeriodRange(period: BudgetPeriod, startDate?: number): { start: number; end: number } {
  const now = new Date();
  const start = startDate ? new Date(startDate * 1000) : new Date(now.getFullYear(), now.getMonth(), 1);

  switch (period) {
    case "weekly": {
      // 本周一
      const day = start.getDay();
      const monday = new Date(start);
      monday.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      return { start: Math.floor(monday.getTime() / 1000), end: Math.floor(sunday.getTime() / 1000) };
    }
    case "monthly": {
      const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
      const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start: Math.floor(monthStart.getTime() / 1000), end: Math.floor(monthEnd.getTime() / 1000) };
    }
    case "yearly": {
      const yearStart = new Date(start.getFullYear(), 0, 1);
      const yearEnd = new Date(start.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { start: Math.floor(yearStart.getTime() / 1000), end: Math.floor(yearEnd.getTime() / 1000) };
    }
  }
}

export interface BudgetProgress {
  budget: Budget;
  spent: number;
  remaining: number;
  percent: number; // 0-100
  isOverBudget: boolean;
}

export async function getBudgetProgress(id: string, userId: string): Promise<BudgetProgress> {
  const db = getDb();

  const budget = await getBudgetById(id, userId);
  if (!budget) throw new Error("预算不存在或无权限");

  const { start, end } = getPeriodRange(budget.period as BudgetPeriod, budget.startDate ?? undefined);

  // 查询该周期内的支出
  let spent = 0;
  if (budget.categoryId) {
    // 分类预算：只查询该分类的支出
    const result = await db
      .select({ total: sql<number>`SUM(${transactions.amount})` })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.categoryId, budget.categoryId),
          eq(transactions.type, "expense"),
          gte(transactions.date, start),
          lte(transactions.date, end)
        )
      )
      .get();
    spent = result?.total ?? 0;
  } else {
    // 总预算：查询所有支出
    const result = await db
      .select({ total: sql<number>`SUM(${transactions.amount})` })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "expense"),
          gte(transactions.date, start),
          lte(transactions.date, end)
        )
      )
      .get();
    spent = result?.total ?? 0;
  }

  const remaining = (budget.amount ?? 0) - spent;
  const percent = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
  const isOverBudget = spent > (budget.amount ?? 0);

  return {
    budget,
    spent,
    remaining,
    percent: Math.round(percent * 100) / 100,
    isOverBudget,
  };
}

export async function listBudgetsWithProgress(userId: string): Promise<BudgetProgress[]> {
  const db = getDb();
  const budgetList = await listBudgets(userId);

  const progresses: BudgetProgress[] = [];
  for (const budget of budgetList) {
    const progress = await getBudgetProgress(budget.id, userId);
    progresses.push(progress);
  }

  return progresses;
}

// ─────────────────────────────────────────────
// 超支预警
// ─────────────────────────────────────────────

export async function getOverBudgetAlerts(userId: string): Promise<BudgetProgress[]> {
  const allProgress = await listBudgetsWithProgress(userId);
  return allProgress.filter((p) => p.isOverBudget);
}
