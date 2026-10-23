import type {
  ComboState,
  Entity,
  Player,
  SharkDef,
  Terrain,
  Vec,
} from "../types";
import { species } from "../data";
import { blocked, dist, segmentDistance } from "../core/math";
export interface CombatContext {
  player: Player;
  def: SharkDef;
  combo: ComboState;
  entities: Entity[];
  terrain: Terrain[];
  oldMouth: Vec;
  time: number;
  biteUpgrade: number;
  kill: (e: Entity) => void;
  hit: (e: Entity) => void;
  damage: (n: number, type: string) => void;
  hint: (text: string) => void;
}
export function mouth(p: Player, def: SharkDef): Vec {
  const reach = def.length * (1 + p.growth * 0.07) * 0.43;
  return {
    x: p.x + Math.cos(p.angle) * reach,
    y: p.y + Math.sin(p.angle) * reach,
  };
}
/** 各目标有独立攻击时间戳。鱼嘴扫掠、前向锥和地形视线同时成立才会咬中。 */
export function feed(c: CombatContext) {
  const p = c.player,
    m = mouth(p, c.def),
    rage = c.combo.rage > 0,
    tier = c.def.level + (rage ? 2 : 0);
  for (const e of c.entities) {
    if (!e.alive || (e.kind === "boss" && e.state === "dormant")) continue;
    const def = species(e.kind),
      d = dist(e, p),
      radius = def.size * (def.rule === "boss" ? 0.18 : 0.4) + 2.2;
    // 巨鳗弱点是实际鳃口位置，不能从尾端在整个恢复期蹭出伤害。
    const target =
      def.rule === "boss"
        ? {
            x: e.x + Math.cos(e.angle) * def.size * 0.22,
            y: e.y + Math.sin(e.angle) * def.size * 0.22,
          }
        : e;
    const swept = segmentDistance(target, c.oldMouth, m) < radius;
    const front =
      (target.x - p.x) * Math.cos(p.angle) +
        (target.y - p.y) * Math.sin(p.angle) >
      0;
    const close = swept && front && !blocked(p, target, c.terrain);
    if (close) {
      if (def.id === "mine") continue;
      if (c.time - e.biteAt < (rage ? 0.22 : 0.42)) continue;
      if (def.rule === "boss" && !(e.weak! > 0)) {
        c.hint("鳃口闭合 · 等待弱点窗口");
        continue;
      }
      if ((def.rule === "machine" || def.rule === "ram") && !p.boost && !rage) {
        c.hint("需要冲刺撞击");
        continue;
      }
      if (
        def.level > tier &&
        def.rule !== "elite" &&
        def.rule !== "boss" &&
        !(p.boost && def.rule === "predator")
      ) {
        if (def.rule === "poison" || def.rule === "spike") {
          if (!(p.skillTime > 0 && c.def.id === "abyss")) {
            c.damage(def.rule === "poison" ? 12 : 16, def.rule);
            c.hint("危险目标 · 等级不足");
            continue;
          }
        } else {
          c.hint("目标等级较高 · 冲刺反击或狂暴");
          continue;
        }
      }
      e.biteAt = c.time;
      p.biteAnim = 0.24;
      let damage =
        c.def.bite *
        (1 + c.biteUpgrade * 0.14) *
        (1 + p.growth * 0.1) *
        (p.boost ? 1.75 : 1) *
        (rage ? 1.8 : 1);
      if (def.id === "net" && p.boost) damage *= 1.2;
      if (def.rule === "boss") damage *= p.boost ? 1 : 0.55;
      e.hp -= damage;
      c.hit(e);
      if (e.hp <= 0) {
        e.alive = false;
        c.kill(e);
      }
    }
    if (e.alive && d < def.size * 0.3 + 3.2) {
      if (def.rule === "poison") c.damage(10, "poison");
      if (def.rule === "spike") c.damage(14, "spike");
      if (def.id === "net") {
        p.vx *= 0.85;
        p.vy *= 0.85;
        c.hint("被渔网拖慢 · 冲刺挣脱");
      }
      if (def.rule === "elite" && e.state === "attack") c.damage(24, "bite");
    }
  }
}
