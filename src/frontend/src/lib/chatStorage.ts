import { supabase } from "./supabaseClient";
import { openai } from "./openaiClient";

export interface ConversationRecord {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface MessageRecord {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  citations?: CitationRecord[];
}

export interface CitationRecord {
  id: string;
  message_id: string;
  document_id?: string;
  chunk_id?: string;
  doc_title: string;
  ministry?: string;
  gazette_number?: string;
  page_number?: number;
  section?: string;
  clause?: string;
  quote: string;
  confidence: number;
  pdf_url?: string;
}

export interface ConversationSummaryRecord {
  conversation_id: string;
  summary: string;
  last_summarized_message_id?: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: {
    timestamp: string;
    id: string;
  } | null;
  hasMore: boolean;
}

/**
 * 1. Keyset Pagination for Conversations
 * Efficiently loads conversations for a user without OFFSET overhead:
 * WHERE user_id = $1 AND (updated_at, id) < ($cursorTimestamp, $cursorId)
 * ORDER BY updated_at DESC, id DESC LIMIT $limit
 */
export async function getConversationsKeyset(
  userId: string,
  cursorTimestamp?: string,
  cursorId?: string,
  limit: number = 25
): Promise<PaginatedResponse<ConversationRecord>> {
  try {
    let query = supabase
      .from("conversations")
      .select("id, user_id, title, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    if (cursorTimestamp && cursorId) {
      // Keyset condition: strictly older timestamp OR same timestamp with smaller UUID
      query = query.or(
        `updated_at.lt.${cursorTimestamp},and(updated_at.eq.${cursorTimestamp},id.lt.${cursorId})`
      );
    }

    const { data, error } = await query;

    if (error || !data) {
      console.warn("getConversationsKeyset error (fallback to memory/mock if table missing):", error);
      return { data: [], nextCursor: null, hasMore: false };
    }

    const hasMore = data.length > limit;
    const items = hasMore ? data.slice(0, limit) : data;

    let nextCursor = null;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      nextCursor = {
        timestamp: lastItem.updated_at,
        id: lastItem.id,
      };
    }

    return {
      data: items as ConversationRecord[],
      nextCursor,
      hasMore,
    };
  } catch (err) {
    console.error("getConversationsKeyset exception:", err);
    return { data: [], nextCursor: null, hasMore: false };
  }
}

/**
 * 2. Keyset Pagination for Messages
 * Efficiently loads messages for a conversation without OFFSET overhead:
 * WHERE conversation_id = $1 AND (created_at, id) < ($cursorTimestamp, $cursorId)
 * ORDER BY created_at DESC, id DESC LIMIT $limit
 */
export async function getMessagesKeyset(
  conversationId: string,
  userId: string,
  cursorTimestamp?: string,
  cursorId?: string,
  limit: number = 25
): Promise<PaginatedResponse<MessageRecord>> {
  try {
    // 1. Authorization check: Verify conversation ownership
    const { data: conv } = await supabase
      .from("conversations")
      .select("id, user_id")
      .eq("id", conversationId)
      .maybeSingle();

    if (conv && conv.user_id !== userId) {
      throw new Error("Unauthorized: Cannot access conversations belonging to another user.");
    }

    // 2. Query messages in reverse chronological order
    let query = supabase
      .from("messages")
      .select(`
        id,
        conversation_id,
        role,
        content,
        created_at,
        citations (
          id,
          message_id,
          document_id,
          chunk_id,
          doc_title,
          ministry,
          gazette_number,
          page_number,
          section,
          clause,
          quote,
          confidence,
          pdf_url
        )
      `)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    if (cursorTimestamp && cursorId) {
      query = query.or(
        `created_at.lt.${cursorTimestamp},and(created_at.eq.${cursorTimestamp},id.lt.${cursorId})`
      );
    }

    const { data, error } = await query;

    if (error || !data) {
      return { data: [], nextCursor: null, hasMore: false };
    }

    const hasMore = data.length > limit;
    const items = hasMore ? data.slice(0, limit) : data;

    let nextCursor = null;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      nextCursor = {
        timestamp: lastItem.created_at,
        id: lastItem.id,
      };
    }

    // Return messages in chronological order for display
    const chronologicalMessages = [...items].reverse() as MessageRecord[];

    return {
      data: chronologicalMessages,
      nextCursor,
      hasMore,
    };
  } catch (err) {
    console.error("getMessagesKeyset error:", err);
    return { data: [], nextCursor: null, hasMore: false };
  }
}

/**
 * 3. Create or Ensure Conversation
 * Uses upsert with ignoreDuplicates so calling this twice with the same id
 * (race condition on refresh) never creates a second DB row.
 */
export async function createConversation(
  userId: string,
  title: string = "New Conversation",
  customId?: string
): Promise<ConversationRecord> {
  const newId = customId || crypto.randomUUID();
  const now = new Date().toISOString();

  const record: ConversationRecord = {
    id: newId,
    user_id: userId,
    title,
    created_at: now,
    updated_at: now,
  };

  try {
    // onConflict: if a row with this id already exists, do nothing (no duplicate).
    // Return the existing row by fetching it when upsert returns nothing.
    const { data } = await supabase
      .from("conversations")
      .upsert([record], { onConflict: "id", ignoreDuplicates: true })
      .select()
      .single();

    if (data) return data as ConversationRecord;

    // ignoreDuplicates suppressed the return — fetch the existing row instead
    const { data: existing } = await supabase
      .from("conversations")
      .select("id, user_id, title, created_at, updated_at")
      .eq("id", newId)
      .single();

    if (existing) return existing as ConversationRecord;
  } catch (e) {
    console.warn("createConversation DB fallback:", e);
  }

  return record;
}

/**
 * 4. Delete Conversation (Cascades to messages, citations, summaries)
 */
export async function deleteConversation(
  conversationId: string,
  userId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", conversationId)
      .eq("user_id", userId);

    return !error;
  } catch (err) {
    console.error("deleteConversation error:", err);
    return false;
  }
}

/**
 * 5. Save Single Message with Normalized Citations
 */
export async function saveMessageWithCitations(
  conversationId: string,
  role: "user" | "assistant" | "system",
  content: string,
  citations: Omit<CitationRecord, "id" | "message_id">[] = []
): Promise<MessageRecord> {
  const msgId = crypto.randomUUID();
  const now = new Date().toISOString();

  const msgRecord: MessageRecord = {
    id: msgId,
    conversation_id: conversationId,
    role,
    content,
    created_at: now,
  };

  try {
    // 1. Insert message row
    await supabase.from("messages").insert([msgRecord]);

    // 2. Insert normalized citations if present
    if (citations && citations.length > 0) {
      const citationRows = citations.map((c) => ({
        id: crypto.randomUUID(),
        message_id: msgId,
        document_id: c.document_id || null,
        chunk_id: c.chunk_id || null,
        doc_title: c.doc_title,
        ministry: c.ministry || null,
        gazette_number: c.gazette_number || null,
        page_number: c.page_number || null,
        section: c.section || null,
        clause: c.clause || null,
        quote: c.quote,
        confidence: c.confidence || 0.95,
        pdf_url: c.pdf_url || null,
        created_at: now,
      }));

      await supabase.from("citations").insert(citationRows);
      msgRecord.citations = citationRows as CitationRecord[];
    }

    // 3. Update conversation updated_at
    await supabase
      .from("conversations")
      .update({ updated_at: now })
      .eq("id", conversationId);
  } catch (err) {
    console.warn("saveMessageWithCitations DB write warning:", err);
  }

  return msgRecord;
}

/**
 * 6. Get Conversation Summary
 */
export async function getConversationSummary(
  conversationId: string
): Promise<ConversationSummaryRecord | null> {
  try {
    const { data } = await supabase
      .from("conversation_summaries")
      .select("conversation_id, summary, last_summarized_message_id, updated_at")
      .eq("conversation_id", conversationId)
      .maybeSingle();

    return data as ConversationSummaryRecord | null;
  } catch (err) {
    return null;
  }
}

/**
 * 7. Bounded Context Assembly for LLM Request
 * Assembles:
 * 1. System instructions
 * 2. Conversation summary (if long dialogue)
 * 3. Recent 6-10 message turns
 * 4. Retrieved government-document evidence
 * 5. Current user question
 */
export async function buildBoundedContext(
  conversationId: string,
  userId: string,
  currentQuery: string,
  retrievedEvidenceText: string,
  recentTurnsLimit: number = 8
): Promise<{
  messagesForLLM: { role: "system" | "user" | "assistant"; content: string }[];
  totalTurnsIncluded: number;
  hasSummary: boolean;
}> {
  // A. Fetch existing conversation summary
  const summaryRecord = await getConversationSummary(conversationId);

  // B. Fetch only the most recent N turns
  const recentMessagesRes = await getMessagesKeyset(
    conversationId,
    userId,
    undefined,
    undefined,
    recentTurnsLimit
  );

  const messagesForLLM: { role: "system" | "user" | "assistant"; content: string }[] = [];

  // 1. System Persona & Strict Sovereign Grounding Prompt
  let systemContent = `You are Pramaan, a Sovereign Government Document Intelligence Assistant for India.
Your mission is to provide accurate, evidence-backed, easily readable answers regarding Indian statutory laws, gazette notifications, circulars, acts, and user-uploaded workspace documents (contracts, policies, agreements).

MANDATORY RULES & DOMAIN BOUNDARY:
1. DOMAIN BOUNDARY & OUT-OF-DOMAIN REFUSAL:
   - You must NOT answer general off-topic trivia or non-document questions (e.g., "who is PM of India", "capital of France", "tell me a joke", sports, cooking, generic entertainment).
   - If an off-topic question is asked, strictly decline with:
     "I am specialized exclusively in Sovereign Document Intelligence (Indian statutory laws, gazette notifications, and your uploaded workspace documents). I cannot answer general off-topic questions. Please ask queries related to regulatory compliance, legal directives, or your attached files."

2. TOPICAL & CONCEPTUAL QUESTIONS ALLOWED:
   - If the user asks a conceptual or general question RELATED to the document's topic, legal principles, compliance mechanisms, or regulatory frameworks (e.g. "What is dark patterning?", "What does SLA uptime mean?", "What is the purpose of Section 8 in DPDP Act?", "How does CERT-In reporting work?"), answer thoroughly using expert legal and domain knowledge.

3. CITATION DISCIPLINE:
   - Use [[cite-id]] tags (e.g. [[cite-live-1]], [[cite-doc-1]]) ONLY when an assertion directly comes from that specific retrieved document chunk.
   - When explaining conceptual domain topics where no specific chunk is cited, answer cleanly WITHOUT attaching false citation tags.

4. OUTPUT FORMATTING GUIDELINES:
   - Output must be clean, natural, human-readable text.
   - Do NOT wrap your entire answer in JSON or markdown code-block envelopes (\`\`\`json).
   - Do NOT start with raw title banners like "# Response" or "### Answer". Start directly with your explanation.
   - Use clear paragraphs, bullet points (- or 1.), and **bold** keywords for readability.
   - Place citation tags [[cite-id]] smoothly inline at the end of the relevant sentence or clause.

5. Be clear, professional, and precise. Avoid speculation or ungrounded assertions.`;

  if (summaryRecord?.summary) {
    systemContent += `\n\n### PREVIOUS CONVERSATION CONTEXT & SUMMARY:\n${summaryRecord.summary}`;
  }

  messagesForLLM.push({ role: "system", content: systemContent });

  // 2. Add the recent dialogue turns (bounded to recentTurnsLimit)
  for (const m of recentMessagesRes.data) {
    if (m.role === "user" || m.role === "assistant") {
      messagesForLLM.push({
        role: m.role,
        content: m.content,
      });
    }
  }

  // 3. Add Current Turn with Retrieved Evidence
  messagesForLLM.push({
    role: "user",
    content: `### RETRIEVED SOVEREIGN EVIDENCE:\n${retrievedEvidenceText}\n\n### USER QUESTION:\n${currentQuery}`,
  });

  return {
    messagesForLLM,
    totalTurnsIncluded: recentMessagesRes.data.length,
    hasSummary: Boolean(summaryRecord?.summary),
  };
}

/**
 * 8. Progressive Conversation Summarization (Triggered when dialogue turns > 10)
 * Preserves user intent, decisions, established facts, citations, and unresolved questions.
 */
export async function triggerProgressiveSummarization(
  conversationId: string,
  userId: string
): Promise<void> {
  try {
    // Check total message count
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId);

    if (!count || count < 10) {
      return; // No summarization needed yet
    }

    // Fetch messages up to the latest 6 (summarize the older portion)
    const { data: allMessages } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (!allMessages || allMessages.length < 10) return;

    const messagesToSummarize = allMessages.slice(0, allMessages.length - 6);
    const existingSummary = await getConversationSummary(conversationId);

    const promptText = `Summarize the following earlier conversation turns between a user and the government document intelligence assistant.
Preserve:
- Key user intent and questions
- Established facts, numbers, and deadlines
- Key policy and gazette citations mentioned
- Any unresolved questions

Existing Summary (if any):
${existingSummary?.summary || "None"}

Turns to incorporate:
${messagesToSummarize.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n")}

Provide a concise, dense markdown summary (max 250 words).`;

    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an analytical assistant summarizing regulatory dialogues. Maintain high factual density.",
        },
        { role: "user", content: promptText },
      ],
      temperature: 0.2,
      max_tokens: 350,
    });

    const newSummary = summaryResponse.choices[0]?.message?.content || "";

    if (newSummary.trim()) {
      await supabase.from("conversation_summaries").upsert({
        conversation_id: conversationId,
        summary: newSummary.trim(),
        last_summarized_message_id: messagesToSummarize[messagesToSummarize.length - 1].id,
        updated_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn("Progressive summarization error:", err);
  }
}
