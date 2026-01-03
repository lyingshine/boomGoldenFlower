<template>
  <div class="player" :class="{ 'current-player': isCurrent }">
    <!-- 玩家头像 -->
    <div class="player-avatar">
      {{ getPlayerEmoji() }}
    </div>
    
    <div class="player-name">{{ player.name.replace(/🎮|🤖/g, '').trim() }}</div>
    <div class="player-chips">¥{{ player.chips }}</div>
    
    <div v-if="player.currentBet > 0" class="current-bet">
      下注: ¥{{ player.currentBet }}
    </div>
  </div>
</template>

<script>
export default {
  name: 'PlayerComponent',
  props: {
    player: {
      type: Object,
      required: true
    },
    isCurrent: {
      type: Boolean,
      default: false
    },
    playerPosition: {
      type: Number,
      default: 0
    }
  },
  methods: {
    getPlayerEmoji() {
      if (this.player.type === 'human') {
        return '🎮'
      } else {
        const emojis = ['🤖', '👨', '👩', '🧑']
        return emojis[this.playerPosition % emojis.length]
      }
    }
  }
}
</script>

<style scoped>
.current-bet {
  font-size: 11px;
  color: var(--gold);
  margin-top: 6px;
  font-weight: var(--font-bold);
  background: 
    linear-gradient(135deg, 
      rgba(255, 215, 0, 0.2) 0%,
      rgba(255, 215, 0, 0.1) 100%
    );
  padding: 4px 8px;
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 215, 0, 0.3);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  box-shadow: 
    0 2px 4px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  text-align: center;
  position: relative;
  z-index: 2;
}

.player-status {
  font-size: 11px;
  color: var(--orange);
  margin-top: 6px;
  font-weight: var(--font-bold);
  padding: 4px 8px;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  box-shadow: 
    0 2px 4px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  text-align: center;
  position: relative;
  z-index: 2;
}

.player-status.all-in {
  color: var(--gold);
  background: 
    linear-gradient(135deg, 
      rgba(255, 215, 0, 0.3) 0%,
      rgba(255, 215, 0, 0.1) 100%
    );
  border-color: rgba(255, 215, 0, 0.4);
}
</style>