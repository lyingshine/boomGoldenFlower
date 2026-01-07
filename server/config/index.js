/**
 * 统一配置管理
 * 从环境变量读取配置，提供默认值和验证
 */
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 环境类型
const NODE_ENV = process.env.NODE_ENV || 'development'
const isDevelopment = NODE_ENV === 'development'
const isProduction = NODE_ENV === 'production'

// 根据环境加载对应的配置文件
const envFile = isProduction ? '.env.production' : '.env.development'
const envPath = join(__dirname, '..', '..', envFile)
dotenv.config({ path: envPath })

console.log(`🔧 加载配置文件: ${envFile}`)
console.log(`📍 配置路径: ${envPath}`)

// 服务器配置
export const serverConfig = {
  port: parseInt(process.env.PORT) || 3001,
  host: process.env.HOST || '0.0.0.0',
  env: NODE_ENV,
  isDevelopment,
  isProduction
}

// 数据库配置
export const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'game',
  // 连接池配置
  pool: {
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_POOL_LIMIT) || 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT) || 10000,
    maxIdle: 10,
    idleTimeout: 60000
  }
}

// WebSocket 配置
export const wsConfig = {
  heartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL) || 30000,
  disconnectTimeout: parseInt(process.env.WS_DISCONNECT_TIMEOUT) || 300000 // 5分钟
}

// 游戏配置
export const gameConfig = {
  defaultAnte: parseInt(process.env.DEFAULT_ANTE) || 10,
  defaultChips: parseInt(process.env.DEFAULT_CHIPS) || 1000,
  maxPlayers: parseInt(process.env.MAX_PLAYERS) || 8,
  minPlayers: parseInt(process.env.MIN_PLAYERS) || 2,
  aiThinkTime: {
    min: parseInt(process.env.AI_THINK_TIME_MIN) || 1000,
    max: parseInt(process.env.AI_THINK_TIME_MAX) || 3000
  }
}

// 安全配置
export const securityConfig = {
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 10,
  maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
  lockoutDuration: parseInt(process.env.LOCKOUT_DURATION) || 900000 // 15分钟
}

// 文件上传配置
export const uploadConfig = {
  avatarMaxSize: parseInt(process.env.AVATAR_MAX_SIZE) || 2 * 1024 * 1024, // 2MB
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
}

// 日志配置
export const logConfig = {
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  file: process.env.LOG_FILE || 'logs/app.log',
  maxSize: process.env.LOG_MAX_SIZE || '10m',
  maxFiles: parseInt(process.env.LOG_MAX_FILES) || 7
}

// 验证必需的配置
export function validateConfig() {
  const errors = []
  
  if (isProduction) {
    if (!process.env.DB_PASSWORD) {
      errors.push('生产环境必须设置 DB_PASSWORD')
    }
    if (securityConfig.jwtSecret === 'your-secret-key-change-in-production') {
      errors.push('生产环境必须设置 JWT_SECRET')
    }
  }
  
  if (!dbConfig.database) {
    errors.push('必须设置 DB_NAME')
  }
  
  if (errors.length > 0) {
    throw new Error(`配置验证失败:\n${errors.join('\n')}`)
  }
  
  return true
}

// 打印配置信息（隐藏敏感信息）
export function printConfig() {
  console.log('📋 服务器配置:')
  console.log(`   环境: ${serverConfig.env}`)
  console.log(`   端口: ${serverConfig.port}`)
  console.log(`   数据库: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`)
  console.log(`   连接池: ${dbConfig.pool.connectionLimit} 连接`)
  console.log(`   默认底注: ${gameConfig.defaultAnte}`)
  console.log(`   默认筹码: ${gameConfig.defaultChips}`)
}
