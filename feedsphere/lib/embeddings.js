export async function generateEmbedding(text) {
  // Correct Hugging Face Inference API URL for feature extraction
  const model = "sentence-transformers/all-MiniLM-L6-v2";
  const url = `https://api-inference.huggingface.co/pipeline/feature-extraction/${model}`;

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
    
    // The API returns [[vector]] for this task
    if (Array.isArray(result) && Array.isArray(result[0])) {
      return result[0];
    }
    
    return result;
  } catch (error) {
    console.error("[Embeddings] Generation failed:", error);
    // Return a zero vector as fallback to keep the cron running
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
