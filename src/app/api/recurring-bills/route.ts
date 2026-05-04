/**
 * Recurring Bills API Routes
 * GET  /api/recurring-bills          — 账单列表
 * POST /api/recurring-bills          — 创建账单
 */
import { NextRequest, NextResponse } from "next/server";
import {
  createRecurringBill,
  listRecurringBills,
  getRecurringBill,
  getDueBillAlerts,
} from "@/lib/services/recurring-bill.service";

const DEFAULT_USER_ID = "user_default";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const enabled = searchParams.get("enabled");
    const alerts = searchParams.get("alerts");
    const daysAhead = parseInt(searchParams.get("daysAhead") ?? "3");

    // 到期预警
    if (alerts === "true") {
      const dueBills = await getDueBillAlerts(DEFAULT_USER_ID, daysAhead);
      return NextResponse.json({ success: true, data: dueBills });
    }

    const bills = await listRecurringBills(DEFAULT_USER_ID, {
      enabled: enabled === "true" ? true : enabled === "false" ? false : undefined,
    });

    return NextResponse.json({ success: true, data: bills });
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

    if (!body.accountId || !body.name || body.amount === undefined || !body.frequency || !body.nextDueDate) {
      return NextResponse.json(
        { success: false, error: { message: "accountId, name, amount, frequency, nextDueDate 为必填项" } },
        { status: 400 }
      );
    }

    const bill = await createRecurringBill({
      userId: DEFAULT_USER_ID,
      accountId: body.accountId,
      categoryId: body.categoryId,
      name: body.name,
      amount: body.amount,
      frequency: body.frequency,
      nextDueDate: body.nextDueDate,
      notes: body.notes,
      enabled: body.enabled ?? true,
    });

    return NextResponse.json({ success: true, data: bill }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}
