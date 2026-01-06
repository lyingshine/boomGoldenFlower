/**
 * Store 组合式函数
 * 方便组件使用 store
 */
import { inject, computed } from 'vue'
import * as gameGetters from './gameGetters.js'

export function useStore() {
  const store = inject('store')
  if (!store) {
    throw new Error('Store not provided')
  }
  return store
}

/**
 * 游戏状态 hooks
 */
export function useGame() {
  const store = useStore()
  const game = store.state.game
  
  return {
    // 状态
    phase: computed(() => game.phase),
    round: computed(() => game.round),
    pot: computed(() => game.pot),
    currentBet: computed(() => game.currentBet),
    currentPlayerIndex: computed(() => game.currentPlayerIndex),
    mySeatIndex: computed(() => game.mySeatIndex),
    seats: computed(() => game.seats),
    winner: computed(() => game.winner),
    firstRoundComplete: computed(() => game.firstRoundComplete),
    
    // 计算属性
    myPlayer: computed(() => game.seats[game.mySeatIndex]),
    isMyTurn: computed(() => game.mySeatIndex === game.currentPlayerIndex),
    players: computed(() => game.seats.filter(p => p)),
    activePlayers: computed(() => game.seats.filter(p => p && !p.folded)),
    
    // 操作判断
    canCall: computed(() => gameGetters.canCall(
      game.seats, game.mySeatIndex, game.currentPlayerIndex, game.currentBet
    )),
    canRaise: computed(() => gameGetters.canRaise(
      game.seats, game.mySeatIndex, game.currentPlayerIndex, game.currentBet
    )),
    canBlind: computed(() => gameGetters.canBlind(
      game.seats, game.mySeatIndex, game.currentPlayerIndex, game.currentBet
    )),
    canShowdown: computed(() => gameGetters.canShowdown(
      game.seats, game.mySeatIndex, game.currentPlayerIndex, game.currentBet, game.firstRoundComplete
    )),
    
    // 金额计算
    callAmount: computed(() => gameGetters.getCallAmount(
      game.seats, game.mySeatIndex, game.currentBet
    )),
    blindMinAmount: computed(() => gameGetters.getCallAmount(
      game.seats, game.mySeatIndex, game.currentBet
    )),
    showdownCost: computed(() => gameGetters.getCallAmount(
      game.seats, game.mySeatIndex, game.currentBet
    )),
    showdownTargets: computed(() => gameGetters.getShowdownTargets(
      game.seats, game.mySeatIndex
    )),
    
    // 状态描述
    statusMessage: computed(() => gameGetters.getStatusMessage(game.phase, game.winner)),
    
    // Actions
    updateGameState: store.updateGameState,
    setMySeatIndex: store.setMySeatIndex,
    resetGame: store.resetGame,
    updateSeatsFromPlayers: store.updateSeatsFromPlayers
  }
}

/**
 * 用户状态 hooks
 */
export function useUser() {
  const store = useStore()
  const user = store.state.user
  
  return {
    currentUser: computed(() => user.currentUser),
    isLoggedIn: computed(() => user.isLoggedIn),
    setUser: store.setUser,
    updateUser: store.updateUser,
    logout: store.logout
  }
}

/**
 * 房间状态 hooks
 */
export function useRoom() {
  const store = useStore()
  const room = store.state.room
  
  return {
    roomCode: computed(() => room.roomCode),
    isHost: computed(() => room.isHost),
    lobbyPlayers: computed(() => room.lobbyPlayers),
    setRoomCode: store.setRoomCode,
    setIsHost: store.setIsHost,
    setLobbyPlayers: store.setLobbyPlayers,
    resetRoom: store.resetRoom
  }
}

/**
 * UI 状态 hooks
 */
export function useUI() {
  const store = useStore()
  const ui = store.state.ui
  
  return {
    showLoginModal: computed(() => ui.showLoginModal),
    showLobbyModal: computed(() => ui.showLobbyModal),
    isLoading: computed(() => ui.isLoading),
    loadingText: computed(() => ui.loadingText),
    showdownMode: computed(() => ui.showdownMode),
    showdownPreview: computed(() => ui.showdownPreview),
    showdownResultDisplay: computed(() => ui.showdownResultDisplay),
    setLoginModal: store.setLoginModal,
    setLobbyModal: store.setLobbyModal,
    setLoading: store.setLoading,
    setShowdownMode: store.setShowdownMode,
    setShowdownPreview: store.setShowdownPreview,
    setShowdownResult: store.setShowdownResult
  }
}

/**
 * 消息状态 hooks
 */
export function useMessages() {
  const store = useStore()
  const messages = store.state.messages
  
  return {
    chatMessages: computed(() => messages.chat),
    actionMessages: computed(() => messages.action),
    addChatMessage: store.addChatMessage,
    addActionMessage: store.addActionMessage
  }
}
