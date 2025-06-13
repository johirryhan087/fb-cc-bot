module.exports.config = {
  name: "youtube",
  version: "2.0.0",
  permission: 0,
  credits: "Mahir (Modified by OpenAI)",
  description: "Search & download YouTube videos only",
  prefix: true,
  category: "Media",
  usages: "[search query]",
  cooldowns: 5,
  dependencies: {}
};

const axios = global.nodemodule.axios;
const fs = global.nodemodule["fs-extra"];
const { writeFileSync, createReadStream, unlinkSync, statSync } = fs;

module.exports.handleReply = async function ({ api, event, handleReply }) {
  const args = event.body.toLowerCase().split(" ");
  const number = parseInt(args[0]);
  const qualityInput = args[1] || "480p";

  if (isNaN(number) || number < 1 || number > 6) {
    return api.sendMessage("দয়া করে 1 থেকে 6 এর মধ্যে একটি সংখ্যা দিন (যেমন: 1 720p)", event.threadID, event.messageID);
  }

  const videoId = handleReply.link[number - 1];

  api.unsendMessage(handleReply.messageID);
  api.sendMessage("⏳ অনুরোধ প্রক্রিয়া হচ্ছে, দয়া করে অপেক্ষা করুন...", event.threadID);

  try {
    const apiUrl = `https://ytdl-api-liart.vercel.app/?url=https://youtu.be/${videoId}`;
    const res = await axios.get(apiUrl);

    if (!res.data.ok || !res.data.result || !res.data.result.medias) {
      throw new Error("Download info not found.");
    }

    const mediaList = res.data.result.medias;

    const media = mediaList.find(m =>
      m.type === "video" &&
      (m.quality?.toLowerCase().includes(qualityInput.toLowerCase()) ||
        m.label?.toLowerCase().includes(qualityInput.toLowerCase()))
    );

    if (!media || !media.url) {
      return api.sendMessage("এই কোয়ালিটিতে ভিডিও পাওয়া যায়নি।", event.threadID, event.messageID);
    }

    const fileUrl = media.url;
    const filename = `${res.data.result.title}.${media.ext || "mp4"}`;
    const filePath = `${__dirname}/cache/${filename}`;
    const fileData = (await axios.get(fileUrl, { responseType: "arraybuffer" })).data;

    writeFileSync(filePath, Buffer.from(fileData, "utf-8"));

    if (statSync(filePath).size > 26e6) {
      unlinkSync(filePath);
      return api.sendMessage("⚠️ ফাইলটি 25MB এর বেশি হওয়ায় পাঠানো যাচ্ছে না।", event.threadID, event.messageID);
    }

    return api.sendMessage({
      body: `✅ ডাউনলোড সম্পন্ন হয়েছে (${media.quality || qualityInput})`,
      attachment: createReadStream(filePath)
    }, event.threadID, () => unlinkSync(filePath), event.messageID);

  } catch (err) {
    console.error("Download error:", err);
    return api.sendMessage("❌ ডাউনলোড করতে সমস্যা হয়েছে।", event.threadID, event.messageID);
  }
};

module.exports.handleReply = async function ({ api, event, handleReply }) {
  const args = event.body.toLowerCase().split(" ");
  const number = parseInt(args[0]);
  const qualityInput = args[1] || "480p"; // <- Default 480p if not given

  if (isNaN(number) || number < 1 || number > 6) {
    return api.sendMessage("দয়া করে 1 থেকে 6 এর মধ্যে একটি সংখ্যা দিন (যেমন: 1 বা 1 720p)", event.threadID, event.messageID);
  }

  const videoId = handleReply.link[number - 1];

  api.unsendMessage(handleReply.messageID);
  api.sendMessage("⏳ অনুরোধ প্রক্রিয়া হচ্ছে, দয়া করে অপেক্ষা করুন...", event.threadID);

  try {
    const apiUrl = `https://ytdl-api-liart.vercel.app/?url=https://youtu.be/${videoId}`;
    const res = await axios.get(apiUrl);

    if (!res.data.ok || !res.data.result || !res.data.result.medias) {
      throw new Error("Download info not found.");
    }

    const mediaList = res.data.result.medias;

    const media = mediaList.find(m =>
      m.type === "video" &&
      (m.quality?.toLowerCase().includes(qualityInput.toLowerCase()) ||
        m.label?.toLowerCase().includes(qualityInput.toLowerCase()))
    );

    if (!media || !media.url) {
      return api.sendMessage("এই কোয়ালিটিতে ভিডিও পাওয়া যায়নি।", event.threadID, event.messageID);
    }

    const fileUrl = media.url;
    const filename = `${res.data.result.title}.${media.ext || "mp4"}`;
    const filePath = `${__dirname}/cache/${filename}`;
    const fileData = (await axios.get(fileUrl, { responseType: "arraybuffer" })).data;

    writeFileSync(filePath, Buffer.from(fileData, "utf-8"));

    if (statSync(filePath).size > 26e6) {
      unlinkSync(filePath);
      return api.sendMessage("⚠️ ফাইলটি 25MB এর বেশি হওয়ায় পাঠানো যাচ্ছে না।", event.threadID, event.messageID);
    }

    return api.sendMessage({
      body: `✅ ডাউনলোড সম্পন্ন হয়েছে (${media.quality || qualityInput})`,
      attachment: createReadStream(filePath)
    }, event.threadID, () => unlinkSync(filePath), event.messageID);

  } catch (err) {
    console.error("Download error:", err);
    return api.sendMessage("❌ ডাউনলোড করতে সমস্যা হয়েছে।", event.threadID, event.messageID);
  }
};
