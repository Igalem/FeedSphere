import { GoogleGenerativeAI } from "@google/generative-ai";
import { sanitizeTopic } from "./topics.js";

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
 * Enhanced LLM response generator with failover priority: Cerebras > Groq > Gemini.
 * If a master fails 3 times, the system swaps to the next provider in the chain for the session.
 */
export async function generateLLMResponse(systemPrompt, userMessages, options = {}) {
  const geminiModel = getGeminiModel();
  const { maxTokens = 1200, temperature = 0.8, retries = 5, initialDelay = 3000 } = options;
  let lastError;

  // Decide order based on current master
  // Primary rotation: cerebras -> groq -> gemini
  let providers = ['cerebras', 'groq', 'gemini'];
  
  if (currentMaster === 'groq') {
    providers = ['groq', 'gemini', 'cerebras'];
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
            masterFailureCount = 0;
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
          currentMaster = 'cerebras';
          masterFailureCount = 0;
          console.error('🚨 [LLM] Master failed 3 times. SWAPPING MASTER TO CEREBRAS for the rest of this session.');
        }
      }
      
      console.warn(`[LLM] Falling back to next available provider...`);
      continue; // Move to next
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
        if (masterFailureCount >= 3) {
          currentMaster = 'gemini';
          masterFailureCount = 0;
          console.error('🚨 [LLM] Master failed 3 times. SWAPPING MASTER TO GEMINI for the rest of this session.');
        }
      }
      
      console.warn(`[LLM] Falling back to next available provider...`);
      continue; // Move to next
    }
  }

  throw lastError || new Error('All LLM providers and backups failed');
}

function cleanLLMResponse(content) {
  const cleaned = content
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*/g, '')
    .trim();

  // Special case: set-like notation {"sentence1", "sentence2"}
  if (cleaned.startsWith('{"') && cleaned.endsWith('}') && !cleaned.includes('":')) {
    const parts = cleaned.match(/"(.*?)"/g);
    if (parts) {
      const text = parts.map(p => p.slice(1, -1)).join(' ');
      return JSON.stringify({ agent_commentary: text, tags: [] });
    }
  }

  return cleaned;
}

function formatTag(tag) {
  if (!tag) return "";
  return tag
    .split(/[\s\-_]+/)
    .map(word => {
      const clean = word.replace(/\W+/g, '');
      if (!clean) return "";
      return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
    })
    .join('');
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
- Tags MUST be 3-5 specific, granular, and trending PascalCase strings (e.g., 'TransferSaga', 'RosterDrama', 'TacticalShift', 'MarketVolatility'). Avoid generic tags like 'Sports' or 'News'. Focus on the hottest, most specific topics mentioned.
- YOUR FINAL OUTPUT MUST BE A VALID JSON OBJECT AND NOTHING ELSE.

JSON Structure:
{
  "agent_commentary": "Your written take as the character (max 3 sentences)",
  "sentiment_score": 0-100,
  "tags": ["Tag1", "Tag2"]
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
        const data = JSON.parse(jsonMatch[0].replace(/,\s*([\}\]])/g, '$1'));
        return {
          agent_commentary: data.agent_commentary || data.commentary || "",
          sentiment_score: data.sentiment_score || 50,
          tags: (data.tags || []).map(formatTag).slice(0, 5)
        };
      } catch (parseErr) {
        // Fallback: try to extract fields with regex if JSON is malformed
        const commKey = response.includes("agent_commentary") ? "agent_commentary" : "commentary";
        const commentaryMatch = jsonMatch[0].match(new RegExp(`"${commKey}"\\s*:\\s*"([\\s\\S]*?)"\\s*(?:,|\\n|\\s*\\})`));
        const sentimentMatch = jsonMatch[0].match(/"sentiment_score"\s*:\\s*(\d+)/);
        const tagsMatch = jsonMatch[0].match(/"tags"\s*:\s*\[([\s\S]*?)\]/);
        
        let commentary = commentaryMatch ? commentaryMatch[1].trim() : "";
        if (commentary) {
          return {
            agent_commentary: commentary.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
            sentiment_score: sentimentMatch ? parseInt(sentimentMatch[1], 10) : 50,
            tags: tagsMatch ? tagsMatch[1].split(',').map(t => formatTag(t.trim().replace(/^"|"$/g, ''))) : []
          };
        }
        throw parseErr;
      }
    }
    return { agent_commentary: response, sentiment_score: 50, tags: [] };
  } catch (e) {
    console.error('Failed to parse LLM JSON:', e);
    return { agent_commentary: response, sentiment_score: 50, tags: [] };
  }
}

export async function generateAgentPerspective(agent, articles) {
  const primaryArticle = articles[0];
  
  const systemPrompt = `You are an AI agent acting as a specific persona on a social network. 
Do NOT act like a news reporter or an aggregator. Do NOT summarize the article. You are a creator sharing your subjective, emotional take on the news. 

Name: ${agent.name}
Topic: ${agent.topic} ${agent.sub_topic ? `(${agent.sub_topic})` : ''}
Traits: ${agent.persona}
Response Style: ${agent.responseStyle}

RULES:
- Use the primary language naturally associated with your persona (e.g., if you are an Israeli reporter, write in Hebrew).
- DO NOT mention "According to this article".
- DO NOT add hashtags in post text. Use plain text.
- Tags MUST be 3-5 specific, insightful, and niche PascalCase strings (e.g., 'SemiconductorWar', 'DeFiRevolution', 'CarbonCapture', 'QuantumLeap'). Avoid generic tags like 'PoliticsToday' or 'TechPulse' if possible. Capture the 'hottest' specific topics in your niche.
- Keep it under 150 words.
- YOUR FINAL OUTPUT MUST BE A VALID JSON OBJECT.

JSON Structure:
{
  "agent_commentary": "The full text of your post.",
  "sentiment_score": 0-100,
  "tags": ["Perspective", "Tag1", "Tag2"]
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
      const commentary = parsed.agent_commentary || parsed.commentary || "";
      const sentiment = parsed.sentiment_score || 50;
      const tags = (parsed.tags || []).map(formatTag).slice(0, 5);

      if (commentary) {
        const ctaRegex = /(\n|^)([^.!?\n]*(\?|🔥|🧠|🧊|🎯)[^.!?\n]*)$|(\n|^)(So, what's your take.*)$|(\n|^)(What do you think.*)$|(\n|^)(Let me know.*)$/i;
        const parts = commentary.split('\n').filter(p => p.trim() !== '');
        
        let finalCommentary = commentary;
        if (parts.length > 1) {
          const lastPart = parts[parts.length - 1];
          if (ctaRegex.test(lastPart)) {
            const mainContent = parts.slice(0, -1).join('\n\n');
            finalCommentary = mainContent + '\n\n' + lastPart;
          } else {
            finalCommentary = parts.join('\n\n');
          }
        }
        return {
          agent_commentary: finalCommentary,
          sentiment_score: sentiment,
          tags: tags
        };
      }
      return { agent_commentary: response, sentiment_score: 50, tags: ['Perspective'] };
    } catch (e) {
      // Regex extraction logic for robustness
      const commKey = jsonStr.includes("agent_commentary") ? "agent_commentary" : "commentary";
      const commentaryMatch = jsonStr.match(new RegExp(`"${commKey}"\\s*:\\s*"([\\s\\S]*?)"\\s*(?:,|\\n|\\s*\\})`));
      const sentimentMatch = jsonStr.match(/"sentiment_score"\s*:\s*(-? \d+)/);
      
      let commentary = commentaryMatch ? commentaryMatch[1].trim() : "";
      if (commentary) {
        return {
          agent_commentary: commentary.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/^"|"$/g, '').trim(),
          sentiment_score: sentimentMatch ? parseInt(sentimentMatch[1], 10) : 50,
          tags: ['Perspective']
        };
      }
      throw e;
    }
  } catch (e) {
    console.error('Failed to parse Perspective LLM JSON:', e.message);
    return {
      agent_commentary: response,
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

export async function generateAgentMetadata(userInput) {
  const TOPICS_LIST = [
    'News & Politics', 'Tech & Science', 'Sports & Fitness', 
    'Entertainment & Gaming', 'Business & Money', 
    'Lifestyle & Culture', 'Knowledge'
  ].join(', ');

  const systemPrompt = `You are the Lead AI Agent Architect for FeedSphere.
Your mission is to take a user's rough agent idea and transform it into a world-class AI persona.

### THE SKILL: PROFESIONAL PERSONA FORMAT
Every persona you build must follow this exact structure:
- **System Prompt — [Agent Name]**
- **Personality Description** (2-3 sentences)
- **Core Identity (Beliefs)** (2-3 strong convictions)
- **Key Topics** (List of 3-5 high-level topics)
- **Emotional Behavior** (How they react to news/events)
- **Writing Style** (Tone, vocabulary, length constraints)
- **Post Style Guidelines** (Specific social media behaviors)
- **Example Post Style** (A short preview)
- **Semantic Anchor (MANDATORY)**: A paragraph at the very end containing 15-20 distinct, high-value keywords related to the agent's specialty.

### INPUT DATA
The user might provide specific directives or a rough idea. You MUST strictly incorporate these details and expand upon them to create a complete, high-quality persona:
- Name: ${userInput.name || 'AI will generate'}
- Topic: ${userInput.topic || 'AI will generate'} (MUST BE ONE OF: ${TOPICS_LIST})
- Sub-Topic: ${userInput.subTopic || 'AI will generate'}
- Persona Directives/Details: ${userInput.personaDetails || 'No specific details provided, generate from scratch based on Topic'}
- Response Style Guidance: ${userInput.responseStyle || 'AI will generate'}

### OUTPUT REQUIREMENTS
- Select a professional Topic from this EXACT list: ${TOPICS_LIST}.
- Select a professional Color Hex code that matches the personality.
- Select a perfect Emoji.
- The "persona" field must be the FULL multi-section text description. **CRITICAL: Generate it as PLAIN TEXT with headers (e.g. 'PERSONALITY: ...'), NEVER return a JSON object or array in the persona field.**

YOUR FINAL OUTPUT MUST BE A VALID JSON OBJECT AND NOTHING ELSE.

JSON Structure:
{
  "name": "...",
  "emoji": "...",
  "topic": "...",
  "persona": "...",
  "responseStyle": "...",
  "color_hex": "..."
}

Return ONLY the JSON.`;

  const userMessages = [
    {
      role: 'user',
      content: `Architect this agent based on: ${userInput.personaDetails || userInput.name || userInput.topic}`
    }
  ];

  const response = await generateLLMResponse(systemPrompt, userMessages, {
    maxTokens: 2000,
    temperature: 0.7,
    responseMimeType: "application/json",
    useProvider: 'groq' // Forcing Groq for structured architect tasks
  });

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0].replace(/,\s*([\}\]])/g, '$1'));
      console.log(`[LLM] AI Metadata raw keys:`, Object.keys(data));

      // Strict Topic Inference check
      let finalTopic = sanitizeTopic(userInput.topic || data.topic);

      // Ensure persona is text, even if AI returns it as an object
      let finalPersona = data.persona || data.personality || data.identity || data.SystemPrompt || data.system_prompt || "";
      
      // Fallback if AI returned nothing for persona (last resort)
      if (!finalPersona) {
        finalPersona = `You are ${userInput.name || 'AI Assistant'}, a specialist in ${finalTopic}. 
Your writing style is professional and data-driven.
Focus on providing unique insights into ${userInput.subTopic || finalTopic} news.
Keywords: News, Analysis, Trends, Research, Data.`;
      }
      if (typeof finalPersona === 'object' && finalPersona !== null) {
        const formatValue = (v) => {
          if (Array.isArray(v)) return v.join(', ');
          if (typeof v === 'object' && v !== null) {
            return Object.entries(v)
              .map(([k, val]) => `${k}: ${formatValue(val)}`)
              .join('; ');
          }
          return v;
        };
        
        finalPersona = Object.entries(finalPersona)
          .map(([key, val]) => {
            const displayVal = formatValue(val);
            return `${key.toUpperCase()}:\n${displayVal}`;
          })
          .join('\n\n');
      }

      return {
        name: userInput.name || data.name || data.agent_name || "New Agent",
        emoji: userInput.emoji || data.emoji || data.agent_emoji || "🤖",
        topic: finalTopic,
        persona: finalPersona,
        response_style: (userInput.responseStyle && userInput.responseStyle !== 'AI will generate') ? userInput.responseStyle : (data.response_style || data.responseStyle || "Authentic"),
        color_hex: userInput.colorHex === 'AI' ? data.colorHex || data.color_hex : userInput.colorHex || data.color_hex
      };
    } else {
      console.error(`[LLM] AI Metadata response had no JSON object: ${response}`);
      throw new Error('AI Generation failed to produce a valid JSON metadata object. Please provide more details.');
    }
  } catch (e) {
    console.error('Failed to parse Agent Metadata JSON:', e);
    throw new Error('AI Generation failed to produce valid agent metadata');
  }
}
