/**
 * 游戏服务
 * 统一导出游戏相关功能
 */
import { getRooms, getClients, send } from './RoomService.js'
import { handleStartGame as startGame } from './game/GameLifecycle.js'
import { handlePlayerAction as playerAction } from './game/PlayerActionHandler.js'
import { processAITurn } from './game/AITurnProcessor.js'
import { GameEngine } from '../game/GameEngine.js'

const rooms = getRooms()
const clients = getClients()

// ==================== 导出的处理函数 ====================

export function handleStartGame(clientId) {
  startGame(clientId, rooms, clients, send)
}

export function handlePlayerAction(clientId, data) {
  playerAction(clientId, data, rooms, clients, send)
}

export { processAITurn }

// ==================== 断线处理 ====================

export function handleDisconnect(clientId) {
  const client = clients.get(clientId)
  if (!client?.roomCode) return
  
  const room = rooms.get(client.roomCode)
  if (!room) return
  
  const wasHost = room.isHost(clientId)
  room.removeClient(clientId, true)
  
  console.log(`👋 玩家断线: ${client.playerName} <- ${client.roomCode}`)
  
  const hasDisconnectedPlayers = room.disconnectedPlayers.size > 0
  const hasConnectedPlayers = room.clients.size > 0
  
  if (!hasConnectedPlayers && !hasDisconnectedPlayers) {
    rooms.delete(client.roomCode)
    console.log(`🚪 房间关闭（无玩家）: ${client.roomCode}`)
  } else if (wasHost && hasConnectedPlayers) {
    const newHost = room.transferHost()
    if (newHost) {
      room.broadcast({ type: 'host_changed', newHostName: newHost.newHostName })
    }
  } else if (!hasConnectedPlayers && hasDisconnectedPlayers) {
    console.log(`⏸️ 房间保持存活，等待玩家重连: ${client.roomCode}`)
  }
  
  if (hasConnectedPlayers) {
    room.broadcast({
      type: 'player_disconnected',
      playerName: client.playerName,
      players: room.getPlayerList()
    })
  }
}


// ==================== 重连处理 ====================

export function handleReconnect(clientId, data) {
  const { roomCode, playerName } = data
  const room = rooms.get(roomCode)
  const client = clients.get(clientId)
  
  if (!room) {
    send(client.ws, { type: 'reconnect_failed', message: '房间不存在' })
    return
  }
  
  const reconnectInfo = room.canReconnect(playerName)
  if (!reconnectInfo) {
    send(client.ws, { type: 'reconnect_failed', message: '无法重连，请重新加入' })
    return
  }
  
  const result = room.reconnectClient(clientId, client.ws, playerName, reconnectInfo.seatIndex)
  if (!result) {
    send(client.ws, { type: 'reconnect_failed', message: '重连失败' })
    return
  }
  
  client.roomCode = roomCode
  client.playerName = playerName
  
  if (reconnectInfo.seatIndex === room.hostSeatIndex || room.clients.size === 1) {
    room.hostId = clientId
    room.hostName = playerName
  }
  
  const isHost = room.isHost(clientId)
  console.log(`🔄 玩家重连成功: ${playerName} -> ${roomCode} (房主: ${isHost})`)
  
  send(client.ws, {
    type: 'reconnect_success',
    roomCode,
    seatIndex: result.seatIndex,
    players: room.getPlayerList(),
    isHost,
    gameStarted: room.gameStarted
  })
  
  room.broadcast({
    type: 'player_reconnected',
    playerName,
    seatIndex: result.seatIndex,
    players: room.getPlayerList()
  }, clientId)
  
  if (room.gameStarted) {
    const state = room.game.getStateForPlayer(result.seatIndex)
    send(client.ws, { type: 'game_state', state })
  }
}


// ==================== 批量测试 ====================

export async function handleBatchTest(clientId, data) {
  const client = clients.get(clientId)
  const { rounds, players, aiList } = data
  
  if (!rounds || rounds < 1) {
    send(client.ws, { type: 'batch_test_result', success: false, message: '无效的测试局数' })
    return
  }
  
  const stats = {}
  const allParticipants = [
    ...players.map(p => ({ name: p.name, type: 'simulated', behavior: p.behavior })),
    ...aiList.map(name => ({ name, type: 'ai', behavior: null }))
  ]
  
  allParticipants.forEach(p => {
    stats[p.name] = { wins: 0, total: 0, type: p.type }
  })
  
  console.log(`🧪 开始批量测试: ${rounds} 局`)
  
  for (let round = 0; round < rounds; round++) {
    const game = new GameEngine('TEST', null)
    
    allParticipants.forEach((p, idx) => {
      game.addPlayer(idx, p.name, 1000, p.type === 'ai' ? 'ai' : 'human')
    })
    
    game.startRound()
    game.finishDealing()
    
    let maxActions = 100
    while (game.state.phase === 'betting' && maxActions-- > 0) {
      const currentIdx = game.state.currentPlayerIndex
      const currentPlayer = game.seats[currentIdx]
      if (!currentPlayer || currentPlayer.folded) break
      
      let decision
      if (currentPlayer.type === 'ai') {
        decision = await game.makeAIDecision(currentIdx)
      } else {
        const participant = allParticipants.find(p => p.name === currentPlayer.name)
        decision = simulatePlayerDecision(currentPlayer, participant?.behavior || 'balanced', game)
      }
      
      if (!decision) break
      
      const result = game.handleAction(currentIdx, decision.action, decision.amount)
      if (!result.success || result.action === 'gameEnd') break
    }
    
    const winner = game.state.winner
    if (winner) {
      allParticipants.forEach(p => {
        stats[p.name].total++
        if (winner.name === p.name) stats[p.name].wins++
      })
    }
    
    if (round % 10 === 0 || round === rounds - 1) {
      const progress = Math.round((round + 1) / rounds * 100)
      send(client.ws, { type: 'batch_test_progress', progress })
    }
  }
  
  const results = Object.entries(stats).map(([name, s]) => ({
    name,
    type: s.type,
    wins: s.wins,
    total: s.total,
    winRate: s.total > 0 ? Math.round(s.wins / s.total * 100) : 0
  })).sort((a, b) => b.winRate - a.winRate)
  
  console.log(`✅ 批量测试完成`)
  send(client.ws, { type: 'batch_test_result', success: true, results })
}


// 模拟玩家决策
function simulatePlayerDecision(player, behavior, game) {
  const callAmount = game.getCallAmountForPlayer(player)
  const chipPressure = callAmount / player.chips
  const hand = player.hand?.getType()
  const handStrength = hand?.weight || 0
  const canShowdown = game.state.firstRoundComplete
  const activePlayers = game.getActivePlayers()
  
  switch (behavior) {
    case 'aggressive':
      if (!player.hasPeeked && Math.random() < 0.5) return { action: 'peek' }
      if (canShowdown && handStrength >= 5000 && activePlayers.length === 2) {
        const target = activePlayers.find(p => p.id !== player.id)
        if (target) return { action: 'showdown', amount: target.id }
      }
      if (Math.random() < 0.4 && player.chips > callAmount + 20) {
        return { action: 'raise', amount: 20 + Math.floor(Math.random() * 30) }
      }
      if (player.hasPeeked && handStrength < 3000 && chipPressure > 0.3 && Math.random() < 0.4) {
        return { action: 'fold' }
      }
      return { action: 'call' }
      
    case 'tight':
      if (!player.hasPeeked) return { action: 'peek' }
      if (handStrength < 4000 && chipPressure > 0.15) return { action: 'fold' }
      if (canShowdown && handStrength >= 6000 && activePlayers.length === 2) {
        const target = activePlayers.find(p => p.id !== player.id)
        if (target) return { action: 'showdown', amount: target.id }
      }
      return { action: 'call' }
      
    case 'passive':
      if (!player.hasPeeked && Math.random() < 0.6) return { action: 'peek' }
      if (player.hasPeeked && handStrength < 3500 && chipPressure > 0.25 && Math.random() < 0.5) {
        return { action: 'fold' }
      }
      return { action: 'call' }
      
    case 'random':
      if (!player.hasPeeked && Math.random() < 0.5) return { action: 'peek' }
      const roll = Math.random()
      if (roll < 0.15) return { action: 'fold' }
      if (roll < 0.25 && player.chips > callAmount + 15) return { action: 'raise', amount: 15 }
      if (roll < 0.35 && canShowdown && activePlayers.length === 2) {
        const target = activePlayers.find(p => p.id !== player.id)
        if (target) return { action: 'showdown', amount: target.id }
      }
      return { action: 'call' }
      
    default:
      if (!player.hasPeeked && Math.random() < 0.5) return { action: 'peek' }
      if (player.hasPeeked && handStrength < 3500 && chipPressure > 0.2 && Math.random() < 0.4) {
        return { action: 'fold' }
      }
      if (canShowdown && handStrength >= 5500 && activePlayers.length === 2 && Math.random() < 0.5) {
        const target = activePlayers.find(p => p.id !== player.id)
        if (target) return { action: 'showdown', amount: target.id }
      }
      if (Math.random() < 0.15 && player.chips > callAmount + 15) {
        return { action: 'raise', amount: 15 }
      }
      return { action: 'call' }
  }
}
