import Versions from './components/Versions'
import FFmpegDemo from './components/FFmpegDemo'
import electronLogo from './assets/electron.svg'

function App(): React.JSX.Element {
  const ipcHandle = (): void => {
    console.log('wwww')
    window.electron.openFile()
  }

  return (
    <>
      {/* <div style={{ textAlign: 'center', padding: '20px' }}>
        <img alt="logo" className="logo" src={electronLogo} style={{ width: '100px', height: '100px' }} />
        <div className="creator">Powered by electron-vite</div>
        <div className="text">
          Build an Electron app with <span className="react">React</span>
          &nbsp;and <span className="ts">TypeScript</span>
        </div>
        <p className="tip">
          Please try pressing <code>F12</code> to open the devTool
        </p>
        <div className="actions">
          <div className="action">
            <a href="https://electron-vite.org/" target="_blank" rel="noreferrer">
              Documentation
            </a>
          </div>
          <div className="action">
            <a target="_blank" rel="noreferrer" onClick={ipcHandle}>
              Send IPC
            </a>
          </div>
        </div>
      </div> */}
      
      <hr style={{ margin: '40px 0' }} />
      
      <FFmpegDemo />
    </>
  )
}

export default App
