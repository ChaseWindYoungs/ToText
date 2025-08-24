// src/main/models.ts
import fs from 'fs'
import path from 'path'
import https from 'https'
import { app } from 'electron'
import { pipeline } from 'stream'
import { promisify } from 'util'
const streamPipeline = promisify(pipeline)

function getUserModelsDir() {
  const dir = path.join(app.getPath('userData'), 'models')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

export const modelsManager = {
  getDir() {
    return getUserModelsDir()
  },
  list(): { name: string; size: number }[] {
    const dir = getUserModelsDir()
    if (!fs.existsSync(dir)) return []
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.bin'))
      .map((f) => {
        const full = path.join(dir, f)
        const st = fs.statSync(full)
        return { name: f, size: st.size }
      })
  },
  remove(name: string) {
    const full = path.join(getUserModelsDir(), name)
    if (fs.existsSync(full)) fs.rmSync(full)
  },
  async download(url: string, fileName?: string, onProgress?: (percent: number) => void) {
    const dir = getUserModelsDir()
    const targetName = fileName || path.basename(new URL(url).pathname)
    const target = path.join(dir, targetName)

    await new Promise<void>((resolve, reject) => {
      https.get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // redirect
          modelsManager
            .download(res.headers.location, targetName, onProgress)
            .then(() => resolve())
            .catch(reject)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }
        const total = Number(res.headers['content-length'] || 0)
        let loaded = 0
        const file = fs.createWriteStream(target)
        res.on('data', (chunk) => {
          loaded += chunk.length
          if (total && onProgress) onProgress(Math.round((loaded / total) * 100))
        })
        res.on('end', () => resolve())
        res.on('error', reject)
        res.pipe(file)
      }).on('error', reject)
    })

    return { path: target }
  }
}