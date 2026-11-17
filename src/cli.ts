#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { openInBrowser } from './browser.js'
import { renderCard, renderPreviewPage } from './card.js'
import { toJson } from './format.js'
import { renderReport } from './report.js'
import { color, terminalWidth } from './terminal.js'
import { buildWrapped, type Wrapped } from './wrapped.js'

const HELP = `
  ${color.lime(color.bold('npm wrapped'))}  ${color.gray('Your year on npm in one command.')}

  ${color.bold('Usage')}
    npx npm-wrapped <username>            Your stats for this year
    npx npm-wrapped <username> --share    Save a share card

  ${color.bold('Options')}
    -y, --year <year>       Another year, e.g. 2025
    -s, --share             Save the share card as SVG and open a PNG preview
        --no-open           Do not open the preview in the browser
        --json              Print JSON
    -h, --help              Show this help
    -v, --version           Show the version
`

function exitWithError(message: string): never {
  clearProgress()
  process.stderr.write(color.red(`npm-wrapped: ${message}`) + '\n')
  process.exit(1)
}

function readOptions() {
  try {
    return parseArgs({
      args: process.argv.slice(2),
      allowPositionals: true,
      options: {
        year: { type: 'string', short: 'y' },
        share: { type: 'boolean', short: 's' },
        'no-open': { type: 'boolean' },
        json: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    })
  } catch (error) {
    exitWithError(`${(error as Error).message}\nRun "npm-wrapped --help" for usage.`)
  }
}

function readVersion(): string {
  try {
    return JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
  } catch {
    return 'unknown'
  }
}

function showProgress(text: string): void {
  if (process.stderr.isTTY) process.stderr.write(`\r\x1b[K${color.gray(text)}`)
}

function clearProgress(): void {
  if (process.stderr.isTTY) process.stderr.write('\r\x1b[K')
}

function readYear(value: string | undefined): number {
  if (value === undefined) return new Date().getUTCFullYear()
  if (!/^\d{4}$/.test(value)) exitWithError('--year needs a four digit year, e.g. 2025.')
  return Number(value)
}

function readUsername(value: string | undefined): string {
  const username = (value ?? '').trim().replace(/^@/, '').toLowerCase()
  if (!username) exitWithError('Usage: npx npm-wrapped username')
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(username)) exitWithError(`"${value}" is not a valid npm username.`)
  return username
}

async function saveCard(wrapped: Wrapped, open: boolean): Promise<void> {
  const baseName = `${wrapped.username}-${wrapped.year}`
  const svg = renderCard(wrapped)
  const file = path.resolve(`${baseName}.svg`)
  fs.writeFileSync(file, svg)
  process.stdout.write(`  ${color.lime('✓')} ${color.gray('card saved to')} ${file}\n`)
  if (!open) return
  const preview = path.join(os.tmpdir(), `${baseName}.html`)
  fs.writeFileSync(preview, renderPreviewPage(svg, `${baseName}.png`))
  const opened = await openInBrowser(pathToFileURL(preview).href)
  process.stdout.write(
    opened
      ? `  ${color.lime('✓')} ${color.gray('opened the preview, use "Download PNG" to get an image')}\n`
      : `  ${color.gray('open this file to download a PNG:')} ${preview}\n`,
  )
}

async function main(): Promise<void> {
  const { values: options, positionals } = readOptions()
  if (options.help) return void process.stdout.write(HELP + '\n')
  if (options.version) return void process.stdout.write(readVersion() + '\n')
  if (positionals.length > 1) exitWithError(`expected one username, got ${positionals.length}.`)

  const year = readYear(options.year)
  const wrapped = await buildWrapped(readUsername(positionals[0]), year, showProgress)
  clearProgress()

  if (options.json) process.stdout.write(toJson(wrapped) + '\n')
  else process.stdout.write(renderReport(wrapped, terminalWidth()) + '\n')

  if (options.share) await saveCard(wrapped, !options['no-open'])
}

main().catch((error: Error) => exitWithError(error.message))
