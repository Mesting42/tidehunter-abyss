import type { Game } from "../game";
import { Storage } from "../core/storage";
import type { OceanRenderer } from "../render/renderer";
import { EQUIPMENT, REGIONS, SHARKS, SPECIES, TASKS, species } from "../data";
import { clamp, dist } from "../core/math";
import { taskProgress } from "../systems/progression";
import type { Mode } from "../types";
import { threatOverlay } from "./threat-overlay";
import { explorationJournal } from "../exploration/journal";
import { navigationX } from "./navigation";
import { EXPEDITIONS, LANDMARKS, ENCOUNTERS } from "../exploration/data";
const icon = (id: string) => {
  const paths: Record<string, string> = {
    pause: "M7 4h3v16H7zM14 4h3v16h-3z",
    danger: "M12 3 22 21H2ZM12 9v5m0 3v1",
    ram: "M5 5 21 12 5 19 9 12Z",
    elite: "M12 2 22 12 12 22 2 12Z",
    map: "m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2ZM9 3v16m6-14v16",
    compass: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4 6-2 6-6 2 2-6Z",
    back: "m14 5-7 7 7 7M7 12h14",
    bolt: "m14 2-9 12h6l-1 8 9-12h-6z",
    skill: "m12 2 3 6 7 4-7 4-3 6-3-6-7-4 7-4z",
    interact: "M7 3h10v18H7zM7 12h10",
    coin: "m12 2 8 5v10l-8 5-8-5V7Zm0 4-4 6 4 6 4-6z",
    close: "m6 6 12 12M18 6 6 18",
    sound: "M3 9h4l5-5v16l-5-5H3zM16 7q7 5 0 10",
    book: "M12 5q-5-4-10 0v15q5-4 10 0 5-4 10 0V5q-5-4-10 0z",
    gear: "m9 3 6 0 1 4 4 1 1 6-4 2-1 4H9l-1-4-4-2 1-6 4-1zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[id] || paths.skill}"/></svg>`;
};
const time = (t: number) =>
  `${Math.floor(t / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(t % 60)
    .toString()
    .padStart(2, "0")}`;
export class UI {
  game: Game;
  renderer: OceanRenderer;
  root: HTMLElement;
  screen = "home";
  previous = "home";
  selected = "reef";
  equipIndex = 0;
  codexIndex = 0;
  previewId: string | undefined;
  hud!: HTMLElement;
  overlay!: HTMLElement;
  toast!: HTMLElement;
  toastTimer = 0;
  uiClock = 0;
  lastAnnouncement = "";
  constructor(game: Game, renderer: OceanRenderer) {
    this.game = game;
    this.renderer = renderer;
    this.root = document.getElementById("app")!;
    this.selected = game.storage.data.selected;
    this.root.innerHTML = `<div id="hud" hidden></div><div id="overlay"></div><div id="toast" role="status" aria-live="polite"></div><div id="orientation"><div class="rotate-symbol">${icon("map")}</div><h2>让海域展开</h2><p>请将设备横过来，航次已安全暂停。</p></div>`;
    this.hud = document.getElementById("hud")!;
    this.overlay = document.getElementById("overlay")!;
    this.toast = document.getElementById("toast")!;
    game.onChange = () => this.sync();
    game.onResult = (win) => this.result(win);
    game.onToast = (m) => this.message(m);
    game.input.onAction = (a) => {
      if (a === "pause") {
        if (game.phase === "playing") {
          game.pause();
          this.open("pause");
        } else if (game.phase === "paused") this.close();
      } else if (a === "skill") game.skill();
      else if (a === "interact") game.interact();
      else if (a === "map") {
        if (this.screen === "map") this.close();
        else if (game.phase === "playing") {
          game.pause();
          this.open("map");
        }
      }
    };
    this.root.addEventListener("click", (e) => this.click(e));
    this.root.addEventListener("input", (e) => this.setting(e));
    this.root.addEventListener("change", (e) => this.setting(e));
    this.home();
    if (game.storage.warning) this.message(game.storage.warning);
    this.applySettings();
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && game.phase === "playing") {
        game.pause();
        this.open("pause");
      }
    });
    window.addEventListener("blur", () => {
      if (game.phase === "playing") {
        game.pause();
        this.open("pause");
      }
    });
    window.addEventListener("resize", () => {
      // A narrow desktop frame is not a rotated touch device.
      if (matchMedia("(pointer: coarse)").matches && innerHeight > innerWidth && game.phase === "playing") {
        game.pause();
        this.open("pause");
      }
    });
  }
  money() {
    return `<span class="currency">${icon("coin")} <b>${this.game.storage.data.currency}</b><span>潮晶</span></span>`;
  }
  header(title: string, sub = "") {
    return `<header class="panel-header"><button class="icon-button" data-action="back" aria-label="返回">${icon("back")}</button><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ""}</div>${this.money()}</header>`;
  }
  message(text: string) {
    this.toast.textContent = text;
    this.toast.classList.add("show");
    this.toastTimer = 3.5;
  }
  home() {
    this.screen = "home";
    this.previewId = undefined;
    this.hud.hidden = true;
    this.overlay.hidden = false;
    const g = this.game,
      s = g.storage.data;
    this.overlay.className = "home-screen";
    this.overlay.innerHTML = `<!-- THESIS: 深海猎手在菜单中游动；用户确认暗黑奇幻世界。 OWN-WORLD: 海墨、冷玉、旧金，沉没仪式与真实三维模型。 STORY: 选择航次，主动进入海域。 FIRST VIEWPORT: 左侧书法标题与纵向操作，右侧立体鲨鱼，底部航线。 FORM: 用户固定世界优先于 seed 2fa555bd。 FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md -->
  <header class="home-top"><span class="brand-mark">${icon("skill")} 猎潮海域</span>${this.money()}</header>
  <main class="home-content"><h1 class="game-title">猎潮狂鲨</h1><p class="home-subtitle">光沉入海底，猎手循潮而生。</p><div class="home-actions">${s.checkpoint ? `<button class="primary" data-action="continue">继续探索航次 <small>${Math.round((s.checkpoint.stage / 12) * 100)}% · 安全检查点</small><span class="action-arrow"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg></span></button>` : ""}<button class="${s.checkpoint ? "secondary" : "primary"}" data-action="start" data-mode="voyage">${s.checkpoint ? "开始新的航次" : "启程 · 目标探索"}<span class="action-arrow"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg></span></button><div class="mode-pair"><button data-action="start" data-mode="endless">无尽猎食 <span>挑战生存纪录</span></button><button data-action="training">自由训练 <span>试游全部鲨鱼</span></button></div></div><nav class="harbor-nav" aria-label="港湾功能"><button data-action="open" data-screen="workshop">鲨鱼与进化</button><button data-action="open" data-screen="equipment">装备</button><button data-action="open" data-screen="codex">生物图鉴</button><button data-action="open" data-screen="tutorial">游玩指南</button><button data-action="open" data-screen="settings">设置</button><button data-action="open" data-screen="records">纪录</button></nav></main>
  <div class="home-shark-caption"><strong>${g.def.name}</strong><span>${g.def.title}</span><p>${g.def.skill} · 捕食等级 ${g.def.level}</p></div><footer class="home-footer"><span>四片海域，一次深入黑暗的航行</span><div>${REGIONS.map((r) => `<span>${r.name}</span>`).join("")}</div><span>原创海洋动作生存 · 本地存档</span></footer>`;
  }
  sync() {
    if (this.game.phase === "playing") {
      this.hud.classList.remove("overlay-open");
      this.screen = "game";
      this.previewId = undefined;
      this.overlay.hidden = true;
      this.hud.hidden = false;
      this.buildHud();
    } else if (this.game.phase === "menu") {
      this.home();
    } else if (this.game.phase === "paused" && this.screen === "game")
      this.open("pause");
  }
  buildHud() {
    this.hud.innerHTML = `<div class="vitals"><div class="vital-label"><b id="hp-label">生命</b><span id="hp-num"></span></div><div class="meter life"><i id="hp-bar"></i></div><div class="boost-row">${icon("bolt")}<div class="meter energy"><i id="energy-bar"></i></div><span id="energy-num"></span></div><div class="rage-label"><span id="rage-label">猎潮狂暴</span><span id="rage-num"></span></div><div class="meter rage"><i id="rage-bar"></i></div></div><div class="score-block"><span>猎食得分</span><strong id="score">0</strong><div><b id="multiplier">×1</b><span id="run-time">00:00</span></div></div><div class="hud-actions"><button class="icon-button" data-action="open-pause" aria-label="暂停">${icon("pause")}</button><button class="icon-button" data-action="game-map" aria-label="海域地图">${icon("map")}</button><button class="icon-button" data-action="game-exploration" aria-label="探索记录">${icon("compass")}</button><button class="icon-button desktop-only" data-action="game-missions" aria-label="航次目标">${icon("book")}</button></div><button id="minimap-button" data-action="game-map" aria-label="展开海域地图"><canvas id="minimap" width="248" height="130"></canvas><span id="region-label"></span></button><div id="objective"></div><button id="exploration-hud" data-action="game-exploration" hidden></button><div id="exploration-marker"></div><div id="boss-bar" hidden><div><b id="boss-name"></b><span id="boss-phase"></span></div><div class="meter boss"><i id="boss-hp"></i></div><p id="boss-state"></p></div><div id="notice" aria-live="polite"></div><div id="hint"></div><div id="target-guide"></div><div id="floating-text"></div><svg id="hazards" aria-hidden="true"></svg><div id="direction-marker"></div><div id="skill-desktop" class="desktop-only"></div><div class="key-hint desktop-only">WASD 游动 <span>Shift 冲刺</span> E 技能 <span>F 交互</span> M 地图</div><div id="touch-controls"><div id="joystick" aria-label="游动摇杆"><div class="stick-ring"></div><div id="stick-nub"></div><span>游动</span></div><div class="touch-right"><button id="touch-interact" data-action="interact" aria-label="交互">${icon("interact")}<span>交互</span></button><button id="touch-skill" data-action="skill" aria-label="使用专属技能">${icon("skill")}<span>技能</span></button><button id="touch-boost" aria-label="按住冲刺">${icon("bolt")}<span>冲刺</span></button></div></div>`;
    this.game.input.attachTouch();
    this.applySettings();
  }
  open(screen: string) {
    if (
      this.screen !== "pause" &&
      this.screen !== "game" &&
      this.screen !== "result"
    )
      this.previous = this.screen;
    else this.previous = this.game.phase === "paused" ? "pause" : "home";
    this.screen = screen;
    if (this.game.phase === "paused") this.hud.classList.add("overlay-open");
    this.overlay.hidden = false;
    this.overlay.className = "panel-screen " + screen;
    this.previewId = undefined;
    const g = this.game;
    if (screen === "pause") {
      this.overlay.innerHTML = `<div class="pause-layout"><h1>潮汐暂歇</h1><p>${g.mode === "voyage" ? "航次进度已保存到安全潮汐点" : "海域正在等待你的归来"}</p><button class="primary" data-action="resume">继续游动 <span class="action-arrow"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg></span></button><button data-action="open" data-screen="map">海域地图</button><div class="pause-paired"><button data-action="open" data-screen="missions">航次目标</button><button data-action="open" data-screen="exploration">探索记录</button></div><button data-action="open" data-screen="tutorial">游玩指南</button><button data-action="open" data-screen="settings">声音与操作</button><button data-action="leave">结算并返回港湾</button></div>`;
    }
    if (screen === "workshop" || screen === "training")
      this.workshop(screen === "training");
    if (screen === "equipment") this.equipment();
    if (screen === "codex") this.codex();
    if (screen === "tutorial") this.tutorial();
    if (screen === "settings") this.settings();
    if (screen === "map") this.map();
    if (screen === "missions") this.missions();
    if (screen === "records") this.records();
    if (screen === "exploration") this.explorationJournal();
  }
  close() {
    this.previewId = undefined;
    if (this.game.phase === "paused") {
      this.game.resume();
    } else this.home();
  }
  workshop(training = false) {
    const g = this.game,
      s = g.storage.data,
      d = SHARKS.find((a) => a.id === this.selected) || SHARKS[0],
      owned = s.unlocked.includes(d.id),
      u = s.upgrades[d.id] || { bite: 0, speed: 0, recovery: 0 };
    this.previewId = d.id;
    this.overlay.innerHTML = `${this.header(training ? "自由训练" : "鲨鱼与进化", training ? "选择任意猎手试游，训练收益不计入存档。" : "每个猎手，都有自己的潮汐。")}<div class="workshop-body"><div class="model-stage"><div class="shark-tabs">${SHARKS.map((a) => `<button class="${d.id === a.id ? "active" : ""}" data-action="select-shark" data-id="${a.id}">${a.name}<small>${s.unlocked.includes(a.id) ? "已解锁" : a.price + " 潮晶"}</small></button>`).join("")}</div><span class="model-caption">实时三维预览 · 原创猎手</span></div><div class="shark-details"><h2>${d.name}</h2><p class="role-name">${d.title}</p><p class="body-copy">${d.desc}</p><div class="attributes"><div>捕食等级 <strong>${d.level}</strong></div><div>最大生命 <strong>${d.hp}</strong></div><div>巡游 / 冲刺 <strong>${d.speed} / ${d.boost}</strong></div><div>咬合伤害 <strong>${Math.round(d.bite * (1 + u.bite * 0.14))}</strong></div><div>饥饿消耗 <strong>${d.hunger} / 秒</strong></div><div>转向灵活度 <strong>${d.turn}</strong></div></div><div class="skill-description"><b>${d.skill}</b><span>${d.skillDesc} 冷却 ${d.cooldown} 秒。</span></div>${training ? `<button class="primary" data-action="trial" data-id="${d.id}">开始试游 <span class="action-arrow"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg></span></button><label class="toggle"><input type="checkbox" data-setting="noHunger" ${s.settings.noHunger ? "checked" : ""}>关闭训练饥饿与伤害</label>` : owned ? `<button class="primary" data-action="choose" data-id="${d.id}">${s.selected === d.id ? "当前出航鲨鱼" : "选为出航鲨鱼"} <span class="action-arrow"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg></span></button><div class="upgrades">${(["bite", "speed", "recovery"] as const).map((k, i) => `<button data-action="upgrade" data-stat="${k}" data-id="${d.id}" ${u[k] >= 3 ? "disabled" : ""}><span>${["强化咬合", "强化游速", "冲刺恢复"][i]} <b>${u[k]} / 3</b></span><small>${u[k] >= 3 ? "已达上限" : 25 + u[k] * 25 + " 潮晶 · " + ["每级 +14%", "每级 +5.5%", "每级 +2 / 秒"][i]}</small></button>`).join("")}</div><div class="skins"><span>外观</span><button class="${s.skin === "natural" ? "active" : ""}" data-action="skin" data-id="natural">原生</button><button class="${s.skin === "moon" ? "active" : ""}" data-action="skin" data-id="moon">${s.skins.includes("moon") ? "月蚀鳍纹" : "月蚀鳍纹 · 35 潮晶"}</button><button class="${s.skin === "explorer" ? "active" : ""}" data-action="skin" data-id="explorer" ${!s.skins.includes("explorer") ? "disabled" : ""}>${s.skins.includes("explorer") ? "回潮鳍纹" : "回潮鳍纹 · 探索解锁"}</button></div>` : `<button class="primary" data-action="unlock" data-id="${d.id}" ${s.currency < d.price ? "disabled" : ""}>解锁猎手 · ${d.price} 潮晶</button><p class="muted">也可通过正常游玩解锁：${d.id === "mako" ? "完成一局或得分达 1000" : d.id === "hammer" ? "击败区域精英，或累计完成 3 局" : "完成目标航次，或累计完成 5 局"}。</p>`}</div></div>`;
  }
  equipment() {
    const s = this.game.storage.data,
      d = EQUIPMENT[this.equipIndex];
    this.previewId = "equip:" + d.shape;
    this.overlay.innerHTML = `${this.header("潮汐装备", "同时装备两件，带着取舍出航。")}<div class="equipment-body"><div class="model-stage"><span class="model-caption">${d.name} · 实时三维预览</span></div><div class="equipment-list">${EQUIPMENT.map(
      (a, i) => {
        const owned = s.owned.includes(a.id),
          on = s.equipment.includes(a.id);
        return `<article class="equipment-row ${i === this.equipIndex ? "selected" : ""}"><button class="equip-info" data-action="equip-preview" data-index="${i}"><b>${a.name}</b><span>${a.desc}</span></button><button class="small-button ${on ? "equipped" : ""}" data-action="equip" data-id="${a.id}" ${!owned && s.currency < a.price ? "disabled" : ""}>${on ? "卸下" : owned ? "装备" : a.price + " 潮晶"}</button></article>`;
      },
    ).join(
      "",
    )}<p class="muted">已装备 ${s.equipment.length} / 2 · 每局保护次数单独计算</p></div></div>`;
  }
  codex() {
    const d = SPECIES[this.codexIndex],
      known = this.game.storage.data.discovered.includes(d.id);
    this.previewId = undefined;
    this.overlay.innerHTML = `${this.header("海域生物图鉴", "○ 吞食　◇ 连咬　▷ 冲撞　! 危险　◆ 大型挑战")}<div class="codex-layout"><nav class="species-list">${SPECIES.map((a, i) => `<button class="${i === this.codexIndex ? "active" : ""}" data-action="codex" data-index="${i}"><span>${a.name}</span><small>${this.game.storage.data.discovered.includes(a.id) ? "已发现" : "观察记录"}</small></button>`).join("")}</nav><article class="codex-detail"><div id="codex-portrait" class="codex-portrait"></div><h2>${d.name}</h2><p class="muted">${known ? "已在航次中发现" : "预先了解食物链，出航后记录发现。"} · ${d.region}</p><p class="codex-rule">${d.hint}</p><dl><div><dt>捕食等级</dt><dd>${d.level === 9 ? "不可吞食" : d.level}</dd></div><div><dt>生命 / 耐久</dt><dd>${d.hp}</dd></div><div><dt>营养恢复</dt><dd>${d.food}</dd></div><div><dt>基础分数</dt><dd>${d.score}</dd></div></dl></article></div>`;
    this.renderPortrait(d.id);
  }
  renderPortrait(id: string) {
    const container = document.getElementById("codex-portrait");
    if (!container) return;
    container.appendChild(this.renderer.portrait(id));
  }
  tutorial() {
    this.overlay.innerHTML = `${this.header("游玩指南", "你是猎手。观察海潮，再决定进攻。")}<div class="guide-grid"><article><h2>游动与破浪</h2><p>WASD / 方向键游动，Shift 或鼠标右键冲刺。朝海面向上冲刺可以跃出水面，离水后会受重力影响。手机使用左摇杆和右侧冲刺按钮。</p><p>E 使用专属技能，F 与宝藏、祭场交互，M 查看地图，Esc 暂停。键盘输入优先于可选鼠标跟随。</p></article><article><h2>对准鱼嘴，主动猎食</h2><p>○ 小型目标直接吞食，◇ 耐久猎物需要连续咬合，▷ 硬壳和机械需要冲刺，! 毒素与尖刺需确认等级。鱼嘴前方才能命中，地形会遮挡捕食和弹道。</p><p>生命同时代表生存压力。捕食可恢复，受伤与搁浅额外损失；开局 15 秒不消耗，暂停与后台完全停止计时。</p></article><article><h2>连吃与猎潮狂暴</h2><p>7 秒内继续捕食可延续连吃，每 4 次提升一级倍率，上限 ×5。受伤损失部分连吃，中断则重置。</p><p>狂暴积满自动触发：无限冲刺、普通伤害吸收、捕食等级 +2、得分翻倍。水雷仍然危险，岩壁仍然实体。结束后有 2.5 秒保护，不会继续积累同条狂暴槽。</p></article><article><h2>探索与大型挑战</h2><p>地图金圈表示当前目标，菱形表示宝藏。宝藏靠近按 F 收集，水面印记需要先跃起。航次失败可从安全检查点继续。</p><p>追随微光、气泡和回声可发现四片海域的可选支线；方框仅标记已发现的地点。探索记录可主动追踪线索，青色提示与主线分开。收集四枚印记可解锁回潮鳍纹，训练不写入真实收藏。</p><p>红色外圈与倒计时表示即将出招，通道实线时方向已锁定，立即侧移。薄荷色回气提示表示反击窗口。巨鳗有冲撞、电潮与尾击；借祭柱遮挡弹道，鳃口发亮时冲刺撕咬。战斗内饥饿消耗降低并补充食物。</p></article><article><h2>成长与港湾</h2><p>局内经验最多成长三阶。潮晶用于有限升级、解锁和装备；每种属性最多升级三次，同时最多装备两件。完成一局可解锁逐电，击败精英可解锁沉甲，首次胜利解锁全部猎手。</p></article><article><h2>模式与存档</h2><p>目标探索包含完整胜利条件；无尽猎食随时间提高威胁而保持食物补充；自由训练可试用全部鲨鱼并关闭饥饿与伤害。训练不获得货币和纪录。</p><p>存档仅保存在当前浏览器。清理网站数据会移除存档；可在设置中导出与导入备份。</p></article></div>`;
  }
  settings() {
    const s = this.game.storage.data.settings;
    this.overlay.innerHTML = `${this.header("声音与操作", "让潮汐适合你的设备。")}<div class="settings-layout"><div><h2>声音与反馈</h2>${[
      ["music", "音乐音量"],
      ["sfx", "音效音量"],
      ["effects", "特效强度"],
    ]
      .map(
        ([k, label]) =>
          `<label class="range-label"><span>${label}</span><input type="range" min="0" max="1" step="0.01" data-setting="${k}" value="${s[k as "music"]}"><output>${Math.round(s[k as "music"] * 100)}%</output></label>`,
      )
      .join("")}${[
      ["flash", "受击与狂暴闪光"],
      ["vibration", "触屏震动"],
      ["mouse", "鼠标跟随游动"],
    ]
      .map(
        ([k, label]) =>
          `<label class="toggle"><input type="checkbox" data-setting="${k}" ${s[k as "flash"] ? "checked" : ""}>${label}</label>`,
      )
      .join(
        "",
      )}<label class="range-label"><span>画质</span><select data-setting="quality"><option value="auto" ${s.quality === "auto" ? "selected" : ""}>自适应</option><option value="high" ${s.quality === "high" ? "selected" : ""}>精细</option><option value="low" ${s.quality === "low" ? "selected" : ""}>省电</option></select></label></div><div><h2>触屏与存档</h2>${[
      ["touchSize", "按钮大小", 0.8, 1.4],
      ["touchOpacity", "按钮不透明度", 0.35, 1],
    ]
      .map(
        ([k, l, min, max]) =>
          `<label class="range-label"><span>${l}</span><input type="range" min="${min}" max="${max}" step="0.01" data-setting="${k}" value="${s[k as "touchSize"]}"><output>${Math.round(s[k as "touchSize"] * 100)}%</output></label>`,
      )
      .join(
        "",
      )}<p class="muted">竖屏与切后台会暂停。旋转后需要点击继续，输入不会残留。</p><div class="backup-actions"><button class="secondary" data-action="export">导出存档</button><label class="secondary file-button">导入存档<input type="file" id="import-save" accept="application/json,.json"></label></div><p class="muted" id="storage-status">${this.game.storage.warning || "本地存档正常 · 版本 1"}</p></div></div>`;
    document
      .getElementById("import-save")
      ?.addEventListener("change", (e) => this.importSave(e));
  }
  map() {
    this.overlay.innerHTML = `${this.header("海域航图", "金圈：目标　菱形：宝藏　圆环：精英　方框：探索　青色：追踪　箭头：你")}<div class="map-wrap"><canvas id="full-map" width="1240" height="650" aria-label="连通海域地图"></canvas><p>当前位置：东向 ${Math.round(this.game.player.x)}m，水深 ${Math.max(0, Math.round(this.game.player.y - 40))}m。地形保持连通。浅湾向右通往沉船与外海，深潜可抵达葬灯洞穴和裂渊祭场；断木栅栏可由更高等级或狂暴撞开。</p><button class="secondary map-exploration" data-action="open" data-screen="exploration">探索记录 · ${this.game.exploration.data.found.length} / 8 发现 · ${this.game.exploration.data.completed.length} / 4 印记</button></div><button class="map-resume primary" data-action="resume">返回海域 <span class="action-arrow"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg></span></button>`;
    const canvas = document.getElementById("full-map") as HTMLCanvasElement;
    this.renderer.drawMap(this.game, canvas, true);
  }
  missions() {
    const g = this.game;
    this.overlay.innerHTML = `${this.header("航次目标", g.mode === "voyage" ? `已完成 ${g.stage} / 12 · 每项奖励限本航次一次` : "探索航次的目标一览；当前模式不推进主线。")}<div class="mission-list">${TASKS.map((t, i) => `<article class="mission-row ${i < g.stage ? "complete" : i === g.stage ? "current" : ""}"><span class="mission-state">${i < g.stage ? "完成" : i === g.stage ? "当前" : "待探索"}</span><div><h2>${t.name}</h2><p>${t.desc}</p></div><span>${taskProgress(g.stats, i)} / ${t.goal}</span><span>${t.reward} 潮晶</span></article>`).join("")}</div>`;
  }
  explorationJournal() {
    const g = this.game;
    this.overlay.innerHTML = `${this.header("探索记录", "可选支线 · 主线之外，追随海域的回声。")}${explorationJournal(g.exploration, g.mode === "training" && g.phase !== "menu", g.storage.data.skins.includes("explorer"))}`;
  }
  records() {
    const s = this.game.storage.data;
    this.overlay.innerHTML = `${this.header("猎手纪录", "每一次深入，都留下回声。")}<div class="records-layout">${(
      ["voyage", "endless"] as const
    )
      .map((mode, i) => {
        const r = s.records[mode];
        return `<article><h2>${i ? "无尽猎食" : "目标探索"}</h2>${r ? `<dl><div><dt>最高分数</dt><dd>${r.score.toLocaleString()}</dd></div><div><dt>最长生存</dt><dd>${time(r.time)}</dd></div><div><dt>最多捕食</dt><dd>${r.eaten}</dd></div><div><dt>最高连吃</dt><dd>${r.combo}</dd></div></dl>` : "<p>海潮正等待第一段猎手传说。</p>"}</article>`;
      })
      .join(
        "",
      )}<article><h2>港湾收藏</h2><p>航次胜利 ${s.wins} 次 · 鲨鱼解锁 ${s.unlocked.length} / 4</p><p>生物发现 ${s.discovered.length} / ${SPECIES.length} · 已完成目标 ${s.completed.length} / 12</p><button class="secondary" data-action="open" data-screen="exploration">探索记录 · ${s.exploration.found.length} / 8 发现</button></article></div>`;
  }
  result(win: boolean) {
    this.screen = "result";
    this.previewId = undefined;
    this.overlay.hidden = false;
    this.overlay.className = "result-screen";
    const g = this.game,
      s = g.stats;
    this.overlay.innerHTML = `<div class="result-layout"><h1>${win ? "深渊归于沉寂" : "航行暂告结束"}</h1><p class="result-flavor">${win ? "裂渊巨鳗沉入黑暗，微光重新流动。" : "猎手的回声，仍留在海潮之中。"}</p><p>${win ? "探索航次完成 · 首次胜利解锁全部鲨鱼" : g.mode === "training" ? "继续练习，掌握属于你的潮汐。" : g.mode === "voyage" ? "重要目标已保留，可从安全检查点再启程。" : "每一次追猎，都能游得更远。"}</p><div class="result-stats"><div><span>猎食得分</span><b>${s.score.toLocaleString()}</b></div><div><span>航行时间</span><b>${time(s.time)}</b></div><div><span>捕食 / 最高连吃</span><b>${s.eaten} / ${s.maxCombo}</b></div><div><span>本次获得潮晶</span><b>+${s.currency}</b></div></div><div class="result-actions">${win ? '<button class="primary" data-action="survive">继续生存 <span class="action-arrow"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg></span></button>' : g.mode === "voyage" && g.storage.data.checkpoint ? '<button class="primary" data-action="continue">从检查点继续 <span class="action-arrow"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg></span></button>' : `<button class="primary" data-action="start" data-mode="${g.mode}">再次出航 <span class="action-arrow"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg></span></button>`}<button class="secondary" data-action="leave">结算返回港湾</button></div><p class="muted">${win ? "胜利奖励已领取，继续生存不会重复发放。" : "成长、装备与纪录已保存。"}</p></div>`;
  }
  click(e: MouseEvent) {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (!b || (b as HTMLButtonElement).disabled) return;
    const a = b.dataset.action,
      g = this.game,
      s = g.storage.data;
    if (g.phase !== "paused") g.audio.unlock();
    if (a === "open") this.open(b.dataset.screen!);
    if (a === "back") {
      if (g.phase === "paused") this.open("pause");
      else this.home();
    }
    if (a === "resume") this.close();
    if (a === "leave") {
      this.previewId = undefined;
      g.menu();
    }
    if (a === "start") {
      const mode = b.dataset.mode as Mode;
      const selected = s.unlocked.includes(s.selected) ? s.selected : "reef";
      g.start(mode, selected);
      this.renderer.syncWorld(g);
    }
    if (a === "continue") {
      const cp = s.checkpoint;
      if (cp) {
        g.start("voyage", cp.shark, cp);
        this.renderer.syncWorld(g);
      }
    }
    if (a === "survive") g.resume();
    if (a === "open-pause") {
      g.pause();
      this.open("pause");
    }
    if (a === "game-map") {
      g.pause();
      this.open("map");
    }
    if (a === "game-missions") {
      g.pause();
      this.open("missions");
    }
    if (a === "game-exploration") {
      g.pause();
      this.open("exploration");
    }
    if (a === "track-exploration") {
      const id = b.dataset.id!;
      if (
        !g.exploration.data.found.includes(id) &&
        !g.exploration.data.seenEncounters.includes(id)
      )
        return;
      g.exploration.data.tracked =
        g.exploration.data.tracked === id ? null : id;
      if (g.mode !== "training" || g.phase === "menu") g.storage.write();
      this.explorationJournal();
    }
    if (a === "wear-explorer" && s.skins.includes("explorer")) {
      s.skin = "explorer";
      g.storage.write();
      this.message("已穿上回潮鳍纹");
    }
    if (a === "skill") g.skill();
    if (a === "interact") g.interact();
    if (a === "training") {
      this.selected = s.selected;
      this.open("training");
    }
    if (a === "select-shark") {
      this.selected = b.dataset.id!;
      this.workshop(this.screen === "training");
    }
    if (a === "trial") {
      g.start("training", b.dataset.id);
      this.renderer.syncWorld(g);
    }
    if (a === "choose") {
      s.selected = b.dataset.id!;
      g.storage.write();
      this.message("已选择 " + g.def.name);
      this.workshop();
    }
    if (a === "unlock") {
      const d = SHARKS.find((v) => v.id === b.dataset.id)!;
      if (!s.unlocked.includes(d.id) && g.storage.buy(d.price)) {
        s.unlocked.push(d.id);
        g.storage.write();
        this.message(d.name + " 已解锁");
        this.workshop();
      }
    }
    if (a === "upgrade") {
      const id = b.dataset.id!,
        k = b.dataset.stat as "bite" | "speed" | "recovery";
      s.upgrades[id] ??= { bite: 0, speed: 0, recovery: 0 };
      const u = s.upgrades[id];
      if (u[k] < 3 && g.storage.buy(25 + u[k] * 25)) {
        u[k]++;
        g.storage.write();
        this.workshop();
      } else this.message("潮晶不足");
    }
    if (a === "skin") {
      const id = b.dataset.id!;
      if (id === "explorer" && !s.skins.includes(id)) return;
      if (!s.skins.includes(id)) {
        if (!g.storage.buy(35)) {
          this.message("潮晶不足");
          return;
        }
        s.skins.push(id);
      }
      s.skin = id;
      g.storage.write();
      this.workshop();
    }
    if (a === "equip-preview") {
      this.equipIndex = Number(b.dataset.index);
      this.equipment();
    }
    if (a === "equip") {
      const d = EQUIPMENT.find((v) => v.id === b.dataset.id)!;
      if (s.equipment.includes(d.id))
        s.equipment = s.equipment.filter((x) => x !== d.id);
      else {
        if (s.equipment.length >= 2) {
          this.message("已装备两件，请先卸下一件");
          return;
        }
        if (!s.owned.includes(d.id)) {
          if (!g.storage.buy(d.price)) {
            this.message("潮晶不足");
            return;
          }
          s.owned.push(d.id);
        }
        s.equipment.push(d.id);
      }
      g.storage.write();
      this.equipment();
    }
    if (a === "codex") {
      this.codexIndex = Number(b.dataset.index);
      this.codex();
    }
    if (a === "export") {
      const blob = new Blob([JSON.stringify(s, null, 2)], {
          type: "application/json",
        }),
        url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = "猎潮狂鲨-存档.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.message("存档已导出");
    }
  }
  setting(e: Event) {
    const el = e.target as HTMLInputElement,
      k = el.dataset.setting;
    if (!k) return;
    const settings = this.game.storage.data.settings as unknown as Record<
      string,
      unknown
    >;
    settings[k] =
      el.type === "checkbox"
        ? el.checked
        : el.tagName === "SELECT"
          ? el.value
          : Number(el.value);
    const output = el.parentElement?.querySelector("output");
    if (output) output.textContent = Math.round(Number(el.value) * 100) + "%";
    this.game.storage.write();
    this.game.audio.apply();
    this.applySettings();
    if (k === "quality") this.renderer.quality(el.value);
  }
  applySettings() {
    const s = this.game.storage.data.settings;
    document.documentElement.style.setProperty(
      "--touch-size",
      String(s.touchSize),
    );
    document.documentElement.style.setProperty(
      "--touch-opacity",
      String(s.touchOpacity),
    );
    document.body.classList.toggle("reduced-flash", !s.flash);
  }
  async importSave(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (
        data.version !== 1 ||
        !Array.isArray(data.unlocked) ||
        !Array.isArray(data.owned) ||
        !data.settings ||
        !Number.isFinite(data.currency) ||
        data.currency < 0
      )
        throw Error();
      const text = JSON.stringify(data);
      if (text.length > 500000) throw Error();
      const candidate = new Storage(text);
      if (candidate.warning) throw Error();
      localStorage.setItem(
        "tidehunter.abyss.save.v1",
        JSON.stringify(candidate.data),
      );
      location.reload();
    } catch {
      this.message("存档格式不正确，现有进度已保留。");
    }
  }
  update(dt: number) {
    this.toastTimer -= dt;
    if (this.toastTimer <= 0) this.toast.classList.remove("show");
    if (this.game.phase === "menu" && this.screen === "home") {
      const caption = this.overlay.querySelector(".home-shark-caption");
      if (caption)
        caption.classList.toggle(
          "breathing",
          Math.sin(performance.now() * 0.001) > 0,
        );
    }
    if (this.game.phase === "menu" || this.hud.hidden) return;
    this.uiClock += dt;
    if (this.uiClock < 0.09) return;
    this.uiClock = 0;
    const g = this.game,
      p = g.player,
      c = g.combo;
    const set = (id: string, value: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };
    const bar = (id: string, v: number) => {
      const el = document.getElementById(id);
      if (el) el.style.transform = `scaleX(${clamp(v, 0, 100) / 100})`;
    };
    set("hp-label", p.hp < p.maxHp * 0.25 ? "生命危急 · 寻找食物" : "生命");
    set("hp-num", Math.ceil(p.hp) + " / " + p.maxHp);
    bar("hp-bar", (p.hp / p.maxHp) * 100);
    this.hud.classList.toggle("low-health", p.hp < p.maxHp * 0.25);
    this.hud.classList.toggle("raging", c.rage > 0);
    set("energy-num", Math.round(p.stamina) + "%");
    bar("energy-bar", p.stamina);
    set(
      "rage-label",
      c.rage > 0
        ? "猎潮狂暴" + (c.rage < 3 ? " · 即将结束" : "")
        : c.grace > 0
          ? "狂潮渐息 · 保护中"
          : "猎潮狂暴",
    );
    set(
      "rage-num",
      c.rage > 0 ? c.rage.toFixed(1) + "s" : Math.floor(c.charge) + "%",
    );
    bar(
      "rage-bar",
      c.rage > 0
        ? (c.rage / (12 + (g.equipment.includes("fury") ? 3 : 0))) * 100
        : c.charge,
    );
    set("score", g.stats.score.toLocaleString());
    set(
      "multiplier",
      "×" + c.multiplier + (c.count ? " · " + c.count + " 连吃" : ""),
    );
    set("run-time", time(g.stats.time));
    set(
      "region-label",
      REGIONS.find((r) => r.id === g.currentRegion)!.name +
        " · 深 " +
        Math.max(0, Math.round(p.y - 40)) +
        "m",
    );
    const task = TASKS[g.stage],
      objective = document.getElementById("objective")!;
    if (g.mode === "voyage" && task) {
      objective.innerHTML = `<button data-action="game-missions"><span>探索航次 · ${g.stage + 1} / 12</span><b>${task.name}</b><p>${task.desc} <strong>${taskProgress(g.stats, g.stage)} / ${task.goal}</strong></p></button>`;
    } else
      objective.innerHTML = `<span>${g.mode === "training" ? "自由训练 · " + (g.storage.data.settings.noHunger ? "无压力" : "生存压力开启") : g.won ? "航次已完成 · 继续生存" : "无尽猎食"}</span><b>${g.mode === "training" ? "熟悉你的猎手" : "追随下一群猎物"}</b>`;
    const notice = g.notices.at(-1);
    document.getElementById("notice")!.innerHTML = notice
      ? `<strong style="color:${notice.color || ""}">${notice.text}</strong>${notice.sub ? `<span>${notice.sub}</span>` : ""}`
      : "";
    set("hint", g.hintTime > 0 ? g.hint : "");
    const near = g.treasures.find((t) => !t.collected && dist(t, p) < 23);
    const sideAction = !g.bossActive
      ? g.exploration.action({ player: p, terrain: g.terrain })
      : undefined;
    const boss = g.ecology.entities.find((e) => e.kind === "boss" && e.alive);
    const interact = document.getElementById("touch-interact")!;
    interact.classList.toggle(
      "available",
      !!near || !!sideAction || (!!boss && dist(p, { x: 1030, y: 488 }) < 95),
    );
    if (near) set("hint", "F / 交互 · 收集" + near.name);
    else if (sideAction) set("hint", "F / 交互 · " + sideAction.label);
    else if (boss && dist(p, { x: 1030, y: 488 }) < 95 && !g.bossActive)
      set(
        "hint",
        g.stage >= 11 || g.mode !== "voyage"
          ? "F / 交互 · 进入祭场挑战"
          : "完成航次目标后唤醒巨鳗",
      );
    const skill = document.getElementById("touch-skill") as HTMLButtonElement;
    skill.disabled = p.skillCd > 0;
    skill.querySelector("span")!.textContent =
      p.skillCd > 0 ? Math.ceil(p.skillCd) + "s" : "技能";
    set(
      "skill-desktop",
      `E · ${g.def.skill} ${p.skillCd > 0 ? Math.ceil(p.skillCd) + "s" : "就绪"}`,
    );
    const bossbar = document.getElementById("boss-bar")!;
    const elite = g.ecology.entities.find(
      (e) => e.alive && e.elite && e.kind !== "boss" && dist(e, p) < 80,
    );
    const target = g.bossActive ? boss : elite;
    bossbar.hidden = !target;
    if (target) {
      set("boss-name", species(target.kind).name);
      set(
        "boss-phase",
        target.kind === "boss" ? "阶段 " + target.phase : "区域精英",
      );
      bar("boss-hp", (target.hp / target.maxHp) * 100);
      set(
        "boss-state",
        target.weak! > 0
          ? "弱点暴露 · 冲刺撕咬"
          : target.state === "warn" || target.state === "warning"
            ? "蓄势预警 · 准备躲避"
            : "观察动作，寻找窗口",
      );
    }
    const canvas = document.getElementById("minimap") as HTMLCanvasElement;
    if (canvas) this.renderer.drawMap(g, canvas);
    this.drawMarkers();
    this.drawHazards();
    this.updateExplorationHUD();
  }
  updateExplorationHUD() {
    const g = this.game,
      e = g.exploration,
      p = g.player;
    const hud = document.getElementById("exploration-hud")!,
      marker = document.getElementById("exploration-marker")!;
    const close = EXPEDITIONS.filter(
      (q) => e.found(q.id) && !e.done(q.id),
    ).find((q) => dist(p, e.target(q.id) || q.entry) < 70);
    const id = e.data.tracked || close?.id;
    hud.hidden = !id || g.bossActive;
    marker.innerHTML = "";
    if (!id || g.bossActive) return;
    const target = e.target(id),
      def = [...EXPEDITIONS, ...LANDMARKS, ...ENCOUNTERS].find(
        (q) => q.id === id,
      );
    hud.innerHTML = `<span>自由探索${e.data.tracked ? " · 追踪中" : " · 附近线索"}</span><b>${def?.name || "海域回声"}</b><small>${e.instruction(id)}</small>`;
    if (!target || !e.data.tracked) return;
    const a = this.renderer.screen(target),
      small = innerHeight < 500;
    if (
      a.x < 40 ||
      a.x > innerWidth - 40 ||
      a.y < 90 ||
      a.y > innerHeight - 65
    ) {
      const x = navigationX(a.x, innerWidth, innerHeight),
        y = clamp(a.y, small ? 205 : 260, innerHeight - (small ? 115 : 95)),
        angle = Math.atan2(a.y - innerHeight / 2, a.x - innerWidth / 2);
      marker.innerHTML = `<div style="left:${x}px;top:${y}px"><svg viewBox="0 0 24 24" style="transform:rotate(${angle}rad)" aria-hidden="true"><path d="M4 4 21 12 4 20 8 12Z"/></svg><span>支线 ${Math.round(dist(p, target))}m</span></div>`;
    } else
      marker.innerHTML = `<div class="exploration-ring" style="left:${a.x}px;top:${a.y}px"></div>`;
  }
  drawHazards() {
    const svg = document.getElementById("hazards");
    if (!svg) return;
    svg.setAttribute("viewBox", `0 0 ${innerWidth} ${innerHeight}`);
    const p = this.game.player,
      at = this.renderer.screen(p),
      scale = innerWidth / this.renderer.viewW;
    const shapes: string[] = [];
    for (const e of this.game.ecology.entities) {
      if (!e.alive || dist(e, p) > 155) continue;
      const a = this.renderer.screen(e),
        size = species(e.kind).size;
      shapes.push(
        threatOverlay(e, {
          screen: (pos) => this.renderer.screen(pos),
          width: innerWidth,
          height: innerHeight,
          scale,
        }),
      );
      if (e.elite && e.weak! > 0)
        shapes.push(
          `<circle cx="${a.x + Math.cos(e.angle) * size * 0.22 * scale}" cy="${a.y + Math.sin(e.angle) * size * 0.22 * scale}" r="${size * 0.23 * scale}" stroke="#bcebcf" stroke-width="2" stroke-dasharray="4 4" fill="none"/>`,
        );
    }
    if (this.game.combo.rage > 0)
      shapes.push(
        `<ellipse cx="${at.x}" cy="${at.y}" rx="${12 * scale}" ry="${8 * scale}" stroke="#edcc83" opacity=".5" stroke-width="1.5" fill="none" stroke-dasharray="6 12"/>`,
      );
    svg.innerHTML = shapes.join("");
  }
  drawMarkers() {
    const g = this.game,
      p = g.player;
    const floats = document.getElementById("floating-text")!;
    floats.innerHTML = g.particles
      .filter((a) => a.text)
      .slice(-12)
      .map((a) => {
        const s = this.renderer.screen(a);
        return `<span style="left:${s.x}px;top:${s.y}px;color:${a.color};opacity:${a.life / a.maxLife}">${a.text}</span>`;
      })
      .join("");
    const guide = document.getElementById("target-guide")!;
    const candidates = g.ecology.entities.filter(
      (e) =>
        e.alive &&
        dist(e, p) < 30 &&
        species(e.kind).rule !== "eat" &&
        species(e.kind).rule !== "boss",
    );
    guide.innerHTML = candidates
      .slice(0, 3)
      .map((e) => {
        const s = this.renderer.screen({
            x: e.x,
            y: e.y - species(e.kind).size * 0.6 - 3,
          }),
          d = species(e.kind);
        const mark =
          d.rule === "poison" || d.rule === "spike"
            ? "danger"
            : d.id === "mine"
              ? "close"
              : d.rule === "machine" || d.rule === "ram"
                ? "ram"
                : "elite";
        return `<span style="left:${s.x}px;top:${s.y}px">${icon(mark)} ${d.name}</span>`;
      })
      .join("");
    const marker = document.getElementById("direction-marker")!;
    if (g.mode === "voyage" && TASKS[g.stage]) {
      const t = TASKS[g.stage],
        s = this.renderer.screen(t);
      if (
        s.x < 60 ||
        s.x > innerWidth - 60 ||
        s.y < 80 ||
        s.y > innerHeight - 65
      ) {
        const x = navigationX(s.x, innerWidth, innerHeight),
          y = clamp(s.y, 110, innerHeight - 85),
          angle = Math.atan2(s.y - innerHeight / 2, s.x - innerWidth / 2);
        marker.innerHTML = `<div style="left:${x}px;top:${y}px"><i style="transform:rotate(${angle}rad)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4 21 12 4 20 8 12Z"/></svg></i><span>${Math.round(dist(p, t))}m</span></div>`;
      } else
        marker.innerHTML = `<div class="target-ring" style="left:${s.x}px;top:${s.y}px"></div>`;
    } else marker.innerHTML = "";
  }
}
