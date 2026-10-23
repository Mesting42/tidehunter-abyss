import type { Player, SharkDef, Terrain, Vec } from "../types";
import { angleDelta, clamp, lerp, resolveTerrain } from "../core/math";
import { WORLD } from "../data";
export interface MoveEffects {
  splash: (p: Vec) => void;
  broke: (id: string) => void;
}
/** 水中主动加速；离水切换重力。冲刺只是加速/破坏许可，所有状态都走实体碰撞。 */
export function movePlayer(
  p: Player,
  def: SharkDef,
  dir: Vec,
  wantBoost: boolean,
  rage: boolean,
  recovery: number,
  speedUpgrade: number,
  terrain: Terrain[],
  dt: number,
  fx: MoveEffects,
  current: Vec = { x: 0, y: 0 },
) {
  const oldUnder = p.under,
    oldBoost = p.boost;
  const steering = Math.hypot(dir.x, dir.y) > 0.05;
  p.boost =
    wantBoost &&
    steering &&
    (p.stamina > 1 || rage || (p.skillTime > 0 && def.id === "mako")) &&
    p.y > WORLD.surface - 2;
  if (p.boost) {
    if (!rage && !(p.skillTime > 0 && def.id === "mako"))
      p.stamina = Math.max(0, p.stamina - 27 * dt);
  } else p.stamina = Math.min(100, p.stamina + (18 + recovery) * dt);
  if (steering) {
    const target = Math.atan2(dir.y, dir.x);
    // 迅速建立新朝向；掉头减速，避免仍以全速沿旧朝向绕出大圈。
    p.angle += clamp(
      angleDelta(p.angle, target),
      -def.turn * 1.75 * dt,
      def.turn * 1.75 * dt,
    );
    if (Math.abs(Math.cos(p.angle)) > 0.12)
      p.facing = Math.cos(p.angle) > 0 ? 1 : -1;
  }
  const alignment = steering
    ? Math.max(0, Math.cos(angleDelta(p.angle, Math.atan2(dir.y, dir.x))))
    : 1;
  const speed =
    (p.boost ? def.boost : def.speed) *
    (1 + speedUpgrade * 0.055) *
    (1 + p.growth * 0.035) *
    (0.22 + alignment * 0.78);
  const opposing = steering && p.vx * dir.x + p.vy * dir.y < 0;
  // 松手留约四米滑行；反向先制动，90 度转向则保留少量水中惯性。
  const accel = !steering ? 6.5 : opposing ? 20 : 13;
  if (p.y >= WORLD.surface) {
    p.vx = lerp(
      p.vx,
      (steering ? Math.cos(p.angle) * speed : 0) + current.x,
      1 - Math.exp(-accel * dt),
    );
    p.vy = lerp(
      p.vy,
      (steering ? Math.sin(p.angle) * speed : 0) + current.y,
      1 - Math.exp(-accel * dt),
    );
    p.airTime = 0;
  } else {
    p.vx += dir.x * 13 * dt;
    p.vy += 55 * dt + dir.y * 9 * dt;
    p.airTime += dt;
    if (!steering && Math.hypot(p.vx, p.vy) > 8)
      p.angle += clamp(
        angleDelta(p.angle, Math.atan2(p.vy, p.vx)),
        -dt * 2,
        dt * 2,
      );
  }
  // 快速向上越过海面时保留惯性；普通游动只能微微露出，不会悬空游泳。
  if (
    p.y >= WORLD.surface &&
    p.y + p.vy * dt < WORLD.surface &&
    !p.boost &&
    p.vy > -40
  ) {
    p.y = WORLD.surface;
    p.vy = Math.max(p.vy, -3);
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  for (const t of terrain) {
    if (
      !t.broken &&
      t.breakable &&
      (p.boost || rage) &&
      def.level + (rage ? 2 : 0) >= t.breakable &&
      p.x > t.x - def.length * 0.5 - 3 &&
      p.x < t.x + t.w + def.length * 0.5 + 3 &&
      p.y > t.y - def.length * 0.5 - 3 &&
      p.y < t.y + t.h + def.length * 0.5 + 3
    ) {
      t.broken = true;
      fx.broke(t.id);
    }
  }
  const collision = resolveTerrain(p, 3.2 + p.growth * 0.2, terrain);
  // 用头、躯干、尾柄三个圆近似胶囊，避免中心未碰壁时鼻尖已经穿入岩石。
  // 校正传回中心，保留沿岩壁滑动能力；所有鲨鱼使用同一规则。
  for (let pass = 0; pass < 3; pass++) {
    for (const offset of [
      def.length * 0.38 * (1 + p.growth * 0.07),
      -def.length * 0.32 * (1 + p.growth * 0.07),
    ]) {
      const part = {
        x: p.x + Math.cos(p.angle) * offset,
        y: p.y + Math.sin(p.angle) * offset,
      };
      const before = { ...part },
        hit = resolveTerrain(part, offset > 0 ? 2.6 : 1.9, terrain);
      p.x += part.x - before.x;
      p.y += part.y - before.y;
      if (hit.x) collision.x = hit.x;
      if (hit.y) collision.y = hit.y;
    }
  }
  if (collision.x) p.vx = 0;
  if (collision.y) p.vy = 0;
  p.x = clamp(p.x, 8, WORLD.width - 8);
  p.y = clamp(p.y, -26, WORLD.floor - 5);
  p.under = p.y >= WORLD.surface;
  if (p.under !== oldUnder) {
    fx.splash(p);
    if (p.under) {
      p.vy *= 0.73;
      p.hurtCd = Math.max(p.hurtCd, 0.4);
    }
  }
  if (!p.under && Math.hypot(p.vx, p.vy) < 10 && p.airTime > 0.7) {
    p.stranded += dt;
    p.vx += (p.x < 65 ? 12 : 0) * dt;
    p.vy += 15 * dt;
  } else p.stranded = 0;
  // 检测船角搁浅，给向下逃离的机会，超过数秒则把玩家移到邻近水域。
  if (p.stranded > 3.5) {
    p.x = Math.max(68, p.x);
    p.y = WORLD.surface + 18;
    p.vy = 12;
    p.stranded = 0;
  }
  return !oldBoost && p.boost;
}
