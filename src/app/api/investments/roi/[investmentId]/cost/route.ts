/**
 * Cost Analysis API
 * GET /api/investments/roi/[investmentId]/cost — 成本分析
 */
import { NextRequest, NextResponse } from "next/server";
import { calculateCostAnalysis } from "@/lib/services/roi.service";

const DEFAULT_USER_ID = "user_default";

type RouteParams = { params: Promise<{ investmentId: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { investmentId } = await params;
    const analysis = await calculateCostAnalysis(investmentId, DEFAULT_USER_ID);

    if (!analysis) {
      return NextResponse.json(
        { success: false, error: { message: "投资不存在" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: analysis });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}
