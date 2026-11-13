/**
 * Remote-SSH settings dictionary.
 *
 * The section registers its OWN namespace `dsh-remote-ssh-settings` through
 * the shell locale service (the merged client entry calls
 * {@link registerSettingsLocale} inside `ctx.effect`). Registering a separate
 * namespace — instead of appending keys to the vendored plugin's
 * `dsh-remote-ssh` dictionaries at build time — keeps all new copy in source,
 * type-checked by the `SettingsKey` union, and lets the slot machinery inject
 * a typed `t` seat into the component (declared as `locale:` in the slot
 * registration). Existing upstream keys/namespace are untouched.
 */
import type { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client';
/** Namespace owned by this settings face. */
export declare const SETTINGS_NS = "dsh-remote-ssh-settings";
/** Chinese dictionary — the key set below is the single source of truth. */
export declare const zh: {
    readonly 'page.title': "Remote SSH";
    readonly 'page.subtitle': "管理远程连接与同步设置";
    readonly 'connection.sectionTitle': "我的连接";
    readonly 'connection.sectionSummary': "测试连接、查看当前连接的诊断信息";
    readonly 'connection.count': "{n} 个连接";
    readonly 'connection.empty': "还没有连接配置。在下方「添加连接」中新增。";
    readonly 'connection.test': "测试连接";
    readonly 'connection.testing': "测试中…";
    readonly 'connection.delete': "删除";
    readonly 'connection.authKey': "密钥认证";
    readonly 'connection.authPassword': "密码认证";
    readonly 'connection.passwordConfigured': "已保存密码";
    readonly 'connection.testOk': "连接成功";
    readonly 'connection.testWarn': "连接成功，但有警告：";
    readonly 'connection.testFail': "连接失败";
    readonly 'connection.diagnostics': "诊断输出";
    readonly 'connection.deleteTitle': "删除连接「{name}」？";
    readonly 'connection.deleteBody': "将同时移除该连接下的远程工作区条目和本地镜像映射；不会删除服务器上的文件。";
    readonly 'connection.deleted': "已删除连接「{name}」";
    readonly 'connection.deleteFail': "删除失败";
    readonly 'add.sectionTitle': "添加连接";
    readonly 'add.sectionSummary': "从系统 SSH 配置导入，或手动填写";
    readonly 'add.import': "从系统 SSH 配置导入…";
    readonly 'add.divider': "或手动添加";
    readonly 'add.name': "名称";
    readonly 'add.namePlaceholder': "如：我的超算";
    readonly 'add.host': "主机";
    readonly 'add.hostPlaceholder': "login.example.com";
    readonly 'add.port': "端口";
    readonly 'add.user': "用户名";
    readonly 'add.userPlaceholder': "your-username";
    readonly 'add.auth': "认证方式";
    readonly 'add.authKey': "SSH 密钥";
    readonly 'add.authPassword': "密码";
    readonly 'add.keyPath': "私钥路径";
    readonly 'add.keyPathPlaceholder': "~/.ssh/id_rsa（留空则使用 ssh-agent 或 SSH 配置）";
    readonly 'add.password': "密码";
    readonly 'add.passwordPlaceholder': "输入密码（不会写回浏览器存储）";
    readonly 'add.remoteRoot': "远程根目录";
    readonly 'add.remoteRootPlaceholder': "~/project";
    readonly 'add.moreOptions': "更多连接选项";
    readonly 'add.moreOptionsSummary': "跳板机 ProxyJump";
    readonly 'add.proxyJump': "跳板机 ProxyJump";
    readonly 'add.proxyJumpPlaceholder': "bastion.example.com";
    readonly 'add.submit': "添加连接";
    readonly 'add.submitting': "添加中…";
    readonly 'add.errHost': "请填写主机";
    readonly 'add.errUser': "请填写用户名";
    readonly 'add.errPort': "端口必须是 1–65535 的整数";
    readonly 'add.ok': "已添加连接「{name}」";
    readonly 'add.fail': "添加失败";
    readonly 'import.title': "从系统 SSH 配置导入";
    readonly 'import.loading': "正在读取 ~/.ssh/config…";
    readonly 'import.readFail': "读取 ~/.ssh/config 失败";
    readonly 'import.empty': "未在 ~/.ssh/config 中发现可用主机";
    readonly 'import.note': "仅列出 ~/.ssh/config 中带 HostName 的条目；这不是完整的 OpenSSH 配置语义。";
    readonly 'import.selectAll': "全选";
    readonly 'import.clearAll': "取消全选";
    readonly 'import.selectedCount': "已选 {n} / {total}";
    readonly 'import.submit': "导入所选连接";
    readonly 'import.importing': "导入中…（{done}/{total}）";
    readonly 'import.progress': "正在导入「{name}」…";
    readonly 'import.resultAllOk': "已导入 {ok} 个连接";
    readonly 'import.resultPartial': "成功 {ok} 个，失败 {fail} 个";
    readonly 'import.resultAllFail': "全部失败（{fail} 个）";
    readonly 'import.failedIntro': "以下主机未导入：";
    readonly 'import.noResult': "保存接口未返回结果";
    readonly 'import.retryFailed': "仅重试失败项（{n}）";
    readonly 'import.retrying': "重试中…（{done}/{total}）";
    readonly 'import.noneSelected': "请至少选择一个主机";
    readonly 'import.proxyJump': "跳板机 {target}";
    readonly 'import.close': "关闭";
    readonly 'import.authNote': "导入的连接固定使用密钥认证、远程根目录 ~；可在手动表单中补充密码或其它字段。";
    readonly 'workspace.sectionTitle': "远程工作区";
    readonly 'workspace.sectionSummary': "独立写回与同步配置";
    readonly 'workspace.empty': "还没有远程工作区。可在「添加工作区」中选择「远程目录」创建。";
    readonly 'workspace.expand': "展开配置";
    readonly 'workspace.collapse': "收起配置";
    readonly 'workspace.connection': "所属连接";
    readonly 'workspace.remotePath': "远程路径";
    readonly 'workspace.writeBack': "启用写回（把 agent 的 write/edit 同步到远端）";
    readonly 'workspace.writeBackExclude': "写回排除（逗号或换行分隔）";
    readonly 'workspace.writeBackExcludeHint': "这些路径的本地改动不会推回远端，例如 _patch/, *.log。";
    readonly 'workspace.syncPaths': "同步范围（逗号或换行分隔，留空 = 整树）";
    readonly 'workspace.syncPathsHint': "只同步这些子路径，例如 .dsh；留空 = 整树。";
    readonly 'workspace.syncExclude': "同步排除（逗号或换行分隔）";
    readonly 'workspace.syncExcludeHint': "拉取和推送时跳过这些路径，例如 data/, *.log；与写回排除用途不同。";
    readonly 'workspace.syncMaxBytes': "同步体积上限（GiB，留空 = 默认 2 GiB）";
    readonly 'workspace.unsaved': "未保存";
    readonly 'workspace.save': "保存该工作区设置";
    readonly 'workspace.saving': "保存中…";
    readonly 'workspace.saved': "该工作区设置已保存";
    readonly 'workspace.saveFail': "保存失败";
    readonly 'workspace.syncBlocked': "有未保存的设置，请先保存再拉取或推送。";
    readonly 'workspace.syncDown': "拉取";
    readonly 'workspace.syncUp': "推送";
    readonly 'workspace.syncing': "拉取中…";
    readonly 'workspace.pushing': "推送中…";
    readonly 'workspace.syncDone': "拉取完成";
    readonly 'workspace.syncFail': "拉取失败";
    readonly 'workspace.pushDone': "推送完成";
    readonly 'workspace.pushFail': "推送失败";
    readonly 'workspace.deleteTitle': "移除远程工作区「{title}」？";
    readonly 'workspace.deleteBody': "只移除本地记录与镜像映射，不会删除服务器上的目录或文件。";
    readonly 'workspace.deleted': "已移除远程工作区「{title}」";
    readonly 'workspace.deleteFail': "删除失败";
    readonly 'workspace.unknownProfile': "未知连接";
    readonly 'advanced.sectionTitle': "高级设置";
    readonly 'advanced.sectionSummary': "终端与写回、新工作区同步默认值";
    readonly 'advanced.terminalGroup': "终端与写回";
    readonly 'advanced.nodePath': "Node 绝对路径";
    readonly 'advanced.nodePathHint': "终端起不来时填写；留空自动解析。";
    readonly 'advanced.nodePathPlaceholder': "C:\\Program Files\\nodejs\\node.exe";
    readonly 'advanced.writeBackFailure': "写回推送失败时";
    readonly 'advanced.wbError': "让模型看见，工具报错";
    readonly 'advanced.wbLog': "只写日志";
    readonly 'advanced.writeBackFreshness': "推送前检查远端是否被改过（发现被改过就不推并报告）";
    readonly 'advanced.syncDefaultsGroup': "新工作区同步默认值";
    readonly 'advanced.syncDefaultsHint': "仅影响之后新建的远程工作区，不会覆盖已有工作区的独立设置。";
    readonly 'advanced.defaultSyncPaths': "默认同步范围（逗号或换行分隔，留空 = 整树）";
    readonly 'advanced.defaultSyncExclude': "默认同步排除（逗号或换行分隔）";
    readonly 'advanced.defaultSyncMaxBytes': "默认同步体积上限（GiB，留空 = 内置 2 GiB）";
    readonly 'advanced.save': "保存设置";
    readonly 'advanced.saving': "保存中…";
    readonly 'advanced.saved': "设置已保存";
    readonly 'advanced.saveFail': "保存失败";
    readonly 'common.cancel': "取消";
    readonly 'common.close': "关闭";
    readonly 'common.confirmDelete': "确认删除";
    readonly 'common.retry': "重试";
    readonly 'common.loading': "加载中…";
    readonly 'common.save': "保存";
    readonly 'common.error': "错误：";
    readonly 'common.warning': "警告：";
    readonly 'common.unknownError': "未知错误";
    readonly 'common.expand': "展开";
    readonly 'common.collapse': "收起";
};
/** Chinese key set; every call site is checked against it. */
export type SettingsKey = keyof typeof zh;
/** English dictionary — complete mirror of the Chinese key set. */
export declare const en: Record<SettingsKey, string>;
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        'dsh-remote-ssh-settings': SettingsKey;
    }
}
/**
 * Register both dictionaries for this namespace on the shell locale service.
 * Call inside `ctx.effect(...)` so the registration is disposed with the
 * plugin fiber. The typed `register` overload enforces zh/en key parity.
 */
export declare function registerSettingsLocale(locale: LocaleRuntime): () => void;
