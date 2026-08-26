require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY in environment");
    process.exit(1);
  }

  const modelName = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  try {
    const result = await model.generateContent(
      'Respond with the single word: "OK"',
    );

    console.log("Gemini test response:");
    console.log(result.response.text());
  } catch (err) {
    const message = err?.message || "Unknown error";
    const retryMatch = message.match(/retryDelay"\s*:\s*"(\d+)s"/i);
    const retryAfterSeconds = retryMatch ? Number(retryMatch[1]) : null;
    console.error("Gemini test failed:", message);
    if (retryAfterSeconds) {
      console.error(`Retry after ~${retryAfterSeconds}s`);
    }
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Gemini test failed:", err.message);
  process.exit(1);
});
