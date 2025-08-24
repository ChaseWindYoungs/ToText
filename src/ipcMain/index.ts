import { ipcMain, dialog, app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import path from 'path'
import { ffmpegService } from '../main/ffmpeg'
import { whisperServer } from '../main/whisperServer'
import { modelsManager } from '../main/models'

class IpcEvent {
  self: any
  constructor(self) {
    this.self = self
    this.init()
  }

  async init() {
    console.log('IpcEvent initialized')
    this.event()
  }

  event() {
    // 原有的IPC事件
    this.handleOpenFile()
    this.handlePing()

    // FFmpeg相关IPC处理
    this.handleFFmpegEvents()

    // 文件系统相关IPC处理
    this.handleFileSystemEvents()

    // Whisper 本地服务与模型管理
    this.handleWhisperEvents()
    this.handleModelEvents()
  }

  // 原有的文件打开方法
  handleOpenFile() {
    ipcMain.handle('open-file', async () => {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          {
            name: 'All Files',
            extensions: []
          }
        ]
      })
      return result
    })
  }

  handlePing() {
    ipcMain.on('ping', () => {
      console.log('pong')
    })
  }

  // FFmpeg相关IPC处理
  handleFFmpegEvents() {
    // 视频转换
    ipcMain.handle(
      'ffmpeg:convert-video',
      async (_event, inputPath: string, outputPath: string, options: any) => {
        try {
          await ffmpegService.convertVideo(inputPath, outputPath, options)
          return { success: true, message: '视频转换成功' }
        } catch (error: any) {
          return { success: false, error: error.message }
        }
      }
    )

    // 获取视频信息
    ipcMain.handle('ffmpeg:get-video-info', async (_event, inputPath: string) => {
      try {
        const info = await ffmpegService.getVideoInfo(inputPath)
        return { success: true, info }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })

    // 提取缩略图
    ipcMain.handle(
      'ffmpeg:extract-thumbnail',
      async (_event, inputPath: string, outputPath: string, time: string) => {
        try {
          await ffmpegService.extractThumbnail(inputPath, outputPath, time)
          return { success: true, message: '缩略图提取成功' }
        } catch (error: any) {
          return { success: false, error: error.message }
        }
      }
    )

    // 视频裁剪
    ipcMain.handle(
      'ffmpeg:trim-video',
      async (
        _event,
        inputPath: string,
        outputPath: string,
        startTime: string,
        duration: string
      ) => {
        try {
          await ffmpegService.trimVideo(inputPath, outputPath, startTime, duration)
          return { success: true, message: '视频裁剪成功' }
        } catch (error: any) {
          return { success: false, error: error.message }
        }
      }
    )

    // 音频提取 - 使用文件路径而不是内存数据
    ipcMain.handle(
      'ffmpeg:extract-audio',
      async (_event, inputPath: string, outputPath?: string) => {
        try {
          const extractedPath = await ffmpegService.extractAudio(inputPath, outputPath)
          return {
            success: true,
            audioPath: extractedPath,
            message: '音频提取成功'
          }
        } catch (error: any) {
          return { success: false, error: error.message }
        }
      }
    )

    // 检查FFmpeg是否就绪
    ipcMain.handle('ffmpeg:is-ready', () => {
      return ffmpegService.isReady()
    })
  }

  // 文件系统相关IPC处理
  handleFileSystemEvents() {
    // 选择文件
    ipcMain.handle('file:select-file', async (_event, options) => {
      try {
        const result = await dialog.showOpenDialog({
          properties: ['openFile'],
          filters: options?.filters || [
            { name: '所有文件', extensions: ['*'] },
            { name: '视频文件', extensions: ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv'] },
            { name: '音频文件', extensions: ['mp3', 'wav', 'aac', 'flac', 'ogg'] },
            { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp'] }
          ]
        })
        if (!result.canceled && result.filePaths.length > 0) {
          return result.filePaths[0]
        }
        return null
      } catch (error) {
        console.error('File selection error:', error)
        return null
      }
    })

    // 选择目录
    ipcMain.handle('file:select-directory', async () => {
      try {
        const result = await dialog.showOpenDialog({
          properties: ['openDirectory']
        })
        if (!result.canceled && result.filePaths.length > 0) {
          return result.filePaths[0]
        }
        return null
      } catch (error) {
        console.error('Directory selection error:', error)
        return null
      }
    })

    // 获取文件信息
    ipcMain.handle('file:get-info', async (_event, filePath) => {
      try {
        const stats = fs.statSync(filePath)
        return {
          size: stats.size,
          type: path.extname(filePath),
          lastModified: stats.mtime.getTime()
        }
      } catch (error) {
        console.error('File info error:', error)
        return null
      }
    })

    // 读取文件内容
    ipcMain.handle('file:read-file', async (_event, filePath) => {
      try {
        const buffer = fs.readFileSync(filePath)
        // 将Buffer转换为ArrayBuffer
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      } catch (error) {
        console.error('File read error:', error)
        return null
      }
    })
  }

  handleWhisperEvents() {
    ipcMain.handle(
      'whisper:start',
      async (_e, opts?: { model?: string; threads?: number; port?: number }) => {
        try {
          await whisperServer.start(opts)
          return { success: true, ready: whisperServer.isReady() }
        } catch (e: any) {
          return { success: false, error: e?.message || String(e) }
        }
      }
    )
    ipcMain.handle('whisper:stop', async () => {
      try {
        await whisperServer.stop()
        return { success: true }
      } catch (e: any) {
        return { success: false, error: e?.message || String(e) }
      }
    })
    ipcMain.handle('whisper:is-ready', () => {
      return whisperServer.isReady()
    })
    ipcMain.handle('whisper:transcribe', async (_e, inputPath: string, options?: any) => {
      try {
        const res = await whisperServer.transcribe(inputPath, options)
        return { success: true, ...res }
      } catch (e: any) {
        return { success: false, error: e?.message || String(e) }
      }
    })
    ipcMain.handle('whisper:restart', async (_e, modelFile?: string) => {
      try {
        await whisperServer.restart(modelFile)
        return { success: true, ready: whisperServer.isReady() }
      } catch (e: any) {
        return { success: false, error: e?.message || String(e) }
      }
    })
  }

  handleModelEvents() {
    ipcMain.handle('models:list', () => modelsManager.list())
    ipcMain.handle('models:dir', () => modelsManager.getDir())
    ipcMain.handle('models:remove', (_e, name: string) => {
      try {
        modelsManager.remove(name)
        return { success: true }
      } catch (e: any) {
        return { success: false, error: e?.message || String(e) }
      }
    })
    ipcMain.handle('models:download', async (_e, url: string, fileName?: string) => {
      try {
        const res = await modelsManager.download(url, fileName)
        return { success: true, ...res }
      } catch (e: any) {
        return { success: false, error: e?.message || String(e) }
      }
    })
  }
}

export default IpcEvent
