import React from 'react'
import { useLocation } from 'react-router-dom'
import {
  Button,
  Typography,
  Card,
  Descriptions,
  Progress,
  Input,
  Alert,
  Space,
  Row,
  Col,
  Divider
} from 'antd'
import WaveSurfer from 'wavesurfer.js'
import VideoPlayer from '../components/VideoPlayer'
import bridge from '../utils/bridge'

function useQuery() {
  const { search } = useLocation()
  return React.useMemo(() => new URLSearchParams(search), [search])
}

function Transcribe(): React.JSX.Element {
  const query = useQuery()
  const filePath = query.get('path') || ''
  const [info, setInfo] = React.useState<any>(null)
  const [phase, setPhase] = React.useState<'extract' | 'transcribe' | 'done' | 'error' | ''>('')
  const [percent, setPercent] = React.useState<number>(0)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [audioPath, setAudioPath] = React.useState<string>('')
  const [outputPath, setOutputPath] = React.useState<string>('')
  const [outputText, setOutputText] = React.useState<string>('')
  const [message, setMessage] = React.useState<string>('')

  // 播放器与波形相关
  // 移除未使用的 videoRef
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const waveContainerRef = React.useRef<HTMLDivElement | null>(null)
  const waveSurferRef = React.useRef<WaveSurfer | null>(null)
  const [videoError, setVideoError] = React.useState<boolean>(false)

  const isAudio = React.useMemo(() => /\.(mp3|wav|aac|flac|ogg|m4a)$/i.test(filePath), [filePath])
  const isVideo = React.useMemo(
    () => /\.(mp4|avi|mov|mkv|wmv|flv|webm)$/i.test(filePath),
    [filePath]
  )

  // 无需额外清理逻辑，这里的进度订阅在 handleStart 中返回后已手动停止

  React.useEffect(() => {
    const loadInfo = async () => {
      if (!filePath) return
      try {
        const result = await bridge.getVideoInfo(filePath)
        if (result?.success) setInfo(result.info)
      } catch (e) {
        // ignore
      }
    }
    loadInfo()
  }, [filePath])

  const ensureWaveSurfer = React.useCallback((audioSrc: string) => {
    if (!waveContainerRef.current || !audioRef.current) return
    if (waveSurferRef.current) {
      try {
        waveSurferRef.current.destroy()
      } catch {}
      waveSurferRef.current = null
    }
    audioRef.current.src = `myapp://${audioSrc}`
    // 注意：使用 MediaElement 模式与现有 audio 元素绑定，保持播放状态同步
    waveSurferRef.current = WaveSurfer.create({
      container: waveContainerRef.current,
      media: audioRef.current,
      waveColor: '#91caff',
      progressColor: '#1677ff',
      height: 80,
      cursorColor: '#1677ff'
    })
  }, [])

  const handleInitWaveform = async () => {
    try {
      // 优先使用已有的 pipeline 生成的音频
      if (audioPath) {
        ensureWaveSurfer(audioPath)
        return
      }
      // 若是音频源文件，直接用原文件
      if (isAudio) {
        ensureWaveSurfer(filePath)
        return
      }
      // 若是视频，先提取音频再初始化
      if (isVideo) {
        const result = await bridge.extractAudio(filePath)
        if (result?.success && result.audioPath) {
          setAudioPath(result.audioPath)
          ensureWaveSurfer(result.audioPath)
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // 删除转码逻辑，遵循“不要使用 ffmpeg 转码”的需求

  const handleStart = async () => {
    if (!filePath || isProcessing) return
    setIsProcessing(true)
    setPhase('')
    setPercent(0)
    setAudioPath('')
    setOutputPath('')
    setOutputText('')
    setMessage('正在执行：提取音频并转写...')

    const stop = bridge.pipelineOnProgress(({ phase: p, percent: pct, message: msg }) => {
      if (p === 'extract' || p === 'transcribe') {
        setPhase(p)
        if (typeof pct === 'number') setPercent(pct)
      } else if (p === 'done') {
        setPhase('done')
        setPercent(100)
      } else if (p === 'error') {
        setPhase('error')
        setMessage(msg || '处理出错')
      }
    })

    try {
      const {
        success,
        audioPath: ap,
        output,
        error
      } = await bridge.pipelineStartVideoToText(filePath, {
        whisper: { format: 'srt', language: 'auto', translate: false }
      })
      if (success) {
        if (ap) setAudioPath(ap)
        if (output) {
          setOutputPath(output)
          try {
            const content = await bridge.readFileAsText(output)
            if (typeof content === 'string') setOutputText(content)
          } catch {}
        }
        setMessage('完成！')
      } else {
        setMessage(`失败：${error || ''}`)
      }
    } catch (e: any) {
      setMessage(`出错：${e?.message || String(e)}`)
    } finally {
      stop()
      setIsProcessing(false)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <Row gutter={16}>
        <Col span={14}>
          <Card size="small" title="媒体预览">
            {/* 视频或音频播放区 */}
            {isVideo && (
              <>
                <VideoPlayer src={`myapp://${filePath}`} onError={() => setVideoError(true)} />
                {videoError && (
                  <Space  className="mt-12">
                    <Alert
                      type="warning"
                      showIcon
                      message="若无法播放，可能是 Chromium 解码不支持该封装/编码"
                    />
                  </Space>
                )}
              </>
            )}
            {isAudio && !isVideo && (
              <audio
                ref={audioRef}
                controls
                src={`myapp://${filePath}`}
                style={{ width: '100%' }}
              />
            )}

            <Divider className="my-4" />
            <Space>
              <Button onClick={handleInitWaveform}>显示波形</Button>
              <Button
                type="primary"
                onClick={handleStart}
                disabled={!filePath || isProcessing}
                loading={isProcessing}
              >
                一键转文字
              </Button>
            </Space>

            {(phase || isProcessing) && (
              <div className="mt-4">
                <Progress
                  percent={Math.max(0, Math.min(100, percent))}
                  status={phase === 'error' ? 'exception' : percent === 100 ? 'success' : 'active'}
                />
                <Typography.Text type="secondary">阶段：{phase || '等待'}</Typography.Text>
              </div>
            )}

            {/* 波形 */}
            <div className="mt-4">
              <Card size="small" title="音频波形">
                <div ref={waveContainerRef} />
                {/* 绑定到隐藏的 audio 元素，实现与波形同步的播放控制 */}
                <audio ref={audioRef} className="hidden" />
              </Card>
            </div>

            {audioPath && (
              <Card size="small" className="mt-4" title="音频文件">
                <Typography.Text className="break-all">{audioPath}</Typography.Text>
              </Card>
            )}
          </Card>

          {info && (
            <Card size="small" className="mt-4" title="媒体信息">
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="原始">
                  {typeof info === 'string' ? info : null}
                </Descriptions.Item>
              </Descriptions>
              {!info || typeof info === 'string' ? null : (
                <pre className="m-0 whitespace-pre-wrap break-words">
                  {JSON.stringify(info, null, 2)}
                </pre>
              )}
            </Card>
          )}
        </Col>
        <Col span={10}>
          {/* 右侧结果 */}
          <Card size="small" title="转义结果">
            {outputPath && (
              <div className="mb-3">
                <Typography.Text strong>结果文件：</Typography.Text>
                <Typography.Text className="break-all"> {outputPath}</Typography.Text>
              </div>
            )}
            <Input.TextArea
              readOnly
              value={outputText}
              autoSize={{ minRows: 20 }}
              className="font-mono"
            />
          </Card>
          {message && (
            <Alert
              className="mt-4"
              message="状态"
              description={message}
              type={phase === 'error' ? 'error' : 'info'}
              showIcon
            />
          )}
        </Col>
      </Row>
    </div>
  )
}

export default Transcribe
