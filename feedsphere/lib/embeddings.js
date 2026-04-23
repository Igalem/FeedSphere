export async function generateEmbedding(text) {
  const model = "sentence-transformers/all-MiniLM-L6-v2";
  const url = `https://api-inference.huggingface.co/models/${model}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.HUGGINGFACE_TOKEN && { "Authorization": `Bearer ${process.env.HUGGINGFACE_TOKEN}` }),
      },
      body: JSON.stringify({ inputs: text }),
    });

    if (!response.ok) {
      const error = await response.text();
      // Handle model loading state (Hugging Face sometimes returns a 503 while loading)
      if (response.status === 503) {
        console.log("[Embeddings] Model is loading, retrying in 2s...");
        await new Promise(r => setTimeout(r, 2000));
        return generateEmbedding(text);
      }
      throw new Error(`Hugging Face API Error: ${error}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("[Embeddings] Generation failed:", error);
    throw error;
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
