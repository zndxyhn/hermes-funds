/**
 * GET /api/reports/overview
 */
import { NextRequest, NextResponse } from "next/server";
import { getAccountOverview } from "@/lib/services/report.service";

const DEFAULT_USER_ID = "user_default";

export async function GET(req: NextRequest) {
  try {
    const data = await getAccountOverview(DEFAULT_USER_ID);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}
