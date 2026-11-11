<p align="right">
  <a href="./README.md">English</a> · <strong>简体中文</strong>
</p>

# dsh-better-workspace-group

DeepSeek Harness 工作区分组插件。基于 [z-col/dsh-workspace-groups](https://github.com/z-col/dsh-workspace-groups) 二次开发，让工作区、文件夹和会话在侧栏里更容易整理和使用。

## 合并包：workspace-groups-remote

本仓库已把两个 DSH 插件合并为**一个可安装的 bundle**（包名 `workspace-groups-remote`）：

- **workspace-groups**（本仓库原有内容）：侧边栏分组管理 + 会话标签条。宿主半边由 `src/` 构建为 `lib/groups.js`，客户端半边在 `src/client/groups-client.ts`。
- **@zhangfengshun/dsh-remote-ssh** 2.4.45（MIT，© ZhangFengshun）：原样收录于 `vendor/dsh-remote-ssh/`。其宿主半边**不打包**、以 `lib/remote-ssh/index.js` 文件形式发布——它必须从宿主模块表解析 `@deepseek-ai/schemastery`（其 Config 依赖 DSH 分支 schemastery 的 `.volatile()`）。发布出的宿主文件带**一组本地补丁**，构建时由 `scripts/patch-remote-ssh.mjs` 打上，vendor 树保持原样（见下文「重复的远程文件夹」「安全加固」）。其客户端在上游是自注册的模块加载器 bundle，构建时由 `scripts/build-remote-ssh-client.mjs` 提取出工厂函数，由合并后的客户端入口（`src/client/index.ts`）与分组客户端一并应用。

### 重复的远程文件夹——本合并包已修复

上游的 `createRemoteWorkspace` 按 `remotePath` 原始字符串比对已有记录，同一个远程目录换个写法（`~/proj` 与 `/home/u/proj` 与 `proj/`）就会再注册**一条工作区记录、一个本地镜像、一个原生工作区**，界面上就是同一个远程项目出现两个文件夹行。本包分两层修复：

- **宿主侧（构建时补丁，`scripts/patch-remote-ssh.mjs`）**：注册时先比轻度规范化后的写法；对不上时走一次 SSH 把路径解析成规范形式（`pwd -P` + `$HOME`）再比对，存入的也用规范写法。解析失败不拦创建（退回上游行为）。补丁行为由 `npm run test:patch` 覆盖；vendor 树保持原样，上游更新仍可直接替换。
- **客户端（分组侧）**：添加云端文件夹时，若已有成员由同一工作区支撑、或指向同一连接 + 同一远程目录，一律拒绝，不再只看镜像路径。

已经产生的重复不会自动合并（会话归属各自的工作区）；等那条成员里的会话不再需要时，在文件夹管理里移除该成员即可，它背后的重复记录会一并删除。

### 安全加固（同一组补丁）

2026-11-11 审查发现的问题，同样由构建时补丁修复，行为由 `npm run test:patch` 覆盖（含把生成的终端 wrapper 真跑起来的端到端用例）：

- **ssh 选项注入**：所有内部连接都经 `sshArgv` 构建，现已在 `user@host` 目标前插入 `--`，以 `-` 开头的用户名/主机名（如 `-oProxyCommand=...`，可经 remote_ssh 工具的内联参数到达）不再会被 ssh 当成选项在本机执行命令。终端 wrapper 自建的参数同样加了 `--`。
- **POSIX 密码传递**：`sshpass -p`（密码出现在进程列表里，同机所有用户可见）改为 `sshpass -e`，密码走 `SSHPASS` 环境变量，与 Windows 侧口径一致。
- **终端 wrapper 的信任域**：生成的 `dsh-remote-shell` 原先认任意目录下的 `.remote-ssh.json` 且完全关闭主机密钥校验；现只认当前目录确为已注册镜像根（`~/.dsh/remote-workspaces` 的直接子目录，正是宿主自己写标记的位置）时才自动连接，校验改为 `accept-new`，且 remotePath 以 base64 编码传给远端 shell，目录名里的引号/`$()` 只作数据、不再能逃逸成命令。
- **远端路径越界**：`localToRemote` 现会先把 `.`/`..` 段按字面折叠，`..` 爬出镜像根的路径直接拒绝，不再把 fs 请求映射到远端工作区之外。
- **写回护栏 fail-closed**：读不到工作区设置时本次不推送（并经 `writeBackFailure` 通道报错），不再在护栏（`writeBack` / `writeBackExclude`）根本没被评估的情况下照推。

`lib/index.js`（源文件 `bundle/index.js`）只做组合：在同一 fiber 上加载两个插件。`cordis.patch.yml` 只插入一行，并原样保留 remote-ssh 对 `better-sidebar` / `terminal-controller` 的 shell 覆盖。

### 安装 / 迁移

1. 从 profile 里移除旧的两个 bundle（`workspace-groups-local` 与 `@zhangfengshun/dsh-remote-ssh`）。
2. 改装本包，并完全重启 DSH。

已有数据不受影响：`~/.dsh/workspace-groups.yaml` 与 `$DSH_HOME` 下的 sidecar、`dsh-remote-ssh` 设置命名空间、`~/.dsh/remote-ssh/` 都照常工作。若以前在 remote-ssh 的 bundle 行里写过配置，现在改为嵌套写法 `config: { remoteSsh: { ... } }`（连接配置本来就存在 DSH 设置里，不受影响）。

### 验证

```sh
npm install
npm run build
npm run verify:bundle   # 对构建产物做组合检查（含 vendor 完整性指纹 + 客户端真执行冒烟）
npm run verify          # 全套：tsc + vitest + verify:bundle + 补丁行为测试
```

vendor 里的上游测试也能原地跑（需先让其依赖可解析：在仓库根执行 `ln -s ../../node_modules vendor/dsh-remote-ssh/node_modules`，再在 `vendor/dsh-remote-ssh` 里运行 `node tests/run-all.mjs`）。已知的非 Windows 环境既存失败：分组插件有 6 个 folders 测试使用 `C:\` 路径、remote-ssh 有几个套件假设 WSL / Windows 路径语义——在未合并的上游里同样失败，与合并无关。

### 已知取舍

- **加载耦合**：两半作为一个包加载，任一半导入失败，整包（含分组）都会起不来。这是「只装一个包」的代价；要隔离失败域需要宿主支持按半懒加载，目前没有这个承诺。
- **shell 覆盖对所有安装生效**：合并包带着 remote-ssh 对 `better-sidebar` / `terminal-controller` 的 shell 覆盖，装这个包等于同时接管 profile 的终端 shell 集成（镜像终端自动连接靠的就是它）。宿主补丁引擎在未来版本里遇到覆盖目标不存在时如何处理，未验证——已列入真机清单。
- **首次连接新 SSH 主机不做指纹确认**（`accept-new`，与 VS Code Remote-SSH 相同的默认）：内部通道首次连接即信任主机密钥，之后密钥变化会大声失败。终端 wrapper 已由补丁从 `no` 提升到同一 `accept-new` 口径。

### 维护

vendor 代码不是 fork：更新 remote-ssh 时，把 `vendor/dsh-remote-ssh/` 换成新版上游树，跑 `npm run vendor:manifest` 重新记录其 sha256 指纹清单，再重新构建；客户端提取脚本带锚点断言，上游若改了 bundle 包裹形式会直接报错。vendor 之外的本地改动：`src/client/GroupsBrowser.tsx` 把可空 ref 的判断改成显式写法（`pending !== null && ...`），因为 fork 的 `tsc` 类型步骤不接受可选链写法，语义不变；以及上文的防重复成员检查（`src/core/folders.ts`、`addRemoteFolderTo`）。宿主补丁脚本同样带锚点断言，上游改动锚点代码时会直接报错。

## 预览

<img src="screenshot.png" alt="工作区分组插件预览" width="280" />

## 已实现的功能

- **工作区分组**：按「分组 → 项目 → 会话」浏览，支持新建、重命名、删除、折叠和置顶分组。
- **拖拽整理**：把项目拖入或移出分组，并调整分组、项目的显示顺序。
- **分组外观**：设置分组颜色和图标；新增「材料与实验」图标分区，包含实验操作、材料结构、表征测试和功能器件图标。
- **一个项目多个文件夹**：为项目添加额外文件夹、选择默认根目录，会话会按工作目录归入对应文件夹。
- **本地与远程目录**：本地工作区和已注册的 SSH 远程工作区都可以创建文件夹；远程操作失败时不会误建到本地镜像。
- **会话标签栏**：打开、切换、固定、重命名、拖动排序和关闭会话标签，支持关闭其他标签及右侧标签。
- **侧栏布局优化**：默认工作区固定在底部；各行的数量、时间和操作按钮统一右对齐；外观弹窗内容可滚动。
- **搜索与保存**：保留分组层级搜索会话，分组、排序、标签和文件夹设置都会保存，刷新或重启后仍然有效。

## 安装

Desktop 环境：

```sh
dsh plugin --profile desktop add github:newbieQQ/dsh-better-workspace-group
```

Web 环境将 `desktop` 改为 `web`。安装完成后，完全重启 DSH 或对应的 Web profile。

## 基本使用

1. 点击工作区标题栏的「新建分组」，再把项目拖进去。
2. 在项目或分组的 `⋯` 菜单中管理分组、外观和文件夹。
3. 在项目的「文件夹…」弹窗中添加文件夹或选择默认根目录。

需要按路径或名称自动分组时，可参考 [workspace-groups.example.yaml](./workspace-groups.example.yaml) 配置 `~/.dsh/workspace-groups.yaml`。不配置也不影响手动分组。

## 卸载

```sh
dsh plugin --profile desktop remove workspace-groups-local
```

## 致谢与许可

原项目由 [zcol](https://github.com/z-col) 开发并以 MIT 许可发布。本仓库在其基础上增加了材料与实验图标、底部默认工作区、统一行尾布局、远程工作区文件夹等功能。

原始作品 © 2026 zcol；本仓库修改 © 2026 newbieQQ。详见 [LICENSE](./LICENSE) 和 [NOTICE.md](./NOTICE.md)。
