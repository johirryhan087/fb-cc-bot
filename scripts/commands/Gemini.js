// 📦 Bot config
module.exports.config = {
    name: "gemini",
    version: "1.0.0",
    permission: 0,
    credits: "Gemini By You",
    description: "Google Gemini AI Integration with Vision Capability", // বিবরণ আপডেট করা হয়েছে
    prefix: true,
    category: "ai",
    usages: "/gemini [prompt]\n/gemini on - auto mode\n/gemini off - disable auto mode\n/gemini [ছবি/ভিডিও] [প্রশ্ন] - ছবির বিশ্লেষণ", // ব্যবহারের নির্দেশিকা আপডেট করা হয়েছে
    cooldowns: 3,
};

const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs-extra");
const path = require("path");
const cron = require("node-cron");
const axios = require("axios"); // ছবি ডাউনলোডের জন্য axios প্রয়োজন

// 🛡️ তোমার সঠিক API KEY এখানে বসাও:
const GEMINI_API_KEY = "AIzaSyB5TpGTpHOY1UFsggmpr25vgRdhMRTKfUA"; // <<<--- REPLACE WITH YOUR ACTUAL API KEY

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

let autoReplyEnabled = false;

// 🔥 কনভারসেশন হিস্টোরি ফোল্ডার এবং সেটিংস
const HISTORY_DIR = path.join(__dirname, 'gemini_histories');
const MAX_HISTORY_TURNS = 10; // শেষ 10টি user-assistant টার্ন মনে রাখবে

let loadedHistories = {}; // মেমোরিতে লোড করা হিস্টোরি (প্রতিটি থ্রেড ID এর জন্য আলাদা)

// 🔄 থ্রেড-ভিত্তিক হিস্টোরি ফাইল থেকে লোড করার ফাংশন
async function loadHistoryForThread(threadID) {
    const threadHistoryFile = path.join(HISTORY_DIR, `${threadID}.json`);
    try {
        if (await fs.pathExists(threadHistoryFile)) {
            const data = await fs.readFile(threadHistoryFile, 'utf8');
            loadedHistories[threadID] = JSON.parse(data);
            console.log(`✅ Gemini history loaded for thread ${threadID}.`);
        } else {
            loadedHistories[threadID] = [];
            console.log(`ℹ️ Gemini history file not found for thread ${threadID}, starting with empty history.`);
        }
    } catch (error) {
        console.error(`❌ Error loading Gemini history for thread ${threadID}:`, error);
        loadedHistories[threadID] = [];
    }
}

// 💾 থ্রেড-ভিত্তিক হিস্টোরি ফাইলে সেভ করার ফাংশন
async function saveHistoryForThread(threadID) {
    const threadHistoryFile = path.join(HISTORY_DIR, `${threadID}.json`);
    try {
        await fs.ensureDir(HISTORY_DIR);
        await fs.writeFile(threadHistoryFile, JSON.stringify(loadedHistories[threadID], null, 2), 'utf8');
        console.log(`✅ Gemini history saved for thread ${threadID}.`);
    } catch (error) {
        console.error(`❌ Error saving Gemini history for thread ${threadID}:`, error);
    }
}

// 🗑️ সব থ্রেডের হিস্টোরি রিসেট করার ফাংশন
async function resetAllHistories() {
    loadedHistories = {};
    try {
        if (await fs.pathExists(HISTORY_DIR)) {
            await fs.emptyDir(HISTORY_DIR);
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

// বট লোড হওয়ার সময়: ফোল্ডারটি তৈরি নিশ্চিত করতে পারি।
(async () => {
    await fs.ensureDir(HISTORY_DIR);
    console.log(`ℹ️ Gemini history directory '${HISTORY_DIR}' ensured.`);
})();

// ছবিকে Base64 তে এনকোড করার ফাংশন
async function urlToBase64(url) {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data).toString('base64');
    } catch (error) {
        console.error("❌ Error converting URL to Base64:", error);
        return null;
    }
}

async function askGemini(userPrompt, threadID, imageAttachment = null) {
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

        // Gemini API তে পাঠানোর জন্য সম্পূর্ণ কথোপকথনের ইতিহাস তৈরি করা (persona সহ)
        const contentsForGemini = [];

        // যদি chat history খালি হয়, তাহলে প্রথম user মেসেজের সাথে personaPrompt যোগ করুন
        if (currentConversationHistory.length === 0) {
            contentsForGemini.push({
                role: "user",
                parts: [{ text: personaPrompt }]
            });
            // মডেলের প্রথম উত্তরও এখানে রাখতে হবে, যদিও এই প্রথম উত্তরের জন্য মডেলের কোনো প্রতিক্রিয়া নেই
            // এটি Gemini-এর চ্যাট হিস্টোরির নিয়ম মেনে চলার জন্য
            // এই ডিফল্ট প্রতিক্রিয়াটি বটের প্রথম রেসপন্সের অংশ হবে না, শুধু হিস্টোরির ফরম্যাট ঠিক রাখার জন্য।
            contentsForGemini.push({
                role: "model",
                parts: [{ text: "কেমন আছো? আমি তোমার সাথেই আছি, কী জানতে চাও বলো!" }] // একটি ডিফল্ট প্রথম প্রতিক্রিয়া
            });
        }
        
        // পূর্ববর্তী কথোপকথন যোগ করা
        currentConversationHistory.forEach(entry => {
            contentsForGemini.push({
                role: entry.role === "user" ? "user" : "model",
                parts: [{ text: entry.content }]
            });
        });

        // বর্তমান ইউজার প্রম্পট এবং ছবি (যদি থাকে) তৈরি করা
        let currentMessageParts = [];
        if (userPrompt) {
            currentMessageParts.push({ text: userPrompt });
        }

        if (imageAttachment) {
            const base64Image = await urlToBase64(imageAttachment.url);
            if (base64Image) {
                currentMessageParts.push({
                    inlineData: {
                        mimeType: imageAttachment.mimeType,
                        data: base64Image
                    }
                });
                console.log(`🖼️ Image attached with mimeType: ${imageAttachment.mimeType}`);
            } else {
                console.error("❌ Failed to encode image to Base64.");
                return "ছবি বিশ্লেষণ করতে সমস্যা হয়েছে। আমি দুঃখিত, বন্ধু।";
            }
        }

        // যদি কোনো মেসেজ পার্ট না থাকে, তাহলে কিছু করার নেই
        if (currentMessageParts.length === 0) {
            return "কিছু জানতে চেয়েছো নাকি, বন্ধু?";
        }

        // chat শুরু করা, এতে পূর্ববর্তী সম্পূর্ণ মেসেজ হিস্টোরি যাবে
        const chat = model.startChat({
            history: contentsForGemini, // সম্পূর্ণ হিস্টোরি এখানে পাঠানো হচ্ছে
            generationConfig: {
                maxOutputTokens: 2048,
            },
        });
        
        // sendMessage এ শুধু বর্তমান ইউজার প্রম্পট এবং ছবি পাঠানো
        // এখানে sendMessage এর আর্গুমেন্ট হিসেবে একটি অবজেক্ট, যেখানে 'parts' কী এর ভ্যালু হিসেবে অ্যারেটি যাচ্ছে।
        const result = await chat.sendMessage({ parts: currentMessageParts });
        
        const response = await result.response;
        const replyText = response.text();

        // 📝 কনভারসেশন হিস্টোরি আপডেট করা (শুধুমাত্র টেক্সট মেসেজ সেভ হবে)
        currentConversationHistory.push({ role: "user", content: userPrompt || "ছবি পাঠানো হয়েছে" });
        currentConversationHistory.push({ role: "assistant", content: replyText });

        // হিস্টোরি একটি নির্দিষ্ট দৈর্ঘ্যে সীমাবদ্ধ রাখা
        if (currentConversationHistory.length > MAX_HISTORY_TURNS * 2) {
            loadedHistories[threadID] = currentConversationHistory.slice(currentConversationHistory.length - MAX_HISTORY_TURNS * 2);
        } else {
             loadedHistories[threadID] = currentConversationHistory;
        }

        await saveHistoryForThread(threadID);

        return replyText;
    } catch (error) {
        console.error("❌ Gemini API Error:", error.response?.data || error.message);
        // এই এররগুলো সমাধানের জন্য history এবং sendMessage এর লজিক আপডেট করা হয়েছে।
        return "❌ Gemini API তে সমস্যা হয়েছে। আমি দুঃখিত, বন্ধু। পরে আবার চেষ্টা করো।";
    }
}

// ✅ /gemini কমান্ড
module.exports.run = async function ({ api, event, args }) {
    const input = args.join(" ");
    const threadID = event.threadID;

    // সরাসরি /gemini on/off কমান্ড হ্যান্ডেল করা
    if (input.toLowerCase() === "on") {
        autoReplyEnabled = true;
        return api.sendMessage("✅ Auto Gemini reply চালু হয়েছে।", threadID, event.messageID);
    }
    if (input.toLowerCase() === "off") {
        autoReplyEnabled = false;
        return api.sendMessage("❌ Auto Gemini reply বন্ধ হয়েছে।", threadID, event.messageID);
    }

    // ছবি অ্যাটাচমেন্ট থাকলে
    const imageAttachment = event.attachments && event.attachments.length > 0 && event.attachments[0].type === "photo"
                            ? event.attachments[0]
                            : null;
    
    // যদি কোনো টেক্সট ইনপুট না থাকে এবং ছবিও না থাকে
    if (!input && !imageAttachment) {
        return api.sendMessage(
            "🧠 Gemini ব্যবহারের জন্য কিছু লিখুন বা একটি ছবি পাঠান। যেমন:\n/gemini Explain Quantum Physics\n/gemini [ছবি] এই ছবিতে কী আছে?",
            threadID,
            event.messageID
        );
    }

    api.sendMessage("🤖 Gemini তোমার প্রশ্নের উত্তর খুঁজছে...", threadID);

    // askGemini ফাংশনে ছবি এবং টেক্সট উভয়ই পাঠানো হচ্ছে
    const reply = await askGemini(input, threadID, imageAttachment);
    return api.sendMessage(`🤖 Gemini:\n\n${reply}`, threadID, event.messageID);
};

// 💬 অটো রেসপন্ডার
module.exports.handleEvent = async function ({ api, event }) {
    if (!autoReplyEnabled) return;
    if (event.senderID == api.getCurrentUserID()) return;
    if (!event.body && (!event.attachments || event.attachments.length === 0)) return; // খালি মেসেজ বা ছবি না থাকলে ইগনোর

    // কমান্ডগুলো ইগনোর করা যাতে অটো-রিপ্লাই ট্রিগার না হয়
    if (event.body && (event.body.startsWith(module.exports.config.prefix ? "/" : "!") || event.body.startsWith("/gemini"))) return;

    const threadID = event.threadID;

    // ছবি অ্যাটাচমেন্ট থাকলে
    const imageAttachment = event.attachments && event.attachments.length > 0 && event.attachments[0].type === "photo"
                            ? event.attachments[0]
                            : null;
    
    // যদি শুধু ছবি থাকে এবং বডিতে কোনো টেক্সট না থাকে, তাহলে একটি ডিফল্ট প্রম্পট ব্যবহার করা যেতে পারে
    const userPrompt = event.body || (imageAttachment ? "এই ছবিতে কী আছে?" : "");

    if (!userPrompt && !imageAttachment) return; // নিশ্চিত করা যে ইনপুট আছে

    // api.sendTypingIndicator(event.threadID); // উদাহরণ, আপনার API র‍্যাপার অনুযায়ী

    const reply = await askGemini(userPrompt, threadID, imageAttachment);
    api.sendMessage(`🤖 Gemini:\n\n${reply}`, threadID, event.messageID);
};
