/**
 * 安全工具
 * 提供密码加密、验证等安全功能
 */
import bcrypt from 'bcrypt'
import { securityConfig } from '../config/index.js'

/**
 * 加密密码
 */
export async function hashPassword(password) {
  return await bcrypt.hash(password, securityConfig.bcryptRounds)
}

/**
 * 验证密码
 */
export async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash)
}

/**
 * 生成随机字符串
 */
export function generateRandomString(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * 清理敏感信息
 */
export function sanitizeUser(user) {
  if (!user) return null
  const { password, ...safeUser } = user
  return safeUser
}

/**
 * 防止 SQL 注入 - 转义特殊字符
 */
export function escapeString(str) {
  if (typeof str !== 'string') return str
  return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, (char) => {
    switch (char) {
      case '\0': return '\\0'
      case '\x08': return '\\b'
      case '\x09': return '\\t'
      case '\x1a': return '\\z'
      case '\n': return '\\n'
      case '\r': return '\\r'
      case '"':
      case "'":
      case '\\':
      case '%':
        return '\\' + char
      default:
        return char
    }
  })
}

/**
 * 限流器 - 简单的内存限流
 */
class RateLimiter {
  constructor(maxAttempts, windowMs) {
    this.maxAttempts = maxAttempts
    this.windowMs = windowMs
    this.attempts = new Map()
  }
  
  /**
   * 检查是否超过限制
   */
  isLimited(key) {
    const now = Date.now()
    const record = this.attempts.get(key)
    
    if (!record) {
      this.attempts.set(key, { count: 1, resetAt: now + this.windowMs })
      return false
    }
    
    if (now > record.resetAt) {
      this.attempts.set(key, { count: 1, resetAt: now + this.windowMs })
      return false
    }
    
    if (record.count >= this.maxAttempts) {
      return true
    }
    
    record.count++
    return false
  }
  
  /**
   * 重置限制
   */
  reset(key) {
    this.attempts.delete(key)
  }
  
  /**
   * 清理过期记录
   */
  cleanup() {
    const now = Date.now()
    for (const [key, record] of this.attempts.entries()) {
      if (now > record.resetAt) {
        this.attempts.delete(key)
      }
    }
  }
}

// 登录限流器
export const loginLimiter = new RateLimiter(
  securityConfig.maxLoginAttempts,
  securityConfig.lockoutDuration
)

// 定期清理过期记录
setInterval(() => {
  loginLimiter.cleanup()
}, 60000) // 每分钟清理一次
