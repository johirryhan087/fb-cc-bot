module.exports.config = {
  name: "youtube",
  version: "1.0.1",
  permission: 0,
  credits: "Nayan & YourName",
  description: "Download YouTube videos or audios",
  prefix: true,
  category: "Media",
  usages: "[search query | YouTube link]",
  cooldowns: 5,
  dependencies: {}
};

module.exports.handleReply = async function ({ api: e, event: a, handleReply: t }) {
  const axios = global.nodemodule.axios;
  const fs = global.nodemodule["fs-extra"];
  const { unlinkSync, statSync } = global.nodemodule["fs-extra"];

  // ইউজারের ইনপুট: "1 720" অথবা "2 128" ইত্যাদি
  const input = a.body.trim().split(" ");
  if (input.length !== 2) {
    return e.sendMessage("সঠিক ফরম্যাট ব্যবহার করুন: নম্বর এবং কোয়ালিটি (যেমন: 1 720 অথবা 2 128)", a.threadID, a.messageID);
  }

  const chosenIndex = parseInt(input[0]);
  const quality = input[1];

  if (isNaN(chosenIndex) || chosenIndex < 1 || chosenIndex > t.link.length) {
    return e.sendMessage(`দয়া করে 1 থেকে ${t.link.length} এর মধ্যে একটি সংখ্যা দিন।`, a.threadID, a.messageID);
  }

  // কোয়ালিটি থেকে ফরম্যাট ঠিক করা
  // ভিডিও কোয়ালিটি সাধারণত 360,480,720,1080 ইত্যাদি
  // অডিও কোয়ালিটি 128,192,256,320
  let format = "";
  const videoQualities = ["360", "480", "720", "1080"];
  const audioQualities = ["128", "192", "256", "320"];

  if (videoQualities.includes(quality)) format = "mp4";
  else if (audioQualities.includes(quality)) format = "mp3";
  else {
    return e.sendMessage("অনুগ্রহ করে সঠিক কোয়ালিটি দিন। ভিডিও: 360/480/720/1080 অথবা অডিও: 128/192/256/320", a.threadID, a.messageID);
  }

  e.unsendMessage(t.messageID);
  e.sendMessage("ডাউনলোড শুরু হচ্ছে, অপেক্ষা করুন...", a.threadID);

  try {
    const videoId = t.link[chosenIndex - 1];

    // নতুন API URL এবং কী
    const apiUrl = `https://your-new-youtube-api.example.com/download`;
    const apiKey = "YOUR_NEW_API_KEY_HERE";

    // API কল - ভিডিও আইডি, ফরম্যাট ও কোয়ালিটি পাঠানো হচ্ছে
    const headers = { "x-api-key": apiKey };

    const response = (await axios.get(apiUrl, {
      headers,
      params: { id: videoId, format: format, quality: quality }
    })).data;

    if (!response || response.status === "fail" || !response.downloadUrl) {
      return e.sendMessage(`এই ${format === "mp4" ? "ভিডিও" : "অডিও"} ডাউনলোড করা যাচ্ছে না।`, a.threadID, a.messageID);
    }

    const downloadLink = response.downloadUrl;
    const filename = `youtube_download.${format}`;

    const fileData = (await axios.get(downloadLink, { responseType: "arraybuffer" })).data;
    fs.writeFileSync(__dirname + `/cache/${filename}`, Buffer.from(fileData, "utf-8"));

    const filePath = __dirname + `/cache/${filename}`;

    if (statSync(filePath).size > 26e6) {
      unlinkSync(filePath);
      return e.sendMessage("ফাইলটি 25MB এর বেশি হওয়ায় পাঠানো যাচ্ছে না।", a.threadID, a.messageID);
    }

    return e.sendMessage({
      body: `» ডাউনলোড সম্পন্ন হয়েছে। ফাইল: ${filename}`,
      attachment: fs.createReadStream(filePath)
    }, a.threadID, () => fs.unlinkSync(filePath), a.messageID);

  } catch (error) {
    console.error(error);
    return e.sendMessage("ডাউনলোড করতে সমস্যা হয়েছে।", a.threadID, a.messageID);
  } finally {
    // পুরনো ক্যাশ ফাইল ডিলিট করা
    for (let i = 1; i < 7; i++) {
      try {
        unlinkSync(__dirname + `/cache/${i}.png`);
      } catch {}
    }
  }
};

module.exports.run = async function ({ api: e, event: a, args: t }) {
  const axios = global.nodemodule.axios;
  const fs = global.nodemodule["fs-extra"];
  const simpleYoutubeApi = global.nodemodule["simple-youtube-api"];
  const { unlinkSync } = global.nodemodule["fs-extra"];

  // YouTube API key (আপনার API keys এর মধ্যে থেকে র‍্যান্ডম)
  const youtubeApiKeys = [
    "AIzaSyB5A3Lum6u5p2Ki2btkGdzvEqtZ8KNLeXo",
    "AIzaSyAyjwkjc0w61LpOErHY_vFo6Di5LEyfLK0",
    "AIzaSyBY5jfFyaTNtiTSBNCvmyJKpMIGlpCSB4w",
    "AIzaSyCYCg9qpFmJJsEcr61ZLV5KsmgT1RE5aI4"
  ];
  const selectedYoutubeApiKey = youtubeApiKeys[Math.floor(Math.random() * youtubeApiKeys.length)];
  const youtubeApi = new simpleYoutubeApi(selectedYoutubeApiKey);

  if (!t.length) {
    return e.sendMessage("অনুসন্ধান খালি রাখা যাবে না!", a.threadID, a.messageID);
  }

  const query = t.join(" ");

  if (query.startsWith("http://") || query.startsWith("https://")) {
    // ডিরেক্ট ইউটিউব লিংক হ্যান্ডেলিং
    const videoIdMatch = query.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/))([^&\n?#]+)/);
    if (!videoIdMatch) {
      return e.sendMessage("অকার্যকর ইউটিউব লিংক।", a.threadID, a.messageID);
    }
    const videoId = videoIdMatch[1];

    e.sendMessage("লিংক থেকে ভিডিও প্রক্রিয়া করা হচ্ছে, দয়া করে অপেক্ষা করুন...", a.threadID);

    try {
      // ডিরেক্ট লিংকের জন্য নতুন API ব্যবহার
      const apiUrl = `https://your-new-youtube-api.example.com/download`;
      const apiKey = "YOUR_NEW_API_KEY_HERE";

      const headers = {
        "x-api-key": apiKey
      };

      const videoInfo = (await axios.get(apiUrl, {
        headers,
        params: { id: videoId }
      })).data;

      if (!videoInfo || videoInfo.status === "fail") {
        return e.sendMessage("এই ফাইলটি পাঠানো যাচ্ছে না।", a.threadID, a.messageID);
      }

      const msg = `একটি ফরম্যাট নির্বাচন করুন:\n1. mp4 (ভিডিও)\n2. mp3 (অডিও)\n\nদয়া করে উত্তর দিন (নম্বর দিন) কোন ফরম্যাটে আপনি ডাউনলোড করতে চান, যেমন: 1 mp4`;

      return e.sendMessage({ body: msg }, a.threadID, (err, info) => {
        if (!err) {
          global.client.handleReply.push({
            name: this.config.name,
            messageID: info.messageID,
            author: a.senderID,
            link: [videoId]
          });
        }
      }, a.messageID);

    } catch (error) {
      console.error("Direct link download error:", error);
      return e.sendMessage("লিংক থেকে ফাইল প্রক্রিয়া করা যায়নি।", a.threadID, a.messageID);
    }
  } else {
    // সার্চ ফাংশনালিটি

    try {
      let attachments = [];
      let messageBody = "»🔎 আপনার অনুসন্ধান কীওয়ার্ডের সাথে মিলে যাওয়া ভিডিওগুলি:\n\n";
      let videoLinks = [];
      let counter = 0;

      const searchResults = await youtubeApi.searchVideos(query, 6);

      for (const video of searchResults) {
        counter++;
        videoLinks.push(video.id);
        messageBody += `${counter}. ${video.title}\n▶️ https://youtu.be/${video.id}\n\n`;
      }

      messageBody +=
        "নিচে ডাউনলোডের জন্য ফরম্যাট উল্লেখ করুন:\n" +
        "যেমন: '1 mp4' বা '2 mp3' - যেখানে নম্বরটি ভিডিও নম্বর এবং mp4/mp3 ফরম্যাট।";

      return e.sendMessage(messageBody, a.threadID, (err, info) => {
        if (!err) {
          global.client.handleReply.push({
            name: this.config.name,
            messageID: info.messageID,
            author: a.senderID,
            link: videoLinks
          });
        }
      }, a.messageID);
    } catch (error) {
      console.error("Search error:", error);
      return e.sendMessage("অনুসন্ধান করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।", a.threadID, a.messageID);
    }
  }
};
