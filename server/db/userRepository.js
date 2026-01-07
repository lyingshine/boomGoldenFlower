/**
 * 用户数据仓库
 */
import { pool, executeWithRetry } from './connection.js'

// 获取用户
export async function getUser(username) {
  const [rows] = await executeWithRetry(
    'SELECT * FROM users WHERE username = ?',
    [username]
  )
  if (rows.length === 0) return null
  return formatUser(rows[0])
}

// 获取所有用户
export async function getAllUsers() {
  const [rows] = await executeWithRetry('SELECT * FROM users', [])
  return rows.map(formatUser)
}

// 创建用户
export async function createUser(userData) {
  const { username, password, chips = 1000 } = userData
  const now = Date.now()

  await executeWithRetry(
    `INSERT INTO users (username, password, chips, total_games, wins, losses, created_at, last_login, sign_in_streak, total_sign_ins)
     VALUES (?, ?, ?, 0, 0, 0, ?, ?, 0, 0)`,
    [username, password, chips, now, now]
  )

  return getUser(username)
}

// 更新用户
export async function updateUser(username, updates) {
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
    totalSignIns: 'total_sign_ins',
    nickname: 'nickname',
    avatar: 'avatar',
    avatarUrl: 'avatar_url'
  }

  for (const [key, value] of Object.entries(updates)) {
    if (fieldMap[key] && value !== undefined) {
      fields.push(`${fieldMap[key]} = ?`)
      values.push(value)
    }
  }

  if (fields.length === 0) return

  values.push(username)
  await executeWithRetry(
    `UPDATE users SET ${fields.join(', ')} WHERE username = ?`,
    values
  )
}

// 格式化用户数据
function formatUser(row) {
  return {
    username: row.username,
    password: row.password,
    nickname: row.nickname,
    avatar: row.avatar,
    avatarUrl: row.avatar_url,
    chips: row.chips,
    totalGames: row.total_games,
    wins: row.wins,
    losses: row.losses,
    createdAt: row.created_at,
    lastLogin: row.last_login,
    lastSignIn: row.last_sign_in,
    signInStreak: row.sign_in_streak,
    totalSignIns: row.total_sign_ins,
    isAdmin: row.is_admin === 1
  }
}

// 批量导入用户
export async function importUsers(usersData) {
  const users = Object.values(usersData)
  let imported = 0

  for (const user of users) {
    try {
      const existing = await getUser(user.username)
      if (existing) {
        console.log(`⏭️ 用户已存在，跳过: ${user.username}`)
        continue
      }

      await pool.execute(
        `INSERT INTO users (username, password, chips, total_games, wins, losses, created_at, last_login, last_sign_in, sign_in_streak, total_sign_ins)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [user.username, user.password, user.chips || 1000, user.totalGames || 0,
         user.wins || 0, user.losses || 0, user.createdAt || Date.now(),
         user.lastLogin || Date.now(), user.lastSignIn || null,
         user.signInStreak || 0, user.totalSignIns || 0]
      )
      imported++
      console.log(`✅ 导入用户: ${user.username}`)
    } catch (e) {
      console.error(`❌ 导入用户失败: ${user.username}`, e.message)
    }
  }

  return imported
}
