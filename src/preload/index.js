import { contextBridge, ipcRenderer } from 'electron'
// import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const electronAPI = {
  ping: () => ipcRenderer.send('ping'),
  openFile: async () => {
    try {
      const res = await ipcRenderer.invoke('open-file')
      return res
    } catch (e) {
      console.error('[preload][electron.openFile] error:', e)
      throw e
    }
  },
  readAudioFile: async (filePath) => {
    try {
      const result = await ipcRenderer.invoke('ffmpeg:read-audio-file', filePath)
      return result
    } catch (e) {
      console.error('[preload][electron.readAudioFile] error:', e)
      throw e
    }
  }
}

const ffmpegAPI = {
  convertVideo: async (inputPath, outputPath, options) => {
    try {
      const result = await ipcRenderer.invoke('ffmpeg:convert-video', inputPath, outputPath, options)
      return result
    } catch (e) {
      console.error('[preload][ffmpeg.convertVideo] error:', e)
      throw e
    }
  },
  getVideoInfo: async (inputPath) => {
    try {
      const result = await ipcRenderer.invoke('ffmpeg:get-video-info', inputPath)
      return result
    } catch (e) {
      console.error('[preload][ffmpeg.getVideoInfo] error:', e)
      throw e
    }
  },
  extractThumbnail: async (inputPath, outputPath, time) => {
    try {
      const result = await ipcRenderer.invoke('ffmpeg:extract-thumbnail', inputPath, outputPath, time)
      return result
    } catch (e) {
      console.error('[preload][ffmpeg.extractThumbnail] error:', e)
      throw e
    }
  },
  trimVideo: async (inputPath, outputPath, startTime, duration) => {
    try {
      const result = await ipcRenderer.invoke('ffmpeg:trim-video', inputPath, outputPath, startTime, duration)
      return result
    } catch (e) {
      console.error('[preload][ffmpeg.trimVideo] error:', e)
      throw e
    }
  },
  extractAudio: async (inputPath, outputPath) => {
    try {
      const result = await ipcRenderer.invoke('ffmpeg:extract-audio', inputPath, outputPath)
      return result
    } catch (e) {
      console.error('[preload][ffmpeg.extractAudio] error:', e)
      throw e
    }
  },
  isReady: async () => {
    try {
      const ready = await ipcRenderer.invoke('ffmpeg:is-ready')
      return ready
    } catch (e) {
      console.error('[preload][ffmpeg.isReady] error:', e)
      throw e
    }
  }
}

// 文件系统相关API
const fileSystemAPI = {
  selectFile: async (options) => {
    try {
      const file = await ipcRenderer.invoke('file:select-file', options)
      return file
    } catch (e) {
      console.error('[preload][fileSystem.selectFile] error:', e)
      throw e
    }
  },
  selectDirectory: async () => {
    try {
      const dir = await ipcRenderer.invoke('file:select-directory')
      return dir
    } catch (e) {
      console.error('[preload][fileSystem.selectDirectory] error:', e)
      throw e
    }
  },
  getFileInfo: async (filePath) => {
    try {
      const info = await ipcRenderer.invoke('file:get-info', filePath)
      return info
    } catch (e) {
      console.error('[preload][fileSystem.getFileInfo] error:', e)
      throw e
    }
  },
  readFile: async (filePath) => {
    try {
      const content = await ipcRenderer.invoke('file:read-file', filePath)
      return content
    } catch (e) {
      console.error('[preload][fileSystem.readFile] error:', e)
      throw e
    }
  }
}

// Whisper 与模型 API
const whisperAPI = {
  start: async (opts) => {
    try {
      const res = await ipcRenderer.invoke('whisper:start', opts)
      return res
    } catch (e) {
      console.error('[preload][whisper.start] error:', e)
      throw e
    }
  },
  stop: async () => {
    try {
      const res = await ipcRenderer.invoke('whisper:stop')
      return res
    } catch (e) {
      console.error('[preload][whisper.stop] error:', e)
      throw e
    }
  },
  isReady: async () => {
    try {
      const ready = await ipcRenderer.invoke('whisper:is-ready')
      return ready
    } catch (e) {
      console.error('[preload][whisper.isReady] error:', e)
      throw e
    }
  },
  transcribe: async (inputPath, options) => {
    try {
      const result = await ipcRenderer.invoke('whisper:transcribe', inputPath, options)
      return result
    } catch (e) {
      console.error('[preload][whisper.transcribe] error:', e)
      throw e
    }
  },
  restart: async (modelFile) => {
    try {
      const res = await ipcRenderer.invoke('whisper:restart', modelFile)
      return res
    } catch (e) {
      console.error('[preload][whisper.restart] error:', e)
      throw e
    }
  }
}

const modelsAPI = {
  list: async () => {
    try {
      const list = await ipcRenderer.invoke('models:list')
      return list
    } catch (e) {
      console.error('[preload][models.list] error:', e)
      throw e
    }
  },
  dir: async () => {
    try {
      const dir = await ipcRenderer.invoke('models:dir')
      return dir
    } catch (e) {
      console.error('[preload][models.dir] error:', e)
      throw e
    }
  },
  remove: async (name) => {
    try {
      const res = await ipcRenderer.invoke('models:remove', name)
      return res
    } catch (e) {
      console.error('[preload][models.remove] error:', e)
      throw e
    }
  },
  download: async (url, fileName) => {
    try {
      const res = await ipcRenderer.invoke('models:download', url, fileName)
      return res
    } catch (e) {
      console.error('[preload][models.download] error:', e)
      throw e
    }
  }
}

// 聚合“视频转文字”管线 API
const pipelineAPI = {
  startVideoToText: async (inputPath, options) => {
    try {
      const res = await ipcRenderer.invoke('pipeline:video-to-text', inputPath, options)
      return res
    } catch (e) {
      console.error('[preload][pipeline.startVideoToText] error:', e)
      throw e
    }
  },
  onProgress: (cb) => {
    const listener = (_e, payload) => cb(payload)
    ipcRenderer.on('pipeline:progress', listener)
    return () => ipcRenderer.removeListener('pipeline:progress', listener)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('ffmpeg', ffmpegAPI)
    contextBridge.exposeInMainWorld('fileSystem', fileSystemAPI)
    contextBridge.exposeInMainWorld('whisper', whisperAPI)
    contextBridge.exposeInMainWorld('models', modelsAPI)
    contextBridge.exposeInMainWorld('pipeline', pipelineAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.ffmpeg = ffmpegAPI
  // @ts-ignore (define in dts)
  window.fileSystem = fileSystemAPI
  window.whisper = whisperAPI
  window.models = modelsAPI
  window.pipeline = pipelineAPI
}
