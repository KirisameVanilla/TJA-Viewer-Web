// 游戏引擎 - 处理游戏逻辑、音符判定等
export class GameEngine {
  constructor(gameState) {
    this.gameState = gameState;
    this.noteSpeed = 1.0;
  }

  // 计算音符位置（考虑滚动速度变化）
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

  // 更新可见音符
  updateVisibleNotes(tjaData, currentTime, isPlayMode) {
    if (!tjaData) return;

    const baseLookAhead = 3;
    const lookAhead = baseLookAhead * this.noteSpeed;
    const lookBehind = 0.5;

    this.gameState.visibleNotes = tjaData.notes.filter(
      (note) =>
        note.time >= currentTime - lookBehind &&
        note.time <= currentTime + lookAhead &&
        (isPlayMode ? 
          !note.hasBeenJudged : 
          !note.hasBeenHit)
    );

    this.gameState.measureLines = tjaData.measureLines.filter(
      (measureLine) =>
        measureLine.time >= currentTime - lookBehind &&
        measureLine.time <= currentTime + lookAhead
    );

    // 预览模式下的自动击飞效果
    if (!isPlayMode) {
      this.handleAutoHit(tjaData, currentTime);
    } else {
      this.updateActiveSpecialNotes(tjaData, currentTime);
    }

    this.updateHitNotes();
    
    if (isPlayMode) {
      this.checkMissedNotes(tjaData, currentTime);
    }
  }

  // 预览模式自动击飞
  handleAutoHit(tjaData, currentTime) {
    const hitLineX = 120;
    const speed = 300 * this.noteSpeed;

    tjaData.notes.forEach((note) => {
      const x = this.calculateNotePosition(note.time, currentTime, speed, tjaData);
      const timeDiff = note.time - currentTime;
      const hitWindow = 0.05 / this.noteSpeed;

      if (!note.hasBeenHit && Math.abs(timeDiff) < hitWindow) {
        note.hasBeenHit = true;
        this.triggerHitEffect(note, x, 100);
      }
    });
  }

  // 更新活跃的特殊音符（连打和气球）
  updateActiveSpecialNotes(tjaData, currentTime) {
    if (!tjaData) return;
    
    // 检查新的连打音符
    for (let i = 0; i < tjaData.notes.length; i++) {
      const note = tjaData.notes[i];
      
      if ((note.type === 5 || note.type === 6) && !note.isRollActive && note.time <= currentTime + 0.1) {
        let endNote = null;
        for (let j = i + 1; j < tjaData.notes.length; j++) {
          if (tjaData.notes[j].type === 8) {
            endNote = tjaData.notes[j];
            break;
          }
        }
        
        if (endNote) {
          const rollData = {
            note: note,
            startTime: note.time,
            endTime: endNote.time,
            type: note.type,
            currentTime: currentTime
          };
          
          this.gameState.activeRolls.push(rollData);
          note.isRollActive = true;
        }
      }
      
      // 检查气球音符
      if (note.type === 7 && !note.isBalloonActive && note.time <= currentTime + 0.1) {
        let endNote = null;
        for (let j = i + 1; j < tjaData.notes.length; j++) {
          if (tjaData.notes[j].type === 8) {
            endNote = tjaData.notes[j];
            break;
          }
        }
        
        if (endNote) {
          const requiredHits = this.getBalloonHits(note, tjaData);
          
          const balloonData = {
            note: note,
            startTime: note.time,
            endTime: endNote.time,
            requiredHits: requiredHits,
            currentTime: currentTime,
            isPopped: false
          };
          
          this.gameState.activeBalloons.push(balloonData);
          note.isBalloonActive = true;
        }
      }
    }
    
    // 移除已结束的连打
    this.gameState.activeRolls = this.gameState.activeRolls.filter(roll => {
      if (currentTime >= roll.endTime) {
        const rollId = `roll_${roll.startTime}`;
        const hitCount = this.gameState.rollHitCounts.get(rollId) || 0;
        console.log(`连打结束: 击打了 ${hitCount} 次`);
        return false;
      }
      return true;
    });
    
    // 移除已结束的气球
    this.gameState.activeBalloons = this.gameState.activeBalloons.filter(balloon => {
      if (currentTime >= balloon.endTime && !balloon.isPopped) {
        balloon.note.isBalloonTimeout = true;
        balloon.note.hasBeenJudged = true;
        
        const hitLineX = 120;
        const missNote = {
          ...balloon.note,
          x: hitLineX,
          y: 100,
          vx: -300 - Math.random() * 200,
          vy: -200 - Math.random() * 100,
          gravity: 600,
          opacity: 0.7,
          fadeSpeed: 2.0,
          startTime: performance.now(),
        };
        this.gameState.hitNotes.push(missNote);
        
        return false;
      }
      return !balloon.isPopped;
    });
  }

  // 处理玩家击打
  handlePlayerHit(hitType, tjaData, currentTime) {
    if (!tjaData) return;

    const currentTimeMs = currentTime * 1000;
    
    // 检查连打和气球
    let hitActiveSpecial = false;
    
    for (let roll of this.gameState.activeRolls) {
      if (this.canHitRoll(roll)) {
        this.hitRoll(roll);
        hitActiveSpecial = true;
        break;
      }
    }
    
    if (!hitActiveSpecial) {
      for (let balloon of this.gameState.activeBalloons) {
        if (this.canHitBalloon(balloon)) {
          this.hitBalloon(balloon, tjaData);
          hitActiveSpecial = true;
          break;
        }
      }
    }
    
    if (hitActiveSpecial) return;

    // 查找最近的普通音符
    let closestNote = null;
    let closestDistance = Infinity;
    let hasNearbyNote = false; // 标记是否有附近的音符
    
    for (let note of tjaData.notes) {
      if (note.hasBeenJudged) continue;
      if (note.type === 5 || note.type === 6 || note.type === 7 || note.type === 8) continue;
      
      const noteTimeMs = note.time * 1000;
      const timeDiff = Math.abs(noteTimeMs - currentTimeMs);
      
      const badWindow = 150;
      
      // 检查是否有附近的音符（不管类型是否匹配）
      if (timeDiff <= badWindow) {
        hasNearbyNote = true;
        
        // 只有类型匹配的音符才能被击打
        const noteType = this.getNoteHitType(note.type);
        if (noteType === hitType && timeDiff < closestDistance) {
          closestNote = note;
          closestDistance = timeDiff;
        }
      }
    }

    if (closestNote) {
      let judge = "";
      
      if (closestDistance <= 50) {
        judge = "PERFECT";
      } else if (closestDistance <= 100) {
        judge = "GOOD";
      } else {
        judge = "BAD";
      }
      
      this.gameState.updateScore(judge);
      this.gameState.showJudgeText(judge);
      
      closestNote.hasBeenJudged = true;
      closestNote.hasBeenHit = true;
      
      const speed = 300 * this.noteSpeed;
      const x = this.calculateNotePosition(closestNote.time, currentTime, speed, tjaData);
      this.triggerHitEffect(closestNote, x, 100);
    } else if (hasNearbyNote) {
      // 只有当附近有音符但类型不匹配或时机不对时才算MISS
      this.gameState.updateScore("MISS");
      this.gameState.showJudgeText("MISS");
    }
    // 如果附近没有任何音符，则什么都不做（不计算MISS）
  }

  // 检查连打是否可以击打
  canHitRoll(roll) {
    const rollId = `roll_${roll.startTime}`;
    const lastHit = this.gameState.lastRollHitTime.get(rollId) || 0;
    const now = performance.now();
    return now - lastHit >= 50;
  }

  // 击打连打
  hitRoll(roll) {
    const rollId = `roll_${roll.startTime}`;
    const currentHitCount = this.gameState.rollHitCounts.get(rollId) || 0;
    
    this.gameState.rollHitCounts.set(rollId, currentHitCount + 1);
    this.gameState.lastRollHitTime.set(rollId, performance.now());
    
    this.gameState.score += 100;
    this.gameState.showJudgeText("连打!");
    
    const speed = 300 * this.noteSpeed;
    const x = this.calculateNotePosition(roll.currentTime || 0, 0, speed);
    this.triggerHitEffect({ ...roll.note, type: roll.note.type }, x, 100);
  }

  // 检查气球是否可以击打
  canHitBalloon(balloon) {
    if (balloon.isPopped) return false;
    
    const balloonId = `balloon_${balloon.startTime}`;
    const lastHit = this.gameState.lastRollHitTime.get(balloonId) || 0;
    const now = performance.now();
    
    return now - lastHit >= 10;
  }

  // 击打气球
  hitBalloon(balloon, tjaData) {
    const balloonId = `balloon_${balloon.startTime}`;
    const currentHitCount = this.gameState.balloonHitCounts.get(balloonId) || 0;
    const newHitCount = currentHitCount + 1;
    
    this.gameState.balloonHitCounts.set(balloonId, newHitCount);
    this.gameState.lastRollHitTime.set(balloonId, performance.now());
    
    this.gameState.score += 100;
    
    if (newHitCount >= balloon.requiredHits) {
      balloon.isPopped = true;
      this.gameState.score += 500;
      this.gameState.showJudgeText("爆炸!");
      
      const index = this.gameState.activeBalloons.indexOf(balloon);
      if (index > -1) {
        this.gameState.activeBalloons.splice(index, 1);
      }
      
      balloon.note.isBalloonPopped = true;
      balloon.note.hasBeenHit = true;
      balloon.note.hasBeenJudged = true;
      
      const hitLineX = 120;
      this.triggerHitEffect({ ...balloon.note, type: 7 }, hitLineX, 100);
    } else {
      this.gameState.showJudgeText(`气球 ${newHitCount}/${balloon.requiredHits}`);
      
      const hitLineX = 120;
      const hitNote = {
        ...balloon.note,
        x: hitLineX,
        y: 100,
        vx: 0,
        vy: -50,
        gravity: 200,
        opacity: 1.0,
        fadeSpeed: 500.0,
        startTime: performance.now(),
      };
      this.gameState.hitNotes.push(hitNote);
    }
  }

  // 获取音符击打类型
  getNoteHitType(noteType) {
    switch (noteType) {
      case 1:
      case 3:
        return "don";
      case 2:
      case 4:
        return "ka";
      default:
        return null;
    }
  }

  // 获取气球击打次数
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

  // 触发击飞效果
  triggerHitEffect(note, x, y) {
    const hitNote = {
      ...note,
      x: x,
      y: y,
      vx: -400 - 0.8 * 80000,
      vy: -300 - 0.8 * 56000,
      gravity: 600,
      opacity: 1.0,
      fadeSpeed: 20,
      startTime: performance.now(),
    };
    this.gameState.hitNotes.push(hitNote);
  }

  // 更新击飞音符
  updateHitNotes() {
    const now = performance.now();

    this.gameState.hitNotes.forEach((hitNote) => {
      const deltaTime = (now - hitNote.startTime) / 1000;

      hitNote.x += hitNote.vx * deltaTime * 0.016;
      hitNote.y += hitNote.vy * deltaTime * 0.016;
      hitNote.vy += hitNote.gravity * deltaTime * 0.016;

      hitNote.opacity -= hitNote.fadeSpeed * deltaTime * 0.016;

      hitNote.startTime = now;
    });

    this.gameState.hitNotes = this.gameState.hitNotes.filter(
      (hitNote) => hitNote.opacity > 0 && hitNote.x > -100 && hitNote.y < 300
    );
  }

  // 检查错过的音符
  checkMissedNotes(tjaData, currentTime) {
    if (!tjaData) return;

    const currentTimeMs = currentTime * 1000;
    
    tjaData.notes.forEach(note => {
      if (!note.hasBeenJudged && !note.hasBeenHit) {
        const noteTimeMs = note.time * 1000;
        
        if (currentTimeMs > noteTimeMs + 150) {
          note.hasBeenJudged = true;
          this.gameState.updateScore("MISS");
        }
      }
    });
  }

  // 设置音符速度
  setNoteSpeed(speed) {
    this.noteSpeed = speed;
  }
}
