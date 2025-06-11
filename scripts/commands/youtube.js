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

  // Set default quality if missing
  if (!qualityInput) {
    qualityInput = format === "audio" ? "128kbps" : "480p";
  } else {
    if (format === "video" && !qualityInput.endsWith("p")) {
      qualityInput += "p";
    }
    if (format === "audio" && !qualityInput.endsWith("kbps")) {
      qualityInput += "kbps";
    }
  }

  const videoId = handleReply.link[number - 1];

  api.unsendMessage(handleReply.messageID);
  api.sendMessage("আপনার অনুরোধ প্রক্রিয়া করা হচ্ছে, দয়া করুন...", event.threadID);

  try {
    const apiUrl = `https://youtubemediapro-production.up.railway.app/api/get/download?url=https://youtu.be/${videoId}&format=${format}&quality=${qualityInput}`;
    const res = await axios.get(apiUrl);
    if (!res.data.success) throw new Error("Download link fetch failed.");

    const fileUrl = `https://youtubemediapro-production.up.railway.app${res.data.download_url}`;
    const filename = decodeURIComponent(res.data.file_path.split("/").pop());

    const fileData = (await axios.get(fileUrl, { responseType: "arraybuffer" })).data;
    const filePath = __dirname + `/cache/${filename}`;

    writeFileSync(filePath, Buffer.from(fileData, "utf-8"));

    if (statSync(filePath).size > 26e6) {
      return api.sendMessage("ফাইলটি 25MB এর বেশি হওয়ায় পাঠানো যাচ্ছে না।", event.threadID, () => unlinkSync(filePath), event.messageID);
    } else {
      return api.sendMessage({
        body: `${res.data.title}\nডাউনলোড সম্পন্ন হয়েছে (${format.toUpperCase()} - ${qualityInput})`,
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

    msg += "উত্তর দিন: নম্বর টাইপ ফরম্যাট কোয়ালিটি (যেমন: 1 vid 720p অথবা 2 aud 192kbps)\n\nভিডিওর জন্য: 3gp/360p/480p/720p/1080p\nঅডিওর জন্য: 128kbps/192kbps/256kbps/320kbps";

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
