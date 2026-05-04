/**
 * Fund Type Stats API
 * GET /api/investments/search/stats — 按类型统计基金数量和市值
 */
import { NextResponse } from "next/server";
import { getFundTypeStats } from "@/lib/services/fund-search.service";

const DEFAULT_USER_ID = "user_default";

export async function GET() {
  try {
    const stats = await getFundTypeStats(DEFAULT_USER_ID);
    return NextResponse.json({ success: true, data: stats });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}
