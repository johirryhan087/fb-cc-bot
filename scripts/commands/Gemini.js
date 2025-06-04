// 📦 Bot config
module.exports.config = {
    name: "gemini",
    version: "1.0.0",
    permission: 0,
    credits: "Gemini By You",
    description: "Google Gemini AI Integration with Image Analysis",
    prefix: true,
    category: "ai",
    usages: "/gemini [prompt]\n/gemini [image attachment]\n/gemini on - auto mode\n/gemini off - disable auto mode",
    cooldowns: 3,
};

const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs-extra");
const path = require("path");
const cron = require("node-cron");

// 🛡️ Replace with your actual API KEY:
const GEMINI_API_KEY = "AIzaSyB5TpGTpHOY1UFsggmpr25vgRdhMRTKfUA";

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

let autoReplyEnabled = false;

// 🔥 Conversation history settings
const HISTORY_DIR = path.join(__dirname, 'gemini_histories');
const MAX_HISTORY_TURNS = 10;

let loadedHistories = {};

// 🔄 Load history for thread
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

// 💾 Save history for thread
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

// 🗑️ Reset all histories
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

// ⏰ Schedule history reset every 12 hours
cron.schedule('0 */12 * * *', async () => {
    console.log('⏰ Running scheduled Gemini history reset for all threads...');
    await resetAllHistories();
}, {
    timezone: "Asia/Dhaka"
});

// Ensure directory exists on bot load
(async () => {
    await fs.ensureDir(HISTORY_DIR);
    console.log(`ℹ️ Gemini history directory '${HISTORY_DIR}' ensured.`);
})();

// Function to convert Facebook attachment to Google Generative AI format
function fileToGenerativePart(buffer, mimeType) {
    return {
        inlineData: {
            data: buffer.toString("base64"),
            mimeType
        },
    };
}

async function askGemini(userPrompt, threadID, imageAttachments = []) {
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

        let result;
        if (imageAttachments.length > 0) {
            // Prepare image parts
            const imageParts = await Promise.all(imageAttachments.map(async attachment => {
                const buffer = await fs.readFile(attachment.path);
                return fileToGenerativePart(buffer, attachment.mime);
            }));

            // Combine text and images
            const combinedContent = [
                { text: finalPromptForGemini },
                ...imageParts
            ];

            result = await chat.sendMessage(combinedContent);
        } else {
            result = await chat.sendMessage(finalPromptForGemini);
        }

        const response = await result.response;
        const replyText = response.text();

        // Update conversation history
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
        return "❌ Gemini API তে সমস্যা হয়েছে। আমি দুঃখিত, বন্ধু। পরে আবার চেষ্টা করো।";
    }
}

// ✅ /gemini command
module.exports.run = async function ({ api, event, args }) {
    const input = args.join(" ");
    const threadID = event.threadID;

    if (!input && !event.attachments) {
        return api.sendMessage(
            "🧠 Gemini ব্যবহারের জন্য কিছু লিখুন বা ছবি আপলোড করুন। যেমন:\n/gemini Explain Quantum Physics\nবা\n/gemini [ছবি আপলোড] 'এই ছবিতে কি আছে?'",
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

    api.sendMessage("🤖 Gemini তোমার প্রশ্ন/ছবি বিশ্লেষণ করছে...", threadID);

    // Process image attachments if any
    let imageAttachments = [];
    if (event.attachments) {
        for (const attachment of event.attachments) {
            if (attachment.type === "photo" || attachment.type === "image") {
                const imagePath = path.join(__dirname, `temp_${Date.now()}.jpg`);
                await fs.writeFile(imagePath, Buffer.from(await require("axios").get(attachment.url, { responseType: 'arraybuffer' })).data));
                imageAttachments.push({
                    path: imagePath,
                    mime: "image/jpeg"
                });
            }
        }
    }

    const reply = await askGemini(input, threadID, imageAttachments);
    
    // Clean up temporary image files
    for (const attachment of imageAttachments) {
        try {
            await fs.unlink(attachment.path);
        } catch (cleanupError) {
            console.error("Error cleaning up temp file:", cleanupError);
        }
    }

    return api.sendMessage(`🤖 Gemini:\n\n${reply}`, threadID, event.messageID);
};

// 💬 Auto responder
module.exports.handleEvent = async function ({ api, event }) {
    if (!autoReplyEnabled) return;
    if (event.senderID == api.getCurrentUserID()) return;
    if (!event.body || event.body.length < 2) return;

    if (event.body.startsWith(module.exports.config.prefix ? "/" : "!") || event.body.startsWith("/gemini")) return;

    const threadID = event.threadID;
    
    // Process image attachments if any
    let imageAttachments = [];
    if (event.attachments) {
        for (const attachment of event.attachments) {
            if (attachment.type === "photo" || attachment.type === "image") {
                const imagePath = path.join(__dirname, `temp_${Date.now()}.jpg`);
                await fs.writeFile(imagePath, Buffer.from(await require("axios").get(attachment.url, { responseType: 'arraybuffer' })).data));
                imageAttachments.push({
                    path: imagePath,
                    mime: "image/jpeg"
                });
            }
        }
    }

    const reply = await askGemini(event.body, threadID, imageAttachments);
    
    // Clean up temporary image files
    for (const attachment of imageAttachments) {
        try {
            await fs.unlink(attachment.path);
        } catch (cleanupError) {
            console.error("Error cleaning up temp file:", cleanupError);
        }
    }

    api.sendMessage(`🤖 Gemini:\n\n${reply}`, threadID, event.messageID);
};
