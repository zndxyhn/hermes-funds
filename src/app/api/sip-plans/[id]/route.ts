/**
 * SIP Plans API Routes — 单个定投计划操作
 * PUT    /api/sip-plans/[id]  — 更新定投计划
 * DELETE /api/sip-plans/[id]  — 删除定投计划
 */
import { NextRequest, NextResponse } from "next/server";
import {
  updateSipPlan,
  deleteSipPlan,
} from "@/lib/services/investment.service";

const DEFAULT_USER_ID = "user_default";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const plan = await updateSipPlan(id, DEFAULT_USER_ID, {
      amount: body.amount,
      frequency: body.frequency,
      nextRunDate: body.nextRunDate,
      enabled: body.enabled,
    });

    return NextResponse.json({ success: true, data: plan });
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
    await deleteSipPlan(id, DEFAULT_USER_ID);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}
