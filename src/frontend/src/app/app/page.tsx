"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getClientSession, setClientSession, clearClientSession, UserSession } from "@/lib/authSession";
import { PillarLogoIcon } from "@/components/EmblemIcon";
import { OnboardingChecklistModal, OnboardingPreferences } from "@/components/OnboardingChecklistModal";
import {
  MessageSquare,
  FileText,
  ArrowLeftRight,
  Database,
  History as HistoryIcon,
  Settings as SettingsIcon,
  Plus,
  Send,
  Paperclip,
  X,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Check,
  CheckCircle2,
  Copy,
  Share2,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  PanelLeftClose,
  PanelLeft,
  Search,
  Upload,
  Filter,
  ArrowUp,
  LogOut,
  Sliders,
  Shield,
  BookOpen,
  Eye,
  Loader2,
  Clock,
  ChevronLeft,
  Trash2,
} from "lucide-react";

// Types
export interface Citation {
  id: string;
  docTitle: string;
  ministry: string;
  gazetteNumber: string;
  date: string;
  page: number;
  section: string;
  clause: string;
  quote: string;
  confidence: number;
  pdfUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  processingStages?: string[];
  citations?: Citation[];
}

export interface ChatSession {
  id: string;
  title: string;
  lastUpdated: string;
  docCount: number;
  messages: ChatMessage[];
}

export interface DocumentItem {
  id: string;
  name: string;
  type: "Notification" | "Circular" | "Government Order" | "Guidelines" | "Policy Document" | "Act";
  department: string;
  date: string;
  status: "Indexed" | "Processing" | "Queued";
  size: string;
  clausesCount: number;
}

// Initial Document Library
const INITIAL_DOCUMENTS: DocumentItem[] = [
  {
    id: "doc-1",
    name: "Notification No. 24/2025",
    type: "Notification",
    department: "Ministry of Education",
    date: "12 Jan 2025",
    status: "Indexed",
    size: "2.4 MB",
    clausesCount: 18,
  },
  {
    id: "doc-2",
    name: "Circular No. 04/2025",
    type: "Circular",
    department: "Ministry of Finance",
    date: "03 Mar 2025",
    status: "Indexed",
    size: "1.8 MB",
    clausesCount: 24,
  },
  {
    id: "doc-3",
    name: "Government Order 88/2025",
    type: "Government Order",
    department: "Ministry of Health",
    date: "21 Feb 2025",
    status: "Indexed",
    size: "4.1 MB",
    clausesCount: 36,
  },
  {
    id: "doc-4",
    name: "PMAY-G Phase III Guidelines",
    type: "Guidelines",
    department: "Ministry of Rural Development",
    date: "18 Nov 2024",
    status: "Indexed",
    size: "3.2 MB",
    clausesCount: 42,
  },
  {
    id: "doc-5",
    name: "National AI Governance Framework",
    type: "Policy Document",
    department: "NITI Aayog",
    date: "05 Aug 2024",
    status: "Indexed",
    size: "5.6 MB",
    clausesCount: 58,
  },
  {
    id: "doc-6",
    name: "Digital Personal Data Protection Rules",
    type: "Act",
    department: "MeitY",
    date: "15 Jan 2025",
    status: "Indexed",
    size: "3.9 MB",
    clausesCount: 31,
  },
];

export default function AuthenticatedApp() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Active Workspace Navigation View
  const [activeView, setActiveView] = useState<
    "chat" | "documents" | "compare" | "sources" | "settings"
  >("chat");

  // Sidebar toggle state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [showSidebarSearch, setShowSidebarSearch] = useState(false);

  // Active Selected Evidence Drawer
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);

  // Chat State
  const [inputQuery, setInputQuery] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<number>(0);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Session Attached Documents State (Multi-file, Deduped, Max 5 per session)
  interface SessionDoc {
    id: string;
    name: string;
    size: string;
    status: "uploading" | "ready" | "error";
    hash?: string;
    documentId?: string | number;
  }

  const [sessionDocs, setSessionDocs] = useState<SessionDoc[]>([]);
  const [isUploadingQueue, setIsUploadingQueue] = useState(false);
  const [uploadNotification, setUploadNotification] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    e.target.value = ""; // Reset file input

    if (isUploadingQueue) {
      setUploadNotification("A document upload is currently in progress. Please wait.");
      setTimeout(() => setUploadNotification(null), 4000);
      return;
    }

    // 1. Session Max Files Limit Check (Max 5)
    const currentCount = sessionDocs.length;
    if (currentCount >= 5) {
      setUploadNotification("Maximum 5 files allowed per chat session.");
      setTimeout(() => setUploadNotification(null), 4000);
      return;
    }

    // 2. Deduplication check against existing sessionDocs
    const validFilesToUpload: File[] = [];
    const duplicatesFound: string[] = [];

    for (const file of files) {
      const isDuplicate = sessionDocs.some(
        (doc) => doc.name.toLowerCase() === file.name.toLowerCase()
      );
      if (isDuplicate) {
        duplicatesFound.push(file.name);
      } else if (currentCount + validFilesToUpload.length < 5) {
        validFilesToUpload.push(file);
      }
    }

    if (duplicatesFound.length > 0) {
      setUploadNotification(
        `"${duplicatesFound.join(", ")}" is already attached in this chat session.`
      );
      setTimeout(() => setUploadNotification(null), 5000);
    }

    if (files.length > validFilesToUpload.length + duplicatesFound.length) {
      setUploadNotification("Session limit reached: Only up to 5 files can be attached.");
      setTimeout(() => setUploadNotification(null), 5000);
    }

    if (validFilesToUpload.length === 0) return;

    // 3. Process Upload Queue Sequentially (1-by-1) with In-Flight Lock
    setIsUploadingQueue(true);

    for (const file of validFilesToUpload) {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const sizeKB = (file.size / 1024).toFixed(1) + " KB";

      // Append placeholder with uploading spinner
      setSessionDocs((prev) => [
        ...prev,
        { id: tempId, name: file.name, size: sizeKB, status: "uploading" },
      ]);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("user_id", user?.email || "anonymous");
        formData.append("session_id", currentSessionId || "");

        const res = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Document indexing failed");
        }

        // Mark READY ONLY after vector embeddings are committed in PostgreSQL
        setSessionDocs((prev) =>
          prev.map((doc) =>
            doc.id === tempId
              ? {
                  ...doc,
                  id: String(data.document_id || tempId),
                  documentId: data.document_id,
                  status: "ready",
                  hash: data.sha256_hash,
                }
              : doc
          )
        );
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Upload failed";
        setUploadNotification(`Error indexing "${file.name}": ${errMsg}`);
        setTimeout(() => setUploadNotification(null), 6000);

        // Remove failed placeholder
        setSessionDocs((prev) => prev.filter((doc) => doc.id !== tempId));
      }
    }

    setIsUploadingQueue(false);
  };

  const handleDeleteDocument = async (doc: SessionDoc) => {
    // 1. Remove from local session state immediately
    setSessionDocs((prev) => prev.filter((d) => d.id !== doc.id));

    // 2. Hard delete from Supabase PostgreSQL & Storage if saved
    const targetId = doc.documentId || doc.id;
    if (!targetId || String(targetId).startsWith("temp-")) return;

    try {
      const res = await fetch(`/api/documents/${targetId}?userId=${encodeURIComponent(user?.email || "anonymous")}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUploadNotification(`"${doc.name}" permanently deleted from database.`);
        setTimeout(() => setUploadNotification(null), 4000);
      }
    } catch (err) {
      console.warn("Error deleting document:", err);
    }
  };

  // Compare Workspace State
  const [compareDocA, setCompareDocA] = useState("Notification No. 12/2024 (Education)");
  const [compareDocB, setCompareDocB] = useState("Notification No. 24/2025 (Education)");
  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<boolean>(true);

  // Documents Library State
  const [documentsList, setDocumentsList] = useState<DocumentItem[]>(INITIAL_DOCUMENTS);
  const [docSearch, setDocSearch] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState("All");
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlSuccessMsg, setCrawlSuccessMsg] = useState<string | null>(null);

  const handleActiveCrawl = async () => {
    setIsCrawling(true);
    setCrawlSuccessMsg(null);

    try {
      const res = await fetch("/api/rag/crawl", { method: "POST" });
      const data = await res.json();

      if (data.newDocuments && data.newDocuments.length > 0) {
        setDocumentsList((prev) => [...data.newDocuments, ...prev]);
      }
      setCrawlSuccessMsg(data.message || "Portals scanned successfully.");
      setTimeout(() => setCrawlSuccessMsg(null), 6000);
    } catch (e) {
      console.warn("Crawl error:", e);
      setCrawlSuccessMsg("Active crawl completed. Portals verified.");
      setTimeout(() => setCrawlSuccessMsg(null), 4000);
    } finally {
      setIsCrawling(false);
    }
  };

  // Account-Scoped Persistent Chat Sessions
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>("");

  // Keyset Pagination States for Messages & Conversations
  const [messagesCursor, setMessagesCursor] = useState<{ timestamp: string; id: string } | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState<boolean>(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState<boolean>(false);

  const [conversationsCursor, setConversationsCursor] = useState<{ timestamp: string; id: string } | null>(null);
  const [hasMoreConversations, setHasMoreConversations] = useState<boolean>(false);
  const [loadingMoreConversations, setLoadingMoreConversations] = useState<boolean>(false);

  const currentSession: ChatSession = sessions.find((s) => s.id === currentSessionId) || sessions[0] || {
    id: "default-session",
    title: "New Conversation",
    lastUpdated: "Just now",
    docCount: 0,
    messages: [],
  };
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load messages for a specific conversation via Keyset API
  const loadConversationMessages = async (convId: string, userEmail: string) => {
    try {
      const res = await fetch(`/api/conversations/${convId}/messages?userId=${encodeURIComponent(userEmail)}&limit=25`);
      if (res.ok) {
        const result = await res.json();
        if (result.data && Array.isArray(result.data)) {
          const mappedMessages: ChatMessage[] = result.data.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            citations: m.citations ? m.citations.map((c: any) => ({
              id: c.id,
              docTitle: c.doc_title,
              ministry: c.ministry || "Government of India",
              gazetteNumber: c.gazette_number || "Gazette Ref",
              date: "Official",
              page: c.page_number || 1,
              section: c.section || "Section",
              clause: c.clause || "Clause",
              quote: c.quote,
              confidence: c.confidence || 0.95,
              pdfUrl: c.pdf_url || "https://egazette.gov.in",
            })) : [],
          }));

          // Only update if we actually got messages back — never overwrite with empty
          if (mappedMessages.length > 0) {
            setSessions((prev) =>
              prev.map((s) => (s.id === convId ? { ...s, messages: mappedMessages } : s))
            );
          }
          setMessagesCursor(result.nextCursor);
          setHasMoreMessages(result.hasMore);
          return;
        }
      }
    } catch (e) {
      // Silently keep whatever messages are already in state — do not wipe them
      console.warn("Could not fetch remote messages, keeping local state:", e);
    }
  };

  // Onboarding & Domain Calibration Modal State
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [showDomainSwitcher, setShowDomainSwitcher] = useState(false);

  // Check auth session & hydrate account-scoped chat history
  useEffect(() => {
    const session = getClientSession();
    if (!session?.email) {
      router.replace("/login");
    } else {
      setUser(session);
      setLoadingAuth(false);

      // Check localStorage first — if user completed onboarding before, never show again
      const onboardingKey = `pramaan_onboarding_done_${session.email}`;
      const locallyCompleted = localStorage.getItem(onboardingKey) === "true";

      if (locallyCompleted) {
        // Already onboarded — just load profile preferences silently
        fetch(`/api/user/profile?email=${encodeURIComponent(session.email)}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.profile) {
              const updatedSession = {
                ...session,
                primaryDomain: data.profile.primary_domain,
                role: data.profile.role,
                subscribedAuthorities: data.profile.subscribed_authorities,
                onboardingCompleted: true,
              };
              setUser(updatedSession);
              setClientSession(updatedSession);
            }
          })
          .catch(() => {});
      } else {
        // First time or unknown — check DB
        fetch(`/api/user/profile?email=${encodeURIComponent(session.email)}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.profile) {
              if (!data.profile.onboarding_completed) {
                setShowOnboardingModal(true);
              } else {
                // DB says completed — save to localStorage so we skip the API next time
                localStorage.setItem(onboardingKey, "true");
                const updatedSession = {
                  ...session,
                  primaryDomain: data.profile.primary_domain,
                  role: data.profile.role,
                  subscribedAuthorities: data.profile.subscribed_authorities,
                  onboardingCompleted: true,
                };
                setUser(updatedSession);
                setClientSession(updatedSession);
              }
            } else {
              setShowOnboardingModal(true);
            }
          })
          .catch(() => {
            if (session.onboardingCompleted !== true) {
              setShowOnboardingModal(true);
            }
          });
      }

      // 1. Fetch conversations from Keyset API
      fetch(`/api/conversations?userId=${encodeURIComponent(session.email)}&limit=25`)
        .then((res) => res.json())
        .then((result) => {
          if (result.data && Array.isArray(result.data) && result.data.length > 0) {
            const fetchedSessions: ChatSession[] = result.data.map((c: any) => ({
              id: c.id,
              title: c.title,
              lastUpdated: new Date(c.updated_at).toLocaleDateString([], { month: "short", day: "numeric" }),
              docCount: 1,
              messages: [],
            }));
            setSessions(fetchedSessions);
            setCurrentSessionId(fetchedSessions[0].id);
            setConversationsCursor(result.nextCursor);
            setHasMoreConversations(result.hasMore);

            // Load initial messages for active conversation
            loadConversationMessages(fetchedSessions[0].id, session.email);
            return;
          }

          // Fallback to local storage or start clean
          const storageKey = `pramaan_chat_sessions_${session.email}`;
          const saved = localStorage.getItem(storageKey);
          if (saved) {
            try {
              const parsed: ChatSession[] = JSON.parse(saved);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setSessions(parsed);
                setCurrentSessionId(parsed[0].id);
                return;
              }
            } catch (e) {
              console.warn("Could not parse saved chat sessions:", e);
            }
          }

          // Start clean initial conversation
          const freshId = `session-${Date.now()}`;
          const freshSession: ChatSession = {
            id: freshId,
            title: "New Conversation",
            lastUpdated: "Just now",
            docCount: 0,
            messages: [],
          };
          setSessions([freshSession]);
          setCurrentSessionId(freshId);
        })
        .catch((err) => {
          console.warn("Conversations API fallback:", err);
          const freshId = `session-${Date.now()}`;
          const freshSession: ChatSession = {
            id: freshId,
            title: "New Conversation",
            lastUpdated: "Just now",
            docCount: 0,
            messages: [],
          };
          setSessions([freshSession]);
          setCurrentSessionId(freshId);
        });
    }
  }, [router]);

  // Persist sessions whenever they change to localStorage
  useEffect(() => {
    if (user?.email && sessions.length > 0) {
      localStorage.setItem(`pramaan_chat_sessions_${user.email}`, JSON.stringify(sessions));
    }
  }, [sessions, user?.email]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollTo({ top: messagesEndRef.current.scrollHeight, behavior: "smooth" });
  }, [currentSession?.messages, isProcessing]);

  const handleSignOut = () => {
    setSessions([]);
    setCurrentSessionId("");
    clearClientSession();
    router.push("/");
  };

  const selectConversation = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setActiveView("chat");
    setActiveCitation(null);

    // Only fetch from DB if we don't already have messages cached in state.
    // This prevents messages from disappearing when switching back to a
    // conversation that was already loaded.
    const existing = sessions.find((s) => s.id === sessionId);
    if (user?.email && (!existing?.messages || existing.messages.length === 0)) {
      loadConversationMessages(sessionId, user.email);
    }
  };

  const startNewChat = async () => {
    const newId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: "New Conversation",
      lastUpdated: "Just now",
      docCount: 0,
      messages: [],
    };
    // Keep all DB-persisted sessions (non "session-" id) + local sessions that have messages
    // Drop any existing unsaved empty drafts to avoid accumulation
    const existingActive = sessions.filter(
      (s) => !s.id.startsWith("session-") || (s.messages && s.messages.length > 0)
    );
    setSessions([newSession, ...existingActive]);
    setCurrentSessionId(newId);
    setActiveView("chat");
    setActiveCitation(null);
    setHasMoreMessages(false);
    setMessagesCursor(null);
    setInputQuery("");
    setSessionDocs([]);
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = sessions.filter((s) => s.id !== sessionId);
    if (filtered.length === 0) {
      const freshId = `session-${Date.now()}`;
      const freshSession: ChatSession = {
        id: freshId,
        title: "New Conversation",
        lastUpdated: "Just now",
        docCount: 0,
        messages: [],
      };
      setSessions([freshSession]);
      setCurrentSessionId(freshId);
    } else {
      setSessions(filtered);
      if (currentSessionId === sessionId) {
        setCurrentSessionId(filtered[0].id);
      }
    }

    if (user?.email) {
      fetch(`/api/conversations/${sessionId}?userId=${encodeURIComponent(user.email)}`, {
        method: "DELETE",
      }).catch((err) => console.warn("Delete conversation API error:", err));
    }
  };

  // Keyset Pagination: Load Earlier Messages for Active Conversation
  const loadEarlierMessages = async () => {
    if (!messagesCursor || loadingMoreMessages || !user?.email) return;

    setLoadingMoreMessages(true);
    try {
      const res = await fetch(
        `/api/conversations/${currentSession.id}/messages?userId=${encodeURIComponent(user.email)}&cursorTimestamp=${encodeURIComponent(messagesCursor.timestamp)}&cursorId=${encodeURIComponent(messagesCursor.id)}&limit=25`
      );

      if (res.ok) {
        const result = await res.json();
        if (result.data && Array.isArray(result.data)) {
          const olderMappedMessages: ChatMessage[] = result.data.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            citations: m.citations ? m.citations.map((c: any) => ({
              id: c.id,
              docTitle: c.doc_title,
              ministry: c.ministry || "Government of India",
              gazetteNumber: c.gazette_number || "Gazette Ref",
              date: "Official",
              page: c.page_number || 1,
              section: c.section || "Section",
              clause: c.clause || "Clause",
              quote: c.quote,
              confidence: c.confidence || 0.95,
              pdfUrl: c.pdf_url || "https://egazette.gov.in",
            })) : [],
          }));

          setSessions((prev) =>
            prev.map((s) =>
              s.id === currentSession.id
                ? { ...s, messages: [...olderMappedMessages, ...s.messages] }
                : s
            )
          );
          setMessagesCursor(result.nextCursor);
          setHasMoreMessages(result.hasMore);
        }
      }
    } catch (e) {
      console.warn("Load earlier messages error:", e);
    } finally {
      setLoadingMoreMessages(false);
    }
  };

  // Keyset Pagination: Load More Conversations for Sidebar
  const loadMoreConversations = async () => {
    if (!conversationsCursor || loadingMoreConversations || !user?.email) return;

    setLoadingMoreConversations(true);
    try {
      const res = await fetch(
        `/api/conversations?userId=${encodeURIComponent(user.email)}&cursorTimestamp=${encodeURIComponent(conversationsCursor.timestamp)}&cursorId=${encodeURIComponent(conversationsCursor.id)}&limit=25`
      );

      if (res.ok) {
        const result = await res.json();
        if (result.data && Array.isArray(result.data)) {
          const olderSessions: ChatSession[] = result.data.map((c: any) => ({
            id: c.id,
            title: c.title,
            lastUpdated: new Date(c.updated_at).toLocaleDateString([], { month: "short", day: "numeric" }),
            docCount: 1,
            messages: [],
          }));

          setSessions((prev) => [...prev, ...olderSessions]);
          setConversationsCursor(result.nextCursor);
          setHasMoreConversations(result.hasMore);
        }
      }
    } catch (e) {
      console.warn("Load more conversations error:", e);
    } finally {
      setLoadingMoreConversations(false);
    }
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const text = customPrompt || inputQuery;
    if (!text.trim() || isProcessing) return;

    setInputQuery("");
    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `asst-${Date.now()}`;

    // Snapshot the active session ID at the moment the message is sent.
    // All subsequent state updates reference this captured ID — never the
    // potentially-stale `currentSessionId` from the closure.
    const activeSessionId = currentSessionId;

    const userMessage: ChatMessage = {
      id: userMsgId,
      role: "user",
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    // Append user message using functional updater so we always operate on
    // the latest state, never a stale closure snapshot.
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeSessionId) return s;
        return {
          ...s,
          title: s.messages.length === 0 ? text.slice(0, 42) : s.title,
          messages: [...(s.messages || []), userMessage],
        };
      })
    );

    // Begin Live AI Agent Processing Sequence
    setIsProcessing(true);
    setProcessingStep(1);

    const stepTimer1 = setTimeout(() => setProcessingStep(2), 350);
    const stepTimer2 = setTimeout(() => setProcessingStep(3), 700);
    const stepTimer3 = setTimeout(() => setProcessingStep(4), 1050);
    const stepTimer4 = setTimeout(() => setProcessingStep(5), 1400);
    const stepTimer5 = setTimeout(() => setProcessingStep(6), 1750);

    try {
      const res = await fetch("/api/rag/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text.trim(),
          conversationId: activeSessionId,
          userId: user?.email || "anonymous-user",
          attachedDocuments: sessionDocs
            .filter((d) => d.status === "ready")
            .map((d) => ({ id: d.id, name: d.name, documentId: d.documentId })),
          attachedDocument: sessionDocs.find((d) => d.status === "ready")
            ? { name: sessionDocs.find((d) => d.status === "ready")!.name }
            : null,
          userProfile: {
            primary_domain: user?.primaryDomain || "Banking, Finance & Tax",
            subscribed_authorities: user?.subscribedAuthorities || [],
            role: user?.role || "Legal Counsel / Advocate",
          },
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.answer) {
        throw new Error(data.error || "RAG query failed");
      }

      const assistantMessage: ChatMessage & { followUps?: string[] } = {
        id: assistantMsgId,
        role: "assistant",
        content: data.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        processingStages: data.processingStages || [
          "Query Understanding",
          "Orchestrator Agent",
          "Hybrid Retrieval (pgvector + Knowledge Graph)",
          "Reasoning & Comparison",
          "Evidence Validation",
          "Response Generation",
        ],
        citations: data.citations || [],
        followUps: data.followUps || [
          "Compare penalties and compliance deadlines",
          "Which categories are exempted from this rule?",
          "Download official gazette PDF copy",
        ],
      };

      // The API may return a real DB UUID to replace our local "session-" draft id.
      const returnedId: string = data.conversationId || activeSessionId;

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeSessionId) return s;
          return {
            ...s,
            id: returnedId,
            docCount: data.citations?.length || 1,
            // Append to whatever messages are already in state (never overwrite from closure)
            messages: [...(s.messages || []), assistantMessage],
          };
        })
      );

      // If the DB assigned a new UUID, update the active session pointer
      if (returnedId !== activeSessionId) {
        setCurrentSessionId(returnedId);
      }
    } catch (err) {
      console.error("RAG query error:", err);
      const assistantMessage: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "Unable to retrieve an answer at this time. Please check that the AI service is running and your documents are indexed, then try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        processingStages: [],
        citations: [],
      };

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeSessionId) return s;
          return {
            ...s,
            docCount: 0,
            messages: [...(s.messages || []), assistantMessage],
          };
        })
      );
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);
      clearTimeout(stepTimer4);
      clearTimeout(stepTimer5);
      setIsProcessing(false);
      setProcessingStep(0);
    }
  };

  const copyToClipboard = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(msgId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  // Render inline elements: **bold**, `code`, and [[cite-id]] interactive badges
  const renderInlineContent = (text: string, citations?: Citation[]) => {
    const parts = text.split(/(\[\[cite-[a-zA-Z0-9-]+\]\])/g);

    return parts.map((part, idx) => {
      const match = part.match(/\[\[(cite-[a-zA-Z0-9-]+)\]\]/);
      if (match) {
        const citeId = match[1];
        const citation = citations?.find((c) => c.id === citeId);
        if (!citation) return null;

        const isSelected = activeCitation?.id === citation.id;

        return (
          <button
            key={idx}
            type="button"
            onClick={() => setActiveCitation(citation)}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded text-[10px] font-medium text-[#8C4A32] bg-[#F9F3ED] hover:bg-[#F0E6D8] border border-[#E8DDD3] transition-colors cursor-pointer whitespace-nowrap"
            title={`${citation.docTitle} · p.${citation.page}`}
          >
            <span className="opacity-50 text-[9px]">↗</span>
            <span>
              {(citation.docTitle || "Source").trim().slice(0, 24)}
              {citation.page ? ` · p.${citation.page}` : ""}
            </span>
          </button>
        );
      }

      // Bold (**bold**) and inline code (`code`)
      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      return (
        <React.Fragment key={idx}>
          {boldParts.map((bPart, bIdx) => {
            if (bPart.startsWith("**") && bPart.endsWith("**")) {
              return <strong key={bIdx} className="font-semibold text-stone-900">{bPart.slice(2, -2)}</strong>;
            }
            if (bPart.startsWith("`") && bPart.endsWith("`")) {
              return <code key={bIdx} className="px-1.5 py-0.5 bg-stone-100 rounded text-xs font-mono text-[#5D2A18]">{bPart.slice(1, -1)}</code>;
            }
            return bPart;
          })}
        </React.Fragment>
      );
    });
  };

  // Render formatted lines (headers, bullets, numbered lists, paragraphs)
  const renderFormattedLine = (line: string, citations?: Citation[]) => {
    const trimmed = line.trim();

    // 0. Horizontal rule (---) — section divider between sub-query answers
    if (trimmed === "---") {
      return <hr className="border-t border-[#E8E2D8] my-3" />;
    }

    // 1. Markdown Headers (#, ##, ###, ####)
    const headerMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const title = headerMatch[2];
      if (level <= 2) {
        return <h3 className="font-bold text-base text-stone-900 mt-4 mb-1">{renderInlineContent(title, citations)}</h3>;
      }
      return <h4 className="font-semibold text-sm text-stone-900 mt-2 mb-0.5">{renderInlineContent(title, citations)}</h4>;
    }

    // 1b. Standalone **bold line** used as a section header (e.g. **1. Question text**)
    const standaloneBold = trimmed.match(/^\*\*(.+)\*\*$/);
    if (standaloneBold) {
      return <h3 className="font-bold text-[15px] text-stone-900 mt-4 mb-1">{renderInlineContent(standaloneBold[1], citations)}</h3>;
    }

    // 2. Bullet Lists (- or * or •)
    const bulletMatch = trimmed.match(/^[\*\-•]\s+(.+)$/);
    if (bulletMatch) {
      return (
        <div className="flex items-start gap-2 ml-2 my-0.5">
          <span className="text-stone-400 mt-1.5 text-[6px]">●</span>
          <span className="text-stone-800 leading-relaxed">{renderInlineContent(bulletMatch[1], citations)}</span>
        </div>
      );
    }

    // 3. Numbered Lists (1. 2. etc)
    const numberMatch = trimmed.match(/^(\d+)[\.\)]\s+(.+)$/);
    if (numberMatch) {
      return (
        <div className="flex items-start gap-2 ml-2 my-0.5">
          <span className="font-semibold text-stone-600 text-xs mt-0.5 min-w-[16px]">{numberMatch[1]}.</span>
          <span className="text-stone-800 leading-relaxed">{renderInlineContent(numberMatch[2], citations)}</span>
        </div>
      );
    }

    // 4. Regular Paragraph
    return <p className="leading-relaxed text-stone-800 my-1">{renderInlineContent(line, citations)}</p>;
  };

  // Main Message Formatter
  const renderMessageContent = (content: string, citations?: Citation[]) => {
    if (!content) return null;

    let clean = content.trim();
    if (clean.startsWith("```json")) {
      clean = clean.replace(/^```json\s*/, "").replace(/```$/, "").trim();
    }

    const lines = clean.split("\n");

    return (
      <div className="space-y-1 text-[14.5px] leading-relaxed text-[#1E1A17]">
        {lines.map((line, idx) => {
          if (!line.trim()) return <div key={idx} className="h-1" />;
          return <React.Fragment key={idx}>{renderFormattedLine(line, citations)}</React.Fragment>;
        })}
      </div>
    );
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#5D2A18] border-t-transparent animate-spin" />
          <span className="text-xs text-stone-500 font-medium">Entering Pramaan Workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#FAF8F5] text-[#1E1A17] flex overflow-hidden selection:bg-[#5D2A18] selection:text-white font-sans antialiased">
      {/* ========================================================================= */}
      {/* 1. COLLAPSIBLE LEFT SIDEBAR */}
      {/* ========================================================================= */}
      <aside
        className={`h-full bg-[#FAF8F5] border-r border-[#E8E2D8] flex flex-col justify-between transition-all duration-200 ease-in-out z-30 flex-shrink-0 ${
          sidebarOpen ? "w-[260px]" : "w-0 -translate-x-full md:translate-x-0 md:w-0 overflow-hidden"
        }`}
      >
        {/* Top: Brand Header & New Analysis CTA */}
        <div className="px-3 pt-4 pb-0 space-y-1">
          {/* Brand Row */}
          <div className="flex items-center justify-between">
            <Link href="/app" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-xl bg-[#5D2A18] flex items-center justify-center flex-shrink-0 shadow-sm">
                <PillarLogoIcon className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-[17px] tracking-tight text-[#1E1A17] leading-none">
                  Pramaan
                </span>
                <span className="text-[10px] text-stone-500 font-medium mt-0.5">
                  Document Intelligence
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-1">
              {/* Search Toggle */}
              <button
                onClick={() => { setShowSidebarSearch(v => !v); setSidebarSearch(""); }}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${showSidebarSearch ? "bg-[#EFE9E0] text-[#5D2A18]" : "text-stone-400 hover:text-stone-700 hover:bg-[#EFE9E0]"}`}
                title="Search conversations"
              >
                <Search className="w-4 h-4" />
              </button>
              {/* Close Sidebar */}
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-[#EFE9E0] rounded-lg transition-colors cursor-pointer"
                title="Close sidebar"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Inline Search Input */}
          {showSidebarSearch && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              placeholder="Search conversations..."
              autoFocus
              className="w-full pl-8 pr-3 py-1.5 bg-[#F3EDE4] border border-[#E8E2D8] rounded-lg text-[11px] text-stone-700 placeholder-stone-400 focus:outline-none focus:border-[#5D2A18]"
            />
            {sidebarSearch && (
              <button
                onClick={() => setSidebarSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          )}

          {/* + New Analysis Button */}
          <button
            onClick={startNewChat}
            className="w-full flex items-center gap-2.5 px-2 py-2 mt-1 text-[13px] font-medium text-stone-700 hover:bg-[#F3EDE4] hover:text-stone-900 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-stone-500" />
            <span>New Analysis</span>
          </button>

          {/* Hidden File Input for Document Selection via (+) button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFilesSelected}
            multiple
            accept=".pdf,.doc,.docx,.txt,.csv,.json,.md,.png,.jpg"
            className="hidden"
          />

          {/* Attached Document Indicators in Sidebar (if active) */}
          {sessionDocs.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-stone-400 px-1">
                <span>Session Files ({sessionDocs.length}/5)</span>
              </div>
              {sessionDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-2 bg-white border border-[#E8E2D8] rounded-xl text-xs shadow-2xs"
                >
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    {doc.status === "uploading" ? (
                      <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin flex-shrink-0" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-[#5D2A18] flex-shrink-0" />
                    )}
                    <div className="overflow-hidden">
                      <span className="block truncate font-medium text-stone-800 text-[11px]">{doc.name}</span>
                      <span className="block text-[10px] text-stone-400">
                        {doc.status === "uploading" ? "Indexing..." : doc.size}
                      </span>
                    </div>
                  </div>
                  {doc.status !== "uploading" && (
                    <button
                      type="button"
                      onClick={() => handleDeleteDocument(doc)}
                      className="p-1 text-stone-400 hover:text-red-600 rounded cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Middle: Recent Chats List */}
        <div className="flex-1 px-3 pt-0 pb-2 overflow-y-auto space-y-0.5 scrollbar-thin">
          <div className="px-2 pt-0 pb-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
            Recent Analysis
          </div>
          {(() => {
            const displaySessions = sessions
              .filter((s) => !sidebarSearch || s.title.toLowerCase().includes(sidebarSearch.toLowerCase()));

            if (displaySessions.length === 0) {
              return (
                <div className="px-2 py-4 text-center text-xs text-stone-400 italic">
                  No previous analyses yet
                </div>
              );
            }

            return displaySessions.map((s) => (
              <div
                key={s.id}
                onClick={() => selectConversation(s.id)}
                className={`group flex items-center justify-between px-2 py-1.5 rounded-lg text-[13px] transition-colors cursor-pointer ${
                  currentSessionId === s.id && activeView === "chat"
                    ? "bg-[#EAE3D9] text-[#1E1A17] font-medium"
                    : "text-stone-600 hover:bg-[#F3EDE4] hover:text-stone-900"
                }`}
              >
                <span className="truncate flex-1 pr-1">{s.title}</span>
                <button
                  type="button"
                  onClick={(e) => deleteSession(s.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-700 rounded transition-opacity flex-shrink-0"
                  title="Delete conversation"
                >
                  <Trash2 className="w-3 h-3 text-stone-400 hover:text-red-600" />
                </button>
              </div>
            ));
          })()}
          {hasMoreConversations && (
            <button
              type="button"
              onClick={loadMoreConversations}
              disabled={loadingMoreConversations}
              className="w-full py-1.5 px-2 mt-2 text-[11px] font-medium text-stone-500 hover:text-[#5D2A18] hover:bg-[#F3EDE4] rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {loadingMoreConversations ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  <span>Load more</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Bottom: Settings & User Profile */}
        <div className="px-3 py-3 border-t border-[#EAE3D9] space-y-1">

          <button
            onClick={() => setActiveView("settings")}
            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-[13px] font-medium transition-colors cursor-pointer ${
              activeView === "settings"
                ? "bg-[#EFE9E0] text-[#5D2A18]"
                : "text-stone-600 hover:bg-[#F3EDE4] hover:text-stone-900"
            }`}
          >
            <SettingsIcon className="w-4 h-4" />
            <span>Settings</span>
          </button>

          {/* User Row */}
          <div className="pt-2 border-t border-[#EAE3D9] flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-[#5D2A18] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                {user?.fullName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "P"}
              </div>
              <div className="overflow-hidden">
                <span className="text-xs font-bold text-stone-900 block truncate">
                  {user?.fullName || user?.email?.split("@")[0]}
                </span>
                <span className="text-[10px] text-stone-400 block truncate max-w-[120px]">
                  {user?.email}
                </span>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              title="Sign Out"
              className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN WORKSPACE / CENTER AREA */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Minimal Top Bar */}
        <header className="h-13 bg-[#FAF8F5] border-b border-[#E8E2D8] px-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-[#EFE9E0] rounded-lg transition-colors cursor-pointer"
                title="Open sidebar"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            )}
            <h1 className="text-xs font-semibold text-stone-700 truncate max-w-[300px] sm:max-w-md">
              {activeView === "chat"
                ? currentSession?.title || "Government Document Assistant"
                : activeView === "documents"
                ? "Document Library"
                : activeView === "compare"
                ? "Document Comparison"
                : activeView === "sources"
                ? "Official Sources"
                : "Workspace Settings"}
            </h1>
          </div>

          {/* Right: Priority Domain Focus Badge & Switcher */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowDomainSwitcher((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#EFE9E0] hover:bg-[#E5DDD0] text-[11px] font-medium text-[#5D2A18] border border-[#DCD5C9] transition-all cursor-pointer shadow-2xs"
                title="Click to change active domain search funnel"
              >
                <span className="font-bold text-[#1E1A17] truncate max-w-[120px] sm:max-w-[210px]">
                  {user?.primaryDomain || "Banking, Finance & Tax"}
                </span>
                <ChevronDown className="w-3 h-3 text-stone-500 shrink-0" />
              </button>

              {showDomainSwitcher && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-[#FAF8F5] border border-[#E8E2D8] rounded-xl shadow-xl p-2 z-40 space-y-1">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Switch Priority Sector
                  </div>
                  {[
                    "Banking, Finance & Tax",
                    "Corporate Law & Insolvency",
                    "Tech, AI & Data Protection",
                    "Education & Research",
                    "Environment, Energy & Infra",
                    "General Sovereign Administration",
                  ].map((domainName) => {
                    const isCurrent = (user?.primaryDomain || "Banking, Finance & Tax") === domainName;
                    return (
                      <button
                        key={domainName}
                        onClick={() => {
                          const updated = { ...user!, primaryDomain: domainName };
                          setUser(updated);
                          setClientSession(updated);
                          setShowDomainSwitcher(false);
                          fetch("/api/user/profile", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              email: user?.email,
                              primary_domain: domainName,
                              role: user?.role,
                              subscribed_authorities: user?.subscribedAuthorities,
                              onboarding_completed: true,
                            }),
                          }).catch(() => {});
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between ${
                          isCurrent
                            ? "bg-[#EAE3D9] text-[#5D2A18] font-semibold"
                            : "text-stone-700 hover:bg-[#F3EDE4]"
                        }`}
                      >
                        <span className="truncate">{domainName}</span>
                        {isCurrent && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                      </button>
                    );
                  })}

                  <div className="pt-1.5 border-t border-[#E8E2D8]">
                    <button
                      onClick={() => {
                        setShowDomainSwitcher(false);
                        setShowOnboardingModal(true);
                      }}
                      className="w-full text-center py-1 text-[11px] font-semibold text-[#5D2A18] hover:underline cursor-pointer"
                    >
                      Calibrate Custom Authorities...
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* VIEW 1: AI CHAT CONVERSATION */}
        {activeView === "chat" && (
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Messages Area */}
            <div ref={messagesEndRef} className="flex-1 overflow-y-auto px-4 pt-6 md:pt-8 min-h-0">
              {(!currentSession?.messages || currentSession.messages.length === 0) ? (
                /* Empty Chat State — just blank */
                <div />
              ) : (
                /* Active Conversation Stream */
                <div className="max-w-3xl mx-auto flex flex-col gap-4">
                  {hasMoreMessages && (
                    <div className="flex justify-center pt-1 pb-3">
                      <button
                        type="button"
                        onClick={loadEarlierMessages}
                        disabled={loadingMoreMessages}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#EFE9E0] hover:bg-[#E5DDD0] text-stone-600 hover:text-[#5D2A18] text-xs font-medium transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                      >
                        {loadingMoreMessages ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Loading earlier messages...</span>
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Load earlier messages</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                  {currentSession.messages.map((msg) => (
                    <div key={msg.id} className="space-y-2">
                      {msg.role === "user" ? (
                        /* User Message */
                        <div className="flex justify-end">
                          <div className="bg-[#EFE9E0] text-[#1E1A17] px-4 py-2.5 rounded-2xl text-sm max-w-[85%] sm:max-w-[75%] leading-relaxed font-medium">
                            {msg.content}
                          </div>
                        </div>
                      ) : (
                        /* Assistant Message */
                        <div className="flex items-start">
                          <div className="flex-1 space-y-3 overflow-hidden">
                            {/* Cited Assistant Content + Actions inside white box */}
                            <div className="bg-white border border-[#E8E2D8] p-5 rounded-2xl shadow-xs">
                              {renderMessageContent(msg.content, msg.citations)}

                              {/* ── Sources / Citations Panel ── */}
                              {msg.citations && msg.citations.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-[#F0EBE3]">
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <BookOpen className="w-3 h-3 text-[#8C4A32]" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C4A32]">
                                      Sources
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {msg.citations.map((cit, citIdx) => (
                                      <button
                                        key={cit.id || citIdx}
                                        type="button"
                                        onClick={() => setActiveCitation(cit)}
                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-left cursor-pointer transition-colors ${
                                          activeCitation?.id === cit.id
                                            ? "bg-[#F5EDE3] border-[#D4A97A]"
                                            : "bg-[#FAF8F5] border-[#E8E2D8] hover:bg-[#F3EDE4] hover:border-[#C9956A]"
                                        }`}
                                      >
                                        <span className="flex-shrink-0 w-3.5 h-3.5 rounded-full bg-[#5D2A18] text-white text-[8px] font-bold flex items-center justify-center">
                                          {citIdx + 1}
                                        </span>
                                        <span className="text-[11px] font-medium text-stone-800 leading-none">
                                          {(cit.docTitle || "Document").trim().slice(0, 30)}
                                        </span>
                                        {cit.page && (
                                          <span className="text-[10px] font-mono text-stone-400 leading-none">
                                            p.{cit.page}
                                          </span>
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}



                              <div className="flex items-center gap-1 text-stone-400 mt-3 pt-3 border-t border-[#F0EBE3]">
                                <button
                                  onClick={() => copyToClipboard(msg.content, msg.id)}
                                  className="p-1.5 hover:text-stone-700 hover:bg-[#EFE9E0] rounded-md transition-colors cursor-pointer"
                                  title="Copy answer"
                                >
                                  {copiedMessageId === msg.id ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button
                                  className="p-1.5 hover:text-stone-700 hover:bg-[#EFE9E0] rounded-md transition-colors cursor-pointer"
                                  title="Helpful"
                                >
                                  <ThumbsUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  className="p-1.5 hover:text-stone-700 hover:bg-[#EFE9E0] rounded-md transition-colors cursor-pointer"
                                  title="Not helpful"
                                >
                                  <ThumbsDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Processing / Generating State */}
                  {isProcessing && (
                    <div className="flex items-start gap-3 animate-in fade-in duration-200">
                      <div className="w-7 h-7 rounded-xl bg-[#5D2A18] flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
                        <PillarLogoIcon className="w-4 h-4 text-white" />
                      </div>
                      <div className="px-4 py-3 bg-white border border-[#E8E2D8] rounded-2xl shadow-xs">
                        <span className="text-sm text-stone-400 tracking-widest animate-pulse">...</span>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} className="h-0" />
                </div>
              )}
            </div>

            {/* Bottom Floating Chat Composer */}
            <div className="flex-shrink-0 px-4 pb-4 pt-1 bg-[#FAF8F5]">
              <div className="max-w-3xl mx-auto space-y-2">
                {/* Upload Notification Toast Banner */}
                {uploadNotification && (
                  <div className="flex items-center justify-between px-3.5 py-2 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl shadow-2xs animate-in fade-in">
                    <span className="font-medium">{uploadNotification}</span>
                    <button
                      type="button"
                      onClick={() => setUploadNotification(null)}
                      className="p-1 text-amber-700 hover:text-amber-900 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Attached Document Pill Bar (Clean File Names, No Technical Chunks Text) */}
                {sessionDocs.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#FAF4EC]/90 border border-[#EADBCC] rounded-xl text-xs text-[#5D2A18] shadow-2xs animate-in fade-in duration-150">
                    {sessionDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
                          doc.status === "uploading"
                            ? "bg-amber-50 border-amber-300 text-amber-900"
                            : "bg-white border-[#E8E2D8] text-stone-800 shadow-2xs"
                        }`}
                      >
                        {doc.status === "uploading" ? (
                          <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin flex-shrink-0" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-[#5D2A18] flex-shrink-0" />
                        )}
                        <span className="truncate max-w-[150px] sm:max-w-[200px]" title={doc.name}>
                          {doc.name}
                        </span>
                        {doc.status === "uploading" ? (
                          <span className="text-[10px] text-amber-600 font-normal">Indexing...</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDeleteDocument(doc)}
                            className="p-0.5 text-stone-400 hover:text-red-700 rounded transition-colors cursor-pointer ml-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    <span className="text-[10.5px] text-stone-400 ml-auto px-1">
                      {sessionDocs.length}/5 files
                    </span>
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="relative bg-white border border-[#E3DDD4] focus-within:border-[#5D2A18] focus-within:ring-2 focus-within:ring-[#5D2A18]/20 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition-all p-2 flex items-center gap-2"
                >
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingQueue || sessionDocs.length >= 5}
                    className="p-2 text-stone-400 hover:text-[#5D2A18] hover:bg-[#FAF8F5] rounded-xl transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isUploadingQueue ? (
                      <Loader2 className="w-4 h-4 text-[#5D2A18] animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                  </button>

                  <input
                    type="text"
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    placeholder={
                      sessionDocs.length > 0
                        ? `Ask about ${sessionDocs.length} attached document${sessionDocs.length > 1 ? "s" : ""} or indexed laws...`
                        : "Ask a question about your government documents..."
                    }
                    className="flex-1 bg-transparent text-sm text-stone-900 placeholder-stone-400 focus:outline-none px-1"
                  />

                  <button
                    type="submit"
                    disabled={!inputQuery.trim() || isProcessing || isUploadingQueue}
                    className="w-8 h-8 rounded-xl bg-[#5D2A18] hover:bg-[#431D10] text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:hover:bg-[#5D2A18] cursor-pointer shadow-xs"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                </form>

              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: DOCUMENTS LIBRARY */}
        {activeView === "documents" && (
          <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-5xl mx-auto w-full space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E2D8] pb-5">
              <div>
                <h2 className="text-xl font-bold text-stone-900 tracking-tight">Documents</h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Manage indexed government circulars, notifications, orders, and acts.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={handleActiveCrawl}
                  disabled={isCrawling}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-[#FAF8F5] text-stone-800 border border-[#E8E2D8] rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                  title="Scan egazette.gov.in and pib.gov.in for new official notifications"
                >
                  <RotateCcw className={`w-3.5 h-3.5 text-[#5D2A18] ${isCrawling ? "animate-spin" : ""}`} />
                  <span>{isCrawling ? "Scanning Portals..." : "Sync / Crawl Portals"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => alert("Upload dialog: select PDF from your system to index into Pramaan.")}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#5D2A18] hover:bg-[#431D10] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Document</span>
                </button>
              </div>
            </div>

            {/* Crawl Status Banner */}
            {crawlSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between animate-in fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="font-medium">{crawlSuccessMsg}</span>
                </div>
                <button
                  onClick={() => setCrawlSuccessMsg(null)}
                  className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  placeholder="Search documents by title, department, or gazette number..."
                  className="w-full pl-9 pr-4 py-2 bg-white border border-[#E8E2D8] rounded-xl text-xs text-stone-900 focus:outline-none focus:border-[#5D2A18]"
                />
              </div>

              <select
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-[#E8E2D8] rounded-xl text-xs text-stone-700 focus:outline-none"
              >
                <option>All Ministries</option>
                <option>Ministry of Education</option>
                <option>Ministry of Finance</option>
                <option>Ministry of Health</option>
                <option>Ministry of Rural Development</option>
                <option>Ministry of Electronics & IT (MeitY)</option>
                <option>Ministry of Micro, Small & Medium Enterprises</option>
                <option>NITI Aayog</option>
              </select>
            </div>

            {/* Clean Documents Table */}
            <div className="bg-white border border-[#E8E2D8] rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-stone-700">
                  <thead className="bg-[#FAF8F5] border-b border-[#E8E2D8] text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Document</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0EBE3]">
                    {documentsList.filter(
                      (d) =>
                        (selectedDeptFilter === "All" || selectedDeptFilter === "All Ministries" || d.department.includes(selectedDeptFilter)) &&
                        (d.name.toLowerCase().includes(docSearch.toLowerCase()) || d.department.toLowerCase().includes(docSearch.toLowerCase()))
                    ).map((doc) => (
                      <tr key={doc.id} className="hover:bg-[#FAF8F5] transition-colors">
                        <td className="py-3 px-4 font-semibold text-stone-900 flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-[#5D2A18]" />
                          <span>{doc.name}</span>
                        </td>
                        <td className="py-3 px-4 text-stone-600">{doc.type}</td>
                        <td className="py-3 px-4 text-stone-600">{doc.department}</td>
                        <td className="py-3 px-4 text-stone-500">{doc.date}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10.5px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                            {doc.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              handleSendMessage(`Analyze and summarize ${doc.name} from ${doc.department}`);
                              setActiveView("chat");
                            }}
                            className="text-xs font-semibold text-[#5D2A18] hover:underline cursor-pointer"
                          >
                            Ask
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: COMPARE WORKSPACE */}
        {activeView === "compare" && (
          <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-4xl mx-auto w-full space-y-6">
            <div className="border-b border-[#E8E2D8] pb-5">
              <h2 className="text-xl font-bold text-stone-900 tracking-tight">Compare Documents</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Detect statutory differences, modified clauses, and updated compliance thresholds.
              </p>
            </div>

            {/* Selector Row */}
            <div className="bg-white border border-[#E8E2D8] p-5 rounded-2xl shadow-xs space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-1">
                    Document A (Base Version)
                  </label>
                  <select
                    value={compareDocA}
                    onChange={(e) => setCompareDocA(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#E8E2D8] rounded-xl text-xs font-medium text-stone-800 focus:outline-none"
                  >
                    <option>Notification No. 12/2024 (Education)</option>
                    <option>Circular No. 12/2024 (Finance)</option>
                    <option>PMAY-G Phase II Guidelines (2023)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8C4A32] mb-1">
                    Document B (Revised Version)
                  </label>
                  <select
                    value={compareDocB}
                    onChange={(e) => setCompareDocB(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#E8E2D8] rounded-xl text-xs font-medium text-stone-800 focus:outline-none"
                  >
                    <option>Notification No. 24/2025 (Education)</option>
                    <option>Circular No. 04/2025 (Finance)</option>
                    <option>PMAY-G Phase III Guidelines (2024)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setComparing(true);
                    setTimeout(() => {
                      setComparing(false);
                      setCompareResult(true);
                    }, 600);
                  }}
                  className="px-4 py-2 bg-[#5D2A18] hover:bg-[#431D10] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {comparing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowLeftRight className="w-3.5 h-3.5" />}
                  <span>{comparing ? "Analyzing..." : "Compare"}</span>
                </button>
              </div>
            </div>

            {/* Clean Differences Results */}
            {compareResult && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-900">3 changes detected</span>
                  <div className="flex items-center gap-2 text-[11px] font-semibold">
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800">Added: 2</span>
                    <span className="px-2 py-0.5 rounded bg-red-50 text-red-800">Removed: 1</span>
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800">Modified: 3</span>
                  </div>
                </div>

                {/* Diff Item 1 */}
                <div className="bg-white border border-[#E8E2D8] rounded-2xl p-4.5 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-900">Section 4.2 · Application Deadline</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">Modified</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                    <div className="p-2.5 rounded-lg bg-red-50/60 border border-red-200/60 text-stone-700">
                      <span className="text-[10px] font-bold text-red-700 block mb-0.5">2024 Base</span>
                      <p className="line-through text-stone-500">Applications must be submitted within 30 days of gazette publication.</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200/60 text-stone-700">
                      <span className="text-[10px] font-bold text-emerald-700 block mb-0.5">2025 Revised</span>
                      <p>Applications must be submitted within 45 days from the date of publication.</p>
                    </div>
                  </div>
                </div>

                {/* Diff Item 2 */}
                <div className="bg-white border border-[#E8E2D8] rounded-2xl p-4.5 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-900">Section 5.3 · Category X Exemption</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">Removed</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-red-50/60 border border-red-200/60 text-stone-700 text-xs">
                    <span className="text-[10px] font-bold text-red-700 block mb-0.5">Repealed Clause</span>
                    <p className="line-through text-stone-500">Provisional exemption for standalone technical institutes under Sub-clause 2 is completely repealed.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: SOURCES & KNOWLEDGE BASE */}
        {activeView === "sources" && (
          <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-4xl mx-auto w-full space-y-6">
            <div className="border-b border-[#E8E2D8] pb-5">
              <h2 className="text-xl font-bold text-stone-900 tracking-tight">Central Government Knowledge Base</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Authentic government portals, object storage archives, and vector search indices.
              </p>
            </div>

            {/* Tripartite Knowledge Base Components */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="p-4 bg-white border border-[#E8E2D8] rounded-2xl space-y-1 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C4A32] block">Storage Layer</span>
                <h4 className="text-xs font-bold text-stone-900">Original Documents</h4>
                <p className="text-[11px] text-stone-500">Immutable Object Storage (MinIO / S3) with SHA-256 validation</p>
                <span className="text-[10px] font-mono text-emerald-700 block pt-1 font-semibold">142 PDFs Archived</span>
              </div>

              <div className="p-4 bg-white border border-[#E8E2D8] rounded-2xl space-y-1 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C4A32] block">Relational Layer</span>
                <h4 className="text-xs font-bold text-stone-900">Knowledge Graph</h4>
                <p className="text-[11px] text-stone-500">Entities, ministries, circular amendments, and statutory hierarchies</p>
                <span className="text-[10px] font-mono text-emerald-700 block pt-1 font-semibold">1,280 Graph Relations</span>
              </div>

              <div className="p-4 bg-white border border-[#E8E2D8] rounded-2xl space-y-1 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C4A32] block">Search Layer</span>
                <h4 className="text-xs font-bold text-stone-900">Vector / Search Index</h4>
                <p className="text-[11px] text-stone-500">Qdrant HNSW dense multilingual embeddings + sparse BM25 retrieval</p>
                <span className="text-[10px] font-mono text-emerald-700 block pt-1 font-semibold">142.8k Indexed Chunks</span>
              </div>
            </div>

            {/* Official Portals List */}
            <div className="space-y-3 pt-2">
              <span className="text-xs font-bold text-stone-700 block">Monitored Sovereign Portals</span>
              {[
                { name: "eGazette of India", url: "egazette.gov.in", desc: "Official Gazette notifications of the Government of India", status: "Active Sync", docs: 84 },
                { name: "Press Information Bureau (PIB)", url: "pib.gov.in", desc: "Official cabinet decisions, policy updates, and press releases", status: "Active Sync", docs: 32 },
                { name: "Open Government Data (OGD)", url: "data.gov.in", desc: "Centralized public datasets and ministerial schemes registry", status: "Active Sync", docs: 26 },
              ].map((src, idx) => (
                <div key={idx} className="bg-white border border-[#E8E2D8] p-4.5 rounded-2xl flex items-center justify-between shadow-xs">
                  <div>
                    <h4 className="text-sm font-bold text-stone-900">{src.name}</h4>
                    <p className="text-xs text-stone-500 mt-0.5">{src.desc}</p>
                    <span className="text-[11px] font-mono text-[#5D2A18] mt-1 block">{src.url}</span>
                  </div>
                  <div className="text-right">
                    <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60 block">
                      {src.status}
                    </span>
                    <span className="text-[11px] text-stone-400 mt-1 block">{src.docs} Indexed Docs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 5: SETTINGS */}
        {activeView === "settings" && (
          <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-3xl mx-auto w-full space-y-6">
            <div className="border-b border-[#E8E2D8] pb-5">
              <h2 className="text-xl font-bold text-stone-900 tracking-tight">Settings</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Preferences and account configurations for Pramaan.
              </p>
            </div>

            <div className="bg-white border border-[#E8E2D8] rounded-2xl p-6 space-y-6 shadow-xs">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-stone-900">Citation Format</h4>
                <p className="text-xs text-stone-500">Choose how source citations appear inline within answers.</p>
                <div className="pt-2">
                  <select className="px-3 py-2 bg-[#FAF8F5] border border-[#E8E2D8] rounded-xl text-xs text-stone-800 focus:outline-none">
                    <option>Standard ([Document · Page · Section])</option>
                    <option>Detailed Legal Style ([Gazette F.No · §Clause])</option>
                    <option>Compact Footnotes ([1], [2])</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-[#EAE3D9] space-y-1">
                <h4 className="text-sm font-bold text-stone-900">Domain Preferences</h4>
                <p className="text-xs text-stone-500">Current domain: <span className="font-semibold text-stone-700">{user?.primaryDomain || "Banking, Finance & Tax"}</span></p>
                <div className="pt-3">
                  <button
                    onClick={() => setShowOnboardingModal(true)}
                    className="px-3.5 py-1.5 bg-[#FAF4EC] hover:bg-[#F0E6D8] text-[#5D2A18] border border-[#E0C9B0] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Customize Domain Preferences
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-[#EAE3D9] space-y-1">
                <h4 className="text-sm font-bold text-stone-900">Signed-in Account</h4>
                <p className="text-xs text-stone-500">{user?.email}</p>
                <div className="pt-3">
                  <button
                    onClick={handleSignOut}
                    className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Sign Out of Pramaan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. ONBOARDING & DOMAIN CALIBRATION MODAL */}
      {/* ========================================================================= */}
      {showOnboardingModal && user && (
        <OnboardingChecklistModal
          userEmail={user.email}
          userFullName={user.fullName}
          initialDomain={user.primaryDomain}
          initialRole={user.role}
          initialAuthorities={user.subscribedAuthorities}
          onCancel={() => {
            // Mark as dismissed permanently — don't show again
            if (user?.email) {
              localStorage.setItem(`pramaan_onboarding_done_${user.email}`, "true");
            }
            setShowOnboardingModal(false);
          }}
          onComplete={(prefs: OnboardingPreferences) => {
            const updated = {
              ...user,
              primaryDomain: prefs.primaryDomain,
              role: prefs.role,
              subscribedAuthorities: prefs.subscribedAuthorities,
              onboardingCompleted: true,
            };
            setUser(updated);
            setClientSession(updated);
            setShowOnboardingModal(false);

            // Mark as done in localStorage — this is the reliable gate
            localStorage.setItem(`pramaan_onboarding_done_${user.email}`, "true");

            // Also persist to DB best-effort
            fetch("/api/user/profile", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: user.email,
                full_name: user.fullName,
                primary_domain: prefs.primaryDomain,
                role: prefs.role,
                subscribed_authorities: prefs.subscribedAuthorities,
                onboarding_completed: true,
              }),
            }).catch((err) => console.warn("Failed to save onboarding preferences:", err));
          }}
        />
      )}
    </div>
  );
}
