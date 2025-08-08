<script>
  export let tjaFiles = [];
  export let oggFiles = [];
  export let selectedTja = "";
  export let selectedOgg = "";
  export let tjaCourses = [];
  export let selectedCourse = "";
  export let onFileSelect;
  export let onCourseChange;
  export let isPlayMode = false;
  export let onTogglePlayMode;
  export let volume = 0.7;
  export let onVolumeChange;
  export let noteSpeed = 1.0;
  export let onSpeedChange;
</script>

<div class="controls-panel">
  <!-- 文件选择 -->
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
    background: rgba(0, 0, 0, 0.3);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 15px;
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
    background: linear-gradient(45deg, #48dbfb, #0abde3);
    color: white;
    border: none;
    border-radius: 25px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  }
  
  .mode-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
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
    background: #feca57;
    border-radius: 50%;
    cursor: pointer;
  }

  .volume-slider::-moz-range-thumb,
  .speed-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: #feca57;
    border-radius: 50%;
    border: none;
    cursor: pointer;
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
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 5px;
    outline: none;
  }

  select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  button {
    padding: 8px 16px;
    background: linear-gradient(45deg, #ff6b6b, #feca57);
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
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

  @media (max-width: 768px) {
    .controls-panel {
      padding: 15px;
    }
    
    .file-selection,
    .course-selection,
    .game-settings {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
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
