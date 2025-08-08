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
    background: rgba(0, 0, 0, 0.4);
    border: 2px solid rgba(255, 135, 0, 0.3);
    border-radius: 15px;
    box-shadow: 0 5px 20px rgba(255, 62, 13, 0.2);
  }

  .song-info h2 {
    margin: 0 0 10px 0;
    color: #fff;
    text-shadow: 3px 3px 6px rgba(255, 62, 13, 0.8);
    font-size: 1.8em;
    font-weight: bold;
  }

  .song-info p {
    margin: 0;
    color: rgba(255, 255, 255, 0.9);
    text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.5);
  }

  .game-area {
    background: linear-gradient(45deg, rgba(0, 0, 0, 0.6), rgba(20, 20, 20, 0.8));
    border: 3px solid rgb(255, 135, 0);
    border-radius: 15px;
    padding: 15px;
    display: flex;
    justify-content: center;
    box-shadow: 0 8px 25px rgba(255, 62, 13, 0.3), inset 0 2px 10px rgba(255, 135, 0, 0.1);
  }

  canvas {
    border-radius: 10px;
    background: linear-gradient(135deg, rgba(0, 0, 0, 0.8), rgba(10, 10, 30, 0.9));
    box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.5);
  }

  .player-controls {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 15px;
    background: rgba(0, 0, 0, 0.4);
    border: 2px solid rgba(255, 135, 0, 0.3);
    border-radius: 15px;
    flex-wrap: wrap;
    box-shadow: 0 5px 20px rgba(255, 62, 13, 0.2);
  }

  .play-btn {
    padding: 12px 24px;
    font-size: 16px;
    font-weight: bold;
    background: linear-gradient(45deg, rgb(255, 180, 120), rgb(255, 210, 150));
    color: white;
    border: none;
    border-radius: 25px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(255, 180, 120, 0.3);
  }

  .play-btn:hover:not(:disabled) {
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(255, 180, 120, 0.4);
    background: linear-gradient(45deg, rgb(255, 210, 150), rgb(255, 180, 120));
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
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.7);
  }

  .progress-bar {
    flex: 1;
    height: 8px;
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 135, 0, 0.4);
    border-radius: 5px;
    overflow: hidden;
    cursor: pointer;
    position: relative;
    box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.3);
  }

  .progress-bar:hover {
    height: 10px;
    background: rgba(255, 255, 255, 0.3);
    border-color: rgb(255, 210, 150);
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, rgb(255, 180, 120), rgb(255, 210, 150));
    border-radius: 4px;
    transition: width 0.1s ease;
    box-shadow: 0 0 10px rgba(255, 180, 120, 0.5);
  }

  .status {
    text-align: center;
    padding: 10px;
    font-weight: bold;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 210, 150, 0.4);
    border-radius: 8px;
    color: white;
    box-shadow: 0 3px 10px rgba(255, 62, 13, 0.2);
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
    background: rgba(255, 135, 0, 0.2);
    border-radius: 8px;
    border: 1px solid rgba(255, 135, 0, 0.4);
    color: white;
    box-shadow: 0 2px 8px rgba(255, 62, 13, 0.15);
  }

  .game-hint {
    background: rgba(255, 62, 13, 0.2);
    border: 1px solid rgba(255, 62, 13, 0.4);
  }

  .note-stats {
    text-align: center;
    padding: 10px;
    font-size: 14px;
    opacity: 0.9;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 135, 0, 0.3);
    border-radius: 8px;
    color: white;
    box-shadow: 0 2px 8px rgba(255, 62, 13, 0.15);
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
