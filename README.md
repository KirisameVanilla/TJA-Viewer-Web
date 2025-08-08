# TJA Viewer Web

🎵 一个基于 Web 的太鼓达人 TJA 格式谱面查看器和播放器

## ✨ 功能特色

- 📁 **TJA 格式支持**: 解析和显示 TJA 谱面文件
- 🎵 **音频同步**: 支持 OGG 格式音频文件的同步播放
- 🎮 **游戏模式**: 可视化的谱面播放和交互
- 📦 **ZIP 包支持**: 直接加载包含 TJA 和音频文件的压缩包
- 🎯 **多难度支持**: 支持不同难度级别的谱面切换
- 🌿 **分支谱面**: 支持 Easy/Normal/Master 分支谱面
- ⚡ **实时渲染**: 基于 Canvas 的高性能谱面渲染
- 🎛️ **播放控制**: 完整的播放、暂停、进度控制功能

## 🎮 支持的谱面元素

- **音符类型**: Don(咚)、Ka(咔)、大音符、连打、气球音符
- **特殊效果**: GOGO Time、BPM 变化、卷轴速度调节
- **分支系统**: 根据演奏表现切换不同分支
- **小节线**: 准确的节拍和小节显示

## 🚀 快速开始

### 环境要求

- Node.js 16+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

访问 `http://localhost:5173` 查看应用

### 构建项目

```bash
npm run build
```

### 预览构建结果

```bash
npm run preview
```

## 📁 项目结构

```text
src/
├── App.svelte              # 主应用组件
├── main.js                 # 应用入口
├── app.css                 # 全局样式
└── lib/
    ├── TJAParser.js        # TJA 文件解析器
    ├── FileManager.js      # 文件管理工具
    ├── GameEngine.js       # 游戏引擎核心
    ├── GameRenderer.js     # 谱面渲染器
    ├── GameState.js        # 游戏状态管理
    ├── GameControls.svelte # 游戏控制界面
    ├── GameDisplay.svelte  # 游戏显示组件
    └── Utils.js           # 工具函数
```

## 🎵 使用方式

### 方式一：通过 postMessage 加载

```javascript
// 发送 ZIP 文件 URL
window.postMessage({
  zipUrl: "path/to/your/song.zip"
}, "*");

// 或发送 Blob 数据
window.postMessage({
  type: "zip",
  blob: yourZipBlob
}, "*");
```

### 方式二：直接文件上传

应用界面提供了文件上传功能，支持：

- 单独上传 TJA 文件和 OGG 音频文件
- 上传包含完整歌曲数据的 ZIP 压缩包

### ZIP 文件格式要求

```text
song.zip
├── song.tja        # TJA 谱面文件
├── song.ogg        # OGG 音频文件（可选）
└── ...            # 其他相关文件
```

## 🎛️ 控制说明

- **播放/暂停**: 点击播放按钮或空格键
- **进度控制**: 拖动进度条跳转到指定位置
- **难度选择**: 下拉菜单切换不同难度
- **分支选择**: 在支持分支的谱面中选择不同分支
- **速度调节**: 调整谱面滚动速度
- **音量控制**: 调整音频播放音量

## 🛠️ 技术栈

- **前端框架**: Svelte 5
- **构建工具**: Vite
- **文件处理**: JSZip
- **音频处理**: Web Audio API
- **图形渲染**: HTML5 Canvas

## 📋 TJA 格式支持

支持标准 TJA 格式的以下特性：

- 基本元数据（TITLE, SUBTITLE, BPM 等）
- 多难度谱面（Easy, Normal, Hard, Oni, Edit）
- 分支谱面（#BRANCHSTART, #N, #E, #M, #BRANCHEND）
- 音符类型（0-8 的所有标准音符）
- 特殊命令（#GOGOSTART, #GOGOEND, #BPMCHANGE 等）

## 🎯 音符说明

| 数字 | 类型 | 描述 |
|------|------|------|
| 0 | 空白 | 无音符 |
| 1 | Don | 红色音符（咚） |
| 2 | Ka | 蓝色音符（咔） |
| 3 | Don 大 | 大红色音符 |
| 4 | Ka 大 | 大蓝色音符 |
| 5 | 连打 | 黄色连打 |
| 6 | 大连打 | 大黄色连打 |
| 7 | 气球 | 气球音符 |
| 8 | 连打结束 | 连打结束标记 |

## 🎨 界面预览

- 清晰的谱面显示
- 实时的音符判定线
- 直观的播放控制界面
- 响应式设计，支持不同屏幕尺寸

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目！

### 开发指南

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 📄 许可证

本项目基于 MIT 许可证开源。

## 🎵 关于太鼓达人

太鼓达人（太鼓の達人）是由 Bandai Namco 开发的知名音乐游戏。本项目仅用于学习和研究目的，不涉及任何商业用途。

## 💡 常见问题

**Q: 支持哪些音频格式？**  
A: 目前主要支持 OGG 格式，这是太鼓达人社区最常用的音频格式。

**Q: 如何调整谱面难度？**  
A: 在加载谱面后，使用界面上的难度选择下拉菜单切换不同难度。

**Q: 分支谱面如何工作？**  
A: 支持分支的谱面会根据玩家的表现动态切换到不同的分支路径（Easy/Normal/Master）。

**Q: 可以离线使用吗？**  
A: 是的，构建后的应用可以离线运行，只需要提供相应的 TJA 和音频文件。

---

⭐ 如果这个项目对您有帮助，请给个 Star！
