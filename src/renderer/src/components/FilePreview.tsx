import React, { useState, useEffect } from 'react';
import { FileLoader, FileLoadResult } from '../utils/fileLoader';

interface FilePreviewProps {
  file: File | string | ArrayBuffer;
  maxSize?: number;
  allowedTypes?: string[];
  onLoad?: (result: FileLoadResult) => void;
  onError?: (error: string) => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({
  file,
  maxSize = 100,
  allowedTypes,
  onLoad,
  onError
}) => {
  const [result, setResult] = useState<FileLoadResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFile();
  }, [file]);

  const loadFile = async () => {
    setLoading(true);
    try {
      const loadResult = await FileLoader.loadFile(file, {
        maxSize,
        allowedTypes,
        preferBlob: false
      });

      setResult(loadResult);
      onLoad?.(loadResult);

      if (!loadResult.success) {
        onError?.(loadResult.error || '加载失败');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      onError?.(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const renderPreview = () => {
    if (!result || !result.success) return null;

    const fileObj = file instanceof File ? file : null;
    const fileInfo = fileObj ? FileLoader.getFileTypeInfo(fileObj) : null;

    if (result.type === 'data-url' && result.data) {
      if (fileInfo?.isImage) {
        return <img src={result.data} alt="预览" style={{ maxWidth: '100%', maxHeight: '300px' }} />;
      } else if (fileInfo?.isVideo) {
        return (
          <video controls style={{ maxWidth: '100%', maxHeight: '300px' }}>
            <source src={result.data} type={fileInfo.mimeType} />
            您的浏览器不支持视频播放
          </video>
        );
      } else if (fileInfo?.isAudio) {
        return (
          <audio controls style={{ width: '100%' }}>
            <source src={result.data} type={fileInfo.mimeType} />
            您的浏览器不支持音频播放
          </audio>
        );
      } else {
        return <div>文件类型: {fileInfo?.mimeType || '未知'}</div>;
      }
    } else if (result.type === 'blob-url' && result.url) {
      // 对于blob URL，创建相应的预览元素
      if (fileInfo?.isImage) {
        return <img src={result.url} alt="预览" style={{ maxWidth: '100%', maxHeight: '300px' }} />;
      } else if (fileInfo?.isVideo) {
        return (
          <video controls style={{ maxWidth: '100%', maxHeight: '300px' }}>
            <source src={result.url} type={fileInfo.mimeType} />
            您的浏览器不支持视频播放
          </video>
        );
      } else if (fileInfo?.isAudio) {
        return (
          <audio controls style={{ width: '100%' }}>
            <source src={result.url} type={fileInfo.mimeType} />
            您的浏览器不支持音频播放
          </audio>
        );
      }
    }

    return <div>文件路径: {result.url}</div>;
  };

  if (loading) {
    return <div>加载中...</div>;
  }

  if (!result) {
    return null;
  }

  return (
    <div style={{ marginTop: '20px' }}>
      <h3>文件预览:</h3>
      {renderPreview()}
      {result.error && (
        <div style={{ color: 'red', marginTop: '10px' }}>
          错误: {result.error}
        </div>
      )}
    </div>
  );
};

export default FilePreview; 