/**
 * 健康检查端点
 * 提供系统状态监控
 */
import { pool } from '../db/connection.js'
import { getRooms, getClients } from '../services/RoomService.js'
import { serverConfig } from '../config/index.js'
import { metrics } from '../utils/metrics.js'
import logger from '../utils/logger.js'

// 系统启动时间
const startTime = Date.now()

/**
 * 基础健康检查
 */
export async function healthCheck(req, res) {
  try {
    // 检查数据库连接
    const dbHealthy = await checkDatabase()
    
    const health = {
      status: dbHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      environment: serverConfig.env,
      database: dbHealthy ? 'connected' : 'disconnected'
    }
    
    const statusCode = dbHealthy ? 200 : 503
    
    res.writeHead(statusCode, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(health))
  } catch (error) {
    logger.error('健康检查失败', { error: error.message })
    res.writeHead(503, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'error', message: error.message }))
  }
}

/**
 * 详细状态信息
 */
export async function statusCheck(req, res) {
  try {
    const rooms = getRooms()
    const clients = getClients()
    
    // 统计房间信息
    let totalPlayers = 0
    let activeGames = 0
    
    for (const room of rooms.values()) {
      totalPlayers += room.clients.size
      if (room.gameStarted) activeGames++
    }
    
    const status = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      environment: serverConfig.env,
      server: {
        port: serverConfig.port,
        host: serverConfig.host
      },
      database: {
        connected: await checkDatabase(),
        poolSize: pool.pool?.config?.connectionLimit || 0
      },
      game: {
        totalRooms: rooms.size,
        activeGames,
        totalPlayers,
        connectedClients: clients.size
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB'
      }
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(status, null, 2))
  } catch (error) {
    logger.error('状态检查失败', { error: error.message })
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'error', message: error.message }))
  }
}

/**
 * 检查数据库连接
 */
async function checkDatabase() {
  try {
    await pool.execute('SELECT 1')
    return true
  } catch (error) {
    logger.error('数据库健康检查失败', { error: error.message })
    return false
  }
}

/**
 * 就绪检查（用于 Kubernetes 等）
 */
export async function readinessCheck(req, res) {
  try {
    const dbHealthy = await checkDatabase()
    
    if (dbHealthy) {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('ready')
    } else {
      res.writeHead(503, { 'Content-Type': 'text/plain' })
      res.end('not ready')
    }
  } catch (error) {
    res.writeHead(503, { 'Content-Type': 'text/plain' })
    res.end('not ready')
  }
}

/**
 * 存活检查（用于 Kubernetes 等）
 */
export function livenessCheck(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('alive')
}

/**
 * 性能指标端点
 */
export function metricsEndpoint(req, res) {
  try {
    const allMetrics = metrics.getAll()
    
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(allMetrics, null, 2))
  } catch (error) {
    logger.error('获取指标失败', { error: error.message })
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'error', message: error.message }))
  }
}
