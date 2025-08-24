import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI & {
      openFile: () => Promise<any>
    }
    api: unknown
    ffmpeg: {
      convertVideo: (inputPath: string, outputPath: string, options?: any) => Promise<{ success: boolean; message?: string; error?: string }>
      getVideoInfo: (inputPath: string) => Promise<{ success: boolean; info?: any; error?: string }>
      extractThumbnail: (inputPath: string, outputPath: string, time?: string) => Promise<{ success: boolean; message?: string; error?: string }>
      trimVideo: (inputPath: string, outputPath: string, startTime: string, duration: string) => Promise<{ success: boolean; message?: string; error?: string }>
      extractAudio: (inputPath: string, outputPath?: string) => Promise<{ success: boolean; audioPath?: string; message?: string; error?: string }>
      isReady: () => boolean
    }
    // 添加文件选择器API
    fileSystem: {
      selectFile: (options?: { filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>
      selectDirectory: () => Promise<string | null>
      getFileInfo: (filePath: string) => Promise<{ size: number; type: string; lastModified: number } | null>
    }
    whisper: {
      start: (opts?: { model?: string; threads?: number; port?: number }) => Promise<{ success: boolean; ready?: boolean; error?: string }>
      stop: () => Promise<{ success: boolean; error?: string }>
      isReady: () => Promise<boolean>
      transcribe: (inputPath: string, options?: { model?: string; language?: string; format?: 'txt' | 'srt' | 'vtt'; threads?: number; translate?: boolean; outputDir?: string }) => Promise<{ success: boolean; output?: string; error?: string }>
      restart: (modelFile?: string) => Promise<{ success: boolean; ready?: boolean; error?: string }>
    }
    models: {
      list: () => Promise<{ name: string; size: number }[]>
      dir: () => Promise<string>
      remove: (name: string) => Promise<{ success: boolean; error?: string }>
      download: (url: string, fileName?: string) => Promise<{ success: boolean; path?: string; error?: string }>
    }
  }
}
