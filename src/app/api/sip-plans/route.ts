/**
 * SIP Plans API Routes
 * GET  /api/sip-plans          — 定投计划列表
 * POST /api/sip-plans          — 创建定投计划
 */
import { NextRequest, NextResponse } from "next/server";
import {
  createSipPlan,
  listSipPlans,
} from "@/lib/services/investment.service";

const DEFAULT_USER_ID = "user_default";

export async function GET() {
  try {
    const plans = await listSipPlans(DEFAULT_USER_ID);
    return NextResponse.json({
      success: true,
      data: plans,
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

    if (!body.investmentId || !body.accountId || body.amount === undefined || !body.frequency || !body.nextRunDate) {
      return NextResponse.json(
        { success: false, error: { message: "investmentId, accountId, amount, frequency, nextRunDate 为必填项" } },
        { status: 400 }
      );
    }

    const plan = await createSipPlan({
      userId: DEFAULT_USER_ID,
      investmentId: body.investmentId,
      accountId: body.accountId,
      amount: body.amount,
      frequency: body.frequency,
      nextRunDate: body.nextRunDate,
    });

    return NextResponse.json({ success: true, data: plan }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}
