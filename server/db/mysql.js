/**
 * MySQL 数据库连接模块
 */
import mysql from 'mysql2/promise'

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || '115.159.68.212',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'bgf',
  password: process.env.DB_PASSWORD || '132014',
  database: process.env.DB_NAME || 'bgf',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
}

// 创建连接池
const pool = mysql.createPool(dbConfig)

// 初始化数据库表
async function initDatabase() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      chips INT DEFAULT 1000,
      total_games INT DEFAULT 0,
      wins INT DEFAULT 0,
      losses INT DEFAULT 0,
      created_at BIGINT,
      last_login BIGINT,
      last_sign_in BIGINT,
      sign_in_streak INT DEFAULT 0,
      total_sign_ins INT DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `
  
  try {
    await pool.execute(createTableSQL)
    console.log('✅ 数据库表初始化成功')
  } catch (error) {
    console.error('❌ 数据库表初始化失败:', error.message)
    throw error
  }
}

// 获取用户
async function getUser(username) {
  const [rows] = await pool.execute(
    'SELECT * FROM users WHERE username = ?',
    [username]
  )
  if (rows.length === 0) return null
  return formatUser(rows[0])
}

// 获取所有用户
async function getAllUsers() {
  const [rows] = await pool.execute('SELECT * FROM users')
  return rows.map(formatUser)
}

// 创建用户
async function createUser(userData) {
  const { username, password, chips = 1000 } = userData
  const now = Date.now()
  
  await pool.execute(
    `INSERT INTO users (username, password, chips, total_games, wins, losses, created_at, last_login, sign_in_streak, total_sign_ins)
     VALUES (?, ?, ?, 0, 0, 0, ?, ?, 0, 0)`,
    [username, password, chips, now, now]
  )
  
  return getUser(username)
}

// 更新用户
async function updateUser(username, updates) {
  const fields = []
  const values = []
  
  const fieldMap = {
    chips: 'chips',
    totalGames: 'total_games',
    wins: 'wins',
    losses: 'losses',
    lastLogin: 'last_login',
    lastSignIn: 'last_sign_in',
    signInStreak: 'sign_in_streak',
    totalSignIns: 'total_sign_ins'
  }
  
  for (const [key, value] of Object.entries(updates)) {
    if (fieldMap[key] && value !== undefined) {
      fields.push(`${fieldMap[key]} = ?`)
      values.push(value)
    }
  }
  
  if (fields.length === 0) return
  
  values.push(username)
  await pool.execute(
    `UPDATE users SET ${fields.join(', ')} WHERE username = ?`,
    values
  )
}

// 格式化用户数据（数据库字段 -> JS 对象）
function formatUser(row) {
  return {
    username: row.username,
    password: row.password,
    chips: row.chips,
    totalGames: row.total_games,
    wins: row.wins,
    losses: row.losses,
    createdAt: row.created_at,
    lastLogin: row.last_login,
    lastSignIn: row.last_sign_in,
    signInStreak: row.sign_in_streak,
    totalSignIns: row.total_sign_ins
  }
}

// 批量导入用户（用于数据迁移）
async function importUsers(usersData) {
  const users = Object.values(usersData)
  let imported = 0
  
  for (const user of users) {
    try {
      // 检查用户是否已存在
      const existing = await getUser(user.username)
      if (existing) {
        console.log(`⏭️ 用户已存在，跳过: ${user.username}`)
        continue
      }
      
      await pool.execute(
        `INSERT INTO users (username, password, chips, total_games, wins, losses, created_at, last_login, last_sign_in, sign_in_streak, total_sign_ins)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.username,
          user.password,
          user.chips || 1000,
          user.totalGames || 0,
          user.wins || 0,
          user.losses || 0,
          user.createdAt || Date.now(),
          user.lastLogin || Date.now(),
          user.lastSignIn || null,
          user.signInStreak || 0,
          user.totalSignIns || 0
        ]
      )
      imported++
      console.log(`✅ 导入用户: ${user.username}`)
    } catch (e) {
      console.error(`❌ 导入用户失败: ${user.username}`, e.message)
    }
  }
  
  return imported
}

export { pool, initDatabase, getUser, getAllUsers, createUser, updateUser, importUsers }
