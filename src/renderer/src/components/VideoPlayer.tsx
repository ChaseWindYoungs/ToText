import React from 'react'

declare global {
  interface Window {
    videojs?: any
  }
}

function loadVideoJsAssets(): Promise<void> {
  if ((window as any).__videojs_loading__) return (window as any).__videojs_loading__
  const promise = new Promise<void>((resolve, reject) => {
    const ensureCss = () => {
      const exists = document.querySelector('link[data-videojs="true"]')
      if (exists) return
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://cdn.jsdelivr.net/npm/video.js@8/dist/video-js.min.css'
      link.setAttribute('data-videojs', 'true')
      document.head.appendChild(link)
    }

    const ensureJs = () => {
      if (window.videojs) return resolve()
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/video.js@8/dist/video.min.js'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load video.js'))
      document.head.appendChild(script)
    }

    try {
      ensureCss()
      ensureJs()
    } catch (e) {
      reject(e as any)
    }
  })
  ;(window as any).__videojs_loading__ = promise
  return promise
}

export interface VideoPlayerProps {
  src: string
  poster?: string
  loop?: boolean
  muted?: boolean
  autoplay?: boolean
  fluid?: boolean
  onError?: () => void
}

export default function VideoPlayer(props: VideoPlayerProps): React.JSX.Element {
  const { src, poster, loop, muted, autoplay, fluid = true, onError } = props
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const playerRef = React.useRef<any>(null)

  React.useEffect(() => {
    let disposed = false
    let player: any

    loadVideoJsAssets()
      .then(() => {
        if (!videoRef.current || disposed || !window.videojs) return
        player = window.videojs(videoRef.current, {
          controls: true,
          autoplay: Boolean(autoplay),
          loop: Boolean(loop),
          muted: Boolean(muted),
          fluid: Boolean(fluid),
          preload: 'auto'
        })
        playerRef.current = player
        player.src({ src, type: undefined })
        // player.addRemoteTextTrack(
        //   { kind: 'subtitles', src: 'myapp://path/to/sub_zh.vtt', srclang: 'zh', label: '中文' },
        //   false
        // )
        if (poster) player.poster(poster)
        if (onError && typeof player.on === 'function') {
          player.on('error', onError)
        }
      })
      .catch(() => {})

    return () => {
      disposed = true
      try {
        if (playerRef.current && onError && typeof playerRef.current.off === 'function') {
          playerRef.current.off('error', onError)
        }
        if (playerRef.current && typeof playerRef.current.dispose === 'function') {
          playerRef.current.dispose()
        }
      } catch {}
      playerRef.current = null
    }
  }, [])

  React.useEffect(() => {
    if (playerRef.current && typeof playerRef.current.src === 'function') {
      playerRef.current.src({ src, type: undefined })
    }
  }, [src])

  return (
    <div data-vjs-player>
      <video ref={videoRef} className="video-js vjs-default-skin" onError={onError} controls >
        {/* <source src="myapp://path/to/video.mp4" type="video/mp4" />
        <track kind="subtitles" src="myapp://path/to/sub_zh.vtt" srclang="zh" label="中文" default />
        <track kind="subtitles" src="myapp://path/to/sub_en.vtt" srclang="en" label="English" /> */}
      </video>
    </div>
  )
}


