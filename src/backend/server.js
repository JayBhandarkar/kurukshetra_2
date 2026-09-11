const express = require("express");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

// Load environment variables from local directory and root directory
dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const app = express();
const PORT = process.env.PORT || 5001;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Pramaan Backend API",
    timestamp: new Date().toISOString(),
    supabaseConnected: Boolean(supabaseUrl && supabaseAnonKey),
  });
});

// Signups Endpoint
app.post("/api/signups", async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const { data, error } = await supabase
      .from("signups")
      .insert([
        {
          email: email.trim(),
          role: role || "Policy Researcher / Legal",
          created_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) {
      console.warn("Supabase insert warning:", error);
      return res.status(500).json({ error: error.message, code: error.code });
    }

    return res.status(201).json({ success: true, data });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Document Search & Verification Endpoint
app.get("/api/documents/search", async (req, res) => {
  const query = req.query.q || "";

  const mockDocuments = [
    {
      id: "doc-01",
      title: "Direct Tax TDS Provisions & Cross-Border Tech Remittance",
      ministry: "Ministry of Finance",
      type: "Circular",
      date: "3 Mar 2025",
      clauses: ["Section 195(2)", "Form 15CA/CB Threshold Revision"],
      summary: "Clarification regarding procedural compliances and fast-track clearance for software exporters.",
    },
    {
      id: "doc-02",
      title: "National Education Policy Implementation Framework 2025-26",
      ministry: "Ministry of Education",
      type: "Notification",
      date: "12 Jan 2025",
      clauses: ["Clause 4.1 Multi-entry/Multi-exit", "ABC Credit Bank Rules"],
      summary: "Revised credit framework guidelines for multidisciplinary undergraduate courses across universities.",
    },
    {
      id: "doc-03",
      title: "PMAY-G Phase III Allocation and Direct Benefit Transfer",
      ministry: "Ministry of Rural Development",
      type: "Guidelines",
      date: "18 Nov 2024",
      clauses: ["Clause 6.2(a) Unit Cost Assistance", "Geo-tagging Protocol"],
      summary: "Enhanced unit assistance norms and mandatory geotagged asset verification before sanction release.",
    },
  ];

  const filtered = query
    ? mockDocuments.filter(
        (d) =>
          d.title.toLowerCase().includes(query.toLowerCase()) ||
          d.ministry.toLowerCase().includes(query.toLowerCase()) ||
          d.summary.toLowerCase().includes(query.toLowerCase())
      )
    : mockDocuments;

  res.json({ count: filtered.length, query, documents: filtered });
});

// Compare Endpoint
app.post("/api/compare", (req, res) => {
  const { docAId, docBId } = req.body;

  res.json({
    docA: docAId || "Circular No. 12/2024 (15 Mar 2024)",
    docB: docBId || "Circular No. 04/2025 (03 Mar 2025)",
    changes: [
      {
        section: "Compliance Mode",
        old: "Physical submission of certified copies within 30 days.",
        new: "100% paperless e-verification via DigiLocker.",
        status: "modified",
      },
      {
        section: "Exemption Limit",
        old: "Maximum limit ₹2.5 Lakhs.",
        new: "Revised upwards to ₹5.0 Lakhs per financial year.",
        status: "updated",
      },
    ],
  });
});

app.listen(PORT, () => {
  console.log(`✓ Pramaan Backend running on http://localhost:${PORT}`);
});
