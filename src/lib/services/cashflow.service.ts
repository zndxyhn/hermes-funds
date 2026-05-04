/**
 * Cash Flow Service — 现金流报表
 * 收入 - 支出 = 净现金流
 * 按月统计收支流水，支持预算对比
 */
import { getDb } from "../db";
import { transactions, accounts, categories, type Transaction } from "../db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

export interface CashFlowMonth {
  month: string; // "2025-05"
  income: number; // 总收入
  expense: number; // 总支出
  netCashFlow: number; // 净现金流
  investmentIn: number; // 投资入金
  investmentOut: number; // 投资出金
  transactionCount: number;
}

export interface CashFlowReport {
  currentMonth: CashFlowMonth;
  monthlyAverage: {
    income: number;
    expense: number;
    netCashFlow: number;
  };
  last6Months: CashFlowMonth[];
  topExpenseCategories: {
    categoryId: string;
    categoryName: string;
    amount: number;
    proportion: number;
  }[];
}

function getMonthRange(year: number, month: number): { start: number; end: number } {
  const start = new Date(year, month - 1, 1).getTime() / 1000;
  const end = new Date(year, month, 0, 23, 59, 59).getTime() / 1000;
  return { start, end };
}

export async function calculateCashFlow(
  userId: string,
  year?: number,
  month?: number
): Promise<CashFlowReport> {
  const db = getDb();
  const now = new Date();
  const targetYear = year ?? now.getFullYear();
  const targetMonth = month ?? now.getMonth() + 1;

  const { start, end } = getMonthRange(targetYear, targetMonth);

  // 查询当月所有交易
  const monthTransactions = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      categoryId: transactions.categoryId,
      date: transactions.date,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, start),
        lte(transactions.date, end)
      )
    )
    .all();

  // 按类型统计
  let income = 0;
  let expense = 0;
  let investmentIn = 0;
  let investmentOut = 0;

  for (const tx of monthTransactions) {
    if (tx.type === "income") income += tx.amount;
    else if (tx.type === "expense") expense += tx.amount;
    else if (tx.type === "investment_buy") investmentIn += tx.amount;
    else if (tx.type === "investment_sell") investmentOut += tx.amount;
  }

  const currentMonth: CashFlowMonth = {
    month: `${targetYear}-${String(targetMonth).padStart(2, "0")}`,
    income,
    expense,
    netCashFlow: income - expense,
    investmentIn,
    investmentOut,
    transactionCount: monthTransactions.length,
  };

  // 最近6个月数据
  const last6Months: CashFlowMonth[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(targetYear, targetMonth - 1 - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const { start: s, end: e } = getMonthRange(y, m);

    const txs = await db
      .select({ type: transactions.type, amount: transactions.amount })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), gte(transactions.date, s), lte(transactions.date, e)))
      .all();

    let inc = 0, exp = 0, invIn = 0, invOut = 0;
    for (const tx of txs) {
      if (tx.type === "income") inc += tx.amount;
      else if (tx.type === "expense") exp += tx.amount;
      else if (tx.type === "investment_buy") invIn += tx.amount;
      else if (tx.type === "investment_sell") invOut += Math.abs(tx.amount);
    }

    last6Months.push({
      month: `${y}-${String(m).padStart(2, "0")}`,
      income: inc,
      expense: exp,
      netCashFlow: inc - exp,
      investmentIn: invIn,
      investmentOut: invOut,
      transactionCount: txs.length,
    });
  }

  // 月均
  const monthlyAverage = {
    income: last6Months.length > 0 ? last6Months.reduce((s, m) => s + m.income, 0) / last6Months.length : 0,
    expense: last6Months.length > 0 ? last6Months.reduce((s, m) => s + m.expense, 0) / last6Months.length : 0,
    netCashFlow: last6Months.length > 0 ? last6Months.reduce((s, m) => s + m.netCashFlow, 0) / last6Months.length : 0,
  };

  // 支出分类排名
  const categoryExpenses = new Map<string, number>();
  for (const tx of monthTransactions) {
    if (tx.type === "expense" && tx.categoryId) {
      categoryExpenses.set(tx.categoryId, (categoryExpenses.get(tx.categoryId) ?? 0) + tx.amount);
    }
  }

  const topExpenseCategories = Array.from(categoryExpenses.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([catId, amt]) => ({
      categoryId: catId,
      categoryName: catId, // 简化，实际应 join categories 表
      amount: amt,
      proportion: expense > 0 ? (amt / expense) * 100 : 0,
    }));

  return {
    currentMonth,
    monthlyAverage,
    last6Months,
    topExpenseCategories,
  };
}
