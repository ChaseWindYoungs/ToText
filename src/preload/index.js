import { contextBridge, ipcRenderer } from 'electron'
// import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const electronAPI = {
  ping: () => ipcRenderer.send('ping'),
  openFile: async () => {
    console.log(111)
    const res = await ipcRenderer.invoke('open-file')
    console.log(res)
  },
  readAudioFile: (filePath) => ipcRenderer.invoke('ffmpeg:read-audio-file', filePath)
}

const ffmpegAPI = {
  convertVideo: (inputPath, outputPath, options) =>
    ipcRenderer.invoke('ffmpeg:convert-video', inputPath, outputPath, options),
  getVideoInfo: (inputPath) => ipcRenderer.invoke('ffmpeg:get-video-info', inputPath),
  extractThumbnail: (inputPath, outputPath, time) =>
    ipcRenderer.invoke('ffmpeg:extract-thumbnail', inputPath, outputPath, time),
  trimVideo: (inputPath, outputPath, startTime, duration) =>
    ipcRenderer.invoke('ffmpeg:trim-video', inputPath, outputPath, startTime, duration),
  extractAudio: (inputPath, outputPath) =>
    ipcRenderer.invoke('ffmpeg:extract-audio', inputPath, outputPath),
  isReady: () => ipcRenderer.invoke('ffmpeg:is-ready')
}

// 文件系统相关API
const fileSystemAPI = {
  selectFile: (options) => ipcRenderer.invoke('file:select-file', options),
  selectDirectory: () => ipcRenderer.invoke('file:select-directory'),
  getFileInfo: (filePath) => ipcRenderer.invoke('file:get-info', filePath),
  readFile: (filePath) => ipcRenderer.invoke('file:read-file', filePath) // 新增
}

// Whisper 与模型 API
const whisperAPI = {
  start: (opts) => ipcRenderer.invoke('whisper:start', opts),
  stop: () => ipcRenderer.invoke('whisper:stop'),
  isReady: () => ipcRenderer.invoke('whisper:is-ready'),
  transcribe: (inputPath, options) => ipcRenderer.invoke('whisper:transcribe', inputPath, options),
  restart: (modelFile) => ipcRenderer.invoke('whisper:restart', modelFile)
}

const modelsAPI = {
  list: () => ipcRenderer.invoke('models:list'),
  dir: () => ipcRenderer.invoke('models:dir'),
  remove: (name) => ipcRenderer.invoke('models:remove', name),
  download: (url, fileName) => ipcRenderer.invoke('models:download', url, fileName)
}

// 聚合“视频转文字”管线 API
const pipelineAPI = {
  startVideoToText: (inputPath, options) =>
    ipcRenderer.invoke('pipeline:video-to-text', inputPath, options),
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
