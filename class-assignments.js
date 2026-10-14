/* Class assignments, added by the app maker. Each one appears for every student.
   course: "c1" = Chinese 1 (Synthesis) · "c2" = Chinese 2 (Listening & Speaking) · "c3" = Chinese 3 (Characters)
   chars: characters to write [character, pinyin, meaning] · set: word list in the Write tab · sheet: printable practice sheet */
var CLASS_ASSIGNMENTS = [
  { id: "c3-2", course: "c3", n: 2, title: "Character writing 2 – 80 characters", set: "H2", sheet: "sheets/chinese3-assignment-2.pdf", times: 18,
    task: "Write each character 18 times, clearly, in your exercise book.\nFollow the correct stroke order – tap a character below to watch it and practise it first.\nAlso learn: 中文 zhōngwén (Chinese language) · 汉字 hànzì (Chinese characters) · 关心 guānxīn (to care about) · 小心 xiǎoxīn (be careful) · 生气 shēngqì (angry) · 借口 jièkǒu (excuse) · 李子 lǐzi (plum)",
    chars: [
      ["人", "rén", "person"], ["个", "gè", "a, an (measure word)"], ["大", "dà", "big, huge"], ["太", "tài", "too (太大 too big)"], ["天", "tiān", "sky, day"],
      ["关", "guān", "to close; 关心 care about"], ["云", "yún", "cloud"], ["会", "huì", "can, will; meeting"], ["女", "nǚ", "female, girl"], ["了", "le", "particle: done / change"],
      ["子", "zǐ", "son, child"], ["好", "hǎo", "good, fine"], ["尔", "ěr", "you (old Chinese)"], ["你", "nǐ", "you"], ["心", "xīn", "heart"],
      ["您", "nín", "you (polite)"], ["又", "yòu", "again"], ["双", "shuāng", "pair, double"], ["寸", "cùn", "Chinese inch (about 3.3 cm)"], ["对", "duì", "right, correct"],
      ["不", "bù", "no, not"], ["土", "tǔ", "earth, soil"], ["走", "zǒu", "to walk, to leave"], ["己", "jǐ", "self"], ["起", "qǐ", "to rise, get up"],
      ["没", "méi", "not (have)"], ["有", "yǒu", "to have"], ["系", "xì / jì", "system; to tie (jì)"], ["见", "jiàn", "to see"], ["再", "zài", "again"],
      ["身", "shēn", "body"], ["谢", "xiè", "to thank"], ["牛", "niú", "cow, ox"], ["生", "shēng", "raw; to be born; life"], ["气", "qì", "air"],
      ["各", "gè", "each"], ["客", "kè", "guest, visitor"], ["我", "wǒ", "I, me"], ["口", "kǒu", "mouth"], ["中", "zhōng", "middle, centre"],
      ["日", "rì", "sun, day"], ["目", "mù", "eye"], ["白", "bái", "white"], ["百", "bǎi", "hundred"], ["万", "wàn", "ten thousand"],
      ["学", "xué", "to learn, study"], ["字", "zì", "character, word"], ["借", "jiè", "to borrow, lend"], ["什", "shén", "什么 what"], ["么", "me", "什么 what"],
      ["叫", "jiào", "to call, shout; be called"], ["夕", "xī", "evening, sunset"], ["多", "duō", "many, a lot"], ["名", "míng", "name, fame"], ["木", "mù", "wood, tree"],
      ["林", "lín", "woods, trees"], ["森", "sēn", "forest"], ["李", "lǐ", "plum; surname Li"], ["月", "yuè", "moon, month"], ["朋", "péng", "friend"],
      ["明", "míng", "bright"], ["王", "wáng", "king"], ["玉", "yù", "jade"], ["国", "guó", "country"], ["老", "lǎo", "old"],
      ["师", "shī", "teacher, master"], ["帅", "shuài", "handsome"], ["比", "bǐ", "to compare; than"], ["冈", "gāng", "ridge, hill"], ["亚", "yà", "second; Asia"],
      ["文", "wén", "language, writing"], ["汉", "hàn", "Han (China's largest people)"], ["汗", "hàn", "sweat"], ["五", "wǔ", "five"], ["吾", "wú", "I, me (old Chinese)"],
      ["语", "yǔ", "language"], ["友", "yǒu", "friend"], ["欠", "qiàn", "to owe"], ["欢", "huān", "happy"], ["士", "shì", "scholar, soldier"],
      ["喜", "xǐ", "happy, to like"]
    ] }
];
