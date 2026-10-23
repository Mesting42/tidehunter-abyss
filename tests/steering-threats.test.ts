import { describe, expect, it, vi } from "vitest";
import * as T from "three";
import { SHARKS } from "../src/data";
import { movePlayer } from "../src/systems/movement";
import { Ecology } from "../src/systems/ecology";
import { attackProfile, trackAttack } from "../src/systems/threats";
import { animateSwimming, swimOrientation } from "../src/render/swimming";
import { threatOverlay } from "../src/ui/threat-overlay";
import type { Player, Vec } from "../src/types";

const player = (): Player => ({
  x: 300,
  y: 200,
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
const step = (p: Player, dir: Vec, dt = 1 / 60) =>
  movePlayer(p, SHARKS[0], dir, false, false, 0, 0, [], dt, {
    splash: () => {},
    broke: () => {},
  });

describe("迅速响应、少量惯性与三维转身", () => {
  it("反向输入在 0.35 秒内反转速度，旧方向位移小于两米", () => {
    const p = player();
    p.vx = SHARKS[0].speed;
    const start = p.x;
    let furthest = start;
    for (let i = 0; i < 21; i++) {
      step(p, { x: -1, y: 0 });
      furthest = Math.max(furthest, p.x);
    }
    expect(p.vx).toBeLessThan(-15);
    expect(furthest - start).toBeLessThan(2);
    expect(Math.abs(p.y - 200)).toBeLessThan(4);
  });
  it("松手保留短滑行并在半秒内明显停稳", () => {
    const p = player();
    p.vx = SHARKS[0].speed;
    for (let i = 0; i < 30; i++) step(p, { x: 0, y: 0 });
    expect(p.x - 300).toBeGreaterThan(2);
    expect(p.x - 300).toBeLessThan(5);
    expect(p.vx).toBeLessThan(1.1);
  });
  it("30/60/120Hz 下连续转向的最终位置相近", () => {
    const results = [30, 60, 120].map((hz) => {
      const p = player();
      for (const dir of [
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: -1, y: 0 },
        { x: 0, y: -1 },
      ])
        for (let i = 0; i < hz; i++) step(p, dir, 1 / hz);
      return p;
    });
    expect(
      Math.hypot(results[0].x - results[2].x, results[0].y - results[2].y),
    ).toBeLessThan(2);
  });
  it("四向模型鼻尖方向正确，左右游动背鳍均朝上且无负缩放", () => {
    for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 2.4, -2.4]) {
      const q = swimOrientation(angle, Math.cos(angle) < 0 ? -1 : 1);
      const nose = new T.Vector3(1, 0, 0).applyQuaternion(q);
      expect(nose.x).toBeCloseTo(Math.cos(angle), 8);
      expect(nose.y).toBeCloseTo(-Math.sin(angle), 8);
    }
    const up = new T.Vector3(0, 1, 0).applyQuaternion(
      swimOrientation(Math.PI, -1),
    );
    expect(up.y).toBeCloseTo(1);
    const model = new T.Group();
    animateSwimming(model, 0, 1, 20, 1 / 60, 0);
    const before = model.quaternion.clone();
    animateSwimming(model, Math.PI, -1, 20, 1 / 60, 0);
    expect(before.angleTo(model.quaternion)).toBeLessThan(0.26);
    expect(model.scale.toArray()).toEqual([1, 1, 1]);
    const paused = model.quaternion.clone();
    for (let i = 0; i < 60; i++) animateSwimming(model, Math.PI, -1, 20, 0, 0);
    expect(paused.angleTo(model.quaternion)).toBeCloseTo(0, 7);
  });
});

describe("攻击预警与实际轨迹一致", () => {
  it("末段锁定后侧移不会改变敌鱼出招方向", () => {
    const eco = new Ecology(11),
      e = eco.spawn("rival", 100, 100, [])!;
    e.timer = 0.6;
    trackAttack(e, { x: 150, y: 100 });
    e.timer = 0.2;
    trackAttack(e, { x: 150, y: 100 });
    expect(e.locked).toBe(true);
    e.timer = 0.1;
    trackAttack(e, { x: 100, y: 180 });
    expect(e.angle).toBe(0);
    const p = player();
    p.x = 100;
    p.y = 180;
    e.state = "warn";
    e.timer = 0.005;
    eco.update({
      player: p,
      terrain: [],
      dt: 1 / 60,
      time: 1,
      tick: 1,
      endless: false,
      slow: false,
      damage: vi.fn(),
      shoot: vi.fn(),
      warning: vi.fn(),
    });
    expect(e.state).toBe("attack");
    expect(e.vx).toBeGreaterThan(0);
    expect(e.vy).toBeCloseTo(0);
  });
  it("预警中隔开岩壁会取消攻击，收招阶段不能继续伤害", () => {
    const eco = new Ecology(3),
      e = eco.spawn("angler", 100, 100, [])!;
    const p = player();
    p.x = 140;
    p.y = 100;
    e.state = "warn";
    e.timer = 0.4;
    const damage = vi.fn();
    const context = {
      player: p,
      terrain: [
        { id: "wall", x: 118, y: 70, w: 10, h: 60, shape: "rock" as const },
      ],
      dt: 1 / 60,
      time: 1,
      tick: 1,
      endless: false,
      slow: false,
      damage,
      shoot: vi.fn(),
      warning: vi.fn(),
    };
    eco.update(context);
    expect(e.state).toBe("recover");
    p.x = e.x;
    p.y = e.y;
    for (let i = 0; i < 30; i++) eco.update(context);
    expect(damage).not.toHaveBeenCalled();
  });
  it("下冲预警绘制在敌人下方，离屏威胁有独立边缘标记", () => {
    const eco = new Ecology(1),
      e = eco.spawn("rival", 200, 150, [])!;
    e.state = "warn";
    e.angle = Math.PI / 2;
    e.timer = 0.5;
    const view = { screen: (p: Vec) => p, width: 844, height: 390, scale: 1 };
    const svg = threatOverlay(e, view);
    expect(svg).toContain("蓄力 0.5s");
    expect(svg).toContain("187"); // 150 + 37 米下冲终点。
    e.x = -100;
    expect(threatOverlay(e, view)).toContain('class="threat-edge"');
    e.state = "patrol";
    expect(threatOverlay(e, view)).toBe("");
    expect(attackProfile(e).duration).toBeLessThan(0.9);
    expect(attackProfile({ kind: "boss", attack: 1, phase: 2 }).range).toBe(135);
  });
});
