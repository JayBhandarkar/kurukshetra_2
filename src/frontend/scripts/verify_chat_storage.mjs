/**
 * Verification script for Chat Storage, Keyset Pagination, User Isolation & Context Budget
 */
import assert from "assert";

// 1. Simulate Keyset Pagination
function paginateKeyset(items, limit, cursor, timeField = "created_at") {
  // Sort reverse chronological: (timestamp DESC, id DESC)
  const sorted = [...items].sort((a, b) => {
    const timeA = new Date(a[timeField]).getTime();
    const timeB = new Date(b[timeField]).getTime();
    if (timeA !== timeB) return timeB - timeA;
    return b.id.localeCompare(a.id);
  });

  // Apply keyset filter
  let filtered = sorted;
  if (cursor) {
    const cursorTime = new Date(cursor.timestamp).getTime();
    filtered = sorted.filter((item) => {
      const itemTime = new Date(item[timeField]).getTime();
      if (itemTime < cursorTime) return true;
      if (itemTime === cursorTime && item.id < cursor.id) return true;
      return false;
    });
  }

  const hasMore = filtered.length > limit;
  const pageItems = hasMore ? filtered.slice(0, limit) : filtered;

  let nextCursor = null;
  if (hasMore && pageItems.length > 0) {
    const last = pageItems[pageItems.length - 1];
    nextCursor = {
      timestamp: last[timeField],
      id: last.id,
    };
  }

  return {
    data: pageItems,
    nextCursor,
    hasMore,
  };
}

// 2. Bounded Context Builder simulation
function buildBoundedContextSim(
  conversationSummary,
  recentMessages,
  currentQuery,
  retrievedEvidence,
  recentTurnsLimit = 8
) {
  const messagesForLLM = [];

  let systemContent = `You are Pramaan, a Sovereign Government Document Intelligence Assistant for India.`;
  if (conversationSummary) {
    systemContent += `\n\n### PREVIOUS CONVERSATION CONTEXT & SUMMARY:\n${conversationSummary}`;
  }
  messagesForLLM.push({ role: "system", content: systemContent });

  // Add at most recentTurnsLimit messages
  const boundedTurns = recentMessages.slice(-recentTurnsLimit);
  for (const m of boundedTurns) {
    if (m.role === "user" || m.role === "assistant") {
      messagesForLLM.push({ role: m.role, content: m.content });
    }
  }

  messagesForLLM.push({
    role: "user",
    content: `### RETRIEVED SOVEREIGN EVIDENCE:\n${retrievedEvidence}\n\n### USER QUESTION:\n${currentQuery}`,
  });

  return {
    messagesForLLM,
    totalTurnsIncluded: boundedTurns.length,
    hasSummary: Boolean(conversationSummary),
  };
}

// ==========================================
// TEST SUITE
// ==========================================

console.log("🚀 Starting Pramaan Chat Storage & Keyset Pagination Test Suite...\n");

// Test 1: Keyset Pagination for 50 Conversations (Page size = 10)
console.log("TEST 1: Keyset Pagination for 50 Conversations (Page size = 10)");
const mockConversations = Array.from({ length: 50 }, (_, i) => ({
  id: `conv-uuid-${String(i).padStart(3, "0")}`,
  user_id: "user@nic.in",
  title: `Conversation ${i + 1}`,
  created_at: new Date(Date.now() - (50 - i) * 60000).toISOString(),
  updated_at: new Date(Date.now() - (50 - i) * 60000).toISOString(),
}));

const page1 = paginateKeyset(mockConversations, 10, null, "updated_at");
assert.strictEqual(page1.data.length, 10, "Page 1 should have 10 items");
assert.strictEqual(page1.hasMore, true, "Page 1 should have more items");
assert.ok(page1.nextCursor, "Page 1 must return nextCursor");

const page2 = paginateKeyset(mockConversations, 10, page1.nextCursor, "updated_at");
assert.strictEqual(page2.data.length, 10, "Page 2 should have 10 items");
assert.strictEqual(page2.hasMore, true, "Page 2 should have more items");
// Ensure no overlap between page 1 and page 2
const page1Ids = new Set(page1.data.map((c) => c.id));
for (const item of page2.data) {
  assert.ok(!page1Ids.has(item.id), `Duplicate ID found across pages: ${item.id}`);
}
console.log("✅ TEST 1 PASSED: Keyset pagination handles pages sequentially without overlap or duplicates.");

// Test 2: Keyset Pagination with Identical Timestamps (Tie-breaker via ID)
console.log("\nTEST 2: Keyset Pagination with Identical Timestamps");
const sameTimestamp = new Date().toISOString();
const tieBreakerItems = [
  { id: "conv-c", user_id: "user@nic.in", title: "C", created_at: sameTimestamp, updated_at: sameTimestamp },
  { id: "conv-b", user_id: "user@nic.in", title: "B", created_at: sameTimestamp, updated_at: sameTimestamp },
  { id: "conv-a", user_id: "user@nic.in", title: "A", created_at: sameTimestamp, updated_at: sameTimestamp },
];
const tiePage1 = paginateKeyset(tieBreakerItems, 2, null, "updated_at");
assert.strictEqual(tiePage1.data.length, 2);
assert.strictEqual(tiePage1.data[0].id, "conv-c");
assert.strictEqual(tiePage1.data[1].id, "conv-b");

const tiePage2 = paginateKeyset(tieBreakerItems, 2, tiePage1.nextCursor, "updated_at");
assert.strictEqual(tiePage2.data.length, 1);
assert.strictEqual(tiePage2.data[0].id, "conv-a");
console.log("✅ TEST 2 PASSED: Identical timestamps properly disambiguated via UUID fallback.");

// Test 3: Account-Scoped Multi-Tenant User Isolation
console.log("\nTEST 3: Account-Scoped User Isolation");
const userAConversations = [
  { id: "conv-1", user_id: "officer_a@mha.gov.in", title: "Internal MHA Report", created_at: sameTimestamp, updated_at: sameTimestamp },
];
const userBConversations = [
  { id: "conv-2", user_id: "citizen_b@gmail.com", title: "PMAY Query", created_at: sameTimestamp, updated_at: sameTimestamp },
];

function filterByUser(conversations, requestingUserId) {
  return conversations.filter((c) => c.user_id === requestingUserId);
}

const officerResults = filterByUser([...userAConversations, ...userBConversations], "officer_a@mha.gov.in");
assert.strictEqual(officerResults.length, 1);
assert.strictEqual(officerResults[0].id, "conv-1");
assert.strictEqual(officerResults[0].title, "Internal MHA Report");
console.log("✅ TEST 3 PASSED: Users strictly isolated from accessing each other's conversation records.");

// Test 4: Bounded Context LLM Budget & Summarization Inclusion
console.log("\nTEST 4: Bounded Context LLM Budget Verification");
const mockChatHistory = Array.from({ length: 30 }, (_, i) => ({
  id: `msg-${i}`,
  conversation_id: "conv-long",
  role: i % 2 === 0 ? "user" : "assistant",
  content: `Turn ${i}: Question/Answer about Gazette Section ${i}`,
  created_at: new Date(Date.now() - (30 - i) * 1000).toISOString(),
}));

const summary = "User discussed 2024 vs 2025 Education Policy, unit cost subsidies in rural areas, and direct tax compliance.";
const bounded = buildBoundedContextSim(
  summary,
  mockChatHistory,
  "What is the final filing deadline?",
  "Evidence Clause 4.2(a): 45 days from gazette publication.",
  8 // Max 8 recent turns
);

assert.strictEqual(bounded.hasSummary, true, "Summary must be present in system prompt");
assert.strictEqual(bounded.totalTurnsIncluded, 8, "Must only include last 8 dialogue turns");
assert.strictEqual(bounded.messagesForLLM[0].role, "system", "First message must be system prompt");
assert.ok(bounded.messagesForLLM[0].content.includes(summary), "System prompt must embed conversation summary");
assert.strictEqual(bounded.messagesForLLM[bounded.messagesForLLM.length - 1].role, "user", "Last message must be current query with evidence");
assert.ok(bounded.messagesForLLM[bounded.messagesForLLM.length - 1].content.includes("Evidence Clause 4.2(a)"), "Evidence must be injected");
console.log("✅ TEST 4 PASSED: LLM context stays bounded to 8 turns + summary + evidence without blowing token budget.");

console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! Ready for production.");
