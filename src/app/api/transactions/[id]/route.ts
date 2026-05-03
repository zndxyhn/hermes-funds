/**
 * Transaction API Routes — 单个交易操作
 * GET    /api/transactions/[id]
 * DELETE /api/transactions/[id]
 */
import { NextRequest, NextResponse } from "next/server";
import { getTransactionById, deleteTransaction } from "@/lib/services/transaction.service";

const DEFAULT_USER_ID = "user_default";
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const tx = await getTransactionById(id, DEFAULT_USER_ID);
    if (!tx) return NextResponse.json({ success: false, error: { message: "交易记录不存在" } }, { status: 404 });
    return NextResponse.json({ success: true, data: tx });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    await deleteTransaction(id, DEFAULT_USER_ID);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: 400 });
  }
}
