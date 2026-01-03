<template>
  <div class="game-container no-select">
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

export default {
  name: 'App',
  components: { LoginModal, LobbyPanel, GameHeader, GameTable, GameControls },
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
      pendingShowdownTarget: null  // 等待开牌结果的目标
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
    gameStats() { return { round: this.gameState.round, activePlayers: this.gameState.getActivePlayers().length } }
  },
  mounted() {
    this.initManagers()
  },
  methods: {
    initManagers() {
      try { this.soundManager = new SoundManager() } catch (e) { console.warn('音效初始化失败') }
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
      if (session) {
        console.log('🔄 发现保存的会话，尝试重连...')
        try {
          await this.networkManager.connect()
          await this.networkManager.reconnectToRoom(session.roomCode)
        } catch (e) {
          console.log('自动重连失败:', e)
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
        } else {
          this.showLobbyModal = true
        }
        console.log('🔄 重连成功')
      }
      nm.onReconnectFailed = (msg) => {
        console.log('❌ 重连失败:', msg)
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
      
      // 轮到我时播放提示音
      if (this.gameState.phase === 'betting' && 
          this.gameState.isMyTurn() && 
          prevTurn !== this.gameState.currentPlayerIndex) {
        this.soundManager?.play('turn')
      }
      
      // 游戏结束时播放获胜音效
      if (this.gameState.phase === 'ended' && prevPhase !== 'ended') {
        this.soundManager?.play('win')
      }
    },
    handleActionResult(result) {
      if (['call', 'raise', 'allin', 'blind'].includes(result.action)) {
        this.soundManager?.play('chip')
      }
      if (result.action === 'peek') {
        this.soundManager?.play('peek')
      }
      if (result.action === 'fold') {
        this.soundManager?.play('fold')
      }
      if (result.action === 'showdown') {
        this.soundManager?.play('chip')
        // 显示开牌结果
        this.showShowdownResult(result)
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
    }
  }
}
</script>

<style>
@import './style.css';
</style>
