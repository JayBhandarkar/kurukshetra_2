import { NextResponse } from "next/server";
import { getConversationsKeyset, createConversation } from "@/lib/chatStorage";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || searchParams.get("userEmail");
    const cursorTimestamp = searchParams.get("cursorTimestamp") || undefined;
    const cursorId = searchParams.get("cursorId") || undefined;
    const limit = parseInt(searchParams.get("limit") || "25", 10);

    if (!userId) {
      return NextResponse.json({ error: "Missing required userId" }, { status: 400 });
    }

    const result = await getConversationsKeyset(userId, cursorTimestamp, cursorId, limit);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("GET /api/conversations error:", error);
    return NextResponse.json({ error: error.message || "Failed to load conversations" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, title, customId } = body;

    if (!userId) {
      return NextResponse.json({ error: "Missing required userId" }, { status: 400 });
    }

    const conversation = await createConversation(userId, title || "New Conversation", customId);

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/conversations error:", error);
    return NextResponse.json({ error: error.message || "Failed to create conversation" }, { status: 500 });
  }
}
