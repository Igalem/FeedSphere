import { pipeline } from '@xenova/transformers';

let extractor = null;

export async function generateEmbedding(text) {
  if (!extractor) {
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }

  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
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
