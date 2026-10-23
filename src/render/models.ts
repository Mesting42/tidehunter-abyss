import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { SharkDef, Species } from "../types";
/** 原创曲面与鳍片均在本地构造。模板共享几何体/材质，实体销毁不重复分配 GPU 资源。 */
export const swimTime = { value: 0 };
const materials = new Map<string, T.MeshStandardMaterial>();
export function mat(
  color: string,
  roughness = 0.58,
  emissive = "black",
  metalness = 0.08,
) {
  const key = color + roughness + emissive + metalness;
  if (!materials.has(key))
    materials.set(
      key,
      new T.MeshStandardMaterial({
        color,
        roughness,
        metalness,
        emissive,
        emissiveIntensity: 0.65,
        side: T.DoubleSide,
      }),
    );
  return materials.get(key)!;
}
export function mesh(
  geo: T.BufferGeometry,
  color: string,
  parent: T.Object3D,
  x = 0,
  y = 0,
  z = 0,
  emissive = "black",
) {
  const m = new T.Mesh(geo, mat(color, 0.58, emissive));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
/** 闭合厚鳍采用曲线轮廓加挤出与小倒角，不以默认三角片拼完整角色。 */
export function fin(points: number[][], depth = 0.2) {
  const s = new T.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 3) {
    if (i + 2 < points.length)
      s.bezierCurveTo(
        points[i][0],
        points[i][1],
        points[i + 1][0],
        points[i + 1][1],
        points[i + 2][0],
        points[i + 2][1],
      );
    else s.lineTo(points[i][0], points[i][1]);
  }
  s.closePath();
  return new T.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelSize: depth * 0.55,
    bevelThickness: depth * 0.45,
    bevelSegments: 2,
    steps: 1,
    curveSegments: 8,
  });
}
function line(
  points: number[][],
  color: string,
  parent: T.Object3D,
  width = 0.05,
) {
  const curve = new T.CatmullRomCurve3(
    points.map((a) => new T.Vector3(a[0], a[1], a[2] || 0)),
  );
  return mesh(new T.TubeGeometry(curve, 12, width, 5, false), color, parent);
}
/** 鱼体截面：x 为长度比例，ry/rz 为截面半径。顶腹使用顶点色渐变，体积依赖真实曲面。 */
function bodyGeometry(
  length: number,
  girth: number,
  color: string,
  belly: string,
  shape = "shark",
) {
  const positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const dark = new T.Color(color),
    light = new T.Color(belly);
  const rings = 40,
    sides = 18;
  const profiles =
    shape === "tuna"
      ? [0.07, 0.24, 0.6, 0.93, 1, 0.9, 0.66, 0.4, 0.04]
      : shape === "eel"
        ? [0.14, 0.3, 0.5, 0.7, 0.9, 1, 0.96, 0.7, 0.1]
        : [0.1, 0.21, 0.47, 0.8, 1, 0.96, 0.84, 0.59, 0.02];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings,
      k = t * (profiles.length - 1),
      a = Math.floor(k),
      r = T.MathUtils.lerp(
        profiles[a],
        profiles[Math.min(a + 1, profiles.length - 1)],
        k - a,
      );
    for (let j = 0; j <= sides; j++) {
      const angle = (j / sides) * Math.PI * 2;
      const y = Math.cos(angle) * girth * r,
        z = Math.sin(angle) * girth * r * (shape === "tuna" ? 0.7 : 0.68);
      positions.push((t - 0.5) * length, y, z);
      const c = dark
        .clone()
        .lerp(
          light,
          T.MathUtils.smoothstep(-y / Math.max(girth * r, 0.01), -0.1, 0.65),
        );
      if (shape === "shark" && y > 0)
        c.multiplyScalar(0.9 + 0.06 * Math.sin(t * 45));
      colors.push(c.r, c.g, c.b);
      if (i < rings && j < sides) {
        const n = i * (sides + 1) + j;
        indices.push(
          n,
          n + sides + 1,
          n + 1,
          n + 1,
          n + sides + 1,
          n + sides + 2,
        );
      }
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
function skin(geo: T.BufferGeometry, parent: T.Object3D) {
  const m = new T.Mesh(
    geo,
    new T.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.48,
      metalness: 0.12,
    }),
  );
  parent.add(m);
  return m;
}
function eye(
  parent: T.Object3D,
  x: number,
  y: number,
  z: number,
  r = 0.3,
  glow = "#75e5c9",
) {
  mesh(new T.SphereGeometry(r * 1.35, 12, 8), "#101d29", parent, x, y, z);
  mesh(
    new T.SphereGeometry(r * 0.65, 10, 8),
    glow,
    parent,
    x + r * 0.15,
    y + r * 0.1,
    z + r * 0.8,
    glow,
  );
  mesh(
    new T.SphereGeometry(r * 0.25, 8, 6),
    "#e3f2e9",
    parent,
    x + r * 0.3,
    y + r * 0.3,
    z + r * 1.25,
  );
}
export function sharkModel(d: SharkDef) {
  const g = new T.Group(),
    L = d.length,
    R = d.girth;
  skin(bodyGeometry(L, R, d.color, d.belly), g);
  const dorsal = mesh(
    fin(
      [
        [L * 0.04, R * 0.72],
        [L * 0.02, R * 1.05],
        [L * 0.01, R + d.fin * 0.75],
        [-L * 0.02, R + d.fin],
        [-L * 0.08, R + d.fin * 0.5],
        [-L * 0.12, R * 0.86],
        [-L * 0.2, R * 0.68],
      ],
      0.25,
    ),
    d.color,
    g,
  );
  dorsal.name = "dorsal";
  mesh(
    fin(
      [
        [-L * 0.27, R * 0.46],
        [-L * 0.28, R * 1.05],
        [-L * 0.35, R * 0.9],
        [-L * 0.37, R * 0.32],
      ],
      0.2,
    ),
    d.color,
    g,
  );
  for (const side of [-1, 1]) {
    const wing = mesh(
      fin(
        [
          [L * 0.08, -R * 0.45],
          [-L * 0.01, -R * 1.8],
          [-L * 0.24, -R * 1.65],
          [-L * 0.19, -R * 0.35],
        ],
        0.3,
      ),
      d.color,
      g,
      0,
      0,
      side * R * 0.45,
    );
    wing.rotation.x = side * 0.85;
    const rear = mesh(
      fin(
        [
          [-L * 0.23, -R * 0.35],
          [-L * 0.29, -R * 0.93],
          [-L * 0.43, -R * 0.7],
          [-L * 0.35, -R * 0.2],
        ],
        0.22,
      ),
      d.color,
      g,
      0,
      0,
      side * R * 0.35,
    );
    rear.rotation.x = side * 0.7;
  }
  const tail = new T.Group();
  tail.name = "tail";
  tail.position.x = -L * 0.44;
  g.add(tail);
  mesh(
    fin(
      [
        [0, 0.4],
        [-L * 0.05, R * 0.6],
        [-L * 0.11, R * 1.6],
        [-L * 0.23, R * 2.15],
        [-L * 0.2, R * 0.95],
        [-L * 0.15, R * 0.35],
        [-L * 0.14, 0],
        [-L * 0.15, -R * 0.3],
        [-L * 0.2, -R * 1.1],
        [-L * 0.22, -R * 1.45],
        [-L * 0.1, -R * 1.12],
        [-L * 0.04, -R * 0.4],
        [0, -0.4],
      ],
      0.18,
    ),
    d.color,
    tail,
  );
  // 咬合缝置于靠镜头一侧，口腔有深色内壁、上下颌与两排细齿。
  const jaw = new T.Group();
  jaw.name = "jaw";
  jaw.position.set(L * 0.23, -R * 0.34, R * 0.48);
  g.add(jaw);
  mesh(
    fin(
      [
        [0, 0],
        [L * 0.08, -R * 0.24],
        [L * 0.2, -R * 0.19],
        [L * 0.265, R * 0.11],
        [L * 0.18, R * 0.2],
        [L * 0.06, R * 0.08],
        [0, 0],
      ],
      0.11,
    ),
    "#17262d",
    jaw,
  );
  for (let i = 0; i < 9; i++) {
    const x = L * (0.028 + i * 0.024);
    const tooth = new T.Shape();
    tooth.moveTo(x, 0.03);
    tooth.lineTo(x + L * 0.009, -R * 0.22);
    tooth.lineTo(x + L * 0.019, R * 0.01);
    mesh(new T.ShapeGeometry(tooth), "#e3dfbd", jaw, 0, 0, 0.16);
    if (i < 7) {
      const t = new T.Shape();
      t.moveTo(x, -R * 0.18);
      t.lineTo(x + L * 0.009, -R * 0.02);
      t.lineTo(x + L * 0.018, -R * 0.18);
      mesh(new T.ShapeGeometry(t), "#d5d8c8", jaw, 0, 0, 0.17);
    }
  }
  for (const side of [-1, 1]) {
    eye(
      g,
      L * 0.34,
      R * 0.3,
      side * R * 0.55,
      R * 0.105,
      d.id === "abyss" ? "#b5a0ee" : "#a6e0cf",
    );
    for (let i = 0; i < 5; i++)
      line(
        [
          [L * (0.13 - i * 0.029), R * 0.28, side * R * 0.67],
          [L * (0.1 - i * 0.029), -R * 0.05, side * R * 0.72],
          [L * (0.12 - i * 0.029), -R * 0.42, side * R * 0.62],
        ],
        "#29424b",
        g,
        0.065,
      );
  }
  if (d.id === "hammer") {
    skin(bodyGeometry(R * 3.5, R * 0.6, d.color, d.belly), g).rotation.y =
      Math.PI / 2;
    const head = g.children[g.children.length - 1];
    head.position.set(L * 0.35, 0.2, 0);
    eye(g, L * 0.35, 0.6, R * 1.7, 0.35);
    eye(g, L * 0.35, 0.6, -R * 1.7, 0.35);
  }
  if (d.id === "abyss") {
    for (let i = 0; i < 11; i++)
      mesh(
        new T.SphereGeometry(0.17, 6, 5),
        "#8bdfd9",
        g,
        L * (0.28 - i * 0.06),
        R * 0.32,
        R * 0.67,
        "#69ccc5",
      );
    line(
      [
        [L * 0.37, R * 0.5, 0],
        [L * 0.41, R * 1.6, 0],
        [L * 0.61, R * 1.3, 0],
      ],
      "#697c9c",
      g,
      0.12,
    );
    mesh(
      new T.SphereGeometry(0.5, 10, 8),
      "#b7e6e1",
      g,
      L * 0.61,
      R * 1.3,
      0,
      "#7ef2cf",
    );
  }
  if (d.id === "mako") {
    mesh(
      fin(
        [
          [L * 0.42, 0.8],
          [L * 0.7, 0.15],
          [L * 0.6, -0.3],
          [L * 0.43, -0.8],
        ],
        0.25,
      ),
      d.color,
      g,
    );
  }
  const moon = new T.Group();
  moon.name = "moon";
  for (let i = 0; i < 4; i++)
    line(
      [
        [-L * 0.17 + i * L * 0.09, R * 0.5, R * 0.61],
        [-L * 0.22 + i * L * 0.09, R * 0.18, R * 0.72],
        [-L * 0.19 + i * L * 0.09, -R * 0.1, R * 0.7],
      ],
      "#b8d6be",
      moon,
      0.11,
    );
  g.add(moon);
  moon.visible = false;
  // 四海印记外观：双侧回潮纹与发光背鳍脉络，独立节点保证不污染原生材质。
  const explorer = new T.Group();
  explorer.name = "explorer";
  for (const side of [-1, 1])
    for (let i = 0; i < 3; i++)
      line(
        [
          [-L * 0.24 + i * L * 0.12, R * 0.5, side * R * 0.65],
          [-L * 0.12 + i * L * 0.1, R * 0.12, side * R * 0.73],
          [-L * 0.26 + i * L * 0.12, -R * 0.18, side * R * 0.67],
        ],
        "#8fd7ea",
        explorer,
        0.16,
      );
  line(
    [
      [-L * 0.04, R * 0.8, 0.25],
      [-L * 0.03, R + d.fin * 0.7, 0.25],
      [L * 0.02, R * 0.85, 0.25],
    ],
    "#b6e8e1",
    explorer,
    0.12,
  );
  g.add(explorer);
  explorer.visible = false;
  return g;
}
export function creatureModel(d: Species) {
  if (d.shape === "shark")
    return sharkModel({
      id: d.id,
      name: d.name,
      title: "",
      desc: "",
      color: d.color,
      belly: "#b7c9c6",
      length: d.size,
      girth: d.size * 0.19,
      fin: d.size * 0.26,
      level: d.level,
      hp: d.hp,
      speed: d.speed,
      boost: 60,
      bite: 20,
      hunger: 1,
      turn: 4,
      skill: "",
      skillDesc: "",
      cooldown: 10,
      price: 0,
    });
  const g = new T.Group(),
    s = d.size;
  if (["fish", "tuna", "eel", "boss"].includes(d.shape)) {
    skin(
      bodyGeometry(
        s,
        s * (d.shape === "boss" ? 0.13 : d.shape === "eel" ? 0.09 : 0.22),
        d.color,
        "#c5dace",
        d.shape === "boss" ? "eel" : d.shape,
      ),
      g,
    );
    const tail = new T.Group();
    tail.name = "tail";
    tail.position.x = -s * 0.43;
    g.add(tail);
    mesh(
      fin(
        [
          [0, 0],
          [-s * 0.27, s * 0.33],
          [-s * 0.12, 0],
          [-s * 0.27, -s * 0.31],
          [0, 0],
        ],
        0.08,
      ),
      d.color,
      tail,
    );
    mesh(
      fin(
        [
          [s * 0.05, s * 0.15],
          [-s * 0.1, s * 0.48],
          [-s * 0.24, s * 0.16],
          [s * 0.05, s * 0.15],
        ],
        0.08,
      ),
      d.color,
      g,
    );
    eye(g, s * 0.33, s * 0.065, s * 0.13, s * 0.038);
    if (d.shape === "boss") {
      for (let i = 0; i < 9; i++) {
        const x = s * (0.32 - i * 0.07);
        line(
          [
            [x, s * 0.08, s * 0.095],
            [x - s * 0.025, 0, s * 0.14],
            [x, -s * 0.1, s * 0.07],
          ],
          "#93ebd4",
          g,
          0.18,
        );
      }
      mesh(
        fin(
          [
            [s * 0.16, -s * 0.02],
            [s * 0.48, -s * 0.21],
            [s * 0.53, 0],
            [s * 0.16, -s * 0.02],
          ],
          0.3,
        ),
        "#182f3b",
        g,
      );
      for (let i = 0; i < 8; i++) {
        const t = new T.Shape();
        t.moveTo(s * (0.2 + i * 0.036), -s * 0.04);
        t.lineTo(s * (0.215 + i * 0.036), -s * 0.12);
        t.lineTo(s * (0.23 + i * 0.036), -s * 0.04);
        mesh(new T.ShapeGeometry(t), "#e1e2c3", g, 0, 0, s * 0.14);
      }
      line(
        [
          [s * 0.29, s * 0.06, s * 0.13],
          [s * 0.3, s * 0.14, s * 0.1],
          [s * 0.27, s * 0.23, s * 0.02],
        ],
        "#b3f6dd",
        g,
        0.6,
      );
    }
    return g;
  }
  if (d.shape === "ray") {
    mesh(
      fin(
        [
          [s * 0.48, 0],
          [s * 0.03, s * 0.27],
          [-s * 0.22, s * 0.32],
          [-s * 0.46, 0.1],
          [-s * 0.2, -s * 0.15],
          [s * 0.12, -s * 0.2],
          [s * 0.48, 0],
        ],
        0.15,
      ),
      d.color,
      g,
    );
    const wing = mesh(
      fin(
        [
          [s * 0.18, 0],
          [-s * 0.12, s * 0.8],
          [-s * 0.38, s * 0.56],
          [-s * 0.25, 0],
        ],
        0.09,
      ),
      d.color,
      g,
    );
    wing.rotation.x = 0.55;
    const wing2 = wing.clone();
    wing2.scale.y = -1;
    g.add(wing2);
    line(
      [
        [-s * 0.3, 0, 0],
        [-s * 0.7, -s * 0.05, 0],
        [-s, 0, 0],
      ],
      "#6f768e",
      g,
      0.08,
    );
    eye(g, s * 0.25, 0.08, 0.25, s * 0.04);
    return g;
  }
  if (d.shape === "jelly") {
    const cap = mesh(
      new T.SphereGeometry(s * 0.48, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
      d.color,
      g,
      0,
      s * 0.1,
      0,
      d.color,
    );
    cap.scale.y = 0.62;
    for (let i = 0; i < 7; i++)
      line(
        [
          [(i - 3) * s * 0.12, 0, 0.15],
          [(i - 3) * s * 0.13, -s * 0.4, 0.25],
          [(i - 3) * s * 0.12 + Math.sin(i) * 0.4, -s * 0.9, 0.2],
        ],
        d.color,
        g,
        0.045,
      );
    return g;
  }
  if (d.shape === "urchin" || d.shape === "mine") {
    mesh(new T.DodecahedronGeometry(s * 0.4, 1), d.color, g);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const spike = mesh(
        new T.ConeGeometry(s * 0.09, s * 0.4, 5),
        d.shape === "mine" ? "#859393" : d.color,
        g,
        Math.cos(a) * s * 0.43,
        Math.sin(a) * s * 0.43,
        0.2,
      );
      spike.rotation.z = a - Math.PI / 2;
    }
    if (d.shape === "mine") {
      mesh(
        new T.SphereGeometry(s * 0.12, 8, 6),
        "#f4a674",
        g,
        0,
        0,
        s * 0.45,
        "#ff7744",
      );
      line(
        [
          [0, -s * 0.3, 0],
          [0.1, -s * 1.3, 0],
          [0, -s * 2, 0],
        ],
        "#62747b",
        g,
        0.06,
      );
    }
    return g;
  }
  if (d.shape === "crab") {
    const b = mesh(new T.SphereGeometry(s * 0.4, 16, 8), d.color, g);
    b.scale.set(1, 0.62, 0.7);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++)
        line(
          [
            [(i - 1.5) * s * 0.15, 0, 0],
            [(i - 1.5) * s * 0.25, side * s * 0.4, 0.1],
            [(i - 1.5) * s * 0.35, side * s * 0.52, 0.15],
          ],
          d.color,
          g,
          0.08,
        );
      mesh(
        fin(
          [
            [s * 0.2, side * s * 0.2],
            [s * 0.6, side * s * 0.6],
            [s * 0.7, side * s * 0.1],
            [s * 0.45, side * s * 0.18],
          ],
          0.13,
        ),
        d.color,
        g,
      );
    }
    eye(g, s * 0.3, 0.2, s * 0.27, s * 0.08);
    return g;
  }
  if (d.shape === "squid") {
    const b = mesh(
      new T.SphereGeometry(s * 0.25, 14, 10),
      d.color,
      g,
      s * 0.1,
      0,
      0,
    );
    b.scale.set(1.7, 1, 0.8);
    mesh(
      fin(
        [
          [s * 0.1, 0],
          [-s * 0.2, s * 0.45],
          [-s * 0.45, s * 0.12],
          [-s * 0.2, 0],
        ],
        0.07,
      ),
      d.color,
      g,
    );
    for (let i = 0; i < 6; i++)
      line(
        [
          [-s * 0.2, (i - 2.5) * s * 0.055, 0.1],
          [-s * 0.55, (i - 2.5) * s * 0.1, 0.1],
          [-s * 0.8, (i - 2.5) * s * 0.13, 0.2],
        ],
        d.color,
        g,
        0.045,
      );
    eye(g, s * 0.1, s * 0.1, s * 0.2, s * 0.08);
    return g;
  }
  if (d.shape === "angler") {
    const b = skin(bodyGeometry(s, s * 0.28, d.color, "#998cab", "tuna"), g);
    b.scale.x = 0.8;
    mesh(
      fin(
        [
          [s * 0.15, s * 0.12],
          [s * 0.5, 0],
          [s * 0.27, -s * 0.23],
          [s * 0.15, s * 0.12],
        ],
        0.15,
      ),
      "#172434",
      g,
      0,
      0,
      s * 0.23,
    );
    for (let i = 0; i < 6; i++) {
      const t = new T.Shape();
      t.moveTo(s * (0.17 + i * 0.04), s * 0.05);
      t.lineTo(s * (0.19 + i * 0.04), -s * 0.07);
      t.lineTo(s * (0.21 + i * 0.04), s * 0.04);
      mesh(new T.ShapeGeometry(t), "#dfdfc2", g, 0, 0, s * 0.27);
    }
    line(
      [
        [s * 0.12, s * 0.22, 0],
        [s * 0.25, s * 0.66, 0],
        [s * 0.6, s * 0.44, 0],
      ],
      "#a0afac",
      g,
      0.06,
    );
    mesh(
      new T.SphereGeometry(s * 0.065, 10, 8),
      "#b4ffda",
      g,
      s * 0.6,
      s * 0.44,
      0,
      "#8bf6c6",
    );
    eye(g, s * 0.07, s * 0.12, s * 0.25, s * 0.05);
    return g;
  }
  if (d.shape === "bird") {
    mesh(
      fin(
        [
          [-s * 0.35, 0],
          [-s * 0.1, s * 0.45],
          [0, s * 0.32],
          [s * 0.1, 0],
          [s * 0.25, s * 0.5],
          [s * 0.5, s * 0.52],
          [s * 0.3, s * 0.05],
        ],
        0.08,
      ),
      d.color,
      g,
    );
    skin(bodyGeometry(s * 0.55, s * 0.1, d.color, "#c1c9c0", "tuna"), g);
    return g;
  }
  if (d.shape === "boat") {
    mesh(
      fin(
        [
          [-s * 0.55, s * 0.14],
          [s * 0.55, s * 0.14],
          [s * 0.36, -s * 0.2],
          [-s * 0.32, -s * 0.2],
        ],
        s * 0.3,
      ),
      "#64554a",
      g,
      0,
      0,
      -s * 0.15,
    );
    mesh(
      new T.BoxGeometry(s * 0.28, s * 0.22, s * 0.2),
      d.color,
      g,
      -s * 0.07,
      s * 0.23,
      0,
    );
    mesh(
      new T.BoxGeometry(s * 0.18, s * 0.1, s * 0.22),
      "#263e48",
      g,
      -s * 0.06,
      s * 0.25,
      0.02,
    );
    line(
      [
        [-s * 0.25, s * 0.2, 0],
        [-s * 0.25, s * 0.7, 0],
      ],
      "#a5b8b0",
      g,
      0.1,
    );
    mesh(
      fin(
        [
          [-s * 0.24, s * 0.66],
          [-s * 0.01, s * 0.58],
          [-s * 0.23, s * 0.45],
          [-s * 0.24, s * 0.66],
        ],
        0.04,
      ),
      "#b77e68",
      g,
    );
    return g;
  }
  if (d.shape === "net") {
    for (let i = 0; i < 7; i++) {
      line(
        [
          [-s * 0.45 + i * s * 0.15, -s * 0.42, 0],
          [-s * 0.45 + i * s * 0.15, s * 0.42, 0],
        ],
        "#aeb99e",
        g,
        0.035,
      );
      line(
        [
          [-s * 0.45, -s * 0.42 + i * s * 0.14, 0],
          [s * 0.45, -s * 0.42 + i * s * 0.14, 0],
        ],
        "#aeb99e",
        g,
        0.035,
      );
    }
    for (const a of [-1, 1])
      mesh(
        new T.CapsuleGeometry(0.3, s * 0.8, 4, 6),
        "#a69a72",
        g,
        a * s * 0.45,
        0,
        0,
      );
    return g;
  }
  if (d.shape === "turret") {
    mesh(
      new T.CylinderGeometry(s * 0.3, s * 0.4, s * 0.22, 8),
      "#586b68",
      g,
      0,
      -s * 0.2,
      0,
    );
    mesh(
      new T.BoxGeometry(s * 0.7, s * 0.15, s * 0.16),
      d.color,
      g,
      s * 0.1,
      s * 0.04,
      0,
    );
    mesh(
      new T.ConeGeometry(s * 0.12, s * 0.3, 6),
      "#c4d2c7",
      g,
      s * 0.48,
      s * 0.04,
      0,
    ).rotation.z = -Math.PI / 2;
    mesh(
      new T.SphereGeometry(0.22, 8, 6),
      "#f3ae79",
      g,
      0,
      s * 0.05,
      s * 0.22,
      "#c58f58",
    );
    return g;
  }
  return g;
}
/** 装备预览采用对应的实物零件：潮核、鳍环、声呐、鳃甲和棱晶。 */
export function equipmentModel(shape: string) {
  const g = new T.Group();
  if (shape === "ring") {
    mesh(new T.TorusGeometry(2, 0.35, 8, 24), "#bdac7c", g);
    mesh(
      new T.TorusGeometry(1.3, 0.13, 8, 24),
      "#84d5bf",
      g,
      0,
      0,
      0.2,
      "#487e73",
    );
  } else if (shape === "gill") {
    for (let i = 0; i < 5; i++)
      mesh(
        fin(
          [
            [-2 + i * 0.7, -2],
            [-2 + i * 0.7, 2],
            [-0.8 + i * 0.7, 1.5],
            [-1 + i * 0.7, -1.7],
          ],
          0.3,
        ),
        "#8aab9f",
        g,
        0,
        0,
        i * 0.12,
      );
  } else if (shape === "sonar") {
    mesh(new T.CylinderGeometry(1.8, 1.8, 0.6, 20), "#698f95", g).rotation.x =
      Math.PI / 2;
    mesh(
      new T.TorusGeometry(1.2, 0.08, 6, 24),
      "#a4dfc8",
      g,
      0,
      0,
      0.5,
      "#91dfbb",
    );
    line(
      [
        [0, 0, 0.55],
        [0.9, 0.7, 0.55],
      ],
      "#c5ead8",
      g,
      0.1,
    );
  } else {
    const m = mesh(
      new T.OctahedronGeometry(2, 0),
      shape === "core" ? "#e7b582" : "#a7a1de",
      g,
      0,
      0,
      0,
      shape === "core" ? "#8b4f31" : "#5c4d83",
    );
    m.rotation.z = 0.3;
    mesh(new T.TorusGeometry(2.4, 0.12, 8, 24), "#ad9872", g).rotation.x = 0.8;
  }
  return g;
}

/** 将精细零件烘焙到一个共享顶点色网格。尾部/下颌保留独立铰链，大幅降低移动端 draw call。 */
export function compactModel(root: T.Group, swim = false) {
  root.updateMatrixWorld(true);
  const pieces: T.BufferGeometry[] = [];
  const hinges: T.Object3D[] = [];
  for (const child of [...root.children]) {
    if (
      child.name === "tail" ||
      child.name === "jaw" ||
      child.name === "moon" ||
      child.name === "explorer"
    ) {
      root.remove(child);
      const group = child as T.Group;
      const pos = group.position.clone();
      group.position.set(0, 0, 0);
      compactModel(group, swim);
      group.position.copy(pos);
      hinges.push(group);
      continue;
    }
    child.traverse((o) => {
      if (!(o instanceof T.Mesh)) return;
      const cloned = o.geometry.clone().applyMatrix4(o.matrixWorld);
      const geo = cloned.index ? cloned.toNonIndexed() : cloned;
      for (const key of Object.keys(geo.attributes))
        if (!["position", "normal", "color"].includes(key))
          geo.deleteAttribute(key);
      if (!geo.getAttribute("color")) {
        const m = o.material as T.MeshStandardMaterial,
          c = m.color || new T.Color("white"),
          colors = new Float32Array(geo.getAttribute("position").count * 3);
        for (let i = 0; i < colors.length; i += 3) {
          colors[i] = c.r;
          colors[i + 1] = c.g;
          colors[i + 2] = c.b;
        }
        geo.setAttribute("color", new T.BufferAttribute(colors, 3));
      }
      pieces.push(geo);
    });
    root.remove(child);
  }
  if (pieces.length) {
    const merged = mergeGeometries(pieces);
    if (merged) {
      const material = new T.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.55,
        metalness: 0.12,
        side: T.DoubleSide,
      });
      if (swim)
        material.onBeforeCompile = (shader) => {
          shader.uniforms.uSwimTime = swimTime;
          shader.vertexShader =
            "uniform float uSwimTime;\n" + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\ntransformed.z+=sin(position.x*.45+uSwimTime*7.)*.13*(1.-smoothstep(-2.,8.,position.x));",
          );
        };
      root.add(new T.Mesh(merged, material));
    }
    for (const p of pieces) p.dispose();
  }
  if (hinges.length) root.add(...hinges);
  root.updateMatrixWorld(true);
  return root;
}
