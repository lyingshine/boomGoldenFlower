/**
 * AI 监控相关消息处理器
 */
import {
  getAIStats, getAIDetail, getAIHandJudgmentStats, getAllPlayerProfiles,
  getAIAllPlayerStrategies, getAllAIPlayerStrategies,
  getAllHandCalibrations, clearAllAIData
} from '../../db/mysql.js'
import { loadAllPersonalityAdjustments, loadGlobalAdjustments, getGameReplays, getGameReplayDetail } from '../../db/aiRepository.js'
import { send } from '../../services/RoomService.js'

export async function handleGetAIProfiles(clientId, clients) {
  const client = clients.get(clientId)
  
  try {
    const profiles = await getAllPlayerProfiles()
    const aiStats = await getAIStats()
    const handJudgments = await getAIHandJudgmentStats()
    const handCalibrations = await getAllHandCalibrations()
    const playerStrategies = await getAllAIPlayerStrategies()
    const personalityAdjustments = await loadAllPersonalityAdjustments()
    const globalAdjustments = await loadGlobalAdjustments()
    
    send(client.ws, { 
      type: 'ai_profiles', 
      profiles, aiStats, handJudgments, handCalibrations, playerStrategies,
      personalityAdjustments: Object.fromEntries(personalityAdjustments),
      globalAdjustments
    })
  } catch (e) {
    console.error('获取 AI 数据失败:', e)
    send(client.ws, { 
      type: 'ai_profiles', 
      profiles: [], aiStats: [], handJudgments: [], handCalibrations: [], playerStrategies: [],
      personalityAdjustments: {}, globalAdjustments: null
    })
  }
}

export async function handleGetAIDetail(clientId, data, clients) {
  const client = clients.get(clientId)
  const { aiName } = data
  
  try {
    const detail = await getAIDetail(aiName)
    const strategies = await getAIAllPlayerStrategies(aiName)
    send(client.ws, { type: 'ai_detail', aiName, detail, strategies })
  } catch (e) {
    console.error('获取 AI 详情失败:', e)
    send(client.ws, { type: 'ai_detail', aiName, detail: null, strategies: [] })
  }
}

export async function handleGetAIStrategies(clientId, data, clients) {
  const client = clients.get(clientId)
  const { aiName } = data
  
  try {
    const strategies = aiName 
      ? await getAIAllPlayerStrategies(aiName) 
      : await getAllAIPlayerStrategies()
    send(client.ws, { type: 'ai_strategies', aiName, strategies })
  } catch (e) {
    console.error('获取 AI 策略失败:', e)
    send(client.ws, { type: 'ai_strategies', aiName, strategies: [] })
  }
}

export async function handleGetHandCalibrations(clientId, clients) {
  const client = clients.get(clientId)
  
  try {
    const calibrations = await getAllHandCalibrations()
    send(client.ws, { type: 'hand_calibrations', calibrations })
  } catch (e) {
    console.error('获取牌力校准失败:', e)
    send(client.ws, { type: 'hand_calibrations', calibrations: [] })
  }
}

export async function handleClearAIData(clientId, clients) {
  const client = clients.get(clientId)
  
  try {
    await clearAllAIData()
    send(client.ws, { type: 'clear_ai_data_result', success: true })
  } catch (e) {
    console.error('清除 AI 数据失败:', e)
    send(client.ws, { type: 'clear_ai_data_result', success: false, message: e.message })
  }
}

// ========== 牌局复盘 ==========

export async function handleGetGameReplays(clientId, data, clients) {
  const client = clients.get(clientId)
  const { page = 1, pageSize = 20 } = data || {}
  
  try {
    const result = await getGameReplays(page, pageSize)
    send(client.ws, { type: 'game_replays', ...result })
  } catch (e) {
    console.error('获取复盘列表失败:', e)
    send(client.ws, { type: 'game_replays', list: [], total: 0, page, pageSize })
  }
}

export async function handleGetGameReplayDetail(clientId, data, clients) {
  const client = clients.get(clientId)
  const { id } = data
  
  try {
    const detail = await getGameReplayDetail(id)
    send(client.ws, { type: 'game_replay_detail', detail })
  } catch (e) {
    console.error('获取复盘详情失败:', e)
    send(client.ws, { type: 'game_replay_detail', detail: null })
  }
}
