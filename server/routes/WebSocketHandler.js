/**
 * WebSocket 消息处理器
 * 统一处理所有 WebSocket 消息路由
 */
import { getClients, generateId, send } from '../services/RoomService.js'
import { handleDisconnect } from '../services/GameService.js'
import { asyncHandler, sendError } from '../middleware/errorHandler.js'
import { ErrorCode, createError } from '../constants/errors.js'
import { wsMetrics } from '../utils/metrics.js'
import logger from '../utils/logger.js'
import * as RoomHandlers from './handlers/RoomHandlers.js'
import * as UserHandlers from './handlers/UserHandlers.js'
import * as AIHandlers from './handlers/AIHandlers.js'
import * as GameHandlers from './handlers/GameHandlers.js'

const clients = getClients()

// 设置 WebSocket 连接
export function setupWebSocket(wss) {
  console.log('🔧 WebSocket 服务器已启动，等待连接...')
  
  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress
    const clientPort = req.socket.remotePort
    console.log(`🔌 收到连接请求 from ${clientIp}:${clientPort}`)
    
    const clientId = generateId()
    clients.set(clientId, { ws, roomCode: null, playerName: null })
    
    wsMetrics.connected()
    wsMetrics.setConnectedClients(clients.size)
    logger.debug(`新客户端连接: ${clientId} from ${clientIp}`)
    
    // Safari 兼容：延迟发送 connected 消息，确保连接完全就绪
    const sendConnected = () => {
      if (ws.readyState === 1) {
        send(ws, { type: 'connected', clientId })
        console.log(`✅ 已发送 connected 消息: ${clientId}`)
        logger.debug(`已发送 connected 消息: ${clientId}`)
      } else {
        console.warn(`⚠️ 连接未就绪，延迟发送: ${clientId}, readyState: ${ws.readyState}`)
        logger.warn(`连接未就绪，延迟发送: ${clientId}, readyState: ${ws.readyState}`)
        setTimeout(sendConnected, 50)
      }
    }
    
    // 立即尝试发送，如果失败会自动重试
    setTimeout(sendConnected, 10)
    
    ws.on('message', (message) => {
      wsMetrics.messageReceived()
      try {
        const data = JSON.parse(message)
        
        // Safari 兼容：如果收到 ping，回复 pong 并确保已发送 clientId
        if (data.type === 'ping') {
          logger.debug(`收到心跳: ${clientId}`)
          send(ws, { type: 'pong' })
          // 再次确认 clientId 已发送
          send(ws, { type: 'connected', clientId })
          return
        }
        
        handleMessage(clientId, data)
      } catch (error) {
        logger.error('消息解析错误', { error: error.message })
        sendError(ws, createError(ErrorCode.INVALID_INPUT, '消息格式错误'))
      }
    })
    
    ws.on('close', () => {
      logger.debug(`客户端断开: ${clientId}`)
      handleDisconnect(clientId)
      clients.delete(clientId)
      
      wsMetrics.disconnected()
      wsMetrics.setConnectedClients(clients.size)
    })
    
    ws.on('error', (err) => {
      logger.error(`WebSocket 错误`, { clientId, error: err.message })
    })
  })
}

// 消息路由
function handleMessage(clientId, data) {
  const handlers = {
    // 房间相关
    'create_room': asyncHandler((cId, d) => RoomHandlers.handleCreateRoom(cId, d, clients)),
    'join_room': asyncHandler((cId, d) => RoomHandlers.handleJoinRoom(cId, d, clients)),
    'verify_room': asyncHandler((cId, d) => RoomHandlers.handleVerifyRoom(cId, d, clients)),
    'get_rooms': asyncHandler((cId) => RoomHandlers.handleGetRooms(cId, clients)),
    'leave_room': asyncHandler((cId) => RoomHandlers.handleLeaveRoom(cId, clients)),
    'add_ai': asyncHandler((cId, d) => RoomHandlers.handleAddAI(cId, d, clients)),
    'update_ante': asyncHandler((cId, d) => RoomHandlers.handleUpdateAnte(cId, d, clients)),
    'remove_ai': asyncHandler((cId, d) => RoomHandlers.handleRemoveAI(cId, d, clients)),
    
    // 游戏相关
    'start_game': asyncHandler((cId) => GameHandlers.handleStartGame(cId, clients)),
    'player_action': asyncHandler((cId, d) => GameHandlers.handlePlayerAction(cId, d, clients)),
    'reconnect': asyncHandler((cId, d) => GameHandlers.handleReconnect(cId, d, clients)),
    'batch_test': asyncHandler((cId, d) => GameHandlers.handleBatchTest(cId, d, clients)),
    
    // 用户相关
    'register': asyncHandler((cId, d) => UserHandlers.handleRegister(cId, d, clients)),
    'login': asyncHandler((cId, d) => UserHandlers.handleLogin(cId, d, clients)),
    'sign_in': asyncHandler((cId, d) => UserHandlers.handleSignIn(cId, d, clients)),
    'get_user': asyncHandler((cId, d) => UserHandlers.handleGetUser(cId, d, clients)),
    'update_profile': asyncHandler((cId, d) => UserHandlers.handleUpdateProfile(cId, d, clients)),
    'update_game_stats': asyncHandler((cId, d) => UserHandlers.handleUpdateGameStats(cId, d, clients)),
    'sync_user': asyncHandler((cId, d) => UserHandlers.handleSyncUser(cId, d, clients)),
    'get_leaderboard': asyncHandler((cId, d) => UserHandlers.handleGetLeaderboard(cId, d, clients)),
    
    // AI 监控相关
    'get_ai_profiles': asyncHandler((cId) => AIHandlers.handleGetAIProfiles(cId, clients)),
    'get_ai_detail': asyncHandler((cId, d) => AIHandlers.handleGetAIDetail(cId, d, clients)),
    'get_ai_strategies': asyncHandler((cId, d) => AIHandlers.handleGetAIStrategies(cId, d, clients)),
    'get_hand_calibrations': asyncHandler((cId) => AIHandlers.handleGetHandCalibrations(cId, clients)),
    'clear_ai_data': asyncHandler((cId) => AIHandlers.handleClearAIData(cId, clients)),
    
    // 牌局复盘
    'get_game_replays': asyncHandler((cId, d) => AIHandlers.handleGetGameReplays(cId, d, clients)),
    'get_game_replay_detail': asyncHandler((cId, d) => AIHandlers.handleGetGameReplayDetail(cId, d, clients))
  }
  
  const handler = handlers[data.type]
  if (handler) {
    handler(clientId, data)
  } else {
    logger.warn(`未知消息类型: ${data.type}`)
    const client = clients.get(clientId)
    if (client?.ws) {
      sendError(client.ws, createError(ErrorCode.INVALID_MESSAGE_TYPE, `未知消息类型: ${data.type}`))
    }
  }
}
