/* Numbers with meaning – digits that sound like words, number codes, red envelopes (红包), rhymes.
   Every meaning is taken from the sources listed at the bottom (numbers in [ ] point to them).
   digits:  [digit, zh, pinyin, soundsLikeZh, soundsLikePy, meaning, mood (good|mixed|bad), emoji, sources]
   codes:   [number, read (digit by digit), pinyin, meaningZh, meaningPy, English, tip, emoji, kind, sources]
   kinds:   love · luck · chat · warn                                                                      */
var LUCKY = {
  digits: [
    ["0", "零", "líng", "你", "nǐ", "“you” in love codes – 520 = 我爱你", "mixed", "👉", [2, 8]],
    ["1", "一", "yī / yāo", "一", "yī", "“one” – as in 一生 “one life” (1314). In codes and phone numbers 1 is often said yāo", "mixed", "☝️", [1, 3]],
    ["2", "二", "èr", "双", "shuāng", "pairs are lucky – 双喜 “double happiness” at weddings, and even amounts for gifts", "good", "👫", [1, 6]],
    ["3", "三", "sān", "生", "shēng", "“life” – the 3 in 1314 (一生一世)", "mixed", "🔺", [1]],
    ["4", "四", "sì", "死", "sǐ", "“death” – the most avoided number, never used in gifts", "bad", "🚫", [1, 6]],
    ["5", "五", "wǔ", "我 / 呜", "wǒ / wū", "“I / me” in love codes (520, 530) – but 555 sounds like crying 呜呜呜", "mixed", "🙋", [1, 2]],
    ["6", "六", "liù", "顺 / 溜", "shùn / liū", "smooth: 六六大顺 “everything goes smoothly”", "good", "🛣️", [4, 5]],
    ["7", "七", "qī", "气 / 欺", "qì / qī", "mixed: 七夕 (Chinese Valentine's) and 气 “life energy” – but also 欺 “deceive” and the Ghost Month (7th lunar month)", "mixed", "🌙", [1]],
    ["8", "八", "bā", "发", "fā", "“get rich” – the luckiest number of all", "good", "💰", [1, 6]],
    ["9", "九", "jiǔ", "久", "jiǔ", "“a long time” – long life, lasting love", "good", "♾️", [1]]
  ],
  codes: [
    ["520", "五二零", "wǔ èr líng", "我爱你", "wǒ ài nǐ", "I love you", "20 May (5·20) is an unofficial Valentine's Day in China.", "❤️", "love", [1, 2, 8]],
    ["521", "五二一", "wǔ èr yī", "我愿意", "wǒ yuànyì", "I'm willing / I love you", "A playful reply to 520.", "💍", "love", [3]],
    ["1314", "一三一四", "yī sān yī sì", "一生一世", "yìshēng yíshì", "for a whole lifetime – forever", "Here 4 means 世 (lifetime), not death – so 1314 is lucky!", "♾️", "love", [1, 2, 4]],
    ["5201314", "五二零一三一四", "wǔ èr líng yī sān yī sì", "我爱你一生一世", "wǒ ài nǐ yìshēng yíshì", "I love you forever", "", "💞", "love", [3, 8]],
    ["1314520", "一三一四五二零", "yī sān yī sì wǔ èr líng", "一生一世我爱你", "yìshēng yíshì wǒ ài nǐ", "all my life, I love you", "", "💗", "love", [3]],
    ["530", "五三零", "wǔ sān líng", "我想你", "wǒ xiǎng nǐ", "I miss you", "", "🥺", "love", [2]],
    ["9420", "九四二零", "jiǔ sì èr líng", "就是爱你", "jiù shì ài nǐ", "it's you I love", "", "💘", "love", [3]],
    ["99", "九九", "jiǔ jiǔ", "久久", "jiǔjiǔ", "long-lasting love", "99 roses is a classic proposal, and 99 is a popular red-envelope amount.", "💑", "love", [1]],
    ["8", "八", "bā", "发", "fā", "get rich", "Amounts that start or end in 8 are best.", "💰", "luck", [1, 6]],
    ["888", "八八八", "bā bā bā", "发发发", "fā fā fā", "triple fortune", "Believed to bring wealth and good fortune.", "🧧", "luck", [4]],
    ["66", "六六", "liù liù", "六六大顺", "liùliù dà shùn", "may everything go smoothly", "Perfect before an exam, a trip or a new job.", "🍀", "luck", [5]],
    ["666", "六六六", "liù liù liù", "顺顺顺", "shùn shùn shùn", "everything goes smoothly", "Often displayed outside shops. In chats it also means “awesome!” (see Chat).", "🛣️", "luck", [4]],
    ["168", "一六八", "yī liù bā", "一路发", "yí lù fā", "fortune all along the road", "Loved by business people.", "🚀", "luck", [4]],
    ["88", "八八", "bā bā", "拜拜", "báibái", "bye-bye", "In chat messages 88 = goodbye.", "👋", "chat", [1, 2, 3]],
    ["886", "八八六", "bā bā liù", "拜拜了", "báibái le", "bye then!", "", "👋", "chat", [3]],
    ["666", "六六六", "liù liù liù", "溜溜溜", "liū liū liū", "awesome! so skilful!", "Very common in chats and live streams.", "👍", "chat", [2, 3]],
    ["233", "二三三", "èr sān sān", "哈哈哈", "hāhāhā", "LOL – laughing", "", "😂", "chat", [2, 3]],
    ["555", "五五五", "wǔ wǔ wǔ", "呜呜呜", "wū wū wū", "boo-hoo (crying)", "", "😭", "chat", [2, 3]],
    ["918", "九一八", "jiǔ yāo bā", "加油吧", "jiāyóu ba", "go for it! you can do it!", "", "💪", "chat", [2, 3]],
    ["94", "九四", "jiǔ sì", "就是", "jiù shì", "exactly!", "", "✅", "chat", [3]],
    ["7456", "七四五六", "qī sì wǔ liù", "气死我了", "qì sǐ wǒ le", "I'm so angry!", "", "😤", "chat", [2, 3]],
    ["995", "九九五", "jiǔ jiǔ wǔ", "救救我", "jiùjiu wǒ", "help me!", "Usually a joke.", "🆘", "chat", [2, 3]],
    ["4", "四", "sì", "死", "sǐ", "death", "Never give an amount with 4 in it for a happy event.", "🚫", "warn", [1, 6]],
    ["250", "二百五", "èrbǎiwǔ", "二百五", "èrbǎiwǔ", "fool, idiot", "Never give ¥250 – it is an insult!", "🙅", "warn", [1, 2, 3]],
    ["748", "七四八", "qī sì bā", "去死吧", "qù sǐ ba", "go to hell", "Very rude – don't use it.", "🤬", "warn", [2, 3]]
  ],
  // occasions → amounts to send (¥ yuan). These are ideas built from the meanings above.
  occasions: [
    ["love", "To someone you love", "❤️", ["5.20", "13.14", "52.0", "99", "520", "1314"], "The money itself says the message: ¥5.20 = 我爱你, ¥13.14 = 一生一世. 20 May (520 Day) is the day for it."],
    ["bday", "Friend's birthday", "🎂", ["6.66", "8.88", "66", "88", "99", "168"], "Wish them a smooth (6), rich (8) and long (9) life."],
    ["wedding", "Wedding", "💍", ["600", "666", "800", "888"], "Even amounts with 6, 8 or 9 – never anything with 4."],
    ["biz", "New business or new job", "🏪", ["66", "168", "888"], "168 一路发 “fortune all along the road” is a classic business number."],
    ["exam", "Exam, trip or new start", "🍀", ["6.66", "66", "9.18"], "6 = 顺 “smooth”, and 918 = 加油吧 “go for it!”"],
    ["cny", "Spring Festival (Chinese New Year)", "🧧", ["66", "88", "168", "888"], "The money for children is 压岁钱 yāsuìqián. Even amounts, best ending in 8."],
    ["thanks", "A small thank you", "🙏", ["6.66", "8.88"], "A small amount with a nice meaning is better than a big plain one."]
  ],
  etiquette: [
    ["🧧", "红包 hóngbāo = red envelope. Red means luck and happiness, so money gifts go in red.", [6]],
    ["👐", "Give and receive with both hands. Open it later in private – not in front of the giver.", [6]],
    ["2️⃣", "Happy events: even amounts (except 4). Amounts that start or end in 8 are best; 6 and 9 are good too.", [6, 7]],
    ["🚫", "Avoid 4 (sounds like death) and 250 (means “fool”).", [1, 6]],
    ["🤍", "Funerals are different: a white (not red) envelope, and an odd amount.", [6, 7]],
    ["🎎", "At Spring Festival, children get 压岁钱 yāsuìqián – New Year money that, in the old story, keeps them safe.", [6]],
    ["📱", "Today many people send electronic red envelopes on WeChat (微信), especially to family and friends far away.", [6]]
  ],
  // idioms with numbers: [idiom, pinyin, literal, meaning]
  idioms: [
    ["一心一意", "yì xīn yí yì", "one heart, one mind", "whole-heartedly"],
    ["三心二意", "sān xīn èr yì", "three hearts, two minds", "half-hearted, can't decide"],
    ["一清二楚", "yì qīng èr chǔ", "one clear, two clear", "crystal clear"],
    ["七上八下", "qī shàng bā xià", "seven up, eight down", "nervous – heart jumping up and down"],
    ["乱七八糟", "luàn qī bā zāo", "messy seven, eight", "a total mess"],
    ["五颜六色", "wǔ yán liù sè", "five colours, six shades", "very colourful"],
    ["四面八方", "sì miàn bā fāng", "four sides, eight directions", "from everywhere"],
    ["十全十美", "shí quán shí měi", "ten complete, ten beautiful", "perfect"]
  ],
  sources: [
    ["Chinese numerology: lucky and unlucky numbers", "StudyCLI", "https://studycli.org/chinese-culture/chinese-numerology/"],
    ["Chinese Slang (number slang handout)", "Confucius Institute, University of Adelaide", "https://confucius.adelaide.edu.au/system/files/media/documents/2020-09/Chinese%20Slang_18%20September.pdf"],
    ["Chinese number slang", "LingoAce", "https://www.lingoace.com/blog/chinese-number-slang/"],
    ["Top 5 Chinese lucky number combinations", "The Chairman's Bao", "https://thechairmansbao.com/blog/lucky-numbers-chinese"],
    ["Lucky number 6", "Travel China Guide", "https://www.travelchinaguide.com/intro/lucky-number6.htm"],
    ["Red envelopes (hongbao): significance, amount and how to give", "China Highlights", "https://www.chinahighlights.com/travelguide/festivals/red-envelop.htm"],
    ["Red packets: when and how much to give", "China Simplified", "https://chinasimplified.com/2014/12/11/red-packets-understanding-when-and-how-much-to-give"],
    ["520: the Chinese love word number", "Ninchanese", "https://ninchanese.com/blog/2016/05/20/520-chinese-love-word-number/"]
  ]
};
