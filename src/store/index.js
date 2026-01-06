/**
 * 前端状态管理中心
 * 使用 Vue 3 reactive 实现简单的状态管理
 */
import { reactive, readonly } from 'vue'

/**
 * 创建状态存储
 */
function createStore() {
  // 私有状态
  const state = reactive({
    // UI 状态
    ui: {
      showLoginModal: true,
      showLobbyModal: false,
      isLoading: false,
      loadingText: '',
      showdownMode: false,
      showdownPreview: null,
      showdownResultDisplay: null
    },
    
    // 用户状态
    user: {
      currentUser: null,
      isLoggedIn: false
    },
    
    // 房间状态
    room: {
      roomCode: '',
      isHost: false,
      lobbyPlayers: []
    },
    
    // 游戏状态
    game: {
      phase: 'waiting',
      round: 0,
      pot: 0,
      currentBet: 10,
      currentPlayerIndex: 0,
      mySeatIndex: -1,
      seats: new Array(8).fill(null),
      winner: null,
      showdownReady: false,
      firstRoundComplete: false,
      showdownResult: null
    },
    
    // 消息状态
    messages: {
      chat: [],
      action: []
    },
    
    // 统计状态
    stats: {
      winStreak: 0
    }
  })

  // Actions
  const actions = {
    // UI Actions
    setLoginModal(show) {
      state.ui.showLoginModal = show
    },
    setLobbyModal(show) {
      state.ui.showLobbyModal = show
    },
    setLoading(loading, text = '') {
      state.ui.isLoading = loading
      state.ui.loadingText = text
    },
    setShowdownMode(mode) {
      state.ui.showdownMode = mode
    },
    setShowdownPreview(preview) {
      state.ui.showdownPreview = preview
    },
    setShowdownResult(result) {
      state.ui.showdownResultDisplay = result
    },

    // User Actions
    setUser(user) {
      state.user.currentUser = user
      state.user.isLoggedIn = !!user
    },
    updateUser(updates) {
      if (state.user.currentUser) {
        Object.assign(state.user.currentUser, updates)
      }
    },
    logout() {
      state.user.currentUser = null
      state.user.isLoggedIn = false
    },

    // Room Actions
    setRoomCode(code) {
      state.room.roomCode = code
    },
    setIsHost(isHost) {
      state.room.isHost = isHost
    },
    setLobbyPlayers(players) {
      state.room.lobbyPlayers = players.map((p, i) => ({
        seatIndex: p.seatIndex ?? i,
        name: p.name,
        type: p.type,
        chips: p.chips || 1000,
        avatarUrl: p.avatarUrl || null,
        waitingForNextRound: p.waitingForNextRound || false
      }))
    },
    resetRoom() {
      state.room.roomCode = ''
      state.room.isHost = false
      state.room.lobbyPlayers = []
    },

    // Game Actions
    setMySeatIndex(index) {
      state.game.mySeatIndex = index
    },
    updateGameState(serverState) {
      if (!serverState) return
      
      state.game.phase = serverState.phase || 'waiting'
      state.game.round = serverState.round || 0
      state.game.pot = serverState.pot || 0
      state.game.currentBet = serverState.currentBet || 10
      state.game.currentPlayerIndex = serverState.currentPlayerIndex || 0
      state.game.winner = serverState.winner || null
      state.game.showdownReady = serverState.showdownReady || false
      state.game.firstRoundComplete = serverState.firstRoundComplete || false
      state.game.showdownResult = serverState.showdownResult || null
      
      if (serverState.seats) {
        state.game.seats = serverState.seats.map(seat => {
          if (!seat) return null
          return {
            id: seat.id,
            name: seat.name,
            chips: seat.chips,
            type: seat.type,
            avatarUrl: seat.avatarUrl || null,
            currentBet: seat.currentBet || 0,
            lastBetAmount: seat.lastBetAmount || 0,
            lastBetBlind: seat.lastBetBlind || false,
            folded: seat.folded || false,
            lostShowdown: seat.lostShowdown || false,
            hasPeeked: seat.hasPeeked || false,
            isAllIn: seat.isAllIn || false,
            cardCount: seat.cardCount || 0,
            cards: seat.cards || null,
            handType: seat.handType || null
          }
        })
      }
    },
    updateSeatsFromPlayers(players) {
      if (!players) return
      state.game.seats = new Array(8).fill(null)
      players.forEach(p => {
        const idx = p.seatIndex ?? p.id
        if (idx >= 0 && idx < 8) {
          state.game.seats[idx] = {
            id: idx,
            name: p.name,
            chips: p.chips || 1000,
            type: p.type,
            avatarUrl: p.avatarUrl || null,
            currentBet: 0,
            folded: false,
            hasPeeked: false,
            isAllIn: false,
            cardCount: 0,
            cards: null
          }
        }
      })
    },
    resetGame() {
      state.game.phase = 'waiting'
      state.game.round = 0
      state.game.pot = 0
      state.game.currentBet = 10
      state.game.currentPlayerIndex = 0
      state.game.seats = new Array(8).fill(null)
      state.game.winner = null
      state.game.showdownReady = false
      state.game.firstRoundComplete = false
      state.game.showdownResult = null
    },

    // Message Actions
    addChatMessage(msg) {
      const msgId = Date.now() + Math.random()
      // 移除同一玩家的旧消息
      state.messages.chat = state.messages.chat.filter(m => m.seatIndex !== msg.seatIndex)
      state.messages.chat.push({ ...msg, id: msgId })
      
      setTimeout(() => {
        state.messages.chat = state.messages.chat.filter(m => m.id !== msgId)
      }, 4000)
    },
    addActionMessage(msg) {
      const msgId = Date.now() + Math.random()
      state.messages.action = state.messages.action.filter(m => m.seatIndex !== msg.seatIndex)
      state.messages.action.push({ ...msg, id: msgId })
      
      setTimeout(() => {
        state.messages.action = state.messages.action.filter(m => m.id !== msgId)
      }, 3000)
    },

    // Stats Actions
    updateWinStreak(isWin) {
      if (isWin) {
        state.stats.winStreak = state.stats.winStreak > 0 ? state.stats.winStreak + 1 : 1
      } else {
        state.stats.winStreak = state.stats.winStreak < 0 ? state.stats.winStreak - 1 : -1
      }
    }
  }

  // Getters
  const getters = {
    // Game Getters
    myPlayer() {
      return state.game.seats[state.game.mySeatIndex]
    },
    isMyTurn() {
      return state.game.mySeatIndex === state.game.currentPlayerIndex
    },
    activePlayers() {
      return state.game.seats.filter(p => p && !p.folded)
    },
    players() {
      return state.game.seats.filter(p => p)
    }
  }

  return {
    state: readonly(state),
    ...actions,
    getters
  }
}

// 单例导出
export const store = createStore()
