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
  const createUsersTableSQL = `
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
  
  // 玩家行为档案表（AI 用于学习玩家风格）
  const createProfilesTableSQL = `
    CREATE TABLE IF NOT EXISTS player_profiles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      total_hands INT DEFAULT 0,
      fold_count INT DEFAULT 0,
      raise_count INT DEFAULT 0,
      call_count INT DEFAULT 0,
      blind_bet_count INT DEFAULT 0,
      showdown_wins INT DEFAULT 0,
      showdown_losses INT DEFAULT 0,
      bluff_caught INT DEFAULT 0,
      big_bet_with_weak INT DEFAULT 0,
      avg_peek_round FLOAT DEFAULT 0,
      peek_round_samples INT DEFAULT 0,
      updated_at BIGINT,
      INDEX idx_username (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `
  
  try {
    await pool.execute(createUsersTableSQL)
    await pool.execute(createProfilesTableSQL)
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

// ========== 玩家行为档案（AI 学习用）==========

// 获取玩家档案
async function getPlayerProfile(username) {
  const [rows] = await pool.execute(
    'SELECT * FROM player_profiles WHERE username = ?',
    [username]
  )
  if (rows.length === 0) return null
  return formatProfile(rows[0])
}

// 创建或更新玩家档案（增量更新）
async function updatePlayerProfile(username, updates) {
  const existing = await getPlayerProfile(username)
  const now = Date.now()
  
  if (!existing) {
    // 创建新档案
    await pool.execute(
      `INSERT INTO player_profiles 
       (username, total_hands, fold_count, raise_count, call_count, blind_bet_count, 
        showdown_wins, showdown_losses, bluff_caught, big_bet_with_weak, 
        avg_peek_round, peek_round_samples, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        username,
        updates.totalHands || 0,
        updates.foldCount || 0,
        updates.raiseCount || 0,
        updates.callCount || 0,
        updates.blindBetCount || 0,
        updates.showdownWins || 0,
        updates.showdownLosses || 0,
        updates.bluffCaught || 0,
        updates.bigBetWithWeak || 0,
        updates.avgPeekRound || 0,
        updates.peekRoundSamples || 0,
        now
      ]
    )
  } else {
    // 增量更新
    const fields = []
    const values = []
    
    const incrementFields = {
      totalHands: 'total_hands',
      foldCount: 'fold_count',
      raiseCount: 'raise_count',
      callCount: 'call_count',
      blindBetCount: 'blind_bet_count',
      showdownWins: 'showdown_wins',
      showdownLosses: 'showdown_losses',
      bluffCaught: 'bluff_caught',
      bigBetWithWeak: 'big_bet_with_weak'
    }
    
    for (const [key, dbField] of Object.entries(incrementFields)) {
      if (updates[key]) {
        fields.push(`${dbField} = ${dbField} + ?`)
        values.push(updates[key])
      }
    }
    
    // 看牌轮次用滑动平均
    if (updates.peekRound) {
      const newSamples = existing.peekRoundSamples + 1
      const newAvg = (existing.avgPeekRound * existing.peekRoundSamples + updates.peekRound) / newSamples
      fields.push('avg_peek_round = ?', 'peek_round_samples = ?')
      values.push(newAvg, newSamples)
    }
    
    if (fields.length > 0) {
      fields.push('updated_at = ?')
      values.push(now)
      values.push(username)
      
      await pool.execute(
        `UPDATE player_profiles SET ${fields.join(', ')} WHERE username = ?`,
        values
      )
    }
  }
}

// 批量获取玩家档案
async function getPlayerProfiles(usernames) {
  if (!usernames || usernames.length === 0) return {}
  
  const placeholders = usernames.map(() => '?').join(',')
  const [rows] = await pool.execute(
    `SELECT * FROM player_profiles WHERE username IN (${placeholders})`,
    usernames
  )
  
  const profiles = {}
  for (const row of rows) {
    profiles[row.username] = formatProfile(row)
  }
  return profiles
}

// 格式化档案数据
function formatProfile(row) {
  return {
    username: row.username,
    totalHands: row.total_hands,
    foldCount: row.fold_count,
    raiseCount: row.raise_count,
    callCount: row.call_count,
    blindBetCount: row.blind_bet_count,
    showdownWins: row.showdown_wins,
    showdownLosses: row.showdown_losses,
    bluffCaught: row.bluff_caught,
    bigBetWithWeak: row.big_bet_with_weak,
    avgPeekRound: row.avg_peek_round,
    peekRoundSamples: row.peek_round_samples,
    updatedAt: row.updated_at
  }
}

export { getPlayerProfile, updatePlayerProfile, getPlayerProfiles }
