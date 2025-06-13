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

module.exports.handleReply = async function ({ api, event, handleReply }) {
  const axios = global.nodemodule.axios;
  const fs = global.nodemodule["fs-extra"];
  const { writeFileSync, createReadStream, unlinkSync, statSync } = fs;

  const args = event.body.toLowerCase().split(" ");
  const number = parseInt(args[0]);
  const typeInput = args[1] || "vid";
  let qualityInput = args[2];

  if (isNaN(number) || number < 1 || number > 6) {
    return api.sendMessage("দয়া করে 1 থেকে 6 এর মধ্যে একটি সংখ্যা দিন (যেমন: 1 vid 720p)", event.threadID, event.messageID);
  }

  const typeMap = {
    vid: "video",
    aud: "audio"
  };

  const format = typeMap[typeInput] || "video";

  if (!qualityInput && format === "video") {
    qualityInput = "480p";
  }

  const videoId = handleReply.link[number - 1];

  api.unsendMessage(handleReply.messageID);
  api.sendMessage("আপনার অনুরোধ প্রক্রিয়া করা হচ্ছে, দয়া করুন...", event.threadID);

  try {
    const apiUrl = `https://ytdl-api-liart.vercel.app/?url=https://youtu.be/${videoId}`;
    const res = await axios.get(apiUrl);

    if (!res.data.ok || !res.data.result || !res.data.result.medias) {
      throw new Error("Download info not found.");
    }

    const mediaList = res.data.result.medias;

    let media;
    if (format === "audio") {
      media = mediaList.find(m => m.type === "audio");
    } else {
      const qualityNormalized = qualityInput.replace(/\D/g, "");
      media = mediaList.find(m =>
        m.type === "video" &&
        (
          (m.quality && m.quality.replace(/\D/g, "").includes(qualityNormalized)) ||
          (m.label && m.label.replace(/\D/g, "").includes(qualityNormalized))
        )
      );
    }

    if (!media || !media.url) {
      return api.sendMessage("এই ফরম্যাট বা কোয়ালিটিতে মিডিয়া পাওয়া যায়নি।", event.threadID, event.messageID);
    }

    const fileUrl = media.url;
    const filename = `${res.data.result.title}.${media.ext || (format === "audio" ? "mp3" : "mp4")}`;

    const fileData = (await axios.get(fileUrl, { responseType: "arraybuffer" })).data;
    const filePath = __dirname + `/cache/${filename}`;

    writeFileSync(filePath, Buffer.from(fileData, "utf-8"));

    if (statSync(filePath).size > 26e6) {
      return api.sendMessage("ফাইলটি 25MB এর বেশি হওয়ায় পাঠানো যাচ্ছে না।", event.threadID, () => unlinkSync(filePath), event.messageID);
    } else {
      return api.sendMessage({
        body: `${res.data.result.title}\nডাউনলোড সম্পন্ন হয়েছে (${format.toUpperCase()}${format === "video" ? ` - ${qualityInput}` : ""})`,
        attachment: createReadStream(filePath)
      }, event.threadID, () => unlinkSync(filePath), event.messageID);
    }

  } catch (err) {
    console.error("Download error:", err);
    return api.sendMessage("ডাউনলোড করতে সমস্যা হয়েছে।", event.threadID, event.messageID);
  }
};

module.exports.run = async function ({ api, event, args }) {
  const axios = global.nodemodule.axios;
  const fs = global.nodemodule["fs-extra"];
  const Youtube = global.nodemodule["simple-youtube-api"];

  const youtubeKeys = ["AIzaSyB5A3Lum6u5p2Ki2btkGdzvEqtZ8KNLeXo"];
  const youtube = new Youtube(youtubeKeys[Math.floor(Math.random() * youtubeKeys.length)]);

  if (!args[0]) return api.sendMessage("অনুসন্ধান খালি রাখা যাবে না!", event.threadID, event.messageID);

  const query = args.join(" ");
  if (query.startsWith("http://") || query.startsWith("https://")) {
    return api.sendMessage("অনুগ্রহ করে শুধু কিওয়ার্ড দিয়ে অনুসন্ধান করুন। লিংক সমর্থিত নয়।", event.threadID, event.messageID);
  }

  try {
    const results = await youtube.searchVideos(query, 6);
    let msg = "🔎 ভিডিও পাওয়া গেছে:\n\n";
    const attachments = [];
    const links = [];

    for (let i = 0; i < results.length; i++) {
      const vid = results[i];
      links.push(vid.id);
      const thumbUrl = `https://i.ytimg.com/vi/${vid.id}/hqdefault.jpg`;
      const imgPath = __dirname + `/cache/${i + 1}.png`;

      const imgData = (await axios.get(thumbUrl, { responseType: "arraybuffer" })).data;
      fs.writeFileSync(imgPath, Buffer.from(imgData, "utf-8"));
      attachments.push(fs.createReadStream(imgPath));

      const durationRaw = (await axios.get(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${vid.id}&key=${youtubeKeys[0]}`)).data.items[0].contentDetails.duration;
      const duration = durationRaw.replace("PT", "").replace("H", ":").replace("M", ":").replace("S", "").replace(/:$/, "");

      msg += `${i + 1}. (${duration}) ${vid.title}\n\n`;
    }

    msg += "উত্তর দিন: নম্বর টাইপ কোয়ালিটি (যেমন: 1 vid 720p অথবা 2 aud)\n\nভিডিও কোয়ালিটি: 144p, 240p, 360p, 480p, 720p, 1080p\nঅডিও ডিফল্ট: 128kbps";

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
    console.error("Search error:", err);
    return api.sendMessage("অনুসন্ধান করতে সমস্যা হয়েছে।", event.threadID, event.messageID);
  }
};
