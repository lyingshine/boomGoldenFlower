/**
 * 玩家档案管理器
 * 管理 AI 对手建模数据
 */
import { getPlayerProfile, updatePlayerProfile, getPlayerProfiles } from '../../db/mysql.js'

export class PlayerProfileManager {
  constructor() {
    // AI 对手建模数据（内存缓存 + 数据库持久化）
    this.playerProfiles = new Map()
    // 待保存的档案更新（批量写入）
    this.pendingProfileUpdates = new Map()
  }

  // 获取玩家档案（优先内存，否则从数据库加载）
  async getPlayerProfile(playerName) {
    if (this.playerProfiles.has(playerName)) {
      return this.playerProfiles.get(playerName)
    }

    try {
      const profile = await getPlayerProfile(playerName)
      if (profile) {
        this.playerProfiles.set(playerName, profile)
        return profile
      }
    } catch (e) {
      console.error('加载玩家档案失败:', e.message)
    }

    const newProfile = this.createEmptyProfile(playerName)
    this.playerProfiles.set(playerName, newProfile)
    return newProfile
  }

  // 创建空档案
  createEmptyProfile(playerName) {
    return {
      username: playerName,
      totalHands: 0,
      foldCount: 0,
      raiseCount: 0,
      callCount: 0,
      blindBetCount: 0,
      showdownWins: 0,
      showdownLosses: 0,
      bluffCaught: 0,
      bigBetWithWeak: 0,
      avgPeekRound: 0,
      peekRoundSamples: 0
    }
  }

  // 预加载玩家档案
  async preloadProfiles(playerNames) {
    if (playerNames.length === 0) return

    try {
      const profiles = await getPlayerProfiles(playerNames)
      for (const [name, profile] of Object.entries(profiles)) {
        this.playerProfiles.set(name, profile)
      }
    } catch (e) {
      console.error('预加载玩家档案失败:', e.message)
    }
  }


  // 更新玩家档案
  updateProfile(playerName, updates) {
    const profile = this.playerProfiles.get(playerName) || this.createFullProfile(playerName)

    // 累加字段
    const incrementFields = [
      'totalHands', 'foldCount', 'raiseCount', 'callCount', 'blindBetCount',
      'showdownWins', 'showdownLosses', 'bluffCaught', 'bigBetWithWeak',
      'earlyFoldCount', 'lateFoldCount', 'smallRaiseCount', 'bigRaiseCount',
      'checkRaiseCount', 'showdownInitiated', 'showdownReceived', 'wonWithoutShowdown',
      'pressureWins', 'pressureAttempts',
      'totalChipsWon', 'totalChipsLost'
    ]

    for (const field of incrementFields) {
      if (updates[field]) {
        profile[field] = (profile[field] || 0) + updates[field]
      }
    }

    // 最大值字段
    if (updates.maxSingleWin && updates.maxSingleWin > (profile.maxSingleWin || 0)) {
      profile.maxSingleWin = updates.maxSingleWin
    }
    if (updates.maxSingleLoss && updates.maxSingleLoss > (profile.maxSingleLoss || 0)) {
      profile.maxSingleLoss = updates.maxSingleLoss
    }

    // 看牌轮次滑动平均
    if (updates.peekRound) {
      const newSamples = profile.peekRoundSamples + 1
      profile.avgPeekRound = (profile.avgPeekRound * profile.peekRoundSamples + updates.peekRound) / newSamples
      profile.peekRoundSamples = newSamples
    }

    // 下注金额滑动平均
    if (updates.betSize) {
      const newSamples = (profile.betSizeSamples || 0) + 1
      profile.avgBetSize = ((profile.avgBetSize || 0) * (profile.betSizeSamples || 0) + updates.betSize) / newSamples
      profile.betSizeSamples = newSamples
    }

    this.playerProfiles.set(playerName, profile)
    this.markPendingUpdate(playerName, updates)
  }

  // 标记待保存
  markPendingUpdate(playerName, updates) {
    const pending = this.pendingProfileUpdates.get(playerName) || {}
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'maxSingleWin' || key === 'maxSingleLoss') {
        pending[key] = Math.max(pending[key] || 0, value)
      } else {
        pending[key] = (pending[key] || 0) + value
      }
    }
    this.pendingProfileUpdates.set(playerName, pending)
  }

  // 创建完整档案结构
  createFullProfile(playerName) {
    return {
      username: playerName,
      totalHands: 0, foldCount: 0, raiseCount: 0, callCount: 0, blindBetCount: 0,
      showdownWins: 0, showdownLosses: 0, bluffCaught: 0, bigBetWithWeak: 0,
      avgPeekRound: 0, peekRoundSamples: 0,
      earlyFoldCount: 0, lateFoldCount: 0, smallRaiseCount: 0, bigRaiseCount: 0,
      checkRaiseCount: 0, showdownInitiated: 0, showdownReceived: 0, wonWithoutShowdown: 0,
      pressureWins: 0, pressureAttempts: 0,
      totalChipsWon: 0, totalChipsLost: 0, maxSingleWin: 0, maxSingleLoss: 0,
      avgBetSize: 0, betSizeSamples: 0
    }
  }

  // 保存所有待更新的档案
  async saveAll() {
    if (this.pendingProfileUpdates.size === 0) return

    const updates = new Map(this.pendingProfileUpdates)
    this.pendingProfileUpdates.clear()

    for (const [playerName, profileUpdates] of updates) {
      try {
        await updatePlayerProfile(playerName, profileUpdates)
      } catch (e) {
        console.error(`保存玩家档案失败 ${playerName}:`, e.message)
        this.pendingProfileUpdates.set(playerName, profileUpdates)
      }
    }
  }

  // 获取档案 Map（供外部访问）
  getProfiles() {
    return this.playerProfiles
  }
}
