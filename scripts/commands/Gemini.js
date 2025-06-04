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

// 🔥 কনভারসেশন হিস্টোরি এখানে থাকবে (বট রিস্টার্ট হলে রিসেট হবে)
// প্রতিটি কথোপকথন একটি অবজেক্ট হিসেবে থাকবে: { role: "user" | "assistant", content: "message" }
let conversationHistory = [];
const MAX_HISTORY_TURNS = 5; // শেষ 5টি user-assistant টার্ন মনে রাখবে

async function askGemini(userPrompt) {
    try {
        const model = genAI.getGenerativeModel({
            // 🔁 লক্ষ্য করো — এখানে মডেলের নাম আপডেট করা হয়েছে
            // 'models/gemini-pro' এর বদলে 'gemini-1.5-flash' ব্যবহার করা হয়েছে।
            // তুমি চাইলে 'gemini-1.5-pro' ও ব্যবহার করতে পারো যদি উন্নত মানের উত্তর দরকার হয়।
            model: "gemini-1.5-flash"
        });

        // Gemini API তে পাঠানোর জন্য মেসেজগুলোকে সঠিক ফরম্যাটে সাজানো
        const messagesToSend = conversationHistory.map(entry => ({
            role: entry.role === "user" ? "user" : "model", // Gemini API 'model' role ব্যবহার করে
            parts: [{ text: entry.content }]
        }));

        // ইউজার প্রম্পট যোগ করা
        messagesToSend.push({ role: "user", parts: [{ text: userPrompt }] });


        const chat = model.startChat({
            history: messagesToSend, // কনভারসেশন হিস্টোরি এখানে পাঠানো হচ্ছে
            generationConfig: {
                maxOutputTokens: 2048,
            },
        });

        const result = await chat.sendMessage(userPrompt); // এখানে শুধু userPrompt পাঠানো হচ্ছে কারণ history উপরে startChat এ সেট করা হয়েছে
        const response = await result.response;
        const replyText = response.text();

        // 📝 কনভারসেশন হিস্টোরি আপডেট করা
        conversationHistory.push({ role: "user", content: userPrompt });
        conversationHistory.push({ role: "assistant", content: replyText });

        // হিস্টোরি একটি নির্দিষ্ট দৈর্ঘ্যে সীমাবদ্ধ রাখা (যাতে খুব বেশি বড় না হয়)
        // প্রতিটি টার্ন (user + assistant) দুইটি মেসেজ, তাই MAX_HISTORY_TURNS * 2
        if (conversationHistory.length > MAX_HISTORY_TURNS * 2) {
            conversationHistory = conversationHistory.slice(conversationHistory.length - MAX_HISTORY_TURNS * 2);
        }

        return replyText;
    } catch (error) {
        console.error("Gemini API Error:", error);
        // ব্যবহারকারীকে আরও তথ্যবহুল মেসেজ দেওয়া হয়েছে
        return "❌ Gemini API তে সমস্যা হয়েছে। আমি দুঃখিত, বন্ধু। পরে আবার চেষ্টা করো।";
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
        return api.sendMessage("✅ Auto Gemini reply চালু হয়েছে।", event.threadID, event.messageID);
    }

    if (input.toLowerCase() === "off") { // Added .toLowerCase() for robustness
        autoReplyEnabled = false;
        return api.sendMessage("❌ Auto Gemini reply বন্ধ হয়েছে।", event.threadID, event.messageID);
    }

    // বট প্রসেস করছে নির্দেশ করে
    api.sendMessage("🤖 Gemini তোমার প্রশ্নের উত্তর খুঁজছে...", event.threadID);

    const reply = await askGemini(input);
    return api.sendMessage(`🤖 Gemini:\n\n${reply}`, event.threadID, event.messageID);
};

// 💬 অটো রেসপন্ডার
module.exports.handleEvent = async function ({ api, event }) {
    if (!autoReplyEnabled) return;
    if (event.senderID == api.getCurrentUserID()) return; // বট যেন নিজের মেসেজের উত্তর না দেয়
    if (!event.body || event.body.length < 2) return; // খুব ছোট বা খালি মেসেজ ইগনোর করা

    // কমান্ডগুলো ইগনোর করা যাতে অটো-রিপ্লাই ট্রিগার না হয়
    if (event.body.startsWith(module.exports.config.prefix ? "/" : "!") || event.body.startsWith("/gemini")) return;

    // আপনি এখানে একটি ছোট বিলম্ব বা "typing..." নির্দেশক যোগ করতে পারেন
    // api.sendTypingIndicator(event.threadID); // উদাহরণ, আপনার API র‍্যাপার অনুযায়ী

    const reply = await askGemini(event.body);
    api.sendMessage(`🤖 Gemini:\n\n${reply}`, event.threadID, event.messageID);
};
