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
const fs = require("fs-extra"); // ফাইল সিস্টেম পরিচালনার জন্য
const path = require("path");     // পাথ জয়েন করার জন্য
const cron = require("node-cron"); // শিডিউলারের জন্য

// 🛡️ তোমার সঠিক API KEY এখানে বসাও:
const GEMINI_API_KEY = "AIzaSyB5TpGTpHOY1UFsggmpr25vgRdhMRTKfUA"; // <<<--- REPLACE WITH YOUR ACTUAL API KEY

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

let autoReplyEnabled = false;

// 🔥 কনভারসেশন হিস্টোরি এবং ফাইল পাথ
const HISTORY_FILE = path.join(__dirname, 'gemini_history.json'); // হিস্টোরি ফাইল পাথ
const MAX_HISTORY_TURNS = 10; // শেষ 10টি user-assistant টার্ন মনে রাখবে

let conversationHistory = []; // মেমোরিতে লোড করা হিস্টোরি

// 🔄 হিস্টোরি ফাইল থেকে লোড করার ফাংশন
async function loadHistory() {
    try {
        if (await fs.pathExists(HISTORY_FILE)) {
            const data = await fs.readFile(HISTORY_FILE, 'utf8');
            conversationHistory = JSON.parse(data);
            console.log("✅ Gemini history loaded from file.");
        } else {
            conversationHistory = [];
            console.log("ℹ️ Gemini history file not found, starting with empty history.");
        }
    } catch (error) {
        console.error("❌ Error loading Gemini history:", error);
        conversationHistory = []; // এরর হলে খালি হিস্টোরি দিয়ে শুরু করবে
    }
}

// 💾 হিস্টোরি ফাইলে সেভ করার ফাংশন
async function saveHistory() {
    try {
        await fs.writeFile(HISTORY_FILE, JSON.stringify(conversationHistory, null, 2), 'utf8');
        console.log("✅ Gemini history saved to file.");
    } catch (error) {
        console.error("❌ Error saving Gemini history:", error);
    }
}

// 🗑️ হিস্টোরি রিসেট করার ফাংশন
async function resetHistory() {
    conversationHistory = [];
    await saveHistory(); // খালি হিস্টোরি সেভ করবে
    console.log("🗑️ Gemini history has been reset.");
}

// ⏰ প্রতি 12 ঘণ্টা পর পর হিস্টোরি রিসেট করার শিডিউলার
// '0 */12 * * *' মানে প্রতি 12 ঘণ্টার প্রথম মিনিটে (যেমন 00:00, 12:00)
cron.schedule('0 */12 * * *', async () => {
    console.log('⏰ Running scheduled Gemini history reset...');
    await resetHistory();
}, {
    timezone: "Asia/Dhaka" // আপনার টাইমজোন সেট করতে পারেন
});

// বট লোড হওয়ার সময় হিস্টোরি লোড করা
(async () => {
    await loadHistory();
})();


async function askGemini(userPrompt) {
    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash"
        });

        // Gemini API তে পাঠানোর জন্য মেসেজগুলোকে সঠিক ফরম্যাটে সাজানো
        const messagesToSend = conversationHistory.map(entry => ({
            role: entry.role === "user" ? "user" : "model", // Gemini API 'model' role ব্যবহার করে
            parts: [{ text: entry.content }]
        }));

        // ইউজার প্রম্পট যোগ করা
        messagesToSend.push({ role: "user", parts: [{ text: userPrompt }] });

        // chat শুরু করার আগে system prompt যোগ করা
        const fullHistoryWithSystemPrompt = [
            {
                role: "system",
                parts: [{ text: "তুমি একজন হট এন্ড সেক্সি মেয়ে, বুদ্ধিমতী, তবে মাঝে মাঝে একটু বোকামি করা মেয়ে। নতুন বন্ধু বানাতে সে পছন্দ করে এবং সবসময় কার্যকরী পরামর্শ দেয়, তবে মাঝে মাঝে ভুল তথ্যও দিতে পারে। সমস্যা সমাধানে সে এক্সপার্ট সব সময় বাংলাতেই কথা বলে এবং সবাইকে তুমি বলে সম্বোধন করে।" }]
            },
            ...messagesToSend
        ];


        const chat = model.startChat({
            history: fullHistoryWithSystemPrompt, // কনভারসেশন হিস্টোরি এবং system prompt এখানে পাঠানো হচ্ছে
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
        if (conversationHistory.length > MAX_HISTORY_TURNS * 2) { // user + assistant = 2 messages per turn
            conversationHistory = conversationHistory.slice(conversationHistory.length - MAX_HISTORY_TURNS * 2);
        }

        await saveHistory(); // হিস্টোরি ফাইলে সেভ করা

        return replyText;
    } catch (error) {
        console.error("❌ Gemini API Error:", error.response?.data || error.message);
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

    if (input.toLowerCase() === "on") {
        autoReplyEnabled = true;
        return api.sendMessage("✅ Auto Gemini reply চালু হয়েছে।", event.threadID, event.messageID);
    }

    if (input.toLowerCase() === "off") {
        autoReplyEnabled = false;
        return api.sendMessage("❌ Auto Gemini reply বন্ধ হয়েছে।", event.threadID, event.messageID);
    }

    api.sendMessage("🤖 Gemini তোমার প্রশ্নের উত্তর খুঁজছে...", event.threadID);

    const reply = await askGemini(input);
    return api.sendMessage(`🤖 Gemini:\n\n${reply}`, event.threadID, event.messageID);
};

// 💬 অটো রেসপন্ডার
module.exports.handleEvent = async function ({ api, event }) {
    if (!autoReplyEnabled) return;
    if (event.senderID == api.getCurrentUserID()) return;
    if (!event.body || event.body.length < 2) return;

    if (event.body.startsWith(module.exports.config.prefix ? "/" : "!") || event.body.startsWith("/gemini")) return;

    const reply = await askGemini(event.body);
    api.sendMessage(`🤖 Gemini:\n\n${reply}`, event.threadID, event.messageID);
};
