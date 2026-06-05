const ZODIAC_SIGNS = [
  { name: "摩羯座", start: [1, 1], end: [1, 19] },
  { name: "水瓶座", start: [1, 20], end: [2, 18] },
  { name: "双鱼座", start: [2, 19], end: [3, 20] },
  { name: "白羊座", start: [3, 21], end: [4, 19] },
  { name: "金牛座", start: [4, 20], end: [5, 20] },
  { name: "双子座", start: [5, 21], end: [6, 21] },
  { name: "巨蟹座", start: [6, 22], end: [7, 22] },
  { name: "狮子座", start: [7, 23], end: [8, 22] },
  { name: "处女座", start: [8, 23], end: [9, 22] },
  { name: "天秤座", start: [9, 23], end: [10, 23] },
  { name: "天蝎座", start: [10, 24], end: [11, 22] },
  { name: "射手座", start: [11, 23], end: [12, 21] },
  { name: "摩羯座", start: [12, 22], end: [12, 31] },
];

export function getWesternZodiac(birthday: Date): string {
  const month = birthday.getMonth() + 1;
  const day = birthday.getDate();

  for (const sign of ZODIAC_SIGNS) {
    const [startMonth, startDay] = sign.start;
    const [endMonth, endDay] = sign.end;

    if (month === startMonth && day >= startDay) return sign.name;
    if (month === endMonth && day <= endDay) return sign.name;
  }

  return "摩羯座";
}
