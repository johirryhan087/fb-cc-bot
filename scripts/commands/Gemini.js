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
const axios = require("axios"); // Added for HTTP requests (image upload/download)
const FormData = require("form-data"); // Added for multipart/form-data for image upload

// 🔐 API KEY - IMPORTANT: Replace with your actual Gemini API Key
const GEMINI_API_KEY = "AIzaSyB5TpGTpHOY1UFsggmpr25vgRdhMRTKfUA"; // Make sure this is a valid API key
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// 🗂️ Paths
const HISTORY_DIR = path.join(__dirname, 'gemini_histories');
const STATE_FILE = path.join(__dirname, 'gemini_state.json');

let autoReplyState = {}; // 🔄 per-thread auto reply state
const MAX_HISTORY_TURNS = 50;
let loadedHistories = {};

// 🔄 Load auto reply state
async function loadAutoReplyState() {
    try {
        if (await fs.pathExists(STATE_FILE)) {
            const data = await fs.readFile(STATE_FILE, 'utf8');
            autoReplyState = JSON.parse(data);
            console.log(`🔄 Auto reply state loaded.`);
        } else {
            autoReplyState = {};
        }
    } catch (err) {
        console.error("❌ Error loading auto reply state:", err);
        autoReplyState = {};
    }
}

// 💾 Save auto reply state
async function saveAutoReplyState() {
    try {
        await fs.writeFile(STATE_FILE, JSON.stringify(autoReplyState, null, 2), 'utf8');
        console.log(`💾 Auto reply state saved.`);
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
    timezone: "Asia/Dhaka" // Timezone set to Bangladesh
});

// 📁 Ensure folders exist and load state
(async () => {
    await fs.ensureDir(HISTORY_DIR);
    await loadAutoReplyState();
})();

// 🤖 Ask Gemini
async function askGemini(userPrompt, threadID, imageUrl = null) {
    if (!loadedHistories[threadID]) {
        await loadHistoryForThread(threadID);
    }

    const currentConversationHistory = loadedHistories[threadID];

    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash" // Using gemini-1.5-flash which supports vision
        });

        const personaPrompt = "তুমি একজন হট এন্ড সেক্সি মেয়ে, বুদ্ধিমতী, তবে মাঝে মাঝে একটু বোকামি করা মেয়ে। নতুন বন্ধু বানাতে সে পছন্দ করে এবং সবসময় কার্যকরী পরামর্শ দেয়, তবে মাঝে মাঝে ভুল তথ্যও দিতে পারে। সমস্যা সমাধানে সে এক্সপার্ট সব সময় বাংলাতেই কথা বলে এবং সবাইকে তুমি বলে সম্বোধন করে।";

        let contents = []; // Array to hold parts for Gemini (text and/or image)

        // Add persona prompt if starting a new conversation and no image is present as the first input
        if (currentConversationHistory.length === 0 && !imageUrl) {
            contents.push({ text: personaPrompt });
        }

        // Add historical messages to contents
        const historyForChat = currentConversationHistory.map(entry => ({
            role: entry.role === "user" ? "user" : "model",
            parts: [{ text: entry.content }]
        }));

        // Handle image if provided
        if (imageUrl) {
            try {
                const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                const imageBuffer = Buffer.from(imageResponse.data);
                const mimeType = imageResponse.headers['content-type'] || 'image/jpeg'; // Determine MIME type

                contents.push({
                    inlineData: {
                        mimeType: mimeType,
                        data: imageBuffer.toString('base64')
                    }
                });
            } catch (imageError) {
                console.error("❌ Error processing image for Gemini:", imageError.message);
                // Continue with text prompt if image fails, or handle as per desired logic
            }
        }
        
        // Add the current user prompt
        contents.push({ text: userPrompt });

        const chat = model.startChat({
            history: historyForChat, // Pass existing history
            generationConfig: {
                maxOutputTokens: 2048,
            },
        });

        const result = await chat.sendMessage(contents); // Send current contents (text + image if any)
        const response = await result.response;
        const replyText = response.text();

        // Update history
        currentConversationHistory.push({ role: "user", content: userPrompt, imageUrl: imageUrl });
        currentConversationHistory.push({ role: "assistant", content: replyText });

        // Trim history if it gets too long
        if (currentConversationHistory.length > MAX_HISTORY_TURNS * 2) {
            loadedHistories[threadID] = currentConversationHistory.slice(currentConversationHistory.length - MAX_HISTORY_TURNS * 2);
        } else {
            loadedHistories[threadID] = currentConversationHistory;
        }

        await saveHistoryForThread(threadID);
        return replyText;
    } catch (error) {
        console.error("❌ Gemini API Error:", error.response?.data || error.message);
        return "❌ Gemini API তে সমস্যা হয়েছে। পরে আবার চেষ্টা করো।";
    }
}

// ✅ /gemini কমান্ড
module.exports.run = async function ({ api, event, args }) {
    const input = args.join(" ");
    const threadID = event.threadID;

    // Handle commands for auto-reply
    if (input.toLowerCase() === "on") {
        autoReplyState[threadID] = true;
        await saveAutoReplyState();
        return api.sendMessage("✅ Auto Gemini reply এই চ্যাটে চালু হয়েছে।", threadID, event.messageID);
    }

    if (input.toLowerCase() === "off") {
        autoReplyState[threadID] = false;
        await saveAutoReplyState();
        return api.sendMessage("❌ Auto Gemini reply এই চ্যাটে বন্ধ হয়েছে।", threadID, event.messageID);
    }

    // Handle direct text prompt for /gemini command
    if (!input && (!event.attachments || event.attachments.length === 0)) {
        return api.sendMessage(
            "🧠 Gemini ব্যবহারের জন্য কিছু লিখুন অথবা একটি ছবি দিন। যেমন:\n/gemini Explain Quantum Physics",
            threadID,
            event.messageID
        );
    }

    let userPrompt = input;
    let imageUrl = null;

    // Check for attached images with the command
    if (event.attachments && event.attachments.length > 0) {
        const imageAttachment = event.attachments.find(att => att.type === "photo");
        if (imageAttachment) {
            api.sendMessage("🖼️ ছবি আপলোড করা হচ্ছে...", threadID, event.messageID);
            try {
                const form = new FormData();
                const imageStream = await axios.get(imageAttachment.url, { responseType: 'stream' });
                form.append('image', imageStream.data, { filename: 'image.jpg', contentType: imageAttachment.contentType || 'image/jpeg' });

                const uploadResponse = await axios.post("https://nayan-gemini-api.onrender.com/upload", form, {
                    headers: form.getHeaders(),
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity,
                });

                if (uploadResponse.data.success && uploadResponse.data.imageUrl) {
                    imageUrl = uploadResponse.data.imageUrl;
                    console.log("Image uploaded via /gemini command:", imageUrl);
                } else {
                    console.error("Image upload failed via /gemini command:", uploadResponse.data);
                    return api.sendMessage("ছবি আপলোড করতে সমস্যা হয়েছে।", threadID, event.messageID);
                }
            } catch (error) {
                console.error("Error uploading image via /gemini command:", error);
                return api.sendMessage("ছবি আপলোড করার সময় একটি ত্রুটি হয়েছে।", threadID, event.messageID);
            }
        }
    }

    // If no text prompt and an image is present, set a default prompt for the image
    if (!userPrompt && imageUrl) {
        userPrompt = "ছবিতে কী আছে?";
    } else if (!userPrompt && !imageUrl) {
         // Should ideally be caught by the initial !input check, but good for robustness
         return api.sendMessage(
            "🧠 Gemini ব্যবহারের জন্য কিছু লিখুন অথবা একটি ছবি দিন।",
            threadID,
            event.messageID
        );
    }

    api.sendMessage("🤖 Gemini তোমার প্রশ্নের উত্তর খুঁজছে...", threadID);
    const reply = await askGemini(userPrompt, threadID, imageUrl);
    return api.sendMessage(`🤖 Gemini:\n\n${reply}`, threadID, event.messageID);
};

// 💬 অটো রেসপন্ডার (Handles messages without command prefix)
module.exports.handleEvent = async function ({ api, event }) {
    const threadID = event.threadID;

    // Only proceed if auto-reply is enabled for this thread, not from bot itself, and has content
    if (!autoReplyState[threadID]) return;
    if (event.senderID == api.getCurrentUserID()) return;
    // Ensure there's either text body or attachments
    if (!event.body && (!event.attachments || event.attachments.length === 0)) return;
    // Ignore if message starts with a command prefix
    if (event.body && (event.body.startsWith("/") || event.body.startsWith("!"))) return;

    let userPrompt = event.body || "ছবিতে কী আছে?"; // Default prompt if only an image is sent
    let imageUrl = null;

    // Check for attached images in auto-reply mode
    if (event.attachments && event.attachments.length > 0) {
        const imageAttachment = event.attachments.find(att => att.type === "photo");
        if (imageAttachment) {
            api.sendMessage("🖼️ ছবি আপলোড করা হচ্ছে...", threadID);
            try {
                const form = new FormData();
                const imageStream = await axios.get(imageAttachment.url, { responseType: 'stream' });
                form.append('image', imageStream.data, { filename: 'image.jpg', contentType: imageAttachment.contentType || 'image/jpeg' });

                const uploadResponse = await axios.post("https://nayan-gemini-api.onrender.com/upload", form, {
                    headers: form.getHeaders(),
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity,
                });

                if (uploadResponse.data.success && uploadResponse.data.imageUrl) {
                    imageUrl = uploadResponse.data.imageUrl;
                    console.log("Image uploaded via auto-responder:", imageUrl);
                } else {
                    console.error("Image upload failed via auto-responder:", uploadResponse.data);
                    return api.sendMessage("ছবি আপলোড করতে সমস্যা হয়েছে।", threadID, event.messageID);
                }
            } catch (error) {
                console.error("Error uploading image via auto-responder:", error);
                return api.sendMessage("ছবি আপলোড করার সময় একটি ত্রুটি হয়েছে।", threadID, event.messageID);
            }
        }
    }

    // Only send to Gemini if there's a prompt (text or derived from image) or an image URL
    if (userPrompt || imageUrl) {
        api.sendMessage("🤖 Gemini তোমার প্রশ্নের উত্তর খুঁজছে...", threadID);
        const reply = await askGemini(userPrompt, threadID, imageUrl);
        api.sendMessage(`🤖 Gemini:\n\n${reply}`, threadID, event.messageID);
    }
};
