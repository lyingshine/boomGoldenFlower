/**
 * AI 回合处理器
 * 处理 AI 玩家的决策和行动
 */
import { recordShowdownResult, updateUsersGameStats } from './GameRecorder.js'

export function processAITurn(room) {
  const game = room.game
  const currentPlayer = game.seats[game.state.currentPlayerIndex]
  
  if (!currentPlayer || currentPlayer.type !== 'ai' || game.state.phase !== 'betting') {
    return
  }
  
  const activePlayers = game.getActivePlayers()
  const humanPlayers = activePlayers.filter(p => p.type === 'human' && !p.folded)
  const onlyAI = humanPlayers.length === 0
  const delay = onlyAI ? 800 : 1500
  
  setTimeout(async () => {
    if (game.state.phase !== 'betting') return
    
    const seatIndex = game.state.currentPlayerIndex
    const player = game.seats[seatIndex]
    const decision = await game.makeAIDecision(seatIndex)
    if (!decision) return
    
    console.log(`🤖 AI决策: 座位${seatIndex} ${decision.action}`)
    
    const result = game.handleAction(seatIndex, decision.action, decision.amount)
    
    if (result.success) {
      // 记录开牌结果
      if (result.action === 'showdown' || (result.action === 'gameEnd' && result.challengerHand)) {
        recordShowdownResult(room, seatIndex, result)
      }
      
      // 游戏结束时保存档案
      if (result.action === 'gameEnd') {
        updateUsersGameStats(room, result)
        room.savePlayerProfiles().catch(e => console.error('保存玩家档案失败:', e.message))
        
        // 记录 AI 决策结果（用于自修正）
        const winner = result.winner
        game.seats.forEach(p => {
          if (p && p.type === 'ai') {
            const won = winner && winner.seatIndex === p.id
            const profit = won ? result.pot : -p.currentBet
            game.aiDecisionMaker.recordDecisionResult(p.name, won, profit)
          }
        })
      }
      
      // 生成 AI 聊天消息
      const personality = game.aiDecisionMaker.getPersonality(player.name).config
      const opponentTilting = activePlayers.some(p => {
        if (p.id === seatIndex) return false
        // 使用玩家档案检测倾斜状态
        const profile = room.playerProfiles?.get(p.name)
        if (!profile) return false
        return game.aiDecisionMaker.detectTiltLevel(profile, p) > 0.4
      })
      const messageContext = {
        hasStrongHand: player.hasPeeked && player.hand.getType().weight >= 7000,
        opponentAggressive: activePlayers.some(p => p.id !== seatIndex && p.lastBetAmount > 25),
        personality,
        opponentTilting,
        isBluffing: decision.action === 'raise' && player.hasPeeked && player.hand.getType().weight < 4000
      }
      const chatMessage = game.generateAIMessage(seatIndex, decision.action, messageContext)
      
      room.broadcast({ type: 'action_result', ...result, isAI: true })
      broadcastActionMessage(room, seatIndex, decision.action, result)
      
      if (chatMessage) {
        room.broadcast({ type: 'chat_message', ...chatMessage, isAI: true })
      }
      
      room.broadcastGameState()
      
      if (result.action !== 'gameEnd') {
        processAITurn(room)
      }
    }
  }, delay)
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
