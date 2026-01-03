/**
 * 诈金花游戏服务器 (权威服务端)
 * 所有游戏逻辑在服务端执行，客户端只负责展示
 */
import { WebSocketServer } from 'ws'
import { Room } from './server/game/Room.js'
import fs from 'fs'
import path from 'path'

const PORT = 3001
const wss = new WebSocketServer({ port: PORT })

// 房间管理
const rooms = new Map()
// 客户端管理
const clients = new Map()

// 用户数据文件路径
const USERS_FILE = './users_data.json'

// 加载用户数据
function loadUsersData() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf8')
      return JSON.parse(data)
    }
  } catch (e) {
    console.error('加载用户数据失败:', e)
  }
  return {}
}

// 保存用户数据
function saveUsersData(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
  } catch (e) {
    console.error('保存用户数据失败:', e)
  }
}

// 全局用户数据
let usersData = loadUsersData()

// 定期检查断线超时，更新筹码
setInterval(() => {
  rooms.forEach((room) => {
    room.disconnectedPlayers.forEach((info, seatIndex) => {
      if (Date.now() - info.disconnectedAt >= room.reconnectTimeout) {
        // 超时，更新用户筹码
        if (info.playerName && usersData[info.playerName]) {
          usersData[info.playerName].chips = info.chips
          saveUsersData(usersData)
          console.log(`⏰ 重连超时，更新筹码: ${info.playerName} -> ${info.chips}`)
        }
        room.disconnectedPlayers.delete(seatIndex)
        room.game.removePlayer(seatIndex)
      }
    })
  })
}, 30000) // 每30秒检查一次

console.log(`🎮 诈金花游戏服务器启动在端口 ${PORT}`)

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
    'get_user': () => handleGetUser(clientId, data)
  }
  
  const handler = handlers[data.type]
  if (handler) handler()
}

// 创建房间
function handleCreateRoom(clientId, data) {
  const { playerName } = data
  const roomCode = generateRoomCode()
  const client = clients.get(clientId)
  
  // 获取玩家真实筹码
  const userChips = usersData[playerName]?.chips || 1000
  
  const room = new Room(roomCode, clientId, playerName)
  room.addClient(clientId, client.ws, playerName, userChips)
  rooms.set(roomCode, room)
  
  client.roomCode = roomCode
  client.playerName = playerName
  
  console.log(`🏠 房间创建: ${roomCode} by ${playerName}`)
  
  send(client.ws, {
    type: 'room_created',
    roomCode,
    seatIndex: room.getSeatIndex(clientId),
    players: room.getPlayerList()
  })
}

// 加入房间
function handleJoinRoom(clientId, data) {
  const { roomCode, playerName } = data
  const room = rooms.get(roomCode)
  const client = clients.get(clientId)
  
  if (!room) {
    send(client.ws, { type: 'join_failed', message: '房间不存在' })
    return
  }
  
  // 获取玩家真实筹码
  const userChips = usersData[playerName]?.chips || 1000
  
  const result = room.addClient(clientId, client.ws, playerName, userChips)
  if (!result) {
    send(client.ws, { type: 'join_failed', message: '房间已满' })
    return
  }
  
  client.roomCode = roomCode
  client.playerName = playerName
  
  console.log(`👤 玩家加入: ${playerName} -> ${roomCode} (筹码: ${userChips})`)
  
  // 通知加入者
  send(client.ws, {
    type: 'room_joined',
    roomCode,
    seatIndex: result.seatIndex,
    players: room.getPlayerList(),
    isHost: false,
    gameStarted: room.gameStarted
  })
  
  // 通知房间内其他玩家
  room.broadcast({
    type: 'player_joined',
    playerName,
    seatIndex: result.seatIndex,
    players: room.getPlayerList()
  }, clientId)
  
  // 如果游戏已经开始（在牌桌中），同步游戏状态给新玩家
  if (room.gameStarted) {
    // 广播更新后的游戏状态给所有玩家（包括房主）
    room.broadcastGameState()
  }
}

// 验证房间
function handleVerifyRoom(clientId, data) {
  const room = rooms.get(data.roomCode)
  const client = clients.get(clientId)
  
  send(client.ws, {
    type: 'room_verified',
    exists: !!room,
    roomInfo: room ? room.getInfo() : null
  })
}

// 获取房间列表
function handleGetRooms(clientId) {
  const client = clients.get(clientId)
  const roomList = Array.from(rooms.values()).map(r => r.getInfo())
  
  send(client.ws, { type: 'rooms_list', rooms: roomList })
}

// 离开房间
function handleLeaveRoom(clientId) {
  const client = clients.get(clientId)
  if (!client?.roomCode) return
  
  const room = rooms.get(client.roomCode)
  if (!room) return
  
  // 获取房间中的客户端信息（包含seatIndex）
  const roomClient = room.clients.get(clientId)
  
  // 主动离开时更新用户筹码（已下的注不退回）
  if (roomClient) {
    updateUserChipsOnLeave(client.playerName, roomClient.seatIndex, room, false)
  }
  
  const wasHost = room.isHost(clientId)
  room.removeClient(clientId)
  
  console.log(`👋 玩家离开: ${client.playerName} <- ${client.roomCode}`)
  
  if (wasHost || room.clients.size === 0) {
    // 房主离开或房间空了，关闭房间
    room.broadcast({ type: 'room_closed', message: '房间已关闭' })
    rooms.delete(client.roomCode)
    console.log(`🚪 房间关闭: ${client.roomCode}`)
  } else {
    // 通知其他玩家
    room.broadcast({
      type: 'player_left',
      playerName: client.playerName,
      players: room.getPlayerList()
    })
  }
  
  client.roomCode = null
}

// 离开房间时更新用户筹码
// isDisconnect: true表示断线，false表示主动离开
function updateUserChipsOnLeave(playerName, seatIndex, room, isDisconnect) {
  if (!playerName || !usersData[playerName]) return
  if (seatIndex === -1 || seatIndex === undefined) return
  
  const player = room.game.seats[seatIndex]
  if (!player || player.type !== 'human') return
  
  // 主动离开：保存当前筹码（已下的注不退回）
  // 断线：不更新筹码，等待重连
  if (!isDisconnect) {
    usersData[playerName].chips = player.chips
    saveUsersData(usersData)
    console.log(`💰 主动离开，更新筹码: ${playerName} -> ${player.chips}`)
  } else {
    console.log(`⏸️ 断线，保留筹码等待重连: ${playerName}`)
  }
}

// 添加AI
function handleAddAI(clientId) {
  const client = clients.get(clientId)
  const room = rooms.get(client?.roomCode)
  
  if (!room || !room.isHost(clientId)) return
  
  const result = room.addAI()
  if (result) {
    console.log(`🤖 添加AI: ${result.name} 座位${result.seatIndex}`)
    room.broadcast({
      type: 'ai_added',
      ...result,
      players: room.getPlayerList()
    })
    send(client.ws, {
      type: 'ai_added',
      ...result,
      players: room.getPlayerList()
    })
  }
}

// 移除AI
function handleRemoveAI(clientId, data) {
  const client = clients.get(clientId)
  const room = rooms.get(client?.roomCode)
  
  if (!room || !room.isHost(clientId)) return
  
  if (room.removeAI(data.seatIndex)) {
    console.log(`🤖 移除AI: 座位${data.seatIndex}`)
    room.broadcast({
      type: 'ai_removed',
      seatIndex: data.seatIndex,
      players: room.getPlayerList()
    })
    send(client.ws, {
      type: 'ai_removed',
      seatIndex: data.seatIndex,
      players: room.getPlayerList()
    })
  }
}

// 开始游戏
function handleStartGame(clientId) {
  const client = clients.get(clientId)
  const room = rooms.get(client?.roomCode)
  
  if (!room || !room.isHost(clientId)) return
  
  // 标记游戏已开始（进入牌桌）
  room.gameStarted = true
  
  // 如果只有一个玩家，先不发牌，等待更多玩家
  const playerCount = room.getPlayerList().length
  if (playerCount < 2) {
    console.log(`🎮 进入牌桌: ${room.roomCode}，等待更多玩家加入`)
    // 广播进入牌桌状态
    room.broadcast({ type: 'game_started', waitingForPlayers: true })
    send(client.ws, { type: 'game_started', waitingForPlayers: true })
    
    // 发送初始游戏状态（等待阶段）
    room.broadcastGameState()
    return
  }
  
  const result = room.game.startRound(room.hostSeatIndex)
  if (!result.success) {
    send(client.ws, { type: 'start_failed', message: result.error })
    return
  }
  
  console.log(`🎮 游戏开始: ${room.roomCode}`)
  
  // 底注已扣除，立即更新用户筹码
  updateUserChips(room)
  
  // 给每个玩家发送他们视角的游戏状态（发牌阶段）
  room.broadcastGameState()
  
  // 发牌动画结束后切换到下注阶段
  // 最后一张牌的延迟 + 动画时长
  const lastCardDelay = (playerCount * 3 - 1) * 300
  const dealingDuration = lastCardDelay + 250 + 100
  
  setTimeout(() => {
    room.game.finishDealing()
    room.broadcastGameState()
    // 检查第一个玩家是否是AI
    processAITurn(room)
  }, dealingDuration)
}

// 处理玩家操作
function handlePlayerAction(clientId, data) {
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
  
  // 广播操作结果
  room.broadcast({
    type: 'action_result',
    ...result
  })
  
  // 更新所有玩家的游戏状态
  room.broadcastGameState()
  
  // 每次操作后都更新用户筹码
  updateUserChips(room)
  
  // 游戏结束时更新战绩
  if (result.action === 'gameEnd') {
    updateUsersGameStats(room, result)
  }
  
  // 处理AI回合
  if (result.action !== 'gameEnd') {
    processAITurn(room)
  }
}

// 更新用户筹码（每次操作后调用）
function updateUserChips(room) {
  room.clients.forEach((client) => {
    const playerName = client.playerName
    if (!playerName || !usersData[playerName]) return
    
    const player = room.game.seats[client.seatIndex]
    if (!player || player.type !== 'human') return
    
    // 更新筹码
    if (usersData[playerName].chips !== player.chips) {
      usersData[playerName].chips = player.chips
      console.log(`💰 更新筹码: ${playerName} -> ${player.chips}`)
    }
  })
  
  saveUsersData(usersData)
}

// 游戏结束后更新战绩
function updateUsersGameStats(room, result) {
  const winnerSeatIndex = result.winner?.seatIndex
  
  room.clients.forEach((client) => {
    const playerName = client.playerName
    if (!playerName || !usersData[playerName]) return
    
    const player = room.game.seats[client.seatIndex]
    if (!player || player.type !== 'human') return
    
    // 更新战绩
    usersData[playerName].totalGames = (usersData[playerName].totalGames || 0) + 1
    
    if (client.seatIndex === winnerSeatIndex) {
      usersData[playerName].wins = (usersData[playerName].wins || 0) + 1
    } else {
      usersData[playerName].losses = (usersData[playerName].losses || 0) + 1
    }
    
    console.log(`📊 更新战绩: ${playerName}`)
  })
  
  saveUsersData(usersData)
}

// 处理AI回合
function processAITurn(room) {
  const game = room.game
  const currentPlayer = game.seats[game.state.currentPlayerIndex]
  
  if (!currentPlayer || currentPlayer.type !== 'ai' || game.state.phase !== 'betting') {
    return
  }
  
  // 检查是否只剩AI玩家
  const activePlayers = game.getActivePlayers()
  const humanPlayers = activePlayers.filter(p => p.type === 'human')
  const onlyAI = humanPlayers.length === 0
  
  // 只剩AI时速战速决，延迟缩短到50ms
  const delay = onlyAI ? 50 : 400
  
  // 延迟执行AI决策
  setTimeout(() => {
    // 只剩AI时直接让最强的AI开牌结束
    if (onlyAI && activePlayers.length >= 2) {
      const aiPlayers = activePlayers.filter(p => p.type === 'ai')
      // 找牌力最强的AI
      let strongestAI = aiPlayers[0]
      for (const ai of aiPlayers) {
        if (ai.hand.getType().weight > strongestAI.hand.getType().weight) {
          strongestAI = ai
        }
      }
      // 让最强AI开牌
      if (game.state.currentPlayerIndex === strongestAI.id) {
        const target = aiPlayers.find(p => p.id !== strongestAI.id)
        if (target) {
          const result = game.handleAction(strongestAI.id, 'showdown', target.id)
          if (result.success) {
            room.broadcast({ type: 'action_result', ...result, isAI: true })
            room.broadcastGameState()
            if (result.action !== 'gameEnd') {
              processAITurn(room)
            }
          }
          return
        }
      }
    }
    
    const decision = game.makeAIDecision(game.state.currentPlayerIndex)
    if (!decision) return
    
    console.log(`🤖 AI决策: 座位${game.state.currentPlayerIndex} ${decision.action}`)
    
    const result = game.handleAction(
      game.state.currentPlayerIndex,
      decision.action,
      decision.amount
    )
    
    if (result.success) {
      room.broadcast({
        type: 'action_result',
        ...result,
        isAI: true
      })
      room.broadcastGameState()
      
      // 继续处理下一个AI
      if (result.action !== 'gameEnd') {
        processAITurn(room)
      }
    }
  }, delay)
}

// 处理断开连接
function handleDisconnect(clientId) {
  const client = clients.get(clientId)
  if (!client?.roomCode) return
  
  const room = rooms.get(client.roomCode)
  if (!room) return
  
  const wasHost = room.isHost(clientId)
  // 传入 true 表示是断线，保留座位
  room.removeClient(clientId, true)
  
  console.log(`👋 玩家断线: ${client.playerName} <- ${client.roomCode}`)
  
  // 只有房主断线且没有其他玩家时才关闭房间
  if (wasHost && room.clients.size === 0 && room.disconnectedPlayers.size <= 1) {
    room.broadcast({ type: 'room_closed', message: '房间已关闭' })
    rooms.delete(client.roomCode)
    console.log(`🚪 房间关闭: ${client.roomCode}`)
  } else if (wasHost && room.clients.size > 0) {
    // 转移房主
    const newHost = room.transferHost()
    if (newHost) {
      room.broadcast({
        type: 'host_changed',
        newHostName: newHost.newHostName
      })
    }
  }
  
  // 通知其他玩家有人断线
  room.broadcast({
    type: 'player_disconnected',
    playerName: client.playerName,
    players: room.getPlayerList()
  })
}

// 重连处理
function handleReconnect(clientId, data) {
  const { roomCode, playerName } = data
  const room = rooms.get(roomCode)
  const client = clients.get(clientId)
  
  if (!room) {
    send(client.ws, { type: 'reconnect_failed', message: '房间不存在' })
    return
  }
  
  // 检查是否可以重连
  const reconnectInfo = room.canReconnect(playerName)
  if (!reconnectInfo) {
    send(client.ws, { type: 'reconnect_failed', message: '无法重连，请重新加入' })
    return
  }
  
  // 执行重连
  const result = room.reconnectClient(clientId, client.ws, playerName, reconnectInfo.seatIndex)
  if (!result) {
    send(client.ws, { type: 'reconnect_failed', message: '重连失败' })
    return
  }
  
  client.roomCode = roomCode
  client.playerName = playerName
  
  console.log(`🔄 玩家重连成功: ${playerName} -> ${roomCode}`)
  
  // 发送重连成功消息
  send(client.ws, {
    type: 'reconnect_success',
    roomCode,
    seatIndex: result.seatIndex,
    players: room.getPlayerList(),
    isHost: room.isHost(clientId),
    gameStarted: room.gameStarted
  })
  
  // 通知其他玩家
  room.broadcast({
    type: 'player_reconnected',
    playerName,
    seatIndex: result.seatIndex,
    players: room.getPlayerList()
  }, clientId)
  
  // 同步游戏状态
  if (room.gameStarted) {
    const state = room.game.getStateForPlayer(result.seatIndex)
    send(client.ws, { type: 'game_state', state })
  }
}

// 发送消息
function send(ws, data) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(data))
  }
}

// 生成ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

// 生成房间码
function generateRoomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// 同步用户数据
function handleSyncUser(clientId, data) {
  const client = clients.get(clientId)
  const { user } = data
  
  if (!user || !user.username) return
  
  // 更新或创建用户数据
  usersData[user.username] = {
    ...usersData[user.username],
    ...user,
    lastSync: Date.now()
  }
  
  saveUsersData(usersData)
  
  send(client.ws, { type: 'user_synced', success: true })
}

// 用户注册
function handleRegister(clientId, data) {
  const client = clients.get(clientId)
  const { username, password } = data
  
  if (!username || username.trim() === '') {
    send(client.ws, { type: 'register_result', success: false, message: '用户名不能为空' })
    return
  }
  
  if (!password || password.trim() === '') {
    send(client.ws, { type: 'register_result', success: false, message: '密码不能为空' })
    return
  }
  
  if (username.length < 2 || username.length > 10) {
    send(client.ws, { type: 'register_result', success: false, message: '用户名长度为2-10个字符' })
    return
  }
  
  if (password.length < 4) {
    send(client.ws, { type: 'register_result', success: false, message: '密码至少4个字符' })
    return
  }
  
  if (usersData[username]) {
    send(client.ws, { type: 'register_result', success: false, message: '用户名已存在' })
    return
  }
  
  // 创建新用户
  usersData[username] = {
    username: username.trim(),
    password: password,
    chips: 1000,
    totalGames: 0,
    wins: 0,
    losses: 0,
    createdAt: Date.now(),
    lastLogin: Date.now(),
    lastSignIn: null,
    signInStreak: 0,
    totalSignIns: 0
  }
  
  saveUsersData(usersData)
  console.log('📝 注册新用户:', username)
  
  send(client.ws, { 
    type: 'register_result', 
    success: true, 
    message: '注册成功',
    user: { ...usersData[username], password: undefined }
  })
}

// 用户登录
function handleLogin(clientId, data) {
  const client = clients.get(clientId)
  const { username, password } = data
  
  if (!username || username.trim() === '') {
    send(client.ws, { type: 'login_result', success: false, message: '用户名不能为空' })
    return
  }
  
  if (!password || password.trim() === '') {
    send(client.ws, { type: 'login_result', success: false, message: '密码不能为空' })
    return
  }
  
  if (!usersData[username]) {
    send(client.ws, { type: 'login_result', success: false, message: '用户不存在' })
    return
  }
  
  const user = usersData[username]
  if (user.password !== password) {
    send(client.ws, { type: 'login_result', success: false, message: '密码错误' })
    return
  }
  
  // 更新登录时间
  user.lastLogin = Date.now()
  saveUsersData(usersData)
  
  console.log('✅ 用户登录:', username)
  
  send(client.ws, { 
    type: 'login_result', 
    success: true, 
    message: '登录成功',
    user: { ...user, password: undefined }
  })
}

// 用户签到
function handleSignIn(clientId, data) {
  const client = clients.get(clientId)
  const { username } = data
  
  if (!username || !usersData[username]) {
    send(client.ws, { type: 'sign_in_result', success: false, message: '用户不存在' })
    return
  }
  
  const user = usersData[username]
  const today = new Date().toDateString()
  const lastSignIn = user.lastSignIn ? new Date(user.lastSignIn).toDateString() : null
  
  if (today === lastSignIn) {
    send(client.ws, { type: 'sign_in_result', success: false, message: '今天已经签到过了' })
    return
  }
  
  // 检查是否连续签到
  const now = Date.now()
  if (lastSignIn) {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (lastSignIn === yesterday.toDateString()) {
      user.signInStreak = (user.signInStreak || 0) + 1
    } else {
      user.signInStreak = 1
    }
  } else {
    user.signInStreak = 1
  }
  
  // 计算奖励
  const streak = Math.min(user.signInStreak, 7)
  const reward = 100 + (streak - 1) * 50
  
  user.lastSignIn = now
  user.totalSignIns = (user.totalSignIns || 0) + 1
  user.chips += reward
  
  saveUsersData(usersData)
  
  send(client.ws, {
    type: 'sign_in_result',
    success: true,
    reward,
    streak: user.signInStreak,
    totalChips: user.chips,
    user: { ...user, password: undefined }
  })
}

// 获取用户数据
function handleGetUser(clientId, data) {
  const client = clients.get(clientId)
  const { username } = data
  
  if (!username || !usersData[username]) {
    send(client.ws, { type: 'get_user_result', success: false, message: '用户不存在' })
    return
  }
  
  send(client.ws, {
    type: 'get_user_result',
    success: true,
    user: { ...usersData[username], password: undefined }
  })
}

// 获取排行榜
function handleGetLeaderboard(clientId, data) {
  const client = clients.get(clientId)
  const { leaderboardType = 'chips', limit = 999 } = data
  
  console.log('📊 获取排行榜:', leaderboardType, '用户数:', Object.keys(usersData).length)
  
  const userList = Object.values(usersData)
  
  let sorted
  switch (leaderboardType) {
    case 'chips':
      sorted = [...userList].sort((a, b) => (b.chips || 0) - (a.chips || 0))
      break
    case 'wins':
      sorted = [...userList].sort((a, b) => (b.wins || 0) - (a.wins || 0))
      break
    case 'winRate':
      sorted = [...userList]
        .filter(u => (u.totalGames || 0) >= 10)
        .sort((a, b) => {
          const rateA = a.totalGames ? (a.wins / a.totalGames) : 0
          const rateB = b.totalGames ? (b.wins / b.totalGames) : 0
          return rateB - rateA
        })
      break
    default:
      sorted = [...userList]
  }
  
  const leaderboard = sorted.slice(0, limit).map((user, index) => ({
    rank: index + 1,
    username: user.username,
    chips: user.chips || 0,
    wins: user.wins || 0,
    totalGames: user.totalGames || 0,
    winRate: user.totalGames ? Math.round((user.wins / user.totalGames) * 100) : 0
  }))
  
  console.log('📊 排行榜数据:', leaderboard.length, '条')
  
  send(client.ws, { type: 'leaderboard', leaderboard, leaderboardType })
}
