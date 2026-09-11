import { NextResponse } from "next/server";
import { deleteConversation, getConversationSummary } from "@/lib/chatStorage";
import { supabase } from "@/lib/supabaseClient";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || searchParams.get("userEmail");

    const { data: conv, error } = await supabase
      .from("conversations")
      .select("id, user_id, title, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();

    if (error || !conv) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (userId && conv.user_id !== userId) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    const summary = await getConversationSummary(id);

    return NextResponse.json({
      conversation: conv,
      summary: summary?.summary || null,
    });
  } catch (error: any) {
    console.error("GET /api/conversations/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch conversation" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || searchParams.get("userEmail");

    if (!userId) {
      return NextResponse.json({ error: "Missing required userId for authorization" }, { status: 400 });
    }

    const success = await deleteConversation(id, userId);

    if (!success) {
      return NextResponse.json({ error: "Failed to delete conversation or unauthorized" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Conversation deleted successfully" });
  } catch (error: any) {
    console.error("DELETE /api/conversations/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete conversation" }, { status: 500 });
  }
}
