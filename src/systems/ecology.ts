import type { Entity, Player, Projectile, Terrain, Vec } from "../types";
import { species, WORLD, regionAt } from "../data";
import { attackProfile, trackAttack } from "./threats";
import {
  blocked,
  clamp,
  dist,
  inside,
  norm,
  rng,
  resolveTerrain,
} from "../core/math";
export interface AIContext {
  player: Player;
  terrain: Terrain[];
  dt: number;
  time: number;
  tick: number;
  endless: boolean;
  slow: boolean;
  damage: (n: number, type: string) => void;
  shoot: (p: Projectile) => void;
  warning: (p: Vec, text: string) => void;
}
/** 生态有硬上限。远离镜头的普通鱼每半秒简化步进，近处保留逃散、分离与避障。 */
export class Ecology {
  entities: Entity[] = [];
  nextId = 1;
  random: () => number;
  replenish = 0;
  constructor(seed: number) {
    this.random = rng(seed);
  }
  spawn(kind: string, x: number, y: number, terrain: Terrain[], tag?: string) {
    if (this.entities.length >= 360) return null;
    const def = species(kind);
    const e: Entity = {
      uid: this.nextId++,
      kind,
      x,
      y,
      vx: 0,
      vy: 0,
      angle: this.random() * Math.PI * 2,
      hp: def.hp,
      maxHp: def.hp,
      state: "patrol",
      timer: this.random() * 4,
      attack: 0,
      biteAt: -100,
      home: { x, y },
      alive: true,
      tag,
      elite: def.rule === "elite" || def.rule === "boss",
      phase: 1,
      weak: 0,
    };
    if (kind === "boss") e.state = "dormant";
    if (terrain.some((t) => inside(e, t, def.size * 0.6))) return null;
    this.entities.push(e);
    return e;
  }
  safeSpawn(
    kind: string,
    x: number,
    y: number,
    terrain: Terrain[],
    spread = 40,
    tag?: string,
  ) {
    for (let i = 0; i < 16; i++) {
      const e = this.spawn(
        kind,
        clamp(x + (this.random() - 0.5) * spread, 50, 1200),
        clamp(y + (this.random() - 0.5) * spread, 55, 605),
        terrain,
        tag,
      );
      if (e) return e;
    }
    return null;
  }
  seed(terrain: Terrain[]) {
    for (let j = 0; j < 18; j++)
      this.safeSpawn("sprat", 205 + j * 1.7, 115, terrain, 20);
    for (const [cx, cy] of [
      [155, 125],
      [220, 190],
      [350, 110],
      [460, 175],
      [590, 135],
      [670, 210],
      [820, 125],
      [975, 200],
      [1140, 165],
      [350, 440],
      [560, 465],
      [780, 540],
      [950, 400],
      [1090, 535],
    ]) {
      for (let j = 0; j < 10; j++) this.safeSpawn("sprat", cx, cy, terrain, 65);
      for (let j = 0; j < 3; j++) this.safeSpawn("tuna", cx, cy, terrain, 95);
    }
    for (let i = 0; i < 14; i++)
      this.safeSpawn(
        "ray",
        100 + this.random() * 1090,
        120 + this.random() * 450,
        terrain,
        70,
      );
    for (let i = 0; i < 14; i++)
      this.safeSpawn(
        "crab",
        110 + this.random() * 1050,
        280 + this.random() * 320,
        terrain,
        40,
      );
    for (let i = 0; i < 16; i++)
      this.safeSpawn(
        "jelly",
        360 + this.random() * 810,
        170 + this.random() * 420,
        terrain,
        35,
      );
    for (let i = 0; i < 9; i++)
      this.safeSpawn(
        "urchin",
        350 + this.random() * 780,
        320 + this.random() * 280,
        terrain,
        30,
      );
    for (let i = 0; i < 10; i++)
      this.safeSpawn(
        "squid",
        500 + this.random() * 650,
        180 + this.random() * 390,
        terrain,
        60,
      );
    for (let i = 0; i < 10; i++)
      this.safeSpawn(
        "eel",
        330 + this.random() * 810,
        380 + this.random() * 210,
        terrain,
        40,
      );
    for (let i = 0; i < 5; i++)
      this.safeSpawn(
        "rival",
        700 + this.random() * 450,
        120 + this.random() * 150,
        terrain,
        35,
      );
    for (let i = 0; i < 7; i++)
      this.safeSpawn(
        "angler",
        350 + this.random() * 790,
        400 + this.random() * 170,
        terrain,
        45,
      );
    for (let i = 0; i < 10; i++)
      this.spawn("gull", 130 + i * 100, 18 + this.random() * 8, terrain);
    for (const [kind, x, y] of [
      ["net", 570, 170],
      ["net", 590, 225],
      ["net", 380, 205],
      ["turret", 530, 220],
      ["turret", 905, 430],
      ["mine", 600, 285],
      ["mine", 630, 350],
      ["mine", 370, 305],
      ["boat", 555, 38],
    ] as [string, number, number][])
      this.spawn(kind, x, y, terrain);
    this.spawn("eliteRam", 875, 195, terrain);
    this.spawn("eliteAmbush", 490, 470, terrain);
    this.spawn("boss", 1090, 495, terrain);
  }
  update(c: AIContext) {
    const p = c.player;
    for (const e of this.entities) {
      if (!e.alive) continue;
      const def = species(e.kind),
        d = dist(e, p);
      let dt = c.dt;
      if (d > 240 && !e.elite) {
        if (c.tick % 30 !== e.uid % 30) continue;
        dt = 0.5;
      }
      e.timer -= dt;
      if (e.kind !== "boss") e.attack = Math.max(0, e.attack - dt);
      e.weak = Math.max(0, (e.weak || 0) - dt);
      if (e.kind === "boss") {
        this.boss(e, c, dt, d);
        continue;
      }
      if (def.rule === "predator" || def.rule === "elite") {
        this.predator(e, c, dt, d);
        continue;
      }
      if (e.kind === "mine") {
        if (d < 17 && e.state === "patrol") {
          e.state = "warning";
          e.timer = 1.3;
          c.warning(e, "水雷起爆 · 离开警戒圈");
        }
        if (e.state === "warning" && e.timer <= 0) {
          e.alive = false;
          if (d < 23) c.damage(48, "mine");
          c.warning(e, "爆破");
        }
        continue;
      }
      if (e.kind === "turret" || e.kind === "boat") {
        if (e.kind === "boat") {
          e.x += Math.sin(c.time * 0.17) * def.speed * dt;
          e.x = clamp(e.x, e.home.x - 65, e.home.x + 65);
        }
        if (e.state === "aim") {
          trackAttack(e, p);
          if (d > 125 || blocked(e, p, c.terrain)) {
            e.state = "patrol";
            e.timer = 2;
          } else if (e.timer <= 0) {
            const n = { x: Math.cos(e.angle), y: Math.sin(e.angle) };
            c.shoot({
              x: e.x,
              y: e.y + 3,
              vx: n.x * 52,
              vy: n.y * 52,
              life: 3,
              damage: 18,
              radius: 1.5,
              type: "harpoon",
            });
            e.state = "patrol";
            e.timer = c.endless ? Math.max(2.4, 5 - c.time / 300) : 5;
          }
        } else if (e.timer <= 0 && d < 100 && !blocked(e, p, c.terrain)) {
          e.state = "aim";
          e.timer = attackProfile(e).duration;
          e.locked = false;
          e.angle = Math.atan2(p.y - e.y, p.x - e.x);
          c.warning(e, "鱼叉锁定");
        }
        continue;
      }
      if (e.kind === "net") continue;
      let dx = Math.cos(e.angle),
        dy = Math.sin(e.angle) * 0.45;
      let speed = def.speed;
      if (e.kind === "gull") {
        e.x += Math.cos(e.angle) * def.speed * dt;
        e.y = e.home.y + Math.sin(c.time + e.uid) * 2;
        if (e.x < 70 || e.x > 1200) e.angle += Math.PI;
        continue;
      }
      if (d < (e.kind === "sprat" ? 17 : 25)) {
        const n = norm(e.x - p.x, e.y - p.y);
        dx = n.x;
        dy = n.y;
        speed *= 1.55;
        e.angle = Math.atan2(dy, dx);
      } else if (e.timer <= 0) {
        e.timer = 1.7 + this.random() * 3;
        e.angle += this.random() * 1.5 - 0.75;
        if (dist(e, e.home) > 75)
          e.angle = Math.atan2(e.home.y - e.y, e.home.x - e.x);
      }
      if (d < 140 && def.id === "sprat") {
        let sx = 0,
          sy = 0,
          k = 0,
          ax = 0,
          ay = 0,
          cx = 0,
          cy = 0,
          flock = 0;
        for (const other of this.entities) {
          if (other.uid === e.uid || !other.alive || other.kind !== "sprat")
            continue;
          const od = dist(e, other);
          if (od < 19 && flock < 8) {
            ax += Math.cos(other.angle);
            ay += Math.sin(other.angle);
            cx += other.x;
            cy += other.y;
            flock++;
          }
          if (od < 5) {
            sx += (e.x - other.x) / (od + 0.1);
            sy += (e.y - other.y) / (od + 0.1);
            k++;
          }
          if (k > 4 && flock >= 8) break;
        }
        dx += sx * 0.55;
        dy += sy * 0.55;
        // 平静时对齐邻居并聚向群心；受惊时只保留分离，形成真正的逃散。
        if (flock && d >= 17) {
          dx += (ax / flock) * 0.22 + (cx / flock - e.x) * 0.025;
          dy += (ay / flock) * 0.14 + (cy / flock - e.y) * 0.025;
        }
      }
      const direction = norm(dx, dy);
      dx = direction.x;
      dy = direction.y;
      e.angle = Math.atan2(dy, dx);
      const ahead = { x: e.x + dx * 9, y: e.y + dy * 9 };
      if (c.terrain.some((t) => inside(ahead, t, def.size * 0.3))) {
        e.angle += Math.PI * 0.7;
        dx = Math.cos(e.angle);
        dy = Math.sin(e.angle);
      }
      e.vx = dx * speed;
      e.vy = dy * speed;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      const hit = resolveTerrain(e, def.size * 0.3, c.terrain);
      if (hit.x || hit.y) e.angle += Math.PI * 0.5;
      e.x = clamp(e.x, 55, 1210);
      e.y = clamp(e.y, 55, 608);
      if (e.y <= 56 || e.y >= 607) e.angle = -e.angle;
    }
    this.replenish += c.dt;
    if (this.replenish > 2.5) {
      this.replenish = 0;
      this.entities = this.entities.filter((e) => e.alive);
      const local = this.entities.filter(
        (e) => dist(e, p) < 130 && species(e.kind).food > 0 && !e.elite,
      ).length;
      if (local < 28 && this.entities.length < 340) {
        const a = this.random() * Math.PI * 2,
          x = clamp(p.x + Math.cos(a) * 95, 70, 1190),
          y = clamp(p.y + Math.sin(a) * 85, 70, 595);
        for (let j = 0; j < 5; j++)
          this.safeSpawn(j === 0 ? "tuna" : "sprat", x, y, c.terrain, 36);
      }
      if (this.entities.length < 300) {
        for (let j = 0; j < 3; j++)
          this.safeSpawn(
            "sprat",
            70 + this.random() * 1120,
            80 + this.random() * 510,
            c.terrain,
            25,
          );
      }
    }
  }
  private predator(e: Entity, c: AIContext, dt: number, d: number) {
    const def = species(e.kind),
      p = c.player,
      elite = e.elite;
    const speed =
      def.speed *
      (c.endless ? 1 + Math.min(0.4, c.time / 1200) : 1) *
      (c.slow ? 0.5 : 1);
    if (e.state === "warn") {
      // 岩壁挡住视线后撤销蓄力，不允许隔墙冲出一个无从判断的攻击。
      if (blocked(e, p, c.terrain) || d > (elite ? 140 : 110)) {
        e.state = "recover";
        e.timer = 1;
        return;
      }
      trackAttack(e, p);
      if (e.timer <= 0) {
        e.state = e.kind === "eliteAmbush" ? "pulse" : "attack";
        e.timer = elite ? 0.95 : 0.65;
        const n = { x: Math.cos(e.angle), y: Math.sin(e.angle) };
        e.vx = n.x * speed * 3.5;
        e.vy = n.y * speed * 3.5;
        if (e.kind === "eliteAmbush") {
          for (let i = -2; i <= 2; i++) {
            const a = e.angle + i * 0.28;
            c.shoot({
              x: e.x + Math.cos(e.angle) * 7,
              y: e.y + Math.sin(e.angle) * 7,
              vx: Math.cos(a) * 27,
              vy: Math.sin(a) * 27,
              life: 2.4,
              damage: 14,
              radius: 1.8,
              type: "spore",
            });
          }
          e.vx = e.vy = 0;
        }
      }
    } else if (e.state === "pulse") {
      const front =
        (p.x - e.x) * Math.cos(e.angle) + (p.y - e.y) * Math.sin(e.angle) > 0;
      if (d < 32 && front) c.damage(22, "pulse");
      if (e.timer <= 0) {
        e.state = "recover";
        e.timer = 4;
        e.weak = 4;
      }
    } else if (e.state === "attack") {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (d < def.size * 0.55 + 5) c.damage(elite ? 24 : 16, "bite");
      const hit = resolveTerrain(e, def.size * 0.28, c.terrain);
      if (hit.x || hit.y || e.timer <= 0) {
        e.state = "recover";
        e.timer = elite ? 3.5 : 2;
        e.weak = e.timer;
        e.vx = 0;
        e.vy = 0;
      }
    } else if (e.state === "recover") {
      if (e.timer <= 0) {
        e.state = "patrol";
        e.timer = 1;
      }
    } else {
      const homeDist = dist(e, e.home);
      if (
        d < (elite ? 83 : 65) &&
        e.timer <= 0 &&
        homeDist < 125 &&
        !blocked(e, p, c.terrain)
      ) {
        e.state = "warn";
        e.timer = attackProfile(e).duration;
        e.locked = false;
        e.angle = Math.atan2(p.y - e.y, p.x - e.x);
        e.vx = e.vy = 0;
        c.warning(
          e,
          e.kind === "eliteAmbush"
            ? "葬灯聚光 · 绕到身后"
            : elite
              ? "精英蓄力 · 侧向闪避"
              : "掠食者蓄力",
        );
      } else {
        const a =
          homeDist > 50
            ? Math.atan2(e.home.y - e.y, e.home.x - e.x)
            : Math.sin(c.time * 0.25 + e.uid) * 2;
        e.angle = a;
        e.x += Math.cos(a) * speed * 0.3 * dt;
        e.y += Math.sin(a) * speed * 0.2 * dt;
        resolveTerrain(e, def.size * 0.3, c.terrain);
      }
    }
    e.x = clamp(e.x, 20, 1210);
    e.y = clamp(e.y, 65, 605);
  }
  private boss(e: Entity, c: AIContext, dt: number, d: number) {
    if (e.state === "dormant" || e.state === "defeated") return;
    const p = c.player;
    e.phase = e.hp < e.maxHp * 0.5 ? 2 : 1;
    if (e.state === "recover") {
      if (e.timer <= 0) {
        e.attack = (e.attack + 1) % 3;
        e.state = "warning";
        e.timer = e.phase === 2 ? 1.25 : 1.8;
        e.warned = false;
        e.locked = false;
      }
      return;
    }
    if (e.state === "warning") {
      trackAttack(e, p);
      if (!e.warned) {
        e.warned = true;
        c.warning(
          e,
          [
            "巨鳗蓄势 · 侧移躲冲撞",
            "电潮聚集 · 借祭柱掩护",
            "尾击蓄力 · 远离圆环",
          ][Math.round(e.attack) % 3],
        );
      }
      if (e.timer <= 0) {
        const n = { x: Math.cos(e.angle), y: Math.sin(e.angle) };
        e.vx = n.x * 86;
        e.vy = n.y * 86;
        e.state = "attack";
        e.timer = 0.95;
        if (Math.round(e.attack) % 3 === 1) {
          for (let i = 0; i < (e.phase === 2 ? 12 : 8); i++) {
            const a = (i / (e.phase === 2 ? 12 : 8)) * Math.PI * 2;
            c.shoot({
              x: e.x,
              y: e.y,
              vx: Math.cos(a) * 30,
              vy: Math.sin(a) * 30,
              life: 4.5,
              damage: 17,
              radius: 2.4,
              type: "electric",
            });
          }
        }
      }
      return;
    }
    if (e.state === "attack") {
      const type = Math.round(e.attack) % 3;
      if (type === 0) {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (d < 27) c.damage(29, "boss");
        const hit = resolveTerrain(e, 11, c.terrain);
        if (hit.x || hit.y) e.timer = 0;
      } else if (type === 2 && d < 43) c.damage(25, "tail");
      if (e.timer <= 0) {
        e.state = "recover";
        e.timer = e.phase === 2 ? 4.5 : 5.5;
        e.weak = e.timer;
        c.warning(e, "鳃口暴露 · 冲刺撕咬");
      }
      e.x = clamp(e.x, 930, 1200);
      e.y = clamp(e.y, 440, 595);
    }
  }
  nearest(p: Vec, kind: string) {
    return this.entities
      .filter((e) => e.alive && e.kind === kind)
      .sort((a, b) => dist(a, p) - dist(b, p))[0];
  }
}
