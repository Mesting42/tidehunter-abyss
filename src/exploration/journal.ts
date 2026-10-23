import { EXPEDITIONS, LANDMARKS, ENCOUNTERS } from "./data";
import type { Exploration } from "./system";
import { REGIONS } from "../data";

const stamp = (index: number) =>
  `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3 35 12v16L20 37 5 28V12Z"/><path d="${["M11 24q4-15 9-3t9-5M14 11v17m12-17v17", "M12 12h16v16H12zM9 20h22m-11-11v22", "M20 9v22M10 14l20 12M10 26l20-12", "M20 9 30 20 20 31 10 20ZM15 20h10"][index]}"/></svg>`;

/** 记录页只展示已经发生的发现；未知地点保留区域线索，追踪由玩家主动选择。 */
export function explorationJournal(
  e: Exploration,
  training: boolean,
  skinOwned: boolean,
) {
  const d = e.data;
  return `<div class="exploration-journal"><div class="exploration-summary"><p>${training ? "训练中的发现仅作练习，离开后不会写入收藏。" : "顺着微光、气泡与潮声，记录海域中的另一段故事。"}</p><div class="exploration-totals"><span>发现 <b>${d.found.length} / 8</b></span><span>海域印记 <b>${d.completed.length} / 4</b></span><span>途中遭遇 <b>${d.encounters.length} / 2</b></span></div></div><div class="expedition-list">${EXPEDITIONS.map(
    (q, i) => {
      const found = e.found(q.id),
        done = e.done(q.id),
        tracked = d.tracked === q.id;
      return `<article class="expedition-row ${done ? "complete" : ""}"><div class="expedition-stamp ${done ? "earned" : ""}" style="--stamp-color:${q.color}">${stamp(i)}</div><div class="expedition-copy"><h2>${found ? q.name : "尚未记录的回声"}</h2><p class="expedition-region">${REGIONS.find((r) => r.id === q.region)!.name} · ${done ? "印记已收藏" : found ? "线索已发现" : "等待发现"}</p><p>${found ? e.instruction(q.id) : ["浅湾的鱼群正围绕珊瑚微光停留。", "沉船东侧，有一串不寻常的气泡。", "冰层下的涌流似乎通往另一片水域。", "深海石碑上的光纹仍在等待回应。"][i]}</p>${found && !done ? `<p class="expedition-clue">${q.clue}</p>` : ""}</div><button class="secondary expedition-track" data-action="track-exploration" data-id="${q.id}" ${!found ? "disabled" : ""}>${tracked ? "停止追踪" : done ? "查看位置" : "追踪线索"}</button></article>`;
    },
  ).join(
    "",
  )}</div><div class="exploration-foot"><section><h2>海域奇景</h2><div class="landmark-list">${LANDMARKS.map((l) => `<div><span>${e.found(l.id) ? l.name : "未记录的奇景"}<small>${REGIONS.find((r) => r.id === l.region)!.name}${d.claims.includes(l.id) ? " · 已记录" : ""}</small></span><button data-action="track-exploration" data-id="${l.id}" ${!e.found(l.id) ? "disabled" : ""}>${d.tracked === l.id ? "停止追踪" : d.claims.includes(l.id) ? "查看位置" : e.found(l.id) ? "前往记录" : "待发现"}</button></div>`).join("")}</div></section><section><h2>途中遭遇</h2><div class="landmark-list">${ENCOUNTERS.map((v) => `<div><span>${d.seenEncounters.includes(v.id) ? v.name : "未记录的遭遇"}<small>${d.encounters.includes(v.id) ? "赠礼已领取" : d.seenEncounters.includes(v.id) ? v.clue : "跟随海域中的异常微光。"}</small></span><button data-action="track-exploration" data-id="${v.id}" ${!d.seenEncounters.includes(v.id) ? "disabled" : ""}>${d.tracked === v.id ? "停止追踪" : d.encounters.includes(v.id) ? "查看位置" : "追踪"}</button></div>`).join("")}</div></section></div><div class="exploration-reward"><div><h2>四海的回潮</h2><p>集齐四枚海域印记，解锁独有外观「回潮鳍纹」。支线、奇景和遭遇的潮晶奖励，每份存档仅领取一次。</p></div><button class="primary" data-action="wear-explorer" ${!skinOwned || training ? "disabled" : ""}>${skinOwned ? "穿上回潮鳍纹" : "印记 " + d.completed.length + " / 4"}</button></div></div>`;
}
