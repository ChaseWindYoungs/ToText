import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Transcribe from './pages/Transcribe'
import ThemeToggle from './components/ThemeToggle'

function App() {
  return (
    <HashRouter>
      <ThemeToggle />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/transcribe" element={<Transcribe />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
export default App
