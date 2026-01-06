/**
 * 日志系统
 * 使用 winston 实现分级日志
 */
import winston from 'winston'
import { logConfig, serverConfig } from '../config/index.js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync, mkdirSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '../..')

// 确保日志目录存在
const logDir = join(rootDir, 'logs')
if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true })
}

// 自定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`
    
    // 添加额外的元数据
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`
    }
    
    // 添加堆栈信息
    if (stack) {
      log += `\n${stack}`
    }
    
    return log
  })
)

// 创建 logger 实例
const logger = winston.createLogger({
  level: logConfig.level,
  format: logFormat,
  transports: [
    // 控制台输出（带颜色）
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),
    
    // 所有日志写入文件
    new winston.transports.File({
      filename: join(logDir, 'app.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 7
    }),
    
    // 错误日志单独文件
    new winston.transports.File({
      filename: join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 7
    })
  ]
})

// 开发环境下的简化日志
if (serverConfig.isDevelopment) {
  logger.level = 'debug'
}

// 导出日志方法
export default logger

// 便捷方法
export const log = {
  debug: (message, meta) => logger.debug(message, meta),
  info: (message, meta) => logger.info(message, meta),
  warn: (message, meta) => logger.warn(message, meta),
  error: (message, meta) => logger.error(message, meta)
}

// 游戏相关日志
export const gameLog = {
  roomCreated: (roomCode, playerName, ante) => {
    logger.info('房间创建', { roomCode, playerName, ante, category: 'room' })
  },
  
  playerJoined: (roomCode, playerName) => {
    logger.info('玩家加入', { roomCode, playerName, category: 'room' })
  },
  
  playerLeft: (roomCode, playerName) => {
    logger.info('玩家离开', { roomCode, playerName, category: 'room' })
  },
  
  gameStarted: (roomCode, playerCount) => {
    logger.info('游戏开始', { roomCode, playerCount, category: 'game' })
  },
  
  gameEnded: (roomCode, winner) => {
    logger.info('游戏结束', { roomCode, winner, category: 'game' })
  },
  
  playerAction: (roomCode, playerName, action, amount) => {
    logger.debug('玩家操作', { roomCode, playerName, action, amount, category: 'game' })
  }
}

// 用户相关日志
export const userLog = {
  register: (username) => {
    logger.info('用户注册', { username, category: 'user' })
  },
  
  login: (username) => {
    logger.info('用户登录', { username, category: 'user' })
  },
  
  loginFailed: (username, reason) => {
    logger.warn('登录失败', { username, reason, category: 'user' })
  },
  
  signIn: (username, reward) => {
    logger.info('每日签到', { username, reward, category: 'user' })
  }
}

// 系统相关日志
export const sysLog = {
  serverStart: (port) => {
    logger.info('服务器启动', { port, category: 'system' })
  },
  
  serverStop: () => {
    logger.info('服务器关闭', { category: 'system' })
  },
  
  dbConnected: () => {
    logger.info('数据库连接成功', { category: 'system' })
  },
  
  dbError: (error) => {
    logger.error('数据库错误', { error: error.message, category: 'system' })
  }
}
