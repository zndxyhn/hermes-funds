/**
 * Investment Service — 投资组合业务逻辑层
 * 职责：持仓管理、买卖交易、分红、定投计划、净值缓存
 */
import { getDb } from "../db";
import {
  investments,
  investmentTransactions,
  fundCache,
  sipPlans,
  type Investment,
  type NewInvestment,
  type InvestmentTransaction,
  type NewInvestmentTransaction,
  type FundCache,
  type NewFundCache,
  type SipPlan,
  type NewSipPlan,
} from "../db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { generateId } from "../utils/id";

export type InvestmentType = "fund" | "stock" | "etf" | "gold" | "bond" | "mmf" | "cb" | "reits" | "private" | "other";
export type TransactionType = "buy" | "sell" | "dividend" | "split";
export type SipFrequency = "daily" | "weekly" | "biweekly" | "monthly" | "quarterly";

// ─────────────────────────────────────────────
// 投资持仓 CRUD
// ─────────────────────────────────────────────

export async function createInvestment(params: {
  userId: string;
  name: string;
  type: InvestmentType;
  ticker?: string;
  totalUnits?: number;
  totalCost?: number;
  avgCost?: number;
  currentNav?: number;
  currentPrice?: number;
  currentValue?: number;
  notes?: string;
}): Promise<Investment> {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const id = generateId("inv");
  const values: NewInvestment = {
    id,
    userId: params.userId,
    name: params.name,
    type: params.type,
    ticker: params.ticker ?? null,
    totalUnits: params.totalUnits ?? 0,
    totalCost: params.totalCost ?? 0,
    avgCost: params.avgCost ?? 0,
    currentNav: params.currentNav ?? null,
    currentPrice: params.currentPrice ?? null,
    currentValue: params.currentValue ?? 0,
    profit: 0,
    profitRate: 0,
    notes: params.notes ?? null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(investments).values(values);
  const created = await db.select().from(investments).where(eq(investments.id, id)).get();
  if (!created) throw new Error("创建投资记录失败");
  return created;
}

export async function getInvestmentById(id: string, userId: string): Promise<Investment | null> {
  const db = getDb();
  const result = await db
    .select()
    .from(investments)
    .where(and(eq(investments.id, id), eq(investments.userId, userId)))
    .get();
  return result ?? null;
}

export async function listInvestments(
  userId: string,
  options?: {
    type?: InvestmentType;
    sortBy?: "createdAt" | "name" | "profitRate" | "currentValue";
    limit?: number;
  }
): Promise<Investment[]> {
  const db = getDb();
  const conditions = [eq(investments.userId, userId)];

  if (options?.type) {
    conditions.push(eq(investments.type, options.type));
  }

  let query = db.select().from(investments).where(and(...conditions));

  // 排序
  const sortColumn =
    options?.sortBy === "createdAt"
      ? investments.createdAt
      : options?.sortBy === "name"
      ? investments.name
      : options?.sortBy === "profitRate"
      ? investments.profitRate
      : options?.sortBy === "currentValue"
      ? investments.currentValue
      : investments.createdAt;

  const results = await query.orderBy(desc(sortColumn)).limit(options?.limit ?? 100).all();
  return results;
}

export async function updateInvestment(
  id: string,
  userId: string,
  updates: Partial<{
    name: string;
    type: InvestmentType;
    ticker: string;
    totalUnits: number;
    totalCost: number;
    avgCost: number;
    currentNav: number;
    currentPrice: number;
    currentValue: number;
    profit: number;
    profitRate: number;
    notes: string;
  }>
): Promise<Investment> {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const existing = await getInvestmentById(id, userId);
  if (!existing) throw new Error("投资记录不存在或无权限");

  const updateData: Record<string, any> = { updatedAt: now };
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.type !== undefined) updateData.type = updates.type;
  if (updates.ticker !== undefined) updateData.ticker = updates.ticker;
  if (updates.totalUnits !== undefined) updateData.totalUnits = updates.totalUnits;
  if (updates.totalCost !== undefined) updateData.totalCost = updates.totalCost;
  if (updates.avgCost !== undefined) updateData.avgCost = updates.avgCost;
  if (updates.currentNav !== undefined) updateData.currentNav = updates.currentNav;
  if (updates.currentPrice !== undefined) updateData.currentPrice = updates.currentPrice;
  if (updates.currentValue !== undefined) updateData.currentValue = updates.currentValue;
  if (updates.profit !== undefined) updateData.profit = updates.profit;
  if (updates.profitRate !== undefined) updateData.profitRate = updates.profitRate;
  if (updates.notes !== undefined) updateData.notes = updates.notes;

  await db.update(investments).set(updateData).where(and(eq(investments.id, id), eq(investments.userId, userId)));

  const updated = await getInvestmentById(id, userId);
  if (!updated) throw new Error("更新投资记录失败");
  return updated;
}

export async function deleteInvestment(id: string, userId: string): Promise<void> {
  const db = getDb();

  const existing = await getInvestmentById(id, userId);
  if (!existing) throw new Error("投资记录不存在或无权限");

  // 有持仓不可删除
  if ((existing.totalUnits ?? 0) > 0) {
    throw new Error(`仍有持仓份额（${existing.totalUnits}份），请先清仓`);
  }

  await db.delete(investments).where(and(eq(investments.id, id), eq(investments.userId, userId)));
}

// ─────────────────────────────────────────────
// 持仓更新（内部方法，供买卖交易调用）
// ─────────────────────────────────────────────

/**
 * 买入基金/股票：更新持仓成本和份额
 */
export async function processBuy(
  investmentId: string,
  userId: string,
  params: {
    amount: number;      // 交易金额
    units: number;      // 交易份额
    navPrice: number;   // 成交净值/价格
  }
): Promise<Investment> {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const inv = await getInvestmentById(investmentId, userId);
  if (!inv) throw new Error("投资记录不存在或无权限");

  const newTotalUnits = (inv.totalUnits ?? 0) + params.units;
  const newTotalCost = (inv.totalCost ?? 0) + params.amount;
  const newAvgCost = newTotalUnits > 0 ? newTotalCost / newTotalUnits : 0;

  // 更新持仓
  await db
    .update(investments)
    .set({
      totalUnits: newTotalUnits,
      totalCost: newTotalCost,
      avgCost: newAvgCost,
      currentValue: newTotalUnits * (inv.currentNav ?? inv.currentPrice ?? params.navPrice),
      updatedAt: now,
    })
    .where(and(eq(investments.id, investmentId), eq(investments.userId, userId)));

  const updated = await getInvestmentById(investmentId, userId);
  if (!updated) throw new Error("更新投资记录失败");
  return updated;
}

/**
 * 卖出基金/股票：更新持仓成本和份额
 */
export async function processSell(
  investmentId: string,
  userId: string,
  params: {
    amount: number;      // 交易金额
    units: number;       // 交易份额
    navPrice: number;    // 成交净值/价格
  }
): Promise<Investment> {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const inv = await getInvestmentById(investmentId, userId);
  if (!inv) throw new Error("投资记录不存在或无权限");

  const newTotalUnits = (inv.totalUnits ?? 0) - params.units;
  if (newTotalUnits < 0) {
    throw new Error(`卖出份额超过持有份额：持有${inv.totalUnits}份，卖出${params.units}份`);
  }

  // 成本按比例减少
  const costRatio = newTotalUnits / ((inv.totalUnits ?? 0) === 0 ? 1 : inv.totalUnits ?? 1);
  const newTotalCost = (inv.totalCost ?? 0) * costRatio;
  const newAvgCost = newTotalUnits > 0 ? newTotalCost / newTotalUnits : 0;

  await db
    .update(investments)
    .set({
      totalUnits: newTotalUnits,
      totalCost: newTotalCost,
      avgCost: newAvgCost,
      currentValue: newTotalUnits * (inv.currentNav ?? inv.currentPrice ?? params.navPrice),
      updatedAt: now,
    })
    .where(and(eq(investments.id, investmentId), eq(investments.userId, userId)));

  const updated = await getInvestmentById(investmentId, userId);
  if (!updated) throw new Error("更新投资记录失败");
  return updated;
}

/**
 * 更新实时行情并重算盈亏
 */
export async function updatePrice(
  investmentId: string,
  userId: string,
  navOrPrice: number
): Promise<Investment> {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const inv = await getInvestmentById(investmentId, userId);
  if (!inv) throw new Error("投资记录不存在或无权限");

  const totalUnits = inv.totalUnits ?? 0;
  const totalCost = inv.totalCost ?? 0;
  const currentValue = totalUnits * navOrPrice;
  const profit = currentValue - totalCost;
  const profitRate = totalCost > 0 ? (profit / totalCost) * 100 : 0;

  const updateData: Record<string, any> = {
    currentValue,
    profit,
    profitRate,
    lastNavUpdate: now,
    updatedAt: now,
  };

  // 基金用 NAV，股票/ETF 用 Price
  if (inv.type === "fund") {
    updateData.currentNav = navOrPrice;
  } else {
    updateData.currentPrice = navOrPrice;
  }

  await db.update(investments).set(updateData).where(and(eq(investments.id, investmentId), eq(investments.userId, userId)));

  const updated = await getInvestmentById(investmentId, userId);
  if (!updated) throw new Error("更新投资记录失败");
  return updated;
}

// ─────────────────────────────────────────────
// 投资交易明细 CRUD
// ─────────────────────────────────────────────

export async function createInvestmentTransaction(params: {
  userId: string;
  investmentId: string;
  accountId: string;
  type: TransactionType;
  amount: number;
  units: number;
  navPrice: number;
  date: number;
  notes?: string;
  source?: "dialog" | "form" | "sip";
}): Promise<InvestmentTransaction> {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const id = generateId("itx");
  const values: NewInvestmentTransaction = {
    id,
    userId: params.userId,
    investmentId: params.investmentId,
    accountId: params.accountId,
    type: params.type,
    amount: params.amount,
    units: params.units,
    navPrice: params.navPrice,
    date: params.date,
    notes: params.notes ?? null,
    source: params.source ?? "form",
    createdAt: now,
  };

  // 先插入交易记录
  await db.insert(investmentTransactions).values(values);

  // 更新持仓
  if (params.type === "buy") {
    await processBuy(params.investmentId, params.userId, {
      amount: params.amount,
      units: params.units,
      navPrice: params.navPrice,
    });
  } else if (params.type === "sell") {
    await processSell(params.investmentId, params.userId, {
      amount: params.amount,
      units: params.units,
      navPrice: params.navPrice,
    });
  }
  // dividend 和 split 暂不处理持仓

  const created = await db.select().from(investmentTransactions).where(eq(investmentTransactions.id, id)).get();
  if (!created) throw new Error("创建投资交易记录失败");
  return created;
}

export async function listInvestmentTransactions(
  userId: string,
  investmentId?: string,
  options?: {
    type?: TransactionType;
    limit?: number;
  }
): Promise<InvestmentTransaction[]> {
  const db = getDb();
  const conditions = [eq(investmentTransactions.userId, userId)];

  if (investmentId) {
    conditions.push(eq(investmentTransactions.investmentId, investmentId));
  }
  if (options?.type) {
    conditions.push(eq(investmentTransactions.type, options.type));
  }

  const results = await db
    .select()
    .from(investmentTransactions)
    .where(and(...conditions))
    .orderBy(desc(investmentTransactions.date))
    .limit(options?.limit ?? 100)
    .all();

  return results;
}

// ─────────────────────────────────────────────
// 定投计划 CRUD
// ─────────────────────────────────────────────

export async function createSipPlan(params: {
  userId: string;
  investmentId: string;
  accountId: string;
  amount: number;
  frequency: SipFrequency;
  nextRunDate: number;
}): Promise<SipPlan> {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const id = generateId("sip");
  const values: NewSipPlan = {
    id,
    userId: params.userId,
    investmentId: params.investmentId,
    accountId: params.accountId,
    amount: params.amount,
    frequency: params.frequency,
    nextRunDate: params.nextRunDate,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(sipPlans).values(values);
  const created = await db.select().from(sipPlans).where(eq(sipPlans.id, id)).get();
  if (!created) throw new Error("创建定投计划失败");
  return created;
}

export async function listSipPlans(userId: string): Promise<SipPlan[]> {
  const db = getDb();
  const results = await db
    .select()
    .from(sipPlans)
    .where(eq(sipPlans.userId, userId))
    .orderBy(asc(sipPlans.nextRunDate))
    .all();
  return results;
}

export async function updateSipPlan(
  id: string,
  userId: string,
  updates: Partial<{
    amount: number;
    frequency: SipFrequency;
    nextRunDate: number;
    enabled: boolean;
  }>
): Promise<SipPlan> {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const existing = await db
    .select()
    .from(sipPlans)
    .where(and(eq(sipPlans.id, id), eq(sipPlans.userId, userId)))
    .get();
  if (!existing) throw new Error("定投计划不存在或无权限");

  const updateData: Record<string, any> = { updatedAt: now };
  if (updates.amount !== undefined) updateData.amount = updates.amount;
  if (updates.frequency !== undefined) updateData.frequency = updates.frequency;
  if (updates.nextRunDate !== undefined) updateData.nextRunDate = updates.nextRunDate;
  if (updates.enabled !== undefined) updateData.enabled = updates.enabled;

  await db.update(sipPlans).set(updateData).where(and(eq(sipPlans.id, id), eq(sipPlans.userId, userId)));

  const updated = await db.select().from(sipPlans).where(eq(sipPlans.id, id)).get();
  if (!updated) throw new Error("更新定投计划失败");
  return updated;
}

export async function deleteSipPlan(id: string, userId: string): Promise<void> {
  const db = getDb();

  const existing = await db
    .select()
    .from(sipPlans)
    .where(and(eq(sipPlans.id, id), eq(sipPlans.userId, userId)))
    .get();
  if (!existing) throw new Error("定投计划不存在或无权限");

  await db.delete(sipPlans).where(and(eq(sipPlans.id, id), eq(sipPlans.userId, userId)));
}

// ─────────────────────────────────────────────
// 基金净值缓存
// ─────────────────────────────────────────────

export async function upsertFundCache(params: {
  ticker: string;
  name?: string;
  nav?: number;
  navDate?: string;
  estNav?: number;
  estNavTime?: string;
  dayChange?: number;
}): Promise<FundCache> {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const values: NewFundCache = {
    ticker: params.ticker,
    name: params.name ?? null,
    nav: params.nav ?? null,
    navDate: params.navDate ?? null,
    estNav: params.estNav ?? null,
    estNavTime: params.estNavTime ?? null,
    dayChange: params.dayChange ?? null,
    updatedAt: now,
  };

  await db.insert(fundCache).values(values).onConflictDoUpdate({
    target: fundCache.ticker,
    set: values,
  });

  const result = await db.select().from(fundCache).where(eq(fundCache.ticker, params.ticker)).get();
  if (!result) throw new Error("更新基金缓存失败");
  return result;
}

export async function getFundCache(ticker: string): Promise<FundCache | null> {
  const db = getDb();
  const result = await db.select().from(fundCache).where(eq(fundCache.ticker, ticker)).get();
  return result ?? null;
}

export async function listFundCache(): Promise<FundCache[]> {
  const db = getDb();
  const results = await db.select().from(fundCache).all();
  return results;
}
