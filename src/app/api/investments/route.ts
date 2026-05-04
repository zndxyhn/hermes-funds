/**
 * Investments API Routes
 * GET  /api/investments          — 持仓列表
 * POST /api/investments          — 添加持仓
 */
import { NextRequest, NextResponse } from "next/server";
import {
  createInvestment,
  listInvestments,
  updatePrice,
} from "@/lib/services/investment.service";

const DEFAULT_USER_ID = "user_default";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") as any;
    const sortBy = searchParams.get("sortBy") as any;

    const investments = await listInvestments(DEFAULT_USER_ID, {
      type: type ?? undefined,
      sortBy: sortBy ?? "createdAt",
    });

    return NextResponse.json({
      success: true,
      data: investments,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.name || !body.type) {
      return NextResponse.json(
        { success: false, error: { message: "name 和 type 为必填项" } },
        { status: 400 }
      );
    }

    const investment = await createInvestment({
      userId: DEFAULT_USER_ID,
      name: body.name,
      type: body.type,
      ticker: body.ticker,
      totalUnits: body.totalUnits ?? 0,
      totalCost: body.totalCost ?? 0,
      avgCost: body.avgCost,
      currentNav: body.currentNav,
      currentPrice: body.currentPrice,
      notes: body.notes,
    });

    return NextResponse.json({ success: true, data: investment }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}
