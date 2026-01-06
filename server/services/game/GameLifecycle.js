/**
 * 游戏生命周期管理
 * 处理游戏开始、结束等核心流程
 */
import { updateUserChips } from '../RoomService.js'
import { processAITurn } from './AITurnProcessor.js'

export function handleStartGame(clientId, rooms, clients, send) {
  const client = clients.get(clientId)
  const room = rooms.get(client?.roomCode)
  
  if (!room || !room.isHost(clientId)) return
  
  const playerCount = room.getPlayerList().length
  
  // 检查人数
  if (playerCount < 2) {
    console.log(`🎮 玩家不足: ${room.roomCode}，需要至少2人`)
    send(client.ws, { type: 'start_failed', message: '至少需要2名玩家' })
    return
  }
  
  // 第一次点击：标记游戏开始，进入牌桌，但不发牌
  if (!room.gameStarted) {
    room.gameStarted = true
    console.log(`🎮 进入牌桌: ${room.roomCode}，等待发牌`)
    room.broadcast({ type: 'game_started' })
    room.broadcastGameState()
    return
  }
  
  // 第二次点击：检查是否可以开始新一局
  // waiting 或 ended 状态都可以开始
  if (room.game.state.phase !== 'waiting' && room.game.state.phase !== 'ended') {
    console.log(`⚠️ 游戏已在进行中: ${room.roomCode}, phase: ${room.game.state.phase}`)
    send(client.ws, { type: 'start_failed', message: '游戏进行中，请等待本局结束' })
    return
  }
  
  // 开始发牌
  const result = room.game.startRound(room.hostSeatIndex, room.ante || 10)
  if (!result.success) {
    send(client.ws, { type: 'start_failed', message: result.error })
    return
  }
  
  console.log(`🎮 开始发牌: ${room.roomCode}`)
  
  updateUserChips(room)
  room.broadcastGameState()
  
  // 发牌动画结束后切换到下注阶段
  const lastCardDelay = (playerCount * 3 - 1) * 300
  const dealingDuration = lastCardDelay + 250 + 100
  
  setTimeout(() => {
    room.game.finishDealing()
    room.broadcastGameState()
    processAITurn(room)
  }, dealingDuration)
}
