/**
 * MySQL 数据库模块
 * 统一导出所有数据库功能
 */

// 连接和初始化
export { pool, executeWithRetry } from './connection.js'
export { initDatabase } from './schema.js'

// 用户数据
export { getUser, getAllUsers, createUser, updateUser, importUsers } from './userRepository.js'

// 玩家档案
export { getPlayerProfile, getPlayerProfiles, getAllPlayerProfiles, updatePlayerProfile } from './profileRepository.js'

// AI 数据
export { 
  recordAIGame, getAIStats, getAIDetail,
  recordAIHandJudgment, getAIHandJudgmentStats,
  updateAIPlayerStrategy, getAIPlayerStrategy, getAIAllPlayerStrategies, getAllAIPlayerStrategies,
  recordShowdownForCalibration, getCalibratedHandWeight, getAllHandCalibrations,
  clearAllAIData
} from './aiRepository.js'
