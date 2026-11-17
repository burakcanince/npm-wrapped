const isTTY = Boolean(process.stdout.isTTY)
const forceColor = process.env.FORCE_COLOR
const useColor = forceColor !== undefined ? forceColor !== '0' : isTTY && !('NO_COLOR' in process.env)
const trueColor = /truecolor|24bit/i.test(process.env.COLORTERM ?? '') || Boolean(process.env.WT_SESSION)

const style =
  (open: string, close: string) =>
  (text: string | number): string =>
    useColor ? `\x1b[${open}m${text}\x1b[${close}m` : String(text)

const rgb = (red: number, green: number, blue: number, fallback: number) =>
  style(trueColor ? `38;2;${red};${green};${blue}` : `38;5;${fallback}`, '39')

export const color = {
  bold: style('1', '22'),
  red: style('31', '39'),
  coral: rgb(255, 97, 80, 203),
  lime: rgb(198, 242, 78, 191),
  gray: rgb(139, 143, 158, 245),
  dim: rgb(52, 55, 64, 238),
  white: rgb(240, 241, 245, 255),
}

export const terminalWidth = (): number => Math.max(48, Math.min(process.stdout.columns || 90, 110))

const visibleLength = (text: string): number => text.replace(/\x1b\[[0-9;]*m/g, '').length

export const padEnd = (text: string, width: number): string => text + ' '.repeat(Math.max(0, width - visibleLength(text)))

export const padStart = (text: string, width: number): string => ' '.repeat(Math.max(0, width - visibleLength(text))) + text

export function truncate(text: string, width: number): string {
  if (width <= 0) return ''
  return text.length > width ? text.slice(0, Math.max(0, width - 1)) + '…' : text
}
