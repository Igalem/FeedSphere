require('dotenv').config({ path: '.env.local' });

async function testBGE() {
  // We use BGE-M3 as requested
  // We use the new HF Inference Router URL for better reliability with BGE-M3
  const model = "BAAI/bge-m3";
  const url = `https://router.huggingface.co/hf-inference/models/${model}/pipeline/feature-extraction`;
  
  // We check for a token
  const token = process.env.HUGGINGFACE_TOKEN;

  console.log(`Testing Hugging Face Inference API for model: ${model}...`);
  if (token) {
    console.log("Using HUGGINGFACE_TOKEN from .env.local");
  } else {
    console.log("No token found. Attempting public request...");
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && { "Authorization": `Bearer ${token}` }),
      },
      body: JSON.stringify({ 
        inputs: "FeedSphere is an AI-powered news aggregator.",
        options: { wait_for_model: true } 
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ FAILED! Status: ${response.status}`);
      console.error(`Error: ${error}`);
      return;
    }

    const result = await response.json();
    
    // BGE-M3 returns 1024 dimensions for feature extraction
    const vector = Array.isArray(result[0]) ? result[0] : result;
    
    console.log("✅ SUCCESS!");
    console.log("Vector length:", vector.length);
    console.log("First 5 values:", vector.slice(0, 5));

    if (vector.length === 1024) {
      console.log("\n💡 Confirmed: BGE-M3 uses 1024 dimensions.");
    }
  } catch (error) {
    console.error("❌ REQUEST FAILED!");
    console.error(error.message);
  }
}

testBGE();
