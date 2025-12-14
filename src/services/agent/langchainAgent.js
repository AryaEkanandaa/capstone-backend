import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { allTools } from "./agentTools.js";

const groqApiKey = process.env.GROQ_API_KEY;

if (!groqApiKey) {
  console.warn("⚠️ GROQ_API_KEY tidak ditemukan di .env!");
}

const llm = new ChatGroq({
  apiKey: groqApiKey,
  model: "llama-3.3-70b-versatile",
  temperature: 0.3,
  maxTokens: 2000,
});


// RATE LIMIT HANDLER (untuk error 429)
const RATE_LIMIT_COOLDOWN = 5 * 60 * 1000;
let lastRateLimitTime = 0;
let rateLimitCount = 0;

function isRateLimited() {
  const now = Date.now();
  if (now - lastRateLimitTime < RATE_LIMIT_COOLDOWN) {
    return true;
  }
  return false;
}

function handleRateLimit() {
  lastRateLimitTime = Date.now();
  rateLimitCount++;
  console.warn(`⚠️ Rate limit hit (${rateLimitCount}x). Cooldown: 5 minutes.`);
}


// SIMPLE CHAT (No Tools) - Fastest

export async function chatToLangChainAgent(prompt) {
  try {
    if (isRateLimited()) {
      return " Sistem AI sedang dalam cooldown (rate limit). Silakan coba lagi dalam beberapa menit atau gunakan fitur direct query (contoh: 'mesin 5', 'mesin kritis').";
    }

    const chain = RunnableSequence.from([
      ChatPromptTemplate.fromTemplate("{input}"),
      llm,
      new StringOutputParser(),
    ]);

    const response = await chain.invoke({ input: prompt });
    return response;
    
  } catch (error) {
    console.error(" Groq Agent Error:", error.message);
    
    if (error.message.includes("429") || error.message.includes("rate_limit")) {
      handleRateLimit();
      return " Limit API tercapai. Sistem akan otomatis recovery dalam 5 menit. Sementara itu, gunakan query direct seperti: 'mesin 5', 'mesin kritis', 'status semua'.";
    }
    
    return " Sistem AI tidak merespon. Coba query direct seperti: 'mesin [nomor]', 'mesin kritis', 'trend mesin [nomor]'.";
  }
}


// AGENT WITH TOOLS
export async function chatToLangChainAgentWithTools(userMessage, suggestedTools = null) {
  try {
    // Check rate limit
    if (isRateLimited()) {
      return " Sistem AI sedang recovery dari rate limit. Gunakan query direct untuk respons instan.";
    }

    // Filter tools if specific tools suggested
    let toolsToUse = allTools;
    if (suggestedTools && Array.isArray(suggestedTools)) {
      toolsToUse = allTools.filter(tool => suggestedTools.includes(tool.name));
    }

    // Create a simple prompt 
    const systemPrompt = `Kamu adalah teknisi ahli mesin industri yang membantu menganalisa data sensor dan prediksi kerusakan.

CRITICAL RULES:
1. Gunakan selalu tools yang tersedia untuk mendapatkan data terbaru. Apabila tidak ada katakan saja. Jangan buat-buat.
2. Analisis data dengan fokus pada action plan
3. Berikan rekomendasi yang spesifik dan actionable
4. Jika data tidak lengkap, jelaskan keterbatasannya
5. Respons harus singkat, padat, dan profesional
6. Jika user minta data SATU mesin spesifik → gunakan get_machine_data
7. Jika user minta data BEBERAPA mesin spesifik (contoh: "mesin 1 dan 2") → gunakan get_multiple_machines_data
8. Jika user minta "semua mesin" atau "status pabrik" → gunakan get_all_machines_summary
...;

Available tools: ${toolsToUse.map(t => t.name).join(", ")}

Format response:
- Gunakan Markdown untuk readability
- Highlight critical issues dengan emoji (🔴 ⚠️ ✅)
- Berikan angka pasti (jangan vague)
- End dengan actionable recommendation

User query: ${userMessage}`;

    const chain = RunnableSequence.from([
      ChatPromptTemplate.fromTemplate("{input}"),
      llm,
      new StringOutputParser(),
    ]);

    const response = await chain.invoke({ input: systemPrompt });
    return response;
    
  } catch (error) {
    console.error(" Agent with Tools Error:", error.message);
    
    if (error.message.includes("429") || error.message.includes("rate_limit")) {
      handleRateLimit();
      return " API limit tercapai. Sistem perlu recovery 5 menit. Gunakan direct query untuk hasil instan.";
    }
    
    return " Agent tidak dapat memproses. Coba gunakan query yang lebih spesifik atau direct query.";
  }
}


// SMART AGENT 

export async function chatToSmartAgent(userMessage, context = "") {
  try {
    if (isRateLimited()) {
      return " Rate limit active. Use direct queries for instant response.";
    }

    const systemPrompt = `Kamu adalah AI agent yang sangat cerdas dalam predictive maintenance.

Context dari sistem: ${context}

User message: ${userMessage}

DECISION TREE:
1. Jika user tanya spesifik tentang mesin → analisis data yang diberikan
2. Jika user tanya trend → jelaskan perubahan parameter
3. Jika user tanya status kritis → prioritaskan mesin urgent
4. Jika user kasih angka sensor → interpretasi hasil prediksi
5. Jika general question → berikan penjelasan teknis

IMPORTANT:
- Berikan analisis mendalam, bukan cuma report data
- End dengan recommendation yang clear
- Format: Markdown dengan emoji

Respond in Bahasa Indonesia.`;

    const chain = RunnableSequence.from([
      ChatPromptTemplate.fromTemplate("{input}"),
      llm,
      new StringOutputParser(),
    ]);

    const response = await chain.invoke({ input: systemPrompt });
    return response;
    
  } catch (error) {
    console.error(" Smart Agent Error:", error.message);
    
    if (error.message.includes("429") || error.message.includes("rate_limit")) {
      handleRateLimit();
      return " Rate limit. Cooldown 5 menit. Gunakan direct query.";
    }
    
    return " Smart agent error. Fallback ke direct query.";
  }
}


// HEALTH CHECK

export function getAgentHealth() {
  return {
    rate_limited: isRateLimited(),
    cooldown_remaining: isRateLimited() 
      ? Math.ceil((RATE_LIMIT_COOLDOWN - (Date.now() - lastRateLimitTime)) / 1000) 
      : 0,
    rate_limit_hits: rateLimitCount,
    last_hit: lastRateLimitTime ? new Date(lastRateLimitTime).toISOString() : null,
  };
}


// MANUAL RATE LIMIT RESET (untuk admin)

export function resetRateLimit() {
  lastRateLimitTime = 0;
  rateLimitCount = 0;
  console.log("✅ Rate limit reset successfully");
}