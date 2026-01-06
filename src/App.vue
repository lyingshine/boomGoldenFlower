<template>
  <div class="game-container no-select">
    <!-- 粒子特效 -->
    <ParticleEffect ref="particles" />
    
    <!-- 登录模态框 -->
    <LoginModal 
      v-if="showLoginModal"
      @login-success="onLoginSuccess"
    />

    <!-- 游戏大厅 -->
    <LobbyPanel
      v-else-if="showLobbyModal"
      :network-manager="networkManager"
      :user-manager="userManager"
      :lobby-players="lobbyPlayers"
      :room-code="roomCode"
      @start-game="onStartGame"
      @leave-lobby="onLeaveLobby"
      @logout="onLogout"
      @players-updated="lobbyPlayers = $event"
      @room-created="roomCode = $event"
    />

    <!-- 游戏界面 -->
    <template v-else>
      <GameHeader
        :user-manager="userManager"
        :game-phase="gamePhase"
        :my-player="myPlayer"
        :room-code="roomCode"
        :player-count="players.length"
        :round="gameStats.round"
        @back-to-lobby="onBackToLobby"
        @logout="onLogout"
      />

      <GameTable
        :all-seats="allSeats"
        :current-player-index="currentPlayerIndex"
        :pot="pot"
        :game-phase="gamePhase"
        :winner="winner"
        :game-status="gameStatus"
        :my-seat-index="mySeatIndex"
        :is-loading="isLoading"
        :loading-text="loadingText"
        :showdown-result="showdownResultDisplay"
        :showdown-mode="showdownMode"
        :showdown-preview="showdownPreview"
        :chat-messages="chatMessages"
        :action-messages="actionMessages"
        @card-click="onCardClick"
        @player-click="onPlayerClick"
      />

      <GameControls
        :game-phase="gamePhase"
        :is-host="networkManager?.isHost"
        :is-my-turn="isMyTurn"
        :my-player="myPlayer"
        :can-call="canCall"
        :can-raise="canRaise"
        :can-showdown="canShowdown"
        :can-blind="canBlind"
        :showdown-targets="showdownTargets"
        :showdown-cost="showdownCost"
        :call-amount="callAmount"
        :blind-min-amount="blindMinAmount"
        :current-bet="currentBet"
        :first-round-complete="firstRoundComplete"
        @start-game="startNewGame"
        @peek="sendAction('peek')"
        @call="onCall"
        @raise="onRaise"
        @blind="onBlind"
        @fold="sendAction('fold')"
        @showdown="onShowdown"
        @showdown-mode-change="showdownMode = $event"
      />
    </template>
  </div>
</template>

<script>
import { ClientGameState } from './game/ClientGameState.js'
import { SoundManager } from './utils/SoundManager.js'
import { UserManager } from './utils/UserManager.js'
import { NetworkManager } from './utils/NetworkManager.js'
import LoginModal from './components/LoginModal.vue'
import LobbyPanel from './components/LobbyPanel.vue'
import GameHeader from './components/GameHeader.vue'
import GameTable from './components/GameTable.vue'
import GameControls from './components/GameControls.vue'
import ParticleEffect from './components/ParticleEffect.vue'

export default {
  name: 'App',
  components: { LoginModal, LobbyPanel, GameHeader, GameTable, GameControls, ParticleEffect },
  data() {
    return {
      gameState: new ClientGameState(),
      gameStateVersion: 0, // 用于强制更新
      soundManager: null,
      userManager: null,
      networkManager: null,
      showLoginModal: true,
      showLobbyModal: false,
      lobbyPlayers: [],
      roomCode: '',
      isLoading: false,
      loadingText: '',
      showdownResultDisplay: null,
      showdownMode: false,
      showdownPreview: null,  // 开牌时展示对手手牌
      pendingShowdownTarget: null,  // 等待开牌结果的目标
      chatMessages: [],  // 聊天消息列表
      actionMessages: [],  // 操作消息列表（下注等）
      winStreak: 0  // 连胜计数（正数连胜，负数连败）
    }
  },
  computed: {
    allSeats() { return this.gameStateVersion, this.gameState.seats },
    players() { return this.allSeats.filter(p => p) },
    currentPlayerIndex() { return this.gameState.currentPlayerIndex },
    pot() { return this.gameState.pot },
    currentBet() { return this.gameState.currentBet },
    gamePhase() { return this.gameState.phase },
    gameStatus() { return this.gameState.getStatusMessage() },
    winner() { return this.gameState.winner },
    canShowdown() { return this.gameState.showdownReady },
    mySeatIndex() { return this.gameState.mySeatIndex },
    myPlayer() { return this.gameStateVersion, this.gameState.getMyPlayer() },
    isMyTurn() { return this.gameState.isMyTurn() },
    canCall() { return this.gameState.canCall() },
    canRaise() { return this.gameState.canRaise() },
    canBlind() { return this.gameState.canBlind() },
    callAmount() { return this.gameState.getCallAmount() },
    blindMinAmount() { return this.gameState.getBlindMinAmount() },
    canShowdown() { return this.gameState.canShowdown() },
    showdownTargets() { return this.gameState.getShowdownTargets() },
    showdownCost() { return this.gameState.getShowdownCost() },
    firstRoundComplete() { return this.gameState.firstRoundComplete },
    gameStats() { return { round: this.gameState.round, activePlayers: this.gameState.getActivePlayers().length } }
  },
  mounted() {
    this.initManagers()
  },
  methods: {
    initManagers() {
      try { 
        this.soundManager = new SoundManager()
        this.soundManager.init()
        // 绑定全局 UI 音效，让所有界面的交互都有反馈
        this.soundManager.bindGlobalUISound()
        // 挂载到全局，方便子组件访问
        window.$sound = this.soundManager
      } catch (e) { console.warn('音效初始化失败') }
      this.networkManager = new NetworkManager()
      this.userManager = new UserManager(this.networkManager)
      this.setupNetworkCallbacks()
      if (this.userManager.isLoggedIn()) {
        this.showLoginModal = false
        this.showLobbyModal = true
        // 检查是否有保存的会话，尝试重连
        this.tryAutoReconnect()
      }
    },
    async tryAutoReconnect() {
      const session = this.networkManager.getSavedSession()
      if (session && session.roomCode) {
        console.log('🔄 发现保存的会话，自动重连中...')
        this.isLoading = true
        this.loadingText = '正在重连对局...'
        try {
          await this.networkManager.connect()
          await this.networkManager.reconnectToRoom(session.roomCode)
        } catch (e) {
          console.log('自动重连失败:', e)
          this.networkManager.clearSession()
        } finally {
          this.isLoading = false
          this.loadingText = ''
        }
      }
    },
    setupNetworkCallbacks() {
      const nm = this.networkManager
      nm.onRoomCreated = (msg) => {
        this.roomCode = msg.roomCode
        this.gameState.mySeatIndex = msg.seatIndex
        this.updateLobbyPlayers(msg.players)
      }
      nm.onRoomJoined = (msg) => {
        this.roomCode = msg.roomCode
        this.gameState.mySeatIndex = msg.seatIndex
        this.updateLobbyPlayers(msg.players)
        // 如果游戏已开始，直接进入牌桌
        if (msg.gameStarted) {
          this.showLobbyModal = false
        }
      }
      // 重连成功
      nm.onReconnectSuccess = (msg) => {
        this.roomCode = msg.roomCode
        this.gameState.mySeatIndex = msg.seatIndex
        this.updateLobbyPlayers(msg.players)
        this.showLoginModal = false
        if (msg.gameStarted) {
          this.showLobbyModal = false
          // 播放提示音
          this.soundManager?.play('notify')
        } else {
          this.showLobbyModal = true
        }
        console.log('🔄 重连成功，房间:', msg.roomCode)
      }
      nm.onReconnectFailed = (msg) => {
        console.log('❌ 重连失败:', msg)
        this.networkManager.clearSession()
        this.showLobbyModal = true
      }
      nm.onPlayerDisconnected = (msg) => {
        console.log(`⏸️ 玩家断线: ${msg.playerName}`)
        this.updateLobbyPlayers(msg.players)
      }
      nm.onPlayerReconnected = (msg) => {
        console.log(`🔄 玩家重连: ${msg.playerName}`)
        this.updateLobbyPlayers(msg.players)
      }
      nm.onPlayerJoined = (msg) => {
        this.updateLobbyPlayers(msg.players)
        // 如果已在牌桌，更新座位显示
        if (!this.showLobbyModal) {
          this.gameState.updateSeatsFromPlayers(msg.players)
        }
      }
      nm.onPlayerLeft = (msg) => {
        this.updateLobbyPlayers(msg.players)
        if (!this.showLobbyModal) {
          this.gameState.updateSeatsFromPlayers(msg.players)
        }
      }
      nm.onRoomClosed = (message) => { alert(message); this.onLeaveLobby() }
      nm.onAIAdded = (msg) => this.updateLobbyPlayers(msg.players)
      nm.onAIRemoved = (msg) => this.updateLobbyPlayers(msg.players)
      nm.onGameStarted = () => { this.showLobbyModal = false }
      nm.onGameState = (state) => this.handleGameState(state)
      nm.onActionResult = (result) => this.handleActionResult(result)
      nm.onActionFailed = (msg) => alert(msg)
      nm.onChatMessage = (msg) => this.handleChatMessage(msg)
      nm.onActionMessage = (msg) => this.handleActionMessage(msg)
    },
    updateLobbyPlayers(players) {
      if (!players) return
      this.lobbyPlayers = players.map((p, i) => ({
        seatIndex: p.seatIndex ?? i,
        name: p.name,
        type: p.type,
        chips: p.chips || 1000
      }))
    },
    handleGameState(state) {
      const prevPhase = this.gameState.phase
      const prevTurn = this.gameState.currentPlayerIndex
      
      this.gameState.updateFromServer(state)
      this.gameStateVersion++ // 触发响应式更新
      
      // 播放相应音效
      if (this.gameState.phase !== 'waiting' && this.showLobbyModal) {
        this.showLobbyModal = false
      }
      
      // 发牌阶段播放发牌音效
      if (this.gameState.phase === 'dealing' && prevPhase !== 'dealing') {
        // 模拟发牌音效序列，与动画同步（每张牌间隔0.3秒）
        const playerCount = this.players.length
        const totalCards = playerCount * 3
        for (let i = 0; i < totalCards; i++) {
          setTimeout(() => this.soundManager?.play('card'), i * 300)
        }
      }
      
      // 轮到我时播放提示音
      if (this.gameState.phase === 'betting' && 
          this.gameState.isMyTurn() && 
          prevTurn !== this.gameState.currentPlayerIndex) {
        this.soundManager?.play('turn')
      }
      
      // 游戏结束时播放音效
      if (this.gameState.phase === 'ended' && prevPhase !== 'ended') {
        const winner = this.gameState.winner
        const isMyWin = winner && winner.seatIndex === this.mySeatIndex
        
        // 更新连胜计数
        if (isMyWin) {
          this.winStreak = this.winStreak > 0 ? this.winStreak + 1 : 1
        } else {
          this.winStreak = this.winStreak < 0 ? this.winStreak - 1 : -1
        }
        
        // 更新本地用户数据（战绩和筹码）
        this.updateLocalUserStats(isMyWin)
        
        // 触发胜利特效
        this.triggerWinEffects(winner)
        
        // 触发连胜提示
        setTimeout(() => {
          this.$refs.particles?.triggerStreakEffect(this.winStreak, isMyWin)
        }, 800)
        
        // 根据牌型播放特殊音效
        if (winner?.handType) {
          this.soundManager?.playHandTypeSound(winner.handType)
        }
        
        // 延迟播放胜负音效
        setTimeout(() => {
          if (isMyWin) {
            this.soundManager?.play('win')
          } else {
            this.soundManager?.play('lose')
          }
        }, 600)
      }
    },
    handleActionResult(result) {
      // 下注相关音效 - 根据金额调整强度
      if (['call', 'blind'].includes(result.action)) {
        this.soundManager?.play('call')
      }
      if (['raise'].includes(result.action)) {
        // 根据加注金额播放不同强度音效
        if (result.amount >= 100) {
          this.soundManager?.play('bigBet')
        } else {
          this.soundManager?.play('raise')
        }
      }
      if (result.action === 'allin') {
        // ALL IN 专属震撼音效
        this.soundManager?.play('allIn')
        this.$refs.particles?.triggerAllInEffect()
      }
      if (result.action === 'peek') {
        this.soundManager?.play('peek')
      }
      if (result.action === 'fold') {
        this.soundManager?.play('fold')
      }
      if (result.action === 'showdown') {
        this.soundManager?.play('showdown')
        // 触发 VS 对决动画
        const challengerName = this.allSeats[result.seatIndex]?.name || '玩家'
        const targetName = this.allSeats[result.targetSeatIndex]?.name || '玩家'
        this.$refs.particles?.triggerVSEffect(challengerName, targetName)
        
        // 如果我是焖牌赢家，被开牌后要看到自己的手牌
        if (result.winnerForcePeeked && result.winnerSeatIndex === this.mySeatIndex && result.winnerCards) {
          // 更新本地玩家的手牌和看牌状态
          const myPlayer = this.allSeats[this.mySeatIndex]
          if (myPlayer) {
            myPlayer.cards = result.winnerCards
            myPlayer.hasPeeked = true
          }
        }
        
        // 延迟显示结果
        setTimeout(() => {
          this.showShowdownResult(result)
        }, 1500)
      }
    },
    showShowdownResult(result) {
      console.log('🎯 开牌结果:', result)
      const challengerName = this.allSeats[result.seatIndex]?.name || '玩家'
      const targetName = this.allSeats[result.targetSeatIndex]?.name || '玩家'
      
      const formatHand = (hand) => {
        if (!hand) return ''
        const typeMap = {
          'leopard': '豹子',
          'straight_flush': '同花顺',
          'flush': '同花',
          'straight': '顺子',
          'pair': '对子',
          'high_card': '散牌'
        }
        return typeMap[hand.type] || hand.type || ''
      }
      
      // 如果是我发起的开牌，先展示对手手牌
      if (this.pendingShowdownTarget !== null && result.targetCards) {
        this.showdownPreview = {
          targetName: targetName,
          targetSeatIndex: result.targetSeatIndex,
          cards: result.targetCards
        }
        this.pendingShowdownTarget = null
        // 2.5秒后关闭预览
        setTimeout(() => {
          this.showdownPreview = null
        }, 2500)
      }
      
      this.showdownResultDisplay = {
        challengerName,
        targetName,
        winnerName: result.winnerName,
        loserName: result.loserName,
        challengerHand: formatHand(result.challengerHand),
        targetHand: formatHand(result.targetHand)
      }
      
      // 8秒后自动清除
      setTimeout(() => {
        this.showdownResultDisplay = null
      }, 8000)
    },
    onLoginSuccess(userManager) {
      if (userManager) {
        this.userManager = userManager
        this.userManager.setNetworkManager(this.networkManager)
      }
      this.showLoginModal = false
      this.showLobbyModal = true
    },
    onStartGame() {
      this.showLobbyModal = false
      this.networkManager.startGame()
    },
    onLeaveLobby() {
      if (this.roomCode) this.networkManager.leaveRoom()
      this.lobbyPlayers = []
      this.roomCode = ''
      this.gameState.reset()
    },
    async onBackToLobby(options = {}) {
      // 手动返回大厅，清除会话不提供重连
      if (options.manual) {
        this.networkManager.clearSession()
      }
      this.onLeaveLobby()
      // 重新从服务器获取用户数据
      await this.refreshUserData()
      this.showLobbyModal = true
    },
    async onLogout(options = {}) {
      // 手动退出，清除会话
      if (options.manual) {
        this.networkManager.clearSession()
      }
      this.onLeaveLobby()
      this.userManager.logout()
      this.showLoginModal = true
      this.showLobbyModal = false
    },
    async refreshUserData() {
      const user = this.userManager.getCurrentUser()
      if (user && user.username) {
        try {
          await this.networkManager.connect()
          const result = await this.networkManager.getUser(user.username)
          if (result.success && result.user) {
            this.userManager.updateUser(result.user)
          }
        } catch (e) {
          console.error('刷新用户数据失败:', e)
        }
      }
    },
    startNewGame() {
      if (!this.networkManager.isHost) return
      this.networkManager.startGame()
    },
    sendAction(action, amount = 0) {
      this.networkManager.sendAction(action, amount)
    },
    onShowdown(targetSeatIndex) {
      this.networkManager.sendAction('showdown', targetSeatIndex)
    },
    onRaise(amount) {
      this.networkManager.sendAction('raise', amount)
    },
    onCall(amount) {
      // 如果金额大于最低跟注，视为加注
      const minCall = this.gameState.getCallAmount()
      if (amount > minCall) {
        this.networkManager.sendAction('raise', amount - minCall)
      } else {
        this.networkManager.sendAction('call')
      }
    },
    onBlind(amount) {
      this.networkManager.sendAction('blind', amount)
    },
    onCardClick(player) {
      if (player.id === this.mySeatIndex && !player.hasPeeked) {
        this.sendAction('peek')
      }
    },
    onPlayerClick(seatIndex) {
      // 开牌模式下点击对手手牌
      if (this.showdownMode) {
        const targetPlayer = this.allSeats[seatIndex]
        if (targetPlayer) {
          // 记录要开牌的目标，等服务器返回结果后再展示
          this.pendingShowdownTarget = seatIndex
          // 发送开牌请求
          this.onShowdown(seatIndex)
          this.showdownMode = false
        }
      }
    },
    handleChatMessage(msg) {
      const msgId = Date.now() + Math.random()
      // 先移除同一玩家的旧消息
      this.chatMessages = this.chatMessages.filter(m => m.seatIndex !== msg.seatIndex)
      // 添加新消息
      this.chatMessages = [...this.chatMessages, {
        id: msgId,
        seatIndex: msg.seatIndex,
        playerName: msg.playerName,
        message: msg.message,
        isAI: msg.isAI
      }]
      
      setTimeout(() => {
        this.chatMessages = this.chatMessages.filter(m => m.id !== msgId)
      }, 4000)
    },
    handleActionMessage(msg) {
      const msgId = Date.now() + Math.random()
      // 先移除同一玩家的旧操作
      this.actionMessages = this.actionMessages.filter(m => m.seatIndex !== msg.seatIndex)
      // 添加新操作
      this.actionMessages = [...this.actionMessages, {
        id: msgId,
        seatIndex: msg.seatIndex,
        message: msg.message,
        actionType: msg.actionType
      }]
      
      setTimeout(() => {
        this.actionMessages = this.actionMessages.filter(m => m.id !== msgId)
      }, 3000)
    },
    // 更新本地用户战绩
    updateLocalUserStats(isWin) {
      const user = this.userManager?.getCurrentUser()
      if (!user) return
      
      const myPlayer = this.myPlayer
      const updates = {
        totalGames: (user.totalGames || 0) + 1,
        wins: (user.wins || 0) + (isWin ? 1 : 0),
        losses: (user.losses || 0) + (isWin ? 0 : 1),
        chips: myPlayer?.chips ?? user.chips
      }
      
      this.userManager.updateUser(updates)
    },
    // 触发胜利特效
    triggerWinEffects(winner) {
      if (!winner || !this.$refs.particles) return
      
      const handType = winner.handType?.type || winner.handType
      const pot = this.pot
      
      // 屏幕中央位置
      const centerX = window.innerWidth / 2
      const centerY = window.innerHeight / 2 - 50
      
      // 牌型中文名
      const handTypeNames = {
        'leopard': '豹子！',
        'straight_flush': '同花顺！',
        'flush': '同花',
        'straight': '顺子',
        'pair': '对子',
        'high_card': '散牌'
      }
      
      // 根据牌型决定特效强度
      if (handType === 'leopard' || handType === 'straight_flush') {
        // 大牌：强烈震动 + 星星爆发 + 筹码喷射
        this.$refs.particles.triggerShake('heavy')
        this.$refs.particles.triggerBigHandEffect()
        setTimeout(() => {
          this.$refs.particles.triggerWinEffect(centerX, centerY, pot)
          this.$refs.particles.triggerFloatText(centerX, centerY - 60, handTypeNames[handType], 'handtype')
        }, 300)
        setTimeout(() => {
          this.$refs.particles.triggerFloatText(centerX, centerY + 20, `+${pot}`, 'win')
        }, 600)
      } else if (handType === 'flush' || handType === 'straight') {
        // 中等牌：中度震动 + 筹码喷射
        this.$refs.particles.triggerShake('medium')
        this.$refs.particles.triggerWinEffect(centerX, centerY, pot)
        setTimeout(() => {
          this.$refs.particles.triggerFloatText(centerX, centerY, `+${pot}`, 'win')
        }, 200)
      } else {
        // 普通胜利：轻度震动 + 少量筹码
        this.$refs.particles.triggerShake('light')
        this.$refs.particles.triggerWinEffect(centerX, centerY, Math.min(pot, 200))
        setTimeout(() => {
          this.$refs.particles.triggerFloatText(centerX, centerY, `+${pot}`, 'win')
        }, 200)
      }
    }
  }
}
</script>

<style>
@import './style.css';
</style>
