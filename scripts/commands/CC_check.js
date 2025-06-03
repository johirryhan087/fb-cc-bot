module.exports = {
  config: {
    name: "chk",
    version: "1.0.0",
    permission: 0,
    prefix: true,
    credits: "YourName",
    description: "Card live/dead checker",
    category: "utility",
    usages: "<cc|mm|yyyy|cvv>",
    cooldowns: 5,
  },

  languages: {
    en: {
      missing: "[ ! ] Please provide a card in format: /chk 5154620016977819|12|2028|000",
      error: "❌ Failed to check card.",
    },
  },

  start: async function ({ nayan, events, args, lang }) {
    const axios = require("axios");
    const { threadID, messageID } = events;

    if (!args[0] || !args[0].includes("|")) {
      return nayan.reply(lang("missing"), threadID, messageID);
    }

    const cc = args[0];

    try {
      const res = await axios.get(`https://xchecker.cc/api.php?cc=${cc}`);
      const data = res.data;

      const rawDetails = data.details || "No extra info";

      // Remove donation message starting with "Please consider"
      const details = rawDetails.split("Please consider")[0].trim();

      const status = data.status?.toUpperCase() === "LIVE" ? "𝗟𝗶𝘃𝗲✅" : "𝗗𝗲𝗮𝗱❌";
      const message =
`𝗖𝗮𝗿𝗱: ${cc}
𝗦𝘁𝗮𝘁𝘂𝘀: ${status} 𝗗𝗲𝘁𝗮𝗶𝗹𝘀: ${details}`;

      return nayan.reply(message, threadID, messageID);
    } catch (err) {
      console.error("Checker error:", err.message);
      return nayan.reply(lang("error"), threadID, messageID);
    }
  }
};
