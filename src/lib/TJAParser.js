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
        };

        inNoteSection = false;
        currentTime = -offset;
        gogoMode = false;
        measureNumber = 0;
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
        currentCourse.measureLines.push({
          time: currentTime,
          measure: measureNumber,
          bpm: currentBPM,
        });

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
