import { NextResponse } from "next/server";
import { getMessagesKeyset } from "@/lib/chatStorage";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || searchParams.get("userEmail");
    const cursorTimestamp = searchParams.get("cursorTimestamp") || undefined;
    const cursorId = searchParams.get("cursorId") || undefined;
    const limit = parseInt(searchParams.get("limit") || "25", 10);

    if (!userId) {
      return NextResponse.json({ error: "Missing required userId parameter" }, { status: 400 });
    }

    const result = await getMessagesKeyset(id, userId, cursorTimestamp, cursorId, limit);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("GET /api/conversations/[id]/messages error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load messages" },
      { status: error.message?.includes("Unauthorized") ? 403 : 500 }
    );
  }
}
