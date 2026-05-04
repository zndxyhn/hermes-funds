/**
 * Net Worth Report API
 * GET /api/reports/net-worth — 当前净资产报表
 * GET /api/reports/net-worth/history — 净资产历史走势
 */
import { NextRequest, NextResponse } from "next/server";
import { calculateNetWorth, getNetWorthHistory } from "@/lib/services/networth.service";

const DEFAULT_USER_ID = "user_default";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const history = searchParams.get("history");
    const months = parseInt(searchParams.get("months") ?? "12", 10);

    if (history !== null) {
      // 净资产历史走势
      const data = await getNetWorthHistory(DEFAULT_USER_ID, months);
      return NextResponse.json({ success: true, data });
    }

    // 当前净资产
    const data = await calculateNetWorth(DEFAULT_USER_ID);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}
