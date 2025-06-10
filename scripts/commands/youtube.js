module.exports.config = {
  name: "youtube",
  version: "1.0.1", // Changed version to indicate modification
  permission: 0,
  credits: "Nayan & YourName", // Added a placeholder for your name
  description: "Download YouTube videos or audios",
  prefix: true,
  category: "Media",
  usages: "[search query | YouTube link]",
  cooldowns: 5,
  dependencies: {}
};

module.exports.handleReply = async function ({
  api: e,
  event: a,
  handleReply: t
}) {
  const n = global.nodemodule.axios,
    s = global.nodemodule["fs-extra"],
    {
      unlinkSync: l,
      statSync: h
    } = global.nodemodule["fs-extra"];

  const [choice, format] = a.body.toLowerCase().split(" ");
  const chosenIndex = parseInt(choice);

  if (isNaN(chosenIndex) || chosenIndex < 1 || chosenIndex > 6) {
    return e.sendMessage("দয়া করে 1 থেকে 6 এর মধ্যে একটি সংখ্যা এবং এক্সটেনশন (mp3/mp4) দিন, যেমন: 1 mp4", a.threadID, a.messageID);
  }

  if (!format || (format !== "mp3" && format !== "mp4")) {
    return e.sendMessage("দয়া করে এক্সটেনশন (mp3 বা mp4) উল্লেখ করুন, যেমন: 1 mp4", a.threadID, a.messageID);
  }

  e.unsendMessage(t.messageID);
  e.sendMessage("আপনার অনুরোধ প্রক্রিয়া করা হচ্ছে, দয়া করে অপেক্ষা করুন...", a.threadID);

  try {
    const videoId = t.link[chosenIndex - 1];
    let apiUrl = `https://ytstream-download-youtube-videos.p.rapidapi.com/dl`;
    let filename = `youtube_download.${format}`;
    let successMessage = "";

    // Fetch API Key dynamically
    const i = await n.get("https://raw.githubusercontent.com/MOHAMMAD-NAYAN-07/Nayan/main/video.json");
    const r = i.data.keyVideo.length;
    const o = i.data.keyVideo[Math.floor(Math.random() * r)]; // Random API Key

    const headers = {
      "x-rapidapi-host": "ytstream-download-youtube-videos.p.rapidapi.com",
      "x-rapidapi-key": o.API_KEY
    };

    let response;
    if (format === "mp4") {
      response = (await n.request({
        method: "GET",
        url: apiUrl,
        params: {
          id: videoId
        },
        headers: headers
      })).data;
      if (response.status === "fail") {
        return e.sendMessage("এই ভিডিওটি ডাউনলোড করা যাচ্ছে না।", a.threadID, a.messageID);
      }
      const videoLink = Object.values(response.link).find(linkArray => linkArray[0].includes("mp4"))[0];
      const videoData = (await n.get(videoLink, {
        responseType: "arraybuffer"
      })).data;
      s.writeFileSync(__dirname + `/cache/${filename}`, Buffer.from(videoData, "utf-8"));
      successMessage = `» ${response.title} (MP4) ডাউনলোড সম্পন্ন হয়েছে।`;
    } else if (format === "mp3") {
      // For MP3, we might need a different API endpoint or parameter,
      // assuming the current API can handle audio streams.
      // If not, you might need a separate API for audio.
      // For simplicity, I'm assuming the same API can return audio.
      response = (await n.request({
        method: "GET",
        url: apiUrl,
        params: {
          id: videoId
        },
        headers: headers
      })).data;
      if (response.status === "fail") {
        return e.sendMessage("এই অডিওটি ডাউনলোড করা যাচ্ছে না।", a.threadID, a.messageID);
      }
      // Assuming the API provides an audio stream link within 'link' object
      // This part might need adjustment based on the actual API response for MP3
      const audioLink = Object.values(response.link).find(linkArray => linkArray[0].includes("mp3"))[0] ||
                       Object.values(response.link)[0][0]; // Fallback if no specific mp3 link

      const audioData = (await n.get(audioLink, {
        responseType: "arraybuffer"
      })).data;
      s.writeFileSync(__dirname + `/cache/${filename}`, Buffer.from(audioData, "utf-8"));
      successMessage = `» ${response.title} (MP3) ডাউনলোড সম্পন্ন হয়েছে।`;
    }

    const filePath = __dirname + `/cache/${filename}`;
    if (h(filePath).size > 26e6) { // Check file size (25MB limit)
      return e.sendMessage("ফাইলটি 25MB এর বেশি হওয়ায় পাঠানো যাচ্ছে না।", a.threadID, () => l(filePath), a.messageID);
    } else {
      return e.sendMessage({
        body: successMessage,
        attachment: s.createReadStream(filePath)
      }, a.threadID, () => s.unlinkSync(filePath), a.messageID);
    }

  } catch (error) {
    console.error("Download error:", error);
    return e.sendMessage("ফাইলটি ডাউনলোড করা যায়নি। API বা নেটওয়ার্ক সমস্যা হতে পারে।", a.threadID, a.messageID);
  } finally {
    // Clean up all cached image files from previous search
    for (let i = 1; i < 7; i++) {
      try {
        l(__dirname + `/cache/${i}.png`);
      } catch (e) {} // Ignore error if file doesn't exist
    }
  }
};

module.exports.run = async function ({
  api: e,
  event: a,
  args: t
}) {
  const n = global.nodemodule.axios,
    s = global.nodemodule["fs-extra"],
    d = global.nodemodule["simple-youtube-api"],
    {
      createReadStream: m,
      unlinkSync: h
    } = global.nodemodule["fs-extra"];

  // Fetch API Key dynamically for search and initial link processing
  const i = await n.get("https://raw.githubusercontent.com/MOHAMMAD-NAYAN-07/Nayan/main/video.json");
  const r = i.data.keyVideo.length;
  const o = i.data.keyVideo[Math.floor(Math.random() * r)]; // Random API Key for download

  const youtubeApiKeys = ["AIzaSyB5A3Lum6u5p2Ki2btkGdzvEqtZ8KNLeXo", "AIzaSyAyjwkjc0w61LpOErHY_vFo6Di5LEyfLK0", "AIzaSyBY5jfFyaTNtiTSBNCvmyJKpMIGlpCSB4w", "AIzaSyCYCg9qpFmJJsEcr61ZLV5KsmgT1RE5aI4"];
  const selectedYoutubeApiKey = youtubeApiKeys[Math.floor(Math.random() * youtubeApiKeys.length)];
  const youtubeApi = new d(selectedYoutubeApiKey);

  if (t.length === 0 || !t) {
    return e.sendMessage("অনুসন্ধান খালি রাখা যাবে না!", a.threadID, a.messageID);
  }

  const query = t.join(" ");

  if (query.startsWith("http://") || query.startsWith("https://")) {
    // Direct YouTube link handling
    let videoIdMatch = query.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/))([^&\n?#]+)/);
    if (!videoIdMatch) {
      return e.sendMessage("অকার্যকর ইউটিউব লিংক।", a.threadID, a.messageID);
    }
    const videoId = videoIdMatch[1];

    e.sendMessage("লিংক থেকে ভিডিও প্রক্রিয়া করা হচ্ছে, দয়া করে অপেক্ষা করুন...", a.threadID);

    try {
      const directDownloadHeaders = {
        "x-rapidapi-host": "ytstream-download-youtube-videos.p.rapidapi.com",
        "x-rapidapi-key": o.API_KEY
      };

      const videoInfo = (await n.request({
        method: "GET",
        url: "https://ytstream-download-youtube-videos.p.rapidapi.com/dl",
        params: {
          id: videoId
        },
        headers: directDownloadHeaders
      })).data;

      if (videoInfo.status === "fail") {
        return e.sendMessage("এই ফাইলটি পাঠানো যাচ্ছে না।", a.threadID, a.messageID);
      }

      // Prompt user to choose format if a direct link is provided
      const msg = `একটি ফরম্যাট নির্বাচন করুন:\n1. mp4 (ভিডিও)\n2. mp3 (অডিও)\n\nদয়া করে উত্তর দিন (নম্বর দিন) কোন ফরম্যাটে আপনি ডাউনলোড করতে চান।`;
      return e.sendMessage({
        body: msg
      }, a.threadID, (err, info) => {
        if (!err) {
          global.client.handleReply.push({
            name: this.config.name,
            messageID: info.messageID,
            author: a.senderID,
            link: [videoId] // Pass the single videoId for direct download
          });
        }
      }, a.messageID);

    } catch (error) {
      console.error("Direct link download error:", error);
      return e.sendMessage("লিংক থেকে ফাইল প্রক্রিয়া করা যায়নি: " + error.message, a.threadID, a.messageID);
    }
  } else {
    // Search functionality
    try {
      let attachments = [];
      let messageBody = "»🔎 আপনার অনুসন্ধান কীওয়ার্ডের সাথে মিলে যাওয়া ভিডিওগুলি:\n\n";
      let videoLinks = [];
      let counter = 0;

      const searchResults = await youtubeApi.searchVideos(query, 6);

      for (let video of searchResults) {
        if (!video.id) continue;
        videoLinks.push(video.id);

        let thumbnailUrl = `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
        let thumbPath = __dirname + `/cache/${counter + 1}.png`;

        const thumbData = (await n.get(thumbnailUrl, {
          responseType: "arraybuffer"
        })).data;
        s.writeFileSync(thumbPath, Buffer.from(thumbData, "utf-8"));
        attachments.push(s.createReadStream(thumbPath));

        // Get video duration
        const videoDetails = (await n.get(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${video.id}&key=${selectedYoutubeApiKey}`)).data.items[0];
        let duration = "N/A";
        if (videoDetails && videoDetails.contentDetails && videoDetails.contentDetails.duration) {
          duration = videoDetails.contentDetails.duration.slice(2).replace("S", "").replace("M", ":").replace("H", ":");
        }

        let prefixEmoji;
        switch (counter + 1) {
          case 1:
            prefixEmoji = "⓵";
            break;
          case 2:
            prefixEmoji = "⓶";
            break;
          case 3:
            prefixEmoji = "⓷";
            break;
          case 4:
            prefixEmoji = "⓸";
            break;
          case 5:
            prefixEmoji = "⓹";
            break;
          case 6:
            prefixEmoji = "⓺";
            break;
        }

        messageBody += `${prefixEmoji} 《${duration}》 ${video.title}\n\n`;
        counter++;
      }

      messageBody += "» অনুগ্রহ করে উত্তর দিন (সংখ্যা দিয়ে) উপরে থেকে একটি নির্বাচন করুন এবং ফরম্যাট (mp3/mp4) উল্লেখ করুন, যেমন: 1 mp4";

      return e.sendMessage({
        attachment: attachments,
        body: messageBody
      }, a.threadID, ((err, info) => {
        if (!err) {
          global.client.handleReply.push({
            name: this.config.name,
            messageID: info.messageID,
            author: a.senderID,
            link: videoLinks
          });
        }
      }), a.messageID);

    } catch (error) {
      console.error("Search error:", error);
      return e.sendMessage("মডিউল ত্রুটির কারণে অনুরোধ প্রক্রিয়া করা যায়নি: " + error.message, a.threadID, a.messageID);
    } finally {
      // Clean up cached image files after sending search results
      for (let i = 1; i < 7; i++) {
        try {
          h(__dirname + `/cache/${i}.png`);
        } catch (e) {} // Ignore error if file doesn't exist
      }
    }
  }
};
