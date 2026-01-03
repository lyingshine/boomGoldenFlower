/**
 * 音效管理器 - 增强版
 */
export class SoundManager {
  constructor() {
    this.sounds = {}
    this.enabled = true
    this.volume = 0.4
    this.audioContext = null
    this.initialized = false
  }

  // 延迟初始化，需要用户交互后才能播放音频
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
    // 发牌音效 - 清脆的卡牌声
    this.sounds.card = () => this.playTone([600, 300], 0.08, 0.25)
    
    // 筹码音效 - 金属碰撞声
    this.sounds.chip = () => {
      this.playTone([500, 550, 500], 0.12, 0.3)
    }
    
    // 获胜音效 - 欢快的旋律
    this.sounds.win = () => {
      const notes = [523, 659, 784, 1047]
      notes.forEach((freq, i) => {
        setTimeout(() => this.playTone([freq], 0.25, 0.4), i * 100)
      })
    }
    
    // 按钮点击音效
    this.sounds.click = () => this.playTone([800], 0.04, 0.15)
    
    // 看牌音效
    this.sounds.peek = () => this.playTone([400, 600], 0.1, 0.2)
    
    // 弃牌音效
    this.sounds.fold = () => this.playTone([300, 200], 0.15, 0.2)
    
    // 轮到你音效
    this.sounds.turn = () => {
      this.playTone([660, 880], 0.15, 0.3)
    }
    
    // 错误/警告音效
    this.sounds.error = () => this.playTone([200, 150], 0.2, 0.25)
  }

  playTone(frequencies, duration, gain) {
    if (!this.audioContext || !this.enabled) return
    
    try {
      const oscillator = this.audioContext.createOscillator()
      const gainNode = this.audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(this.audioContext.destination)
      
      const now = this.audioContext.currentTime
      
      // 设置频率变化
      oscillator.frequency.setValueAtTime(frequencies[0], now)
      frequencies.forEach((freq, i) => {
        if (i > 0) {
          oscillator.frequency.linearRampToValueAtTime(freq, now + (duration * i / frequencies.length))
        }
      })
      
      // 设置音量包络
      gainNode.gain.setValueAtTime(0, now)
      gainNode.gain.linearRampToValueAtTime(this.volume * gain, now + 0.01)
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration)
      
      oscillator.start(now)
      oscillator.stop(now + duration)
    } catch (e) {
      // 静默失败
    }
  }

  play(soundName) {
    if (!this.initialized) this.init()
    if (this.enabled && this.sounds[soundName]) {
      try {
        // 恢复被暂停的音频上下文
        if (this.audioContext?.state === 'suspended') {
          this.audioContext.resume()
        }
        this.sounds[soundName]()
      } catch (e) {
        // 静默失败
      }
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
}