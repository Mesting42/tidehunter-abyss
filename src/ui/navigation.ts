import { clamp } from "../core/math";

/** 导航提示停留在可视海域内，避开左侧生命/目标栏与右侧地图、触控按钮。 */
export function navigationX(x: number, width: number, height: number) {
  const short = height < 500;
  const left = Math.min(short ? 240 : 320, width / 2);
  const right = Math.max(width - (short ? 180 : 230), width / 2);
  return clamp(x, left, right);
}
