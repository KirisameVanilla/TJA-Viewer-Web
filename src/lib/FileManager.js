// 文件管理器
import JSZip from "jszip";

export class FileManager {
  constructor() {
    this.zipFileMap = {};
    this.tjaFiles = [];
    this.oggFiles = [];
  }

  // 从URL加载ZIP文件
  async loadZipFromUrl(zipUrl) {
    try {
      const resp = await fetch(zipUrl);
      if (!resp.ok) throw new Error("下载失败");
      const blob = await resp.blob();
      return await this.loadZipFromBlob(blob);
    } catch (e) {
      throw new Error("zip 加载或解压失败: " + e.message);
    }
  }

  // 从Blob加载ZIP文件
  async loadZipFromBlob(blob) {
    try {
      const zip = await JSZip.loadAsync(blob);
      this.tjaFiles = [];
      this.oggFiles = [];
      this.zipFileMap = {};

      zip.forEach((relPath, file) => {
        if (!file.dir) {
          if (relPath.endsWith(".tja")) this.tjaFiles.push(relPath);
          if (relPath.endsWith(".ogg")) this.oggFiles.push(relPath);
          this.zipFileMap[relPath] = file;
        }
      });

      if (this.tjaFiles.length === 0 || this.oggFiles.length === 0) {
        throw new Error("zip 包中未找到 tja 或 ogg 文件");
      }

      return {
        tjaFiles: this.tjaFiles,
        oggFiles: this.oggFiles,
        success: true
      };
    } catch (e) {
      throw new Error("zip 解压失败: " + e.message);
    }
  }

  // 从ZIP中加载TJA文件
  async loadTJAFile(filename) {
    if (!filename || !this.zipFileMap[filename]) {
      throw new Error("未找到指定的TJA文件");
    }

    try {
      const text = await this.zipFileMap[filename].async("text");
      return text;
    } catch (e) {
      throw new Error("TJA 文件读取失败: " + e.message);
    }
  }

  // 从ZIP中加载音频文件
  async loadAudioFile(filename, volume = 0.7) {
    if (!filename || !this.zipFileMap[filename]) {
      throw new Error("未找到指定的音频文件");
    }

    try {
      const blob = await this.zipFileMap[filename].async("blob");
      const url = URL.createObjectURL(blob);
      
      const audioElement = new Audio(url);
      audioElement.volume = volume;
      
      return new Promise((resolve, reject) => {
        audioElement.addEventListener("loadedmetadata", () => {
          resolve(audioElement);
        });
        
        audioElement.addEventListener("error", (e) => {
          reject(new Error("音频文件加载失败"));
        });
        
        audioElement.load();
      });
    } catch (e) {
      throw new Error("音频文件处理失败: " + e.message);
    }
  }

  // 设置音频事件监听器
  setupAudioEventListeners(audioElement, callbacks) {
    if (!audioElement || !callbacks) return;

    if (callbacks.onTimeUpdate) {
      audioElement.addEventListener("timeupdate", callbacks.onTimeUpdate);
    }
    
    if (callbacks.onEnded) {
      audioElement.addEventListener("ended", callbacks.onEnded);
    }
    
    if (callbacks.onPause) {
      audioElement.addEventListener("pause", callbacks.onPause);
    }
  }

  // 获取文件列表
  getFileList() {
    return {
      tjaFiles: this.tjaFiles,
      oggFiles: this.oggFiles
    };
  }

  // 清理资源
  cleanup() {
    Object.values(this.zipFileMap).forEach(file => {
      if (file.url) {
        URL.revokeObjectURL(file.url);
      }
    });
    this.zipFileMap = {};
    this.tjaFiles = [];
    this.oggFiles = [];
  }
}
