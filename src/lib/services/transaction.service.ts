/**
 * Transaction Service — 交易记录业务逻辑层
 * 核心：原子操作 — INSERT 交易记录 + UPDATE 余额 必须在同一事务内
 */
import { getDb } from "../db";
import { transactions, accounts, categories, type Transaction, type NewTransaction } from "../db/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { generateId } from "../utils/id";

// 引用 better-sqlite3 的 transaction 方法（通过 drizzle 底层）
// Drizzle ORM 对 better-sqlite3 的 transaction 包装
function runInTransaction<T>(fn: () => T): T {
  const db = getDb();
  // @ts-ignore — 获取底层 sqlite 实例
  const sqlite = db.$client as import("better-sqlite3").Database;
  return sqlite.transaction(fn)();
}

export type TransactionType = "expense" | "income" | "transfer" | "investment_buy" | "investment_sell";
export type TransactionSource = "dialog" | "form" | "import" | "sip";

// ─────────────────────────────────────────────
// 创建支出
// ─────────────────────────────────────────────
export async function createExpense(params: {
  userId: string;
  accountId: string;
  categoryId: string;
  amount: number;
  description?: string;
  notes?: string;
  date?: Date;
  tags?: string[];
  source?: TransactionSource;
}): Promise<{ transaction: Transaction; balanceAfter: number }> {
  if (params.amount <= 0) throw new Error("金额必须大于 0");

  return runInTransaction(() => {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    // 1. 查询账户并锁定（检查余额）
    const account = db.select().from(accounts)
      .where(and(eq(accounts.id, params.accountId), eq(accounts.userId, params.userId)))
      .get() as any;
    if (!account) throw new Error("账户不存在或无权限");

    const currentBalance = account.balance ?? 0;
    const newBalance = currentBalance - params.amount;

    // 信用卡账户允许负余额，普通账户不允许
    if (account.type !== "credit" && newBalance < 0) {
      throw new Error(`余额不足：当前 ¥${currentBalance}，需要 ¥${params.amount.toFixed(2)}`);
    }

    // 2. 创建交易记录
    const txId = generateId("tx");
    const txData: NewTransaction = {
      id: txId,
      userId: params.userId,
      accountId: params.accountId,
      categoryId: params.categoryId,
      type: "expense",
      amount: params.amount,
      description: params.description ?? null,
      notes: params.notes ?? null,
      date: Math.floor((params.date ?? new Date()).getTime() / 1000),
      tags: params.tags ? JSON.stringify(params.tags) : null,
      source: params.source ?? "form",
      investmentId: null,
      transferToAccountId: null,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(transactions).values(txData).run();

    // 3. 更新账户余额
    db.update(accounts)
      .set({ balance: newBalance, updatedAt: now })
      .where(and(eq(accounts.id, params.accountId), eq(accounts.userId, params.userId)))
      .run();

    const created = db.select().from(transactions).where(eq(transactions.id, txId)).get();
    return { transaction: created!, balanceAfter: newBalance };
  });
}

// ─────────────────────────────────────────────
// 创建收入
// ─────────────────────────────────────────────
export async function createIncome(params: {
  userId: string;
  accountId: string;
  categoryId: string;
  amount: number;
  description?: string;
  notes?: string;
  date?: Date;
  tags?: string[];
  source?: TransactionSource;
}): Promise<{ transaction: Transaction; balanceAfter: number }> {
  if (params.amount <= 0) throw new Error("金额必须大于 0");

  return runInTransaction(() => {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    const account = db.select().from(accounts)
      .where(and(eq(accounts.id, params.accountId), eq(accounts.userId, params.userId)))
      .get() as any;
    if (!account) throw new Error("账户不存在或无权限");

    const currentBalance = account.balance ?? 0;
    const newBalance = currentBalance + params.amount;

    const txId = generateId("tx");
    const txData: NewTransaction = {
      id: txId,
      userId: params.userId,
      accountId: params.accountId,
      categoryId: params.categoryId,
      type: "income",
      amount: params.amount,
      description: params.description ?? null,
      notes: params.notes ?? null,
      date: Math.floor((params.date ?? new Date()).getTime() / 1000),
      tags: params.tags ? JSON.stringify(params.tags) : null,
      source: params.source ?? "form",
      investmentId: null,
      transferToAccountId: null,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(transactions).values(txData).run();
    db.update(accounts)
      .set({ balance: newBalance, updatedAt: now })
      .where(and(eq(accounts.id, params.accountId), eq(accounts.userId, params.userId)))
      .run();

    const created = db.select().from(transactions).where(eq(transactions.id, txId)).get();
    return { transaction: created!, balanceAfter: newBalance };
  });
}

// ─────────────────────────────────────────────
// 创建转账
// ─────────────────────────────────────────────
export async function createTransfer(params: {
  userId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  description?: string;
  date?: Date;
  source?: TransactionSource;
}): Promise<{ transaction: Transaction; fromBalanceAfter: number; toBalanceAfter: number }> {
  if (params.amount <= 0) throw new Error("金额必须大于 0");
  if (params.fromAccountId === params.toAccountId) throw new Error("转出和转入账户不能相同");

  return runInTransaction(() => {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    // 查询转出账户
    const fromAccount = db.select().from(accounts)
      .where(and(eq(accounts.id, params.fromAccountId), eq(accounts.userId, params.userId)))
      .get() as any;
    if (!fromAccount) throw new Error("转出账户不存在或无权限");

    const fromBalance = fromAccount.balance ?? 0;
    const newFromBalance = fromBalance - params.amount;
    if (fromAccount.type !== "credit" && newFromBalance < 0) {
      throw new Error(`转出账户余额不足：当前 ¥${fromBalance}，需要 ¥${params.amount.toFixed(2)}`);
    }

    // 查询转入账户
    const toAccount = db.select().from(accounts)
      .where(and(eq(accounts.id, params.toAccountId), eq(accounts.userId, params.userId)))
      .get() as any;
    if (!toAccount) throw new Error("转入账户不存在或无权限");

    const toBalance = toAccount.balance ?? 0;
    const newToBalance = toBalance + params.amount;

    // 创建转账记录（type=transfer）
    const txId = generateId("tx");
    const txData: NewTransaction = {
      id: txId,
      userId: params.userId,
      accountId: params.fromAccountId,
      categoryId: null,
      type: "transfer",
      amount: params.amount,
      description: params.description ?? null,
      notes: null,
      date: Math.floor((params.date ?? new Date()).getTime() / 1000),
      tags: null,
      source: params.source ?? "form",
      investmentId: null,
      transferToAccountId: params.toAccountId,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(transactions).values(txData).run();

    // 更新两个账户余额
    db.update(accounts).set({ balance: newFromBalance, updatedAt: now })
      .where(and(eq(accounts.id, params.fromAccountId), eq(accounts.userId, params.userId))).run();
    db.update(accounts).set({ balance: newToBalance, updatedAt: now })
      .where(and(eq(accounts.id, params.toAccountId), eq(accounts.userId, params.userId))).run();

    const created = db.select().from(transactions).where(eq(transactions.id, txId)).get();
    return { transaction: created!, fromBalanceAfter: newFromBalance, toBalanceAfter: newToBalance };
  });
}

// ─────────────────────────────────────────────
// 查询交易列表（分页+筛选）
// ─────────────────────────────────────────────
export async function listTransactions(
  userId: string,
  options?: {
    type?: TransactionType;
    categoryId?: string;
    accountId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    pageSize?: number;
  }
): Promise<{ data: Transaction[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const db = getDb();
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const conditions = [eq(transactions.userId, userId)];
  if (options?.type) conditions.push(eq(transactions.type, options.type));
  if (options?.categoryId) conditions.push(eq(transactions.categoryId, options.categoryId));
  if (options?.accountId) conditions.push(eq(transactions.accountId, options.accountId));
  if (options?.startDate) conditions.push(gte(transactions.date, Math.floor(options.startDate.getTime() / 1000)));
  if (options?.endDate) conditions.push(lte(transactions.date, Math.floor(options.endDate.getTime() / 1000)));

  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

  // 总数
  const countResult = db.select({ count: sql<number>`count(*)` }).from(transactions).where(whereClause).get();
  const total = countResult?.count ?? 0;

  // 数据
  const data = await db
    .select()
    .from(transactions)
    .where(whereClause)
    .orderBy(desc(transactions.date))
    .limit(pageSize)
    .offset(offset)
    .all();

  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// ─────────────────────────────────────────────
// 按 ID 查询
// ─────────────────────────────────────────────
export async function getTransactionById(id: string, userId: string): Promise<Transaction | null> {
  const db = getDb();
  return await db.select().from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .get() ?? null;
}

// ─────────────────────────────────────────────
// 删除交易（同时逆操作余额）
// ─────────────────────────────────────────────
export async function deleteTransaction(id: string, userId: string): Promise<void> {
  return runInTransaction(() => {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    const tx = db.select().from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .get() as any;
    if (!tx) throw new Error("交易记录不存在或无权限");

    const account = db.select().from(accounts)
      .where(and(eq(accounts.id, tx.account_id), eq(accounts.userId, userId)))
      .get() as any;
    if (!account) throw new Error("关联账户不存在");

    // 逆操作余额
    let balanceDelta: number;
    if (tx.type === "expense") {
      balanceDelta = tx.amount; // 支出逆操作 = 加回余额
    } else if (tx.type === "income") {
      balanceDelta = -tx.amount; // 收入逆操作 = 扣除余额
    } else if (tx.type === "transfer") {
      // 转账需要同时恢复两个账户
      const toAccount = db.select().from(accounts)
        .where(and(eq(accounts.id, tx.transfer_to_account_id), eq(accounts.userId, userId)))
        .get() as any;
      if (toAccount) {
        db.update(accounts).set({ balance: toAccount.balance + tx.amount, updatedAt: now })
          .where(eq(accounts.id, tx.transfer_to_account_id)).run();
      }
      balanceDelta = -tx.amount; // 转出账户加回
    } else {
      balanceDelta = 0;
    }

    db.update(accounts)
      .set({ balance: account.balance + balanceDelta, updatedAt: now })
      .where(and(eq(accounts.id, tx.account_id), eq(accounts.userId, userId)))
      .run();

    db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId))).run();
  });
}
