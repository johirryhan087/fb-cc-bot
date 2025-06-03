module.exports = {
  config: {
    name: "bin",
    version: "1.1.0",
    permission: 0,
    prefix: true,
    credits: "YourName",
    description: "BIN info lookup with fallback",
    category: "utility",
    usages: "<bin>",
    cooldowns: 5,
  },

  languages: {
    en: {
      missing: "[ ! ] Please provide a BIN number (6 digits).",
      error: "❌ Could not fetch BIN data from either API.",
    },
  },

  start: async function ({ nayan, events, args, lang }) {
    const axios = require("axios");
    const { threadID, messageID } = events;

    if (!args[0] || args[0].length < 6 || isNaN(args[0])) {
      return nayan.reply(lang("missing"), threadID, messageID);
    }

    const bin = args[0].slice(0, 6);
    let d = null;

    // First API
    try {
      const res = await axios.get(`https://lookup.binlist.net/${bin}`);
      d = res.data;
    } catch (err) {
      console.warn("Primary API failed. Trying fallback...");
    }

    // Fallback API
    if (!d) {
      try {
        const fallback = await axios.get(`https://drlabapis.onrender.com/api/bin?bin=${bin}`);
        d = fallback.data;
      } catch (err2) {
        console.error("Both APIs failed.");
        return nayan.reply(lang("error"), threadID, messageID);
      }
    }

    const message = 
`𝗕𝗜𝗡: ${bin}
𝗧𝘆𝗽𝗲: ${(d.type || "N/A").toUpperCase()} (${(d.scheme || "N/A").toUpperCase()})

𝐈𝐬𝐬𝐮𝐞𝐫: ${d.bank?.name || "Unknown"}
𝐁𝐚𝐧𝐤: ${d.bank?.name || "Unknown"}
𝗖𝗼𝘂𝗻𝘁𝗿𝘆: ${d.country?.name || "Unknown"} ${d.country?.emoji || ""}
𝗖𝘂𝗿𝗿𝗲𝗻𝗰𝘆: ${d.country?.currency || "N/A"} | 𝗖𝗼𝗱𝗲: ${d.country?.alpha2 || "N/A"}
𝗣𝗿𝗲𝗽𝗮𝗶𝗱: ${d.prepaid ? "YES" : "NO"} | 𝗟𝘂𝗵𝗻 𝗩𝗮𝗹𝗶𝗱: ${d.number?.luhn === false ? "NO" : "YES"}`;

    return nayan.reply(message, threadID, messageID);
  }
};