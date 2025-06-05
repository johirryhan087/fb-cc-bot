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
const fs = require("fs-extra");
const path = require("path");
const cron = require("node-cron");

// 🔐 API KEY
const GEMINI_API_KEY = "AIzaSyB5TpGTpHOY1UFsggmpr25vgRdhMRTKfUA";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// 🗂️ Paths
const HISTORY_DIR = path.join(__dirname, 'gemini_histories');
const STATE_FILE = path.join(__dirname, 'gemini_state.json');

let autoReplyEnabled = false;
const MAX_HISTORY_TURNS = 50;
let loadedHistories = {};

// 🔄 Auto state functions
async function loadAutoReplyState() {
    try {
        if (await fs.pathExists(STATE_FILE)) {
            const data = await fs.readFile(STATE_FILE, 'utf8');
            const parsed = JSON.parse(data);
            autoReplyEnabled = parsed.autoReplyEnabled || false;
            console.log(`🔄 Auto reply state loaded: ${autoReplyEnabled}`);
        } else {
            autoReplyEnabled = false;
        }
    } catch (err) {
        console.error("❌ Error loading auto reply state:", err);
        autoReplyEnabled = false;
    }
}

async function saveAutoReplyState() {
    try {
        const data = { autoReplyEnabled };
        await fs.writeFile(STATE_FILE, JSON.stringify(data, null, 2), 'utf8');
        console.log(`💾 Auto reply state saved: ${autoReplyEnabled}`);
    } catch (err) {
        console.error("❌ Error saving auto reply state:", err);
    }
}

// 🧠 Load history
async function loadHistoryForThread(threadID) {
    const threadHistoryFile = path.join(HISTORY_DIR, `${threadID}.json`);
    try {
        if (await fs.pathExists(threadHistoryFile)) {
            const data = await fs.readFile(threadHistoryFile, 'utf8');
            loadedHistories[threadID] = JSON.parse(data);
            console.log(`✅ Gemini history loaded for thread ${threadID}.`);
        } else {
            loadedHistories[threadID] = [];
            console.log(`ℹ️ No history file found for thread ${threadID}, starting fresh.`);
        }
    } catch (error) {
        console.error(`❌ Error loading history for thread ${threadID}:`, error);
        loadedHistories[threadID] = [];
    }
}

// 💾 Save history
async function saveHistoryForThread(threadID) {
    const threadHistoryFile = path.join(HISTORY_DIR, `${threadID}.json`);
    try {
        await fs.ensureDir(HISTORY_DIR);
        await fs.writeFile(threadHistoryFile, JSON.stringify(loadedHistories[threadID], null, 2), 'utf8');
        console.log(`✅ History saved for thread ${threadID}.`);
    } catch (error) {
        console.error(`❌ Error saving history for thread ${threadID}:`, error);
    }
}

// 🗑️ Reset all histories
async function resetAllHistories() {
    loadedHistories = {};
    try {
        if (await fs.pathExists(HISTORY_DIR)) {
            await fs.emptyDir(HISTORY_DIR);
            console.log("🗑️ All histories reset.");
        } else {
            console.log("🗑️ No history directory found.");
        }
    } catch (error) {
        console.error("❌ Error resetting histories:", error);
    }
}

// ⏰ Schedule reset every 12 hours
cron.schedule('0 */12 * * *', async () => {
    console.log('⏰ Scheduled Gemini history reset running...');
    await resetAllHistories();
}, {
    timezone: "Asia/Dhaka"
});

// 📁 Ensure folders exist and load state
(async () => {
    await fs.ensureDir(HISTORY_DIR);
    await loadAutoReplyState();
})();

// 🤖 Ask Gemini
async function askGemini(userPrompt, threadID) {
    if (!loadedHistories[threadID]) {
        await loadHistoryForThread(threadID);
    }

    const currentConversationHistory = loadedHistories[threadID];

    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash"
        });

        const personaPrompt = "তুমি একজন হট এন্ড সেক্সি মেয়ে, বুদ্ধিমতী, তবে মাঝে মাঝে একটু বোকামি করা মেয়ে। নতুন বন্ধু বানাতে সে পছন্দ করে এবং সবসময় কার্যকরী পরামর্শ দেয়, তবে মাঝে মাঝে ভুল তথ্যও দিতে পারে। সমস্যা সমাধানে সে এক্সপার্ট সব সময় বাংলাতেই কথা বলে এবং সবাইকে তুমি বলে সম্বোধন করে।";

        const messagesToSend = currentConversationHistory.map(entry => ({
            role: entry.role === "user" ? "user" : "model",
            parts: [{ text: entry.content }]
        }));

        let finalPromptForGemini;
        if (currentConversationHistory.length === 0) {
            finalPromptForGemini = `${personaPrompt}\n\n👉 প্রশ্ন: ${userPrompt}`;
        } else {
            finalPromptForGemini = userPrompt;
        }

        const chat = model.startChat({
            history: messagesToSend,
            generationConfig: {
                maxOutputTokens: 2048,
            },
        });

        const result = await chat.sendMessage(finalPromptForGemini);
        const response = await result.response;
        const replyText = response.text();

        currentConversationHistory.push({ role: "user", content: userPrompt });
        currentConversationHistory.push({ role: "assistant", content: replyText });

        if (currentConversationHistory.length > MAX_HISTORY_TURNS * 2) {
            loadedHistories[threadID] = currentConversationHistory.slice(currentConversationHistory.length - MAX_HISTORY_TURNS * 2);
        } else {
            loadedHistories[threadID] = currentConversationHistory;
        }

        await saveHistoryForThread(threadID);
        return replyText;
    } catch (error) {
        console.error("❌ Gemini API Error:", error.response?.data || error.message);
        return "❌ Gemini API তে সমস্যা হয়েছে। পরে আবার চেষ্টা করো।";
    }
}

// ✅ /gemini কমান্ড
module.exports.run = async function ({ api, event, args }) {
    const input = args.join(" ");
    const threadID = event.threadID;

    if (!input) {
        return api.sendMessage(
            "🧠 Gemini ব্যবহারের জন্য কিছু লিখুন। যেমন:\n/gemini Explain Quantum Physics",
            threadID,
            event.messageID
        );
    }

    if (input.toLowerCase() === "on") {
        autoReplyEnabled = true;
        await saveAutoReplyState();
        return api.sendMessage("✅ Auto Gemini reply চালু হয়েছে।", threadID, event.messageID);
    }

    if (input.toLowerCase() === "off") {
        autoReplyEnabled = false;
        await saveAutoReplyState();
        return api.sendMessage("❌ Auto Gemini reply বন্ধ হয়েছে।", threadID, event.messageID);
    }

    api.sendMessage("🤖 Gemini তোমার প্রশ্নের উত্তর খুঁজছে...", threadID);
    const reply = await askGemini(input, threadID);
    return api.sendMessage(`🤖 Gemini:\n\n${reply}`, threadID, event.messageID);
};

// 💬 অটো রেসপন্ডার
module.exports.handleEvent = async function ({ api, event }) {
    if (!autoReplyEnabled) return;
    if (event.senderID == api.getCurrentUserID()) return;
    if (!event.body || event.body.length < 2) return;
    if (event.body.startsWith(module.exports.config.prefix ? "/" : "!") || event.body.startsWith("/gemini")) return;

    const threadID = event.threadID;
    const reply = await askGemini(event.body, threadID);
    api.sendMessage(`🤖 Gemini:\n\n${reply}`, threadID, event.messageID);
};
