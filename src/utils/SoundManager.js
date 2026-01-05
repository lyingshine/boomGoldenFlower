/**
 * 音效管理器 - 增强版
 * 支持丰富的游戏音效和背景音乐
 */
export class SoundManager {
  constructor() {
    this.sounds = {}
    this.enabled = true
    this.volume = 0.5
    this.musicVolume = 0.3
    this.audioContext = null
    this.initialized = false
    this.bgmNode = null
    this.bgmPlaying = false
  }

  init() {
    if (this.initialized) return
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
      this.createSounds()
      this.initialized = true
    } catch (e) {
      console.warn('音效初始化失败:', e)
    }
  }

  createSounds() {
    // 发牌音效 - 真实扑克牌滑动+落桌声
    this.sounds.card = () => this.playCardSound()
    
    // 洗牌音效
    this.sounds.shuffle = () => this.playShuffleSound()
    
    // 翻牌音效
    this.sounds.flip = () => this.playFlipSound()
    
    // 收牌音效
    this.sounds.collect = () => this.playCollectSound()
    
    // 筹码音效 - 金属碰撞声（多层次）
    this.sounds.chip = () => this.playChipSound()
    
    // 大额下注音效
    this.sounds.bigBet = () => this.playBigBetSound()
    
    // 获胜音效 - 欢快的旋律
    this.sounds.win = () => this.playWinSound()
    
    // 失败音效
    this.sounds.lose = () => this.playLoseSound()
    
    // 按钮点击音效
    this.sounds.click = () => this.playTone([800, 600], 0.05, 0.15, 'sine')
    
    // 看牌音效 - 神秘感
    this.sounds.peek = () => this.playPeekSound()
    
    // 弃牌音效 - 低沉
    this.sounds.fold = () => this.playFoldSound()
    
    // 轮到你音效 - 提示音
    this.sounds.turn = () => this.playTurnSound()
    
    // 开牌音效 - 紧张刺激
    this.sounds.showdown = () => this.playShowdownSound()
    
    // 豹子音效 - 震撼
    this.sounds.leopard = () => this.playLeopardSound()
    
    // 同花顺音效
    this.sounds.straightFlush = () => this.playStraightFlushSound()
    
    // 倒计时音效
    this.sounds.tick = () => this.playTone([1000], 0.05, 0.2, 'square')
    
    // 倒计时紧急
    this.sounds.tickUrgent = () => this.playTone([1200, 800], 0.08, 0.3, 'square')
    
    // 错误/警告音效
    this.sounds.error = () => this.playTone([200, 150], 0.2, 0.25, 'sawtooth')
    
    // 加入房间
    this.sounds.join = () => this.playJoinSound()
    
    // 离开房间
    this.sounds.leave = () => this.playTone([400, 300, 200], 0.15, 0.2, 'sine')
    
    // 消息提示
    this.sounds.message = () => this.playTone([600, 800], 0.1, 0.15, 'sine')
    
    // ========== UI 交互音效 ==========
    
    // 按钮悬停 - 轻柔提示
    this.sounds.hover = () => this.playTone([1200], 0.02, 0.08, 'sine')
    
    // 按钮按下 - 清脆确认
    this.sounds.press = () => this.playTone([600, 800], 0.04, 0.12, 'sine')
    
    // 按钮释放
    this.sounds.release = () => this.playTone([800, 600], 0.03, 0.08, 'sine')
    
    // 开关切换 - 开
    this.sounds.toggleOn = () => this.playTone([400, 600, 800], 0.08, 0.15, 'sine')
    
    // 开关切换 - 关
    this.sounds.toggleOff = () => this.playTone([600, 400, 300], 0.08, 0.12, 'sine')
    
    // 滑块拖动
    this.sounds.slide = () => this.playTone([500 + Math.random() * 200], 0.02, 0.06, 'sine')
    
    // 弹窗打开 - 展开感
    this.sounds.modalOpen = () => {
      this.playTone([300, 500], 0.1, 0.15, 'sine')
      setTimeout(() => this.playTone([600, 800], 0.08, 0.12, 'sine'), 50)
    }
    
    // 弹窗关闭 - 收缩感
    this.sounds.modalClose = () => this.playTone([500, 300, 200], 0.1, 0.12, 'sine')
    
    // 输入框聚焦
    this.sounds.focus = () => this.playTone([800, 1000], 0.03, 0.1, 'sine')
    
    // 输入框失焦
    this.sounds.blur = () => this.playTone([600, 400], 0.03, 0.08, 'sine')
    
    // 打字音效
    this.sounds.type = () => this.playTone([1000 + Math.random() * 200], 0.015, 0.06, 'square')
    
    // 删除音效
    this.sounds.delete = () => this.playTone([600, 400], 0.03, 0.08, 'square')
    
    // 成功确认 - 积极反馈
    this.sounds.success = () => {
      this.playTone([523, 659], 0.1, 0.2, 'sine')
      setTimeout(() => this.playTone([784], 0.15, 0.25, 'sine'), 100)
    }
    
    // 警告提示
    this.sounds.warning = () => this.playTone([400, 350, 400], 0.15, 0.2, 'triangle')
    
    // 列表项选中
    this.sounds.select = () => this.playTone([700, 900], 0.05, 0.12, 'sine')
    
    // 拖拽开始
    this.sounds.dragStart = () => this.playTone([400, 500], 0.06, 0.1, 'sine')
    
    // 拖拽放下
    this.sounds.dragEnd = () => this.playTone([600, 500, 400], 0.08, 0.12, 'sine')
    
    // 刷新/加载
    this.sounds.refresh = () => {
      this.playTone([400, 600, 800, 600], 0.2, 0.12, 'sine')
    }
    
    // 通知弹出
    this.sounds.notify = () => {
      this.playTone([800, 1000], 0.08, 0.15, 'sine')
      setTimeout(() => this.playTone([1200], 0.1, 0.12, 'sine'), 80)
    }
    
    // 金币/奖励音效
    this.sounds.coin = () => {
      this.playTone([1800, 2200], 0.06, 0.15, 'sine')
      setTimeout(() => this.playTone([2000, 2400], 0.05, 0.12, 'sine'), 40)
      setTimeout(() => this.playTone([2200, 2600], 0.04, 0.1, 'sine'), 80)
    }
    
    // 倒计时最后几秒 - 心跳感
    this.sounds.heartbeat = () => {
      this.playTone([80, 60], 0.15, 0.35, 'sine')
      setTimeout(() => this.playTone([100, 70], 0.1, 0.25, 'sine'), 150)
    }
    
    // 全押 All-in 震撼音效
    this.sounds.allIn = () => {
      // 低音冲击
      this.playTone([60, 80, 60], 0.3, 0.5, 'sine')
      // 筹码雨
      for (let i = 0; i < 5; i++) {
        setTimeout(() => this.playChipSound(), i * 80)
      }
      // 高音强调
      setTimeout(() => {
        this.playTone([800, 1200, 1600], 0.2, 0.3, 'sine')
      }, 400)
    }
    
    // 跟注
    this.sounds.call = () => {
      this.playTone([500, 600], 0.08, 0.15, 'sine')
      setTimeout(() => this.playChipSound(), 50)
    }
    
    // 加注
    this.sounds.raise = () => {
      this.playTone([500, 700, 900], 0.1, 0.18, 'sine')
      setTimeout(() => this.playChipSound(), 80)
      setTimeout(() => this.playChipSound(), 160)
    }
  }

  // 发牌音效 - 真实扑克牌滑动+落桌声
  playCardSound() {
    if (!this.audioContext || !this.enabled) return
    
    const now = this.audioContext.currentTime
    
    // 1. 卡牌从牌堆抽出的摩擦声（高频短促噪声）
    this.playFilteredNoise(0.05, 0.4, 3000, 6000, 'highpass')
    
    // 2. 卡牌滑动的"刷"声（中频带通噪声，模拟纸张摩擦）
    setTimeout(() => {
      this.playFilteredNoise(0.07, 0.35, 1500, 3500, 'bandpass')
    }, 20)
    
    // 3. 卡牌落桌的轻微"啪"声（低频冲击 + 高频瞬态）
    setTimeout(() => {
      // 低频冲击感
      this.playTone([180, 100], 0.04, 0.5, 'sine')
      // 高频瞬态（纸牌边缘触桌）
      this.playFilteredNoise(0.03, 0.45, 2000, 5000, 'highpass')
    }, 50)
    
    // 4. 轻微的桌面共振（低沉的尾音）
    setTimeout(() => {
      this.playTone([80, 50], 0.1, 0.2, 'sine')
    }, 70)
  }
  
  // 洗牌音效 - 多张牌快速翻动
  playShuffleSound() {
    if (!this.audioContext || !this.enabled) return
    
    // 模拟洗牌时多张牌快速滑动的声音
    const shuffleCount = 8 + Math.floor(Math.random() * 4)
    for (let i = 0; i < shuffleCount; i++) {
      const delay = i * 25 + Math.random() * 15
      setTimeout(() => {
        // 随机化每张牌的音调，增加真实感
        const freqVariation = 0.8 + Math.random() * 0.4
        this.playFilteredNoise(0.025, 0.08 * freqVariation, 2500, 5000, 'bandpass')
      }, delay)
    }
    
    // 洗牌结束的整理声
    setTimeout(() => {
      this.playFilteredNoise(0.08, 0.12, 1000, 3000, 'bandpass')
      this.playTone([100, 60], 0.05, 0.1, 'sine')
    }, shuffleCount * 25 + 50)
  }
  
  // 翻牌音效 - 牌面翻转
  playFlipSound() {
    if (!this.audioContext || !this.enabled) return
    
    // 翻牌的"唰"声
    this.playFilteredNoise(0.05, 0.1, 2000, 4500, 'bandpass')
    
    // 牌面落下的轻响
    setTimeout(() => {
      this.playTone([200, 100], 0.03, 0.12, 'sine')
      this.playFilteredNoise(0.02, 0.08, 3000, 6000, 'highpass')
    }, 40)
  }
  
  // 收牌音效 - 把牌收回
  playCollectSound() {
    if (!this.audioContext || !this.enabled) return
    
    // 多张牌滑动堆叠
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        this.playFilteredNoise(0.04, 0.08, 1800, 4000, 'bandpass')
      }, i * 60)
    }
    
    // 整理牌堆的声音
    setTimeout(() => {
      this.playFilteredNoise(0.1, 0.15, 800, 2500, 'bandpass')
      this.playTone([80, 50], 0.06, 0.1, 'sine')
    }, 280)
  }
  
  // 带滤波器的噪声播放（更真实的纸牌声）
  playFilteredNoise(duration, gain, lowFreq, highFreq, filterType = 'bandpass') {
    if (!this.audioContext || !this.enabled) return
    
    try {
      const bufferSize = Math.floor(this.audioContext.sampleRate * duration)
      const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate)
      const data = buffer.getChannelData(0)
      
      // 生成粉红噪声（比白噪声更自然）
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1
        b0 = 0.99886 * b0 + white * 0.0555179
        b1 = 0.99332 * b1 + white * 0.0750759
        b2 = 0.96900 * b2 + white * 0.1538520
        b3 = 0.86650 * b3 + white * 0.3104856
        b4 = 0.55000 * b4 + white * 0.5329522
        b5 = -0.7616 * b5 - white * 0.0168980
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
        b6 = white * 0.115926
      }
      
      const noise = this.audioContext.createBufferSource()
      noise.buffer = buffer
      
      // 滤波器
      const filter = this.audioContext.createBiquadFilter()
      filter.type = filterType
      filter.frequency.value = (lowFreq + highFreq) / 2
      filter.Q.value = filterType === 'bandpass' ? 0.8 : 0.5
      
      // 包络
      const gainNode = this.audioContext.createGain()
      const now = this.audioContext.currentTime
      
      // 快速起音，自然衰减
      gainNode.gain.setValueAtTime(0, now)
      gainNode.gain.linearRampToValueAtTime(this.volume * gain, now + 0.003)
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration)
      
      noise.connect(filter)
      filter.connect(gainNode)
      gainNode.connect(this.audioContext.destination)
      
      noise.start(now)
      noise.stop(now + duration)
    } catch (e) {}
  }

  // 筹码音效 - 金属碰撞
  playChipSound() {
    const now = this.audioContext.currentTime
    // 多个金属碰撞音叠加
    this.playTone([2000, 1800], 0.08, 0.2, 'sine')
    setTimeout(() => this.playTone([1500, 1200], 0.06, 0.15, 'sine'), 30)
    setTimeout(() => this.playTone([1800, 1400], 0.05, 0.1, 'sine'), 60)
  }

  // 大额下注音效
  playBigBetSound() {
    this.playChipSound()
    setTimeout(() => this.playChipSound(), 100)
    setTimeout(() => this.playChipSound(), 180)
    // 加一个低音强调
    setTimeout(() => this.playTone([200, 150], 0.2, 0.25, 'sine'), 250)
  }

  // 获胜音效 - 欢快上升旋律
  playWinSound() {
    const notes = [523, 659, 784, 880, 1047] // C5 E5 G5 A5 C6
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.playTone([freq], 0.2, 0.35, 'sine')
        // 加和声
        this.playTone([freq * 1.25], 0.2, 0.15, 'sine')
      }, i * 100)
    })
    // 最后加个闪亮音效
    setTimeout(() => {
      this.playTone([2000, 2500, 3000], 0.3, 0.2, 'sine')
    }, 500)
  }

  // 失败音效
  playLoseSound() {
    const notes = [400, 350, 300, 250]
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone([freq], 0.25, 0.25, 'sine'), i * 150)
    })
  }

  // 看牌音效 - 神秘揭示感
  playPeekSound() {
    this.playTone([300, 400, 500], 0.15, 0.2, 'sine')
    setTimeout(() => this.playTone([600, 800], 0.1, 0.15, 'sine'), 100)
  }

  // 弃牌音效
  playFoldSound() {
    this.playTone([400, 250, 150], 0.2, 0.2, 'sine')
    this.playNoise(0.1, 0.1, 500, 2000)
  }

  // 轮到你音效 - 双音提示
  playTurnSound() {
    this.playTone([660], 0.12, 0.3, 'sine')
    setTimeout(() => this.playTone([880], 0.15, 0.35, 'sine'), 120)
  }

  // 开牌音效 - 紧张刺激
  playShowdownSound() {
    // 鼓点般的节奏
    this.playTone([150], 0.1, 0.4, 'sine')
    setTimeout(() => this.playTone([150], 0.1, 0.35, 'sine'), 150)
    setTimeout(() => this.playTone([200], 0.15, 0.45, 'sine'), 300)
    // 揭示音
    setTimeout(() => {
      this.playTone([400, 600, 800], 0.2, 0.3, 'sine')
    }, 450)
  }

  // 豹子音效 - 震撼
  playLeopardSound() {
    // 低音震动
    this.playTone([80, 100, 80], 0.3, 0.5, 'sine')
    // 高音闪耀
    setTimeout(() => {
      const notes = [800, 1000, 1200, 1400, 1600]
      notes.forEach((freq, i) => {
        setTimeout(() => this.playTone([freq], 0.15, 0.3, 'sine'), i * 60)
      })
    }, 200)
    // 最终爆发
    setTimeout(() => {
      this.playTone([100, 150], 0.4, 0.4, 'sine')
      this.playTone([1600, 2000], 0.3, 0.25, 'sine')
    }, 550)
  }

  // 同花顺音效
  playStraightFlushSound() {
    const notes = [523, 587, 659, 698, 784] // C D E F G
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.playTone([freq], 0.18, 0.3, 'sine')
        this.playTone([freq * 2], 0.18, 0.15, 'sine')
      }, i * 80)
    })
    setTimeout(() => {
      this.playTone([1047, 1200], 0.25, 0.25, 'sine')
    }, 450)
  }

  // 加入房间音效
  playJoinSound() {
    this.playTone([400, 500, 600], 0.12, 0.2, 'sine')
    setTimeout(() => this.playTone([800], 0.1, 0.15, 'sine'), 100)
  }

  // 播放白噪声（用于摩擦、滑动等音效）
  playNoise(duration, gain, lowFreq = 1000, highFreq = 5000) {
    if (!this.audioContext || !this.enabled) return
    try {
      const bufferSize = this.audioContext.sampleRate * duration
      const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1
      }
      
      const noise = this.audioContext.createBufferSource()
      noise.buffer = buffer
      
      const filter = this.audioContext.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = (lowFreq + highFreq) / 2
      filter.Q.value = 1
      
      const gainNode = this.audioContext.createGain()
      const now = this.audioContext.currentTime
      gainNode.gain.setValueAtTime(this.volume * gain, now)
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration)
      
      noise.connect(filter)
      filter.connect(gainNode)
      gainNode.connect(this.audioContext.destination)
      
      noise.start(now)
      noise.stop(now + duration)
    } catch (e) {}
  }

  playTone(frequencies, duration, gain, waveType = 'sine') {
    if (!this.audioContext || !this.enabled) return
    
    try {
      const oscillator = this.audioContext.createOscillator()
      const gainNode = this.audioContext.createGain()
      
      oscillator.type = waveType
      oscillator.connect(gainNode)
      gainNode.connect(this.audioContext.destination)
      
      const now = this.audioContext.currentTime
      
      oscillator.frequency.setValueAtTime(frequencies[0], now)
      frequencies.forEach((freq, i) => {
        if (i > 0) {
          oscillator.frequency.linearRampToValueAtTime(freq, now + (duration * i / frequencies.length))
        }
      })
      
      gainNode.gain.setValueAtTime(0, now)
      gainNode.gain.linearRampToValueAtTime(this.volume * gain, now + 0.01)
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration)
      
      oscillator.start(now)
      oscillator.stop(now + duration)
    } catch (e) {}
  }

  // 根据牌型播放对应音效
  playHandTypeSound(handType) {
    if (!handType) return
    const type = typeof handType === 'string' ? handType : handType.type
    switch (type) {
      case 'leopard':
        this.play('leopard')
        break
      case 'straight_flush':
        this.play('straightFlush')
        break
      case 'flush':
      case 'straight':
        this.play('win')
        break
      default:
        // 普通牌型不播放特殊音效
        break
    }
  }

  play(soundName) {
    if (!this.initialized) this.init()
    if (this.enabled && this.sounds[soundName]) {
      try {
        if (this.audioContext?.state === 'suspended') {
          this.audioContext.resume()
        }
        this.sounds[soundName]()
      } catch (e) {}
    }
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume))
  }

  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, volume))
  }

  toggle() {
    this.enabled = !this.enabled
    return this.enabled
  }

  isEnabled() {
    return this.enabled
  }

  /**
   * 绑定全局 UI 音效
   * 自动为页面上的交互元素添加音效反馈
   */
  bindGlobalUISound() {
    if (typeof document === 'undefined') return
    
    // 防止重复绑定
    if (this._globalBound) return
    this._globalBound = true
    
    // 按钮悬停和点击
    document.addEventListener('mouseenter', (e) => {
      const target = e.target
      if (this.isInteractiveElement(target)) {
        this.play('hover')
      }
    }, true)
    
    document.addEventListener('mousedown', (e) => {
      const target = e.target
      if (this.isInteractiveElement(target)) {
        this.play('press')
      }
    }, true)
    
    document.addEventListener('mouseup', (e) => {
      const target = e.target
      if (this.isInteractiveElement(target)) {
        this.play('release')
      }
    }, true)
    
    // 输入框聚焦
    document.addEventListener('focusin', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        this.play('focus')
      }
    }, true)
    
    // 键盘输入
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Backspace' || e.key === 'Delete') {
          this.play('delete')
        } else if (e.key.length === 1) {
          this.play('type')
        }
      }
    }, true)
  }
  
  /**
   * 判断是否为可交互元素
   */
  isInteractiveElement(el) {
    if (!el || !el.tagName) return false
    const tag = el.tagName.toLowerCase()
    const interactiveTags = ['button', 'a', 'select', 'label']
    if (interactiveTags.includes(tag)) return true
    if (el.getAttribute('role') === 'button') return true
    if (el.classList?.contains('btn') || el.classList?.contains('clickable')) return true
    if (el.onclick || el.hasAttribute('onclick')) return true
    return false
  }
  
  /**
   * 播放带强度的音效
   * @param {string} soundName 音效名称
   * @param {number} intensity 强度 0-1，影响音量和音调
   */
  playWithIntensity(soundName, intensity = 0.5) {
    const originalVolume = this.volume
    this.volume = originalVolume * (0.5 + intensity * 0.5)
    this.play(soundName)
    this.volume = originalVolume
  }
  
  /**
   * 播放连续音效（如筹码堆叠）
   * @param {string} soundName 音效名称
   * @param {number} count 播放次数
   * @param {number} interval 间隔毫秒
   */
  playSequence(soundName, count = 3, interval = 50) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => this.play(soundName), i * interval)
    }
  }
  
  /**
   * 根据金额大小播放对应强度的筹码音效
   * @param {number} amount 金额
   * @param {number} maxAmount 最大金额参考值
   */
  playChipsByAmount(amount, maxAmount = 10000) {
    const ratio = Math.min(amount / maxAmount, 1)
    if (ratio > 0.8) {
      this.play('bigBet')
    } else if (ratio > 0.5) {
      this.playSequence('chip', 3, 60)
    } else if (ratio > 0.2) {
      this.playSequence('chip', 2, 80)
    } else {
      this.play('chip')
    }
  }
}