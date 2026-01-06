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
              <button class="adj-btn" @click="decreaseCall" :disabled="callBetAmount <= callAmount">−</button>
              <button @click="$emit('call', callBetAmount)" :disabled="!canCall" class="btn btn-primary">
                🤝 跟 ¥{{ callBetAmount }}
              </button>
              <button class="adj-btn" @click="increaseCall">+</button>
            </div>
            
            <!-- 焖牌控制 -->
            <div v-if="!myPlayer.hasPeeked" class="bet-inline">
              <button class="adj-btn" @click="decreaseBlind" :disabled="blindBetAmount <= blindMinAmount">−</button>
              <button @click="$emit('blind', blindBetAmount)" :disabled="!canBlind" class="btn btn-blind">
                🙈 焖 ¥{{ blindBetAmount }}
              </button>
              <button class="adj-btn" @click="increaseBlind">+</button>
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
  props: ['gamePhase', 'isHost', 'isMyTurn', 'myPlayer', 'canCall', 'canRaise', 'canShowdown', 'canBlind', 'currentBet', 'showdownTargets', 'showdownCost', 'callAmount', 'blindMinAmount', 'firstRoundComplete'],
  emits: ['start-game', 'peek', 'call', 'raise', 'fold', 'showdown', 'blind', 'showdown-mode-change'],
  data() {
    return {
      showdownMode: false,
      callBetAmount: 10,
      blindBetAmount: 10
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
      if (this.callBetAmount < max) {
        this.callBetAmount = Math.min(this.callBetAmount + 10, max)
      }
    },
    decreaseCall() {
      if (this.callBetAmount > this.callAmount) {
        this.callBetAmount = Math.max(this.callBetAmount - 10, this.callAmount)
      }
    },
    increaseBlind() {
      const max = this.myPlayer ? this.myPlayer.chips : 100
      if (this.blindBetAmount < max) {
        this.blindBetAmount = Math.min(this.blindBetAmount + 10, max)
      }
    },
    decreaseBlind() {
      if (this.blindBetAmount > this.blindMinAmount) {
        this.blindBetAmount = Math.max(this.blindBetAmount - 10, this.blindMinAmount)
      }
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
  position: absolute;
  width: 100%;
  height: 80px;
  pointer-events: none;
  top: 0;
}

/* 左右按钮容器 - 固定定位 */
.left-button {
  position: absolute;
  bottom: 0;
  left: 20px;
  pointer-events: auto;
}

.right-button {
  position: absolute;
  bottom: 0;
  right: 20px;
  pointer-events: auto;
}

/* 圆形按钮样式 - 筹码质感 */
.btn-circle {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  border: 3px solid;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
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
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: radial-gradient(circle at center, #374151 0%, #1f2937 50%, #111827 100%);
  color: rgba(255, 255, 255, 0.4);
  border: 3px solid #4b5563;
  font-size: 10px;
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

/* 底部控制区域 */
.bottom-controls {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  width: 100%;
  padding: 20px;
  background: linear-gradient(180deg, 
    rgba(0, 0, 0, 0) 0%, 
    rgba(0, 0, 0, 0.3) 30%, 
    rgba(0, 0, 0, 0.6) 100%);
  backdrop-filter: blur(12px);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  min-height: 140px;
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
  padding: 30px 20px;
  background: linear-gradient(180deg, 
    rgba(0, 0, 0, 0) 0%, 
    rgba(0, 0, 0, 0.4) 100%);
  backdrop-filter: blur(8px);
  min-height: 100px;
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

/* 跟注和焖牌同一行 */
.bet-row {
  display: flex;
  gap: 20px;
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

/* 调节按钮 - 精致设计 */
.adj-btn {
  width: 52px;
  height: 52px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.3);
  color: rgba(255, 255, 255, 0.9);
  font-size: 22px;
  font-weight: 400;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(8px);
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

/* 按钮组合 */
.bet-inline {
  display: flex;
  align-items: center;
  gap: 0;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(8px);
}

.bet-inline .btn {
  border-radius: 0;
  min-width: 180px;
  padding: 20px 24px;
  font-size: 18px;
  font-weight: 700;
  border-left: none;
  border-right: none;
}

/* 尺寸变体 */
.btn-large {
  padding: 22px 32px;
  font-size: 19px;
  min-width: 180px;
  border-radius: 16px;
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
  padding: 18px 24px;
  font-size: 17px;
  border-radius: 12px;
  min-width: 160px;
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
    left: 60px;
  }
  
  .right-button {
    right: 60px;
  }
  
  .btn-circle {
    width: 55px;
    height: 55px;
    font-size: 10px;
  }
  
  .bottom-controls {
    gap: 16px;
    padding: 20px;
    min-height: 140px;
  }
  
  .bet-row {
    gap: 18px;
  }
  
  .bet-inline .btn {
    min-width: 180px;
    padding: 22px 26px;
    font-size: 18px;
  }
  
  .btn-large {
    padding: 24px 32px;
    font-size: 19px;
    min-width: 180px;
  }
  
  .adj-btn {
    width: 52px;
    height: 52px;
    font-size: 22px;
  }
  
  .btn-small {
    padding: 20px 26px;
    font-size: 17px;
    min-width: 160px;
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
