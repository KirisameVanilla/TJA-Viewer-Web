// 游戏状态管理
export class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.hitCount = { perfect: 0, good: 0, bad: 0, miss: 0 };
    this.judgeText = "";
    this.judgeTimeout = null;
    this.gameStartTime = 0;
    
    // 连打和气球状态
    this.activeRolls = [];
    this.activeBalloons = [];
    this.balloonHitCounts = new Map();
    this.rollHitCounts = new Map();
    this.lastRollHitTime = new Map();
    
    // 音符状态
    this.hitNotes = [];
    this.visibleNotes = [];
    this.measureLines = [];
  }

  // 更新分数
  updateScore(judge, comboBonus = 0) {
    let scoreAdd = 0;
    
    switch (judge) {
      case "PERFECT":
        scoreAdd = 1000;
        this.hitCount.perfect++;
        this.combo++;
        break;
      case "GOOD":
        scoreAdd = 500;
        this.hitCount.good++;
        this.combo++;
        break;
      case "BAD":
        scoreAdd = 100;
        this.hitCount.bad++;
        this.combo = 0;
        break;
      case "MISS":
        this.hitCount.miss++;
        this.combo = 0;
        break;
    }
    
    this.score += scoreAdd + (this.combo * 10) + comboBonus;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
  }

  // 显示判定文字
  showJudgeText(judge) {
    this.judgeText = judge;
    if (this.judgeTimeout) {
      clearTimeout(this.judgeTimeout);
    }
    this.judgeTimeout = setTimeout(() => {
      this.judgeText = "";
    }, 500);
  }

  // 获取判定文字颜色
  getJudgeColor(judge) {
    switch (judge) {
      case 'PERFECT': return '#ffdd00';
      case 'GOOD': return '#00ff00';
      case 'BAD': return '#ffaa00';
      case 'MISS': return '#ff0000';
      default: return '#ffffff';
    }
  }

  // 重置音符状态
  resetNoteStates(tjaData) {
    if (tjaData && tjaData.notes) {
      tjaData.notes.forEach((note) => {
        note.hasBeenHit = false;
        note.hasBeenJudged = false;
        note.isRollActive = false;
        note.isBalloonActive = false;
        note.isBalloonPopped = false;
        note.isBalloonTimeout = false;
      });
    }
    
    this.hitNotes = [];
    this.activeRolls = [];
    this.activeBalloons = [];
    this.balloonHitCounts.clear();
    this.rollHitCounts.clear();
    this.lastRollHitTime.clear();
  }
}
