<template>
  <div class="ai-monitor">
    <div class="monitor-header">
      <h2>🤖 AI 数据分析后台</h2>
      <div class="header-actions">
        <button @click="clearAIData" class="clear-btn">清除数据</button>
        <button @click="$emit('close')" class="close-btn">✕</button>
      </div>
    </div>
    
    <div class="monitor-tabs">
      <button 
        v-for="tab in tabs" 
        :key="tab.id" 
        :class="['tab-btn', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >{{ tab.name }}</button>
    </div>
    
    <div class="monitor-content">
      <!-- AI 综合胜率 -->
      <section v-if="activeTab === 'overview'" class="monitor-section">
        <h3>📊 AI 综合胜率</h3>
        <div v-if="aiStats.length === 0" class="no-data">暂无 AI 对局数据</div>
        <div v-else class="stats-grid">
          <div v-for="ai in aiStats" :key="ai.aiName" class="ai-stat-card">
            <div class="ai-name">{{ ai.aiName }}</div>
            <div class="win-rate" :class="getWinRateClass(ai.winRate)">{{ ai.winRate }}%</div>
            <div class="stat-details">
              <span>{{ ai.wins }}胜 / {{ ai.losses }}负</span>
              <span>共 {{ ai.totalGames }} 局</span>
            </div>
            <div class="chips-info">累计赢取: ¥{{ ai.totalChipsWon }}</div>
          </div>
        </div>
      </section>

      <!-- 大牌认知校准 -->
      <section v-if="activeTab === 'calibration'" class="monitor-section">
        <h3>🎴 大牌认知校准</h3>
        <p class="section-desc">AI 对各牌型的认知是否正确，系统会根据实际胜率动态调整</p>
        <div v-if="handCalibrations.length === 0" class="no-data">暂无校准数据，需要更多开牌记录</div>
        <div v-else class="calibration-grid">
          <div v-for="c in handCalibrations" :key="c.handType" class="calibration-card" :class="{ warning: !c.shouldBeStrong }">
            <div class="calibration-header">
              <span class="hand-name">{{ formatHandTypeName(c.handType) }}</span>
              <span class="calibration-status" :class="c.shouldBeStrong ? 'correct' : 'incorrect'">
                {{ c.shouldBeStrong ? '✓ 认知正确' : '⚠ 需要修正' }}
              </span>
            </div>
            <div class="calibration-stats">
              <div class="stat-row">
                <span>原始权重:</span>
                <span>{{ c.baseWeight }}</span>
              </div>
              <div class="stat-row" :class="{ adjusted: c.calibratedWeight !== c.baseWeight }">
                <span>校准权重:</span>
                <span>{{ c.calibratedWeight }}</span>
              </div>
              <div class="stat-row">
                <span>实际胜率:</span>
                <span :class="getWinRateClass(c.winRate)">{{ c.winRate }}%</span>
              </div>
              <div class="stat-row">
                <span>开牌次数:</span>
                <span>{{ c.totalShowdowns }}</span>
              </div>
            </div>
            <div v-if="c.calibrationNote" class="calibration-note">{{ c.calibrationNote }}</div>
          </div>
        </div>
      </section>

      <!-- 玩家建模 -->
      <section v-if="activeTab === 'players'" class="monitor-section">
        <h3>👤 玩家建模数据</h3>
        <div v-if="playerProfiles.length === 0" class="no-data">暂无玩家数据</div>
        <div v-else class="profiles-grid">
          <div v-for="profile in playerProfiles" :key="profile.username" class="profile-card">
            <div class="profile-header">
              <span class="profile-name">{{ profile.username }}</span>
              <span class="profile-type" :class="getPlayerType(profile)">{{ getPlayerTypeLabel(getPlayerType(profile)) }}</span>
            </div>
            
            <!-- 基础数据 -->
            <div class="profile-stats">
              <div class="stat-item"><span class="stat-label">总手数</span><span class="stat-value">{{ profile.totalHands || 0 }}</span></div>
              <div class="stat-item"><span class="stat-label">弃牌率</span><span class="stat-value">{{ getFoldRate(profile) }}%</span></div>
              <div class="stat-item"><span class="stat-label">加注率</span><span class="stat-value">{{ getRaiseRate(profile) }}%</span></div>
              <div class="stat-item"><span class="stat-label">焖牌率</span><span class="stat-value">{{ getBlindRate(profile) }}%</span></div>
              <div class="stat-item"><span class="stat-label">开牌胜率</span><span class="stat-value">{{ getShowdownWinRate(profile) }}%</span></div>
              <div class="stat-item"><span class="stat-label">诈唬被抓</span><span class="stat-value">{{ profile.bluffCaught || 0 }}</span></div>
            </div>
            
            <!-- 进阶数据 -->
            <div class="profile-advanced">
              <div class="advanced-row">
                <span>早期弃牌:</span>
                <span>{{ getEarlyFoldRate(profile) }}%</span>
              </div>
              <div class="advanced-row">
                <span>大注比例:</span>
                <span>{{ getBigRaiseRate(profile) }}%</span>
              </div>
              <div class="advanced-row">
                <span>平均下注:</span>
                <span>¥{{ Math.round(profile.avgBetSize || 0) }}</span>
              </div>
              <div class="advanced-row">
                <span>主动开牌:</span>
                <span>{{ profile.showdownInitiated || 0 }}次</span>
              </div>
              <div class="advanced-row" :class="getNetProfitClass(profile)">
                <span>总盈亏:</span>
                <span>{{ getNetProfit(profile) >= 0 ? '+' : '' }}¥{{ getNetProfit(profile) }}</span>
              </div>
            </div>
            
            <div class="profile-analysis">
              <div class="analysis-title">AI 解读:</div>
              <div class="analysis-text">{{ getAIAnalysis(profile) }}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AIMonitor',
  props: {
    playerProfiles: { type: Array, default: () => [] },
    aiStats: { type: Array, default: () => [] },
    handCalibrations: { type: Array, default: () => [] }
  },
  data() {
    return {
      activeTab: 'overview',
      tabs: [
        { id: 'overview', name: 'AI 综合胜率' },
        { id: 'calibration', name: '大牌认知校准' },
        { id: 'players', name: '玩家建模' }
      ]
    }
  },
  methods: {
    getWinRateClass(rate) {
      if (rate >= 60) return 'high'
      if (rate >= 45) return 'medium'
      return 'low'
    },
    getPlayerType(profile) {
      if (!profile || !profile.totalHands) return 'unknown'
      const foldRate = this.getFoldRate(profile)
      const raiseRate = this.getRaiseRate(profile)
      const bigRaiseRate = this.getBigRaiseRate(profile)
      const earlyFoldRate = this.getEarlyFoldRate(profile)
      const pressureWinRate = this.getPressureWinRate(profile)
      
      if (raiseRate > 40 && foldRate < 30 && bigRaiseRate > 50) return 'maniac'
      if (raiseRate > 35 || bigRaiseRate > 60) return 'aggressive'
      if (foldRate > 50 || earlyFoldRate > 70) return 'rock'
      if (raiseRate < 15 && foldRate < 30) return 'calling_station'
      if (pressureWinRate > 40) return 'pressure_player'
      return 'balanced'
    },
    getPlayerTypeLabel(type) {
      return {
        maniac: '疯狂型',
        aggressive: '激进型',
        rock: '岩石型',
        calling_station: '跟注站',
        pressure_player: '施压型',
        balanced: '均衡型',
        unknown: '未知'
      }[type] || '未知'
    },
    getFoldRate(p) { return p.totalHands ? Math.round((p.foldCount || 0) / p.totalHands * 100) : 0 },
    getRaiseRate(p) { return p.totalHands ? Math.round((p.raiseCount || 0) / p.totalHands * 100) : 0 },
    getBlindRate(p) { return p.totalHands ? Math.round((p.blindBetCount || 0) / p.totalHands * 100) : 0 },
    getShowdownWinRate(p) {
      const total = (p.showdownWins || 0) + (p.showdownLosses || 0)
      return total ? Math.round((p.showdownWins || 0) / total * 100) : 0
    },
    getEarlyFoldRate(p) {
      const totalFolds = p.foldCount || 0
      return totalFolds ? Math.round((p.earlyFoldCount || 0) / totalFolds * 100) : 0
    },
    getBigRaiseRate(p) {
      const totalRaises = p.raiseCount || 0
      return totalRaises ? Math.round((p.bigRaiseCount || 0) / totalRaises * 100) : 0
    },
    getPressureWinRate(p) {
      const wins = (p.showdownWins || 0) + (p.wonWithoutShowdown || 0)
      return wins ? Math.round((p.wonWithoutShowdown || 0) / wins * 100) : 0
    },
    getNetProfit(p) {
      return (p.totalChipsWon || 0) - (p.totalChipsLost || 0)
    },
    getNetProfitClass(p) {
      const profit = this.getNetProfit(p)
      if (profit > 0) return 'profit'
      if (profit < 0) return 'loss'
      return ''
    },
    getAIAnalysis(profile) {
      const insights = []
      const type = this.getPlayerType(profile)
      
      // 基于类型的核心解读
      if (type === 'maniac') insights.push('疯狂加注，用强牌设陷阱')
      if (type === 'aggressive') insights.push('激进风格，强牌慢打应对')
      if (type === 'rock') insights.push('容易弃牌，可频繁施压')
      if (type === 'calling_station') insights.push('跟注站，有牌就加注，别诈唬')
      if (type === 'pressure_player') insights.push('善于施压，大注时多怀疑')
      
      // 细节补充
      const bluffRate = profile.totalHands ? (profile.bluffCaught || 0) / profile.totalHands : 0
      if (bluffRate > 0.15) insights.push('诈唬被抓率高')
      
      const earlyFoldRate = this.getEarlyFoldRate(profile)
      if (earlyFoldRate > 70) insights.push('早期弃牌多，胆小')
      
      const bigRaiseRate = this.getBigRaiseRate(profile)
      if (bigRaiseRate > 60) insights.push('喜欢大注')
      
      return insights.length > 0 ? insights.join('；') : '数据不足，继续观察'
    },
    clearAIData() {
      if (confirm('确定要清除所有 AI 数据吗？')) {
        this.$emit('clear-ai-data')
      }
    },
    formatHandTypeName(type) {
      const map = {
        'leopard': '豹子',
        'straight_flush': '同花顺',
        'flush': '同花',
        'straight': '顺子',
        'pair': '对子',
        'high_card': '散牌'
      }
      return map[type] || type
    }
  }
}
</script>

<style scoped>
.ai-monitor {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  z-index: 10000;
  overflow-y: auto;
  color: white;
}
.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 30px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 215, 0, 0.2);
  position: sticky;
  top: 0;
  z-index: 10;
}
.monitor-header h2 { margin: 0; font-size: 24px; color: #ffd700; }
.header-actions { display: flex; gap: 10px; align-items: center; }
.clear-btn {
  padding: 8px 16px;
  border: 1px solid rgba(239, 68, 68, 0.5);
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
  cursor: pointer;
  font-size: 13px;
}
.clear-btn:hover { background: rgba(239, 68, 68, 0.3); }
.close-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 20px;
  cursor: pointer;
}
.close-btn:hover { background: rgba(255, 255, 255, 0.2); }
.monitor-tabs {
  display: flex;
  gap: 10px;
  padding: 15px 30px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.tab-btn {
  padding: 10px 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s;
}
.tab-btn:hover { background: rgba(255, 255, 255, 0.1); }
.tab-btn.active {
  background: rgba(255, 215, 0, 0.2);
  border-color: #ffd700;
  color: #ffd700;
}
.monitor-content { padding: 20px 30px; max-width: 1400px; margin: 0 auto; }
.monitor-section { margin-bottom: 30px; }
.monitor-section h3 {
  font-size: 18px;
  color: #ffd700;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 215, 0, 0.2);
}
.section-desc { color: rgba(255, 255, 255, 0.6); font-size: 13px; margin-bottom: 15px; }
.no-data { text-align: center; color: rgba(255, 255, 255, 0.4); padding: 40px; }

/* AI 统计卡片 */
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
.ai-stat-card {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 16px;
}
.ai-name { font-size: 16px; font-weight: bold; margin-bottom: 8px; }
.win-rate { font-size: 32px; font-weight: bold; margin-bottom: 8px; }
.win-rate.high { color: #4ade80; }
.win-rate.medium { color: #fbbf24; }
.win-rate.low { color: #f87171; }
.stat-details { font-size: 12px; color: rgba(255, 255, 255, 0.6); display: flex; justify-content: space-between; }
.chips-info { font-size: 12px; color: #ffd700; margin-top: 8px; }

/* 校准卡片 */
.calibration-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px; }
.calibration-card {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 16px;
}
.calibration-card.warning { border-color: rgba(251, 191, 36, 0.5); background: rgba(251, 191, 36, 0.1); }
.calibration-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.hand-name { font-size: 16px; font-weight: bold; }
.calibration-status { font-size: 12px; padding: 4px 10px; border-radius: 12px; }
.calibration-status.correct { background: rgba(74, 222, 128, 0.2); color: #4ade80; }
.calibration-status.incorrect { background: rgba(251, 191, 36, 0.2); color: #fbbf24; }
.calibration-stats { font-size: 13px; }
.stat-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
.stat-row.adjusted { color: #fbbf24; }
.calibration-note { margin-top: 10px; font-size: 12px; color: #a78bfa; padding: 8px; background: rgba(139, 92, 246, 0.1); border-radius: 6px; }

/* 玩家档案 */
.profiles-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 20px; }
.profile-card {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 16px;
}
.profile-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.profile-name { font-size: 16px; font-weight: bold; }
.profile-type { font-size: 12px; padding: 4px 10px; border-radius: 12px; }
.profile-type.maniac { background: rgba(239, 68, 68, 0.4); color: #fca5a5; }
.profile-type.aggressive { background: rgba(239, 68, 68, 0.3); color: #f87171; }
.profile-type.rock { background: rgba(59, 130, 246, 0.3); color: #60a5fa; }
.profile-type.calling_station { background: rgba(251, 191, 36, 0.3); color: #fbbf24; }
.profile-type.pressure_player { background: rgba(168, 85, 247, 0.3); color: #c084fc; }
.profile-type.balanced { background: rgba(74, 222, 128, 0.3); color: #4ade80; }
.profile-type.unknown { background: rgba(156, 163, 175, 0.3); color: #9ca3af; }
.profile-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
.stat-item { background: rgba(0, 0, 0, 0.2); padding: 8px; border-radius: 8px; text-align: center; }
.stat-label { display: block; font-size: 10px; color: rgba(255, 255, 255, 0.5); margin-bottom: 4px; }
.stat-value { font-size: 14px; font-weight: bold; color: #ffd700; }

/* 进阶数据 */
.profile-advanced {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 12px;
  font-size: 12px;
}
.advanced-row {
  display: flex;
  justify-content: space-between;
  padding: 3px 0;
  color: rgba(255, 255, 255, 0.7);
}
.advanced-row.profit { color: #4ade80; }
.advanced-row.loss { color: #f87171; }

.profile-analysis {
  background: rgba(139, 92, 246, 0.15);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 8px;
  padding: 10px;
}
.analysis-title { font-size: 11px; color: #a78bfa; margin-bottom: 4px; }
.analysis-text { font-size: 12px; color: rgba(255, 255, 255, 0.8); line-height: 1.5; }

@media (max-width: 768px) {
  .monitor-content { padding: 15px; }
  .stats-grid, .calibration-grid, .profiles-grid { grid-template-columns: 1fr; }
  .profile-stats { grid-template-columns: repeat(2, 1fr); }
}
</style>
