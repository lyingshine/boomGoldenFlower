/**
 * 房间相关消息处理器
 */
import { 
  createRoom, joinRoom, leaveRoom, getRoomList, verifyRoom,
  addAI, removeAI, updateAnte
} from '../../services/RoomService.js'
import { send } from '../../services/RoomService.js'
import { 
  validatePlayerName, validateRoomCode, validateAnte, 
  validateSeatIndex, validateAll 
} from '../../validators/index.js'

export function handleCreateRoom(clientId, data, clients) {
  const { playerName, ante } = data
  const client = clients.get(clientId)
  
  // 验证输入
  const validation = validateAll(
    validatePlayerName(playerName),
    validateAnte(ante || 10)
  )
  
  if (!validation.isValid) {
    send(client.ws, { 
      type: 'error', 
      message: validation.firstError.message 
    })
    return
  }
  
  const result = createRoom(clientId, playerName, ante)
  
  send(client.ws, {
    type: 'room_created',
    ...result
  })
}

export function handleJoinRoom(clientId, data, clients) {
  const { roomCode, playerName } = data
  const client = clients.get(clientId)
  
  // 验证输入
  const validation = validateAll(
    validateRoomCode(roomCode),
    validatePlayerName(playerName)
  )
  
  if (!validation.isValid) {
    send(client.ws, { 
      type: 'join_failed', 
      message: validation.firstError.message 
    })
    return
  }
  
  const result = joinRoom(clientId, roomCode, playerName)
  
  if (!result.success) {
    send(client.ws, { type: 'join_failed', message: result.message })
    return
  }
  
  const { room } = result
  
  send(client.ws, {
    type: 'room_joined',
    roomCode: result.roomCode,
    seatIndex: result.seatIndex,
    players: result.players,
    isHost: result.isHost,
    gameStarted: result.gameStarted,
    waitingForNextRound: result.waitingForNextRound
  })
  
  room.broadcast({
    type: 'player_joined',
    playerName,
    seatIndex: result.seatIndex,
    players: result.players,
    waitingForNextRound: result.waitingForNextRound
  }, clientId)
  
  if (result.gameStarted) {
    room.broadcastGameState()
  }
}

export function handleVerifyRoom(clientId, data, clients) {
  const client = clients.get(clientId)
  
  // 验证房间码
  const validation = validateRoomCode(data.roomCode)
  if (!validation.isValid) {
    send(client.ws, {
      type: 'room_verified',
      exists: false,
      message: validation.firstError.message
    })
    return
  }
  
  const result = verifyRoom(data.roomCode)
  
  send(client.ws, {
    type: 'room_verified',
    ...result
  })
}

export function handleGetRooms(clientId, clients) {
  const client = clients.get(clientId)
  send(client.ws, { type: 'rooms_list', rooms: getRoomList() })
}

export function handleLeaveRoom(clientId, clients) {
  const result = leaveRoom(clientId)
  if (!result) return
  
  const { closed, room, playerName, players } = result
  
  if (closed) {
    room.broadcast({ type: 'room_closed', message: '房间已关闭' })
  } else {
    room.broadcastGameState()
    room.broadcast({
      type: 'player_left',
      playerName,
      players
    })
  }
}

export function handleAddAI(clientId, data, clients) {
  const client = clients.get(clientId)
  const result = addAI(clientId)
  
  if (result) {
    const { room, ...responseData } = result
    room.broadcast({ type: 'ai_added', ...responseData })
    send(client.ws, { type: 'ai_added', ...responseData })
  }
}

export function handleUpdateAnte(clientId, data, clients) {
  const client = clients.get(clientId)
  const result = updateAnte(clientId, data.ante)
  
  if (result) {
    const { room, ...responseData } = result
    room.broadcast({ type: 'ante_updated', ...responseData })
  }
}

export function handleRemoveAI(clientId, data, clients) {
  const client = clients.get(clientId)
  
  // 验证座位索引
  const validation = validateSeatIndex(data.seatIndex)
  if (!validation.isValid) {
    send(client.ws, { 
      type: 'error', 
      message: validation.firstError.message 
    })
    return
  }
  
  const result = removeAI(clientId, data.seatIndex)
  
  if (result) {
    const { room, ...restData } = result
    room.broadcast({ type: 'ai_removed', ...restData })
    send(client.ws, { type: 'ai_removed', ...restData })
  }
}
