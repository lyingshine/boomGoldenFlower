/**
 * WebSocket 消息处理器
 * 统一处理所有 WebSocket 消息路由
 */
import { 
  getClients, generateId, send,
  createRoom, joinRoom, leaveRoom, getRoomList, verifyRoom,
  addAI, removeAI
} from '../services/RoomService.js'
import {
  registerUser, loginUser, signInUser, getUserData, updateUserProfile, getLeaderboard
} from '../services/UserService.js'
import {
  getAIStats, getAIDetail, getAIHandJudgmentStats, getAllPlayerProfiles,
  getAIAllPlayerStrategies, getAllAIPlayerStrategies,
  getAllHandCalibrations, clearAllAIData
} from '../db/mysql.js'

const clients = getClients()

// 设置 WebSocket 连接
export function setupWebSocket(wss) {
  wss.on('connection', (ws) => {
    const clientId = generateId()
    clients.set(clientId, { ws, roomCode: null, playerName: null })
    
    console.log(`✅ 新客户端连接: ${clientId}`)
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message)
        handleMessage(clientId, data)
      } catch (error) {
        console.error('消息解析错误:', error)
      }
    })
    
    ws.on('close', () => {
      console.log(`❌ 客户端断开: ${clientId}`)
      handleDisconnect(clientId)
      clients.delete(clientId)
    })
    
    send(ws, { type: 'connected', clientId })
  })
}

// 消息路由
function handleMessage(clientId, data) {
  const handlers = {
    'create_room': () => handleCreateRoom(clientId, data),
    'join_room': () => handleJoinRoom(clientId, data),
    'reconnect': () => handleReconnect(clientId, data),
    'verify_room': () => handleVerifyRoom(clientId, data),
    'get_rooms': () => handleGetRooms(clientId),
    'leave_room': () => handleLeaveRoom(clientId),
    'add_ai': () => handleAddAI(clientId),
    'remove_ai': () => handleRemoveAI(clientId, data),
    'start_game': () => handleStartGame(clientId),
    'player_action': () => handlePlayerAction(clientId, data),
    'sync_user': () => handleSyncUser(clientId, data),
    'get_leaderboard': () => handleGetLeaderboard(clientId, data),
    'register': () => handleRegister(clientId, data),
    'login': () => handleLogin(clientId, data),
    'sign_in': () => handleSignIn(clientId, data),
    'get_user': () => handleGetUser(clientId, data),
    'update_profile': () => handleUpdateProfile(clientId, data),
    'get_ai_profiles': () => handleGetAIProfiles(clientId),
    'get_ai_detail': () => handleGetAIDetail(clientId, data),
    'get_ai_strategies': () => handleGetAIStrategies(clientId, data),
    'get_hand_calibrations': () => handleGetHandCalibrations(clientId),
    'clear_ai_data': () => handleClearAIData(clientId),
    'batch_test': () => handleBatchTest(clientId, data)
  }
  
  const handler = handlers[data.type]
  if (handler) handler()
}

// ==================== 房间相关 ====================

// 创建房间
function handleCreateRoom(clientId, data) {
  const { playerName, ante } = data
  const client = clients.get(clientId)
  
  const result = createRoom(clientId, playerName, ante)
  
  send(client.ws, {
    type: 'room_created',
    ...result
  })
}

// 加入房间
function handleJoinRoom(clientId, data) {
  const { roomCode, playerName } = data
  const client = clients.get(clientId)
  
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

// 验证房间
function handleVerifyRoom(clientId, data) {
  const client = clients.get(clientId)
  const result = verifyRoom(data.roomCode)
  
  send(client.ws, {
    type: 'room_verified',
    ...result
  })
}

// 获取房间列表
function handleGetRooms(clientId) {
  const client = clients.get(clientId)
  send(client.ws, { type: 'rooms_list', rooms: getRoomList() })
}

// 离开房间
function handleLeaveRoom(clientId) {
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

// 添加AI
function handleAddAI(clientId) {
  const client = clients.get(clientId)
  const result = addAI(clientId)
  
  if (result) {
    const { room } = result
    room.broadcast({ type: 'ai_added', ...result })
    send(client.ws, { type: 'ai_added', ...result })
  }
}

// 移除AI
function handleRemoveAI(clientId, data) {
  const client = clients.get(clientId)
  const result = removeAI(clientId, data.seatIndex)
  
  if (result) {
    const { room, seatIndex, players } = result
    room.broadcast({ type: 'ai_removed', seatIndex, players })
    send(client.ws, { type: 'ai_removed', seatIndex, players })
  }
}


// ==================== 用户相关 ====================

// 用户注册
async function handleRegister(clientId, data) {
  const client = clients.get(clientId)
  const { username, password } = data
  
  const result = await registerUser(username, password)
  send(client.ws, { type: 'register_result', ...result })
}

// 用户登录
async function handleLogin(clientId, data) {
  const client = clients.get(clientId)
  const { username, password } = data
  
  const result = await loginUser(username, password)
  send(client.ws, { type: 'login_result', ...result })
}

// 用户签到
function handleSignIn(clientId, data) {
  const client = clients.get(clientId)
  const { username } = data
  
  const result = signInUser(username)
  send(client.ws, { type: 'sign_in_result', ...result })
}

// 获取用户数据
async function handleGetUser(clientId, data) {
  const client = clients.get(clientId)
  const { username } = data
  
  const result = await getUserData(username)
  send(client.ws, { type: 'get_user_result', ...result })
}

// 更新用户资料
async function handleUpdateProfile(clientId, data) {
  const client = clients.get(clientId)
  const { username, nickname, avatar, avatarUrl } = data
  
  const result = await updateUserProfile(username, { nickname, avatar, avatarUrl })
  send(client.ws, { type: 'update_profile_result', ...result })
}

// 获取排行榜
function handleGetLeaderboard(clientId, data) {
  const client = clients.get(clientId)
  const { leaderboardType = 'chips', limit = 999 } = data
  
  const leaderboard = getLeaderboard(leaderboardType, limit)
  send(client.ws, { type: 'leaderboard', leaderboard, leaderboardType })
}

// 同步用户数据
function handleSyncUser(clientId, data) {
  const client = clients.get(clientId)
  // 简单确认同步
  send(client.ws, { type: 'user_synced', success: true })
}


// ==================== AI 监控相关 ====================

// 获取 AI 监控数据
async function handleGetAIProfiles(clientId) {
  const client = clients.get(clientId)
  
  try {
    const profiles = await getAllPlayerProfiles()
    const aiStats = await getAIStats()
    const handJudgments = await getAIHandJudgmentStats()
    const handCalibrations = await getAllHandCalibrations()
    const playerStrategies = await getAllAIPlayerStrategies()
    
    send(client.ws, { 
      type: 'ai_profiles', 
      profiles, aiStats, handJudgments, handCalibrations, playerStrategies
    })
  } catch (e) {
    console.error('获取 AI 数据失败:', e)
    send(client.ws, { 
      type: 'ai_profiles', 
      profiles: [], aiStats: [], handJudgments: [], handCalibrations: [], playerStrategies: [] 
    })
  }
}

// 获取单个 AI 详细数据
async function handleGetAIDetail(clientId, data) {
  const client = clients.get(clientId)
  const { aiName } = data
  
  try {
    const detail = await getAIDetail(aiName)
    const strategies = await getAIAllPlayerStrategies(aiName)
    send(client.ws, { type: 'ai_detail', aiName, detail, strategies })
  } catch (e) {
    console.error('获取 AI 详情失败:', e)
    send(client.ws, { type: 'ai_detail', aiName, detail: null, strategies: [] })
  }
}

// 获取 AI 对玩家的策略
async function handleGetAIStrategies(clientId, data) {
  const client = clients.get(clientId)
  const { aiName } = data
  
  try {
    const strategies = aiName 
      ? await getAIAllPlayerStrategies(aiName) 
      : await getAllAIPlayerStrategies()
    send(client.ws, { type: 'ai_strategies', aiName, strategies })
  } catch (e) {
    console.error('获取 AI 策略失败:', e)
    send(client.ws, { type: 'ai_strategies', aiName, strategies: [] })
  }
}

// 获取牌力校准数据
async function handleGetHandCalibrations(clientId) {
  const client = clients.get(clientId)
  
  try {
    const calibrations = await getAllHandCalibrations()
    send(client.ws, { type: 'hand_calibrations', calibrations })
  } catch (e) {
    console.error('获取牌力校准失败:', e)
    send(client.ws, { type: 'hand_calibrations', calibrations: [] })
  }
}

// 清除所有 AI 数据
async function handleClearAIData(clientId) {
  const client = clients.get(clientId)
  
  try {
    await clearAllAIData()
    send(client.ws, { type: 'clear_ai_data_result', success: true })
  } catch (e) {
    console.error('清除 AI 数据失败:', e)
    send(client.ws, { type: 'clear_ai_data_result', success: false, message: e.message })
  }
}


// ==================== 游戏相关（需要从外部注入） ====================

let gameHandlers = null

// 注入游戏处理器
export function setGameHandlers(handlers) {
  gameHandlers = handlers
}

// 开始游戏
function handleStartGame(clientId) {
  if (gameHandlers?.handleStartGame) {
    gameHandlers.handleStartGame(clientId)
  }
}

// 处理玩家操作
function handlePlayerAction(clientId, data) {
  if (gameHandlers?.handlePlayerAction) {
    gameHandlers.handlePlayerAction(clientId, data)
  }
}

// 批量测试
function handleBatchTest(clientId, data) {
  if (gameHandlers?.handleBatchTest) {
    gameHandlers.handleBatchTest(clientId, data)
  }
}

// 处理断开连接
function handleDisconnect(clientId) {
  if (gameHandlers?.handleDisconnect) {
    gameHandlers.handleDisconnect(clientId)
  }
}

// 重连处理
function handleReconnect(clientId, data) {
  if (gameHandlers?.handleReconnect) {
    gameHandlers.handleReconnect(clientId, data)
  }
}
