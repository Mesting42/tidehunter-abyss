import type { Player, SharkDef, ComboState } from "../types";
/** 生命是唯一饥饿资源；Boss 战消耗降至四分之一，开局 15 秒保护。暂停由 Game 停止整个步进。 */
export function hunger(
  p: Player,
  def: SharkDef,
  dt: number,
  time: number,
  boss: boolean,
  disabled: boolean,
) {
  if (disabled || time < 15) return;
  p.hp = Math.max(
    0,
    p.hp -
      def.hunger * (boss ? 0.25 : 1) * (p.boost ? 1.12 : 1) * dt -
      (p.stranded > 1 ? 7 * dt : 0),
  );
}
export function hurt(
  p: Player,
  combo: ComboState,
  amount: number,
  type: string,
  venom: boolean,
  training: boolean,
) {
  if (training || p.hurtCd > 0) return false;
  if ((combo.rage > 0 || combo.grace > 0) && type !== "mine") return false;
  if (venom && (type === "poison" || type === "spike")) amount *= 0.4;
  p.hp = Math.max(0, p.hp - amount);
  p.hurtCd = 0.9;
  combo.count = Math.floor(combo.count * 0.5);
  combo.multiplier = Math.max(1, Math.min(5, 1 + Math.floor(combo.count / 4)));
  return true;
}
export function updateCombo(
  c: ComboState,
  dt: number,
  onStart: () => void,
  onEnd: () => void,
  rageDuration: number,
) {
  c.time = Math.max(0, c.time - dt);
  c.grace = Math.max(0, c.grace - dt);
  if (c.time === 0 && c.count) {
    c.count = 0;
    c.multiplier = 1;
  }
  if (c.rage > 0) {
    c.rage = Math.max(0, c.rage - dt);
    if (c.rage === 0) {
      c.charge = 0;
      c.grace = 2.5;
      onEnd();
    }
  } else if (c.charge >= 100 && c.grace <= 0) {
    c.charge = 0;
    c.rage = rageDuration;
    onStart();
  }
}
export function addCatch(c: ComboState, score: number) {
  c.count++;
  c.time = 7;
  c.multiplier = Math.min(5, 1 + Math.floor(c.count / 4));
  if (c.rage <= 0)
    c.charge = Math.min(100, c.charge + 3.8 + Math.min(score, 200) * 0.025);
}
