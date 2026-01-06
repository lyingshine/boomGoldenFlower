/**
 * 房间服务
 * 处理房间创建、加入、离开等逻辑
 */
import { Room } from '../game/Room.js'
import { saveUserData, getUsersCache } from './UserService.js'

// 房间管理
const rooms = new Map()
// 客户端管理
const clients = new Map()

// 获取房间和客户端 Map
export function getRooms() {
  return rooms
}

export function getClients() {
  return clients
}

// 生成房间号
export function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// 生成客户端ID
export function generateId() {
  return Math.random().toString(36).substring(2, 15)
}

// 发送消息
export function send(ws, data) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(data))
  }
}

// 创建房间
export function createRoom(clientId, playerName, ante = 10) {
  const usersCache = getUsersCache()
  const roomCode = generateRoomCode()
  const client = clients.get(clientId)
  
  const userChips = usersCache[playerName]?.chips || 1000
  
  const room = new Room(roomCode, clientId, playerName)
  room.ante = ante
  room.game.state.currentBet = room.ante
  
  room.addClient(clientId, client.ws, playerName, userChips)
  rooms.set(roomCode, room)
  
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
  
  const userChips = usersCache[playerName]?.chips || 1000
  
  const result = room.addClient(clientId, client.ws, playerName, userChips)
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
    rooms.delete(roomCode)
    console.log(`🚪 房间关闭: ${roomCode}`)
    return { closed: true, roomCode, playerName, room }
  }
  
  return { closed: false, roomCode, playerName, room, players: room.getPlayerList() }
}

// 离开房间时更新用户筹码
export function updateUserChipsOnLeave(playerName, seatIndex, room, isDisconnect) {
  const usersCache = getUsersCache()
  if (!playerName || !usersCache[playerName]) return
  if (seatIndex === -1 || seatIndex === undefined) return
  
  const player = room.game.seats[seatIndex]
  if (!player || player.type !== 'human') return
  
  if (!isDisconnect) {
    usersCache[playerName].chips = player.chips
    saveUserData(playerName)
    console.log(`💰 主动离开，更新筹码: ${playerName} -> ${player.chips}`)
  } else {
    console.log(`⏸️ 断线，保留筹码等待重连: ${playerName}`)
  }
}

// 获取房间列表
export function getRoomList() {
  return Array.from(rooms.values()).map(r => r.getInfo())
}

// 验证房间
export function verifyRoom(roomCode) {
  const room = rooms.get(roomCode)
  return {
    exists: !!room,
    roomInfo: room ? room.getInfo() : null
  }
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

// 更新用户筹码（游戏中）
export function updateUserChips(room) {
  const usersCache = getUsersCache()
  room.game.seats.forEach(player => {
    if (player && player.type === 'human' && usersCache[player.name]) {
      usersCache[player.name].chips = player.chips
      saveUserData(player.name)
    }
  })
}

// 定期检查断线超时
export function startDisconnectChecker() {
  const usersCache = getUsersCache()
  setInterval(() => {
    rooms.forEach((room) => {
      room.disconnectedPlayers.forEach((info, seatIndex) => {
        if (Date.now() - info.disconnectedAt >= room.reconnectTimeout) {
          if (info.playerName && usersCache[info.playerName]) {
            usersCache[info.playerName].chips = info.chips
            saveUserData(info.playerName)
            console.log(`⏰ 重连超时，更新筹码: ${info.playerName} -> ${info.chips}`)
          }
          room.disconnectedPlayers.delete(seatIndex)
          room.game.removePlayer(seatIndex)
        }
      })
    })
  }, 30000)
}
