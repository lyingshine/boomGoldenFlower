/**
 * 网络处理器 Composable
 * 管理 WebSocket 消息处理
 */
import { inject, ref } from 'vue'

export function useNetworkHandlers(networkManager, effects, userManager) {
  const store = inject('store')
  const pendingShowdownTarget = ref(null)
  
  // 用于追踪前一个状态
  const prevPhase = ref('waiting')
  const prevTurn = ref(-1)
  
  // 设置所有网络回调
  const setupCallbacks = () => {
    networkManager.value.onRoomCreated = handleRoomCreated
    networkManager.value.onRoomJoined = handleRoomJoined
    networkManager.value.onReconnectSuccess = handleReconnectSuccess
    networkManager.value.onReconnectFailed = handleReconnectFailed
    networkManager.value.onPlayerDisconnected = handlePlayerDisconnected
    networkManager.value.onPlayerReconnected = handlePlayerReconnected
    networkManager.value.onPlayerJoined = handlePlayerJoined
    networkManager.value.onPlayerLeft = handlePlayerLeft
    networkManager.value.onRoomClosed = handleRoomClosed
    networkManager.value.onAIAdded = handleAIAdded
    networkManager.value.onAIRemoved = handleAIRemoved
    networkManager.value.onGameStarted = handleGameStarted
    networkManager.value.onGameState = handleGameState
    networkManager.value.onActionResult = handleActionResult
    networkManager.value.onActionFailed = handleActionFailed
    networkManager.value.onChatMessage = (msg) => store.addChatMessage(msg)
    networkManager.value.onActionMessage = (msg) => store.addActionMessage(msg)
  }
  
  const handleRoomCreated = (msg) => {
    store.setRoomCode(msg.roomCode)
    store.setMySeatIndex(msg.seatIndex)
    store.setLobbyPlayers(msg.players)
  }
  
  const handleRoomJoined = (msg) => {
    store.setRoomCode(msg.roomCode)
    store.setMySeatIndex(msg.seatIndex)
    store.setLobbyPlayers(msg.players)
    if (msg.gameStarted) {
      store.setLobbyModal(false)
    }
  }
  
  const handleReconnectSuccess = (msg) => {
    store.setRoomCode(msg.roomCode)
    store.setMySeatIndex(msg.seatIndex)
    store.setLobbyPlayers(msg.players)
    store.setLoginModal(false)
    
    if (msg.gameStarted) {
      store.setLobbyModal(false)
      effects.playTurnSound()
    } else {
      store.setLobbyModal(true)
    }
    console.log('🔄 重连成功，房间:', msg.roomCode)
  }
  
  const handleReconnectFailed = (msg) => {
    console.log('❌ 重连失败:', msg)
    networkManager.value.clearSession()
    store.setLobbyModal(true)
  }
  
  const handlePlayerDisconnected = (msg) => {
    console.log(`⏸️ 玩家断线: ${msg.playerName}`)
    store.setLobbyPlayers(msg.players)
  }
  
  const handlePlayerReconnected = (msg) => {
    console.log(`🔄 玩家重连: ${msg.playerName}`)
    store.setLobbyPlayers(msg.players)
  }
  
  const handlePlayerJoined = (msg) => {
    store.setLobbyPlayers(msg.players)
    if (!store.state.ui.showLobbyModal) {
      store.updateSeatsFromPlayers(msg.players)
    }
  }
  
  const handlePlayerLeft = (msg) => {
    store.setLobbyPlayers(msg.players)
    if (!store.state.ui.showLobbyModal) {
      store.updateSeatsFromPlayers(msg.players)
    }
  }
  
  const handleRoomClosed = (message) => {
    alert(message)
    // 需要从外部传入 onLeaveLobby
  }
  
  const handleAIAdded = (msg) => {
    store.setLobbyPlayers(msg.players)
  }
  
  const handleAIRemoved = (msg) => {
    store.setLobbyPlayers(msg.players)
  }
  
  const handleGameStarted = (msg) => {
    // 进入牌桌
    store.setLobbyModal(false)
  }
  
  const handleGameState = (msg) => {
    const state = msg.state || msg
    const isFull = msg.full !== false
    
    const oldPhase = prevPhase.value
    const oldTurn = prevTurn.value
    
    store.updateGameState(state, isFull)
    
    if (store.state.game.phase !== 'waiting' && store.state.ui.showLobbyModal) {
      store.setLobbyModal(false)
    }
    
    // 发牌音效 - 进入 dealing 阶段时播放
    const players = store.state.game.seats.filter(p => p)
    if (store.state.game.phase === 'dealing' && oldPhase !== 'dealing') {
      effects.playDealingSound(players.length)
    }
    
    // 轮次提示音
    const mySeatIndex = store.state.game.mySeatIndex
    const isMyTurn = mySeatIndex === store.state.game.currentPlayerIndex
    if (store.state.game.phase === 'betting' && isMyTurn && oldTurn !== store.state.game.currentPlayerIndex) {
      effects.playTurnSound()
    }
    
    // 游戏结束处理
    if (store.state.game.phase === 'ended' && oldPhase !== 'ended') {
      handleGameEnd(mySeatIndex)
    }
    
    // 更新前一个状态
    prevPhase.value = store.state.game.phase
    prevTurn.value = store.state.game.currentPlayerIndex
  }
  
  const handleGameEnd = (mySeatIndex) => {
    const winner = store.state.game.winner
    const isMyWin = winner && winner.seatIndex === mySeatIndex
    
    store.updateWinStreak(isMyWin)
    updateLocalUserStats(isMyWin, mySeatIndex)
    effects.triggerWinEffects(winner, store.state.game.pot, store.state.game.seats)
    effects.triggerStreakEffect(store.state.stats.winStreak, isMyWin)
    
    if (winner?.handType) {
      effects.playHandTypeSound(winner.handType)
    }
    
    effects.playWinLoseSound(isMyWin)
  }
  
  const handleActionResult = (result) => {
    effects.playActionSound(result.action, result.amount)
    
    if (result.action === 'showdown') {
      const challengerName = store.state.game.seats[result.seatIndex]?.name || '玩家'
      const targetName = store.state.game.seats[result.targetSeatIndex]?.name || '玩家'
      effects.triggerVSEffect(challengerName, targetName)
      
      // 焖牌赢家强制看牌
      if (result.winnerForcePeeked && result.winnerSeatIndex === store.state.game.mySeatIndex && result.winnerCards) {
        const myPlayer = store.state.game.seats[store.state.game.mySeatIndex]
        if (myPlayer) {
          myPlayer.cards = result.winnerCards
          myPlayer.hasPeeked = true
        }
      }
      
      setTimeout(() => {
        showShowdownResult(result)
      }, 1500)
    }
  }
  
  const handleActionFailed = (msg) => {
    alert(msg)
  }
  
  const showShowdownResult = (result) => {
    const challengerName = store.state.game.seats[result.seatIndex]?.name || '玩家'
    const targetName = store.state.game.seats[result.targetSeatIndex]?.name || '玩家'
    
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
    
    if (pendingShowdownTarget.value !== null && result.targetCards) {
      store.setShowdownPreview({
        targetName: targetName,
        targetSeatIndex: result.targetSeatIndex,
        cards: result.targetCards
      })
      pendingShowdownTarget.value = null
      setTimeout(() => {
        store.setShowdownPreview(null)
      }, 2500)
    }
    
    store.setShowdownResult({
      challengerName,
      targetName,
      winnerName: result.winnerName,
      loserName: result.loserName,
      challengerHand: formatHand(result.challengerHand),
      targetHand: formatHand(result.targetHand)
    })
    
    setTimeout(() => {
      store.setShowdownResult(null)
    }, 8000)
  }
  
  const updateLocalUserStats = (isWin, mySeatIndex) => {
    const user = userManager.value?.getCurrentUser()
    if (!user) return
    
    const myPlayer = store.state.game.seats[mySeatIndex]
    const updates = {
      totalGames: (user.totalGames || 0) + 1,
      wins: (user.wins || 0) + (isWin ? 1 : 0),
      losses: (user.losses || 0) + (isWin ? 0 : 1),
      chips: myPlayer?.chips ?? user.chips
    }
    
    // 更新本地数据
    userManager.value.updateUser(updates)
    
    // 同步到服务器
    if (networkManager.value) {
      networkManager.value.updateGameStats(user.username, {
        totalGames: updates.totalGames,
        wins: updates.wins,
        losses: updates.losses,
        chips: updates.chips
      })
    }
  }
  
  return {
    setupCallbacks,
    pendingShowdownTarget,
    handleRoomClosed
  }
}
