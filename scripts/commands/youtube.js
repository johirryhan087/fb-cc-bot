const axios = require('axios');
const fs = require("fs-extra");

module.exports.config = {
  name: "youtube",
  version: "2.0.0",
  permission: 0,
  credits: "Mahir (Modified by OpenAI)",
  description: "Search & download YouTube videos/audios",
  prefix: true,
  category: "Media",
  usages: "[search query | YouTube link]",
  cooldowns: 5,
  dependencies: {}
};


module.exports.run = async ({ api, event, args }) => {
  const query = args.join(" ");
  if (!query) return api.sendMessage("🔎 দয়া করে ইউটিউব সার্চ টার্ম দিন।", event.threadID, event.messageID);

  const searchUrl = `https://youtubemediapro-production.up.railway.app/api/search?query=${encodeURIComponent(query)}`;

  try {
    const res = await axios.get(searchUrl);
    const results = res.data.results;

    if (!results || results.length === 0) {
      return api.sendMessage("😞 কিছুই পাওয়া যায়নি!", event.threadID, event.messageID);
    }

    const replyMessage = results.slice(0, 6).map((video, i) => (
      `${i + 1}. ${video.title} [${video.duration}]`
    )).join("\n");

    return api.sendMessage(
      `🔍 সার্চ রেজাল্ট:\n\n${replyMessage}\n\n➡️ রিপ্লাই করে লিখুন:\n[number] [vid/aud] [quality]\n\n📌 উদাহরণ: 1 vid 480\n📌 ডিফল্ট: video 480p`,
      event.threadID,
      (err, info) => {
        global.client.handleReply.push({
          name: module.exports.config.name,
          messageID: info.messageID,
          author: event.senderID,
          link: results.map(v => v.id)
        });
      },
      event.messageID
    );

  } catch (err) {
    console.error(err);
    return api.sendMessage("❌ সার্ভার থেকে ডেটা আনতে সমস্যা হয়েছে।", event.threadID, event.messageID);
  }
};

module.exports.handleReply = async ({ api, event, handleReply }) => {
  const input = event.body.toLowerCase().trim().split(/\s+/);
  const index = parseInt(input[0]);

  if (isNaN(index) || index < 1 || index > handleReply.link.length) {
    return api.sendMessage("❗ সঠিক নম্বর দিন যেমন: 1 vid 480 বা 2 aud 128", event.threadID, event.messageID);
  }

  let format = input[1] || "vid";
  let quality = input[2];

  if (format !== "vid" && format !== "aud") {
    // উদাহরণ: 1 480 → format নাই, তাহলে ধরে নেওয়া হবে vid
    if (!quality && /^\d+$/.test(input[1])) {
      quality = input[1];
      format = "vid";
    } else {
      return api.sendMessage("❗ ফরম্যাট হবে vid বা aud", event.threadID, event.messageID);
    }
  }

  // ডিফল্ট কোয়ালিটি
  if (!quality) quality = (format === "aud") ? "128" : "480";

  const videoId = handleReply.link[index - 1];

  const apiBase = "https://youtubemediapro-production.up.railway.app/api/get/download";
  const url = `${apiBase}?url=https://youtu.be/${videoId}&format=${format === "vid" ? "video" : "audio"}&quality=${quality}${format === "vid" ? "p" : "kbps"}`;

  api.unsendMessage(handleReply.messageID);
  api.sendMessage("⏳ ডাউনলোড হচ্ছে, দয়া করে অপেক্ষা করুন...", event.threadID);

  try {
    const res = await axios.get(url);
    if (!res.data.success) throw new Error("API ব্যর্থ হয়েছে বা ভিডিও পাওয়া যায়নি।");

    const downloadUrl = `https://youtubemediapro-production.up.railway.app${res.data.download_url}`;
    const fileRes = await axios.get(downloadUrl, { responseType: "arraybuffer" });

    const fileName = decodeURIComponent(res.data.file_path.split("/").pop());
    const filePath = __dirname + `/cache/${fileName}`;
    fs.writeFileSync(filePath, Buffer.from(fileRes.data, "binary"));

    if (fs.statSync(filePath).size > 25 * 1024 * 1024) {
      fs.unlinkSync(filePath);
      return api.sendMessage("⚠️ ফাইলটি 25MB এর বেশি, পাঠানো যাচ্ছে না।", event.threadID, event.messageID);
    }

    return api.sendMessage({
      body: `✅ ডাউনলোড সম্পন্ন: ${res.data.title}`,
      attachment: fs.createReadStream(filePath)
    }, event.threadID, () => fs.unlinkSync(filePath), event.messageID);

  } catch (err) {
    console.error("Download Error:", err.message);
    return api.sendMessage("❌ ডাউনলোড করতে সমস্যা হয়েছে:\n" + err.message, event.threadID, event.messageID);
  }
};
