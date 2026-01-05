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
  queueLimit: 0,
  // 连接保活配置
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  // 连接超时配置
  connectTimeout: 10000,
  // 自动重连
  maxIdle: 10,
  idleTimeout: 60000
}

// 创建连接池
const pool = mysql.createPool(dbConfig)

// 连接池错误处理
pool.on('error', (err) => {
  console.error('❌ 数据库连接池错误:', err.message)
})

// 带重试的查询执行
async function executeWithRetry(sql, params, retries = 2) {
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

// 初始化数据库表
async function initDatabase() {
  const createUsersTableSQL = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      nickname VARCHAR(50),
      avatar VARCHAR(20),
      avatar_url VARCHAR(255),
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
      -- 新增：更细粒度的行为数据
      early_fold_count INT DEFAULT 0,
      late_fold_count INT DEFAULT 0,
      small_raise_count INT DEFAULT 0,
      big_raise_count INT DEFAULT 0,
      check_raise_count INT DEFAULT 0,
      showdown_initiated INT DEFAULT 0,
      showdown_received INT DEFAULT 0,
      won_without_showdown INT DEFAULT 0,
      total_chips_won BIGINT DEFAULT 0,
      total_chips_lost BIGINT DEFAULT 0,
      max_single_win INT DEFAULT 0,
      max_single_loss INT DEFAULT 0,
      avg_bet_size FLOAT DEFAULT 0,
      bet_size_samples INT DEFAULT 0,
      updated_at BIGINT,
      INDEX idx_username (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `
  
  // AI 对局记录表
  const createAIGamesTableSQL = `
    CREATE TABLE IF NOT EXISTS ai_games (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ai_name VARCHAR(50) NOT NULL,
      opponent_name VARCHAR(50),
      room_code VARCHAR(20),
      hand_type VARCHAR(30),
      hand_weight INT,
      action_taken VARCHAR(20),
      result VARCHAR(20),
      chips_won INT DEFAULT 0,
      round_count INT DEFAULT 1,
      created_at BIGINT,
      INDEX idx_ai_name (ai_name),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `
  
  // AI 牌力认知表（记录 AI 对牌力的判断是否正确）
  const createAIHandJudgmentTableSQL = `
    CREATE TABLE IF NOT EXISTS ai_hand_judgments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ai_name VARCHAR(50) NOT NULL,
      hand_type VARCHAR(30),
      hand_weight INT,
      judged_as VARCHAR(20),
      actual_result VARCHAR(20),
      was_correct TINYINT DEFAULT 0,
      opponent_hand_type VARCHAR(30),
      opponent_hand_weight INT,
      created_at BIGINT,
      INDEX idx_ai_name (ai_name),
      INDEX idx_hand_type (hand_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `
  
  // AI 对玩家的策略表（记录 AI 对每个玩家的解读和策略）
  const createAIPlayerStrategyTableSQL = `
    CREATE TABLE IF NOT EXISTS ai_player_strategies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ai_name VARCHAR(50) NOT NULL,
      target_player VARCHAR(50) NOT NULL,
      player_type VARCHAR(20),
      bluff_tendency FLOAT DEFAULT 0.5,
      aggression_level FLOAT DEFAULT 0.5,
      fold_threshold FLOAT DEFAULT 0.5,
      recommended_strategy TEXT,
      strategy_success_rate FLOAT DEFAULT 0,
      total_encounters INT DEFAULT 0,
      wins_against INT DEFAULT 0,
      updated_at BIGINT,
      UNIQUE KEY uk_ai_player (ai_name, target_player),
      INDEX idx_ai_name (ai_name),
      INDEX idx_target_player (target_player)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `
  
  // AI 大牌认知校准表（记录 AI 对什么是大牌的认知及校准）
  const createAIHandCalibrationTableSQL = `
    CREATE TABLE IF NOT EXISTS ai_hand_calibration (
      id INT AUTO_INCREMENT PRIMARY KEY,
      hand_type VARCHAR(30) NOT NULL,
      base_weight INT NOT NULL,
      calibrated_weight INT,
      win_count INT DEFAULT 0,
      lose_count INT DEFAULT 0,
      total_showdowns INT DEFAULT 0,
      avg_opponent_weight FLOAT DEFAULT 0,
      should_be_strong TINYINT DEFAULT 1,
      calibration_note TEXT,
      updated_at BIGINT,
      UNIQUE KEY uk_hand_type (hand_type),
      INDEX idx_hand_type (hand_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `
  
  try {
    await pool.execute(createUsersTableSQL)
    await pool.execute(createProfilesTableSQL)
    await pool.execute(createAIGamesTableSQL)
    await pool.execute(createAIHandJudgmentTableSQL)
    await pool.execute(createAIPlayerStrategyTableSQL)
    await pool.execute(createAIHandCalibrationTableSQL)
    
    // 检查并添加新字段（兼容旧表）
    try {
      await pool.execute('ALTER TABLE users ADD COLUMN nickname VARCHAR(50)')
    } catch (e) { /* 字段已存在 */ }
    try {
      await pool.execute('ALTER TABLE users ADD COLUMN avatar VARCHAR(20)')
    } catch (e) { /* 字段已存在 */ }
    try {
      await pool.execute('ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255)')
    } catch (e) { /* 字段已存在 */ }
    
    // player_profiles 新增字段
    const newProfileFields = [
      'early_fold_count INT DEFAULT 0',
      'late_fold_count INT DEFAULT 0',
      'small_raise_count INT DEFAULT 0',
      'big_raise_count INT DEFAULT 0',
      'check_raise_count INT DEFAULT 0',
      'showdown_initiated INT DEFAULT 0',
      'showdown_received INT DEFAULT 0',
      'won_without_showdown INT DEFAULT 0',
      'total_chips_won BIGINT DEFAULT 0',
      'total_chips_lost BIGINT DEFAULT 0',
      'max_single_win INT DEFAULT 0',
      'max_single_loss INT DEFAULT 0',
      'avg_bet_size FLOAT DEFAULT 0',
      'bet_size_samples INT DEFAULT 0'
    ]
    for (const field of newProfileFields) {
      try {
        await pool.execute(`ALTER TABLE player_profiles ADD COLUMN ${field}`)
      } catch (e) { /* 字段已存在 */ }
    }
    
    console.log('✅ 数据库表初始化成功')
  } catch (error) {
    console.error('❌ 数据库表初始化失败:', error.message)
    throw error
  }
}

// 获取用户
async function getUser(username) {
  const [rows] = await executeWithRetry(
    'SELECT * FROM users WHERE username = ?',
    [username]
  )
  if (rows.length === 0) return null
  return formatUser(rows[0])
}

// 获取所有用户
async function getAllUsers() {
  const [rows] = await executeWithRetry('SELECT * FROM users', [])
  return rows.map(formatUser)
}

// 创建用户
async function createUser(userData) {
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

// 格式化用户数据（数据库字段 -> JS 对象）
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
        avg_peek_round, peek_round_samples,
        early_fold_count, late_fold_count, small_raise_count, big_raise_count,
        check_raise_count, showdown_initiated, showdown_received, won_without_showdown,
        total_chips_won, total_chips_lost, max_single_win, max_single_loss,
        avg_bet_size, bet_size_samples, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        updates.earlyFoldCount || 0,
        updates.lateFoldCount || 0,
        updates.smallRaiseCount || 0,
        updates.bigRaiseCount || 0,
        updates.checkRaiseCount || 0,
        updates.showdownInitiated || 0,
        updates.showdownReceived || 0,
        updates.wonWithoutShowdown || 0,
        updates.totalChipsWon || 0,
        updates.totalChipsLost || 0,
        updates.maxSingleWin || 0,
        updates.maxSingleLoss || 0,
        updates.avgBetSize || 0,
        updates.betSizeSamples || 0,
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
      bigBetWithWeak: 'big_bet_with_weak',
      earlyFoldCount: 'early_fold_count',
      lateFoldCount: 'late_fold_count',
      smallRaiseCount: 'small_raise_count',
      bigRaiseCount: 'big_raise_count',
      checkRaiseCount: 'check_raise_count',
      showdownInitiated: 'showdown_initiated',
      showdownReceived: 'showdown_received',
      wonWithoutShowdown: 'won_without_showdown',
      totalChipsWon: 'total_chips_won',
      totalChipsLost: 'total_chips_lost'
    }
    
    for (const [key, dbField] of Object.entries(incrementFields)) {
      if (updates[key]) {
        fields.push(`${dbField} = ${dbField} + ?`)
        values.push(updates[key])
      }
    }
    
    // 最大单次赢/输用 GREATEST
    if (updates.maxSingleWin) {
      fields.push('max_single_win = GREATEST(max_single_win, ?)')
      values.push(updates.maxSingleWin)
    }
    if (updates.maxSingleLoss) {
      fields.push('max_single_loss = GREATEST(max_single_loss, ?)')
      values.push(updates.maxSingleLoss)
    }
    
    // 看牌轮次用滑动平均
    if (updates.peekRound) {
      const newSamples = existing.peekRoundSamples + 1
      const newAvg = (existing.avgPeekRound * existing.peekRoundSamples + updates.peekRound) / newSamples
      fields.push('avg_peek_round = ?', 'peek_round_samples = ?')
      values.push(newAvg, newSamples)
    }
    
    // 下注金额用滑动平均
    if (updates.betSize) {
      const newSamples = (existing.betSizeSamples || 0) + 1
      const newAvg = ((existing.avgBetSize || 0) * (existing.betSizeSamples || 0) + updates.betSize) / newSamples
      fields.push('avg_bet_size = ?', 'bet_size_samples = ?')
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
    // 新增字段
    earlyFoldCount: row.early_fold_count || 0,
    lateFoldCount: row.late_fold_count || 0,
    smallRaiseCount: row.small_raise_count || 0,
    bigRaiseCount: row.big_raise_count || 0,
    checkRaiseCount: row.check_raise_count || 0,
    showdownInitiated: row.showdown_initiated || 0,
    showdownReceived: row.showdown_received || 0,
    wonWithoutShowdown: row.won_without_showdown || 0,
    totalChipsWon: row.total_chips_won || 0,
    totalChipsLost: row.total_chips_lost || 0,
    maxSingleWin: row.max_single_win || 0,
    maxSingleLoss: row.max_single_loss || 0,
    avgBetSize: row.avg_bet_size || 0,
    betSizeSamples: row.bet_size_samples || 0,
    updatedAt: row.updated_at
  }
}

export { getPlayerProfile, updatePlayerProfile, getPlayerProfiles }

// ========== AI 对局记录 ==========

// 记录 AI 对局
async function recordAIGame(data) {
  const now = Date.now()
  await pool.execute(
    `INSERT INTO ai_games (ai_name, opponent_name, room_code, hand_type, hand_weight, action_taken, result, chips_won, round_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.aiName || 'unknown',
      data.opponentName || null,
      data.roomCode || null,
      data.handType || null,
      data.handWeight || null,
      data.actionTaken || null,
      data.result || null,
      data.chipsWon || 0,
      data.roundCount || 1,
      now
    ]
  )
}

// 获取 AI 综合统计
async function getAIStats() {
  const [rows] = await pool.execute(`
    SELECT 
      ai_name,
      COUNT(*) as total_games,
      SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN result = 'lose' THEN 1 ELSE 0 END) as losses,
      SUM(chips_won) as total_chips_won,
      AVG(round_count) as avg_rounds
    FROM ai_games
    GROUP BY ai_name
    ORDER BY wins DESC
  `)
  return rows.map(row => ({
    aiName: row.ai_name,
    totalGames: row.total_games,
    wins: row.wins,
    losses: row.losses,
    winRate: row.total_games > 0 ? Math.round(row.wins / row.total_games * 100) : 0,
    totalChipsWon: row.total_chips_won,
    avgRounds: Math.round(row.avg_rounds * 10) / 10
  }))
}

// 获取单个 AI 的详细数据
async function getAIDetail(aiName) {
  // 基础统计
  const [statsRows] = await pool.execute(`
    SELECT 
      COUNT(*) as total_games,
      SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN result = 'lose' THEN 1 ELSE 0 END) as losses,
      SUM(chips_won) as total_chips_won
    FROM ai_games WHERE ai_name = ?
  `, [aiName])
  
  // 按牌型统计
  const [handRows] = await pool.execute(`
    SELECT 
      hand_type,
      COUNT(*) as count,
      SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins
    FROM ai_games WHERE ai_name = ? AND hand_type IS NOT NULL
    GROUP BY hand_type
  `, [aiName])
  
  // 按操作统计
  const [actionRows] = await pool.execute(`
    SELECT 
      action_taken,
      COUNT(*) as count,
      SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins
    FROM ai_games WHERE ai_name = ?
    GROUP BY action_taken
  `, [aiName])
  
  // 最近对局
  const [recentRows] = await pool.execute(`
    SELECT * FROM ai_games WHERE ai_name = ?
    ORDER BY created_at DESC LIMIT 20
  `, [aiName])
  
  return {
    stats: statsRows[0] ? {
      totalGames: statsRows[0].total_games,
      wins: statsRows[0].wins,
      losses: statsRows[0].losses,
      winRate: statsRows[0].total_games > 0 ? Math.round(statsRows[0].wins / statsRows[0].total_games * 100) : 0,
      totalChipsWon: statsRows[0].total_chips_won
    } : null,
    handStats: handRows.map(r => ({
      handType: r.hand_type,
      count: r.count,
      wins: r.wins,
      winRate: r.count > 0 ? Math.round(r.wins / r.count * 100) : 0
    })),
    actionStats: actionRows.map(r => ({
      action: r.action_taken,
      count: r.count,
      wins: r.wins,
      winRate: r.count > 0 ? Math.round(r.wins / r.count * 100) : 0
    })),
    recentGames: recentRows.map(r => ({
      opponentName: r.opponent_name,
      handType: r.hand_type,
      action: r.action_taken,
      result: r.result,
      chipsWon: r.chips_won,
      createdAt: r.created_at
    }))
  }
}

// ========== AI 牌力认知 ==========

// 记录 AI 牌力判断
async function recordAIHandJudgment(data) {
  const now = Date.now()
  await pool.execute(
    `INSERT INTO ai_hand_judgments (ai_name, hand_type, hand_weight, judged_as, actual_result, was_correct, opponent_hand_type, opponent_hand_weight, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.aiName, data.handType, data.handWeight, data.judgedAs, data.actualResult, data.wasCorrect ? 1 : 0, data.opponentHandType, data.opponentHandWeight, now]
  )
}

// 获取 AI 牌力认知统计
async function getAIHandJudgmentStats() {
  const [rows] = await pool.execute(`
    SELECT 
      hand_type,
      judged_as,
      COUNT(*) as count,
      SUM(was_correct) as correct_count
    FROM ai_hand_judgments
    GROUP BY hand_type, judged_as
    ORDER BY hand_type, judged_as
  `)
  
  // 按牌型分组
  const byHandType = {}
  for (const row of rows) {
    if (!byHandType[row.hand_type]) {
      byHandType[row.hand_type] = { total: 0, correct: 0, judgments: [] }
    }
    byHandType[row.hand_type].total += row.count
    byHandType[row.hand_type].correct += row.correct_count
    byHandType[row.hand_type].judgments.push({
      judgedAs: row.judged_as,
      count: row.count,
      correctCount: row.correct_count,
      accuracy: row.count > 0 ? Math.round(row.correct_count / row.count * 100) : 0
    })
  }
  
  return Object.entries(byHandType).map(([handType, data]) => ({
    handType,
    total: data.total,
    correct: data.correct,
    accuracy: data.total > 0 ? Math.round(data.correct / data.total * 100) : 0,
    judgments: data.judgments
  }))
}

// 获取所有玩家档案（用于 AI 监控）
async function getAllPlayerProfiles() {
  const [rows] = await pool.execute('SELECT * FROM player_profiles ORDER BY total_hands DESC')
  return rows.map(formatProfile)
}

export { recordAIGame, getAIStats, getAIDetail, recordAIHandJudgment, getAIHandJudgmentStats, getAllPlayerProfiles }

// ========== AI 对玩家策略 ==========

// 更新 AI 对某玩家的策略（使用 upsert 避免锁）
async function updateAIPlayerStrategy(aiName, targetPlayer, data) {
  const now = Date.now()
  await pool.execute(
    `INSERT INTO ai_player_strategies 
     (ai_name, target_player, player_type, bluff_tendency, aggression_level, fold_threshold, 
      recommended_strategy, strategy_success_rate, total_encounters, wins_against, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)
     ON DUPLICATE KEY UPDATE
     player_type = VALUES(player_type),
     bluff_tendency = VALUES(bluff_tendency),
     aggression_level = VALUES(aggression_level),
     fold_threshold = VALUES(fold_threshold),
     recommended_strategy = VALUES(recommended_strategy),
     total_encounters = total_encounters + 1,
     wins_against = wins_against + VALUES(wins_against),
     strategy_success_rate = (wins_against + VALUES(wins_against)) / (total_encounters + 1),
     updated_at = VALUES(updated_at)`,
    [aiName, targetPlayer, data.playerType || 'unknown', data.bluffTendency || 0.5, 
     data.aggressionLevel || 0.5, data.foldThreshold || 0.5, data.recommendedStrategy || '',
     data.won ? 1 : 0, now]
  )
}

// 获取 AI 对某玩家的策略
async function getAIPlayerStrategy(aiName, targetPlayer) {
  const [rows] = await pool.execute(
    'SELECT * FROM ai_player_strategies WHERE ai_name = ? AND target_player = ?',
    [aiName, targetPlayer]
  )
  if (rows.length === 0) return null
  return formatAIPlayerStrategy(rows[0])
}

// 获取 AI 对所有玩家的策略
async function getAIAllPlayerStrategies(aiName) {
  const [rows] = await pool.execute(
    'SELECT * FROM ai_player_strategies WHERE ai_name = ? ORDER BY total_encounters DESC',
    [aiName]
  )
  return rows.map(formatAIPlayerStrategy)
}

// 获取所有 AI 的玩家策略汇总
async function getAllAIPlayerStrategies() {
  const [rows] = await pool.execute(
    `SELECT ai_name, target_player, player_type, bluff_tendency, aggression_level, 
     fold_threshold, recommended_strategy, strategy_success_rate, total_encounters, wins_against
     FROM ai_player_strategies ORDER BY ai_name, total_encounters DESC`
  )
  return rows.map(formatAIPlayerStrategy)
}

function formatAIPlayerStrategy(row) {
  return {
    aiName: row.ai_name,
    targetPlayer: row.target_player,
    playerType: row.player_type,
    bluffTendency: row.bluff_tendency,
    aggressionLevel: row.aggression_level,
    foldThreshold: row.fold_threshold,
    recommendedStrategy: row.recommended_strategy,
    strategySuccessRate: row.strategy_success_rate,
    totalEncounters: row.total_encounters,
    winsAgainst: row.wins_against,
    updatedAt: row.updated_at
  }
}

// ========== AI 大牌认知校准 ==========

// 记录开牌结果用于校准（使用 upsert 避免锁）
async function recordShowdownForCalibration(handType, handWeight, won, opponentWeight) {
  const now = Date.now()
  
  // 先尝试插入，如果存在则更新
  await pool.execute(
    `INSERT INTO ai_hand_calibration 
     (hand_type, base_weight, calibrated_weight, win_count, lose_count, total_showdowns, avg_opponent_weight, should_be_strong, calibration_note, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, 1, '数据收集中', ?)
     ON DUPLICATE KEY UPDATE
     win_count = win_count + ?,
     lose_count = lose_count + ?,
     total_showdowns = total_showdowns + 1,
     avg_opponent_weight = (avg_opponent_weight * (total_showdowns - 1) + ?) / total_showdowns,
     updated_at = ?`,
    [handType, handWeight, handWeight, won ? 1 : 0, won ? 0 : 1, opponentWeight, now,
     won ? 1 : 0, won ? 0 : 1, opponentWeight, now]
  )
  
  // 异步更新校准权重（不阻塞主流程）
  updateCalibrationWeight(handType).catch(e => console.error('校准权重更新失败:', e.message))
}

// 更新校准权重（独立函数，避免阻塞）
async function updateCalibrationWeight(handType) {
  const [rows] = await pool.execute(
    'SELECT base_weight, win_count, total_showdowns FROM ai_hand_calibration WHERE hand_type = ?',
    [handType]
  )
  if (rows.length === 0 || rows[0].total_showdowns < 5) return
  
  const row = rows[0]
  const winRate = row.win_count / row.total_showdowns
  
  let calibratedWeight = row.base_weight
  if (winRate < 0.4) {
    calibratedWeight = Math.round(row.base_weight * 0.85)
  } else if (winRate < 0.5) {
    calibratedWeight = Math.round(row.base_weight * 0.95)
  } else if (winRate > 0.7) {
    calibratedWeight = Math.round(row.base_weight * 1.1)
  }
  
  const shouldBeStrong = winRate >= 0.5 ? 1 : 0
  const note = winRate < 0.4 ? '此牌型胜率偏低，建议谨慎' : 
               winRate > 0.7 ? '此牌型表现优秀' : '表现正常'
  
  await pool.execute(
    `UPDATE ai_hand_calibration SET calibrated_weight = ?, should_be_strong = ?, calibration_note = ? WHERE hand_type = ?`,
    [calibratedWeight, shouldBeStrong, note, handType]
  )
}

// 获取校准后的牌力权重
async function getCalibratedHandWeight(handType, baseWeight) {
  const [rows] = await pool.execute(
    'SELECT calibrated_weight FROM ai_hand_calibration WHERE hand_type = ?', [handType]
  )
  if (rows.length === 0) return baseWeight
  return rows[0].calibrated_weight || baseWeight
}

// 获取所有牌型校准数据
async function getAllHandCalibrations() {
  const [rows] = await pool.execute(
    'SELECT * FROM ai_hand_calibration ORDER BY base_weight DESC'
  )
  return rows.map(row => ({
    handType: row.hand_type,
    baseWeight: row.base_weight,
    calibratedWeight: row.calibrated_weight,
    winCount: row.win_count,
    loseCount: row.lose_count,
    totalShowdowns: row.total_showdowns,
    winRate: row.total_showdowns > 0 ? Math.round(row.win_count / row.total_showdowns * 100) : 0,
    avgOpponentWeight: Math.round(row.avg_opponent_weight),
    shouldBeStrong: row.should_be_strong === 1,
    calibrationNote: row.calibration_note,
    updatedAt: row.updated_at
  }))
}

export { 
  updateAIPlayerStrategy, getAIPlayerStrategy, getAIAllPlayerStrategies, getAllAIPlayerStrategies,
  recordShowdownForCalibration, getCalibratedHandWeight, getAllHandCalibrations,
  clearAllAIData
}

// 清除所有 AI 数据
async function clearAllAIData() {
  await pool.execute('TRUNCATE TABLE ai_games')
  await pool.execute('TRUNCATE TABLE ai_hand_judgments')
  await pool.execute('TRUNCATE TABLE ai_player_strategies')
  await pool.execute('TRUNCATE TABLE ai_hand_calibration')
  await pool.execute('TRUNCATE TABLE player_profiles')
  console.log('✅ 已清除所有 AI 数据和玩家建模数据')
}
