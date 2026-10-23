import { describe, expect, it } from "vitest";
import * as T from "three";
import { SHARKS } from "../src/data";
import { mouth } from "../src/systems/combat";
import {
  animatePlayerSwimming,
  animateSwimming,
  PLAYER_MAX_PITCH,
  PLAYER_RENDER_DEPTH,
} from "../src/render/swimming";
import type { Player } from "../src/types";

const player = (angle: number, facing = 1, growth = 0): Player => ({
  x: 300,
  y: 190,
  vx: 0,
  vy: 27,
  angle,
  facing,
  growth,
  hp: 150,
  maxHp: 150,
  stamina: 100,
  skillCd: 0,
  skillTime: 0,
  hurtCd: 0,
  biteAnim: 0,
  airTime: 0,
  stranded: 0,
  xp: 0,
  boost: false,
  under: true,
  shieldUsed: false,
});
const model = () => {
  const m = new T.Group();
  const tail = new T.Group();
  tail.name = "tail";
  m.add(tail);
  return m;
};

describe("玩家斜游姿态与模拟边界", () => {
  it("上下游动保留最近左右朝向，稳定俯仰为 60 度而不竖直", () => {
    for (const facing of [-1, 1])
      for (const angle of [-Math.PI / 2, Math.PI / 2]) {
        const m = model(),
          p = player(angle, facing);
        for (let i = 0; i < 60; i++)
          animatePlayerSwimming(m, p, SHARKS[0], 1 / 60);
        const nose = new T.Vector3(1, 0, 0).applyQuaternion(m.quaternion);
        expect(Math.sign(nose.x)).toBe(facing);
        expect(Math.abs(nose.x)).toBeCloseTo(Math.cos(PLAYER_MAX_PITCH), 4);
        expect(Math.sign(nose.y)).toBe(-Math.sign(angle));
        expect(Math.abs(nose.y)).toBeLessThan(0.88);
        expect(m.scale.toArray()).toEqual([1, 1, 1]);
      }
  });
  it("四种鲨鱼与各成长阶段在连续转向时，显示嘴部始终对齐真实扫掠点", () => {
    for (const def of SHARKS)
      for (const growth of [0, 1, 3]) {
        const m = model(),
          p = player(0, 1, growth);
        m.scale.setScalar(1 + growth * 0.07);
        for (const angle of [
          0,
          -Math.PI / 2,
          Math.PI / 2,
          Math.PI,
          -2.4,
          2.4,
        ]) {
          p.angle = angle;
          if (Math.abs(Math.cos(angle)) > 0.12)
            p.facing = Math.sign(Math.cos(angle));
          animatePlayerSwimming(m, p, def, 1 / 60);
          m.updateMatrixWorld(true);
          const visible = new T.Vector3(def.length * 0.43, 0, 0).applyMatrix4(
            m.matrixWorld,
          );
          const actual = mouth(p, def);
          expect(visible.x).toBeCloseTo(actual.x, 7);
          expect(visible.y).toBeCloseTo(-actual.y, 7);
          expect(visible.z).toBeCloseTo(PLAYER_RENDER_DEPTH, 7);
        }
      }
  });
  it("尾部先保留上一姿态再收敛；暂停冻结且不修改玩家状态", () => {
    const m = model(),
      p = player(0);
    animatePlayerSwimming(m, p, SHARKS[0], 1 / 60);
    p.angle = -Math.PI / 2;
    const before = structuredClone(p);
    animatePlayerSwimming(m, p, SHARKS[0], 1 / 60);
    expect(m.userData.tailPitch).toBeGreaterThan(-PLAYER_MAX_PITCH);
    expect(Math.abs(m.getObjectByName("tail")!.rotation.z)).toBeGreaterThan(
      0.2,
    );
    for (let i = 0; i < 90; i++) animatePlayerSwimming(m, p, SHARKS[0], 1 / 60);
    expect(m.userData.tailPitch).toBeCloseTo(-PLAYER_MAX_PITCH, 4);
    const q = m.quaternion.clone(),
      pos = m.position.clone();
    const tail = m.getObjectByName("tail")!.rotation.clone();
    for (let i = 0; i < 60; i++) animatePlayerSwimming(m, p, SHARKS[0], 0);
    expect(m.quaternion.angleTo(q)).toBeCloseTo(0, 7);
    expect(m.position.distanceTo(pos)).toBeCloseTo(0, 7);
    expect(m.getObjectByName("tail")!.rotation.toArray()).toEqual(
      tail.toArray(),
    );
    expect(p).toEqual(before);
  });
  it("敌鱼不受玩家俯仰限制，攻击方向仍与预警一致", () => {
    const m = model();
    animateSwimming(m, Math.PI / 2, 1, 30, 1 / 60, 0);
    const nose = new T.Vector3(1, 0, 0).applyQuaternion(m.quaternion);
    expect(nose.x).toBeCloseTo(0, 8);
    expect(nose.y).toBeCloseTo(-1, 8);
  });
});
