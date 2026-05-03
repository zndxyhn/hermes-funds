/**
 * Account API Routes — 单个账户操作
 * GET    /api/accounts/[id]  — 获取账户
 * PUT    /api/accounts/[id]  — 更新账户
 * DELETE /api/accounts/[id]  — 删除账户
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getAccountById,
  updateAccount,
  deleteAccount,
} from "@/lib/services/account.service";

const DEFAULT_USER_ID = "user_default";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const account = await getAccountById(id, DEFAULT_USER_ID);

    if (!account) {
      return NextResponse.json(
        { success: false, error: { message: "账户不存在" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: account });
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

    const account = await updateAccount(id, DEFAULT_USER_ID, {
      name: body.name,
      type: body.type,
      balance: body.balance,
      currency: body.currency,
      icon: body.icon,
      color: body.color,
      sortOrder: body.sortOrder,
      isDefault: body.isDefault,
    });

    return NextResponse.json({ success: true, data: account });
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
    await deleteAccount(id, DEFAULT_USER_ID);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}
