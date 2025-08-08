<script>
  import { onMount } from "svelte";
  import JSZip from "jszip";

  let tjaData = null;
  let audioElement = null;
  let isLoaded = false;
  let isPlaying = false;
  let currentTime = 0;
  let duration = 0;
  let loadingStatus = "正在加载...";
  let notes = [];
  let visibleNotes = [];
  let gameCanvas;
  let hitNotes = []; // 存储被击中的音符，用于击飞动画
  let noteSpeed = 1.0; // 音符流动速度倍率，1.0为默认速度
  let measureLines = []; // 存储小节线信息
  let tjaCourses = []; // 存储所有难度的谱面数据
  let selectedCourse = ""; // 当前选择的难度

  // 游玩相关状态
  let isPlayMode = false; // 是否处于游玩模式
  let score = 0; // 分数
  let combo = 0; // 连击数
  let maxCombo = 0; // 最大连击数
  let hitCount = { perfect: 0, good: 0, bad: 0, miss: 0 }; // 命中统计
  let judgeText = ""; // 判定文字显示
  let judgeTimeout = null; // 判定文字显示超时
  let gameStartTime = 0; // 游戏开始时间
  
  // 连打和气球相关状态
  let activeRolls = []; // 当前活跃的连打音符（type 5、6）
  let activeBalloons = []; // 当前活跃的气球音符（type 7）
  let balloonHitCounts = new Map(); // 气球击打次数记录
  let rollHitCounts = new Map(); // 连打击打次数记录
  let lastRollHitTime = new Map(); // 连打最后击打时间，防止连击太快

  // zip 相关
  let tjaFiles = [];
  let oggFiles = [];
  let selectedTja = "";
  let selectedOgg = "";
  let zipFileMap = {}; // 文件名: Blob

  // 太鼓音符类型
  const NOTE_TYPES = {
    0: "empty",
    1: "don", // 红色
    2: "ka", // 蓝色
    3: "don_big", // 大红
    4: "ka_big", // 大蓝
    5: "roll", // 黄卷
    6: "roll_big", // 大黄卷
    7: "balloon", // 气球
    8: "end_roll", // 卷结束
  };

  onMount(() => {
    loadingStatus = "请通过 postMessage 发送 zip 包 URL";
    function handleMsg(event) {
      if (event.data && typeof event.data === "object") {
        if (event.data.zipUrl) {
          loadZipFromUrl(event.data.zipUrl);
        } else if (
          event.data.type === "zip" &&
          event.data.blob instanceof Blob
        ) {
          loadZipFromBlob(event.data.blob);
        }
      }
    }
    window.addEventListener("message", handleMsg);
    async function loadZipFromBlob(blob) {
      loadingStatus = "正在解压 zip...";
      try {
        const zip = await JSZip.loadAsync(blob);
        tjaFiles = [];
        oggFiles = [];
        zipFileMap = {};
        zip.forEach((relPath, file) => {
          if (!file.dir) {
            if (relPath.endsWith(".tja")) tjaFiles.push(relPath);
            if (relPath.endsWith(".ogg")) oggFiles.push(relPath);
            zipFileMap[relPath] = file;
          }
        });
        if (tjaFiles.length === 0 || oggFiles.length === 0) {
          loadingStatus = "zip 包中未找到 tja 或 ogg 文件";
          return;
        }
        selectedTja = tjaFiles[0];
        selectedOgg = oggFiles[0];
        loadingStatus = "请选择谱面和音频文件";
        isLoaded = false;
      } catch (e) {
        loadingStatus = "zip 加载或解压失败: " + e;
      }
    }
    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("message", handleMsg);
      window.removeEventListener("keydown", handleKeyPress);
      stopAnimation();
    };
  });

  async function loadZipFromUrl(zipUrl) {
    loadingStatus = "正在下载 zip 包...";
    try {
      const resp = await fetch(zipUrl);
      if (!resp.ok) throw new Error("下载失败");
      const blob = await resp.blob();
      loadingStatus = "正在解压 zip...";
      const zip = await JSZip.loadAsync(blob);
      tjaFiles = [];
      oggFiles = [];
      zipFileMap = {};
      zip.forEach((relPath, file) => {
        if (!file.dir) {
          if (relPath.endsWith(".tja")) tjaFiles.push(relPath);
          if (relPath.endsWith(".ogg")) oggFiles.push(relPath);
          zipFileMap[relPath] = file;
        }
      });
      if (tjaFiles.length === 0 || oggFiles.length === 0) {
        loadingStatus = "zip 包中未找到 tja 或 ogg 文件";
        return;
      }
      selectedTja = tjaFiles[0];
      selectedOgg = oggFiles[0];
      loadingStatus = "请选择谱面和音频文件";
      isLoaded = false;
    } catch (e) {
      loadingStatus = "zip 加载或解压失败: " + e;
    }
  }

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
          // 咚（红色音符）
          hitType = "don";
          break;
        case "KeyD":
        case "KeyK":
          // 咔（蓝色音符）
          hitType = "ka";
          break;
      }
      
      if (hitType) {
        handlePlayerHit(hitType);
      }
    }
  }

  async function loadTJAFileFromZip() {
    if (!selectedTja || !zipFileMap[selectedTja]) return;
    loadingStatus = "正在加载 TJA 谱面...";
    try {
      const text = await zipFileMap[selectedTja].async("text");
      tjaCourses = parseTJA(text);

      if (tjaCourses.length > 0) {
        // 默认选择第一个难度
        selectedCourse = tjaCourses[0].name;
        tjaData = tjaCourses[0];
        loadingStatus = `谱面加载完成，找到 ${tjaCourses.length} 个难度`;
      } else {
        loadingStatus = "TJA 文件中没有找到有效的谱面数据";
        tjaData = null;
      }
    } catch (e) {
      loadingStatus = "TJA 加载失败: " + e;
      tjaCourses = [];
      tjaData = null;
    }
  }

  function handleCourseChange() {
    if (!tjaCourses || tjaCourses.length === 0) return;

    const course = tjaCourses.find((c) => c.name === selectedCourse);
    if (course) {
      tjaData = course;
      // 重置播放状态
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
        currentTime = 0;
        isPlaying = false;
        stopAnimation();
      }
      resetNoteStates();
      setupCanvas();
    }
  }

  let volume = 0.7;

  async function loadAudioFileFromZip() {
    if (!selectedOgg || !zipFileMap[selectedOgg]) return;
    loadingStatus = "正在加载音频文件...";
    try {
      const blob = await zipFileMap[selectedOgg].async("blob");
      const url = URL.createObjectURL(blob);
      audioElement = new Audio(url);
      audioElement.volume = volume;
      return new Promise((resolve, reject) => {
        audioElement.addEventListener("loadedmetadata", () => {
          duration = audioElement.duration;
          loadingStatus = "音频加载完成";
          resolve();
        });
        audioElement.addEventListener("timeupdate", () => {
          currentTime = audioElement.currentTime;
        });
        audioElement.addEventListener("ended", () => {
          isPlaying = false;
          stopAnimation();
          currentTime = 0;
          audioElement.currentTime = 0;
        });
        audioElement.addEventListener("pause", () => {
          isPlaying = false;
          stopAnimation();
        });
        audioElement.addEventListener("error", (e) => {
          loadingStatus = "音频文件加载失败";
          reject(e);
        });
        audioElement.load();
      });
    } catch (e) {
      loadingStatus = "音频加载失败: " + e;
      throw e;
    }
  }

  function handleVolumeChange(event) {
    volume = parseFloat(event.target.value);
    if (audioElement) {
      audioElement.volume = volume;
    }
  }

  async function handleFileSelect() {
    await loadTJAFileFromZip();
    await loadAudioFileFromZip();
    setupCanvas();
    isLoaded = true;
    loadingStatus = "加载完成！点击播放按钮开始预览";
  }

  function parseTJA(text) {
    const lines = text.split("\n");
    const globalMetadata = {};
    const courses = [];

    let currentCourse = null;
    let inNoteSection = false;
    let currentBPM = 150;
    let currentTime = 0;
    let gogoMode = false;
    let offset = 0;
    let measureNumber = 0;

    // 计算基于当前拍子的小节时长
    function getMeasureDuration(bpm, measureSignature = { numerator: 4, denominator: 4 }) {
      // 基础4/4拍小节时长：(60 / BPM) * 4
      // 对于A/B拍：(60 / BPM) * (A * 4 / B)
      const baseBeatDuration = 60 / bpm; // 一拍的时长
      const beatsPerMeasure = (measureSignature.numerator * 4) / measureSignature.denominator;
      return baseBeatDuration * beatsPerMeasure;
    }

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      // 跳过空行和注释
      if (!line || line.startsWith("//")) continue;

      // 检测新的难度开始（必须在通用元数据解析之前）
      if (line.startsWith("COURSE:")) {
        // 如果之前有未完成的难度，先保存它
        if (currentCourse && inNoteSection) {
          courses.push(currentCourse);
        }

        const courseName = line.split(":", 2)[1].trim();

        currentCourse = {
          name: courseName,
          metadata: { ...globalMetadata }, // 继承全局元数据
          notes: [],
          measureLines: [],
          bpm: currentBPM,
          offset: offset,
          totalTime: 0,
          measureSignature: { numerator: 4, denominator: 4 }, // 默认4/4拍
          scrollChanges: [], // 滚动速度变更记录
        };

        // 重置状态
        inNoteSection = false;
        currentTime = -offset;
        gogoMode = false;
        measureNumber = 0;
        continue;
      }

      // 解析全局元数据（在任何COURSE之前）
      if (line.includes(":") && !inNoteSection && !currentCourse) {
        const [key, value] = line.split(":", 2);
        globalMetadata[key] = value.trim();
        if (key === "BPM") {
          currentBPM = parseFloat(value) || 150;
        }
        if (key === "OFFSET") {
          offset = parseFloat(value) || 0;
        }
        continue;
      }

      // 如果没有当前难度但遇到了#START，创建默认难度
      if (line === "#START" && !currentCourse) {
        currentCourse = {
          name: "Unknown",
          metadata: { ...globalMetadata },
          notes: [],
          measureLines: [],
          bpm: currentBPM,
          offset: offset,
          totalTime: 0,
          measureSignature: { numerator: 4, denominator: 4 }, // 默认4/4拍
          scrollChanges: [], // 滚动速度变更记录
        };
        currentTime = -offset;
        gogoMode = false;
        measureNumber = 0;
      }

      if (!currentCourse) continue;

      // 解析当前难度的元数据
      if (line.includes(":") && !inNoteSection) {
        const [key, value] = line.split(":", 2);
        currentCourse.metadata[key] = value.trim();
        if (key === "BPM") {
          currentCourse.bpm = parseFloat(value) || 150;
          currentBPM = currentCourse.bpm;
        }
        if (key === "OFFSET") {
          currentCourse.offset = parseFloat(value) || 0;
          offset = currentCourse.offset;
        }
        continue;
      }

      // 开始音符部分
      if (line === "#START") {
        inNoteSection = true;
        currentTime = -offset;
        continue;
      }

      // 结束音符部分
      if (line === "#END") {
        inNoteSection = false;
        if (currentCourse) {
          courses.push(currentCourse);
        }
        currentCourse = null;
        continue;
      }

      if (!inNoteSection || !currentCourse) continue;

      // GOGO模式
      if (line === "#GOGOSTART") {
        gogoMode = true;
        continue;
      }

      if (line === "#GOGOEND") {
        gogoMode = false;
        continue;
      }

      // BPM变更
      if (line.startsWith("#BPMCHANGE ")) {
        const newBPM = parseFloat(line.replace("#BPMCHANGE ", ""));
        if (!isNaN(newBPM)) {
          currentBPM = newBPM;
          currentCourse.bpm = newBPM;
        }
        continue;
      }

      // 拍子变更 #MEASURE A/B 表示 B分A拍子
      if (line.startsWith("#MEASURE ")) {
        const measureValue = line.replace("#MEASURE ", "").trim();
        const parts = measureValue.split("/");
        if (parts.length === 2) {
          const numerator = parseInt(parts[0]);
          const denominator = parseInt(parts[1]);
          if (!isNaN(numerator) && !isNaN(denominator)) {
            // 记录拍子变更，影响小节时长计算
            currentCourse.measureSignature = { numerator, denominator };
            console.log(`拍子变更: ${numerator}/${denominator}`);
          }
        }
        continue;
      }

      // 滚动速度变更 #SCROLL 0.5 表示速度变为0.5倍
      if (line.startsWith("#SCROLL ")) {
        const scrollValue = parseFloat(line.replace("#SCROLL ", ""));
        if (!isNaN(scrollValue)) {
          // 记录滚动速度变更点
          if (!currentCourse.scrollChanges) {
            currentCourse.scrollChanges = [];
          }
          currentCourse.scrollChanges.push({
            time: currentTime,
            scrollSpeed: scrollValue
          });
          console.log(`滚动速度变更: ${scrollValue}x at time ${currentTime}`);
        }
        continue;
      }

      // 解析音符行
      if (line.includes(",")) {
        const noteLine = line
          .replace(",", "")
          .replace(/\/\/.*/, "")
          .trim();

        // 在每个小节开始时记录小节线位置
        currentCourse.measureLines.push({
          time: currentTime,
          measure: measureNumber,
          bpm: currentBPM,
        });

        // 处理特殊行（单个数字，通常是小节线标记）
        if (noteLine.length === 1) {
          const specialNote = parseInt(noteLine);
          if (specialNote === 7) {
            // 气球音符（单独出现时作为小节标记）
            const measureDuration = getMeasureDuration(currentBPM, currentCourse.measureSignature);
            currentTime += measureDuration;
            measureNumber++;
            continue;
          } else if (specialNote === 8) {
            // 连打结束标记
            continue;
          }
        }

        if (noteLine.length === 0) {
          // 空小节，增加一个小节的时间
          const measureDuration = getMeasureDuration(currentBPM, currentCourse.measureSignature);
          currentTime += measureDuration;
          measureNumber++;
          continue;
        }

        // 计算每个音符位置的时间间隔
        const measureDuration = getMeasureDuration(currentBPM, currentCourse.measureSignature); // 基于当前拍子的小节时长
        const noteInterval = measureDuration / noteLine.length; // 每个音符的时间间隔

        for (let j = 0; j < noteLine.length; j++) {
          const noteType = parseInt(noteLine[j]);
          if (noteType > 0 && noteType <= 8) {
            const noteTime = currentTime + j * noteInterval;
            currentCourse.notes.push({
              time: noteTime,
              type: noteType,
              gogo: gogoMode,
              bpm: currentBPM,
              measure: measureNumber,
            });
          }
        }

        currentTime += measureDuration;
        measureNumber++;
      }
    }

    // 如果最后还有未完成的难度，保存它
    if (currentCourse && inNoteSection) {
      courses.push(currentCourse);
    }

    // 对每个难度的音符按时间排序
    courses.forEach((course) => {
      course.notes.sort((a, b) => a.time - b.time);
      // 计算每个难度的总时长
      if (course.notes.length > 0) {
        const lastNoteTime = course.notes[course.notes.length - 1].time;
        const lastMeasureTime =
          course.measureLines.length > 0
            ? course.measureLines[course.measureLines.length - 1].time
            : 0;
        course.totalTime = Math.max(lastNoteTime, lastMeasureTime) + 4; // 添加4秒缓冲
      } else {
        course.totalTime = 0;
      }
    });

    return courses;
  }

  function setupCanvas() {
    if (gameCanvas) {
      const ctx = gameCanvas.getContext("2d");
      gameCanvas.width = 800;
      gameCanvas.height = 200;

      // 绘制初始状态
      drawNotes();
    }
  }

  let animationId = null;

  function updateVisibleNotes() {
    if (!tjaData) return;

    // 根据速度调整显示范围，速度越快需要提前显示越多
    const baseLookAhead = 3; // 基础提前显示时间
    const lookAhead = baseLookAhead * noteSpeed; // 根据速度倍率调整
    const lookBehind = 0.5; // 保持0.5秒显示过去的音符

    visibleNotes = tjaData.notes.filter(
      (note) =>
        note.time >= currentTime - lookBehind &&
        note.time <= currentTime + lookAhead &&
        (isPlayMode ? 
          !note.hasBeenJudged : // 游戏模式下，排除已判定的音符（包括超时的气球）
          !note.hasBeenHit), // 预览模式下排除已击中的音符
    );

    // 更新可见的小节线
    measureLines = tjaData.measureLines.filter(
      (measureLine) =>
        measureLine.time >= currentTime - lookBehind &&
        measureLine.time <= currentTime + lookAhead,
    );

    // 预览模式下，检查是否有音符经过判定线，触发击飞效果
    if (!isPlayMode) {
      const hitLineX = 120;
      const speed = 300 * noteSpeed; // 应用速度倍率

      tjaData.notes.forEach((note) => {
        const x = calculateNotePosition(note.time, currentTime, speed);

        // 根据速度调整击飞判定的时间窗口，速度越快窗口越小
        const timeDiff = note.time - currentTime;
        const hitWindow = 0.05 / noteSpeed;

        // 当音符刚好经过判定线时（在调整后的时间窗口内）
        if (!note.hasBeenHit && Math.abs(timeDiff) < hitWindow) {
          note.hasBeenHit = true;
          triggerHitEffect(note, x, 100); // 100是y坐标
        }
      });
    } else {
      // 游玩模式下，更新活跃的连打和气球
      updateActiveSpecialNotes();
    }

    // 更新击飞中的音符动画
    updateHitNotes();
    
    // 游玩模式下检查错过的音符
    if (isPlayMode) {
      checkMissedNotes();
    }
  }
  
  // 更新活跃的连打和气球音符
  function updateActiveSpecialNotes() {
    if (!tjaData) return;
    
    // 检查新的连打音符（type 5, 6）
    for (let i = 0; i < tjaData.notes.length; i++) {
      const note = tjaData.notes[i];
      
      if ((note.type === 5 || note.type === 6) && !note.isRollActive && note.time <= currentTime + 0.1) {
        // 找到对应的结束音符（type 8）
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
          
          activeRolls.push(rollData);
          note.isRollActive = true;
          
          console.log(`激活连打: ${note.type === 5 ? '小连打' : '大连打'} 从 ${note.time}s 到 ${endNote.time}s`);
        }
      }
      
      // 检查气球音符（type 7）
      if (note.type === 7 && !note.isBalloonActive && note.time <= currentTime + 0.1) {
        // 找到对应的结束音符（type 8）
        let endNote = null;
        for (let j = i + 1; j < tjaData.notes.length; j++) {
          if (tjaData.notes[j].type === 8) {
            endNote = tjaData.notes[j];
            break;
          }
        }
        
        if (endNote) {
          // 获取气球所需击打次数
          const requiredHits = getBalloonHits(note, tjaData);
          
          const balloonData = {
            note: note,
            startTime: note.time,
            endTime: endNote.time,
            requiredHits: requiredHits,
            currentTime: currentTime,
            isPopped: false
          };
          
          activeBalloons.push(balloonData);
          note.isBalloonActive = true;
          
          console.log(`激活气球: 需要击打 ${requiredHits} 次，从 ${note.time}s 到 ${endNote.time}s`);
        }
      }
    }
    
    // 移除已结束的连打
    activeRolls = activeRolls.filter(roll => {
      if (currentTime >= roll.endTime) {
        // 连打结束，计算得分
        const rollId = `roll_${roll.startTime}`;
        const hitCount = rollHitCounts.get(rollId) || 0;
        console.log(`连打结束: 击打了 ${hitCount} 次`);
        return false;
      }
      return true;
    });
    
    // 移除已结束的气球
    activeBalloons = activeBalloons.filter(balloon => {
      if (currentTime >= balloon.endTime && !balloon.isPopped) {
        // 气球时间结束但没有爆炸，标记为超时并触发miss动画
        balloon.note.isBalloonTimeout = true;
        balloon.note.hasBeenJudged = true; // 标记为已判定，避免重复显示
        
        // 触发miss效果（向左飞行，和普通音符miss一样）
        const hitLineX = 120;
        const missNote = {
          ...balloon.note,
          x: hitLineX,
          y: 100,
          vx: -300 - Math.random() * 200, // 向左飞行的速度（-300到-500px/s）
          vy: -200 - Math.random() * 100, // 向上飞行的速度（-200到-300px/s）
          gravity: 600, // 重力加速度
          opacity: 0.7, // 稍微透明，表示miss
          fadeSpeed: 2.0,
          startTime: performance.now(),
        };
        hitNotes.push(missNote);
        
        console.log('气球超时，触发miss动画');
        return false;
      }
      return !balloon.isPopped; // 已爆炸的气球也移除
    });
  }
  
  // 获取气球所需击打次数
  function getBalloonHits(balloonNote, courseData) {
    if (!courseData.metadata || !courseData.metadata.BALLOON) {
      return 5; // 默认值
    }
    
    // 解析BALLOON字符串，格式如："5,12,5"
    const balloonHits = courseData.metadata.BALLOON.split(',').map(s => parseInt(s.trim()));
    
    // 找到当前是第几个气球音符
    let balloonIndex = 0;
    for (let note of courseData.notes) {
      if (note.type === 7) {
        if (note === balloonNote) {
          break;
        }
        balloonIndex++;
      }
    }
    
    return balloonHits[balloonIndex] || 5; // 如果超出范围，默认5次
  }

  // 计算考虑滚动速度变化的音符X位置
  function calculateNotePosition(noteTime, currentTime, baseSpeed) {
    if (!tjaData || !tjaData.scrollChanges || tjaData.scrollChanges.length === 0) {
      // 没有滚动速度变化，使用基础计算
      const timeDiff = noteTime - currentTime;
      return 120 + timeDiff * baseSpeed; // 120是判定线位置
    }

    // 找到影响这个音符的滚动速度变化
    let effectiveScrollSpeed = 1.0; // 默认滚动速度
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

  function triggerHitEffect(note, x, y) {
    const hitNote = {
      ...note,
      x: x,
      y: y,
      vx: -400 - 0.8 * 80000, // 向左飞行的速度（-400到-600px/s）
      vy: -300 - 0.8 * 56000, // 向上飞行的速度（-300到-400px/s）
      gravity: 600, // 重力加速度
      opacity: 1.0,
      fadeSpeed: 20, // 透明度减少速度（稍微慢一点，让飞行过程更清晰）
      startTime: performance.now(),
    };
    hitNotes.push(hitNote);
  }

  function updateHitNotes() {
    const now = performance.now();

    // 更新每个击飞音符的位置和状态
    hitNotes.forEach((hitNote) => {
      const deltaTime = (now - hitNote.startTime) / 1000; // 转换为秒

      // 更新位置（抛物线运动）
      hitNote.x += hitNote.vx * deltaTime * 0.016; // 假设60fps
      hitNote.y += hitNote.vy * deltaTime * 0.016;
      hitNote.vy += hitNote.gravity * deltaTime * 0.016; // 重力影响

      // 更新透明度
      hitNote.opacity -= hitNote.fadeSpeed * deltaTime * 0.016;

      // 更新开始时间用于下一帧计算
      hitNote.startTime = now;
    });

    // 移除已经完全透明或飞出屏幕的音符
    hitNotes = hitNotes.filter(
      (hitNote) => hitNote.opacity > 0 && hitNote.x > -100 && hitNote.y < 300,
    );
  }

  function startAnimation() {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }

    function animate() {
      if (isPlaying && audioElement) {
        currentTime = audioElement.currentTime;
        updateVisibleNotes();
        drawNotes();
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

  // 游玩模式相关函数
  function togglePlayMode() {
    isPlayMode = !isPlayMode;
    if (isPlayMode) {
      // 进入游玩模式，重置游戏状态
      resetGameState();
    }
  }

  function resetGameState() {
    score = 0;
    combo = 0;
    maxCombo = 0;
    hitCount = { perfect: 0, good: 0, bad: 0, miss: 0 };
    judgeText = "";
    if (judgeTimeout) {
      clearTimeout(judgeTimeout);
      judgeTimeout = null;
    }
    
    // 重置连打和气球状态
    activeRolls = [];
    activeBalloons = [];
    balloonHitCounts.clear();
    rollHitCounts.clear();
    lastRollHitTime.clear();
    
    // 重置所有音符的状态
    if (tjaData && tjaData.notes) {
      tjaData.notes.forEach(note => {
        note.hasBeenHit = false;
        note.hasBeenJudged = false;
        note.isRollActive = false;
        note.isBalloonActive = false;
        note.isBalloonPopped = false;
        note.isBalloonTimeout = false;
      });
    }
    hitNotes = [];
  }

  function handlePlayerHit(hitType) {
    if (!tjaData || !isPlayMode) return;

    const currentTimeMs = currentTime * 1000;
    
    // 首先检查是否有活跃的连打或气球可以击打
    let hitActiveSpecial = false;
    
    // 检查活跃的连打音符
    for (let roll of activeRolls) {
      if (canHitRoll(roll, hitType)) {
        hitRoll(roll);
        hitActiveSpecial = true;
        break; // 一次只击打一个连打
      }
    }
    
    // 检查活跃的气球音符
    if (!hitActiveSpecial) {
      for (let balloon of activeBalloons) {
        if (canHitBalloon(balloon, hitType)) {
          hitBalloon(balloon);
          hitActiveSpecial = true;
          break; // 一次只击打一个气球
        }
      }
    }
    
    // 如果击打了特殊音符，不再检查普通音符
    if (hitActiveSpecial) return;

    const hitLineX = 120;
    const speed = 300 * noteSpeed;

    // 找到判定窗口内最近的普通音符（非连打、气球类型）
    let closestNote = null;
    let closestDistance = Infinity;
    
    for (let note of tjaData.notes) {
      if (note.hasBeenJudged) continue;
      
      // 跳过连打、气球和结束标记
      if (note.type === 5 || note.type === 6 || note.type === 7 || note.type === 8) continue;
      
      const noteTimeMs = note.time * 1000;
      const timeDiff = Math.abs(noteTimeMs - currentTimeMs);
      
      // 判定窗口（毫秒）
      const perfectWindow = 50;  // ±50ms 完美
      const goodWindow = 100;    // ±100ms 良好
      const badWindow = 150;     // ±150ms 一般
      
      if (timeDiff <= badWindow && timeDiff < closestDistance) {
        // 检查音符类型匹配
        const noteType = getNoteHitType(note.type);
        if (noteType === hitType) {
          closestNote = note;
          closestDistance = timeDiff;
        }
      }
    }

    if (closestNote) {
      // 执行判定
      let judge = "";
      let scoreAdd = 0;
      
      if (closestDistance <= 50) {
        judge = "PERFECT";
        scoreAdd = 1000;
        hitCount.perfect++;
        combo++;
      } else if (closestDistance <= 100) {
        judge = "GOOD";
        scoreAdd = 500;
        hitCount.good++;
        combo++;
      } else {
        judge = "BAD";
        scoreAdd = 100;
        hitCount.bad++;
        combo = 0;
      }
      
      // 更新分数和状态
      score += scoreAdd + (combo * 10); // 连击奖励
      maxCombo = Math.max(maxCombo, combo);
      
      // 显示判定文字
      showJudgeText(judge);
      
      // 标记音符为已判定和已击中
      closestNote.hasBeenJudged = true;
      closestNote.hasBeenHit = true;
      
      // 触发击飞效果
      const x = calculateNotePosition(closestNote.time, currentTime, speed);
      triggerHitEffect(closestNote, x, 100);
      
    } else {
      // 没有找到可判定的音符，算作miss
      combo = 0;
      showJudgeText("MISS");
    }
  }
  
  // 检查连打是否可以击打
  function canHitRoll(roll, hitType) {
    // 连打可以用任何键击打（咚或咔都可以）
    const rollId = `roll_${roll.startTime}`;
    const lastHit = lastRollHitTime.get(rollId) || 0;
    const now = performance.now();
    
    // 防止击打太频繁（最少间隔50ms）
    return now - lastHit >= 50;
  }
  
  // 击打连打
  function hitRoll(roll) {
    const rollId = `roll_${roll.startTime}`;
    const currentHitCount = rollHitCounts.get(rollId) || 0;
    
    rollHitCounts.set(rollId, currentHitCount + 1);
    lastRollHitTime.set(rollId, performance.now());
    
    // 每次击打连打得100分
    score += 100;
    
    // 连打不算miss，也不影响combo
    showJudgeText("连打!");
    
    // 触发击飞效果（使用和普通音符相同的速度）
    const speed = 300 * noteSpeed;
    const x = calculateNotePosition(roll.currentTime || currentTime, currentTime, speed);
    triggerHitEffect({ ...roll.note, type: roll.note.type }, x, 100);
  }
  
  // 检查气球是否可以击打
  function canHitBalloon(balloon, hitType) {
    // 气球可以用任何键击打
    if (balloon.isPopped) return false;
    
    const balloonId = `balloon_${balloon.startTime}`;
    const lastHit = lastRollHitTime.get(balloonId) || 0;
    const now = performance.now();
    
    // 防止击打太频繁（最少间隔50ms）
    return now - lastHit >= 10;
  }
  
  // 击打气球
  function hitBalloon(balloon) {
    const balloonId = `balloon_${balloon.startTime}`;
    const currentHitCount = balloonHitCounts.get(balloonId) || 0;
    const newHitCount = currentHitCount + 1;
    
    balloonHitCounts.set(balloonId, newHitCount);
    lastRollHitTime.set(balloonId, performance.now());
    
    // 每次击打气球得100分
    score += 100;
    
    // 检查是否达到所需击打次数
    if (newHitCount >= balloon.requiredHits) {
      // 气球爆炸！
      balloon.isPopped = true;
      score += 500; // 爆炸奖励分数
      showJudgeText("爆炸!");
      
      // 从活跃气球列表中移除
      const index = activeBalloons.indexOf(balloon);
      if (index > -1) {
        activeBalloons.splice(index, 1);
      }
      
      // 标记对应的音符为已击中和已爆炸
      balloon.note.isBalloonPopped = true;
      balloon.note.hasBeenHit = true;
      balloon.note.hasBeenJudged = true;
      
      // 触发击飞效果（和普通音符一样的速度和方向）
      const hitLineX = 120;
      triggerHitEffect({ ...balloon.note, type: 7 }, hitLineX, 100);
      
    } else {
      showJudgeText(`气球 ${newHitCount}/${balloon.requiredHits}`);
      
      // 触发小的击打效果但不击飞（只是震动效果）
      const hitLineX = 120;
      const hitNote = {
        ...balloon.note,
        x: hitLineX,
        y: 100,
        vx: 0, // 不水平移动
        vy: -50, // 小幅向上
        gravity: 200,
        opacity: 1.0,
        fadeSpeed: 500.0, // 快速消失
        startTime: performance.now(),
      };
      hitNotes.push(hitNote);
    }
  }

  function getNoteHitType(noteType) {
    switch (noteType) {
      case 1: // 小咚
      case 3: // 大咚
        return "don";
      case 2: // 小咔
      case 4: // 大咔
        return "ka";
      default:
        return null;
    }
  }

  function showJudgeText(judge) {
    judgeText = judge;
    if (judgeTimeout) {
      clearTimeout(judgeTimeout);
    }
    judgeTimeout = setTimeout(() => {
      judgeText = "";
    }, 500);
  }
  
  // 绘制连打轨道
  function drawRollTrack(ctx, rollNote, startX, y, speed) {
    // 找到对应的结束音符来计算轨道长度
    let endTime = rollNote.time + 2; // 默认2秒
    for (let i = 0; i < tjaData.notes.length; i++) {
      if (tjaData.notes[i].time > rollNote.time && tjaData.notes[i].type === 8) {
        endTime = tjaData.notes[i].time;
        break;
      }
    }
    
    const endX = calculateNotePosition(endTime, currentTime, speed);
    
    // 只绘制可见部分的轨道
    const trackStartX = Math.max(80, Math.min(startX, endX));
    const trackEndX = Math.min(gameCanvas.width - 80, Math.max(startX, endX));
    
    if (trackEndX > trackStartX) {
      // 绘制连打轨道背景
      ctx.fillStyle = rollNote.type === 6 ? "rgba(255, 255, 34, 0.3)" : "rgba(255, 255, 68, 0.3)";
      ctx.fillRect(trackStartX, y - 15, trackEndX - trackStartX, 30);
      
      // 绘制轨道边框
      ctx.strokeStyle = rollNote.type === 6 ? "#ffcc00" : "#ffff44";
      ctx.lineWidth = 2;
      ctx.strokeRect(trackStartX, y - 15, trackEndX - trackStartX, 30);
      
      // 绘制连打进度
      if (rollNote.isRollActive) {
        const rollId = `roll_${rollNote.time}`;
        const hitCount = rollHitCounts.get(rollId) || 0;
        
        // 显示击打次数
        if (hitCount > 0) {
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 12px Arial";
          ctx.textAlign = "center";
          ctx.fillText(`${hitCount}连`, (trackStartX + trackEndX) / 2, y - 25);
        }
      }
    }
  }
  
  // 绘制气球击打进度
  function drawBalloonProgress(ctx, x, y, currentHits, requiredHits) {
    const progressWidth = 50;
    const progressHeight = 6;
    
    // 绘制进度条背景
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(x - progressWidth/2, y, progressWidth, progressHeight);
    
    // 绘制进度条
    const progress = Math.min(currentHits / requiredHits, 1);
    ctx.fillStyle = progress >= 1 ? "#00ff00" : "#ffff00";
    ctx.fillRect(x - progressWidth/2, y, progressWidth * progress, progressHeight);
    
    // 绘制进度文字
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${currentHits}/${requiredHits}`, x, y - 2);
  }

  // 检查错过的音符
  function checkMissedNotes() {
    if (!tjaData || !isPlayMode) return;

    const currentTimeMs = currentTime * 1000;
    
    tjaData.notes.forEach(note => {
      if (!note.hasBeenJudged && !note.hasBeenHit) {
        const noteTimeMs = note.time * 1000;
        
        // 如果音符已经超过判定窗口150ms，算作miss
        if (currentTimeMs > noteTimeMs + 150) {
          note.hasBeenJudged = true;
          hitCount.miss++;
          combo = 0;
        }
      }
    });
  }

  function drawNotes() {
    if (!gameCanvas || !tjaData) return;

    const ctx = gameCanvas.getContext("2d");
    const width = gameCanvas.width;
    const height = gameCanvas.height;

    // 清空画布
    ctx.fillStyle = "#000022";
    ctx.fillRect(0, 0, width, height);

    // 绘制轨道背景
    ctx.fillStyle = "#111133";
    ctx.fillRect(80, 50, width - 160, 100);

    // 绘制判定线
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(120, 40);
    ctx.lineTo(120, 160);
    ctx.stroke();

    // 绘制判定圆
    ctx.strokeStyle = "#ffff00";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(120, 100, 25, 0, 2 * Math.PI);
    ctx.stroke();

    // 绘制小节线
    const speed = 300 * noteSpeed; // 应用速度倍率
    const hitLineX = 120;

    ctx.strokeStyle = "#666666";
    ctx.lineWidth = 1;
    measureLines.forEach((measureLine) => {
      const x = calculateNotePosition(measureLine.time, currentTime, speed);

      // 只绘制在屏幕内的小节线
      if (x >= 80 && x <= width - 80) {
        ctx.beginPath();
        ctx.moveTo(x, 50);
        ctx.lineTo(x, 150);
        ctx.stroke();

        // 在小节线上方显示小节数
        ctx.fillStyle = "#aaaaaa";
        ctx.font = "10px Arial";
        ctx.textAlign = "center";
        ctx.fillText(`${measureLine.measure + 1}`, x, 45);
      }
    });

    // 绘制音符
    visibleNotes.forEach((note) => {
      let x = calculateNotePosition(note.time, currentTime, speed);
      const y = 100;

      // 只绘制在屏幕内的音符
      if (x < -30 || x > width + 30) return;
      
      // 跳过结束标记音符的绘制
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
        case 5: // 小连打 - 黄色
          color = "#ffff44";
          radius = 20;
          // 检查是否为活跃连打
          if (note.isRollActive) {
            // 绘制连打轨道
            drawRollTrack(ctx, note, x, y, speed);
            shouldDrawNote = x >= hitLineX - 50; // 只在接近判定线时显示音符
          }
          break;
        case 6: // 大连打 - 大黄色
          color = "#ffff22";
          radius = 28;
          strokeColor = "#ff8800";
          // 检查是否为活跃连打
          if (note.isRollActive) {
            // 绘制连打轨道
            drawRollTrack(ctx, note, x, y, speed);
            shouldDrawNote = x >= hitLineX - 50; // 只在接近判定线时显示音符
          }
          break;
        case 7: // 气球 - 粉色
          color = "#ff44ff";
          radius = 25;
          
          // 气球的特殊位置逻辑
          // 检查气球状态
          if (note.isBalloonActive && !note.isBalloonPopped) {
            const balloonId = `balloon_${note.time}`;
            const currentHits = balloonHitCounts.get(balloonId) || 0;
            const requiredHits = getBalloonHits(note, tjaData);
            
            // 气球在激活状态下应该停在判定线位置
            if (currentTime >= note.time) {
              x = hitLineX; // 停在判定线位置
            }
            
            // 根据击打进度改变颜色
            const progress = currentHits / requiredHits;
            if (progress > 0.8) {
              color = "#ff8844"; // 即将爆炸
            } else if (progress > 0.5) {
              color = "#ff6666"; // 击打中
            }
            
            // 绘制气球进度
            drawBalloonProgress(ctx, x, y - 35, currentHits, requiredHits);
          } else if (note.isBalloonPopped || note.isBalloonTimeout) {
            // 已爆炸或超时的气球不显示（由击飞动画处理）
            shouldDrawNote = false;
          } else {
            // 找到对应的结束时间来判断气球是否应该停在判定线
            let endTime = note.time + 2; // 默认2秒
            for (let i = 0; i < tjaData.notes.length; i++) {
              if (tjaData.notes[i].time > note.time && tjaData.notes[i].type === 8) {
                endTime = tjaData.notes[i].time;
                break;
              }
            }
            
            // 如果当前时间在气球的活动范围内，停在判定线
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
        // 闪烁效果
        const flash = Math.sin(currentTime * 10) * 0.3 + 0.7;
        strokeColor = `rgba(255, 255, 0, ${flash})`;

        // 光环效果
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(x, y, radius + 8, 0, 2 * Math.PI);
        ctx.stroke();
      }

      // 绘制音符主体
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fill();

      // 绘制音符边框
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.stroke();

      // 绘制音符内部标记
      ctx.fillStyle = "#ffffff";
      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      let symbol = "";
      switch (note.type) {
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
        ctx.fillText(symbol, x, y);
      }
    });

    // 绘制击飞中的音符
    drawHitNotes(ctx);

    // 绘制当前时间指示器
    ctx.fillStyle = "#ff0000";
    ctx.font = "14px Arial";
    ctx.textAlign = "left";
    ctx.fillText(`时间: ${formatTime(currentTime)}`, 10, 30);

    // 计算并显示当前小节数
    let currentMeasure = 0;
    if (tjaData && tjaData.measureLines) {
      // 找到当前时间对应的小节
      for (let i = tjaData.measureLines.length - 1; i >= 0; i--) {
        if (tjaData.measureLines[i].time <= currentTime) {
          currentMeasure = tjaData.measureLines[i].measure + 1;
          break;
        }
      }
    }
    ctx.fillText(`小节: ${currentMeasure}`, 200, 30);

    // 绘制BPM信息
    if (tjaData) {
      ctx.fillText(`BPM: ${tjaData.bpm}`, 10, height - 10);
    }
    
    // 绘制游玩模式信息
    if (isPlayMode) {
      // 分数
      ctx.fillStyle = '#ffdd00';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`分数: ${score}`, width - 10, 30);
      
      // 连击数
      ctx.fillStyle = combo > 10 ? '#ff6b6b' : '#ffffff';
      ctx.font = 'bold 16px Arial';
      ctx.fillText(`连击: ${combo}`, width - 10, 55);
      
      // 判定文字
      if (judgeText) {
        ctx.fillStyle = getJudgeColor(judgeText);
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(judgeText, width / 2, height / 2 - 20);
      }
      
      // 命中统计（小字显示）
      ctx.fillStyle = '#cccccc';
      ctx.font = '12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`Perfect: ${hitCount.perfect} Good: ${hitCount.good} Bad: ${hitCount.bad} Miss: ${hitCount.miss}`, 10, height - 30);
      ctx.fillText(`Max Combo: ${maxCombo}`, 10, height - 50);
      
      // 按键提示
      if (!isPlaying) {
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('按键: F/J = 咚(红)  D/K = 咔(蓝)', width / 2, height - 20);
        ctx.fillText('连打和气球可用任意按键击打', width / 2, height - 5);
      }
      
      // 显示当前活跃的连打和气球信息
      if (activeRolls.length > 0 || activeBalloons.length > 0) {
        let infoY = 170;
        ctx.fillStyle = '#ffff00';
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        
        activeRolls.forEach((roll, index) => {
          const rollId = `roll_${roll.startTime}`;
          const hitCount = rollHitCounts.get(rollId) || 0;
          ctx.fillText(`连打${index + 1}: ${hitCount}次`, 10, infoY);
          infoY += 15;
        });
        
        activeBalloons.forEach((balloon, index) => {
          const balloonId = `balloon_${balloon.startTime}`;
          const hitCount = balloonHitCounts.get(balloonId) || 0;
          ctx.fillText(`气球${index + 1}: ${hitCount}/${balloon.requiredHits}`, 10, infoY);
          infoY += 15;
        });
      }
    }
  }
  
  function getJudgeColor(judge) {
    switch (judge) {
      case 'PERFECT': return '#ffdd00';
      case 'GOOD': return '#00ff00';
      case 'BAD': return '#ffaa00';
      case 'MISS': return '#ff0000';
      default: return '#ffffff';
    }
  }

  function drawHitNotes(ctx) {
    // 绘制所有击飞中的音符
    hitNotes.forEach((hitNote) => {
      const x = hitNote.x;
      const y = hitNote.y;
      let radius = 20;
      let color = "#888888";
      let strokeColor = "#ffffff";

      // 根据音符类型设置样式（与原音符相同）
      switch (hitNote.type) {
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
        case 5: // 小连打 - 黄色
          color = "#ffff44";
          radius = 20;
          break;
        case 6: // 大连打 - 大黄色
          color = "#ffff22";
          radius = 28;
          strokeColor = "#ff8800";
          break;
        case 7: // 气球 - 粉色
          color = "#ff44ff";
          radius = 25;
          break;
      }

      // 应用透明度
      const alpha = Math.max(0, Math.min(1, hitNote.opacity));

      // 解析颜色并添加透明度
      const addAlpha = (colorStr, alpha) => {
        if (colorStr.startsWith("#")) {
          const r = parseInt(colorStr.slice(1, 3), 16);
          const g = parseInt(colorStr.slice(3, 5), 16);
          const b = parseInt(colorStr.slice(5, 7), 16);
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        return colorStr;
      };

      // 绘制音符主体（带透明度）
      ctx.fillStyle = addAlpha(color, alpha);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fill();

      // 绘制音符边框（带透明度）
      ctx.strokeStyle = addAlpha(strokeColor, alpha);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.stroke();

      // 绘制音符内部标记（带透明度）
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      let symbol = "";
      switch (hitNote.type) {
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
        ctx.fillText(symbol, x, y);
      }
    });
  }

  function resetNoteStates() {
    // 重置所有音符的击中状态
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

    // 清空击飞中的音符数组
    hitNotes = [];
    
    // 重置连打和气球状态
    activeRolls = [];
    activeBalloons = [];
    balloonHitCounts.clear();
    rollHitCounts.clear();
    lastRollHitTime.clear();
    
    // 如果在游玩模式，重置游戏状态
    if (isPlayMode) {
      resetGameState();
    }
  }

  function togglePlay() {
    if (!audioElement || !isLoaded) return;

    if (isPlaying) {
      audioElement.pause();
      isPlaying = false;
      stopAnimation();
    } else {
      // 重置所有音符的击中状态和击飞动画
      resetNoteStates();

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

  let progressBarElement;
  let isDraggingProgress = false;

  function handleProgressClick(event) {
    if (!audioElement || !duration) return;

    const rect = progressBarElement.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;

    audioElement.currentTime = Math.max(0, Math.min(newTime, duration));
    currentTime = audioElement.currentTime;

    // 重置音符状态，因为时间改变了
    resetNoteStates();

    updateVisibleNotes();
    drawNotes();
  }

  function handleProgressMouseDown() {
    isDraggingProgress = true;
  }

  function handleProgressMouseUp() {
    isDraggingProgress = false;
  }

  function handleProgressMouseMove(event) {
    if (!isDraggingProgress || !audioElement || !duration) return;
    handleProgressClick(event);
  }

  function handleSpeedChange(event) {
    noteSpeed = parseFloat(event.target.value);
  }

  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
</script>

<main>
  <h1>太鼓达人谱面预览器</h1>

  <div style="margin-bottom: 1em;">
    <label for="tja-select">选择谱面文件：</label>
    <select
      id="tja-select"
      bind:value={selectedTja}
      on:change={handleFileSelect}
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
      on:change={handleFileSelect}
      disabled={oggFiles.length === 0}
    >
      {#each oggFiles as ogg}
        <option value={ogg}>{ogg}</option>
      {/each}
    </select>
    <button on:click={handleFileSelect} disabled={!selectedTja || !selectedOgg}
      >加载</button
    >
  </div>

  {#if tjaCourses.length > 1}
    <div style="margin-bottom: 1em;">
      <label for="course-select">选择难度：</label>
      <select
        id="course-select"
        bind:value={selectedCourse}
        on:change={handleCourseChange}
      >
        {#each tjaCourses as course}
          <option value={course.name}
            >{course.name} (Level: {course.metadata.LEVEL || "N/A"})</option
          >
        {/each}
      </select>
    </div>
  {/if}

  {#if tjaData}
    <div class="song-info">
      <h2>{tjaData.metadata.TITLE || "未知曲目"}</h2>
      <p>
        BPM: {tjaData.bpm} | 难度: {tjaData.metadata.LEVEL || "N/A"} | OFFSET: {tjaData.offset}s
      </p>
    </div>

    <div style="margin-bottom: 1em;">
      <label for="speed-slider">音符流动速度：</label>
      <input
        id="speed-slider"
        type="range"
        min="0.5"
        max="3.0"
        step="0.1"
        bind:value={noteSpeed}
        on:input={handleSpeedChange}
        style="width: 200px;"
      />
      <span style="margin-left: 0.5em;">{noteSpeed.toFixed(1)}x</span>
      <span style="margin-left: 1em; font-size: 0.9em; color: #666;"
        >(1.0x为默认速度)</span
      >
    </div>
  {/if}

  <div class="game-area">
    <canvas bind:this={gameCanvas} width="800" height="200"></canvas>
  </div>

  <div class="controls">
    <button class="play-btn" on:click={togglePlay} disabled={!isLoaded}>
      {isPlaying ? "⏸️ 暂停" : "▶️ 播放"}
    </button>
    
    <button class="mode-btn" on:click={togglePlayMode} disabled={!isLoaded}>
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
        on:input={handleVolumeChange}
        class="volume-slider"
      />
      <span>{Math.round(volume * 100)}%</span>
    </div>

    <div class="time-info">
      {formatTime(currentTime)} / {formatTime(duration)}
    </div>

    <div
      class="progress-bar"
      bind:this={progressBarElement}
      on:click={handleProgressClick}
      on:keydown={(e) => e.key === "Enter" && handleProgressClick(e)}
      on:mousedown={handleProgressMouseDown}
      on:mouseup={handleProgressMouseUp}
      on:mousemove={handleProgressMouseMove}
      role="slider"
      tabindex="0"
      aria-label="播放进度"
      aria-valuenow={duration > 0
        ? Math.round((currentTime / duration) * 100)
        : 0}
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div
        class="progress-fill"
        style="width: {duration > 0 ? (currentTime / duration) * 100 : 0}%"
      ></div>
    </div>
  </div>

  <div class="status">
    {loadingStatus}
  </div>

  <div class="keyboard-hint">
    💡 小贴士: 按空格键可以播放/暂停，点击进度条可以跳转
  </div>

  {#if tjaData}
    <div class="note-stats">
      总音符数: {tjaData.notes.length} | 当前可见: {visibleNotes.length}
      {#if tjaData.notes.length > 0}
        | 首个音符时间: {tjaData.notes[0].time.toFixed(2)}s
      {/if}
    </div>
  {/if}
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

  .song-info {
    text-align: center;
    margin-bottom: 20px;
    padding: 15px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 10px;
  }

  .song-info h2 {
    margin: 0 0 10px 0;
    color: #ffd700;
  }

  .game-area {
    background: #000022;
    border: 3px solid #444;
    border-radius: 10px;
    padding: 10px;
    margin: 20px 0;
    display: flex;
    justify-content: center;
  }

  canvas {
    border-radius: 5px;
    background: #000011;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 20px;
    margin: 20px 0;
    padding: 15px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 10px;
    flex-wrap: wrap;
  }

  .volume-control {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }

  .volume-slider {
    width: 80px;
    height: 4px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }

  .volume-slider::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    background: #feca57;
    border-radius: 50%;
    cursor: pointer;
  }

  .volume-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: #feca57;
    border-radius: 50%;
    border: none;
    cursor: pointer;
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

  .time-info {
    font-weight: bold;
    font-size: 18px;
    min-width: 120px;
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
    margin: 10px 0;
  }

  .keyboard-hint {
    text-align: center;
    padding: 8px;
    font-size: 14px;
    background: rgba(255, 215, 0, 0.2);
    border-radius: 5px;
    margin: 10px 0;
    border: 1px solid rgba(255, 215, 0, 0.4);
  }

  .note-stats {
    text-align: center;
    padding: 10px;
    font-size: 14px;
    opacity: 0.8;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 5px;
  }

  @media (max-width: 768px) {
    main {
      padding: 10px;
    }

    canvas {
      width: 100%;
      height: auto;
    }

    .controls {
      flex-direction: column;
      gap: 10px;
    }

    .progress-bar {
      width: 100%;
    }
  }
</style>
