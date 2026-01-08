/**
 * 诈金花游戏服务器
 * 入口文件 - 只负责启动和配置
 */
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { serverConfig, validateConfig, printConfig } from './server/config/index.js'
import { initDatabase } from './server/db/mysql.js'
import { loadUsersToCache } from './server/services/UserService.js'
import { startDisconnectChecker } from './server/services/RoomService.js'
import { setupWebSocket } from './server/routes/WebSocketHandler.js'
import { createStaticServer } from './server/middleware/staticServer.js'
import { createAvatarUploadHandler } from './server/routes/handlers/UploadHandler.js'
import { healthCheck, statusCheck, readinessCheck, livenessCheck, metricsEndpoint } from './server/routes/healthCheck.js'
import logger, { sysLog } from './server/utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PORT = serverConfig.port
const STATIC_DIR = join(__dirname, 'dist')
const AVATARS_DIR = join(__dirname, 'dist', 'avatars')

// 创建中间件
const serveStatic = createStaticServer(STATIC_DIR)
const handleAvatarUpload = createAvatarUploadHandler(AVATARS_DIR)

// 初始化并启动服务器
async function startServer() {
  try {
    // 验证配置
    validateConfig()
    printConfig()
    
    // 初始化数据库（如果设置了 RESET_DB=true 则重置非用户数据）
    const resetDb = process.env.RESET_DB === 'true'
    if (resetDb) {
      console.log('⚠️ 检测到 RESET_DB=true，将重置非用户数据表')
    }
    await initDatabase(resetDb)
    sysLog.dbConnected()
    
    await loadUsersToCache()
    
    // 创建 HTTP 服务器
    const server = createServer((req, res) => {
      // 路由分发
      if (req.url === '/health') {
        healthCheck(req, res)
      } else if (req.url === '/status') {
        statusCheck(req, res)
      } else if (req.url === '/metrics') {
        metricsEndpoint(req, res)
      } else if (req.url === '/ready') {
        readinessCheck(req, res)
      } else if (req.url === '/alive') {
        livenessCheck(req, res)
      } else if (req.url === '/api/upload-avatar') {
        handleAvatarUpload(req, res)
      } else {
        serveStatic(req, res)
      }
    })
    
    // 创建 WebSocket 服务器（只接受 /ws 路径）
    const wss = new WebSocketServer({ 
      server,
      path: '/ws'
    })
    setupWebSocket(wss)
    
    // 启动断线检查器
    startDisconnectChecker()
    
    // 启动服务器
    server.listen(PORT, serverConfig.host, () => {
      sysLog.serverStart(PORT)
      logger.info(`🎮 诈金花游戏服务器启动成功`)
      logger.info(`📡 WebSocket: ws://${serverConfig.host}:${PORT}`)
      logger.info(`📁 静态文件: ${STATIC_DIR}`)
    })
    
    // 优雅关闭
    process.on('SIGTERM', () => gracefulShutdown(server))
    process.on('SIGINT', () => gracefulShutdown(server))
    
  } catch (error) {
    logger.error('❌ 服务器启动失败', { error: error.message })
    process.exit(1)
  }
}

// 优雅关闭
function gracefulShutdown(server) {
  logger.info('\n⏳ 正在关闭服务器...')
  sysLog.serverStop()
  
  server.close(() => {
    logger.info('✅ 服务器已关闭')
    process.exit(0)
  })
  
  // 强制关闭超时
  setTimeout(() => {
    logger.error('❌ 强制关闭服务器')
    process.exit(1)
  }, 10000)
}

startServer()
