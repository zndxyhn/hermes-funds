/**
 * Investment Transactions API Routes
 * GET  /api/investment-transactions          — 交易明细列表
 * POST /api/investment-transactions          — 记录交易（买/卖/分红/拆分）
 */
import { NextRequest, NextResponse } from "next/server";
import {
  createInvestmentTransaction,
  listInvestmentTransactions,
} from "@/lib/services/investment.service";

const DEFAULT_USER_ID = "user_default";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const investmentId = searchParams.get("investmentId") ?? undefined;
    const type = searchParams.get("type") as any;

    const transactions = await listInvestmentTransactions(DEFAULT_USER_ID, investmentId, {
      type: type ?? undefined,
    });

    return NextResponse.json({
      success: true,
      data: transactions,
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

    if (!body.investmentId || !body.accountId || !body.type || body.amount === undefined || body.units === undefined || body.navPrice === undefined) {
      return NextResponse.json(
        { success: false, error: { message: "investmentId, accountId, type, amount, units, navPrice 为必填项" } },
        { status: 400 }
      );
    }

    const transaction = await createInvestmentTransaction({
      userId: DEFAULT_USER_ID,
      investmentId: body.investmentId,
      accountId: body.accountId,
      type: body.type,
      amount: body.amount,
      units: body.units,
      navPrice: body.navPrice,
      date: body.date ?? Math.floor(Date.now() / 1000),
      notes: body.notes,
      source: body.source ?? "form",
    });

    return NextResponse.json({ success: true, data: transaction }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}
