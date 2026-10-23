import { beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("../src/core/input", () => ({
  Input: class {
    enabled = false;
    pointer = { x: 0, y: 0 };
    clear() {}
    direction() {
      return { x: 0, y: 0 };
    }
    get boosting() {
      return false;
    }
  },
}));
vi.mock("../src/core/audio", () => ({
  Audio: class {
    unlock() {}
    resume() {}
    suspend() {}
    play() {}
    update() {}
    apply() {}
  },
}));
import { Game } from "../src/game";
beforeEach(() => {
  const memory = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => memory.get(k) || null,
    setItem: (k: string, v: string) => memory.set(k, v),
  });
});
describe("主状态与检查点", () => {
  it("暂停冻结所有模拟计时、生命、生态与技能", () => {
    const g = new Game();
    g.start("voyage", "reef");
    for (let i = 0; i < 120; i++) g.update(1 / 60);
    g.pause();
    const snap = JSON.stringify({
      player: g.player,
      stats: g.stats,
      combo: g.combo,
      entities: g.ecology.entities,
      events: g.event,
    });
    for (let i = 0; i < 1000; i++) g.update(1 / 60);
    expect(
      JSON.stringify({
        player: g.player,
        stats: g.stats,
        combo: g.combo,
        entities: g.ecology.entities,
        events: g.event,
      }),
    ).toBe(snap);
  });
  it("暂停菜单返回也会结算，反复继续检查点不能重复获得结算货币或航次计数", () => {
    const g = new Game();
    g.start("voyage", "reef");
    g.pause();
    g.menu();
    const currency = g.storage.data.currency,
      runs = g.storage.data.runs;
    expect(runs).toBe(1);
    expect(g.storage.data.unlocked).toContain("mako");
    const cp = structuredClone(g.storage.data.checkpoint!);
    g.start("voyage", cp.shark, cp);
    g.pause();
    g.menu();
    expect(g.storage.data.currency).toBe(currency);
    expect(g.storage.data.runs).toBe(runs);
  });
  it("训练试游不会改变出航选择、货币与解锁", () => {
    const g = new Game();
    g.start("training", "abyss");
    expect(g.def.id).toBe("abyss");
    g.pause();
    g.menu();
    expect(g.storage.data.selected).toBe("reef");
    expect(g.storage.data.unlocked).toEqual(["reef"]);
    expect(g.storage.data.currency).toBe(80);
    expect(g.storage.data.runs).toBe(0);
  });
  it("已发放精英奖励在生态回收后仍写入检查点", () => {
    const g = new Game();
    g.start("voyage", "reef");
    g.stats.claims.push("elite:eliteRam");
    g.ecology.entities = g.ecology.entities.filter(
      (e) => e.kind !== "eliteRam",
    );
    g.checkpoint();
    expect(g.storage.data.checkpoint!.elites).toContain("eliteRam");
  });
});
