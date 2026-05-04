/**
 * Recurring Bills Service — 周期账单业务逻辑层
 * 职责：周期账单 CRUD、自动生成交易、到期检测
 */
import { getDb } from "../db";
import { recurringBills, accounts, categories, transactions, type RecurringBill, type NewRecurringBill } from "../db/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { generateId } from "../utils/id";

export type BillFrequency = "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";

// ─────────────────────────────────────────────
// 日期工具
// ─────────────────────────────────────────────

/** 将 YYYY-MM-DD 字符串转为 Unix timestamp */
function parseDate(dateStr: string): number {
  return Math.floor(new Date(dateStr).getTime() / 1000);
}

/** 将 Unix timestamp 转为 YYYY-MM-DD 字符串 */
function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().split("T")[0];
}

/** 格式化账单返回数据（转换时间戳为日期字符串） */
function formatBill(bill: RecurringBill): RecurringBill & { nextDueDateStr: string; lastRunDateStr: string | null } {
  return {
    ...bill,
    nextDueDateStr: formatDate(bill.nextDueDate),
    lastRunDateStr: bill.lastRunDate ? formatDate(bill.lastRunDate) : null,
  } as any;
}

// ─────────────────────────────────────────────
// 周期账单 CRUD
// ─────────────────────────────────────────────

export async function createRecurringBill(params: {
  userId: string;
  accountId: string;
  categoryId?: string;
  name: string;
  amount: number;
  frequency: BillFrequency;
  nextDueDate: string; // YYYY-MM-DD
  notes?: string;
  enabled?: boolean;
}): Promise<RecurringBill> {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const id = generateId("rb");
  const values: NewRecurringBill = {
    id,
    userId: params.userId,
    accountId: params.accountId,
    categoryId: params.categoryId ?? null,
    name: params.name,
    amount: params.amount,
    frequency: params.frequency,
    nextDueDate: parseDate(params.nextDueDate),
    lastRunDate: null,
    notes: params.notes ?? null,
    enabled: params.enabled !== false ? true : false,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(recurringBills).values(values);
  const created = await db.select().from(recurringBills).where(eq(recurringBills.id, id)).get();
  if (!created) throw new Error("创建周期账单失败");
  return created;
}

export async function getRecurringBill(id: string, userId: string): Promise<RecurringBill | null> {
  return getRecurringBillById(id, userId);
}

export async function getRecurringBillById(id: string, userId: string): Promise<RecurringBill | null> {
  const db = getDb();
  const result = await db
    .select()
    .from(recurringBills)
    .where(and(eq(recurringBills.id, id), eq(recurringBills.userId, userId)))
    .get();
  return result ?? null;
}

export async function listRecurringBills(
  userId: string,
  options?: {
    enabled?: boolean;
    limit?: number;
  }
): Promise<RecurringBill[]> {
  const db = getDb();
  const conditions = [eq(recurringBills.userId, userId)];

  if (options?.enabled !== undefined) {
    conditions.push(eq(recurringBills.enabled, options.enabled ? true : false));
  }

  const results = await db
    .select()
    .from(recurringBills)
    .where(and(...conditions))
    .orderBy(desc(recurringBills.nextDueDate))
    .limit(options?.limit ?? 100)
    .all();

  return results;
}

export async function updateRecurringBill(
  id: string,
  userId: string,
  updates: Partial<{
    accountId: string;
    categoryId: string;
    name: string;
    amount: number;
    frequency: BillFrequency;
    nextDueDate: string; // YYYY-MM-DD
    notes: string;
    enabled: boolean;
  }>
): Promise<RecurringBill> {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const existing = await getRecurringBillById(id, userId);
  if (!existing) throw new Error("周期账单不存在或无权限");

  const updateData: Record<string, any> = { updatedAt: now };
  if (updates.accountId !== undefined) updateData.accountId = updates.accountId;
  if (updates.categoryId !== undefined) updateData.categoryId = updates.categoryId;
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.amount !== undefined) updateData.amount = updates.amount;
  if (updates.frequency !== undefined) updateData.frequency = updates.frequency;
  if (updates.nextDueDate !== undefined) updateData.nextDueDate = parseDate(updates.nextDueDate);
  if (updates.notes !== undefined) updateData.notes = updates.notes;
  if (updates.enabled !== undefined) updateData.enabled = updates.enabled ? true : false;

  await db.update(recurringBills).set(updateData).where(and(eq(recurringBills.id, id), eq(recurringBills.userId, userId)));

  const updated = await getRecurringBillById(id, userId);
  if (!updated) throw new Error("更新周期账单失败");
  return updated;
}

export async function deleteRecurringBill(id: string, userId: string): Promise<void> {
  const db = getDb();

  const existing = await getRecurringBillById(id, userId);
  if (!existing) throw new Error("周期账单不存在或无权限");

  await db.delete(recurringBills).where(and(eq(recurringBills.id, id), eq(recurringBills.userId, userId)));
}

// ─────────────────────────────────────────────
// 下次到期日期计算
// ─────────────────────────────────────────────

export function calculateNextDueDate(frequency: BillFrequency, fromDate: number): number {
  const date = new Date(fromDate * 1000);

  switch (frequency) {
    case "daily":
      date.setDate(date.getDate() + 1);
      break;
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "biweekly":
      date.setDate(date.getDate() + 14);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + 1);
      break;
    case "quarterly":
      date.setMonth(date.getMonth() + 3);
      break;
    case "yearly":
      date.setFullYear(date.getFullYear() + 1);
      break;
  }

  return Math.floor(date.getTime() / 1000);
}

// ─────────────────────────────────────────────
// 执行周期账单（生成交易）
// ─────────────────────────────────────────────

export interface ExecuteBillResult {
  bill: RecurringBill;
  transactionId?: string;
  skipped: boolean;
  message: string;
}

export async function executeRecurringBill(id: string, userId: string, targetAccountId?: string): Promise<ExecuteBillResult> {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const bill = await getRecurringBillById(id, userId);
  if (!bill) throw new Error("周期账单不存在或无权限");

  if (!bill.enabled) {
    return { bill, skipped: true, message: "账单已禁用" };
  }

  // 检查是否已过到期日
  if (bill.nextDueDate > now) {
    return { bill, skipped: true, message: "未到到期日" };
  }

  // 生成交易记录
  const transactionId = generateId("tx_rb");
  const accountId = targetAccountId || bill.accountId;

  await db.insert(transactions).values({
    id: transactionId,
    userId: bill.userId,
    accountId,
    categoryId: bill.categoryId ?? null,
    type: "expense",
    amount: bill.amount,
    description: `周期账单: ${bill.name}`,
    notes: bill.notes ?? null,
    date: bill.nextDueDate,
    source: "recurring_bill" as any,
    createdAt: now,
    updatedAt: now,
  });

  // 计算下次到期日
  const nextDueDate = calculateNextDueDate(bill.frequency as BillFrequency, bill.nextDueDate);

  // 更新账单
  await db.update(recurringBills).set({
    lastRunDate: bill.nextDueDate,
    nextDueDate: nextDueDate,
    updatedAt: now,
  }).where(eq(recurringBills.id, id));

  const updatedBill = await getRecurringBillById(id, userId);
  return {
    bill: updatedBill!,
    transactionId,
    skipped: false,
    message: `已生成交易，金额 ¥${bill.amount}`,
  };
}

// 兼容别名叫 generateBillTransactions
export async function generateBillTransactions(id: string, userId: string, targetAccountId?: string): Promise<number> {
  const result = await executeRecurringBill(id, userId, targetAccountId);
  return result.skipped ? 0 : 1;
}

// ─────────────────────────────────────────────
// 批量执行到期账单
// ─────────────────────────────────────────────

export async function executeDueBills(userId: string): Promise<ExecuteBillResult[]> {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  // 查找所有已到期且启用的账单
  const dueBills = await db
    .select()
    .from(recurringBills)
    .where(and(
      eq(recurringBills.userId, userId),
      eq(recurringBills.enabled, true),
      lte(recurringBills.nextDueDate, now)
    ))
    .all();

  const results: ExecuteBillResult[] = [];
  for (const bill of dueBills) {
    try {
      const result = await executeRecurringBill(bill.id, userId);
      results.push(result);
    } catch (error: any) {
      results.push({
        bill,
        skipped: true,
        message: `执行失败: ${error.message}`,
      });
    }
  }

  return results;
}

// ─────────────────────────────────────────────
// 到期预警
// ─────────────────────────────────────────────

export async function getDueBillAlerts(userId: string, daysAhead: number = 3): Promise<{ bill: RecurringBill; daysUntilDue: number }[]> {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const futureDate = now + daysAhead * 24 * 60 * 60;

  const bills = await db
    .select()
    .from(recurringBills)
    .where(and(
      eq(recurringBills.userId, userId),
      eq(recurringBills.enabled, true),
      gte(recurringBills.nextDueDate, now),
      lte(recurringBills.nextDueDate, futureDate)
    ))
    .all();

  return bills.map((bill) => ({
    bill,
    daysUntilDue: Math.ceil((bill.nextDueDate - now) / (24 * 60 * 60)),
  }));
}
