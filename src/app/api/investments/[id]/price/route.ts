/**
 * Investment Price API Route
 * POST /api/investments/[id]/price — 更新行情价格
 */
import { NextRequest, NextResponse } from "next/server";
import { getInvestmentById, updatePrice } from "@/lib/services/investment.service";

const DEFAULT_USER_ID = "user_default";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    if (body.navOrPrice === undefined) {
      return NextResponse.json(
        { success: false, error: { message: "navOrPrice 为必填项" } },
        { status: 400 }
      );
    }

    const investment = await getInvestmentById(id, DEFAULT_USER_ID);
    if (!investment) {
      return NextResponse.json(
        { success: false, error: { message: "持仓不存在" } },
        { status: 404 }
      );
    }

    const updated = await updatePrice(id, DEFAULT_USER_ID, body.navOrPrice);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}
