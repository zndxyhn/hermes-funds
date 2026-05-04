/**
 * Investments API Routes — 单个持仓操作
 * GET    /api/investments/[id]  — 获取持仓
 * PUT    /api/investments/[id]  — 更新持仓
 * DELETE /api/investments/[id]  — 删除持仓
 * POST   /api/investments/[id]/price — 更新行情
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getInvestmentById,
  updateInvestment,
  deleteInvestment,
  updatePrice,
} from "@/lib/services/investment.service";

const DEFAULT_USER_ID = "user_default";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const investment = await getInvestmentById(id, DEFAULT_USER_ID);

    if (!investment) {
      return NextResponse.json(
        { success: false, error: { message: "持仓不存在" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: investment });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const investment = await updateInvestment(id, DEFAULT_USER_ID, {
      name: body.name,
      type: body.type,
      ticker: body.ticker,
      totalUnits: body.totalUnits,
      totalCost: body.totalCost,
      avgCost: body.avgCost,
      currentNav: body.currentNav,
      currentPrice: body.currentPrice,
      currentValue: body.currentValue,
      profit: body.profit,
      profitRate: body.profitRate,
      notes: body.notes,
    });

    return NextResponse.json({ success: true, data: investment });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    await deleteInvestment(id, DEFAULT_USER_ID);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}
