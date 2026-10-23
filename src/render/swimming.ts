import * as T from "three";
import { clamp } from "../core/math";
import type { Player, SharkDef } from "../types";

const target = new T.Quaternion();
const pose = new T.Euler(0, 0, 0, "YZX");
const visibleMouth = new T.Vector3();
export const PLAYER_MAX_PITCH = Math.PI / 3;
// 岩石装饰倒角最前沿约为 z=21。玩家保持在其前方，贴墙时仍可辨认头部与姿态。
export const PLAYER_RENDER_DEPTH = 26;

/** 在三维空间转身而非负缩放镜像。左右游动都保持背鳍朝上，竖直过渡通过四元数平滑。 */
export function swimOrientation(
  angle: number,
  facing: number,
  out = new T.Quaternion(),
  maxPitch = Math.PI / 2,
) {
  pose.set(
    0,
    facing < 0 ? Math.PI : 0,
    -clamp(Math.asin(Math.sin(angle)), -maxPitch, maxPitch),
    "YZX",
  );
  return out.setFromEuler(pose);
}

/** 动画状态只留在模型，绝不回写碰撞和捕食状态。暂停时 dt 为零，身体也同步静止。 */
export function animateSwimming(
  model: T.Group,
  angle: number,
  facing: number,
  speed: number,
  dt: number,
  bite: number,
  maxPitch = Math.PI / 2,
) {
  swimOrientation(angle, facing, target, maxPitch);
  if (!model.userData.swimReady) {
    model.quaternion.copy(target);
    model.userData.swimReady = true;
  } else model.quaternion.rotateTowards(target, dt * 15);
  const state = model.userData;
  // 玩家前身先建立姿态，尾鳍以较慢的阻尼跟随俯仰；不影响敌鱼的真实出招方向。
  const pitch = clamp(Math.asin(Math.sin(angle)), -maxPitch, maxPitch);
  state.tailPitch =
    state.tailPitch === undefined
      ? pitch
      : state.tailPitch + (pitch - state.tailPitch) * (1 - Math.exp(-dt * 7));
  state.swimSpeed =
    (state.swimSpeed ?? 0) +
    (speed - (state.swimSpeed ?? 0)) * (1 - Math.exp(-dt * 8));
  state.swimPhase =
    (state.swimPhase ?? model.id) +
    dt * (3.5 + Math.min(80, state.swimSpeed) * 0.15);
  const effort = clamp(state.swimSpeed / 35, 0, 1);
  // 轻微顺轴摆体与尾摆同相位；顺轴旋转不改变鱼嘴方向。暂停不累加姿态。
  if (dt > 0) model.rotateX(Math.sin(state.swimPhase) * 0.025 * effort);
  const tail = model.getObjectByName("tail");
  if (tail) {
    tail.rotation.y = Math.sin(state.swimPhase) * (0.07 + effort * 0.29);
    tail.rotation.z =
      Math.sin(state.swimPhase * 0.5) * 0.025 * effort +
      (maxPitch < Math.PI / 2
        ? clamp(pitch - state.tailPitch, -0.28, 0.28)
        : 0);
  }
  const jaw = model.getObjectByName("jaw");
  if (jaw)
    jaw.rotation.z = -Math.sin(clamp(bite / 0.24, 0, 1) * Math.PI) * 0.24;
}

/**
 * 玩家专用显示姿态：俯仰最多 60 度，左右朝向沿用逻辑中的稳定 facing。
 * 模型绕可见咬合点定位，因此身体倾斜后鱼嘴仍落在 combat.mouth 的真实位置。
 * 只写渲染对象；速度、逻辑角度、地形碰撞和嘴部扫掠均由模拟系统持有。
 */
export function animatePlayerSwimming(
  model: T.Group,
  player: Player,
  def: SharkDef,
  dt: number,
) {
  animateSwimming(
    model,
    player.angle,
    player.facing,
    Math.hypot(player.vx, player.vy),
    dt,
    player.biteAnim,
    PLAYER_MAX_PITCH,
  );
  const reach = def.length * (1 + player.growth * 0.07) * 0.43;
  visibleMouth.set(reach, 0, 0).applyQuaternion(model.quaternion);
  model.position.set(
    player.x + Math.cos(player.angle) * reach - visibleMouth.x,
    -player.y - Math.sin(player.angle) * reach - visibleMouth.y,
    PLAYER_RENDER_DEPTH - visibleMouth.z,
  );
}
