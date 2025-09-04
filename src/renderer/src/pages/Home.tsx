import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Typography } from 'antd'
import bridge from '../utils/bridge'

function Home(): React.JSX.Element {
  const navigate = useNavigate()

  const handleSelect = async () => {
    const filePath = await bridge.selectFile({
      filters: [
        { name: '视频文件', extensions: ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv'] },
        { name: '音频文件', extensions: ['mp3', 'wav', 'aac', 'flac', 'ogg'] }
      ]
    })
    if (filePath) {
      navigate(`/transcribe?path=${encodeURIComponent(filePath)}`)
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <Typography.Title level={3} style={{ margin: 0 }}>选择一个视频/音频文件</Typography.Title>
      <Button type="primary" size="large" onClick={handleSelect}>选择文件</Button>
    </div>
  )
}

export default Home


