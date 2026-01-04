<template>
  <div class="game-controls-wrapper" :class="{ 'my-turn': isMyTurn && gamePhase === 'betting' }">
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
          <button v-else @click="enterShowdownMode" :class="['btn', 'btn-showdown', 'btn-small', { 'showdown-mode-active': showdownMode }]">
            {{ showdownMode ? '点击对手开牌' : '⚔️ 开牌' }} ¥{{ showdownCost }}
          </button>
          <button v-if="showdownMode" @click="cancelShowdownMode" class="btn btn-danger btn-small">
            取消
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
  </div>
</template>

<script>
export default {
  name: 'GameControls',
  props: ['gamePhase', 'isHost', 'isMyTurn', 'myPlayer', 'canCall', 'canRaise', 'canShowdown', 'canBlind', 'currentBet', 'showdownTargets', 'showdownCost', 'callAmount', 'blindMinAmount'],
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
    }
  },
  methods: {
    confirmFold() {
      if (confirm('确定要弃牌吗？')) {
        this.$emit('fold')
      }
    },
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
.game-controls-wrapper.my-turn {
  border-color: rgba(255, 215, 0, 0.6) !important;
  border-width: 2px !important;
  box-shadow: 
    0 -4px 20px rgba(0, 0, 0, 0.3),
    0 8px 32px rgba(0, 0, 0, 0.5),
    0 0 15px rgba(255, 215, 0, 0.5),
    0 0 30px rgba(255, 215, 0, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
  animation: myTurnGlow 2s ease-in-out infinite;
}

@keyframes myTurnGlow {
  0%, 100% { 
    box-shadow: 
      0 -4px 20px rgba(0, 0, 0, 0.3),
      0 8px 32px rgba(0, 0, 0, 0.5),
      0 0 15px rgba(255, 215, 0, 0.5),
      0 0 30px rgba(255, 215, 0, 0.25),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }
  50% { 
    box-shadow: 
      0 -4px 20px rgba(0, 0, 0, 0.3),
      0 8px 32px rgba(0, 0, 0, 0.5),
      0 0 25px rgba(255, 215, 0, 0.7),
      0 0 50px rgba(255, 215, 0, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }
}

.game-controls {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  width: 100%;
}

.controls-row {
  display: flex;
  gap: 6px;
  justify-content: center;
  flex-wrap: wrap;
  width: 100%;
}

.btn-large {
  padding: 10px 20px;
  font-size: 15px;
  min-width: 110px;
  border-radius: var(--radius-xl);
  font-weight: 600;
  letter-spacing: 0.5px;
}

.btn-showdown {
  background: linear-gradient(145deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%);
  color: white;
  border-radius: 10px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.btn-showdown:hover:not(:disabled) {
  background: linear-gradient(145deg, #a78bfa 0%, #8b5cf6 50%, #7c3aed 100%);
  box-shadow: 0 6px 16px rgba(139, 92, 246, 0.4);
  transform: translateY(-1px);
}

.btn-showdown.showdown-mode-active {
  background: linear-gradient(145deg, #f59e0b 0%, #d97706 50%, #b45309 100%);
  animation: pulse 1s ease-in-out infinite;
  box-shadow: 0 4px 16px rgba(245, 158, 11, 0.4);
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.03); }
}

.btn-blind {
  background: linear-gradient(145deg, #f59e0b 0%, #d97706 50%, #b45309 100%);
  color: white;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.btn-blind:hover:not(:disabled) {
  background: linear-gradient(145deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%);
  box-shadow: 0 6px 16px rgba(245, 158, 11, 0.4);
  transform: translateY(-1px);
}

.bet-row {
  gap: 8px;
}

.bet-inline {
  display: flex;
  align-items: center;
  gap: 0;
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.adj-btn {
  width: 32px;
  height: 38px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}

.adj-btn:first-child {
  border-radius: var(--radius-xl) 0 0 var(--radius-xl);
}

.adj-btn:last-child {
  border-radius: 0 var(--radius-xl) var(--radius-xl) 0;
}

.adj-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.adj-btn:active:not(:disabled) {
  background: rgba(255, 255, 255, 0.25);
}

.adj-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.bet-inline .btn {
  border-radius: 0;
  min-width: 90px;
  padding: 10px 12px;
  font-size: 14px;
  font-weight: 600;
}

.btn-small {
  padding: 8px 14px !important;
  font-size: 13px !important;
  border-radius: var(--radius-lg);
  font-weight: 500;
}

.secondary-row {
  gap: 8px;
}

.secondary-row .btn {
  min-width: auto;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
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

@media (max-width: 768px) {
  .controls-row {
    width: 100%;
  }
  
  .controls-row .btn {
    flex: 1;
    min-width: 0;
  }
  
  .btn-large {
    padding: 12px 20px;
    font-size: 14px;
  }
  
  .bet-inline .btn {
    min-width: 90px;
    padding: 10px 12px;
    font-size: 13px;
  }
  
  .adj-btn {
    width: 32px;
    height: 36px;
    font-size: 18px;
  }
}

@media (max-width: 380px) {
  .game-controls {
    gap: 8px;
  }
  
  .controls-row {
    gap: 8px;
  }
  
  .btn-large {
    padding: 10px 16px;
    font-size: 13px;
    min-width: 100px;
  }
  
  .bet-inline .btn {
    min-width: 80px;
    padding: 8px 10px;
    font-size: 12px;
  }
  
  .adj-btn {
    width: 28px;
    height: 32px;
    font-size: 16px;
  }
}
</style>
