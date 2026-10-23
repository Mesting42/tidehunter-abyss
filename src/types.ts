/** 游戏逻辑统一使用米与秒。二维坐标 x 向右、y 向下；渲染层负责反转 y。 */
export interface Vec {
  x: number;
  y: number;
}
export type Mode = "voyage" | "endless" | "training";
export type Phase = "menu" | "playing" | "paused" | "dead" | "victory";
export type FoodRule =
  | "eat"
  | "bite"
  | "ram"
  | "poison"
  | "spike"
  | "predator"
  | "machine"
  | "elite"
  | "boss";
export interface SharkDef {
  id: string;
  name: string;
  title: string;
  desc: string;
  color: string;
  belly: string;
  length: number;
  girth: number;
  fin: number;
  level: number;
  hp: number;
  speed: number;
  boost: number;
  bite: number;
  hunger: number;
  turn: number;
  skill: string;
  skillDesc: string;
  cooldown: number;
  price: number;
}
export interface Species {
  id: string;
  name: string;
  rule: FoodRule;
  level: number;
  hp: number;
  food: number;
  score: number;
  speed: number;
  size: number;
  color: string;
  shape: string;
  region: string;
  hint: string;
}
export interface Entity extends Vec {
  uid: number;
  kind: string;
  vx: number;
  vy: number;
  angle: number;
  hp: number;
  maxHp: number;
  state: string;
  timer: number;
  attack: number;
  biteAt: number;
  home: Vec;
  alive: boolean;
  elite?: boolean;
  phase?: number;
  weak?: number;
  warned?: boolean;
  /** 预警末段已锁定攻击方向，出招不再追踪玩家。 */
  locked?: boolean;
  tag?: string;
}
export interface Player extends Vec {
  vx: number;
  vy: number;
  angle: number;
  facing: number;
  hp: number;
  maxHp: number;
  stamina: number;
  skillCd: number;
  skillTime: number;
  hurtCd: number;
  biteAnim: number;
  airTime: number;
  stranded: number;
  growth: number;
  xp: number;
  boost: boolean;
  under: boolean;
  shieldUsed: boolean;
}
export interface Projectile extends Vec {
  vx: number;
  vy: number;
  life: number;
  damage: number;
  radius: number;
  type: string;
}
export interface Particle extends Vec {
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  text?: string;
}
export interface Terrain {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  shape: "rock" | "wreck" | "ice" | "ruin";
  breakable?: number;
  broken?: boolean;
}
export interface Treasure extends Vec {
  id: string;
  name: string;
  collected: boolean;
  air?: boolean;
}
export interface EventState {
  id: number;
  type: number;
  name: string;
  x: number;
  y: number;
  age: number;
  duration: number;
  stage: "warning" | "active";
  spawned: boolean;
}
export interface RunStats {
  time: number;
  score: number;
  eaten: number;
  boostEaten: number;
  fishTypes: string[];
  maxCombo: number;
  leaps: number;
  nets: number;
  wreck: number;
  cave: number;
  iceTime: number;
  frenzy: number;
  frenzyKills: number;
  elites: number;
  boss: number;
  distance: number;
  treasures: number;
  relic: number;
  paidScore: number;
  runCounted: boolean;
  currency: number;
  visited: string[];
  claims: string[];
}
export interface ComboState {
  count: number;
  time: number;
  multiplier: number;
  charge: number;
  rage: number;
  grace: number;
}
export interface Checkpoint {
  charge?: number;
  mode: "voyage";
  shark: string;
  stats: RunStats;
  treasures: string[];
  broken: string[];
  elites: string[];
  x: number;
  y: number;
  hp: number;
  xp: number;
  growth: number;
  stage: number;
  seed: number;
}
export interface Settings {
  music: number;
  sfx: number;
  effects: number;
  flash: boolean;
  vibration: boolean;
  touchSize: number;
  touchOpacity: number;
  mouse: boolean;
  noHunger: boolean;
  quality: "auto" | "high" | "low";
}
export interface SaveData {
  /** 可选探索跨航次收藏；旧存档由存档层补全。 */
  exploration: import("./exploration/system").ExplorationSave;
  version: number;
  currency: number;
  selected: string;
  unlocked: string[];
  upgrades: Record<string, { bite: number; speed: number; recovery: number }>;
  equipment: string[];
  owned: string[];
  skins: string[];
  skin: string;
  discovered: string[];
  completed: string[];
  records: Record<
    string,
    { score: number; time: number; eaten: number; combo: number }
  >;
  settings: Settings;
  checkpoint: Checkpoint | null;
  wins: number;
  runs: number;
}
export interface GameNotice {
  text: string;
  sub?: string;
  time: number;
  color?: string;
}
