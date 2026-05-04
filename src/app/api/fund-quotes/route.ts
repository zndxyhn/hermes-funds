/**
 * Fund Quotes API
 * GET /api/fund-quotes?ticker=000001           — 获取单个基金行情
 * GET /api/fund-quotes?tickers=000001,000002   — 批量获取
 * POST /api/fund-quotes/refresh                — 刷新缓存
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getFundQuote,
  refreshFundCache,
  listCachedFunds,
} from "@/lib/services/fund-cache.service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = searchParams.get("ticker");
    const tickers = searchParams.get("tickers");
    const refresh = searchParams.get("refresh") === "true";
    const force = searchParams.get("force") === "true";

    // 列出所有缓存基金
    if (searchParams.get("list") === "true") {
      const funds = await listCachedFunds();
      return NextResponse.json({ success: true, data: funds });
    }

    // 批量获取
    if (tickers) {
      const tickerList = tickers.split(",").map((t) => t.trim());
      const results: Record<string, any> = {};

      await Promise.all(
        tickerList.map(async (t) => {
          const quote = await getFundQuote(t, force);
          results[t] = quote;
        })
      );

      return NextResponse.json({ success: true, data: results });
    }

    // 单个获取
    if (ticker) {
      const quote = await getFundQuote(ticker, force || refresh);
      if (!quote) {
        return NextResponse.json(
          { success: false, error: { message: "无法获取基金行情" } },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: quote });
    }

    return NextResponse.json(
      { success: false, error: { message: "请提供 ticker 参数" } },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const ticker = body.ticker;
    const tickers = body.tickers;

    if (!ticker && !tickers) {
      return NextResponse.json(
        { success: false, error: { message: "ticker 或 tickers 参数必填" } },
        { status: 400 }
      );
    }

    if (ticker) {
      const result = await refreshFundCache(ticker);
      if (!result) {
        return NextResponse.json(
          { success: false, error: { message: "无法获取基金行情，请检查基金代码是否正确" } },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: result });
    }

    // 批量刷新
    const tickerList = Array.isArray(tickers) ? tickers : [tickers];
    const results = await Promise.all(
      tickerList.map(async (t: string) => {
        const result = await refreshFundCache(t);
        return { ticker: t, success: !!result };
      })
    );

    return NextResponse.json({ success: true, data: results });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}
