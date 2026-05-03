/**
 * Report Service — 报表业务逻辑层
 * 职责：月度收支汇总、趋势图数据
 */
import { getDb } from "../db";
import { transactions, categories, accounts } from "../db/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

const DEFAULT_USER_ID = "user_default";

// ─────────────────────────────────────────────
// 工具函数：获取月份的时间范围（Unix timestamp）
// ─────────────────────────────────────────────
function getMonthRange(year: number, month: number): { start: number; end: number } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59); // 该月最后一天
  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000),
  };
}

// ─────────────────────────────────────────────
// 月度收支汇总
// ─────────────────────────────────────────────
export async function getMonthlySummary(year: number, month: number, userId: string = DEFAULT_USER_ID) {
  const db = getDb();
  const { start, end } = getMonthRange(year, month);

  // 按类型统计
  const statsByType = db
    .select({
      type: transactions.type,
      total: sql<number>`SUM(${transactions.amount})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      gte(transactions.date, start),
      lte(transactions.date, end)
    ))
    .groupBy(transactions.type)
    .all();

  const income = statsByType.find((s) => s.type === "income");
  const expense = statsByType.find((s) => s.type === "expense");

  const incomeTotal = income?.total ?? 0;
  const expenseTotal = expense?.total ?? 0;
  const balance = incomeTotal - expenseTotal;

  // 按分类明细
  const categoryBreakdown = db
    .select({
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      type: transactions.type,
      total: sql<number>`SUM(${transactions.amount})`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(and(
      eq(transactions.userId, userId),
      gte(transactions.date, start),
      lte(transactions.date, end),
      // 只统计收支，不统计转账/投资
      sql`${transactions.type} IN ('income', 'expense')`
    ))
    .groupBy(transactions.categoryId)
    .orderBy(desc(sql`SUM(${transactions.amount})`))
    .all();

  // 按日汇总
  const daily = db
    .select({
      date: sql<number>`date / 86400 * 86400`,
      income: sql<number>`SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE 0 END)`,
      expense: sql<number>`SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE 0 END)`,
    })
    .from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      gte(transactions.date, start),
      lte(transactions.date, end),
      sql`${transactions.type} IN ('income', 'expense')`
    ))
    .groupBy(sql`date / 86400`)
    .orderBy(sql`date / 86400`)
    .all();

  return {
    year,
    month,
    income: { total: incomeTotal, count: income?.count ?? 0 },
    expense: { total: expenseTotal, count: expense?.count ?? 0 },
    balance,
    categoryBreakdown: categoryBreakdown.map((c) => ({
      categoryId: c.categoryId,
      categoryName: c.categoryName ?? "未知",
      categoryIcon: c.categoryIcon ?? "📦",
      type: c.type,
      amount: c.total,
    })),
    daily: daily.map((d) => ({
      date: new Date(d.date * 1000).toISOString().split("T")[0],
      income: d.income,
      expense: d.expense,
    })),
  };
}

// ─────────────────────────────────────────────
// 收支趋势（最近 N 个月）
// ─────────────────────────────────────────────
export async function getTrend(
  months: number = 6,
  userId: string = DEFAULT_USER_ID
) {
  const db = getDb();
  const now = new Date();
  const labels: string[] = [];
  const incomeData: number[] = [];
  const expenseData: number[] = [];
  const savings: number[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const label = `${m}月`;
    labels.push(label);

    const summary = await getMonthlySummary(y, m, userId);
    incomeData.push(summary.income.total);
    expenseData.push(summary.expense.total);
    savings.push(summary.balance);
  }

  return { labels, income: incomeData, expense: expenseData, savings };
}

// ─────────────────────────────────────────────
// 账户概览（所有账户余额汇总）
// ─────────────────────────────────────────────
export async function getAccountOverview(userId: string = DEFAULT_USER_ID) {
  const db = getDb();

  const accountsList = await db.select().from(accounts).where(eq(accounts.userId, userId)).all();

  const totalBalance = accountsList.reduce((sum, acc) => sum + (acc.balance ?? 0), 0);

  const byType: Record<string, number> = {};
  for (const acc of accountsList) {
    byType[acc.type] = (byType[acc.type] ?? 0) + (acc.balance ?? 0);
  }

  return {
    totalBalance,
    byType,
    accounts: accountsList.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      balance: a.balance,
      icon: a.icon,
    })),
  };
}
