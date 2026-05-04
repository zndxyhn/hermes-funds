/**
 * ROI Service — 投资收益分析
 * 职责：持仓分析、分红统计、收益率计算、历史盈亏汇总
 */
import { getDb } from "../db";
import {
  investments,
  investmentTransactions,
  accounts,
  type Investment,
  type InvestmentTransaction,
} from "../db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

// ─────────────────────────────────────────────
// 收益率计算
// ─────────────────────────────────────────────

/**
 * 计算单个投资的收益率详情
 */
export async function calculateInvestmentROI(
  investmentId: string,
  userId: string
): Promise<{
  investmentId: string;
  name: string;
  ticker: string;
  type: string;
  currency: string;
  // 持仓数据
  totalUnits: number;
  totalCost: number;
  currentNav: number | null;
  currentPrice: number | null;
  currentValue: number;
  // 收益数据
  profit: number;
  profitRate: number; // 持仓收益率 %
  // 分红数据
  totalDividends: number;
  dividendCount: number;
  // 总收益（含分红）
  totalProfit: number;
  totalProfitRate: number; // 总收益 %
  // 持有信息
  firstBuyDate: number | null;
  holdingDays: number;
  annualReturn: number; // 年化收益率 %
  // 交易统计
  buyCount: number;
  sellCount: number;
  buyAmount: number;
  sellAmount: number;
} | null> {
  const db = getDb();

  // 获取投资基本信息
  const inv = await db
    .select()
    .from(investments)
    .where(and(eq(investments.id, investmentId), eq(investments.userId, userId)))
    .get();

  if (!inv) return null;

  // 获取所有交易记录
  const transactions = await db
    .select()
    .from(investmentTransactions)
    .where(and(eq(investmentTransactions.investmentId, investmentId), eq(investmentTransactions.userId, userId)))
    .orderBy(investmentTransactions.date)
    .all();

  // 计算买入/卖出/分红
  let totalUnits = 0;
  let totalCost = 0;
  let buyCount = 0;
  let sellCount = 0;
  let buyAmount = 0;
  let sellAmount = 0;
  let totalDividends = 0;
  let firstBuyDate: number | null = null;

  for (const tx of transactions) {
    if (tx.type === "buy") {
      totalUnits += tx.units;
      totalCost += tx.amount;
      buyAmount += tx.amount;
      buyCount++;
      if (!firstBuyDate || tx.date < firstBuyDate) {
        firstBuyDate = tx.date;
      }
    } else if (tx.type === "sell") {
      // 卖出：按先进先出减少份额和成本
      const avgCost = totalUnits > 0 ? totalCost / totalUnits : 0;
      totalUnits -= tx.units;
      totalCost -= tx.units * avgCost;
      sellAmount += tx.amount;
      sellCount++;
      if (totalUnits < 0) totalUnits = 0;
      if (totalCost < 0) totalCost = 0;
    } else if (tx.type === "dividend") {
      totalDividends += tx.amount;
    }
  }

  // 当前值
  const navOrPrice = inv.type === "fund" ? inv.currentNav : inv.currentPrice;
  const currentValue = totalUnits * (navOrPrice ?? 0);

  // 收益
  const profit = currentValue - totalCost;
  const profitRate = totalCost > 0 ? (profit / totalCost) * 100 : 0;

  // 总收益（含分红）
  const totalProfit = profit + totalDividends;
  const totalProfitRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  // 持有天数
  const now = Math.floor(Date.now() / 1000);
  const holdingDays = firstBuyDate ? Math.max(1, Math.floor((now - firstBuyDate) / 86400)) : 0;

  // 年化收益率
  const annualReturn = holdingDays > 0 && totalCost > 0
    ? (totalProfitRate / holdingDays) * 365
    : 0;

  return {
    investmentId: inv.id,
    name: inv.name,
    ticker: inv.ticker ?? "",
    type: inv.type,
    currency: "CNY", // 投资默认CNY
    totalUnits,
    totalCost,
    currentNav: inv.currentNav,
    currentPrice: inv.currentPrice,
    currentValue,
    profit,
    profitRate,
    totalDividends,
    dividendCount: transactions.filter((t) => t.type === "dividend").length,
    totalProfit,
    totalProfitRate,
    firstBuyDate,
    holdingDays,
    annualReturn,
    buyCount,
    sellCount,
    buyAmount,
    sellAmount,
  };
}

/**
 * 获取用户所有投资的收益率汇总
 */
export async function calculatePortfolioROI(
  userId: string
): Promise<{
  totalInvested: number;    // 总投入
  totalCurrentValue: number; // 总当前市值
  totalProfit: number;       // 总持仓盈亏
  totalProfitRate: number;   // 总持仓收益率
  totalDividends: number;    // 总分红
  totalProfitIncludingDividends: number; // 总收益（含分红）
  totalProfitRateIncludingDividends: number; // 总收益率（含分红）
  investments: Awaited<ReturnType<typeof calculateInvestmentROI>>[];
}> {
  const db = getDb();

  const userInvestments = await db
    .select()
    .from(investments)
    .where(eq(investments.userId, userId))
    .all();

  const investmentROIs = await Promise.all(
    userInvestments.map(async (inv) => calculateInvestmentROI(inv.id, userId))
  );

  const validROIs = investmentROIs.filter((r): r is NonNullable<typeof r> => r !== null);

  const totalInvested = validROIs.reduce((sum, r) => sum + r.totalCost, 0);
  const totalCurrentValue = validROIs.reduce((sum, r) => sum + r.currentValue, 0);
  const totalProfit = validROIs.reduce((sum, r) => sum + r.profit, 0);
  const totalDividends = validROIs.reduce((sum, r) => sum + r.totalDividends, 0);
  const totalProfitIncludingDividends = totalProfit + totalDividends;
  const totalProfitRate = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
  const totalProfitRateIncludingDividends = totalInvested > 0
    ? (totalProfitIncludingDividends / totalInvested) * 100
    : 0;

  return {
    totalInvested,
    totalCurrentValue,
    totalProfit,
    totalProfitRate,
    totalDividends,
    totalProfitIncludingDividends,
    totalProfitRateIncludingDividends,
    investments: validROIs,
  };
}

// ─────────────────────────────────────────────
// 历史交易盈亏分析
// ─────────────────────────────────────────────

export interface TradeSummary {
  ticker: string;
  name: string;
  buyCount: number;
  sellCount: number;
  totalBoughtShares: number;
  totalSoldShares: number;
  totalBuyAmount: number;
  totalSellAmount: number;
  realizedProfit: number;
  realizedProfitRate: number;
  avgBuyPrice: number;
  avgSellPrice: number;
}

export async function calculateTradeSummary(
  investmentId: string,
  userId: string
): Promise<TradeSummary | null> {
  const db = getDb();

  const inv = await db
    .select()
    .from(investments)
    .where(and(eq(investments.id, investmentId), eq(investments.userId, userId)))
    .get();

  if (!inv) return null;

  const transactions = await db
    .select()
    .from(investmentTransactions)
    .where(and(eq(investmentTransactions.investmentId, investmentId), eq(investmentTransactions.userId, userId)))
    .orderBy(investmentTransactions.date)
    .all();

  let totalBoughtShares = 0;
  let totalSoldShares = 0;
  let totalBuyAmount = 0;
  let totalSellAmount = 0;
  let buyCount = 0;
  let sellCount = 0;

  for (const tx of transactions) {
    if (tx.type === "buy") {
      totalBoughtShares += tx.units;
      totalBuyAmount += tx.amount;
      buyCount++;
    } else if (tx.type === "sell") {
      totalSoldShares += tx.units;
      totalSellAmount += tx.amount;
      sellCount++;
    }
  }

  // 已实现收益 = 卖出金额 - (卖出份额 * 平均买入成本)
  const avgBuyCost = totalBoughtShares > 0 ? totalBuyAmount / totalBoughtShares : 0;
  const realizedProfit = totalSellAmount - totalSoldShares * avgBuyCost;
  const realizedProfitRate = totalSellAmount > 0 ? (realizedProfit / totalSellAmount) * 100 : 0;

  return {
    ticker: inv.ticker ?? "",
    name: inv.name,
    buyCount,
    sellCount,
    totalBoughtShares,
    totalSoldShares,
    totalBuyAmount,
    totalSellAmount,
    realizedProfit,
    realizedProfitRate,
    avgBuyPrice: avgBuyCost,
    avgSellPrice: totalSoldShares > 0 ? totalSellAmount / totalSoldShares : 0,
  };
}

// ─────────────────────────────────────────────
// 成本均价分析
// ─────────────────────────────────────────────

export interface CostAnalysis {
  ticker: string;
  name: string;
  currentUnits: number;
  totalCost: number;
  avgCost: number;        // 单位成本
  currentNav: number | null;
  currentPrice: number | null;
  currentValue: number;
  unrealizedProfit: number;
  unrealizedProfitRate: number;
}

export async function calculateCostAnalysis(
  investmentId: string,
  userId: string
): Promise<CostAnalysis | null> {
  const db = getDb();

  const inv = await db
    .select()
    .from(investments)
    .where(and(eq(investments.id, investmentId), eq(investments.userId, userId)))
    .get();

  if (!inv) return null;

  const transactions = await db
    .select()
    .from(investmentTransactions)
    .where(and(eq(investmentTransactions.investmentId, investmentId), eq(investmentTransactions.userId, userId)))
    .all();

  let totalUnits = 0;
  let totalCost = 0;

  for (const tx of transactions) {
    if (tx.type === "buy") {
      totalUnits += tx.units;
      totalCost += tx.amount;
    } else if (tx.type === "sell") {
      const avgCost = totalUnits > 0 ? totalCost / totalUnits : 0;
      totalUnits -= tx.units;
      totalCost -= tx.units * avgCost;
      if (totalUnits < 0) totalUnits = 0;
      if (totalCost < 0) totalCost = 0;
    }
  }

  const navOrPrice = inv.type === "fund" ? inv.currentNav : inv.currentPrice;
  const currentValue = totalUnits * (navOrPrice ?? 0);
  const unrealizedProfit = currentValue - totalCost;
  const unrealizedProfitRate = totalCost > 0 ? (unrealizedProfit / totalCost) * 100 : 0;

  return {
    ticker: inv.ticker ?? "",
    name: inv.name,
    currentUnits: totalUnits,
    totalCost,
    avgCost: totalUnits > 0 ? totalCost / totalUnits : 0,
    currentNav: inv.currentNav,
    currentPrice: inv.currentPrice,
    currentValue,
    unrealizedProfit,
    unrealizedProfitRate,
  };
}
