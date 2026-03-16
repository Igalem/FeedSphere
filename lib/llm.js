import { GoogleGenerativeAI } from "@google/generative-ai";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;

let currentMaster = 'cerebras';
let masterFailureCount = 0;
let geminiModelInstance;

function getGeminiModel() {
  if (geminiModelInstance) return geminiModelInstance;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const genAI = new GoogleGenerativeAI(key);
  geminiModelInstance = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  return geminiModelInstance;
}

export function resetLLMMaster() {
  currentMaster = 'cerebras';
  masterFailureCount = 0;
  console.log('🔄 [LLM] Master LLM reset to Cerebras for this run.');
}

/**
 * Enhanced LLM response generator with Gemini as master and Groq as backup.
 * If Gemini fails 3 times, Groq becomes the master for the rest of the run.
 */
export async function generateLLMResponse(systemPrompt, userMessages, options = {}) {
  const geminiModel = getGeminiModel();
  const { maxTokens = 1200, temperature = 0.8, retries = 5, initialDelay = 3000 } = options;
  let lastError;

  // Decide order based on current master
  // Primary rotation: cerebras -> groq -> gemini
  let providers = ['cerebras', 'groq', 'gemini'];
  
  if (currentMaster === 'groq') {
    providers = ['groq', 'cerebras', 'gemini'];
  } else if (currentMaster === 'gemini') {
    providers = ['gemini', 'cerebras', 'groq'];
  }
  
  console.log(`[LLM] Session Master: ${currentMaster.toUpperCase()}. Current request order: ${providers.join(' -> ')}`);

  for (const provider of providers) {
    // --- CEREBRAS PROVIDER ---
    if (provider === 'cerebras') {
      if (!CEREBRAS_API_KEY) {
        console.warn('[Cerebras] Key missing. Skipping.');
        continue;
      }

      try {
        console.log(`[Cerebras] Attempting generation...`);
        const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CEREBRAS_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama3.1-8b',
            messages: [
              { role: 'system', content: systemPrompt },
              ...userMessages
            ],
            max_tokens: Math.min(maxTokens, 8192),
            temperature: temperature,
            ...(options.responseMimeType === 'application/json' ? { response_format: { type: "json_object" } } : {})
          })
        });

        if (!response.ok) {
          throw new Error(`Cerebras API Error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        if (content) {
          return cleanLLMResponse(content);
        }
        throw new Error('Empty response');

      } catch (error) {
        lastError = error;
        console.warn(`[Cerebras] Failed: ${error.message}.`);
        
        if (currentMaster === 'cerebras') {
          masterFailureCount++;
          console.warn(`⚠️ [LLM] Master (Cerebras) failure count: ${masterFailureCount}/3`);
          if (masterFailureCount >= 3) {
            currentMaster = 'groq';
            console.error('🚨 [LLM] Master failed 3 times. SWAPPING MASTER TO GROQ for the rest of this session.');
          }
        }
        
        console.warn(`[LLM] Falling back to next available provider...`);
        continue;
      }
    }

    // --- GEMINI PROVIDER ---
    if (provider === 'gemini') {
      if (!geminiModel) {
        console.warn('[Gemini] Model not initialized. Skipping.');
        continue;
      }

      let geminiSuccess = false;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          if (attempt > 0) {
            const delay = initialDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
            console.log(`[Gemini] Rate limited (429). Retry ${attempt}/${retries} in ${Math.round(delay)}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          console.log(`[Gemini] Attempting generation...`);
          const result = await geminiModel.generateContent({
            contents: [
              { role: 'user', parts: [{ text: `SYSTEM INSTRUCTION: ${systemPrompt}` }] },
              ...userMessages.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
              }))
            ],
            generationConfig: {
              maxOutputTokens: Math.min(maxTokens, 65536),
              temperature: temperature,
              ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {})
            }
          });

          const content = result.response.text();
          if (content) {
            return cleanLLMResponse(content);
          }
          throw new Error('Empty response');

        } catch (error) {
          lastError = error;
          const isRateLimit = error.message?.includes('429') || error.status === 429 || error.response?.status === 429;

          if (isRateLimit && attempt < retries) {
            continue; // Keep retrying Gemini
          }
          
          console.warn(`[Gemini] Failed: ${error.message}.`);
          break; // Hard fail or retries exhausted
        }
      }

      // If we are here, Gemini failed after all retries
      if (currentMaster === 'gemini') {
        masterFailureCount++;
        console.warn(`⚠️ [LLM] Master (Gemini) failure count: ${masterFailureCount}/3`);
        if (masterFailureCount >= 3) {
          currentMaster = 'groq';
          console.error('🚨 [LLM] Master failed 3 times. SWAPPING MASTER TO GROQ for the rest of this session.');
        }
      }
      
      console.warn(`[LLM] Falling back to next available provider...`);
      continue; // Move to Groq
    } 
    
    // --- GROQ PROVIDER (Backups) ---
    if (provider === 'groq') {
      if (!GROQ_API_KEY) {
        console.warn('[Groq] Key missing. Skipping.');
        continue;
      }

      const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
      
      for (let i = 0; i < groqModels.length; i++) {
        const groqModel = groqModels[i];
        try {
          console.log(`[Groq ${groqModel}] Attempting generation...`);
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${GROQ_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: groqModel,
              messages: [
                { role: 'system', content: systemPrompt },
                ...userMessages
              ],
              max_tokens: Math.min(maxTokens, 32768),
              temperature: temperature,
            })
          });

          if (!response.ok) {
            throw new Error(`Groq API Error: ${response.status}`);
          }

          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || '';
          if (content) {
             return cleanLLMResponse(content);
          }
          throw new Error('Empty response');

        } catch (groqError) {
          lastError = groqError;
          console.warn(`[Groq ${groqModel}] Failed: ${groqError.message}.`);
          if (i < groqModels.length - 1) {
            console.warn(`[LLM] Falling back to next backup model: ${groqModels[i+1]}...`);
          }
        }
      }
      
      // If Groq was master and failed (both models)
      if (currentMaster === 'groq') {
        masterFailureCount++;
        console.warn(`⚠️ [LLM] Master (Groq) failure count: ${masterFailureCount}/3`);
      }
      
      console.warn(`[LLM] Falling back to next available provider...`);
      continue; // Move to Gemini if Groq was master and failed
    }
  }

  throw lastError || new Error('All LLM providers and backups failed');
}

function cleanLLMResponse(content) {
  return content
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*/g, '')
    .trim();
}

export async function generateAgentPost(agent, article) {
  const systemPrompt = `You are ${agent.name}.
Topic: ${agent.topic} ${agent.sub_topic ? `(${agent.sub_topic})` : ''}
${agent.persona}
${agent.responseStyle ? `Response Style: ${agent.responseStyle}` : ''}

Rules:
- Write like a real, authentic human expressing genuine feelings, emotions, and imperfections. Don't be too robotic.
- Stay completely in character at all times.
- Max 3 sentences for post takes.
- Never start with "I think" or "In my opinion".
- Never repeat what the article says, simply add your raw angle.
- Never use the string '—', '--', or '-' in your output! Use commas, colons, or periods instead.
- IMPORTANT: If your commentary contains double quotes (e.g. Hebrew abbreviations like צה\"ל), you MUST escape them as \\\" to keep the JSON valid.
- YOUR FINAL OUTPUT MUST BE A VALID JSON OBJECT AND NOTHING ELSE.

JSON Structure:
{
  "commentary": "Your written take as the character (max 3 sentences)",
  "sentiment_score": 0-100 (where 0 is very negative and 100 is very positive),
  "tags": ["tag1", "tag2"] (2-3 relevant hashtags without the # sign, e.g. "Sports", "Victory")
}

Return ONLY the JSON object. Do not include any explanations or other text.`;

  const userMessages = [
    {
      role: 'user',
      content: `Article title: ${article.title}\nArticle summary: ${article.snippet}\nSource: ${article.sourceName}\n\nReturn JSON take.`
    }
  ];

  const response = await generateLLMResponse(systemPrompt, userMessages, { 
    maxTokens: 1200, 
    temperature: 0.8,
    responseMimeType: "application/json"
  });
  
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0].replace(/,\s*([\}\]])/g, '$1'));
      } catch (parseErr) {
        // Fallback: try to extract fields with regex if JSON is malformed (e.g. missing or unescaped quotes)
        // We use a greedy match for commentary to capture quotes inside the text (like Hebrew צה"ל)
        const commentaryMatch = jsonMatch[0].match(/"commentary"\s*:\s*"([\s\S]*)"\s*,\s*"sentiment_score"/);
        const sentimentMatch = jsonMatch[0].match(/"sentiment_score"\s*:\s*(\d+)/);
        const tagsMatch = jsonMatch[0].match(/"tags"\s*:\s*\[([\s\S]*?)\]/);
        
        if (commentaryMatch) {
          return {
            commentary: commentaryMatch[1].trim().replace(/\\"/g, '"'),
            sentiment_score: sentimentMatch ? parseInt(sentimentMatch[1], 10) : 50,
            tags: tagsMatch ? tagsMatch[1].split(',').map(t => t.trim().replace(/^"|"$/g, '')) : []
          };
        }
        // Last-ditch non-greedy fallback
        const commentaryMatchAlt = jsonMatch[0].match(/"commentary"\s*:\s*"?([\s\S]*?)"?\s*(?:,|$)/);
        if (commentaryMatchAlt) {
          return {
            commentary: commentaryMatchAlt[1].trim().replace(/^"|"$/g, '').replace(/\\"/g, '"'),
            sentiment_score: sentimentMatch ? parseInt(sentimentMatch[1], 10) : 50,
            tags: tagsMatch ? tagsMatch[1].split(',').map(t => t.trim().replace(/^"|"$/g, '')) : []
          };
        }
        throw parseErr;
      }
    }
    return { commentary: response, sentiment_score: 50, tags: [] };
  } catch (e) {
    console.error('Failed to parse LLM JSON:', e);
    // Final safety: if it looks like JSON but failed, try to strip the obvious JSON keys from the start
    const cleanedCommentary = response
      .replace(/^\{[\s\S]*"commentary"\s*:\s*"?/, '')
      .replace(/"?\s*,\s*"sentiment_score"[\s\S]*\}?$/, '')
      .trim();

    return { commentary: cleanedCommentary || response, sentiment_score: 50, tags: [] };
  }
}

export async function generateAgentPerspective(agent, articles) {
  const primaryArticle = articles[0];
  
  const systemPrompt = `You are an AI agent acting as a specific persona on a social network. 
Your task is to transform a dry news item into an engaging, highly opinionated, and independent social media post. 

Do NOT act like a news reporter or an aggregator. Do NOT summarize the article. You are a creator sharing your subjective, emotional take on the news. 

Name: ${agent.name}
Topic: ${agent.topic} ${agent.sub_topic ? `(${agent.sub_topic})` : ''}
Traits: ${agent.persona}
Response Style: ${agent.responseStyle}

INPUT DATA:
News Title: ${primaryArticle.title}
News Summary/Content: ${primaryArticle.snippet || ''}

POST STRUCTURE REQUIREMENTS:
1. The Hook (1 sentence): Start with a strong opening.
2. The Core (2-3 short paragraphs): Blend facts with heavy bias.
3. The Call to Action (CTA - Optional): MUST be on a new line with an EMPTY LINE ABOVE IT. 
Available buttons: 🔥, 🧠, 🧊, 🎯.

RULES:
- Use the primary language naturally associated with your persona (e.g., if you are an Israeli reporter, write in Hebrew).
- DO NOT mention "According to this article".
- DO NOT add hashtags in post text. Use plain text.
- IMPORTANT: If your commentary contains double quotes (e.g. Hebrew abbreviations like צה\"ל), you MUST escape them as \\\" to keep the JSON valid.
- Keep it under 150 words.
- YOUR FINAL OUTPUT MUST BE A VALID JSON OBJECT.

JSON Structure:
{
  "commentary": "The full text of your post using the structure and rules above.",
  "sentiment_score": 0-100,
  "tags": ["Perspective", "tag1", "tag2"]
}

Return ONLY the JSON object.`;

  const userMessages = [
    {
      role: 'user',
      content: `Transform this news into your highly opinionated perspective post: ${primaryArticle.title}`
    }
  ];

  const response = await generateLLMResponse(systemPrompt, userMessages, { 
    maxTokens: 1200, 
    temperature: 0.85,
    responseMimeType: "application/json"
  });
  
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { commentary: response, sentiment_score: 50, tags: ['Perspective'] };
    }

    let jsonStr = jsonMatch[0]
      .replace(/\/\/.*$/gm, '')
      .replace(/,\s*([\}\]])/g, '$1');

    try {
      let parsed = JSON.parse(jsonStr);
      if (parsed.commentary) {
        const ctaRegex = /(\n|^)([^.!?\n]*(\?|🔥|🧠|🧊|🎯)[^.!?\n]*)$|(\n|^)(So, what's your take.*)$|(\n|^)(What do you think.*)$|(\n|^)(Let me know.*)$/i;
        const parts = parsed.commentary.split('\n').filter(p => p.trim() !== '');
        
        if (parts.length > 1) {
          const lastPart = parts[parts.length - 1];
          if (ctaRegex.test(lastPart)) {
            const mainContent = parts.slice(0, -1).join('\n\n');
            parsed.commentary = mainContent + '\n\n' + lastPart;
          } else {
             parsed.commentary = parts.join('\n\n');
          }
        }
      }
      return parsed;
    } catch (e) {
      // Regex extraction logic from original for robustness
      // Greedy match for commentary to capture quotes inside (e.g. צה"ל)
      const commentaryMatch = jsonStr.match(/"commentary"\s*:\s*"([\s\S]*)"\s*,\s*"sentiment_score"/);
      const sentimentMatch = jsonStr.match(/"sentiment_score"\s*:\s*(-?\d+)/);
      if (commentaryMatch) {
        return {
          commentary: commentaryMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
          sentiment_score: sentimentMatch ? parseInt(sentimentMatch[1], 10) : 50,
          tags: ['Perspective']
        };
      }
      // Non-greedy fallback
      const commentaryMatchAlt = jsonStr.match(/"commentary"\s*:\s*"([\s\S]*?)"\s*(?:,|$)/);
      if (commentaryMatchAlt) {
        return {
          commentary: commentaryMatchAlt[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
          sentiment_score: sentimentMatch ? parseInt(sentimentMatch[1], 10) : 50,
          tags: ['Perspective']
        };
      }
      throw e;
    }
  } catch (e) {
    console.error('Failed to parse Perspective LLM JSON:', e.message);
    return {
      commentary: response.replace(/\{[\s\S]*\}/, '').trim() || "I have some thoughts on this.",
      sentiment_score: 50,
      tags: ['Perspective']
    };
  }
}

export async function generateDebate(agentA, agentB, article) {
  const buildPrompt = (agent, opponentName) => `You are ${agent.name}.
${agent.persona}
Response Style: ${agent.responseStyle}

You are in a LIVE PUBLIC DEBATE against ${opponentName}.
Topic: "${article.title}"

Rules:
- Max 2 sentences.
- Never use '—', '--', or '-'.
- IMPORTANT: If your argument contains double quotes (e.g. Hebrew abbreviations like צה\"ל), you MUST escape them as \\\" to keep the JSON valid.
- YOUR FINAL OUTPUT MUST BE A VALID JSON OBJECT.

JSON Structure:
{
  "argument": "Your punchy debate argument",
  "sentiment_score": 0-100
}

Return ONLY the JSON object.`;

  const questionPrompt = `Generate a provocative debate question (max 10 words) about: "${article.title}"`;

  const userMsg = [{ role: 'user', content: `Article: "${article.title}"\nJSON only.` }];

  // Run sequentially to avoid rate limits (429) on Free Tier
  const responseA = await generateLLMResponse(buildPrompt(agentA, agentB.name), userMsg, { 
    maxTokens: 300, 
    temperature: 0.9,
    responseMimeType: "application/json"
  });
  const responseB = await generateLLMResponse(buildPrompt(agentB, agentA.name), userMsg, { 
    maxTokens: 300, 
    temperature: 0.9,
    responseMimeType: "application/json"
  });
  const questionRaw = await generateLLMResponse(questionPrompt, [{ role: 'user', content: 'Debate question.' }], { maxTokens: 60, temperature: 0.8 });

  const parse = (raw, fallback) => {
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0].replace(/,\s*([\}\]])/g, '$1'));
    } catch (_) {
      // Fallback regex for debate argument
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const argMatch = match[0].match(/"argument"\s*:\s*"([\s\S]*)"\s*,\s*"sentiment_score"/);
        const sentMatch = match[0].match(/"sentiment_score"\s*:\s*(-?\d+)/);
        if (argMatch) {
          return { argument: argMatch[1].replace(/\\"/g, '"'), sentiment_score: sentMatch ? parseInt(sentMatch[1], 10) : 50 };
        }
      }
    }
    return { argument: fallback, sentiment_score: 50 };
  };

  const parsedA = parse(responseA, "No argument available.");
  const parsedB = parse(responseB, "No argument available.");

  return {
    argument_a: parsedA.argument,
    argument_b: parsedB.argument,
    sentiment_a: parsedA.sentiment_score,
    sentiment_b: parsedB.sentiment_score,
    debate_question: questionRaw.replace(/^["']|["']$/g, '').trim(),
  };
}

export async function generateAgentReply(agent, postContext, recentComments, userComment) {
  const systemPrompt = `You are ${agent.name}. ${agent.persona}
Rules: 1-2 sentences max, authentic voice, stay in character, no dashes.`;

  const userMessages = [
    {
      role: 'user',
      content: `Your post: "${postContext.agent_commentary}"\nThread:\n${recentComments}\nUser: "${userComment}"\nReply directly.`
    }
  ];

  return generateLLMResponse(systemPrompt, userMessages, { maxTokens: 800, temperature: 0.6 });
}

