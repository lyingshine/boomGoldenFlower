<template>
  <div class="game-controls-wrapper" :class="{ 'my-turn': isMyTurn && gamePhase === 'betting' }">
    <!-- 轮到我时的提示 -->
    <div v-if="isMyTurn && gamePhase === 'betting'" class="turn-indicator">
      ⚡ 轮到你了！
    </div>
    
    <div class="game-controls">
      <!-- 等待阶段 -->
      <template v-if="gamePhase === 'waiting'">
        <button v-if="isHost" @click="$emit('start-game')" class="btn btn-primary btn-large">
          🃏 发牌开始
        </button>
        <div v-else class="waiting-message">
          <span class="waiting-dot"></span>
          等待房主发牌
        </div>
      </template>

      <!-- 下注阶段 -->
      <template v-if="gamePhase === 'betting' && myPlayer && !myPlayer.folded">
        <!-- 第一行：看牌和弃牌 -->
        <div class="controls-row secondary-row">
          <button v-if="!myPlayer.hasPeeked" @click="$emit('peek')" class="btn btn-info btn-small">
            👁️ 看牌
          </button>
          <button @click="confirmFold" class="btn btn-danger btn-small">
            🚫 弃牌
          </button>
        </div>
        
        <!-- 第二行：跟注/焖牌（轮到我时显示） -->
        <div v-if="isMyTurn" class="controls-row bet-row">
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

        <!-- 第三行：开牌按钮（轮到我且有对手时显示） -->
        <div v-if="isMyTurn && canShowdown && showdownTargets.length > 0" class="controls-row secondary-row">
          <button v-if="showdownTargets.length === 1" @click="$emit('showdown', showdownTargets[0].id)" class="btn btn-showdown btn-small">
            ⚔️ 开牌 ¥{{ showdownCost }}
          </button>
          <button v-else @click="showShowdownModal = true" class="btn btn-showdown btn-small">
            ⚔️ 开牌 ¥{{ showdownCost }}
          </button>
        </div>
        
        <!-- 不是我的回合 -->
        <div v-if="!isMyTurn" class="waiting-message">
          <span class="waiting-dot"></span>
          等待其他玩家
        </div>
      </template>

      <!-- 已弃牌 -->
      <template v-if="gamePhase === 'betting' && myPlayer && myPlayer.folded">
        <div class="folded-message">
          🚫 已弃牌，等待本轮结束
        </div>
      </template>

      <!-- 游戏结束 -->
      <template v-if="gamePhase === 'showdown' || gamePhase === 'ended'">
        <button v-if="isHost" @click="$emit('start-game')" class="btn btn-primary btn-large">
          🃏 再来一局
        </button>
        <div v-else class="waiting-message">
          <span class="waiting-dot"></span>
          等待房主发牌
        </div>
      </template>
    </div>

    <!-- 开牌选择弹窗 -->
    <div v-if="showShowdownModal" class="compare-modal-overlay" @click.self="showShowdownModal = false">
      <div class="compare-modal">
        <div class="compare-modal-header">
          <span>⚔️ 选择开牌对手</span>
          <button class="close-btn" @click="showShowdownModal = false">×</button>
        </div>
        <div class="compare-modal-body">
          <div class="compare-cost-info">开牌费用: ¥{{ showdownCost }}</div>
          <div class="compare-targets">
            <button
              v-for="target in showdownTargets"
              :key="target.id"
              class="compare-target-btn"
              @click="selectShowdownTarget(target)"
            >
              <span class="target-avatar">{{ target.type === 'ai' ? '🤖' : '🎮' }}</span>
              <span class="target-name">{{ target.name }}</span>
              <span class="target-chips">¥{{ target.chips }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'GameControls',
  props: ['gamePhase', 'isHost', 'isMyTurn', 'myPlayer', 'canCall', 'canRaise', 'canShowdown', 'canBlind', 'currentBet', 'showdownTargets', 'showdownCost', 'callAmount', 'blindMinAmount'],
  emits: ['start-game', 'peek', 'call', 'raise', 'fold', 'showdown', 'blind'],
  data() {
    return {
      showShowdownModal: false,
      callBetAmount: 10,
      blindBetAmount: 10
    }
  },
  watch: {
    isMyTurn(val) {
      if (val) {
        this.callBetAmount = this.callAmount
        this.blindBetAmount = this.blindMinAmount
      }
    },
    callAmount(val) {
      if (this.callBetAmount < val) this.callBetAmount = val
    },
    blindMinAmount(val) {
      if (this.blindBetAmount < val) this.blindBetAmount = val
    }
  },
  methods: {
    confirmFold() {
      if (confirm('确定要弃牌吗？')) {
        this.$emit('fold')
      }
    },
    selectShowdownTarget(target) {
      this.showShowdownModal = false
      this.$emit('showdown', target.id)
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
.game-controls-wrapper.my-turn {
  border-color: rgba(255, 215, 0, 0.5) !important;
  box-shadow: 0 0 16px rgba(255, 215, 0, 0.25) !important;
}

.game-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

.controls-row {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}

.btn-large {
  padding: 12px 24px;
  font-size: 14px;
  min-width: 120px;
}

.btn-showdown {
  background: linear-gradient(145deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%);
  color: white;
  width: 100%;
  max-width: 200px;
}

.btn-showdown:hover:not(:disabled) {
  background: linear-gradient(145deg, #a78bfa 0%, #8b5cf6 50%, #7c3aed 100%);
}

.btn-blind {
  background: linear-gradient(145deg, #f59e0b 0%, #d97706 50%, #b45309 100%);
  color: white;
}

.btn-blind:hover:not(:disabled) {
  background: linear-gradient(145deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%);
}

.bet-row {
  gap: 16px;
}

.bet-inline {
  display: flex;
  align-items: center;
  gap: 0;
}

.adj-btn {
  width: 28px;
  height: 32px;
  border: none;
  background: rgba(255, 255, 255, 0.15);
  color: white;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}

.adj-btn:first-child {
  border-radius: 6px 0 0 6px;
}

.adj-btn:last-child {
  border-radius: 0 6px 6px 0;
}

.adj-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.25);
}

.adj-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.bet-inline .btn {
  border-radius: 0;
  min-width: 100px;
  padding: 12px 16px;
  font-size: 15px;
}

.btn-small {
  padding: 6px 10px !important;
  font-size: 11px !important;
  opacity: 0.8;
}

.secondary-row {
  gap: 16px;
}

.secondary-row .btn {
  min-width: auto;
}

.waiting-message {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
}

.waiting-dot {
  width: 6px;
  height: 6px;
  background: #ffd700;
  border-radius: 50%;
  animation: blink 1s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.folded-message {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  padding: 8px 14px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 6px;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.turn-indicator {
  position: absolute;
  top: -22px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #ffd700, #ffed4e);
  color: #2d3748;
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: bold;
  animation: bounce 0.5s ease-out;
  white-space: nowrap;
}

@keyframes bounce {
  0% { transform: translateX(-50%) translateY(-8px); opacity: 0; }
  50% { transform: translateX(-50%) translateY(2px); }
  100% { transform: translateX(-50%) translateY(0); opacity: 1; }
}

@media (max-width: 768px) {
  .controls-row {
    width: 100%;
  }
  
  .controls-row .btn {
    flex: 1;
    min-width: 0;
  }
  
  .btn-large {
    padding: 10px 20px;
    font-size: 13px;
  }
  
  .turn-indicator {
    font-size: 10px;
    padding: 2px 8px;
    top: -20px;
  }
}

@media (max-width: 380px) {
  .game-controls {
    gap: 6px;
  }
  
  .controls-row {
    gap: 6px;
  }
  
  .btn-large {
    padding: 8px 16px;
    font-size: 12px;
    min-width: 100px;
  }
}

/* 比牌按钮样式 */
.btn-compare {
  background: linear-gradient(145deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%);
  color: white;
  width: 100%;
  max-width: 200px;
}

.btn-compare:hover:not(:disabled) {
  background: linear-gradient(145deg, #f87171 0%, #ef4444 50%, #dc2626 100%);
}

/* 开牌弹窗样式 */
.compare-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.compare-modal {
  background: linear-gradient(145deg, #1e293b 0%, #0f172a 100%);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  min-width: 280px;
  max-width: 90vw;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
}

.compare-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 14px;
  font-weight: 600;
  color: #ffd700;
}

.close-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  color: white;
}

.compare-modal-body {
  padding: 16px;
}

.compare-cost-info {
  text-align: center;
  color: #ef4444;
  font-size: 12px;
  margin-bottom: 12px;
  padding: 6px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 6px;
}

.compare-targets {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.compare-target-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
}

.compare-target-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
}

.target-avatar {
  font-size: 20px;
}

.target-name {
  flex: 1;
  font-size: 13px;
}

.target-chips {
  font-size: 12px;
  color: #ffd700;
}
</style>
