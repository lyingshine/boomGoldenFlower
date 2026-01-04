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
    // 发牌音效 - 清脆的卡牌滑动声
    this.sounds.card = () => this.playCardSound()
    
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
  }

  // 发牌音效 - 模拟卡牌滑动
  playCardSound() {
    const now = this.audioContext.currentTime
    // 白噪声模拟摩擦
    this.playNoise(0.06, 0.15, 2000, 4000)
    // 轻微的音调
    this.playTone([600, 400], 0.05, 0.1, 'sine')
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
}