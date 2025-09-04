import React from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'
interface ThemeContextValue { mode: ThemeMode; effective: 'light' | 'dark'; setMode: (m: ThemeMode) => void }
const ThemeContext = React.createContext<ThemeContextValue | null>(null)

const prefersDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches
const effectiveOf = (m: ThemeMode) => m === 'system' ? (prefersDark() ? 'dark' : 'light') : m

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = React.useState<ThemeMode>(() => (localStorage.getItem('theme-mode') as ThemeMode) || 'system')
  const [effective, setEffective] = React.useState<'light' | 'dark'>(effectiveOf(mode))

  React.useEffect(() => {
    const apply = () => {
      const eff = effectiveOf(mode)
      setEffective(eff)
      const el = document.documentElement
      eff === 'dark' ? el.classList.add('dark') : el.classList.remove('dark')
    }
    apply()
    localStorage.setItem('theme-mode', mode)
    if (mode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const onChange = () => apply()
      mq.addEventListener?.('change', onChange)
      return () => mq.removeEventListener?.('change', onChange)
    }
  }, [mode])

  return <ThemeContext.Provider value={{ mode, effective, setMode }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}