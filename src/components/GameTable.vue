<template>
  <div class="new-game-table" :class="{ 
    'showdown-phase': gamePhase === 'showdown' || gamePhase === 'ended',
    'betting-phase': gamePhase === 'betting'
  }">
    <!-- 中央信息区 -->
    <div class="center-info">
      <div v-if="gamePhase === 'waiting'" class="pot-display waiting">
        <div class="waiting-icon">🎴</div>
        <div class="game-status-text">等待开始游戏</div>
        <div class="waiting-hint">房主点击"发牌"开始</div>
      </div>
      
      <div v-else-if="winner" class="pot-display winner-info">
        <div class="winner-crown">👑</div>
        <div class="winner-text">{{ winner.name }} 获胜！</div>
        <div class="winner-amount">赢得 ¥{{ pot }}</div>
        <div v-if="winner.handType" class="winner-hand">{{ formatHandType(winner.handType) }}</div>
      </div>
      
      <div v-else class="pot-display">
        <span class="pot-label">💎 底池</span>
        <span class="pot-value">¥{{ displayPot }}</span>
        <div class="game-status-text">
          <span class="status-icon">{{ getStatusIcon() }}</span>
          {{ gameStatus }}
        </div>
        <div v-if="currentPlayerName" class="current-turn">
          轮到: <strong>{{ currentPlayerName }}</strong>
        </div>
      </div>
    </div>

    <!-- 玩家座位 - 只显示有玩家的座位 -->
    <div class="players-area" :class="{ 'centered-layout': playerCount <= 4 }">
      <div
        v-for="(player, index) in allSeats"
        :key="index"
        v-show="player"
        :class="['player-seat', `seat-${index}`, {
          'active-player': player && currentPlayerIndex === index,
          'folded-player': player && player.folded,
          'human-player': player && index === mySeatIndex,
          'winner-player': winner && player && player.name === winner.name
        }]"
      >
        <template v-if="player">
          <div class="player-info">
            <div class="player-avatar" :class="{ 'my-avatar': index === mySeatIndex }">
              {{ index === mySeatIndex ? '😎' : (player.type === 'human' ? '🎮' : '🤖') }}
            </div>
            <div class="player-name">
              {{ player.name }}
              <span v-if="index === mySeatIndex" class="me-badge">我</span>
              <span v-if="!player.folded && player.hasPeeked && gamePhase === 'betting'" class="peeked-badge">👁️</span>
            </div>
            <div class="player-chips">¥{{ player.chips }}</div>
            <div v-if="!player.folded && player.currentBet > 0" class="player-bet">
              本把: ¥{{ player.currentBet }}
            </div>
            <div v-if="!player.folded && player.lastBetAmount > 0 && gamePhase === 'betting'" class="player-bet round-bet">
              本轮: ¥{{ player.lastBetAmount }}<span v-if="player.lastBetBlind" class="blind-mark">焖</span>
            </div>
            <div v-if="player.folded" class="player-status folded">已弃牌</div>
            <div v-else-if="player.isAllIn" class="player-status allin">ALL IN</div>
          </div>
          
          <!-- 手牌 -->
          <div class="player-cards" v-if="player.cardCount > 0 || (player.cards && player.cards.length)">
            <div
              v-for="i in 3"
              :key="i"
              :class="['game-card', { 
                'card-back': !showCard(player, i - 1),
                'card-clickable': canClickCard(player),
                'card-deal-anim': gamePhase === 'dealing'
              }]"
              :style="{ animationDelay: getCardDelay(index, i - 1) + 's' }"
              @click="handleCardClick(player)"
            >
              <span v-if="showCard(player, i - 1) && player.cards" v-html="formatCard(player.cards[i - 1])"></span>
            </div>
          </div>

          <!-- 下注动画筹码 -->
          <div v-if="player.lastBetAmount > 0 && gamePhase === 'betting'" class="bet-chip-anim">
            💰
          </div>
        </template>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-display">
      <div class="loading-icon">🎴</div>
      <div class="loading-message">{{ loadingText }}</div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'GameTable',
  props: ['allSeats', 'currentPlayerIndex', 'pot', 'gamePhase', 'winner', 'gameStatus', 'mySeatIndex', 'isLoading', 'loadingText'],
  emits: ['card-click'],
  data() {
    return {
      displayPot: 0,
      potAnimating: false
    }
  },
  watch: {
    pot(newVal, oldVal) {
      if (newVal !== oldVal) {
        this.animatePot(oldVal, newVal)
      }
    }
  },
  mounted() {
    this.displayPot = this.pot
  },
  computed: {
    // 玩家数量
    playerCount() {
      return this.allSeats.filter(p => p).length
    },
    // 座位映射：≤4人时居中显示
    seatMapping() {
      if (this.playerCount <= 4) {
        // 4人及以下：映射到上下左右4个居中位置
        // 原座位 0,5,6,2 -> 显示位置 0,5,6,2（保持不变，这4个就是居中位置）
        return { 0: 0, 5: 5, 6: 6, 2: 2, 1: 1, 4: 4, 7: 7, 3: 3 }
      }
      return null // 不需要映射
    },
    currentPlayerName() {
      if (this.gamePhase !== 'betting') return null
      const player = this.allSeats[this.currentPlayerIndex]
      return player ? player.name : null
    },
    // 获取活跃玩家的座位索引列表（逆时针顺序）
    activePlayerIndices() {
      const indices = []
      for (let i = 0; i < 8; i++) {
        if (this.allSeats[i]) {
          indices.push(i)
        }
      }
      return indices
    }
  },
  methods: {
    // 计算发牌延迟：第1轮给所有人发第1张，第2轮发第2张，第3轮发第3张
    getCardDelay(seatIndex, cardIndex) {
      const playerOrder = this.activePlayerIndices.indexOf(seatIndex)
      if (playerOrder === -1) return 0
      
      const playerCount = this.activePlayerIndices.length
      // 每张牌间隔0.3秒
      const totalOrder = cardIndex * playerCount + playerOrder
      return totalOrder * 0.3
    },
    animatePot(from, to) {
      const duration = 800
      const startTime = Date.now()
      const diff = to - from
      
      const animate = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)
        // easeOutQuad
        const eased = 1 - (1 - progress) * (1 - progress)
        this.displayPot = Math.round(from + diff * eased)
        
        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          this.displayPot = to
        }
      }
      
      requestAnimationFrame(animate)
    },
    showCard(player, index) {
      if (!player) return false
      if (player.id === this.mySeatIndex && player.hasPeeked) {
        return player.cards && player.cards.length > index
      }
      if (this.gamePhase === 'showdown' || this.gamePhase === 'ended') {
        return player.cards && player.cards.length > index
      }
      return false
    },
    formatCard(card) {
      if (!card) return ''
      const isRed = card.suit === '♥' || card.suit === '♦'
      return `<span class="card-${isRed ? 'red' : 'black'}">${card.rank}${card.suit}</span>`
    },
    canClickCard(player) {
      return player && 
             player.id === this.mySeatIndex && 
             !player.hasPeeked && 
             this.gamePhase === 'betting' &&
             !player.folded
    },
    handleCardClick(player) {
      if (this.canClickCard(player)) {
        this.$emit('card-click', player)
      }
    },
    getStatusIcon() {
      switch (this.gamePhase) {
        case 'dealing': return '🎴'
        case 'betting': return '💰'
        case 'showdown': return '🃏'
        case 'ended': return '🏆'
        default: return '⏳'
      }
    },
    formatHandType(handType) {
      if (!handType) return ''
      if (typeof handType === 'string') return handType
      const typeMap = {
        'leopard': '豹子',
        'straight_flush': '同花顺',
        'flush': '同花',
        'straight': '顺子',
        'pair': '对子',
        'high_card': '散牌'
      }
      return typeMap[handType.type] || handType.type || ''
    }
  }
}
</script>

<style scoped>
.waiting-icon {
  font-size: 32px;
  margin-bottom: 8px;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.8; }
}

.waiting-hint {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 6px;
}

.winner-crown {
  font-size: 36px;
  margin-bottom: 6px;
  animation: bounce 0.5s ease-out;
}

@keyframes bounce {
  0% { transform: scale(0); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

.winner-hand {
  font-size: 13px;
  color: #7c2d12;
  margin-top: 6px;
  font-weight: 600;
}

.status-icon {
  margin-right: 3px;
}

.current-turn {
  font-size: 10px;
  color: #ffd700;
  margin-top: 5px;
  padding: 3px 8px;
  background: rgba(255, 215, 0, 0.15);
  border-radius: 5px;
}

.me-badge {
  font-size: 8px;
  background: #22c55e;
  color: white;
  padding: 1px 4px;
  border-radius: 3px;
  margin-left: 3px;
}

.peeked-badge {
  font-size: 10px;
  margin-left: 2px;
}

.blind-mark {
  font-size: 9px;
  background: #f59e0b;
  color: white;
  padding: 1px 3px;
  border-radius: 2px;
  margin-left: 3px;
}

.my-avatar {
  background: radial-gradient(ellipse at 30% 30%, #22c55e 0%, #16a34a 50%, #15803d 100%) !important;
  border-color: #15803d !important;
  box-shadow: 0 0 12px rgba(34, 197, 94, 0.5) !important;
}

.player-status {
  font-size: 8px;
  padding: 2px 5px;
  border-radius: 3px;
  margin-top: 3px;
  font-weight: 600;
}

.player-status.folded {
  background: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.player-status.allin {
  background: linear-gradient(135deg, #ffd700, #ffed4e);
  color: #2d3748;
}

.card-clickable {
  cursor: pointer;
  animation: glow 1.5s ease-in-out infinite;
}

@keyframes glow {
  0%, 100% { box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4); }
  50% { box-shadow: 0 2px 12px rgba(255, 215, 0, 0.5); }
}

.peek-hint {
  position: absolute;
  bottom: -18px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 9px;
  color: #ffd700;
  white-space: nowrap;
  animation: fadeInOut 2s ease-in-out infinite;
}

@keyframes fadeInOut {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.winner-player .player-info {
  border-color: #ffd700 !important;
  box-shadow: 0 0 18px rgba(255, 215, 0, 0.5) !important;
}

.active-player .player-info {
  animation: activePulse 1.5s ease-in-out infinite;
}

@keyframes activePulse {
  0%, 100% { box-shadow: 0 0 12px rgba(255, 215, 0, 0.4); }
  50% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.7); }
}

/* 发牌动画 - 从中间发出 */
.card-deal-anim {
  animation: dealCard 0.25s ease-out forwards;
  opacity: 0; /* 初始隐藏，动画开始后显示 */
}

/* 座位0-3 底部玩家 - 牌从上方中间飞来 */
.seat-0 .card-deal-anim,
.seat-1 .card-deal-anim,
.seat-2 .card-deal-anim,
.seat-3 .card-deal-anim {
  animation-name: dealCardFromTop;
}

@keyframes dealCardFromTop {
  0% {
    transform: translate(0, -150px) rotate(10deg) scale(0.5);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  100% {
    transform: translate(0, 0) rotate(0deg) scale(1);
    opacity: 1;
  }
}

/* 座位4-5 右侧玩家 - 牌从左边中间飞来 */
.seat-4 .card-deal-anim,
.seat-5 .card-deal-anim {
  animation-name: dealCardFromLeft;
}

@keyframes dealCardFromLeft {
  0% {
    transform: translate(-150px, 0) rotate(-10deg) scale(0.5);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  100% {
    transform: translate(0, 0) rotate(0deg) scale(1);
    opacity: 1;
  }
}

/* 座位6-7 左侧玩家 - 牌从右边中间飞来 */
.seat-6 .card-deal-anim,
.seat-7 .card-deal-anim {
  animation-name: dealCardFromRight;
}

@keyframes dealCardFromRight {
  0% {
    transform: translate(150px, 0) rotate(10deg) scale(0.5);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  100% {
    transform: translate(0, 0) rotate(0deg) scale(1);
    opacity: 1;
  }
}

/* 下注筹码动画 - 飞向底池 */
.bet-chip-anim {
  position: absolute;
  font-size: 20px;
  animation: chipToPot 1s ease-out forwards;
  pointer-events: none;
  z-index: 100;
}

/* 底部玩家筹码往上飞 */
.seat-0 .bet-chip-anim,
.seat-1 .bet-chip-anim,
.seat-2 .bet-chip-anim,
.seat-3 .bet-chip-anim {
  animation-name: chipToTop;
  top: -20px;
}

@keyframes chipToTop {
  0% {
    transform: scale(1.2) translateY(0);
    opacity: 1;
  }
  70% {
    opacity: 1;
  }
  100% {
    transform: scale(0.6) translateY(-120px);
    opacity: 0;
  }
}

/* 右侧玩家筹码往左飞 */
.seat-4 .bet-chip-anim,
.seat-5 .bet-chip-anim {
  animation-name: chipToLeft;
  left: -20px;
}

@keyframes chipToLeft {
  0% {
    transform: scale(1.2) translateX(0);
    opacity: 1;
  }
  70% {
    opacity: 1;
  }
  100% {
    transform: scale(0.6) translateX(-120px);
    opacity: 0;
  }
}

/* 左侧玩家筹码往右飞 */
.seat-6 .bet-chip-anim,
.seat-7 .bet-chip-anim {
  animation-name: chipToRight;
  right: -20px;
}

@keyframes chipToRight {
  0% {
    transform: scale(1.2) translateX(0);
    opacity: 1;
  }
  70% {
    opacity: 1;
  }
  100% {
    transform: scale(0.6) translateX(120px);
    opacity: 0;
  }
}

/* 本轮下注高亮 */
.round-bet {
  background: rgba(34, 197, 94, 0.3) !important;
  color: #4ade80 !important;
}
</style>
