module.exports = {
  config: {
    name: "gen",
    version: "1.0.0",
    permission: 0,
    prefix: true,
    credits: "YourName",
    description: "Generate test credit cards from BIN",
    category: "utility",
    usages: "[bin] [.cnt amount] or [bin|MM|YY|CVV] [.cnt amount]",
    cooldowns: 5,
  },

  languages: {
    en: {
      missing: "[ ! ] Please provide a BIN (6-16 digits). Example:\n/gen 515462\n/gen 515462xx .cnt 10\n/gen 515462xxxxxx|12|25|123 .cnt 5",
      error: "❌ Failed to generate cards.",
      invalidBin: "❌ Invalid BIN (must be 6-16 digits).",
      invalidCount: "❌ Count must be between 1 and 50.",
      invalidFormat: "❌ Invalid format. Use:\nBIN (6-16 digits)\nOptional: |MM|YY|CVV\n.cnt N (1-50)",
    },
  },

  start: async function ({ nayan, events, args, lang }) {
    const axios = require("axios");
    const { threadID, messageID } = events;

    // Default values
    let bin = "";
    let count = 5;
    let month = "xx";
    let year = "xx";
    let cvv = "xxx";
    let customPattern = "";

    const fullArgs = args.join(" ");

    // Extract count if .cnt exists
    const cntMatch = fullArgs.match(/\.cnt\s+(\d{1,2})/i);
    if (cntMatch) {
      const parsedCount = parseInt(cntMatch[1]);
      if (!isNaN(parsedCount)) {
        count = Math.min(Math.max(1, parsedCount), 50); // Clamp between 1 and 50
      } else {
        return nayan.reply(lang("invalidCount"), threadID, messageID);
      }
    }

    // Remove .cnt part for clean BIN parsing
    const cleanInput = fullArgs.replace(/\.cnt\s+\d{1,2}/i, "").trim();
    const pipeParts = cleanInput.split("|").map(p => p.trim());

    if (!pipeParts[0]) return nayan.reply(lang("missing"), threadID, messageID);

    // Clean BIN from any non-digit/x characters
    bin = pipeParts[0].replace(/[^0-9x]/gi, "").toLowerCase();
    if (bin.length < 6 || bin.length > 16) return nayan.reply(lang("invalidBin"), threadID, messageID);

    // Optional fields
    if (pipeParts[1]) month = pipeParts[1].padStart(2, '0').slice(0, 2);
    if (pipeParts[2]) year = pipeParts[2].slice(-2).padStart(2, '0');
    if (pipeParts[3]) cvv = pipeParts[3].slice(0, 3).padStart(3, '0');

    customPattern = bin.padEnd(16, 'x').slice(0, 16);
    if (pipeParts.length > 1) customPattern += `|${month}|${year}`;
    if (pipeParts.length > 3) customPattern += `|${cvv}`;

    let resultText = "";

    // Try Primary API
    try {
      const res = await axios.get(`https://drlabapis.onrender.com/api/ccgenerator?bin=${customPattern}&count=${count}`);
      if (typeof res.data === "string") {
        resultText = `✅ Generated ${count} CCs (${customPattern})\n\n${res.data}`;
      } else {
        throw new Error("Primary API error");
      }
    } catch (err1) {
      // Fallback API
      try {
        const fallbackRes = await axios.get(`https://web-production-4159.up.railway.app/api/ccgenerator?bin=${customPattern}&count=${count}`);
        const data = fallbackRes.data;

        if (!data.generated || !Array.isArray(data.generated)) throw new Error("Fallback API failed");

        const cards = data.generated.map(c => {
          const expMonth = month !== "xx" ? month : c.expiry_month.toString().padStart(2, '0');
          const expYear = year !== "xx" ? year : c.expiry_year.toString().slice(-2);
          const cardCvv = cvv !== "xxx" ? cvv : c.cvv.toString().padStart(3, '0');
          return `${c.raw_card_number}|${expMonth}|${expYear}|${cardCvv}`;
        }).join("\n");

        resultText = `✅ Generated ${count} CCs (${customPattern}):\n\n${cards}`;
      } catch (err2) {
        console.error("Both BIN generator APIs failed:", err2);
        return nayan.reply(lang("error"), threadID, messageID);
      }
    }

    return nayan.reply(resultText, threadID, messageID);
  },
};
