import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY || "";

export const openai = new OpenAI({
  apiKey,
});

/**
 * Generate 1536-dimensional embedding using text-embedding-3-small
 * Compatible with Supabase pgvector vector(1536)
 */
export async function createEmbedding(text: string): Promise<number[]> {
  try {
    const cleanText = text.replace(/\n+/g, " ").trim();
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: cleanText,
      dimensions: 1536,
    });

    return response.data[0].embedding;
  } catch (err) {
    console.error("OpenAI createEmbedding error:", err);
    throw err;
  }
}
