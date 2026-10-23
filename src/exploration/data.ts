import type { Terrain, Vec } from "../types";

export interface Expedition {
  id: string;
  name: string;
  region: string;
  entry: Vec;
  goal: Vec;
  clue: string;
  memory: string;
  stamp: string;
  color: string;
  nodes: (Vec & { id: string; label: string })[];
}

/** 支线位置使用同一米制世界，不创建独立传送场景；每一处都有可读入口与真实碰撞。 */
export const EXPEDITIONS: Expedition[] = [
  {
    id: "coral",
    name: "珊瑚回声",
    region: "bay",
    entry: { x: 235, y: 175 },
    goal: { x: 135, y: 185 },
    clue: "三簇珊瑚在回应鱼群的微光。追随它们，靠近依次亮起的珊瑚。",
    memory: "光并未消失，只是藏进了珊瑚的呼吸。",
    stamp: "珊瑚印记",
    color: "#9fddbc",
    nodes: [
      { id: "coral-0", label: "第一簇回声", x: 245, y: 151 },
      { id: "coral-1", label: "第二簇回声", x: 247, y: 201 },
      { id: "coral-2", label: "第三簇回声", x: 215, y: 220 },
    ],
  },
  {
    id: "hold",
    name: "失落的密舱",
    region: "wreck",
    entry: { x: 601, y: 265 },
    goal: { x: 485, y: 332 },
    clue: "密舱的气泡沿两根锁链浮起。正面冲刺撞断锁链锚座，东侧舱门便会松开。",
    memory: "旧航线从舱底延续，通往更深的潮汐。",
    stamp: "沉船印记",
    color: "#d9ba83",
    nodes: [
      { id: "hold-0", label: "上层锁链锚座", x: 605, y: 291 },
      { id: "hold-1", label: "下层锁链锚座", x: 605, y: 350 },
    ],
  },
  {
    id: "icepass",
    name: "逆流冰隙",
    region: "ice",
    entry: { x: 903, y: 260 },
    goal: { x: 1162, y: 260 },
    clue: "冰隙每隔数秒平潮。冲刺穿过涌流，停在蓝色岩隙补充体力。",
    memory: "寒流之外，冰层保存着一片未被惊动的蓝。",
    stamp: "霜潮印记",
    color: "#94cfe9",
    nodes: [
      { id: "icepass-0", label: "第一道冰纹", x: 963, y: 263 },
      { id: "icepass-1", label: "避流岩隙", x: 1035, y: 276 },
      { id: "icepass-2", label: "末端冰纹", x: 1104, y: 257 },
    ],
  },
  {
    id: "court",
    name: "沉眠的回声庭",
    region: "deep",
    entry: { x: 747, y: 403 },
    goal: { x: 759, y: 482 },
    clue: "门楣光纹：波纹 → 双环 → 菱晶。靠近对应回声碑交互，守卫可反击，也可绕行。",
    memory: "石庭重新听见潮声，守望者也终于有了归处。",
    stamp: "裂渊印记",
    color: "#c5b5e7",
    nodes: [
      { id: "court-0", label: "波纹回声碑", x: 755, y: 410 },
      { id: "court-1", label: "双环回声碑", x: 790, y: 553 },
      { id: "court-2", label: "菱晶回声碑", x: 850, y: 478 },
    ],
  },
];

export const LANDMARKS = [
  {
    id: "garden",
    name: "贝光花园",
    region: "bay",
    x: 265,
    y: 98,
    desc: "细小贝壳随潮起伏，像一座没有边界的花园。",
    color: "#b7e4ca",
  },
  {
    id: "bell",
    name: "沉钟回廊",
    region: "wreck",
    x: 638,
    y: 260,
    desc: "沉钟仍在水中共鸣，断裂的锁链指向沉船深处。",
    color: "#dbc99a",
  },
  {
    id: "whalesong",
    name: "冰海鲸歌",
    region: "ice",
    x: 1175,
    y: 151,
    desc: "冰面之下，远去的鲸歌把整个海域连在一起。",
    color: "#a8ddef",
  },
  {
    id: "bones",
    name: "古鲸眠骨",
    region: "deep",
    x: 614,
    y: 575,
    desc: "古鲸脊骨间长出星光，新生命在旧骨骼里栖息。",
    color: "#d5c9de",
  },
] as const;

export const ENCOUNTERS = [
  {
    id: "rescue",
    name: "解救受困鱼群",
    x: 351,
    y: 235,
    clue: "渔网里有微光。靠近调查，再冲刺撞开缚网。",
  },
  {
    id: "messenger",
    name: "潮汐信使",
    x: 702,
    y: 174,
    clue: "一尾发光的鱼正在等候。靠近交互，跟随它寻找潮汐赠礼。",
  },
] as const;
export const MESSENGER_ROUTE: Vec[] = [
  { x: 720, y: 177 },
  { x: 746, y: 194 },
  { x: 779, y: 164 },
  { x: 814, y: 188 },
];

/** 原地形 shelf 分为两侧与可开启舱底，完成密舱后真正出现向深海的捷径。 */
export const EXPLORATION_TERRAIN: Terrain[] = [
  { id: "exp-coral-roof", x: 88, y: 141, w: 113, h: 12, shape: "rock" },
  { id: "exp-coral-floor", x: 88, y: 219, w: 113, h: 12, shape: "rock" },
  { id: "exp-coral-wall", x: 88, y: 141, w: 12, h: 90, shape: "rock" },
  { id: "exp-gate-coral", x: 190, y: 153, w: 11, h: 66, shape: "rock" },
  { id: "exp-hold-west", x: 399, y: 286, w: 12, h: 84, shape: "wreck" },
  { id: "exp-gate-hold", x: 552, y: 286, w: 12, h: 84, shape: "wreck" },
  { id: "exp-hold-floor", x: 450, y: 370, w: 50, h: 30, shape: "wreck" },
  { id: "exp-ice-roof", x: 925, y: 202, w: 215, h: 12, shape: "ice" },
  { id: "exp-ice-exit", x: 1140, y: 202, w: 50, h: 12, shape: "ice" },
  { id: "exp-ice-floor", x: 925, y: 310, w: 265, h: 12, shape: "ice" },
  { id: "exp-ice-east", x: 1190, y: 202, w: 12, h: 120, shape: "ice" },
  { id: "exp-ice-tooth", x: 1014, y: 214, w: 23, h: 34, shape: "ice" },
  { id: "exp-ice-rest", x: 1058, y: 289, w: 27, h: 21, shape: "rock" },
  { id: "exp-gate-icepass", x: 1130, y: 214, w: 12, h: 96, shape: "ice" },
  { id: "exp-court-roof", x: 710, y: 438, w: 120, h: 12, shape: "ruin" },
  { id: "exp-court-floor", x: 710, y: 522, w: 120, h: 10, shape: "ruin" },
  { id: "exp-court-west", x: 710, y: 450, w: 12, h: 72, shape: "ruin" },
  { id: "exp-gate-court", x: 818, y: 450, w: 12, h: 72, shape: "ruin" },
];

export const EXPLORATION_IDS = [
  ...EXPEDITIONS.map((e) => e.id),
  ...LANDMARKS.map((e) => e.id),
];
