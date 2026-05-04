/**
 * NLU 解析 API
 * POST /api/nlu/parse — 自然语言解析
 *
 * Body: { text: string }
 * Returns: { success, data: { intent, amount, date, category, canConfirm, missingSlots, confidence } }
 */
import { NextRequest, NextResponse } from "next/server";
import { parse } from "@/lib/services/nlu-engine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { success: false, error: { message: "text 为必填项，类型为字符串" } },
        { status: 400 }
      );
    }

    if (text.length > 500) {
      return NextResponse.json(
        { success: false, error: { message: "text 不能超过 500 字符" } },
        { status: 400 }
      );
    }

    const result = parse(text);

    // 规范化返回结构
    const response = {
      intent: result.intent,
      intentConfidence: result.intentConfidence,
      amount: result.amount ?? null,
      date: result.date ?? null,
      category: result.category ?? null,
      account: result.accountHint ?? null,
      investment: null,
      canConfirm: result.canConfirm,
      missingSlots: result.missingSlots,
      response: null,
      originalText: text,
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}
