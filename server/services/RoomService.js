/**
 * 房间服务
 * 统一导出房间相关功能
 */
import { getUsersCache } from './UserService.js'
import { getClients, generateId, send } from './room/ClientManager.js'
import { getRooms, generateRoomCode, getRoomList, verifyRoom, createRoomInstance, deleteRoom } from './room/RoomManager.js'
import { updateUserChipsOnLeave, updateUserChips, startDisconnectChecker as startChecker } from './room/ChipsManager.js'

// 重新导出基础功能
export { getClients, generateId, send, getRooms, getRoomList, verifyRoom, updateUserChips }

const rooms = getRooms()
const clients = getClients()

// 创建房间
export function createRoom(clientId, playerName, ante = 10) {
  const usersCache = getUsersCache()
  const roomCode = generateRoomCode()
  const client = clients.get(clientId)
  
  const user = usersCache[playerName]
  const userChips = user?.chips || 1000
  const avatarUrl = user?.avatarUrl || null
  
  const room = createRoomInstance(roomCode, clientId, playerName)
  room.ante = ante
  room.game.state.currentBet = room.ante
  
  room.addClient(clientId, client.ws, playerName, userChips, avatarUrl)
  
  client.roomCode = roomCode
  client.playerName = playerName
  
  console.log(`🏠 房间创建: ${roomCode} by ${playerName}, 底注: ${room.ante}`)
  
  return {
    roomCode,
    seatIndex: room.getSeatIndex(clientId),
    players: room.getPlayerList(),
    ante: room.ante
  }
}

// 加入房间
export function joinRoom(clientId, roomCode, playerName) {
  const usersCache = getUsersCache()
  const room = rooms.get(roomCode)
  const client = clients.get(clientId)
  
  if (!room) {
    return { success: false, message: '房间不存在' }
  }
  
  const user = usersCache[playerName]
  const userChips = user?.chips || 1000
  const avatarUrl = user?.avatarUrl || null
  
  const result = room.addClient(clientId, client.ws, playerName, userChips, avatarUrl)
  if (!result) {
    return { success: false, message: '房间已满' }
  }
  
  client.roomCode = roomCode
  client.playerName = playerName
  
  const waitingMsg = result.waitingForNextRound ? ' (等待下一局)' : ''
  console.log(`👤 玩家加入: ${playerName} -> ${roomCode} (筹码: ${userChips})${waitingMsg}`)
  
  return {
    success: true,
    roomCode,
    seatIndex: result.seatIndex,
    players: room.getPlayerList(),
    isHost: false,
    gameStarted: room.gameStarted,
    waitingForNextRound: result.waitingForNextRound,
    room
  }
}


// 离开房间
export function leaveRoom(clientId) {
  const client = clients.get(clientId)
  if (!client?.roomCode) return null
  
  const room = rooms.get(client.roomCode)
  if (!room) return null
  
  const roomClient = room.clients.get(clientId)
  const roomCode = client.roomCode
  const playerName = client.playerName
  
  // 如果游戏进行中，先让玩家弃牌
  if (roomClient && room.gameStarted && room.game.state.phase === 'betting') {
    const player = room.game.seats[roomClient.seatIndex]
    if (player && !player.folded) {
      player.fold()
      player.hasActed = true
      console.log(`🃏 玩家离开，自动弃牌: ${playerName}`)
      
      const active = room.game.getActivePlayers()
      if (active.length <= 1) {
        room.game.endGame()
      } else if (room.game.state.currentPlayerIndex === roomClient.seatIndex) {
        room.game.nextPlayer()
      }
    }
  }
  
  // 主动离开时更新用户筹码
  if (roomClient) {
    updateUserChipsOnLeave(playerName, roomClient.seatIndex, room, false)
  }
  
  const wasHost = room.isHost(clientId)
  room.removeClient(clientId)
  
  console.log(`👋 玩家离开: ${playerName} <- ${roomCode}`)
  
  client.roomCode = null
  
  if (wasHost || room.clients.size === 0) {
    deleteRoom(roomCode)
    console.log(`🚪 房间关闭: ${roomCode}`)
    return { closed: true, roomCode, playerName, room }
  }
  
  return { closed: false, roomCode, playerName, room, players: room.getPlayerList() }
}

// 添加AI
export function addAI(clientId) {
  const client = clients.get(clientId)
  const room = rooms.get(client?.roomCode)
  
  if (!room || !room.isHost(clientId)) return null
  
  const result = room.addAI()
  if (result) {
    console.log(`🤖 添加AI: ${result.name} 座位${result.seatIndex}`)
    return { ...result, players: room.getPlayerList(), room }
  }
  return null
}

// 更新底注
export function updateAnte(clientId, ante) {
  const client = clients.get(clientId)
  const room = rooms.get(client?.roomCode)
  
  if (!room || !room.isHost(clientId)) return null
  
  if (ante !== undefined && ante > 0) {
    room.ante = ante
    room.game.state.currentBet = ante
    console.log(`💰 更新房间底注: ¥${ante}`)
    return { ante: room.ante, room }
  }
  return null
}

// 移除AI
export function removeAI(clientId, seatIndex) {
  const client = clients.get(clientId)
  const room = rooms.get(client?.roomCode)
  
  if (!room || !room.isHost(clientId)) return null
  
  if (room.removeAI(seatIndex)) {
    console.log(`🤖 移除AI: 座位${seatIndex}`)
    return { seatIndex, players: room.getPlayerList(), room }
  }
  return null
}

// 启动断线检查器
export function startDisconnectChecker() {
  startChecker(rooms)
}
