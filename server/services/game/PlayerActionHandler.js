/**
 * 玩家操作处理
 * 处理玩家的各种游戏操作
 */
import { updateUserChips } from '../RoomService.js'
import { processAITurn } from './AITurnProcessor.js'
import { recordPlayerBehavior, recordShowdownResult, updateUsersGameStats, recordPressureWin } from './GameRecorder.js'

export function handlePlayerAction(clientId, data, rooms, clients, send) {
  const client = clients.get(clientId)
  const room = rooms.get(client?.roomCode)
  
  if (!room) return
  
  const seatIndex = room.getSeatIndex(clientId)
  if (seatIndex === -1) return
  
  const { action, amount } = data
  console.log(`🎯 玩家操作: 座位${seatIndex} ${action} ${amount || ''}`)
  
  const result = room.game.handleAction(seatIndex, action, amount)
  
  if (!result.success) {
    send(client.ws, { type: 'action_failed', message: result.error })
    return
  }
  
  // 记录玩家行为到档案
  recordPlayerBehavior(room, seatIndex, action, amount, result)
  
  // 记录开牌结果
  if (result.action === 'showdown' || (result.action === 'gameEnd' && result.challengerHand)) {
    recordShowdownResult(room, seatIndex, result)
  }
  
  // 广播操作结果
  room.broadcast({ type: 'action_result', ...result })
  
  // 发送操作消息
  broadcastActionMessage(room, seatIndex, action, result)
  
  room.broadcastGameState()
  updateUserChips(room)
  
  // 游戏结束时更新战绩
  if (result.action === 'gameEnd') {
    updateUsersGameStats(room, result)
    // 记录施压获胜（非开牌获胜）
    recordPressureWin(room, result)
    room.savePlayerProfiles().catch(e => console.error('保存玩家档案失败:', e.message))
  }
  
  // 处理AI回合
  if (result.action !== 'gameEnd') {
    processAITurn(room)
  }
}

// 广播操作消息
function broadcastActionMessage(room, seatIndex, action, result) {
  const actionMessages = {
    'call': `跟注 ¥${result.amount}`,
    'raise': `加注 ¥${result.amount}`,
    'fold': '弃牌',
    'check': '过牌',
    'allin': `ALL IN ¥${result.amount}`,
    'blind': `焖注 ¥${result.amount}`,
    'peek': '看牌',
    'showdown': '开牌'
  }
  const actionMsg = actionMessages[result.action] || actionMessages[action]
  if (actionMsg) {
    room.broadcast({
      type: 'action_message',
      seatIndex,
      message: actionMsg,
      actionType: result.action || action
    })
  }
}
