import * as T from "three";
import type { Exploration } from "./system";
import { EXPEDITIONS, LANDMARKS, ENCOUNTERS } from "./data";
import {
  compactModel,
  creatureModel,
  equipmentModel,
  mat,
  mesh,
} from "../render/models";
import { species } from "../data";

const stroke = (
  points: number[][],
  color: string,
  parent: T.Group,
  radius = 0.22,
) =>
  mesh(
    new T.TubeGeometry(
      new T.CatmullRomCurve3(
        points.map((p) => new T.Vector3(...(p as [number, number, number]))),
      ),
      16,
      radius,
      5,
      false,
    ),
    color,
    parent,
  );

/** 探索道具为原创实体几何；只有水流线复用缓冲区，逐帧不创建模型或材质。 */
export class ExplorationRenderer {
  group = new T.Group();
  nodes = new Map<string, T.Group>();
  relics = new Map<string, T.Group>();
  shoal: T.Group[] = [];
  messenger: T.Group;
  cagedFish: T.Group[] = [];
  currents: T.LineSegments<T.BufferGeometry, T.LineBasicMaterial>;
  flow = new T.BufferGeometry();
  positions = new Float32Array(60 * 6);
  constructor() {
    for (const q of EXPEDITIONS) {
      for (let i = 0; i < q.nodes.length; i++) {
        const n = q.nodes[i],
          g = new T.Group();
        g.position.set(n.x, -n.y, 4);
        if (q.id === "hold") {
          mesh(new T.BoxGeometry(3, 6, 3), "#8f9687", g);
          mesh(new T.TorusGeometry(3, 0.55, 6, 14), "#c9ae7a", g, 0, 0, 2);
          for (let j = 0; j < 7; j++) {
            const ring = mesh(
              new T.TorusGeometry(0.9, 0.22, 5, 9),
              "#8e9d91",
              g,
              -j * 5.7,
              0,
              0,
            );
            ring.rotation.y = j % 2 ? 0.8 : 0;
          }
        } else {
          mesh(
            new T.CylinderGeometry(1.8, 2.8, 7, 8),
            q.id === "icepass" ? "#598b9f" : "#526f70",
            g,
            0,
            -4,
            0,
          );
          if (q.id === "coral") {
            for (let j = -1; j <= 1; j++)
              stroke(
                [
                  [j * 2, -7, 0],
                  [j * 2.4, -2, 0],
                  [j * 3, 3 + j, 0],
                ],
                "#7cbaa4",
                g,
                0.55,
              );
          } else if (q.id === "court") {
            const plate = mesh(
              new T.BoxGeometry(5.5, 7, 1.4),
              "#63747e",
              g,
              0,
              1,
              0,
            );
            if (i === 0)
              stroke(
                [
                  [-2, 0, 1],
                  [-1, 1.2, 1],
                  [0, 0, 1],
                  [1, -1.2, 1],
                  [2, 0, 1],
                ],
                q.color,
                g,
                0.18,
              );
            if (i === 1)
              for (const x of [-1.1, 1.1])
                mesh(
                  new T.TorusGeometry(1.3, 0.18, 5, 14),
                  q.color,
                  g,
                  x,
                  0,
                  1,
                );
            if (i === 2)
              mesh(
                new T.OctahedronGeometry(1.8),
                q.color,
                g,
                0,
                0,
                1.3,
                q.color,
              );
          } else
            mesh(new T.OctahedronGeometry(2.4), q.color, g, 0, 1, 0, q.color);
        }
        const ring = mesh(
          new T.TorusGeometry(q.id === "hold" ? 5 : 6, 0.18, 5, 28),
          q.color,
          g,
          0,
          0,
          4,
          q.color,
        );
        ring.name = "signal";
        this.group.add(g);
        this.nodes.set(n.id, g);
      }
      const relic = equipmentModel("crystal");
      relic.scale.setScalar(0.85);
      relic.position.set(q.goal.x, -q.goal.y, 5);
      this.group.add(relic);
      this.relics.set(q.id, relic);
      const pedestal = new T.Group();
      pedestal.position.set(q.goal.x, -q.goal.y - 6, 0);
      mesh(new T.CylinderGeometry(4, 6, 3, 8), "#586d72", pedestal);
      const halo = mesh(
        new T.TorusGeometry(7, 0.15, 5, 32),
        q.color,
        pedestal,
        0,
        7,
        -1,
        q.color,
      );
      this.group.add(compactModel(pedestal));
    }
    for (const l of LANDMARKS) {
      const g = new T.Group();
      g.position.set(l.x, -l.y, -1);
      if (l.id === "garden") {
        for (let i = 0; i < 9; i++) {
          const x = ((i % 3) - 1) * 4,
            y = (Math.floor(i / 3) - 1) * 3;
          const shell = mesh(
            new T.SphereGeometry(1.8, 10, 6),
            i % 2 ? "#9eafa5" : "#91b3a6",
            g,
            x,
            y,
            0,
          );
          shell.scale.set(1, 0.5, 0.6);
          stroke(
            [
              [x, y, 0],
              [x + 1, y + 3, 0],
              [x - 1, y + 6, 0],
            ],
            l.color,
            g,
            0.16,
          );
          mesh(
            new T.SphereGeometry(0.35, 6, 4),
            l.color,
            g,
            x - 1,
            y + 6,
            1,
            l.color,
          );
        }
      } else if (l.id === "bell") {
        mesh(
          new T.CylinderGeometry(1.4, 5.5, 7, 16, 1, true),
          "#948d6b",
          g,
          0,
          0,
          0,
        );
        mesh(
          new T.TorusGeometry(5.6, 0.45, 6, 20),
          "#baa675",
          g,
          0,
          -3.5,
          0,
        ).rotation.x = Math.PI / 2;
        stroke(
          [
            [0, 5, 0],
            [1, 9, 0],
            [0, 14, 0],
          ],
          "#778b83",
          g,
          0.35,
        );
        for (let i = 0; i < 3; i++)
          mesh(
            new T.TorusGeometry(6 + i * 3, 0.09, 4, 36),
            l.color,
            g,
            0,
            0,
            -2 - i,
          );
      } else if (l.id === "whalesong") {
        for (let i = 0; i < 5; i++) {
          const c = mesh(
            new T.ConeGeometry(1.6, 10 + i * 2, 6),
            "#a4cbd0",
            g,
            (i - 2) * 4,
            0,
            0,
          );
          c.rotation.z = (i - 2) * 0.16;
          mesh(
            new T.SphereGeometry(0.45, 8, 5),
            l.color,
            g,
            (i - 2) * 4,
            6 + i,
            1,
            l.color,
          );
        }
        for (let i = 0; i < 3; i++)
          mesh(
            new T.TorusGeometry(10 + i * 4, 0.1, 4, 36),
            l.color,
            g,
            0,
            0,
            -3 - i,
          );
      } else {
        stroke(
          [
            [-18, 0, 0],
            [-6, 2, 0],
            [7, 1, 0],
            [21, -2, 0],
          ],
          "#b0b6a5",
          g,
          0.85,
        );
        for (let i = 0; i < 8; i++) {
          const x = -15 + i * 4;
          stroke(
            [
              [x, 0, 0],
              [x - 2, 4, 1],
              [x - 1, 9 - i * 0.4, 0],
            ],
            "#9bada5",
            g,
            0.48,
          );
          stroke(
            [
              [x, 0, 0],
              [x + 1, -4, 1],
              [x + 2, -7 + i * 0.3, 0],
            ],
            "#9bada5",
            g,
            0.4,
          );
          if (i % 2)
            mesh(
              new T.SphereGeometry(0.4, 6, 5),
              l.color,
              g,
              x - 1,
              7,
              1,
              l.color,
            );
        }
      }
      this.group.add(compactModel(g));
    }
    const fishTemplate = compactModel(creatureModel(species("sprat")));
    for (let i = 0; i < 5; i++) {
      const fish = fishTemplate.clone(true);
      this.group.add(fish);
      this.shoal.push(fish);
    }
    this.messenger = fishTemplate.clone(true);
    this.messenger.scale.setScalar(1.65);
    this.group.add(this.messenger);
    for (let i = 0; i < 7; i++) {
      const fish = fishTemplate.clone(true);
      this.group.add(fish);
      this.cagedFish.push(fish);
    }
    this.flow.setAttribute(
      "position",
      new T.BufferAttribute(this.positions, 3),
    );
    this.currents = new T.LineSegments(
      this.flow,
      new T.LineBasicMaterial({
        color: "#b8e7ed",
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      }),
    );
    this.group.add(this.currents);
  }
  update(e: Exploration, time: number) {
    for (const q of EXPEDITIONS) {
      const step = e.step(q.id);
      q.nodes.forEach((n, i) => {
        const model = this.nodes.get(n.id)!;
        model.visible = q.id !== "hold" || !e.data.anchors.includes(n.id);
        const signal = model.getObjectByName("signal")!;
        signal.visible =
          !e.done(q.id) && (i === step || (q.id === "court" && i < step));
        signal.scale.setScalar(1 + Math.sin(time * 1.7) * 0.045);
      });
      const relic = this.relics.get(q.id)!;
      relic.visible = !e.done(q.id);
      relic.rotation.y = time * 0.45;
      relic.position.y = -q.goal.y + Math.sin(time * 1.3) * 0.5;
    }
    const coral = EXPEDITIONS[0],
      target = coral.nodes[e.step("coral")] || coral.goal;
    this.shoal.forEach((fish, i) => {
      fish.visible = !e.done("coral");
      const a = time * 0.6 + i * 1.25;
      fish.position.set(
        target.x + Math.cos(a) * 5,
        -target.y + Math.sin(a) * 3,
        5,
      );
      fish.rotation.set(
        0,
        Math.cos(a + 0.7) > 0 ? 0 : Math.PI,
        Math.sin(a) * 0.15,
      );
    });
    this.messenger.visible = !e.data.encounters.includes("messenger");
    this.messenger.position.set(
      e.messenger.x,
      -e.messenger.y + Math.sin(time * 2) * 0.5,
      5,
    );
    this.cagedFish.forEach((fish, i) => {
      fish.visible = !e.data.encounters.includes("rescue");
      fish.position.set(
        ENCOUNTERS[0].x + Math.sin(time + i) * 2,
        -ENCOUNTERS[0].y + ((i % 3) - 1) * 2,
        2,
      );
      fish.rotation.y = Math.cos(time + i) > 0 ? 0 : Math.PI;
    });
    const flowing = !e.iceCalm();
    this.currents.material.opacity = flowing ? 0.32 : 0.11;
    for (let i = 0; i < 60; i++) {
      const x =
          938 + ((((i * 17.3 - time * (flowing ? 25 : 5)) % 185) + 185) % 185),
        y = 224 + (i % 9) * 9;
      const rest = e.iceRest({ x, y });
      const offset = i * 6,
        length = rest ? 0 : flowing ? 5 : 2;
      this.positions.set([x, -y, 6, x + length, -y + 0.25, 6], offset);
    }
    this.flow.getAttribute("position").needsUpdate = true;
  }
}
