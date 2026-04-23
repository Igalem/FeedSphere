require('dotenv').config({ path: '.env.local' });
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY is missing in .env.local");
    return;
  }

  console.log("Testing Gemini Embedding API...");
  console.log("Key starting with:", apiKey.substring(0, 5) + "...");

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Use gemini-embedding-2 which supports outputDimensionality and is verified
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });

    const result = await model.embedContent({
      content: { parts: [{ text: "The quick brown fox jumps over the lazy dog" }] },
      outputDimensionality: 1024,
    });

    const vector = result.embedding.values;
    console.log("✅ SUCCESS!");
    console.log("Vector length:", vector.length);
    console.log("First 5 values:", vector.slice(0, 5));
  } catch (error) {
    console.error("❌ FAILED!");
    console.error(error.message);
    if (error.message.includes("API key not valid")) {
      console.log("\n💡 Your API key seems invalid. Please get a new one from: https://aistudio.google.com/");
    }
  }
}

test();
