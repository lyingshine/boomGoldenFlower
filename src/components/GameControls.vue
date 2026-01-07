<template>
    <div class="game-controls" :class="{ 'my-turn': isMyTurn && gamePhase === 'betting' }">
      <!-- 下注阶段 -->
      <template v-if="gamePhase === 'betting' && myPlayer && !myPlayer.folded">
        <!-- 圆形按钮：看牌（左下角）和弃牌（右下角） -->
        <div class="corner-buttons">
          <!-- 左侧按钮：看牌/已看牌 -->
          <div class="left-button">
            <button v-if="!myPlayer.hasPeeked" @click="$emit('peek')" class="btn-circle btn-peek">
              看牌
            </button>
            <div v-else class="btn-circle btn-peek-disabled">
              已看牌
            </div>
          </div>
          <!-- 右侧按钮：弃牌 -->
          <div class="right-button">
            <button @click="$emit('fold')" class="btn-circle btn-fold">
              弃牌
            </button>
          </div>
        </div>
        
        <!-- 底部区域：跟注/焖牌（轮到我时显示） -->
        <div v-if="isMyTurn" class="bottom-controls">
          <!-- 跟注和焖牌在同一行 -->
          <div class="bet-row">
            <!-- 跟注控制 -->
            <div class="bet-inline">
              <button class="adj-btn" @mousedown="startHold('decreaseCall')" @mouseup="stopHold" @mouseleave="stopHold" @touchstart.prevent="startHold('decreaseCall')" @touchend="stopHold" :disabled="callBetAmount <= callAmount">−</button>
              <button @click="$emit('call', callBetAmount)" :disabled="!canCall" class="btn btn-primary">
                🤝 跟 ¥{{ callBetAmount }}
              </button>
              <button class="adj-btn" @mousedown="startHold('increaseCall')" @mouseup="stopHold" @mouseleave="stopHold" @touchstart.prevent="startHold('increaseCall')" @touchend="stopHold">+</button>
            </div>
            
            <!-- 焖牌控制 -->
            <div v-if="!myPlayer.hasPeeked" class="bet-inline">
              <button class="adj-btn" @mousedown="startHold('decreaseBlind')" @mouseup="stopHold" @mouseleave="stopHold" @touchstart.prevent="startHold('decreaseBlind')" @touchend="stopHold" :disabled="blindBetAmount <= blindMinAmount">−</button>
              <button @click="$emit('blind', blindBetAmount)" :disabled="!canBlind" class="btn btn-blind">
                🙈 焖 ¥{{ blindBetAmount }}
              </button>
              <button class="adj-btn" @mousedown="startHold('increaseBlind')" @mouseup="stopHold" @mouseleave="stopHold" @touchstart.prevent="startHold('increaseBlind')" @touchend="stopHold">+</button>
            </div>
          </div>
          
          <!-- 开牌按钮单独一行 -->
          <div v-if="showdownTargets.length > 0" class="showdown-controls">
            <button v-if="showdownTargets.length === 1" @click="$emit('showdown', showdownTargets[0].id)" :disabled="!firstRoundComplete" class="btn btn-showdown btn-small">
              ⚔️ 开牌 ¥{{ showdownCost }}
            </button>
            <button v-else @click="enterShowdownMode" :disabled="!firstRoundComplete" :class="['btn', 'btn-showdown', 'btn-small', { 'showdown-mode-active': showdownMode }]">
              {{ showdownMode ? '点击对手开牌' : '⚔️ 开牌' }} ¥{{ showdownCost }}
            </button>
            <button v-if="showdownMode" @click="cancelShowdownMode" class="btn btn-danger btn-small">
              取消
            </button>
          </div>
        </div>
        
        <!-- 不是我的回合 -->
        <div v-if="!isMyTurn" class="unified-bottom-control">
          <div class="waiting-message">
            <span class="waiting-dot"></span>
            等待其他玩家操作
          </div>
        </div>
      </template>

      <!-- 已弃牌 -->
      <template v-if="gamePhase === 'betting' && myPlayer && myPlayer.folded">
        <div class="unified-bottom-control">
          <div class="folded-message">
            🚫 已弃牌，等待本轮结束
          </div>
        </div>
      </template>

      <!-- 等待阶段 - 统一到底部 -->
      <template v-if="gamePhase === 'waiting'">
        <div class="unified-bottom-control">
          <button v-if="isHost" @click="$emit('start-game')" class="btn btn-primary btn-large">
            🃏 发牌开始
          </button>
          <div v-else class="waiting-message">
            <span class="waiting-dot"></span>
            等待房主发牌
          </div>
        </div>
      </template>

      <!-- 游戏结束 - 统一到底部 -->
      <template v-if="gamePhase === 'showdown' || gamePhase === 'ended'">
        <div class="unified-bottom-control">
          <button v-if="isHost" @click="$emit('start-game')" class="btn btn-primary btn-large">
            🃏 再来一局
          </button>
          <div v-else class="waiting-message">
            <span class="waiting-dot"></span>
            等待房主发牌
          </div>
        </div>
      </template>
    </div>
</template>

<script>
export default {
  name: 'GameControls',
  props: ['gamePhase', 'isHost', 'isMyTurn', 'myPlayer', 'canCall', 'canRaise', 'canShowdown', 'canBlind', 'currentBet', 'showdownTargets', 'showdownCost', 'callAmount', 'blindMinAmount', 'firstRoundComplete', 'ante'],
  emits: ['start-game', 'peek', 'call', 'raise', 'fold', 'showdown', 'blind', 'showdown-mode-change'],
  data() {
    return {
      showdownMode: false,
      callBetAmount: 10,
      blindBetAmount: 10,
      holdTimer: null,
      holdInterval: null
    }
  },
  watch: {
    isMyTurn(val) {
      if (val) {
        this.callBetAmount = this.callAmount
        this.blindBetAmount = this.blindMinAmount
      } else {
        this.showdownMode = false
        this.$emit('showdown-mode-change', false)
      }
    },
    callAmount(val) {
      if (this.callBetAmount < val) this.callBetAmount = val
    },
    blindMinAmount(val) {
      if (this.blindBetAmount < val) this.blindBetAmount = val
    },
    // 游戏结束时重置下注金额
    gamePhase(val) {
      if (val === 'ended' || val === 'waiting') {
        this.callBetAmount = this.callAmount || 10
        this.blindBetAmount = this.blindMinAmount || 10
        this.showdownMode = false
        this.$emit('showdown-mode-change', false)
      }
    }
  },
  methods: {
    enterShowdownMode() {
      this.showdownMode = true
      this.$emit('showdown-mode-change', true)
    },
    cancelShowdownMode() {
      this.showdownMode = false
      this.$emit('showdown-mode-change', false)
    },
    increaseCall() {
      const max = this.myPlayer ? this.myPlayer.chips : 100
      const step = this.ante || 10
      if (this.callBetAmount < max) {
        this.callBetAmount = Math.min(this.callBetAmount + step, max)
      }
    },
    decreaseCall() {
      const step = this.ante || 10
      if (this.callBetAmount > this.callAmount) {
        this.callBetAmount = Math.max(this.callBetAmount - step, this.callAmount)
      }
    },
    increaseBlind() {
      const max = this.myPlayer ? this.myPlayer.chips : 100
      const step = this.ante || 10
      if (this.blindBetAmount < max) {
        this.blindBetAmount = Math.min(this.blindBetAmount + step, max)
      }
    },
    decreaseBlind() {
      const step = this.ante || 10
      if (this.blindBetAmount > this.blindMinAmount) {
        this.blindBetAmount = Math.max(this.blindBetAmount - step, this.blindMinAmount)
      }
    },
    startHold(action) {
      this[action]()
      this.holdTimer = setTimeout(() => {
        this.holdInterval = setInterval(() => this[action](), 100)
      }, 300)
    },
    stopHold() {
      clearTimeout(this.holdTimer)
      clearInterval(this.holdInterval)
      this.holdTimer = null
      this.holdInterval = null
    }
  }
}
</script>

<style scoped>
.game-controls {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  width: 100%;
  min-height: 120px;
}

.game-controls.my-turn {
  animation: myTurnGlow 2s ease-in-out infinite;
}

/* 圆形按钮容器 */
.corner-buttons {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: auto;
  pointer-events: none;
  z-index: 60;
}

/* 左右按钮容器 - 与底部玩家卡片齐平 */
.left-button {
  position: fixed;
  bottom: calc(50vh - 210px);
  left: calc(50% - 340px);
  pointer-events: auto;
  z-index: 60;
}

.right-button {
  position: fixed;
  bottom: calc(50vh - 210px);
  right: calc(50% - 340px);
  pointer-events: auto;
  z-index: 60;
}

/* 圆形按钮样式 - PC端优化 */
.btn-circle {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: 3px solid;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
  position: relative;
}

.btn-circle::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  opacity: 0;
  transition: opacity 0.3s ease;
  animation: rotate 3s linear infinite;
}

.btn-circle:hover::before {
  opacity: 1;
}

.btn-circle::after {
  content: '';
  position: absolute;
  inset: 4px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.3), transparent 60%);
  pointer-events: none;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.btn-circle:hover {
  transform: translateY(-3px) scale(1.05);
  filter: brightness(1.2);
}

.btn-circle:active {
  transform: translateY(-1px) scale(0.98);
  transition: all 0.1s ease;
}

/* 看牌按钮 - 神秘蓝光 */
.btn-peek {
  background: radial-gradient(circle at center, #1e40af 0%, #1e3a8a 50%, #0f172a 100%);
  border-color: #3b82f6;
  color: #e0f2fe;
  box-shadow: 
    0 0 20px rgba(59, 130, 246, 0.6),
    0 4px 15px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.btn-peek:hover {
  background: radial-gradient(circle at center, #2563eb 0%, #1e40af 50%, #1e3a8a 100%);
  border-color: #60a5fa;
  box-shadow: 
    0 0 30px rgba(59, 130, 246, 0.8),
    0 6px 20px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

/* 已看牌状态 - 暗淡效果 */
.btn-peek-disabled {
  width: 45px;
  height: 45px;
  border-radius: 50%;
  background: radial-gradient(circle at center, #374151 0%, #1f2937 50%, #111827 100%);
  color: rgba(255, 255, 255, 0.4);
  border: 2px solid #4b5563;
  font-size: 9px;
  font-weight: 600;
  cursor: default;
  display: flex;
  align-items: center;
  justify-content: center;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  opacity: 0.7;
}

/* 弃牌按钮 - 危险红焰 */
.btn-fold {
  background: radial-gradient(circle at center, #dc2626 0%, #b91c1c 50%, #7f1d1d 100%);
  border-color: #ef4444;
  color: #fef2f2;
  box-shadow: 
    0 0 20px rgba(239, 68, 68, 0.6),
    0 4px 15px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.btn-fold:hover {
  background: radial-gradient(circle at center, #ef4444 0%, #dc2626 50%, #b91c1c 100%);
  border-color: #f87171;
  box-shadow: 
    0 0 30px rgba(239, 68, 68, 0.8),
    0 6px 20px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

/* 底部控制区域 - PC端优化 */
.bottom-controls {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 14px 12px;
  background: linear-gradient(180deg, 
    rgba(0, 0, 0, 0) 0%, 
    rgba(0, 0, 0, 0.35) 30%, 
    rgba(0, 0, 0, 0.65) 100%);
  backdrop-filter: blur(16px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  min-height: 80px;
}

/* 统一的底部控制区域 - 所有状态都在这里 */
.unified-bottom-control {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 15px 10px;
  background: linear-gradient(180deg, 
    rgba(0, 0, 0, 0) 0%, 
    rgba(0, 0, 0, 0.4) 100%);
  backdrop-filter: blur(8px);
  min-height: 50px;
}

/* 等待其他玩家 - 使用统一样式 */
.wait-controls {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  padding: 30px 20px;
  background: linear-gradient(180deg, 
    rgba(0, 0, 0, 0) 0%, 
    rgba(0, 0, 0, 0.4) 100%);
  backdrop-filter: blur(8px);
}

/* 游戏结束 - 使用统一样式 */
.end-controls {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  padding: 30px 20px;
  background: linear-gradient(180deg, 
    rgba(0, 0, 0, 0) 0%, 
    rgba(0, 0, 0, 0.4) 100%);
  backdrop-filter: blur(8px);
}

/* 跟注和焖牌同一行 - PC端优化 */
.bet-row {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
  width: 100%;
  max-width: 600px;
}

/* 开牌控制区域 */
.showdown-controls {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.controls-row {
  display: flex;
  gap: 6px;
  justify-content: center;
  flex-wrap: wrap;
  width: 100%;
}

/* 主要按钮基础样式 - 筹码质感 */
.btn {
  border: 2px solid;
  border-radius: 8px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  position: relative;
  overflow: hidden;
  font-family: inherit;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

.btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  transition: left 0.5s ease;
}

.btn:hover::before {
  left: 100%;
}

.btn:hover {
  transform: translateY(-2px);
  filter: brightness(1.15) saturate(1.2);
}

.btn:active {
  transform: translateY(0) scale(0.98);
  transition: all 0.1s ease;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  filter: grayscale(0.5);
}

/* 跟注按钮 - 金色筹码 */
.btn-primary {
  background: radial-gradient(circle at center, #f59e0b 0%, #d97706 50%, #92400e 100%);
  border-color: #fbbf24;
  color: #fffbeb;
  box-shadow: 
    0 0 15px rgba(251, 191, 36, 0.5),
    0 4px 15px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.btn-primary:hover:not(:disabled) {
  background: radial-gradient(circle at center, #fbbf24 0%, #f59e0b 50%, #d97706 100%);
  border-color: #fcd34d;
  box-shadow: 
    0 0 25px rgba(251, 191, 36, 0.7),
    0 6px 20px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

/* 焖牌按钮 - 深红筹码 */
.btn-blind {
  background: radial-gradient(circle at center, #b91c1c 0%, #991b1b 50%, #7f1d1d 100%);
  border-color: #dc2626;
  color: #fef2f2;
  box-shadow: 
    0 0 15px rgba(220, 38, 38, 0.5),
    0 4px 15px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.btn-blind:hover:not(:disabled) {
  background: radial-gradient(circle at center, #dc2626 0%, #b91c1c 50%, #991b1b 100%);
  border-color: #ef4444;
  box-shadow: 
    0 0 25px rgba(220, 38, 38, 0.7),
    0 6px 20px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

/* 开牌按钮 - 紫色筹码 */
.btn-showdown {
  background: radial-gradient(circle at center, #7c3aed 0%, #6d28d9 50%, #581c87 100%);
  border-color: #8b5cf6;
  color: #f3e8ff;
  box-shadow: 
    0 0 15px rgba(139, 92, 246, 0.5),
    0 4px 15px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.btn-showdown:hover:not(:disabled) {
  background: radial-gradient(circle at center, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%);
  border-color: #a78bfa;
  box-shadow: 
    0 0 25px rgba(139, 92, 246, 0.7),
    0 6px 20px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.btn-showdown.showdown-mode-active {
  background: radial-gradient(circle at center, #f59e0b 0%, #d97706 50%, #92400e 100%);
  animation: chipPulse 1.5s ease-in-out infinite;
  border-color: #fbbf24;
}

@keyframes chipPulse {
  0%, 100% { 
    box-shadow: 
      0 0 15px rgba(251, 191, 36, 0.6),
      0 4px 15px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
  50% { 
    box-shadow: 
      0 0 30px rgba(251, 191, 36, 0.9),
      0 6px 20px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.4);
    transform: scale(1.02);
  }
}

/* 危险按钮 */
.btn-danger {
  background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%);
  color: #fef2f2;
  box-shadow: 
    0 4px 16px rgba(185, 28, 28, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.btn-danger:hover:not(:disabled) {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  box-shadow: 
    0 6px 20px rgba(185, 28, 28, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

/* 调节按钮 - PC端优化 */
.adj-btn {
  width: 36px;
  height: 36px;
  border: 2px solid rgba(255, 255, 255, 0.18);
  background: rgba(0, 0, 0, 0.35);
  color: rgba(255, 255, 255, 0.95);
  font-size: 16px;
  font-weight: 400;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(10px);
  position: relative;
}

.adj-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
  opacity: 0;
  transition: opacity 0.25s ease;
}

.adj-btn:hover:not(:disabled)::before {
  opacity: 1;
}

.adj-btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.4);
  border-color: rgba(255, 255, 255, 0.25);
  color: white;
}

.adj-btn:active:not(:disabled) {
  background: rgba(0, 0, 0, 0.5);
}

.adj-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.adj-btn:first-child {
  border-radius: 14px 0 0 14px;
}

.adj-btn:last-child {
  border-radius: 0 14px 14px 0;
}

/* 按钮组合 - PC端优化 */
.bet-inline {
  display: flex;
  align-items: center;
  gap: 0;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(10px);
}

.bet-inline .btn {
  border-radius: 0;
  min-width: 120px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 700;
  border-left: none;
  border-right: none;
}

/* 尺寸变体 */
.btn-large {
  padding: 12px 20px;
  font-size: 14px;
  min-width: 120px;
  border-radius: 10px;
}

/* 状态信息 - 优雅设计 */
.waiting-message {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  font-weight: 400;
  padding: 12px 20px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
}

.waiting-dot {
  width: 6px;
  height: 6px;
  background: #fbbf24;
  border-radius: 50%;
  animation: gentleBlink 2s ease-in-out infinite;
}

@keyframes gentleBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.folded-message {
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  font-weight: 400;
  padding: 12px 20px;
  background: rgba(185, 28, 28, 0.15);
  border-radius: 12px;
  border: 1px solid rgba(185, 28, 28, 0.25);
  backdrop-filter: blur(8px);
}

.btn-small {
  padding: 10px 14px;
  font-size: 12px;
  border-radius: 8px;
  min-width: 100px;
}

.waiting-message {
  display: flex;
  align-items: center;
  gap: 5px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: var(--radius-xl);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.waiting-dot {
  width: 8px;
  height: 8px;
  background: #ffd700;
  border-radius: 50%;
  animation: blink 1.2s ease-in-out infinite;
  box-shadow: 0 0 8px rgba(255, 215, 0, 0.5);
}

@keyframes blink {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.9); }
}

.folded-message {
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  padding: 8px 14px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: var(--radius-xl);
  border: 1px solid rgba(239, 68, 68, 0.2);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .left-button {
    bottom: auto;
    top: calc(50vh + 180px);
    left: calc(50% - 180px);
  }
  
  .right-button {
    bottom: auto;
    top: calc(50vh + 180px);
    right: calc(50% - 180px);
  }
  
  .btn-circle {
    width: 45px;
    height: 45px;
    font-size: 9px;
  }
  
  .bottom-controls {
    gap: 10px;
    padding: 12px;
    min-height: 70px;
  }
  
  .bet-row {
    gap: 10px;
  }
  
  .bet-inline .btn {
    min-width: 100px;
    padding: 10px 12px;
    font-size: 12px;
  }
  
  .btn-large {
    padding: 12px 18px;
    font-size: 13px;
    min-width: 110px;
  }
  
  .adj-btn {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }
  
  .btn-small {
    padding: 10px 14px;
    font-size: 11px;
    min-width: 90px;
  }
}

@media (max-width: 380px) {
  .game-controls {
    gap: 8px;
    min-height: 100px;
  }
  
  .btn-circle {
    width: 50px;
    height: 50px;
    font-size: 9px;
  }
  
  .bottom-controls {
    gap: 14px;
    padding: 18px;
    min-height: 130px;
  }
  
  .bet-row {
    gap: 14px;
  }
  
  .btn-large {
    padding: 22px 28px;
    font-size: 17px;
    min-width: 160px;
  }
  
  .bet-inline .btn {
    min-width: 160px;
    padding: 20px 24px;
    font-size: 16px;
  }
  
  .adj-btn {
    width: 48px;
    height: 48px;
    font-size: 20px;
  }
  
  .btn-small {
    padding: 18px 24px;
    font-size: 15px;
    min-width: 140px;
  }
}
</style>
