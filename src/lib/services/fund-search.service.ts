/**
 * Fund Search Service — 基金筛选与搜索
 * 职责：按名称/代码搜索基金、按类型/规模/评级筛选
 */
import { getDb } from "../db";
import { investments } from "../db/schema";
import { eq, like, or, and, desc } from "drizzle-orm";

export type FundType = "fund" | "stock" | "etf" | "gold" | "bond" | "mmf" | "cb" | "reits" | "private" | "other";

export interface FundSearchResult {
  investmentId: string;
  name: string;
  ticker: string;
  type: FundType;
  currentValue: number;
  profit: number;
  profitRate: number;
  lastNavUpdate: number | null;
}

export interface FundSearchFilters {
  query?: string; // 名称或代码模糊搜索
  type?: FundType; // 基金类型
  minValue?: number; // 最小市值
  maxValue?: number; // 最大市值
  minProfitRate?: number; // 最小收益率
  maxProfitRate?: number; // 最大收益率
  sortBy?: "name" | "currentValue" | "profitRate" | "profit" | "ticker";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface FundSearchResponse {
  results: FundSearchResult[];
  total: number;
  filters: FundSearchFilters;
}

/**
 * 搜索基金（名称/代码模糊匹配）
 */
export async function searchFunds(
  userId: string,
  filters: FundSearchFilters
): Promise<FundSearchResponse> {
  const db = getDb();

  const {
    query,
    type,
    minValue,
    maxValue,
    minProfitRate,
    maxProfitRate,
    sortBy = "name",
    sortOrder = "asc",
    limit = 50,
    offset = 0,
  } = filters;

  // 构建查询条件
  const conditions = [eq(investments.userId, userId)];

  if (type) {
    conditions.push(eq(investments.type, type));
  }

  if (query) {
    // 模糊搜索：匹配名称或代码
    const q = `%${query}%`;
    conditions.push(
      or(
        like(investments.name, q),
        like(investments.ticker, q)
      )!
    );
  }

  // 后置过滤（SQLite 不支持数值范围 in WHERE，用 JS 过滤）
  let allResults = await db
    .select()
    .from(investments)
    .where(and(...conditions))
    .all();

  // 后置过滤（SQLite 不支持数值范围 in WHERE，用 JS 过滤）
  if (minValue !== undefined) {
    allResults = allResults.filter((r) => (r.currentValue ?? 0) >= minValue);
  }
  if (maxValue !== undefined) {
    allResults = allResults.filter((r) => (r.currentValue ?? 0) <= maxValue);
  }
  if (minProfitRate !== undefined) {
    allResults = allResults.filter((r) => (r.profitRate ?? 0) >= minProfitRate);
  }
  if (maxProfitRate !== undefined) {
    allResults = allResults.filter((r) => (r.profitRate ?? 0) <= maxProfitRate);
  }

  // 排序
  allResults.sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case "name":
        cmp = (a.name ?? "").localeCompare(b.name ?? "");
        break;
      case "ticker":
        cmp = (a.ticker ?? "").localeCompare(b.ticker ?? "");
        break;
      case "currentValue":
        cmp = (a.currentValue ?? 0) - (b.currentValue ?? 0);
        break;
      case "profitRate":
        cmp = (a.profitRate ?? 0) - (b.profitRate ?? 0);
        break;
      case "profit":
        cmp = (a.profit ?? 0) - (b.profit ?? 0);
        break;
    }
    return sortOrder === "desc" ? -cmp : cmp;
  });

  const total = allResults.length;
  const paginatedResults = allResults.slice(offset, offset + limit);

  return {
    results: paginatedResults.map((r) => ({
      investmentId: r.id,
      name: r.name,
      ticker: r.ticker ?? "",
      type: r.type as FundType,
      currentValue: r.currentValue ?? 0,
      profit: r.profit ?? 0,
      profitRate: r.profitRate ?? 0,
      lastNavUpdate: r.lastNavUpdate ?? null,
    })),
    total,
    filters,
  };
}

/**
 * 按类型统计基金数量和总市值
 */
export async function getFundTypeStats(userId: string): Promise<{
  type: FundType;
  count: number;
  totalValue: number;
  totalProfit: number;
}[]> {
  const db = getDb();

  const results = await db
    .select()
    .from(investments)
    .where(eq(investments.userId, userId))
    .all();

  // 聚合统计
  const statsMap = new Map<string, { count: number; totalValue: number; totalProfit: number }>();

  for (const r of results) {
    const t = r.type;
    const existing = statsMap.get(t) ?? { count: 0, totalValue: 0, totalProfit: 0 };
    existing.count++;
    existing.totalValue += r.currentValue ?? 0;
    existing.totalProfit += r.profit ?? 0;
    statsMap.set(t, existing);
  }

  return Array.from(statsMap.entries()).map(([type, stats]) => ({
    type: type as FundType,
    ...stats,
  }));
}

/**
 * 基金代码精确查询（验证代码是否有效）
 */
export async function validateFundTicker(ticker: string): Promise<boolean> {
  // 基金代码：6位数字
  // 股票代码：6位数字（上海/深圳）
  // ETF：6位数字
  return /^\d{6}$/.test(ticker);
}
