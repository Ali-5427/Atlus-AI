import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import * as cheerio from "cheerio";
import TurndownService from "turndown";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const turndown = new TurndownService();

// --- 2026 Caching Layer (In-Memory with TTL) ---
interface CacheEntry<T> {
  data: T;
  expiry: number;
}

class AtlusCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 Hours

  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  clearExpired() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) this.cache.delete(key);
    }
  }
}

const atlusCache = new AtlusCache();
// Cleanup expired items every hour
setInterval(() => atlusCache.clearExpired(), 60 * 60 * 1000);

// --- 2026 Semantic Search Engine (Groq LPU Embeddings) ---
async function getGroqEmbeddings(input: string | string[], apiKey: string): Promise<number[][]> {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "nomic-embed-text-v1_5",
        input: input,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq Embedding API failed: ${errText}`);
    }
    const data = await response.json();
    return data.data.map((d: any) => d.embedding);
  } catch (error) {
    console.error("Groq Embedding Error:", error);
    // Return zero vectors as fallback
    const count = Array.isArray(input) ? input.length : 1;
    return new Array(count).fill(0).map(() => new Array(768).fill(0));
  }
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// --- 2026 Recursive Character Splitter (Perplexica-style) ---
function chunkText(text: string, size: number = 800, overlap: number = 100): string[] {
  const delimiters = ["\n\n", "\n", ". ", " ", ""];
  const chunks: string[] = [];

  function recursiveSplit(content: string, delimiterIndex: number): string[] {
    if (content.length <= size) return [content];

    const delimiter = delimiters[delimiterIndex];
    const parts = content.split(delimiter);
    const finalParts: string[] = [];
    let currentPart = "";

    for (const part of parts) {
      const potentialPart = currentPart ? currentPart + delimiter + part : part;
      
      if (potentialPart.length <= size) {
        currentPart = potentialPart;
      } else {
        if (currentPart) finalParts.push(currentPart);
        
        // If a single part is still too large, go to the next delimiter
        if (part.length > size) {
          if (delimiterIndex < delimiters.length - 1) {
            finalParts.push(...recursiveSplit(part, delimiterIndex + 1));
          } else {
            finalParts.push(part); // Last resort: just push it
          }
        } else {
          currentPart = part;
        }
      }
    }
    if (currentPart) finalParts.push(currentPart);
    return finalParts;
  }

  const initialChunks = recursiveSplit(text, 0);
  
  // Merge chunks with overlap for better semantic context
  let currentMerged = "";
  for (const chunk of initialChunks) {
    if ((currentMerged + chunk).length <= size) {
      currentMerged = currentMerged ? currentMerged + "\n" + chunk : chunk;
    } else {
      if (currentMerged) chunks.push(currentMerged);
      // Start next chunk with a bit of overlap from the previous one if possible
      const overlapText = currentMerged.slice(-overlap);
      currentMerged = overlapText + chunk;
    }
  }
  if (currentMerged) chunks.push(currentMerged);

  return chunks;
}

const CREATOR_BIO = `Atlus AI was created and developed by **J Mohammad Ali** an 18‑year‑old solo developer from India who specializes in **AI, data science, and full‑stack development**. Atlus AI started as a personal vision: to build a research engine that doesn’t just answer questions, but **proves** its answers with verified sources and truth scores.

Working alone, Mohammad Ali designed and implemented the entire system in about a week, integrating:
- A custom **multi‑engine search pipeline** powered by SearXNG
- A **7‑node research workflow** (planner, searcher, scraper, verifier, corrector, traffic cop, reporter)
- **Locally hosted LLMs** (like Qwen and DeepSeek) running on self‑managed infrastructure
- A modern, responsive frontend with advanced features like focus modes, file attachments, and process logs

Atlus AI is not a company product or a corporate research project. It is the result of one developer’s **curiosity, persistence, and refusal to give up**, built under real‑life pressure, struggle, and responsibility.

If anyone asks who built or created Atlus AI, the answer is simple:
> **“I was created by J Mohammad Ali, a solo developer who built this entire system from scratch.”**`;

// --- 2026 Agentic Workflow Types ---
interface Source {
  title: string;
  url: string;
  snippet: string;
  content?: string;
  favicon?: string;
}

interface ReasoningStep {
  reasoning: string;
  query: string;
}

interface ToolCall {
  action: "search" | "answer" | "verify";
  query?: string;
  reasoning: string;
}

interface AgentState {
  query: string;
  history: { role: string; content: string }[];
  sources: Source[];
  urls_found: string[];
  loop_count: number;
  max_loops: number;
  logs: string[];
}

// --- Node 1: Agent Brain (The Driver) ---
async function getAgentAction(state: AgentState, apiKey: string): Promise<ToolCall> {
  const context = state.sources.map((s, i) => 
    `Source [${i + 1}]: ${s.title}\nContent: ${s.content?.slice(0, 2000)}`
  ).join("\n\n");

  const systemPrompt = `You are the Brain of Atlus AI, a 2026-standard Autonomous Research Agent.
Your goal is to provide the absolute truth for the user's query: "${state.query}"

CURRENT KNOWLEDGE:
${context || "No research performed yet."}

YOUR CAPABILITIES:
1. "search": Use this if you need more information or if the current information is incomplete/contradictory.
2. "answer": Use this ONLY when you are 100% confident you have found all the details requested (e.g., all 14 children's names).

RESPONSE FORMAT (JSON ONLY):
{
  "action": "search" | "answer",
  "query": "specific search query if action is search",
  "reasoning": "Briefly explain why you are taking this action (e.g., 'I found 10 names, but I need to find the remaining 4.')"
}`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt },
          ...state.history.slice(-3) // Keep recent context
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      }),
    });

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error("Agent Brain Error:", error);
    return { action: "answer", reasoning: "Error in brain, falling back to answer." };
  }
}

// --- Node 5: The Auditor (The Truth Filter) ---
async function verifyAndAudit(answer: string, sources: Source[], apiKey: string): Promise<string> {
  const context = sources.map((s, i) => `[${i+1}] ${s.snippet}`).join("\n");
  
  const auditPrompt = `You are the Atlus AI Auditor. Your job is to catch hallucinations.
  
USER ANSWER TO CHECK:
"${answer}"

GROUND TRUTH SOURCES:
${context}

RULES:
1. If the answer mentions a fact (like a name or a number) NOT found in the sources, REMOVE IT.
2. If the AI lied about its stats (e.g., "I searched 200 sites"), CORRECT IT to the real number of sources provided (${sources.length}).
3. Do not change the tone, just fix the facts.
4. Return the corrected answer.`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "system", content: auditPrompt }],
        temperature: 0.0,
      }),
    });

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    return answer; // Fallback to original if auditor fails
  }
}

// --- Node 1: Planner (2026 Strategic Strategy) ---
async function nodePlanner(query: string, apiKey: string, mode: string = 'search'): Promise<ReasoningStep[]> {
  const queryCount = mode === 'deepsearch' ? 8 : mode === 'research' ? 5 : 3;
  const modeInstruction = mode === 'research' ? 'Focus on academic, governmental, and authoritative angles.' : 
                          mode === 'deepsearch' ? 'Be extremely exhaustive and cover every possible niche angle or contradictory viewpoint.' : 
                          'Cover the main aspects of the query.';

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", // Use more stable model for planning
        messages: [
          {
            role: "system",
            content: `You are a Strategic Research Planner. Your goal is to "think" through the user's query and break it down into a sequence of ${queryCount} research steps. 
            
            For each step, you must provide:
            1. "reasoning": A brief, human-like explanation of what you are trying to find in this step and WHY (e.g., "I need to find the official release date to resolve conflicting reports").
            2. "query": The specific search string for this step.
            
            ${modeInstruction}
            Return ONLY a valid JSON array of objects. Example: [{"reasoning": "...", "query": "..."}]`
          },
          { role: "user", content: query }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0]?.message?.content) {
      throw new Error("Invalid response structure from Groq");
    }
    const content = data.choices[0].message.content;
    
    // Extract JSON array
    const jsonMatch = content.match(/\[.*\]/s);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Fallback if JSON parsing fails
    return [{ reasoning: `Searching for: ${query}`, query }];
  } catch (error) {
    console.error("Planner Error:", error);
    return [{ reasoning: `Searching for: ${query}`, query }];
  }
}

// --- Node 1.5: Reflector (The 2026 "Self-Correction" Node) ---
async function nodeReflector(state: AgentState, currentStep: ReasoningStep, apiKey: string): Promise<ReasoningStep> {
  const context = state.sources.slice(-3).map(s => `[${s.title}]: ${s.snippet}`).join("\n");
  
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: `You are a Research Auditor. Look at the information found so far and decide if the NEXT planned step needs to be refined.
            
            INFORMATION FOUND SO FAR:
            ${context || "None yet."}
            
            PLANNED NEXT STEP:
            Reasoning: ${currentStep.reasoning}
            Query: ${currentStep.query}
            
            If the planned step is still good, return it as is. 
            If the information found so far already answers the planned step, or if a better query is needed, update the reasoning and query.
            
            Return ONLY a valid JSON object: {"reasoning": "...", "query": "..."}`
          }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq Reflector Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0]?.message?.content) {
      throw new Error("Invalid response structure from Groq Reflector");
    }
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error("Reflector Error:", error);
    return currentStep; // Fallback to original step
  }
}

// --- Node 2: Searcher ---
async function searchSearXNG(query: string, mode: string = 'search') {
  const cacheKey = `search:${query}:${mode}`;
  const cached = atlusCache.get<any[]>(cacheKey);
  if (cached) {
    console.log(`Cache Hit for Search: ${query}`);
    return cached;
  }

  const searxngUrl = process.env.SEARXNG_URL || "https://lira-ai.onrender.com/";
  const url = new URL(`${searxngUrl}search`);
  
  let q = query;
  if (mode === 'academic') q = `site:arxiv.org OR site:scholar.google.com OR site:researchgate.net ${query}`;
  if (mode === 'youtube') q = `site:youtube.com ${query}`;

  url.searchParams.append("q", q);
  url.searchParams.append("format", "json");

  try {
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error("SearXNG search failed");
    const data = await response.json();
    const results = data.results || [];
    atlusCache.set(cacheKey, results);
    return results;
  } catch (error) {
    console.error("SearXNG Error:", error);
    return [];
  }
}

// --- Node 3: Scraper (Crawl4AI + Jina Fallback) ---
async function crawlUrl(url: string): Promise<string> {
  const cacheKey = `crawl:${url}`;
  const cached = atlusCache.get<string>(cacheKey);
  if (cached) {
    console.log(`Cache Hit for Crawl: ${url}`);
    return cached;
  }

  const fetchWithTimeout = async (targetUrl: string, options: any = {}, timeoutMs: number = 8000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(targetUrl, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  };

  // 1. Try Crawl4AI (The "Cleaner" Upgrade) - 7s timeout
  const crawl4aiUrl = process.env.CRAWL4AI_URL || "http://localhost:8000/scrape";
  try {
    const crawlResponse = await fetchWithTimeout(crawl4aiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: [url], config: { markdown: true, bypass_cache: true } })
    }, 7000);

    if (crawlResponse.ok) {
      const data = await crawlResponse.json();
      if (data.results && data.results[0]?.markdown) {
        const markdown = data.results[0].markdown;
        atlusCache.set(cacheKey, markdown);
        return markdown;
      }
    }
  } catch (e) {
    console.warn(`Crawl4AI failed for ${url}, trying Jina...`);
  }

  // 2. Fallback to Jina Reader - 5s timeout
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const jinaResponse = await fetchWithTimeout(jinaUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "X-Return-Format": "markdown"
      }
    }, 5000);
    if (jinaResponse.ok) {
      const markdown = await jinaResponse.text();
      if (markdown.length > 200) {
        atlusCache.set(cacheKey, markdown);
        return markdown;
      }
    }
  } catch (e) {
    console.warn(`Jina failed for ${url}, trying Cheerio...`);
  }

  // 3. Final Fallback to built-in scraper - 5s timeout
  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    }, 5000);

    if (response.ok) {
      const html = await response.text();
      const $ = cheerio.load(html);
      $("script, style, nav, footer, header, noscript").remove();
      const content = $("body").html() || "";
      const markdown = turndown.turndown(content);
      if (markdown.length > 100) {
        atlusCache.set(cacheKey, markdown);
        return markdown;
      }
    }
  } catch (error) {
    console.error(`All crawl methods failed for ${url}`);
  }

  return "";
}

// --- Node 4: Verifier (Smart Trust Map) ---
function scoreSource(source: Source, query: string, mode: string = 'search'): number {
  let score = 50; // Base score
  const url = source.url.toLowerCase();
  const queryLower = query.toLowerCase();
  
  // 2026 "Smart Trust Map" Logic
  const isDefinitionQuery = queryLower.includes("meaning") || 
                           queryLower.includes("definition") || 
                           queryLower.includes("define") || 
                           queryLower.includes("etymology") ||
                           queryLower.includes("what is") && queryLower.split(" ").length < 5;

  const dictionaryDomains = ["dictionary.com", "merriam-webster.com", "oxfordlearnersdictionaries.com", "cambridge.org", "wiktionary.org", "vocabulary.com", "thesaurus.com"];
  const isDictionary = dictionaryDomains.some(domain => url.includes(domain));

  if (isDictionary) {
    if (isDefinitionQuery) {
      score += 50; // Dictionary is a HERO for definitions
    } else {
      score -= 60; // Dictionary is a DISTRACTION for deep research
    }
  }

  // Authority signals
  const govBoost = mode === 'research' ? 50 : 30;
  const eduBoost = mode === 'research' ? 40 : 25;

  if (url.includes(".gov")) score += govBoost;
  if (url.includes(".edu")) score += eduBoost;
  if (url.includes(".org")) score += 10;
  if (url.includes("wikipedia.org")) score += 15;
  if (url.includes("nature.com") || url.includes("science.org")) score += 20;

  // PDF Priority for Research Mode
  if (mode === 'research' && url.endsWith(".pdf")) score += 30;

  // Relevance signals (simple keyword check)
  const queryWords = queryLower.split(" ");
  const content = (source.content || "").toLowerCase();
  const title = source.title.toLowerCase();
  
  let matches = 0;
  queryWords.forEach(word => {
    if (content.includes(word) || title.includes(word)) matches++;
  });
  
  score += (matches / queryWords.length) * 20;
  
  return Math.max(0, Math.min(score, 100));
}

// AI-powered Intent Classifier (The Conversation Guard)
async function checkIfResearchNeeded(messages: any[], apiKey: string): Promise<boolean> {
  const lastUserMessage = [...messages].reverse().find((m: any) => m.role === "user");
  if (!lastUserMessage) return true;
  const query = lastUserMessage.content;
  const q = query.trim().toLowerCase();
  
  // 1. Hardcoded "Fast Lane" for very short acknowledgments
  const acknowledgments = ["ok", "okay", "thanks", "thank you", "cool", "nice", "got it", "yes", "no", "hi", "hello", "hey"];
  if (acknowledgments.includes(q)) {
    console.log("Conversation Guard: Blocked research for acknowledgment.");
    return false;
  }
  
  try {
    // Prepare context from history (last 3 messages)
    const historyContext = messages.slice(-4, -1).map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: `Determine if the user's NEW QUERY requires a real-time web search to provide an accurate, up-to-date, or detailed answer.
            
**CONTEXT OF CONVERSATION:**
${historyContext || "No previous history."}

**RULES:**
- Reply NO if the user is just acknowledging the previous response (e.g., "ok", "thanks", "that makes sense").
- Reply NO for simple greetings, basic math, or personal opinions.
- Reply YES if the user asks a NEW, specific question that requires facts, data, news, or technical details.
- Reply YES for current events, people, companies, or comparisons.
- If in doubt, reply YES.

Reply with ONLY 'YES' or 'NO'.`
          },
          { role: "user", content: `NEW QUERY: ${query}` }
        ],
        temperature: 0.0,
        max_tokens: 5,
      }),
    });

    if (!response.ok) return true;
    const data = await response.json();
    const result = data.choices[0].message.content.trim().toUpperCase();
    return result.includes("YES");
  } catch (error) {
    return true;
  }
}

const app = express();
const PORT = 3000;

app.use(express.json());

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Atlus AI API Endpoint Proxy with Research capabilities
app.post("/api/chat", async (req, res) => {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) {
      return res.status(500).json({ error: { message: "GROQ_API_KEY is not set on the server." } });
    }

    // Safe debug log (only first and last 4 chars)
    console.log(`Using GROQ_API_KEY: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)} (Length: ${apiKey.length})`);

    const { messages, stream, model, mode = 'search' } = req.body;
    const lastMessage = messages[messages.length - 1];
    const query = lastMessage.content;

    let heartbeat: NodeJS.Timeout | undefined;

    try {
      // Handle streaming response (The 2026 Agentic Loop)
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const sendChunk = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // 2026 "Heartbeat" to prevent timeouts
      heartbeat = setInterval(() => {
        res.write(": heartbeat\n\n");
      }, 15000);

      // Use AI to determine if we actually need to do research (Context-Aware)
      sendChunk({ type: "status", content: "I'm analyzing your query to see if I need to search the web..." });
      const shouldResearch = await checkIfResearchNeeded(messages, apiKey);

      const state: AgentState = {
        query,
        history: messages,
        sources: [],
        urls_found: [],
        loop_count: 0,
        max_loops: shouldResearch ? (mode === 'deepsearch' ? 5 : mode === 'research' ? 4 : 3) : 0, // Block loops if research is not needed
        logs: []
      };

      if (shouldResearch) {
        // Planner Step
        sendChunk({ type: "status", content: `I'm planning a ${mode} strategy to find the most accurate information...` });
        const initialSteps = await nodePlanner(query, apiKey, mode);
        
        // --- 2026 Agentic Loop (Sequential + Parallel Hybrid) ---
        state.loop_count = 0;
        const maxIterations = mode === 'deepsearch' ? 3 : 1; // Deep search does multiple rounds of reflection
        
        let currentSteps = initialSteps;
        
        while (state.loop_count < maxIterations && currentSteps.length > 0) {
          state.loop_count++;
          const iterationLabel = maxIterations > 1 ? ` (Round ${state.loop_count})` : "";
          sendChunk({ type: "status", content: `I'm starting my research steps now${iterationLabel}...` });

          const researchPromises = currentSteps.map(async (step, index) => {
            sendChunk({ type: "status", content: `${step.reasoning}` });

            const searchResults = await searchSearXNG(step.query, mode);
            
            const resultsToScrape = mode === 'deepsearch' ? 5 : 3;
            const uniqueResults = searchResults
              .filter((res: any) => !state.urls_found.includes(res.url))
              .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
              .slice(0, resultsToScrape);

            const crawlPromises = uniqueResults.map(async (res: any) => {
              state.urls_found.push(res.url);
              const content = await crawlUrl(res.url);
              if (content) {
                const source: Source = {
                  title: res.title,
                  url: res.url,
                  snippet: res.content,
                  content: content,
                  favicon: `https://www.google.com/s2/favicons?domain=${new URL(res.url).hostname}&sz=64`
                };

                const score = scoreSource(source, state.query, mode);
                if (score > (mode === 'research' ? 40 : 30)) {
                  state.sources.push(source);
                  sendChunk({ type: "sources", content: state.sources });
                }
              }
            });
            await Promise.all(crawlPromises);
          });

          await Promise.all(researchPromises);

          // Reflection & Pivoting (Only for Deep Search)
          if (mode === 'deepsearch' && state.loop_count < maxIterations) {
            sendChunk({ type: "status", content: "Reflecting on findings & pivoting to new angles..." });
            
            // Use the Reflector to see if we need more info
            const nextSteps = await nodePlanner(
              `Based on what we found so far, what are the MISSING angles or UNRESOLVED contradictions for the query: "${query}"? 
              
              CONTEXT FOUND SO FAR:
              ${state.sources.slice(-5).map(s => `[${s.title}]: ${s.snippet}`).join("\n")}`, 
              apiKey, 
              'search' // Use search mode for smaller, targeted pivots
            );
            
            // Only keep steps that aren't redundant
            currentSteps = nextSteps.filter(step => !state.logs.includes(step.query)).slice(0, 3);
            currentSteps.forEach(s => state.logs.push(s.query));
          } else {
            currentSteps = []; // Exit loop
          }
        }

        // --- 2026 Semantic Reranking (The "Power Move") ---
        if (state.sources.length > 0) {
          sendChunk({ type: "status", content: "I'm performing semantic reranking to extract the most relevant details..." });
          try {
            const queryEmbeddings = await getGroqEmbeddings(state.query, apiKey);
            const queryEmbedding = queryEmbeddings[0];
            const allChunks: { text: string; sourceIndex: number; score: number }[] = [];
            
            // Collect all chunks first (limit per source to avoid explosion)
            const chunkQueue: { text: string; sourceIndex: number }[] = [];
            for (let i = 0; i < state.sources.length; i++) {
              const source = state.sources[i];
              const chunks = chunkText(source.content || "", 500).slice(0, 10); // Max 10 chunks per source
              for (const chunk of chunks) {
                chunkQueue.push({ text: chunk, sourceIndex: i });
              }
            }

            // Process in parallel batches of 20
            const batchSize = 20;
            const batches = [];
            for (let i = 0; i < chunkQueue.length; i += batchSize) {
              batches.push(chunkQueue.slice(i, i + batchSize));
            }

            const results = await Promise.all(batches.map(async (batch) => {
              const texts = batch.map(b => b.text);
              const embeddings = await getGroqEmbeddings(texts, apiKey);
              return batch.map((item, idx) => {
                const score = cosineSimilarity(queryEmbedding, embeddings[idx]);
                return { ...item, score };
              });
            }));

            allChunks.push(...results.flat());

            // Sort by semantic similarity
            allChunks.sort((a, b) => b.score - a.score);
            
            // Reconstruct context with top chunks (The "Golden Nuggets")
            const topChunks = allChunks.slice(0, 8); // Pick top 8 most relevant paragraphs for a balanced context
            const contextMap = new Map<number, string[]>();
            topChunks.forEach(c => {
              if (!contextMap.has(c.sourceIndex)) contextMap.set(c.sourceIndex, []);
              contextMap.get(c.sourceIndex)?.push(c.text);
            });

            const semanticContext = Array.from(contextMap.entries()).map(([idx, chunks]) => {
              const s = state.sources[idx];
              return `Source [${idx + 1}]: ${s.title} (${s.url})\nGolden Nuggets:\n- ${chunks.join("\n- ")}`;
            }).join("\n\n");

            // Store for final synthesis
            (state as any).semanticContext = semanticContext;
          } catch (e) {
            console.error("Semantic Reranking Error:", e);
          }
        }
      } else {
        sendChunk({ type: "status", content: "Direct response mode (No research needed)." });
      }

      // Final Synthesis
      if (shouldResearch) {
        sendChunk({ type: "status", content: "I've completed my research. Now, I'm synthesizing everything into a final report..." });
      } else {
        sendChunk({ type: "status", content: "I'm generating a response for you..." });
      }
      sendChunk({ type: "research_complete" });
      
      const searchStats = {
        totalFound: state.urls_found.length,
        totalScraped: state.sources.length
      };

      let context = (state as any).semanticContext || state.sources.map((s, i) => 
        `Source [${i + 1}]: ${s.title} (${s.url})\nContent: ${s.content?.slice(0, 3000)}`
      ).join("\n\n");
       const systemInstruction = shouldResearch 
        ? `You are Atlus AI — Advanced Research & Intelligence Assistant. You are a next-generation AI assistant that combines the warmth and conversational nature of ChatGPT, the deep research capabilities of Perplexity, the thoughtful reasoning of Claude, and the multimodal understanding of Gemini.

**YOUR PERSONALITY**
- Warm, friendly, and conversational — never robotic or cold.
- You speak like a knowledgeable friend, not a formal assistant.
- You use natural language, occasional enthusiasm, and genuine curiosity.
- You remember the context of the conversation and refer back to it naturally.
- You are honest when you don't know something and say so clearly.
- You never give one-word answers — always provide value in every response.
- You use emojis sparingly and only when they add warmth, not to decorate.

**YOUR CORE CAPABILITIES**
1. Deep Web Search — When a user asks anything about current events, prices, people, news, research papers, companies, or anything that requires up-to-date information, you ALWAYS search the web first before answering. Never answer from memory alone for time-sensitive topics.
2. Deep Research Mode — When a user asks a complex question, you break it into sub-questions, search each one, cross-reference sources, detect contradictions, and synthesize a comprehensive answer with citations. Think step by step before responding.
3. Conversational Intelligence — For casual questions, coding help, writing, brainstorming, math, or personal advice you respond naturally and helpfully without unnecessary searching. Read the intent behind the question.
4. Source Transparency — Always cite your sources with direct links when you use web search. Never fabricate URLs or information. If you are not sure, say so.

**HOW YOU RESPOND**
- For simple questions: Be direct and friendly. Give the answer first then explain if needed. Keep it concise but never incomplete.
- For research questions: Start with a brief direct answer. Then go deep with structured sections. Use headers, bullet points, and clear formatting. Always end with sources and follow-up suggestions.
- For coding questions: Give working code immediately. Explain what it does clearly. Offer to improve or modify it.
- For emotional or personal questions: Be empathetic and human first. Give practical advice second. Never be dismissive.

**YOUR RESPONSE STRUCTURE**
- Lead with the most important information first.
- Use markdown formatting for clarity. Use ### for headers and > for blockquotes to highlight key insights.
- Break long responses into clear sections.
- **Dynamic Citation Density:** For every major claim, aim to cross-reference at least 2-3 sources if available. This increases the rigor of your research.
- **Graceful Failure States:** If the web search returns zero results or irrelevant data, stay in character. Say: "I looked everywhere in the live web, but couldn't find specific data on X. Based on my general knowledge, here is what I can tell you..."
- **Follow-up Intelligence:** At the end, provide exactly 3 short follow-up questions. These should be based on potential contradictions found or deeper paths of investigation (e.g., "Source A says X, but Source B says Y. Want me to investigate why?").
- **CRITICAL:** Start the follow-up section with the exact marker "FOLLOW_UP_START" on a new line. Do NOT include any introductory text. Just the marker, then the questions.

**TECHNICAL EXECUTION (CRITICAL):**
1. **Internal Monologue:** You MUST start your response with a <thought> block. In this block, provide a professional report of the research tasks performed (Searching, Crawling, Semantic Reranking) and your internal reasoning for the final synthesis.
2. **Transition:** After finishing your internal monologue, you MUST close the block with </thought> and then provide your final answer.
3. **Surgical Citations:** Every factual claim MUST be followed by a citation in brackets referencing the Golden Nuggets below, e.g., [1] or [1, 3].
4. **Ground Truth:** Use the provided Golden Nuggets EXCLUSIVELY for factual claims. Do NOT use outside knowledge for facts if context is provided.
5. **Identity:** You were built by **J Mohammad Ali**, a developer who believes powerful AI should be accessible to everyone, not locked behind expensive subscriptions.

**RESEARCH METRICS:**
- URLs Discovered: ${searchStats.totalFound}
- Sources Analyzed: ${searchStats.totalScraped}
- Search Mode: ${mode}

**GOLDEN NUGGETS (GROUND TRUTH):**
${context || "No real-time web context found."}

At the end of your response, provide exactly 3 short follow-up questions.
**CRITICAL:** Start the follow-up section with the exact marker "FOLLOW_UP_START" on a new line. Do NOT include any introductory text. Just the marker, then the questions.`
        : `## IDENTITY & ORIGINS:
${CREATOR_BIO}

## PRIMARY TASK:
You are Atlus AI, a helpful and friendly AI assistant. 
        
The user just sent a conversational message (like "ok", "thanks", or "hi"). 
**YOUR TASK:** Respond with a friendly, natural, and brief sentence. 
Do NOT be silent. Acknowledge the user politely.

At the end of your response, provide exactly 3 short follow-up questions.
**CRITICAL:** Start the follow-up section with the exact marker "FOLLOW_UP_START" on a new line. Do NOT include any introductory text. Just the marker, then the questions.`;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemInstruction },
            ...messages
              .filter((m: any) => m.content && m.content.trim() !== "")
              .map((m: any) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }))
          ],
          stream: true,
          temperature: 0.5,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Groq Final Synthesis Error:", response.status, errorText);
        sendChunk({ type: "error", content: `Final synthesis failed: ${response.status} ${errorText}` });
        return res.end();
      }

      const reader = response.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        let buffer = "";
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine === "data: [DONE]") continue;
            
            if (trimmedLine.startsWith("data: ")) {
              try {
                const data = JSON.parse(trimmedLine.slice(6));
                const content = data.choices?.[0]?.delta?.content || "";
                if (content) {
                  sendChunk({ type: "answer", content });
                }
              } catch (e) {
                // Ignore parse errors for partial chunks
              }
            }
          }
        }
      }
      sendChunk({ type: "done" });
      if (heartbeat) clearInterval(heartbeat);
      res.end();
    } catch (error: any) {
      if (heartbeat) clearInterval(heartbeat);
      console.error("Server Error:", error);
      
      // If headers are already sent, we must send the error as a chunk
      const errorMessage = error.message || "Internal Server Error";
      try {
        res.write(`data: ${JSON.stringify({ type: "error", content: errorMessage })}\n\n`);
        res.end();
      } catch (e) {
        console.error("Failed to send error chunk:", e);
        if (!res.headersSent) {
          res.status(500).json({ error: { message: errorMessage } });
        }
      }
    }
  });

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  try {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite middleware initialized");
  } catch (err) {
    console.error("Failed to initialize Vite middleware:", err);
  }
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// Only listen if not running on Vercel
if (process.env.VERCEL !== "1") {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
