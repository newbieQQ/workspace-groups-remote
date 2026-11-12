// Build step: turn the vendored dsh-remote-ssh client bundle into an
// importable factory module for the merged client entry.
//
// Upstream ships lib/client.js as a self-registering module-loader bundle:
//   window.__ModuleLoader__.load({ id: "@zhangfengshun/dsh-remote-ssh",
//     factory: (require) => { ... } })
// A DSH package gets exactly ONE client row (keyed by package name), so the
// merged package cannot ship that file as-is. This script strips the
// registration wrapper and re-exports the factory itself; the merged client
// entry invokes it with the bundle's own require and applies the result
// next to the workspace-groups client. The factory body is byte-identical
// to upstream — only the two wrapper lines change.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(join(root, 'vendor/dsh-remote-ssh/lib/client.js'), 'utf8')

const LOAD = 'window.__ModuleLoader__.load({'
if (source.split(LOAD).length - 1 !== 1) throw new Error('remote-ssh client: expected exactly one __ModuleLoader__.load call')
const loadAt = source.indexOf(LOAD)
const header = source.slice(0, loadAt)
const rest = source.slice(loadAt + LOAD.length)

const ID_LINE = '\n  id: "@zhangfengshun/dsh-remote-ssh",'
if (!rest.startsWith(ID_LINE)) throw new Error('remote-ssh client: id line anchor mismatch')
const FACTORY_LINE = '\n  factory: (require) => {'
const afterId = rest.slice(ID_LINE.length)
if (!afterId.startsWith(FACTORY_LINE)) throw new Error('remote-ssh client: factory line anchor mismatch')
let body = afterId.slice(FACTORY_LINE.length)

const TAIL = '\n  }\n});'
if (body.endsWith(TAIL + '\n')) body = body.slice(0, -(TAIL.length + 1))
else if (body.endsWith(TAIL)) body = body.slice(0, -TAIL.length)
else throw new Error('remote-ssh client: tail anchor mismatch')

// [workspace-groups-remote patch] Replace the upstream root-label heuristic
// (basename + inline padding-left:6px) with an exact full-path identity match.
// better-sidebar's RootRow carries the complete directory in `title`; only an
// element whose title equals a remote workspace's mirrorPath is rewritten, so
// a same-named local directory can never be relabelled by mistake. If a future
// shell drops that attribute nothing is changed (safe degradation).
const ROOT_LABEL_OLD = `        // ---- 文件树根标签：显示远程目录名，而不是本地镜像目录 ID（issue #9）----
        // better-sidebar「文件」页签的树根标签取自会话 cwd（= 本地镜像路径）的 basename，
        // 于是显示成镜像目录 ID（如 wmirror3）。这条链路不经过任何 fs.* 路由，
        // 而 Host 侧 session.cwd 虽然已返回 root 字段，客户端只消费 cwd
        // （client-registry 的 api.sessionCwd(...).then(r => setFetchedCwd(r.cwd))，
        // 另有 useSessionCwd 直接读客户端会话列表的 cwd），因此只能在渲染层替换文本。
        // 定位不依赖构建期哈希类名：根行是树里唯一带内联 padding-left:6px 的行，
        // 仅当该行内的纯文本节点 === 某远程工作区的镜像 basename 时才替换（幂等、可自愈）。
        var watchedRootLabels = []; // 已替换的标签元素：1s 幂等复检，抵消 React 重渲染
        function refreshRootLabels(workspaces) {
          var next = {};
          for (var i = 0; i < (workspaces || []).length; i++) {
            var w = workspaces[i] || {};
            var mirror = String(w.mirrorPath || "").replace(/[\\\\/]+$/, "");
            var remote = String(w.remotePath || "").replace(/[\\\\/]+$/, "");
            if (!mirror || !remote) continue;
            var mb = mirror.split(/[\\\\/]/).pop();
            var rb = remote.split(/[\\\\/]/).pop();
            if (mb && rb && mb !== rb) next[mb] = { label: rb, remotePath: remote };
          }
          rootLabels = next;
        }
        /** 根行判据：自身或 ≤3 层祖先带内联 padding-left:6px（better-sidebar 根行样式）。 */
        function isRootRow(el) {
          var node = el;
          for (var hop = 0; hop < 3 && node; hop++) {
            var style = node.getAttribute ? node.getAttribute("style") : null;
            if (style && /padding-left:\\s*6px/i.test(String(style))) return true;
            node = node.parentElement;
          }
          return false;
        }
        /** 单个标签替换：纯文本 + 命中镜像 basename + 位于根行 → 换成远程目录名。 */
        function fixRootLabel(el) {
          var text = (el.textContent || "").trim();
          if (!text) return false;
          var hit = rootLabels[text];
          if (hit === undefined) {
            // 文本已是远程目录名（上一轮替换过）→ 幂等成功；否则与本插件无关
            return el.getAttribute && el.getAttribute("data-rssh-root-label") === "1";
          }
          if (el.childElementCount > 0) return false; // 只改纯文本节点
          if (!isRootRow(el)) return false;           // 非根行（例如同名子条目）不动
          el.textContent = hit.label;
          if (el.setAttribute) {
            el.setAttribute("data-rssh-root-label", "1");
            el.setAttribute("title", hit.remotePath); // 悬停可见完整远程路径
          }
          watchRootLabel(el);
          return true;
        }
        function watchRootLabel(el) {
          for (var i = 0; i < watchedRootLabels.length; i++) { if (watchedRootLabels[i] === el) return; }
          watchedRootLabels.push(el);
        }
        function recheckRootLabels() {
          for (var i = watchedRootLabels.length - 1; i >= 0; i--) {
            var el = watchedRootLabels[i];
            if (!el || !el.isConnected) { watchedRootLabels.splice(i, 1); continue; }
            fixRootLabel(el);
          }
        }
        function applyRootLabelsIn(root) {
          if (!root || !root.querySelectorAll) return;
          try {
            var nodes = root.querySelectorAll("span,div");
            for (var i = 0; i < nodes.length; i++) fixRootLabel(nodes[i]);
            if (root.nodeType === 1) fixRootLabel(root);
          } catch (e) {}
        }`

const ROOT_LABEL_NEW = `        // ---- 文件树根标签：按完整镜像路径精确认行（issue #9）----
        // better-sidebar 的根行 title 是完整目录路径（RootRow title={path}）。
        // 只在该 title 精确等于某个远程工作区的 mirrorPath 时才改写名称：不再
        // 按 basename 或内联 padding-left 猜测目录身份，因此同名本地目录不会
        // 被误改；属性缺席时保持原样（安全降级）。
        var watchedRootLabels = []; // 已替换的标签元素：1s 幂等复检，抵消 React 重渲染
        var rootLabels = {};
        function normRemotePath(value) {
          return String(value == null ? "" : value).replace(/[\\\\/]+$/, "");
        }
        function refreshRootLabels(workspaces) {
          var next = {};
          for (var i = 0; i < (workspaces || []).length; i++) {
            var w = workspaces[i] || {};
            var mirror = normRemotePath(w.mirrorPath);
            var remote = normRemotePath(w.remotePath);
            if (!mirror || !remote) continue;
            var title = normTitle(w.title);
            var label = title || remote.split(/[\\\\/]/).pop();
            if (label) next[mirror] = { label: label, remotePath: remote, mirrorPath: mirror };
          }
          rootLabels = next;
        }
        /** The root row's own full path, from the explicit attributes only. */
        function rootPathOf(el) {
          var explicit = el && el.getAttribute ? el.getAttribute("data-rssh-root-mirror") : null;
          if (explicit) return normRemotePath(explicit);
          var title = el && el.getAttribute ? el.getAttribute("title") : null;
          return title ? normRemotePath(title) : "";
        }
        /** Direct leaf <span> that prints the folder name (no nested markup). */
        function rootLabelSpanOf(el) {
          var children = el && el.children ? el.children : [];
          for (var i = 0; i < children.length; i++) {
            if (String(children[i].tagName || "").toLowerCase() === "span" && children[i].childElementCount === 0) return children[i];
          }
          return null;
        }
        /** Exact full-path hit → replace only the leaf name span. */
        function fixRootLabel(el) {
          if (!el || !el.getAttribute) return false;
          var path = rootPathOf(el);
          if (!path) return false;
          var hit = rootLabels[path];
          if (hit === undefined) return false;
          var span = rootLabelSpanOf(el);
          if (!span) return false;
          var base = path.split(/[\\\\/]/).pop();
          var text = normTitle(span.textContent);
          if (text !== base && el.getAttribute("data-rssh-root-label") !== "1") return false;
          span.textContent = hit.label;
          el.setAttribute("data-rssh-root-label", "1");
          el.setAttribute("data-rssh-root-mirror", hit.mirrorPath);
          el.setAttribute("title", hit.remotePath); // 悬停可见完整远程路径
          watchRootLabel(el);
          return true;
        }
        function watchRootLabel(el) {
          for (var i = 0; i < watchedRootLabels.length; i++) { if (watchedRootLabels[i] === el) return; }
          watchedRootLabels.push(el);
        }
        function recheckRootLabels() {
          for (var i = watchedRootLabels.length - 1; i >= 0; i--) {
            var el = watchedRootLabels[i];
            if (!el || !el.isConnected) { watchedRootLabels.splice(i, 1); continue; }
            fixRootLabel(el);
          }
        }
        function applyRootLabelsIn(root) {
          if (!root || !root.querySelectorAll) return;
          try {
            // Only elements carrying the full path title are candidates; no
            // text/basename or inline-style scan.
            var nodes = root.querySelectorAll("[title]");
            for (var i = 0; i < nodes.length; i++) fixRootLabel(nodes[i]);
            if (root.nodeType === 1) fixRootLabel(root);
          } catch (e) {}
        }`

const occurrences = body.split(ROOT_LABEL_OLD).length - 1
if (occurrences !== 1) throw new Error('remote-ssh client: root-label block anchor found ' + occurrences + ' times')
body = body.replace(ROOT_LABEL_OLD, ROOT_LABEL_NEW)

const out = header
  + '// --- merged-bundle transform (scripts/build-remote-ssh-client.mjs) ---\n'
  + '// Upstream registers this factory under its own package id; the merged\n'
  + '// package registers ONE client row, so the factory is exported instead\n'
  + '// and applied by src/client/index.ts. Body below is upstream-verbatim.\n'
  + 'export default (require) => {'
  + body
  + '\n}\n'
writeFileSync(join(root, 'src/client/remote-ssh-factory.generated.mjs'), out)
console.log('remote-ssh client factory -> src/client/remote-ssh-factory.generated.mjs')
