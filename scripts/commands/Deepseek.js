module.exports.config = {
    name: "seek", 
    version: "1.0.0",
    permission: 0, 
    credits: "OpenRouter & Your Name", 
    description: "OpenRouter AI Integration with DeepSeek model (Text Only)",
    prefix: true, 
    category: "ai",
    usages: "/seek [prompt]\n/seek on - auto mode\n/seek off - disable auto mode",
    cooldowns: 3, 
};

const fs = require("fs-extra");     
const path = require("path");      
const cron = require("node-cron");  
const axios = require("axios");    

// 🔐 API KEY 
const OPENROUTER_API_KEY = "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";

// 🗂️ হিস্টরি ফাইল সংরক্ষণের ডিরেক্টরি
const HISTORY_DIR = path.join(__dirname, 'seek_histories'); 

let autoReplyState = {};

// 📈 প্রতি থ্রেডে কথোপকথন হিস্টরির সর্বোচ্চ টার্ন সংখ্যা
const MAX_HISTORY_TURNS = 50; 
let loadedHistories = {};    

// 🧠 একটি নির্দিষ্ট থ্রেডের জন্য কথোপকথন হিস্টরি লোড করো
async function loadHistoryForThread(threadID) {
    const threadHistoryFile = path.join(HISTORY_DIR, `${threadID}.json`);
    try {
        if (await fs.pathExists(threadHistoryFile)) {
            const data = await fs.readFile(threadHistoryFile, 'utf8');
            loadedHistories[threadID] = JSON.parse(data);
            console.log(`[Seek Bot] ✅ থ্রেড ${threadID} এর জন্য হিস্টরি লোড হয়েছে।`);
        } else {
            loadedHistories[threadID] = []; 
            console.log(`[Seek Bot] ℹ️ থ্রেড ${threadID} এর জন্য কোনো হিস্টরি ফাইল পাওয়া যায়নি, নতুন করে শুরু হচ্ছে।`);
        }
    } catch (error) {
        console.error(`[Seek Bot] ❌ থ্রেড ${threadID} এর জন্য হিস্টরি লোড করতে সমস্যা হয়েছে:`, error);
        loadedHistories[threadID] = []; 
    }
}

// 💾 একটি নির্দিষ্ট থ্রেডের জন্য কথোপকথন হিস্টরি সেভ করো
async function saveHistoryForThread(threadID) {
    const threadHistoryFile = path.join(HISTORY_DIR, `${threadID}.json`);
    try {
        await fs.ensureDir(HISTORY_DIR); 
        await fs.writeFile(threadHistoryFile, JSON.stringify(loadedHistories[threadID], null, 2), 'utf8');
        console.log(`[Seek Bot] ✅ থ্রেড ${threadID} এর জন্য হিস্টরি সেভ হয়েছে।`);
    } catch (error) {
        console.error(`[Seek Bot] ❌ থ্রেড ${threadID} এর জন্য হিস্টরি সেভ করতে সমস্যা হয়েছে:`, error);
    }
}

// 🗑️ সব থ্রেডের কথোপকথন হিস্টরি রিসেট করো (ফাইল ডিলিট করে)
async function resetAllHistories() {
    loadedHistories = {}; 
    try {
        if (await fs.pathExists(HISTORY_DIR)) {
            await fs.emptyDir(HISTORY_DIR); 
            console.log("[Seek Bot] 🗑️ সব হিস্টরি রিসেট হয়েছে।");
        } else {
            console.log("[Seek Bot] 🗑️ কোনো হিস্টরি ডিরেক্টরি পাওয়া যায়নি।");
        }
    } catch (error) {
        console.error("[Seek Bot] ❌ হিস্টরি রিসেট করতে সমস্যা হয়েছে:", error);
    }
}

// ⏰ প্রতি 12 ঘন্টা পর পর সব হিস্টরি রিসেট করার জন্য শিডিউল সেট করো
cron.schedule('0 */12 * * *', async () => {
    console.log('[Seek Bot] ⏰ শিডিউল করা হিস্টরি রিসেট চলছে...');
    await resetAllHistories();
}, {
    timezone: "Asia/Dhaka" 
});

// 📁 কোড লোড হওয়ার সময় হিস্টরি ফোল্ডার আছে কিনা নিশ্চিত করো
(async () => {
    await fs.ensureDir(HISTORY_DIR);
})();

// 🤖 OpenRouter API ব্যবহার করে DeepSeek মডেল থেকে উত্তর পাও
async function getSeekResponse(userPrompt, threadID) {
    // যদি এই থ্রেডের জন্য হিস্টরি লোড না থাকে, তাহলে লোড করো
    if (!loadedHistories[threadID]) {
        await loadHistoryForThread(threadID);
    }

    const currentConversationHistory = loadedHistories[threadID];

    try {
        // পার্সোনা প্রম্পট: AI এর ব্যক্তিত্ব নির্ধারণ করে
        const personaPrompt = " তুমি একটি বুদ্ধিমতি AI তোমাকে যা প্রশ্ন করা হবে শুধু তারই উত্তর দিবে এর বাহিরে কোন উত্তর দিবে না, চেষ্টা করবে একটা শব্দের মধ্যে উত্তর দেওয়ার আর যখন দরকার হবে তখন বাক্যে এক বা একাধিক তবে বেশি যেন না হয়, অল্প কয়েক বাক্যে";

        // যদি কথোপকথন নতুন হয় (হিস্টরি খালি), তাহলে পার্সোনা প্রম্পট যোগ করো
        if (currentConversationHistory.length === 0) {
            currentConversationHistory.push({ role: "user", content: personaPrompt });
            // পার্সোনার প্রাথমিক প্রতিক্রিয়া যোগ করো
            currentConversationHistory.push({ role: "assistant", content: "hi" });
        }

        const messagesForAPI = currentConversationHistory.map(entry => ({
            role: entry.role === "user" ? "user" : "assistant",
            content: entry.content
        }));

        // বর্তমান ইউজার প্রম্পটটি মেসেজ লিস্টে যোগ করো
        messagesForAPI.push({ role: "user", content: userPrompt });

        // OpenRouter API-তে HTTP POST রিকুয়েস্ট পাঠাও
        const response = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                // এখানে DeepSeek মডেল ব্যবহার করা হয়েছে, যা তোমার দেওয়া ছিল
                model: "deepseek/deepseek-r1-0528:free",
                messages: messagesForAPI,
                max_tokens: 2048, 
            },
            {
                headers: {
                    "Authorization": `Bearer ${OPENROUTER_API_KEY}`, 
                    "Content-Type": "application/json",              
                },
            }
        );

        // API রেসপন্স থেকে AI এর উত্তর বের করো
        const replyText = response.data.choices[0].message.content;

        // কথোপকথন হিস্টরি আপডেট করো
        currentConversationHistory.push({ role: "user", content: userPrompt });
        currentConversationHistory.push({ role: "assistant", content: replyText });

        // যদি হিস্টরি খুব লম্বা হয়ে যায়, তাহলে পুরোনো মেসেজগুলো ছাঁটাই করো
        if (currentConversationHistory.length > MAX_HISTORY_TURNS * 2) {
            loadedHistories[threadID] = currentConversationHistory.slice(currentConversationHistory.length - MAX_HISTORY_TURNS * 2);
        } else {
            loadedHistories[threadID] = currentConversationHistory;
        }

        // আপডেট করা হিস্টরি ফাইলে সেভ করো
        await saveHistoryForThread(threadID);
        return replyText; 
    } catch (error) {
        
        console.error("[Seek Bot] ❌ DeepSeek (OpenRouter) API সমস্যা:", error.response?.data || error.message);
        return "❌ দুঃখিত, DeepSeek API তে সমস্যা হয়েছে। পরে আবার চেষ্টা করো।";
    }
}

async function isAdmin(api, threadID, senderID) {
    try {
        const threadInfo = await api.getThreadInfo(threadID);
        
        return threadInfo.adminIDs.some(adminInfo => adminInfo.id === senderID);
    } catch (error) {
        console.error("[Seek Bot] ❌ অ্যাডমিন স্ট্যাটাস চেক করতে সমস্যা হয়েছে:", error);
        return false; 
    }
}

// ✅ মেইন কমান্ড হ্যান্ডলার (/seek)
module.exports.run = async function ({ api, event, args }) {
    const input = args.join(" "); // কমান্ডের পর ইউজার যা লিখেছে
    const threadID = event.threadID;
    const senderID = event.senderID;

    // "on" বা "off" কমান্ড হ্যান্ডেল করো অটো-রিপ্লাইয়ের জন্য
    if (input.toLowerCase() === "on") {
        if (!await isAdmin(api, threadID, senderID)) {
            return api.sendMessage("⛔ শুধুমাত্র গ্রুপের অ্যাডমিনরা অটো DeepSeek রিপ্লাই চালু করতে পারবে।", threadID, event.messageID);
        }
        autoReplyState[threadID] = true; // এই থ্রেডের জন্য অটো-রিপ্লাই চালু করো
        return api.sendMessage("✅ অটো DeepSeek রিপ্লাই এই চ্যাটে চালু হয়েছে।", threadID, event.messageID);
    }

    if (input.toLowerCase() === "off") {
        if (!await isAdmin(api, threadID, senderID)) {
            return api.sendMessage("⛔ শুধুমাত্র গ্রুপের অ্যাডমিনরা অটো DeepSeek রিপ্লাই বন্ধ করতে পারবে।", threadID, event.messageID);
        }
        autoReplyState[threadID] = false; // এই থ্রেডের জন্য অটো-রিপ্লাই বন্ধ করো
        return api.sendMessage("❌ অটো DeepSeek রিপ্লাই এই চ্যাটে বন্ধ হয়েছে।", threadID, event.messageID);
    }

    // যদি /seek এর পর কিছু না লেখা হয়
    if (!input) {
        return api.sendMessage(
            "🧠 DeepSeek ব্যবহারের জন্য কিছু লিখুন। যেমন:\n/seek কোয়ান্টাম ফিজিক্স ব্যাখ্যা করো",
            threadID,
            event.messageID
        );
    }

    // AI এর উত্তর আসার আগে একটি লোডিং বার্তা পাঠাও
    api.sendMessage("🤖 DeepSeek তোমার প্রশ্নের উত্তর খুঁজছে...", threadID);

    // AI ফাংশন কল করো এবং উত্তর পাও
    const reply = await getSeekResponse(input, threadID);

    // AI এর উত্তর ইউজারকে পাঠাও
    return api.sendMessage(`🤖 DeepSeek:\n\n${reply}`, threadID, event.messageID);
};

module.exports.handleEvent = async function ({ api, event }) {
    const threadID = event.threadID;


    if (!autoReplyState[threadID]) return;
    if (event.senderID == api.getCurrentUserID()) return; 
    if (!event.body || event.body.length < 2) return; 
    if (event.body.startsWith("/") || event.body.startsWith("!")) return;

    const reply = await getSeekResponse(event.body, threadID);
    api.sendMessage(`🤖 DeepSeek:\n\n${reply}`, threadID, event.messageID);
};
