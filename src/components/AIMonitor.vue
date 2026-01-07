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

      <!-- 策略与认知 -->
      <section v-if="activeTab === 'strategy'" class="monitor-section">
        <!-- 策略自修正 -->
        <div class="subsection">
          <h3>🔧 策略自修正参数</h3>
          <p class="section-desc">AI 根据实战表现自动调整的策略参数</p>
          
          <!-- 全局调整（牌力阈值） -->
          <div class="adjustment-group">
            <h4>🎯 牌力阈值调整（全局共享）</h4>
            <div v-if="!globalAdjustments" class="no-data">暂无调整数据</div>
            <div v-else class="adjustments-grid">
              <div class="adjustment-card">
                <div class="adj-label">怪兽牌阈值</div>
                <div class="adj-value" :class="getAdjustClass(globalAdjustments.monsterThresholdAdjust)">
                  {{ formatAdjust(globalAdjustments.monsterThresholdAdjust) }}
                </div>
                <div class="adj-desc">{{ getThresholdDesc(globalAdjustments.monsterThresholdAdjust) }}</div>
              </div>
              <div class="adjustment-card">
                <div class="adj-label">强牌阈值</div>
                <div class="adj-value" :class="getAdjustClass(globalAdjustments.strongThresholdAdjust)">
                  {{ formatAdjust(globalAdjustments.strongThresholdAdjust) }}
                </div>
                <div class="adj-desc">{{ getThresholdDesc(globalAdjustments.strongThresholdAdjust) }}</div>
              </div>
              <div class="adjustment-card">
                <div class="adj-label">中等牌阈值</div>
                <div class="adj-value" :class="getAdjustClass(globalAdjustments.mediumThresholdAdjust)">
                  {{ formatAdjust(globalAdjustments.mediumThresholdAdjust) }}
                </div>
                <div class="adj-desc">{{ getThresholdDesc(globalAdjustments.mediumThresholdAdjust) }}</div>
              </div>
              <div class="adjustment-card">
                <div class="adj-label">弱牌阈值</div>
                <div class="adj-value" :class="getAdjustClass(globalAdjustments.weakThresholdAdjust)">
                  {{ formatAdjust(globalAdjustments.weakThresholdAdjust) }}
                </div>
                <div class="adj-desc">{{ getThresholdDesc(globalAdjustments.weakThresholdAdjust) }}</div>
              </div>
            </div>
          </div>

          <!-- 全局调整（其他） -->
          <div class="adjustment-group" v-if="globalAdjustments">
            <h4>📈 通用策略调整（全局共享）</h4>
            <div class="adjustments-grid">
              <div class="adjustment-card">
                <div class="adj-label">弃牌倾向</div>
                <div class="adj-value" :class="getAdjustClass(globalAdjustments.foldAdjust)">
                  {{ formatPercent(globalAdjustments.foldAdjust) }}
                </div>
              </div>
              <div class="adjustment-card">
                <div class="adj-label">开牌倾向</div>
                <div class="adj-value" :class="getAdjustClass(globalAdjustments.showdownAdjust)">
                  {{ formatPercent(globalAdjustments.showdownAdjust) }}
                </div>
              </div>
              <div class="adjustment-card">
                <div class="adj-label">试探频率</div>
                <div class="adj-value" :class="getAdjustClass(globalAdjustments.probeAdjust)">
                  {{ formatPercent(globalAdjustments.probeAdjust) }}
                </div>
              </div>
            </div>
          </div>

          <!-- 按个性类型调整 -->
          <div class="adjustment-group">
            <h4>🎭 个性类型调整</h4>
            <div v-if="Object.keys(personalityAdjustments).length === 0" class="no-data">暂无个性调整数据</div>
            <div v-else class="personality-grid">
              <div v-for="(adj, type) in personalityAdjustments" :key="type" class="personality-card">
                <div class="personality-header">{{ getPersonalityName(type) }}</div>
                <div class="personality-stats">
                  <div class="adj-row">
                    <span>诈唬频率:</span>
                    <span :class="getAdjustClass(adj.bluffAdjust)">{{ formatPercent(adj.bluffAdjust) }}</span>
                  </div>
                  <div class="adj-row">
                    <span>激进度:</span>
                    <span :class="getAdjustClass(adj.aggressionAdjust)">{{ formatPercent(adj.aggressionAdjust) }}</span>
                  </div>
                  <div class="adj-row">
                    <span>慢打频率:</span>
                    <span :class="getAdjustClass(adj.slowPlayAdjust)">{{ formatPercent(adj.slowPlayAdjust) }}</span>
                  </div>
                  <div class="adj-row">
                    <span>陷阱频率:</span>
                    <span :class="getAdjustClass(adj.trapAdjust)">{{ formatPercent(adj.trapAdjust) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 大牌认知校准 -->
        <div class="subsection">
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

      <!-- 牌局复盘 -->
      <section v-if="activeTab === 'replays'" class="monitor-section">
        <h3>📜 牌局复盘</h3>
        <p class="section-desc">查看历史牌局的详细操作记录和 AI 决策思路</p>
        
        <!-- 复盘列表 -->
        <div v-if="!replayDetail">
          <div v-if="replays.length === 0" class="no-data">暂无复盘数据</div>
          <div v-else class="replay-list">
            <div v-for="r in replays" :key="r.id" class="replay-item" @click="loadReplayDetail(r.id)">
              <div class="replay-info">
                <span class="replay-room">房间 {{ r.roomCode }}</span>
                <span class="replay-time">{{ formatTime(r.createdAt) }}</span>
              </div>
              <div class="replay-summary">
                <span>{{ r.totalRounds }} 回合</span>
                <span class="replay-winner">🏆 {{ r.winnerName }}</span>
                <span class="replay-pot">底池 ¥{{ r.potSize }}</span>
              </div>
            </div>
          </div>
          <div v-if="replayTotal > replays.length" class="load-more">
            <button @click="loadMoreReplays" class="load-more-btn">加载更多</button>
          </div>
        </div>

        <!-- 复盘详情 -->
        <div v-else class="replay-detail">
          <button @click="replayDetail = null" class="back-btn">← 返回列表</button>
          <div class="replay-header">
            <span>房间 {{ replayDetail.roomCode }}</span>
            <span>{{ replayDetail.totalRounds }} 回合</span>
            <span>🏆 {{ replayDetail.winnerName }}</span>
            <span>底池 ¥{{ replayDetail.potSize }}</span>
          </div>
          
          <!-- 玩家手牌展示 -->
          <div v-if="replayDetail.playerHands && replayDetail.playerHands.length" class="player-hands-section">
            <div class="hands-title">🃏 玩家手牌</div>
            <div class="hands-list">
              <div v-for="ph in replayDetail.playerHands" :key="ph.seatIndex" 
                   class="hand-item" :class="{ 'winner': ph.name === replayDetail.winnerName, 'folded': ph.folded }">
                <span class="hand-player">{{ ph.name }}</span>
                <span class="hand-cards">
                  <span v-for="(card, ci) in ph.cards" :key="ci" 
                        :class="['card', isRedSuit(card.suit) ? 'red' : 'black']">
                    {{ card.rank }}{{ card.suit }}
                  </span>
                </span>
                <span class="hand-type">{{ ph.handType || '' }}</span>
                <span v-if="ph.folded" class="folded-badge">弃牌</span>
              </div>
            </div>
          </div>
          
          <div class="actions-timeline">
            <div v-for="(action, idx) in replayDetail.actions" :key="idx" 
                 class="action-item" :class="action.playerType">
              <div class="action-round">R{{ action.round }}</div>
              <div class="action-content">
                <div class="action-header">
                  <span class="action-player">{{ action.playerName }}</span>
                  <span class="blind-status" :class="action.isBlind ? 'blind' : 'peeked'">
                    {{ action.isBlind ? '🙈焖' : '👁看' }}
                  </span>
                  <span class="action-type-badge" :class="action.action">{{ formatAction(action.action) }}</span>
                  <span v-if="action.amount" class="action-amount">¥{{ action.amount }}</span>
                </div>
                <div v-if="action.reasoning" class="action-reasoning">
                  💭 {{ action.reasoning }}
                </div>
              </div>
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
    handCalibrations: { type: Array, default: () => [] },
    personalityAdjustments: { type: Object, default: () => ({}) },
    globalAdjustments: { type: Object, default: null }
  },
  data() {
    return {
      activeTab: 'overview',
      tabs: [
        { id: 'overview', name: 'AI 综合胜率' },
        { id: 'strategy', name: '策略与认知' },
        { id: 'players', name: '玩家建模' },
        { id: 'replays', name: '牌局复盘' }
      ],
      replays: [],
      replayDetail: null,
      replayPage: 1,
      replayTotal: 0
    }
  },
  mounted() {
    console.log('[AIMonitor] globalAdjustments:', this.globalAdjustments)
    console.log('[AIMonitor] personalityAdjustments:', this.personalityAdjustments)
  },
  watch: {
    globalAdjustments(val) {
      console.log('[AIMonitor] globalAdjustments 更新:', val)
    },
    personalityAdjustments(val) {
      console.log('[AIMonitor] personalityAdjustments 更新:', val)
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
    },
    // 策略自修正相关方法
    formatAdjust(val) {
      if (!val) return '0'
      return val > 0 ? `+${val}` : `${val}`
    },
    formatPercent(val) {
      if (!val) return '0%'
      const percent = Math.round(val * 100)
      return percent > 0 ? `+${percent}%` : `${percent}%`
    },
    getAdjustClass(val) {
      if (!val) return 'neutral'
      return val > 0 ? 'positive' : 'negative'
    },
    getThresholdDesc(val) {
      if (!val) return '无调整'
      return val > 0 ? '更严格' : '更宽松'
    },
    getPersonalityName(type) {
      const map = {
        aggressive: '激进型',
        conservative: '保守型',
        balanced: '均衡型',
        tricky: '诡诈型',
        tight: '紧凶型'
      }
      return map[type] || type
    },
    // 复盘相关方法
    formatTime(ts) {
      if (!ts) return ''
      const d = new Date(ts)
      return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`
    },
    formatAction(action) {
      const map = { fold: '弃牌', call: '跟注', raise: '加注', blind: '焖牌', showdown: '开牌', peek: '看牌' }
      return map[action] || action
    },
    isRedSuit(suit) {
      return suit === '♥' || suit === '♦'
    },
    loadReplayDetail(id) {
      this.$emit('load-replay-detail', id)
    },
    loadMoreReplays() {
      this.$emit('load-replays', this.replayPage + 1)
    },
    updateReplays(data) {
      this.replays = data.list || []
      this.replayTotal = data.total || 0
      this.replayPage = data.page || 1
    },
    updateReplayDetail(detail) {
      this.replayDetail = detail
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

/* 子区块样式 */
.subsection {
  margin-bottom: 40px;
  padding: 20px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.subsection:last-child {
  margin-bottom: 0;
}
.subsection h3 {
  font-size: 17px;
  color: #ffd700;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 215, 0, 0.15);
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

/* 策略自修正样式 */
.adjustment-group {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}
.adjustment-group h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
}
.adjustments-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}
.adjustment-card {
  background: rgba(30, 41, 59, 0.8);
  border-radius: 10px;
  padding: 12px;
  text-align: center;
}
.adj-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 6px;
}
.adj-value {
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 4px;
}
.adj-value.positive { color: #4ade80; }
.adj-value.negative { color: #f87171; }
.adj-value.neutral { color: #9ca3af; }
.adj-desc {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
}
.personality-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}
.personality-card {
  background: rgba(30, 41, 59, 0.8);
  border-radius: 10px;
  padding: 12px;
}
.personality-header {
  font-size: 14px;
  font-weight: bold;
  color: #ffd700;
  margin-bottom: 10px;
  text-align: center;
}
.personality-stats { font-size: 12px; }
.adj-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  color: rgba(255, 255, 255, 0.7);
}
.adj-row .positive { color: #4ade80; }
.adj-row .negative { color: #f87171; }
.adj-row .neutral { color: #9ca3af; }

/* 复盘样式 */
.replay-list { display: flex; flex-direction: column; gap: 10px; }
.replay-item {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 14px;
  cursor: pointer;
  transition: all 0.2s;
}
.replay-item:hover { background: rgba(255, 215, 0, 0.1); border-color: rgba(255, 215, 0, 0.3); }
.replay-info { display: flex; justify-content: space-between; margin-bottom: 8px; }
.replay-room { font-weight: bold; color: #ffd700; }
.replay-time { font-size: 12px; color: rgba(255, 255, 255, 0.5); }
.replay-summary { display: flex; gap: 15px; font-size: 13px; color: rgba(255, 255, 255, 0.7); }
.replay-winner { color: #4ade80; }
.replay-pot { color: #fbbf24; }
.load-more { text-align: center; margin-top: 15px; }
.load-more-btn {
  padding: 10px 24px;
  background: rgba(255, 215, 0, 0.2);
  border: 1px solid rgba(255, 215, 0, 0.4);
  border-radius: 8px;
  color: #ffd700;
  cursor: pointer;
}
.back-btn {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  cursor: pointer;
  margin-bottom: 15px;
}
.replay-header {
  display: flex; gap: 20px; padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px; margin-bottom: 15px;
  font-size: 14px; color: rgba(255, 255, 255, 0.8);
}
.player-hands-section {
  background: rgba(0, 0, 0, 0.25);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 15px;
}
.hands-title {
  font-size: 13px;
  color: #ffd700;
  margin-bottom: 10px;
  font-weight: bold;
}
.hands-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hand-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  border-left: 3px solid rgba(255, 255, 255, 0.2);
}
.hand-item.winner {
  border-left-color: #ffd700;
  background: rgba(255, 215, 0, 0.1);
}
.hand-item.folded {
  opacity: 0.5;
}
.hand-player {
  font-weight: bold;
  font-size: 13px;
  min-width: 60px;
}
.hand-cards {
  display: flex;
  gap: 6px;
}
.hand-cards .card {
  font-size: 14px;
  font-weight: bold;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 4px;
}
.hand-cards .card.red { color: #dc2626; }
.hand-cards .card.black { color: #1f2937; }
.hand-type {
  font-size: 12px;
  color: #a78bfa;
  margin-left: auto;
}
.folded-badge {
  font-size: 10px;
  color: #f87171;
  background: rgba(239, 68, 68, 0.2);
  padding: 2px 6px;
  border-radius: 4px;
}
.actions-timeline { display: flex; flex-direction: column; gap: 8px; }
.action-item {
  display: flex; gap: 12px;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  border-left: 3px solid rgba(255, 255, 255, 0.2);
}
.action-item.ai { border-left-color: #a78bfa; }
.action-item.human { border-left-color: #60a5fa; }
.action-round {
  font-size: 11px; color: rgba(255, 255, 255, 0.4);
  min-width: 30px;
}
.action-content { flex: 1; }
.action-header { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
.action-player { font-weight: bold; font-size: 14px; }
.blind-status {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 8px;
}
.blind-status.blind {
  background: rgba(251, 191, 36, 0.25);
  color: #fbbf24;
}
.blind-status.peeked {
  background: rgba(59, 130, 246, 0.25);
  color: #60a5fa;
}
.action-type-badge {
  font-size: 11px; padding: 2px 8px;
  border-radius: 10px; background: rgba(255, 255, 255, 0.1);
}
.action-type-badge.fold { background: rgba(239, 68, 68, 0.3); color: #f87171; }
.action-type-badge.raise { background: rgba(74, 222, 128, 0.3); color: #4ade80; }
.action-type-badge.call { background: rgba(59, 130, 246, 0.3); color: #60a5fa; }
.action-type-badge.blind { background: rgba(251, 191, 36, 0.3); color: #fbbf24; }
.action-type-badge.showdown { background: rgba(168, 85, 247, 0.3); color: #c084fc; }
.action-amount { color: #ffd700; font-size: 13px; }
.action-reasoning {
  font-size: 12px; color: rgba(255, 255, 255, 0.6);
  background: rgba(139, 92, 246, 0.1);
  padding: 6px 10px; border-radius: 6px; margin-top: 6px;
}
</style>
