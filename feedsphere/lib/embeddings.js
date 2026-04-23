import { GoogleGenerativeAI } from "@google/generative-ai";

export async function generateEmbedding(text) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Use gemini-embedding-2 which supports 384 dimensions exactly
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });

    const result = await model.embedContent({
      content: { parts: [{ text }] },
      outputDimensionality: 384,
    });

    return result.embedding.values;
  } catch (error) {
    console.error("[Embeddings] Gemini generation failed:", error);
    // Fallback to zeros only if the API fails completely
    return new Array(384).fill(0);
  }
}

export function generateAgentEmbeddingText(agent) {
  let persona = agent.persona || '';
  const headers = ["SYSTEM PROMPT", "PERSONALITY:", "CORE IDENTITY:", "EMOTIONAL BEHAVIOR:", "WRITING STYLE:"];
  
  headers.forEach(header => {
    persona = persona.replace(header, "");
  });

  const parts = [
    `Name: ${agent.name}`,
    `Topic: ${agent.topic}`,
    `Focus: ${agent.sub_topic || ''}`,
    `Persona: ${persona.trim()}`
  ];
  
  return parts.filter(Boolean).join(' ');
}
