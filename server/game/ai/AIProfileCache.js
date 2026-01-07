/**
 * AI 对手档案缓存
 * 缓存玩家档案和分析结果，减少数据库查询
 */

export class AIProfileCache {
  constructor() {
    // 玩家档案缓存 { playerName: { profile, timestamp } }
    this.profileCache = new Map()
    // 分析结果缓存 { playerName: { analysis, timestamp } }
    this.analysisCache = new Map()
    
    // 缓存过期时间（毫秒）
    this.profileTTL = 60000      // 档案缓存 60 秒
    this.analysisTTL = 10000     // 分析缓存 10 秒（每局可能变化）
  }

  /**
   * 获取缓存的玩家档案
   */
  getProfile(playerName) {
    const cached = this.profileCache.get(playerName)
    if (cached && Date.now() - cached.timestamp < this.profileTTL) {
      return cached.profile
    }
    return null
  }

  /**
   * 缓存玩家档案
   */
  setProfile(playerName, profile) {
    this.profileCache.set(playerName, {
      profile,
      timestamp: Date.now()
    })
  }

  /**
   * 获取缓存的分析结果
   */
  getAnalysis(playerName, lastBetAmount) {
    const cached = this.analysisCache.get(playerName)
    if (cached && 
        Date.now() - cached.timestamp < this.analysisTTL &&
        cached.lastBetAmount === lastBetAmount) {
      return cached.analysis
    }
    return null
  }

  /**
   * 缓存分析结果
   */
  setAnalysis(playerName, analysis, lastBetAmount) {
    this.analysisCache.set(playerName, {
      analysis,
      lastBetAmount,
      timestamp: Date.now()
    })
  }

  /**
   * 清除指定玩家的缓存
   */
  clearPlayer(playerName) {
    this.profileCache.delete(playerName)
    this.analysisCache.delete(playerName)
  }

  /**
   * 清除所有缓存（新一局开始时调用）
   */
  clearAll() {
    this.analysisCache.clear()
    // 档案缓存保留，因为跨局有效
  }

  /**
   * 清除过期缓存
   */
  cleanup() {
    const now = Date.now()
    
    for (const [name, cached] of this.profileCache) {
      if (now - cached.timestamp > this.profileTTL) {
        this.profileCache.delete(name)
      }
    }
    
    for (const [name, cached] of this.analysisCache) {
      if (now - cached.timestamp > this.analysisTTL) {
        this.analysisCache.delete(name)
      }
    }
  }
}
