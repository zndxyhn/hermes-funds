/**
 * Account API Routes
 * GET  /api/accounts          — 账户列表
 * POST /api/accounts          — 创建账户
 */
import { NextRequest, NextResponse } from "next/server";
import {
  createAccount,
  listAccounts,
  getAccountById,
  updateAccount,
  deleteAccount,
} from "@/lib/services/account.service";

// 默认用户 ID（后续接入认证后从 session 获取）
const DEFAULT_USER_ID = "user_default";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") as any;

    const accounts = await listAccounts(DEFAULT_USER_ID, {
      type: type ?? undefined,
      sortBy: "sortOrder",
    });

    return NextResponse.json({
      success: true,
      data: accounts,
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

    if (!body.name || !body.type) {
      return NextResponse.json(
        { success: false, error: { message: "name 和 type 为必填项" } },
        { status: 400 }
      );
    }

    const account = await createAccount({
      userId: DEFAULT_USER_ID,
      name: body.name,
      type: body.type,
      balance: body.balance ?? 0,
      currency: body.currency ?? "CNY",
      icon: body.icon,
      color: body.color,
      sortOrder: body.sortOrder,
      isDefault: body.isDefault ?? false,
    });

    return NextResponse.json({ success: true, data: account }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}
