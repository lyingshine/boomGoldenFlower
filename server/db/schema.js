/**
 * 数据库表结构初始化
 */
import { pool } from './connection.js'

// 重置非用户数据表（保留用户数据）
export async function resetNonUserTables() {
  const tables = [
    'ai_games',
    'ai_hand_judgments',
    'ai_player_strategies', 
    'ai_hand_calibration',
    'ai_strategy_adjustments',
    'player_profiles'
  ]
  
  console.log('🔄 开始重置非用户数据表...')
  
  for (const table of tables) {
    try {
      await pool.execute(`DROP TABLE IF EXISTS ${table}`)
      console.log(`✅ 已删除表: ${table}`)
    } catch (e) {
      console.log(`⚠️ 删除表 ${table} 失败: ${e.message}`)
    }
  }
  
  console.log('✅ 非用户数据表已清除，将重新创建...')
}

// 初始化数据库表
export async function initDatabase(resetData = false) {
  // 如果需要重置数据
  if (resetData) {
    await resetNonUserTables()
  }
  
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
      early_fold_count INT DEFAULT 0,
      late_fold_count INT DEFAULT 0,
      small_raise_count INT DEFAULT 0,
      big_raise_count INT DEFAULT 0,
      check_raise_count INT DEFAULT 0,
      showdown_initiated INT DEFAULT 0,
      showdown_received INT DEFAULT 0,
      won_without_showdown INT DEFAULT 0,
      pressure_wins INT DEFAULT 0,
      pressure_attempts INT DEFAULT 0,
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

  // 按个性类型共享的调整参数
  const createAIPersonalityAdjustmentsTableSQL = `
    CREATE TABLE IF NOT EXISTS ai_personality_adjustments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      personality_type VARCHAR(30) UNIQUE NOT NULL,
      bluff_adjust FLOAT DEFAULT 0,
      aggression_adjust FLOAT DEFAULT 0,
      slow_play_adjust FLOAT DEFAULT 0,
      trap_adjust FLOAT DEFAULT 0,
      total_decisions INT DEFAULT 0,
      updated_at BIGINT,
      INDEX idx_personality (personality_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `

  // 全局共享的调整参数
  const createAIGlobalAdjustmentsTableSQL = `
    CREATE TABLE IF NOT EXISTS ai_global_adjustments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      key_name VARCHAR(30) UNIQUE NOT NULL DEFAULT 'global',
      fold_adjust FLOAT DEFAULT 0,
      showdown_adjust FLOAT DEFAULT 0,
      monster_threshold_adjust FLOAT DEFAULT 0,
      strong_threshold_adjust FLOAT DEFAULT 0,
      medium_threshold_adjust FLOAT DEFAULT 0,
      weak_threshold_adjust FLOAT DEFAULT 0,
      probe_adjust FLOAT DEFAULT 0,
      total_decisions INT DEFAULT 0,
      updated_at BIGINT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `

  // 玩家开牌记录（用于分析下注模式）
  const createPlayerShowdownRecordsTableSQL = `
    CREATE TABLE IF NOT EXISTS player_showdown_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL,
      hand_type VARCHAR(30) NOT NULL,
      hand_weight INT NOT NULL,
      bet_intensity FLOAT NOT NULL,
      total_bet INT NOT NULL,
      avg_bet FLOAT NOT NULL,
      won TINYINT DEFAULT 0,
      created_at BIGINT,
      INDEX idx_username (username),
      INDEX idx_bet_intensity (bet_intensity)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `

  // 牌局复盘记录
  const createGameReplaysTableSQL = `
    CREATE TABLE IF NOT EXISTS game_replays (
      id INT AUTO_INCREMENT PRIMARY KEY,
      game_id VARCHAR(50) NOT NULL,
      room_code VARCHAR(20),
      start_time BIGINT,
      end_time BIGINT,
      total_rounds INT DEFAULT 1,
      winner_name VARCHAR(50),
      pot_size INT DEFAULT 0,
      player_hands_json MEDIUMTEXT,
      actions_json MEDIUMTEXT,
      created_at BIGINT,
      INDEX idx_room_code (room_code),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `

  try {
    await pool.execute(createUsersTableSQL)
    await pool.execute(createProfilesTableSQL)
    await pool.execute(createAIGamesTableSQL)
    await pool.execute(createAIHandJudgmentTableSQL)
    await pool.execute(createAIPlayerStrategyTableSQL)
    await pool.execute(createAIHandCalibrationTableSQL)
    await pool.execute(createAIPersonalityAdjustmentsTableSQL)
    await pool.execute(createAIGlobalAdjustmentsTableSQL)
    await pool.execute(createPlayerShowdownRecordsTableSQL)
    await pool.execute(createGameReplaysTableSQL)

    // 兼容旧表添加新字段
    await addColumnsIfNotExist()

    console.log('✅ 数据库表初始化成功')
  } catch (error) {
    console.error('❌ 数据库表初始化失败:', error.message)
    throw error
  }
}

async function addColumnsIfNotExist() {
  const userFields = ['nickname VARCHAR(50)', 'avatar VARCHAR(20)', 'avatar_url VARCHAR(255)']
  for (const field of userFields) {
    try { await pool.execute(`ALTER TABLE users ADD COLUMN ${field}`) } catch (e) {}
  }

  const profileFields = [
    'early_fold_count INT DEFAULT 0', 'late_fold_count INT DEFAULT 0',
    'small_raise_count INT DEFAULT 0', 'big_raise_count INT DEFAULT 0',
    'check_raise_count INT DEFAULT 0', 'showdown_initiated INT DEFAULT 0',
    'showdown_received INT DEFAULT 0', 'won_without_showdown INT DEFAULT 0',
    'total_chips_won BIGINT DEFAULT 0', 'total_chips_lost BIGINT DEFAULT 0',
    'max_single_win INT DEFAULT 0', 'max_single_loss INT DEFAULT 0',
    'avg_bet_size FLOAT DEFAULT 0', 'bet_size_samples INT DEFAULT 0'
  ]
  for (const field of profileFields) {
    try { await pool.execute(`ALTER TABLE player_profiles ADD COLUMN ${field}`) } catch (e) {}
  }

  // 复盘表添加玩家手牌字段
  try { await pool.execute(`ALTER TABLE game_replays ADD COLUMN player_hands_json MEDIUMTEXT`) } catch (e) {}

  // AI策略调整表添加新字段
  const strategyFields = [
    'monster_threshold_adjust FLOAT DEFAULT 0',
    'strong_threshold_adjust FLOAT DEFAULT 0',
    'medium_threshold_adjust FLOAT DEFAULT 0'
  ]
  for (const field of strategyFields) {
    try { await pool.execute(`ALTER TABLE ai_strategy_adjustments ADD COLUMN ${field}`) } catch (e) {}
  }
}
