import type { Entity } from "../types";

/** 攻击时序与形状的单一来源，AI 与 HUD 共用，保证预警对应真实伤害范围。 */
export function attackProfile(e: Pick<Entity, "kind" | "attack" | "phase">) {
  if (e.kind === "boss") {
    const type = Math.round(e.attack) % 3;
    return {
      duration: e.phase === 2 ? 1.25 : 1.8,
      lock: 0.28,
      shape: type === 1 ? "radial" : type === 2 ? "ring" : "charge",
      range: type === 2 ? 43 : type === 1 ? 135 : 82,
    } as const;
  }
  if (e.kind === "mine")
    return { duration: 1.3, lock: 1.3, shape: "ring", range: 23 } as const;
  if (e.kind === "boat" || e.kind === "turret")
    return { duration: 1.4, lock: 0.22, shape: "harpoon", range: 100 } as const;
  if (e.kind === "eliteAmbush")
    return { duration: 1.05, lock: 0.25, shape: "fan", range: 65 } as const;
  return {
    duration: e.kind === "eliteRam" ? 1 : e.kind === "angler" ? 0.7 : 0.76,
    lock: 0.22,
    shape: "charge",
    range: e.kind === "eliteRam" ? 76 : e.kind === "rival" ? 37 : 30,
  } as const;
}

/** 最后数帧锁定方向，玩家侧移后敌人不会在出招瞬间重新瞄准。 */
export function trackAttack(e: Entity, target: { x: number; y: number }) {
  const profile = attackProfile(e);
  if (e.locked) return;
  e.angle = Math.atan2(target.y - e.y, target.x - e.x);
  if (e.timer <= profile.lock) e.locked = true;
}
