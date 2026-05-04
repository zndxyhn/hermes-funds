/**
 * Cash Flow Report API
 * GET /api/reports/cash-flow — 现金流报表
 * Query: year, month (可选，默认当前月)
 */
import { NextRequest, NextResponse } from "next/server";
import { calculateCashFlow } from "@/lib/services/cashflow.service";

const DEFAULT_USER_ID = "user_default";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year") ? parseInt(searchParams.get("year")!, 10) : undefined;
    const month = searchParams.get("month") ? parseInt(searchParams.get("month")!, 10) : undefined;

    const data = await calculateCashFlow(DEFAULT_USER_ID, year, month);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}
