<script>
  import { onMount } from "svelte";
  import { TJAParser } from "./lib/TJAParser.js";
  import { FileManager } from "./lib/FileManager.js";
  import { GameState } from "./lib/GameState.js";
  import { GameEngine } from "./lib/GameEngine.js";
  import { GameRenderer } from "./lib/GameRenderer.js";
  import GameControls from "./lib/GameControls.svelte";
  import GameDisplay from "./lib/GameDisplay.svelte";

  // 核心状态
  let fileManager = new FileManager();
  let gameState = new GameState();
  let gameEngine = new GameEngine(gameState);
  let gameRenderer = null;

  // UI 状态
  let tjaData = null;
  let audioElement = null;
  let isLoaded = false;
  let isPlaying = false;
  let currentTime = 0;
  let duration = 0;
  let loadingStatus = "正在加载...";
  let tjaCourses = [];
  let selectedCourse = "";
  let selectedBranch = "normal"; // 新增分支选择状态
  let isPlayMode = false;
  let volume = 0.7;
  let noteSpeed = 1.0;

  // 文件选择状态
  let tjaFiles = [];
  let oggFiles = [];
  let selectedTja = "";
  let selectedOgg = "";

  // Canvas 相关
  let gameCanvas;
  let animationId = null;

  onMount(() => {
    loadingStatus = "请通过 postMessage 发送 zip 包 URL";
    
    function handleMsg(event) {
      if (event.data && typeof event.data === "object") {
        if (event.data.zipUrl) {
          loadZipFromUrl(event.data.zipUrl);
        } else if (event.data.type === "zip" && event.data.blob instanceof Blob) {
          loadZipFromBlob(event.data.blob);
        }
      }
    }

    window.addEventListener("message", handleMsg);
    window.addEventListener("keydown", handleKeyPress);

    return () => {
      window.removeEventListener("message", handleMsg);
      window.removeEventListener("keydown", handleKeyPress);
      stopAnimation();
    };
  });

  // 从URL加载ZIP
  async function loadZipFromUrl(zipUrl) {
    try {
      loadingStatus = "正在下载 zip 包...";
      const result = await fileManager.loadZipFromUrl(zipUrl);
      
      tjaFiles = result.tjaFiles;
      oggFiles = result.oggFiles;
      selectedTja = tjaFiles[0];
      selectedOgg = oggFiles[0];
      loadingStatus = "请选择谱面和音频文件";
      isLoaded = false;
    } catch (e) {
      loadingStatus = e.message;
    }
  }

  // 从Blob加载ZIP
  async function loadZipFromBlob(blob) {
    try {
      loadingStatus = "正在解压 zip...";
      const result = await fileManager.loadZipFromBlob(blob);
      
      tjaFiles = result.tjaFiles;
      oggFiles = result.oggFiles;
      selectedTja = tjaFiles[0];
      selectedOgg = oggFiles[0];
      loadingStatus = "请选择谱面和音频文件";
      isLoaded = false;
    } catch (e) {
      loadingStatus = e.message;
    }
  }

  // 按键处理
  function handleKeyPress(event) {
    if (event.code === "Space") {
      event.preventDefault();
      togglePlay();
    }

    // 游玩模式按键处理
    if (isPlayMode && isPlaying) {
      event.preventDefault();
      
      let hitType = null;
      switch (event.code) {
        case "KeyF":
        case "KeyJ":
          hitType = "don";
          break;
        case "KeyD":
        case "KeyK":
          hitType = "ka";
          break;
      }
      
      if (hitType) {
        gameEngine.handlePlayerHit(hitType, tjaData, currentTime);
      }
    }
  }

  // 加载TJA和音频文件
  async function handleFileSelect() {
    try {
      // 加载TJA文件
      loadingStatus = "正在加载 TJA 谱面...";
      const tjaText = await fileManager.loadTJAFile(selectedTja);
      tjaCourses = TJAParser.parseTJA(tjaText);

      if (tjaCourses.length > 0) {
        selectedCourse = tjaCourses[0].name;
        selectedBranch = "normal"; // 重置分支选择
        updateTjaData();
        loadingStatus = `谱面加载完成，找到 ${tjaCourses.length} 个难度`;
      } else {
        loadingStatus = "TJA 文件中没有找到有效的谱面数据";
        return;
      }

      // 加载音频文件
      loadingStatus = "正在加载音频文件...";
      audioElement = await fileManager.loadAudioFile(selectedOgg, volume);
      
      // 设置音频事件监听器
      fileManager.setupAudioEventListeners(audioElement, {
        onTimeUpdate: () => {
          currentTime = audioElement.currentTime;
        },
        onEnded: () => {
          isPlaying = false;
          stopAnimation();
          currentTime = 0;
          audioElement.currentTime = 0;
        },
        onPause: () => {
          isPlaying = false;
          stopAnimation();
        }
      });

      duration = audioElement.duration;
      setupCanvas();
      isLoaded = true;
      loadingStatus = "加载完成！点击播放按钮开始预览";
    } catch (e) {
      loadingStatus = e.message;
    }
  }

  // 更新TJA数据（根据选择的难度和分支）
  function updateTjaData() {
    if (!tjaCourses || tjaCourses.length === 0) return;

    const course = tjaCourses.find((c) => c.name === selectedCourse);
    if (course) {
      // 使用TJAParser的新方法获取带分支的数据
      tjaData = TJAParser.getCourseWithBranch(course, selectedBranch);
    }
  }

  // 难度切换
  function handleCourseChange() {
    updateTjaData();
    
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      currentTime = 0;
      isPlaying = false;
      stopAnimation();
    }
    
    gameState.resetNoteStates(tjaData);
    setupCanvas();
  }

  // 分支切换
  function handleBranchChange() {
    updateTjaData();
    
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      currentTime = 0;
      isPlaying = false;
      stopAnimation();
    }
    
    gameState.resetNoteStates(tjaData);
    setupCanvas();
  }

  // 设置Canvas
  function setupCanvas() {
    if (gameCanvas) {
      gameRenderer = new GameRenderer(gameCanvas, gameState);
      gameRenderer.setNoteSpeed(noteSpeed);
      gameRenderer.render(tjaData, currentTime, isPlayMode, duration);
    }
  }

  // 播放控制
  function togglePlay() {
    if (!audioElement || !isLoaded) return;

    if (isPlaying) {
      audioElement.pause();
      isPlaying = false;
      stopAnimation();
    } else {
      gameState.resetNoteStates(tjaData);

      audioElement
        .play()
        .then(() => {
          isPlaying = true;
          startAnimation();
        })
        .catch((error) => {
          console.error("音频播放失败:", error);
          isPlaying = false;
        });
    }
  }

  // 动画控制
  function startAnimation() {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }

    function animate() {
      if (isPlaying && audioElement) {
        currentTime = audioElement.currentTime;
        gameEngine.updateVisibleNotes(tjaData, currentTime, isPlayMode);
        
        if (gameRenderer) {
          gameRenderer.render(tjaData, currentTime, isPlayMode, duration);
        }
        
        animationId = requestAnimationFrame(animate);
      }
    }

    animate();
  }

  function stopAnimation() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  // 音量控制
  function handleVolumeChange(event) {
    volume = parseFloat(event.target.value);
    if (audioElement) {
      audioElement.volume = volume;
    }
  }

  // 速度控制
  function handleSpeedChange(event) {
    noteSpeed = parseFloat(event.target.value);
    gameEngine.setNoteSpeed(noteSpeed);
    if (gameRenderer) {
      gameRenderer.setNoteSpeed(noteSpeed);
    }
  }

  // 游戏模式切换
  function togglePlayMode() {
    isPlayMode = !isPlayMode;
    if (isPlayMode) {
      gameState.reset();
    }
  }

  // 进度条控制
  let isDraggingProgress = false;

  function handleProgressClick(event, progressBarElement) {
    if (!audioElement || !duration) return;

    const rect = progressBarElement.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;

    audioElement.currentTime = Math.max(0, Math.min(newTime, duration));
    currentTime = audioElement.currentTime;

    gameState.resetNoteStates(tjaData);
    gameEngine.updateVisibleNotes(tjaData, currentTime, isPlayMode);
    
    if (gameRenderer) {
      gameRenderer.render(tjaData, currentTime, isPlayMode, duration);
    }
  }

  function handleProgressMouseDown() {
    isDraggingProgress = true;
  }

  function handleProgressMouseUp() {
    isDraggingProgress = false;
  }

  function handleProgressMouseMove(event, progressBarElement) {
    if (!isDraggingProgress || !audioElement || !duration) return;
    handleProgressClick(event, progressBarElement);
  }
</script>

<main>
  <h1>太鼓达人谱面预览器</h1>

  <GameControls
    {tjaFiles}
    {oggFiles}
    bind:selectedTja
    bind:selectedOgg
    {tjaCourses}
    bind:selectedCourse
    bind:selectedBranch
    {isPlayMode}
    bind:volume
    bind:noteSpeed
    onFileSelect={handleFileSelect}
    onCourseChange={handleCourseChange}
    onBranchChange={handleBranchChange}
    onTogglePlayMode={togglePlayMode}
    onVolumeChange={handleVolumeChange}
    onSpeedChange={handleSpeedChange}
  />

  <GameDisplay
    {tjaData}
    {isPlaying}
    {currentTime}
    {duration}
    {isLoaded}
    {loadingStatus}
    {isPlayMode}
    bind:gameCanvas
    onPlayToggle={togglePlay}
    onProgressClick={handleProgressClick}
    onProgressMouseDown={handleProgressMouseDown}
    onProgressMouseUp={handleProgressMouseUp}
    onProgressMouseMove={handleProgressMouseMove}
  />
</main>

<style>
  main {
    max-width: 1000px;
    margin: 0 auto;
    padding: 20px;
    font-family: Arial, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    color: white;
  }

  h1 {
    text-align: center;
    color: #fff;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    margin-bottom: 30px;
  }

  @media (max-width: 768px) {
    main {
      padding: 10px;
    }
  }
</style>
