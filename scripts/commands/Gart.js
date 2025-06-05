module.exports = {
  config: {
    name: "gart",
    version: "1.0.0",
    permission: 0,
    credits: "Mahir",
    description: "Generate images with a prompt, style, and specified amount using the second API.",
    prefix: true,
    category: "prefix",
    usages: "[prompt] .stl [style] .cnt [amount (optional)]", // Updated usage
    cooldowns: 10,
  },

  languages: {
    "vi": {},
    "en": {
      "missing_prompt_style": 'Please provide both a prompt and a style using the format: /imagine2 [your prompt] .stl [your style] .cnt [amount (optional)]\nExample: /imagine2 a-boy-is-playing .stl logo .cnt 2',
      "invalid_amount": "The amount must be a number greater than 0."
    }
  },

  start: async function({ nayan, events, args, lang }) {
    const axios = require("axios");
    const fs = require("fs-extra");

    let prompt = "";
    let style = "";
    let amount = 4; // Default amount of images

    // Find the positions of '.stl' and '.cnt'
    const stlIndex = args.indexOf(".stl");
    const cntIndex = args.indexOf(".cnt");

    // Validate command structure
    if (stlIndex === -1 || stlIndex === 0 || (cntIndex !== -1 && cntIndex < stlIndex)) {
      return nayan.reply(lang('missing_prompt_style'), events.threadID, events.messageID);
    }

    // Extract prompt
    prompt = args.slice(0, stlIndex).join(" ");

    // Extract style
    if (cntIndex !== -1) { // If .cnt is present
      style = args.slice(stlIndex + 1, cntIndex).join(" ");
    } else { // If only .stl is present
      style = args.slice(stlIndex + 1).join(" ");
    }

    // Extract amount if .cnt is present
    if (cntIndex !== -1) {
      const parsedAmount = parseInt(args[cntIndex + 1]);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return nayan.reply(lang('invalid_amount'), events.threadID, events.messageID);
      }
      amount = parsedAmount;
    }

    if (!prompt || !style) {
      return nayan.reply(lang('missing_prompt_style'), events.threadID, events.messageID);
    }

    let imgData = [];
    let generatedCount = 0;

    try {
      for (let i = 0; i < amount; i++) {
        const apiUrl = `https://imggen-delta.vercel.app/?prompt=${encodeURIComponent(prompt)}&style=${encodeURIComponent(style)}`;

        const res = await axios.get(apiUrl);

        if (res.data && res.data.url) {
          const imageUrl = res.data.url;
          const path = __dirname + `/cache/imagine2_${events.senderID}_${Date.now()}_${i}.jpg`; // More unique path
          const getDown = (await axios.get(imageUrl, { responseType: 'arraybuffer' })).data;
          fs.writeFileSync(path, Buffer.from(getDown, 'binary'));
          imgData.push(fs.createReadStream(path));
          generatedCount++;
        } else {
          console.warn(`API did not return an image URL for prompt "${prompt}" and style "${style}" (attempt ${i + 1}).`);
        }
      }

      if (imgData.length === 0) {
        return nayan.reply("Could not generate any images. Please try a different prompt or style.", events.threadID, events.messageID);
      }

      await nayan.reply({
        attachment: imgData,
        body: `🔍Imagine Result🔍\n\n📝Prompt: ${prompt}\n✨Style: ${style}\n#️⃣Generated Images: ${generatedCount}`
      }, events.threadID, events.messageID);

    } catch (error) {
      console.error("Error in imagine2 command:", error);
      return nayan.reply("An error occurred while generating the image(s). Please check your prompt and style, then try again later.", events.threadID, events.messageID);
    } finally {
      // Clean up cached images
      for (const stream of imgData) {
        if (fs.existsSync(stream.path)) {
          fs.unlinkSync(stream.path);
        }
      }
    }
  }
};
