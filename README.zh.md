---
description: "dsh Web 客户端的用量统计面板：从全部持久会话日志折叠出的历史 token 与金额统计，以滚动一年的消费热力图呈现，并自述计价方式与数据来源。"
kind: "package-reference"
---

# dsh-local-usage

[English](README.md) | 中文

## Summary

**用量统计**回答这台机器花了多少钱、花在了什么时候。Harness 按会话记录了精确的 provider token 计量，但既不提供跨会话聚合，也完全不涉及货币，因此本包把两者都补上：Host 半边枚举全部逻辑会话，把每个持久日志折叠为「每次计费结算一个样本」，将样本归因到实际计费的 `provider/model` 路由，再按配置的价目表计价；Client 半边贡献一个**全局面板**——侧栏入口，在主列中以全宽页面打开——其核心是当年的日历。

它刻意不做成设置页：一整年的格子需要主列的宽度才不必横向滚动，而且一个 profile 花了多少钱并不是一项偏好设置。

一个面板给出：

- **滚动一年的日历** —— 以当前周结束的 52 周，按窗口内活跃日的分位数梯度着色，每天悬停都有明细卡片。
- **五档区间** —— 当天、近 7 天、本月、本季度、全年，全部以今天为终点。
- **区间总量** —— 金额、总 token、非缓存输入 / 输出 / 缓存读 / 缓存写四个桶、计费调用次数、以及贡献用量的会话数。
- **可配置的价目表** —— 按模型的输入、缓存读、缓存写、输出单价，回退费率，以及北京时间高峰时段与倍率。
- **自述依据** —— 计价公式、实际生效的费率、以及每个数字的来源，写在页面本身，而不是只写在文档里。
- **跟随 harness 的语言，不自带开关** —— 每句文案来自字典，每个数字按当前语言格式化，因此中文面板以 万/亿 计数，英文面板以 M/B 计数。
- **不出网** —— 折叠在 dsh 进程内基于持久会话日志完成，不上传任何数据，也不发起外部请求。

## Table of Contents

- [Use this package](#use-this-package)
- [Troubleshooting](#troubleshooting)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Development](#development)

-----

<a id="use-this-package"></a>
## Use this package

在侧栏选择**用量统计**即可打开面板。它是全局面板，属于 profile 而非某个会话，因此在切换会话时依然可用；在已经提供 Session 查询引擎、会话存储、以及带侧栏与主列的布局外壳的 Web 组合中挂载 `dsh-local-usage` 即可，无需任何配置。

两半之间不需要额外接线：Host 半边自行注册 Fetch 路由，浏览器半边直接调用它，因此本包不会出现在产品的 Remote 装配中。

### 安装

```sh
dsh plugin add git@github.com:webxiaobaiyu-droid/dsh-local-usage.git   # 从 GitHub 安装
dsh plugin add /path/to/dsh-local-usage                               # 从本地目录安装
```

**插件 → 添加插件** 对话框接受同样这两种形式。

本仓库把构建好的 `lib/` 与 `cordis.patch.yml` 一并入库，且不声明任何构建脚本，因此安装时不会在你的机器上执行代码，也不需要 git 依赖通常会要求的构建授权：加载的就是已入库的产物本身。`dsh plugin add` 会把 `dsh-local-usage` 追加到该 profile 的 bundle 列表，`dsh --profile <名称> --dump-config` 可以看到它贡献的那一行 `local-usage`。一行同时挂载两半：它加载 Host 半边，而由于 manifest 声明了 `dsh.client.platform: web`，同一行也是浏览器加载面板的依据。

一个 profile 的 bundle 列表是在进程启动时组装的：通过**插件 → 添加插件**安装会作用于正在运行的进程；而在命令行安装时，若已有 dsh 进程在该 profile 上服务，需要重启该进程，入口才会出现。

### 阅读页面

范围选择器决定观察的镜头：**当天**、**近 7 天**、**本月**、**本季度**或**全年**。每个范围都以今天结束，因此「本月」指的是本月至今，而不是一个已结束的自然月。

其下以一个大号主数字给出所选范围内的总花费，下面一排格子承载总 token、输入、输出、缓存三个桶、计费调用次数，以及贡献了用量的会话数。

日历是稳定的画框：以周日为首列，左侧星期栏每个格子只有一个字形——中文是 `日 一 二 三 四 五 六`，英文是 `S M T W T F S`，取自字典而不是写死的字符集；它横跨截至本周的滚动 52 周，并且不随范围变化。格子是固定大小的方块，边长由面板实测决定：当一年的列数能以最小边长放下时，格子会长大铺满宽度；再窄就保持最小边长并丢弃最旧的若干周——因此无论面板多窄（包括展开侧边栏时）都不会横向滚动，也不会被裁掉。格子不带描边，唯一的标记就是颜色深浅；悬停任意一天会弹出卡片，给出当天的花费、总 token、输入、输出、缓存命中的 token 数与调用次数，且卡片里的数字是**精确值**——完整位数，按当前语言分组——因为「只给约数」恰恰是明细卡片回答不了的那件事。

色阶按窗口内活跃日的分位数分级——中位数、75 分位、90 分位——因此它会随这个 profile 的真实消费分布自适应，而不是假定某种分布。

色阶的「无用量」档是一块看得见的中性灰格子，而不是页面底色本身——于是一个没有消费的月份读起来是「空的一个月」，而不是「什么都没有」。它是把正文墨色以低比例混进页面底色得到的，这样两个主题下都成立：没有任何一个 surface token 在两种主题下都与页面底不同，而唯一在浅色下与底不同的那个（`bg-layer-2`）解析出来正是页面底色。第一档活跃颜色靠**色相**与它区分——那一档是蓝的——在色差如此之小的一步上，色相在一瞥之间就能读出，而明度不行。

### 语言

面板跟随 harness 自身的语言设置，没有自己的开关。文案与数字分开处理，因为这是两个不同的问题：

- **文案**是字典。所有用户可见字符串都在 `src/client/locales.ts` 里、以 `usage` 命名空间下的两个语言各存一份——面板自己不渲染任何字面量。英文字典上的 `satisfies Record<UsageInsightsLocaleKey, string>` 使得「某种语言有、另一种没有」直接成为编译错误；而 `tests/locales.client.spec.ts` 补上类型系统看不见的那一半：要求两种语言为同一个键声明相同的 `{name}` 占位符。原因是 locale 运行时会把匹配不到的占位符原样留在文本里，键名不一致会让读者看到字面量 `{date}`，而任何地方都不会报错。语言包新增一门语言只需注册第三份字典，不需要改组件。
- **数字**不是文案，由 `src/client/format.ts` 按当前语言格式化：货币符号位置、分组方式、小数点、紧凑数量级、以及日期的书写顺序，都属于读者的语言，而不属于包住它们的那句话。紧凑 token 数量级是最清楚的例子——英文按 K/M/B 计数，中文按 万/亿 计数，所以中文面板上显示 `214.87M` 就不是风格问题，而是没翻译。改完之后英文输出不变，因为 `Intl` 的 compact 记法解析出来正是原先写死的那套 K/M/B。

由于 Host 返回的报告是语言中立的——它携带计数、费率和日期键，从不携带渲染好的字符串——切换语言只需重渲染一次，不需要重读任何数据。配置有问题时数字会降级而不是让面板挂掉：无法识别的 ISO 货币码渲染为 `CODE 0.00`，而 `Intl` 没有数据的合法语言标签会退回默认语言的数字。

### 配置

| 字段 | 默认值 | 含义 |
|---|---|---|
| `currency` | `CNY` | 所有金额的表达币种；插件不做汇率换算。 |
| `models` | DeepSeek V4.1 Flash 与 V4 Pro 两张价目 | 按路由模型匹配的价目表，先匹配者生效。 |
| `fallback` | Flash 价目 | 没有任何价目命中的路由所用的费率。 |
| `peakWindows` | `09:00-12:00`、`14:00-18:00` | 北京时间的高峰时段；留空即关闭高峰计价。 |
| `peakWeekdaysOnly` | `true` | 周末是否始终按空闲时段计价。 |
| `peakMultiplier` | `2` | 高峰时段对每条费率施加的倍数。 |

每张价目给出 `input`、`cacheRead`、`cacheWrite`、`output`（币种单位／百万 token），以及认领路由的 `match` 子串。内置默认值是 DeepSeek 官方公布的 `deepseek-flash` 与 `deepseek-v4-pro` 空闲时段人民币价格；经聚合商或转售商提供的路由必须由使用者自行定价，页面会点名所有回退到默认费率的路由，而不是给出一个它无法支撑的数字。

### 金额能信到什么程度

花费是本插件自己算出来的，不是从 provider 账单读回来的：各桶 `token × 配置费率`，并按每次调用自身的时刻判定高峰/空闲。面板在**计价方式**里明确写出公式、当前生效费率和高峰时段——因为一个估算值与账单的差异来源，恰恰是读者容易默认已经包含的那些东西：预购额度、套餐包、阶梯折扣、赠送余额、聚合商加价与转售差价都不在其中。请以 provider 账单为准。

### 数据从哪来

面板在**用量依据**里自述来源：Harness 没有用量数据库，因此统计折叠自会话的持久事件日志本身——本机全部会话、跨所有工作目录，经会话查询服务读取并做重放校验。该区块还给出落盘形态（`<DSH_HOME>/sessions/<工作目录>/<会话>/session.v3.jsonl.zstd`）、不计入的部分（fork 的继承前缀、尚未结算的在途调用、读不出的日志）、以及不上传也不发起外部请求这一事实，最后给出产生当前数字的那一次读取的计数。

### 数字的含义

每个**计费结算**产生一个样本，语义与 Harness 自身的 `tokenUsage` 投影一致：同一 `(turn, step)` 槽位的结算会替换先前的样本，`llm/retry-started` 关闭该槽位使重试的尝试单独计费，完全相同的重复结算不改变任何数字，而未提交可见消息的结算仍通过其内嵌 stream 携带的 usage 计入。因此提取器能精确复现持久投影的总量，这也正是本包针对真实日志所做的验证。`uncachedInputTokens` 不含缓存流量；`cacheReadTokens` 与 `cacheWriteTokens` 在 provider 未上报时计为零。花费为各桶 `token × 费率`，并按每个样本自身的时刻计价，因此一天之内跨越高峰边界时，两侧样本各自正确，而不会被平均。

-----

<a id="troubleshooting"></a>
## Troubleshooting

**面板能打开，但显示无法读取用量数据。** 说明浏览器半边已挂载、Host 半边没有，于是它要调用的路由并不存在。启动输出会直接点名原因：

```
dsh: warning: 1 entry did not activate
local-usage (dsh-local-usage): Error: cannot get property "connection" without inject
```

这条信息意味着 entry 到达 Loader 时丢掉了 `inject` 列表，并在第一次读取服务时失败；造成它的唯一一种模块形状见 [Dev Note](#development)，`tests/module-shape.host.spec.ts` 守着这条规则。要确认安装本身正常，可以问组合后的配置：`dsh --profile <名称> --dump-config` 会在 `- id: local-usage` 上方打印 `# == dsh-local-usage`。

**插件列表里没有它，或安装被拒绝并提示 `declares no dsh.bundle`。** 只有当 manifest 声明了 `dsh.bundle.patch`、并随包提供它指向的 patch 文件时，一个包才能作为插件层安装；这两者本仓库都已入库，因此被拒绝说明装的是本包的旧副本 —— 请重新从本仓库安装。

**安装失败并报 `ERR_PNPM_PUBLIC_HOIST_PATTERN_DIFF`。** 这是 profile 自身的状态，与本包无关：它的 `node_modules` 是由另一个 pnpm 版本或另一套 linker 设置创建的，与当前正在安装的那套不一致。在该 profile 目录里运行 `pnpm install`，然后重新添加插件即可。

**总量看起来低于 provider 的账单。** 有三类内容按设计排除，并且会在面板的来源区块里计数，而不是被悄悄丢掉：fork 继承的前缀（已在父会话计费）、仍在流式输出、用量尚未最终确定的结算，以及任何无法读取的日志。没有命中价目表的路由按回退费率计价，并在提示行中点名。

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

### Host 折叠

`UsageInsightsController` 通过 `ctx.sessionQuery.listSessions()` 枚举会话，该调用不读取任何事件日志；随后在固定的读并发下通过 `ctx.sessionQuery.readSession()` 把每个日志读一次。读取是昂贵的一半、折叠不是，因此缓存保存的是每个会话抽取出的样本而非成品报告，每次调用都以当前配置重新计价；于是配置变更无需重读任何日志即可生效。会话一旦记录新事件，其缓存条目立即失效，请求也可以强制全量重读。

fork 会话的日志以父会话的继承前缀开头，而那些 Turn 已在父会话计费，因此只折叠 `inheritedEventCount` 及其之后的事件。会话标题仍从完整日志折叠（含继承前缀），因为标题是关于对话本身的事实，而非关于计费。

### 页面

浏览器半边贡献一个全局面板：一个 `sidebar.panellist` 条目与一个 `main` 键控槽占用者共享同一个 id，于是侧栏拥有按钮、框架拥有主列。由于全局面板是被保留而非重新挂载的，面板会读取 `usePanelInfo`，并且只在自己被选中时才读取日志。它只通过 Host 半边注册的那一个 Fetch 路由触达 Host，因此这半边不含任何折叠或定价逻辑，本包也不需要出现在产品的 Remote 装配中。本产品没有图表库、引入图表库也超出边界，因此日历是用 CSS grid 单元格在语义主题 token 上以 `color-mix` 着色实现的。

语言经由插件自己的 injected face 抵达面板，而不是再开一份订阅：渲染器会按 locale 版本号重新推导每个条目的字典函数，所以切换语言本身已经会让面板重渲染，注入的 `locale()` 在渲染期读取服务，读到的必然就是旁边那句文案所用的同一个 id。格式化器按 `(locale, currency, digits)` 缓存，构造失败的会以「不存在」缓存下来——这正是让配错的货币码不会每次渲染都抛异常的原因。

-----

<a id="further-exploration"></a>
## Further Exploration

以下子系统是本包读取、镜像或据以安装的 DeepSeek Harness 包。由于本包独立发布、已不在那棵源码树内，链接一律指向 Harness 仓库。

- [Session query](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/session-query/session-query/README.zh.md) —— Host 半边用于枚举与读取的冷读引擎。
- [Token meter](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/llm/token-meter/README.zh.md) —— 本包提取器所镜像的持久 `tokenUsage` 投影，及其结算与重试语义。
- [Session projection cache](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/session/session-projection-cache/README.zh.md) —— 持久化的按会话投影存储，读取日志之外的零 I/O 方案。
- [打包与安装插件](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.zh.md) —— 本包据以安装的 bundle 与 profile 模型。

<a id="model-experience"></a>
## Model Experience

无。本包读取持久会话日志并渲染浏览器页面，不添加任何模型可见内容，也不发起模型调用。

#### KV Cache effect

无；本包既不组装也不发送 provider 请求。

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

这些限制界定了页面能报告什么；它们是本包当前的约束。

- **价格是配置，不是账单** —— Harness 只记录 token、从不记录货币，因此每个金额都是 `token × 配置费率`；没有命中价目的路由按回退费率计价，并在页面的提示行中点名，而不是被悄悄估算。
- **未建模中国法定节假日** —— 高峰时段遵循官方公布的北京时间周一至周五时段，因此窗口内的节假日工作日会按高峰计价。
- **只随包发布两种语言** —— 中文与英文。语言包注册的第三种语言会按键逐条回退到英文，因此在该语言包同时注册 `usage` 字典之前，它渲染出来是英文句子。文案是双语的，数字则不是——一门背后没有 `Intl` 数据的语言会静默地渲染成默认语言的数字。
- **语言是 harness 的，不是面板的** —— 面板没有自己的语言选择。想在英文 harness 上看到中文数字的读者必须改 harness 的语言，而那会改变所有界面，不只是这一个。
- **仍在流式输出的结算不贡献数字** —— 其用量尚未最终确定，后续结算仍可能替换它，因此运行中会话的最新一轮交换只有结算后才出现。
- **按设计排除 fork 继承前缀** —— fork 会话只报告它自身造成的花费，因此按会话的统计不能相加来还原父对话的总花费。
- **日历只展示一个滚动窗口** —— 面板在挂载时固定画框，因此需要任意日期区间的部署目前还没有切换控件。
- **报告仍携带页面不再渲染的按模型与按会话行** —— 加权路由与会话排行作为第一步已从页面移除，但这些行保留在 wire 契约中，直到有界面需要它们。

<a id="dev-note"></a>
<a id="development"></a>
## Development

### 前置条件

Node 22 与 pnpm，外加一份 **DeepSeek Harness 源码检出**。本包编译与测试所依赖的 `@deepseek-ai/*` 都是 Harness 的 workspace 包：npm 上的 rc 版本会解析 `@deepseek-ai/dsh-type-meta`，而它并未发布到 registry，因此只有源码检出才能拿到这些包。

```sh
pnpm install
pnpm run link:host -- --src /path/to/deepseek-harness
# 或者：DSH_SRC=/path/to/deepseek-harness pnpm run link:host
```

`link:host` 会把本仓库的 `node_modules/@deepseek-ai/*` 指向该检出（并打印链接来源的 Harness 版本），包清单在 `scripts/link-host-packages.mjs`；新增宿主 import 时在其中补一条即可。这些链接只是开发期状态：不会被提交，而 `lib/` 在运行期从宿主进程解析同样的包。

### 常用命令

| 命令 | 作用 |
|---|---|
| `pnpm test` | 运行两半的 vitest 套件 |
| `pnpm run typecheck` | 以两个程序分别类型检查两半 |
| `pnpm run build` | 打包 `lib/*.js`，并产出 `lib/types` |
| `pnpm run watch` | 只重建打包产物，用于热重载循环 |

这里刻意**不提供 `prepare` 脚本**。`lib/` 已入库，而 git 依赖上的构建脚本恰恰会迫使每个安装者授予该包「在安装期执行代码」的权限；去掉它，安装才能直接使用入库产物、不索取任何权限。改动 `src/` 后请自行运行 `pnpm run build` 并提交产物。

### Dev Note

<details>
<summary>面向维护者的工作上下文 —— 点击展开</summary>

Host 半边与浏览器半边都会在相同的 key 上合并 Cordis `Context`，但服务不同，因此**同一个 TypeScript 程序无法同时看到两者**；Harness 自身也是出于同样的原因拆分类型检查。`tsconfig.host.json` 与 `tsconfig.client.json` 是 `typecheck` 与编辑器所用的两个程序，而 `tsconfig.host.build.json` / `tsconfig.client.build.json` 是它们收窄后的子集，用于把声明产出到 `lib/types` —— 这正是 `package.json` 的 `exports` 所指向的布局，也是 Harness 自身客户端包的布局（`rootDir: src`，`outDir: lib/types`）。

由此有两点需要注意：

- `tsdown` 只打包 JavaScript，使用共享的 `tsconfig.json`。两半的 `dts` 都关闭：在那里产出的声明会把浏览器产物的 module-loader banner/footer 包进声明文件而破坏解析，Harness 自己的客户端预设也因此关闭它。
- 声明只有在 `pnpm run build`（或 `pnpm run build:types`）之后才存在；由于本包通过 git 分发，声明与打包产物一同入库 —— 只跑 `tsdown` 会让 `exports` 里的 `types` 条件指向不存在的文件。

这里用仓库自己的脚本调用 `tsc`，而不是 `tsc -b`：本包不在 Harness 的 project reference 图内，因此它针对检出的已构建声明文件编译，而非针对该工程图。

两半都**只导出具名成员**，绝不写 `export default apply`。带 default 导出的模块会以该 default 被挂载，于是插件拿不到模块的 `name` 与 `inject`：fiber 以空 inject 列表激活，entry 在第一次读取服务时即以 `cannot get property "…" without inject` 失败，面板随之没有可读取的路由。`tests/module-shape.host.spec.ts` 为两半守着这条规则。

</details>

**Runtime invariant:** Host 半边拥有一个提供折叠报告的 HTTP 路由，以及一个以会话 id 为键的内存样本缓存；浏览器半边注册一个本地化的侧栏条目及其对应的 `main` 面板，并且只通过该路由访问 Host。不发布 companion，两半都不自行发出 Cordis 事件。
