/**
 * 单个周期账单 API Routes
 * GET    /api/recurring-bills/[id]
 * PUT    /api/recurring-bills/[id]
 * DELETE /api/recurring-bills/[id]
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getRecurringBill,
  updateRecurringBill,
  deleteRecurringBill,
  generateBillTransactions,
} from "@/lib/services/recurring-bill.service";

const DEFAULT_USER_ID = "user_default";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const bill = await getRecurringBill(id, DEFAULT_USER_ID);

    if (!bill) {
      return NextResponse.json(
        { success: false, error: { message: "账单不存在" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: bill });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();
    const bill = await updateRecurringBill(id, DEFAULT_USER_ID, body);

    return NextResponse.json({ success: true, data: bill });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await deleteRecurringBill(id, DEFAULT_USER_ID);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}

// POST /api/recurring-bills/[id]/generate — 手动生成交易
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const txCount = await generateBillTransactions(id, DEFAULT_USER_ID, body.accountId);

    return NextResponse.json({ success: true, data: { transactionsCreated: txCount } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}
