import type { Entity, Vec } from "../types";
import { clamp } from "../core/math";
import { species } from "../data";
import { attackProfile } from "../systems/threats";

interface ThreatView {
  screen: (p: Vec) => Vec;
  width: number;
  height: number;
  scale: number;
}

/** 纯投影层：不改变敌人和碰撞。屏幕 y 与模拟 y 同向，避免预警上下颠倒。 */
export function threatOverlay(e: Entity, view: ThreatView) {
  const preparing = ["warn", "warning", "aim"].includes(e.state);
  const attacking = ["attack", "pulse"].includes(e.state);
  const recovering = e.state === "recover" && e.kind !== "boss";
  if (!preparing && !attacking && !recovering) return "";
  const a = view.screen(e),
    profile = attackProfile(e),
    size = species(e.kind).size;
  const color = recovering ? "#a5e1c8" : "#ff8177";
  const compact = view.height < 500,
    marginX = compact ? 31 : 46;
  const left = marginX,
    right = view.width - marginX;
  const top = compact ? 92 : 148,
    bottom = view.height - (compact ? 107 : 85);
  const offscreen =
    a.x < 12 || a.x > view.width - 12 || a.y < 12 || a.y > view.height - 12;
  if (offscreen) {
    if (!preparing && !attacking) return "";
    // 从屏幕中心作射线与安全矩形相交，保持箭头指向准确，避开摇杆与 HUD。
    const cx = view.width / 2,
      cy = (top + bottom) / 2;
    const dx = a.x - cx,
      dy = a.y - cy;
    const t = Math.min(
      dx > 0 ? (right - cx) / dx : (left - cx) / dx,
      dy > 0 ? (bottom - cy) / dy : (top - cy) / dy,
    );
    const x = cx + dx * t,
      y = cy + dy * t,
      angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    return `<g class="threat-edge" transform="translate(${x} ${y})"><circle r="18" fill="#251d26" stroke="${color}" stroke-width="2"/><path d="M-8 -7 9 0-8 7-4 0Z" transform="rotate(${angle})" fill="${color}"/><text y="34" text-anchor="middle" fill="${color}">${preparing ? e.timer.toFixed(1) + "s" : "来袭"}</text></g>`;
  }
  if (recovering) {
    return `<g class="threat-recover"><ellipse cx="${a.x}" cy="${a.y}" rx="${Math.max(12, size * 0.6 * view.scale)}" ry="${Math.max(9, size * 0.3 * view.scale)}" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="3 6"/><text x="${a.x}" y="${a.y - size * 0.45 * view.scale - 12}" text-anchor="middle" fill="${color}">回气 · 可反击</text></g>`;
  }
  const x = Math.cos(e.angle),
    y = Math.sin(e.angle),
    k = view.scale;
  // 冲刺开始后只标出剩余路程，不能把完整蓄力距离再次从移动中的鱼嘴向前延伸。
  const remainingRange =
    attacking && profile.shape === "charge"
      ? Math.hypot(e.vx, e.vy) * Math.max(0, e.timer)
      : profile.range;
  const len = remainingRange * k,
    half = (size * 0.28 + (e.kind === "boss" ? 12 : 5)) * k;
  let region = "";
  if (profile.shape === "ring" || profile.shape === "radial") {
    const r = profile.range * k;
    region = `<circle cx="${a.x}" cy="${a.y}" r="${r}"/>`;
    if (profile.shape === "radial")
      for (let i = 0; i < (e.phase === 2 ? 12 : 8); i++) {
        const ang = (i * Math.PI * 2) / (e.phase === 2 ? 12 : 8);
        region += `<path d="M${a.x + Math.cos(ang) * r * 0.25} ${a.y + Math.sin(ang) * r * 0.25}L${a.x + Math.cos(ang) * r} ${a.y + Math.sin(ang) * r}"/>`;
      }
  } else if (profile.shape === "fan") {
    const lo = e.angle - 0.65,
      hi = e.angle + 0.65;
    region = `<path d="M${a.x} ${a.y}L${a.x + Math.cos(lo) * len} ${a.y + Math.sin(lo) * len}A${len} ${len} 0 0 1 ${a.x + Math.cos(hi) * len} ${a.y + Math.sin(hi) * len}Z"/>`;
  } else if (profile.shape === "harpoon") {
    region = `<path d="M${a.x} ${a.y}L${a.x + x * len} ${a.y + y * len}"/>`;
  } else {
    region = `<path d="M${a.x - y * half} ${a.y + x * half}L${a.x + x * len - y * half} ${a.y + y * len + x * half}L${a.x + x * len + y * half} ${a.y + y * len - x * half}L${a.x + y * half} ${a.y - x * half}Z"/><path d="M${a.x + x * len * 0.7 - y * 8} ${a.y + y * len * 0.7 + x * 8}L${a.x + x * len * 0.7 + x * 11} ${a.y + y * len * 0.7 + y * 11}L${a.x + x * len * 0.7 + y * 8} ${a.y + y * len * 0.7 - x * 8}" fill="none"/>`;
  }
  const r = Math.max(15, size * 0.65 * k),
    circumference = Math.PI * 2 * r;
  const progress = preparing ? clamp(1 - e.timer / profile.duration, 0, 1) : 1;
  const label = attacking
    ? "攻击中"
    : e.locked
      ? "锁定 · 闪避"
      : `蓄力 ${Math.max(0, e.timer).toFixed(1)}s`;
  return `<g class="threat-zone" stroke="${color}" stroke-width="${attacking ? 2.5 : 1.8}" fill="${attacking ? "#f45f5930" : "#f45f5918"}" stroke-dasharray="${preparing && !e.locked ? "7 5" : "none"}">${region}</g><g class="threat-source"><ellipse cx="${a.x}" cy="${a.y}" rx="${size * 0.65 * k + 5}" ry="${size * 0.32 * k + 5}" stroke="${color}" fill="none" stroke-width="2.5"/><circle cx="${a.x}" cy="${a.y}" r="${r}" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="${circumference * progress} ${circumference}" transform="rotate(-90 ${a.x} ${a.y})"/><text x="${a.x}" y="${a.y - r - 13}" fill="${color}" text-anchor="middle">${label}</text></g>`;
}
