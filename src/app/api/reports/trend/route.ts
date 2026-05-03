/**
 * GET /api/reports/trend?months=6
 */
import { NextRequest, NextResponse } from "next/server";
import { getTrend } from "@/lib/services/report.service";

const DEFAULT_USER_ID = "user_default";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const months = parseInt(searchParams.get("months") ?? "6");
    const data = await getTrend(months, DEFAULT_USER_ID);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}
