import sensitiveWords from "@/data/sensitive-words.json";

export const DEFAULT_TREEHOLE_TAG = "浮光";
const DEFAULT_SHORT_TAG = "絮语";
const DEFAULT_LONG_TAG = "长夜";
const TAG_MAX_LENGTH = 20;

const CATEGORY_SYNONYMS: Record<string, string[]> = {
  暗恋: ["暗恋","偷偷喜欢","不敢说","ta不知道","偷看","暗恋对象","单相思","默默关注","不敢表白","没勇气","crush","secret crush","unrequited","love from afar","notice me"],
  失恋: ["失恋","分手","被甩","被分手","结束了","走不出来","失恋了","放不下","ex","breakup","heart broken","dumped","moving on","still love","can't forget","crying over"],
  异地: ["异地","异地恋","距离","隔着屏幕","视频通话","时差","异地太难","long distance","far away","different city","ldr","timezone","video call","miss you"],
  单身: ["单身","一个人","单身狗","没人要","solo","single life","single","alone","forever alone","no boyfriend","no girlfriend","single af"],
  暧昧: ["暧昧","不清不楚","算什么","朋友以上","恋人未满","暧昧期","该不该问","situationship","more than friends","what are we","mixed signals","almost dating"],
  友情: ["友情","朋友","闺蜜","兄弟","发小","好姐妹","好朋友","走散","bff","friendship","best friend","drifted apart","old friend","bromance"],
  婚姻: ["婚姻","结婚","婚后","夫妻","老婆","老公","没话说","室友","结婚后","marriage","married","spouse","husband","wife","roommates","divorce","fight"],
  分手: ["分开","告别","和平分手","断联","删除","拉黑","结束","我提的分手","breakup","broke up","cut off","blocked","deleted","walking away"],
  考研: ["考研","研究生","二战","上岸","图书馆","备考","自习","复习","英语一","政治","数学一","grad school","master","phd","entrance exam","gre","gmat","study"],
  高考: ["高考","高三","模拟考","模考","志愿","大学","高中","文科","理科","gaokao","college entrance","high school","sat","senior year","junior"],
  留学: ["留学","出国","托福","雅思","国外","海外","异国","study abroad","international student","toefl","ielts","overseas","exchange","foreign"],
  论文: ["论文","初稿","答辩","盲审","查重","导师","改稿","thesis","dissertation","draft","defense","advisor","plagiarism","citation","peer review"],
  毕业: ["毕业","散伙饭","最后一面","各奔东西","散场","graduation","farewell","goodbye","last day","convocation","diploma","moving on"],
  加班: ["加班","996","大小周","通宵","熬夜","加班费","调休","凌晨","overtime","996","work late","all nighter","weekend work","overwork","no life"],
  辞职: ["辞职","不干了","裸辞","提离职","职业倦怠","resign","quit","put in notice","i quit","two weeks","burnout","leave job"],
  面试: ["面试","群面","hr","简历","自我介绍","offer","背调","interview","recruiter","resume","cv","offer letter","job hunt","rejection"],
  内卷: ["内卷","卷","别人不走","不敢走","拼加班","表演","rat race","competition","overachieving","hustle culture","grind","keeping up"],
  创业: ["创业","startup","创始人","合伙人","赔钱","all in","startup","founder","cofounder","bootstrap","vc","funding","pivot","failure"],
  裁员: ["裁员","被裁","n+1","赔偿金","layoff","fired","downsize","restructure","terminated","severance","let go","unemployed"],
  父母: ["父母","爸爸","妈妈","爸妈","老爸","老妈","想家","回家","parents","dad","mom","father","mother","homesick","miss home","call home"],
  催婚: ["催婚","相亲","介绍","结婚","对象","七大姑","marriage pressure","matchmaking","blind date","why single","settle down","family pressure"],
  亲子: ["孩子","带娃","当妈","当爸","育儿","单亲","parenting","raising kids","single mom","single dad","toddler","newborn","maternity"],
  原生家庭: ["原生家庭","童年","小时候","我爸","我妈","父母离异","创伤","family of origin","childhood trauma","dysfunctional","abuse","neglect","dad issues","mom issues"],
  婆媳: ["婆婆","媳妇","公公","婆家","in-laws","mother in law","daughter in law","family drama","husband's mom"],
  独居: ["独居","一个人住","一个人吃饭","一个人生活","living alone","by myself","one person household","solo living","alone at home"],
  宠物: ["宠物","猫","狗","养猫","养狗","主子","毛孩子","pet","cat","dog","kitten","puppy","fur baby","my cat","my dog"],
  美食: ["美食","好吃的","做饭","外卖","泡面","深夜食堂","comfort food","cook","cooking","instant noodles","takeout","hungry"],
  旅行: ["旅行","旅游","洱海","丽江","一个人去","travel","trip","vacation","getaway","wanderlust","backpack","solo travel"],
  失眠: ["失眠","睡不着","凌晨","褪黑素","熬夜","insomnia","can't sleep","awake","3am","melatonin","sleep deprived","tossing"],
  租房: ["租房","房东","房租","涨价","室友","rent","landlord","apartment","lease","roommate","renting","deposit"],
  搬家: ["搬家","搬走","打包","收拾行李","换城市","moved","moving","packing","new place","relocate","moving out"],
  焦虑: ["焦虑","心慌","胸闷","喘不过气","紧张","anxiety","anxious","panic","chest tight","worried","overthinking","nervous","racing heart"],
  抑郁: ["抑郁","低落","没意思","不想动","没感觉","depression","depressed","numb","empty","no energy","can't feel","hopeless"],
  孤独: ["孤独","寂寞","没人","一个人","alone","lonely","isolated","no one","nobody","solitude","invisible"],
  迷茫: ["迷茫","不知道","未来","怎么办","lost","don't know","no direction","quarter life","mid life","purpose","meaning","stuck"],
  治愈: ["治愈","好起来","慢慢来","会好的","healing","getting better","recovery","self care","therapist","journal","progress","small wins"],
  自卑: ["自卑","不够好","配不上","丑","不自信","insecure","not good enough","ugly","self hate","confidence","self doubt","imposter"],
  疾病: ["生病","癌症","肿瘤","手术","体检","illness","cancer","disease","diagnosed","sick","hospital","surgery","chronic"],
  生死: ["去世","走了","不在","失去","最后一面","death","passed away","gone","funeral","grief","lost someone","never said goodbye"],
  负债: ["负债","欠债","花呗","借呗","信用卡","欠钱","debt","owe","credit card","loan","broke","overdraft","paying off","drowning"],
};

function normalizeInput(text: string): string {
  return text.trim().toLowerCase();
}

function removeSeparators(text: string): string {
  return text.replace(/[\s\-_.·]/g, "");
}

export function isTagAllowed(input: string): boolean {
  const raw = input.trim();
  if (!raw) return false;
  if (raw.length > TAG_MAX_LENGTH) return false;
  const normalized = removeSeparators(normalizeInput(raw));
  if (!normalized) return false;
  if (!/^[A-Za-z0-9\u4e00-\u9fff]+$/.test(normalized)) return false;
  for (const word of sensitiveWords.words) {
    const key = removeSeparators(normalizeInput(word));
    if (key && normalized.includes(key)) return false;
  }
  return true;
}

export function normalizeTag(input: string): string {
  const cleaned = normalizeInput(input).replace(/^#/, "");
  if (!cleaned) return "";
  for (const [category, keywords] of Object.entries(CATEGORY_SYNONYMS)) {
    for (const keyword of keywords) {
      const key = normalizeInput(keyword);
      if (cleaned === key || cleaned.includes(key)) {
        return category;
      }
    }
  }
  return input.trim();
}

export function getDefaultTagForContent(content: string): string {
  const len = content.trim().length;
  if (len <= 30) return DEFAULT_SHORT_TAG;
  if (len >= 180) return DEFAULT_LONG_TAG;
  return DEFAULT_TREEHOLE_TAG;
}

export function getParentTag(tag: string): string | null {
  const parts = tag.split("·");
  if (parts.length >= 2 && parts[0].trim()) return parts[0].trim();
  return null;
}

export function detectLanguage(content: string): "zh" | "en" {
  const text = content.trim();
  if (!text) return "zh";
  const cjkRegex = /[\u4e00-\u9fff\u3400-\u4dbf\uff00-\uffef]/g;
  const cjkMatches = text.match(cjkRegex);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;
  const ratio = cjkCount / text.length;
  return ratio > 0.15 ? "zh" : "en";
}

export function classifyPost(content: string): string | null {
  const normalizedContent = normalizeInput(content);
  const scores: Record<string, number> = {};

  for (const [category, keywords] of Object.entries(CATEGORY_SYNONYMS)) {
    let score = 0;
    for (const keyword of keywords) {
      const key = normalizeInput(keyword);
      if (key && normalizedContent.includes(key)) {
        score++;
      }
    }
    if (score > 0) {
      scores[category] = score;
    }
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : null;
}
