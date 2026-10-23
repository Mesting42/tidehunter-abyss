import { describe, it, expect, vi, beforeEach } from "vitest";
import { blocked, resolveTerrain, segmentDistance } from "../src/core/math";
import { SHARKS, SPECIES, TERRAIN } from "../src/data";
import { feed, mouth } from "../src/systems/combat";
import { addCatch, hunger, hurt, updateCombo } from "../src/systems/survival";
import { movePlayer } from "../src/systems/movement";
import { Ecology } from "../src/systems/ecology";
import { Storage } from "../src/core/storage";
import type { ComboState, Player, Terrain } from "../src/types";
const player = (): Player => ({
  x: 100,
  y: 100,
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
const combo = (): ComboState => ({
  count: 0,
  time: 0,
  multiplier: 1,
  charge: 0,
  rage: 0,
  grace: 0,
});
const wall: Terrain = {
  id: "wall",
  x: 110,
  y: 80,
  w: 10,
  h: 40,
  shape: "rock",
};
const effects = { splash: () => {}, broke: () => {} };
describe("方向、连续检测与结算", () => {
  it("高速扫掠命中路径，尾巴碰到目标不能捕食", () => {
    expect(
      segmentDistance({ x: 50, y: 2 }, { x: 0, y: 0 }, { x: 100, y: 0 }),
    ).toBe(2);
    const p = player(),
      eco = new Ecology(1),
      k = vi.fn();
    eco.spawn("sprat", 92, 100, []);
    feed({
      player: p,
      def: SHARKS[0],
      combo: combo(),
      entities: eco.entities,
      terrain: [],
      oldMouth: mouth(p, SHARKS[0]),
      time: 1,
      biteUpgrade: 0,
      kill: k,
      hit: () => {},
      damage: () => {},
      hint: () => {},
    });
    expect(k).not.toHaveBeenCalled();
  });
  it("扫掠只结算一次，同一目标不能重复奖励", () => {
    const p = player(),
      eco = new Ecology(1),
      k = vi.fn();
    eco.spawn("sprat", 107, 100, []);
    const c = {
      player: p,
      def: SHARKS[0],
      combo: combo(),
      entities: eco.entities,
      terrain: [],
      oldMouth: { x: 103, y: 100 },
      time: 1,
      biteUpgrade: 0,
      kill: k,
      hit: () => {},
      damage: () => {},
      hint: () => {},
    };
    feed(c);
    feed(c);
    expect(k).toHaveBeenCalledTimes(1);
  });
  it("岩壁同时遮挡捕食与鱼叉视线", () => {
    expect(blocked({ x: 100, y: 100 }, { x: 125, y: 100 }, [wall])).toBe(true);
    expect(blocked({ x: 100, y: 70 }, { x: 125, y: 70 }, [wall])).toBe(false);
    const p = player(),
      eco = new Ecology(1),
      k = vi.fn();
    eco.spawn("sprat", 112, 100, []);
    feed({
      player: p,
      def: { ...SHARKS[0], length: 30 },
      combo: combo(),
      entities: eco.entities,
      terrain: [wall],
      oldMouth: { x: 109, y: 100 },
      time: 1,
      biteUpgrade: 0,
      kill: k,
      hit: () => {},
      damage: () => {},
      hint: () => {},
    });
    expect(k).not.toHaveBeenCalled();
  });
  it("耐久目标攻击间隔与帧率无关", () => {
    for (const hz of [30, 60, 120]) {
      const p = player(),
        eco = new Ecology(1);
      eco.spawn("ray", 107, 100, []);
      let hits = 0;
      for (let i = 0; i < hz; i++)
        feed({
          player: p,
          def: { ...SHARKS[0], bite: 1 },
          combo: combo(),
          entities: eco.entities,
          terrain: [],
          oldMouth: mouth(p, SHARKS[0]),
          time: i / hz,
          biteUpgrade: 0,
          kill: () => {},
          hit: () => hits++,
          damage: () => {},
          hint: () => {},
        });
      expect(hits).toBe(3);
    }
  });
});
describe("生存、狂暴与时间", () => {
  it("饥饿在不同刷新率下一致，开局与训练豁免", () => {
    for (const hz of [30, 60, 120]) {
      const p = player();
      for (let i = 0; i < hz * 60; i++)
        hunger(p, SHARKS[0], 1 / hz, 30, false, false);
      expect(p.hp).toBeCloseTo(116.4, 6);
    }
    const p = player();
    hunger(p, SHARKS[0], 10, 5, false, false);
    hunger(p, SHARKS[0], 10, 30, false, true);
    expect(p.hp).toBe(150);
  });
  it("狂暴不回填槽，结束保护吸收普通伤害但水雷仍危险", () => {
    const c = combo(),
      p = player();
    c.rage = 0.1;
    addCatch(c, 100);
    expect(c.charge).toBe(0);
    let ends = 0;
    updateCombo(
      c,
      0.2,
      () => {},
      () => ends++,
      12,
    );
    expect(ends).toBe(1);
    expect(c.grace).toBe(2.5);
    expect(hurt(p, c, 50, "bite", false, false)).toBe(false);
    expect(hurt(p, c, 48, "mine", false, false)).toBe(true);
    expect(p.hp).toBe(102);
  });
  it("倍率上限为五，连吃中断复位", () => {
    const c = combo();
    for (let i = 0; i < 80; i++) addCatch(c, 20);
    expect(c.multiplier).toBe(5);
    updateCombo(
      c,
      8,
      () => {},
      () => {},
      12,
    );
    expect(c.multiplier).toBe(1);
  });
});
describe("海面、碰撞与长期生态", () => {
  it("冲刺越过海面后受重力影响，最终回到水中", () => {
    const p = player();
    p.y = 48;
    p.angle = -Math.PI / 2;
    for (let i = 0; i < 18; i++)
      movePlayer(
        p,
        SHARKS[0],
        { x: 0, y: -1 },
        true,
        false,
        0,
        0,
        [],
        1 / 60,
        effects,
      );
    expect(p.y).toBeLessThan(40);
    let min = p.y;
    for (let i = 0; i < 180; i++) {
      movePlayer(
        p,
        SHARKS[0],
        { x: 0, y: 0 },
        false,
        false,
        0,
        0,
        [],
        1 / 60,
        effects,
      );
      min = Math.min(min, p.y);
    }
    expect(min).toBeLessThan(25);
    expect(p.y).toBeGreaterThanOrEqual(40);
  });
  it("普通冲刺不能穿过岩壁，圆碰撞能推出内侧点", () => {
    const p = player();
    p.x = 90;
    for (let i = 0; i < 120; i++)
      movePlayer(
        p,
        SHARKS[0],
        { x: 1, y: 0 },
        true,
        false,
        0,
        0,
        [wall],
        1 / 60,
        effects,
      );
    expect(p.x).toBeLessThan(110);
    const v = { x: 115, y: 100 };
    resolveTerrain(v, 3, [wall]);
    expect(v.x < 110 || v.x > 120 || v.y < 80 || v.y > 120).toBe(true);
  });
  it("三十分钟简化生态维持补充并受硬上限约束", () => {
    const p = player(),
      eco = new Ecology(124),
      terrain = structuredClone(TERRAIN);
    eco.seed(terrain);
    const start = eco.entities.length;
    let max = start;
    for (let i = 0; i < 1800; i++) {
      if (i % 2 === 0) {
        const food = eco.entities.find(
          (e) =>
            e.alive &&
            Math.hypot(e.x - p.x, e.y - p.y) < 130 &&
            e.kind === "sprat",
        );
        if (food) food.alive = false;
      }
      eco.update({
        player: p,
        terrain,
        dt: 1,
        time: i,
        tick: i * 60,
        endless: true,
        slow: false,
        damage: () => {},
        shoot: () => {},
        warning: () => {},
      });
      max = Math.max(max, eco.entities.length);
    }
    expect(max).toBeLessThanOrEqual(360);
    expect(
      eco.entities.filter((e) => e.alive && e.kind === "sprat").length,
    ).toBeGreaterThan(30);
  });
  it("所有要求的内容数量与地形骨架存在", () => {
    expect(SHARKS.length).toBe(4);
    expect(SPECIES.length).toBeGreaterThanOrEqual(14);
    expect(SPECIES.filter((s) => s.rule === "elite").length).toBe(2);
    expect(TERRAIN.length).toBeGreaterThan(12);
  });
});
describe("存档容错与防重复奖励", () => {
  let memory: Map<string, string>;
  beforeEach(() => {
    memory = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => memory.get(k) || null,
      setItem: (k: string, v: string) => memory.set(k, v),
    });
  });
  it("损坏或不兼容存档回退，其他命名空间不受影响", () => {
    memory.set("other.game", "untouched");
    memory.set("tidehunter.abyss.save.v1", "{broken");
    const store = new Storage();
    expect(store.data.selected).toBe("reef");
    expect(store.warning).not.toBe("");
    expect(memory.get("other.game")).toBe("untouched");
  });
  it("同一个任务/宝藏幂等发奖", () => {
    const store = new Storage(),
      claims: string[] = [];
    expect(store.reward(claims, "treasure:one", 30)).toBe(true);
    expect(store.reward(claims, "treasure:one", 30)).toBe(false);
    expect(store.data.currency).toBe(110);
  });
});
