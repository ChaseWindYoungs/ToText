import { createRoot } from 'react-dom/client'
import { ConfigProvider, theme as antdTheme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App.tsx'
import { ThemeProvider, useTheme } from './ThemeProvider'
// src/renderer/src/main.tsx
import './assets/tailwind.css'
import './assets/main.css'
import './assets/antd-custom.css'

const root = createRoot(document.getElementById('root')!)

function ThemedApp() {
  const { effective } = useTheme()
  const isDark = effective === 'dark'
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        },
      }}
    >
      <App />
    </ConfigProvider>
  )
}

root.render(
  <ThemeProvider>
    <ThemedApp />
  </ThemeProvider>
)