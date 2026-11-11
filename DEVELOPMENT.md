# 开发说明（DEVELOPMENT）

> 面向「在这个仓库上做扩展」的人。仓库是 DeepSeek Harness 插件
> `@dsh-xhl/workspace-groups`：侧栏三级工作区分组浏览器 + 顶部会话标签条
> + Ctrl+R 快切面板。宿主半边（node）负责 sidecar 配置读写，浏览器半边负责 UI。

## 1. 这份工作树的来源

当前分支 `feat/base-0.4.2` 的工作树，是从**用户机器上实际安装运行的那份 0.4.2 构建**
反推重建的，而不是仓库 HEAD 的原样代码：

- 来源：`~/.dsh/profiles/desktop/node_modules/@dsh-xhl/workspace-groups/lib/client.js.map`
  （内联 `sourcesContent`，含全部 `src/client/*` 的 TypeScript 源码）
- 仓库 HEAD（`942babe`，package 版本仍写着 `0.1.0`）里只有侧栏分组浏览器，
  没有会话标签条 / 快切面板 / 分支视图这些模块，即上游 GitHub 的公开代码落后于
  已发布构建。
- 因此重建树 = 安装版 0.4.2 的完整源码，并补齐宿主侧 `src/host-tabs.ts` 与
  `/workspace-groups/tabs` 路由。

重建后的对齐校验（可用下面第 3 节的命令复现）：

| 产物 | 与安装版对比 |
| --- | --- |
| `lib/index.js`（宿主） | diff 行数 **0**（逐字节） |
| `lib/client.js`（浏览器） | 仅 **1** 行差异：CSS 虚拟模块注释里的构建绝对路径 |
| `lib/types/**/*.d.ts` | **27/27 完全一致** |

git 历史里 `942babe` 及更早的提交原样保留；重建工作作为 `b30f771` 一次提交落在
`feat/base-0.4.2` 分支上。合回 `master` / 推上游前请自行决定如何叙事。

## 2. 目录结构

宿主半边（node，平台 `node`，输出 ESM）：

| 文件 | 职责 |
| --- | --- |
| `src/index.ts` | 插件入口。`inject = ['webServer']`，注册 4 组路由：`GET /workspace-groups/config`、`GET|PUT /workspace-groups/tabs`、`PUT /workspace-groups/manual`、`GET|PUT|POST /workspace-groups/folders` |
| `src/host-config.ts` | 读用户 YAML 分类规则（默认 `~/.dsh/workspace-groups.yaml`），校验后以 JSON 下发 |
| `src/host-manual.ts` | 运行期分组覆盖（手动分组 + 单工作区归类覆盖），落 `$DSH_HOME/workspace-groups.manual.json` |
| `src/host-folders.ts` | 每个工作区的额外文件夹 + 根目录，落 `$DSH_HOME/workspace-groups.folders.json`（写时严格、读时宽容）。另提供 `defaultRemoteMirrorBase()`：`~/.dsh/remote-workspaces`，即 `@zhangfengshun/dsh-remote-ssh` 的本地镜像根，GET 时随文档下发 |
| `src/host-tabs.ts` | 会话标签条的宿主侧持久化。放在宿主是因为**浏览器存储按 origin 隔离，而 origin 含端口**，`dsh web`/测试/桌面壳端口各不相同 |
| `src/context-types.ts` | 本插件消费的 cordis 服务结构类型（第三方插件拿不到 monorepo 内的 `declare module` 合并） |

共享纯逻辑（浏览器 / node 两半都编译）：

| 文件 | 职责 |
| --- | --- |
| `src/core/types.ts` | 规则配置类型，零运行时依赖 |
| `src/core/matcher.ts` | 归类与排序的纯函数：工作区归哪个分类、分类/工作区怎么排。宿主校验与客户端建树共用，语义不会漂移 |
| `src/core/folders.ts` | 多文件夹的纯函数：有效文件夹列表、根目录解析、cwd 归属（最具体优先）、镜像判定与相对子路径拼装（`isUnderBase` / `joinSubpath`）。宿主校验与客户端建树共用 |

浏览器半边（`src/client/`，输出 CJS 闭包工厂）：

| 文件 | 职责 |
| --- | --- |
| `index.ts` | 客户端入口：向 `sidebar.workspaces` 槽注册（priority -1，shadow 官方浏览器）、注册 i18n、绑定各视图 |
| `contract.ts` | 注入共享契约（`GroupsBrowserInjected`），镜像官方 ui-workspace 的注入形状 |
| `GroupsBrowser.tsx` | 主 UI：分区头（标题/搜索/新建分组/添加工作区）+ 三级树 + 分组/工作区/会话对话框 |
| `rows.tsx` | 树的行组件（行内菜单、状态点、图标），对话框挂在 browser root 以免折叠时卸载 |
| `tree.ts` | 纯派生：分类文件夹 → 项目文件夹 →（可选）文件夹行 → 会话行；可见性规则对齐官方树 |
| `folders-persist.ts` | 文件夹 overlay 的客户端侧，读写宿主 `/workspace-groups/folders` |
| `locales.ts` | `workspaceGroups` 命名空间词典（zh/en + key 联合类型） |
| `styles.css` | 全部样式，`?inline` 导入后由构建期 lightningcss 压缩内联 |
| `branch.ts` / `FlowerBranch.tsx` | 侧栏当前行的「花朵」标记（几何计算在 `branch.ts`，仍由单测覆盖；连线与逐行圆点已移除，只画花朵） |
| `tabs.ts` | 标签条**纯**状态：打开顺序、激活项、派生展示 |
| `tab-store.ts` | `defineStore` 绑定（只做绑定，变换留在 `tabs.ts`） |
| `tab-seat.ts` | DOM 挂载点：标签条要贴在会话列顶部（ui-layout `AppFrame` 的 `.centerCol` 是 `pI_x6G_centerCol`，没有对应 slot） |
| `tab-persist.ts` | 标签条持久化的客户端侧，读写宿主 `/workspace-groups/tabs` |
| `SessionTabs.tsx` | 标签条 UI：每个打开的会话一枚 chip |
| `quick.ts` / `QuickPanel.tsx` | Ctrl+R 快切面板（工作区 / 会话两个页签） |
| `open-folder.ts` | 调 `@deepseek-ai/dsh-host-open-in-app` 的宿主路由，打开项目目录 |
| `subagent-lineage.ts` | 子代理后代计数的本地投影（0.1.2 起 runtime 不再提供 `indexSubagentDescendants`） |
| `store-core.ts` | 展开状态的**纯**变换（无运行时 import，便于单测） |
| `stores.ts` | 视图 store 工厂（展开状态，独立持久化 key，不碰官方 `dsh.workspace.view.v5`） |
| `store-hook.ts` | 面向 store 实例的框架形状选择器 hook（`useSyncExternalStoreWithSelector`） |

其它：`tests/*.test.ts`（vitest，覆盖 core matcher/tree/store/tabs/folders），
`tools/verify-folders.mjs`（沙箱内 vitest 起不来时的等价纯 node 断言），`cordis.patch.yml`
（cordis 插件补丁层），`scripts/verify-groups.mjs`，`workspace-groups.example.yaml`。

## 3. 构建 / 校验 / 装回去

本机的 DSH 沙箱里没有把 node/pnpm 放进 PATH，用下面这份绝对路径脚本跑（含备选写法说明）：

```powershell
$nodeDir = "C:\Users\qyh15\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin"
$pnpm    = "C:\Users\qyh15\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.cjs"
$env:Path = "$nodeDir;$PWD\node_modules\.bin;" + $env:Path

# 依赖（已装过可跳过）
& "$nodeDir\node.exe" $pnpm install

# 类型检查（tsc 两次：node 半边 + 浏览器半边）
& "$nodeDir\node.exe" $pnpm typecheck

# 构建：先 tsc 出 lib/types，再 tsdown 出 lib/index.js + lib/client.js
& "$nodeDir\node.exe" $pnpm build

# 单测（注意：DSH 沙箱内 vitest 起子进程会被 EPERM 拦掉，用普通终端跑）
& "$nodeDir\node.exe" .\node_modules\vitest\vitest.mjs run
```

对齐校验（重建时用过，改动后也可用来确认没伤到宿主半边）：

```powershell
$installed = "C:\Users\qyh15\.dsh\profiles\desktop\node_modules\@dsh-xhl\workspace-groups"
& "$nodeDir\node.exe" ..\tools\diff-text.mjs "$installed\lib\index.js" lib\index.js 3
& "$nodeDir\node.exe" ..\tools\compare-types.mjs "$installed\lib\types" lib\types
```

装回正在运行的 DSH 做真机验证：

1. `pnpm build`
2. 把 `lib\`（`index.js`、`client.js`、`client.js.map`、`types\`）覆盖到
   `C:\Users\qyh15\.dsh\profiles\desktop\node_modules\@dsh-xhl\workspace-groups\lib\`
3. 重启 DSH（Web GUI 在 `http://127.0.0.1:1282`）

> `lib/` 是**入库**的（上游仓库也这么干），改完源码要记得重新 build 再提交，
> 否则安装方拿到的还是旧产物。

## 4. 扩展时必须知道的三条约束

1. **平台模块表外置，其它一律内联。** `tsdown.config.ts` 的 `CLIENT_EXTERNALS`
   只允许 `react`、`react/jsx-runtime`、`react-dom*`、`@deepseek-ai/cordis`、
   `dsh-client-ui-slots`、`dsh-client-ui-primitives`、`dsh-client-store`、
   `dsh-client-runtime/client`。**任何其它 `@deepseek-ai/*` 值导入都会让构建失败**
   （`dsh-workspace-groups-client-purity` 纯净门）；跨插件协作只能走 cordis 服务或 slot。
   单纯类型导入没问题（会被擦除）。
2. **CSS 走 `?inline` 虚拟模块，前缀名不能改。** `CSS_VIRTUAL_PREFIX` 是
   `\0dsh-workspace-groups-inline-css:`，`styles.css` 里的类名会被 lightningcss
   压成哈希。加样式直接写 `styles.css`，组件里 `import css from './styles.css?inline'` 即可。
3. **Node 内置模块不许进浏览器包**（`NODE_BUILTINS` 参与判定）。需要 node 能力就往宿主半边加路由。

## 5. 常见扩展动作

- **加一块侧栏 UI / 一个按钮**：`rows.tsx` 加行内动作 →
  `GroupsBrowser.tsx` 接 handler；文案加进 `locales.ts` 的 `zh`/`en` 与
  `WorkspaceGroupsKey` 联合类型（漏加会被 tsc 抓到）。
- **加一份视图状态**：纯变换写 `store-core.ts`（或新开 `xxx.ts`，保持零运行时 import）
  → `stores.ts` 里 `defineStore` 绑定 → 组件用 `store-hook.ts` 的选择器 hook。
  这样单测能直接测语义，不必起浏览器 module loader。
- **加宿主能力**：新建 `src/host-xxx.ts`（读写 sidecar、做校验）→ 在 `src/index.ts`
  里用 `ctx.effect(() => ctx.webServer.register({ kind: 'exact', path, handler }), '...')`
  挂路由 → 客户端照 `tab-persist.ts` 的 `fetch` 封装去调，注意 `Cache-Control: no-store`。
- **加标签条行为**：状态变换进 `tabs.ts`（纯），store 绑定在 `tab-store.ts`，
  渲染在 `SessionTabs.tsx`，落盘走 `tab-persist.ts`；位置模型是「首次入列时定序」，
  改动前先读 `tabs.ts` 顶部的 position model 注释。两条不变量：**固定标签恒在未固定
  之前**（`moveTab` 在固定区边界夹紧、`togglePinTab` 插到固定区尾/未固定区头），
  **标签名与会话标题互不影响**（`renameTab` 只动 `title`）。除 `order` 之外的标签状态
  （固定、自定义名）也必须由 `restoreTabsImpl` 原样复原，否则每次重启都丢配置。
- **加一个分组展示元数据（颜色 / 图标 / 置顶等）**：字段进 `types.ts`
  （`CategoryAppearance` + `GROUP_COLORS`/`GROUP_ICON_IDS` 白名单）→ 校验进
  `host-manual.ts` 的 `parseAppearance`（**严格写、宽容读**：不校验键对应的分类是否
  还存在，否则删掉一条 YAML 分类就会让之后每次保存都 400）→ 派生进 `matcher.ts`
  （要影响排序就必须放 `effectiveCategories`，只在渲染层排会让拖拽落点与看到的顺序
  不一致）→ `tree.ts` 节点带 `appearance` → `rows.tsx` 渲染 → `styles.css` 配色/
  动画 → `locales.ts` 双语文案。写路径统一走
  `GroupsBrowser.tsx` 的 `updateCategoryAppearance`；**改名要重映射 `appearance` 的键、
  删除要清掉**（键空间是 display name，与 `categoryOrder` 一致）。
- **新增平台依赖**：先确认 DSH shell 的 module table 真有那一行，再往
  `CLIENT_EXTERNALS` 里加，否则运行时 `require` 会拿不到模块。

## 6. 已知坑

- **沙箱内跑不了 vitest**：`spawn` 被 DSH 沙箱拦（EPERM），在普通 PowerShell 终端里跑。
- **`node_modules/.bin/*.CMD` 直调会挂**：pnpm 里嵌套的 pnpm 脚本在 DSH 沙箱下会
  `Could not determine executable`，统一用 `node <pnpm.cjs> <script>` 形式。
- **单测覆盖不齐**：`tests/` 是早期版本写的，现已补 `tests/tabs.test.ts`（标签条纯逻辑：
  固定区不变量、拖动夹紧、关闭其他/右侧、持久化恢复）；**快切面板
  （`quick.ts` / `QuickPanel.tsx`）与分组外观仍无单测**，改到这些区域时补。
- **改持久化格式一律「严格写、宽容读」**：新增字段必须是可选的，旧文件读不进来不算
  错；悬挂键（如已删除的分类/会话）不得拒写，否则用户会卡在 400 上再也保存不了；
  新字段在 `restore*` 里必须原样带过去（`pinned`/`title` 漏带就等于重启丢配置）。
- **package 版本号语义混乱**：仓库 HEAD 里是 `0.1.0`，但提交里写 `feat(v0.7)`；
  重建树统一对齐到安装版的 `0.4.2`。发布前自己定一版号。
- **远程（`@zhangfengshun/dsh-remote-ssh`）工作区是镜像，不是真实远端目录**：它用
  `workspaceRegistry.create(mirrorDir)` 把远端根登记成普通工作区，`mirrorDir` 就是
  `~/.dsh/remote-workspaces/<workspaceId>`。所以对付这类项目时：
  额外文件夹只能是镜像内子目录（用 `joinSubpath` 拼、`isUnderBase` 判定，**绝不要让
  用户用原生选择器挑任意本地目录**）；`cwd` 分区逻辑照常可用，因为会话本身也在本地跑。
  真正"服务器上另一个根目录"应当由 SSH 插件单独建成工作区，再用分组归到一起。
  `POST /workspace-groups/folders` 已停用（410）：禁止复制子 marker，避免绕过父写回规则。
  统一创建入口在 `src/client/folder-directory.ts`：listWorkspaces 判归属，本地使用 DSH
  createDirectory，远端用专属 mkdir API（递归幂等），不走可能降级本地的 sidebar fs.mkdir。
  缺 SSH 的已知镜像、网络/鉴权失败、坏目录清单和重叠根一律报错。远程子目录会话暂阻断，
  因 remote-ssh 2.4.40 模型工具仍只匹配注册根 cwd。历史 marker 不自动清理。
  验证：`node tools/verify-folder-directory.mjs`（模拟 API）和
  `node --experimental-transform-types tools/verify-folders.mjs`（含 marker POST 拒绝回归）。
  不要把静态检查/模拟通过当成实机 SSH 联调通过。
