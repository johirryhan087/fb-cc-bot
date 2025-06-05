module.exports = {
  config: {
    name: "gart",
    version: "1.0.0",
    permission: 0,
    credits: "Nayan",
    description: "Generate images with a prompt and style using the second API.",
    prefix: true,
    category: "prefix",
    usages: "[prompt] .stl [style]", // Updated usage for clarity
    cooldowns: 10,
  },

  languages: {
    "vi": {},
    "en": {
      "missing_prompt_style": 'Please provide both a prompt and a style using the format: /imagine2 [your prompt] .stl [your style]\nExample: /imagine2 a-boy-is-playing .stl logo'
    }
  },

  start: async function({ nayan, events, args, lang }) {
    const axios = require("axios");
    const fs = require("fs-extra");

    // Check if the input contains '.stl' to separate prompt and style
    const stlIndex = args.indexOf(".stl");

    if (stlIndex === -1 || stlIndex === 0 || stlIndex === args.length - 1) {
      // If '.stl' is not found, or it's at the beginning/end, show error
      return nayan.reply(lang('missing_prompt_style'), events.threadID, events.messageID);
    }

    // Extract prompt and style based on '.stl' position
    const prompt = args.slice(0, stlIndex).join(" ");
    const style = args.slice(stlIndex + 1).join(" ");

    if (!prompt || !style) {
      return nayan.reply(lang('missing_prompt_style'), events.threadID, events.messageID);
    }

    try {
      // Construct the API URL with prompt and style
      const apiUrl = `https://imggen-delta.vercel.app/?prompt=${encodeURIComponent(prompt)}&style=${encodeURIComponent(style)}`;

      const res = await axios.get(apiUrl);

      if (!res.data || !res.data.url) {
        return nayan.reply("No image URL received from the API. Please try a different prompt or style.", events.threadID, events.messageID);
      }

      const imageUrl = res.data.url;
      const path = __dirname + `/cache/imagine2_${events.senderID}_${Date.now()}.jpg`; // More unique path

      // Download the image
      const getDown = (await axios.get(imageUrl, { responseType: 'arraybuffer' })).data;
      fs.writeFileSync(path, Buffer.from(getDown, 'binary'));

      await nayan.reply({
        attachment: fs.createReadStream(path),
        body: `🔍Imagine Result🔍\n\n📝Prompt: ${prompt}\n✨Style: ${style}`
      }, events.threadID, events.messageID);

    } catch (error) {
      console.error("Error in imagine2 command:", error);
      return nayan.reply("An error occurred while generating the image. Please check your prompt and style, then try again later.", events.threadID, events.messageID);
    } finally {
      // Clean up the cached image
      if (fs.existsSync(path)) {
        fs.unlinkSync(path);
      }
    }
  }
};
