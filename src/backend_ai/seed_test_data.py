"""
seed_test_data.py
-----------------
Inserts real embedded test document chunks into Supabase for retrieval testing.
Run once:  python seed_test_data.py
"""

import os
import uuid
from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client

load_dotenv()

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
supabase = create_client(
    os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
    os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
)

DOCUMENTS = [
    {
        "title": "CBDT Circular No. 6/2024 — TDS Rates FY 2024-25",
        "ministry": "Ministry of Finance",
        "doc_type": "Circular",
        "gazette_number": "F.No. 275/192/2024-IT(B)",
        "publication_date": "2024-04-05",
    },
    {
        "title": "RBI Master Direction — KYC Norms 2024",
        "ministry": "Reserve Bank of India",
        "doc_type": "Master Direction",
        "gazette_number": "RBI/2024-25/18",
        "publication_date": "2024-05-10",
    },
    {
        "title": "NEP 2020 — UGC Credit Framework Notification",
        "ministry": "Ministry of Education",
        "doc_type": "Notification",
        "gazette_number": "F.No. 1-3/2024-U.III",
        "publication_date": "2024-03-15",
    },
]

CHUNKS = [
    {
        "doc_idx": 0,
        "section": "Section 192 — TDS on Salary",
        "clause": "Clause 3.1 — Rate of Deduction",
        "page_number": 3,
        "content": (
            "Tax deduction at source on salary income for Financial Year 2024-25 shall be "
            "computed at the average rate of income tax based on the rates in force. For "
            "individuals with total income below Rs. 7 lakh, no TDS shall be deducted under "
            "the new tax regime as per Section 87A rebate provisions."
        ),
    },
    {
        "doc_idx": 0,
        "section": "Section 194C — TDS on Contractor Payments",
        "clause": "Clause 4.2 — Rate and Threshold",
        "page_number": 5,
        "content": (
            "TDS under Section 194C shall be deducted at 1% for payments to individual or HUF "
            "contractors and 2% for other contractors. No deduction shall be made where the "
            "aggregate annual payment does not exceed Rs. 1,00,000. The threshold for single "
            "transaction is Rs. 30,000."
        ),
    },
    {
        "doc_idx": 0,
        "section": "Section 194J — TDS on Professional Fees",
        "clause": "Clause 5.1 — Applicable Rate",
        "page_number": 7,
        "content": (
            "Tax deduction at source on fees for professional services under Section 194J is "
            "applicable at 10%. For technical services and royalty payments, the rate is "
            "reduced to 2% with effect from April 1, 2020 as amended by Finance Act 2020. "
            "Threshold limit for deduction is Rs. 30,000 per annum."
        ),
    },
    {
        "doc_idx": 1,
        "section": "Part II — Customer Due Diligence",
        "clause": "Clause 16 — KYC Documents",
        "page_number": 12,
        "content": (
            "Regulated entities shall obtain Officially Valid Documents (OVD) for identity "
            "and address verification. Aadhaar number, PAN card, Voter ID, Driving Licence, "
            "and Passport are accepted as OVDs. Video-based Customer Identification Process "
            "(V-CIP) is permitted as an alternate KYC method under RBI Master Direction 2024."
        ),
    },
    {
        "doc_idx": 1,
        "section": "Part III — Periodic Updation",
        "clause": "Clause 38 — Risk-Based Updation",
        "page_number": 21,
        "content": (
            "KYC updation shall be carried out on a risk-based approach: every 2 years for "
            "high-risk customers, every 8 years for medium-risk customers, and every 10 years "
            "for low-risk customers. Non-compliance may result in account freeze as per PMLA "
            "provisions notified by the Ministry of Finance."
        ),
    },
    {
        "doc_idx": 2,
        "section": "Section 4 — Credit Framework",
        "clause": "Clause 4.3 — Academic Bank of Credits",
        "page_number": 8,
        "content": (
            "Under the National Education Policy 2020, the Academic Bank of Credits (ABC) "
            "enables students to accumulate, transfer, and redeem academic credits earned "
            "from different higher education institutions. A minimum of 40 credits per year "
            "is required for a full-time undergraduate programme under the UGC Credit "
            "Framework Notification 2024."
        ),
    },
]


def embed(text: str):
    res = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text.replace("\n", " ").strip(),
        dimensions=1536,
    )
    return res.data[0].embedding


def seed():
    print("Seeding Supabase with test document chunks...\n")
    doc_ids = []

    for doc in DOCUMENTS:
        doc_id = str(uuid.uuid4())
        doc_ids.append(doc_id)
        try:
            supabase.table("documents").insert({
                "id": doc_id,
                "title": doc["title"],
                "ministry": doc["ministry"],
                "doc_type": doc["doc_type"],
                "gazette_number": doc["gazette_number"],
                "publication_date": doc["publication_date"],
                "file_url": "https://egazette.gov.in",
                "status": "Indexed",
            }).execute()
            print(f"  ✓ Document: {doc['title']}")
        except Exception as e:
            print(f"  ✗ Document insert failed: {e}")

    print("\nGenerating embeddings and inserting chunks...")
    for chunk in CHUNKS:
        doc_id = doc_ids[chunk["doc_idx"]]
        print(f"  Embedding: {chunk['section'][:55]}...")
        try:
            embedding = embed(chunk["content"])
            supabase.table("document_chunks").insert({
                "id": str(uuid.uuid4()),
                "document_id": doc_id,
                "content": chunk["content"],
                "section": chunk["section"],
                "clause": chunk["clause"],
                "page_number": chunk["page_number"],
                "embedding": embedding,
            }).execute()
            print(f"  ✓ Chunk: {chunk['clause']}")
        except Exception as e:
            print(f"  ✗ Chunk insert failed: {e}")

    print("\n✅ Done! Now test with POST /api/retrieval/query using:")
    print()
    print('  {"query": "TDS rate for contractor payments Section 194C"}')
    print('  {"query": "KYC document requirements RBI 2024"}')
    print('  {"query": "Academic Bank of Credits NEP undergraduate"}')
    print('  {"query": "TDS on professional fees technical services"}')


if __name__ == "__main__":
    seed()
