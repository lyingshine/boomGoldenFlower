<template>
  <div class="game-container no-select">
    <!-- 粒子特效 -->
    <ParticleEffect :ref="particlesRef" />
    
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
      @players-updated="store.setLobbyPlayers($event)"
      @room-created="store.setRoomCode($event)"
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
        :current-user="currentUser"
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
        @showdown-mode-change="store.setShowdownMode($event)"
      />
    </template>
  </div>
</template>

<script>
import { ref, computed, inject, onMounted, watch } from 'vue'
import { SoundManager } from './utils/SoundManager.js'
import { UserManager } from './utils/UserManager.js'
import { NetworkManager } from './utils/NetworkManager.js'
import LoginModal from './components/LoginModal.vue'
import LobbyPanel from './components/LobbyPanel.vue'
import GameHeader from './components/GameHeader.vue'
import GameTable from './components/GameTable.vue'
import GameControls from './components/GameControls.vue'
import ParticleEffect from './components/ParticleEffect.vue'
import { useGameState } from './composables/useGameState.js'
import { useGameEffects } from './composables/useGameEffects.js'
import { useGameActions } from './composables/useGameActions.js'
import { useNetworkHandlers } from './composables/useNetworkHandlers.js'

export default {
  name: 'App',
  components: { LoginModal, LobbyPanel, GameHeader, GameTable, GameControls, ParticleEffect },
  setup() {
    const store = inject('store')
    
    // 管理器
    const soundManager = ref(null)
    const userManager = ref(null)
    const networkManager = ref(null)
    
    // 使用 Composables
    const gameState = useGameState()
    const effects = useGameEffects(soundManager)
    const actions = useGameActions(networkManager, userManager)
    const handlers = useNetworkHandlers(networkManager, effects, userManager)
    
    // UI 状态
    const showLoginModal = computed(() => store.state.ui.showLoginModal)
    const showLobbyModal = computed(() => store.state.ui.showLobbyModal)
    const isLoading = computed(() => store.state.ui.isLoading)
    const loadingText = computed(() => store.state.ui.loadingText)
    const showdownMode = computed(() => store.state.ui.showdownMode)
    const showdownPreview = computed(() => store.state.ui.showdownPreview)
    const showdownResultDisplay = computed(() => store.state.ui.showdownResultDisplay)
    
    // 房间状态
    const roomCode = computed(() => store.state.room.roomCode)
    const lobbyPlayers = computed(() => store.state.room.lobbyPlayers)
    
    // 消息状态
    const chatMessages = computed(() => store.state.messages.chat)
    const actionMessages = computed(() => store.state.messages.action)
    
    // 初始化管理器
    const initManagers = () => {
      try {
        soundManager.value = new SoundManager()
        soundManager.value.init()
        soundManager.value.bindGlobalUISound()
        window.$sound = soundManager.value
      } catch (e) {
        console.warn('音效初始化失败')
      }
      
      networkManager.value = new NetworkManager()
      userManager.value = new UserManager(networkManager.value)
      
      // 设置网络回调
      handlers.setupCallbacks()
      
      // 自动登录
      if (userManager.value.isLoggedIn()) {
        store.setLoginModal(false)
        store.setLobbyModal(true)
        actions.tryAutoReconnect()
      }
    }
    
    // 登录成功
    const onLoginSuccess = (um) => {
      if (um) {
        userManager.value = um
        userManager.value.setNetworkManager(networkManager.value)
      }
      store.setLoginModal(false)
      store.setLobbyModal(true)
    }
    
    // 开始游戏
    const onStartGame = () => {
      store.setLobbyModal(false)
      networkManager.value.startGame()
    }
    
    // 卡牌点击
    const onCardClick = (player) => {
      actions.onCardClick(player, gameState.mySeatIndex.value)
    }
    
    // 玩家点击
    const onPlayerClick = (seatIndex) => {
      actions.onPlayerClick(
        seatIndex,
        showdownMode.value,
        gameState.allSeats.value,
        handlers.pendingShowdownTarget
      )
    }
    
    onMounted(() => {
      initManagers()
    })
    
    return {
      // 管理器
      soundManager,
      userManager,
      networkManager,
      
      // UI 状态
      showLoginModal,
      showLobbyModal,
      isLoading,
      loadingText,
      showdownMode,
      showdownPreview,
      showdownResultDisplay,
      
      // 房间状态
      roomCode,
      lobbyPlayers,
      
      // 游戏状态（从 composable）
      ...gameState,
      
      // 消息
      chatMessages,
      actionMessages,
      
      // 特效引用
      particlesRef: effects.particlesRef,
      
      // 事件处理
      onLoginSuccess,
      onStartGame,
      onCardClick,
      onPlayerClick,
      
      // 动作（从 composable）
      sendAction: actions.sendAction,
      startNewGame: actions.startNewGame,
      onCall: (amount) => actions.onCall(amount, gameState.callAmount.value),
      onRaise: actions.onRaise,
      onBlind: actions.onBlind,
      onShowdown: actions.onShowdown,
      onLeaveLobby: actions.onLeaveLobby,
      onBackToLobby: actions.onBackToLobby,
      onLogout: actions.onLogout,
      
      // Store
      store
    }
  }
}
</script>

<style>
@import './style.css';
</style>
