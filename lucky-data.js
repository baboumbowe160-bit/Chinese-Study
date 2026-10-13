/* Numbers with meaning – digits that sound like words, number codes, red envelopes (红包).
   digits:  [digit, zh, pinyin, soundsLikeZh, soundsLikePy, meaning, mood (good|mixed|bad), emoji]
   codes:   [number, read (digit by digit), pinyin, meaningZh, meaningPy, English, tip, emoji, kind]
   kinds:   love · luck · chat · warn                                                            */
var LUCKY = {
  digits: [
    ["0", "零", "líng", "你", "nǐ", "“you” in love codes – 520 = 我爱你", "mixed", "👉"],
    ["1", "一", "yī / yāo", "要", "yào", "“want / will”. In phone numbers and codes 1 is said yāo", "mixed", "☝️"],
    ["2", "二", "èr", "双", "shuāng", "pairs: 好事成双 “good things come in pairs” – even amounts are lucky", "good", "👫"],
    ["3", "三", "sān", "生 / 散", "shēng / sàn", "“life” (as in 1314) – but also “break apart”, so it depends", "mixed", "🔺"],
    ["4", "四", "sì", "死", "sǐ", "“death” – the most avoided number. Many buildings have no 4th floor", "bad", "🚫"],
    ["5", "五", "wǔ", "我", "wǒ", "“I / me” in love codes – 530 = 我想你", "mixed", "🙋"],
    ["6", "六", "liù", "顺 / 溜", "shùn / liū", "smooth: 六六大顺 “everything goes smoothly”", "good", "🛣️"],
    ["7", "七", "qī", "妻 / 气", "qī / qì", "“wife” or “anger”. 七夕 (7th night of the 7th month) is Chinese Valentine's Day", "mixed", "🌙"],
    ["8", "八", "bā", "发", "fā", "“get rich” – the luckiest number of all", "good", "💰"],
    ["9", "九", "jiǔ", "久", "jiǔ", "“long-lasting” – love and friendship that last forever", "good", "♾️"]
  ],
  codes: [
    ["520", "五二零", "wǔ èr líng", "我爱你", "wǒ ài nǐ", "I love you", "20 May (5·20) is “520 Day” – couples send ¥5.20, ¥52.0 or ¥520.", "❤️", "love"],
    ["521", "五二一", "wǔ èr yāo", "我愿意", "wǒ yuànyì", "I do / I'm willing (also: I love you)", "A sweet reply to 520.", "💍", "love"],
    ["1314", "一三一四", "yāo sān yāo sì", "一生一世", "yìshēng yíshì", "for my whole life", "Here 4 means 世 (lifetime), not death – so 1314 is lucky!", "♾️", "love"],
    ["5201314", "五二零一三一四", "wǔ èr líng yāo sān yāo sì", "我爱你一生一世", "wǒ ài nǐ yìshēng yíshì", "I love you for my whole life", "Often sent as two red envelopes: 520 and 13.14.", "💞", "love"],
    ["530", "五三零", "wǔ sān líng", "我想你", "wǒ xiǎng nǐ", "I miss you", "", "🥺", "love"],
    ["9420", "九四二零", "jiǔ sì èr líng", "就是爱你", "jiù shì ài nǐ", "it's you I love", "", "💘", "love"],
    ["99", "九九", "jiǔ jiǔ", "久久", "jiǔjiǔ", "forever and ever", "Popular for anniversaries and close friends.", "💑", "love"],
    ["1001", "一千零一", "yìqiān líng yī", "千里挑一", "qiān lǐ tiāo yī", "one in a thousand", "A classic wedding gift: “you found one in a thousand”.", "💍", "love"],
    ["10001", "一万零一", "yíwàn líng yī", "万里挑一", "wàn lǐ tiāo yī", "one in ten thousand", "An even bigger wedding compliment.", "👰", "love"],
    ["8", "八", "bā", "发", "fā", "get rich", "Good for any happy gift.", "💰", "luck"],
    ["88", "八八", "bā bā", "发发", "fā fā", "rich and richer", "As money it means wealth – as a chat message it means “bye-bye” (see Chat).", "💰", "luck"],
    ["888", "八八八", "bā bā bā", "发发发", "fā fā fā", "riches, riches, riches", "Great for weddings, new businesses, Spring Festival.", "🧧", "luck"],
    ["6", "六", "liù", "顺", "shùn", "smooth", "", "🛣️", "luck"],
    ["66", "六六", "liù liù", "六六大顺", "liùliù dà shùn", "may everything go smoothly", "Perfect before an exam, a trip or a new job.", "🍀", "luck"],
    ["168", "一六八", "yāo liù bā", "一路发", "yí lù fā", "prosper all the way", "Loved by business people – also in shop names and phone numbers.", "🚀", "luck"],
    ["518", "五一八", "wǔ yāo bā", "我要发", "wǒ yào fā", "I will prosper", "", "📈", "luck"],
    ["999", "九九九", "jiǔ jiǔ jiǔ", "长长久久", "chángcháng jiǔjiǔ", "long-lasting", "Weddings and anniversaries.", "♾️", "luck"],
    ["88", "八八", "bā bā", "拜拜", "báibái", "bye-bye", "In chat messages 88 = goodbye.", "👋", "chat"],
    ["886", "八八六", "bā bā liù", "拜拜了", "báibái le", "bye then!", "", "👋", "chat"],
    ["666", "六六六", "liù liù liù", "溜溜溜", "liū liū liū", "awesome! so skilful!", "Very common in chats and live streams. As money it also means “smooth”.", "👍", "chat"],
    ["233", "二三三", "èr sān sān", "哈哈哈", "hāhāhā", "LOL – laughing", "From a laughing-face code on an old Chinese forum.", "😂", "chat"],
    ["555", "五五五", "wǔ wǔ wǔ", "呜呜呜", "wū wū wū", "boo-hoo (crying)", "", "😭", "chat"],
    ["7456", "七四五六", "qī sì wǔ liù", "气死我了", "qì sǐ wǒ le", "I'm so angry!", "", "😤", "chat"],
    ["4", "四", "sì", "死", "sǐ", "death", "Never give an amount with 4 in it for a happy event.", "🚫", "warn"],
    ["14", "一四", "yāo sì", "要死", "yào sǐ", "“going to die”", "Avoid in gifts and phone numbers.", "⚠️", "warn"],
    ["250", "二百五", "èrbǎiwǔ", "二百五", "èrbǎiwǔ", "fool, idiot", "Never give ¥250 – it is an insult!", "🙅", "warn"],
    ["748", "七四八", "qī sì bā", "去死吧", "qù sǐ ba", "go to hell", "Very rude.", "🤬", "warn"],
    ["38", "三八", "sān bā", "三八", "sānbā", "a rude word for a nosy woman", "But 三八节 (8 March) is Women's Day – context matters.", "⚠️", "warn"]
  ],
  // occasions → amounts to send (as in WeChat / Alipay red envelopes, ¥ yuan)
  occasions: [
    ["love", "To someone you love", "❤️", ["5.20", "13.14", "52.0", "99", "520", "1314"], "Send on 520 Day (20 May), 七夕 or their birthday. Two envelopes – 520 then 1314 – say “I love you forever”."],
    ["bday", "Friend's birthday", "🎂", ["6.66", "8.88", "66", "88", "99", "168"], "Wish them a smooth (6), rich (8) and long (9) life."],
    ["wedding", "Wedding", "💍", ["666", "888", "999", "1001"], "Use even or lucky numbers. 1001 means “one in a thousand”. Never anything with 4."],
    ["biz", "New business or new job", "🏪", ["66", "168", "518", "888"], "168 一路发 “prosper all the way” is the classic business number."],
    ["exam", "Exam, trip or new start", "🍀", ["6.66", "66", "66.6"], "6 = 顺 “smooth” – may everything go smoothly."],
    ["cny", "Spring Festival (Chinese New Year)", "🧧", ["8.88", "66", "88", "168", "888"], "The money for children is 压岁钱 yāsuìqián. Use new, clean notes."],
    ["thanks", "A small thank you", "🙏", ["6.66", "8.88", "9.99"], "A small amount with a nice meaning is better than a big plain one."]
  ],
  // the red-envelope etiquette card
  etiquette: [
    ["🧧", "红包 hóngbāo = red envelope. Red means luck and happiness, so money gifts go in red."],
    ["👐", "Give and receive with both hands. Traditionally you don't open it in front of the giver."],
    ["2️⃣", "Happy events: even amounts (好事成双 good things come in pairs) and 6, 8, 9."],
    ["🚫", "Avoid 4 (sounds like death) and 250 (means “fool”)."],
    ["🤍", "Sad events such as funerals use a white envelope (白包) with an odd amount."],
    ["📱", "On WeChat (微信) and Alipay (支付宝) people send digital red envelopes. Even the cents carry a message: ¥13.14 = 一生一世!"]
  ]
};
