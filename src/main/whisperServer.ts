// src/main/whisperServer.ts
import { spawn } from 'child_process'
import http from 'http'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'

type TranscribeOptions = {
  model?: string
  language?: string
  format?: 'txt' | 'srt' | 'vtt'
  threads?: number
  translate?: boolean
  outputDir?: string
}

function getResourcesBase() {
  return is.dev
    ? path.join(process.cwd(), 'resources', 'whisper')
    : path.join(process.resourcesPath, 'resources', 'whisper')
}

function getUserModelsDir() {
  const dir = path.join(app.getPath('userData'), 'models')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function findModelPath(modelFile: string) {
  const userModel = path.join(getUserModelsDir(), modelFile)
  if (fs.existsSync(userModel)) return userModel
  const resModel = path.join(getResourcesBase(), 'models', modelFile)
  if (fs.existsSync(resModel)) return resModel
  return ''
}

function findServerBin(): string {
  const archDir = process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64'
  const base = path.join(getResourcesBase(), 'bin', archDir)

  const candidates = [
    path.join(base, 'whisper-server'),
    path.join(base, 'server'),
    path.join(base, 'whisper_server')
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return ''
}

function findCliBin(): string {
  const archDir = process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64'
  const base = path.join(getResourcesBase(), 'bin', archDir)
  const candidates = [path.join(base, 'whisper'), path.join(base, 'main')]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return ''
}

async function httpPostJson(url: string, body: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const { hostname, port, pathname } = new URL(url)
    const data = Buffer.from(JSON.stringify(body))
    const req = http.request(
      {
        hostname,
        port,
        path: pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      },
      (res) => {
        let chunks = ''
        res.on('data', (d) => (chunks += d.toString()))
        res.on('end', () => {
          try {
            resolve(JSON.parse(chunks))
          } catch {
            resolve({ ok: res.statusCode === 200, data: chunks })
          }
        })
      }
    )
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

async function httpPostMultipart(
  url: string,
  fields: Record<string, string | number | boolean>,
  fileField: { name: string; filePath: string; filename?: string; contentType?: string }
): Promise<any> {
  return new Promise((resolve, reject) => {
    const { hostname, port, pathname } = new URL(url)
    const boundary = '----whisper-boundary-' + Date.now()

    const headers: Record<string, string> = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    }

    const req = http.request(
      {
        hostname,
        port,
        path: pathname,
        method: 'POST',
        headers
      },
      (res) => {
        let chunks = ''
        res.on('data', (d) => (chunks += d.toString()))
        res.on('end', () => {
          try {
            resolve(JSON.parse(chunks))
          } catch {
            resolve({ ok: res.statusCode === 200, data: chunks })
          }
        })
      }
    )
    req.on('error', reject)

    function writeField(name: string, value: string) {
      req.write(`--${boundary}\r\n`)
      req.write(`Content-Disposition: form-data; name="${name}"\r\n\r\n`)
      req.write(`${value}\r\n`)
    }

    // write fields
    for (const [k, v] of Object.entries(fields)) {
      writeField(k, String(v))
    }

    // write file header
    const filename = fileField.filename || path.basename(fileField.filePath)
    const contentType = fileField.contentType || 'application/octet-stream'
    req.write(`--${boundary}\r\n`)
    req.write(
      `Content-Disposition: form-data; name="${fileField.name}"; filename="${filename}"\r\n`
    )
    req.write(`Content-Type: ${contentType}\r\n\r\n`)

    // stream file
    const fileStream = fs.createReadStream(fileField.filePath)
    fileStream.on('error', (e) => req.destroy(e))
    fileStream.on('end', () => {
      req.write(`\r\n--${boundary}--\r\n`)
      req.end()
    })
    fileStream.pipe(req, { end: false })
  })
}

async function run(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += d.toString()))
    child.stderr.on('data', (d) => (stderr += d.toString()))
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }))
  })
}

class WhisperServerManager {
  private child: import('child_process').ChildProcess | null = null
  private port: number = 8089
  private currentModelFile: string | null = null
  private serverBin: string = ''
  private cliBin: string = ''
  private ready: boolean = false

  constructor() {
    this.serverBin = findServerBin()
    this.cliBin = findCliBin()
  }

  getUserModelsDir() {
    return getUserModelsDir()
  }

  isServerAvailable() {
    return !!this.serverBin
  }

  isCliAvailable() {
    return !!this.cliBin
  }

  isReady() {
    return this.ready
  }

  async start(options?: { model?: string; threads?: number; port?: number }) {
    if (this.child) return
    if (!this.serverBin) {
      this.ready = false
      return
    }
    const port = options?.port ?? this.port
    this.port = port
    const modelFile = options?.model ?? this.currentModelFile ?? 'ggml-tiny-q5_1.bin'
    const modelPath = findModelPath(modelFile)
    if (!modelPath) {
      throw new Error(`模型未找到: ${modelFile}（请下载到 ${this.getUserModelsDir()} 或放入 resources/whisper/models）`)
    }
    this.currentModelFile = modelFile

    const threads = options?.threads ?? Math.max(1, Math.min(8, os.cpus().length))

    // 常见 server 参数（根据你编译的 server 程序实际参数适配）
    // 例：--model, --threads, --port
    const args = ['--model', modelPath, '--threads', String(threads), '--port', String(port)]

    // 打印启动参数，便于排查
    console.log('[whisper] spawn:', this.serverBin, args.join(' '))

    this.child = spawn(this.serverBin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    this.child.stdout?.on('data', (d) => {
      const s = d.toString()
      console.log('[whisper][stdout]', s.trim())
      if (!this.ready && /(listening|server started|http|Server running)/i.test(s)) {
        this.ready = true
      }
    })
    this.child.stderr?.on('data', (d) => {
      const s = d.toString()
      console.error('[whisper][stderr]', s.trim())
    })
    this.child.on('close', () => {
      this.child = null
      this.ready = false
    })

    // 简单探活重试
    const start = Date.now()
    while (Date.now() - start < 8000) {
      // 如果已通过 stdout 判定就绪，直接返回
      if (this.ready) return

      const ok = await this.ping().catch(() => false)
      if (ok) {
        this.ready = true
        return
      }
      await new Promise((r) => setTimeout(r, 300))
    }
    if (this.ready) return
    throw new Error('whisper 本地服务启动超时')
  }

  async stop() {
    if (this.child) {
      this.child.kill('SIGTERM')
      this.child = null
    }
    this.ready = false
  }

  async restart(modelFile?: string) {
    await this.stop()
    await this.start({ model: modelFile ?? this.currentModelFile ?? undefined, port: this.port })
  }

  async ping() {
    if (!this.serverBin) return false
    try {
      const res = await httpPostJson(`http://127.0.0.1:${this.port}/ping`, {})
      return !!res
    } catch {
      return false
    }
  }

  async transcribe(inputPath: string, opt: TranscribeOptions = {}) {
    const format = opt.format ?? 'txt'
    const language = opt.language ?? 'auto'
    const translate = !!opt.translate

    // server 优先
    if (this.ready && this.serverBin) {
      // 多数 whisper 服务器期望 multipart/form-data，文件字段名常为 "file"
      const res = await httpPostMultipart(
        `http://127.0.0.1:${this.port}/inference`,
        {
          language,
          translate
        },
        {
          name: 'file',
          filePath: inputPath,
          filename: path.basename(inputPath),
          contentType: inputPath.endsWith('.mp3') ? 'audio/mpeg' : 'application/octet-stream'
        }
      )

      // 期待返回 { ok: true, output: '/path/to/result.txt' } 或 { text: '...' }
      if (res?.output && fs.existsSync(res.output)) {
        return { output: res.output }
      }
      const text =
        typeof res?.text === 'string'
          ? res.text
          : typeof res?.result?.text === 'string'
          ? res.result.text
          : null
      if (typeof text === 'string') {
        const outDir = opt.outputDir || fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-'))
        const outPath = path.join(outDir, `transcript_${Date.now()}.${format}`)
        fs.writeFileSync(outPath, text)
        return { output: outPath }
      }
      throw new Error('本地服务返回格式不符合预期')
    }

    // 回退：直接用 CLI（会每次加载模型，速度较慢）
    if (!this.cliBin) {
      throw new Error('未找到 whisper 可执行文件（CLI），无法回退')
    }
    const model = opt.model ?? this.currentModelFile ?? 'ggml-tiny-q5_1.bin'
    const modelPath = findModelPath(model)
    if (!modelPath) {
      throw new Error(`模型未找到: ${model}`)
    }
    const threads = opt.threads ?? Math.max(1, Math.min(8, os.cpus().length))
    const outDir = opt.outputDir || fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-'))
    const prefix = path.join(outDir, `transcript_${Date.now()}`)

    const outFlags = format === 'srt' ? ['-osrt'] : format === 'vtt' ? ['-ovtt'] : ['-otxt']
    const args = ['-m', modelPath, '-f', inputPath, '-l', language, '-t', String(threads), '-of', prefix, ...outFlags]
    if (translate) args.push('-tr')

    const { code, stderr } = await run(this.cliBin, args)
    if (code !== 0) throw new Error(`whisper CLI 失败(code=${code}): ${stderr}`)

    const outPath = format === 'srt' ? `${prefix}.srt` : format === 'vtt' ? `${prefix}.vtt` : `${prefix}.txt`
    if (!fs.existsSync(outPath)) throw new Error('输出文件未生成')
    return { output: outPath }
  }
}

export const whisperServer = new WhisperServerManager()