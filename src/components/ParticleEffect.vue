<template>
  <div class="particles-container" ref="container">
    <!-- 筹码喷射 -->
    <div v-for="chip in chips" :key="chip.id" 
         class="chip-particle"
         :style="chip.style">
      {{ chip.emoji }}
    </div>
    <!-- 星星闪烁 -->
    <div v-for="star in stars" :key="star.id"
         class="star-particle"
         :style="star.style">
      ✨
    </div>
    <!-- 飘字 -->
    <div v-for="text in floatTexts" :key="text.id"
         class="float-text"
         :class="text.type"
         :style="text.style">
      {{ text.content }}
    </div>
    <!-- ALL IN 火焰 -->
    <div v-for="flame in flames" :key="flame.id"
         class="flame-particle"
         :style="flame.style">
      {{ flame.emoji }}
    </div>
    <!-- ALL IN 文字 -->
    <div v-if="showAllIn" class="allin-text">ALL IN!</div>
    <!-- VS 对决动画 -->
    <div v-if="showVS" class="vs-overlay">
      <div class="vs-container">
        <div class="vs-player left">{{ vsData.challenger }}</div>
        <div class="vs-symbol">⚔️</div>
        <div class="vs-player right">{{ vsData.target }}</div>
      </div>
    </div>
    <!-- 连胜提示 -->
    <div v-if="streakInfo" class="streak-banner" :class="streakInfo.type">
      <span class="streak-icon">{{ streakInfo.icon }}</span>
      <span class="streak-text">{{ streakInfo.text }}</span>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ParticleEffect',
  data() {
    return {
      chips: [],
      stars: [],
      floatTexts: [],
      flames: [],
      showAllIn: false,
      showVS: false,
      vsData: { challenger: '', target: '' },
      streakInfo: null,
      idCounter: 0
    }
  },
  methods: {
    // 胜利时的筹码喷射
    triggerWinEffect(x, y, amount = 500) {
      const chipCount = Math.min(Math.floor(amount / 50) + 5, 25)
      const emojis = ['💰', '🪙', '💎', '✨', '⭐']
      
      for (let i = 0; i < chipCount; i++) {
        const id = this.idCounter++
        const angle = (Math.random() * 360) * Math.PI / 180
        const velocity = 150 + Math.random() * 200
        const vx = Math.cos(angle) * velocity
        const vy = Math.sin(angle) * velocity - 100
        
        const chip = {
          id,
          emoji: emojis[Math.floor(Math.random() * emojis.length)],
          style: {
            left: x + 'px',
            top: y + 'px',
            '--vx': vx + 'px',
            '--vy': vy + 'px',
            '--rotation': (Math.random() * 720 - 360) + 'deg',
            animationDelay: (i * 30) + 'ms',
            fontSize: (16 + Math.random() * 12) + 'px'
          }
        }
        this.chips.push(chip)
        
        setTimeout(() => {
          this.chips = this.chips.filter(c => c.id !== id)
        }, 1500)
      }
    },
    
    // 大牌特效（豹子/同花顺）
    triggerBigHandEffect() {
      const starCount = 20
      const centerX = window.innerWidth / 2
      const centerY = window.innerHeight / 2
      
      for (let i = 0; i < starCount; i++) {
        const id = this.idCounter++
        const angle = (i / starCount) * 360 * Math.PI / 180
        const distance = 100 + Math.random() * 150
        
        const star = {
          id,
          style: {
            left: centerX + 'px',
            top: centerY + 'px',
            '--tx': (Math.cos(angle) * distance) + 'px',
            '--ty': (Math.sin(angle) * distance) + 'px',
            animationDelay: (i * 50) + 'ms',
            fontSize: (20 + Math.random() * 16) + 'px'
          }
        }
        this.stars.push(star)
        
        setTimeout(() => {
          this.stars = this.stars.filter(s => s.id !== id)
        }, 1200)
      }
    },
    
    // 飘字效果
    triggerFloatText(x, y, content, type = 'win') {
      const id = this.idCounter++
      const text = {
        id,
        content,
        type,
        style: {
          left: x + 'px',
          top: y + 'px'
        }
      }
      this.floatTexts.push(text)
      
      setTimeout(() => {
        this.floatTexts = this.floatTexts.filter(t => t.id !== id)
      }, 1500)
    },
    
    // ALL IN 火焰效果
    triggerAllInEffect() {
      const centerX = window.innerWidth / 2
      const centerY = window.innerHeight / 2
      const flameEmojis = ['🔥', '💥', '⚡', '🌟']
      
      // 显示 ALL IN 文字
      this.showAllIn = true
      setTimeout(() => { this.showAllIn = false }, 1500)
      
      // 震动
      this.triggerShake('heavy')
      
      // 火焰粒子
      for (let i = 0; i < 30; i++) {
        const id = this.idCounter++
        const angle = (Math.random() * 360) * Math.PI / 180
        const distance = 80 + Math.random() * 120
        
        const flame = {
          id,
          emoji: flameEmojis[Math.floor(Math.random() * flameEmojis.length)],
          style: {
            left: centerX + 'px',
            top: centerY + 'px',
            '--tx': (Math.cos(angle) * distance) + 'px',
            '--ty': (Math.sin(angle) * distance - 50) + 'px',
            animationDelay: (i * 20) + 'ms',
            fontSize: (20 + Math.random() * 20) + 'px'
          }
        }
        this.flames.push(flame)
        
        setTimeout(() => {
          this.flames = this.flames.filter(f => f.id !== id)
        }, 1200)
      }
    },
    
    // 屏幕震动
    triggerShake(intensity = 'medium') {
      const container = document.querySelector('.game-container')
      if (!container) return
      
      const className = `shake-${intensity}`
      container.classList.add(className)
      setTimeout(() => container.classList.remove(className), 500)
    },
    
    // VS 对决动画
    triggerVSEffect(challengerName, targetName) {
      this.vsData = { challenger: challengerName, target: targetName }
      this.showVS = true
      this.triggerShake('medium')
      
      setTimeout(() => {
        this.showVS = false
      }, 1800)
    },
    
    // 连胜提示（3连胜以上才提醒，取消连败提示）
    triggerStreakEffect(streak, isWin) {
      // 只显示3连胜以上
      if (!isWin || streak < 3) return
      
      let icon, text
      
      if (streak >= 5) {
        icon = '👑'
        text = `${streak}连胜！无人能挡！`
      } else if (streak >= 3) {
        icon = '🔥'
        text = `${streak}连胜！势不可挡！`
      }
      
      this.streakInfo = { icon, text, type: 'win-streak' }
      this.triggerShake('light')
      
      setTimeout(() => {
        this.streakInfo = null
      }, 2500)
    }
  }
}
</script>

<style scoped>
.particles-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 9999;
  overflow: hidden;
}

.chip-particle {
  position: absolute;
  animation: chipFly 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
}

@keyframes chipFly {
  0% {
    transform: translate(0, 0) rotate(0deg) scale(0);
    opacity: 0;
  }
  10% {
    opacity: 1;
    transform: translate(0, 0) rotate(0deg) scale(1.2);
  }
  100% {
    transform: translate(var(--vx), var(--vy)) rotate(var(--rotation)) scale(0.5);
    opacity: 0;
  }
}

.star-particle {
  position: absolute;
  animation: starBurst 1s ease-out forwards;
}

@keyframes starBurst {
  0% {
    transform: translate(0, 0) scale(0);
    opacity: 0;
  }
  20% {
    opacity: 1;
    transform: translate(0, 0) scale(1.5);
  }
  100% {
    transform: translate(var(--tx), var(--ty)) scale(0);
    opacity: 0;
  }
}

/* 飘字效果 */
.float-text {
  position: absolute;
  font-weight: 800;
  text-shadow: 0 2px 8px rgba(0,0,0,0.5);
  animation: floatUp 1.5s ease-out forwards;
  white-space: nowrap;
}

.float-text.win {
  font-size: 28px;
  color: #ffd700;
  text-shadow: 
    0 0 10px rgba(255, 215, 0, 0.8),
    0 2px 4px rgba(0,0,0,0.5);
}

.float-text.lose {
  font-size: 24px;
  color: #ef4444;
}

.float-text.handtype {
  font-size: 22px;
  color: #a78bfa;
  text-shadow: 
    0 0 10px rgba(167, 139, 250, 0.6),
    0 2px 4px rgba(0,0,0,0.5);
}

@keyframes floatUp {
  0% {
    transform: translateY(0) scale(0.5);
    opacity: 0;
  }
  20% {
    transform: translateY(-10px) scale(1.2);
    opacity: 1;
  }
  80% {
    opacity: 1;
  }
  100% {
    transform: translateY(-80px) scale(1);
    opacity: 0;
  }
}

/* 火焰粒子 */
.flame-particle {
  position: absolute;
  animation: flameBurst 1s ease-out forwards;
  filter: drop-shadow(0 0 8px rgba(255, 100, 0, 0.8));
}

@keyframes flameBurst {
  0% {
    transform: translate(0, 0) scale(0) rotate(0deg);
    opacity: 0;
  }
  15% {
    opacity: 1;
    transform: translate(0, 0) scale(1.5) rotate(10deg);
  }
  100% {
    transform: translate(var(--tx), var(--ty)) scale(0.3) rotate(-20deg);
    opacity: 0;
  }
}

/* ALL IN 文字 */
.allin-text {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 64px;
  font-weight: 900;
  color: #ff4444;
  text-shadow: 
    0 0 20px rgba(255, 68, 68, 0.8),
    0 0 40px rgba(255, 68, 68, 0.6),
    0 4px 8px rgba(0,0,0,0.5);
  animation: allinPop 1.5s ease-out forwards;
  letter-spacing: 4px;
}

@keyframes allinPop {
  0% {
    transform: translate(-50%, -50%) scale(0) rotate(-10deg);
    opacity: 0;
  }
  20% {
    transform: translate(-50%, -50%) scale(1.3) rotate(5deg);
    opacity: 1;
  }
  40% {
    transform: translate(-50%, -50%) scale(1) rotate(0deg);
  }
  80% {
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.1) rotate(0deg);
    opacity: 0;
  }
}

/* VS 对决动画 */
.vs-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: vsFadeIn 0.3s ease-out;
}

@keyframes vsFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.vs-container {
  display: flex;
  align-items: center;
  gap: 20px;
}

.vs-player {
  font-size: 28px;
  font-weight: 800;
  color: white;
  padding: 12px 24px;
  border-radius: 12px;
  text-shadow: 0 2px 8px rgba(0,0,0,0.5);
}

.vs-player.left {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  animation: vsSlideLeft 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  transform: translateX(-100px);
  opacity: 0;
}

.vs-player.right {
  background: linear-gradient(135deg, #ef4444, #b91c1c);
  animation: vsSlideRight 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  transform: translateX(100px);
  opacity: 0;
}

@keyframes vsSlideLeft {
  from {
    transform: translateX(-100px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes vsSlideRight {
  from {
    transform: translateX(100px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.vs-symbol {
  font-size: 48px;
  animation: vsPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s forwards;
  transform: scale(0);
  opacity: 0;
  filter: drop-shadow(0 0 20px rgba(255, 200, 0, 0.8));
}

@keyframes vsPop {
  from {
    transform: scale(0) rotate(-180deg);
    opacity: 0;
  }
  to {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
}

/* 连胜/连败提示 */
.streak-banner {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 28px;
  border-radius: 30px;
  font-size: 18px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 10px;
  animation: streakSlide 2.5s ease-out forwards;
  z-index: 9998;
}

.streak-banner.win-streak {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.95), rgba(245, 158, 11, 0.95));
  color: #1a1a1a;
  box-shadow: 0 4px 20px rgba(255, 215, 0, 0.5);
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.streak-banner.lose-streak {
  background: linear-gradient(135deg, rgba(100, 100, 120, 0.9), rgba(70, 70, 90, 0.9));
  color: #e5e5e5;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  border: 2px solid rgba(255, 255, 255, 0.1);
}

.streak-icon {
  font-size: 24px;
}

@keyframes streakSlide {
  0% {
    transform: translateX(-50%) translateY(-30px);
    opacity: 0;
  }
  15% {
    transform: translateX(-50%) translateY(0);
    opacity: 1;
  }
  85% {
    transform: translateX(-50%) translateY(0);
    opacity: 1;
  }
  100% {
    transform: translateX(-50%) translateY(-20px);
    opacity: 0;
  }
}
</style>
