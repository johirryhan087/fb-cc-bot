module.exports.config = {
    name: "spam",
    version: "1.0.1", 
    permssion: 2,
    credits: "Nayan",
    description: "Sends a message multiple times.", 
    category: "spam",
    usages: "[message] [amount]", 
    prefix: true,
    cooldowns: 5,
    dependencies: "",
};

module.exports.run = function ({ api, event, Users, args }) {
    // অনুমতি যাচাই (আপনার দেওয়া কোড অনুযায়ী)
    const permission = ["61576199337987"];
    if (!permission.includes(event.senderID)) {
        return api.sendMessage("Only Bot Admin Can Use this command", event.threadID, event.messageID);
    }

    // আর্গুমেন্ট (কমান্ডের পরের অংশ) ঠিক আছে কিনা তা যাচাই করা
    // মেসেজ এবং কাউন্ট (সংখ্যা) মিলিয়ে অন্তত ২টি আর্গুমেন্ট লাগবে
    if (args.length < 2) {
        return api.sendMessage(`Invalid usage. Please use: ${global.config.PREFIX}spam [message] [amount]`, event.threadID);
    }

    var { threadID, messageID } = event;
    var sendMessage = function (msg) { api.sendMessage(msg, threadID)}; // 'k' এর বদলে আরও স্পষ্ট নাম 'sendMessage' ব্যবহার করা হয়েছে

    // শেষ আর্গুমেন্টটি (শেষের শব্দ) হল কাউন্ট (কতবার যাবে)
    const count = parseInt(args[args.length - 1]); // parseInt দিয়ে নিশ্চিত করা হচ্ছে এটি একটি সংখ্যা

    // কাউন্ট একটি বৈধ সংখ্যা কিনা তা যাচাই করা
    if (isNaN(count) || count <= 0) {
        return api.sendMessage("The amount must be a positive number.", threadID, messageID);
    }

    // মেসেজ তৈরি করা: শেষ আর্গুমেন্টটি (কাউন্ট) বাদ দিয়ে বাকি সব আর্গুমেন্ট একসাথে জুড়ে দেওয়া হচ্ছে
    const messageToSpam = args.slice(0, args.length - 1).join(" ");

    // নির্দিষ্ট সংখ্যক বার মেসেজ পাঠানো
    for (let i = 0; i < count; i++) {
        sendMessage(messageToSpam);
    }
};
