/**
 * Portfolio ROI API
 * GET /api/investments/roi — 用户所有投资的收益率汇总
 */
import { NextRequest, NextResponse } from "next/server";
import { calculatePortfolioROI } from "@/lib/services/roi.service";

const DEFAULT_USER_ID = "user_default";

export async function GET(_req: NextRequest) {
  try {
    const roi = await calculatePortfolioROI(DEFAULT_USER_ID);
    return NextResponse.json({ success: true, data: roi });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}
