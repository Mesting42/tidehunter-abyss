import type { SaveData, Settings, Checkpoint } from "../types";
import { SHARKS, EQUIPMENT, SPECIES, TASKS } from "../data";
import { freshExploration, sanitizeExploration } from "../exploration/system";
const KEY = "tidehunter.abyss.save.v1";
export const defaults: Settings = {
  music: 0.32,
  sfx: 0.65,
  effects: 0.7,
  flash: true,
  vibration: true,
  touchSize: 1,
  touchOpacity: 0.8,
  mouse: false,
  noHunger: false,
  quality: "auto",
};
export function freshSave(): SaveData {
  return {
    exploration: freshExploration(),
    version: 1,
    currency: 80,
    selected: "reef",
    unlocked: ["reef"],
    upgrades: {},
    equipment: [],
    owned: [],
    skins: ["natural"],
    skin: "natural",
    discovered: [],
    completed: [],
    records: {},
    settings: { ...defaults },
    checkpoint: null,
    wins: 0,
    runs: 0,
  };
}
function validCheckpoint(c: unknown): c is Checkpoint {
  if (!c || typeof c !== "object") return false;
  const a = c as Checkpoint;
  return (
    a.mode === "voyage" &&
    Number.isFinite(a.x) &&
    a.x > 0 &&
    a.x < 1240 &&
    Number.isFinite(a.y) &&
    a.y > 40 &&
    a.y < 625 &&
    SHARKS.some((s) => s.id === a.shark) &&
    Number.isFinite(a.stage) &&
    a.stage >= 0 &&
    a.stage <= 12 &&
    Number.isFinite(a.hp) &&
    Number.isFinite(a.xp) &&
    Number.isFinite(a.growth) &&
    Number.isFinite(a.seed) &&
    !!a.stats &&
    typeof a.stats === "object" &&
    ["time", "score", "eaten", "frenzy", "elites", "boss"].every((k) =>
      Number.isFinite((a.stats as any)[k]),
    ) &&
    Array.isArray(a.stats.claims) &&
    Array.isArray(a.stats.visited) &&
    Array.isArray(a.stats.fishTypes) &&
    Array.isArray(a.treasures) &&
    Array.isArray(a.broken) &&
    Array.isArray(a.elites)
  );
}
/** 本命名空间之外的 localStorage 永不触碰。不兼容/损坏数据回退，避免进入半初始化状态。 */
export class Storage {
  data: SaveData;
  warning = "";
  constructor(rawOverride?: string) {
    this.data = freshSave();
    try {
      const raw = rawOverride ?? localStorage.getItem(KEY);
      if (!raw) return;
      const a = JSON.parse(raw);
      if (a.version !== 1) throw Error("版本不兼容");
      const d = freshSave();
      this.data = {
        ...d,
        ...a,
        settings: { ...defaults, ...a.settings },
        checkpoint: validCheckpoint(a.checkpoint) ? a.checkpoint : null,
        exploration: sanitizeExploration(a.exploration),
      };
      for (const k of ["currency", "wins", "runs"] as const)
        if (
          !Number.isFinite(this.data[k]) ||
          this.data[k] < 0 ||
          this.data[k] > 1e9
        )
          throw Error("数据损坏");
      for (const k of [
        "unlocked",
        "owned",
        "equipment",
        "skins",
        "discovered",
        "completed",
      ] as const)
        if (
          !Array.isArray(this.data[k]) ||
          !this.data[k].every((v: unknown) => typeof v === "string")
        )
          throw Error("数据损坏");
      this.data.unlocked = [
        ...new Set([
          "reef",
          ...this.data.unlocked.filter((id) => SHARKS.some((s) => s.id === id)),
        ]),
      ];
      if (!this.data.unlocked.includes(this.data.selected))
        this.data.selected = "reef";
      this.data.owned = this.data.owned.filter((id) =>
        EQUIPMENT.some((e) => e.id === id),
      );
      this.data.equipment = [
        ...new Set(
          this.data.equipment.filter((id) => this.data.owned.includes(id)),
        ),
      ].slice(0, 2);
      this.data.discovered = this.data.discovered.filter((id) =>
        SPECIES.some((s) => s.id === id),
      );
      this.data.completed = this.data.completed.filter((id) =>
        TASKS.some((t) => t.id === id),
      );
      this.data.skins = this.data.skins.filter((id) =>
        ["natural", "moon", "explorer"].includes(id),
      );
      if (
        this.data.exploration.completed.length === 4 &&
        !this.data.skins.includes("explorer")
      )
        this.data.skins.push("explorer");
      if (!this.data.skins.includes(this.data.skin)) this.data.skin = "natural";
      if (!a.upgrades || typeof a.upgrades !== "object")
        this.data.upgrades = {};
      for (const id of Object.keys(this.data.upgrades)) {
        const u = this.data.upgrades[id];
        if (
          !u ||
          !["bite", "speed", "recovery"].every(
            (k) =>
              Number.isInteger((u as any)[k]) &&
              (u as any)[k] >= 0 &&
              (u as any)[k] <= 3,
          )
        )
          delete this.data.upgrades[id];
      }
      if (!a.records || typeof a.records !== "object") this.data.records = {};
      for (const key of Object.keys(this.data.records))
        if (
          !["score", "time", "eaten", "combo"].every((k) =>
            Number.isFinite((this.data.records[key] as any)?.[k]),
          )
        )
          delete this.data.records[key];
      for (const k of [
        "music",
        "sfx",
        "effects",
        "touchOpacity",
        "touchSize",
      ] as const) {
        const v = this.data.settings[k];
        if (!Number.isFinite(v)) this.data.settings[k] = defaults[k];
        else
          this.data.settings[k] = Math.max(
            k === "touchSize" ? 0.8 : 0,
            Math.min(k === "touchSize" ? 1.4 : 1, v),
          );
      }
      for (const k of ["flash", "vibration", "mouse", "noHunger"] as const)
        if (typeof this.data.settings[k] !== "boolean")
          this.data.settings[k] = defaults[k];
      if (!["auto", "high", "low"].includes(this.data.settings.quality))
        this.data.settings.quality = "auto";
    } catch {
      this.warning = "存档不可用，已安全创建新档。旧数据未自动删除。";
      this.data = freshSave();
    }
  }
  write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
      return true;
    } catch {
      this.warning = "浏览器禁止保存或空间已满，本次仍可游玩。";
      return false;
    }
  }
  /** 任务领取先写幂等标记再发奖。claimId 随航次存入检查点，恢复不能重复领奖。 */
  reward(claims: string[], id: string, amount: number) {
    if (claims.includes(id)) return false;
    claims.push(id);
    this.data.currency += amount;
    this.write();
    return true;
  }
  buy(price: number) {
    if (this.data.currency < price) return false;
    this.data.currency -= price;
    this.write();
    return true;
  }
  reset() {
    this.data = freshSave();
    this.write();
  }
}
