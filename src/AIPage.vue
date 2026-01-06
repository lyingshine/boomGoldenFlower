<template>
  <AIMonitor 
    ref="monitor"
    :player-profiles="playerProfiles"
    :ai-stats="aiStats"
    :hand-calibrations="handCalibrations"
    :player-strategies="playerStrategies"
    :personality-adjustments="personalityAdjustments"
    :global-adjustments="globalAdjustments"
    @close="goBack"
    @load-ai-detail="loadAIDetail"
    @clear-ai-data="clearAIData"
    @start-batch-test="startBatchTest"
    @load-replays="loadReplays"
    @load-replay-detail="loadReplayDetail"
  />
</template>

<script>
import AIMonitor from './components/AIMonitor.vue'
import { NetworkManager } from './utils/NetworkManager.js'

export default {
  name: 'AIPage',
  components: { AIMonitor },
  data() {
    return {
      networkManager: null,
      playerProfiles: [],
      aiStats: [],
      handCalibrations: [],
      playerStrategies: [],
      personalityAdjustments: {},
      globalAdjustments: null
    }
  },
  async mounted() {
    this.networkManager = new NetworkManager()
    await this.loadProfiles()
    await this.loadReplays(1)
    this.refreshTimer = setInterval(() => this.loadProfiles(), 2000)
  },
  beforeUnmount() {
    if (this.refreshTimer) clearInterval(this.refreshTimer)
    if (this.networkManager) this.networkManager.disconnect()
  },
  methods: {
    async loadProfiles() {
      try {
        await this.networkManager.connect()
        const data = await this.networkManager.getAIProfiles()
        this.playerProfiles = data.profiles || []
        this.aiStats = data.aiStats || []
        this.handCalibrations = data.handCalibrations || []
        this.playerStrategies = data.playerStrategies || []
        this.personalityAdjustments = data.personalityAdjustments || {}
        this.globalAdjustments = data.globalAdjustments || null
      } catch (e) {
        console.error('加载档案失败:', e)
      }
    },
    async loadAIDetail(aiName) {
      try {
        const data = await this.networkManager.getAIDetail(aiName)
        // 通过事件或直接更新子组件
        this.$refs.monitor?.updateAIDetail(data)
      } catch (e) {
        console.error('加载AI详情失败:', e)
      }
    },
    goBack() {
      window.location.href = '/'
    },
    async clearAIData() {
      try {
        await this.networkManager.clearAIData()
        await this.loadProfiles()
      } catch (e) {
        console.error('清除数据失败:', e)
      }
    },
    async startBatchTest(config) {
      try {
        await this.networkManager.connect()
        this.networkManager.onBatchTestProgress = (msg) => {
          this.$refs.monitor?.updateTestProgress(msg.progress)
        }
        this.networkManager.onBatchTestResult = (msg) => {
          this.$refs.monitor?.updateTestResults(msg.results)
          this.loadProfiles()
        }
        this.networkManager.send({ type: 'batch_test', ...config })
      } catch (e) {
        console.error('批量测试失败:', e)
      }
    },
    async loadReplays(page = 1) {
      try {
        await this.networkManager.connect()
        const data = await this.networkManager.getGameReplays(page)
        this.$refs.monitor?.updateReplays(data)
      } catch (e) {
        console.error('加载复盘列表失败:', e)
      }
    },
    async loadReplayDetail(id) {
      try {
        const data = await this.networkManager.getGameReplayDetail(id)
        this.$refs.monitor?.updateReplayDetail(data.detail)
      } catch (e) {
        console.error('加载复盘详情失败:', e)
      }
    }
  }
}
</script>
