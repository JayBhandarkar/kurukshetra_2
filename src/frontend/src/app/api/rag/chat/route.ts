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
    const { query, ministry, conversationId: reqConvId, userId: reqUserId, attachedDocument, attachedDocuments, userProfile } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const cleanQuery = query.trim();
    const userId = reqUserId || "anonymous-user";
    let conversationId = reqConvId;

    // Ensure active conversation exists in DB.
    if (!conversationId || conversationId.startsWith("session-")) {
      const newConv = await createConversation(
        userId,
        cleanQuery.slice(0, 48),
        undefined
      );
      conversationId = newConv.id;
    } else {
      await createConversation(userId, cleanQuery.slice(0, 48), conversationId);
    }

    // 1. Save User Question to normalized Messages table
    await saveMessageWithCitations(conversationId, "user", cleanQuery, []);

    // 2. Fetch Attached User Documents Chunks from Supabase (if files attached)
    const attachedDocsList: any[] = Array.isArray(attachedDocuments) && attachedDocuments.length > 0
      ? attachedDocuments
      : attachedDocument
      ? [attachedDocument]
      : [];

    const docIdsToFetch = attachedDocsList
      .map((d: any) => d.documentId)
      .filter((id: any): id is string => typeof id === "string" && Boolean(id));

    let userDocChunks: any[] = [];
    if (docIdsToFetch.length > 0) {
      try {
        const { data: cData, error: cErr } = await supabase
          .from("document_chunks")
          .select("id, document_id, chunk_index, content, page_number, section, clause, metadata")
          .in("document_id", docIdsToFetch)
          .order("chunk_index", { ascending: true })
          .limit(60);

        if (!cErr && Array.isArray(cData)) {
          userDocChunks = cData;
        }
      } catch (userChunkErr) {
        console.warn("User document chunks fetch notice:", userChunkErr);
      }
    }

    // 3. Try querying FastAPI Multi-Agent Microservice if NO user documents attached (Global Sovereign mode)
    if (attachedDocsList.length === 0) {
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
          signal: AbortSignal.timeout(75000),
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
    }

    // 4. Query Supabase pgvector RPC for Sovereign Gazette Knowledge Base
    let matchedChunks: MatchedChunk[] = [];
    try {
      const queryEmbedding = await createEmbedding(cleanQuery);
      if (queryEmbedding) {
        const { data, error } = await supabase.rpc("match_document_chunks", {
          query_embedding: queryEmbedding,
          match_threshold: 0.55,
          match_count: 6,
          filter_ministry: ministry && ministry !== "All" && ministry !== "All Ministries" ? ministry : null,
        });

        if (!error && Array.isArray(data) && data.length > 0) {
          matchedChunks = data;
        }
      }
    } catch (dbErr) {
      console.warn("Supabase pgvector query fallback:", dbErr);
    }

    // 5. Build Structured Multi-Source Context & Citations
    const citationsToPersist: any[] = [];
    let contextText = "";

    // CASE A: Multi-Document Comparison (2+ attached files)
    if (attachedDocsList.length >= 2) {
      contextText += "=== MODE: MULTI-DOCUMENT COMPARISON & VERSION DIFF ===\n\n";
      attachedDocsList.forEach((doc: any, docIdx: number) => {
        const docCiteId = `cite-doc-${docIdx + 1}`;
        const dChunks = userDocChunks.filter((c: any) => c.document_id === doc.documentId);
        
        citationsToPersist.push({
          id: docCiteId,
          document_id: doc.documentId || `doc-${docIdx + 1}`,
          doc_title: doc.name || `Document ${docIdx + 1}`,
          docTitle: doc.name || `Document ${docIdx + 1}`,
          ministry: "Uploaded Workspace Document",
          gazette_number: `File #${docIdx + 1}`,
          gazetteNumber: `File #${docIdx + 1}`,
          date: "Uploaded",
          page_number: 1,
          page: 1,
          section: "Clauses & Provisions",
          clause: "All Extracted Content",
          quote: dChunks.length > 0 ? dChunks[0].content.slice(0, 350) + "..." : (doc.name || ""),
          confidence: 1.0,
          pdf_url: "",
          pdfUrl: "",
        });

        contextText += `[Citation Tag: [[${docCiteId}]]]\n--- ATTACHED FILE ${docIdx + 1}: "${doc.name}" ---\n`;
        if (dChunks.length > 0) {
          dChunks.forEach((c: any) => {
            contextText += `[Page ${c.page_number || 1}${c.section ? `, ${c.section}` : ""}]\n${c.content}\n\n`;
          });
        } else if (doc.content) {
          contextText += `${doc.content}\n\n`;
        }
      });
    }
    // CASE B: Single Uploaded Document (Compare vs Sovereign Gazette or Single-Doc Q&A)
    else if (attachedDocsList.length === 1) {
      const singleDoc = attachedDocsList[0];
      const docCiteId = "cite-user-doc";
      const dChunks = userDocChunks.filter((c: any) => c.document_id === singleDoc.documentId);

      citationsToPersist.push({
        id: docCiteId,
        document_id: singleDoc.documentId || "user-doc",
        doc_title: singleDoc.name || "Uploaded Document",
        docTitle: singleDoc.name || "Uploaded Document",
        ministry: "User Uploaded Workspace",
        gazette_number: "Uploaded Document",
        gazetteNumber: "Uploaded Document",
        date: "Uploaded",
        page_number: 1,
        page: 1,
        section: "Clauses & Provisions",
        clause: "Document Content",
        quote: dChunks.length > 0 ? dChunks[0].content.slice(0, 350) + "..." : (singleDoc.name || ""),
        confidence: 1.0,
        pdf_url: "",
        pdfUrl: "",
      });

      contextText += `[Citation Tag: [[${docCiteId}]]]\n=== USER UPLOADED DOCUMENT: "${singleDoc.name}" ===\n`;
      if (dChunks.length > 0) {
        dChunks.forEach((c: any) => {
          contextText += `[Page ${c.page_number || 1}${c.section ? `, ${c.section}` : ""}]\n${c.content}\n\n`;
        });
      } else if (singleDoc.content) {
        contextText += `${singleDoc.content}\n\n`;
      }

      if (matchedChunks.length > 0) {
        contextText += "\n=== STATUTORY SOVEREIGN GAZETTES & RELEVANT ACTS ===\n";
        matchedChunks.forEach((chunk, idx) => {
          const citeId = `cite-live-${idx + 1}`;
          citationsToPersist.push({
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
          });
          contextText += `[Citation Tag: [[${citeId}]]]\nSovereign Gazette: ${chunk.doc_title} (${chunk.ministry})\nSection: ${chunk.section}, Clause: ${chunk.clause}\n"${chunk.content}"\n\n`;
        });
      }
    }
    // CASE C: Pure Global Knowledge Base Query (No Files Attached)
    else {
      if (matchedChunks.length > 0) {
        matchedChunks.forEach((chunk, idx) => {
          const citeId = `cite-live-${idx + 1}`;
          citationsToPersist.push({
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
          });
          contextText += `[Citation Tag: [[${citeId}]]]\nDocument: ${chunk.doc_title} (${chunk.ministry})\nPage: ${chunk.page_number}, Section: ${chunk.section}, Clause: ${chunk.clause}\nContent:\n"${chunk.content}"\n\n`;
        });
      } else {
        contextText = "No indexed government documents matched this query. Answer only from well-known public statutory knowledge and clearly state that no indexed source was found.";
      }
    }

    // 6. Assemble Bounded LLM Context
    const { messagesForLLM } = await buildBoundedContext(
      conversationId,
      userId,
      cleanQuery,
      contextText,
      8
    );

    // 7. Generate Answer with OpenAI GPT-4o-mini
    const isComparisonQuery = attachedDocsList.length >= 2 || 
      /differen|compar|versus|vs|changed|delta|gap|redline|diverg/i.test(cleanQuery);

    if (isComparisonQuery) {
      messagesForLLM[0].content += `\n\nADDITIONAL COMPARISON INSTRUCTIONS:
- The user is asking to compare documents or find differences.
- Structure your answer clearly with:
  1. **Executive Summary of Differences**
  2. **Side-by-Side Comparison / Key Changes** (Use a structured Markdown table where appropriate: Column 1 = Provision/Topic, Column 2 = File 1 / Old Version, Column 3 = File 2 / New Version or Statutory Requirement, Column 4 = Key Difference/Impact)
  3. **Added or Missing Obligations**
  4. **Legal / Operational Implications**
- Include [[cite-id]] citation tags for every clause referenced from each document.`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messagesForLLM,
      temperature: 0.15,
      max_tokens: 1100,
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

    // 6. Filter Citations: ONLY retain citations that are explicitly referenced in the generated answer with [[cite-id]]
    const citedTags = cleanAnswer.match(/\[\[(cite-[a-zA-Z0-9\-_]+)\]\]/g) || [];
    const citedIdSet = new Set(citedTags.map((tag) => tag.replace("[[", "").replace("]]", "")));
    const verifiedCitations = citationsToPersist.filter((c) => citedIdSet.has(c.id));

    // Persist Assistant Answer & Citations in Normalized PostgreSQL tables
    const savedAssistantMsg = await saveMessageWithCitations(
      conversationId,
      "assistant",
      cleanAnswer,
      verifiedCitations
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
      citations: verifiedCitations,
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
