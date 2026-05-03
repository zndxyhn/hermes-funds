/**
 * Category API Routes — 单个分类操作
 * GET    /api/categories/[id]
 * PUT    /api/categories/[id]
 * DELETE /api/categories/[id]
 */
import { NextRequest, NextResponse } from "next/server";
import { getCategoryById, updateCategory, deleteCategory } from "@/lib/services/category.service";

const DEFAULT_USER_ID = "user_default";
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const cat = await getCategoryById(id, DEFAULT_USER_ID);
    if (!cat) return NextResponse.json({ success: false, error: { message: "分类不存在" } }, { status: 404 });
    return NextResponse.json({ success: true, data: cat });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: 400 });
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const cat = await updateCategory(id, DEFAULT_USER_ID, {
      name: body.name,
      icon: body.icon,
      color: body.color,
      sortOrder: body.sortOrder,
    });
    return NextResponse.json({ success: true, data: cat });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    await deleteCategory(id, DEFAULT_USER_ID);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: 400 });
  }
}
