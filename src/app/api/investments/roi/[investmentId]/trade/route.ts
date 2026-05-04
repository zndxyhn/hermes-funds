/**
 * Trade Summary API
 * GET /api/investments/roi/[investmentId]/trade — 交易汇总
 */
import { NextRequest, NextResponse } from "next/server";
import { calculateTradeSummary } from "@/lib/services/roi.service";

const DEFAULT_USER_ID = "user_default";

type RouteParams = { params: Promise<{ investmentId: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { investmentId } = await params;
    const summary = await calculateTradeSummary(investmentId, DEFAULT_USER_ID);

    if (!summary) {
      return NextResponse.json(
        { success: false, error: { message: "投资不存在" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: summary });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}
