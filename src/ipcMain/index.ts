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
    this.handleOpenFile()
    this.handlePing()

    // FFmpeg相关IPC处理
    this.handleFFmpegEvents()

    // 文件系统相关IPC处理
    this.handleFileSystemEvents()

    // Whisper 本地服务与模型管理
    this.handleWhisperEvents()
    // 聚合“视频转文字”管线
    this.handleVideoToTextPipeline()
    this.handleModelEvents()
  }

  // 原有的文件打开方法
  handleOpenFile() {
    /**
     * 选择并打开本地文件（系统对话框）
     *
     * 通道: 'open-file'
     * @returns {Promise<Electron.OpenDialogReturnValue>} 系统对话框返回结果
     */
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

  
  /**
   * FFmpeg相关IPC处理
   */
  handleFFmpegEvents() {
    // 视频转换
    /**
     * 使用 FFmpeg 转换视频
     *
     * 通道: 'ffmpeg:convert-video'
     * @param {string} inputPath 输入视频路径
     * @param {string} outputPath 输出视频路径
     * @param {Record<string, any>} options 转换参数（编码、比特率、分辨率等）
     * @returns {Promise<{success:boolean, message?:string, error?:string}>}
     */
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
    /**
     * 读取视频基础信息（如分辨率、时长、编码等）
     *
     * 通道: 'ffmpeg:get-video-info'
     * @param {string} inputPath 输入视频路径
     * @returns {Promise<{success:boolean, info?:any, error?:string}>}
     */
    ipcMain.handle('ffmpeg:get-video-info', async (_event, inputPath: string) => {
      try {
        const info = await ffmpegService.getVideoInfo(inputPath)
        return { success: true, info }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })

    // 提取缩略图
    /**
     * 从视频中提取指定时间点的缩略图
     *
     * 通道: 'ffmpeg:extract-thumbnail'
     * @param {string} inputPath 输入视频路径
     * @param {string} outputPath 输出图片路径（.jpg/.png）
     * @param {string} time 时间点，格式 HH:MM:SS
     * @returns {Promise<{success:boolean, message?:string, error?:string}>}
     */
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
    /**
     * 按起始时间与时长裁剪视频片段
     *
     * 通道: 'ffmpeg:trim-video'
     * @param {string} inputPath 输入视频路径
     * @param {string} outputPath 输出视频路径
     * @param {string} startTime 开始时间 HH:MM:SS
     * @param {string} duration 时长 HH:MM:SS
     * @returns {Promise<{success:boolean, message?:string, error?:string}>}
     */
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
    /**
     * 从输入媒体中提取音频轨并输出为音频文件
     *
     * 通道: 'ffmpeg:extract-audio'
     * @param {string} inputPath 输入媒体路径
     * @param {string} [outputPath] 可选的输出音频路径
     * @returns {Promise<{success:boolean, audioPath?:string, message?:string, error?:string}>}
     */
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
    /**
     * 检查 FFmpeg 服务是否就绪
     *
     * 通道: 'ffmpeg:is-ready'
     * @returns {boolean} 是否就绪
     */
    ipcMain.handle('ffmpeg:is-ready', () => {
      return ffmpegService.isReady()
    })
  }

  
  /**
   * 处理文件系统相关IPC事件
   */
  handleFileSystemEvents() {
    /**
     * 打开系统对话框选择单个文件
     *
     * 通道: 'file:select-file'
     * @param {Object} [options] 过滤选项
     * @returns {Promise<string|null>} 选中文件路径或 null
     */
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

    /**
     * 打开系统对话框选择目录
     *
     * 通道: 'file:select-directory'
     * @returns {Promise<string|null>} 选中目录路径或 null
     */
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

    /**
     * 获取文件的基本信息
     *
     * 通道: 'file:get-info'
     * @param {string} filePath 文件路径
     * @returns {Promise<{size:number,type:string,lastModified:number}|null>}
     */
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

    /**
     * 以二进制方式读取文件并返回 ArrayBuffer
     *
     * 通道: 'file:read-file'
     * @param {string} filePath 文件路径
     * @returns {Promise<ArrayBuffer|null>} 文件内容或 null
     */
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

  /**
   * 处理Whisper IPC事件。
   */
  handleWhisperEvents() {

    /**
     * 启动 Whisper 本地服务
     *
     * 通道: 'whisper:start'
     * @param {{model?:string, threads?:number, port?:number}} [opts] 启动参数
     * @returns {Promise<{success:boolean, ready?:boolean, error?:string}>}
     */
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

    /**
     * 停止 Whisper 本地服务
     *
     * 通道: 'whisper:stop'
     * @returns {Promise<{success:boolean, error?:string}>}
     */
    ipcMain.handle('whisper:stop', async () => {
      try {
        await whisperServer.stop()
        return { success: true }
      } catch (e: any) {
        return { success: false, error: e?.message || String(e) }
      }
    })

    /**
     * 查询 Whisper 服务是否就绪
     *
     * 通道: 'whisper:is-ready'
     * @returns {boolean}
     */
    ipcMain.handle('whisper:is-ready', () => {
      return whisperServer.isReady()
    })

    /**
     * 通过 Whisper 转写指定音频/视频文件
     *
     * 通道: 'whisper:transcribe'
     * @param {string} inputPath 输入媒体路径
     * @param {Record<string, any>} [options] 转写参数（语言、格式、线程数等）
     * @returns {Promise<{success:boolean, output?:string, error?:string}>}
     */
    ipcMain.handle('whisper:transcribe', async (_e, inputPath: string, options?: any) => {
      try {
        const res = await whisperServer.transcribe(inputPath, options)
        return { success: true, ...res }
      } catch (e: any) {
        return { success: false, error: e?.message || String(e) }
      }
    })

    /**
     * 重启 Whisper 服务（可切换模型）
     *
     * 通道: 'whisper:restart'
     * @param {string} [modelFile] 模型文件名
     * @returns {Promise<{success:boolean, ready?:boolean, error?:string}>}
     */
    ipcMain.handle('whisper:restart', async (_e, modelFile?: string) => {
      try {
        await whisperServer.restart(modelFile)
        return { success: true, ready: whisperServer.isReady() }
      } catch (e: any) {
        return { success: false, error: e?.message || String(e) }
      }
    })
  }

  /**
   * 聚合：视频→提取音频→Whisper转写，并通过事件推送细进度。
   * 事件频道：'pipeline:progress' -> { phase: 'extract'|'upload'|'process'|'transcribe'|'done'|'error', percent?: number, message?: string }
   */
  handleVideoToTextPipeline() {
    /**
     * 一键处理：视频→提取音频→Whisper 转写
     *
     * 通道: 'pipeline:video-to-text'
     * @param {string} inputVideoPath 输入视频路径
     * @param {{outputDir?:string, whisper?:Record<string, any>}} [options] 选项
     * @returns {Promise<{success:boolean, audioPath?:string, output?:string, error?:string}>}
     */
    ipcMain.handle(
      'pipeline:video-to-text',
      async (event, inputVideoPath: string, options?: { outputDir?: string; whisper?: any }) => {
        try {
          const webContents = event.sender
          const emit = (payload: any) => webContents.send('pipeline:progress', payload)

          // 1) 提取音频（细进度）
          emit({ phase: 'extract', percent: 0 })
          let lastPercent = 0
          const audioPath = await ffmpegService.extractAudio(inputVideoPath, undefined, {
            onProgress: (p) => {
              // 防抖：只在变化时发送
              if (typeof p === 'number' && p !== lastPercent) {
                lastPercent = p
                emit({ phase: 'extract', percent: Math.max(0, Math.min(100, p)) })
              }
            }
          })
          emit({ phase: 'extract', percent: 100 })

          // 2) Whisper 转写
          emit({ phase: 'transcribe', percent: 0 })
          const res = await whisperServer.transcribe(audioPath, {
            ...(options?.whisper || {}),
            outputDir: options?.outputDir
          })
          emit({ phase: 'transcribe', percent: 100 })
          emit({ phase: 'done' })
          return { success: true, audioPath, output: res.output }
        } catch (e: any) {
          const msg = e?.message || String(e)
          event.sender.send('pipeline:progress', { phase: 'error', message: msg })
          return { success: false, error: msg }
        }
      }
    )
  }


  /**
   * 处理模型相关的进程间通信事件.
   */
  handleModelEvents() {
    /**
     * 获取可用模型列表
     *
     * 通道: 'models:list'
     * @returns {Promise<Array<{name:string,size:number}>>}
     */
    ipcMain.handle('models:list', () => modelsManager.list())

    /**
     * 获取模型存储目录
     *
     * 通道: 'models:dir'
     * @returns {Promise<string>} 目录绝对路径
     */
    ipcMain.handle('models:dir', () => modelsManager.getDir())

    /**
     * 删除指定模型
     *
     * 通道: 'models:remove'
     * @param {string} name 模型文件名（不含扩展名）
     * @returns {Promise<{success:boolean, error?:string}>}
     */
    ipcMain.handle('models:remove', (_e, name: string) => {
      try {
        modelsManager.remove(name)
        return { success: true }
      } catch (e: any) {
        return { success: false, error: e?.message || String(e) }
      }
    })

    /**
     * 下载并保存模型文件
     *
     * 通道: 'models:download'
     * @param {string} url 模型下载 URL
     * @param {string} [fileName] 可选保存文件名
     * @returns {Promise<{success:boolean, path?:string, error?:string}>}
     */
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
