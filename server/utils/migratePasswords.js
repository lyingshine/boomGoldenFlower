/**
 * 密码迁移工具
 * 将数据库中的明文密码加密
 */
import 'dotenv/config'
import { pool } from '../db/connection.js'
import { hashPassword } from './security.js'

export async function migratePasswords() {
  try {
    console.log('🔄 开始迁移密码...')
    
    // 获取所有用户
    const [users] = await pool.execute('SELECT username, password FROM users')
    
    let migrated = 0
    let skipped = 0
    
    for (const user of users) {
      // 检查密码是否已经是 bcrypt 哈希（以 $2b$ 开头）
      if (user.password.startsWith('$2b$')) {
        skipped++
        continue
      }
      
      // 加密明文密码
      const hashedPassword = await hashPassword(user.password)
      
      // 更新数据库
      await pool.execute(
        'UPDATE users SET password = ? WHERE username = ?',
        [hashedPassword, user.username]
      )
      
      migrated++
      console.log(`✅ 已迁移: ${user.username}`)
    }
    
    console.log(`\n✅ 迁移完成！`)
    console.log(`   已迁移: ${migrated} 个用户`)
    console.log(`   已跳过: ${skipped} 个用户（已加密）`)
    
    await pool.end()
    return { migrated, skipped }
  } catch (error) {
    console.error('❌ 密码迁移失败:', error.message)
    await pool.end()
    throw error
  }
}

// 如果直接运行此文件
const isMainModule = process.argv[1] && import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`
if (isMainModule) {
  migratePasswords()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}
