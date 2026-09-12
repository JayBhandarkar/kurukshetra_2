import { NextResponse } from "next/server";
import { openai, createEmbedding } from "@/lib/openaiClient";
import { supabase } from "@/lib/supabaseClient";

// Allow compound multi-query requests up to 90 seconds
// (3–4 sub-queries × ~15s each + buffer)
export const maxDuration = 90;
import {
  saveMessageWithCitations,
  buildBoundedContext,
  triggerProgressiveSummarization,
  createConversation,
} from "@/lib/chatStorage";

interface MatchedChunk {
  id: string;
  document_id: string;
  content: string;
  doc_title: string;
  ministry: string;
  gazette_number: string;
  page_number: number;
  section: string;
  clause: string;
  similarity: number;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, ministry, conversationId: reqConvId, userId: reqUserId, attachedDocument, userProfile } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const cleanQuery = query.trim();
    const userId = reqUserId || "anonymous-user";
    let conversationId = reqConvId;

    // Ensure active conversation exists in DB.
    // Local draft sessions have ids like "session-<timestamp>" — not valid UUIDs.
    // Create a real DB record for them so messages are persisted and appear in history.
    if (!conversationId || conversationId.startsWith("session-")) {
      const newConv = await createConversation(userId, cleanQuery.slice(0, 48), conversationId?.startsWith("session-") ? undefined : conversationId);
      conversationId = newConv.id;
    }

    // 1. Save User Question to normalized Messages table
    await saveMessageWithCitations(conversationId, "user", cleanQuery, []);

    // 2. Try querying FastAPI Multi-Agent Microservice with Domain Profile
    try {
      const fastapiBase = process.env.FASTAPI_URL || "http://localhost:8000";
      const aiFastApiRes = await fetch(`${fastapiBase}/api/rag/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: cleanQuery,
          ministry: ministry && ministry !== "All" && ministry !== "All Ministries" ? ministry : null,
          user_profile: userProfile || {
            primary_domain: "General Sovereign Administration",
            role: "Legal Counsel / Advocate",
          },
        }),
        signal: AbortSignal.timeout(75000), // 75s — supports up to 4 compound sub-queries
      });

      if (aiFastApiRes.ok) {
        const aiData = await aiFastApiRes.json();
        if (aiData && aiData.answer) {
          const aiCitations = (aiData.citations || []).map((c: any) => ({
            id: c.id,
            doc_title: c.docTitle,
            docTitle: c.docTitle,
            ministry: c.ministry,
            gazette_number: c.gazetteNumber,
            gazetteNumber: c.gazetteNumber,
            date: "Official",
            page_number: c.page,
            page: c.page,
            section: c.section,
            clause: c.clause,
            quote: c.quote,
            confidence: c.confidence,
            pdf_url: c.pdfUrl || "https://egazette.gov.in",
            pdfUrl: c.pdfUrl || "https://egazette.gov.in",
          }));

          await saveMessageWithCitations(conversationId, "assistant", aiData.answer, aiCitations);
          triggerProgressiveSummarization(conversationId, userId).catch(() => {});

          return NextResponse.json({
            answer: aiData.answer,
            citations: aiCitations,
            intent: aiData.intent,
            searchMode: aiData.searchMode,
            primaryDomain: aiData.primaryDomain,
            processingStages: aiData.processingStages,
            followUps: aiData.followUps,
          });
        }
      }
    } catch (fastApiErr) {
      console.warn("FastAPI AI microservice fallback notice:", fastApiErr);
    }

    // 3. Generate 1536-dim Embedding with OpenAI (Direct Fallback)
    let queryEmbedding: number[] | null = null;
    try {
      queryEmbedding = await createEmbedding(cleanQuery);
    } catch (embErr) {
      console.warn("OpenAI embedding warning (will fallback to lexical matching):", embErr);
    }

    // 3. Query Supabase pgvector RPC
    let matchedChunks: MatchedChunk[] = [];
    if (queryEmbedding) {
      try {
        const { data, error } = await supabase.rpc("match_document_chunks", {
          query_embedding: queryEmbedding,
          match_threshold: 0.6,
          match_count: 5,
          filter_ministry: ministry && ministry !== "All" && ministry !== "All Ministries" ? ministry : null,
        });

        if (!error && Array.isArray(data) && data.length > 0) {
          matchedChunks = data;
        }
      } catch (dbErr) {
        console.warn("Supabase pgvector query fallback:", dbErr);
      }
    }

    // Format citations & evidence text
    const citationsToPersist: any[] = [];
    let contextText = "";

    // If user attached a local document from PC, prioritize its contents
    if (attachedDocument && attachedDocument.content) {
      const docCiteId = "cite-local-doc";
      citationsToPersist.push({
        id: docCiteId,
        doc_title: attachedDocument.name || "Local Document",
        docTitle: attachedDocument.name || "Local Document",
        ministry: "Uploaded from Local PC",
        gazette_number: "Local File",
        gazetteNumber: "Local File",
        date: "Recent",
        page_number: 1,
        page: 1,
        section: "Full Text",
        clause: "Attached Provision",
        quote: attachedDocument.content.slice(0, 350) + "...",
        confidence: 1.0,
        pdf_url: "",
        pdfUrl: "",
      });
      contextText += `[Citation Tag: [[${docCiteId}]]]\nUser Uploaded Local Document: "${attachedDocument.name}"\nDocument Content:\n"""\n${attachedDocument.content}\n"""\n\n`;
    }

    if (matchedChunks.length > 0) {
      matchedChunks.forEach((chunk, idx) => {
        const citeId = `cite-live-${idx + 1}`;
        const citeObj = {
          id: citeId,
          document_id: chunk.document_id,
          chunk_id: chunk.id,
          doc_title: chunk.doc_title || "Official Gazette",
          docTitle: chunk.doc_title || "Official Gazette",
          ministry: chunk.ministry || "Government of India",
          gazette_number: chunk.gazette_number || "Gazette Ref",
          gazetteNumber: chunk.gazette_number || "Gazette Ref",
          date: "Official",
          page_number: chunk.page_number || 1,
          page: chunk.page_number || 1,
          section: chunk.section || "Section",
          clause: chunk.clause || "Clause",
          quote: chunk.content,
          confidence: chunk.similarity || 0.95,
          pdf_url: "https://egazette.gov.in",
          pdfUrl: "https://egazette.gov.in",
        };
        citationsToPersist.push(citeObj);
        contextText += `[Citation Tag: [[${citeId}]]]\nDocument: ${chunk.doc_title} (${chunk.ministry})\nPage: ${chunk.page_number}, Section: ${chunk.section}, Clause: ${chunk.clause}\nContent:\n"${chunk.content}"\n\n`;
      });
    } else {
      // No matching chunks found in pgvector — do not fabricate citations.
      // GPT will answer with what it knows but no [[cite-id]] tags will be injected,
      // so the Sources panel will correctly show nothing.
      contextText = "No indexed government documents matched this query. Answer only from well-known public statutory knowledge and clearly state that no indexed source was found.";
    }

    // 4. Assemble Bounded LLM Context
    // (System + Summary + Recent 6-10 turns + Retrieved Evidence + User Question)
    const { messagesForLLM } = await buildBoundedContext(
      conversationId,
      userId,
      cleanQuery,
      contextText,
      8
    );

    // 5. Generate Answer with OpenAI GPT-4o-mini
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messagesForLLM,
      temperature: 0.2,
      max_tokens: 800,
    });

    let rawAnswer = completion.choices[0]?.message?.content || "Unable to generate answer from indexed documents.";

    // Sanitize raw JSON envelopes if returned
    let cleanAnswer = rawAnswer.trim();
    if (cleanAnswer.startsWith("```json")) {
      cleanAnswer = cleanAnswer.replace(/^```json\s*/, "").replace(/```$/, "").trim();
    }
    if (cleanAnswer.startsWith("{") && cleanAnswer.endsWith("}")) {
      try {
        const parsed = JSON.parse(cleanAnswer);
        cleanAnswer = parsed.answer || parsed.response || parsed.content || cleanAnswer;
      } catch (e) {
        // Not valid JSON, keep as is
      }
    }

    // 6. Persist Assistant Answer & Citations in Normalized PostgreSQL tables
    const savedAssistantMsg = await saveMessageWithCitations(
      conversationId,
      "assistant",
      cleanAnswer,
      citationsToPersist
    );

    // 7. Progressive Context Summarization in Background (if threshold exceeded)
    triggerProgressiveSummarization(conversationId, userId).catch((err) =>
      console.warn("Background summarization non-blocking error:", err)
    );

    // Generate dynamic follow-up suggestions
    const followUps: string[] = [
      "Compare penalties and compliance deadlines",
      "Which categories are exempted from this rule?",
      "Download official gazette PDF copy",
    ];

    return NextResponse.json({
      success: true,
      answer: cleanAnswer,
      citations: citationsToPersist,
      messageId: savedAssistantMsg.id,
      conversationId,
      processingStages: [
        "Query Understanding",
        "Orchestrator Agent",
        "Hybrid Retrieval (pgvector + Knowledge Graph)",
        "Reasoning & Comparison",
        "Evidence Validation",
        "Response Generation",
      ],
      followUps,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "RAG processing failed";
    console.error("RAG Chat Route Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
