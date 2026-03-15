import { GoogleGenerativeAI } from "@google/generative-ai";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

let geminiModel;

function getGeminiModel() {
  if (geminiModel) return geminiModel;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const genAI = new GoogleGenerativeAI(key);
  geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  return geminiModel;
}

/**
 * Enhanced LLM response generator with Gemini as master and Groq as backup.
 */
export async function generateLLMResponse(systemPrompt, userMessages, options = {}) {
  const model = getGeminiModel();
  const { maxTokens = 1200, temperature = 0.8, retries = 5, initialDelay = 3000 } = options;
  let lastError;

  // 1. Try Gemini first
  if (model) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = initialDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
          console.log(`[Gemini] Rate limited. Retry attempt ${attempt} in ${Math.round(delay)}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        console.log(`[Gemini] Generating response...`);
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
          }
        });

        const content = result.response.text();
        if (content) {
          return cleanLLMResponse(content);
        }
        throw new Error('Gemini returned empty content');

      } catch (error) {
        lastError = error;
        // Check for rate limit (429) - SDK might wrap it
        const isRateLimit = error.message?.includes('429') || 
                            error.status === 429 || 
                            error.response?.status === 429;

        if (isRateLimit) {
          console.warn(`[Gemini] 429 Rate Limit hit.`);
          continue; // Retry
        }
        
        console.warn(`[Gemini] Error: ${error.message}. Switching to fallback...`);
        break; // Non-retryable error or exhausted retries, move to Groq
      }
    }
  } else {
    console.warn('[Gemini] Key missing or model not initialized. Using Groq.');
  }

  // 2. Fallback to Groq
  if (GROQ_API_KEY) {
    console.log(`[Groq Fallback] Generating response...`);
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: systemPrompt },
            ...userMessages
          ],
          max_tokens: maxTokens,
          temperature: temperature,
        })
      });

      if (!response.ok) {
        throw new Error(`Groq API Error: ${response.status} ${await response.text()}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      return cleanLLMResponse(content);

    } catch (groqError) {
      console.error(`[Groq Fallback] Failed: ${groqError.message}`);
      throw lastError || groqError;
    }
  }

  throw lastError || new Error('All LLM providers failed or are unconfigured');
}

function cleanLLMResponse(content) {
  return content
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*/g, '')
    .trim();
}

export async function generateAgentPost(agent, article) {
  const systemPrompt = `You are ${agent.name}.
${agent.persona}

Rules:
- Write like a real, authentic human expressing genuine feelings, emotions, and imperfections. Don't be too robotic.
- Stay completely in character at all times.
- Max 3 sentences for post takes.
- Never start with "I think" or "In my opinion".
- Never repeat what the article says, simply add your raw angle.
- Never use the string '—', '--', or '-' in your output! Use commas, colons, or periods instead.
- YOUR FINAL OUTPUT MUST BE A VALID JSON OBJECT.

JSON Structure:
{
  "commentary": "Your written take as the character (max 3 sentences)",
  "sentiment_score": 0-100 (where 0 is very negative and 100 is very positive),
  "tags": ["tag1", "tag2"] (2-3 relevant hashtags without the # sign, e.g. "Sports", "Victory")
}

- If you use <think> tags, be brief so the actual response isn't cut off.`;

  const userMessages = [
    {
      role: 'user',
      content: `Article title: ${article.title}\nArticle summary: ${article.snippet}\nSource: ${article.sourceName}\n\nWrite your take on this article and provide the JSON.`
    }
  ];

  const response = await generateLLMResponse(systemPrompt, userMessages, { maxTokens: 1200, temperature: 0.8 });
  
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { commentary: response, sentiment_score: 50, tags: [] };
  } catch (e) {
    console.error('Failed to parse LLM JSON:', e);
    return { commentary: response, sentiment_score: 50, tags: [] };
  }
}

export async function generateAgentPerspective(agent, articles) {
  const primaryArticle = articles[0];
  
  const systemPrompt = `You are an AI agent acting as a specific persona on a social network. 
Your task is to transform a dry news item into an engaging, highly opinionated, and independent social media post. 

Do NOT act like a news reporter or an aggregator. Do NOT summarize the article. You are a creator sharing your subjective, emotional take on the news. 

Name: ${agent.name}
Traits: ${agent.persona}

INPUT DATA:
News Title: ${primaryArticle.title}
News Summary/Content: ${primaryArticle.snippet || ''}

POST STRUCTURE REQUIREMENTS:
1. The Hook (1 sentence): Start with a strong opening.
2. The Core (2-3 short paragraphs): Blend facts with heavy bias.
3. The Call to Action (CTA - Optional): MUST be on a new line with an EMPTY LINE ABOVE IT. 
Available buttons: 🔥, 🧠, 🧊, 🎯.

RULES:
- Language: English.
- DO NOT mention "According to this article".
- DO NOT add hashtags in post text. Use plain text.
- Keep it under 150 words.
- YOUR FINAL OUTPUT MUST BE A VALID JSON OBJECT.

JSON Structure:
{
  "commentary": "The full text of your post using the structure and rules above.",
  "sentiment_score": 0-100,
  "tags": ["Perspective", "tag1", "tag2"]
}`;

  const userMessages = [
    {
      role: 'user',
      content: `Transform this news into your highly opinionated perspective post: ${primaryArticle.title}`
    }
  ];

  const response = await generateLLMResponse(systemPrompt, userMessages, { maxTokens: 1200, temperature: 0.85 });
  
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
      const commentaryMatch = jsonStr.match(/"commentary"\s*:\s*"([\s\S]*?)"\s*(?:,|$)/);
      const sentimentMatch = jsonStr.match(/"sentiment_score"\s*:\s*(-?\d+)/);
      if (commentaryMatch) {
        return {
          commentary: commentaryMatch[1].replace(/\\n/g, '\n'),
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

You are in a LIVE PUBLIC DEBATE against ${opponentName}.
Topic: "${article.title}"

Rules:
- Max 2 sentences.
- Never use '—', '--', or '-'.
- YOUR FINAL OUTPUT MUST BE A VALID JSON OBJECT.

JSON Structure:
{
  "argument": "Your punchy debate argument",
  "sentiment_score": 0-100
}`;

  const questionPrompt = `Generate a provocative debate question (max 10 words) about: "${article.title}"`;

  const userMsg = [{ role: 'user', content: `Article: "${article.title}"\nJSON only.` }];

  // Run sequentially to avoid rate limits (429) on Free Tier
  const responseA = await generateLLMResponse(buildPrompt(agentA, agentB.name), userMsg, { maxTokens: 300, temperature: 0.9 });
  const responseB = await generateLLMResponse(buildPrompt(agentB, agentA.name), userMsg, { maxTokens: 300, temperature: 0.9 });
  const questionRaw = await generateLLMResponse(questionPrompt, [{ role: 'user', content: 'Debate question.' }], { maxTokens: 60, temperature: 0.8 });

  const parse = (raw, fallback) => {
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch (_) {}
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

