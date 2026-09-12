import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!id) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 });
    }

    // 1. Fetch document record to verify and find storage file_url
    const { data: doc, error: fetchErr } = await supabase
      .from("documents")
      .select("id, file_url, title, metadata")
      .eq("id", id)
      .single();

    if (fetchErr && fetchErr.code !== "PGRST116") {
      console.warn("Notice fetching doc before deletion:", fetchErr);
    }

    // 2. Cascade delete all vector chunks from public.document_chunks
    const { error: chunkErr } = await supabase
      .from("document_chunks")
      .delete()
      .eq("document_id", id);

    if (chunkErr) {
      console.warn("Notice deleting chunks:", chunkErr);
    }

    // 3. Delete master document record from public.documents
    const { error: docErr } = await supabase
      .from("documents")
      .delete()
      .eq("id", id);

    if (docErr) {
      console.error("Error deleting master document record:", docErr);
      return NextResponse.json({ error: docErr.message }, { status: 500 });
    }

    // 4. If file_url exists in Supabase Storage, attempt cleanup
    if (doc?.file_url) {
      try {
        const urlStr = doc.file_url;
        // Parse storage path after bucket name
        const match = urlStr.match(/\/storage\/v1\/object\/public\/(documents|user_documents)\/(.+)/);
        if (match) {
          const bucket = match[1];
          const filePath = decodeURIComponent(match[2]);
          await supabase.storage.from(bucket).remove([filePath]);
        }
      } catch (storageErr) {
        console.warn("Storage file cleanup notice:", storageErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Document "${doc?.title || id}" and all vector embeddings permanently deleted from database.`,
      documentId: id,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete document";
    console.error("Document DELETE Route Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
