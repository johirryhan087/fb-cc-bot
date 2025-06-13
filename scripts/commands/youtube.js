const axios = global.nodemodule.axios;
const fs = global.nodemodule["fs-extra"];
const { writeFileSync, createReadStream, unlinkSync, statSync } = fs;

module.exports.config = {
  name: "youtube",
  version: "2.0.0",
  permission: 0,
  credits: "Mahir (Fixed by OpenAI)",
  description: "Search & download YouTube videos/audios",
  prefix: true,
  category: "Media",
  usages: "[search query]",
  cooldowns: 5
};

module.exports.handleReply = async function ({ api, event, handleReply }) {
  try {
    const args = event.body.toLowerCase().split(" ");
    const number = parseInt(args[0]);
    const type = args[1] === "audio" || args[1] === "aud" ? "audio" : "video";
    const quality = args[2] || "480p";

    if (isNaN(number) || number < 1 || number > 6) {
      return api.sendMessage("১ থেকে ৬ এর মধ্যে একটি নম্বর দিন (যেমন: 1 video 720p)", event.threadID, event.messageID);
    }

    const videoId = handleReply.link[number - 1];
    const apiUrl = `https://ytdl-api-liart.vercel.app/?url=https://youtu.be/${videoId}`;

    api.unsendMessage(handleReply.messageID);
    api.sendMessage("⏳ অনুরোধ প্রক্রিয়া হচ্ছে...", event.threadID);

    const res = await axios.get(apiUrl);
    if (!res.data.ok || !res.data.result || !res.data.result.medias) {
      throw new Error("API response invalid");
    }

    const mediaList = res.data.result.medias;

    let media;
    if (type === "audio") {
      media = mediaList.find(m => m.type === "audio");
    } else {
      const q = quality.replace(/\D/g, "");
      media = mediaList.find(m =>
        m.type === "video" &&
        (
          (m.quality && m.quality.replace(/\D/g, "") === q) ||
          (m.label && m.label.replace(/\D/g, "") === q)
        )
      );
    }

    if (!media || !media.url) {
      return api.sendMessage("এই ফরম্যাট বা কোয়ালিটিতে মিডিয়া পাওয়া যায়নি।", event.threadID, event.messageID);
    }

    const fileUrl = media.url;
    const fileName = `${res.data.result.title}.${media.ext || (type === "audio" ? "m4a" : "mp4")}`;
    const filePath = `${__dirname}/cache/${fileName}`;

    const file = (await axios.get(fileUrl, { responseType: "arraybuffer" })).data;
    writeFileSync(filePath, Buffer.from(file, "utf-8"));

    if (statSync(filePath).size > 26e6) {
      unlinkSync(filePath);
      return api.sendMessage("⚠️ ফাইলটি 25MB এর বেশি, পাঠানো যাবে না।", event.threadID, event.messageID);
    }

    return api.sendMessage({
      body: `✅ ডাউনলোড সম্পন্ন (${type.toUpperCase()} - ${media.quality || media.label})`,
      attachment: createReadStream(filePath)
    }, event.threadID, () => unlinkSync(filePath), event.messageID);

  } catch (err) {
    console.error(err);
    return api.sendMessage("❌ ডাউনলোড করতে সমস্যা হয়েছে।", event.threadID, event.messageID);
  }
};

module.exports.run = async function ({ api, event, args }) {
  const Youtube = global.nodemodule["simple-youtube-api"];
  const youtube = new Youtube("AIzaSyB5A3Lum6u5p2Ki2btkGdzvEqtZ8KNLeXo");

  if (!args[0]) return api.sendMessage("🔍 অনুসন্ধান খালি রাখা যাবে না!", event.threadID, event.messageID);

  const query = args.join(" ");
  if (query.startsWith("http://") || query.startsWith("https://")) {
    return api.sendMessage("🔗 অনুগ্রহ করে কিওয়ার্ড দিন, লিংক নয়।", event.threadID, event.messageID);
  }

  try {
    const results = await youtube.searchVideos(query, 6);
    const links = [];
    let msg = "🔎 ভিডিও পাওয়া গেছে:\n\n";

    const attachments = await Promise.all(results.map(async (vid, index) => {
      links.push(vid.id);
      const thumbUrl = `https://i.ytimg.com/vi/${vid.id}/hqdefault.jpg`;
      const imgPath = `${__dirname}/cache/${index + 1}.png`;
      const img = (await axios.get(thumbUrl, { responseType: "arraybuffer" })).data;
      fs.writeFileSync(imgPath, Buffer.from(img, "utf-8"));
      msg += `${index + 1}. ${vid.title}\n`;
      return fs.createReadStream(imgPath);
    }));

    msg += "\nউত্তর দিন: নম্বর টাইপ (যেমন: 1 video 720p অথবা 2 audio)\n\nভিডিও কোয়ালিটি: 144p, 240p, 360p, 480p, 720p, 1080p\nঅডিওতে কোয়ালিটি দিতে হবে না।";

    return api.sendMessage({ body: msg, attachment: attachments }, event.threadID, (err, info) => {
      if (!err) {
        global.client.handleReply.push({
          name: this.config.name,
          messageID: info.messageID,
          author: event.senderID,
          link: links
        });
      }
    }, event.messageID);

  } catch (err) {
    console.error(err);
    return api.sendMessage("❌ অনুসন্ধান করতে সমস্যা হয়েছে।", event.threadID, event.messageID);
  }
};
