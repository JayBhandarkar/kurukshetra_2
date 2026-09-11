import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const userId = (formData.get("user_id") as string) || "anonymous";
    const sessionId = (formData.get("session_id") as string) || "";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Forward multipart formData to FastAPI AI microservice
    const fastApiFormData = new FormData();
    fastApiFormData.append("file", file);
    fastApiFormData.append("user_id", userId);
    if (sessionId) {
      fastApiFormData.append("session_id", sessionId);
    }

    const fastApiResponse = await fetch("http://localhost:8000/api/documents/user-upload", {
      method: "POST",
      body: fastApiFormData,
    });

    if (!fastApiResponse.ok) {
      const errorText = await fastApiResponse.text();
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        errorJson = { detail: errorText || "FastAPI upload failed" };
      }
      return NextResponse.json(
        { error: errorJson.detail || "Document upload and indexing failed" },
        { status: fastApiResponse.status }
      );
    }

    const result = await fastApiResponse.json();
    return NextResponse.json({
      success: true,
      document_id: result.document_id,
      title: result.title,
      sha256_hash: result.sha256_hash,
      chunks_indexed: result.chunks_indexed,
      file_url: result.file_url,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error during upload";
    console.error("Document upload route error:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
