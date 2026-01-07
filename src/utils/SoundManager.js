/**
 * 音效管理器 - Web Audio API 版本
 * 使用原生 Web Audio API 提供游戏音效
 */

export class SoundManager {
  constructor() {
    this.sounds = {}
    this.enabled = true
    this.volume = 0.5
    this.initialized = false
    this.audioContext = null
  }

  async init() {
    if (this.initialized) return
    
    try {
      this.createSounds()
      console.log('音效系统准备就绪')
    } catch (e) {
      console.warn('音效初始化失败:', e)
    }
  }

  // 确保 AudioContext 已启动
  ensureAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume()
    }
    this.initialized = true
    return this.audioContext
  }

  // 播放简单的音调
  playTone(frequency, duration, type = 'sine', volumeMultiplier = 1) {
    try {
      const ctx = this.ensureAudioContext()
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      
      oscillator.type = type
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime)
      
      gainNode.gain.setValueAtTime(this.volume * volumeMultiplier, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)
      
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + duration)
    } catch (e) {
      console.warn('播放音调失败:', e)
    }
  }

  // 播放噪声
  playNoise(duration, volumeMultiplier = 1) {
    try {
      const ctx = this.ensureAudioContext()
      const bufferSize = ctx.sampleRate * duration
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1
      }
      
      const source = ctx.createBufferSource()
      const gainNode = ctx.createGain()
      const filter = ctx.createBiquadFilter()
      
      filter.type = 'lowpass'
      filter.frequency.value = 2000
      
      source.buffer = buffer
      gainNode.gain.setValueAtTime(this.volume * volumeMultiplier * 0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)
      
      source.connect(filter)
      filter.connect(gainNode)
      gainNode.connect(ctx.destination)
      
      source.start()
    } catch (e) {}
  }

  createSounds() {
    // 发牌
    this.sounds.card = () => {
      this.playNoise(0.08, 0.5)
      setTimeout(() => this.playTone(100, 0.05, 'sine', 0.3), 30)
    }
    
    // 洗牌
    this.sounds.shuffle = () => {
      for (let i = 0; i < 5; i++) {
        setTimeout(() => this.playNoise(0.05, 0.3), i * 30)
      }
    }
    
    // 翻牌
    this.sounds.flip = () => {
      this.playNoise(0.06, 0.4)
      setTimeout(() => this.playTone(523, 0.05, 'sine', 0.2), 20)
    }
    
    // 收牌
    this.sounds.collect = () => {
      for (let i = 0; i < 3; i++) {
        setTimeout(() => this.playNoise(0.06, 0.3), i * 40)
      }
    }
    
    // 筹码
    this.sounds.chip = () => {
      this.playTone(1200, 0.08, 'square', 0.15)
      setTimeout(() => this.playTone(1500, 0.06, 'square', 0.1), 20)
    }
    
    // 大额下注
    this.sounds.bigBet = () => {
      for (let i = 0; i < 4; i++) {
        setTimeout(() => this.sounds.chip(), i * 50)
      }
      setTimeout(() => this.playTone(80, 0.2, 'sine', 0.4), 200)
    }
    
    // 获胜
    this.sounds.win = () => {
      const notes = [262, 330, 392, 523, 659]
      notes.forEach((freq, i) => {
        setTimeout(() => this.playTone(freq, 0.15, 'sine', 0.4), i * 100)
      })
    }
    
    // 失败
    this.sounds.lose = () => {
      const notes = [330, 294, 262, 247]
      notes.forEach((freq, i) => {
        setTimeout(() => this.playTone(freq, 0.15, 'sine', 0.3), i * 120)
      })
    }
    
    // 看牌
    this.sounds.peek = () => {
      this.playTone(294, 0.1, 'triangle', 0.25)
      setTimeout(() => this.playTone(440, 0.08, 'sine', 0.2), 80)
    }
    
    // 弃牌
    this.sounds.fold = () => {
      this.playTone(80, 0.15, 'sine', 0.3)
      this.playNoise(0.1, 0.2)
    }
    
    // 轮到你
    this.sounds.turn = () => {
      this.playTone(659, 0.1, 'sine', 0.35)
      setTimeout(() => this.playTone(880, 0.12, 'sine', 0.4), 100)
    }
    
    // 开牌
    this.sounds.showdown = () => {
      this.playTone(65, 0.1, 'sine', 0.5)
      setTimeout(() => this.playTone(65, 0.1, 'sine', 0.4), 120)
      setTimeout(() => this.playTone(98, 0.15, 'sine', 0.5), 240)
    }
    
    // 豹子
    this.sounds.leopard = () => {
      this.playTone(50, 0.4, 'sine', 0.5)
      const notes = [523, 659, 784, 988, 1047]
      notes.forEach((freq, i) => {
        setTimeout(() => this.playTone(freq, 0.1, 'sine', 0.35), 150 + i * 50)
      })
    }
    
    // 同花顺
    this.sounds.straightFlush = () => {
      const notes = [262, 294, 330, 349, 392, 440, 494, 523]
      notes.forEach((freq, i) => {
        setTimeout(() => this.playTone(freq, 0.08, 'sine', 0.35), i * 60)
      })
    }
    
    // 全押
    this.sounds.allIn = () => {
      this.playTone(50, 0.3, 'sine', 0.5)
      for (let i = 0; i < 5; i++) {
        setTimeout(() => this.sounds.chip(), i * 70)
      }
    }
    
    // 跟注
    this.sounds.call = () => {
      this.playTone(330, 0.06, 'triangle', 0.2)
      setTimeout(() => this.sounds.chip(), 40)
    }
    
    // 加注
    this.sounds.raise = () => {
      this.playTone(262, 0.05, 'triangle', 0.25)
      this.playTone(330, 0.05, 'triangle', 0.25)
      setTimeout(() => this.sounds.chip(), 60)
    }

    // 点击
    this.sounds.click = () => this.playTone(784, 0.03, 'sine', 0.15)
    
    // 悬停
    this.sounds.hover = () => this.playTone(1047, 0.02, 'sine', 0.08)
    
    // 成功
    this.sounds.success = () => {
      this.playTone(523, 0.08, 'sine', 0.25)
      setTimeout(() => this.playTone(659, 0.08, 'sine', 0.25), 80)
      setTimeout(() => this.playTone(784, 0.1, 'sine', 0.3), 160)
    }
    
    // 错误
    this.sounds.error = () => {
      this.playTone(165, 0.12, 'sawtooth', 0.3)
      setTimeout(() => this.playTone(131, 0.12, 'sawtooth', 0.25), 120)
    }
    
    // 警告
    this.sounds.warning = () => {
      this.playTone(330, 0.08, 'triangle', 0.25)
      setTimeout(() => this.playTone(330, 0.08, 'triangle', 0.25), 150)
    }
    
    // 通知
    this.sounds.notify = () => {
      this.playTone(784, 0.06, 'sine', 0.2)
      setTimeout(() => this.playTone(1047, 0.1, 'sine', 0.25), 60)
    }
    
    // 倒计时
    this.sounds.tick = () => this.playTone(880, 0.02, 'sine', 0.15)
    this.sounds.tickUrgent = () => {
      this.playTone(880, 0.03, 'sine', 0.25)
      setTimeout(() => this.playTone(659, 0.03, 'sine', 0.2), 40)
    }
    
    // 加入
    this.sounds.join = () => {
      this.playTone(262, 0.06, 'sine', 0.2)
      setTimeout(() => this.playTone(392, 0.08, 'sine', 0.25), 80)
    }
    
    // 离开
    this.sounds.leave = () => {
      this.playTone(392, 0.06, 'sine', 0.2)
      setTimeout(() => this.playTone(262, 0.08, 'sine', 0.15), 80)
    }
    
    // 弹窗打开
    this.sounds.modalOpen = () => {
      this.playTone(262, 0.05, 'sine', 0.15)
      setTimeout(() => this.playTone(392, 0.05, 'sine', 0.2), 40)
    }
    
    // 弹窗关闭
    this.sounds.modalClose = () => {
      this.playTone(392, 0.05, 'sine', 0.15)
      setTimeout(() => this.playTone(262, 0.05, 'sine', 0.12), 40)
    }
    
    // 金币
    this.sounds.coin = () => {
      this.playTone(2093, 0.05, 'square', 0.12)
      setTimeout(() => this.playTone(2637, 0.04, 'square', 0.1), 30)
    }
  }

  play(soundName) {
    if (this.enabled && this.sounds[soundName]) {
      try {
        this.sounds[soundName]()
      } catch (e) {
        console.warn('播放音效失败:', soundName, e)
      }
    }
  }

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
        break
    }
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume))
  }

  toggle() {
    this.enabled = !this.enabled
    return this.enabled
  }

  isEnabled() {
    return this.enabled
  }

  playChipsByAmount(amount, maxAmount = 10000) {
    const ratio = Math.min(amount / maxAmount, 1)
    
    if (ratio > 0.8) {
      this.play('bigBet')
    } else if (ratio > 0.5) {
      for (let i = 0; i < 3; i++) {
        setTimeout(() => this.play('chip'), i * 60)
      }
    } else if (ratio > 0.2) {
      for (let i = 0; i < 2; i++) {
        setTimeout(() => this.play('chip'), i * 80)
      }
    } else {
      this.play('chip')
    }
  }

  dispose() {
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    this.initialized = false
  }
}
