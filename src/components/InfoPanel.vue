<template>
  <div class="info-panel">
    <button class="panel-toggle" @click="togglePanel">
      {{ isOpen ? '✕' : 'ℹ️' }}
    </button>
    
    <div class="panel-content" v-show="isOpen">
      <div class="panel-header">
        <h3>游戏信息</h3>
      </div>
      
      <div class="panel-body">
        <div class="stats-section">
          <h4>📊 游戏统计</h4>
          <div class="stat-item">
            <span>当前轮次:</span>
            <span>{{ gameStats.round }}</span>
          </div>
          <div class="stat-item">
            <span>总底池:</span>
            <span>¥{{ gameStats.totalPot }}</span>
          </div>
          <div class="stat-item">
            <span>活跃玩家:</span>
            <span>{{ gameStats.activePlayers }}</span>
          </div>
        </div>
        
        <div class="rules-section">
          <h4>🃏 牌型大小</h4>
          <div class="hand-type-item">🐆 豹子 - 三张相同</div>
          <div class="hand-type-item">🌟 同花顺 - 同花连续</div>
          <div class="hand-type-item">🌈 同花 - 同花色</div>
          <div class="hand-type-item">📈 顺子 - 连续数字</div>
          <div class="hand-type-item">👥 对子 - 两张相同</div>
          <div class="hand-type-item">🎯 高牌 - 单张最大</div>
        </div>
        
        <div class="tips-section">
          <h4>💡 操作提示</h4>
          <div class="tip-item">👁️ 点击牌背可以看牌</div>
          <div class="tip-item">🤝 跟注跟上当前下注</div>
          <div class="tip-item">📈 加注增加下注金额</div>
          <div class="tip-item">🚫 弃牌退出本轮</div>
          <div class="tip-item">🃏 开牌比较牌型</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'InfoPanel',
  props: {
    gameStats: {
      type: Object,
      default: () => ({
        round: 0,
        totalPot: 0,
        activePlayers: 0
      })
    }
  },
  data() {
    return {
      isOpen: false
    }
  },
  methods: {
    togglePanel() {
      this.isOpen = !this.isOpen
      this.$emit('panelToggled', this.isOpen)
    }
  }
}
</script>

<style scoped>
.info-panel {
  position: fixed;
  top: 20px;
  left: 20px;
  z-index: 1000;
}

.panel-toggle {
  width: 50px;
  height: 50px;
  border: none;
  border-radius: 50%;
  background: rgba(0,0,0,0.7);
  color: white;
  font-size: 1.2rem;
  cursor: pointer;
}

.panel-toggle:hover {
  background: rgba(0,0,0,0.8);
}

.panel-content {
  position: absolute;
  top: 60px;
  left: 0;
  width: 300px;
  background: rgba(0,0,0,0.9);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}

.panel-header {
  padding: 20px;
  border-bottom: 1px solid rgba(255,255,255,0.2);
}

.panel-header h3 {
  margin: 0;
  color: white;
}

.panel-body {
  padding: 20px;
  max-height: 400px;
  overflow-y: auto;
}

.stats-section,
.rules-section,
.tips-section {
  margin-bottom: 20px;
}

.stats-section h4,
.rules-section h4,
.tips-section h4 {
  margin: 0 0 15px 0;
  color: rgba(255, 255, 255, 0.9);
}

.stat-item {
  display: flex;
  justify-content: space-between;
  padding: 5px 0;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
}

.hand-type-item,
.tip-item {
  padding: 5px 0;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
}
</style>