import type {
  Checkpoint,
  ComboState,
  Entity,
  EventState,
  GameNotice,
  Mode,
  Particle,
  Phase,
  Player,
  Projectile,
  RunStats,
  Terrain,
  Treasure,
  Vec,
} from "./types";
import {
  EVENT_NAMES,
  SHARKS,
  TASKS,
  TERRAIN,
  TREASURES,
  regionAt,
  species,
  WORLD,
} from "./data";
import { clamp, dist, blocked, norm } from "./core/math";
import { Input } from "./core/input";
import { Audio } from "./core/audio";
import { Storage } from "./core/storage";
import { movePlayer } from "./systems/movement";
import { addCatch, hunger, hurt, updateCombo } from "./systems/survival";
import { Ecology } from "./systems/ecology";
import { feed, mouth } from "./systems/combat";
import { newStats, taskProgress, unlockedByPlay } from "./systems/progression";
import { Exploration, type ExplorationContext } from "./exploration/system";
/** 主状态协调器只组织模块。菜单和暂停不调用 update，整套模拟不会偷偷流逝。 */
export class Game {
  storage = new Storage();
  input = new Input();
  audio = new Audio(this.storage.data.settings);
  phase: Phase = "menu";
  mode: Mode = "voyage";
  player!: Player;
  stats: RunStats = newStats();
  combo: ComboState = {
    count: 0,
    time: 0,
    multiplier: 1,
    charge: 0,
    rage: 0,
    grace: 0,
  };
  ecology = new Ecology(1);
  exploration = new Exploration(this.storage.data.exploration);
  terrain: Terrain[] = [];
  treasures: Treasure[] = [];
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  notices: GameNotice[] = [];
  trainingPrevious: string | undefined;
  seed = 1;
  tick = 0;
  stage = 0;
  currentRegion = "bay";
  event: EventState | null = null;
  eventClock = 36;
  eventIndex = 0;
  bossActive = false;
  won = false;
  settled = false;
  noticeCd = 0;
  hint = "";
  hintTime = 0;
  lastCheckpoint = 0;
  camera: Vec = { x: 150, y: 120 };
  screenWorld: Vec = { x: 0, y: 0 };
  onChange: () => void = () => {};
  onResult: (win: boolean) => void = () => {};
  onToast: (message: string) => void = () => {};
  get def() {
    return SHARKS.find((s) => s.id === this.storage.data.selected) || SHARKS[0];
  }
  get equipment() {
    return this.storage.data.equipment;
  }
  get upgrades() {
    return (
      this.storage.data.upgrades[this.def.id] || {
        bite: 0,
        speed: 0,
        recovery: 0,
      }
    );
  }
  start(mode: Mode, shark?: string, checkpoint?: Checkpoint) {
    if (mode === "training" && this.trainingPrevious === undefined)
      this.trainingPrevious = this.storage.data.selected;
    if (shark) this.storage.data.selected = shark;
    this.mode = mode;
    this.seed = checkpoint?.seed ?? Math.floor(Math.random() * 1e8);
    this.stats = checkpoint
      ? { ...newStats(), ...structuredClone(checkpoint.stats) }
      : newStats();
    this.stage = checkpoint?.stage || 0;
    this.combo = {
      count: 0,
      time: 0,
      multiplier: 1,
      charge: clamp(checkpoint?.charge || 0, 0, 99.9),
      rage: 0,
      grace: 0,
    };
    this.terrain = structuredClone(TERRAIN);
    // 训练只写探索副本；正式模式使用账号收藏，不随主线重开清除。
    this.exploration = new Exploration(
      mode === "training"
        ? structuredClone(this.storage.data.exploration)
        : this.storage.data.exploration,
    );
    this.exploration.buildTerrain(this.terrain);
    this.treasures = TREASURES.map((t) => ({
      ...t,
      collected: checkpoint?.treasures.includes(t.id) || false,
    }));
    this.ecology = new Ecology(this.seed);
    this.ecology.seed(this.terrain);
    if (checkpoint) {
      for (const t of this.terrain)
        if (checkpoint.broken.includes(t.id)) t.broken = true;
      for (const e of this.ecology.entities)
        if (checkpoint.elites.includes(e.kind)) e.alive = false;
    }
    const d = this.def;
    this.player = {
      x: checkpoint?.x || 150,
      y: checkpoint?.y || 115,
      vx: 0,
      vy: 0,
      angle: 0,
      facing: 1,
      hp: checkpoint ? Math.max(d.hp * 0.8, checkpoint.hp) : d.hp,
      maxHp: d.hp,
      stamina: 100,
      skillCd: 0,
      skillTime: 0,
      hurtCd: 3,
      biteAnim: 0,
      airTime: 0,
      stranded: 0,
      growth: checkpoint?.growth || 0,
      xp: checkpoint?.xp || 0,
      boost: false,
      under: true,
      shieldUsed: false,
    };
    this.exploration.seed(this.explorationContext(0));
    this.camera = { x: this.player.x, y: this.player.y };
    // 检查点是安全恢复，不把随机生成的危险目标直接留在玩家身体上。
    if (checkpoint)
      this.ecology.entities = this.ecology.entities.filter(
        (e) =>
          e.elite ||
          dist(e, this.player) > 48 ||
          !["predator", "machine", "poison", "spike"].includes(
            species(e.kind).rule,
          ),
      );
    this.projectiles = [];
    this.particles = [];
    this.notices = [];
    this.event = null;
    this.eventClock = 36;
    this.eventIndex = 0;
    this.bossActive = false;
    this.won = false;
    this.settled = false;
    this.tick = 0;
    this.lastCheckpoint = this.stats.time;
    this.currentRegion = regionAt(this.player.x, this.player.y);
    this.input.clear();
    this.input.enabled = true;
    this.phase = "playing";
    this.notice(
      checkpoint ? "从安全潮汐点继续" : "猎手，醒来",
      mode === "training"
        ? "自由训练 · 全部鲨鱼可试用"
        : mode === "endless"
          ? "无尽猎食 · 在海潮中留下纪录"
          : "跟随航次目标，前往沉没的裂渊",
    );
    this.audio.unlock();
    this.audio.resume();
    this.onChange();
    if (mode === "voyage" && !checkpoint) this.checkpoint();
  }
  pause() {
    if (this.phase !== "playing") return;
    this.phase = "paused";
    this.input.enabled = false;
    this.input.clear();
    this.audio.suspend();
    if (this.mode === "voyage" && !this.won) this.checkpoint();
    this.onChange();
  }
  resume() {
    if (this.phase !== "paused" && this.phase !== "victory") return;
    if (this.phase === "victory") this.settled = false;
    this.phase = "playing";
    this.input.clear();
    this.input.enabled = true;
    this.audio.resume();
    this.onChange();
  }
  menu() {
    if (this.phase === "playing" && this.mode === "voyage" && !this.won)
      this.checkpoint();
    if ((this.phase === "playing" || this.phase === "paused") && !this.settled)
      this.settle(false, true);
    if (this.trainingPrevious !== undefined) {
      this.storage.data.selected = this.trainingPrevious;
      this.trainingPrevious = undefined;
    }
    if (!this.storage.data.unlocked.includes(this.storage.data.selected))
      this.storage.data.selected = "reef";
    this.phase = "menu";
    this.exploration = new Exploration(this.storage.data.exploration);
    this.input.enabled = false;
    this.input.clear();
    this.audio.resume();
    this.onChange();
  }
  notice(text: string, sub?: string, color?: string) {
    this.notices.push({ text, sub, color, time: 4.5 });
    if (this.notices.length > 4) this.notices.shift();
  }
  showHint(text: string) {
    if (this.noticeCd > 0 && text === this.hint) return;
    this.hint = text;
    this.hintTime = 2;
    this.noticeCd = 1.5;
  }
  burst(
    x: number,
    y: number,
    color: string,
    count = 12,
    speed = 14,
    text?: string,
  ) {
    const intensity = this.storage.data.settings.effects;
    for (
      let i = 0;
      i < Math.ceil(count * intensity) && this.particles.length < 220;
      i++
    ) {
      const a = Math.random() * Math.PI * 2,
        l = 0.4 + Math.random() * 0.6;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: l,
        maxLife: l,
        color,
        size: 0.3 + Math.random() * 0.7,
      });
    }
    if (text && this.particles.length < 230)
      this.particles.push({
        x,
        y: y - 5,
        vx: 0,
        vy: -8,
        life: 1.1,
        maxLife: 1.1,
        color,
        size: 1,
        text,
      });
  }
  damage(n: number, type: string) {
    if (
      this.def.id === "abyss" &&
      this.player.skillTime > 0 &&
      (type === "poison" || type === "spike")
    )
      return;
    if (
      hurt(
        this.player,
        this.combo,
        n,
        type,
        this.equipment.includes("venom"),
        this.mode === "training" && this.storage.data.settings.noHunger,
      )
    ) {
      this.audio.play("hit");
      this.burst(this.player.x, this.player.y, "#dd936d", 8);
      if (this.storage.data.settings.vibration && navigator.vibrate)
        navigator.vibrate(35);
    }
  }
  update(dt: number) {
    if (this.phase !== "playing") return;
    const p = this.player;
    this.tick++;
    this.stats.time += dt;
    const old = { x: p.x, y: p.y },
      oldMouth = mouth(p, this.def);
    p.hurtCd = Math.max(0, p.hurtCd - dt);
    p.skillCd = Math.max(0, p.skillCd - dt);
    p.skillTime = Math.max(0, p.skillTime - dt);
    p.biteAnim = Math.max(0, p.biteAnim - dt);
    this.noticeCd = Math.max(0, this.noticeCd - dt);
    this.hintTime = Math.max(0, this.hintTime - dt);
    for (const n of this.notices) n.time -= dt;
    this.notices = this.notices.filter((n) => n.time > 0);
    const dir = this.input.direction(
      this.screenWorld,
      p,
      this.storage.data.settings.mouse,
    );
    const boosted = movePlayer(
      p,
      this.def,
      dir,
      this.input.boosting,
      this.combo.rage > 0,
      (this.equipment.includes("flow") ? 5.4 : 0) + this.upgrades.recovery * 2,
      this.upgrades.speed,
      this.terrain,
      dt,
      {
        splash: (pos) => {
          this.audio.play("splash");
          this.burst(pos.x, WORLD.surface, "#b7e9e1", 22, 23);
        },
        broke: (id) => {
          this.audio.play("break");
          this.burst(p.x, p.y, "#c8ab77", 24, 20);
          this.notice(
            "通路已打开",
            id === "reward" ? "发现暗礁秘藏" : "沉船捷径",
          );
        },
      },
      this.exploration.current(p),
    );
    if (boosted) this.audio.play("boost");
    this.stats.distance += dist(p, old);
    if (p.under && Math.hypot(p.vx, p.vy) > 15 && this.tick % 7 === 0)
      this.burst(
        p.x - Math.cos(p.angle) * this.def.length * 0.42,
        p.y - Math.sin(p.angle) * this.def.length * 0.42,
        p.boost ? "#b8e9df" : "#759f9c",
        p.boost ? 3 : 1,
        3,
      );
    const region = regionAt(p.x, p.y);
    if (region !== this.currentRegion) {
      this.currentRegion = region;
      const names: Record<string, string> = {
        bay: "日光浅湾",
        wreck: "沉船航道",
        ice: "冰冷外海",
        deep: "裂渊深海",
      };
      this.notice(
        names[region],
        region === "deep" ? "留意发光的轮廓与洞穴入口" : "新的潮汐，新的猎场",
      );
    }
    if (!this.stats.visited.includes(region)) {
      this.stats.visited.push(region);
      if (this.mode !== "training") this.reward("region:" + region, 15);
    }
    if (region === "ice") this.stats.iceTime += dt;
    this.ecology.update({
      player: p,
      terrain: this.terrain,
      dt,
      time: this.stats.time,
      tick: this.tick,
      endless: this.mode === "endless",
      slow: p.skillTime > 0 && this.def.id === "abyss",
      damage: (n, t) => this.damage(n, t),
      shoot: (q) => {
        if (this.projectiles.length < 90) this.projectiles.push(q);
      },
      warning: (pos, text) => {
        if (dist(pos, p) < 155) {
          if (text === "爆破") this.burst(pos.x, pos.y, "#e6a16e", 30, 37);
          else {
            this.showHint(text);
            this.audio.play("warning");
            if (this.storage.data.settings.vibration && navigator.vibrate)
              navigator.vibrate([18, 25, 18]);
          }
        }
      },
    });
    if (!this.bossActive) this.exploration.update(this.explorationContext(dt));
    feed({
      player: p,
      def: this.def,
      combo: this.combo,
      entities: this.ecology.entities,
      terrain: this.terrain,
      oldMouth,
      time: this.stats.time,
      biteUpgrade: this.upgrades.bite,
      kill: (e) => this.kill(e),
      hit: (e) => {
        this.audio.play("bite");
        this.burst(e.x, e.y, "#e1ddbc", 5, 8);
      },
      damage: (n, t) => this.damage(n, t),
      hint: (t) => this.showHint(t),
    });
    for (const q of this.projectiles) {
      const prev = { x: q.x, y: q.y };
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.life -= dt;
      if (blocked(prev, q, this.terrain)) {
        q.life = 0;
        this.burst(q.x, q.y, "#8be3da", 6);
      }
      if (dist(p, q) < q.radius + 3.8) {
        this.damage(q.damage, q.type);
        q.life = 0;
      }
    }
    this.projectiles = this.projectiles.filter((q) => q.life > 0);
    updateCombo(
      this.combo,
      dt,
      () => {
        this.stats.frenzy++;
        this.audio.play("rage");
        this.notice(
          "猎 潮 狂 暴",
          "普通伤害吸收 · 无限冲刺 · 得分翻倍",
          "#ebcb82",
        );
        this.burst(p.x, p.y, "#e5bf6c", 34, 32);
      },
      () => {
        this.audio.play("rageEnd");
        this.notice("狂潮渐息", "2.5 秒缓冲保护 · 留意冲刺能量");
        p.stamina = Math.max(p.stamina, 60);
      },
      12 + (this.equipment.includes("fury") ? 3 : 0),
    );
    hunger(
      p,
      this.def,
      dt,
      this.stats.time,
      this.bossActive,
      this.mode === "training" && this.storage.data.settings.noHunger,
    );
    if (
      this.equipment.includes("guard") &&
      !p.shieldUsed &&
      p.hp < p.maxHp * 0.25
    ) {
      p.shieldUsed = true;
      p.hp = Math.min(p.maxHp, p.hp + 35);
      p.hurtCd = 3;
      this.notice("护命潮核已触发", "恢复生命 · 3 秒保护");
    }
    if (this.tick % 15 === 0) this.tasks();
    this.updateEvents(dt);
    this.audio.update(dt, p.y, this.combo.rage > 0);
    for (const a of this.particles) {
      a.life -= dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.vx *= 1 - dt * 1.6;
    }
    this.particles = this.particles.filter((a) => a.life > 0);
    if (
      this.mode === "voyage" &&
      !this.bossActive &&
      !this.won &&
      this.stats.time - this.lastCheckpoint > 30
    )
      this.checkpoint();
    if (p.hp <= 0) this.finish(false);
  }
  kill(e: Entity) {
    const d = species(e.kind),
      rage = this.combo.rage > 0;
    const score = Math.round(
      d.score *
        this.combo.multiplier *
        (rage ? 2 : 1) *
        (rage && this.equipment.includes("fury") ? 1.2 : 1),
    );
    this.stats.score += score;
    if (d.food) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + d.food);
      this.stats.eaten++;
      if (this.player.boost) this.stats.boostEaten++;
      this.player.xp += d.score;
      addCatch(this.combo, d.score);
      this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo.count);
      if (rage) this.stats.frenzyKills++;
      if (!this.stats.fishTypes.includes(e.kind))
        this.stats.fishTypes.push(e.kind);
      if (
        this.player.xp >= (this.player.growth + 1) * 500 &&
        this.player.growth < 3
      ) {
        this.player.growth++;
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 25);
        this.notice(
          "猎手成长 · " + this.player.growth + " / 3",
          "咬合强化，体型略微增加",
        );
        this.audio.play("task");
      }
    }
    if (
      this.mode !== "training" &&
      !this.storage.data.discovered.includes(e.kind)
    ) {
      this.storage.data.discovered.push(e.kind);
      this.storage.write();
    }
    if (e.kind === "net") this.stats.nets++;
    if (d.rule === "elite") {
      this.stats.elites++;
      this.reward("elite:" + e.kind, 75);
      this.notice(d.name + " 已被击退", "区域恢复平静 · 新鲨鱼解锁条件达成");
      this.checkpoint();
    }
    if (e.kind === "boss") {
      this.stats.boss = 1;
      this.bossActive = false;
      this.projectiles = [];
      for (const other of this.ecology.entities)
        if (
          dist(other, this.player) < 160 &&
          (species(other.kind).rule === "predator" ||
            species(other.kind).rule === "machine")
        )
          other.alive = false;
      this.player.hurtCd = 8;
      this.player.hp = this.player.maxHp;
      this.tasks();
      this.finish(true);
    }
    this.audio.play(d.food ? "eat" : "break");
    this.burst(
      e.x,
      e.y,
      rage ? "#f3cf80" : d.food ? "#a5e6cf" : "#d6b68c",
      d.size > 10 ? 25 : 9,
      15,
      "+" + score,
    );
  }
  skill() {
    if (this.phase !== "playing" || this.player.skillCd > 0) return;
    const p = this.player;
    p.skillCd = this.def.cooldown;
    p.skillTime = this.def.id === "mako" ? 4 : this.def.id === "abyss" ? 6 : 2;
    p.hurtCd = Math.max(p.hurtCd, this.def.id === "reef" ? 2 : 0.4);
    if (this.def.id === "reef") {
      p.angle += Math.PI;
      p.facing *= -1;
      p.vx *= -0.5;
      p.vy *= -0.5;
    }
    if (this.def.id === "hammer") {
      for (const e of this.ecology.entities)
        if (e.alive && dist(p, e) < 28 && !blocked(p, e, this.terrain)) {
          e.hp -= e.kind === "net" ? 100 : 65;
          if (e.hp <= 0) {
            e.alive = false;
            this.kill(e);
          } else {
            e.state = "recover";
            e.timer = 2;
            e.weak = 2;
          }
        }
    }
    this.burst(
      p.x,
      p.y,
      this.def.id === "abyss" ? "#c0a2fa" : "#a1d9df",
      30,
      32,
    );
    this.audio.play("skill");
    this.showHint(this.def.skill);
  }
  interact() {
    if (this.phase !== "playing") return;
    const p = this.player;
    const near = this.treasures.find(
      (t) => !t.collected && dist(p, t) < 20 && !blocked(p, t, this.terrain),
    );
    if (near) {
      near.collected = true;
      this.stats.treasures++;
      if (near.id === "crest") this.stats.leaps = 1;
      if (near.id === "wreckGold") this.stats.wreck = 1;
      if (near.id === "cavePearl") this.stats.cave = 1;
      if (near.id === "deepRelic") this.stats.relic = 1;
      this.reward("treasure:" + near.id, 30);
      this.burst(near.x, near.y, "#e8c785", 24, 22);
      this.audio.play("collect");
      this.notice(near.name, "已收入航次收藏 · +30 潮晶");
      this.tasks();
      this.checkpoint();
      return;
    }
    if (
      !this.bossActive &&
      this.exploration.interact(this.explorationContext(0))
    ) {
      if (this.mode === "voyage" && !this.won) this.checkpoint();
      return;
    }
    const boss = this.ecology.entities.find(
      (e) => e.kind === "boss" && e.alive,
    );
    if (boss && dist(p, { x: 1030, y: 488 }) < 95 && !this.bossActive) {
      if (this.mode === "voyage" && this.stage < 11) {
        this.showHint("先完成航次目标，再唤醒裂渊巨鳗");
        return;
      }
      this.bossActive = true;
      boss.state = "warning";
      boss.timer = 2;
      boss.attack = 0;
      boss.warned = false;
      this.projectiles = [];
      p.hp = Math.max(p.hp, p.maxHp * 0.85);
      p.stamina = 100;
      this.audio.play("boss");
      this.notice("裂渊巨鳗", "躲避蓄势攻击，借祭柱挡弹；鳃口发亮时冲刺撕咬");
      return;
    }
    this.showHint("靠近宝藏或祭场入口后交互");
  }
  /** 探索仅通过这些回调取得世界能力；它不依赖 Game 类、音频实例或存档实现。 */
  explorationContext(dt: number): ExplorationContext {
    return {
      player: this.player,
      terrain: this.terrain,
      entities: this.ecology.entities,
      dt,
      time: this.stats.time,
      training: this.mode === "training",
      bossActive: this.bossActive,
      persist: () => {
        if (this.mode !== "training") this.storage.write();
      },
      reward: (amount) => {
        this.storage.data.currency += amount;
        this.stats.currency += amount;
      },
      unlock: () => {
        if (!this.storage.data.skins.includes("explorer")) {
          this.storage.data.skins.push("explorer");
          this.storage.write();
          this.onToast(
            "四海印记已集齐 · 回潮鳍纹外观已解锁，可在鲨鱼与进化中穿戴。",
          );
        }
      },
      signal: (title, detail, pos, color = "#a6dfcf") => {
        this.notice(title, detail, color);
        this.audio.play("collect");
        this.burst(pos.x, pos.y, color, 14, 11);
      },
      spawn: (kind, pos, tag) =>
        this.ecology.spawn(kind, pos.x, pos.y, this.terrain, tag),
    };
  }
  tasks() {
    if (this.mode !== "voyage") return;
    while (
      this.stage < TASKS.length &&
      taskProgress(this.stats, this.stage) >= TASKS[this.stage].goal
    ) {
      const t = TASKS[this.stage];
      this.reward("task:" + t.id, t.reward);
      if (!this.storage.data.completed.includes(t.id))
        this.storage.data.completed.push(t.id);
      this.stage++;
      this.audio.play("task");
      this.notice(
        "目标完成 · " + t.name,
        `+${t.reward} 潮晶 · ${this.stage} / ${TASKS.length}`,
      );
      this.checkpoint();
    }
  }
  reward(id: string, amount: number) {
    if (this.mode === "training") return;
    if (this.storage.reward(this.stats.claims, id, amount))
      this.stats.currency += amount;
  }
  updateEvents(dt: number) {
    this.eventClock -= dt;
    if (!this.event && this.eventClock <= 0) {
      const type = this.eventIndex++ % 4,
        p = this.player;
      this.event = {
        id: this.eventIndex,
        type,
        name: EVENT_NAMES[type],
        x: clamp(p.x + 110, 100, 1140),
        y: clamp(p.y, 80, 550),
        age: 0,
        duration: type === 0 ? 33 : 40,
        stage: "warning",
        spawned: false,
      };
      this.notice(
        this.event.name + " 即将到来",
        [
          "鱼群将穿过前方水域",
          "猎手船即将布下渔网",
          "蓝色潮流将暂时打通捷径",
          "巨物轮廓正在接近",
        ][type],
      );
      this.audio.play("warning");
    }
    const ev = this.event;
    if (!ev) return;
    ev.age += dt;
    if (ev.age > 5 && !ev.spawned) {
      ev.stage = "active";
      ev.spawned = true;
      const tag = "event:" + ev.id;
      if (ev.type === 0) {
        for (let i = 0; i < 27 && this.ecology.entities.length < 360; i++)
          this.ecology.safeSpawn(
            i % 4 ? "sprat" : "tuna",
            ev.x,
            ev.y,
            this.terrain,
            70,
            tag,
          );
      }
      if (ev.type === 1) {
        this.ecology.spawn("boat", ev.x, 38, this.terrain, tag);
        for (let i = 0; i < 3; i++)
          this.ecology.safeSpawn(
            "net",
            ev.x - 20 + i * 22,
            ev.y,
            this.terrain,
            20,
            tag,
          );
      }
      if (ev.type === 2) {
        for (const t of this.terrain) if (t.breakable) t.broken = true;
        this.notice(
          "暗流回廊已开启",
          "沿蓝色流光前行 · 临时通路在事件结束后仍保留",
        );
      }
      if (ev.type === 3) {
        this.ecology.safeSpawn("rival", ev.x, ev.y, this.terrain, 35, tag);
        for (let i = 0; i < 12; i++)
          this.ecology.safeSpawn(
            "squid",
            ev.x - 35,
            ev.y,
            this.terrain,
            90,
            tag,
          );
        this.notice("深渊巡游", "巨物带起上升涌流 · 冲刺避开猎手");
      }
    }
    if (ev.stage === "active" && ev.type === 2 && dist(this.player, ev) < 85) {
      this.player.stamina = Math.min(100, this.player.stamina + dt * 30);
      this.player.vx += dt * 15;
    }
    if (ev.stage === "active" && ev.type === 3 && dist(this.player, ev) < 110) {
      this.player.vy -= dt * 10;
    }
    if (ev.age > ev.duration) {
      for (const e of this.ecology.entities)
        if (
          e.tag === "event:" + ev.id &&
          ["boat", "net", "rival"].includes(e.kind) &&
          dist(e, this.player) > 30
        )
          e.alive = false;
      this.notice(ev.name + " 已结束", "潮汐恢复平静");
      this.event = null;
      this.eventClock =
        this.mode === "endless" ? Math.max(25, 65 - this.stats.time / 60) : 55;
    }
  }
  checkpoint() {
    if (this.mode !== "voyage" || this.won || !this.player) return;
    const p = this.player;
    const safe =
      regionAt(p.x, p.y) === "bay"
        ? { x: 155, y: 135 }
        : regionAt(p.x, p.y) === "wreck"
          ? { x: 350, y: 145 }
          : regionAt(p.x, p.y) === "ice"
            ? { x: 835, y: 125 }
            : { x: 760, y: 560 };
    this.storage.data.checkpoint = {
      mode: "voyage",
      shark: this.def.id,
      stats: structuredClone(this.stats),
      treasures: this.treasures.filter((t) => t.collected).map((t) => t.id),
      broken: this.terrain.filter((t) => t.broken).map((t) => t.id),
      elites: this.stats.claims
        .filter((id) => id.startsWith("elite:"))
        .map((id) => id.slice(6)),
      x: safe.x,
      y: safe.y,
      hp: Math.max(p.hp, p.maxHp * 0.8),
      xp: p.xp,
      growth: p.growth,
      stage: this.stage,
      charge: this.combo.rage > 0 ? 0 : this.combo.charge,
      seed: this.seed,
    };
    this.lastCheckpoint = this.stats.time;
    this.storage.write();
  }
  /** 检查点可反复继续；分数只补发新增部分，航次计数/失败补偿/胜利奖励均分别幂等。 */
  settle(win: boolean, abandon = false) {
    if (this.settled || this.mode === "training") return;
    this.settled = true;
    const s = this.storage.data,
      scoreCredit = Math.floor(this.stats.score / 160),
      paid = this.stats.paidScore || 0;
    if (scoreCredit > paid) {
      this.reward("score:" + scoreCredit, scoreCredit - paid);
      this.stats.paidScore = scoreCredit;
    }
    if (win && !this.stats.claims.includes("victory")) {
      this.reward("victory", 120);
      s.wins++;
      s.checkpoint = null;
    } else if (!win && !abandon) this.reward("completion", 15);
    if (!this.stats.runCounted) {
      s.runs++;
      this.stats.runCounted = true;
    }
    const r = s.records[this.mode] || { score: 0, time: 0, eaten: 0, combo: 0 };
    s.records[this.mode] = {
      score: Math.max(r.score, this.stats.score),
      time: Math.max(r.time, this.stats.time),
      eaten: Math.max(r.eaten, this.stats.eaten),
      combo: Math.max(r.combo, this.stats.maxCombo),
    };
    unlockedByPlay(s, this.stats.score, this.stats.elites, win);
    if (!win && this.mode === "voyage") this.checkpoint();
    this.storage.write();
  }
  finish(win: boolean) {
    if (this.phase !== "playing" || (win && this.won)) return;
    if (win) {
      this.won = true;
      this.settle(true);
      this.phase = "victory";
      this.audio.play("win");
      this.notice("深渊归于沉寂", "航次完成 · 你成为这片海域的新猎手");
    } else {
      if (this.mode === "voyage") this.checkpoint();
      this.settle(false);
      this.phase = "dead";
      this.audio.play("fail");
    }
    this.input.enabled = false;
    this.input.clear();
    this.onResult(win);
  }
  /** 只读诊断快照供测试和性能观测。没有修改成长、跳关或触发胜利的入口。 */
  snapshot() {
    const boss = this.ecology.entities.find((e) => e.kind === "boss");
    return {
      phase: this.phase,
      mode: this.mode,
      player: {
        x: this.player?.x,
        y: this.player?.y,
        hp: this.player?.hp,
        stamina: this.player?.stamina,
        angle: this.player?.angle,
        boost: this.player?.boost,
      },
      stats: structuredClone(this.stats),
      combo: { ...this.combo },
      stage: this.stage,
      region: this.currentRegion,
      boss: boss
        ? {
            hp: boss.hp,
            state: boss.state,
            weak: boss.weak,
            x: boss.x,
            y: boss.y,
          }
        : null,
      entities: this.ecology.entities.length,
      particles: this.particles.length,
      projectiles: this.projectiles.length,
      event: this.event?.name,
      shark: this.def.id,
    };
  }
}
