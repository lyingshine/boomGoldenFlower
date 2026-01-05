<template>
  <AIMonitor 
    ref="monitor"
    :player-profiles="playerProfiles"
    :ai-stats="aiStats"
    :hand-calibrations="handCalibrations"
    :player-strategies="playerStrategies"
    @close="goBack"
    @load-ai-detail="loadAIDetail"
    @clear-ai-data="clearAIData"
    @start-batch-test="startBatchTest"
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
      playerStrategies: []
    }
  },
  async mounted() {
    this.networkManager = new NetworkManager()
    await this.loadProfiles()
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
    }
  }
}
</script>
