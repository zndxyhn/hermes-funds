/**
 * GET /api/reports/monthly-summary?year=2025&month=5
 */
import { NextRequest, NextResponse } from "next/server";
import { getMonthlySummary } from "@/lib/services/report.service";

const DEFAULT_USER_ID = "user_default";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const now = new Date();
    const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()));
    const month = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1));

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { success: false, error: { message: "year 和 month 参数无效" } },
        { status: 400 }
      );
    }

    const data = await getMonthlySummary(year, month, DEFAULT_USER_ID);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}
