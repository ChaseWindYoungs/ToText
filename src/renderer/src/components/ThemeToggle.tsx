import React from 'react'
import { Segmented, Tooltip } from 'antd'
import { useTheme } from '../ThemeProvider'

export default function ThemeToggle() {
  const { mode, setMode } = useTheme()
  return (
    <div className="fixed right-3 top-3 z-50">
      <Tooltip title="主题模式">
        <Segmented
          size="small"
          value={mode}
          onChange={(v) => setMode(v as any)}
          options={[
            { label: '亮', value: 'light' },
            { label: '暗', value: 'dark' },
            { label: '系统', value: 'system' },
          ]}
        />
      </Tooltip>
    </div>
  )
}