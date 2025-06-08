const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");
const path = require("path");
const ffmpegPath = require("ffmpeg-static");
const { spawn } = require("child_process");

const ASSEMBLYAI_API_KEY = "da1ea0da92954bb1b1338038691ae7f2";

module.exports.config = {
  name: "vt",
  version: "1.0.0",
  permission: 0,
  credits: "Mahir Labib + Edited by ChatGPT",
  prefix: true,
  description: "Voice to text using AssemblyAI only",
  category: "tools",
  usages: "[reply to voice/audio]",
  cooldowns: 5
};

function getExtension(mimeType, fileName) {
  if (mimeType) {
    const parts = mimeType.split("/");
    if (parts[0] === "audio" && parts[1]) return parts[1];
    if (mimeType === "video/mp4") return "mp4";
  }
  if (fileName) {
    return fileName.split(".").pop();
  }
  return "mp3";
}

async function convertToMp3(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, [
      "-i", inputPath,
      "-vn",
      "-ar", "44100",
      "-ac", "2",
      "-b:a", "192k",
      outputPath
    ]);

    ffmpeg.on("error", reject);
    ffmpeg.stderr.on("data", data => console.log(`FFmpeg: ${data}`));
    ffmpeg.on("close", code => {
      if (code === 0) resolve();
      else reject(new Error("FFmpeg conversion failed"));
    });
  });
}

module.exports.run = async function ({ api, event }) {
  if (!event.messageReply || !event.messageReply.attachments?.length) {
    return api.sendMessage("🎤 অনুগ্রহ করে একটি ভয়েস/অডিও মেসেজে রিপ্লাই দাও।", event.threadID, event.messageID);
  }

  const audioAttachment = event.messageReply.attachments.find(att => {
    if (att.type === "audio" || att.type === "voice-message") return true;
    if (att.type === "file") {
      if (!att.mimeType || att.mimeType === "application/octet-stream") return true;
      if (att.mimeType.startsWith("audio/") || att.mimeType === "video/mp4") return true;
    }
    return false;
  });

  if (!audioAttachment) {
    return api.sendMessage("🔇 এটি ভয়েস বা অডিও মেসেজ না। অনুগ্রহ করে আবার চেষ্টা করো।", event.threadID, event.messageID);
  }

  const audioUrl = audioAttachment.url;
  const guessedExt = getExtension(audioAttachment.mimeType, audioAttachment.name);

  const audioFileName = path.join(__dirname, `temp_audio_${Date.now()}.${guessedExt}`);
  const convertedFileName = audioFileName.replace(path.extname(audioFileName), ".mp3");

  try {
    // অডিও ডাউনলোড
    const res = await axios({ method: "GET", url: audioUrl, responseType: "stream" });
    const writer = fs.createWriteStream(audioFileName);
    res.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    // কনভার্ট mp3 তে
    await convertToMp3(audioFileName, convertedFileName);

    // AssemblyAI তে আপলোড
    const form = new FormData();
    form.append("file", fs.createReadStream(convertedFileName));

    const uploadRes = await axios.post("https://api.assemblyai.com/v2/upload", form, {
      headers: {
        ...form.getHeaders(),
        authorization: ASSEMBLYAI_API_KEY
      }
    });

    const audio_url = uploadRes.data.upload_url;
    api.sendMessage("🔍 অডিও বিশ্লেষণ করা হচ্ছে...", event.threadID);

    // ট্রান্সক্রিপশন শুরু
    const transcriptRes = await axios.post("https://api.assemblyai.com/v2/transcript", {
      audio_url,
      punctuate: true,
      format_text: true,
      language_detection: false
    }, {
      headers: { authorization: ASSEMBLYAI_API_KEY }
    });

    const transcriptId = transcriptRes.data.id;

    let transcriptText = "";
    let done = false;
    let tries = 0;

    while (!done && tries < 25) {
      await new Promise(res => setTimeout(res, 4000));
      tries++;

      const statusRes = await axios.get(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: { authorization: ASSEMBLYAI_API_KEY }
      });

      if (statusRes.data.status === "completed") {
        transcriptText = statusRes.data.text;
        done = true;
      } else if (statusRes.data.status === "error") {
        throw new Error(statusRes.data.error);
      }
    }

    if (!done) throw new Error("⏱️ ট্রান্সক্রিপশন টাইমআউট হয়েছে।");
    if (!transcriptText || transcriptText.trim() === "") {
      return api.sendMessage("⚠️ অডিও থেকে কিছুই ট্রান্সক্রাইব করা যায়নি।", event.threadID, event.messageID);
    }

    api.sendMessage(`🗣️ সে এটা বলেছে:\n\n"${transcriptText}"`, event.threadID, event.messageID);

  } catch (err) {
    console.error("❌ Voice to text error:", err);
    api.sendMessage(`⚠️ একটি সমস্যা হয়েছে: ${err.message || err}`, event.threadID, event.messageID);
  } finally {
    try {
      if (fs.existsSync(audioFileName)) fs.unlinkSync(audioFileName);
      if (fs.existsSync(convertedFileName)) fs.unlinkSync(convertedFileName);
    } catch (e) {
      console.error("ফাইল ডিলিটে সমস্যা:", e);
    }
  }
};
