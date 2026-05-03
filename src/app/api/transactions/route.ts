/**
 * Transaction API Routes
 * GET  /api/transactions          — 交易列表（分页+筛选）
 * POST /api/transactions          — 创建交易（支出/收入/转账）
 */
import { NextRequest, NextResponse } from "next/server";
import {
  createExpense,
  createIncome,
  createTransfer,
  listTransactions,
} from "@/lib/services/transaction.service";

const DEFAULT_USER_ID = "user_default";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20");
    const type = searchParams.get("type") as any;
    const categoryId = searchParams.get("categoryId") ?? undefined;
    const accountId = searchParams.get("accountId") ?? undefined;
    const startDate = searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : undefined;
    const endDate = searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : undefined;

    const result = await listTransactions(DEFAULT_USER_ID, {
      type: type ?? undefined,
      categoryId,
      accountId,
      startDate,
      endDate,
      page,
      pageSize,
    });

    return NextResponse.json({ success: true, data: result });
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

    if (!body.type || !body.amount || !body.accountId) {
      return NextResponse.json(
        { success: false, error: { message: "type, amount, accountId 为必填项" } },
        { status: 400 }
      );
    }

    if (!["expense", "income", "transfer"].includes(body.type)) {
      return NextResponse.json(
        { success: false, error: { message: "type 必须是 expense/income/transfer" } },
        { status: 400 }
      );
    }

    if (body.type === "transfer") {
      if (!body.toAccountId) {
        return NextResponse.json(
          { success: false, error: { message: "转账需要 toAccountId" } },
          { status: 400 }
        );
      }
      const result = await createTransfer({
        userId: DEFAULT_USER_ID,
        fromAccountId: body.accountId,
        toAccountId: body.toAccountId,
        amount: body.amount,
        description: body.description,
        date: body.date ? new Date(body.date) : undefined,
        source: body.source ?? "form",
      });
      return NextResponse.json({
        success: true,
        data: {
          id: result.transaction.id,
          type: "transfer",
          amount: body.amount,
          fromBalanceAfter: result.fromBalanceAfter,
          toBalanceAfter: result.toBalanceAfter,
        },
      }, { status: 201 });
    }

    if (!body.categoryId) {
      return NextResponse.json(
        { success: false, error: { message: "expense/income 需要 categoryId" } },
        { status: 400 }
      );
    }

    if (body.type === "expense") {
      const result = await createExpense({
        userId: DEFAULT_USER_ID,
        accountId: body.accountId,
        categoryId: body.categoryId,
        amount: body.amount,
        description: body.description,
        notes: body.notes,
        date: body.date ? new Date(body.date) : undefined,
        tags: body.tags,
        source: body.source ?? "form",
      });
      return NextResponse.json({
        success: true,
        data: {
          id: result.transaction.id,
          type: "expense",
          amount: body.amount,
          categoryId: body.categoryId,
          accountId: body.accountId,
          balanceAfter: result.balanceAfter,
        },
      }, { status: 201 });
    }

    if (body.type === "income") {
      const result = await createIncome({
        userId: DEFAULT_USER_ID,
        accountId: body.accountId,
        categoryId: body.categoryId,
        amount: body.amount,
        description: body.description,
        notes: body.notes,
        date: body.date ? new Date(body.date) : undefined,
        tags: body.tags,
        source: body.source ?? "form",
      });
      return NextResponse.json({
        success: true,
        data: {
          id: result.transaction.id,
          type: "income",
          amount: body.amount,
          categoryId: body.categoryId,
          accountId: body.accountId,
          balanceAfter: result.balanceAfter,
        },
      }, { status: 201 });
    }

    return NextResponse.json(
      { success: false, error: { message: "未知交易类型" } },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}
