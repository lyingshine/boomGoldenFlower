/**
 * AI 数据仓库
 */
import { pool } from './connection.js'

// ========== AI 对局记录 ==========

export async function recordAIGame(data) {
  const now = Date.now()
  await pool.execute(
    `INSERT INTO ai_games (ai_name, opponent_name, room_code, hand_type, hand_weight, action_taken, result, chips_won, round_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.aiName || 'unknown', data.opponentName || null, data.roomCode || null,
     data.handType || null, data.handWeight || null, data.actionTaken || null,
     data.result || null, data.chipsWon || 0, data.roundCount || 1, now]
  )
}

export async function getAIStats() {
  const [rows] = await pool.execute(`
    SELECT ai_name, COUNT(*) as total_games,
      SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN result = 'lose' THEN 1 ELSE 0 END) as losses,
      SUM(chips_won) as total_chips_won, AVG(round_count) as avg_rounds
    FROM ai_games GROUP BY ai_name ORDER BY wins DESC
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

export async function getAIDetail(aiName) {
  const [statsRows] = await pool.execute(`
    SELECT COUNT(*) as total_games,
      SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN result = 'lose' THEN 1 ELSE 0 END) as losses,
      SUM(chips_won) as total_chips_won
    FROM ai_games WHERE ai_name = ?
  `, [aiName])

  const [handRows] = await pool.execute(`
    SELECT hand_type, COUNT(*) as count,
      SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins
    FROM ai_games WHERE ai_name = ? AND hand_type IS NOT NULL GROUP BY hand_type
  `, [aiName])

  const [actionRows] = await pool.execute(`
    SELECT action_taken, COUNT(*) as count,
      SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins
    FROM ai_games WHERE ai_name = ? GROUP BY action_taken
  `, [aiName])

  const [recentRows] = await pool.execute(`
    SELECT * FROM ai_games WHERE ai_name = ? ORDER BY created_at DESC LIMIT 20
  `, [aiName])

  return {
    stats: statsRows[0] ? {
      totalGames: statsRows[0].total_games,
      wins: statsRows[0].wins,
      losses: statsRows[0].losses,
      winRate: statsRows[0].total_games > 0 ? Math.round(statsRows[0].wins / statsRows[0].total_games * 100) : 0,
      totalChipsWon: statsRows[0].total_chips_won
    } : null,
    handStats: handRows.map(r => ({ handType: r.hand_type, count: r.count, wins: r.wins, winRate: r.count > 0 ? Math.round(r.wins / r.count * 100) : 0 })),
    actionStats: actionRows.map(r => ({ action: r.action_taken, count: r.count, wins: r.wins, winRate: r.count > 0 ? Math.round(r.wins / r.count * 100) : 0 })),
    recentGames: recentRows.map(r => ({ opponentName: r.opponent_name, handType: r.hand_type, action: r.action_taken, result: r.result, chipsWon: r.chips_won, createdAt: r.created_at }))
  }
}


// ========== AI 牌力认知 ==========

export async function recordAIHandJudgment(data) {
  const now = Date.now()
  await pool.execute(
    `INSERT INTO ai_hand_judgments (ai_name, hand_type, hand_weight, judged_as, actual_result, was_correct, opponent_hand_type, opponent_hand_weight, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.aiName, data.handType, data.handWeight, data.judgedAs, data.actualResult, data.wasCorrect ? 1 : 0, data.opponentHandType, data.opponentHandWeight, now]
  )
}

export async function getAIHandJudgmentStats() {
  const [rows] = await pool.execute(`
    SELECT hand_type, judged_as, COUNT(*) as count, SUM(was_correct) as correct_count
    FROM ai_hand_judgments GROUP BY hand_type, judged_as ORDER BY hand_type, judged_as
  `)

  const byHandType = {}
  for (const row of rows) {
    if (!byHandType[row.hand_type]) {
      byHandType[row.hand_type] = { total: 0, correct: 0, judgments: [] }
    }
    byHandType[row.hand_type].total += row.count
    byHandType[row.hand_type].correct += row.correct_count
    byHandType[row.hand_type].judgments.push({
      judgedAs: row.judged_as, count: row.count, correctCount: row.correct_count,
      accuracy: row.count > 0 ? Math.round(row.correct_count / row.count * 100) : 0
    })
  }

  return Object.entries(byHandType).map(([handType, data]) => ({
    handType, total: data.total, correct: data.correct,
    accuracy: data.total > 0 ? Math.round(data.correct / data.total * 100) : 0,
    judgments: data.judgments
  }))
}

// ========== AI 对玩家策略 ==========

export async function updateAIPlayerStrategy(aiName, targetPlayer, data) {
  const now = Date.now()
  await pool.execute(
    `INSERT INTO ai_player_strategies 
     (ai_name, target_player, player_type, bluff_tendency, aggression_level, fold_threshold, 
      recommended_strategy, strategy_success_rate, total_encounters, wins_against, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)
     ON DUPLICATE KEY UPDATE
     player_type = VALUES(player_type), bluff_tendency = VALUES(bluff_tendency),
     aggression_level = VALUES(aggression_level), fold_threshold = VALUES(fold_threshold),
     recommended_strategy = VALUES(recommended_strategy), total_encounters = total_encounters + 1,
     wins_against = wins_against + VALUES(wins_against),
     strategy_success_rate = (wins_against + VALUES(wins_against)) / (total_encounters + 1),
     updated_at = VALUES(updated_at)`,
    [aiName, targetPlayer, data.playerType || 'unknown', data.bluffTendency || 0.5,
     data.aggressionLevel || 0.5, data.foldThreshold || 0.5, data.recommendedStrategy || '',
     data.won ? 1 : 0, now]
  )
}

export async function getAIPlayerStrategy(aiName, targetPlayer) {
  const [rows] = await pool.execute(
    'SELECT * FROM ai_player_strategies WHERE ai_name = ? AND target_player = ?',
    [aiName, targetPlayer]
  )
  if (rows.length === 0) return null
  return formatAIPlayerStrategy(rows[0])
}

export async function getAIAllPlayerStrategies(aiName) {
  const [rows] = await pool.execute(
    'SELECT * FROM ai_player_strategies WHERE ai_name = ? ORDER BY total_encounters DESC',
    [aiName]
  )
  return rows.map(formatAIPlayerStrategy)
}

export async function getAllAIPlayerStrategies() {
  const [rows] = await pool.execute(
    `SELECT ai_name, target_player, player_type, bluff_tendency, aggression_level, 
     fold_threshold, recommended_strategy, strategy_success_rate, total_encounters, wins_against
     FROM ai_player_strategies ORDER BY ai_name, total_encounters DESC`
  )
  return rows.map(formatAIPlayerStrategy)
}

function formatAIPlayerStrategy(row) {
  return {
    aiName: row.ai_name, targetPlayer: row.target_player, playerType: row.player_type,
    bluffTendency: row.bluff_tendency, aggressionLevel: row.aggression_level,
    foldThreshold: row.fold_threshold, recommendedStrategy: row.recommended_strategy,
    strategySuccessRate: row.strategy_success_rate, totalEncounters: row.total_encounters,
    winsAgainst: row.wins_against, updatedAt: row.updated_at
  }
}


// ========== AI 大牌认知校准 ==========

export async function recordShowdownForCalibration(handType, handWeight, won, opponentWeight) {
  const now = Date.now()
  await pool.execute(
    `INSERT INTO ai_hand_calibration 
     (hand_type, base_weight, calibrated_weight, win_count, lose_count, total_showdowns, avg_opponent_weight, should_be_strong, calibration_note, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, 1, '数据收集中', ?)
     ON DUPLICATE KEY UPDATE
     win_count = win_count + ?, lose_count = lose_count + ?, total_showdowns = total_showdowns + 1,
     avg_opponent_weight = (avg_opponent_weight * (total_showdowns - 1) + ?) / total_showdowns, updated_at = ?`,
    [handType, handWeight, handWeight, won ? 1 : 0, won ? 0 : 1, opponentWeight, now,
     won ? 1 : 0, won ? 0 : 1, opponentWeight, now]
  )
  updateCalibrationWeight(handType).catch(e => console.error('校准权重更新失败:', e.message))
}

async function updateCalibrationWeight(handType) {
  const [rows] = await pool.execute(
    'SELECT base_weight, win_count, total_showdowns FROM ai_hand_calibration WHERE hand_type = ?',
    [handType]
  )
  if (rows.length === 0 || rows[0].total_showdowns < 5) return

  const row = rows[0]
  const winRate = row.win_count / row.total_showdowns

  let calibratedWeight = row.base_weight
  if (winRate < 0.4) calibratedWeight = Math.round(row.base_weight * 0.85)
  else if (winRate < 0.5) calibratedWeight = Math.round(row.base_weight * 0.95)
  else if (winRate > 0.7) calibratedWeight = Math.round(row.base_weight * 1.1)

  const shouldBeStrong = winRate >= 0.5 ? 1 : 0
  const note = winRate < 0.4 ? '此牌型胜率偏低，建议谨慎' : winRate > 0.7 ? '此牌型表现优秀' : '表现正常'

  await pool.execute(
    `UPDATE ai_hand_calibration SET calibrated_weight = ?, should_be_strong = ?, calibration_note = ? WHERE hand_type = ?`,
    [calibratedWeight, shouldBeStrong, note, handType]
  )
}

export async function getCalibratedHandWeight(handType, baseWeight) {
  const [rows] = await pool.execute(
    'SELECT calibrated_weight FROM ai_hand_calibration WHERE hand_type = ?', [handType]
  )
  if (rows.length === 0) return baseWeight
  return rows[0].calibrated_weight || baseWeight
}

export async function getAllHandCalibrations() {
  const [rows] = await pool.execute('SELECT * FROM ai_hand_calibration ORDER BY base_weight DESC')
  return rows.map(row => ({
    handType: row.hand_type, baseWeight: row.base_weight, calibratedWeight: row.calibrated_weight,
    winCount: row.win_count, loseCount: row.lose_count, totalShowdowns: row.total_showdowns,
    winRate: row.total_showdowns > 0 ? Math.round(row.win_count / row.total_showdowns * 100) : 0,
    avgOpponentWeight: Math.round(row.avg_opponent_weight), shouldBeStrong: row.should_be_strong === 1,
    calibrationNote: row.calibration_note, updatedAt: row.updated_at
  }))
}

// ========== 清除数据 ==========

export async function clearAllAIData() {
  await pool.execute('TRUNCATE TABLE ai_games')
  await pool.execute('TRUNCATE TABLE ai_hand_judgments')
  await pool.execute('TRUNCATE TABLE ai_player_strategies')
  await pool.execute('TRUNCATE TABLE ai_hand_calibration')
  await pool.execute('TRUNCATE TABLE ai_strategy_adjustments')
  await pool.execute('TRUNCATE TABLE player_profiles')
  console.log('✅ 已清除所有 AI 数据和玩家建模数据')
}

// 清除除用户表外的所有数据
export async function clearNonUserData() {
  const tables = [
    'ai_games',
    'ai_hand_judgments', 
    'ai_player_strategies',
    'ai_hand_calibration',
    'ai_strategy_adjustments',
    'player_profiles'
  ]
  
  for (const table of tables) {
    try {
      await pool.execute(`TRUNCATE TABLE ${table}`)
      console.log(`✅ 已清空表: ${table}`)
    } catch (e) {
      console.log(`⚠️ 清空表 ${table} 失败: ${e.message}`)
    }
  }
  
  console.log('✅ 已清除所有非用户数据')
}

// ========== AI 策略自修正参数（按个性类型 + 全局共享） ==========

// 保存按个性类型共享的调整参数
export async function savePersonalityAdjustments(personalityType, adjustments, totalDecisions = 0) {
  const now = Date.now()
  await pool.execute(
    `INSERT INTO ai_personality_adjustments 
     (personality_type, bluff_adjust, aggression_adjust, slow_play_adjust, trap_adjust, total_decisions, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
     bluff_adjust = VALUES(bluff_adjust), aggression_adjust = VALUES(aggression_adjust),
     slow_play_adjust = VALUES(slow_play_adjust), trap_adjust = VALUES(trap_adjust),
     total_decisions = VALUES(total_decisions), updated_at = VALUES(updated_at)`,
    [personalityType, adjustments.bluffAdjust || 0, adjustments.aggressionAdjust || 0,
     adjustments.slowPlayAdjust || 0, adjustments.trapAdjust || 0, totalDecisions, now]
  )
}

// 保存全局共享的调整参数
export async function saveGlobalAdjustments(adjustments, totalDecisions = 0) {
  const now = Date.now()
  await pool.execute(
    `INSERT INTO ai_global_adjustments 
     (key_name, fold_adjust, showdown_adjust, monster_threshold_adjust, strong_threshold_adjust, medium_threshold_adjust, probe_adjust, total_decisions, updated_at)
     VALUES ('global', ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
     fold_adjust = VALUES(fold_adjust), showdown_adjust = VALUES(showdown_adjust),
     monster_threshold_adjust = VALUES(monster_threshold_adjust), strong_threshold_adjust = VALUES(strong_threshold_adjust),
     medium_threshold_adjust = VALUES(medium_threshold_adjust), probe_adjust = VALUES(probe_adjust),
     total_decisions = VALUES(total_decisions), updated_at = VALUES(updated_at)`,
    [adjustments.foldAdjust || 0, adjustments.showdownAdjust || 0,
     adjustments.monsterThresholdAdjust || 0, adjustments.strongThresholdAdjust || 0,
     adjustments.mediumThresholdAdjust || 0, adjustments.probeAdjust || 0, totalDecisions, now]
  )
}

// 加载所有个性类型的调整参数
export async function loadAllPersonalityAdjustments() {
  const [rows] = await pool.execute('SELECT * FROM ai_personality_adjustments')
  const result = new Map()
  for (const row of rows) {
    result.set(row.personality_type, {
      bluffAdjust: row.bluff_adjust,
      aggressionAdjust: row.aggression_adjust,
      slowPlayAdjust: row.slow_play_adjust,
      trapAdjust: row.trap_adjust,
      totalDecisions: row.total_decisions
    })
  }
  return result
}

// 加载全局调整参数
export async function loadGlobalAdjustments() {
  const [rows] = await pool.execute('SELECT * FROM ai_global_adjustments WHERE key_name = ?', ['global'])
  if (rows.length === 0) return null
  const row = rows[0]
  return {
    foldAdjust: row.fold_adjust,
    showdownAdjust: row.showdown_adjust,
    monsterThresholdAdjust: row.monster_threshold_adjust,
    strongThresholdAdjust: row.strong_threshold_adjust,
    mediumThresholdAdjust: row.medium_threshold_adjust,
    probeAdjust: row.probe_adjust,
    totalDecisions: row.total_decisions
  }
}


// ========== 玩家开牌记录（下注模式分析） ==========

// 保存玩家开牌记录
export async function savePlayerShowdownRecord(username, record) {
  const now = Date.now()
  await pool.execute(
    `INSERT INTO player_showdown_records 
     (username, hand_type, hand_weight, bet_intensity, total_bet, avg_bet, won, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [username, record.handType, record.handWeight, record.betIntensity, 
     record.totalBet, record.avgBet, record.won ? 1 : 0, now]
  )
}

// 获取玩家的开牌记录
export async function getPlayerShowdownRecords(username) {
  const [rows] = await pool.execute(
    'SELECT * FROM player_showdown_records WHERE username = ? ORDER BY created_at DESC LIMIT 50',
    [username]
  )
  return rows
}

// 分析玩家的下注模式（按强度区间统计平均牌力）
export async function analyzePlayerBetPattern(username) {
  const [rows] = await pool.execute(
    `SELECT 
       CASE 
         WHEN bet_intensity < 0.8 THEN 'low'
         WHEN bet_intensity < 1.3 THEN 'medium'
         ELSE 'high'
       END as intensity_level,
       AVG(hand_weight) as avg_hand_weight,
       COUNT(*) as sample_count
     FROM player_showdown_records 
     WHERE username = ?
     GROUP BY intensity_level`,
    [username]
  )
  
  const pattern = { low: null, medium: null, high: null, totalRecords: 0 }
  for (const row of rows) {
    pattern[row.intensity_level] = {
      avgHandWeight: Math.round(row.avg_hand_weight),
      sampleCount: row.sample_count
    }
    pattern.totalRecords += row.sample_count
  }
  return pattern
}


// ========== 牌局复盘记录 ==========

// 保存牌局复盘记录
export async function saveGameReplay(replay) {
  const now = Date.now()
  const actionsJson = JSON.stringify(replay.actions || [])
  
  const [result] = await pool.execute(
    `INSERT INTO game_replays 
     (game_id, room_code, start_time, end_time, total_rounds, winner_name, pot_size, actions_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [replay.gameId, replay.roomCode, replay.startTime, replay.endTime, 
     replay.totalRounds, replay.winnerName || null, replay.potSize || 0, actionsJson, now]
  )
  return result.insertId
}

// 获取复盘列表（分页）
export async function getGameReplays(page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize
  
  const [rows] = await pool.execute(
    `SELECT id, game_id, room_code, start_time, end_time, total_rounds, winner_name, pot_size, created_at
     FROM game_replays ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [pageSize, offset]
  )
  
  const [countRows] = await pool.execute('SELECT COUNT(*) as total FROM game_replays')
  
  return {
    list: rows.map(formatReplayListItem),
    total: countRows[0].total,
    page,
    pageSize
  }
}

// 获取单个复盘详情
export async function getGameReplayDetail(id) {
  const [rows] = await pool.execute(
    'SELECT * FROM game_replays WHERE id = ?',
    [id]
  )
  
  if (rows.length === 0) return null
  
  const row = rows[0]
  return {
    id: row.id,
    gameId: row.game_id,
    roomCode: row.room_code,
    startTime: row.start_time,
    endTime: row.end_time,
    totalRounds: row.total_rounds,
    winnerName: row.winner_name,
    potSize: row.pot_size,
    actions: JSON.parse(row.actions_json || '[]'),
    createdAt: row.created_at
  }
}

// 按房间号查询复盘
export async function getGameReplaysByRoom(roomCode, limit = 10) {
  const [rows] = await pool.execute(
    `SELECT id, game_id, room_code, start_time, end_time, total_rounds, winner_name, pot_size, created_at
     FROM game_replays WHERE room_code = ? ORDER BY created_at DESC LIMIT ?`,
    [roomCode, limit]
  )
  return rows.map(formatReplayListItem)
}

function formatReplayListItem(row) {
  return {
    id: row.id,
    gameId: row.game_id,
    roomCode: row.room_code,
    startTime: row.start_time,
    endTime: row.end_time,
    totalRounds: row.total_rounds,
    winnerName: row.winner_name,
    potSize: row.pot_size,
    createdAt: row.created_at
  }
}
