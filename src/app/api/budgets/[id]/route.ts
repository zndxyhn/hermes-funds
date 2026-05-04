/**
 * Budgets API Routes — 单个预算操作
 * GET    /api/budgets/[id]  — 获取预算（含进度）
 * PUT    /api/budgets/[id]  — 更新预算
 * DELETE /api/budgets/[id]  — 删除预算
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getBudgetById,
  getBudgetProgress,
  updateBudget,
  deleteBudget,
} from "@/lib/services/budget.service";

const DEFAULT_USER_ID = "user_default";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const withProgress = searchParams.get("progress") !== "false";

    const budget = await getBudgetById(id, DEFAULT_USER_ID);
    if (!budget) {
      return NextResponse.json(
        { success: false, error: { message: "预算不存在" } },
        { status: 404 }
      );
    }

    if (withProgress) {
      const progress = await getBudgetProgress(id, DEFAULT_USER_ID);
      return NextResponse.json({ success: true, data: progress });
    }

    return NextResponse.json({ success: true, data: budget });
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

    const budget = await updateBudget(id, DEFAULT_USER_ID, {
      categoryId: body.categoryId,
      amount: body.amount,
      period: body.period,
      startDate: body.startDate,
    });

    return NextResponse.json({ success: true, data: budget });
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
    await deleteBudget(id, DEFAULT_USER_ID);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}
