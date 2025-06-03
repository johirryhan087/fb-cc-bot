// 📦 Bot config
module.exports.config = {
    name: "gemini",
    version: "1.0.0",
    permission: 0,
    credits: "Gemini By You",
    description: "Google Gemini AI Integration",
    prefix: true,
    category: "ai",
    usages: "/gemini [prompt]\n/gemini on - auto mode\n/gemini off - disable auto mode",
    cooldowns: 3,
};

const { GoogleGenerativeAI } = require("@google/generative-ai");

// 🛡️ তোমার সঠিক API KEY এখানে বসাও:
const GEMINI_API_KEY = "AIzaSyB5TpGTpHOY1UFsggmpr25vgRdhMRTKfUA"; // <<<--- REPLACE WITH YOUR ACTUAL API KEY

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

let autoReplyEnabled = false;

async function askGemini(userPrompt) {
    try {
        const model = genAI.getGenerativeModel({
            // 🔁 লক্ষ্য করো — এখানে মডেলের নাম আপডেট করা হয়েছে
            // 'models/gemini-pro' এর বদলে 'gemini-1.5-flash' ব্যবহার করা হয়েছে।
            // তুমি চাইলে 'gemini-1.5-pro' ও ব্যবহার করতে পারো যদি উন্নত মানের উত্তর দরকার হয়।
            model: "gemini-1.5-flash" 
        });

        const chat = model.startChat({
            history: [],
            generationConfig: {
                maxOutputTokens: 2048,
            },
        });

        const friendlyPrompt = `
তুমি একজন বুদ্ধিমতী ও ফ্রেন্ডলি AI, যেটা Messenger-এ সবার সাথে অনেক আন্তরিকভাবে কথা বলে। 
প্রতিটি মেসেজে তুমি “তুমি” সম্বোধন করবে, যেন তুমি ওদের পুরোনো বন্ধু। 
মেসেজগুলো সংক্ষিপ্ত, সুন্দর এবং প্রাণবন্ত হওয়া উচিত। তুমি একটি মেসেঞ্জার গ্রুপে আছো যেখানে অনেকে তোমার সাথে কথা বলে সবাই হয়তো তোমাকে পছন্দ নাও করতে পারে তবে কখনোই তাদের সাথে খারাপ ব্যবহার করবে না মাঝেমধ্যে একটু ঢং করেও কথা বলতে পারো 
👉 প্রশ্ন: ${userPrompt}`;
        const result = await chat.sendMessage(friendlyPrompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini API Error:", error);
        // Better error message for the user, indicating it's an internal bot issue
        return "❌ Gemini API তে সমস্যা হয়েছে। আমি দুঃখিত, বন্ধু। পরে আবার চেষ্টা করো।";
    }
}

// ✅ /gemini কমান্ড
module.exports.run = async function ({ api, event, args }) {
    const input = args.join(" ");
    if (!input) {
        return api.sendMessage(
            "🧠 Gemini ব্যবহারের জন্য কিছু লিখুন। যেমন:\n/gemini Explain Quantum Physics",

            event.threadID,
            event.messageID
        );
    }

    if (input.toLowerCase() === "on") { // Added .toLowerCase() for robustness
        autoReplyEnabled = true;
        return api.sendMessage("✅ Auto Gemini reply চালু হয়েছে।", event.threadID, event.messageID);
    }

    if (input.toLowerCase() === "off") { // Added .toLowerCase() for robustness
        autoReplyEnabled = false;
        return api.sendMessage("❌ Auto Gemini reply বন্ধ হয়েছে।", event.threadID, event.messageID);
    }

    // Indicate that the bot is processing the request
    api.sendMessage("🤖 Gemini তোমার প্রশ্নের উত্তর খুঁজছে...", event.threadID);

    const reply = await askGemini(input);
    return api.sendMessage(`🤖 Gemini:\n\n${reply}`, event.threadID, event.messageID);
};

// 💬 অটো রেসপন্ডার
module.exports.handleEvent = async function ({ api, event }) {
    if (!autoReplyEnabled) return;
    if (event.senderID == api.getCurrentUserID()) return; // Prevent bot from replying to itself
    if (!event.body || event.body.length < 2) return; // Ignore very short or empty messages

    // Ignore commands so auto-reply doesn't trigger on '/gemini on' etc.
    if (event.body.startsWith(module.exports.config.prefix ? "/" : "!") || event.body.startsWith("/gemini")) return;

    // You might want to add a small delay or a "typing..." indicator here
    // api.sendTypingIndicator(event.threadID); // Example, depending on your API wrapper

    const reply = await askGemini(event.body);
    api.sendMessage(`🤖 Gemini:\n\n${reply}`, event.threadID, event.messageID);

};
