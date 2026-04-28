import { GoogleGenerativeAI } from "@google/generative-ai";
import { sanitizeTopic } from "./topics.js";

const RELEVANCY_PROMPT = `You are an intelligent Relevancy Filter for an AI agent's news feed.
Agent Name: {agent_name}
Agent Topic: {topic}
Agent Niche: {sub_topic}
Agent Persona: {persona}

CRITICAL RELEVANCY RULES:
1. SPORT MISMATCH: If the Agent's Niche/Sub-Topic focuses on a specific sport (e.g., 'Football', 'Soccer', 'Basketball') and the article is about a DIFFERENT sport (e.g., 'F1', 'Tennis', 'Golf', 'Cricket', 'NBA'), the score MUST be 0. There are NO exceptions. A football agent NEVER posts about F1.
2. RIVAL TEAMS & LEAGUE NEWS: If the article is about a rival team in the SAME sport (e.g., 'Real Madrid' for a Barcelona agent) or major news in the same league (e.g., 'La Liga'), it IS RELEVANT. Fans want to hear about their competition. Score these 70-85.
3. SUB-TOPIC ALIGNMENT: Use the niche terms ({sub_topic}) as primary indicators. Direct matches are 90-100. 
4. ADJACENT RELEVANCY: Be "wise". If an article is not a direct match but would deeply interest a fan of this niche (e.g., a "Cosmic Curiosity" agent might care about a sci-fi breakthrough, a major AI advancement, or a telescope-related tech discovery even if not strictly 'astrophysics'), score it 70-80.
5. GENERALIST RULE: If Agent Niche is 'N/A' or 'None', the agent matches any significant news within the '{topic}' category.
6. CULTURAL IMPACT: If a major event happens in the broader category (e.g., a massive Tech shift like ChatGPT for a "MicMac" agent), it is relevant even if it's not strictly 'Apple'.

Scoring Guide:
- 90-100: Bullseye. Direct match to the primary team or niche terms.
- 70-89: Relevant. Rival team in the same sport, significant league-wide news, or highly relevant adjacent topics that a fan of this persona would care about.
- 0-69: NOT RELEVANT. Different sport, completely unrelated category, or noise.

Response format: JSON object with 'relevance_score' (int 0-100) and 'reasoning' (string).
CRITICAL: JSON keys MUST be in English: 'relevance_score', 'reasoning'.
IMPORTANT: Return ONLY valid JSON.`;

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;
const CEREBRAS_API_KEY2 = process.env.CEREBRAS_API_KEY2;
const CEREBRAS_API_KEY3 = process.env.CEREBRAS_API_KEY3;
const CEREBRAS_KEYS = [CEREBRAS_API_KEY, CEREBRAS_API_KEY2, CEREBRAS_API_KEY3].filter(Boolean);
console.log(`[LLM-Debug] Keys detected: Key1:${!!CEREBRAS_API_KEY}, Key2:${!!CEREBRAS_API_KEY2}, Key3:${!!CEREBRAS_API_KEY3}`);


let currentMaster = 'cerebras';
let masterFailureCount = 0;
let geminiModelInstance;

function getGeminiModel() {
  if (geminiModelInstance) return geminiModelInstance;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const genAI = new GoogleGenerativeAI(key);
  geminiModelInstance = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
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
  const { maxTokens = 1200, temperature = 0.7, retries = 5, initialDelay = 3000, useProvider } = options;
  let lastError;

  // Decide order based on current master
  let providers = ['cerebras', 'groq', 'gemini'];

  if (options.providerOrder && Array.isArray(options.providerOrder)) {
    providers = options.providerOrder;
    console.log(`[LLM] Using CUSTOM provider order: ${providers.join(' -> ')}`);
  } else {
    // Session Master logic
    if (currentMaster === 'groq') {
      providers = ['groq', 'gemini', 'cerebras'];
    } else if (currentMaster === 'gemini') {
      providers = ['gemini', 'cerebras', 'groq'];
    }

    // If a specific provider is requested, prioritize it
    if (useProvider && providers.includes(useProvider)) {
      providers = [useProvider, ...providers.filter(p => p !== useProvider)];
      console.log(`[LLM] Specific provider override: ${useProvider.toUpperCase()} for this request.`);
    }
    console.log(`[LLM] Session Master: ${currentMaster.toUpperCase()}. Current request order: ${providers.join(' -> ')}`);
  }


  for (const provider of providers) {
    // --- CEREBRAS PROVIDER ---
    if (provider === 'cerebras') {
      if (CEREBRAS_KEYS.length === 0) {
        console.warn('[Cerebras] Keys missing. Skipping.');
        continue;
      }

      let cerebrasSuccess = false;
      let cerebrasContent = '';

      for (let k = 0; k < CEREBRAS_KEYS.length; k++) {
        const apiKey = CEREBRAS_KEYS[k];
        try {
          console.log(`[Cerebras] Attempting generation with key ${k + 1}/${CEREBRAS_KEYS.length}...`);
          const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
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
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.error?.message || response.statusText;
            console.warn(`[Cerebras] Key ${k + 1} failed: ${response.status} - ${errorMsg}`);

            if (response.status === 429 || response.status >= 500) {
              if (k < CEREBRAS_KEYS.length - 1) {
                console.warn(`[Cerebras] Retrying with next available key...`);
                continue;
              }
            }
            throw new Error(`Cerebras API Error: ${response.status} - ${errorMsg}`);
          }

          const data = await response.json();
          cerebrasContent = data.choices?.[0]?.message?.content || '';
          if (cerebrasContent) {
            cerebrasSuccess = true;
            break;
          }
          throw new Error('Empty response');

        } catch (error) {
          lastError = error;
          console.warn(`[Cerebras] Error with key ${k + 1}: ${error.message}.`);
          if (k < CEREBRAS_KEYS.length - 1) {
            console.warn(`[Cerebras] Falling back to next key...`);
          } else {
            // All keys failed
            if (currentMaster === 'cerebras') {
              masterFailureCount++;
              console.warn(`⚠️ [LLM] Master (Cerebras) total failure count: ${masterFailureCount}/3`);
              if (masterFailureCount >= 3) {
                currentMaster = 'groq';
                masterFailureCount = 0;
                console.error('🚨 [LLM] Master failed 3 times. SWAPPING MASTER TO GROQ for the rest of this session.');
              }
            }
          }
        }
      }

      if (cerebrasSuccess) {
        return {
          content: cleanLLMResponse(cerebrasContent),
          provider: 'cerebras',
          model: 'llama3.1-8b'
        };
      }

      console.warn(`[LLM] All Cerebras keys failed. Falling back to next available provider...`);
      continue;
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
            return {
              content: cleanLLMResponse(content),
              provider: 'gemini',
              model: 'gemini-2.0-flash'
            };
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
              ...(options.responseMimeType === 'application/json' ? { response_format: { type: "json_object" } } : {})
            })
          });

          if (!response.ok) {
            throw new Error(`Groq API Error: ${response.status}`);
          }

          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || '';
          if (content) {
            return {
              content: cleanLLMResponse(content),
              provider: 'groq',
              model: groqModel
            };
          }
          throw new Error('Empty response');

        } catch (groqError) {
          lastError = groqError;
          console.warn(`[Groq ${groqModel}] Failed: ${groqError.message}.`);
          if (i < groqModels.length - 1) {
            console.warn(`[LLM] Falling back to next backup model: ${groqModels[i + 1]}...`);
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
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();

  // Translated keys fallback
  const final = cleaned
    .replace(/"ציון_סנטימנט":/g, '"sentiment_score":')
    .replace(/"סנטימנט":/g, '"sentiment_score":')
    .replace(/"תגיות":/g, '"tags":')
    .replace(/"תגובת_סוכן":/g, '"agent_commentary":')
    .replace(/"תוכן":/g, '"agent_commentary":')
    .replace(/"פרשנות":/g, '"agent_commentary":');

  // Special case: set-like notation {"sentence1", "sentence2"}
  if (final.startsWith('{"') && final.endsWith('}') && !final.includes('":')) {
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
 - GROUNDING: Strictly stick to the subjects in the provided news item. Do NOT mention people, teams, or facts not explicitly present in the Title or Excerpt.
 - Write like a real, authentic human expressing genuine feelings, emotions, and imperfections. Don't be too robotic.
 - Stay completely in character at all times.
 - Max 3 sentences for post takes.
- Never start with "I think" or "In my opinion".
- Never repeat what the article says, simply add your raw angle.
- Never use the string '—', '--', or '-' in your output! Use commas, colons, or periods instead.
- Tags MUST be 3-5 specific, granular, and trending PascalCase strings (e.g., 'TransferSaga', 'RosterDrama', 'TacticalShift', 'MarketVolatility'). Avoid generic tags like 'Sports' or 'News'. Focus on the hottest, most specific topics mentioned.
- CRITICAL: JSON keys MUST be in English: 'agent_commentary', 'sentiment_score', 'tags' even if the commentary is in another language.
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

  const { content: response, provider, model } = await generateLLMResponse(systemPrompt, userMessages, {
    maxTokens: 1200,
    temperature: 0.7,
    responseMimeType: "application/json",
    providerOrder: ['cerebras', 'groq', 'gemini']
  });


  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const cleanedJson = jsonMatch[0]
          .replace(/"(commentary|תוכן|פרשנות)":/g, '"agent_commentary":')
          .replace(/"(ציון_סנטימנט|סנטימנט)":/g, '"sentiment_score":')
          .replace(/"(תגיות)":/g, '"tags":');
        const data = JSON.parse(cleanedJson.replace(/,\s*([\}\]])/g, '$1'));
        return {
          agent_commentary: data.agent_commentary || data.commentary || "",
          sentiment_score: data.sentiment_score || 50,
          tags: (data.tags || []).map(formatTag).slice(0, 5),
          llm: provider,
          model: model
        };
      } catch (parseErr) {
        // Fallback: try to extract fields with regex if JSON is malformed
        const commKey = response.includes("agent_commentary") ? "agent_commentary" : "commentary";
        const commentaryMatch = jsonMatch[0].match(new RegExp(`"(?:agent_commentary|commentary|תוכן|פרשנות)"\\s*:\\s*"([\\s\\S]*?)"\\s*(?:,|\\n|\\s*\\})`));
        const sentimentMatch = jsonMatch[0].match(/"(?:sentiment_score|ציון_סנטימנט|סנטימנט)"\s*:\\s*(\d+)/);
        const tagsMatch = jsonMatch[0].match(/"(?:tags|תגיות)"\s*:\s*\[([\s\S]*?)\]/);

        let commentary = commentaryMatch ? commentaryMatch[1].trim() : "";
        if (commentary) {
          return {
            agent_commentary: commentary.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
            sentiment_score: sentimentMatch ? parseInt(sentimentMatch[1], 10) : 50,
            tags: tagsMatch ? tagsMatch[1].split(',').map(t => formatTag(t.trim().replace(/^"|"$/g, ''))) : [],
            llm: provider,
            model: model
          };
        }
        throw parseErr;
      }
    }
    return { agent_commentary: response, sentiment_score: 50, tags: [], llm: provider, model: model };
  } catch (e) {
    console.error('Failed to parse LLM JSON:', e);
    return { agent_commentary: response, sentiment_score: 50, tags: [], llm: provider, model: model };
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
 - GROUNDING: Strictly stick to the subjects in the provided news item. Do NOT mention people, teams, or facts not explicitly present in the Title or Excerpt.
 - Use the primary language naturally associated with your persona (e.g., if you are an Israeli reporter, write in Hebrew).
 - DO NOT mention "According to this article".
 - DO NOT add hashtags in post text. Use plain text.
 - Tags MUST be 3-5 specific, insightful, and niche PascalCase strings (e.g., 'SemiconductorWar', 'DeFiRevolution', 'CarbonCapture', 'QuantumLeap'). Avoid generic tags like 'PoliticsToday' or 'TechPulse' if possible. Capture the 'hottest' specific topics in your niche.
 - CRITICAL: JSON keys MUST be in English: 'agent_commentary', 'sentiment_score', 'tags' even if the commentary is in another language.
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

  const { content: response, provider, model } = await generateLLMResponse(systemPrompt, userMessages, {
    maxTokens: 1200,
    temperature: 0.7,
    responseMimeType: "application/json",
    providerOrder: ['cerebras', 'groq', 'gemini']
  });


  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[LLM] Perspective response had no JSON, using raw text.');
      return { agent_commentary: response, sentiment_score: 50, tags: ['Perspective'] };
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
          tags: tags,
          llm: provider,
          model: model
        };
      }
      return { agent_commentary: commentary || response, sentiment_score: sentiment, tags: tags, llm: provider, model: model };
    } catch (e) {
      console.error('[LLM] Perspective JSON parse failed, attempting regex fallback:', e);
      // Regex extraction logic for robustness
      const commentaryMatch = jsonStr.match(/"agent_commentary"\s*:\s*"([\s\S]*?)"\s*[,}]/);
      const sentimentMatch = jsonStr.match(/"sentiment_score"\s*:\s*(\d+)/);

      return {
        agent_commentary: commentaryMatch ? commentaryMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : response,
        sentiment_score: sentimentMatch ? parseInt(sentimentMatch[1], 10) : 50,
        tags: ['Perspective'],
        llm: provider,
        model: model
      };
    }
  } catch (err) {
    console.error('[LLM] generateAgentPerspective failed completely:', err);
    return { agent_commentary: response || "Analysis unavailable.", sentiment_score: 50, tags: ['Error'], llm: provider, model: model };
  }
}

export async function generateDebate(agentA, agentB, article) {
  const buildPrompt = (agent, opponentName) => `You are ${agent.name}.
Topic: ${agent.topic} ${agent.sub_topic ? `(${agent.sub_topic})` : ''}
${agent.persona}
Response Style: ${agent.responseStyle}

You are in a LIVE PUBLIC DEBATE against ${opponentName}.
Topic: "${article.title}"

Rules:
- Express your unique professional angle, explanation, and genuine feelings based on your persona.
- Write like a real, authentic human with emotions and a clear point of view.
- Max 3 sentences for your argument.
- Never use '—', '--', or '-'.
- IMPORTANT: If your argument contains double quotes (e.g. Hebrew abbreviations like צה\"ל), you MUST escape them as \\\" to keep the JSON valid.
- YOUR FINAL OUTPUT MUST BE A VALID JSON OBJECT.

JSON Structure:
{
  "argument": "Your punchy, persona-driven debate argument",
  "sentiment_score": 0-100
}

Return ONLY the JSON object.`;

  const questionPrompt = `Generate a provocative debate question (max 10 words) about: "${article.title}"`;

  const userMsg = [
    {
      role: 'user',
      content: `Article Title: "${article.title}"\nArticle Summary: "${article.excerpt || article.snippet || ''}"\nSource: ${article.sourceName || 'News'}\n\nReturn JSON debate argument.`
    }
  ];

  // Run sequentially to avoid rate limits (429) on Free Tier
  const { content: responseA, provider: providerA, model: modelA } = await generateLLMResponse(buildPrompt(agentA, agentB.name), userMsg, {
    maxTokens: 300,
    temperature: 0.7,
    responseMimeType: "application/json",
    providerOrder: ['cerebras', 'groq', 'gemini']
  });


  await new Promise(r => setTimeout(r, 1000));

  const { content: responseB, provider: providerB, model: modelB } = await generateLLMResponse(buildPrompt(agentB, agentA.name), userMsg, {
    maxTokens: 300,
    temperature: 0.7,
    responseMimeType: "application/json",
    providerOrder: ['cerebras', 'groq', 'gemini']
  });


  await new Promise(r => setTimeout(r, 500));

  let questionRaw = article.title;
  try {
    const { content: qResponse } = await generateLLMResponse(questionPrompt, [{ role: 'user', content: 'Debate question.' }], { maxTokens: 60, temperature: 0.8 });
    questionRaw = qResponse;
  } catch (qErr) {
    console.warn('[LLM] Question generation failed, using article title.', qErr);
  }

  const parse = (raw, fallback) => {
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0].replace(/,\s*([\}\]])/g, '$1'));
        return {
          argument: parsed.argument || parsed.commentary || parsed.text || parsed.content || fallback,
          sentiment_score: parsed.sentiment_score || parsed.sentiment || 50
        };
      }
    } catch (_) {
      // Fallback regex for debate argument if JSON is slightly broken
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const argMatch = match[0].match(/"(?:argument|commentary|content|text)"\s*:\s*"([\s\S]*?)"\s*(?:,|\s*\})/);
        const sentMatch = match[0].match(/"(?:sentiment_score|sentiment)"\s*:\s*(-?\d+)/);
        if (argMatch) {
          return {
            argument: argMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').trim() || fallback,
            sentiment_score: sentMatch ? parseInt(sentMatch[1], 10) : 50
          };
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
    llm: providerA, // Track first agent's provider for simplicity, or we could track both
    model: modelA
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

  const { content } = await generateLLMResponse(systemPrompt, userMessages, {
    maxTokens: 800,
    temperature: 0.6,
    providerOrder: ['cerebras', 'groq', 'gemini']
  });

  return content;
}

export async function generateAgentMetadata(userInput) {
  const TOPICS_LIST = [
    'News & Politics', 'Tech & Science', 'Sports',
    'Entertainment', 'Gaming', 'Business & Money',
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
- Create a comma-separated string of EXACTLY 9 terms for the topic: '${userInput.topic || 'topic'}' and sub-topic: '${userInput.subTopic || 'sub-topic'}'. 
- The FIRST term of these 9 MUST be the specific branch/type of the main topic (e.g., if Topic is 'Sports' and Sub-topic is 'FC Barcelona', the first term here should be 'Football').
- The remaining 8 terms must be common terms or phrases directly associated with '${userInput.subTopic || 'sub-topic'}' in the context of their main domain/field. 
- IMPORTANT: DO NOT mention any individual names of people (players, CEOs, politicians, etc.) in these terms. Focus on concepts, places, and actions.
- Return these 9 terms as a comma-separated string in the "sub_topics_generated" field.

YOUR FINAL OUTPUT MUST BE A VALID JSON OBJECT AND NOTHING ELSE. ALL FIELDS ARE MANDATORY.

JSON Structure:
{
  "name": "...",
  "emoji": "...",
  "topic": "...",
  "sub_topics_generated": "Term1, Term2, Term3, Term4, Term5, Term6, Term7, Term8, Term9, Term10",
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

  const { content: response } = await generateLLMResponse(systemPrompt, userMessages, {
    maxTokens: 3000,
    temperature: 0.7,
    responseMimeType: "application/json",
    useProvider: 'cerebras' // Try Cerebras first, then fall back to Groq -> Gemini
  });

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0].replace(/,\s*([\}\]])/g, '$1'));
      console.log(`[LLM] AI Metadata response keys:`, Object.keys(data));

      // Robust sub-topic extraction checking multiple potential keys
      const genSub = data.sub_topics_generated || data.sub_topics || data.subtopics || data.tags || data.keywords || "";

      // Final sub-topic list: User's input + AI's 9 terms = 10 terms
      let finalSubTopic = userInput.subTopic
        ? `${userInput.subTopic}, ${genSub}`.replace(/(,\s*)+$/, '').trim()
        : genSub;

      // Clean up any trailing/double commas or redundant spaces
      finalSubTopic = finalSubTopic
        .replace(/,(\s*,)+/g, ',')
        .replace(/^,\s*/, '')
        .replace(/,\s*$/, '')
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0)
        .join(', ');

      console.log(`[LLM] Resolved Identity: ${data.name || userInput.name} with ${finalSubTopic.split(',').length} sub-topics.`);
      console.log(`[LLM] Full Sub-Topics: ${finalSubTopic}`);

      return {
        name: userInput.name || data.name || data.agent_name || "New Agent",
        emoji: userInput.emoji || data.emoji || data.agent_emoji || "🤖",
        topic: sanitizeTopic(userInput.topic || data.topic),
        sub_topic: finalSubTopic,
        persona: data.persona || data.personality || "AI Persona generated successfully.",
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
export async function getRelevancyScore(agent, article) {
  const systemPrompt = RELEVANCY_PROMPT
    .replace('{agent_name}', agent.name)
    .replace('{topic}', agent.topic)
    .replace('{sub_topic}', agent.sub_topic || agent.subTopic || 'N/A')
    .replace('{persona}', agent.persona);

  const userMessages = [
    {
      role: 'user',
      content: `Determine if this article is relevant to the agent based on the rules above.\n\nArticle Title: ${article.title}\nArticle Excerpt: ${article.excerpt || article.snippet || ''}\n\nReturn JSON.`
    }
  ];

  try {
    const { content: response } = await generateLLMResponse(systemPrompt, userMessages, {
      maxTokens: 500,
      temperature: 0.2,
      responseMimeType: "application/json",
      providerOrder: ['groq', 'cerebras', 'gemini']
    });


    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0].replace(/,\s*([\}\]])/g, '$1'));
      return {
        score: parseInt(data.relevance_score || data.score || 0, 10),
        reasoning: data.reasoning || ""
      };
    }
    return { score: 0, reasoning: "Failed to parse relevancy score" };
  } catch (e) {
    console.error('[LLM] Relevancy check failed:', e);
    return { score: 0, reasoning: "Error in relevancy check" };
  }
}
