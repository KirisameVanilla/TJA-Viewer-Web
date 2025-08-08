<script>
  import { onMount } from 'svelte'
  import JSZip from 'jszip'
  
  let tjaData = null
  let audioElement = null
  let isLoaded = false
  let isPlaying = false
  let currentTime = 0
  let duration = 0
  let loadingStatus = "正在加载..."
  let notes = []
  let visibleNotes = []
  let gameCanvas
  let hitNotes = [] // 存储被击中的音符，用于击飞动画

  // zip 相关
  let tjaFiles = []
  let oggFiles = []
  let selectedTja = ''
  let selectedOgg = ''
  let zipFileMap = {} // 文件名: Blob
  
  // 太鼓音符类型
  const NOTE_TYPES = {
    0: 'empty',
    1: 'don',     // 红色
    2: 'ka',      // 蓝色
    3: 'don_big', // 大红
    4: 'ka_big',  // 大蓝
    5: 'roll',    // 黄卷
    6: 'roll_big', // 大黄卷
    7: 'balloon', // 气球
    8: 'end_roll' // 卷结束
  }

  onMount(() => {
    loadingStatus = '请通过 postMessage 发送 zip 包 URL'
    function handleMsg(event) {
      if (event.data && typeof event.data === 'object') {
        if (event.data.zipUrl) {
          loadZipFromUrl(event.data.zipUrl)
        } else if (event.data.type === 'zip' && event.data.blob instanceof Blob) {
          loadZipFromBlob(event.data.blob)
        }
      }
    }
    window.addEventListener('message', handleMsg)
  async function loadZipFromBlob(blob) {
    loadingStatus = '正在解压 zip...'
    try {
      const zip = await JSZip.loadAsync(blob)
      tjaFiles = []
      oggFiles = []
      zipFileMap = {}
      zip.forEach((relPath, file) => {
        if (!file.dir) {
          if (relPath.endsWith('.tja')) tjaFiles.push(relPath)
          if (relPath.endsWith('.ogg')) oggFiles.push(relPath)
          zipFileMap[relPath] = file
        }
      })
      if (tjaFiles.length === 0 || oggFiles.length === 0) {
        loadingStatus = 'zip 包中未找到 tja 或 ogg 文件'
        return
      }
      selectedTja = tjaFiles[0]
      selectedOgg = oggFiles[0]
      loadingStatus = '请选择谱面和音频文件'
      isLoaded = false
    } catch (e) {
      loadingStatus = 'zip 加载或解压失败: ' + e
    }
  }
    window.addEventListener('keydown', handleKeyPress)
    return () => {
      window.removeEventListener('message', handleMsg)
      window.removeEventListener('keydown', handleKeyPress)
      stopAnimation()
    }
  })

  async function loadZipFromUrl(zipUrl) {
    loadingStatus = '正在下载 zip 包...'
    try {
      const resp = await fetch(zipUrl)
      if (!resp.ok) throw new Error('下载失败')
      const blob = await resp.blob()
      loadingStatus = '正在解压 zip...'
      const zip = await JSZip.loadAsync(blob)
      tjaFiles = []
      oggFiles = []
      zipFileMap = {}
      zip.forEach((relPath, file) => {
        if (!file.dir) {
          if (relPath.endsWith('.tja')) tjaFiles.push(relPath)
          if (relPath.endsWith('.ogg')) oggFiles.push(relPath)
          zipFileMap[relPath] = file
        }
      })
      if (tjaFiles.length === 0 || oggFiles.length === 0) {
        loadingStatus = 'zip 包中未找到 tja 或 ogg 文件'
        return
      }
      selectedTja = tjaFiles[0]
      selectedOgg = oggFiles[0]
      loadingStatus = '请选择谱面和音频文件'
      isLoaded = false
    } catch (e) {
      loadingStatus = 'zip 加载或解压失败: ' + e
    }
  }

  function handleKeyPress(event) {
    if (event.code === 'Space') {
      event.preventDefault()
      togglePlay()
    }
  }


  async function loadTJAFileFromZip() {
    if (!selectedTja || !zipFileMap[selectedTja]) return
    loadingStatus = '正在加载 TJA 谱面...'
    try {
      const text = await zipFileMap[selectedTja].async('text')
      tjaData = parseTJA(text)
      loadingStatus = '谱面加载完成'
    } catch (e) {
      loadingStatus = 'TJA 加载失败: ' + e
    }
  }

  let volume = 0.7


  async function loadAudioFileFromZip() {
    if (!selectedOgg || !zipFileMap[selectedOgg]) return
    loadingStatus = '正在加载音频文件...'
    try {
      const blob = await zipFileMap[selectedOgg].async('blob')
      const url = URL.createObjectURL(blob)
      audioElement = new Audio(url)
      audioElement.volume = volume
      return new Promise((resolve, reject) => {
        audioElement.addEventListener('loadedmetadata', () => {
          duration = audioElement.duration
          loadingStatus = '音频加载完成'
          resolve()
        })
        audioElement.addEventListener('timeupdate', () => {
          currentTime = audioElement.currentTime
        })
        audioElement.addEventListener('ended', () => {
          isPlaying = false
          stopAnimation()
          currentTime = 0
          audioElement.currentTime = 0
        })
        audioElement.addEventListener('pause', () => {
          isPlaying = false
          stopAnimation()
        })
        audioElement.addEventListener('error', (e) => {
          loadingStatus = '音频文件加载失败'
          reject(e)
        })
        audioElement.load()
      })
    } catch (e) {
      loadingStatus = '音频加载失败: ' + e
      throw e
    }
  }


  function handleVolumeChange(event) {
    volume = parseFloat(event.target.value)
    if (audioElement) {
      audioElement.volume = volume
    }
  }

  async function handleFileSelect() {
    await loadTJAFileFromZip()
    await loadAudioFileFromZip()
    setupCanvas()
    isLoaded = true
    loadingStatus = '加载完成！点击播放按钮开始预览'
  }

  function parseTJA(text) {
    const lines = text.split('\n')
    const metadata = {}
    const noteData = []
    let inNoteSection = false
    let currentBPM = 150
    let currentTime = 0
    let gogoMode = false
    let offset = 0
    
    for (let line of lines) {
      line = line.trim()
      
      // 跳过空行和注释
      if (!line || line.startsWith('//')) continue
      
      // 解析元数据
      if (line.includes(':') && !inNoteSection) {
        const [key, value] = line.split(':', 2)
        metadata[key] = value.trim()
        if (key === 'BPM') {
          currentBPM = parseFloat(value) || 150
        }
        if (key === 'OFFSET') {
          offset = parseFloat(value) || 0
        }
      }
      
      // 开始音符部分
      if (line === '#START') {
        inNoteSection = true
        // OFFSET表示音符相对于音频的时间偏移
        // 负值表示音符比音频提前，正值表示延后
        currentTime = -offset // 注意这里取负值，因为我们需要调整音符时间
        console.log('谱面开始时间:', currentTime, 'OFFSET:', offset)
        continue
      }
      
      // 结束音符部分
      if (line === '#END') {
        break
      }
      
      // GOGO模式
      if (line === '#GOGOSTART') {
        gogoMode = true
        continue
      }
      
      if (line === '#GOGOEND') {
        gogoMode = false
        continue
      }
      
      // BPM变更
      if (line.startsWith('#BPMCHANGE ')) {
        const newBPM = parseFloat(line.replace('#BPMCHANGE ', ''))
        if (!isNaN(newBPM)) {
          currentBPM = newBPM
        }
        continue
      }
      
      // 解析音符行
      if (inNoteSection && line.includes(',')) {
        const noteLine = line.replace(',', '').replace(/\/\/.*/, '').trim()
        
        // 处理特殊行（单个数字，通常是小节线标记）
        if (noteLine.length === 1) {
          const specialNote = parseInt(noteLine)
          if (specialNote === 7) {
            // 气球音符（单独出现时作为小节标记）
            const measureDuration = (60 / currentBPM) * 4
            currentTime += measureDuration
            continue
          } else if (specialNote === 8) {
            // 连打结束标记
            continue
          }
        }
        
        if (noteLine.length === 0) {
          // 空小节，增加一个小节的时间
          const measureDuration = (60 / currentBPM) * 4 // 一个4/4拍的小节时长
          currentTime += measureDuration
          continue
        }
        
        // 计算每个音符位置的时间间隔
        // TJA中通常一行代表一个小节（4拍），音符数量决定了细分程度
        const measureDuration = (60 / currentBPM) * 4 // 一个小节的总时长
        const noteInterval = measureDuration / noteLine.length // 每个音符的时间间隔
        
        for (let i = 0; i < noteLine.length; i++) {
          const noteType = parseInt(noteLine[i])
          if (noteType > 0 && noteType <= 8) {
            const noteTime = currentTime + (i * noteInterval)
            noteData.push({
              time: noteTime,
              type: noteType,
              gogo: gogoMode,
              bpm: currentBPM,
              measure: Math.floor(noteData.length / 16) // 大致的小节数
            })
          }
        }
        
        currentTime += measureDuration
      }
    }
    
    // 按时间排序音符
    noteData.sort((a, b) => a.time - b.time)
    
    console.log('解析完成，总音符数:', noteData.length)
    console.log('前几个音符时间:', noteData.slice(0, 5).map(n => n.time))
    
    return {
      metadata,
      notes: noteData,
      bpm: currentBPM,
      totalTime: currentTime,
      offset: offset
    }
  }

  function setupCanvas() {
    if (gameCanvas) {
      const ctx = gameCanvas.getContext('2d')
      gameCanvas.width = 800
      gameCanvas.height = 200
      
      // 绘制初始状态
      drawNotes()
    }
  }

  let animationId = null

  function updateVisibleNotes() {
    if (!tjaData) return
    
    const lookAhead = 3 // 提前3秒显示音符
    const lookBehind = 0.5 // 保持0.5秒显示过去的音符
    
    visibleNotes = tjaData.notes.filter(note => 
      note.time >= currentTime - lookBehind && 
      note.time <= currentTime + lookAhead &&
      !note.hasBeenHit // 排除已经被击中的音符
    )
    
    // 检查是否有音符经过判定线，触发击飞效果
    const hitLineX = 120
    const speed = 300
    
    tjaData.notes.forEach(note => {
      const timeDiff = note.time - currentTime
      const x = hitLineX + (timeDiff * speed)
      
      // 当音符刚好经过判定线时（在很小的时间窗口内）
      if (!note.hasBeenHit && Math.abs(timeDiff) < 0.05) {
        note.hasBeenHit = true
        triggerHitEffect(note, x, 100) // 100是y坐标
      }
    })
    
    // 更新击飞中的音符动画
    updateHitNotes()
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
      startTime: performance.now()
    }
    hitNotes.push(hitNote)
  }

  function updateHitNotes() {
    const now = performance.now()
    
    // 更新每个击飞音符的位置和状态
    hitNotes.forEach(hitNote => {
      const deltaTime = (now - hitNote.startTime) / 1000 // 转换为秒
      
      // 更新位置（抛物线运动）
      hitNote.x += hitNote.vx * deltaTime * 0.016 // 假设60fps
      hitNote.y += hitNote.vy * deltaTime * 0.016
      hitNote.vy += hitNote.gravity * deltaTime * 0.016 // 重力影响
      
      // 更新透明度
      hitNote.opacity -= hitNote.fadeSpeed * deltaTime * 0.016
      
      // 更新开始时间用于下一帧计算
      hitNote.startTime = now
    })
    
    // 移除已经完全透明或飞出屏幕的音符
    hitNotes = hitNotes.filter(hitNote => 
      hitNote.opacity > 0 && hitNote.x > -100 && hitNote.y < 300
    )
  }

  function startAnimation() {
    if (animationId) {
      cancelAnimationFrame(animationId)
    }
    
    function animate() {
      if (isPlaying && audioElement) {
        currentTime = audioElement.currentTime
        updateVisibleNotes()
        drawNotes()
        animationId = requestAnimationFrame(animate)
      }
    }
    
    animate()
  }

  function stopAnimation() {
    if (animationId) {
      cancelAnimationFrame(animationId)
      animationId = null
    }
  }

  function drawNotes() {
    if (!gameCanvas || !tjaData) return
    
    const ctx = gameCanvas.getContext('2d')
    const width = gameCanvas.width
    const height = gameCanvas.height
    
    // 清空画布
    ctx.fillStyle = '#000022'
    ctx.fillRect(0, 0, width, height)
    
    // 绘制轨道背景
    ctx.fillStyle = '#111133'
    ctx.fillRect(80, 50, width - 160, 100)
    
    // 绘制判定线
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(120, 40)
    ctx.lineTo(120, 160)
    ctx.stroke()
    
    // 绘制判定圆
    ctx.strokeStyle = '#ffff00'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(120, 100, 25, 0, 2 * Math.PI)
    ctx.stroke()
    
    // 绘制音符
    const speed = 300 // 像素每秒
    const hitLineX = 120
    
    visibleNotes.forEach(note => {
      const timeDiff = note.time - currentTime
      const x = hitLineX + (timeDiff * speed)
      const y = 100
      
      // 只绘制在屏幕内的音符
      if (x < -30 || x > width + 30) return
      
      let radius = 20
      let color = '#888888'
      let strokeColor = '#ffffff'
      
      // 根据音符类型设置样式
      switch(note.type) {
        case 1: // 咚 - 红色
          color = '#ff4444'
          radius = 22
          break
        case 2: // 咔 - 蓝色
          color = '#4444ff'
          radius = 22
          break
        case 3: // 大咚 - 大红色
          color = '#ff2222'
          radius = 30
          strokeColor = '#ffaa00'
          break
        case 4: // 大咔 - 大蓝色
          color = '#2222ff'
          radius = 30
          strokeColor = '#ffaa00'
          break
        case 5: // 小连打 - 黄色
          color = '#ffff44'
          radius = 20
          break
        case 6: // 大连打 - 大黄色
          color = '#ffff22'
          radius = 28
          strokeColor = '#ff8800'
          break
        case 7: // 气球 - 粉色
          color = '#ff44ff'
          radius = 25
          break
      }
      
      // GOGO模式效果
      if (note.gogo) {
        // 闪烁效果
        const flash = Math.sin(currentTime * 10) * 0.3 + 0.7
        strokeColor = `rgba(255, 255, 0, ${flash})`
        
        // 光环效果
        ctx.strokeStyle = strokeColor
        ctx.lineWidth = 6
        ctx.beginPath()
        ctx.arc(x, y, radius + 8, 0, 2 * Math.PI)
        ctx.stroke()
      }
      
      // 绘制音符主体
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, 2 * Math.PI)
      ctx.fill()
      
      // 绘制音符边框
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, 2 * Math.PI)
      ctx.stroke()
      
      // 绘制音符内部标记
      ctx.fillStyle = '#ffffff'
      ctx.font = '12px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      let symbol = ''
      switch(note.type) {
        case 1:
        case 3:
          symbol = '咚'
          break
        case 2:
        case 4:
          symbol = '咔'
          break
        case 5:
        case 6:
          symbol = '连'
          break
        case 7:
          symbol = '气'
          break
      }
      
      if (symbol && radius > 18) {
        ctx.fillText(symbol, x, y)
      }
    })
    
    // 绘制击飞中的音符
    drawHitNotes(ctx)
    
    // 绘制当前时间指示器
    ctx.fillStyle = '#ff0000'
    ctx.font = '14px Arial'
    ctx.textAlign = 'left'
    ctx.fillText(`时间: ${formatTime(currentTime)}`, 10, 30)
    
    // 绘制BPM信息
    if (tjaData) {
      ctx.fillText(`BPM: ${tjaData.bpm}`, 10, height - 10)
    }
  }

  function drawHitNotes(ctx) {
    // 绘制所有击飞中的音符
    hitNotes.forEach(hitNote => {
      const x = hitNote.x
      const y = hitNote.y
      let radius = 20
      let color = '#888888'
      let strokeColor = '#ffffff'
      
      // 根据音符类型设置样式（与原音符相同）
      switch(hitNote.type) {
        case 1: // 咚 - 红色
          color = '#ff4444'
          radius = 22
          break
        case 2: // 咔 - 蓝色
          color = '#4444ff'
          radius = 22
          break
        case 3: // 大咚 - 大红色
          color = '#ff2222'
          radius = 30
          strokeColor = '#ffaa00'
          break
        case 4: // 大咔 - 大蓝色
          color = '#2222ff'
          radius = 30
          strokeColor = '#ffaa00'
          break
        case 5: // 小连打 - 黄色
          color = '#ffff44'
          radius = 20
          break
        case 6: // 大连打 - 大黄色
          color = '#ffff22'
          radius = 28
          strokeColor = '#ff8800'
          break
        case 7: // 气球 - 粉色
          color = '#ff44ff'
          radius = 25
          break
      }
      
      // 应用透明度
      const alpha = Math.max(0, Math.min(1, hitNote.opacity))
      
      // 解析颜色并添加透明度
      const addAlpha = (colorStr, alpha) => {
        if (colorStr.startsWith('#')) {
          const r = parseInt(colorStr.slice(1, 3), 16)
          const g = parseInt(colorStr.slice(3, 5), 16)
          const b = parseInt(colorStr.slice(5, 7), 16)
          return `rgba(${r}, ${g}, ${b}, ${alpha})`
        }
        return colorStr
      }
      
      // 绘制音符主体（带透明度）
      ctx.fillStyle = addAlpha(color, alpha)
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, 2 * Math.PI)
      ctx.fill()
      
      // 绘制音符边框（带透明度）
      ctx.strokeStyle = addAlpha(strokeColor, alpha)
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, 2 * Math.PI)
      ctx.stroke()
      
      // 绘制音符内部标记（带透明度）
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
      ctx.font = '12px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      let symbol = ''
      switch(hitNote.type) {
        case 1:
        case 3:
          symbol = '咚'
          break
        case 2:
        case 4:
          symbol = '咔'
          break
        case 5:
        case 6:
          symbol = '连'
          break
        case 7:
          symbol = '气'
          break
      }
      
      if (symbol && radius > 18) {
        ctx.fillText(symbol, x, y)
      }
    })
  }

  function resetNoteStates() {
    // 重置所有音符的击中状态
    if (tjaData && tjaData.notes) {
      tjaData.notes.forEach(note => {
        note.hasBeenHit = false
      })
    }
    
    // 清空击飞中的音符数组
    hitNotes = []
  }

  function togglePlay() {
    if (!audioElement || !isLoaded) return
    
    if (isPlaying) {
      audioElement.pause()
      isPlaying = false
      stopAnimation()
    } else {
      // 重置所有音符的击中状态和击飞动画
      resetNoteStates()
      
      audioElement.play().then(() => {
        isPlaying = true
        startAnimation()
      }).catch(error => {
        console.error('音频播放失败:', error)
        isPlaying = false
      })
    }
  }

  let progressBarElement
  let isDraggingProgress = false

  function handleProgressClick(event) {
    if (!audioElement || !duration) return
    
    const rect = progressBarElement.getBoundingClientRect()
    const clickX = event.clientX - rect.left
    const percentage = clickX / rect.width
    const newTime = percentage * duration
    
    audioElement.currentTime = Math.max(0, Math.min(newTime, duration))
    currentTime = audioElement.currentTime
    
    // 重置音符状态，因为时间改变了
    resetNoteStates()
    
    updateVisibleNotes()
    drawNotes()
  }

  function handleProgressMouseDown() {
    isDraggingProgress = true
  }

  function handleProgressMouseUp() {
    isDraggingProgress = false
  }

  function handleProgressMouseMove(event) {
    if (!isDraggingProgress || !audioElement || !duration) return
    handleProgressClick(event)
  }

  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
</script>

<main>
  <h1>太鼓达人谱面预览器</h1>

  <div style="margin-bottom: 1em;">
    <label for="tja-select">选择谱面文件：</label>
    <select id="tja-select" bind:value={selectedTja} on:change={handleFileSelect} disabled={tjaFiles.length === 0}>
      {#each tjaFiles as tja}
        <option value={tja}>{tja}</option>
      {/each}
    </select>
    <label for="ogg-select" style="margin-left:2em;">选择音频文件：</label>
    <select id="ogg-select" bind:value={selectedOgg} on:change={handleFileSelect} disabled={oggFiles.length === 0}>
      {#each oggFiles as ogg}
        <option value={ogg}>{ogg}</option>
      {/each}
    </select>
    <button on:click={handleFileSelect} disabled={!selectedTja || !selectedOgg}>加载</button>
  </div>

  {#if tjaData}
    <div class="song-info">
      <h2>{tjaData.metadata.TITLE || '未知曲目'}</h2>
      <p>BPM: {tjaData.bpm} | 难度: {tjaData.metadata.LEVEL || 'N/A'} | OFFSET: {tjaData.offset}s</p>
    </div>
  {/if}

  <div class="game-area">
    <canvas bind:this={gameCanvas} width="800" height="200"></canvas>
  </div>

  <div class="controls">
    <button 
      class="play-btn" 
      on:click={togglePlay} 
      disabled={!isLoaded}
    >
      {isPlaying ? '⏸️ 暂停' : '▶️ 播放'}
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
      on:keydown={(e) => e.key === 'Enter' && handleProgressClick(e)}
      on:mousedown={handleProgressMouseDown}
      on:mouseup={handleProgressMouseUp}
      on:mousemove={handleProgressMouseMove}
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
    text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
    margin-bottom: 30px;
  }

  .song-info {
    text-align: center;
    margin-bottom: 20px;
    padding: 15px;
    background: rgba(0,0,0,0.3);
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
    background: rgba(0,0,0,0.3);
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
    background: rgba(255,255,255,0.3);
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
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
  }

  .play-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0,0,0,0.3);
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
  }

  .progress-bar {
    flex: 1;
    height: 8px;
    background: rgba(255,255,255,0.3);
    border-radius: 4px;
    overflow: hidden;
    cursor: pointer;
    position: relative;
  }

  .progress-bar:hover {
    height: 10px;
    background: rgba(255,255,255,0.4);
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
    background: rgba(0,0,0,0.4);
    border-radius: 5px;
    margin: 10px 0;
  }

  .keyboard-hint {
    text-align: center;
    padding: 8px;
    font-size: 14px;
    background: rgba(255,215,0,0.2);
    border-radius: 5px;
    margin: 10px 0;
    border: 1px solid rgba(255,215,0,0.4);
  }

  .note-stats {
    text-align: center;
    padding: 10px;
    font-size: 14px;
    opacity: 0.8;
    background: rgba(0,0,0,0.2);
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
