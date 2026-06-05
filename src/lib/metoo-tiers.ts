export interface MeTooTier {
  name: string;
  description: string;
  threshold: number;
}

export const METOO_TIERS: MeTooTier[] = [
  {
    name: "寥若星尘",
    description:
      "像某个月夜独自走过的巷口，路灯下只有自己的影——偶尔也有人经过，但他们都步履匆匆，不曾回头。",
    threshold: 0,
  },
  {
    name: "河畔灯火",
    description:
      "像一列漫长夜车里，隔着过道的几个陌生人，彼此沉默，却都在看向同一扇起雾的窗——你知道他们也在，却不必开口寒暄。",
    threshold: 10,
  },
  {
    name: "人海潮汐",
    description:
      "像潮水退去后，沙滩上密密麻麻的脚印——原来每一个独自站在风里的人，都曾以为只有自己一人。",
    threshold: 50,
  },
];

export function getMeTooTier(count: number): MeTooTier {
  for (let i = METOO_TIERS.length - 1; i >= 0; i--) {
    if (count >= METOO_TIERS[i].threshold) {
      return METOO_TIERS[i];
    }
  }
  return METOO_TIERS[0];
}
