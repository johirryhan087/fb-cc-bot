// 📦 Bot config
module.exports.config = {
  name: "gpt",
  aliases: ["openrouter"],
  version: "1.0.0",
  permission: 0,
  credits: "OpenRouter AI by You",
  description: "GPT-3.5/4 via OpenRouter API",
  prefix: true,
  category: "ai",
  usages: "/gpt [prompt]",
  cooldowns: 3,
};

const axios = require("axios");

// 🔐 তোমার OpenRouter API KEY বসাও
const OPENROUTER_API_KEY = "Bearer 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"; // <<< এখানে তোমার KEY বসাও

// ✨ Friendly Prompt Generator
async function askOpenRouter(prompt) {
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-3.5-turbo", // তুমি চাইলে gpt-4, anthropic/claude-3-opus ইত্যাদি দিতে পারো
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          Authorization: OPENROUTER_API_KEY,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://your-bot.com", // আপনার ওয়েব বা প্রোজেক্ট URL
          "X-Title": "MyMessengerBot",
        },
      }
    );

    return response.data.choices[0].message.content.trim();
  } catch (err) {
    console.error("OpenRouter Error:", err.response?.data || err.message);
    return "❌ OpenRouter API তে সমস্যা হয়েছে। দয়া করে একটু পর আবার চেষ্টা করো।";
  }
}

// ✅ /openrouter কমান্ড হ্যান্ডলার
module.exports.run = async function ({ api, event, args }) {
  const input = args.join(" ");
  if (!input) {
    return api.sendMessage(
      "🤖 GPT ব্যবহারের জন্য কিছু লিখুন। যেমন:\n/openrouter Explain black holes",
      event.threadID,
      event.messageID
    );
  }

  api.sendMessage("🤔 GPT চিন্তা করছে... একটু অপেক্ষা করো!", event.threadID);
  const reply = await askOpenRouter(input);
  api.sendMessage(`🤖 GPT:\n\n${reply}`, event.threadID, event.messageID);
};
