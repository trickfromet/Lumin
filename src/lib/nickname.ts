const adjectives = [
  "快乐的", "孤独的", "温柔的", "暴躁的", "迷糊的",
  "机智的", "懒洋洋的", "勇敢的", "害羞的", "神秘的",
  "呆萌的", "高冷的", "话痨的", "佛系的", "社恐的",
  "元气满满的", "忧郁的", "搞笑的", "认真的", "天真的",
];

const animals = [
  "柴犬", "橘猫", "兔子", "仓鼠", "柯基",
  "熊猫", "海豚", "猫头鹰", "刺猬", "企鹅",
  "树懒", "水獭", "龙猫", "柴犬", "鹦鹉",
  "小鹿", "松鼠", "海豹", "考拉", "变色龙",
];

export function generateNickname(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  return adj + animal;
}
