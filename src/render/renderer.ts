import * as T from "three";
import type { Game } from "../game";
import type { Entity, Vec } from "../types";
import { SHARKS, SPECIES, WORLD, species } from "../data";
import { clamp, lerp, rng } from "../core/math";
import { animatePlayerSwimming, animateSwimming } from "./swimming";
import { ExplorationRenderer } from "../exploration/render";
import { EXPEDITIONS, LANDMARKS } from "../exploration/data";
import {
  compactModel,
  creatureModel,
  equipmentModel,
  fin,
  mat,
  mesh,
  sharkModel,
  swimTime,
} from "./models";
/** 渲染只读游戏状态。模拟坐标 y 向下，在此统一变为 Three.js y 向上。 */
export class OceanRenderer {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.OrthographicCamera(-100, 100, 60, -60, 0.1, 500);
  world = new T.Group();
  decor = new T.Group();
  actors = new T.Group();
  showcase = new T.Group();
  ambient: T.HemisphereLight;
  key: T.DirectionalLight;
  templates = new Map<string, T.Group>();
  models = new Map<number, T.Group>();
  terrainModels = new Map<string, T.Group>();
  treasureModels = new Map<string, T.Group>();
  player: T.Group | null = null;
  playerKind = "";
  preview: T.Group | null = null;
  previewId = "";
  width = 1;
  height = 1;
  viewW = 210;
  viewH = 125;
  time = 0;
  surface: T.Line;
  back: T.ShaderMaterial;
  particleMesh: T.Points;
  particleGeo: T.BufferGeometry;
  projectileGroup = new T.Group();
  leviathan: T.Group | null = null;
  corpse: T.Group | null = null;
  corpseTime = 0;
  victoryVisualDone = false;
  snow: T.Points;
  lastFrame = 0;
  fps = 60;
  mapCanvas: HTMLCanvasElement;
  mini: HTMLCanvasElement;
  projection = new T.Vector3();
  explorationArt = new ExplorationRenderer();
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.scene.background = new T.Color("#0b2934");
    this.camera.position.z = 160;
    this.scene.add(
      this.world,
      this.decor,
      this.actors,
      this.showcase,
      this.projectileGroup,
      this.explorationArt.group,
    );
    this.ambient = new T.HemisphereLight("#bbf1e6", "#253445", 2.6);
    this.key = new T.DirectionalLight("#e3f5d3", 3);
    this.key.position.set(30, 90, 90);
    this.scene.add(this.ambient, this.key);
    const rim = new T.DirectionalLight("#468c9a", 2.2);
    rim.position.set(-50, -10, -35);
    this.scene.add(rim);
    this.back = new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec3 vWorld;void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,
      fragmentShader: `varying vec3 vWorld;uniform float uTime;void main(){float depth=max(0.,-vWorld.y-40.);float cold=smoothstep(600.,850.,vWorld.x);vec3 a=mix(vec3(.055,.28,.32),vec3(.08,.22,.31),cold);vec3 b=vec3(.032,.065,.13);vec3 col=mix(a,b,smoothstep(70.,500.,depth));float beams=pow(max(0.,sin(vWorld.x*.055+vWorld.y*.024+uTime*.12)),22.)*.06*exp(-depth/160.);float caust=sin(vWorld.x*.09+uTime*.3)*sin(vWorld.y*.07+uTime*.15)*.012;col+=beams+caust;if(vWorld.y> -40.){col=mix(vec3(.22,.37,.40),vec3(.045,.13,.20),clamp((vWorld.y+40.)/110.,0.,1.));float star=pow(max(0.,sin(vWorld.x*1.13)*cos(vWorld.y*1.73)),180.);col+=star*.3;}gl_FragColor=vec4(col,1.);}`,
    });
    const background = new T.Mesh(new T.PlaneGeometry(1600, 1000), this.back);
    background.position.set(620, -250, -90);
    this.world.add(background);
    const points = [];
    for (let i = 0; i <= 250; i++)
      points.push(new T.Vector3(i * 5, -WORLD.surface, 2));
    this.surface = new T.Line(
      new T.BufferGeometry().setFromPoints(points),
      new T.LineBasicMaterial({
        color: "#93d7cc",
        transparent: true,
        opacity: 0.7,
      }),
    );
    this.world.add(this.surface);
    for (const d of SPECIES)
      this.templates.set(d.id, compactModel(creatureModel(d), true));
    for (const s of SHARKS)
      this.templates.set("player:" + s.id, compactModel(sharkModel(s), true));
    const snowPositions = new Float32Array(700 * 3),
      random = rng(7495);
    for (let i = 0; i < 700; i++) {
      snowPositions[i * 3] = random() * 1300;
      snowPositions[i * 3 + 1] = -40 - random() * 600;
      snowPositions[i * 3 + 2] = -10 - random() * 35;
    }
    const sg = new T.BufferGeometry();
    sg.setAttribute("position", new T.BufferAttribute(snowPositions, 3));
    this.snow = new T.Points(
      sg,
      new T.PointsMaterial({
        color: "#b9e4d4",
        size: 0.35,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
      }),
    );
    this.decor.add(this.snow);
    this.particleGeo = new T.BufferGeometry();
    this.particleGeo.setAttribute(
      "position",
      new T.BufferAttribute(new Float32Array(240 * 3), 3),
    );
    this.particleGeo.setAttribute(
      "color",
      new T.BufferAttribute(new Float32Array(240 * 3), 3),
    );
    this.particleMesh = new T.Points(
      this.particleGeo,
      new T.PointsMaterial({
        vertexColors: true,
        size: 1.2,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    );
    this.scene.add(this.particleMesh);
    this.buildDecor();
    this.mapCanvas = document.createElement("canvas");
    this.mapCanvas.width = 1240;
    this.mapCanvas.height = 650;
    this.mini = document.createElement("canvas");
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }
  resize() {
    this.width = innerWidth;
    this.height = innerHeight;
    this.renderer.setSize(this.width, this.height, false);
    const aspect = this.width / this.height;
    this.viewH = aspect > 2 ? 112 : 132;
    this.viewW = this.viewH * aspect;
    this.camera.left = -this.viewW / 2;
    this.camera.right = this.viewW / 2;
    this.camera.top = this.viewH / 2;
    this.camera.bottom = -this.viewH / 2;
    this.camera.updateProjectionMatrix();
  }
  quality(value: string) {
    this.renderer.setPixelRatio(
      value === "low"
        ? 1
        : Math.min(devicePixelRatio, value === "high" ? 2 : 1.65),
    );
    this.renderer.setSize(this.width, this.height, false);
  }
  buildDecor() {
    const random = rng(6281);
    // 远景的断层岩、柱廊、珊瑚与海草错开深度，保持角色平面的可读性。
    for (let i = 0; i < 46; i++) {
      const x = i * 28,
        y = 280 + random() * 340,
        w = 12 + random() * 46,
        h = 50 + random() * 140;
      const shape = fin(
        [
          [0, 0],
          [w * 0.12, h * 0.72],
          [w * 0.3, h],
          [w * 0.55, h * 0.94],
          [w * 0.72, h * 0.75],
          [w * 0.9, h * 0.8],
          [w, h * 0.14],
          [w, 0],
          [0, 0],
        ],
        12,
      );
      mesh(shape, i < 12 ? "#20545a" : "#1c3548", this.decor, x, -y, -40);
    }
    for (let i = 0; i < 110; i++) {
      const x = 20 + random() * 1200,
        y = 585 + random() * 48;
      const base = mesh(
        new T.DodecahedronGeometry(4 + random() * 8, 0),
        i < 30 ? "#326464" : "#233f4a",
        this.decor,
        x,
        -y,
        -5 - random() * 20,
      );
      base.scale.set(1.6, 0.5, 1);
    }
    for (let i = 0; i < 100; i++) {
      const x = 45 + random() * 1150,
        y = (x < 330 ? 278 : 620) - random() * 13;
      const col = x < 330 ? "#528b77" : "#34736d";
      for (let j = 0; j < 3; j++) {
        const h = 5 + random() * 9;
        mesh(
          fin(
            [
              [j * 0.9, 0],
              [j * 0.9 + 1, h * 0.4],
              [j * 0.9 - 1, h * 0.8],
              [j * 0.9 + 1, h],
              [j * 0.9 + 2, h * 0.5],
              [j * 0.9 + 2, 0],
              [j * 0.9, 0],
            ],
            0.07,
          ),
          col,
          this.decor,
          x,
          -y,
          -5,
        );
      }
    }
    for (let i = 0; i < 24; i++) {
      const x = 60 + random() * 230,
        y = 232 + random() * 20;
      this.coral(x, y, i);
    }
    for (const [x, y] of [
      [430, 350],
      [520, 350],
      [900, 605],
      [1100, 605],
    ]) {
      for (let j = 0; j < 4; j++) {
        mesh(
          new T.CylinderGeometry(0.7, 1.4, 12 + j * 2, 7),
          "#3d5961",
          this.decor,
          x + j * 4,
          -y + 6 + j,
          -15,
        );
        mesh(
          new T.SphereGeometry(0.65, 8, 5),
          "#9cd3c0",
          this.decor,
          x + j * 4,
          -y + 13 + j * 2,
          -15,
          "#3c8b79",
        );
      }
    }
    // 祭场远景拱廊以缺口和倾斜表达沉没遗迹。
    for (let i = 0; i < 6; i++) {
      const x = 860 + i * 65;
      mesh(
        new T.CylinderGeometry(2.5, 3.5, 70, 8),
        "#2b3c53",
        this.decor,
        x,
        -490,
        -35,
      );
      mesh(new T.BoxGeometry(14, 4, 8), "#35455b", this.decor, x, -453, -35);
    }
  }
  coral(x: number, y: number, i: number) {
    const random = rng(i * 47 + 23);
    for (let j = 0; j < 4; j++) {
      const path = new T.CatmullRomCurve3([
        new T.Vector3(x, -y, -8),
        new T.Vector3(x + (j - 1.5) * 2, -y + 4, -8),
        new T.Vector3(x + (j - 1.5) * 3, -y + 6 + random() * 6, -8),
      ]);
      mesh(
        new T.TubeGeometry(path, 6, 0.4, 5, false),
        i % 3 === 0 ? "#ba8d88" : "#6fa499",
        this.decor,
      );
    }
  }
  syncWorld(game: Game) {
    this.actors.clear();
    this.models.clear();
    for (const m of this.terrainModels.values()) {
      m.traverse((o) => {
        if (o instanceof T.Mesh) o.geometry.dispose();
      });
      this.world.remove(m);
    }
    this.terrainModels.clear();
    for (const t of game.terrain) {
      const g = new T.Group();
      g.position.set(t.x, -t.y, 0);
      if (t.id.startsWith("exp-gate-")) {
        const color = t.id.endsWith("hold")
          ? "#baaa81"
          : t.id.endsWith("court")
            ? "#aab7c7"
            : "#8abcb9";
        for (let i = 0; i < 4; i++)
          mesh(
            new T.BoxGeometry(1.2, t.h, 3),
            color,
            g,
            (t.w * (i + 0.5)) / 4,
            -t.h / 2,
            2,
          );
        mesh(new T.BoxGeometry(t.w + 3, 2, 4), color, g, t.w / 2, -2, 2);
        mesh(
          new T.TorusGeometry(2, 0.23, 6, 16),
          color,
          g,
          t.w / 2,
          -t.h / 2,
          5,
          color,
        );
      } else if (t.shape === "wreck") {
        const hull = mesh(
          fin(
            [
              [0, -t.h * 0.35],
              [t.w * 0.1, 0],
              [t.w * 0.85, -t.h * 0.06],
              [t.w, -t.h * 0.48],
              [t.w * 0.83, -t.h],
              [t.w * 0.2, -t.h],
              [0, -t.h * 0.35],
            ],
            8,
          ),
          t.breakable ? "#8a7760" : "#605c50",
          g,
          0,
          0,
          -4,
        );
        for (let j = 0; j < t.w; j += 12)
          mesh(
            new T.BoxGeometry(0.4, t.h * 0.65, 8.3),
            "#313e3e",
            g,
            j,
            -t.h * 0.46,
            0,
          );
        if (t.w > 100) {
          for (let j = 0; j < 5; j++)
            mesh(
              new T.TorusGeometry(2.1, 0.4, 6, 12),
              "#b5a77a",
              g,
              25 + j * 21,
              -t.h * 0.42,
              4.5,
            );
          mesh(
            new T.BoxGeometry(t.w * 0.34, 6, 7),
            "#4c5c5c",
            g,
            t.w * 0.55,
            1,
            0,
          );
        }
      } else if (t.shape === "ruin") {
        mesh(
          new T.CylinderGeometry(t.w * 0.42, t.w * 0.5, t.h, 8),
          "#60747b",
          g,
          t.w / 2,
          -t.h / 2,
          0,
        );
        mesh(
          new T.BoxGeometry(t.w * 1.05, 4, 10),
          "#7f8c89",
          g,
          t.w / 2,
          -2,
          0,
        );
        for (let i = 0; i < 3; i++)
          mesh(
            new T.BoxGeometry(1, t.h * 0.75, 1),
            "#304756",
            g,
            t.w * 0.25 + i * 5,
            -t.h / 2,
            10,
          );
        mesh(
          new T.TorusGeometry(2.7, 0.3, 6, 16),
          "#a9d8c4",
          g,
          t.w / 2,
          -t.h * 0.2,
          10,
          "#487a72",
        );
      } else {
        const points = [
          [0, 0],
          [t.w * 0.18, t.h * 0.04],
          [t.w * 0.33, -t.h * 0.09],
          [t.w * 0.55, t.h * 0.02],
          [t.w * 0.73, -t.h * 0.08],
          [t.w * 0.91, 0],
          [t.w, -t.h * 0.1],
          [t.w, -t.h],
          [t.w * 0.65, -t.h * 1.03],
          [t.w * 0.3, -t.h * 0.97],
          [0, -t.h],
          [0, 0],
        ];
        mesh(
          fin(points, 22),
          t.shape === "ice" ? "#9dbdc2" : "#365761",
          g,
          0,
          0,
          -11,
        );
        const ridge = mesh(
          fin(
            [
              [0, 0],
              [t.w * 0.18, 0],
              [t.w * 0.4, -t.h * 0.17],
              [t.w * 0.7, -t.h * 0.08],
              [t.w, -t.h * 0.03],
              [t.w, -t.h * 0.14],
              [t.w * 0.5, -t.h * 0.24],
              [0, -t.h * 0.13],
              [0, 0],
            ],
            0.3,
          ),
          t.shape === "ice" ? "#c1d6cd" : "#537b75",
          g,
          0,
          0,
          11.5,
        );
        if (t.breakable) ridge.material = mat("#aa9470");
      }
      this.world.add(g);
      this.terrainModels.set(t.id, g);
    }
    for (const m of this.treasureModels.values()) {
      m.traverse((o) => {
        if (o instanceof T.Mesh) o.geometry.dispose();
      });
      this.world.remove(m);
    }
    this.treasureModels.clear();
    for (const t of game.treasures) {
      const g = equipmentModel("crystal");
      g.scale.setScalar(0.75);
      g.position.set(t.x, -t.y, 5);
      this.world.add(g);
      this.treasureModels.set(t.id, g);
    }
    this.playerKind = "";
    this.previewId = "";
  }
  setPreview(id: string) {
    if (id === this.previewId) return;
    this.showcase.clear();
    this.previewId = id;
    const key = id.startsWith("equip:") ? id : "player:" + id;
    this.preview = id.startsWith("equip:")
      ? compactModel(equipmentModel(id.slice(6)))
      : this.templates.get(key)!.clone(true);
    this.showcase.add(this.preview);
  }
  animateModel(
    m: T.Group,
    angle: number,
    facing: number,
    t: number,
    speed: number,
    bite = 0,
  ) {
    animateSwimming(m, angle, facing, speed, this.animationDt, bite);
  }
  animationDt = 0;
  render(game: Game, dt: number, previewId?: string) {
    this.animationDt =
      game.phase === "playing" || game.phase === "menu" ? dt : 0;
    this.time += dt;
    swimTime.value += this.animationDt;
    const active = game.phase !== "menu";
    this.explorationArt.group.visible = active && !previewId;
    if (active) this.explorationArt.update(game.exploration, swimTime.value);
    const p = game.player;
    this.back.uniforms.uTime.value = this.time;
    // 巨物仅存在于远景层；它的涌流由事件系统处理，轮廓不参与捕食碰撞。
    if (!this.leviathan) {
      this.leviathan = this.templates.get("boss")!.clone(true);
      const shadow = new T.MeshBasicMaterial({
        color: "#153749",
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      });
      this.leviathan.traverse((o) => {
        if (o instanceof T.Mesh) o.material = shadow;
      });
      this.scene.add(this.leviathan);
    }
    const passage = game.event;
    this.leviathan.visible =
      active && !previewId && passage?.type === 3 && passage.stage === "active";
    if (passage && this.leviathan.visible) {
      this.leviathan.position.set(
        passage.x - 180 + (passage.age - 5) * 12,
        -passage.y - 25,
        -36,
      );
      this.leviathan.scale.setScalar(3);
      this.animateModel(this.leviathan, 0, 1, this.time, 15);
      this.leviathan.scale.y = 3;
    }
    if (!game.won) this.victoryVisualDone = false;
    if (game.phase === "victory" && !this.corpse && !this.victoryVisualDone) {
      this.victoryVisualDone = true;
      const e = game.ecology.entities.find((a) => a.kind === "boss");
      if (e) {
        this.corpse = this.templates.get("boss")!.clone(true);
        this.corpse.position.set(e.x, -e.y, 1);
        this.corpse.rotation.z = -e.angle;
        this.corpse.traverse((o) => {
          if (o instanceof T.Mesh) {
            o.material = (o.material as T.Material).clone();
            (o.material as T.Material).transparent = true;
          }
        });
        this.scene.add(this.corpse);
        this.corpseTime = 0;
      }
    }
    if (this.corpse) {
      this.corpseTime += dt;
      this.corpse.position.y -= dt * 8;
      this.corpse.rotation.z += dt * 0.08;
      this.corpse.traverse((o) => {
        if (o instanceof T.Mesh)
          (o.material as T.Material).opacity = Math.max(
            0,
            1 - this.corpseTime / 4,
          );
      });
      if (this.corpseTime > 4 || !game.won) {
        this.scene.remove(this.corpse);
        this.corpse.traverse((o) => {
          if (o instanceof T.Mesh) (o.material as T.Material).dispose();
        });
        this.corpse = null;
      }
    }
    if (active && p) {
      this.showcase.visible = !!previewId;
      this.world.visible =
        this.decor.visible =
        this.actors.visible =
          !previewId;
      game.camera.x = lerp(
        game.camera.x,
        // 根据真实速度预留前方视野，原地转头不再拉扯镜头左右摇摆。
        p.x + clamp(p.vx * 0.18, -10, 10),
        1 - Math.exp(-dt * 5.5),
      );
      game.camera.y = lerp(
        game.camera.y,
        p.y + clamp(p.vy * 0.1, -5, 5),
        1 - Math.exp(-dt * 5.5),
      );
      this.camera.position.x = clamp(
        game.camera.x,
        this.viewW * 0.42,
        WORLD.width - this.viewW * 0.42,
      );
      this.camera.position.y = -clamp(
        game.camera.y,
        50,
        WORLD.height - this.viewH * 0.45,
      );
      this.ambient.intensity = 2.3 - (p.y / 650) * 0.5;
      if (this.playerKind !== game.def.id) {
        if (this.player) this.actors.remove(this.player);
        this.player = this.templates.get("player:" + game.def.id)!.clone(true);
        this.playerKind = game.def.id;
        this.actors.add(this.player);
      }
      this.player!.getObjectByName("moon")!.visible =
        game.storage.data.skin === "moon";
      this.player!.getObjectByName("explorer")!.visible =
        game.storage.data.skin === "explorer";
      this.player!.scale.setScalar(1 + p.growth * 0.07);
      animatePlayerSwimming(this.player!, p, game.def, this.animationDt);
      const blink =
        p.hurtCd > 0 && game.combo.rage <= 0 && Math.sin(this.time * 25) > 0;
      this.player!.visible = true;
      const alive = new Set<number>();
      for (const e of game.ecology.entities) {
        if (!e.alive) continue;
        alive.add(e.uid);
        const visible =
          Math.abs(e.x - this.camera.position.x) < this.viewW * 0.64 &&
          Math.abs(-e.y - this.camera.position.y) < this.viewH * 0.68;
        if (!visible) {
          const model = this.models.get(e.uid);
          if (model) model.visible = false;
          continue;
        }
        let model = this.models.get(e.uid);
        if (!model) {
          model = this.templates.get(e.kind)!.clone(true);
          this.actors.add(model);
          this.models.set(e.uid, model);
        }
        model.visible = true;
        model.position.set(e.x, -e.y, e.elite ? 3 : 1);
        const facing = Math.cos(e.angle) >= 0 ? 1 : -1;
        this.animateModel(
          model,
          e.angle,
          facing,
          this.time,
          Math.hypot(e.vx, e.vy),
        );
        if (
          e.kind === "net" ||
          e.kind === "turret" ||
          e.kind === "mine" ||
          e.kind === "boat"
        )
          model.rotation.set(0, 0, 0);
        if (e.kind === "jelly")
          model.scale.set(
            1 + Math.sin(this.time * 3 + e.uid) * 0.05,
            1 + Math.cos(this.time * 3 + e.uid) * 0.09,
            1,
          );
      }
      for (const [id, m] of this.models)
        if (!alive.has(id)) {
          this.actors.remove(m);
          this.models.delete(id);
        }
      for (const t of game.terrain) {
        const m = this.terrainModels.get(t.id);
        if (m) m.visible = !t.broken;
      }
      for (const t of game.treasures) {
        const m = this.treasureModels.get(t.id)!;
        m.visible = !t.collected;
        m.position.y = -t.y + Math.sin(this.time * 1.4) * 0.7;
        m.rotation.y = this.time * 0.5;
      }
    } else {
      this.showcase.visible = true;
      this.world.visible = this.decor.visible = true;
      this.actors.visible = false;
      this.camera.position.set(165, -125, 160);
      this.ambient.intensity = 2.8;
    }
    if (previewId || !active) {
      this.setPreview(previewId || game.storage.data.selected);
      const posX =
        this.camera.position.x + this.viewW * (previewId ? -0.22 : 0.19);
      if (this.preview) {
        this.preview.position.set(
          posX,
          this.camera.position.y + (active ? 1 : 3),
          10,
        );
        const scale = this.previewId.startsWith("equip:")
          ? 6
          : previewId
            ? 2.1
            : 3;
        const moon = this.preview.getObjectByName("moon");
        if (moon) moon.visible = game.storage.data.skin === "moon";
        const explorer = this.preview.getObjectByName("explorer");
        if (explorer) explorer.visible = game.storage.data.skin === "explorer";
        this.preview.scale.setScalar(scale);
        this.preview.rotation.y = -0.25 + Math.sin(this.time * 0.25) * 0.08;
        this.preview.rotation.z = Math.sin(this.time * 0.5) * 0.025;
        const tail = this.preview.getObjectByName("tail");
        if (tail) tail.rotation.y = Math.sin(this.time * 4) * 0.3;
      }
    }
    const arr = this.particleGeo.getAttribute("position") as T.BufferAttribute,
      cols = this.particleGeo.getAttribute("color") as T.BufferAttribute;
    let count = 0;
    if (active && !previewId)
      for (const a of game.particles) {
        if (a.text) continue;
        arr.setXYZ(count, a.x, -a.y, 15);
        const c = new T.Color(a.color).multiplyScalar(a.life / a.maxLife);
        cols.setXYZ(count, c.r, c.g, c.b);
        count++;
      }
    this.particleGeo.setDrawRange(0, count);
    arr.needsUpdate = true;
    cols.needsUpdate = true;
    this.particleMesh.visible = active;
    // 弹道网格固定池，防止每帧重新分配几何体。
    while (this.projectileGroup.children.length < 90) {
      const m = mesh(
        new T.SphereGeometry(1, 8, 5),
        "#d9cf9d",
        this.projectileGroup,
      );
      m.visible = false;
    }
    this.projectileGroup.children.forEach((m, i) => {
      const q = game.projectiles[i];
      m.visible = active && !!q && !previewId;
      if (q) {
        m.position.set(q.x, -q.y, 10);
        m.scale.set(
          q.type === "harpoon" ? q.radius * 2 : q.radius,
          q.radius * 0.5,
          q.radius * 0.5,
        );
        m.rotation.z = -Math.atan2(q.vy, q.vx);
      }
    });
    const surf = this.surface.geometry.getAttribute(
      "position",
    ) as T.BufferAttribute;
    for (let i = 0; i < surf.count; i++)
      surf.setY(
        i,
        -40 +
          Math.sin(i * 0.32 + this.time * 1.2) * 0.38 +
          Math.sin(i * 0.11 - this.time) * 0.45,
      );
    surf.needsUpdate = true;
    this.snow.rotation.z = Math.sin(this.time * 0.03) * 0.0015;
    this.renderer.render(this.scene, this.camera);
  }
  screen(pos: Vec) {
    this.projection.set(pos.x, -pos.y, 10).project(this.camera);
    return {
      x: ((this.projection.x + 1) * this.width) / 2,
      y: ((1 - this.projection.y) * this.height) / 2,
    };
  }
  worldPoint(pos: Vec) {
    return {
      x: this.camera.position.x + (pos.x / this.width - 0.5) * this.viewW,
      y: -this.camera.position.y + (pos.y / this.height - 0.5) * this.viewH,
    };
  }
  portrait(id: string) {
    const w = 720,
      h = 240,
      canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.setAttribute("aria-label", species(id).name + "真实模型");
    const target = new T.WebGLRenderTarget(w, h),
      scene = new T.Scene();
    scene.background = new T.Color("#173441");
    const model = this.templates.get(id)!.clone(true);
    model.rotation.y = -0.2;
    const size = species(id).size;
    scene.add(model, new T.HemisphereLight("#d3f4e0", "#30475a", 3));
    const light = new T.DirectionalLight("#edf0d7", 3);
    light.position.set(15, 30, 30);
    scene.add(light);
    const camera = new T.OrthographicCamera(
      -size * 0.8,
      size * 0.8,
      (size * 0.8 * h) / w,
      (-size * 0.8 * h) / w,
      0.1,
      150,
    );
    camera.position.z = 70;
    camera.position.y = size * 0.04;
    this.renderer.setRenderTarget(target);
    this.renderer.render(scene, camera);
    const pixels = new Uint8Array(w * h * 4);
    this.renderer.readRenderTargetPixels(target, 0, 0, w, h, pixels);
    const data = new Uint8ClampedArray(pixels.length);
    for (let y = 0; y < h; y++)
      data.set(
        pixels.subarray((h - 1 - y) * w * 4, (h - y) * w * 4),
        y * w * 4,
      );
    canvas.getContext("2d")!.putImageData(new ImageData(data, w, h), 0, 0);
    this.renderer.setRenderTarget(null);
    target.dispose();
    return canvas;
  }
  drawMap(game: Game, canvas: HTMLCanvasElement, full = false) {
    const w = canvas.width,
      h = canvas.height,
      c = canvas.getContext("2d")!;
    c.clearRect(0, 0, w, h);
    c.save();
    c.scale(w / WORLD.width, h / WORLD.height);
    c.fillStyle = "#0c2b38";
    c.fillRect(0, 0, 1240, 650);
    c.fillStyle = "#163c49";
    c.fillRect(0, 40, 340, 280);
    c.fillStyle = "#1b3643";
    c.fillRect(340, 40, 310, 280);
    c.fillStyle = "#233d52";
    c.fillRect(650, 40, 590, 280);
    c.fillStyle = "#242b46";
    c.fillRect(0, 320, 1240, 330);
    c.strokeStyle = "#a2d0c3";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, 40);
    c.lineTo(1240, 40);
    c.stroke();
    for (const t of game.terrain) {
      if (t.broken) continue;
      c.fillStyle = t.breakable ? "#b7a57c" : "#607780";
      c.fillRect(t.x, t.y, t.w, t.h);
    }
    if (full || game.equipment.includes("echo")) {
      for (const t of game.treasures) {
        if (t.collected) continue;
        c.fillStyle = "#e7c37f";
        c.beginPath();
        c.moveTo(t.x, t.y - 7);
        c.lineTo(t.x + 6, t.y);
        c.lineTo(t.x, t.y + 7);
        c.lineTo(t.x - 6, t.y);
        c.fill();
      }
    }
    for (const e of game.ecology.entities)
      if (e.elite && e.alive) {
        c.strokeStyle = e.kind === "boss" ? "#e5a280" : "#caa4d0";
        c.lineWidth = 3;
        c.beginPath();
        c.arc(e.x, e.y, e.kind === "boss" ? 14 : 9, 0, Math.PI * 2);
        c.stroke();
      }
    if (game.mode === "voyage" && game.stage < 12) {
      const t = TASKS_FOR_MAP[game.stage];
      c.strokeStyle = "#f2d38a";
      c.lineWidth = 3;
      c.beginPath();
      c.arc(t.x, t.y, 16, 0, Math.PI * 2);
      c.stroke();
    }
    // 仅绘制已发现的探索记录。未发现地点保留环境线索，不提前把地图填满问号。
    const exploration = game.exploration;
    for (const q of [...EXPEDITIONS, ...LANDMARKS]) {
      if (!exploration.found(q.id)) continue;
      const point = "entry" in q ? q.entry : q;
      c.strokeStyle =
        exploration.done(q.id) || exploration.data.claims.includes(q.id)
          ? "#b9dfbd"
          : "#a7d8e1";
      c.lineWidth = full ? 2.8 : 3.5;
      c.strokeRect(point.x - 6, point.y - 6, 12, 12);
    }
    const sideTarget = exploration.target();
    if (sideTarget) {
      c.strokeStyle = "#9edbea";
      c.lineWidth = 3;
      c.beginPath();
      c.arc(sideTarget.x, sideTarget.y, 12, 0, Math.PI * 2);
      c.stroke();
    }
    const p = game.player;
    if (p) {
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.angle);
      c.fillStyle = "#9ef1d4";
      c.beginPath();
      c.moveTo(12, 0);
      c.lineTo(-8, -7);
      c.lineTo(-5, 0);
      c.lineTo(-8, 7);
      c.fill();
      c.restore();
    }
    if (full) {
      c.fillStyle = "#d7e5df";
      c.font = "22px sans-serif";
      c.fillText("日光浅湾", 105, 96);
      c.fillText("沉船航道", 415, 96);
      c.fillText("冰冷外海", 850, 96);
      c.fillText("裂渊深海", 685, 375);
      c.font = "16px sans-serif";
      c.fillStyle = "#bacbc8";
      c.fillText("葬灯洞穴", 390, 525);
      c.fillText("裂渊祭场", 1035, 610);
    }
    c.restore();
  }
}
import { TASKS as TASKS_FOR_MAP } from "../data";
