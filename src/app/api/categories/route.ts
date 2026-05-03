/**
 * Category API Routes
 * GET  /api/categories         — 分类列表
 * POST /api/categories          — 创建分类
 */
import { NextRequest, NextResponse } from "next/server";
import {
  createCategory,
  listCategories,
  matchCategory,
} from "@/lib/services/category.service";

const DEFAULT_USER_ID = "user_default";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") as any;
    const parentId = searchParams.get("parentId"); // null = 一级分类
    const hint = searchParams.get("hint"); // NLU 分类匹配

    // 分类匹配模式
    if (hint) {
      const result = await matchCategory(DEFAULT_USER_ID, hint, type ?? undefined);
      return NextResponse.json({ success: true, data: result });
    }

    // 普通列表模式
    const cats = await listCategories(DEFAULT_USER_ID, {
      type: type ?? undefined,
      parentId: parentId === "null" ? null : parentId ?? undefined,
    });

    return NextResponse.json({ success: true, data: cats });
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

    if (!["expense", "income", "investment"].includes(body.type)) {
      return NextResponse.json(
        { success: false, error: { message: "type 必须是 expense/income/investment" } },
        { status: 400 }
      );
    }

    const cat = await createCategory({
      userId: DEFAULT_USER_ID,
      name: body.name,
      type: body.type,
      icon: body.icon,
      color: body.color,
      parentId: body.parentId,
      sortOrder: body.sortOrder,
      isSystem: false, // 用户创建的均为非系统分类
    });

    return NextResponse.json({ success: true, data: cat }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}
