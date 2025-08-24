export interface FileLoadResult {
  success: boolean;
  data?: string | ArrayBuffer;
  url?: string;
  error?: string;
  type: 'data-url' | 'blob-url' | 'file-path';
}

export class FileLoader {
  /**
   * 通用文件加载方法
   * @param file 文件对象或文件路径
   * @param options 加载选项
   */
  static async loadFile(
    file: File | string | ArrayBuffer,
    options: {
      maxSize?: number; // 最大文件大小（MB）
      allowedTypes?: string[]; // 允许的文件类型
      preferBlob?: boolean; // 是否优先使用blob URL
    } = {}
  ): Promise<FileLoadResult> {
    try {
      const { maxSize = 100, allowedTypes, preferBlob = false } = options;

      // 处理不同类型的输入
      if (typeof file === 'string') {
        return this.loadFromPath(file);
      } else if (file instanceof ArrayBuffer) {
        return this.loadFromArrayBuffer(file);
      } else if (file instanceof File) {
        return this.loadFromFile(file, { maxSize, allowedTypes, preferBlob });
      } else {
        throw new Error('不支持的文件类型');
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        type: 'data-url'
      };
    }
  }

  /**
   * 从File对象加载
   */
  private static async loadFromFile(
    file: File,
    options: { maxSize: number; allowedTypes?: string[]; preferBlob: boolean }
  ): Promise<FileLoadResult> {
    // 检查文件大小
    if (file.size > options.maxSize * 1024 * 1024) {
      throw new Error(`文件大小超过限制 (${options.maxSize}MB)`);
    }

    // 检查文件类型
    if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
      throw new Error(`不支持的文件类型: ${file.type}`);
    }

    // 根据文件类型和大小选择最佳加载方式
    if (file.size < 10 * 1024 * 1024 && !options.preferBlob) {
      // 小文件使用data URL
      return this.createDataURL(file);
    } else {
      // 大文件使用blob URL
      return this.createBlobURL(file);
    }
  }

  /**
   * 从ArrayBuffer加载
   */
  private static async loadFromArrayBuffer(buffer: ArrayBuffer): Promise<FileLoadResult> {
    try {
      const base64 = this.arrayBufferToBase64(buffer);
      return {
        success: true,
        data: base64,
        type: 'data-url'
      };
    } catch (error) {
      throw new Error('ArrayBuffer转换失败');
    }
  }

  /**
   * 从文件路径加载
   */
  private static async loadFromPath(path: string): Promise<FileLoadResult> {
    return {
      success: true,
      url: path,
      type: 'file-path'
    };
  }

  /**
   * 创建data URL
   */
  private static async createDataURL(file: File): Promise<FileLoadResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          success: true,
          data: reader.result as string,
          type: 'data-url'
        });
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * 创建blob URL
   */
  private static async createBlobURL(file: File): Promise<FileLoadResult> {
    const url = URL.createObjectURL(file);
    return {
      success: true,
      url,
      type: 'blob-url'
    };
  }

  /**
   * ArrayBuffer转Base64
   */
  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * 清理资源
   */
  static cleanup(url: string): void {
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }

  /**
   * 获取文件类型信息
   */
  static getFileTypeInfo(file: File): {
    isImage: boolean;
    isVideo: boolean;
    isAudio: boolean;
    isDocument: boolean;
    mimeType: string;
  } {
    const mimeType = file.type;
    const isImage = mimeType.startsWith('image/');
    const isVideo = mimeType.startsWith('video/');
    const isAudio = mimeType.startsWith('audio/');
    const isDocument = mimeType.includes('pdf') || mimeType.includes('document');

    return {
      isImage,
      isVideo,
      isAudio,
      isDocument,
      mimeType
    };
  }
} 