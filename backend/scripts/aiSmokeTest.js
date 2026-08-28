// One real call against the configured model. This is the ten seconds that tells
// you what broke at the next model shutdown: it prints the model id it used and
// the classified status, instead of an SDK stack trace.
//
//   npm run ai:smoke
require("dotenv").config();
const { generateJson, getModelName, Type } = require("../lib/aiClient");

const SCHEMA = {
  type: Type.OBJECT,
  properties: { status: { type: Type.STRING } },
  required: ["status"],
};

async function run() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY in environment");
    process.exit(1);
  }

  console.log(`Model: ${getModelName()}`);
  const started = Date.now();

  try {
    const result = await generateJson({
      prompt: 'Set the "status" field to the single word OK.',
      schema: SCHEMA,
      maxTokens: 256,
    });
    console.log(`Response after ${Date.now() - started} ms:`, result);
  } catch (err) {
    console.error(
      `Failed after ${Date.now() - started} ms ` +
        `[status ${err.status ?? "-"} / ${err.code ?? "unclassified"}]: ${err.message}`,
    );
    if (err.retryAfterSeconds) {
      console.error(`Retry after ~${err.retryAfterSeconds}s`);
    }
    process.exit(1);
  }
}

run();
