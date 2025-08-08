// 游戏渲染器
import { Utils } from './Utils.js';

export class GameRenderer {
  constructor(canvas, gameState) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.gameState = gameState;
    this.noteSpeed = 1.0;
    
    if (canvas) {
      this.setupCanvas();
    }
  }

  setupCanvas() {
    this.canvas.width = 800;
    this.canvas.height = 200;
  }

  // 主渲染函数
  render(tjaData, currentTime, isPlayMode, duration) {
    if (!this.canvas || !tjaData) return;

    const width = this.canvas.width;
    const height = this.canvas.height;

    // 清空画布
    this.ctx.fillStyle = "#000022";
    this.ctx.fillRect(0, 0, width, height);

    this.drawTrack(width, height);
    this.drawJudgeLine();
    this.drawMeasureLines(tjaData, currentTime, width);
    this.drawNotes(tjaData, currentTime);
    this.drawHitNotes();
    this.drawUI(tjaData, currentTime, isPlayMode, width, height, duration);
  }

  // 绘制轨道背景
  drawTrack(width, height) {
    this.ctx.fillStyle = "#111133";
    this.ctx.fillRect(80, 50, width - 160, 100);
  }

  // 绘制判定线
  drawJudgeLine() {
    // 判定线
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.moveTo(120, 40);
    this.ctx.lineTo(120, 160);
    this.ctx.stroke();

    // 判定圆
    this.ctx.strokeStyle = "#ffff00";
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(120, 100, 25, 0, 2 * Math.PI);
    this.ctx.stroke();
  }

  // 绘制小节线
  drawMeasureLines(tjaData, currentTime, width) {
    const speed = 300 * this.noteSpeed;

    this.ctx.strokeStyle = "#666666";
    this.ctx.lineWidth = 1;
    
    this.gameState.measureLines.forEach((measureLine) => {
      const x = this.calculateNotePosition(measureLine.time, currentTime, speed, tjaData);

      if (x >= 80 && x <= width - 80) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, 50);
        this.ctx.lineTo(x, 150);
        this.ctx.stroke();

        this.ctx.fillStyle = "#aaaaaa";
        this.ctx.font = "10px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText(`${measureLine.measure + 1}`, x, 45);
      }
    });
  }

  // 绘制音符
  drawNotes(tjaData, currentTime) {
    const speed = 300 * this.noteSpeed;
    const hitLineX = 120;

    this.gameState.visibleNotes.forEach((note) => {
      let x = this.calculateNotePosition(note.time, currentTime, speed, tjaData);
      const y = 100;

      if (x < -30 || x > this.canvas.width + 30) return;
      if (note.type === 8) return;

      let radius = 20;
      let color = "#888888";
      let strokeColor = "#ffffff";
      let shouldDrawNote = true;

      // 根据音符类型设置样式
      switch (note.type) {
        case 1: // 咚 - 红色
          color = "#ff4444";
          radius = 22;
          break;
        case 2: // 咔 - 蓝色
          color = "#4444ff";
          radius = 22;
          break;
        case 3: // 大咚 - 大红色
          color = "#ff2222";
          radius = 30;
          strokeColor = "#ffaa00";
          break;
        case 4: // 大咔 - 大蓝色
          color = "#2222ff";
          radius = 30;
          strokeColor = "#ffaa00";
          break;
        case 5: // 小连打
          color = "#ffff44";
          radius = 20;
          if (note.isRollActive) {
            this.drawRollTrack(note, x, y, speed, tjaData);
            shouldDrawNote = x >= hitLineX - 50;
          }
          break;
        case 6: // 大连打
          color = "#ffff22";
          radius = 28;
          strokeColor = "#ff8800";
          if (note.isRollActive) {
            this.drawRollTrack(note, x, y, speed, tjaData);
            shouldDrawNote = x >= hitLineX - 50;
          }
          break;
        case 7: // 气球
          color = "#ff44ff";
          radius = 25;
          
          if (note.isBalloonActive && !note.isBalloonPopped) {
            const balloonId = `balloon_${note.time}`;
            const currentHits = this.gameState.balloonHitCounts.get(balloonId) || 0;
            const requiredHits = this.getBalloonHits(note, tjaData);
            
            if (currentTime >= note.time) {
              x = hitLineX;
            }
            
            const progress = currentHits / requiredHits;
            if (progress > 0.8) {
              color = "#ff8844";
            } else if (progress > 0.5) {
              color = "#ff6666";
            }
            
            this.drawBalloonProgress(x, y - 35, currentHits, requiredHits);
          } else if (note.isBalloonPopped || note.isBalloonTimeout) {
            shouldDrawNote = false;
          } else {
            let endTime = note.time + 2;
            for (let i = 0; i < tjaData.notes.length; i++) {
              if (tjaData.notes[i].time > note.time && tjaData.notes[i].type === 8) {
                endTime = tjaData.notes[i].time;
                break;
              }
            }
            
            if (currentTime >= note.time && currentTime < endTime) {
              x = hitLineX;
            }
          }
          
          if (!shouldDrawNote) return;
          break;
      }

      if (!shouldDrawNote) return;

      // GOGO模式效果
      if (note.gogo) {
        const flash = Math.sin(currentTime * 10) * 0.3 + 0.7;
        strokeColor = `rgba(255, 255, 0, ${flash})`;

        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = 6;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius + 8, 0, 2 * Math.PI);
        this.ctx.stroke();
      }

      // 绘制音符主体
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
      this.ctx.fill();

      // 绘制音符边框
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
      this.ctx.stroke();

      // 绘制音符内部标记
      this.drawNoteSymbol(note.type, x, y, radius);
    });
  }

  // 绘制音符符号
  drawNoteSymbol(noteType, x, y, radius) {
    this.ctx.fillStyle = "#ffffff";
    this.ctx.font = "12px Arial";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";

    let symbol = "";
    switch (noteType) {
      case 1:
      case 3:
        symbol = "咚";
        break;
      case 2:
      case 4:
        symbol = "咔";
        break;
      case 5:
      case 6:
        symbol = "连";
        break;
      case 7:
        symbol = "气";
        break;
    }

    if (symbol && radius > 18) {
      this.ctx.fillText(symbol, x, y);
    }
  }

  // 绘制连打轨道
  drawRollTrack(rollNote, startX, y, speed, tjaData) {
    let endTime = rollNote.time + 2;
    for (let i = 0; i < tjaData.notes.length; i++) {
      if (tjaData.notes[i].time > rollNote.time && tjaData.notes[i].type === 8) {
        endTime = tjaData.notes[i].time;
        break;
      }
    }
    
    const endX = this.calculateNotePosition(endTime, 0, speed, tjaData);
    
    const trackStartX = Math.max(80, Math.min(startX, endX));
    const trackEndX = Math.min(this.canvas.width - 80, Math.max(startX, endX));
    
    if (trackEndX > trackStartX) {
      this.ctx.fillStyle = rollNote.type === 6 ? "rgba(255, 255, 34, 0.3)" : "rgba(255, 255, 68, 0.3)";
      this.ctx.fillRect(trackStartX, y - 15, trackEndX - trackStartX, 30);
      
      this.ctx.strokeStyle = rollNote.type === 6 ? "#ffcc00" : "#ffff44";
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(trackStartX, y - 15, trackEndX - trackStartX, 30);
      
      if (rollNote.isRollActive) {
        const rollId = `roll_${rollNote.time}`;
        const hitCount = this.gameState.rollHitCounts.get(rollId) || 0;
        
        if (hitCount > 0) {
          this.ctx.fillStyle = "#ffffff";
          this.ctx.font = "bold 12px Arial";
          this.ctx.textAlign = "center";
          this.ctx.fillText(`${hitCount}连`, (trackStartX + trackEndX) / 2, y - 25);
        }
      }
    }
  }

  // 绘制气球进度
  drawBalloonProgress(x, y, currentHits, requiredHits) {
    const progressWidth = 50;
    const progressHeight = 6;
    
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    this.ctx.fillRect(x - progressWidth/2, y, progressWidth, progressHeight);
    
    const progress = Math.min(currentHits / requiredHits, 1);
    this.ctx.fillStyle = progress >= 1 ? "#00ff00" : "#ffff00";
    this.ctx.fillRect(x - progressWidth/2, y, progressWidth * progress, progressHeight);
    
    this.ctx.fillStyle = "#ffffff";
    this.ctx.font = "10px Arial";
    this.ctx.textAlign = "center";
    this.ctx.fillText(`${currentHits}/${requiredHits}`, x, y - 2);
  }

  // 绘制击飞音符
  drawHitNotes() {
    this.gameState.hitNotes.forEach((hitNote) => {
      const x = hitNote.x;
      const y = hitNote.y;
      let radius = 20;
      let color = "#888888";
      let strokeColor = "#ffffff";

      switch (hitNote.type) {
        case 1:
          color = "#ff4444";
          radius = 22;
          break;
        case 2:
          color = "#4444ff";
          radius = 22;
          break;
        case 3:
          color = "#ff2222";
          radius = 30;
          strokeColor = "#ffaa00";
          break;
        case 4:
          color = "#2222ff";
          radius = 30;
          strokeColor = "#ffaa00";
          break;
        case 5:
          color = "#ffff44";
          radius = 20;
          break;
        case 6:
          color = "#ffff22";
          radius = 28;
          strokeColor = "#ff8800";
          break;
        case 7:
          color = "#ff44ff";
          radius = 25;
          break;
      }

      const alpha = Math.max(0, Math.min(1, hitNote.opacity));
      
      const addAlpha = (colorStr, alpha) => {
        return Utils.addAlpha(colorStr, alpha);
      };

      // 绘制音符主体
      this.ctx.fillStyle = addAlpha(color, alpha);
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
      this.ctx.fill();

      // 绘制边框
      this.ctx.strokeStyle = addAlpha(strokeColor, alpha);
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
      this.ctx.stroke();

      // 绘制符号
      this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      this.drawNoteSymbol(hitNote.type, x, y, radius);
    });
  }

  // 绘制UI信息
  drawUI(tjaData, currentTime, isPlayMode, width, height, duration) {
    // 时间信息
    this.ctx.fillStyle = "#ff0000";
    this.ctx.font = "14px Arial";
    this.ctx.textAlign = "left";
    this.ctx.fillText(`时间: ${this.formatTime(currentTime)}`, 10, 30);

    // 当前小节数
    let currentMeasure = 0;
    if (tjaData && tjaData.measureLines) {
      for (let i = tjaData.measureLines.length - 1; i >= 0; i--) {
        if (tjaData.measureLines[i].time <= currentTime) {
          currentMeasure = tjaData.measureLines[i].measure + 1;
          break;
        }
      }
    }
    this.ctx.fillText(`小节: ${currentMeasure}`, 200, 30);

    // BPM信息
    if (tjaData) {
      this.ctx.fillText(`BPM: ${tjaData.bpm}`, 10, height - 10);
    }
    
    // 游玩模式UI
    if (isPlayMode) {
      this.drawGameUI(width, height);
    }
  }

  // 绘制游戏UI
  drawGameUI(width, height) {
    // 分数
    this.ctx.fillStyle = '#ffdd00';
    this.ctx.font = 'bold 20px Arial';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`分数: ${this.gameState.score}`, width - 10, 30);
    
    // 连击数
    this.ctx.fillStyle = this.gameState.combo > 10 ? '#ff6b6b' : '#ffffff';
    this.ctx.font = 'bold 16px Arial';
    this.ctx.fillText(`连击: ${this.gameState.combo}`, width - 10, 55);
    
    // 判定文字
    if (this.gameState.judgeText) {
      this.ctx.fillStyle = this.gameState.getJudgeColor(this.gameState.judgeText);
      this.ctx.font = 'bold 24px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(this.gameState.judgeText, width / 2, height / 2 - 20);
    }
    
    // 命中统计
    this.ctx.fillStyle = '#cccccc';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`Perfect: ${this.gameState.hitCount.perfect} Good: ${this.gameState.hitCount.good} Bad: ${this.gameState.hitCount.bad} Miss: ${this.gameState.hitCount.miss}`, 10, height - 30);
    this.ctx.fillText(`Max Combo: ${this.gameState.maxCombo}`, 10, height - 50);
    
    // 活跃特殊音符信息
    if (this.gameState.activeRolls.length > 0 || this.gameState.activeBalloons.length > 0) {
      let infoY = 170;
      this.ctx.fillStyle = '#ffff00';
      this.ctx.font = '12px Arial';
      this.ctx.textAlign = 'left';
      
      this.gameState.activeRolls.forEach((roll, index) => {
        const rollId = `roll_${roll.startTime}`;
        const hitCount = this.gameState.rollHitCounts.get(rollId) || 0;
        this.ctx.fillText(`连打${index + 1}: ${hitCount}次`, 10, infoY);
        infoY += 15;
      });
      
      this.gameState.activeBalloons.forEach((balloon, index) => {
        const balloonId = `balloon_${balloon.startTime}`;
        const hitCount = this.gameState.balloonHitCounts.get(balloonId) || 0;
        this.ctx.fillText(`气球${index + 1}: ${hitCount}/${balloon.requiredHits}`, 10, infoY);
        infoY += 15;
      });
    }
  }

  // 计算音符位置（与GameEngine中的方法相同）
  calculateNotePosition(noteTime, currentTime, baseSpeed, tjaData) {
    if (!tjaData || !tjaData.scrollChanges || tjaData.scrollChanges.length === 0) {
      const timeDiff = noteTime - currentTime;
      return 120 + timeDiff * baseSpeed;
    }

    let effectiveScrollSpeed = 1.0;
    let lastChangeTime = -Infinity;

    for (const scrollChange of tjaData.scrollChanges) {
      if (scrollChange.time <= noteTime && scrollChange.time > lastChangeTime) {
        effectiveScrollSpeed = scrollChange.scrollSpeed;
        lastChangeTime = scrollChange.time;
      }
    }

    const timeDiff = noteTime - currentTime;
    return 120 + timeDiff * baseSpeed * effectiveScrollSpeed;
  }

  // 获取气球击打次数（临时方法，应该从GameEngine获取）
  getBalloonHits(balloonNote, courseData) {
    if (!courseData.metadata || !courseData.metadata.BALLOON) {
      return 5;
    }
    
    const balloonHits = courseData.metadata.BALLOON.split(',').map(s => parseInt(s.trim()));
    
    let balloonIndex = 0;
    for (let note of courseData.notes) {
      if (note.type === 7) {
        if (note === balloonNote) {
          break;
        }
        balloonIndex++;
      }
    }
    
    return balloonHits[balloonIndex] || 5;
  }

  // 时间格式化
  formatTime(seconds) {
    return Utils.formatTime(seconds);
  }

  // 设置音符速度
  setNoteSpeed(speed) {
    this.noteSpeed = speed;
  }
}
