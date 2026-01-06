/**
 * 测试密码迁移
 */
import 'dotenv/config'
import { pool } from '../db/connection.js'
import bcrypt from 'bcrypt'

async function test() {
  try {
    console.log('🔄 测试数据库连接...')
    const [rows] = await pool.execute('SELECT COUNT(*) as count FROM users')
    console.log(`✅ 找到 ${rows[0].count} 个用户`)
    
    console.log('🔄 测试 bcrypt...')
    const hash = await bcrypt.hash('test123', 10)
    console.log(`✅ bcrypt 正常: ${hash.substring(0, 20)}...`)
    
    await pool.end()
    console.log('✅ 测试完成')
    process.exit(0)
  } catch (error) {
    console.error('❌ 测试失败:', error.message)
    await pool.end()
    process.exit(1)
  }
}

test()
