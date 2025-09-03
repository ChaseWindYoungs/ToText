export type PipelinePhase = 'extract' | 'upload' | 'process' | 'transcribe' | 'done' | 'error'

export interface ConvertVideoOptions {
  format?: string
  codec?: string
  bitrate?: string
  resolution?: string
}

export interface WhisperTranscribeOptions {
  model?: string
  language?: string
  format?: 'txt' | 'srt' | 'vtt'
  threads?: number
  translate?: boolean
  outputDir?: string
}

export interface PipelineStartOptions {
  outputDir?: string
  whisper?: Omit<WhisperTranscribeOptions, 'outputDir'>
}

class Bridge {
  // electron
  async openFile(): Promise<any> {
    try {
      const result = await window.electron.openFile()
      return result
    } catch (e) {
      console.error('[bridge.openFile] error:', e)
      throw e
    }
  }

  // file system
  async selectFile(options?: { filters?: { name: string; extensions: string[] }[] }): Promise<string | null> {
    try {
      const result = await window.fileSystem.selectFile(options)
      return result
    } catch (e) {
      console.error('[bridge.selectFile] error:', e)
      throw e
    }
  }

  async selectDirectory(): Promise<string | null> {
    try {
      const result = await window.fileSystem.selectDirectory()
      return result
    } catch (e) {
      console.error('[bridge.selectDirectory] error:', e)
      throw e
    }
  }

  async getFileInfo(filePath: string): Promise<{ size: number; type: string; lastModified: number } | null> {
    try {
      const info = await window.fileSystem.getFileInfo(filePath)
      return info
    } catch (e) {
      console.error('[bridge.getFileInfo] error:', e)
      throw e
    }
  }

  // ffmpeg
  async isFfmpegReady(): Promise<boolean> {
    try {
      const ready = await window.ffmpeg.isReady()
      return ready
    } catch (e) {
      console.error('[bridge.isFfmpegReady] error:', e)
      return false
    }
  }

  async convertVideo(inputPath: string, outputPath: string, options?: ConvertVideoOptions) {
    try {
      const result = await window.ffmpeg.convertVideo(inputPath, outputPath, options)
      return result
    } catch (e) {
      console.error('[bridge.convertVideo] error:', e)
      throw e
    }
  }

  async getVideoInfo(inputPath: string) {
    try {
      const result = await window.ffmpeg.getVideoInfo(inputPath)
      return result
    } catch (e) {
      console.error('[bridge.getVideoInfo] error:', e)
      throw e
    }
  }

  async extractThumbnail(inputPath: string, outputPath: string, time?: string) {
    try {
      const result = await window.ffmpeg.extractThumbnail(inputPath, outputPath, time)
      return result
    } catch (e) {
      console.error('[bridge.extractThumbnail] error:', e)
      throw e
    }
  }

  async extractAudio(inputPath: string, outputPath?: string) {
    try {
      const result = await window.ffmpeg.extractAudio(inputPath, outputPath)
      return result
    } catch (e) {
      console.error('[bridge.extractAudio] error:', e)
      throw e
    }
  }

  // whisper
  async whisperStart(opts?: { model?: string; threads?: number; port?: number }) {
    try {
      const res = await window.whisper.start(opts)
      return res
    } catch (e) {
      console.error('[bridge.whisperStart] error:', e)
      throw e
    }
  }

  async whisperStop() {
    try {
      const res = await window.whisper.stop()
      return res
    } catch (e) {
      console.error('[bridge.whisperStop] error:', e)
      throw e
    }
  }

  async whisperIsReady() {
    try {
      const ready = await window.whisper.isReady()
      return ready
    } catch (e) {
      console.error('[bridge.whisperIsReady] error:', e)
      return false
    }
  }

  async whisperTranscribe(inputPath: string, options?: WhisperTranscribeOptions) {
    try {
      const result = await window.whisper.transcribe(inputPath, options)
      return result
    } catch (e) {
      console.error('[bridge.whisperTranscribe] error:', e)
      throw e
    }
  }

  async whisperRestart(modelFile?: string) {
    try {
      const res = await window.whisper.restart(modelFile)
      return res
    } catch (e) {
      console.error('[bridge.whisperRestart] error:', e)
      throw e
    }
  }

  // pipeline
  async pipelineStartVideoToText(inputPath: string, options?: PipelineStartOptions) {
    try {
      const result = await window.pipeline.startVideoToText(inputPath, options)
      return result
    } catch (e) {
      console.error('[bridge.pipelineStartVideoToText] error:', e)
      throw e
    }
  }

  pipelineOnProgress(cb: (payload: { phase: PipelinePhase; percent?: number; message?: string }) => void) {
    const unsubscribe = window.pipeline.onProgress(cb)
    return unsubscribe
  }

  // models
  async listModels() {
    try {
      const list = await window.models.list()
      return list
    } catch (e) {
      console.error('[bridge.listModels] error:', e)
      throw e
    }
  }

  async modelsDir() {
    try {
      const dir = await window.models.dir()
      return dir
    } catch (e) {
      console.error('[bridge.modelsDir] error:', e)
      throw e
    }
  }

  async removeModel(name: string) {
    try {
      const res = await window.models.remove(name)
      return res
    } catch (e) {
      console.error('[bridge.removeModel] error:', e)
      throw e
    }
  }

  async downloadModel(url: string, fileName?: string) {
    try {
      const res = await window.models.download(url, fileName)
      return res
    } catch (e) {
      console.error('[bridge.downloadModel] error:', e)
      throw e
    }
  }
}

export const bridge = new Bridge()
export default bridge 