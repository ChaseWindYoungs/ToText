import React, { useState, useRef, useEffect } from 'react'
import { FileLoader, FileLoadResult } from '../utils/fileLoader'
import FilePreview from './FilePreview'

interface FFmpegDemoProps {}

const FFmpegDemo: React.FC<FFmpegDemoProps> = () => {
  const [inputFilePath, setInputFilePath] = useState<string>('')
  const [outputPath, setOutputPath] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState<string>('')
  const [ffmpegReady, setFfmpegReady] = useState<boolean>(false)
  const [extractedAudioPath, setExtractedAudioPath] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 检查FFmpeg是否就绪
  React.useEffect(() => {
    const checkFFmpeg = async () => {
      try {
        const ready = await window.ffmpeg.isReady()
        setFfmpegReady(ready)
      } catch (error) {
        console.error('FFmpeg not available:', error)
        setFfmpegReady(false)
      }
    }
    checkFFmpeg()
  }, [])

  const handleFileSelect = async () => {
    try {
      const filePath = await window.fileSystem.selectFile({
        filters: [
          { name: '视频文件', extensions: ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv'] },
          { name: '音频文件', extensions: ['mp3', 'wav', 'aac', 'flac', 'ogg'] },
          { name: '所有文件', extensions: ['*'] }
        ]
      })

      if (filePath) {
        setInputFilePath(filePath)
        const fileName = filePath.split(/[/\\]/).pop() || ''
        setOutputPath(fileName.replace(/\.[^/.]+$/, '_converted.mp4'))

        // 获取文件信息
        const fileInfo = await window.fileSystem.getFileInfo(filePath)
        if (fileInfo) {
          const sizeMB = (fileInfo.size / (1024 * 1024)).toFixed(2)
          setMessage(`已选择文件: ${fileName} (${sizeMB} MB)`)
        }
      }
    } catch (error) {
      console.error('文件选择错误:', error)
      setMessage('文件选择失败')
    }
  }

  const handleConvert = async () => {
    if (!inputFilePath) {
      setMessage('请先选择输入文件')
      return
    }

    setIsProcessing(true)
    setMessage('正在转换视频...')

    try {
      const result = await window.ffmpeg.convertVideo(inputFilePath, outputPath, {
        format: 'mp4',
        codec: 'libx264',
        bitrate: '1000k',
        resolution: '1280x720'
      })

      if (result.success) {
        setMessage(result.message || '视频转换成功！')
      } else {
        setMessage(`转换失败: ${result.error}`)
      }
    } catch (error) {
      setMessage(`转换出错: ${error}`)
      console.error('转换出错:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleExtractThumbnail = async () => {
    if (!inputFilePath) {
      setMessage('请先选择输入文件')
      return
    }

    setIsProcessing(true)
    setMessage('正在提取缩略图...')

    try {
      const thumbnailPath = inputFilePath.replace(/\.[^/.]+$/, '_thumbnail.jpg')

      const result = await window.ffmpeg.extractThumbnail(inputFilePath, thumbnailPath, '00:00:01')

      if (result.success) {
        setMessage(result.message || '缩略图提取成功！')
      } else {
        setMessage(`提取失败: ${result.error}`)
      }
    } catch (error) {
      console.error('提取出错:', error)
      setMessage(`提取出错: ${error}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleGetInfo = async () => {
    if (!inputFilePath) {
      setMessage('请先选择输入文件')
      return
    }

    setIsProcessing(true)
    setMessage('正在获取视频信息...')

    try {
      const result = await window.ffmpeg.getVideoInfo(inputFilePath)

      if (result.success) {
        setMessage(`视频信息获取成功: ${JSON.stringify(result.info)}`)
      } else {
        setMessage(`获取失败: ${result.error}`)
      }
    } catch (error) {
      console.error('获取出错:', error)
      setMessage(`获取出错: ${error}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleExtractAudio = async () => {
    if (!inputFilePath) {
      setMessage('请先选择输入文件')
      return
    }

    setIsProcessing(true)
    setMessage('正在提取音频...')

    try {
      const result = await window.ffmpeg.extractAudio(inputFilePath)

      if (result.success && result.audioPath) {
        setExtractedAudioPath(result.audioPath)
        setMessage(result.message || '音频提取成功！')
      } else {
        setMessage(`音频提取失败: ${result.error}`)
      }
    } catch (error) {
      console.error('音频提取出错:', error)
      setMessage(`音频提取出错: ${error}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div
      className="ffmpeg-demo"
      style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', overflow: 'auto' }}
    >

      <div style={{ marginBottom: '20px' }}>
        <p>
          FFmpeg 状态:
          <span
            style={{
              color: ffmpegReady ? 'green' : 'red',
              fontWeight: 'bold',
              marginLeft: '10px'
            }}
          >
            {ffmpegReady ? '就绪' : '未就绪'}
          </span>
        </p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={handleFileSelect}
          style={{
            marginBottom: '10px',
            padding: '10px 20px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          选择文件
        </button>
        {inputFilePath && <p>已选择文件: {inputFilePath}</p>}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label>
          输出路径:
          <input
            type="text"
            value={outputPath}
            onChange={(e) => setOutputPath(e.target.value)}
            style={{ marginLeft: '10px', width: '300px' }}
            placeholder="输出文件路径"
          />
        </label>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button
          style={{
            marginRight: '10px',
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: isProcessing ? 'not-allowed' : 'pointer'
          }}
          onClick={async () => {
            try {
              // 启动本地服务（如果已经启动会立即返回）
              const models = await window.models.list()
              const useModel =
                models.find((m) => m.name.includes('small'))?.name || 'ggml-tiny-q5_1.bin'
              const res = await window.whisper.start({ model: useModel, threads: 4, port: 8089 })
              if (!res.success) {
                alert(`启动失败: ${res.error}`)
                return
              }
              alert('Whisper 本地服务已启动')
            } catch (e: any) {
              alert(`启动出错: ${e?.message || e}`)
            }
          }}
        >
          启动 Whisper 本地服务
        </button>
        <button
          style={{
            marginRight: '10px',
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: isProcessing ? 'not-allowed' : 'pointer'
          }}
          onClick={async () => {
            if (!inputFilePath) return alert('请先选择文件')
            const ready = await window.whisper.isReady()
            if (!ready) {
              // 服务未就绪也可以直接 transcribe（会回退到 CLI）
              console.warn('whisper 服务未就绪，使用 CLI 回退')
            }
            const { success, output, error } = await window.whisper.transcribe(inputFilePath, {
              language: 'zh',
              format: 'srt',
              translate: false
            })
            if (success) {
              alert(`转写完成: ${output}`)
            } else {
              alert(`转写失败: ${error}`)
            }
          }}
        >
          转写当前文件
        </button>
        <button
          onClick={handleConvert}
          disabled={!ffmpegReady || !inputFilePath || isProcessing}
          style={{
            marginRight: '10px',
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: isProcessing ? 'not-allowed' : 'pointer'
          }}
        >
          {isProcessing ? '处理中...' : '转换视频'}
        </button>
        <button
          onClick={handleExtractThumbnail}
          disabled={!ffmpegReady || !inputFilePath || isProcessing}
          style={{
            marginRight: '10px',
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: isProcessing ? 'not-allowed' : 'pointer'
          }}
        >
          提取缩略图
        </button>
        <button
          onClick={handleGetInfo}
          disabled={!ffmpegReady || !inputFilePath || isProcessing}
          style={{
            padding: '10px 20px',
            backgroundColor: '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: isProcessing ? 'not-allowed' : 'pointer'
          }}
        >
          获取视频信息
        </button>
        <button
          onClick={handleExtractAudio}
          disabled={!ffmpegReady || !inputFilePath || isProcessing}
          style={{
            marginRight: '10px',
            padding: '10px 20px',
            backgroundColor: '#6f42c1',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: isProcessing ? 'not-allowed' : 'pointer'
          }}
        >
          {isProcessing ? '提取中...' : '提取音频'}
        </button>
      </div>

      {/* 音频播放器 */}
      {extractedAudioPath && (
        <div style={{ marginTop: '20px' }}>
          <h3>提取的音频:</h3>
          <audio controls style={{ width: '100%' }}>
            <source src={`myapp://${extractedAudioPath}`} type="audio/mpeg" />
            您的浏览器不支持音频播放。
          </audio>
          <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            音频文件路径: {extractedAudioPath}
          </p>
        </div>
      )}

      {message && (
        <div
          style={{
            padding: '10px',
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '5px',
            marginTop: '20px',
            color: 'black'
          }}
        >
          <strong>状态:</strong> {message}
        </div>
      )}

      <div style={{ marginTop: '30px', fontSize: '14px', color: '#666' }}>
        <h3>功能说明:</h3>
        <ul>
          <li>
            <strong>转换视频:</strong> 将输入视频转换为MP4格式，支持自定义编码、比特率和分辨率
          </li>
          <li>
            <strong>提取缩略图:</strong> 从视频中提取指定时间点的缩略图
          </li>
          <li>
            <strong>获取视频信息:</strong> 获取视频的基本信息
          </li>
        </ul>
      </div>
    </div>
  )
}

export default FFmpegDemo
