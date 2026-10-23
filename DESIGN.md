---
name: 猎潮狂鲨 · 裂渊航次
description: 以海墨、骨白、冷玉与旧金构成的暗黑奇幻海洋动作游戏视觉系统。
colors:
  sea-ink: "#071e29"
  ocean-ground: "#092530"
  bone-white: "#e2ebe3"
  muted-tide: "#abc2bf"
  cold-jade: "#9cdec5"
  old-gold: "#e7c688"
  title-bone: "#e8e3c9"
  voyage-sage: "#c4d6ac"
  voyage-sage-hover: "#dae7bf"
  action-ink: "#122d34"
  secondary-sea: "#153e48"
  secondary-bone: "#d2e3d8"
  secondary-border: "#385b5e"
  field-sea: "#183742"
  field-border: "#46626a"
  life-jade: "#92d4b2"
  energy-blue: "#80b9ca"
  rage-gold: "#d4b673"
  injury-coral: "#d58976"
  threat-red: "#ff8177"
  recovery-mint: "#a5e1c8"
typography:
  display:
    fontFamily: '"Ma Shan Zheng", cursive'
    fontSize: "clamp(70px, 7.8vw, 118px)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif'
    fontSize: "27px"
    fontWeight: 500
    letterSpacing: "2px"
  title:
    fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif'
    fontSize: "25px"
    fontWeight: 500
  body:
    fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif'
    fontSize: "14px"
    lineHeight: 1.8
  label:
    fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif'
    fontSize: "12px"
  action:
    fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif'
    fontSize: "16px"
  threat-label:
    fontFamily: '"Microsoft YaHei", sans-serif'
    fontSize: "13px"
    fontWeight: 600
rounded:
  meter: "2px"
  control: "3px"
  icon: "4px"
  circle: "50%"
spacing:
  compact: "8px"
  base: "12px"
  row: "14px"
  control-inline: "20px"
  section: "22px"
  panel: "24px"
components:
  button-primary:
    backgroundColor: "{colors.voyage-sage}"
    textColor: "{colors.action-ink}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "14px 20px"
    width: "100%"
  button-primary-hover:
    backgroundColor: "{colors.voyage-sage-hover}"
    textColor: "#0a252b"
  button-secondary:
    backgroundColor: "{colors.secondary-sea}"
    textColor: "{colors.secondary-bone}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "14px 20px"
    width: "100%"
  button-icon:
    backgroundColor: "#0a2a36b0"
    textColor: "#cce0d5"
    rounded: "{rounded.icon}"
    width: "44px"
    height: "44px"
  select-field:
    backgroundColor: "{colors.field-sea}"
    textColor: "{colors.bone-white}"
    rounded: "{rounded.control}"
    padding: "8px"
  harbor-navigation:
    textColor: "#c0d1c7"
    padding: "8px 14px 8px 0"
  target-label:
    backgroundColor: "#0c2536a0"
    textColor: "#e5d6a7"
    padding: "3px 6px"
  life-meter:
    backgroundColor: "{colors.life-jade}"
    rounded: "{rounded.meter}"
    height: "12px"
  threat-warning:
    textColor: "{colors.threat-red}"
    typography: "{typography.threat-label}"
  threat-recovery:
    textColor: "{colors.recovery-mint}"
---

# Design System: 猎潮狂鲨 · 裂渊航次

## Overview

**Creative North Star: "沉船上的航行记录"**

真实海域占据整个视野，界面像刻在沉船上的航行记录。用户固定的暗黑奇幻方向是视觉权威：沉没遗迹、发光生态与深海巨兽由实际 Three.js 场景呈现；海墨承托骨白文字，冷玉标识生命与生机，旧金指向狂暴、潮晶和关键状态。书法只用于有仪式感的名称，操作信息保持清楚、克制。

体验以探索和行动为中心。港湾首页在左侧组织纵向操作，让右侧实时鲨鱼成为主体；这是一种首页表达，不是所有页面的固定模板。游玩中的 HUD 采用边缘分区、局部实底和文字阴影，中央空间留给侧视 2.5D 海域、猎手轮廓与危险预警。用户固定方向优先于探索用 seed `2fa555bd`。

**Key Characteristics:**
- 暗黑奇幻海洋，冷色水体与有节制的生物微光。
- 实时三维生物、分面遗迹和侧视 2.5D 场景共同构成深度。
- 骨白书法名称与中文无衬线操作信息形成明确分工。
- 细边框、低圆角、局部半透明海墨底，减少遮挡。
- 港湾保留氛围；HUD 优先快速识别生命、目标与可执行动作。
- 鱼类自然转身并随速度摆尾；攻击以蓄力、锁定、出招、回气构成可读节奏。

## Colors

配色以深海冷色为底，浅色文字与微光提供能见度；所有规范色值以 frontmatter 为准。

### Primary
- **航次鼠尾草**（`voyage-sage`）：主要出航、继续与确认动作的实底；悬停使用对应的浅色变体，文字使用动作海墨。
- **冷玉**（`cold-jade`）：表单强调和生命语言的基础色；生命槽使用专用生命玉色，避免把所有互动都做成金色。

### Secondary
- **旧金**（`old-gold`）：潮晶、选中猎手、狂暴关联信息、关键目标与焦点环。狂暴槽采用专用较沉的金色。
- **能量冰蓝**（`energy-blue`）：冲刺能量，与生命玉、狂暴金同时显示时保持辨识。
- **受伤珊瑚**（`injury-coral`）：低生命状态的辅助色；必须与文字、数值和生命槽变化共同出现。
- **警戒红**（`threat-red`）：敌方蓄力倒计时、攻击范围、攻击中状态和离屏来袭箭头；用形状、线型和文字同时说明威胁。
- **回气薄荷**（`recovery-mint`）：非首领敌人收招时的虚线轮廓与“回气 · 可反击”文字，明确反击窗口。

### Neutral
- **海墨与海域底**（`sea-ink`、`ocean-ground`）：世界与界面的暗部基调。
- **骨白与标题骨白**（`bone-white`、`title-bone`）：常规可读文字与书法标题；标题略暖，避免纯白发光字抢过主体。
- **退潮灰绿**（`muted-tide`）：次级说明和标签。
- **次级海面**（`secondary-sea`）及其骨白、边线：次级行动以深色实底和细边框保持可识别性。
- **表单海面**（`field-sea`）及其边线：设置中的原生选择框，与正文区形成局部对比。

**The Signal Rule.** 旧金和冷玉必须有状态含义；危险同时使用图形、文字或动作预警，不能只靠颜色。

## Typography

**Display Font:** 自托管 Ma Shan Zheng（`@fontsource/ma-shan-zheng`，400），回退到 cursive。
**Body Font:** Microsoft YaHei、PingFang SC、sans-serif。

**Character:** 书法传递猎手与航次的仪式感；无衬线负责菜单、数值、任务与说明。中文名称优先使用完整自然语言，不用装饰性的英文大写标签替代操作语义。

### Hierarchy
- **Display:** 首页标题使用 frontmatter 的响应式字号与紧凑行高。低矮横屏实际收敛到（56px）；名称、暂停和结算标题依据场景使用书法，不能把首页超大字号复制到 HUD。
- **Headline:** 面板页标题使用（27px），低矮横屏为（21px）；无衬线、适度字距。
- **Title:** 普通分区标题使用（25px）基准；猎手详情名称使用书法（64px），低矮横屏为（42px）。角色称号放在名称下方。
- **Body:** 说明正文使用（14px）与（1.8）行高；猎手介绍限制为（36em）以内，段落不跨过模型主体。
- **Label:** 常规标签为（12px）；HUD、地图与紧凑说明按现有层级缩小，操作名仍应明确。
- **Numeric:** 得分、时间、属性和资源使用等宽数字（`tabular-nums`）；得分独立放大，不用书法呈现动态数据。
- **Threat Label:** 攻击状态与倒计时采用无衬线（600），并使用深海描边保护可读性；常规字号见 frontmatter，低高度屏幕为（11px），回气提示为（11px）。

**The Two Voices Rule.** 名称可以书写，操作必须可读；不要把 Ma Shan Zheng 用于连续正文、计时器或生命数值。

## Layout

渲染画布固定铺满视口，界面叠层覆盖其上；非交互叠层不拦截游戏输入。页面不使用文档纵向滚动来容纳海域，长内容在面板或详情区内部滚动。安全区通过 `env(safe-area-inset-*)` 参与边缘定位。

桌面首页以左侧约（375px）操作列与右侧实时鲨鱼形成非对称构图。顶部是世界标识和潮晶，底部是辅助航线信息。工坊和装备页采用模型舞台与详情双区，模型舞台约占（49%）；详情区自行滚动。图鉴采用物种列表与详情区，指南、设置与纪录使用双列分区；细分信息常以行和底部分隔线组织，而不是全部包进卡片。

基础节奏使用 frontmatter 的紧凑、基础、行与面板间距；主要按钮常规最小高度为（52px）。低矮横屏条件是高度不超过（570px）；此时收紧标题、页头和间距，主页“继续 / 新航次”并排，模式选择占下一整行，港湾功能变为三列网格，辅助页脚隐藏。主要按钮、图标按钮、地图返回、物种行和开关行保留至少（44px）的操作高度。此规则记录明确实现的控件族，不替代完整触屏审计。

粗指针或宽度不超过（1024px）时显示触屏控件并隐藏键盘提示；宽度不超过（740px）的横屏进一步收紧信息密度。宽度不超过（1024px）的竖屏展示旋转提示，游戏暂停，恢复横屏后由玩家继续。

离屏威胁沿屏幕中心至敌人的射线投影到内部安全矩形，箭头保持真实方向并避开上方 HUD 与下方摇杆。高度低于（500px）时，预警安全边界使用左右（31px）、上方（92px）、下方（107px）；常规屏幕对应为（46px）、（148px）、（85px）。这些是预警投影边距，与设备安全区及触摸目标分别处理。

**The Clear Water Rule.** HUD 的生命与任务在左、得分居中、暂停和地图在右；新增信息不得遮住玩家和当前威胁的主要行动区域。

## Elevation & Depth

系统以实际三维场景、海水明暗、光束、分面地形与前后层次承担主要深度。界面自身使用渐变遮罩、半透明海墨底、细边线和少量柔和阴影；不把每条信息都抬成悬浮卡片。首页遮罩从左侧加深，工坊遮罩向右侧详情加深，兼顾模型和文字。侧视玩法的清晰轮廓比持续高亮和闪光更重要。

### Shadow Vocabulary
- **主要行动柔影**（`0 7px 25px #00151f40`）：浅色主按钮与暗水体之间的轻微分离。
- **书法环境影**（`0 5px 22px #00141b70`）：首页标题在动态背景上的可读性。
- **即时反馈影**（`0 6px 24px #02162055`）：底部 toast 的短暂前景层次。
- **HUD 文字影**（`0 1px 4px #00141b`）：生命和键盘提示等紧凑信息的局部支撑。

**The World Carries Depth Rule.** 让海域承担空间深度，界面阴影只服务可读性与状态反馈。

鱼类运动使用实际三维姿态：左右转身通过绕 Y 轴朝向与俯仰组合的四元数平滑过渡，背鳍保持朝上；尾部摆动的频率与幅度随游速增加。暂停令动画时间步为零。运动姿态只改变视觉模型，不反向改变碰撞、捕食和攻击判定。

**The Dorsal Up Rule.** 左右转向必须在三维空间转身；禁止通过负的 `scale.y` 镜像翻面来改变朝向。

## Shapes

界面以平直矩形和轻微圆角构成：槽条、普通控件、图标按钮分别使用 frontmatter 的 meter、control、icon 圆角。分隔线常用低对比灰绿半透明细线，突出行的关系而非封闭盒子。生物与遗迹在真实场景中形成分面轮廓。

圆形只承担明确的空间或输入语义：摇杆、触屏动作、目标环。图标采用内联 SVG，线宽（1.5）、圆线帽与圆连接；常规图标为（22px），紧凑方向标识按所在控件缩小。行动箭头使用同一线性 SVG 语言，不使用字符箭头替代。

## Components

### Buttons

行动像简洁的航次指令，主次层级靠明暗、面积与边线建立。

- **Primary:** 航次鼠尾草实底、动作海墨文字、轻微圆角；常规内边距见 frontmatter，内容左右对齐，右侧线性斜向箭头。检查点可用小字补充进度。
- **Secondary:** 深海面实底、骨白文字、灰绿细边线；与主按钮并列时保持同等操作高度。
- **Icon:** 方形（44px）控件、细边线、半透明暗底；必须有可访问名称。
- **States:** 颜色、背景和透明度以（0.2s）过渡；按下下移（1px）。键盘焦点为旧金（2px）外轮廓，偏移（5px）。禁用透明度（0.4），同时使用原生禁用语义。

### Navigation

港湾功能使用小型文字动作，桌面紧凑流式排列、低矮横屏三列排列。猎手标签、皮肤选择与物种列表通过旧金文字和底线或局部暗底表达选中；不要改成厚重胶囊导航。猎手标签可包含解锁状态和价格。

### Cards / Containers

常用容器是面板、详情列和清晰的列表行。面板采用深海遮罩；装备、任务、属性和图鉴条目采用细底线与留白。当前任务使用局部较亮海色，已完成状态以文字与生命玉提示。保留实际三维预览，不能用静态占位图代表可选择猎手。

### Inputs / Fields

设置使用原生滑块、复选框和选择框。滑块及勾选强调为冷玉，选择框为表单海面、细边线与轻微圆角；键盘焦点继承全局旧金轮廓。数值输出紧邻设置项，触屏大小与透明度具有可见百分比反馈。

### HUD Meters and Target Labels

生命、冲刺、狂暴采用长条与数字 / 文本并行。生命条最厚，能量与狂暴更细；变化使用（0.12s linear）缩放，不能靠重排宽度造成跳动。目标提示使用局部半透明底、小型 SVG 与简短文字，危险图形与预警动作共同承担识别。顶部集中播报使用书法，但不替代持续任务进度。

### Threat Telegraphs and Recovery

攻击预警是实际攻击状态的投影，AI 与 HUD 共用 `src/systems/threats.ts` 的时序和形状定义。普通突进类蓄力为（0.70s / 0.76s），精英冲撞为（1.00s），精英伏击为（1.05s）；最后（0.22s）锁定朝向，精英伏击的锁定窗口为（0.25s）。首领、鱼叉和水雷遵循各自同源配置，不能把普通敌人的时序套给所有威胁。

蓄力时以警戒红虚线区域、源头轮廓、填充进度环与小数秒倒计时标明方向和范围。方向锁定后区域变为实线，文字切换为“锁定 · 闪避”；出招时显示“攻击中”，范围描边从（1.8px）加粗到（2.5px），透明填充从（`#f45f5918`）变为（`#f45f5930`）。突进显示通道和方向折线，伏击显示扇区，范围攻击显示圆或放射线，鱼叉显示射线。范围与形状必须来自同一攻击配置，屏幕投影的纵向与模拟坐标一致。

离屏来袭采用圆底箭头和倒计时 / “来袭”文字，警告指向敌人真实位置。非首领收招时撤下红色攻击范围，显示薄荷色虚线椭圆与“回气 · 可反击”；离屏收招不显示额外提示。预警层不接收指针事件，也不修改敌人或碰撞状态。

**The Honest Telegraph Rule.** 倒计时、锁定方向与范围必须对应真实攻击；锁定后不能在出招瞬间重新瞄准玩家。

### Touch Controls and Feedback

左侧圆形摇杆与右侧冲刺、技能、交互按钮组成动作区，视觉外圈与触摸区域对应；设置可调整大小和透明度。可交互状态以旧金和更高不透明度强调。Toast 从底部短距离上移并淡入（0.25s），用于确认短暂操作结果；持久目标留在任务区。系统减少动态效果时取消界面过渡，闪光强度另受玩家设置控制。

## Do's and Don'ts

### Do:
- **Do** 以用户确认的暗黑奇幻海洋为视觉权威，保留真实 Three.js 生物、遗迹与侧视 2.5D 空间。
- **Do** 用骨白保证信息可读，用冷玉、旧金和图形共同表达状态。
- **Do** 将名称放在角色称号之前，让主要行动、当前任务和生命值一眼可见。
- **Do** 为操作保留清楚的焦点、禁用状态、SVG 图标和可访问名称。
- **Do** 在低矮横屏保持已建立的至少 44px 控件高度，并验证安全区和滚动详情不会盖住主要行动。
- **Do** 让鱼类平滑转身、背鳍朝上，摆尾强度随游速变化。
- **Do** 用同源时序和形状呈现蓄力、锁定、攻击与回气，并用离屏箭头保留威胁方向。

### Don't:
- **Don't** 以 seed 随机方向覆盖已经确认的暗黑奇幻世界。
- **Don't** 用静态海报替代实际游动的猎手，或用装饰面板挤占行动海域。
- **Don't** 只靠颜色传达危险、可交互状态或完成状态。
- **Don't** 把书法用于连续操作说明和动态数字，或让高频特效掩盖轮廓和预警。
- **Don't** 将单次截图中的裁切或暂态当作系统规范。
- **Don't** 使用负的 `scale.y` 令鱼类上下翻面，或让视觉动画改变实际碰撞和捕食状态。
- **Don't** 在锁定后重新瞄准，或显示与真实伤害方向、范围、时序不一致的攻击预警。
