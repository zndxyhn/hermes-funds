/**
 * Fund Cache API Routes
 * GET  /api/fund-cache          — 获取缓存的基金净值列表
 * GET  /api/fund-cache/[ticker] — 获取单个基金净值
 * POST /api/fund-cache          — 更新基金净值缓存
 */
import { NextRequest, NextResponse } from "next/server";
import {
  upsertFundCache,
  getFundCache,
  listFundCache,
} from "@/lib/services/investment.service";

const DEFAULT_USER_ID = "user_default";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = searchParams.get("ticker");

    if (ticker) {
      const cache = await getFundCache(ticker);
      if (!cache) {
        return NextResponse.json(
          { success: false, error: { message: "基金不存在" } },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: cache });
    }

    const funds = await listFundCache();
    return NextResponse.json({ success: true, data: funds });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.ticker) {
      return NextResponse.json(
        { success: false, error: { message: "ticker 为必填项" } },
        { status: 400 }
      );
    }

    const cache = await upsertFundCache({
      ticker: body.ticker,
      name: body.name,
      nav: body.nav,
      navDate: body.navDate,
      estNav: body.estNav,
      estNavTime: body.estNavTime,
      dayChange: body.dayChange,
    });

    return NextResponse.json({ success: true, data: cache }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}
