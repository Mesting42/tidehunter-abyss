# 上下斜游姿态专项

2026-10-24，用户选择 A 并确认：调整鲨鱼显示姿态，保留迅速响应、少量惯性与现有实际移动轨迹。

## 当前行为

- 玩家模型的稳定俯仰上限为 60°，持续按上 / 下也不再整条竖成 90°。最近一次左右朝向继续由逻辑 `facing` 保存。
- 前身通过原有四元数平滑建立新姿态，尾鳍用独立指数阻尼跟随俯仰变化；尾鳍附加转角最大 0.28 rad，原有速度驱动摆尾继续保留。
- 可见咬合参考点为模型局部 `length × 0.43`。每帧根据实际四元数反算显示模型的位置，使该点在 x/y 平面与 `combat.mouth()` 重合，包括成长缩放和转向过程。
- 玩家显示层设为 z=26，位于岩石装饰倒角前方，避免贴墙时头部被装饰覆盖；逻辑碰撞仍使用原有地形。装饰倒角的可见边沿不等于矩形碰撞边界。
- 玩家动画不写入 `Player`。敌鱼仍使用完整逻辑角度，预警与出招朝向保持一致。暂停时四元数、位置和尾鳍均保持静止。

## 维护位置

`src/render/swimming.ts` 中 `swimOrientation()` 接受可选俯仰上限，默认仍为 90°；`animateSwimming()` 是共用鱼类动画；`animatePlayerSwimming()` 单独负责玩家的 60° 姿态与显示咬合点定位。`src/render/renderer.ts` 只把玩家交给新入口，其他生物继续使用原入口。

修改姿态上限时，不应直接修改 `player.angle`、移动系统或 `combat.mouth()` 来迎合模型。模型缩放由 Renderer 按成长设置，显示定位必须使用相同成长系数。

## 验证

新增 `tests/swim-pose.test.ts` 四项回归：

1. 上 / 下与左 / 右四种组合稳定保持 60°、正确朝向和非负缩放。
2. 四种鲨鱼、三个成长阶段、连续六种转向的显示咬合点与实际嘴部位置一致。
3. 尾鳍先滞后再收敛，暂停不再变化，动画不修改玩家模拟对象。
4. 敌鱼没有被玩家的俯仰限制影响，向下攻击仍与原预警方向一致。

最终 `npm test` 为 **6 个文件、39 项通过**；TypeScript / Vite 生产构建通过。浏览器控制台 warning / error 检查为空。Three.js 原有 500KB 分块体积提示仍存在。

实际通过 5193 静态版的训练入口操作 WASD、Shift 与 E，覆盖 1440×900 桌面、1024×768 平板和 844×390 手机横屏。检查左右朝向的上下切换、冲刺、岩壁阻挡、正常捕食、回旋技能与暂停。使用训练避免覆盖已有真实航次；训练开关已恢复，退出后保留原 135 潮晶与 8% 安全检查点。

截图：

- [桌面上潜](screenshots/swim-pose-desktop-up.png) / [桌面下潜](screenshots/swim-pose-desktop-down.png)
- [手机上潜](screenshots/swim-pose-mobile-up.png) / [手机下潜](screenshots/swim-pose-mobile-down.png)
- [平板上潜](screenshots/swim-pose-tablet-up.png) / [平板下潜](screenshots/swim-pose-tablet-down.png)
- [手机贴墙冲刺](screenshots/swim-pose-mobile-wall.png)

三端为同一浏览器的视口与页面交互测试，未新增实体设备或 Safari 测试。本轮没有重跑主线首领与全部探索支线，原有规则回归继续通过。
