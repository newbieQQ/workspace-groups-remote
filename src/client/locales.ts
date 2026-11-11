/**
 * Locale dictionaries for the workspace-groups browser. The namespace is
 * `workspaceGroups` (independent from ui-workspace's `workspace` namespace).
 */
import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'

/** Dictionary keys of the workspaceGroups namespace (single source of truth). */

export type WorkspaceGroupsKey =
  | 'section.workspaces'
  | 'section.sessions'
  | 'search'
  | 'search.placeholder'
  | 'search.clear'
  | 'search.noMatches'
  | 'search.unavailable'
  | 'search.pending'
  | 'search.hasMore'
  | 'search.results.aria'
  | 'workspace.add'
  | 'workspace.addBusy'
  | 'workspace.addError'
  | 'workspace.addErrorTitle'
  | 'workspace.rename'
  | 'workspace.delete'
  | 'workspace.deleteTitle'
  | 'workspace.deleteConfirm'
  | 'workspace.deleteCancel'
  | 'workspace.renaming'
  | 'workspace.deleting'
  | 'workspace.renameTitle'
  | 'workspace.renamePlaceholder'
  | 'workspace.renameConfirm'
  | 'workspace.renameCancel'
  | 'workspace.moveOutOfGroup'
  | 'workspace.openInFolder'
  | 'workspace.openInFolderError'
  | 'folder.title'
  | 'folder.manage'
  | 'folder.listAria'
  | 'folder.sectionList'
  | 'folder.sectionAdd'
  | 'folder.emptyHint'
  | 'folder.base'
  | 'folder.setRoot'
  | 'folder.rootBadge'
  | 'folder.remove'
  | 'folder.add'
  | 'folder.done'
  | 'folder.duplicate'
  | 'folder.conflict'
  | 'folder.removeError'
  | 'folder.removeRemotePrompt'
  | 'folder.removeRemoteDelete'
  | 'folder.removeRemoteOnly'
  | 'folder.addError'
  | 'folder.sessionError'
  | 'folder.saveError'
  | 'folder.notReady'
  | 'folder.remoteSessionUnsupported'
  | 'folder.remoteHint'
  | 'folder.remoteNeedsSubpath'
  | 'folder.subpathLabel'
  | 'folder.subpathPlaceholder'
  | 'folder.addSubpath'
  | 'folder.subpathInvalid'
  | 'folder.cloudSection'
  | 'folder.profileLabel'
  | 'folder.remotePathLabel'
  | 'folder.remotePathPlaceholder'
  | 'folder.remotePathOrName'
  | 'folder.createAndAdd'
  | 'folder.cloudNoteBoth'
  | 'folder.addRemote'
  | 'folder.noProfiles'
  | 'folder.profilesError'
  | 'folder.cloudTag'
  | 'folder.localTag'
  | 'folder.memberMissing'
  | 'folder.memberNested'
  | 'folder.alreadyRoot'
  | 'folder.addAria'
  | 'folder.tabLocal'
  | 'folder.tabCloud'
  | 'folder.pickLocal'
  | 'folder.localNote'
  | 'folder.localIntoRemote'
  | 'folder.cloudNote'
  | 'folder.browse'
  | 'folder.browseTitle'
  | 'folder.browseListAria'
  | 'folder.browseNote'
  | 'folder.browseFailed'
  | 'folder.chooseHere'
  | 'folder.up'
  | 'folder.home'
  | 'folder.refresh'
  | 'folder.loading'
  | 'folder.emptyDir'
  | 'group.create'
  | 'group.createTitle'
  | 'group.createPlaceholder'
  | 'group.createConfirm'
  | 'group.createCancel'
  | 'group.rename'
  | 'group.renameTitle'
  | 'group.renameConfirm'
  | 'group.delete'
  | 'group.deleteTitle'
  | 'group.deleteConfirm'
  | 'group.deleteCancel'
  | 'group.nameDuplicate'
  | 'group.nameReserved'
  | 'group.pin'
  | 'group.unpin'
  | 'group.pinned'
  | 'group.appearance'
  | 'group.appearanceTitle'
  | 'group.appearanceDone'
  | 'group.color'
  | 'group.colorDefault'
  | 'group.icon'
  | 'group.iconDefault'
  | 'group.iconCustom'
  | 'group.iconInvalid'
  | 'group.icon.section.common'
  | 'group.icon.section.lab'
  | 'group.icon.section.materials'
  | 'group.icon.section.characterization'
  | 'group.icon.section.devices'
  | 'group.icon.section.emoji'
  | 'color.red'
  | 'color.orange'
  | 'color.amber'
  | 'color.green'
  | 'color.teal'
  | 'color.blue'
  | 'color.indigo'
  | 'color.purple'
  | 'color.pink'
  | 'color.gray'
  | 'section.topLevel'
  | 'section.defaultWorkspace'
  | 'manual.saveError'
  | 'manual.conflict'
  | 'session.new'
  | 'session.rename'
  | 'session.archive'
  | 'session.fork'
  | 'session.renameTitle'
  | 'session.renamePlaceholder'
  | 'session.renameConfirm'
  | 'session.renameCancel'
  | 'session.renaming'
  | 'uncategorized'
  | 'empty.none'
  | 'empty.noWorkspaces'
  | 'close'
  | 'cancel'
  | 'confirm'
  | 'retry'
  | 'configUnavailable'
  | 'collapse'
  | 'expandMore'
  | 'newSession'
  | 'quick.title'
  | 'quick.tab.workspaces'
  | 'quick.tab.sessions'
  | 'quick.search.placeholder'
  | 'quick.search.sessions'
  | 'quick.empty.workspaces'
  | 'quick.action.newSession'
  | 'quick.action.running'
  | 'quick.action.noneRunning'
  | 'quick.empty.sessions'
  | 'quick.select.hint'
  | 'quick.hint'
  | 'tabs.aria'
  | 'tabs.close'
  | 'tabs.archive'
  | 'tabs.pin'
  | 'tabs.unpin'
  | 'tabs.pinned'
  | 'tabs.rename'
  | 'tabs.renameSession'
  | 'tabs.renamePlaceholder'
  | 'tabs.closeOthers'
  | 'tabs.closeRight'
  | 'tabs.dragHint'

export type WorkspaceGroupsDict = LocaleDictOf<'workspaceGroups'>

/** Simplified Chinese dictionary. */
export const zh: WorkspaceGroupsDict = {
  'section.workspaces': '工作区',
  'section.sessions': '会话',
  'search': '搜索',
  'search.placeholder': '搜索会话…',
  'search.clear': '清除',
  'search.noMatches': '没有匹配的会话',
  'search.unavailable': '搜索不可用',
  'search.pending': '搜索中…',
  'search.hasMore': '结果过多，请细化关键词',
  'search.results.aria': '搜索结果',
  'workspace.add': '添加工作区',
  'workspace.addBusy': '正在添加…',
  'workspace.addError': '添加失败',
  'workspace.addErrorTitle': '无法添加工作区',
  'workspace.rename': '重命名',
  'workspace.delete': '删除',
  'workspace.deleteTitle': '删除工作区',
  'workspace.deleteConfirm': '仅删除注册信息，目录与会话日志保留。确定删除？',
  'workspace.deleteCancel': '取消删除',
  'workspace.renaming': '重命名中…',
  'workspace.deleting': '删除中…',
  'workspace.renameTitle': '重命名工作区',
  'workspace.renamePlaceholder': '工作区名称',
  'workspace.renameConfirm': '重命名',
  'workspace.renameCancel': '取消',
  'workspace.moveOutOfGroup': '移出分组',
  'workspace.openInFolder': '在文件夹中打开',
  'workspace.openInFolderError': '打开文件夹失败',
  'folder.title': '文件夹',
  'folder.manage': '文件夹…',
  'folder.listAria': '工作区文件夹',
  'folder.sectionList': '项目文件夹',
  'folder.sectionAdd': '添加文件夹',
  'folder.emptyHint': '还没有额外文件夹。下面挂一个目录，它的会话会独立运行，模型也能直接读到里面的文件。',
  'folder.base': '基础文件夹',
  'folder.setRoot': '设为根目录',
  'folder.rootBadge': '根目录',
  'folder.remove': '从工作区移除',
  'folder.add': '添加文件夹',
  'folder.done': '完成',
  'folder.duplicate': '该文件夹已在此工作区中',
  'folder.conflict': '文件夹已被另一个窗口修改，已同步为最新状态，本次修改未保存，请重试',
  'folder.removeError': '远程工作区删除失败',
  'folder.removeRemotePrompt': '这个云端文件夹背后有一个工作区，移除时要连它一起删掉吗？删掉后它里面的会话也会消失。',
  'folder.removeRemoteDelete': '连工作区一起删',
  'folder.removeRemoteOnly': '只移除文件夹',
  'folder.addError': '添加文件夹失败',
  'folder.sessionError': '新建会话失败',
  'folder.saveError': '文件夹保存失败',
  'folder.notReady': '目录安全信息尚未加载，请重启 DSH 并刷新页面后重试',
  'folder.remoteSessionUnsupported': '当前 SSH 插件不完整支持子目录会话，请从远程工作区根目录打开会话。不会退回本地终端。',
  'folder.remoteHint': '输入一个文件夹名：本地使用 DSH 目录接口；远程使用 SSH 创建目录接口（远端同名目录已存在时复用）。SSH 不可用时不会在镜像里创建本地目录。',
  'folder.remoteNeedsSubpath': '远程工作区请用子目录方式添加文件夹',
  'folder.subpathLabel': '文件夹名称',
  'folder.subpathPlaceholder': '例如 data',
  'folder.addSubpath': '创建文件夹',
  'folder.subpathInvalid': '路径无效：请填工作区内的相对路径，不能用绝对路径或 ..',
  'folder.cloudSection': '云端文件夹',
  'folder.profileLabel': 'SSH 连接',
  'folder.remotePathLabel': '远端目录',
  'folder.remotePathPlaceholder': '例如 ~/projects/app',
  'folder.remotePathOrName': '例如 ~/projects/app，或新目录名',
  'folder.createAndAdd': '新建并添加',
  'folder.cloudNoteBoth': '填绝对路径：新建一个云端工作区（带本地镜像）；只填名字：在项目云端根目录下新建该目录并挂进来',
  'folder.addRemote': '添加云端文件夹',
  'folder.noProfiles': '没有可用的 SSH 连接：请先在 remote-ssh 插件中配置连接',
  'folder.profilesError': '读取 SSH 连接失败',
  'folder.cloudTag': '云端',
  'folder.localTag': '本地',
  'folder.memberMissing': '该文件夹对应的独立工作区已不存在，请移除后重新添加',
  'folder.memberNested': '该目录本身已是一个含文件夹的项目，不能作为文件夹加入',
  'folder.alreadyRoot': '这就是项目的根目录，不能再作为一个文件夹加入',
  'folder.addAria': '添加文件夹的方式',
  'folder.tabLocal': '本地目录',
  'folder.tabCloud': '云端目录',
  'folder.pickLocal': '选择本地目录…',
  'folder.localNote': '在本机选一个目录，作为这个项目的文件夹',
  'folder.localIntoRemote': '这个项目在云端；本地目录会作为本地文件夹挂到这个项目里',
  'folder.cloudNote': '会为该远端目录建立本地镜像，并注册成一个工作区供会话使用',
  'folder.browse': '浏览…',
  'folder.browseTitle': '选择云端文件夹',
  'folder.browseListAria': '远端目录列表',
  'folder.browseNote': '只列出目录：点目录进入，用底部按钮选择当前目录。',
  'folder.browseFailed': '读取远端目录失败',
  'folder.chooseHere': '选择此目录',
  'folder.up': '上一级',
  'folder.home': '主目录',
  'folder.refresh': '刷新',
  'folder.loading': '正在读取远端目录…',
  'folder.emptyDir': '这个目录下没有子目录',
  'group.create': '新建分组',
  'group.createTitle': '新建分组',
  'group.createPlaceholder': '分组名称',
  'group.createConfirm': '创建',
  'group.createCancel': '取消',
  'group.rename': '重命名分组',
  'group.renameTitle': '重命名分组',
  'group.renameConfirm': '重命名',
  'group.delete': '删除分组',
  'group.deleteTitle': '删除分组',
  'group.deleteConfirm': '删除后，该分组内的所有项目将移到顶层（不归组）。确定删除？',
  'group.deleteCancel': '取消删除',
  'group.nameDuplicate': '已存在同名分组',
  'group.nameReserved': '该名称不可用',
  'group.pin': '置顶分组',
  'group.unpin': '取消置顶',
  'group.pinned': '已置顶',
  'group.appearance': '颜色与图标…',
  'group.appearanceTitle': '分组外观',
  'group.appearanceDone': '完成',
  'group.color': '颜色',
  'group.colorDefault': '默认',
  'group.icon': '图标',
  'group.iconDefault': '默认图标',
  'group.iconCustom': '自定义字符',
  'group.iconInvalid': '图标需为预设图标或 1–4 个字符',
  'group.icon.section.common': '常用图标',
  'group.icon.section.lab': '实验操作',
  'group.icon.section.materials': '材料结构',
  'group.icon.section.characterization': '表征测试',
  'group.icon.section.devices': '功能器件',
  'group.icon.section.emoji': '常用表情',
  'color.red': '红色',
  'color.orange': '橙色',
  'color.amber': '琥珀',
  'color.green': '绿色',
  'color.teal': '青色',
  'color.blue': '蓝色',
  'color.indigo': '靛蓝',
  'color.purple': '紫色',
  'color.pink': '粉色',
  'color.gray': '灰色',
  'section.topLevel': '顶层项目',
  'section.defaultWorkspace': '默认工作区',
  'manual.saveError': '分组变更保存失败',
  'manual.conflict': '分组已被另一个窗口修改，已同步为最新状态，本次修改未保存，请重试',
  'session.new': '新建会话',
  'session.rename': '重命名会话',
  'session.archive': '归档',
  'session.fork': '派生',
  'session.renameTitle': '重命名会话',
  'session.renamePlaceholder': '会话名称',
  'session.renameConfirm': '重命名',
  'session.renameCancel': '取消',
  'session.renaming': '重命名中…',
  'uncategorized': '未分类',
  'empty.none': '暂无内容',
  'empty.noWorkspaces': '还没有工作区',
  'close': '关闭',
  'cancel': '取消',
  'confirm': '确定',
  'retry': '重试',
  'configUnavailable': '分组配置不可用',
  'collapse': '折叠',
  'expandMore': '展开全部',
  'newSession': '新建会话',
  'quick.title': '快速切换',
  'quick.tab.workspaces': '工作区',
  'quick.tab.sessions': '全部会话',
  'quick.search.placeholder': '搜索工作区…',
  'quick.search.sessions': '搜索会话…',
  'quick.empty.workspaces': '没有匹配的工作区',
  'quick.action.newSession': '新建会话',
  'quick.action.running': '切到运行中的会话',
  'quick.action.noneRunning': '没有正在运行的会话',
  'quick.empty.sessions': '还没有会话',
  'quick.select.hint': '在上方选择一个工作区',
  'quick.hint': 'Ctrl+R 开关 · Enter 打开/新建 · Esc 关闭',
  'tabs.aria': '已打开的会话',
  'tabs.close': '关闭标签',
  'tabs.archive': '归档',
  'tabs.pin': '固定标签',
  'tabs.unpin': '取消固定',
  'tabs.pinned': '已固定（关闭其他时保留）',
  'tabs.rename': '重命名标签',
  'tabs.renameSession': '重命名会话…',
  'tabs.renamePlaceholder': '标签名，留空恢复会话标题',
  'tabs.closeOthers': '关闭其他标签',
  'tabs.closeRight': '关闭右侧标签',
  'tabs.dragHint': '拖动可排序',
}

/** English dictionary. */
export const en: WorkspaceGroupsDict = {
  'section.workspaces': 'Workspaces',
  'section.sessions': 'Sessions',
  'search': 'Search',
  'search.placeholder': 'Search sessions…',
  'search.clear': 'Clear',
  'search.noMatches': 'No matching sessions',
  'search.unavailable': 'Search unavailable',
  'search.pending': 'Searching…',
  'search.hasMore': 'Too many results — refine the query',
  'search.results.aria': 'Search results',
  'workspace.add': 'Add workspace',
  'workspace.addBusy': 'Adding…',
  'workspace.addError': 'Add failed',
  'workspace.addErrorTitle': 'Could not add workspace',
  'workspace.rename': 'Rename',
  'workspace.delete': 'Delete',
  'workspace.deleteTitle': 'Delete workspace',
  'workspace.deleteConfirm': 'Only the registration is removed; the directory and session logs stay. Delete?',
  'workspace.deleteCancel': 'Cancel delete',
  'workspace.renaming': 'Renaming…',
  'workspace.deleting': 'Deleting…',
  'workspace.renameTitle': 'Rename workspace',
  'workspace.renamePlaceholder': 'Workspace name',
  'workspace.renameConfirm': 'Rename',
  'workspace.renameCancel': 'Cancel',
  'workspace.moveOutOfGroup': 'Move out of group',
  'workspace.openInFolder': 'Open in folder',
  'workspace.openInFolderError': 'Could not open the folder',
  'folder.title': 'Folders',
  'folder.manage': 'Folders…',
  'folder.listAria': 'Workspace folders',
  'folder.sectionList': 'Project folders',
  'folder.sectionAdd': 'Add a folder',
  'folder.emptyHint': 'No extra folders yet. A folder added below runs its sessions on its own, so the agent can read the files inside it directly.',
  'folder.base': 'Base folder',
  'folder.setRoot': 'Set as root',
  'folder.rootBadge': 'Root',
  'folder.remove': 'Remove from workspace',
  'folder.add': 'Add folder',
  'folder.done': 'Done',
  'folder.duplicate': 'That folder is already in this workspace',
  'folder.conflict': 'Folders changed in another window; synced to the latest state, this edit was not saved — please retry',
  'folder.removeError': 'Could not delete the remote workspace',
  'folder.removeRemotePrompt': 'This cloud folder is backed by its own workspace. Remove the workspace along with it? Its sessions will be deleted too.',
  'folder.removeRemoteDelete': 'Delete workspace too',
  'folder.removeRemoteOnly': 'Remove folder only',
  'folder.addError': 'Could not add the folder',
  'folder.sessionError': 'Could not start a session',
  'folder.saveError': 'Could not save folders',
  'folder.notReady': 'Directory safety information is not loaded. Restart DSH and refresh the page before retrying.',
  'folder.remoteSessionUnsupported': 'This SSH plugin does not fully support subdirectory sessions. Start from the remote workspace root instead; no local terminal fallback is allowed.',
  'folder.remoteHint': 'Enter one folder name. Local workspaces use DSH; remote workspaces use SSH mkdir (existing remote directories are reused). Missing SSH never falls back to a local mirror write.',
  'folder.remoteNeedsSubpath': 'Remote workspaces take a subdirectory, not a picked folder',
  'folder.subpathLabel': 'Folder name',
  'folder.subpathPlaceholder': 'e.g. data',
  'folder.addSubpath': 'Create folder',
  'folder.subpathInvalid': 'Invalid path: use a relative path inside the workspace (no absolute paths, no ..)',
  'folder.cloudSection': 'Cloud folders',
  'folder.profileLabel': 'SSH connection',
  'folder.remotePathLabel': 'Remote directory',
  'folder.remotePathPlaceholder': 'e.g. ~/projects/app',
  'folder.remotePathOrName': 'e.g. ~/projects/app, or a new folder name',
  'folder.createAndAdd': 'Create and add',
  'folder.cloudNoteBoth': 'A path creates a new cloud workspace with its local mirror; a bare name creates that directory under this project’s remote root and attaches it',
  'folder.addRemote': 'Add cloud folder',
  'folder.noProfiles': 'No SSH connection available: configure one in the remote-ssh plugin first',
  'folder.profilesError': 'Could not read SSH connections',
  'folder.cloudTag': 'Cloud',
  'folder.localTag': 'Local',
  'folder.memberMissing': 'The standalone workspace behind this folder no longer exists. Remove the folder and add it again.',
  'folder.memberNested': 'That directory is a project with folders of its own, so it cannot join as a folder.',
  'folder.alreadyRoot': 'That is the root of this project, so it cannot join as a folder.',
  'folder.addAria': 'Ways to add a folder',
  'folder.tabLocal': 'Local directory',
  'folder.tabCloud': 'Cloud directory',
  'folder.pickLocal': 'Choose a local directory…',
  'folder.localNote': 'Pick a directory on this machine to use as a folder of this project',
  'folder.localIntoRemote': 'This project lives on the SSH host; a local directory joins it as a local folder',
  'folder.cloudNote': 'Mirrors that remote directory locally and registers a workspace for its sessions',
  'folder.browse': 'Browse…',
  'folder.browseTitle': 'Choose a cloud folder',
  'folder.browseListAria': 'Remote directory list',
  'folder.browseNote': 'Only directories are listed: enter one, then choose the current directory with the button below.',
  'folder.browseFailed': 'Could not read the remote directory',
  'folder.chooseHere': 'Choose this directory',
  'folder.up': 'Up',
  'folder.home': 'Home',
  'folder.refresh': 'Refresh',
  'folder.loading': 'Reading the remote directory…',
  'folder.emptyDir': 'No subdirectories here',
  'group.create': 'New group',
  'group.createTitle': 'New group',
  'group.createPlaceholder': 'Group name',
  'group.createConfirm': 'Create',
  'group.createCancel': 'Cancel',
  'group.rename': 'Rename group',
  'group.renameTitle': 'Rename group',
  'group.renameConfirm': 'Rename',
  'group.delete': 'Delete group',
  'group.deleteTitle': 'Delete group',
  'group.deleteConfirm': 'Deleting removes this group; every project inside it moves to the top level (ungrouped). Delete?',
  'group.deleteCancel': 'Cancel delete',
  'group.nameDuplicate': 'A group with this name already exists',
  'group.nameReserved': 'This name is not available',
  'group.pin': 'Pin group',
  'group.unpin': 'Unpin group',
  'group.pinned': 'Pinned',
  'group.appearance': 'Color & icon…',
  'group.appearanceTitle': 'Group appearance',
  'group.appearanceDone': 'Done',
  'group.color': 'Color',
  'group.colorDefault': 'Default',
  'group.icon': 'Icon',
  'group.iconDefault': 'Default icon',
  'group.iconCustom': 'Custom character',
  'group.iconInvalid': 'Use a preset icon or 1–4 characters',
  'group.icon.section.common': 'Common icons',
  'group.icon.section.lab': 'Lab operations',
  'group.icon.section.materials': 'Material structures',
  'group.icon.section.characterization': 'Characterization',
  'group.icon.section.devices': 'Functional devices',
  'group.icon.section.emoji': 'Emoji',
  'color.red': 'Red',
  'color.orange': 'Orange',
  'color.amber': 'Amber',
  'color.green': 'Green',
  'color.teal': 'Teal',
  'color.blue': 'Blue',
  'color.indigo': 'Indigo',
  'color.purple': 'Purple',
  'color.pink': 'Pink',
  'color.gray': 'Gray',
  'section.topLevel': 'Top-level projects',
  'section.defaultWorkspace': 'Default workspace',
  'manual.saveError': 'Could not save group changes',
  'manual.conflict': 'Groups changed in another window; synced to the latest state, this edit was not saved — please retry',
  'session.new': 'New Session',
  'session.rename': 'Rename session',
  'session.archive': 'Archive',
  'session.fork': 'Fork',
  'session.renameTitle': 'Rename session',
  'session.renamePlaceholder': 'Session name',
  'session.renameConfirm': 'Rename',
  'session.renameCancel': 'Cancel',
  'session.renaming': 'Renaming…',
  'uncategorized': 'Uncategorized',
  'empty.none': 'Nothing here',
  'empty.noWorkspaces': 'No workspaces yet',
  'close': 'Close',
  'cancel': 'Cancel',
  'confirm': 'Confirm',
  'retry': 'Retry',
  'configUnavailable': 'Grouping config unavailable',
  'collapse': 'Collapse',
  'expandMore': 'Show all',
  'newSession': 'New Session',
  'quick.title': 'Quick switch',
  'quick.tab.workspaces': 'Workspaces',
  'quick.tab.sessions': 'All sessions',
  'quick.search.placeholder': 'Search workspaces…',
  'quick.search.sessions': 'Search sessions…',
  'quick.empty.workspaces': 'No matching workspaces',
  'quick.action.newSession': 'New Session',
  'quick.action.running': 'Switch to running session',
  'quick.action.noneRunning': 'No running session',
  'quick.empty.sessions': 'No sessions yet',
  'quick.select.hint': 'Pick a workspace above',
  'quick.hint': 'Ctrl+R toggle · Enter open/new · Esc close',
  'tabs.aria': 'Open sessions',
  'tabs.close': 'Close tab',
  'tabs.archive': 'Archive',
  'tabs.pin': 'Pin tab',
  'tabs.unpin': 'Unpin tab',
  'tabs.pinned': 'Pinned (kept by Close others)',
  'tabs.rename': 'Rename tab',
  'tabs.renameSession': 'Rename session…',
  'tabs.renamePlaceholder': 'Tab name — blank restores the session title',
  'tabs.closeOthers': 'Close other tabs',
  'tabs.closeRight': 'Close tabs to the right',
  'tabs.dragHint': 'Drag to reorder',
}
