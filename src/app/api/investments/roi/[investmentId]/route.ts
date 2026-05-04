/**
 * Single Investment ROI API
 * GET /api/investments/roi/[investmentId] — 单个投资收益详情
 */
import { NextRequest, NextResponse } from "next/server";
import { calculateInvestmentROI } from "@/lib/services/roi.service";

const DEFAULT_USER_ID = "user_default";

type RouteParams = { params: Promise<{ investmentId: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { investmentId } = await params;
    const roi = await calculateInvestmentROI(investmentId, DEFAULT_USER_ID);

    if (!roi) {
      return NextResponse.json(
        { success: false, error: { message: "投资不存在" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: roi });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}
