<script>
  export let tjaFiles = [];
  export let oggFiles = [];
  export let selectedTja = "";
  export let selectedOgg = "";
  export let tjaCourses = [];
  export let selectedCourse = "";
  export let selectedBranch = "normal"; // 新增分支选择
  export let onFileSelect;
  export let onFileUpload; // 新增文件上传回调
  export let onCourseChange;
  export let onBranchChange; // 新增分支切换回调
  export let isPlayMode = false;
  export let onTogglePlayMode;
  export let volume = 0.7;
  export let onVolumeChange;
  export let noteSpeed = 1.0;
  export let onSpeedChange;
  export let uploadedFileName = ""; // 新增上传文件名变量

  // 处理文件上传包装函数
  function handleFileUpload(event) {
    const files = event.target.files;
    if (files && files.length > 0) {
      uploadedFileName = files[0].name;
    }
    onFileUpload(event);
  }
</script>

<div class="controls-panel">
  <!-- 文件上传 -->
  <div class="file-upload">
    <input
      id="zip-upload"
      type="file"
      accept=".zip"
      on:change={handleFileUpload}
      style="display: none;"
    />
    <button 
      class="upload-btn" 
      on:click={() => document.getElementById('zip-upload').click()}
    >
      {uploadedFileName ? `已上传 ${uploadedFileName}` : '选择 ZIP 文件'}
    </button>
  </div>

  <!-- 文件选择 - 只在有文件时显示 -->
  {#if tjaFiles.length > 0 || oggFiles.length > 0}
    <div class="file-selection">
    <label for="tja-select">选择谱面文件：</label>
    <select
      id="tja-select"
      bind:value={selectedTja}
      on:change={onFileSelect}
      disabled={tjaFiles.length === 0}
    >
      {#each tjaFiles as tja}
        <option value={tja}>{tja}</option>
      {/each}
    </select>
    
    <label for="ogg-select" style="margin-left:2em;">选择音频文件：</label>
    <select
      id="ogg-select"
      bind:value={selectedOgg}
      on:change={onFileSelect}
      disabled={oggFiles.length === 0}
    >
      {#each oggFiles as ogg}
        <option value={ogg}>{ogg}</option>
      {/each}
    </select>
    
    <button on:click={onFileSelect} disabled={!selectedTja || !selectedOgg}>
      加载
    </button>
  </div>
  {/if}

  <!-- 难度选择 -->
  {#if tjaCourses.length > 1}
    <div class="course-selection">
      <label for="course-select">选择难度：</label>
      <select
        id="course-select"
        bind:value={selectedCourse}
        on:change={onCourseChange}
      >
        {#each tjaCourses as course}
          <option value={course.name}>
            {course.name} (Level: {course.metadata.LEVEL || "N/A"})
          </option>
        {/each}
      </select>
    </div>
  {/if}

  <!-- 分支选择 -->
  {#if tjaCourses.length > 0 && tjaCourses.find(c => c.name === selectedCourse)?.hasBranch}
    <div class="branch-selection">
      <label for="branch-select">选择分支：</label>
      <select
        id="branch-select"
        bind:value={selectedBranch}
        on:change={onBranchChange}
      >
        <option value="easy">Easy (简单)</option>
        <option value="normal">Normal (普通)</option>
        <option value="master">Master (达人)</option>
      </select>
    </div>
  {/if}

  <!-- 游戏设置 -->
  <div class="game-settings">
    <button class="mode-btn" on:click={onTogglePlayMode}>
      {isPlayMode ? "👁️ 预览模式" : "🎮 游玩模式"}
    </button>

    <div class="volume-control">
      <span>🔊</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.1"
        bind:value={volume}
        on:input={onVolumeChange}
        class="volume-slider"
      />
      <span>{Math.round(volume * 100)}%</span>
    </div>

    <div class="speed-control">
      <label for="speed-slider">音符流动速度：</label>
      <input
        id="speed-slider"
        type="range"
        min="0.5"
        max="3.0"
        step="0.1"
        bind:value={noteSpeed}
        on:input={onSpeedChange}
        class="speed-slider"
      />
      <span class="speed-value">{noteSpeed.toFixed(1)}x</span>
      <span class="speed-hint">(1.0x为默认速度)</span>
    </div>
  </div>
</div>

<style>
  .controls-panel {
    margin-bottom: 1em;
    padding: 20px;
    background: rgba(0, 0, 0, 0.4);
    border: 2px solid rgba(255, 135, 0, 0.3);
    border-radius: 15px;
    display: flex;
    flex-direction: column;
    gap: 15px;
    box-shadow: 0 8px 25px rgba(255, 62, 13, 0.2);
  }

  .file-selection,
  .course-selection,
  .game-settings {
    display: flex;
    align-items: center;
    gap: 15px;
    flex-wrap: wrap;
  }

  .mode-btn {
    padding: 12px 20px;
    font-size: 14px;
    font-weight: bold;
    background: linear-gradient(45deg, rgb(255, 180, 120), rgb(255, 210, 150));
    color: white;
    border: none;
    border-radius: 25px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(255, 180, 120, 0.3);
  }
  
  .mode-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(255, 180, 120, 0.4);
    background: linear-gradient(45deg, rgb(255, 210, 150), rgb(255, 180, 120));
  }
  
  .mode-btn:disabled {
    background: #666;
    cursor: not-allowed;
    opacity: 0.6;
  }

  .volume-control {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }

  .volume-slider,
  .speed-slider {
    width: 120px;
    height: 4px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }

  .volume-slider::-webkit-slider-thumb,
  .speed-slider::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    background: linear-gradient(45deg, rgb(255, 180, 120), rgb(255, 210, 150));
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(255, 180, 120, 0.3);
  }

  .volume-slider::-moz-range-thumb,
  .speed-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: linear-gradient(45deg, rgb(255, 180, 120), rgb(255, 210, 150));
    border-radius: 50%;
    border: none;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(255, 180, 120, 0.3);
  }

  .speed-control {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .speed-value {
    font-weight: bold;
    min-width: 40px;
  }

  .speed-hint {
    font-size: 0.9em;
    color: #aaa;
  }

  select {
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.4);
    color: white;
    border: 2px solid rgba(255, 135, 0, 0.4);
    border-radius: 8px;
    outline: none;
    transition: border-color 0.3s ease;
  }
  
  select:focus {
    border-color: rgb(255, 135, 0);
    box-shadow: 0 0 10px rgba(255, 135, 0, 0.3);
  }

  select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  button {
    padding: 8px 16px;
    background: linear-gradient(45deg, rgb(255, 180, 120), rgb(255, 210, 150));
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 3px 10px rgba(255, 180, 120, 0.3);
  }

  button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 15px rgba(255, 180, 120, 0.4);
    background: linear-gradient(45deg, rgb(255, 210, 150), rgb(255, 180, 120));
  }

  button:disabled {
    background: #666;
    cursor: not-allowed;
    opacity: 0.6;
    transform: none;
  }

  label {
    color: white;
    font-weight: bold;
  }

  /* 文件上传样式 */
  .file-upload {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
  }

  .upload-btn {
    padding: 12px 24px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 25px;
    background: rgba(0, 0, 0, 0.2);
    color: white;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 14px;
    font-weight: bold;
    min-width: 200px;
    text-align: center;
  }

  .upload-btn:hover {
    background: rgba(0, 0, 0, 0.3);
    border-color: rgb(255, 210, 150);
    transform: translateY(-2px);
  }

  @media (max-width: 768px) {
    .controls-panel {
      padding: 15px;
    }
    
    .file-upload,
    .file-selection,
    .course-selection,
    .branch-selection,
    .game-settings {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
    }
    
    .file-upload {
      align-items: flex-start;
    }
    
    .speed-control {
      flex-direction: column;
      align-items: stretch;
    }
    
    .volume-slider,
    .speed-slider {
      width: 100%;
    }
  }
</style>
