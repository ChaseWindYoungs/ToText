# FFmpeg 集成说明

本项目已经成功集成了 FFmpeg，可以在 Electron 应用中直接使用视频处理功能。

## 安装的依赖

- `@ffmpeg/ffmpeg`: FFmpeg 的 JavaScript 封装
- `@ffmpeg/core`: FFmpeg 核心库
- `@ffmpeg-installer/ffmpeg`: FFmpeg 二进制文件安装器

## 项目结构

```
src/
├── main/
│   ├── ffmpeg.ts          # FFmpeg 服务类
│   └── index.ts           # 主进程，包含 IPC 处理
├── preload/
│   ├── index.d.ts         # 类型定义
│   └── index.js           # 预加载脚本
└── renderer/
    └── src/
        ├── components/
        │   └── FFmpegDemo.tsx  # FFmpeg 演示组件
        └── App.tsx             # 主应用组件
```

## 主要功能

### 1. 视频转换
- 支持多种格式转换
- 可自定义编码器、比特率、分辨率
- 异步处理，不阻塞主线程

### 2. 缩略图提取
- 从视频中提取指定时间点的缩略图
- 支持自定义时间点

### 3. 视频信息获取
- 获取视频的基本信息
- 支持多种视频格式

### 4. 视频裁剪
- 按时间范围裁剪视频
- 支持精确的时间控制

## 使用方法

### 在渲染进程中使用

```typescript
// 检查 FFmpeg 是否就绪
const isReady = await window.ffmpeg.isReady();

// 转换视频
const result = await window.ffmpeg.convertVideo(
  'input.mp4',
  'output.mp4',
  {
    format: 'mp4',
    codec: 'libx264',
    bitrate: '1000k',
    resolution: '1280x720'
  }
);

// 提取缩略图
const thumbnailResult = await window.ffmpeg.extractThumbnail(
  'input.mp4',
  'thumbnail.jpg',
  '00:00:01'
);

// 获取视频信息
const infoResult = await window.ffmpeg.getVideoInfo('input.mp4');

// 裁剪视频
const trimResult = await window.ffmpeg.trimVideo(
  'input.mp4',
  'output.mp4',
  '00:00:10',
  '00:00:30'
);
```

### 在主进程中使用

```typescript
import { ffmpegService } from './ffmpeg';

// 直接使用服务
await ffmpegService.convertVideo('input.mp4', 'output.mp4');
```

## 构建配置

在 `electron-builder.yml` 中已经配置了：

```yaml
asarUnpack:
  - resources/**
  - node_modules/@ffmpeg/**
```

这确保 FFmpeg 相关的文件在打包时被正确包含。

## 注意事项

1. **文件路径**: 确保输入和输出文件路径是绝对路径或相对于应用根目录的路径
2. **内存管理**: FFmpeg 会自动清理临时文件，但建议在处理大文件时注意内存使用
3. **错误处理**: 所有 FFmpeg 操作都返回 Promise，建议使用 try-catch 进行错误处理
4. **格式支持**: 支持大多数常见的视频和音频格式

## 故障排除

### FFmpeg 未就绪
- 检查是否正确安装了依赖
- 查看控制台是否有错误信息
- 确保 `@ffmpeg/core` 文件存在

### 视频转换失败
- 检查输入文件是否存在且可读
- 确认输出目录有写入权限
- 查看具体的错误信息

### 性能问题
- 大文件处理可能需要较长时间
- 考虑在后台线程中处理
- 可以添加进度回调来显示处理状态

## 扩展功能

你可以基于现有的 FFmpeg 服务类添加更多功能：

- 批量处理
- 进度监控
- 更多编码器支持
- 音频处理功能
- 流媒体支持

## 许可证

FFmpeg 遵循 LGPL/GPL 许可证，请确保你的应用符合相关要求。 