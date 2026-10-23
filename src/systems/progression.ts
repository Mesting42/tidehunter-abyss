import type { RunStats, SaveData } from "../types";
import { TASKS } from "../data";
export function newStats(): RunStats {
  return {
    time: 0,
    score: 0,
    eaten: 0,
    boostEaten: 0,
    fishTypes: [],
    maxCombo: 0,
    leaps: 0,
    nets: 0,
    wreck: 0,
    cave: 0,
    iceTime: 0,
    frenzy: 0,
    frenzyKills: 0,
    elites: 0,
    boss: 0,
    distance: 0,
    treasures: 0,
    relic: 0,
    paidScore: 0,
    runCounted: false,
    currency: 0,
    visited: [],
    claims: [],
  };
}
/** 任务最多激活两项。提前达成的行为会保留，但必须按顺序结算，奖励只经 claim 队列发放。 */
export function taskProgress(s: RunStats, index: number) {
  const t = TASKS[index];
  return t ? Math.min(t.goal, Math.floor(s[t.key] as number)) : 0;
}
export function unlockedByPlay(
  save: SaveData,
  score: number,
  elites: number,
  win: boolean,
) {
  const out: string[] = [];
  const add = (id: string) => {
    if (!save.unlocked.includes(id)) {
      save.unlocked.push(id);
      out.push(id);
    }
  };
  if (score >= 1000 || save.runs >= 1 || win) add("mako");
  if (elites > 0 || win || save.runs >= 3) add("hammer");
  if (win || save.runs >= 5) add("abyss");
  return out;
}
