import { NextResponse } from "next/server";
import { openai, createEmbedding } from "@/lib/openaiClient";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request: Request) {
  try {
    const { title, ministry, docType, gazetteNumber, publicationDate, content, clauses } =
      await request.json();

    if (!title || !ministry || !content) {
      return NextResponse.json(
        { error: "Title, ministry, and content are required" },
        { status: 400 }
      );
    }

    // 1. Insert Document record
    const { data: docData, error: docError } = await supabase
      .from("documents")
      .insert([
        {
          title: title.trim(),
          ministry: ministry.trim(),
          doc_type: docType || "Notification",
          gazette_number: gazetteNumber || null,
          publication_date: publicationDate || new Date().toISOString().split("T")[0],
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (docError || !docData) {
      console.warn("Could not insert document into Supabase:", docError);
      return NextResponse.json({ error: docError?.message || "Insert failed" }, { status: 500 });
    }

    const documentId = docData.id;

    // 2. Break content into statutory chunks or use provided clauses
    const rawChunks: Array<{ text: string; page: number; section: string; clause: string }> =
      clauses && clauses.length > 0
        ? clauses
        : [
            {
              text: content,
              page: 1,
              section: "General Provision",
              clause: "Clause 1.1",
            },
          ];

    // 3. Generate embeddings & insert chunks
    const chunkInserts = [];
    for (let i = 0; i < rawChunks.length; i++) {
      const chunk = rawChunks[i];
      const embedding = await createEmbedding(chunk.text);

      chunkInserts.push({
        document_id: documentId,
        chunk_index: i,
        content: chunk.text,
        page_number: chunk.page || 1,
        section: chunk.section || "Section",
        clause: chunk.clause || `Clause ${i + 1}`,
        embedding,
        created_at: new Date().toISOString(),
      });
    }

    const { error: chunkError } = await supabase.from("document_chunks").insert(chunkInserts);

    if (chunkError) {
      console.warn("Could not insert document chunks:", chunkError);
      return NextResponse.json({ error: chunkError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully ingested "${title}" with ${chunkInserts.length} vector embeddings!`,
      documentId,
      chunksCount: chunkInserts.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Ingestion failed";
    console.error("RAG Ingest Route Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
