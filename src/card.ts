import { formatNumber, formatPercent, formatSigned, monthLabel, resample, topShare } from './format.js'
import type { Wrapped } from './wrapped.js'

const COLORS = {
  background: '#1b1c21',
  tile: '#25272e',
  tileBorder: '#32353d',
  coral: '#ff6150',
  lime: '#c6f24e',
  gray: '#8b8f9e',
  soft: '#b9bcc8',
  white: '#f0f1f5',
}

const DISPLAY = `font-family="'Space Grotesk', 'Segoe UI', Arial, sans-serif"`
const MONO = `font-family="'JetBrains Mono', Consolas, Menlo, monospace"`

const escapeXml = (text: string): string =>
  text.replace(/[<>&'"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character] ?? character)

function fitText(text: string, maxWidth: number, maxSize: number, minSize: number, charWidth: number): { text: string; size: number } {
  const size = Math.max(minSize, Math.min(maxSize, maxWidth / (Math.max(1, text.length) * charWidth)))
  const maxChars = Math.floor(maxWidth / (size * charWidth))
  return { text: text.length > maxChars ? text.slice(0, Math.max(1, maxChars - 1)) + '…' : text, size: Math.round(size * 10) / 10 }
}

function weeklyBars(weekly: number[], x: number, y: number, width: number, height: number, count: number): string {
  const values = resample(weekly, count)
  if (values.length === 0) return ''
  const max = Math.max(...values, 1)
  const gap = 3
  const barWidth = (width - gap * (values.length - 1)) / values.length
  return values
    .map((value, index) => {
      const barHeight = Math.max(2, (value / max) * height)
      const opacity = 0.35 + (0.65 * (index + 1)) / values.length
      return `<rect x="${(x + index * (barWidth + gap)).toFixed(1)}" y="${(y + height - barHeight).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="1.5" fill="${COLORS.lime}" fill-opacity="${opacity.toFixed(2)}"/>`
    })
    .join('')
}

const label = (x: number, y: number, text: string): string =>
  `<text x="${x}" y="${y}" ${MONO} font-size="10.5" letter-spacing="1.6" fill="${COLORS.gray}">${escapeXml(text.toUpperCase())}</text>`

const tile = (x: number, y: number, width: number, height: number): string =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="14" fill="${COLORS.tile}" stroke="${COLORS.tileBorder}"/>`

export function renderCard(wrapped: Wrapped): string {
  const width = 540
  const height = 675
  const top = wrapped.packages[0]
  const total = fitText(formatNumber(wrapped.total), 180, 40, 18, 0.6)
  const topName = fitText(top && wrapped.total > 0 ? top.name : 'none yet', 180, 26, 14, 0.56)
  const user = fitText(`@${wrapped.username}`, 220, 12.5, 9, 0.6)
  const growth = wrapped.weeklyGrowth === null ? 'n/a' : formatSigned(wrapped.weeklyGrowth)

  const tileWidth = 220
  const tileHeight = 263
  const left = 40
  const right = 280
  const rowOne = 92
  const rowTwo = rowOne + tileHeight + 20
  const value = (y: number) => y + tileHeight - 50
  const sub = (y: number) => y + tileHeight - 26

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="${COLORS.background}"/>
<text x="40" y="58" ${MONO} font-size="12.5" font-weight="700" fill="${COLORS.lime}">npm wrapped <tspan font-weight="400" fill="${COLORS.gray}">${wrapped.year}</tspan></text>
<text x="500" y="58" ${MONO} font-size="${user.size}" text-anchor="end" fill="${COLORS.gray}">${escapeXml(user.text)}</text>
${tile(left, rowOne, tileWidth, tileHeight)}
${label(left + 20, rowOne + 30, 'total downloads')}
<text x="${left + 18}" y="${value(rowOne)}" ${DISPLAY} font-size="${total.size}" font-weight="700" letter-spacing="-1" fill="${COLORS.coral}">${total.text}</text>
<text x="${left + 20}" y="${sub(rowOne)}" ${DISPLAY} font-size="12.5" font-weight="500" fill="${COLORS.soft}">${monthLabel(wrapped.start)} to ${monthLabel(wrapped.end)}</text>
${tile(right, rowOne, tileWidth, tileHeight)}
${label(right + 20, rowOne + 30, 'top package')}
<text x="${right + 20}" y="${value(rowOne)}" ${DISPLAY} font-size="${topName.size}" font-weight="700" fill="${COLORS.white}">${escapeXml(topName.text)}</text>
<text x="${right + 20}" y="${sub(rowOne)}" ${DISPLAY} font-size="12.5" font-weight="500" fill="${COLORS.soft}">${top && wrapped.total > 0 ? `${formatPercent(topShare(wrapped))} of all downloads` : 'no downloads yet'}</text>
${tile(left, rowTwo, tileWidth, tileHeight)}
${label(left + 20, rowTwo + 30, 'weekly growth')}
${weeklyBars(wrapped.weekly, left + 20, rowTwo + 60, 180, 100, 26)}
<text x="${left + 20}" y="${value(rowTwo)}" ${DISPLAY} font-size="26" font-weight="700" fill="${COLORS.lime}">${growth}</text>
<text x="${left + 20}" y="${sub(rowTwo)}" ${DISPLAY} font-size="12.5" font-weight="500" fill="${COLORS.soft}">average every week</text>
${tile(right, rowTwo, tileWidth, tileHeight)}
${label(right + 20, rowTwo + 30, 'packages')}
<text x="${right + 18}" y="${value(rowTwo)}" ${DISPLAY} font-size="40" font-weight="700" letter-spacing="-1" fill="${COLORS.white}">${wrapped.packages.length}</text>
<text x="${right + 20}" y="${sub(rowTwo)}" ${DISPLAY} font-size="12.5" font-weight="500" fill="${COLORS.soft}">public ${wrapped.packages.length === 1 ? 'package' : 'packages'}</text>
</svg>
`
}

export function renderPreviewPage(svg: string, fileName: string): string {
  const source = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>npm wrapped</title>
<style>
body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;background:#050608;font-family:Consolas,Menlo,monospace;color:#8b8f9e;padding:24px;box-sizing:border-box}
img{width:min(540px,100%);height:auto;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.6)}
button{font:inherit;font-weight:700;background:#c6f24e;color:#0b0c0f;border:0;border-radius:8px;padding:12px 20px;cursor:pointer}
</style>
</head>
<body>
<img id="card" src="${source}" alt="npm wrapped card">
<button id="save">Download PNG</button>
<script>
document.getElementById('save').addEventListener('click', function () {
  var image = new Image()
  image.onload = function () {
    var canvas = document.createElement('canvas')
    canvas.width = 1080
    canvas.height = 1350
    canvas.getContext('2d').drawImage(image, 0, 0, 1080, 1350)
    canvas.toBlob(function (blob) {
      var link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = ${JSON.stringify(fileName)}
      link.click()
    }, 'image/png')
  }
  image.src = document.getElementById('card').src
})
</script>
</body>
</html>
`
}
