module.exports.config = {
  name: "youtube",
  version: "1.1.0",
  permission: 0,
  credits: "Nayan & Modified by ChatGPT",
  description: "Search and download YouTube videos or audios",
  prefix: true,
  category: "Media",
  usages: "search query",
  cooldowns: 5,
  dependencies: {}
};

module.exports.handleReply = async function ({ api, event, handleReply }) {
  const axios = global.nodemodule.axios;
  const fs = global.nodemodule["fs-extra"];

  const i = await axios.get("https://raw.githubusercontent.com/MOHAMMAD-NAYAN-07/Nayan/main/video.json");
  const o = i.data.keyVideo[Math.floor(Math.random() * i.data.keyVideo.length)];

  const [indexRaw, formatRaw] = event.body.split(" ");
  const index = parseInt(indexRaw);

  if (isNaN(index) || index < 1 || index > handleReply.link.length || !["mp3", "mp4"].includes(formatRaw)) {
    return api.sendMessage("⚠️ লিখুন: নম্বর + ফরম্যাট (যেমন: 1 mp3 বা 2 mp4)", event.threadID, event.messageID);
  }

  const videoId = handleReply.link[index - 1];
  const downloadRequest = {
    method: "GET",
    url: "https://ytstream-download-youtube-videos.p.rapidapi.com/dl",
    params: { id: videoId },
    headers: {
      "x-rapidapi-host": "ytstream-download-youtube-videos.p.rapidapi.com",
      "x-rapidapi-key": o.API_KEY
    }
  };

  try {
    const res = await axios.request(downloadRequest);
    if (res.data.status === "fail") return api.sendMessage("❌ ডাউনলোড লিংক পাওয়া যায়নি।", event.threadID);

    const title = res.data.title;
    const links = res.data.link;

    let downloadUrl;
    if (formatRaw === "mp3") {
      const audioKey = Object.keys(links).find(k => k.toLowerCase().includes("audio"));
      if (!audioKey) return api.sendMessage("🔇 অডিও লিংক পাওয়া যায়নি।", event.threadID);
      downloadUrl = links[audioKey][0];
    } else {
      const videoKey = Object.keys(links).find(k => k.includes("360") || k.includes("480") || k.includes("720"));
      if (!videoKey) return api.sendMessage("📹 ভিডিও লিংক পাওয়া যায়নি।", event.threadID);
      downloadUrl = links[videoKey][0];
    }

    const fileExt = formatRaw === "mp3" ? ".mp3" : ".mp4";
    const filePath = __dirname + `/cache/youtube_file${fileExt}`;
    const fileBuffer = (await axios.get(downloadUrl, { responseType: "arraybuffer" })).data;
    fs.writeFileSync(filePath, Buffer.from(fileBuffer, "utf-8"));

    if (fs.statSync(filePath).size > 26 * 1024 * 1024) {
      fs.unlinkSync(filePath);
      return api.sendMessage("❌ ফাইলটি 25MB এর বেশি হওয়ায় পাঠানো সম্ভব নয়।", event.threadID);
    }

    return api.sendMessage({
      body: `✅ ডাউনলোড সম্পন্ন: ${title}`,
      attachment: fs.createReadStream(filePath)
    }, event.threadID, () => fs.unlinkSync(filePath), event.messageID);

  } catch (err) {
    console.error(err);
    return api.sendMessage("⚠️ ডাউনলোড中 সমস্যা হয়েছে!", event.threadID);
  }
};

module.exports.run = async function ({ api, event, args }) {
  const axios = global.nodemodule.axios;
  const fs = global.nodemodule["fs-extra"];
  const YouTube = global.nodemodule["simple-youtube-api"];

  const apiKeys = [
    "AIzaSyB5A3Lum6u5p2Ki2btkGdzvEqtZ8KNLeXo",
    "AIzaSyAyjwkjc0w61LpOErHY_vFo6Di5LEyfLK0",
    "AIzaSyBY5jfFyaTNtiTSBNCvmyJKpMIGlpCSB4w",
    "AIzaSyCYCg9qpFmJJsEcr61ZLV5KsmgT1RE5aI4"
  ];
  const yt = new YouTube(apiKeys[Math.floor(Math.random() * apiKeys.length)]);

  if (!args[0]) return api.sendMessage("🔍 দয়া করে সার্চ শব্দ লিখুন!", event.threadID, event.messageID);

  const query = args.join(" ");
  try {
    const results = await yt.searchVideos(query, 6);
    let msg = "🎶 নিচের ভিডিওগুলো পাওয়া গেছে:\n\n";
    let links = [];
    let attachments = [];

    for (let i = 0; i < results.length; i++) {
      const video = results[i];
      const id = video.id;
      links.push(id);

      const thumbnailUrl = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
      const thumbData = (await axios.get(thumbnailUrl, { responseType: "arraybuffer" })).data;
      const thumbPath = __dirname + `/cache/thumb${i}.jpg`;
      fs.writeFileSync(thumbPath, Buffer.from(thumbData, "utf-8"));
      attachments.push(fs.createReadStream(thumbPath));

      msg += `${i + 1}. ${video.title}\n`;
    }

    msg += "\n👉 রিপ্লাই করুন নম্বর এবং ফরম্যাট সহ (যেমন: 2 mp3 বা 3 mp4)";

    return api.sendMessage({
      body: msg,
      attachment: attachments
    }, event.threadID, (err, info) => {
      global.client.handleReply.push({
        name: module.exports.config.name,
        messageID: info.messageID,
        author: event.senderID,
        link: links
      });
    }, event.messageID);

  } catch (err) {
    console.error(err);
    return api.sendMessage("❌ ইউটিউব সার্চে সমস্যা হয়েছে!", event.threadID, event.messageID);
  }
};
