import type { Vec } from "../types";
import { norm } from "./math";
/** 键盘、鼠标和多点触控汇总到统一意图。按钮指针与摇杆指针分开持有，互不抢占。 */
export class Input {
  keys = new Set<string>();
  stick: Vec = { x: 0, y: 0 };
  pointer: Vec = { x: 0, y: 0 };
  pointerActive = false;
  right = false;
  touchBoost = false;
  joystickId = -1;
  center: Vec = { x: 0, y: 0 };
  radius = 48;
  enabled = false;
  onAction: (action: string) => void = () => {};
  constructor() {
    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (
        (e.target as HTMLElement)?.matches("input,select,textarea") &&
        k !== "escape"
      )
        return;
      this.keys.add(k);
      if (
        [
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
          " ",
          "shift",
        ].includes(k) &&
        this.enabled
      )
        e.preventDefault();
      if (!e.repeat) {
        const a: Record<string, string> = {
          e: "skill",
          f: "interact",
          m: "map",
          escape: "pause",
        };
        if (a[k]) this.onAction(a[k]);
      }
    });
    window.addEventListener("keyup", (e) =>
      this.keys.delete(e.key.toLowerCase()),
    );
    window.addEventListener("blur", () => this.clear());
    window.addEventListener("pointerup", () => {
      this.right = false;
    });
    window.addEventListener("resize", () => this.clear());
    const canvas = document.querySelector("canvas")!;
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("pointerdown", (e) => {
      if (e.button === 2) this.right = true;
      if (e.pointerType === "mouse") this.pointerActive = true;
    });
    canvas.addEventListener("pointermove", (e) => {
      this.pointer = { x: e.clientX, y: e.clientY };
      if (e.pointerType === "mouse") this.pointerActive = true;
    });
  }
  direction(mouseWorld?: Vec, player?: Vec, mouseEnabled = false): Vec {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = 0,
      y = 0;
    if (this.keys.has("a") || this.keys.has("arrowleft")) x--;
    if (this.keys.has("d") || this.keys.has("arrowright")) x++;
    if (this.keys.has("w") || this.keys.has("arrowup")) y--;
    if (this.keys.has("s") || this.keys.has("arrowdown")) y++;
    if (x || y) return norm(x, y);
    if (Math.hypot(this.stick.x, this.stick.y) > 0.08) return { ...this.stick };
    if (mouseEnabled && this.pointerActive && mouseWorld && player) {
      const dx = mouseWorld.x - player.x,
        dy = mouseWorld.y - player.y;
      if (Math.hypot(dx, dy) > 6) return norm(dx, dy);
    }
    return { x: 0, y: 0 };
  }
  get boosting() {
    return (
      this.enabled && (this.keys.has("shift") || this.right || this.touchBoost)
    );
  }
  clear() {
    this.keys.clear();
    this.right = false;
    this.touchBoost = false;
    this.stick = { x: 0, y: 0 };
    this.joystickId = -1;
    this.pointerActive = false;
    document
      .querySelector<HTMLElement>("#stick-nub")
      ?.style.setProperty("transform", "translate(0px,0px)");
  }
  attachTouch() {
    const joy = document.querySelector<HTMLElement>("#joystick");
    if (joy) {
      joy.onpointerdown = (e) => {
        if (this.joystickId !== -1) return;
        e.preventDefault();
        this.joystickId = e.pointerId;
        joy.setPointerCapture(e.pointerId);
        const r = joy.getBoundingClientRect();
        this.center = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        this.radius = r.width * 0.35;
        this.moveStick(e);
      };
      joy.onpointermove = (e) => {
        if (e.pointerId === this.joystickId) this.moveStick(e);
      };
      const release = (e: PointerEvent) => {
        if (e.pointerId === this.joystickId) {
          this.joystickId = -1;
          this.stick = { x: 0, y: 0 };
          document.querySelector<HTMLElement>("#stick-nub")!.style.transform =
            "translate(0px,0px)";
        }
      };
      joy.onpointerup = release;
      joy.onpointercancel = release;
    }
    const boost = document.querySelector<HTMLElement>("#touch-boost");
    if (boost) {
      boost.onpointerdown = (e) => {
        e.preventDefault();
        boost.setPointerCapture(e.pointerId);
        this.touchBoost = true;
      };
      boost.onpointerup = () => (this.touchBoost = false);
      boost.onpointercancel = () => (this.touchBoost = false);
    }
  }
  private moveStick(e: PointerEvent) {
    const dx = e.clientX - this.center.x,
      dy = e.clientY - this.center.y;
    const n = Math.max(1, Math.hypot(dx, dy) / this.radius);
    this.stick = { x: dx / n / this.radius, y: dy / n / this.radius };
    document.querySelector<HTMLElement>("#stick-nub")!.style.transform =
      `translate(${dx / n}px,${dy / n}px)`;
  }
}
