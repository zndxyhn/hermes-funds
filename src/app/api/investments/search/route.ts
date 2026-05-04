/**
 * Fund Search API
 * GET /api/investments/search — 基金筛选与搜索
 * Query params:
 *   q       — 名称/代码模糊搜索
 *   type    — 基金类型 (fund/stock/etf/gold/bond/mmf/cb/reits/private/other)
 *   minValue, maxValue — 市值范围
 *   minProfitRate, maxProfitRate — 收益率范围
 *   sortBy  — name | currentValue | profitRate | profit | ticker (default: name)
 *   order    — asc | desc (default: asc)
 *   limit    — 每页数量 (default: 50)
 *   offset   — 偏移量 (default: 0)
 */
import { NextRequest, NextResponse } from "next/server";
import { searchFunds, type FundType } from "@/lib/services/fund-search.service";

const DEFAULT_USER_ID = "user_default";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // 搜索
    const filters = {
      query: searchParams.get("q") ?? undefined,
      type: (searchParams.get("type") as FundType) ?? undefined,
      minValue: searchParams.get("minValue") ? parseFloat(searchParams.get("minValue")!) : undefined,
      maxValue: searchParams.get("maxValue") ? parseFloat(searchParams.get("maxValue")!) : undefined,
      minProfitRate: searchParams.get("minProfitRate") ? parseFloat(searchParams.get("minProfitRate")!) : undefined,
      maxProfitRate: searchParams.get("maxProfitRate") ? parseFloat(searchParams.get("maxProfitRate")!) : undefined,
      sortBy: (searchParams.get("sortBy") as "name" | "currentValue" | "profitRate" | "profit" | "ticker") ?? "name",
      sortOrder: (searchParams.get("order") as "asc" | "desc") ?? "asc",
      limit: parseInt(searchParams.get("limit") ?? "50", 10),
      offset: parseInt(searchParams.get("offset") ?? "0", 10),
    };

    const data = await searchFunds(DEFAULT_USER_ID, filters);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}
