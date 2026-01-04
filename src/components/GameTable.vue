<template>
  <div class="game-table-wrapper">
    <!-- 开牌手牌放大预览 -->
    <div v-if="showdownPreview && showdownPreview.cards" class="showdown-preview-overlay">
      <div class="showdown-preview">
        <div class="preview-title">{{ showdownPreview.targetName }} 的手牌</div>
        <div class="preview-cards">
          <div v-for="(card, i) in showdownPreview.cards" :key="i" class="preview-card">
            <span v-html="formatCard(card)"></span>
          </div>
        </div>
      </div>
    </div>

    <!-- 开牌结果 - 左下角显示 -->
    <div v-if="showdownResult" class="showdown-result-corner">
      <div class="showdown-title">⚔️ 开牌</div>
      <div class="showdown-players">
        <span>{{ showdownResult.challengerName }}</span>
        <span class="vs">VS</span>
        <span>{{ showdownResult.targetName }}</span>
      </div>
      <div class="showdown-hands">
        <span>{{ showdownResult.challengerHand }}</span>
        <span class="vs-small">-</span>
        <span>{{ showdownResult.targetHand }}</span>
      </div>
      <div class="showdown-winner">🏆 {{ showdownResult.winnerName }} 胜</div>
    </div>

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
          'winner-player': winner && player && player.name === winner.name,
          'my-turn-glow': player && index === mySeatIndex && currentPlayerIndex === index && gamePhase === 'betting',
          'showdown-target': showdownMode && player && index !== mySeatIndex && !player.folded
        }]"
        @click="handlePlayerClick(player, index)"
      >
        <template v-if="player">
          <div class="player-info">
            <div class="player-header">
              <div class="player-avatar" :class="{ 'my-avatar': index === mySeatIndex }">
                {{ index === mySeatIndex ? '😎' : (player.type === 'human' ? '🎮' : '🤖') }}
              </div>
              <div class="player-name">
                {{ player.name }}
              </div>
            </div>
            <div class="player-chips">¥{{ player.chips }}</div>
            <div v-if="!player.folded && gamePhase === 'betting'" class="player-mode">
              <span v-if="player.hasPeeked" class="mode-tag peeked">已看牌</span>
              <span v-else class="mode-tag blind">焖牌中</span>
            </div>
            <div v-if="!player.folded && (player.currentBet > 0 || player.lastBetAmount > 0)" class="player-bet-info">
              <div v-if="player.currentBet > 0" class="player-bet">
                本把: ¥{{ player.currentBet }}
              </div>
              <div v-if="player.lastBetAmount > 0 && gamePhase === 'betting'" class="player-bet round-bet">
                本轮: ¥{{ player.lastBetAmount }}
              </div>
            </div>
            <div v-if="player.folded" class="player-status folded">{{ player.lostShowdown ? '比牌输' : '已弃牌' }}</div>
            <div v-else-if="player.isAllIn" class="player-status allin">ALL IN</div>
          </div>
          
          <!-- 手牌 -->
          <div class="player-cards" v-if="player.cardCount > 0 || (player.cards && player.cards.length)"
               :class="{ 
                 'showdown-target-cards': isShowdownTarget(player, index),
                 'showdown-revealed': player.folded && player.cards && player.cards.length > 0
               }"
               @click="handleCardsClick(player, index)">
            <div
              v-for="i in 3"
              :key="i"
              :class="['game-card', { 
                'card-back': !showCard(player, i - 1),
                'card-clickable': canClickCard(player),
                'card-deal-anim': gamePhase === 'dealing',
                'card-shake': isShowdownTarget(player, index)
              }]"
              :style="{ animationDelay: getCardDelay(index, i - 1) + 's' }"
              @click.stop="handleCardClick(player)"
            >
              <span v-if="showCard(player, i - 1) && player.cards" v-html="formatCard(player.cards[i - 1])"></span>
            </div>
          </div>

          <!-- 下注动画筹码 -->
          <div v-if="player.lastBetAmount > 0 && gamePhase === 'betting'" class="bet-chip-anim">
            💰
          </div>
          
          <!-- 聊天气泡 -->
          <div v-if="getPlayerMessage(index)" class="chat-bubble">
            {{ getPlayerMessage(index) }}
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
  </div>
</template>

<script>
export default {
  name: 'GameTable',
  props: ['allSeats', 'currentPlayerIndex', 'pot', 'gamePhase', 'winner', 'gameStatus', 'mySeatIndex', 'isLoading', 'loadingText', 'showdownResult', 'showdownMode', 'showdownPreview', 'chatMessages'],
  emits: ['card-click', 'player-click'],
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
    // 开牌预览的玩家
    previewPlayer() {
      if (this.showdownPreview && this.showdownPreview.targetSeatIndex !== undefined) {
        return this.allSeats[this.showdownPreview.targetSeatIndex]
      }
      return null
    },
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
      // 弃牌玩家：如果有牌数据（被开牌输了），显示给开牌者看
      if (player.folded && player.cards && player.cards.length > index) {
        return true
      }
      if (player.folded) return false
      // 自己看过牌后可以看自己的牌
      if (player.id === this.mySeatIndex && player.hasPeeked) {
        return player.cards && player.cards.length > index
      }
      // 开牌/结束阶段：只显示有牌数据的玩家（服务端只发送开牌双方的牌）
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
    handleCardsClick(player, index) {
      // 开牌模式下点击对手手牌
      if (this.isShowdownTarget(player, index)) {
        this.$emit('player-click', index)
      }
    },
    handlePlayerClick(player, index) {
      // 开牌模式下点击对手（保留兼容）
      if (this.showdownMode && player && index !== this.mySeatIndex && !player.folded) {
        this.$emit('player-click', index)
      }
    },
    isShowdownTarget(player, index) {
      return this.showdownMode && player && index !== this.mySeatIndex && !player.folded
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
    },
    getPlayerMessage(seatIndex) {
      if (!this.chatMessages) return null
      const msg = this.chatMessages.find(m => m.seatIndex === seatIndex)
      return msg ? msg.message : null
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
  border-radius: var(--radius-lg);
}

.me-badge {
  font-size: 8px;
  background: #22c55e;
  color: white;
  padding: 2px 5px;
  border-radius: var(--radius-lg);
  margin-left: 4px;
  font-size: 9px;
  font-weight: 600;
}

.player-mode {
  margin-top: -4px;
  margin-bottom: 1px;
}

.mode-tag {
  font-size: 8px;
  padding: 2px 6px;
  border-radius: var(--radius-lg);
  font-weight: 600;
  letter-spacing: 0.2px;
  display: inline-block;
  line-height: 1;
}

.mode-tag.peeked {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(37, 99, 235, 0.35) 100%);
  color: #93c5fd;
  border: 1px solid rgba(59, 130, 246, 0.3);
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.15);
}

.mode-tag.blind {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(217, 119, 6, 0.35) 100%);
  color: #fcd34d;
  border: 1px solid rgba(245, 158, 11, 0.3);
  box-shadow: 0 2px 4px rgba(245, 158, 11, 0.15);
}

.peeked-badge {
  font-size: 10px;
  margin-left: 2px;
}

.blind-mark {
  font-size: 9px;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: white;
  padding: 2px 4px;
  border-radius: var(--radius-lg);
  margin-left: 3px;
}

.my-avatar {
  background: radial-gradient(ellipse at 30% 30%, #22c55e 0%, #16a34a 50%, #15803d 100%) !important;
  border-color: #15803d !important;
}

/* 轮到我时头像发光 */
.my-turn-glow .player-avatar {
  box-shadow: 
    0 4px 12px rgba(0, 0, 0, 0.4),
    0 0 15px rgba(255, 215, 0, 0.5),
    0 0 30px rgba(255, 215, 0, 0.25) !important;
  border-color: rgba(255, 215, 0, 0.6) !important;
  animation: myTurnGlow 2s ease-in-out infinite;
}

.player-status {
  font-size: 9px;
  padding: 3px 8px;
  border-radius: var(--radius-lg);
  margin-top: 4px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.player-status.folded {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(220, 38, 38, 0.35) 100%);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.player-status.allin {
  background: linear-gradient(135deg, #ffd700 0%, #ffed4e 50%, #f59e0b 100%);
  color: #1a202c;
  border: 1px solid #b8860b;
  box-shadow: 0 2px 8px rgba(255, 215, 0, 0.4);
  animation: allinPulse 1.5s ease-in-out infinite;
}

@keyframes allinPulse {
  0%, 100% { box-shadow: 0 2px 8px rgba(255, 215, 0, 0.4); }
  50% { box-shadow: 0 2px 16px rgba(255, 215, 0, 0.7); }
}

.card-clickable {
  cursor: pointer;
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
.player-bet-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  align-items: center;
  margin-top: 1px;
}

.round-bet {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.25) 0%, rgba(22, 163, 74, 0.35) 100%) !important;
  color: #4ade80 !important;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

/* 开牌结果显示 - 左下角 */
.game-table-wrapper {
  position: relative;
}

.showdown-result-corner {
  position: fixed !important;
  left: 12px !important;
  bottom: 200px !important;
  background: linear-gradient(145deg, rgba(139, 92, 246, 0.96) 0%, rgba(109, 40, 217, 0.94) 50%, rgba(91, 33, 182, 0.92) 100%) !important;
  border: 1px solid rgba(167, 139, 250, 0.5) !important;
  border-radius: 14px !important;
  padding: 14px 18px !important;
  z-index: 9999 !important;
  animation: showdownSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 
    0 8px 32px rgba(139, 92, 246, 0.4),
    0 4px 16px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
}

@keyframes showdownSlideIn {
  0% { transform: translateX(-120%); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}

.showdown-result-corner .showdown-title {
  font-size: 13px;
  font-weight: bold;
  color: #ffd700;
  margin-bottom: 8px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.showdown-result-corner .showdown-players {
  font-size: 12px;
  color: white;
  margin-bottom: 4px;
  font-weight: 500;
}

.showdown-result-corner .showdown-players .vs {
  color: #fbbf24;
  margin: 0 6px;
  font-weight: bold;
}

.showdown-result-corner .showdown-hands {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.85);
  margin-bottom: 8px;
}

.showdown-result-corner .showdown-hands .vs-small {
  margin: 0 4px;
  color: rgba(255, 255, 255, 0.5);
}

.showdown-result-corner .showdown-winner {
  font-size: 12px;
  font-weight: bold;
  color: #4ade80;
  background: rgba(0, 0, 0, 0.35);
  padding: 5px 12px;
  border-radius: 8px;
  text-align: center;
  border: 1px solid rgba(74, 222, 128, 0.3);
}

/* 轮到我时手牌发光 */
.my-turn-glow .player-cards .game-card {
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.5), 0 0 30px rgba(255, 215, 0, 0.25) !important;
  border-color: rgba(255, 215, 0, 0.6) !important;
  animation: myTurnGlow 2s ease-in-out infinite;
}

@keyframes myTurnGlow {
  0%, 100% { box-shadow: 0 0 15px rgba(255, 215, 0, 0.5), 0 0 30px rgba(255, 215, 0, 0.25); }
  50% { box-shadow: 0 0 25px rgba(255, 215, 0, 0.7), 0 0 50px rgba(255, 215, 0, 0.4); }
}

/* 开牌模式下对手高亮 */
.showdown-target {
  cursor: pointer;
}

.showdown-target .player-info {
  border-color: #ef4444 !important;
  box-shadow: 0 0 15px rgba(239, 68, 68, 0.6), 0 0 30px rgba(239, 68, 68, 0.3) !important;
  animation: showdownTargetGlow 1s ease-in-out infinite;
}

@keyframes showdownTargetGlow {
  0%, 100% { box-shadow: 0 0 15px rgba(239, 68, 68, 0.6), 0 0 30px rgba(239, 68, 68, 0.3); }
  50% { box-shadow: 0 0 22px rgba(239, 68, 68, 0.8), 0 0 44px rgba(239, 68, 68, 0.5); }
}

/* 开牌模式下对手手牌晃动 */
.showdown-target-cards {
  cursor: pointer;
}

.card-shake {
  animation: cardShake 0.5s ease-in-out infinite !important;
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.6) !important;
}

@keyframes cardShake {
  0%, 100% { transform: rotate(-3deg); }
  50% { transform: rotate(3deg); }
}

/* 开牌手牌放大预览 */
.showdown-preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.showdown-preview {
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.99) 100%);
  border: 2px solid rgba(239, 68, 68, 0.5);
  border-radius: 20px;
  padding: 24px 36px;
  text-align: center;
  animation: previewZoom 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 
    0 20px 60px rgba(0, 0, 0, 0.6),
    0 0 40px rgba(239, 68, 68, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

@keyframes previewZoom {
  from { transform: scale(0.6); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.preview-title {
  font-size: 18px;
  color: #ffd700;
  margin-bottom: 20px;
  font-weight: bold;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.preview-cards {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.preview-card {
  width: 70px;
  height: 98px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: bold;
  box-shadow: 
    0 8px 24px rgba(0, 0, 0, 0.4),
    inset 0 2px 0 rgba(255, 255, 255, 0.8),
    inset 0 -2px 4px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.1);
  animation: cardReveal 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
}

.preview-card:nth-child(1) { animation-delay: 0.15s; }
.preview-card:nth-child(2) { animation-delay: 0.25s; }
.preview-card:nth-child(3) { animation-delay: 0.35s; }

@keyframes cardReveal {
  from { transform: rotateY(90deg); }
  to { transform: rotateY(0); }
}

/* 卡牌花色颜色 - 使用深度选择器穿透v-html */
:deep(.card-red) {
  color: #dc2626 !important;
}

:deep(.card-black) {
  color: #1a1a1a !important;
}

/* 聊天气泡 - 基础样式 */
.chat-bubble {
  position: absolute;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%);
  color: #1e293b;
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 
    0 4px 12px rgba(0, 0, 0, 0.15),
    0 2px 4px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(0, 0, 0, 0.08);
  animation: chatBubbleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 100;
}

/* 底部玩家(0,1,2,3) - 气泡显示在上方 */
.seat-0 .chat-bubble,
.seat-1 .chat-bubble,
.seat-2 .chat-bubble,
.seat-3 .chat-bubble {
  top: -45px;
  left: 50%;
  transform: translateX(-50%);
}

.seat-0 .chat-bubble::after,
.seat-1 .chat-bubble::after,
.seat-2 .chat-bubble::after,
.seat-3 .chat-bubble::after {
  content: '';
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid rgba(255, 255, 255, 0.95);
}

/* 右侧玩家(4,5) - 气泡显示在左边 */
.seat-4 .chat-bubble,
.seat-5 .chat-bubble {
  top: 50%;
  right: calc(100% + 10px);
  left: auto;
  transform: translateY(-50%);
}

.seat-4 .chat-bubble::after,
.seat-5 .chat-bubble::after {
  content: '';
  position: absolute;
  top: 50%;
  right: -6px;
  left: auto;
  bottom: auto;
  transform: translateY(-50%);
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-left: 6px solid rgba(255, 255, 255, 0.95);
}

/* 左侧玩家(6,7) - 气泡显示在右边 */
.seat-6 .chat-bubble,
.seat-7 .chat-bubble {
  top: 50%;
  left: calc(100% + 10px);
  right: auto;
  transform: translateY(-50%);
}

.seat-6 .chat-bubble::after,
.seat-7 .chat-bubble::after {
  content: '';
  position: absolute;
  top: 50%;
  left: -6px;
  right: auto;
  bottom: auto;
  transform: translateY(-50%);
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-right: 6px solid rgba(255, 255, 255, 0.95);
}

/* ===== 居中布局（4人及以下）===== */
/* 座位5变成顶部 - 气泡显示在下方 */
.players-area.centered-layout .seat-5 .chat-bubble {
  top: auto;
  bottom: -45px;
  left: 50%;
  right: auto;
  transform: translateX(-50%);
}

.players-area.centered-layout .seat-5 .chat-bubble::after {
  top: -6px;
  bottom: auto;
  left: 50%;
  right: auto;
  transform: translateX(-50%);
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: none;
  border-bottom: 6px solid rgba(255, 255, 255, 0.95);
}

/* 座位2变成右侧 - 气泡显示在左边 */
.players-area.centered-layout .seat-2 .chat-bubble {
  top: 50%;
  bottom: auto;
  left: auto;
  right: calc(100% + 10px);
  transform: translateY(-50%);
}

.players-area.centered-layout .seat-2 .chat-bubble::after {
  top: 50%;
  bottom: auto;
  left: auto;
  right: -6px;
  transform: translateY(-50%);
  border-left: 6px solid rgba(255, 255, 255, 0.95);
  border-right: none;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
}

@keyframes chatBubbleIn {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(10px) scale(0.8);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

/* 左右玩家气泡动画 */
.seat-4 .chat-bubble,
.seat-5 .chat-bubble {
  animation: chatBubbleInRight 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.seat-6 .chat-bubble,
.seat-7 .chat-bubble {
  animation: chatBubbleInLeft 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* 居中布局动画覆盖 */
.players-area.centered-layout .seat-5 .chat-bubble {
  animation: chatBubbleInBottom 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.players-area.centered-layout .seat-2 .chat-bubble {
  animation: chatBubbleInRight 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes chatBubbleInRight {
  0% {
    opacity: 0;
    transform: translateY(-50%) translateX(10px) scale(0.8);
  }
  100% {
    opacity: 1;
    transform: translateY(-50%) translateX(0) scale(1);
  }
}

@keyframes chatBubbleInLeft {
  0% {
    opacity: 0;
    transform: translateY(-50%) translateX(-10px) scale(0.8);
  }
  100% {
    opacity: 1;
    transform: translateY(-50%) translateX(0) scale(1);
  }
}

@keyframes chatBubbleInBottom {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(-10px) scale(0.8);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}
</style>
