/**
 * 数据库连接管理
 */
import mysql from 'mysql2/promise'
import { dbConfig } from '../config/index.js'

// 创建连接池
export const pool = mysql.createPool({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  ...dbConfig.pool
})

// 连接池错误处理
pool.on('error', (err) => {
  console.error('❌ 数据库连接池错误:', err.message)
})

// 带重试的查询执行
export async function executeWithRetry(sql, params, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await pool.execute(sql, params)
    } catch (err) {
      if (i === retries || !isRetryableError(err)) {
        throw err
      }
      console.warn(`⚠️ 数据库查询失败，重试 ${i + 1}/${retries}:`, err.message)
      await new Promise(r => setTimeout(r, 500))
    }
  }
}

// 判断是否可重试的错误
function isRetryableError(err) {
  const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST']
  return retryableCodes.includes(err.code) || err.message.includes('ECONNRESET')
}
