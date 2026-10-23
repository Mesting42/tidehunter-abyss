import type { Entity, Player, Terrain, Vec } from "../types";
import { blocked, clamp, dist, inside } from "../core/math";
import {
  EXPEDITIONS,
  LANDMARKS,
  ENCOUNTERS,
  MESSENGER_ROUTE,
  EXPLORATION_IDS,
  EXPLORATION_TERRAIN,
} from "./data";

export interface ExplorationSave {
  found: string[];
  completed: string[];
  steps: Record<string, number>;
  anchors: string[];
  claims: string[];
  encounters: string[];
  seenEncounters: string[];
  tracked: string | null;
}
export const freshExploration = (): ExplorationSave => ({
  found: [],
  completed: [],
  steps: {},
  anchors: [],
  claims: [],
  encounters: [],
  seenEncounters: [],
  tracked: null,
});

/** 旧 v1 存档没有 exploration 时补默认值；未知 id 和异常进度丢弃，不影响原航次。 */
export function sanitizeExploration(raw: unknown): ExplorationSave {
  const d = freshExploration();
  if (!raw || typeof raw !== "object") return d;
  const a = raw as Partial<ExplorationSave>;
  const strings = (v: unknown, allowed: string[]) =>
    Array.isArray(v)
      ? [
          ...new Set(
            v.filter(
              (id): id is string =>
                typeof id === "string" && allowed.includes(id),
            ),
          ),
        ]
      : [];
  d.found = strings(a.found, EXPLORATION_IDS);
  d.completed = strings(
    a.completed,
    EXPEDITIONS.map((e) => e.id),
  );
  d.anchors = strings(
    a.anchors,
    EXPEDITIONS[1].nodes.map((n) => n.id),
  );
  d.encounters = strings(
    a.encounters,
    ENCOUNTERS.map((e) => e.id),
  );
  d.seenEncounters = strings(
    a.seenEncounters,
    ENCOUNTERS.map((e) => e.id),
  );
  const claims = [...EXPLORATION_IDS, ...ENCOUNTERS.map((e) => "enc:" + e.id)];
  d.claims = strings(a.claims, claims);
  for (const q of EXPEDITIONS) {
    const value = a.steps?.[q.id];
    d.steps[q.id] = Number.isInteger(value)
      ? clamp(value!, 0, q.nodes.length)
      : 0;
    if (d.completed.includes(q.id)) d.steps[q.id] = q.nodes.length;
  }
  const trackable = [...d.found, ...d.seenEncounters];
  d.tracked =
    typeof a.tracked === "string" && trackable.includes(a.tracked)
      ? a.tracked
      : null;
  return d;
}

export interface ExplorationContext {
  player: Player;
  terrain: Terrain[];
  entities: Entity[];
  dt: number;
  time: number;
  training: boolean;
  bossActive: boolean;
  persist: () => void;
  reward: (amount: number) => void;
  unlock: () => void;
  signal: (title: string, detail: string, pos: Vec, color?: string) => void;
  spawn: (kind: string, pos: Vec, tag: string) => Entity | null;
}
export interface ExplorationAction {
  id: string;
  label: string;
  pos: Vec;
  kind: "collect" | "beacon" | "landmark" | "encounter";
  index?: number;
}

/** 可选探索完全独立于主线计数。收藏跨航次保存，训练使用副本；机关和领奖均以唯一 id 幂等。 */
export class Exploration {
  data: ExplorationSave;
  messenger: Vec = { x: ENCOUNTERS[1].x, y: ENCOUNTERS[1].y };
  messengerStep = 0;
  messengerActive = false;
  rescueActive = false;
  rescueCage?: Entity;
  time = 0;
  constructor(data = freshExploration()) {
    this.data = data;
  }
  step(id: string) {
    return this.data.steps[id] || 0;
  }
  done(id: string) {
    return this.data.completed.includes(id);
  }
  found(id: string) {
    return this.data.found.includes(id);
  }
  iceCalm() {
    return this.time % 7 >= 4.6;
  }
  iceRest(p: Vec) {
    return dist(p, { x: 1038, y: 276 }) < 19;
  }
  current(p: Vec): Vec {
    if (
      p.x > 934 &&
      p.x < 1126 &&
      p.y > 216 &&
      p.y < 309 &&
      !this.iceRest(p) &&
      !this.iceCalm()
    )
      return { x: -24, y: Math.sin(this.time * 1.7) * 2 };
    return { x: 0, y: 0 };
  }
  buildTerrain(terrain: Terrain[]) {
    const shelf = terrain.find((t) => t.id === "shelf");
    if (shelf) shelf.w = 72;
    terrain.push(
      { id: "exp-shelf-east", x: 500, y: 370, w: 53, h: 30, shape: "rock" },
      ...structuredClone(EXPLORATION_TERRAIN),
    );
    this.syncDoors(terrain);
  }
  syncDoors(terrain: Terrain[]) {
    for (const q of EXPEDITIONS) {
      const gate = terrain.find((t) => t.id === "exp-gate-" + q.id);
      if (gate)
        gate.broken = this.step(q.id) >= q.nodes.length || this.done(q.id);
    }
    for (const id of ["gate", "exp-hold-floor", "exp-ice-exit"]) {
      const t = terrain.find((t) => t.id === id);
      if (
        t &&
        (id === "gate"
          ? this.step("hold") >= 2
          : id === "exp-hold-floor"
            ? this.done("hold")
            : this.done("icepass"))
      )
        t.broken = true;
    }
  }
  seed(c: ExplorationContext) {
    // 新房间的墙体不能包住随机生物；普通威胁清出解谜室，庭院保留独立可绕行守卫。
    for (const e of c.entities) {
      if (e.elite) continue;
      if (c.terrain.some((t) => t.id.startsWith("exp-") && inside(e, t, 5)))
        e.alive = false;
      if (
        (e.x > 98 && e.x < 190 && e.y > 153 && e.y < 219) ||
        (e.x > 410 && e.x < 552 && e.y > 286 && e.y < 370) ||
        (e.x > 722 && e.x < 818 && e.y > 450 && e.y < 522)
      )
        e.alive = false;
    }
    if (!this.data.encounters.includes("rescue"))
      this.rescueCage =
        c.spawn("net", ENCOUNTERS[0], "exploration:rescue") || undefined;
    if (this.step("court") >= 3 && !this.done("court")) this.guardian(c);
  }
  guardian(c: ExplorationContext) {
    if (!c.entities.some((e) => e.tag === "exploration:guardian")) {
      const e = c.spawn("angler", { x: 794, y: 484 }, "exploration:guardian");
      if (e) {
        e.timer = 2;
        e.home = { x: 790, y: 485 };
      }
    }
  }
  record(
    c: ExplorationContext,
    id: string,
    title: string,
    detail: string,
    pos: Vec,
    color?: string,
  ) {
    if (!this.found(id)) {
      this.data.found.push(id);
      c.persist();
      c.signal("发现 · " + title, detail, pos, color);
    }
  }
  claim(c: ExplorationContext, id: string, amount: number) {
    if (this.data.claims.includes(id)) return false;
    this.data.claims.push(id);
    if (!c.training) c.reward(amount);
    c.persist();
    return true;
  }
  update(c: ExplorationContext) {
    this.time += c.dt;
    const p = c.player;
    for (const q of EXPEDITIONS) {
      if (dist(p, q.entry) < 47 && !blocked(p, q.entry, c.terrain))
        this.record(c, q.id, q.name, q.clue, q.entry, q.color);
      if (!this.found(q.id) || this.done(q.id)) continue;
      const step = this.step(q.id),
        node = q.nodes[step];
      if (
        (q.id === "coral" || q.id === "icepass") &&
        node &&
        dist(p, node) < 13 &&
        !blocked(p, node, c.terrain)
      ) {
        this.data.steps[q.id] = step + 1;
        this.syncDoors(c.terrain);
        c.persist();
        c.signal(
          q.id === "coral" ? "珊瑚回应了微光" : "冰纹已记录",
          step + 1 === q.nodes.length
            ? "入口已开启 · 深入收集海域印记"
            : q.nodes[step + 1].label + "正在回应",
          node,
          q.color,
        );
      }
      if (q.id === "hold" && p.boost) {
        for (const anchor of q.nodes) {
          const front =
            (anchor.x - p.x) * Math.cos(p.angle) +
            (anchor.y - p.y) * Math.sin(p.angle);
          if (
            !this.data.anchors.includes(anchor.id) &&
            dist(p, anchor) < 15 &&
            front > -2 &&
            !blocked(p, anchor, c.terrain)
          ) {
            this.data.anchors.push(anchor.id);
            this.data.steps.hold = this.data.anchors.length;
            this.syncDoors(c.terrain);
            c.persist();
            c.signal(
              "锁链锚座已断",
              this.step("hold") >= 2
                ? "东侧舱门已松开 · 顺气泡进入密舱"
                : "还剩一根固定锁链",
              anchor,
              q.color,
            );
          }
        }
      }
    }
    for (const l of LANDMARKS)
      if (dist(p, l) < 34 && !blocked(p, l, c.terrain))
        this.record(
          c,
          l.id,
          l.name,
          "靠近交互，记录这处海域奇景。",
          l,
          l.color,
        );
    for (const e of ENCOUNTERS)
      if (
        !this.data.seenEncounters.includes(e.id) &&
        dist(p, e) < 46 &&
        !blocked(p, e, c.terrain)
      ) {
        this.data.seenEncounters.push(e.id);
        c.persist();
        c.signal("途中遭遇 · " + e.name, e.clue, e, "#a6dfe3");
      }
    const cage = this.rescueCage;
    if (
      cage &&
      !cage.alive &&
      !this.data.encounters.includes("rescue") &&
      (this.rescueActive || dist(p, cage) < 45)
    )
      this.finishEncounter("rescue", c, cage);
    if (this.messengerActive && !this.data.encounters.includes("messenger")) {
      const target = MESSENGER_ROUTE[this.messengerStep];
      if (target && dist(p, this.messenger) < 62) {
        const distance = dist(this.messenger, target),
          speed = Math.min(distance, 18 * c.dt);
        if (distance > 0.1) {
          this.messenger.x +=
            ((target.x - this.messenger.x) / distance) * speed;
          this.messenger.y +=
            ((target.y - this.messenger.y) / distance) * speed;
        }
        if (distance < 2 && dist(p, target) < 25) this.messengerStep++;
      }
      if (
        this.messengerStep >= MESSENGER_ROUTE.length &&
        dist(p, this.messenger) < 25
      )
        this.finishEncounter("messenger", c, this.messenger);
    }
    if (this.iceRest(p)) p.stamina = Math.min(100, p.stamina + c.dt * 26);
  }
  finishEncounter(id: string, c: ExplorationContext, pos: Vec) {
    this.data.encounters.push(id);
    this.claim(c, "enc:" + id, 18);
    if (this.data.tracked === id) this.data.tracked = null;
    for (let i = 0; i < 9; i++)
      c.spawn(
        i % 3 ? "sprat" : "tuna",
        {
          x: pos.x + ((i % 3) - 1) * 6,
          y: pos.y + (Math.floor(i / 3) - 1) * 5,
        },
        "exploration:gift",
      );
    c.signal(
      id === "rescue" ? "鱼群重获自由" : "信使留下潮汐赠礼",
      c.training ? "训练记录 · 不计入真实收藏" : "+18 潮晶 · 遭遇记录已保存",
      pos,
      "#a8e8cb",
    );
    c.persist();
  }
  action(
    c: Pick<ExplorationContext, "player" | "terrain">,
  ): ExplorationAction | undefined {
    const actions: ExplorationAction[] = [];
    for (const q of EXPEDITIONS) {
      if (!this.found(q.id) || this.done(q.id)) continue;
      if (this.step(q.id) >= q.nodes.length)
        actions.push({
          id: q.id,
          label: "收集" + q.stamp,
          pos: q.goal,
          kind: "collect",
        });
      else if (q.id === "court")
        q.nodes.forEach((n, index) =>
          actions.push({
            id: q.id,
            label: "唤醒" + n.label,
            pos: n,
            kind: "beacon",
            index,
          }),
        );
    }
    for (const l of LANDMARKS)
      if (this.found(l.id) && !this.data.claims.includes(l.id))
        actions.push({
          id: l.id,
          label: "记录" + l.name,
          pos: l,
          kind: "landmark",
        });
    for (const e of ENCOUNTERS)
      if (
        this.data.seenEncounters.includes(e.id) &&
        !this.data.encounters.includes(e.id) &&
        !(e.id === "rescue" ? this.rescueActive : this.messengerActive)
      )
        actions.push({
          id: e.id,
          label: e.id === "rescue" ? "调查受困鱼群" : "回应潮汐信使",
          pos: e,
          kind: "encounter",
        });
    return actions
      .filter(
        (a) =>
          dist(c.player, a.pos) < 17 && !blocked(c.player, a.pos, c.terrain),
      )
      .sort((a, b) => dist(c.player, a.pos) - dist(c.player, b.pos))[0];
  }
  interact(c: ExplorationContext) {
    const action = this.action(c);
    if (!action) return false;
    if (action.kind === "collect") {
      const q = EXPEDITIONS.find((e) => e.id === action.id)!;
      this.data.completed.push(q.id);
      this.claim(c, q.id, 45);
      this.syncDoors(c.terrain);
      if (this.data.tracked === q.id) this.data.tracked = null;
      c.signal(
        "获得 · " + q.stamp,
        q.memory + (c.training ? " · 训练记录" : " · +45 潮晶"),
        q.goal,
        q.color,
      );
      for (let i = 0; i < 4; i++)
        c.spawn(
          "tuna",
          { x: q.goal.x + 5 + i * 4, y: q.goal.y - 5 },
          "exploration:gift",
        );
      if (this.data.completed.length === 4 && !c.training) c.unlock();
    } else if (action.kind === "beacon") {
      if (action.index !== this.step("court"))
        c.signal(
          "回声尚未应答",
          "门楣光纹：波纹 → 双环 → 菱晶；已唤醒的光纹会保留。",
          action.pos,
          "#c5b5e7",
        );
      else {
        this.data.steps.court = this.step("court") + 1;
        this.syncDoors(c.terrain);
        c.signal(
          action.label + " · 已回应",
          this.step("court") >= 3
            ? "东侧石门已开启 · 可绕开守卫进入石庭"
            : "寻找下一种门楣光纹",
          action.pos,
          "#c5b5e7",
        );
        if (this.step("court") >= 3) this.guardian(c);
      }
    } else if (action.kind === "landmark") {
      const l = LANDMARKS.find((e) => e.id === action.id)!;
      this.claim(c, l.id, 12);
      c.signal(
        "奇景已记录 · " + l.name,
        l.desc + (c.training ? "" : " · +12 潮晶"),
        l,
        l.color,
      );
    } else {
      if (action.id === "rescue") this.rescueActive = true;
      else {
        this.messengerActive = true;
        this.messengerStep = 0;
      }
      c.signal(
        action.id === "rescue" ? "微光在网中挣扎" : "信使开始引路",
        action.id === "rescue"
          ? "正面冲刺撞断缚网，鱼群会留下补给。"
          : "跟紧微光；距离过远时，它会停下等候。",
        action.pos,
        "#a6dfe3",
      );
    }
    c.persist();
    return true;
  }
  target(id = this.data.tracked): Vec | undefined {
    const q = EXPEDITIONS.find((e) => e.id === id);
    if (q)
      return this.step(q.id) >= q.nodes.length
        ? q.goal
        : q.id === "hold"
          ? q.nodes.find((n) => !this.data.anchors.includes(n.id))
          : q.nodes[this.step(q.id)];
    if (id === "messenger" && this.messengerActive) return this.messenger;
    return (
      LANDMARKS.find((e) => e.id === id) || ENCOUNTERS.find((e) => e.id === id)
    );
  }
  instruction(id: string) {
    const q = EXPEDITIONS.find((e) => e.id === id);
    if (!q)
      return id === "rescue"
        ? "冲刺解开缚网，释放受困鱼群"
        : id === "messenger"
          ? "回应并跟随微光，信使会等候你"
          : "靠近交互，记录海域奇景";
    if (this.done(id)) return q.memory;
    const step = this.step(id);
    if (step >= q.nodes.length) return "入口已开启 · 深入收集" + q.stamp;
    if (id === "hold") return `冲刺撞断锁链锚座 ${step} / 2`;
    if (id === "court")
      return `唤醒${q.nodes[step].label} ${step} / 3 · 波纹 → 双环 → 菱晶`;
    if (id === "icepass")
      return `${this.iceCalm() ? "平潮 · 趁机前进" : "逆流 · 冲刺或寻找避流岩隙"} · 冰纹 ${step} / 3`;
    return `跟随发光鱼群 · 珊瑚回应 ${step} / 3`;
  }
}
