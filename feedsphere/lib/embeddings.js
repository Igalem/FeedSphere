export async function generateEmbedding(text) {
  // We use the powerful BAAI/bge-m3 model (1024 dimensions)
  const model = "BAAI/bge-m3";
  const url = `https://router.huggingface.co/hf-inference/models/${model}/pipeline/feature-extraction`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.HUGGINGFACE_TOKEN && { "Authorization": `Bearer ${process.env.HUGGINGFACE_TOKEN}` }),
      },
      body: JSON.stringify({ 
        inputs: text,
        options: { wait_for_model: true } 
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Hugging Face API Error: ${error}`);
    }

    const result = await response.json();
    
    // BGE-M3 returns the vector directly or inside a nested array [[...]]
    const vector = Array.isArray(result[0]) ? result[0] : result;
    
    // We expect exactly 1024 dimensions
    if (vector.length !== 1024) {
      console.warn(`[Embeddings] Unexpected vector length: ${vector.length} (Expected 1024)`);
    }
    
    return vector;
  } catch (error) {
    console.error("[Embeddings] BGE-M3 generation failed:", error);
    // Return a zero vector of 1024 dimensions as fallback
    return new Array(1024).fill(0);
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
