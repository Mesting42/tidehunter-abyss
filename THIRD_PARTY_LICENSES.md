# 第三方许可与素材来源

鲨鱼、鱼类、机械、装备、地形、UI 图标、海洋特效和合成音效由本项目代码原创生成，没有使用《饥饿鲨》的图像、声音、模型、商标或关卡素材。玩法参考仅用于用户指定的体验方向。

运行时依赖：

| 组件 | 用途 | 许可 | 原始许可文件 |
| --- | --- | --- | --- |
| Three.js | 三维渲染与合并几何工具 | MIT | `public/licenses/three-LICENSE.txt` |
| Ma Shan Zheng / Fontsource | 自托管中文展示字体 | SIL Open Font License 1.1 | `public/licenses/ma-shan-zheng-LICENSE.txt` |
| Vite | 构建及模块预加载辅助代码 | MIT | `public/licenses/vite-LICENSE.txt` |

原始许可随静态构建复制到 `dist/licenses/`，发布时请一并保留。Fontsource 使用本地 npm 包内字体子集，运行时不请求 Google Fonts 或其他远程字体服务。

TypeScript、Vitest、Prettier、Playwright 与类型定义仅用于开发 / 检查，不作为游戏素材。其完整许可证保留在各 npm 包中，锁文件固定本次依赖解析。项目构建产物不包含 node_modules 或开发工具可执行程序。
