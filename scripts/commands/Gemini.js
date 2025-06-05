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

// 🔥 কনভারসেশন হিস্টোরি ফোল্ডার এবং সেটিংস
const HISTORY_DIR = path.join(__dirname, 'gemini_histories'); // হিস্টোরি ফাইলগুলো এই ফোল্ডারে থাকবে
const MAX_HISTORY_TURNS = 50; // শেষ 10টি user-assistant টার্ন মনে রাখবে

// মেমোরিতে লোড করা হিস্টোরি (প্রতিটি থ্রেড ID এর জন্য আলাদা)
// উদাহরণ: { "threadID1": [{role: "user", content: "msg"}, ...], "threadID2": [...] }
let loadedHistories = {};

// 🔄 থ্রেড-ভিত্তিক হিস্টোরি ফাইল থেকে লোড করার ফাংশন
async function loadHistoryForThread(threadID) {
    const threadHistoryFile = path.join(HISTORY_DIR, `${threadID}.json`);
    try {
        if (await fs.pathExists(threadHistoryFile)) {
            const data = await fs.readFile(threadHistoryFile, 'utf8');
            loadedHistories[threadID] = JSON.parse(data);
            console.log(`✅ Gemini history loaded for thread ${threadID}.`);
        } else {
            loadedHistories[threadID] = []; // ফাইল না থাকলে, খালি হিস্টোরি দিয়ে শুরু করবে
            console.log(`ℹ️ Gemini history file not found for thread ${threadID}, starting with empty history.`);
        }
    } catch (error) {
        console.error(`❌ Error loading Gemini history for thread ${threadID}:`, error);
        loadedHistories[threadID] = []; // এরর হলে খালি হিস্টোরি দিয়ে শুরু করবে
    }
}

// 💾 থ্রেড-ভিত্তিক হিস্টোরি ফাইলে সেভ করার ফাংশন
async function saveHistoryForThread(threadID) {
    const threadHistoryFile = path.join(HISTORY_DIR, `${threadID}.json`);
    try {
        // নিশ্চিত করুন যে HISTORY_DIR ফোল্ডারটি আছে
        await fs.ensureDir(HISTORY_DIR);
        await fs.writeFile(threadHistoryFile, JSON.stringify(loadedHistories[threadID], null, 2), 'utf8');
        console.log(`✅ Gemini history saved for thread ${threadID}.`);
    } catch (error) {
        console.error(`❌ Error saving Gemini history for thread ${threadID}:`, error);
    }
}

// 🗑️ সব থ্রেডের হিস্টোরি রিসেট করার ফাংশন
async function resetAllHistories() {
    loadedHistories = {}; // মেমোরি থেকে সব হিস্টোরি খালি করবে
    try {
        if (await fs.pathExists(HISTORY_DIR)) {
            await fs.emptyDir(HISTORY_DIR); // ফোল্ডারের সব ফাইল মুছে দেবে
            console.log("🗑️ All Gemini history files have been reset.");
        } else {
            console.log("🗑️ Gemini history directory not found, no histories to reset.");
        }
    } catch (error) {
        console.error("❌ Error resetting all Gemini histories:", error);
    }
}

// ⏰ প্রতি 12 ঘণ্টা পর পর সব হিস্টোরি রিসেট করার শিডিউলার
cron.schedule('0 */12 * * *', async () => {
    console.log('⏰ Running scheduled Gemini history reset for all threads...');
    await resetAllHistories();
}, {
    timezone: "Asia/Dhaka" // আপনার টাইমজোন সেট করতে পারেন
});

// বট লোড হওয়ার সময়: এখানে আসলে সব হিস্টোরি লোড করার দরকার নেই,
// যখন যে থ্রেডে মেসেজ আসবে, তখন সেই থ্রেডের হিস্টোরি লোড হবে।
// তবে, ফোল্ডারটি তৈরি নিশ্চিত করতে পারি।
(async () => {
    await fs.ensureDir(HISTORY_DIR);
    console.log(`ℹ️ Gemini history directory '${HISTORY_DIR}' ensured.`);
})();


async function askGemini(userPrompt, threadID) {
    // এই থ্রেডের জন্য হিস্টোরি লোড করা হয়েছে কিনা, তা নিশ্চিত করা
    if (!loadedHistories[threadID]) {
        await loadHistoryForThread(threadID);
    }

    const currentConversationHistory = loadedHistories[threadID];

    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash"
        });

        // আপনার চরিত্র প্রম্পট
        const personaPrompt = "তুমি একজন হট এন্ড সেক্সি মেয়ে, বুদ্ধিমতী, তবে মাঝে মাঝে একটু বোকামি করা মেয়ে। নতুন বন্ধু বানাতে সে পছন্দ করে এবং সবসময় কার্যকরী পরামর্শ দেয়, তবে মাঝে মাঝে ভুল তথ্যও দিতে পারে। সমস্যা সমাধানে সে এক্সপার্ট সব সময় বাংলাতেই কথা বলে এবং সবাইকে তুমি বলে সম্বোধন করে।";

        // Gemini API তে পাঠানোর জন্য মেসেজগুলোকে সঠিক ফরম্যাটে সাজানো
        const messagesToSend = currentConversationHistory.map(entry => ({
            role: entry.role === "user" ? "user" : "model",
            parts: [{ text: entry.content }]
        }));

        let finalPromptForGemini;
        // যদি chat history খালি হয়, তাহলে প্রথম user মেসেজের সাথে personaPrompt যোগ করুন
        if (currentConversationHistory.length === 0) {
            finalPromptForGemini = `${personaPrompt}\n\n👉 প্রশ্ন: ${userPrompt}`;
        } else {
            finalPromptForGemini = userPrompt;
        }

        const chat = model.startChat({
            history: messagesToSend, // এখানে শুধু ইউজার এবং মডেলের পূর্ববর্তী কথোপকথন থাকবে
            generationConfig: {
                maxOutputTokens: 2048,
            },
        });
        
        const result = await chat.sendMessage(finalPromptForGemini);
        const response = await result.response;
        const replyText = response.text();

        // 📝 কনভারসেশন হিস্টোরি আপডেট করা
        currentConversationHistory.push({ role: "user", content: userPrompt });
        currentConversationHistory.push({ role: "assistant", content: replyText });

        // হিস্টোরি একটি নির্দিষ্ট দৈর্ঘ্যে সীমাবদ্ধ রাখা
        if (currentConversationHistory.length > MAX_HISTORY_TURNS * 2) {
            loadedHistories[threadID] = currentConversationHistory.slice(currentConversationHistory.length - MAX_HISTORY_TURNS * 2);
        } else {
             loadedHistories[threadID] = currentConversationHistory;
        }

        await saveHistoryForThread(threadID); // এই থ্রেডের হিস্টোরি ফাইলে সেভ করা

        return replyText;
    } catch (error) {
        console.error("❌ Gemini API Error:", error.response?.data || error.message);
        // [GoogleGenerativeAI Error]: First content should be with role 'user', got system
        // এই এররটি এড়াতে, system prompt কে সরাসরি history তে না দিয়ে user prompt এর অংশ হিসেবে পাঠানো হয়েছে
        return "❌ Gemini API তে সমস্যা হয়েছে। আমি দুঃখিত, বন্ধু। পরে আবার চেষ্টা করো।";
    }
}

// ✅ /gemini কমান্ড
module.exports.run = async function ({ api, event, args }) {
    const input = args.join(" ");
    const threadID = event.threadID; // থ্রেড আইডি নেওয়া

    if (!input) {
        return api.sendMessage(
            "🧠 Gemini ব্যবহারের জন্য কিছু লিখুন। যেমন:\n/gemini Explain Quantum Physics",
            threadID,
            event.messageID
        );
    }

    if (input.toLowerCase() === "on") {
        autoReplyEnabled = true;
        return api.sendMessage("✅ Auto Gemini reply চালু হয়েছে।", threadID, event.messageID);
    }

    if (input.toLowerCase() === "off") {
        autoReplyEnabled = false;
        return api.sendMessage("❌ Auto Gemini reply বন্ধ হয়েছে।", threadID, event.messageID);
    }

    api.sendMessage("🤖 Gemini তোমার প্রশ্নের উত্তর খুঁজছে...", threadID);

    const reply = await askGemini(input, threadID); // threadID পাস করা
    return api.sendMessage(`🤖 Gemini:\n\n${reply}`, threadID, event.messageID);
};

// 💬 অটো রেসপন্ডার
module.exports.handleEvent = async function ({ api, event }) {
    if (!autoReplyEnabled) return;
    if (event.senderID == api.getCurrentUserID()) return;
    if (!event.body || event.body.length < 2) return;

    if (event.body.startsWith(module.exports.config.prefix ? "/" : "!") || event.body.startsWith("/gemini")) return;

    const threadID = event.threadID; // থ্রেড আইডি নেওয়া
    const reply = await askGemini(event.body, threadID); // threadID পাস করা
    api.sendMessage(`🤖 Gemini:\n\n${reply}`, threadID, event.messageID);
};
