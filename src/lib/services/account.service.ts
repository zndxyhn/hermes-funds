/**
 * Account Service — 账户业务逻辑层
 * 职责：账户 CRUD、余额更新、默认账户管理
 */
import { getDb } from "../db";
import { accounts, type Account, type NewAccount } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { generateId } from "../utils/id";

export type AccountType = "cash" | "bank" | "digital" | "investment" | "credit" | "other";

// ─────────────────────────────────────────────
// 创建账户
// ─────────────────────────────────────────────
export async function createAccount(params: {
  userId: string;
  name: string;
  type: AccountType;
  balance?: number;
  currency?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
  isDefault?: boolean;
}): Promise<Account> {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const id = generateId("acc");
  const values: NewAccount = {
    id,
    userId: params.userId,
    name: params.name,
    type: params.type,
    balance: params.balance ?? 0,
    currency: params.currency ?? "CNY",
    icon: params.icon ?? null,
    color: params.color ?? null,
    sortOrder: params.sortOrder ?? 0,
    isDefault: params.isDefault ?? false,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(accounts).values(values);
  const created = await db.select().from(accounts).where(eq(accounts.id, id)).get();
  if (!created) throw new Error("创建账户失败");
  return created;
}

// ─────────────────────────────────────────────
// 查询账户（单个）
// ─────────────────────────────────────────────
export async function getAccountById(id: string, userId: string): Promise<Account | null> {
  const db = getDb();
  const result = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .get();
  return result ?? null;
}

// ─────────────────────────────────────────────
// 查询账户列表
// ─────────────────────────────────────────────
export async function listAccounts(
  userId: string,
  options?: {
    type?: AccountType;
    sortBy?: "sortOrder" | "createdAt" | "name";
    limit?: number;
  }
): Promise<Account[]> {
  const db = getDb();
  const conditions = [eq(accounts.userId, userId)];

  if (options?.type) {
    conditions.push(eq(accounts.type, options.type));
  }

  let query = db
    .select()
    .from(accounts)
    .where(and(...conditions));

  // 排序
  const sortColumn =
    options?.sortBy === "createdAt"
      ? accounts.createdAt
      : options?.sortBy === "name"
      ? accounts.name
      : accounts.sortOrder;

  const results = await query.orderBy(desc(sortColumn)).limit(options?.limit ?? 100).all();
  return results;
}

// ─────────────────────────────────────────────
// 更新账户
// ─────────────────────────────────────────────
export async function updateAccount(
  id: string,
  userId: string,
  updates: Partial<{
    name: string;
    type: AccountType;
    balance: number;
    currency: string;
    icon: string;
    color: string;
    sortOrder: number;
    isDefault: boolean;
  }>
): Promise<Account> {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  // 验证归属
  const existing = await getAccountById(id, userId);
  if (!existing) throw new Error("账户不存在或无权限");

  const updateData: Record<string, any> = { updatedAt: now };
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.type !== undefined) updateData.type = updates.type;
  if (updates.balance !== undefined) updateData.balance = updates.balance;
  if (updates.currency !== undefined) updateData.currency = updates.currency;
  if (updates.icon !== undefined) updateData.icon = updates.icon;
  if (updates.color !== undefined) updateData.color = updates.color;
  if (updates.sortOrder !== undefined) updateData.sortOrder = updates.sortOrder;
  if (updates.isDefault !== undefined) updateData.isDefault = updates.isDefault;

  await db.update(accounts).set(updateData).where(and(eq(accounts.id, id), eq(accounts.userId, userId)));

  const updated = await getAccountById(id, userId);
  if (!updated) throw new Error("更新账户失败");
  return updated;
}

// ─────────────────────────────────────────────
// 删除账户（仅空账户可删除）
// ─────────────────────────────────────────────
export async function deleteAccount(id: string, userId: string): Promise<void> {
  const db = getDb();

  const existing = await getAccountById(id, userId);
  if (!existing) throw new Error("账户不存在或无权限");

  // 余额非空不可删除
  if (existing.balance !== 0) {
    throw new Error(`账户余额非零（¥${existing.balance}），请先清空账户`);
  }

  // 系统默认账户不可删除
  if (existing.isDefault) {
    throw new Error("默认账户不可删除");
  }

  await db.delete(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
}

// ─────────────────────────────────────────────
// 余额更新（内部方法，供 TransactionService 调用）
// ─────────────────────────────────────────────
export async function updateBalance(
  accountId: string,
  delta: number,
  userId: string
): Promise<number> {
  const db = getDb();

  const account = await getAccountById(accountId, userId);
  if (!account) throw new Error("账户不存在或无权限");

  const currentBalance = account.balance ?? 0;
  const newBalance = currentBalance + delta;

  // 不允许余额为负（信用卡账户除外）
  if (account.type !== "credit" && newBalance < 0) {
    throw new Error(`余额不足：当前 ¥${account.balance}，需要 ¥${Math.abs(delta)}`);
  }

  await db
    .update(accounts)
    .set({ balance: newBalance, updatedAt: Math.floor(Date.now() / 1000) })
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));

  return newBalance;
}

// ─────────────────────────────────────────────
// 获取默认账户
// ─────────────────────────────────────────────
export async function getDefaultAccount(userId: string): Promise<Account | null> {
  const db = getDb();
  const result = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isDefault, true)))
    .get();

  if (!result) {
    // 没有默认账户时返回第一个
    const first = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .orderBy(accounts.sortOrder)
      .limit(1)
      .get();
    return first ?? null;
  }
  return result;
}
