/**
 * Fund Cache Service — 基金行情缓存
 * 职责：从天天基金网获取基金净值/估算净值，缓存到本地数据库
 * 数据源：东方财富 (Eastmoney) 公开接口
 */
import { getDb } from "../db";
import { fundCache, type FundCache, type NewFundCache } from "../db/schema";
import { eq } from "drizzle-orm";

// 天天基金网 API（公开免费）
const EASTMONEY_FUND_API = "https://fundgz.1234567.com.cn/js";
const FUND_DETAIL_API = "https://fundf10.crealworld.com/F10/FundBase";

interface EastMoneyFundGZ {
  /** 基金代码 */
  fundcode: string;
  /** 基金名称 */
  name: string;
  /** 单位净值 */
  dwjz: string;
  /** 净值日期 */
  jzrq: string;
  /** 估算净值（交易日更新） */
  gsz: string;
  /** 估算时间 */
  gztime: string;
  /** 日涨跌幅 % */
  gszzl: string;
  /** 最新更新时间戳 */
  gztime_ts: number;
}

// ─────────────────────────────────────────────
// 行情数据获取
// ─────────────────────────────────────────────

/**
 * 获取单个基金实时行情（从东方财富）
 * @param ticker 基金代码，如 "000001"
 */
export async function fetchFundQuote(ticker: string): Promise<{
  ticker: string;
  name: string;
  nav: number;
  navDate: string;
  estNav: number;
  estNavTime: string;
  dayChange: number;
} | null> {
  try {
    const url = `${EASTMONEY_FUND_API}/${ticker}.js?rt=1`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://fund.eastmoney.com/",
      },
    });

    if (!response.ok) {
      return null;
    }

    const text = await response.text();
    // 返回格式：jsonpgz({"fundId":"000001",...})
    const jsonMatch = text.match(/jsonpgz\((.+)\)/);
    if (!jsonMatch) return null;

    const data: EastMoneyFundGZ = JSON.parse(jsonMatch[1]);

    if (!data.fundcode) return null;

    return {
      ticker: data.fundcode,
      name: data.name,
      nav: parseFloat(data.dwjz) || 0,
      navDate: data.jzrq,
      estNav: parseFloat(data.gsz) || 0,
      estNavTime: data.gztime,
      dayChange: parseFloat(data.gszzl) || 0,
    };
  } catch (error) {
    console.error(`获取基金行情失败 ${ticker}:`, error);
    return null;
  }
}

/**
 * 批量获取基金行情
 */
export async function fetchFundQuotes(tickers: string[]): Promise<Map<string, Awaited<ReturnType<typeof fetchFundQuote>> extends infer R ? R : never>> {
  const results = new Map();

  // 并发请求，每个 ticker 独立
  const promises = tickers.map(async (ticker) => {
    const quote = await fetchFundQuote(ticker);
    return { ticker, quote };
  });

  const resolved = await Promise.all(promises);
  for (const { ticker, quote } of resolved) {
    if (quote) results.set(ticker, quote);
  }

  return results;
}

// ─────────────────────────────────────────────
// 缓存管理
// ─────────────────────────────────────────────

/**
 * 更新基金缓存（从实时 API 获取并写入数据库）
 */
export async function refreshFundCache(ticker: string): Promise<FundCache | null> {
  const quote = await fetchFundQuote(ticker);
  if (!quote) return null;

  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const cacheData: NewFundCache = {
    ticker: quote.ticker,
    name: quote.name,
    nav: quote.nav,
    navDate: quote.navDate,
    estNav: quote.estNav,
    estNavTime: quote.estNavTime,
    dayChange: quote.dayChange,
    updatedAt: now,
  };

  await db.insert(fundCache).values(cacheData).onConflictDoUpdate({
    target: fundCache.ticker,
    set: cacheData,
  });

  const cached = await db.select().from(fundCache).where(eq(fundCache.ticker, ticker)).get();
  return cached ?? null;
}

/**
 * 批量刷新基金缓存
 */
export async function refreshFundCaches(tickers: string[]): Promise<number> {
  let success = 0;
  for (const ticker of tickers) {
    const result = await refreshFundCache(ticker);
    if (result) success++;
  }
  return success;
}

/**
 * 获取本地缓存的基金行情
 */
export async function getCachedFund(ticker: string): Promise<FundCache | null> {
  const db = getDb();
  return db.select().from(fundCache).where(eq(fundCache.ticker, ticker)).get() ?? null;
}

/**
 * 获取所有缓存的基金
 */
export async function listCachedFunds(): Promise<FundCache[]> {
  const db = getDb();
  return db.select().from(fundCache).all();
}

/**
 * 删除缓存
 */
export async function deleteFundCache(ticker: string): Promise<void> {
  const db = getDb();
  await db.delete(fundCache).where(eq(fundCache.ticker, ticker));
}

/**
 * 检查缓存是否过期（超过 5 分钟视为过期）
 */
export function isCacheExpired(fund: FundCache): boolean {
  if (!fund.updatedAt) return true;
  const now = Math.floor(Date.now() / 1000);
  return now - fund.updatedAt > 5 * 60; // 5 分钟
}

/**
 * 获取基金行情（优先缓存，缓存过期则自动刷新）
 */
export async function getFundQuote(ticker: string, forceRefresh = false): Promise<{
  ticker: string;
  name: string;
  nav: number;
  navDate: string;
  estNav: number;
  estNavTime: string;
  dayChange: number;
  fromCache: boolean;
} | null> {
  // 强制刷新或缓存过期时，先尝试刷新
  if (forceRefresh) {
    const refreshed = await refreshFundCache(ticker);
    if (refreshed) {
      return {
        ticker: refreshed.ticker,
        name: refreshed.name ?? "",
        nav: refreshed.nav ?? 0,
        navDate: refreshed.navDate ?? "",
        estNav: refreshed.estNav ?? 0,
        estNavTime: refreshed.estNavTime ?? "",
        dayChange: refreshed.dayChange ?? 0,
        fromCache: false,
      };
    }
  }

  const cached = await getCachedFund(ticker);
  if (cached && !isCacheExpired(cached)) {
    return {
      ticker: cached.ticker,
      name: cached.name ?? "",
      nav: cached.nav ?? 0,
      navDate: cached.navDate ?? "",
      estNav: cached.estNav ?? 0,
      estNavTime: cached.estNavTime ?? "",
      dayChange: cached.dayChange ?? 0,
      fromCache: true,
    };
  }

  // 缓存过期，尝试刷新
  const refreshed = await refreshFundCache(ticker);
  if (refreshed) {
    return {
      ticker: refreshed.ticker,
      name: refreshed.name ?? "",
      nav: refreshed.nav ?? 0,
      navDate: refreshed.navDate ?? "",
      estNav: refreshed.estNav ?? 0,
      estNavTime: refreshed.estNavTime ?? "",
      dayChange: refreshed.dayChange ?? 0,
      fromCache: false,
    };
  }

  // 无法获取，返回缓存（可能已过期）
  if (cached) {
    return {
      ticker: cached.ticker,
      name: cached.name ?? "",
      nav: cached.nav ?? 0,
      navDate: cached.navDate ?? "",
      estNav: cached.estNav ?? 0,
      estNavTime: cached.estNavTime ?? "",
      dayChange: cached.dayChange ?? 0,
      fromCache: true,
    };
  }

  return null;
}
