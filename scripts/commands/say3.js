module.exports.config = {
    name: "say3",
    version: "1.0.0",
    permission: 0,
    credits: "ryuko",
    description: "text to voice speech messages",
    prefix: true,
    category: "with prefix",
    usages: `text to speech messages`,
    cooldowns: 5,
    dependencies: {
        "path": "",
        "fs-extra": ""
    }
};

module.exports.run = async function({
    api,
    event,
    args
}) {
    try {
        const {
            createReadStream,
            unlinkSync
        } = global.nodemodule["fs-extra"];
        const {
            resolve
        } = global.nodemodule["path"];

        // Get the text to convert to speech
        let content = (event.type == "message_reply") ? event.messageReply.body : args.join(" ");

        // If no content is provided, respond accordingly
        if (!content) {
            return api.sendMessage("Please provide some text to convert to speech.", event.threadID, event.messageID);
        }

        // Determine the language. Prioritize explicit language prefix if present.
        let languageToSay = "en"; // Default to English if no explicit language or global config is not set
        if (["ru", "en", "ko", "ja", "tl"].some(item => content.startsWith(item + " "))) { // Using startsWith for clarity
            languageToSay = content.slice(0, content.indexOf(" "));
            content = content.slice(content.indexOf(" ") + 1, content.length); // Remove language prefix from content
        } else if (global.config && global.config.language) {
            languageToSay = global.config.language;
        }

        const path = resolve(__dirname, 'cache', `${event.threadID}_${event.senderID}.mp3`);
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(content)}&tl=${languageToSay}&client=tw-ob`;

        await global.utils.downloadFile(ttsUrl, path);

        return api.sendMessage({
            attachment: createReadStream(path)
        }, event.threadID, () => unlinkSync(path), event.messageID);

    } catch (e) {
        console.error("Error in say2 command:", e); // Use console.error for errors
        return api.sendMessage("An error occurred while converting text to speech. Please try again later.", event.threadID, event.messageID);
    }
}
