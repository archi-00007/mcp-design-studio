// 一键生成交付物：release/mcp-design-studio.html（单文件、可双击打开）
//
// 用法：
//   npm run release                 # 完整流程：类型检查 + vite 构建 + 内联 + 渲染自检
//   node scripts/build-singlefile.mjs --no-build    # 跳过构建，只重新内联现有 dist
//   node scripts/build-singlefile.mjs --no-verify   # 跳过浏览器渲染自检（无浏览器环境）
//
// 这个脚本承担两件事，缺一不可：
//   1) 把 dist 的 JS/CSS 内联进一个 HTML；
//   2) 用无头浏览器真实打开它，确认页面真的渲染出来了。
// 第 2 步是 2026-10-19 的教训：只 grep 产物里的中文文案会命中"内联在 JS 源码里的字符串"，
// 白屏也能通过，属于假阳性。必须只看 #root 之内的真实 DOM。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'

const args = new Set(process.argv.slice(2))
const skipBuild = args.has('--no-build')
const skipVerify = args.has('--no-verify')

const root = process.cwd()
const distDir = path.join(root, 'dist')
const outDir = path.join(root, 'release')
const outFile = path.join(outDir, 'mcp-design-studio.html')

const log = (msg = '') => console.log(msg)
const step = (n, total, msg) => log(`\n[${n}/${total}] ${msg}`)

// ---------------------------------------------------------------- 运行环境
// 项目常在 WSL 里开发。WSL 的 /usr/bin 下没有浏览器，但可以直接调起 Windows
// 侧的 Chrome / Edge，只是传给它的文件和 profile 路径必须是盘符形式。
// 若互操作被禁用（exec 报 EACCES），验证降级为 SKIP 而不是失败——不能因为
// 环境限制把好产物判死。
const wsl = (() => {
  try {
    return /microsoft|wsl/i.test(fs.readFileSync('/proc/version', 'utf8'))
  } catch {
    return false
  }
})()

function wslPath(flag, p) {
  const res = spawnSync('wslpath', [flag, p], { encoding: 'utf8' })
  if (res.status === 0 && res.stdout.trim()) return res.stdout.trim()
  const win = /^([A-Za-z]):\\(.*)$/.exec(p)
  if (win) return `/mnt/${win[1].toLowerCase()}/` + win[2].replace(/\\/g, '/')
  const posix = /^\/mnt\/([a-z])\/(.*)$/i.exec(p)
  if (posix) return `${posix[1].toUpperCase()}:\\` + posix[2].replace(/\//g, '\\')
  return p
}

function windowsTempDir() {
  const res = spawnSync('cmd.exe', ['/c', 'echo %TEMP%'], { encoding: 'utf8', timeout: 15000 })
  const out = (res.stdout || '').trim()
  return res.status === 0 && /^[A-Za-z]:\\/.test(out) ? out.replace(/\\+$/, '') : 'C:\\Windows\\Temp'
}

function wslBrowserCandidates() {
  const list = []
  for (const base of ['/mnt/c/Program Files', '/mnt/c/Program Files (x86)']) {
    list.push(path.join(base, 'Google/Chrome/Application/chrome.exe'))
    list.push(path.join(base, 'Microsoft/Edge/Application/msedge.exe'))
  }
  try {
    for (const user of fs.readdirSync('/mnt/c/Users')) {
      list.push(path.join('/mnt/c/Users', user, 'AppData/Local/Google/Chrome/Application/chrome.exe'))
      list.push(path.join('/mnt/c/Users', user, 'AppData/Local/Microsoft/Edge/Application/msedge.exe'))
    }
  } catch {
    // 读不到 /mnt/c/Users 就算了，交给调用方判定 SKIP
  }
  return list
}

// ---------------------------------------------------------------- 1) 构建
step(1, 4, skipBuild ? '跳过构建（--no-build），直接使用现有 dist' : '类型检查 + 构建（npm run build）')
if (!skipBuild) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const res = spawnSync(npm, ['run', 'build'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (res.status !== 0) {
    console.error('\n构建失败，已中止。上面是 tsc / vite 的原始报错。')
    process.exit(res.status ?? 1)
  }
}

const indexPath = path.join(distDir, 'index.html')
if (!fs.existsSync(indexPath)) throw new Error('找不到 dist/index.html，请先执行 npm run build')

// ---------------------------------------------------------------- 2) 内联
step(2, 4, '内联 JS / CSS')
let html = fs.readFileSync(indexPath, 'utf8')

// vite 把 <script type="module"> 放在 <head>。module 天然 defer，所以原本安全；
// 内联成普通 <script> 后不再 defer，留在 head 会在 #root 解析前执行，
// createRoot(null) 直接抛 React #299。因此必须把脚本移到 </body> 之前。
let jsCode = null
html = html.replace(
  /<script[^>]*src="\.\/assets\/([^"]+\.js)"[^>]*><\/script>\s*/,
  (_m, file) => {
    const code = fs.readFileSync(path.join(distDir, 'assets', file), 'utf8')
    if (code.includes('</script')) throw new Error('bundle 含 </script，无法安全内联')
    jsCode = code
    return ''
  },
)
if (jsCode === null) throw new Error('未找到外部 JS 引用，dist 结构可能已变化')

html = html.replace(
  /<link[^>]*rel="stylesheet"[^>]*href="\.\/assets\/([^"]+\.css)"[^>]*>/,
  (_m, file) => {
    const css = fs.readFileSync(path.join(distDir, 'assets', file), 'utf8')
    if (css.includes('</style')) throw new Error('CSS 含 </style，无法安全内联')
    return `<style>\n${css}\n</style>`
  },
)

// 必须用函数式替换：替换串里的 `$&`、`$'`、$`、`$1` 会被 String.replace 当成替换模式
// 展开，而 minified 代码里确实存在 `$&` 这类序列，会污染代码（曾导致 bundle 被截断）。
if (!html.includes('</body>')) throw new Error('未找到 </body>')
html = html.replace('</body>', () => `  <script>\n${jsCode}\n  </script>\n  </body>`)

// ---------------------------------------------------------------- 3) 静态自检
step(3, 4, '静态自检')
const leftovers = html.match(/\.\/assets\/[^"']+/g)
if (leftovers) throw new Error('仍存在外部资源引用: ' + leftovers.join(', '))

const bodyAt = html.indexOf('<body')
const rootAt = html.indexOf('<div id="root">')
const scriptAt = html.indexOf('<script>')
if (scriptAt < 0 || bodyAt < 0 || rootAt < 0) throw new Error('结构自检失败：缺少 body / root / script')
if (scriptAt < bodyAt) throw new Error('脚本仍在 <body> 之前，会在 #root 存在前执行')
if (scriptAt < rootAt) throw new Error('脚本早于 #root，createRoot 会拿到 null')
if (!html.includes(jsCode)) throw new Error('内联后的脚本与原始 bundle 不一致（代码被替换模式或转义污染）')

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(outFile, html, 'utf8')
log(`    OK  已写入 ${path.relative(root, outFile)}`)
log(`    OK  无外部 assets 引用；脚本位于 #root 之后；内联内容与 bundle 逐字节一致`)

// ---------------------------------------------------------------- 4) 渲染自检
step(4, 4, '无头浏览器渲染自检')

function findBrowser() {
  const candidates =
    process.platform === 'win32'
      ? [
          path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
          path.join(process.env.ProgramFiles || '', 'Google/Chrome/Application/chrome.exe'),
          path.join(process.env['ProgramFiles(x86)'] || '', 'Google/Chrome/Application/chrome.exe'),
          path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
          path.join(process.env.ProgramFiles || '', 'Microsoft/Edge/Application/msedge.exe'),
        ]
      : process.platform === 'darwin'
        ? [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
          ]
        : [
            ...['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
            ...(wsl ? wslBrowserCandidates() : []),
          ]
  return candidates.find((p) => p && fs.existsSync(p)) || null
}

function verifyRender(file) {
  const browser = findBrowser()
  if (!browser) return { skipped: true, reason: '未找到 Chrome / Edge' }

  // Windows 侧浏览器只认盘符路径，Linux 浏览器只认 /mnt 路径，二者不能混用
  const winExe = /\.exe$/i.test(browser)
  const target = winExe ? wslPath('-w', file) : file
  const fileUrl = 'file:///' + target.replace(/\\/g, '/')
  const stamp = Date.now()
  const profile = winExe ? `${windowsTempDir()}\\mds-verify-${stamp}` : path.join(os.tmpdir(), `mds-verify-${stamp}`)
  const profilePath = winExe ? wslPath('-u', profile) : profile

  let res
  try {
    res = spawnSync(
      browser,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--no-first-run',
        `--user-data-dir=${profile}`,
        '--virtual-time-budget=15000',
        '--dump-dom',
        fileUrl,
      ],
      { encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024 },
    )
  } finally {
    fs.rmSync(profilePath, { recursive: true, force: true })
  }

  if (res.error) {
    // 环境不让执行（沙箱 / 互操作关闭）不算产物有问题
    if (['EACCES', 'EPERM', 'ENOEXEC'].includes(res.error.code)) {
      return { skipped: true, reason: `当前环境不允许执行 ${path.basename(browser)}（${res.error.code}）` }
    }
    return { ok: false, reason: `浏览器启动失败：${res.error.message}` }
  }

  const dom = res.stdout || ''
  if (!dom.trim()) {
    return { ok: false, reason: `浏览器没有输出 DOM（exit=${res.status}）${(res.stderr || '').slice(0, 300)}` }
  }
  const rootIdx = dom.indexOf('id="root"')
  if (rootIdx < 0) return { ok: false, reason: 'DOM 里没有 #root 容器' }
  const scriptIdx = dom.indexOf('<script', rootIdx)
  // 只看 #root 与内联 <script> 之间这一段：这才是真正渲染出来的 DOM。
  // 不能在整个 dom 上搜关键词——内联的 React 产物本身含有 "Minified React error" 这类字面量，
  // 会把好文件误判成坏文件（2026-10-19 就踩过一次反向的假阳性）。
  const rendered = dom.slice(rootIdx, scriptIdx < 0 ? undefined : scriptIdx)

  if (rendered.length < 500) {
    return { ok: false, reason: `#root 内几乎为空（${rendered.length} 字节），页面大概率白屏` }
  }
  if (/Minified React error|error-decoder/.test(rendered)) {
    return { ok: false, reason: '渲染出的 DOM 里出现 React 报错文案（渲染阶段崩溃）' }
  }
  if (/Uncaught|CONSOLE.*ERROR/i.test(res.stderr || '') && rendered.length < 5000) {
    return { ok: false, reason: `控制台有未捕获异常：${(res.stderr || '').slice(0, 300)}` }
  }
  for (const keyword of ['工具列表', 'Server 设置']) {
    if (!rendered.includes(keyword)) {
      return { ok: false, reason: `#root 内缺少侧栏文案「${keyword}」，渲染不完整` }
    }
  }
  return { ok: true, browser: path.basename(browser), bytes: Buffer.byteLength(rendered) }
}

if (skipVerify) {
  log('    SKIP 跳过渲染自检（--no-verify）')
} else {
  const result = verifyRender(outFile)
  if (result.skipped) {
    log(`    SKIP ${result.reason}，未能验证渲染结果。请手动双击打开确认。`)
  } else if (!result.ok) {
    console.error(`    FAIL ${result.reason}`)
    console.error('    产物已写出但验证未通过，不要发给别人。')
    process.exit(1)
  } else {
    log(`    OK  ${result.browser} 以 file:// 打开渲染正常，#root 内 ${result.bytes} 字节`)
  }
}

// ---------------------------------------------------------------- 汇总
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const buffer = fs.readFileSync(outFile)
const sha = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 12)

log('\n────────────────────────────────────────────')
log('交付物已生成')
log(`  文件   ${outFile}`)
log(`  大小   ${(buffer.length / 1024).toFixed(1)} KB`)
log(`  版本   v${pkg.version}`)
log(`  指纹   ${sha}（发给别人时可用它核对是不是同一版）`)
log(`  时间   ${new Date().toLocaleString('zh-CN')}`)
log('────────────────────────────────────────────')
log('注意：单文件版的数据存在各人自己的浏览器里，与本机 dev 环境不互通；')
log('      交接内容请走「导出 IR → 对方导入」。')
