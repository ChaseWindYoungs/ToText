import { Button, Flex, message, Progress, Image } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchDownloadFile, fetchProjectUploadFile } from '@/services/project';
import { DeleteOutlined, EyeOutlined, VerticalAlignBottomOutlined } from '@ant-design/icons';
import styles from './index.module.css';
import bridge from '@/utils/bridge';

type CustomUploadProps = {
  value?: any;
  onChange?: (data: any) => void;
  disabled?: boolean;
  disabledExts?: string[];
};
const defaultDisabledExts = ['js', 'vbs', 'sh', 'py', 'rb'];
const imgExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'];
const otherExts = ['pdf'];
const localFileExts = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'];
const allCanPreviewExts = [...imgExts, ...otherExts, ...localFileExts];
const videoExts = ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv'];

export default function CustomUpload(props: CustomUploadProps) {
  const { disabled = false, value = [], onChange, disabledExts = defaultDisabledExts } = props;
  const [fileList, setFileList] = useState<Array<any>>([]);
  const isDisabled = useMemo(() => disabled, [disabled]);
  const [visible, setVisible] = useState(false);
  const UploadFileRef = useRef<HTMLInputElement>(null);
  const [previewImgUrl, setPreviewImgUrl] = useState<string | null>(null);
  // 记录上传中的 abortController
  const uploadControllers = useRef<Record<string, AbortController>>({});

  // 回显
  useEffect(() => {
    console.log('useEffect', value);

    if (!value || !Array.isArray(value) || value.length === 0) {
      // setFileList([]);
      return;
    }

    // const hasUploading = fileList.some((file) => file.status === 'uploading');
    // if (hasUploading) {
    //   if (value.length > 0) {
    let arr = value.map((item) => ({
      ...item,
      name: item.fileName,
      uid: item.id,
      url: item.filePath,
      status: 'done',
    }));
    setFileList(arr ?? []);
    //   }
    // } else {
    //   setFileList(value);
    // }
  }, [value]);

  const handleBeforeUpload = (file: File) => {
    // 获取文件扩展名
    let fileName = file.name;
    let fileExtension = fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase();
    if (disabledExts.includes(fileExtension)) {
      message.warning(`不支持上传该类型文件！【${file.name}】`);
      return false;
    }
    if (videoExts.includes(fileExtension) && file.size > 1 * 1024 * 1024 * 1024) {
      message.warning(`文件大小不能超过1G！【 ${file.name}】`);
      return false;
    }
    return true;
  };

  // 处理自定义上传
  const handleSingleFileUpload = async (file: File) => {
    if (!handleBeforeUpload(file)) return;
    const uid = `${file.name}_${Date.now()}`;
    const controller = new AbortController();
    uploadControllers.current[uid] = controller;
    const uploadFile = {
      uid,
      name: file.name,
      status: 'uploading',
      percent: 0,
      raw: file,
      controller,
    };
    setFileList((prev) => {
      console.log([...prev, uploadFile]);
      return [...prev, uploadFile];
    });
    const formData = new FormData();
    formData.append('files', file);
    try {
      await fetchProjectUploadFile(
        formData,
        (percent) => {
          console.log('文件上传进度 =====>', percent);
          setFileList((prev) => {
            console.log(prev, uid, percent);
            return prev.map((f) => (f.uid === uid ? { ...f, percent } : f));
          });
        },
        { signal: controller.signal },
      ).then((res) => {
        if (controller.signal.aborted) return;
        let item = res[0];
        item.url = item.filePath;
        item.name = item.fileName;
        item.uid = item.id;
        item.uid = uid; // 保持id
        // item.status = 'done';
        // item.percent = 100;
        // setFileList((prev) => prev.map((f) => (f.uid === uid ? item : f)));
        // 用 setFileList 的最新值
        setFileList((prev) => {
          console.log('fetchProjectUploadFile', prev);
          const newList = prev.map((f) => (f.uid === uid ? item : f));
          console.log('fetchProjectUploadFile', newList);
          onChange && onChange(newList);
          return newList;
        });
      });
    } catch (err: any) {
      console.log('err =====>', err);
      if (
        err &&
        (err.name === 'AbortError' ||
          err.name === 'CanceledError' ||
          err.code === 'ERR_CANCELED' ||
          err.message === 'canceled')
      ) {
        message.info('文件上传已取消');
      } else {
        message.warning('文件上传出错');
      }
    } finally {
      delete uploadControllers.current[uid];
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = e.target;
    if (!files) return;
    Array.from(files).forEach((file) => {
      handleSingleFileUpload(file);
    });
    e.target.value = '';
  };

  async function downloadNetworkFile(file, url, suggestedFileName) {
    if (!url) {
      message.warning('下载路径不存在');
      return;
    }

    try {
      // 获取网络文件
      const response = await fetchDownloadFile({
        url,
        onProgress: (progress, loaded, total) => {
          console.log('progress', progress);
          setFileList((prev) => {
            return prev.map((f) => {
              if (f.uid === file.uid) {
                f.status = 'downloading';
                f.percent = Math.round((loaded / total) * 100);
              }
              return f;
            });
          });
        },
      });
      // 验证 blob 是否为 Blob 类型
      if (!(response instanceof Blob)) {
        throw new Error('响应数据不是有效的 Blob 类型');
      }

      // 使用 showSaveFilePicker 让用户选择保存位置
      const options = {
        suggestedName: suggestedFileName, // 建议的文件名
      };
      const newHandle = await window.showSaveFilePicker(options);

      // 创建可写流
      const writableStream = await newHandle.createWritable();

      // 将 Blob 数据写入文件
      await writableStream.write(response);

      // 关闭流并保存文件
      await writableStream.close();
      message.success('文件下载并保存成功');
    } catch (err) {
      console.error('下载文件时出错:', err);
    } finally {
      setFileList((prev) => {
        return prev.map((f) => {
          if (f.uid === file.uid) {
            delete f.status;
            delete f.percent;
          }
          return f;
        });
      });
    }
  }

  function onPreview(file) {
    let fileName = file.name;
    let fileExtension = fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase();
    if (imgExts.includes(fileExtension)) {
      // 预览图片
      const realUrl = `https://localhost:4001/${file.url.replaceAll('\\', '/')}`;
      setPreviewImgUrl(realUrl);
      setVisible(true);
    } else if (otherExts.includes(fileExtension)) {
      const realUrl = `https://localhost:4001/${file.url.replaceAll('\\', '/')}`;
      window.open(realUrl);
    } else if (localFileExts.includes(fileExtension)) {
      bridge.openLocalFile(file.url);
    }
  }

  return (
    <>
      <div className={styles.CustomUpload} style={{ marginLeft: '10px' }}>
        {!isDisabled && (
          <Flex justify="space-between" align="center">
            <Button disabled={isDisabled} onClick={() => UploadFileRef?.current?.click()}>
              选择文件
            </Button>
            <input
              ref={UploadFileRef}
              type="file"
              style={{ display: 'none' }}
              multiple
              onChange={handleFileChange}
              accept="*"
              disabled={isDisabled}
            />
            {fileList.length > 0 && <p>{fileList.length}</p>}
          </Flex>
        )}
        {fileList.length > 0 ? (
          fileList.map((file) => (
            <div className={styles.fileItem} key={file.uid}>
              <Flex key={file.uid} justify="space-between" align="center" onClick={(e) => e.stopPropagation()}>
                <p>{file.name}</p>
                <Flex gap="small" align="center">
                  {file.url && allCanPreviewExts.includes(file?.name?.substring(file?.name?.lastIndexOf('.') + 1)) && (
                    <span className={styles.iconWrapper}>
                      <EyeOutlined
                        style={{ color: '#1890ff', cursor: 'pointer' }}
                        title="预览"
                        onClick={() => {
                          // 预览逻辑
                          if (file.url) {
                            onPreview(file);
                          } else {
                            message.warning('没有可预览的文件');
                          }
                        }}
                      />
                    </span>
                  )}
                  {!isDisabled && !file.percent && (
                    <span
                      className={styles.iconWrapper}
                      onClick={() => {
                        // 删除时中断上传
                        if (file.status === 'uploading' && file.controller) {
                          file.controller.abort();
                        }
                        setFileList((prev) => prev.filter((item) => item.uid !== file.uid));
                        onChange && onChange(fileList.filter((item) => item.uid !== file.uid));
                      }}
                    >
                      <DeleteOutlined title="删除" style={{ color: 'red', cursor: 'pointer' }} />
                    </span>
                  )}
                  {file.url && (
                    <>
                      <span
                        className={styles.iconWrapper}
                        onClick={() => downloadNetworkFile(file, file.url, file.name)}
                      >
                        <VerticalAlignBottomOutlined title="下载" style={{ color: 'green', cursor: 'pointer' }} />
                      </span>
                      {file.percent && <span>进度： {file.percent}%</span>}
                    </>
                  )}
                </Flex>
              </Flex>
              {file.status === 'uploading' && <Progress percent={file.percent} size="small" />}
            </div>
          ))
        ) : disabled ? (
          <div style={{ paddingTop: '6px' }}>暂无文件</div>
        ) : null}
      </div>
      <Image
        width={200}
        style={{ display: 'none' }}
        preview={{
          visible,
          src: previewImgUrl!,
          onVisibleChange: (value) => {
            setVisible(value);
          },
        }}
      />
    </>
  );
}
