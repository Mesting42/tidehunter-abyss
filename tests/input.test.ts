import { it, expect, vi } from "vitest";
import { Input } from "../src/core/input";
/** 无浏览器的输入单元测试只验证状态归并，不冒充真实触屏设备测试。 */
it("两个独立触点可以同时摇杆游动与冲刺，释放按钮不丢失方向", () => {
  const joy: any = {
      style: { setProperty: () => {} },
      setPointerCapture: () => {},
      getBoundingClientRect: () => ({ x: 0, y: 0, width: 120, height: 120 }),
    },
    boost: any = { setPointerCapture: () => {} },
    nub = { style: { transform: "", setProperty: () => {} } };
  const win = new EventTarget();
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", {
    querySelector: (q: string) =>
      q === "#joystick"
        ? joy
        : q === "#touch-boost"
          ? boost
          : q === "#stick-nub"
            ? nub
            : { addEventListener: () => {} },
  });
  const input = new Input();
  input.enabled = true;
  input.attachTouch();
  const pointer = (id: number, x: number, y: number) => ({
    pointerId: id,
    clientX: x,
    clientY: y,
    preventDefault: () => {},
  });
  joy.onpointerdown(pointer(1, 100, 60));
  expect(input.direction().x).toBeGreaterThan(0.8);
  boost.onpointerdown(pointer(2, 0, 0));
  expect(input.boosting).toBe(true);
  expect(input.direction().x).toBeGreaterThan(0.8);
  boost.onpointerup(pointer(2, 0, 0));
  expect(input.boosting).toBe(false);
  expect(input.direction().x).toBeGreaterThan(0.8);
  joy.onpointercancel(pointer(1, 100, 60));
  expect(input.direction()).toEqual({ x: 0, y: 0 });
  joy.onpointerdown(pointer(3, 60, 20));
  boost.onpointerdown(pointer(4, 0, 0));
  win.dispatchEvent(new Event("resize"));
  expect(input.boosting).toBe(false);
  expect(input.direction()).toEqual({ x: 0, y: 0 });
  vi.unstubAllGlobals();
});
