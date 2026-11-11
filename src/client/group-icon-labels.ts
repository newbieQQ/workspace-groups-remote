import type { GroupIconId } from '../core/types.ts'

/** Bilingual accessible names also make native browser tooltips recognizable in either locale. */
export const GROUP_ICON_LABELS: Record<GroupIconId, string> = {
  folder: '文件夹 / Folder', workspace: '工作区 / Workspace', code: '代码 / Code',
  plugin: '插件 / Plugin', skill: '技能 / Skill', data: '数据 / Data',
  database: '数据库 / Database', api: '接口 / API', plan: '计划 / Plan',
  goal: '目标 / Goal', light: '日光 / Sun', globe: '全球 / Globe',
  archive: '归档 / Archive', branch: '分支 / Branch', users: '团队 / Team',
  clock: '时间 / Clock', shield: '安全 / Security', checklist: '清单 / Checklist',
  sparkle: '灵感 / Sparkle', tree: '层级 / Tree',
  chat: '对话 / Chat', search: '搜索 / Search', settings: '设置 / Settings',
  document: '文档 / Document', edit: '编辑 / Edit', think: '思考 / Think',
  agent: '智能体 / Agent', browse: '浏览 / Browse', context: '上下文 / Context',
  link: '链接 / Link', share: '分享 / Share', user: '个人 / Personal',
  send: '发送 / Send', attachment: '附件 / Attachment', download: '下载 / Download',
  play: '运行 / Run', design: '设计 / Design', moon: '夜间 / Moon',
  monitor: '桌面 / Desktop', gauge: '性能 / Performance', queue: '队列 / Queue',
  notes: '笔记 / Notes', inspect: '检查 / Inspect', help: '帮助 / Help',
  info: '信息 / Information', alarm: '提醒 / Reminder', compare: '对比 / Compare',
  done: '完成 / Done', pin: '重点 / Pin', microphone: '语音 / Voice',
  // Materials & Lab family
  'test-tube': '试管 / Test tube', flask: '烧瓶 / Flask', pipette: '移液枪 / Pipette',
  dropper: '滴液 / Dropper', stirrer: '磁力搅拌 / Magnetic stirrer', hotplate: '加热台 / Hot plate',
  centrifuge: '离心机 / Centrifuge', balance: '电子天平 / Balance',
  atom: '原子 / Atom', molecule: '分子 / Molecule', lattice: '晶格 / Crystal lattice',
  layered: '层状材料 / Layered material', framework: '多孔框架 / Porous framework',
  'thin-film': '薄膜 / Thin film', fiber: '纤维 / Fiber', hydrogel: '水凝胶 / Hydrogel',
  microscope: '显微镜 / Microscope', xrd: 'XRD 衍射峰 / XRD pattern', spectrum: '光谱 / Spectrum',
  tensile: '拉伸测试 / Tensile test', electrode: '电极 / Electrode', 'iv-curve': '电学曲线 / I–V curve',
  illumination: '光照 / Illumination', temperature: '温度 / Temperature', humidity: '湿度 / Humidity',
  actuator: '弯曲驱动器 / Bending actuator', 'flex-sensor': '柔性传感器 / Flexible sensor',
  battery: '电池 / Battery',
}

/** All presets satisfy the existing host's 1–4 Unicode-code-point custom-glyph rule. */
export const GROUP_EMOJI_ICONS = [
  { icon: '🚀', label: '启动 / Launch' },
  { icon: '📚', label: '学习 / Learning' },
  { icon: '🔬', label: '科研 / Research' },
  { icon: '🧪', label: '实验 / Experiment' },
  { icon: '🎨', label: '创作 / Art' },
  { icon: '🎯', label: '目标 / Target' },
  { icon: '💡', label: '想法 / Idea' },
  { icon: '🛠️', label: '工具 / Tools' },
  { icon: '🌱', label: '成长 / Growth' },
  { icon: '🏠', label: '生活 / Home' },
  { icon: '💼', label: '工作 / Work' },
  { icon: '🎮', label: '游戏 / Games' },
  { icon: '🎵', label: '音乐 / Music' },
  { icon: '❤️', label: '收藏 / Favorites' },
  { icon: '⭐', label: '星标 / Star' },
  { icon: '🔥', label: '热门 / Hot' },
] as const
