<template>
  <div class="player-card">
    <!-- 主卡片 -->
    <div class="main-info" :class="{ 'active': isCurrentTurn, 'folded': player.folded }">
      <div class="player-avatar" :class="[avatarColorClass, { 'my-avatar': isMe }]" @click="showChips = !showChips">
        {{ avatarEmoji }}
        <!-- 点击显示资产 -->
        <div v-if="showChips" class="chips-tooltip">💰 ¥{{ player.chips }}</div>
      </div>
      <div class="player-name">{{ displayName }}</div>
      <div class="player-status">
        <span v-if="player.folded" class="status folded">{{ player.lostShowdown ? '比牌输' : '已弃牌' }}</span>
        <span v-else-if="player.isAllIn" class="status allin">ALL IN</span>
        <span v-else-if="player.hasPeeked" class="status peeked">已看牌</span>
        <span v-else class="status blind">焖牌中</span>
      </div>
    </div>
    
  </div>
</template>

<script>
export default {
  name: 'PlayerComponent',
  props: {
    player: { type: Object, required: true },
    seatIndex: { type: Number, required: true },
    isMe: { type: Boolean, default: false },
    isCurrentTurn: { type: Boolean, default: false }
  },
  data() {
    return {
      showChips: false
    }
  },
  computed: {
    displayName() {
      return this.player.name?.replace(/🎮|🤖/g, '').trim() || '玩家'
    },
    avatarEmoji() {
      if (this.isMe) return '😎'
      return this.player.type === 'human' ? '🎮' : '🤖'
    },
    avatarColorClass() {
      return 'avatar-color-' + (this.seatIndex % 6)
    }
  },
  watch: {
    showChips(val) {
      if (val) {
        setTimeout(() => { this.showChips = false }, 2000)
      }
    }
  }
}
</script>

<style scoped>
.player-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.main-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
}

.main-info.active {
  border-color: rgba(255, 215, 0, 0.6);
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.4);
}

.main-info.folded {
  opacity: 0.5;
}

/* 头像 */
.player-avatar {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  border: 2px solid;
  cursor: pointer;
  transition: transform 0.2s;
}

.player-avatar:hover {
  transform: scale(1.1);
}

.avatar-color-0 { background: linear-gradient(135deg, #f472b6, #be185d); border-color: #9d174d; }
.avatar-color-1 { background: linear-gradient(135deg, #60a5fa, #1d4ed8); border-color: #1e40af; }
.avatar-color-2 { background: linear-gradient(135deg, #a78bfa, #6d28d9); border-color: #5b21b6; }
.avatar-color-3 { background: linear-gradient(135deg, #fb923c, #c2410c); border-color: #9a3412; }
.avatar-color-4 { background: linear-gradient(135deg, #4ade80, #15803d); border-color: #166534; }
.avatar-color-5 { background: linear-gradient(135deg, #f87171, #b91c1c); border-color: #991b1b; }
.my-avatar { background: linear-gradient(135deg, #22c55e, #15803d); border-color: #166534; }

/* 资产提示 */
.chips-tooltip {
  position: absolute;
  top: -30px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  color: #4ade80;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 6px;
  white-space: nowrap;
  z-index: 100;
  animation: fadeIn 0.2s ease;
}

.chips-tooltip::after {
  content: '';
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid rgba(0, 0, 0, 0.9);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateX(-50%) translateY(-5px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

/* 昵称 */
.player-name {
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  max-width: 70px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 状态 */
.player-status {
  margin-top: 2px;
}

.status {
  font-size: 9px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}

.status.blind {
  background: rgba(245, 158, 11, 0.3);
  color: #fcd34d;
}

.status.peeked {
  background: rgba(59, 130, 246, 0.3);
  color: #93c5fd;
}

.status.folded {
  background: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.status.allin {
  background: linear-gradient(135deg, #ffd700, #f59e0b);
  color: #1a202c;
}

@keyframes popIn {
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

/* 移动端 */
@media (max-width: 768px) {
  .main-info {
    padding: 6px 10px;
    gap: 3px;
  }
  
  .player-avatar {
    width: 28px;
    height: 28px;
    font-size: 14px;
  }
  
  .chips-tooltip {
    font-size: 10px;
    padding: 3px 8px;
    top: -26px;
  }
  
  .player-name {
    font-size: 9px;
    max-width: 50px;
  }
  
  .status {
    font-size: 8px;
    padding: 2px 6px;
  }
  
  .bet-popup {
    font-size: 9px;
    padding: 2px 6px;
    top: -20px;
    right: -8px;
  }
}
</style>
