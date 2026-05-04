/**
 * Budgets API Routes
 * GET  /api/budgets          — 预算列表（含进度）
 * POST /api/budgets          — 创建预算
 */
import { NextRequest, NextResponse } from "next/server";
import {
  createBudget,
  listBudgets,
  listBudgetsWithProgress,
} from "@/lib/services/budget.service";

const DEFAULT_USER_ID = "user_default";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") as any;
    const withProgress = searchParams.get("progress") !== "false";

    if (withProgress) {
      const budgetsWithProgress = await listBudgetsWithProgress(DEFAULT_USER_ID);
      return NextResponse.json({ success: true, data: budgetsWithProgress });
    }

    // 旧接口：直接返回预算列表
    const budgets = await listBudgets(DEFAULT_USER_ID, { period: period ?? undefined });
    return NextResponse.json({ success: true, data: budgets });
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

    if (!body.amount) {
      return NextResponse.json(
        { success: false, error: { message: "amount 为必填项" } },
        { status: 400 }
      );
    }

    const budget = await createBudget({
      userId: DEFAULT_USER_ID,
      categoryId: body.categoryId ?? undefined,
      amount: body.amount,
      period: body.period ?? "monthly",
      startDate: body.startDate,
    });

    return NextResponse.json({ success: true, data: budget }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}
