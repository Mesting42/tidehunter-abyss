import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  Exploration,
  freshExploration,
  sanitizeExploration,
  type ExplorationContext,
} from "../src/exploration/system";
import {
  EXPEDITIONS,
  LANDMARKS,
  MESSENGER_ROUTE,
} from "../src/exploration/data";
import { Storage } from "../src/core/storage";
import { TERRAIN, SHARKS } from "../src/data";
import { Ecology } from "../src/systems/ecology";
import { movePlayer } from "../src/systems/movement";
import { inside } from "../src/core/math";
import type { Player, Vec } from "../src/types";

const player = (): Player => ({
  x: 150,
  y: 115,
  vx: 0,
  vy: 0,
  angle: 0,
  facing: 1,
  hp: 150,
  maxHp: 150,
  stamina: 100,
  skillCd: 0,
  skillTime: 0,
  hurtCd: 0,
  biteAnim: 0,
  airTime: 0,
  stranded: 0,
  growth: 0,
  xp: 0,
  boost: false,
  under: true,
  shieldUsed: false,
});
function fixture(training = false) {
  const e = new Exploration(),
    eco = new Ecology(1),
    terrain = structuredClone(TERRAIN);
  e.buildTerrain(terrain);
  const c: ExplorationContext = {
    player: player(),
    terrain,
    entities: eco.entities,
    dt: 1 / 60,
    time: 0,
    training,
    bossActive: false,
    persist: vi.fn(),
    reward: vi.fn(),
    unlock: vi.fn(),
    signal: vi.fn(),
    spawn: (kind, pos, tag) => eco.spawn(kind, pos.x, pos.y, terrain, tag),
  };
  return { e, c, eco };
}
const put = (p: Player, target: Vec) => {
  p.x = target.x;
  p.y = target.y;
};

describe("可选探索机关与收藏", () => {
  it("有八个独立发现点，主线定义不被探索数据改写", () => {
    expect(EXPEDITIONS.length + LANDMARKS.length).toBe(8);
    expect(new Set([...EXPEDITIONS, ...LANDMARKS].map((p) => p.id)).size).toBe(
      8,
    );
    const { e, c } = fixture();
    e.update(c);
    expect(e.data.found).toEqual([]);
  });
  it("珊瑚必须顺序靠近并有视线，机关完成后才可收集，奖励不重复", () => {
    const { e, c } = fixture(),
      q = EXPEDITIONS[0];
    put(c.player, q.entry);
    e.update(c);
    put(c.player, q.goal);
    expect(e.interact(c)).toBe(false);
    put(c.player, q.nodes[2]);
    e.update(c);
    expect(e.step(q.id)).toBe(0);
    for (const n of q.nodes) {
      put(c.player, n);
      e.update(c);
    }
    expect(c.terrain.find((t) => t.id === "exp-gate-coral")!.broken).toBe(true);
    put(c.player, q.goal);
    expect(e.interact(c)).toBe(true);
    expect(c.reward).toHaveBeenCalledWith(45);
    e.interact(c);
    expect(c.reward).toHaveBeenCalledTimes(1);
    const resumed = new Exploration(structuredClone(e.data));
    resumed.interact(c);
    expect(c.reward).toHaveBeenCalledTimes(1);
  });
  it("锚座必须正面冲刺，密舱收集后舱底真实打开", () => {
    const { e, c } = fixture(),
      q = EXPEDITIONS[1];
    put(c.player, q.entry);
    e.update(c);
    put(c.player, { x: q.nodes[0].x - 9, y: q.nodes[0].y });
    e.update(c);
    expect(e.step("hold")).toBe(0);
    c.player.boost = true;
    c.player.angle = 0;
    for (const n of q.nodes) {
      put(c.player, { x: n.x - 9, y: n.y });
      e.update(c);
    }
    expect(e.step("hold")).toBe(2);
    expect(c.terrain.find((t) => t.id === "exp-hold-floor")!.broken).not.toBe(
      true,
    );
    put(c.player, q.goal);
    e.interact(c);
    expect(c.terrain.find((t) => t.id === "exp-hold-floor")!.broken).toBe(true);
  });
  it("回声碑错误顺序不清除已达进度，正确顺序打开石庭并生成可绕守卫", () => {
    const { e, c } = fixture(),
      q = EXPEDITIONS[3];
    put(c.player, q.entry);
    e.update(c);
    put(c.player, q.nodes[1]);
    e.interact(c);
    expect(e.step("court")).toBe(0);
    put(c.player, q.nodes[0]);
    e.interact(c);
    expect(e.step("court")).toBe(1);
    e.interact(c);
    expect(e.step("court")).toBe(1);
    for (const n of q.nodes.slice(1)) {
      put(c.player, n);
      e.interact(c);
    }
    expect(c.terrain.find((t) => t.id === "exp-gate-court")!.broken).toBe(true);
    expect(c.entities.some((v) => v.tag === "exploration:guardian")).toBe(true);
    put(c.player, q.goal);
    e.interact(c);
    expect(e.done("court")).toBe(true); // 不把击杀守卫设为隐含门槛。
  });
  it("冰隙有逆流、平潮和避流恢复，松手同样受真实水流推动", () => {
    const { e, c } = fixture();
    e.time = 1;
    expect(e.current({ x: 970, y: 270 }).x).toBe(-24);
    expect(e.current({ x: 1038, y: 276 }).x).toBe(0);
    e.time = 5;
    expect(e.current({ x: 970, y: 270 }).x).toBe(0);
    c.player.stamina = 20;
    put(c.player, { x: 1038, y: 276 });
    e.update(c);
    expect(c.player.stamina).toBeGreaterThan(20);
    put(c.player, { x: 970, y: 270 });
    const before = c.player.x;
    e.time = 1;
    for (let i = 0; i < 60; i++)
      movePlayer(
        c.player,
        SHARKS[0],
        { x: 0, y: 0 },
        false,
        false,
        0,
        0,
        c.terrain,
        1 / 60,
        { splash: () => {}, broke: () => {} },
        e.current(c.player),
      );
    expect(c.player.x).toBeLessThan(before - 15);
  });
  it("旧 v1 存档安全迁移，异常探索数据不污染钱币与主线", () => {
    const s = new Storage(
      JSON.stringify({
        version: 1,
        currency: 123,
        unlocked: ["reef"],
        owned: [],
        equipment: [],
        skins: ["natural"],
        discovered: [],
        completed: [],
        settings: {},
      }),
    );
    expect(s.warning).toBe("");
    expect(s.data.currency).toBe(123);
    expect(s.data.exploration).toEqual(freshExploration());
    const cleaned = sanitizeExploration({
      found: ["coral", "unknown"],
      steps: { coral: 100, hold: -3 },
      tracked: "unknown",
      completed: [],
      claims: ["unknown"],
    });
    expect(cleaned.found).toEqual(["coral"]);
    expect(cleaned.steps.coral).toBe(3);
    expect(cleaned.steps.hold).toBe(0);
    expect(cleaned.tracked).toBeNull();
  });
  it("四枚印记解锁探索外观，训练发现与领奖不写真实存档", () => {
    const { e, c } = fixture(true),
      original = freshExploration();
    for (const q of EXPEDITIONS) {
      e.data.found.push(q.id);
      e.data.steps[q.id] = q.nodes.length;
      e.syncDoors(c.terrain);
      put(c.player, q.goal);
      e.interact(c);
    }
    expect(e.data.completed.length).toBe(4);
    expect(c.reward).not.toHaveBeenCalled();
    expect(c.unlock).not.toHaveBeenCalled();
    expect(original).toEqual(freshExploration());
    const real = fixture();
    real.e.data.found = EXPEDITIONS.map((q) => q.id);
    real.e.data.completed = EXPEDITIONS.slice(0, 3).map((q) => q.id);
    real.e.data.steps.court = 3;
    real.e.syncDoors(real.c.terrain);
    put(real.c.player, EXPEDITIONS[3].goal);
    real.e.interact(real.c);
    expect(real.c.unlock).toHaveBeenCalledTimes(1);
  });
  it("受困鱼群在网实体被回收后仍能结算，赠礼和潮晶只领一次", () => {
    const { e, c } = fixture();
    e.seed(c);
    put(c.player, { x: 351, y: 235 });
    e.update(c);
    e.interact(c);
    e.rescueCage!.alive = false;
    c.entities.splice(c.entities.indexOf(e.rescueCage!), 1);
    e.update(c);
    e.update(c);
    expect(e.data.encounters).toEqual(["rescue"]);
    expect(c.reward).toHaveBeenCalledTimes(1);
    expect(c.entities.filter((v) => v.tag === "exploration:gift").length).toBe(
      9,
    );
  });
  it("潮汐信使会等候掉队的玩家，真实跟随四段路线才完成遭遇", () => {
    const { e, c } = fixture();
    put(c.player, { x: 702, y: 174 });
    e.update(c);
    e.interact(c);
    const start = { ...e.messenger };
    put(c.player, { x: 100, y: 100 });
    for (let i = 0; i < 120; i++) e.update(c);
    expect(e.messenger).toEqual(start);
    for (let i = 0; i < 800 && !e.data.encounters.includes("messenger"); i++) {
      put(c.player, e.messenger);
      e.update(c);
    }
    expect(e.messengerStep).toBe(MESSENGER_ROUTE.length);
    expect(e.data.encounters).toContain("messenger");
  });
  it("打开后的四个秘密区域均有可用通路，关闭的石庭不能隔墙交互", () => {
    const { e, c } = fixture();
    put(c.player, { x: 834, y: 482 });
    e.data.found.push("court");
    e.data.steps.court = 3;
    // 门仍未同步打开，墙后 16m 内也不能透墙收集。
    expect(e.action(c)?.id).not.toBe("court");
    for (const q of EXPEDITIONS) e.data.steps[q.id] = q.nodes.length;
    e.syncDoors(c.terrain);
    for (const q of EXPEDITIONS) {
      expect(c.terrain.some((t) => inside(q.goal, t, 5))).toBe(false);
      const found = new Set<string>(),
        queue: Vec[] = [q.goal];
      let reached = false;
      for (let cursor = 0; cursor < queue.length && cursor < 30000; cursor++) {
        const p = queue[cursor];
        if (Math.hypot(p.x - q.entry.x, p.y - q.entry.y) < 14) {
          reached = true;
          break;
        }
        for (const [dx, dy] of [
          [8, 0],
          [-8, 0],
          [0, 8],
          [0, -8],
        ]) {
          const n = { x: p.x + dx, y: p.y + dy },
            key = n.x + ":" + n.y;
          if (
            n.x < 52 ||
            n.x > 1220 ||
            n.y < 70 ||
            n.y > 610 ||
            found.has(key) ||
            c.terrain.some((t) => inside(n, t, 5))
          )
            continue;
          found.add(key);
          queue.push(n);
        }
      }
      expect(reached, q.id + " must remain reachable").toBe(true);
    }
  });
});
