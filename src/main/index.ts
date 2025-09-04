import { app, shell, BrowserWindow, ipcMain, protocol } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import IpcEvent from '../ipcMain/index'
import { ffmpegService } from './ffmpeg'
import fs from 'fs'
import path from 'path'
import https from 'https'
import express from 'express'
import selfsigned from 'selfsigned'

let _IpcEvent: any
let serverCloser: undefined | (() => void)

// 注册自定义协议
function registerCustomProtocol(): void {
  console.log('正在注册自定义协议 myapp://')
  
  protocol.registerFileProtocol('myapp', (request, callback) => {
    try {
      console.log('协议请求:', request.url)
      
      // 解析URL，移除协议前缀
      const filePath = request.url.replace('myapp://', '')
      
      console.log('解析后的文件路径:', filePath)
      
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        console.error('文件不存在:', filePath)
        callback({ error: -2 }) // 文件不存在
        return
      }
      
      console.log('文件存在，返回路径:', filePath)
      callback(filePath)
    } catch (error) {
      console.error('协议处理错误:', error)
      callback({ error: -2 })
    }
  })
  
  console.log('自定义协议注册完成')
}
async function startLocalHttpsServer(): Promise<{ url: string, close: () => void }> {
  const attrs = [{ name: 'commonName', value: 'localhost' }]
  const pems = selfsigned.generate(attrs, { days: 365, keySize: 2048 })

  const appSrv = express()
  const staticDir = path.join(__dirname, '../renderer')

  appSrv.use(express.static(staticDir))
  appSrv.get('*', (_, res) => res.sendFile(path.join(staticDir, 'index.html')))

  const server = https.createServer({ key: pems.private, cert: pems.cert }, appSrv)

  const port = 8443
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve))

  return {
    url: `https://127.0.0.1:${port}/index.html`,
    close: () => server.close()
  }
}

async function createWindow(): Promise<void> {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: true,        // 开启Node.js集成
      contextIsolation: false,      // 关闭上下文隔离
      enableRemoteModule: true,     // 启用远程模块
      webSecurity: false            // 关闭web安全限制
    }
  })

  // 设置 CSP 头允许自定义协议
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' https: 'unsafe-inline' 'unsafe-eval' data: blob: myapp:; media-src 'self' https: data: blob: myapp:; img-src 'self' https: data: blob: myapp:; script-src 'self' https: 'unsafe-inline' 'unsafe-eval';"
        ]
      }
    })
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // 放宽仅限 localhost/127.0.0.1 的证书校验
  mainWindow.webContents.session.setCertificateVerifyProc((request, callback) => {
    if (request.hostname === 'localhost' || request.hostname === '127.0.0.1') callback(0)
    else callback(-3)
  })

  // 开发环境：由 electron-vite 提供的 https dev server
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    // 生产环境：本地 https 静态服务
    const { url, close } = await startLocalHttpsServer()
    serverCloser = close
    await mainWindow.loadURL(url)
  }

  _IpcEvent = new IpcEvent(mainWindow)

  mainWindow.on('closed', () => {
    if (serverCloser) serverCloser()
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // 先注册自定义协议，等待完成
  registerCustomProtocol()
  
  // 等待一小段时间确保协议注册完成
  await new Promise(resolve => setTimeout(resolve, 100))

  // 放宽默认会话对本地自签名证书的校验
  app.whenReady().then(() => {
    const ses = (BrowserWindow.getFocusedWindow()?.webContents.session) || null
    if (!ses) {
      // 如果此时没有窗口会话，使用默认会话
      // 仅对 localhost/127.0.0.1 放行
      require('electron').session.defaultSession.setCertificateVerifyProc((request, callback) => {
        if (request.hostname === 'localhost' || request.hostname === '127.0.0.1') callback(0)
        else callback(-3)
      })
    }
  })

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  
  // 然后创建窗口
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// https://v.douyin.com/vmgTwVa3kr0/
// https://v.douyin.com/1F8KIquViAo/
// https://v.douyin.com/KJQhSTYHwxc/
// https://v.douyin.com/aAMM17vrQj8/
// https://v.douyin.com/6JXt7JiqYm0/

