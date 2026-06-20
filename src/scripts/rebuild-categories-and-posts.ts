// Rebuild: delete old categories, create 40 new ones, seed 80 heartfelt posts.
import "dotenv/config";

// ─── 40 CATEGORIES ────────────────────────────────────────────
const CATEGORIES: { name: string; en: string; description: string; icon: string; sortOrder: number }[] = [
  // 💕 情感世界
  { name: "暗恋", en: "Secret Crush", description: "不敢说出口的喜欢，藏在心底的名字", icon: "💌", sortOrder: 1 },
  { name: "失恋", en: "Heartbreak", description: "曾经那么近的人，如今远在天边", icon: "💔", sortOrder: 2 },
  { name: "异地", en: "Long Distance", description: "隔着屏幕说爱你，隔着山海想念你", icon: "🌏", sortOrder: 3 },
  { name: "单身", en: "Being Single", description: "一个人也很好，但偶尔也想有人陪", icon: "🧍", sortOrder: 4 },
  { name: "暧昧", en: "Situationship", description: "友达以上恋人未满，猜来猜去的疲惫", icon: "🫧", sortOrder: 5 },
  { name: "友情", en: "Friendship", description: "那些走散的朋友，那些不变的陪伴", icon: "🤝", sortOrder: 6 },
  { name: "婚姻", en: "Marriage", description: "围城内外，柴米油盐里的爱与倦", icon: "💍", sortOrder: 7 },
  { name: "分手", en: "Breakup", description: "说再见的那一刻，心里下起了大雨", icon: "🌧️", sortOrder: 8 },

  // 📚 求学成长
  { name: "考研", en: "Grad Exam", description: "一个人一支笔，一个图书馆一个未来", icon: "📖", sortOrder: 9 },
  { name: "高考", en: "Gaokao", description: "那场决定了太多东西的考试，和回不去的青春", icon: "✏️", sortOrder: 10 },
  { name: "留学", en: "Study Abroad", description: "异国他乡的孤独、成长与自我发现", icon: "✈️", sortOrder: 11 },
  { name: "论文", en: "Thesis", description: "deadline前的崩溃、导师的已读不回", icon: "📝", sortOrder: 12 },
  { name: "毕业", en: "Graduation", description: "散伙饭吃了一顿又一顿，青春就这么散了", icon: "🎓", sortOrder: 13 },

  // 💼 职场浮沉
  { name: "加班", en: "Overtime", description: "凌晨的办公楼，只有自己和屏幕亮着", icon: "🌙", sortOrder: 14 },
  { name: "辞职", en: "Resignation", description: "终于递了那封信，心里空落落的", icon: "🚪", sortOrder: 15 },
  { name: "面试", en: "Job Interview", description: "自我介绍说到麻木，等通知等到焦虑", icon: "💬", sortOrder: 16 },
  { name: "内卷", en: "Rat Race", description: "大家都在跑，我不敢停下来", icon: "🏃", sortOrder: 17 },
  { name: "创业", en: "Startup", description: "九死一生的路上，一个人扛着所有", icon: "🚀", sortOrder: 18 },
  { name: "裁员", en: "Layoff", description: "昨天还在开会，今天工位就空了", icon: "📦", sortOrder: 19 },

  // 🏠 家庭港湾
  { name: "父母", en: "Parents", description: "他们的白发越来越多，我离家越来越远", icon: "👨‍👩‍👧", sortOrder: 20 },
  { name: "催婚", en: "Marriage Push", description: "过年回家最怕的那句话：有对象了吗", icon: "⏰", sortOrder: 21 },
  { name: "亲子", en: "Parenting", description: "为人父母方知父母恩，鸡飞狗跳中的爱", icon: "🍼", sortOrder: 22 },
  { name: "原生家庭", en: "Family Origin", description: "那些童年留下的印记，要用一生去和解", icon: "🏚️", sortOrder: 23 },
  { name: "婆媳", en: "In-Laws", description: "两个女人爱着同一个男人，相处却那么难", icon: "🏡", sortOrder: 24 },

  // 🌿 日常烟火
  { name: "独居", en: "Living Alone", description: "一个人吃饭一个人逛街一个人生病", icon: "🏠", sortOrder: 25 },
  { name: "宠物", en: "Pets", description: "毛孩子不会说话，但什么都懂", icon: "🐾", sortOrder: 26 },
  { name: "美食", en: "Food", description: "吃到好吃的那一刻，觉得活着真好", icon: "🍜", sortOrder: 27 },
  { name: "旅行", en: "Travel", description: "换个地方看看人间，也看看自己", icon: "🗺️", sortOrder: 28 },
  { name: "失眠", en: "Insomnia", description: "凌晨三点，全世界都睡了只有自己醒着", icon: "🕯️", sortOrder: 29 },
  { name: "租房", en: "Renting", description: "在这个城市里找一盏属于自己的灯", icon: "🔑", sortOrder: 30 },
  { name: "搬家", en: "Moving", description: "打包的不只是行李，还有一段生活", icon: "📦", sortOrder: 31 },

  // 💭 情绪心绪
  { name: "焦虑", en: "Anxiety", description: "心跳加速呼吸急促，说不清在害怕什么", icon: "😰", sortOrder: 32 },
  { name: "抑郁", en: "Depression", description: "不是不开心，是感受不到任何情绪", icon: "🌫️", sortOrder: 33 },
  { name: "孤独", en: "Loneliness", description: "人群中的孤独，比一个人的孤独更难熬", icon: "🌌", sortOrder: 34 },
  { name: "迷茫", en: "Feeling Lost", description: "站在十字路口，不知道该往哪走", icon: "🧭", sortOrder: 35 },
  { name: "治愈", en: "Healing", description: "那些让你重新相信世界美好的瞬间", icon: "✨", sortOrder: 36 },
  { name: "自卑", en: "Insecurity", description: "总觉得自己不够好，不值得被爱", icon: "🪞", sortOrder: 37 },

  // 🌑 人生底色
  { name: "疾病", en: "Illness", description: "和身体里的敌人战斗，每一天都是勇士", icon: "🏥", sortOrder: 38 },
  { name: "生死", en: "Life & Death", description: "有些人说了再见，就真的再也见不到了", icon: "🕊️", sortOrder: 39 },
  { name: "负债", en: "Debt", description: "被数字压得喘不过气，但还在努力上岸", icon: "🪙", sortOrder: 40 },
];

// ─── 80 HEARTFELT POSTS (40 CN + 40 EN) ──────────────────────
const POSTS: { category: string; zh: string; en: string }[] = [
  // 1. 暗恋
  { category: "暗恋", zh: "每次在食堂碰到你，我都会故意排在你不排的那一队。怕被你发现我在看你，更怕你根本不知道我在看你。室友说我怂，我说你不懂。你不懂暗恋一个人的时候，连对视都像在偷东西。", en: "I always pick the opposite line at the cafeteria so you won't catch me staring. My roommate calls me a coward. Maybe I am. But when you have a crush on someone, even eye contact feels like stealing." },
  // 2. 失恋
  { category: "失恋", zh: "昨晚路过那家我们一起吃过的烧烤摊，老板娘还问我怎么好久没来了。我说最近忙。其实我不忙，我只是一个人来这里会想起你坐在对面帮我剥蒜的样子，然后眼泪就止不住了。", en: "Walked past our old BBQ spot last night. The owner asked why she hasn't seen us lately. I said I've been busy. Truth is, I can't sit there alone without seeing you peel garlic for me across the table. Then the tears just come." },
  // 3. 异地
  { category: "异地", zh: "今天视频的时候你那边在下雨，你举着手机给我看窗外的雨。我突然好想穿过屏幕去给你送把伞。异地最大的敌人不是距离，是每一个需要你的时刻你都不在。但我们说好了，熬过去就结婚。", en: "It was raining on your side during our video call today. You held up the phone to show me. I wanted to reach through the screen and bring you an umbrella. Long distance isn't about miles — it's about every moment I need you and you're not there. But we promised: get through this, then get married." },
  // 4. 单身
  { category: "单身", zh: "闺蜜今天又脱单了，群里发了一串红包。我抢了最大的那个，然后默默关掉了朋友圈。不是嫉妒，就是突然觉得，什么时候轮到我呢。一个人吃火锅被服务员用同情的眼光看，我真的不需要同情。", en: "My bestie got a boyfriend today. The group chat exploded with red packets. I grabbed the biggest one, then silently closed WeChat Moments. Not jealous — just wondering when it'll be my turn. I've gotten used to the pitying looks from waiters when I eat hotpot alone. I don't need pity." },
  // 5. 暧昧
  { category: "暧昧", zh: "你每天跟我说早安晚安，生病了比我还紧张，看电影的时候手就放在我手边——可是你从来没说过喜欢我。朋友问我你们是不是在一起了，我说不知道。暧昧最大的残忍是，你给了我所有恋爱的感觉，却从来不给我身份。", en: "You text me good morning and good night every day. You worry more than I do when I'm sick. At the movies, your hand rests inches from mine — but you've never said you like me. My friends ask if we're together and I say I don't know. The cruelty of a situationship is you give me every feeling of love without ever giving me a name." },
  // 6. 友情
  { category: "友情", zh: "翻手机相册翻到三年前的截图，是她的聊天记录。我们曾经每天聊到凌晨，现在对话框里最后一条是半年前的'好的'。没有吵架没有误会，就是各自奔向了不同的生活。成年人的友情，散了都不需要理由。", en: "Scrolling through old photos and found a screenshot of our chat from three years ago. We used to talk until 3am every night. Now the last message is a six-month-old 'ok.' No fight, no falling out — just two lives drifting in different directions. Adult friendships don't need a reason to fade." },
  // 7. 婚姻
  { category: "婚姻", zh: "结婚五年，昨晚因为谁洗碗又吵了一架。他摔门去了书房，我一个人在厨房把碗洗完了，眼泪滴在洗洁精泡沫里。早上起来发现他给我煎了蛋放在桌上，旁边压了张纸条：'对不起。'这就是婚姻吧，吵完架还会给你煎蛋的人。", en: "Five years married. Last night we fought about dishes — again. He slammed the study door. I stood at the sink finishing the dishes alone, tears falling into the soap bubbles. This morning I found a fried egg on the table with a note: 'Sorry.' I guess that's marriage. The person who still makes you eggs after a fight." },
  // 8. 分手
  { category: "分手", zh: "你发了两年的'晚安'，昨天换成了'我们分手吧'。我没有挽留，回了一个'好'。其实我想打一千个字问你为什么，但我忍住了。成年人的体面是，你不想继续了我就不纠缠。只是今晚的枕头又要湿了。", en: "For two years you texted me 'good night.' Yesterday it changed to 'let's break up.' I didn't beg. I just replied 'ok.' I wanted to write a thousand words asking why, but I held back. Dignity in adulthood means not chasing someone who wants to leave. But my pillow will be wet again tonight." },

  // 9. 考研
  { category: "考研", zh: "倒计时 42 天。今天做英语阅读又错了 5 个，政治大题背了三遍还是忘。去食堂的路上看到一个男生边走边哭，我想去安慰他，但自己也快绷不住了。这条路太孤独了，可我必须走完。", en: "42 days left. Got 5 wrong on English reading today. Memorized the politics essays three times and still blanked. On the way to the cafeteria I saw a guy walking and crying. I wanted to comfort him but I'm barely holding it together myself. This road is so lonely. But I have to finish it." },
  // 10. 高考
  { category: "高考", zh: "还有两个月就高考了。妈妈每天给我炖汤送到学校，爸爸戒了烟说怕影响我。他们越是这样我越怕考砸。昨晚做了一个梦，梦到成绩出来妈妈在哭。醒来枕头是湿的，才早上五点。", en: "Two months until gaokao. Mom brings me soup at school every day. Dad quit smoking, says he doesn't want to affect me. The more they do this, the more terrified I am of failing. Last night I dreamed my scores came out and Mom was crying. Woke up at 5am, pillow wet." },
  // 11. 留学
  { category: "留学", zh: "来美国的第三个月，发烧到 39 度，在出租屋里一个人裹着被子发抖。不敢告诉爸妈，怕他们隔着太平洋干着急。自己打车去急诊，用蹩脚的英语描述症状。那一刻突然理解了什么叫'报喜不报忧'。", en: "Third month in the US. Fever of 102, shivering alone under my blanket in a rented room. Didn't tell my parents — what can they do from across the Pacific? Took an Uber to the ER, describing my symptoms in broken English. That's when I truly understood what it means to only share the good news." },
  // 12. 论文
  { category: "论文", zh: "导师又已读不回了，我的开题报告改了第八稿。室友都睡了，我一个人对着满屏的红色批注发呆。突然很想退学，但想想已经走到这一步了，咬咬牙继续改吧。窗外天快亮了。", en: "My advisor left me on read again. Draft eight of my thesis proposal. Roommates are all asleep, I'm staring at a screen full of red comments. Suddenly I want to drop out. But I've come this far. Grit my teeth and keep editing. The sky outside is starting to lighten." },
  // 13. 毕业
  { category: "毕业", zh: "今天拍了毕业照，大家笑得很灿烂。回到宿舍开始收拾东西，翻到大一报到时的照片，那时候觉得四年好长啊。现在才发现，青春这东西，过的时候没感觉，回头看全是舍不得。明天宿舍就空了。", en: "Took graduation photos today. Everyone smiling so bright. Back in the dorm, packing up four years of stuff. Found a photo from freshman move-in day — back then four years felt endless. Now I know: youth never feels like anything while you're in it. Only when you look back. Tomorrow the dorm will be empty." },

  // 14. 加班
  { category: "加班", zh: "连续加班第十一天，今天月经来了疼到直不起腰。主管在群里说今晚继续。我吃了两颗布洛芬，继续改方案。不是不想反抗，是怕反抗了连这份工作都没了。这个城市里，谁不是拿命换钱呢。", en: "Eleventh straight day of overtime. Got my period today, cramps so bad I couldn't stand straight. Manager messaged the group: we push through tonight. Took two ibuprofen and kept editing the proposal. It's not that I don't want to fight back — I'm afraid if I do, I'll lose even this job. In this city, who isn't trading their health for rent?" },
  // 15. 辞职
  { category: "辞职", zh: "今天提了辞职。领导问我为什么，我说想休息一段时间。其实真正的原因我写在日记本里了：我恨这个格子间。三年了，我变成了自己最讨厌的那种人——对生活毫无热情。趁还没完全死掉，我先逃了。", en: "Handed in my resignation today. Boss asked why. I said I need a break. The real reason is in my journal: I hate this cubicle. Three years and I've become the person I hated most — someone with zero passion for life. Before I die completely inside, I'm escaping." },
  // 16. 面试
  { category: "面试", zh: "这个月已经面试了七家了。每次都说'回去等通知'，然后就没有然后了。今天的面完在地铁站坐了很久，看人来人往，突然怀疑自己是不是真的很差。一个陌生人递了张纸巾给我，我才发现自己哭了。", en: "Seven interviews this month. Every time: 'We'll let you know.' Then nothing. After today's interview I sat in the subway station for an hour, watching people rush past. Started wondering if I'm really that unqualified. A stranger handed me a tissue. I didn't even realize I was crying." },
  // 17. 内卷
  { category: "内卷", zh: "同事周六都在加班，我不敢走。其实我的工作早就做完了，但我不敢先走。这个办公室像一个无声的竞技场，每个人都在假装很忙。我好累，但更怕被淘汰。什么时候我们可以不必这样活着。", en: "All my coworkers work Saturdays so I can't leave either. My tasks are done, but I don't dare be the first one out. This office is a silent arena where everyone pretends to be busy. I'm exhausted — but more afraid of being eliminated. When do we get to stop living like this?" },
  // 18. 创业
  { category: "创业", zh: "公司账上还剩三个月的现金流。投资人说下周给答复，但这话他上个月也说过。不敢跟团队说实情，每天还要笑着给大家打鸡血。回家我妈问我最近怎么样，我说挺好的。其实挺好的，至少还没放弃。", en: "Three months of runway left. Investor said he'd get back to us next week — same thing he said last month. Can't tell the team the truth. Every day I rally them with fake optimism. Mom asks how it's going, I say fine. Actually, it IS fine. At least I haven't given up yet." },
  // 19. 裁员
  { category: "裁员", zh: "今天公司裁了 30 个人，我旁边的工位空了。他走的时候抱了一个纸箱，跟我说'江湖再见'。我们相处了两年，我连他微信都没有。这个职场教会我的第一件事：别把同事当朋友，离别来得比你想象的快。", en: "Company laid off 30 people today. The desk next to mine is empty. He left with a cardboard box and said 'see you around the jungle.' We sat next to each other for two years — I don't even have his WeChat. First lesson the workplace taught me: don't mistake colleagues for friends. Goodbye comes faster than you think." },

  // 20. 父母
  { category: "父母", zh: "今天和妈妈视频，发现她染了黑发，但发根已经白了。她笑着说这样看起来精神。我突然意识到，我在外面漂泊的这些年，他们在以我注意不到的速度变老。挂了电话哭了很久。", en: "Video called Mom today. Noticed she'd dyed her hair black — but the roots were white. She smiled and said it makes her look younger. It hit me: all these years I've been away, they've been aging at a speed I never noticed. Cried for a long time after hanging up." },
  // 21. 催婚
  { category: "催婚", zh: "过年回家第七天，我妈安排了第三场相亲。我说不想去，她说'你都快三十了，再不找就没人要了'。我很想反驳，但看到她鬓角的白发又把话咽下去了。他们那个年代的人，大概觉得不结婚就是不幸吧。", en: "Seventh day home for New Year. Mom arranged my third blind date. I said I don't want to go. She said 'you're almost thirty, no one will want you soon.' I wanted to argue, but seeing her grey temples, I swallowed my words. People of her generation truly believe being unmarried equals unhappiness." },
  // 22. 亲子
  { category: "亲子", zh: "今天对儿子发了很大的火，因为他把牛奶洒在了我刚拖的地上。他哭着说'妈妈对不起'，那个小表情让我心都碎了。我蹲下来抱住他，跟他说该说对不起的是妈妈。当妈才知道，控制情绪比熬夜喂奶难多了。", en: "Lost my temper at my son today because he spilled milk on the floor I just mopped. He cried and said 'sorry Mommy' — that little face shattered me. I knelt down and hugged him, told him I'm the one who should say sorry. Being a mom teaches you: controlling your temper is harder than all the sleepless nights." },
  // 23. 原生家庭
  { category: "原生家庭", zh: "今天和伴侣吵架，我摔了一个杯子。然后突然愣住了——那是我爸的动作。我用了二十年告诉自己不要成为他，但那些潜移默化的东西早就刻进了骨头里。对不起，我会努力改。", en: "Fought with my partner today. I threw a cup. Then I froze — that's my father's move. I spent twenty years telling myself I'd never be like him, but those patterns are carved into my bones. I'm sorry. I'll keep trying to be better." },
  // 24. 婆媳
  { category: "婆媳", zh: "婆婆今天又说我做饭太咸了，对儿子身体不好。我笑着说下次注意。回房间关上门，眼泪就掉下来了。不是因为她这句话，是因为我老公就在旁边，从头到尾一句话都没说。", en: "Mother-in-law told me again today that my cooking is too salty, bad for her son's health. I smiled and said I'll do better next time. Went back to my room, closed the door, and the tears came. Not because of what she said — but because my husband was right there the whole time and said absolutely nothing." },

  // 25. 独居
  { category: "独居", zh: "今天发烧到 38 度，自己烧了壶水放在床头。想叫个外卖粥，翻了半天也没有单人份的。最后自己爬起来煮了碗泡面。独居第三年，最怕的不是孤独，是生病。", en: "Fever of 100.4 today. Boiled myself a kettle of water and put it by the bed. Wanted to order congee delivery but nowhere sells single portions. Ended up dragging myself out of bed to make instant noodles. Three years living alone. It's not loneliness I fear — it's getting sick." },
  // 26. 宠物
  { category: "宠物", zh: "我的猫咪今天趴在我胸口，用它的小脑袋蹭我的下巴。它不知道我今天被领导骂了，不知道我在地铁上被人推了。它只知道我回来了，它想我了。有时候觉得不是我养它，是它在养我。", en: "My cat curled up on my chest today, rubbing her little head against my chin. She doesn't know my boss yelled at me. Doesn't know someone shoved me on the subway. She only knows I'm home and she missed me. Sometimes I think I'm not the one taking care of her — she's taking care of me." },
  // 27. 美食
  { category: "美食", zh: "今天下班绕路去了那家藏在巷子里的面馆，老板还是老样子，多给我加了一勺肉臊子。咬下第一口的时候眼眶突然热了——这是我来这座城市吃到的第一顿饭的味道。七年了，只有这碗面没变。", en: "Took a detour after work to the noodle joint hidden in the alley. The owner, same as always, scooped an extra ladle of meat sauce into my bowl. First bite and my eyes welled up — this was the first meal I ever ate in this city. Seven years. Only this bowl of noodles has stayed the same." },
  // 28. 旅行
  { category: "旅行", zh: "一个人去了大理。在洱海边坐了一整个下午，看云从苍山那边飘过来又飘走。旁边的情侣在拍照，我一个人给自己拍了张影子。挺好的，和自己相处这门课，我终于开始及格了。", en: "Traveled to Dali alone. Sat by Erhai Lake for an entire afternoon, watching clouds drift over Cangshan and away. Couples were taking photos next to me. I took a picture of my own shadow. It's fine. I'm finally starting to pass the class on being alone with myself." },
  // 29. 失眠
  { category: "失眠", zh: "又失眠了，凌晨两点四十三分。窗外有鸟在叫，不知道是没睡还是醒了。刷了一遍朋友圈，所有人都过得很好。只有我躺在这个城市的角落里，睁着眼睛等天亮。明天还要上班，但我睡不着。", en: "Can't sleep again. 2:43am. A bird is singing outside — can't tell if it hasn't slept or just woke up. Scrolled through every social feed. Everyone seems to be living their best life. And here I am, lying in a corner of this city, eyes wide open waiting for dawn. Work tomorrow. But I can't sleep." },
  // 30. 租房
  { category: "租房", zh: "房东说下个月涨五百。这意味着我每个月要多加十几个小时的班。在这座城市里，房东才是最了解通货膨胀的人。我开始怀疑，我到底是在为自己活，还是在为房租活。", en: "Landlord says rent goes up 500 next month. That's a dozen more overtime hours I have to work. In this city, landlords understand inflation better than anyone. Starting to wonder — am I living for myself, or am I living for rent?" },
  // 31. 搬家
  { category: "搬家", zh: "第五次搬家了。打包的时候翻出好多东西：上次搬家没拆封的箱子、三年前朋友送的生日礼物、一封写了没寄出去的信。每搬一次家就像一次小型死亡，扔掉一些过去，带着剩下的继续漂泊。", en: "Fifth move. Packing, I found so many things: a box from the last move I never unpacked, a birthday gift from a friend three years ago, a letter I wrote but never sent. Every move feels like a small death — throwing away pieces of the past, carrying what's left into the next unknown." },

  // 32. 焦虑
  { category: "焦虑", zh: "下午开会的时候突然心跳加速手心出汗，感觉周围的声音都在变远。我跟同事说去趟洗手间，然后在隔间里坐了二十分钟。不是第一次了，但每次都觉得是不是要死了。医生说只是焦虑症。只是。", en: "Heart started racing during the afternoon meeting. Palms sweaty, sounds fading into the distance. Told my coworker I needed the restroom, then sat in a stall for twenty minutes. Not the first time. Every time I think I'm dying. Doctor says it's just anxiety. Just." },
  // 33. 抑郁
  { category: "抑郁", zh: "今天天气很好，阳光照进房间暖洋洋的。所有人都说这样的天气应该开心，但我躺在床上动不了。不是懒，是真的没有力气把自己从床上拔起来。吃了药会好一点，但'好一点'也只是从海底往上游了一米。", en: "Beautiful day today. Sunlight warming up the room. Everyone says you should be happy on a day like this. But I'm lying in bed, unable to move. Not lazy — genuinely don't have the strength to pull myself up. The meds help a little. But 'a little' just means I've swum up one meter from the ocean floor." },
  // 34. 孤独
  { category: "孤独", zh: "今天在便利店买了一个饭团和一瓶牛奶。收银员说了句'欢迎光临'，我差点哭了。那是今天唯一一个和我说话的人。回到出租屋打开综艺节目当背景音，假装这个房间里不止我一个人。", en: "Bought a rice ball and milk at the convenience store. The cashier said 'welcome' and I almost cried. She was the only person who spoke to me today. Got home, turned on a variety show for background noise. Pretending there's more than just me in this room." },
  // 35. 迷茫
  { category: "迷茫", zh: "今年二十五岁，换了三份工作，还是不知道自己喜欢什么。同学群里有人买了房有人结了婚，我在这个城市的出租屋里对着墙壁发呆。大人们说二十多岁是最好的年纪，但为什么我觉得自己像被困在一团雾里。", en: "Twenty-five years old, three jobs down, still don't know what I actually want. My classmates are buying houses and getting married. I'm in my rented room staring at a wall. Adults say your twenties are the best years. So why do I feel trapped in fog?" },
  // 36. 治愈
  { category: "治愈", zh: "今天在公园看到一个老爷爷推着轮椅上的老奶奶看花。她手指了指一朵红色的，他就停下来让她慢慢看。阳光落在他们花白的头发上。我突然觉得，也许生活没那么糟，也许爱情真的存在。", en: "In the park today I saw an old man pushing his wife in a wheelchair to look at flowers. She pointed at a red one and he stopped so she could take her time. Sunlight fell on their white hair. I suddenly felt — maybe life isn't so bad. Maybe love is real." },
  // 37. 自卑
  { category: "自卑", zh: "今天团建，大家轮流说自己最大的优点。轮到我的时候我说'我比较细心'。其实我想说的是我觉得自己一无是处。从小到大，没有人告诉过我'你很棒'，所以我活成了一个永远觉得自己不够好的人。", en: "Team building today. We each had to say our greatest strength. When it was my turn I said 'I'm detail-oriented.' What I really wanted to say: I feel worthless. Growing up, no one ever told me 'you're great.' So I became someone who will never believe they're enough." },

  // 38. 疾病
  { category: "疾病", zh: "确诊那天我没有哭，还反过来安慰我妈说没什么大不了的。真正崩溃是化疗后第一次在镜子里看到自己光头的那天。我对着镜子站了很久，然后戴上假发去楼下面馆吃了碗面。活着，就是好好吃每一顿饭。", en: "Didn't cry the day I got diagnosed. Even comforted my mom, told her it's no big deal. The real breakdown came after chemo, the first time I saw my bald head in the mirror. Stood there for a long time. Then put on my wig, went downstairs, and ate a bowl of noodles. Living means savoring every single meal." },
  // 39. 生死
  { category: "生死", zh: "奶奶走的那天我在外地出差，赶回去的时候她已经不在了。妈妈说奶奶最后一直在问'小杰到了没有'。我跪在灵前哭到说不出话。这一年我升职了加薪了，有什么用呢。她再也看不到了。", en: "Grandma passed while I was on a business trip. By the time I got back, she was gone. Mom said her last words kept asking 'has Xiao Jie arrived yet?' I knelt before her spirit tablet, crying until I couldn't speak. This year I got promoted, got a raise. What's the point? She'll never know." },
  // 40. 负债
  { category: "负债", zh: "今天把最后一笔网贷还清了。截图保存，看了很久。两年前投资失败欠了三十万，不敢告诉任何人，每天吃泡面省钱还款。现在终于上岸了。想把这段经历说出来，但不知道该告诉谁。就在这里说吧，和过去的自己说声辛苦了。", en: "Paid off the last online loan today. Took a screenshot, stared at it for a long time. Two years ago a failed investment left me 300k in debt. Told no one. Lived on instant noodles to save every yuan. Finally free. I want to tell someone, but don't know who. So I'll say it here: to my past self — you worked so hard." },
];

// ─── RUN ───────────────────────────────────────────────────────
const ZH_ADJ = ["快乐的","孤独的","温柔的","迷糊的","机智的","懒洋洋的","勇敢的","害羞的","神秘的","呆萌的","忧郁的","认真的","天真的","佛系的","社恐的","元气满满的","高冷的","话痨的","暖心的","安静的第"];
const ZH_ANIMAL = ["柴犬","橘猫","兔子","仓鼠","柯基","熊猫","海豚","猫头鹰","刺猬","企鹅","树懒","水獭","松鼠","考拉","小鹿","海豹","龙猫","鹦鹉","金毛","布偶猫"];
const EN_ADJ = ["Happy","Lonely","Gentle","Sleepy","Witty","Shy","Brave","Cozy","Wild","Lucky","Funny","Dreamy","Sunny","Kind","Sweet","Quiet","Stormy","Warm","Fancy","Silly"];
const EN_ANIMAL = ["Panda","Fox","Owl","Raccoon","Hedgehog","Dolphin","Penguin","Squirrel","Koala","Bunny","Wolf","Deer","Otter","Bear","Robin","Turtle","Bee","Moose","Corgi","Puffin"];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function nickZh() { return rand(ZH_ADJ) + rand(ZH_ANIMAL); }
function nickEn() { return rand(EN_ADJ) + rand(EN_ANIMAL); }
function daysAgo(d: number) { return new Date(Date.now() - d * 864e5); }

async function main() {
  const { prisma } = await import("../lib/prisma");

  // 1. Wipe old categories
  const deletedCats = await prisma.category.deleteMany();
  console.log(`🗑️  Deleted ${deletedCats.count} old categories`);

  // 2. Create 40 new categories
  for (const cat of CATEGORIES) {
    await prisma.category.create({ data: cat });
  }
  const created = await prisma.category.findMany({ select: { id: true, name: true } });
  const catMap = new Map(created.map(c => [c.name, c.id]));
  console.log(`📂 Created ${created.length} categories`);

  // 3. Seed 80 posts
  let total = 0;
  for (const p of POSTS) {
    const catId = catMap.get(p.category);
    if (!catId) { console.warn(`⚠ Unknown category: ${p.category}`); continue; }

    await prisma.post.create({
      data: {
        userId: null,
        nickname: nickZh(),
        content: p.zh,
        isEncrypted: false,
        language: "zh",
        categoryId: catId,
        isHidden: false,
        createdAt: daysAgo(total + 3),
        tags: { create: { tag: p.category } },
      },
    });
    total++;

    await prisma.post.create({
      data: {
        userId: null,
        nickname: nickEn(),
        content: p.en,
        isEncrypted: false,
        language: "en",
        categoryId: catId,
        isHidden: false,
        createdAt: daysAgo(total + 3),
        tags: { create: { tag: p.category } },
      },
    });
    total++;
  }

  console.log(`✅ Seeded ${total} posts (${POSTS.length} categories × 2 languages)`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
