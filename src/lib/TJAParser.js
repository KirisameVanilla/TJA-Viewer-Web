// TJA文件解析器
export class TJAParser {
  // 太鼓音符类型常量
  static NOTE_TYPES = {
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

  static parseTJA(text) {
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
    
    // 分歧相关状态
    let inBranchSection = false;
    let branchStartTime = 0;
    let branchStartMeasure = 0; // 分歧开始时的小节号
    let currentBranch = 'normal'; // 默认分支
    let branchNotes = {
      easy: [],
      normal: [],
      master: []
    };

    // 计算基于当前拍子的小节时长
    function getMeasureDuration(bpm, measureSignature = { numerator: 4, denominator: 4 }) {
      const baseBeatDuration = 60 / bpm;
      const beatsPerMeasure = (measureSignature.numerator * 4) / measureSignature.denominator;
      return baseBeatDuration * beatsPerMeasure;
    }

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      // 跳过空行和注释
      if (!line || line.startsWith("//")) continue;

      // 检测新的难度开始
      if (line.startsWith("COURSE:")) {
        // 如果之前有未完成的难度，先保存它
        if (currentCourse && inNoteSection) {
          courses.push(currentCourse);
        }

        const courseName = line.split(":", 2)[1].trim();

        currentCourse = {
          name: courseName,
          metadata: { ...globalMetadata },
          notes: [],
          measureLines: [],
          bpm: currentBPM,
          offset: offset,
          totalTime: 0,
          measureSignature: { numerator: 4, denominator: 4 },
          scrollChanges: [],
          hasBranch: false,
          branches: {
            easy: { notes: [], measureLines: [] },
            normal: { notes: [], measureLines: [] },
            master: { notes: [], measureLines: [] }
          }
        };

        inNoteSection = false;
        currentTime = -offset;
        gogoMode = false;
        measureNumber = 0;
        
        // 重置分歧相关状态
        inBranchSection = false;
        branchStartTime = 0;
        branchStartMeasure = 0;
        currentBranch = 'normal';
        branchNotes = {
          easy: [],
          normal: [],
          master: []
        };
        continue;
      }

      // 解析全局元数据
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
          measureSignature: { numerator: 4, denominator: 4 },
          scrollChanges: [],
          hasBranch: false,
          branches: {
            easy: { notes: [], measureLines: [] },
            normal: { notes: [], measureLines: [] },
            master: { notes: [], measureLines: [] }
          }
        };
        currentTime = -offset;
        gogoMode = false;
        measureNumber = 0;
        
        // 重置分歧相关状态
        inBranchSection = false;
        branchStartTime = 0;
        branchStartMeasure = 0;
        currentBranch = 'normal';
        branchNotes = {
          easy: [],
          normal: [],
          master: []
        };
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

      // 分歧开始
      if (line.startsWith("#BRANCHSTART")) {
        inBranchSection = true;
        branchStartTime = currentTime;
        branchStartMeasure = measureNumber;
        currentCourse.hasBranch = true;
        currentBranch = 'normal'; // 默认开始分支
        
        // 重置分歧音符存储，为每个分支记录起始时间
        branchNotes = {
          easy: [],
          normal: [],
          master: [],
          easy_measures: [],
          normal_measures: [],
          master_measures: []
        };
        
        console.log(`分歧开始 at time ${currentTime}, measure ${measureNumber}`);
        continue;
      }

      // 分歧结束
      if (line === "#BRANCHEND") {
        if (inBranchSection) {
          // 找出所有分支中最长的时间，作为分歧结束后的时间点
          let maxBranchEndTime = branchStartTime;
          ['easy', 'normal', 'master'].forEach(branch => {
            if (branchNotes[branch] && branchNotes[branch].length > 0) {
              const lastNote = branchNotes[branch][branchNotes[branch].length - 1];
              maxBranchEndTime = Math.max(maxBranchEndTime, lastNote.time);
              currentCourse.branches[branch].notes.push(...branchNotes[branch]);
            }
            if (branchNotes[branch + '_measures'] && branchNotes[branch + '_measures'].length > 0) {
              const lastMeasure = branchNotes[branch + '_measures'][branchNotes[branch + '_measures'].length - 1];
              maxBranchEndTime = Math.max(maxBranchEndTime, lastMeasure.time);
              currentCourse.branches[branch].measureLines.push(...branchNotes[branch + '_measures']);
            }
          });
          
          // 更新主时间线到分歧结束点
          currentTime = maxBranchEndTime;
        }
        inBranchSection = false;
        currentBranch = 'normal';
        branchNotes = {
          easy: [],
          normal: [],
          master: []
        };
        console.log(`分歧结束 at time ${currentTime}`);
        continue;
      }

      // 分歧难度标记
      if (inBranchSection) {
        if (line === "#E") {
          currentBranch = 'easy';
          currentTime = branchStartTime; // 重置时间到分歧开始点
          measureNumber = branchStartMeasure; // 重置小节计数到分歧开始点
          console.log(`切换到Easy分支 at time ${currentTime}, measure ${measureNumber}`);
          continue;
        }
        if (line === "#N") {
          currentBranch = 'normal';
          currentTime = branchStartTime; // 重置时间到分歧开始点
          measureNumber = branchStartMeasure; // 重置小节计数到分歧开始点
          console.log(`切换到Normal分支 at time ${currentTime}, measure ${measureNumber}`);
          continue;
        }
        if (line === "#M") {
          currentBranch = 'master';
          currentTime = branchStartTime; // 重置时间到分歧开始点
          measureNumber = branchStartMeasure; // 重置小节计数到分歧开始点
          console.log(`切换到Master分支 at time ${currentTime}, measure ${measureNumber}`);
          continue;
        }
      }

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

      // 拍子变更
      if (line.startsWith("#MEASURE ")) {
        const measureValue = line.replace("#MEASURE ", "").trim();
        const parts = measureValue.split("/");
        if (parts.length === 2) {
          const numerator = parseInt(parts[0]);
          const denominator = parseInt(parts[1]);
          if (!isNaN(numerator) && !isNaN(denominator)) {
            currentCourse.measureSignature = { numerator, denominator };
            console.log(`拍子变更: ${numerator}/${denominator}`);
          }
        }
        continue;
      }

      // 滚动速度变更
      if (line.startsWith("#SCROLL ")) {
        const scrollValue = parseFloat(line.replace("#SCROLL ", ""));
        if (!isNaN(scrollValue)) {
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

        // 记录小节线位置
        const measureLine = {
          time: currentTime,
          measure: measureNumber,
          bpm: currentBPM,
        };

        if (inBranchSection) {
          // 在分歧中，将小节线添加到当前分支
          if (!branchNotes[currentBranch + '_measures']) {
            branchNotes[currentBranch + '_measures'] = [];
          }
          branchNotes[currentBranch + '_measures'].push(measureLine);
        } else {
          // 不在分歧中，添加到主列表
          currentCourse.measureLines.push(measureLine);
        }

        // 处理特殊行
        if (noteLine.length === 1) {
          const specialNote = parseInt(noteLine);
          if (specialNote === 7) {
            const measureDuration = getMeasureDuration(currentBPM, currentCourse.measureSignature);
            currentTime += measureDuration;
            measureNumber++;
            continue;
          } else if (specialNote === 8) {
            continue;
          }
        }

        if (noteLine.length === 0) {
          // 空小节
          const measureDuration = getMeasureDuration(currentBPM, currentCourse.measureSignature);
          currentTime += measureDuration;
          measureNumber++;
          continue;
        }

        // 计算音符位置
        const measureDuration = getMeasureDuration(currentBPM, currentCourse.measureSignature);
        const noteInterval = measureDuration / noteLine.length;

        for (let j = 0; j < noteLine.length; j++) {
          const noteType = parseInt(noteLine[j]);
          if (noteType > 0 && noteType <= 8) {
            const noteTime = currentTime + j * noteInterval;
            const note = {
              time: noteTime,
              type: noteType,
              gogo: gogoMode,
              bpm: currentBPM,
              measure: measureNumber,
            };

            if (inBranchSection) {
              // 在分歧中，将音符添加到当前分支
              branchNotes[currentBranch].push(note);
            } else {
              // 不在分歧中，添加到主列表
              currentCourse.notes.push(note);
            }
          }
        }

        currentTime += measureDuration;
        measureNumber++;
      }
    }

    // 保存最后的难度
    if (currentCourse && inNoteSection) {
      courses.push(currentCourse);
    }

    // 对每个难度的音符排序并计算总时长
    courses.forEach((course) => {
      course.notes.sort((a, b) => a.time - b.time);
      if (course.notes.length > 0) {
        const lastNoteTime = course.notes[course.notes.length - 1].time;
        const lastMeasureTime =
          course.measureLines.length > 0
            ? course.measureLines[course.measureLines.length - 1].time
            : 0;
        course.totalTime = Math.max(lastNoteTime, lastMeasureTime) + 4;
      } else {
        course.totalTime = 0;
      }
    });

    return courses;
  }

  // 根据选择的分支获取音符数据
  static getCourseWithBranch(course, branchType = 'normal') {
    if (!course.hasBranch) {
      return course;
    }

    // 创建一个新的course对象，合并主要部分和选择的分支
    const result = {
      ...course,
      notes: [...course.notes], // 主要部分的音符
      measureLines: [...course.measureLines] // 主要部分的小节线
    };

    // 添加选择分支的音符和小节线
    if (course.branches[branchType]) {
      result.notes.push(...course.branches[branchType].notes);
      result.measureLines.push(...course.branches[branchType].measureLines);
    }

    // 重新排序
    result.notes.sort((a, b) => a.time - b.time);
    result.measureLines.sort((a, b) => a.time - b.time);

    // 重新计算总时长
    if (result.notes.length > 0) {
      const lastNoteTime = result.notes[result.notes.length - 1].time;
      const lastMeasureTime = result.measureLines.length > 0
        ? result.measureLines[result.measureLines.length - 1].time
        : 0;
      result.totalTime = Math.max(lastNoteTime, lastMeasureTime) + 4;
    }

    return result;
  }

  // 获取气球所需击打次数
  static getBalloonHits(balloonNote, courseData) {
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
}
