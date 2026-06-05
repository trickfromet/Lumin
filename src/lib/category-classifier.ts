import sensitiveWords from "@/data/sensitive-words.json";

export const DEFAULT_TREEHOLE_TAG = "拾遗";
const DEFAULT_SHORT_TAG = "碎语";
const DEFAULT_LONG_TAG = "长卷";
const TAG_MAX_LENGTH = 20;

const CATEGORY_SYNONYMS: Record<string, string[]> = {
  心弦: [
    "喜欢",
    "暗恋",
    "分手",
    "恋爱",
    "爱情",
    "失恋",
    "表白",
    "心动",
    "想念",
    "前任",
    "出轨",
    "渣男",
    "渣女",
    "暧昧",
    "单身",
    "crush",
    "暧昧期",
    // English
    "love",
    "crush",
    "heartbreak",
    "dating",
    "relationship",
    "ex",
    "confession",
    "breakup",
    "single",
    "miss you",
    "in love",
    "romance",
    "feelings",
    "valentine",
  ],
  求索: [
    "考试",
    "考研",
    "论文",
    "毕业",
    "大学",
    "高中",
    "成绩",
    "挂科",
    "奖学金",
    "导师",
    "作业",
    "课",
    "学习",
    "高考",
    "保研",
    "绩点",
    // English
    "exam",
    "study",
    "college",
    "university",
    "graduate",
    "thesis",
    "research",
    "class",
    "homework",
    "scholarship",
    "professor",
    "learning",
    "school",
    "student",
    "semester",
    "degree",
  ],
  尘网: [
    "工作",
    "加班",
    "辞职",
    "面试",
    "老板",
    "同事",
    "工资",
    "offer",
    "职场",
    "被裁",
    "内卷",
    "996",
    "摸鱼",
    "降薪",
    "KPI",
    // English
    "work",
    "job",
    "career",
    "boss",
    "colleague",
    "salary",
    "paycheck",
    "overtime",
    "interview",
    "resign",
    "fired",
    "layoff",
    "promotion",
    "meeting",
    "deadline",
    "office",
    "startup",
  ],
  屋檐: [
    "父母",
    "家人",
    "家庭",
    "妈妈",
    "爸爸",
    "原生家庭",
    "吵架",
    "催婚",
    "亲戚",
    "过年",
    "家里",
    // English
    "family",
    "mom",
    "dad",
    "mother",
    "father",
    "parent",
    "home",
    "sibling",
    "brother",
    "sister",
    "childhood",
    "marriage",
    "relative",
    "grew up",
    "house",
  ],
  浮生: [
    "生活",
    "租房",
    "搬家",
    "独居",
    "做饭",
    "养猫",
    "养狗",
    "旅行",
    "健身",
    "减肥",
    "失眠",
    "日常",
    "通勤",
    // English
    "life",
    "daily",
    "routine",
    "cooking",
    "pet",
    "cat",
    "dog",
    "travel",
    "fitness",
    "insomnia",
    "commute",
    "moving",
    "rent",
    "weekend",
    "weather",
    "morning",
    "coffee",
  ],
  幽壑: [
    "焦虑",
    "抑郁",
    "孤独",
    "压力",
    "崩溃",
    "难过",
    "哭",
    "开心",
    "快乐",
    "感恩",
    "治愈",
    "emo",
    "低落",
    "情绪",
    // English
    "anxiety",
    "depression",
    "lonely",
    "stress",
    "sad",
    "cry",
    "overwhelmed",
    "hopeless",
    "thankful",
    "healing",
    "dark",
    "struggle",
    "mental health",
    "burnout",
    "tired",
    "therapist",
  ],
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

/**
 * Detect whether content is Chinese or English based on CJK character ratio.
 * If >15% of characters are in CJK ranges → "zh", otherwise "en".
 */
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
