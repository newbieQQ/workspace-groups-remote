# NOTICE — 开源声明与署名 / Open-source statement and attribution

## 中文

**本仓库** `newbieQQ/dsh-better-workspace-group`
（DSH Web 客户端插件，npm 包名 `workspace-groups-local`）是下列作品的**衍生版本（fork）**：

- **原始项目**：https://github.com/z-col/dsh-workspace-groups
- **原作者**：zcol（GitHub [@z-col](https://github.com/z-col)，297114876@qq.com）
- **原始许可**：MIT License，`Copyright (c) 2026 zcol`（完整文本见仓库根目录 `LICENSE`）

原始项目提供了本插件的核心能力：把 DSH GUI 侧边栏从「项目 → 会话」两层升级为
「分类文件夹 → 项目文件夹 → 会话」三层树，以及拖拽归类、自由排序、sidecar YAML 规则
自动归类、runtime overlay 与分组树搜索。**这些设计与实现均归功于原作者**。

### 本 fork 的修改

本仓库在原始项目 `release: workspace-groups-local 1.0.0` 之上新增/调整了：

1. 分组外观弹窗新增「材料与实验」图标分区：28 个 16×16 手绘单色线条字形
   （实验操作 / 材料结构 / 表征测试 / 功能器件），中英双语悬停提示；
2. 外观弹窗改为在宿主 Modal 内容区内滚动、标题行固定，图标区变大不遮挡「完成」按钮，
   并规范默认图标输入框与「置顶分组」按钮的间距；
3. 所有行统一一个右对齐尾槽：成员数（会话行为相对时间）贴右边界，悬停/聚焦时让位给
   「＋」「⋯」按钮，零重排；按钮顺序统一为「＋」在前、「⋯」在后；
4. 宿主「默认工作区」从分组树移出，固定在侧栏底部独立一栏，保留工作区行的全部能力，
   并从分组、顶层与搜索结果中去重（识别依据来自宿主工作区数据，不只依赖目录名）；
5. `tools/verify-row-layout.mjs`：零依赖的样式表与行结构断言。

### 许可与合规

- 本仓库整体继续以 **MIT License** 发布，完整许可文本见 `LICENSE`，
  `Copyright (c) 2026 zcol` 声明予以**保留不作修改**。
- 本 fork 的修改部分：`Copyright (c) 2026 newbieQQ`，同样以 MIT 许可提供。
- 本仓库不包含原项目的商标、图标或品牌资产；README 与 package.json 中对原项目的引用
  仅用于署名与溯源。
- 上游仓库仍是本项目的正源：仅存在于上游的问题请提交上游 issue tracker，
  本 fork 不主张上游的所有权。

---

## English

**This repository**, `newbieQQ/dsh-better-workspace-group` (a DeepSeek Harness web-client
plugin, npm package name `workspace-groups-local`), is a **fork** of:

- **Original project**: https://github.com/z-col/dsh-workspace-groups
- **Original author**: zcol (GitHub [@z-col](https://github.com/z-col), 297114876@qq.com)
- **Original license**: MIT License, `Copyright (c) 2026 zcol` (full text in `LICENSE`)

The original project contributed the core of this plugin: upgrading the DSH GUI sidebar from a
two-level "project → session" list to a three-level "category → project → session" tree, plus
drag-and-drop classification, free ordering, sidecar YAML rules, the runtime overlay and
tree search. **Those designs and implementations are the original author's work.**

### Changes in this fork

1. a "Materials & lab" icon section in the appearance picker — 28 hand-drawn 16×16 monochrome
   line glyphs (lab operations, material structures, characterization, functional devices)
   with bilingual tooltips;
2. the appearance dialog now scrolls inside the host modal with a sticky header, so a larger
   icon grid never covers the "done" button, and the custom-icon input no longer touches the
   "pin group" button;
3. every row kind shares one right-aligned trailing slot: the member count (or a session's
   relative time) sits flush with the row's right edge and yields to the "+" / "⋯" buttons on
   hover or keyboard focus without reflow; buttons always order "+" then "⋯";
4. the host **default workspace** is pinned to its own bottom bar, keeping every
   workspace-row capability and being deduplicated out of groups, the top level and search
   results (identified from host workspace data, not from a directory name alone);
5. `tools/verify-row-layout.mjs`, a zero-dependency assertion script over the stylesheet and
   the row markup.

### License and compliance

- This repository stays under the **MIT License**; the full text is in `LICENSE` and the
  original `Copyright (c) 2026 zcol` notice is **kept unmodified**.
- Modifications in this fork: `Copyright (c) 2026 newbieQQ`, also provided under the MIT
  License.
- No upstream trademarks, logos or brand assets are included; references to the upstream
  project exist only for attribution and provenance.
- Upstream remains the canonical project. Issues that exist there should be reported to the
  upstream issue tracker; this fork claims no ownership of upstream.

---

## 合并 vendored 组件：dsh-remote-ssh / Vendored component: dsh-remote-ssh

自 `workspace-groups-remote` 1.0.0 起，本仓库以 vendor 方式原样收录下列作品，
与分组插件合并为同一个可安装 bundle：

- **项目**：https://github.com/ZhangFengshun/dsh-remote-ssh（npm 包名 `@zhangfengshun/dsh-remote-ssh`，收录版本 2.4.45）
- **作者**：ZhangFengshun
- **许可**：MIT License（完整文本见 `vendor/dsh-remote-ssh/LICENSE`）

收录范围为上游仓库的完整树（`vendor/dsh-remote-ssh/`），代码未作修改；
合并只发生在包级别：宿主入口组合加载、客户端工厂提取、补丁行合并，
细节见 README 的 “Merged bundle” 一节。

Since `workspace-groups-remote` 1.0.0 this repository vendors the work above
verbatim under `vendor/dsh-remote-ssh/` and ships it merged with the
workspace-groups plugin as a single installable bundle. The vendored code is
unmodified; the merge is package-level composition (host entry, client
factory extraction, patch rows) plus a small set of build-time patches to the shipped
host artifact (canonical remote-path identity in createRemoteWorkspace;
ssh argv hardening; terminal-wrapper trust tightening — all applied by
scripts/patch-remote-ssh.mjs; the vendored tree itself is untouched),
as documented in the README.

