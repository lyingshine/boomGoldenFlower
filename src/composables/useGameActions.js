/**
 * 游戏动作 Composable
 * 管理玩家操作
 */
import { inject } from 'vue'

export function useGameActions(networkManager, userManager) {
  const store = inject('store')
  
  // 发送动作到服务器
  const sendAction = (action, amount = 0) => {
    networkManager.value.sendAction(action, amount)
  }
  
  // 开始游戏
  const startNewGame = () => {
    if (!networkManager.value.isHost) return
    networkManager.value.startGame()
  }
  
  // 跟注
  const onCall = (amount, callAmount) => {
    if (amount > callAmount) {
      networkManager.value.sendAction('raise', amount - callAmount)
    } else {
      networkManager.value.sendAction('call')
    }
  }
  
  // 加注
  const onRaise = (amount) => {
    networkManager.value.sendAction('raise', amount)
  }
  
  // 焖牌下注
  const onBlind = (amount) => {
    networkManager.value.sendAction('blind', amount)
  }
  
  // 开牌
  const onShowdown = (targetSeatIndex) => {
    networkManager.value.sendAction('showdown', targetSeatIndex)
  }
  
  // 点击卡牌（看牌）
  const onCardClick = (player, mySeatIndex) => {
    if (player.id === mySeatIndex && !player.hasPeeked) {
      sendAction('peek')
    }
  }
  
  // 点击玩家（开牌模式）
  const onPlayerClick = (seatIndex, showdownMode, allSeats, pendingShowdownTarget) => {
    if (showdownMode) {
      const targetPlayer = allSeats[seatIndex]
      if (targetPlayer) {
        pendingShowdownTarget.value = seatIndex
        onShowdown(seatIndex)
        store.setShowdownMode(false)
      }
    }
  }
  
  // 离开大厅
  const onLeaveLobby = () => {
    if (store.state.room.roomCode) {
      networkManager.value.leaveRoom()
    }
    store.resetRoom()
    store.resetGame()
  }
  
  // 返回大厅
  const onBackToLobby = async (options = {}) => {
    if (options.manual) {
      networkManager.value.clearSession()
    }
    onLeaveLobby()
    await refreshUserData()
    store.setLobbyModal(true)
  }
  
  // 登出
  const onLogout = (options = {}) => {
    if (options.manual) {
      networkManager.value.clearSession()
    }
    onLeaveLobby()
    userManager.value.logout()
    store.setLoginModal(true)
    store.setLobbyModal(false)
  }
  
  // 刷新用户数据
  const refreshUserData = async () => {
    const user = userManager.value.getCurrentUser()
    if (user && user.username) {
      try {
        await networkManager.value.connect()
        const result = await networkManager.value.getUser(user.username)
        if (result.success && result.user) {
          userManager.value.updateUser(result.user)
        }
      } catch (e) {
        console.error('刷新用户数据失败:', e)
      }
    }
  }
  
  // 自动重连
  const tryAutoReconnect = async () => {
    const session = networkManager.value.getSavedSession()
    if (session && session.roomCode) {
      console.log('🔄 发现保存的会话，自动重连中...')
      store.setLoading(true, '正在重连对局...')
      try {
        await networkManager.value.connect()
        await networkManager.value.reconnectToRoom(session.roomCode)
      } catch (e) {
        console.log('自动重连失败:', e)
        networkManager.value.clearSession()
      } finally {
        store.setLoading(false)
      }
    }
  }
  
  return {
    sendAction,
    startNewGame,
    onCall,
    onRaise,
    onBlind,
    onShowdown,
    onCardClick,
    onPlayerClick,
    onLeaveLobby,
    onBackToLobby,
    onLogout,
    tryAutoReconnect
  }
}
