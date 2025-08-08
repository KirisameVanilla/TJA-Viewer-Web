<script>
  // @ts-nocheck
  import { Utils } from './Utils.js';
  
  export let tjaData = null;
  export let isPlaying = false;
  export let currentTime = 0;
  export let duration = 0;
  export let isLoaded = false;
  export let loadingStatus = "";
  export let onPlayToggle;
  export let onProgressClick;
  export let onProgressMouseDown;
  export let onProgressMouseUp;
  export let onProgressMouseMove;
  export let isPlayMode = false;
  export let gameCanvas;

  let progressBarElement;
</script>

<div class="display-panel">
  <!-- 曲目信息 -->
  {#if tjaData}
    <div class="song-info">
      <h2>{tjaData.metadata?.TITLE || "未知曲目"}</h2>
      <p>
        BPM: {tjaData.bpm} | 难度: {tjaData.metadata?.LEVEL || "N/A"} | OFFSET: {tjaData.offset}s
      </p>
    </div>
  {/if}

  <!-- 游戏区域 -->
  <div class="game-area">
    <canvas bind:this={gameCanvas} width="800" height="200"></canvas>
  </div>

  <!-- 播放控制 -->
  <div class="player-controls">
    <button class="play-btn" on:click={onPlayToggle} disabled={!isLoaded}>
      {isPlaying ? "⏸️ 暂停" : "▶️ 播放"}
    </button>

    <div class="time-info">
      {Utils.formatTime(currentTime)} / {Utils.formatTime(duration)}
    </div>

    <div
      class="progress-bar"
      bind:this={progressBarElement}
      on:click={(e) => onProgressClick(e, progressBarElement)}
      on:keydown={(e) => e.key === "Enter" && onProgressClick(e, progressBarElement)}
      on:mousedown={onProgressMouseDown}
      on:mouseup={onProgressMouseUp}
      on:mousemove={(e) => onProgressMouseMove(e, progressBarElement)}
      role="slider"
      tabindex="0"
      aria-label="播放进度"
      aria-valuenow={duration > 0 ? Math.round((currentTime / duration) * 100) : 0}
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div
        class="progress-fill"
        style="width: {duration > 0 ? (currentTime / duration) * 100 : 0}%"
      ></div>
    </div>
  </div>

  <!-- 状态显示 -->
  <div class="status">
    {loadingStatus}
  </div>

  <!-- 提示信息 -->
  <div class="hints">
    <div class="keyboard-hint">
      💡 小贴士: 按空格键可以播放/暂停，点击进度条可以跳转
    </div>

    {#if isPlayMode}
      <div class="game-hint">
        🎮 游戏模式: F/J = 咚(红色)  D/K = 咔(蓝色)  连打和气球可用任意按键击打
      </div>
    {/if}

    {#if tjaData && tjaData.notes}
      <div class="note-stats">
        总音符数: {tjaData.notes.length}
        {#if tjaData.notes.length > 0}
          | 首个音符时间: {tjaData.notes[0].time.toFixed(2)}s
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .display-panel {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .song-info {
    text-align: center;
    padding: 15px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 10px;
  }

  .song-info h2 {
    margin: 0 0 10px 0;
    color: #ffd700;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  }

  .song-info p {
    margin: 0;
    color: white;
  }

  .game-area {
    background: #000022;
    border: 3px solid #444;
    border-radius: 10px;
    padding: 10px;
    display: flex;
    justify-content: center;
  }

  canvas {
    border-radius: 5px;
    background: #000011;
  }

  .player-controls {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 15px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 10px;
    flex-wrap: wrap;
  }

  .play-btn {
    padding: 12px 24px;
    font-size: 16px;
    font-weight: bold;
    background: linear-gradient(45deg, #ff6b6b, #feca57);
    color: white;
    border: none;
    border-radius: 25px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  }

  .play-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
  }

  .play-btn:disabled {
    background: #666;
    cursor: not-allowed;
    opacity: 0.6;
  }

  .time-info {
    font-weight: bold;
    font-size: 18px;
    min-width: 120px;
    color: white;
  }

  .progress-bar {
    flex: 1;
    height: 8px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    overflow: hidden;
    cursor: pointer;
    position: relative;
  }

  .progress-bar:hover {
    height: 10px;
    background: rgba(255, 255, 255, 0.4);
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #ff6b6b, #feca57, #48dbfb);
    border-radius: 4px;
    transition: width 0.1s ease;
  }

  .status {
    text-align: center;
    padding: 10px;
    font-weight: bold;
    background: rgba(0, 0, 0, 0.4);
    border-radius: 5px;
    color: white;
  }

  .hints {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .keyboard-hint,
  .game-hint {
    text-align: center;
    padding: 8px;
    font-size: 14px;
    background: rgba(255, 215, 0, 0.2);
    border-radius: 5px;
    border: 1px solid rgba(255, 215, 0, 0.4);
    color: white;
  }

  .game-hint {
    background: rgba(72, 219, 251, 0.2);
    border: 1px solid rgba(72, 219, 251, 0.4);
  }

  .note-stats {
    text-align: center;
    padding: 10px;
    font-size: 14px;
    opacity: 0.8;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 5px;
    color: white;
  }

  @media (max-width: 768px) {
    canvas {
      width: 100%;
      height: auto;
    }

    .player-controls {
      flex-direction: column;
      gap: 15px;
    }

    .progress-bar {
      width: 100%;
    }

    .time-info {
      min-width: auto;
    }
  }
</style>
