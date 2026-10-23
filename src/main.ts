import "./style.css";
import "./exploration/style.css";
import { Game } from "./game";
import { OceanRenderer } from "./render/renderer";
import { UI } from "./ui/ui";
/** 固定 60Hz 模拟与独立渲染。后台暂停清空累积时间，恢复后不会补算饥饿与攻击。 */
try {
  const game = new Game();
  const renderer = new OceanRenderer(
    document.getElementById("ocean") as HTMLCanvasElement,
  );
  const ui = new UI(game, renderer);
  renderer.quality(game.storage.data.settings.quality);
  let last = performance.now(),
    accumulator = 0;
  const step = 1 / 60;
  function frame(now: number) {
    const realDt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (game.phase === "playing") {
      accumulator += realDt;
      let steps = 0;
      while (accumulator >= step && steps++ < 6) {
        game.screenWorld = renderer.worldPoint(game.input.pointer);
        game.update(step);
        accumulator -= step;
      }
    } else accumulator = 0;
    renderer.render(game, realDt, ui.previewId);
    ui.update(realDt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  Object.defineProperty(window, "__TIDE__", {
    value: Object.freeze({
      snapshot: () => game.snapshot(),
      performance: () => ({
        drawCalls: renderer.renderer.info.render.calls,
        triangles: renderer.renderer.info.render.triangles,
        geometries: renderer.renderer.info.memory.geometries,
        textures: renderer.renderer.info.memory.textures,
      }),
    }),
    writable: false,
  });
} catch (error) {
  console.error(error);
  document.getElementById("app")!.innerHTML =
    `<div style="pointer-events:auto;background:#092530;padding:10vw;color:#dce8dc;height:100%;font:16px sans-serif"><h1>海域暂时无法呈现</h1><p>请启用浏览器硬件加速与 WebGL，然后重新加载。</p><button style="padding:14px 24px;background:#bed2ab;color:#153a40" onclick="location.reload()">重新载入</button><p>${String(error).replace(/[<>]/g, "")}</p></div>`;
}
