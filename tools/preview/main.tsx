/**
 * Entry of the ISOLATED Remote-SSH settings preview.
 *
 * Renders the REAL built section (`src/client/rssh-settings/index.tsx` →
 * `createSettingsSection({ api })`) under a stand-in DSH settings panel,
 * against the fake `/remote-ssh/api` layer. Nothing here touches the running
 * DSH GUI, the daily profile or node_modules.
 *
 * URL query:
 *   ?scene=default|expanded|import-ready|import-partial|workspaces|password|test-failure
 *   &theme=light|dark
 *   &width=narrow   (viewport width is still set by the screenshot script)
 */
import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { createSettingsSection } from '#rssh-settings'
import { SETTINGS_CSS } from '../../src/client/rssh-settings/styles.ts'
import previewCss from './preview.css?inline'
import { createFakeApi, isPreviewScene } from './fake-api.ts'
import { EXPECTED_MOUNT_TEXT, makeT } from './translate.ts'
import type { PreviewScene } from './fake-api.ts'

const params = new URLSearchParams(window.location.search)
const sceneParam = params.get('scene') || 'default'
const scene: PreviewScene = isPreviewScene(sceneParam) ? sceneParam : 'default'
const theme = params.get('theme') === 'dark' ? 'dark' : 'light'
const width = params.get('width') === 'narrow' ? 'narrow' : 'wide'

document.documentElement.dataset.theme = theme
document.documentElement.dataset.width = width
document.documentElement.dataset.previewScene = scene
document.documentElement.dataset.isolatedPreview = '1'

// The real section only ships CSS as a string (`styles.ts`); the shell normally
// injects it beside the vendored client's stylesheet. The preview stands in for
// that shell injection, then adds its own panel/token styles afterwards.
const settingsStyle = document.createElement('style')
settingsStyle.id = 'rssh-settings-css'
settingsStyle.textContent = SETTINGS_CSS
document.head.appendChild(settingsStyle)

const style = document.createElement('style')
style.id = 'preview-shell-css'
style.textContent = previewCss
document.head.appendChild(style)

const previewWindow = window as unknown as Record<string, unknown>
previewWindow.__RSH_PREVIEW_SCENE__ = scene
previewWindow.__RSH_PREVIEW_THEME__ = theme
previewWindow.__RSH_PREVIEW_WIDTH__ = width
previewWindow.__RSH_PREVIEW_EXPECTED_TEXT__ = EXPECTED_MOUNT_TEXT

const api = createFakeApi(scene)
const t = makeT()

let SettingsSection: ReturnType<typeof createSettingsSection> | null = null
let createError = ''
try {
  SettingsSection = createSettingsSection({ api })
} catch (error) {
  createError = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  console.error('[preview] createSettingsSection threw', error)
}

const sceneLabel: Record<PreviewScene, string> = {
  default: '默认（高级设置收起）',
  expanded: '全部展开',
  'import-ready': '导入弹窗（全部可导入）',
  'import-partial': '导入部分失败',
  workspaces: '远程工作区配置',
  password: '密码认证表单',
  'test-failure': '连接测试失败',
}

function PreviewApp() {
  useEffect(() => {
    const markReady = (): void => {
      previewWindow.__RSH_PREVIEW_READY__ = true
      document.documentElement.dataset.previewReady = '1'
    }
    const afterFonts = (): void => {
      requestAnimationFrame(() => requestAnimationFrame(markReady))
    }
    const fonts = (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts
    if (fonts?.ready) {
      fonts.ready.then(afterFonts).catch(afterFonts)
    } else {
      setTimeout(afterFonts, 0)
    }
  }, [])

  return (
    <div className="preview-page">
      <div className="preview-shell">
        <header className="preview-banner" data-preview-banner="isolated">
          <span className="preview-banner__tag">隔离预览</span>
          <span className="preview-banner__text">
            真实组件 + 本地假 API 渲染 · 未接入当前 DSH GUI、未修改 daily profile · 场景：
            {sceneLabel[scene]} · 主题：{theme === 'dark' ? '深色' : '浅色'} · 宽度：{width === 'narrow' ? '窄屏' : '宽屏'}
          </span>
        </header>

        <main className="preview-panel" aria-label="DSH 设置面板容器（预览替身）">
          <div className="preview-panel__bar">
            <span className="preview-panel__crumb">设置 / 插件 / Remote SSH</span>
            <span className="preview-panel__chip">隔离预览容器</span>
          </div>
          <div className="preview-panel__body" id="settings-mount">
            {createError ? (
              <div role="alert" className="preview-fallback" data-preview-create-error="1">
                <h1>组件创建失败</h1>
                <p>{createError}</p>
              </div>
            ) : SettingsSection ? (
              <SettingsSection t={t} />
            ) : null}
          </div>
        </main>

        <footer className="preview-footer">
          本页为隔离预览：数据全部来自 tools/preview/fake-api.ts，仅用于视觉核对；不含真实密码、私钥或真实主机凭据，不写入任何浏览器存储。
        </footer>
      </div>
    </div>
  )
}

createRoot(document.getElementById('preview-root') as HTMLElement).render(<PreviewApp />)
