import type { Vec, Terrain } from "../types";
export const clamp = (v: number, a: number, b: number) =>
  Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export const angleDelta = (a: number, b: number) =>
  Math.atan2(Math.sin(b - a), Math.cos(b - a));
export function norm(x: number, y: number): Vec {
  const n = Math.hypot(x, y) || 1;
  return { x: x / n, y: y / n };
}
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
/** 点到线段的最近距离用于高速鱼嘴扫掠，不能只测本帧终点。 */
export function segmentDistance(p: Vec, a: Vec, b: Vec) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = clamp(
    ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
    0,
    1,
  );
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
}
export function inside(p: Vec, t: Terrain, pad = 0) {
  return (
    !t.broken &&
    p.x > t.x - pad &&
    p.x < t.x + t.w + pad &&
    p.y > t.y - pad &&
    p.y < t.y + t.h + pad
  );
}
/** 线段与 AABB 的 slab 检测：捕食和鱼叉都共享此遮挡规则。 */
export function blocked(a: Vec, b: Vec, terrain: Terrain[]) {
  return terrain.some((t) => {
    if (t.broken) return false;
    let lo = 0,
      hi = 1;
    for (const k of ["x", "y"] as const) {
      const d = b[k] - a[k],
        min = t[k],
        max = min + (k === "x" ? t.w : t.h);
      if (Math.abs(d) < 1e-6) {
        if (a[k] <= min || a[k] >= max) return false;
      } else {
        let u = (min - a[k]) / d,
          v = (max - a[k]) / d;
        if (u > v) [u, v] = [v, u];
        lo = Math.max(lo, u);
        hi = Math.min(hi, v);
        if (lo > hi) return false;
      }
    }
    return lo < 0.98 && hi > 0.02;
  });
}
/** 圆与地形的最小平移解。只更正碰撞轴，保留沿壁游动；外部仍负责速度投影。 */
export function resolveTerrain(p: Vec, r: number, terrain: Terrain[]) {
  let nx = 0,
    ny = 0;
  for (const t of terrain) {
    if (t.broken) continue;
    const qx = clamp(p.x, t.x, t.x + t.w),
      qy = clamp(p.y, t.y, t.y + t.h);
    let dx = p.x - qx,
      dy = p.y - qy;
    const d = Math.hypot(dx, dy);
    if (d < r) {
      if (d > 0.001) {
        p.x += (dx / d) * (r - d);
        p.y += (dy / d) * (r - d);
        nx = dx / d;
        ny = dy / d;
      } else {
        const sides = [
          { d: Math.abs(p.x - t.x), x: t.x - r, y: p.y, nx: -1, ny: 0 },
          {
            d: Math.abs(p.x - t.x - t.w),
            x: t.x + t.w + r,
            y: p.y,
            nx: 1,
            ny: 0,
          },
          { d: Math.abs(p.y - t.y), x: p.x, y: t.y - r, nx: 0, ny: -1 },
          {
            d: Math.abs(p.y - t.y - t.h),
            x: p.x,
            y: t.y + t.h + r,
            nx: 0,
            ny: 1,
          },
        ].sort((a, b) => a.d - b.d)[0];
        p.x = sides.x;
        p.y = sides.y;
        nx = sides.nx;
        ny = sides.ny;
      }
    }
  }
  return { x: nx, y: ny };
}
