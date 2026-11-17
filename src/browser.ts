import { spawn } from 'node:child_process'
import path from 'node:path'

function browserCommand(url: string): [string, string[]] {
  if (process.platform === 'win32') {
    const systemRoot = process.env.SystemRoot || process.env.windir || 'C:\\Windows'
    return [path.join(systemRoot, 'System32', 'rundll32.exe'), ['url.dll,FileProtocolHandler', url]]
  }
  if (process.platform === 'darwin') return ['open', [url]]
  return ['xdg-open', [url]]
}

export function openInBrowser(url: string): Promise<boolean> {
  if (!/^(https?|file):\/\/\S+$/i.test(url)) return Promise.resolve(false)
  const [command, args] = browserCommand(url)
  return new Promise((resolve) => {
    try {
      const child = spawn(command, args, { detached: true, stdio: 'ignore' })
      child.once('error', () => resolve(false))
      child.once('spawn', () => {
        child.unref()
        resolve(true)
      })
    } catch {
      resolve(false)
    }
  })
}
