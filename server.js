/**
 * 诈金花游戏服务器 (权威服务端)
 * 所有游戏逻辑在服务端执行，客户端只负责展示
 */
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { Room } from './server/game/Room.js'
import { initDatabase, getAllUsers, getUser, createUser, updateUser, getAIStats, getAIDetail, getAIHandJudgmentStats, getAllPlayerProfiles, recordAIGame, recordAIHandJudgment, updateAIPlayerStrategy, getAIAllPlayerStrategies, getAllAIPlayerStrategies, recordShowdownForCalibration, getAllHandCalibrations, clearAllAIData } from './server/db/mysql.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PORT = 3001
const STATIC_DIR = join(__dirname, 'dist')

// MIME 类型映射
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
}

// 头像上传目录
const AVATARS_DIR = join(__dirname, 'dist', 'avatars')
if (!existsSync(AVATARS_DIR)) {
  mkdirSync(AVATARS_DIR, { recursive: true })
}

// 房间管理
const rooms = new Map()
// 客户端管理
const clients = new Map()

// 内存缓存用户数据（减少数据库查询）
let usersCache = {}

// 从数据库加载用户到缓存
async function loadUsersToCache() {
  try {
    const users = await getAllUsers()
    usersCache = {}
    users.forEach(user => {
      usersCache[user.username] = user
    })
    console.log(`✅ 加载了 ${users.length} 个用户到缓存`)
  } catch (e) {
    console.error('加载用户数据失败:', e)
  }
}

// 保存用户数据到数据库
async function saveUserData(username) {
  const user = usersCache[username]
  if (!user) return
  
  try {
    await updateUser(username, user)
  } catch (e) {
    console.error('保存用户数据失败:', e)
  }
}

// 初始化数据库并启动服务器
async function startServer() {
  try {
    await initDatabase()
    await loadUsersToCache()
    
    // 创建 HTTP 服务器（同时提供静态文件）
    const server = createServer((req, res) => {
      // 处理头像上传
      if (req.url === '/api/upload-avatar') {
        handleAvatarUpload(req, res)
        return
      }
      
      // 处理静态文件请求
      let filePath = req.url === '/' ? '/index.html' : req.url
      // 移除查询参数
      filePath = filePath.split('?')[0]
      
      const fullPath = join(STATIC_DIR, filePath)
      const ext = extname(filePath)
      
      // 安全检查：防止目录遍历
      if (!fullPath.startsWith(STATIC_DIR)) {
        res.writeHead(403)
        res.end('Forbidden')
        return
      }
      
      if (existsSync(fullPath)) {
        try {
          const content = readFileSync(fullPath)
          const contentType = MIME_TYPES[ext] || 'application/octet-stream'
          res.writeHead(200, { 'Content-Type': contentType })
          res.end(content)
        } catch (e) {
          res.writeHead(500)
          res.end('Server Error')
        }
      } else {
        // SPA fallback: 返回 index.html
        try {
          const content = readFileSync(join(STATIC_DIR, 'index.html'))
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(content)
        } catch (e) {
          res.writeHead(404)
          res.end('Not Found')
        }
      }
    })
    
    // WebSocket 服务器挂载到 HTTP 服务器
    const wss = new WebSocketServer({ server })
    setupWebSocket(wss)
    
    server.listen(PORT, () => {
      console.log(`🎮 诈金花游戏服务器启动在端口 ${PORT}`)
      console.log(`📁 静态文件目录: ${STATIC_DIR}`)
    })
  } catch (error) {
    console.error('❌ 服务器启动失败:', error)
    process.exit(1)
  }
}

// 设置 WebSocket
function setupWebSocket(wss) {
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

// 定期检查断线超时，更新筹码
setInterval(() => {
  rooms.forEach((room) => {
    room.disconnectedPlayers.forEach((info, seatIndex) => {
      if (Date.now() - info.disconnectedAt >= room.reconnectTimeout) {
        // 超时，更新用户筹码
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
}, 30000) // 每30秒检查一次

// 启动服务器
startServer()

// 处理头像上传
function handleAvatarUpload(req, res) {
  // 添加 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }
  
  const chunks = []
  
  req.on('data', chunk => chunks.push(chunk))
  req.on('end', () => {
    try {
      const buffer = Buffer.concat(chunks)
      const boundary = req.headers['content-type'].split('boundary=')[1]
      
      // 解析 multipart/form-data
      const parts = parseMultipart(buffer, boundary)
      const avatarPart = parts.find(p => p.name === 'avatar')
      const usernamePart = parts.find(p => p.name === 'username')
      
      if (!avatarPart || !usernamePart) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, message: '缺少必要参数' }))
        return
      }
      
      const username = usernamePart.data.toString()
      const ext = avatarPart.filename ? extname(avatarPart.filename) : '.jpg'
      const filename = `${username}_${Date.now()}${ext}`
      const filepath = join(AVATARS_DIR, filename)
      
      // 保存文件
      writeFileSync(filepath, avatarPart.data)
      
      const avatarUrl = `/avatars/${filename}`
      
      // 更新用户数据
      if (usersCache[username]) {
        usersCache[username].avatarUrl = avatarUrl
        saveUserData(username)
      }
      
      console.log(`📷 头像上传成功: ${username} -> ${avatarUrl}`)
      
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, avatarUrl }))
    } catch (e) {
      console.error('头像上传失败:', e)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: false, message: '上传失败' }))
    }
  })
}

// 解析 multipart/form-data
function parseMultipart(buffer, boundary) {
  const parts = []
  const boundaryBuffer = Buffer.from(`--${boundary}`)
  const endBoundary = Buffer.from(`--${boundary}--`)
  
  let start = buffer.indexOf(boundaryBuffer) + boundaryBuffer.length + 2
  
  while (start < buffer.length) {
    const end = buffer.indexOf(boundaryBuffer, start)
    if (end === -1) break
    
    const part = buffer.slice(start, end - 2)
    const headerEnd = part.indexOf('\r\n\r\n')
    
    if (headerEnd !== -1) {
      const headers = part.slice(0, headerEnd).toString()
      const data = part.slice(headerEnd + 4)
      
      const nameMatch = headers.match(/name="([^"]+)"/)
      const filenameMatch = headers.match(/filename="([^"]+)"/)
      
      if (nameMatch) {
        parts.push({
          name: nameMatch[1],
          filename: filenameMatch ? filenameMatch[1] : null,
          data
        })
      }
    }
    
    start = end + boundaryBuffer.length + 2
  }
  
  return parts
}

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

// 获取 AI 监控数据
async function handleGetAIProfiles(clientId) {
  const client = clients.get(clientId)
  
  try {
    // 获取所有玩家档案
    const profiles = await getAllPlayerProfiles()
    // 获取 AI 综合统计
    const aiStats = await getAIStats()
    // 获取牌力认知统计
    const handJudgments = await getAIHandJudgmentStats()
    // 获取牌力校准数据
    const handCalibrations = await getAllHandCalibrations()
    // 获取 AI 对玩家的策略
    const playerStrategies = await getAllAIPlayerStrategies()
    
    send(client.ws, { 
      type: 'ai_profiles', 
      profiles,
      aiStats,
      handJudgments,
      handCalibrations,
      playerStrategies
    })
  } catch (e) {
    console.error('获取 AI 数据失败:', e)
    send(client.ws, { type: 'ai_profiles', profiles: [], aiStats: [], handJudgments: [], handCalibrations: [], playerStrategies: [] })
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
    const strategies = aiName ? await getAIAllPlayerStrategies(aiName) : await getAllAIPlayerStrategies()
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

// 批量测试（数据不写入数据库，只统计结果）
async function handleBatchTest(clientId, data) {
  const client = clients.get(clientId)
  const { rounds, players, aiList } = data
  
  if (!rounds || rounds < 1) {
    send(client.ws, { type: 'batch_test_result', success: false, message: '无效的测试局数' })
    return
  }
  
  // 导入需要的模块
  const { GameEngine } = await import('./server/game/GameEngine.js')
  
  // 统计结果
  const stats = {}
  const allParticipants = [
    ...players.map(p => ({ name: p.name, type: 'simulated', behavior: p.behavior })),
    ...aiList.map(name => ({ name, type: 'ai', behavior: null }))
  ]
  
  allParticipants.forEach(p => {
    stats[p.name] = { wins: 0, total: 0, type: p.type }
  })
  
  console.log(`🧪 开始批量测试: ${rounds} 局, 参与者: ${allParticipants.map(p => p.name).join(', ')}`)
  
  // 模拟玩家决策
  const simulatePlayerDecision = (player, behavior, game) => {
    const callAmount = game.getCallAmountForPlayer(player)
    const chipPressure = callAmount / player.chips
    const hand = player.hand?.getType()
    const handStrength = hand?.weight || 0
    const canShowdown = game.state.firstRoundComplete
    const activePlayers = game.getActivePlayers()
    
    // 根据行为类型决策
    switch (behavior) {
      case 'aggressive':
        if (!player.hasPeeked && Math.random() < 0.5) return { action: 'peek' }
        // 激进型会主动开牌
        if (canShowdown && handStrength >= 5000 && activePlayers.length === 2) {
          const target = activePlayers.find(p => p.id !== player.id)
          if (target) return { action: 'showdown', amount: target.id }
        }
        if (Math.random() < 0.4 && player.chips > callAmount + 20) {
          return { action: 'raise', amount: 20 + Math.floor(Math.random() * 30) }
        }
        // 弱牌也会弃牌
        if (player.hasPeeked && handStrength < 3000 && chipPressure > 0.3 && Math.random() < 0.4) {
          return { action: 'fold' }
        }
        return { action: 'call' }
        
      case 'tight':
        if (!player.hasPeeked) return { action: 'peek' }
        // 紧凑型弱牌容易弃牌
        if (handStrength < 4000 && chipPressure > 0.15) {
          return { action: 'fold' }
        }
        // 强牌会开牌
        if (canShowdown && handStrength >= 6000 && activePlayers.length === 2) {
          const target = activePlayers.find(p => p.id !== player.id)
          if (target) return { action: 'showdown', amount: target.id }
        }
        return { action: 'call' }
        
      case 'passive':
        if (!player.hasPeeked && Math.random() < 0.6) return { action: 'peek' }
        // 被动型很少开牌，但弱牌会弃
        if (player.hasPeeked && handStrength < 3500 && chipPressure > 0.25 && Math.random() < 0.5) {
          return { action: 'fold' }
        }
        return { action: 'call' }
        
      case 'random':
        if (!player.hasPeeked && Math.random() < 0.5) return { action: 'peek' }
        const roll = Math.random()
        if (roll < 0.15) return { action: 'fold' }
        if (roll < 0.25 && player.chips > callAmount + 15) {
          return { action: 'raise', amount: 15 }
        }
        if (roll < 0.35 && canShowdown && activePlayers.length === 2) {
          const target = activePlayers.find(p => p.id !== player.id)
          if (target) return { action: 'showdown', amount: target.id }
        }
        return { action: 'call' }
        
      default: // balanced
        if (!player.hasPeeked && Math.random() < 0.5) return { action: 'peek' }
        // 均衡型根据牌力决策
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
  
  // 运行测试
  for (let round = 0; round < rounds; round++) {
    const game = new GameEngine('TEST', null)
    
    // 添加参与者
    allParticipants.forEach((p, idx) => {
      game.addPlayer(idx, p.name, 1000, p.type === 'ai' ? 'ai' : 'human')
    })
    
    // 开始游戏
    game.startRound()
    game.finishDealing()
    
    // 模拟对局
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
      if (!result.success) break
      if (result.action === 'gameEnd') break
    }
    
    // 统计结果
    const winner = game.state.winner
    if (winner) {
      allParticipants.forEach(p => {
        stats[p.name].total++
        if (winner.name === p.name) {
          stats[p.name].wins++
        }
      })
    }
    
    // 发送进度
    if (round % 10 === 0 || round === rounds - 1) {
      const progress = Math.round((round + 1) / rounds * 100)
      send(client.ws, { type: 'batch_test_progress', progress })
    }
  }
  
  // 生成结果
  const results = Object.entries(stats).map(([name, s]) => ({
    name,
    type: s.type,
    wins: s.wins,
    total: s.total,
    winRate: s.total > 0 ? Math.round(s.wins / s.total * 100) : 0
  })).sort((a, b) => b.winRate - a.winRate)
  
  console.log(`✅ 批量测试完成:`, results)
  send(client.ws, { type: 'batch_test_result', success: true, results })
}

// 创建房间
function handleCreateRoom(clientId, data) {
  const { playerName } = data
  const roomCode = generateRoomCode()
  const client = clients.get(clientId)
  
  // 获取玩家真实筹码
  const userChips = usersCache[playerName]?.chips || 1000
  
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
  const userChips = usersCache[playerName]?.chips || 1000
  
  const result = room.addClient(clientId, client.ws, playerName, userChips)
  if (!result) {
    send(client.ws, { type: 'join_failed', message: '房间已满' })
    return
  }
  
  client.roomCode = roomCode
  client.playerName = playerName
  
  const waitingMsg = result.waitingForNextRound ? ' (等待下一局)' : ''
  console.log(`👤 玩家加入: ${playerName} -> ${roomCode} (筹码: ${userChips})${waitingMsg}`)
  
  // 通知加入者
  send(client.ws, {
    type: 'room_joined',
    roomCode,
    seatIndex: result.seatIndex,
    players: room.getPlayerList(),
    isHost: false,
    gameStarted: room.gameStarted,
    waitingForNextRound: result.waitingForNextRound
  })
  
  // 通知房间内其他玩家
  room.broadcast({
    type: 'player_joined',
    playerName,
    seatIndex: result.seatIndex,
    players: room.getPlayerList(),
    waitingForNextRound: result.waitingForNextRound
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
  
  // 如果游戏进行中，先让玩家弃牌
  if (roomClient && room.gameStarted && room.game.state.phase === 'betting') {
    const player = room.game.seats[roomClient.seatIndex]
    if (player && !player.folded) {
      player.fold()
      player.hasActed = true
      console.log(`🃏 玩家离开，自动弃牌: ${client.playerName}`)
      
      // 检查游戏是否结束
      const active = room.game.getActivePlayers()
      if (active.length <= 1) {
        room.game.endGame()
      } else if (room.game.state.currentPlayerIndex === roomClient.seatIndex) {
        // 如果是当前玩家，切换到下一个
        room.game.nextPlayer()
      }
      
      // 广播游戏状态
      room.broadcastGameState()
    }
  }
  
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
  if (!playerName || !usersCache[playerName]) return
  if (seatIndex === -1 || seatIndex === undefined) return
  
  const player = room.game.seats[seatIndex]
  if (!player || player.type !== 'human') return
  
  // 主动离开：保存当前筹码（已下的注不退回）
  // 断线：不更新筹码，等待重连
  if (!isDisconnect) {
    usersCache[playerName].chips = player.chips
    saveUserData(playerName)
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
  
  // 记录玩家行为到档案（用于 AI 学习）
  const player = room.game.seats[seatIndex]
  if (player && player.type === 'human') {
    const updates = {}
    const round = room.game.state.round || 1
    
    if (action === 'fold') {
      updates.foldCount = 1
      // 区分早期弃牌和晚期弃牌（基于本局是否完成第一轮下注）
      if (!room.game.state.firstRoundComplete) {
        updates.earlyFoldCount = 1
      } else {
        updates.lateFoldCount = 1
      }
    }
    
    if (action === 'raise') {
      updates.raiseCount = 1
      // 区分小加注和大加注
      if (amount <= 20) {
        updates.smallRaiseCount = 1
      } else {
        updates.bigRaiseCount = 1
      }
      // 记录下注金额
      updates.betSize = amount
    }
    
    if (action === 'call') {
      updates.callCount = 1
      if (result.amount) {
        updates.betSize = result.amount
      }
    }
    
    if (action === 'blind') {
      updates.blindBetCount = 1
      updates.betSize = amount
      // 焖牌加注也算加注
      const callAmount = room.game.getCallAmountForPlayer(player)
      if (amount > callAmount) {
        updates.raiseCount = 1
        if (amount - callAmount > 20) {
          updates.bigRaiseCount = 1
        } else {
          updates.smallRaiseCount = 1
        }
      }
    }
    
    if (action === 'peek') {
      updates.peekRound = round
    }
    
    if (action === 'showdown') {
      updates.showdownInitiated = 1
    }
    
    if (Object.keys(updates).length > 0) {
      room.updatePlayerProfile(player.name, updates)
    }
  }
  
  // 记录开牌结果（包括开牌后直接结束游戏的情况）
  if (result.action === 'showdown' || (result.action === 'gameEnd' && result.challengerHand)) {
    const winner = room.game.seats[result.winnerSeatIndex]
    const loser = room.game.seats[result.loserSeatIndex]
    const target = room.game.seats[result.targetSeatIndex]
    
    // 被开牌的玩家
    if (target && target.type === 'human') {
      room.updatePlayerProfile(target.name, { showdownReceived: 1 })
    }
    
    if (winner && winner.type === 'human') {
      room.updatePlayerProfile(winner.name, { showdownWins: 1 })
    }
    if (loser && loser.type === 'human') {
      room.updatePlayerProfile(loser.name, { showdownLosses: 1 })
      
      // 检测诈唬被抓
      const loserHand = result.loserSeatIndex === seatIndex ? result.challengerHand : result.targetHand
      console.log(`🔍 诈唬检测: loser=${loser.name}, loserHand=`, loserHand, `currentBet=${loser.currentBet}`)
      
      if (loserHand) {
        const isWeakHand = loserHand.weight < 3500
        const totalBet = loser.currentBet || 0
        console.log(`🔍 isWeakHand=${isWeakHand}(${loserHand.weight}), totalBet=${totalBet}`)
        
        if (isWeakHand && totalBet > 30) {
          room.updatePlayerProfile(loser.name, { bluffCaught: 1 })
          console.log(`🎭 诈唬被抓: ${loser.name}`)
        }
      } else {
        console.log(`⚠️ loserHand 为空`)
      }
    } else {
      console.log(`⚠️ loser检测跳过: loser=${loser?.name}, type=${loser?.type}`)
    }
    
    // 记录牌力校准数据
    const challengerHand = result.challengerHand
    const targetHand = result.targetHand
    console.log(`🎴 校准数据检查: challengerHand=`, challengerHand, `targetHand=`, targetHand)
    if (challengerHand && targetHand) {
      const challengerWon = result.winnerSeatIndex === seatIndex
      console.log(`📝 记录校准: ${challengerHand.type}(${challengerHand.weight}) vs ${targetHand.type}(${targetHand.weight}), 挑战者胜=${challengerWon}`)
      recordShowdownForCalibration(challengerHand.type, challengerHand.weight, challengerWon, targetHand.weight)
        .then(() => console.log(`✅ 校准记录成功: ${challengerHand.type}`))
        .catch(e => console.error('记录牌力校准失败:', e.message))
      recordShowdownForCalibration(targetHand.type, targetHand.weight, !challengerWon, challengerHand.weight)
        .then(() => console.log(`✅ 校准记录成功: ${targetHand.type}`))
        .catch(e => console.error('记录牌力校准失败:', e.message))
    } else {
      console.log(`⚠️ 校准数据缺失，跳过记录`)
    }
    
    // 如果是 AI 开牌，记录 AI 对玩家的策略
    const challenger = room.game.seats[seatIndex]
    const showdownTarget = room.game.seats[result.targetSeatIndex]
    if (challenger?.type === 'ai' && showdownTarget) {
      const playerProfile = room.playerProfiles?.get(showdownTarget.name)
      updateAIPlayerStrategy(challenger.name, showdownTarget.name, {
        playerType: getPlayerTypeFromProfile(playerProfile),
        bluffTendency: playerProfile ? (playerProfile.bluffCaught / Math.max(playerProfile.totalHands, 1)) : 0.5,
        aggressionLevel: playerProfile ? (playerProfile.raiseCount / Math.max(playerProfile.totalHands, 1)) : 0.5,
        foldThreshold: playerProfile ? (playerProfile.foldCount / Math.max(playerProfile.totalHands, 1)) : 0.5,
        recommendedStrategy: generateStrategyRecommendation(playerProfile),
        won: result.winnerSeatIndex === seatIndex
      }).catch(e => console.error('更新 AI 策略失败:', e.message))
    }
  }
  
  // 广播操作结果
  room.broadcast({
    type: 'action_result',
    ...result
  })
  
  // 发送操作消息（用专门的操作气泡）
  const actionMessages = {
    'call': `跟注 ¥${result.amount || amount}`,
    'raise': `加注 ¥${result.amount || amount}`,
    'fold': '弃牌',
    'check': '过牌',
    'allin': `ALL IN ¥${result.amount || amount}`,
    'blind': `焖注 ¥${result.amount || amount}`,
    'peek': '看牌',
    'showdown': '开牌'
  }
  const actionMsg = actionMessages[result.action] || actionMessages[action]
  if (actionMsg) {
    room.broadcast({
      type: 'action_message',
      seatIndex: seatIndex,
      message: actionMsg,
      actionType: result.action || action
    })
  }
  
  // 更新所有玩家的游戏状态
  room.broadcastGameState()
  
  // 每次操作后都更新用户筹码
  updateUserChips(room)
  
  // 游戏结束时更新战绩和保存玩家档案
  if (result.action === 'gameEnd') {
    updateUsersGameStats(room, result)
    // 异步保存玩家行为档案到数据库
    room.savePlayerProfiles().catch(e => console.error('保存玩家档案失败:', e.message))
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
    if (!playerName || !usersCache[playerName]) return
    
    const player = room.game.seats[client.seatIndex]
    if (!player || player.type !== 'human') return
    
    // 更新筹码
    if (usersCache[playerName].chips !== player.chips) {
      usersCache[playerName].chips = player.chips
      saveUserData(playerName)
      console.log(`💰 更新筹码: ${playerName} -> ${player.chips}`)
    }
  })
}

// 游戏结束后更新战绩
function updateUsersGameStats(room, result) {
  const winnerSeatIndex = result.winner?.seatIndex
  const winnerHand = result.winner?.handType
  const pot = room.game.state.pot || 0
  
  // 遍历所有座位上的玩家
  room.game.seats.forEach((player, seatIndex) => {
    if (!player) return
    
    const isWinner = seatIndex === winnerSeatIndex
    const playerResult = isWinner ? 'win' : 'lose'
    
    // AI 玩家记录对局
    if (player.type === 'ai') {
      const handType = player.hand?.getType()
      console.log(`🤖 记录AI对局: ${player.name}, 结果: ${playerResult}`)
      recordAIGame({
        aiName: player.name,
        opponentName: result.winner?.name || 'unknown',
        roomCode: room.roomCode,
        handType: handType?.name,
        handWeight: handType?.weight,
        actionTaken: player.folded ? 'fold' : 'showdown',
        result: playerResult,
        chipsWon: isWinner ? room.game.state.pot : -player.currentBet,
        roundCount: room.game.state.round || 1
      }).then(() => {
        console.log(`✅ AI对局记录成功: ${player.name}`)
      }).catch(e => console.error('❌ 记录AI对局失败:', e.message))
    }
    
    // 人类玩家更新战绩和档案
    if (player.type === 'human') {
      const playerName = player.name
      if (!playerName || !usersCache[playerName]) return
      
      usersCache[playerName].totalGames = (usersCache[playerName].totalGames || 0) + 1
      
      // 记录筹码输赢到档案
      const profileUpdates = { totalHands: 1 }  // 每局游戏结束时+1
      if (isWinner) {
        usersCache[playerName].wins = (usersCache[playerName].wins || 0) + 1
        // 赢的筹码 = 底池 - 自己投入的
        const chipsWon = pot - player.currentBet
        if (chipsWon > 0) {
          profileUpdates.totalChipsWon = chipsWon
          profileUpdates.maxSingleWin = chipsWon
        }
        // 不通过开牌赢的（别人都弃牌了）
        if (!player.lostShowdown && room.game.getActivePlayers().length === 1) {
          profileUpdates.wonWithoutShowdown = 1
        }
      } else {
        usersCache[playerName].losses = (usersCache[playerName].losses || 0) + 1
        // 输的筹码 = 自己投入的
        const chipsLost = player.currentBet
        if (chipsLost > 0) {
          profileUpdates.totalChipsLost = chipsLost
          profileUpdates.maxSingleLoss = chipsLost
        }
      }
      
      room.updatePlayerProfile(playerName, profileUpdates)
      
      const stats = usersCache[playerName]
      console.log(`📊 更新战绩: ${playerName} - 总场:${stats.totalGames} 胜:${stats.wins} 负:${stats.losses}`)
      saveUserData(playerName).catch(e => console.error(`❌ 保存战绩失败 ${playerName}:`, e.message))
    }
  })
}

// 处理AI回合
function processAITurn(room) {
  const game = room.game
  const currentPlayer = game.seats[game.state.currentPlayerIndex]
  
  if (!currentPlayer || currentPlayer.type !== 'ai' || game.state.phase !== 'betting') {
    return
  }
  
  // 检查是否只剩AI玩家（没有未弃牌的人类玩家）
  const activePlayers = game.getActivePlayers()
  const humanPlayers = activePlayers.filter(p => p.type === 'human' && !p.folded)
  const onlyAI = humanPlayers.length === 0
  
  // AI决策延迟：有人类玩家时更长，让玩家能看清
  const delay = onlyAI ? 800 : 1500
  
  // 延迟执行AI决策
  setTimeout(async () => {
    // 重新检查游戏状态
    if (game.state.phase !== 'betting') return
    
    const seatIndex = game.state.currentPlayerIndex
    const player = game.seats[seatIndex]
    const decision = await game.makeAIDecision(seatIndex)
    if (!decision) return
    
    console.log(`🤖 AI决策: 座位${seatIndex} ${decision.action}`)
    
    const result = game.handleAction(seatIndex, decision.action, decision.amount)
    
    if (result.success) {
      // 记录开牌结果到玩家档案
      if (result.action === 'showdown' || (result.action === 'gameEnd' && result.challengerHand)) {
        const winner = game.seats[result.winnerSeatIndex]
        const loser = game.seats[result.loserSeatIndex]
        if (winner && winner.type === 'human') {
          room.updatePlayerProfile(winner.name, { showdownWins: 1 })
        }
        if (loser && loser.type === 'human') {
          room.updatePlayerProfile(loser.name, { showdownLosses: 1 })
          
          // 检测诈唬被抓
          const loserHand = result.loserSeatIndex === seatIndex ? result.challengerHand : result.targetHand
          if (loserHand) {
            const isWeakHand = loserHand.weight < 3500
            const totalBet = loser.currentBet || 0
            if (isWeakHand && totalBet > 30) {
              room.updatePlayerProfile(loser.name, { bluffCaught: 1 })
              console.log(`🎭 诈唬被抓: ${loser.name}, 牌型: ${loserHand.name}(${loserHand.weight}), 总投入: ${totalBet}`)
            }
          }
        }
        
        // 记录牌力校准数据
        const challengerHand = result.challengerHand
        const targetHand = result.targetHand
        if (challengerHand && targetHand) {
          const challengerWon = result.winnerSeatIndex === seatIndex
          console.log(`📝 AI开牌校准: ${challengerHand.type}(${challengerHand.weight}) vs ${targetHand.type}(${targetHand.weight})`)
          recordShowdownForCalibration(challengerHand.type, challengerHand.weight, challengerWon, targetHand.weight)
            .then(() => console.log(`✅ 校准记录成功: ${challengerHand.type}`))
            .catch(e => console.error('记录牌力校准失败:', e.message))
          recordShowdownForCalibration(targetHand.type, targetHand.weight, !challengerWon, challengerHand.weight)
            .then(() => console.log(`✅ 校准记录成功: ${targetHand.type}`))
            .catch(e => console.error('记录牌力校准失败:', e.message))
        }
      }
      
      // 游戏结束时保存档案
      if (result.action === 'gameEnd') {
        updateUsersGameStats(room, result)
        room.savePlayerProfiles().catch(e => console.error('保存玩家档案失败:', e.message))
      }
      
      // 生成 AI 聊天消息
      const messageContext = {
        hasStrongHand: player.hasPeeked && player.hand.getType().weight >= 7000,
        opponentAggressive: activePlayers.some(p => p.id !== seatIndex && p.lastBetAmount > 25)
      }
      const chatMessage = game.generateAIMessage(seatIndex, decision.action, messageContext)
      
      room.broadcast({
        type: 'action_result',
        ...result,
        isAI: true
      })
      
      // 广播 AI 操作气泡
      const actionMessages = {
        'call': `跟注 ¥${result.amount || decision.amount}`,
        'raise': `加注 ¥${result.amount || decision.amount}`,
        'fold': '弃牌',
        'check': '过牌',
        'allin': `ALL IN ¥${result.amount || decision.amount}`,
        'blind': `焖注 ¥${result.amount || decision.amount}`,
        'peek': '看牌',
        'showdown': '开牌'
      }
      const actionMsg = actionMessages[result.action] || actionMessages[decision.action]
      if (actionMsg) {
        room.broadcast({
          type: 'action_message',
          seatIndex: seatIndex,
          message: actionMsg,
          actionType: result.action || decision.action
        })
      }
      
      // 广播 AI 聊天消息
      if (chatMessage) {
        room.broadcast({
          type: 'chat_message',
          ...chatMessage,
          isAI: true
        })
      }
      
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
  
  // 只有当没有任何玩家（包括断线等待重连的）时才关闭房间
  const hasDisconnectedPlayers = room.disconnectedPlayers.size > 0
  const hasConnectedPlayers = room.clients.size > 0
  
  if (!hasConnectedPlayers && !hasDisconnectedPlayers) {
    // 没有任何玩家了，关闭房间
    rooms.delete(client.roomCode)
    console.log(`🚪 房间关闭（无玩家）: ${client.roomCode}`)
  } else if (wasHost && hasConnectedPlayers) {
    // 房主断线但还有其他在线玩家，转移房主
    const newHost = room.transferHost()
    if (newHost) {
      room.broadcast({
        type: 'host_changed',
        newHostName: newHost.newHostName
      })
    }
  } else if (!hasConnectedPlayers && hasDisconnectedPlayers) {
    // 没有在线玩家但有断线玩家等待重连，保持房间存活
    console.log(`⏸️ 房间保持存活，等待玩家重连: ${client.roomCode} (${room.disconnectedPlayers.size}人断线)`)
  }
  
  // 通知其他在线玩家有人断线
  if (hasConnectedPlayers) {
    room.broadcast({
      type: 'player_disconnected',
      playerName: client.playerName,
      players: room.getPlayerList()
    })
  }
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
  
  // 如果是原房主重连且当前没有房主，恢复房主身份
  if (reconnectInfo.seatIndex === room.hostSeatIndex || room.clients.size === 1) {
    room.hostId = clientId
    room.hostName = playerName
  }
  
  const isHost = room.isHost(clientId)
  
  console.log(`🔄 玩家重连成功: ${playerName} -> ${roomCode} (房主: ${isHost})`)
  
  // 发送重连成功消息
  send(client.ws, {
    type: 'reconnect_success',
    roomCode,
    seatIndex: result.seatIndex,
    players: room.getPlayerList(),
    isHost: isHost,
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

// 根据玩家档案判断玩家类型
function getPlayerTypeFromProfile(profile) {
  if (!profile || !profile.totalHands) return 'unknown'
  const foldRate = profile.foldCount / profile.totalHands
  const raiseRate = profile.raiseCount / profile.totalHands
  
  if (raiseRate > 0.4) return 'aggressive'
  if (foldRate > 0.5) return 'tight'
  if (raiseRate < 0.15 && foldRate < 0.3) return 'passive'
  return 'balanced'
}

// 生成策略建议
function generateStrategyRecommendation(profile) {
  if (!profile || !profile.totalHands || profile.totalHands < 5) {
    return '数据不足，继续观察'
  }
  
  const foldRate = profile.foldCount / profile.totalHands
  const raiseRate = profile.raiseCount / profile.totalHands
  const bluffRate = profile.bluffCaught / profile.totalHands
  
  const tips = []
  
  if (foldRate > 0.5) {
    tips.push('容易弃牌，可用激进策略逼退')
  }
  if (raiseRate > 0.4) {
    tips.push('频繁加注，大注时需谨慎判断真假')
  }
  if (bluffRate > 0.15) {
    tips.push('诈唬被抓率高，大注可能是虚张声势')
  }
  if (profile.blindBetCount / profile.totalHands > 0.3) {
    tips.push('喜欢焖牌，难以读牌')
  }
  if (profile.avgPeekRound > 3) {
    tips.push('看牌较晚，可能是焖牌高手')
  }
  
  return tips.length > 0 ? tips.join('；') : '打法均衡，需综合判断'
}

// 同步用户数据
function handleSyncUser(clientId, data) {
  const client = clients.get(clientId)
  const { user } = data
  
  if (!user || !user.username) return
  
  // 更新或创建用户数据
  usersCache[user.username] = {
    ...usersCache[user.username],
    ...user,
    lastSync: Date.now()
  }
  
  saveUserData(user.username)
  
  send(client.ws, { type: 'user_synced', success: true })
}

// 用户注册
async function handleRegister(clientId, data) {
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
  
  if (usersCache[username]) {
    send(client.ws, { type: 'register_result', success: false, message: '用户名已存在' })
    return
  }
  
  try {
    // 创建新用户到数据库
    const newUser = await createUser({
      username: username.trim(),
      password: password
    })
    
    // 更新缓存
    usersCache[username] = newUser
    
    console.log('📝 注册新用户:', username)
    
    send(client.ws, { 
      type: 'register_result', 
      success: true, 
      message: '注册成功',
      user: { ...newUser, password: undefined }
    })
  } catch (e) {
    console.error('注册失败:', e)
    send(client.ws, { type: 'register_result', success: false, message: '注册失败，请重试' })
  }
}

// 用户登录
async function handleLogin(clientId, data) {
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
  
  try {
    // 从数据库获取用户数据
    const user = await getUser(username)
    if (!user) {
      send(client.ws, { type: 'login_result', success: false, message: '用户不存在' })
      return
    }
    
    if (user.password !== password) {
      send(client.ws, { type: 'login_result', success: false, message: '密码错误' })
      return
    }
    
    // 更新登录时间
    user.lastLogin = Date.now()
    
    // 同步更新缓存
    usersCache[username] = user
    saveUserData(username)
    
    console.log('✅ 用户登录:', username)
    
    send(client.ws, { 
      type: 'login_result', 
      success: true, 
      message: '登录成功',
      user: { ...user, password: undefined }
    })
  } catch (e) {
    console.error('登录失败:', e.message)
    send(client.ws, { type: 'login_result', success: false, message: '登录失败，请重试' })
  }
}

// 用户签到
function handleSignIn(clientId, data) {
  const client = clients.get(clientId)
  const { username } = data
  
  if (!username || !usersCache[username]) {
    send(client.ws, { type: 'sign_in_result', success: false, message: '用户不存在' })
    return
  }
  
  const user = usersCache[username]
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
  
  saveUserData(username)
  
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
async function handleGetUser(clientId, data) {
  const client = clients.get(clientId)
  const { username } = data
  
  if (!username) {
    send(client.ws, { type: 'get_user_result', success: false, message: '用户名不能为空' })
    return
  }
  
  try {
    // 从数据库获取最新数据
    const user = await getUser(username)
    if (!user) {
      send(client.ws, { type: 'get_user_result', success: false, message: '用户不存在' })
      return
    }
    
    // 同步更新缓存
    usersCache[username] = user
    
    send(client.ws, {
      type: 'get_user_result',
      success: true,
      user: { ...user, password: undefined }
    })
  } catch (e) {
    console.error('获取用户数据失败:', e.message)
    // 降级使用缓存
    if (usersCache[username]) {
      send(client.ws, {
        type: 'get_user_result',
        success: true,
        user: { ...usersCache[username], password: undefined }
      })
    } else {
      send(client.ws, { type: 'get_user_result', success: false, message: '获取用户数据失败' })
    }
  }
}

// 更新用户资料
async function handleUpdateProfile(clientId, data) {
  const client = clients.get(clientId)
  const { username, nickname, avatar, avatarUrl } = data
  
  if (!username) {
    send(client.ws, { type: 'update_profile_result', success: false, message: '用户名不能为空' })
    return
  }
  
  try {
    const user = await getUser(username)
    if (!user) {
      send(client.ws, { type: 'update_profile_result', success: false, message: '用户不存在' })
      return
    }
    
    // 更新资料
    if (nickname !== undefined) user.nickname = nickname
    if (avatar !== undefined) user.avatar = avatar
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl
    
    await updateUser(username, user)
    usersCache[username] = user
    
    send(client.ws, {
      type: 'update_profile_result',
      success: true,
      user: { ...user, password: undefined }
    })
    
    console.log(`✏️ 用户 ${username} 更新资料:`, { nickname, avatar, avatarUrl })
  } catch (e) {
    console.error('更新用户资料失败:', e)
    send(client.ws, { type: 'update_profile_result', success: false, message: '更新失败' })
  }
}

// 获取排行榜
function handleGetLeaderboard(clientId, data) {
  const client = clients.get(clientId)
  const { leaderboardType = 'chips', limit = 999 } = data
  
  console.log('📊 获取排行榜:', leaderboardType, '用户数:', Object.keys(usersCache).length)
  
  const userList = Object.values(usersCache)
  
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
