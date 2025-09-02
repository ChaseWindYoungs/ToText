import { spawn } from 'child_process';
import { join } from 'path';
import * as fs from 'fs';

// 模拟 fluent-ffmpeg 的 API 风格
class FluentFFmpeg {
  private inputPath: string = '';
  private outputPath: string = '';
  private options: any = {};
  private ffmpegPath: string;

  constructor(ffmpegPath: string) {
    this.ffmpegPath = ffmpegPath;
  }

  input(inputPath: string): FluentFFmpeg {
    this.inputPath = inputPath;
    return this;
  }

  output(outputPath: string): FluentFFmpeg {
    this.outputPath = outputPath;
    return this;
  }

  videoCodec(codec: string): FluentFFmpeg {
    this.options.videoCodec = codec;
    return this;
  }

  audioCodec(codec: string): FluentFFmpeg {
    this.options.audioCodec = codec;
    return this;
  }

  videoBitrate(bitrate: string): FluentFFmpeg {
    this.options.videoBitrate = bitrate;
    return this;
  }

  audioBitrate(bitrate: string): FluentFFmpeg {
    this.options.audioBitrate = bitrate;
    return this;
  }

  size(size: string): FluentFFmpeg {
    this.options.size = size;
    return this;
  }

  on(event: string, callback: Function): FluentFFmpeg {
    this.options[event] = callback;
    return this;
  }

  async run(): Promise<void> {
    const args = this.buildArgs();
    return this.executeFFmpeg(args);
  }

  private buildArgs(): string[] {
    const args = ['-i', this.inputPath];
    
    if (this.options.videoCodec) {
      args.push('-c:v', this.options.videoCodec);
    }
    if (this.options.audioCodec) {
      args.push('-c:a', this.options.audioCodec);
    }
    if (this.options.videoBitrate) {
      args.push('-b:v', this.options.videoBitrate);
    }
    if (this.options.audioBitrate) {
      args.push('-b:a', this.options.audioBitrate);
    }
    if (this.options.size) {
      args.push('-s', this.options.size);
    }
    
    args.push('-y', this.outputPath);
    return args;
  }

  private async executeFFmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn(this.ffmpegPath, args);
      
      let stderr = '';
      
      if (this.options.progress) {
        ffmpeg.stderr.on('data', (data) => {
          const output = data.toString();
          stderr += output;
          
          // 解析进度信息
          const progressMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
          if (progressMatch) {
            const hours = parseInt(progressMatch[1]);
            const minutes = parseInt(progressMatch[2]);
            const seconds = parseInt(progressMatch[3]);
            const centiseconds = parseInt(progressMatch[4]);
            const totalSeconds = hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
            
            if (this.options.progress) {
              this.options.progress(totalSeconds);
            }
          }
        });
      } else {
        ffmpeg.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(error);
      });
    });
  }
}

export class FFmpegService {
  private ffmpegPath: string;
  private isLoaded = false;

  constructor() {
    // 尝试找到 FFmpeg 二进制文件
    this.ffmpegPath = this.findFFmpegPath();
    this.isLoaded = !!this.ffmpegPath;
  }

  private findFFmpegPath(): string {
    // 优先使用应用资源目录中的 FFmpeg
    const appPath = process.env.NODE_ENV === 'development' ? process.cwd() : process.resourcesPath;
    
    const possiblePaths = [
      // 应用资源目录（打包后会被包含）
      join(appPath, 'resources', 'ffmpeg', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
      join(appPath, 'ffmpeg', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
      
      // 系统安装的 FFmpeg
      '/usr/local/bin/ffmpeg',
      '/usr/bin/ffmpeg',
      '/opt/homebrew/bin/ffmpeg',
      '/opt/local/bin/ffmpeg',
      
      // 开发环境下的 node_modules（仅用于开发）
      ...(process.env.NODE_ENV === 'development' ? [
        join(process.cwd(), 'node_modules', '@ffmpeg-installer', 'darwin-arm64', 'ffmpeg'),
        join(process.cwd(), 'node_modules', '@ffmpeg-installer', 'darwin-x64', 'ffmpeg'),
        join(process.cwd(), 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe'),
        join(process.cwd(), 'node_modules', '@ffmpeg-installer', 'linux-x64', 'ffmpeg'),
      ] : []),
      
      // 其他路径
      join(process.cwd(), 'ffmpeg', 'bin', 'ffmpeg'),
      join(process.cwd(), 'ffmpeg', 'ffmpeg.exe')
    ];

    for (const ffmpegPath of possiblePaths) {
      if (fs.existsSync(ffmpegPath)) {
        console.log(`Found FFmpeg at: ${ffmpegPath}`);
        return ffmpegPath;
      }
    }

    // 尝试使用 @ffmpeg-installer/ffmpeg 包
    try {
      const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
      if (ffmpegInstaller && ffmpegInstaller.path && fs.existsSync(ffmpegInstaller.path)) {
        console.log(`Found FFmpeg via installer at: ${ffmpegInstaller.path}`);
        return ffmpegInstaller.path;
      }
    } catch (error) {
      console.warn('Failed to load @ffmpeg-installer/ffmpeg:', error);
    }

    console.warn('FFmpeg not found in common paths');
    return '';
  }

  async load(): Promise<void> {
    if (this.isLoaded) return;
    
    try {
      // 检查 FFmpeg 是否可用
      await this.checkFFmpeg();
      this.isLoaded = true;
      console.log('FFmpeg loaded successfully');
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      throw error;
    }
  }

  private async checkFFmpeg(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ffmpegPath) {
        reject(new Error('FFmpeg binary not found'));
        return;
      }

      const ffmpeg = spawn(this.ffmpegPath, ['-version']);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg check failed with code ${code}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(error);
      });
    });
  }

  // 创建 fluent-ffmpeg 风格的实例
  ffmpeg(): FluentFFmpeg {
    return new FluentFFmpeg(this.ffmpegPath);
  }

  async convertVideo(inputPath: string, outputPath: string, options: {
    format?: string;
    codec?: string;
    bitrate?: string;
    resolution?: string;
    onProgress?: (progress: number) => void;
  } = {}): Promise<void> {
    if (!this.isLoaded) {
      await this.load();
    }

    const {
      codec = 'libx264',
      bitrate = '1000k',
      resolution = '1280x720',
      onProgress
    } = options;

    try {
      // 使用 fluent-ffmpeg 风格的 API
      const ffmpeg = this.ffmpeg()
        .input(inputPath)
        .output(outputPath)
        .videoCodec(codec)
        .audioCodec('aac')
        .videoBitrate(bitrate)
        .audioBitrate('128k')
        .size(resolution);

      if (onProgress) {
        ffmpeg.on('progress', onProgress);
      }

      await ffmpeg.run();
      console.log(`Video converted successfully: ${outputPath}`);
    } catch (error) {
      console.error('Video conversion failed:', error);
      throw error;
    }
  }

  async getVideoInfo(inputPath: string): Promise<any> {
    if (!this.isLoaded) {
      await this.load();
    }

    try {
      // 使用 ffprobe 获取视频信息
      const args = ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', '-i', inputPath];
      
      const result = await this.executeFFprobe(args);
      
      return {
        status: 'success',
        info: result
      };
    } catch (error) {
      console.error('Failed to get video info:', error);
      throw error;
    }
  }

  private async executeFFprobe(args: string[]): Promise<any> {
    return new Promise((resolve, reject) => {
      // 尝试使用 ffprobe，如果不存在则使用 ffmpeg -i
      const ffprobePath = this.ffmpegPath.replace('ffmpeg', 'ffprobe');
      
      if (fs.existsSync(ffprobePath)) {
        const ffprobe = spawn(ffprobePath, args);
        let stdout = '';
        let stderr = '';
        
        ffprobe.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        ffprobe.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        ffprobe.on('close', (code) => {
          if (code === 0) {
            try {
              resolve(JSON.parse(stdout));
            } catch (e) {
              resolve({ stdout, stderr });
            }
          } else {
            reject(new Error(`FFprobe failed with code ${code}: ${stderr}`));
          }
        });

        ffprobe.on('error', (error) => {
          reject(error);
        });
      } else {
        // 如果没有 ffprobe，使用 ffmpeg -i 命令
        const ffmpeg = spawn(this.ffmpegPath, ['-i', args[args.length - 1]]);
        let stderr = '';
        
        ffmpeg.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        ffmpeg.on('close', () => {
          // ffmpeg -i 通常返回非零代码，但 stderr 包含信息
          resolve({ stderr, format: 'ffmpeg' });
        });

        ffmpeg.on('error', (error) => {
          reject(error);
        });
      }
    });
  }

  async extractThumbnail(inputPath: string, outputPath: string, time: string = '00:00:01'): Promise<void> {
    if (!this.isLoaded) {
      await this.load();
    }

    try {
      // 添加时间偏移和帧数限制
      const args = ['-ss', time, '-vframes', '1', '-f', 'image2'];
      
      // 执行命令
      await this.executeFFmpegWithArgs(inputPath, outputPath, args);
      console.log(`Thumbnail extracted successfully: ${outputPath}`);
    } catch (error) {
      console.error('Thumbnail extraction failed:', error);
      throw error;
    }
  }

  private async executeFFmpegWithArgs(inputPath: string, outputPath: string, additionalArgs: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ['-i', inputPath, ...additionalArgs, '-y', outputPath];
      const ffmpeg = spawn(this.ffmpegPath, args);
      
      let stderr = '';
      
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(error);
      });
    });
  }

  async trimVideo(inputPath: string, outputPath: string, startTime: string, duration: string): Promise<void> {
    if (!this.isLoaded) {
      await this.load();
    }

    try {
      // 添加时间裁剪参数
      const args = ['-ss', startTime, '-t', duration];
      
      // 执行命令
      await this.executeFFmpegWithArgs(inputPath, outputPath, args);
      console.log(`Video trimmed successfully: ${outputPath}`);
    } catch (error) {
      console.error('Video trimming failed:', error);
      throw error;
    }
  }

  async extractAudio(inputPath: string, outputPath?: string, options?: { onProgress?: (percent: number) => void }): Promise<string> {
    if (!this.isLoaded) {
      await this.load();
    }

    try {
      // 预先获取视频总时长（秒），用于将 ffmpeg 的处理时间换算为百分比
      let durationSeconds = 0;
      try {
        const info = await this.getVideoInfo(inputPath);
        const durStr = info?.info?.format?.duration;
        const dur = durStr ? parseFloat(durStr) : NaN;
        if (!isNaN(dur) && isFinite(dur)) {
          durationSeconds = Math.max(0, dur);
        }
      } catch (_) {
        durationSeconds = 0;
      }

      // 如果没有指定输出路径，使用默认路径
      if (!outputPath) {
        const appPath = process.env.NODE_ENV === 'development' ? process.cwd() : process.resourcesPath;
        const fileName = `audio_${Date.now()}.mp3`;
        outputPath = join(appPath, 'audio', fileName);
        
        // 确保音频目录存在
        const audioDir = join(appPath, 'audio');
        if (!fs.existsSync(audioDir)) {
          fs.mkdirSync(audioDir, { recursive: true });
        }
      }

      // 使用 fluent-ffmpeg 风格的 API 提取音频
      const ffmpeg = this.ffmpeg()
        .input(inputPath)
        .output(outputPath)
        .audioCodec('mp3')
        .audioBitrate('128k')
        .videoCodec('copy') // 不处理视频，只提取音频
        .size('1x1'); // 最小尺寸，因为我们不需要视频

      if (options?.onProgress) {
        ffmpeg.on('progress', (processedSeconds: number) => {
          if (durationSeconds > 0) {
            const ratio = Math.min(1, Math.max(0, processedSeconds / durationSeconds));
            const percent = Math.round(ratio * 100);
            options.onProgress!(percent);
          } else {
            // 无法获取总时长时，降级为 0（由调用方选择是否显示不确定进度）
            options.onProgress!(0);
          }
        });
      }

      await ffmpeg.run();
      console.log(`Audio extracted successfully: ${outputPath}`);
      
      return outputPath;
    } catch (error) {
      console.error('Audio extraction failed:', error);
      throw error;
    }
  }

  isReady(): boolean {
    return this.isLoaded;
  }
}

// 创建单例实例
export const ffmpegService = new FFmpegService(); 