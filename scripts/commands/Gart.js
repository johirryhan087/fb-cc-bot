module.exports = {
  config: {
    name: "gart",
    version: "1.0.0",
    permission: 0,
    credits: "Tofazzol", 
    description: "Generate images from a prompt with an optional style and amount.",
    prefix: true,
    category: "prefix",
    usages: "gart [prompt] .stl [style] .cnt [amount]", 
    cooldowns: 10,
  },

  languages: {
    "vi": {},
    "en": {
      "missing_prompt": 'Please provide a prompt. Usage: /gart a cat .stl anime .cnt 2',
      "generating_message": "Generating your image(s), please wait...", // নতুন মেসেজ
      "error": "An error occurred while generating the image. Please try again later."
    }
  },

  start: async function({ nayan, events, args, lang }) {
    const axios = require("axios");
    const fs = require("fs-extra");

    // prompt, style এবং amount আলাদা করা
    let prompt = "";
    let style = "";
    let amount = 2; // Default to 2 image

    const argString = args.join(" ");
    const promptMatch = argString.match(/(.*?)(?:\s*\.stl\s*(.*?))?(?:\s*\.cnt\s*(\d+))?$/i);

    if (promptMatch) {
      prompt = promptMatch[1].trim();
      style = promptMatch[2] ? promptMatch[2].trim() : "";
      amount = promptMatch[3] ? parseInt(promptMatch[3]) : 1;
    }

    if (!prompt) {
      return nayan.reply(lang('missing_prompt'), events.threadID, events.messageID);
    }

    // সর্বোচ্চ 4টি ইমেজ জেনারেট করার জন্য সীমাবদ্ধতা
    if (amount > 4) {
      amount = 4;
      nayan.reply("You can generate a maximum of 4 images at a time. Generating 4 images.", events.threadID, events.messageID);
    }

    // তাৎক্ষণিক রিপ্লাই
    nayan.reply(lang('generating_message'), events.threadID, events.messageID);

    try {
      const imgData = [];
      for (let i = 0; i < amount; i++) {
        const apiUrl = `https://imggen-delta.vercel.app/?prompt=${encodeURIComponent(prompt)}&style=${encodeURIComponent(style)}`;
        const res = await axios.get(apiUrl);

        const imageUrl = res.data.url;

        if (!imageUrl) {
          // যদি কোনো কারণে URL না পাওয়া যায়, তবে লুপ ব্রেক করে দেওয়া
          console.error("No image URL found from API for iteration", i);
          if (imgData.length === 0) { // যদি কোনো ইমেজই জেনারেট না হয়
            return nayan.reply(lang('error'), events.threadID, events.messageID);
          }
          break;
        }

        const path = __dirname + `/cache/gart_result_${i + 1}.png`;
        const getDown = (await axios.get(imageUrl, { responseType: 'arraybuffer' })).data;
        fs.writeFileSync(path, Buffer.from(getDown, 'utf-8'));
        imgData.push(fs.createReadStream(path));
      }

      if (imgData.length === 0) {
        return nayan.reply(lang('error'), events.threadID, events.messageID);
      }

      nayan.reply({
        attachment: imgData,
        body: `🔍Imagine Result🔍\n\n📝Prompt: ${prompt}\n${style ? `🎨Style: ${style}\n` : ''}#️⃣Number of Images: ${imgData.length}`
      }, events.threadID, () => {
        // সব ইমেজ পাঠানোর পর ক্যাশ ফাইলগুলো ডিলিট করা
        for (let i = 0; i < imgData.length; i++) {
          fs.unlinkSync(__dirname + `/cache/gart_result_${i + 1}.png`);
        }
      });

    } catch (error) {
      console.error("Gart command error:", error);
      nayan.reply(lang('error'), events.threadID, events.messageID);
    }
  }
};
