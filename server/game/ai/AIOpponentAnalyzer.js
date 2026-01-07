/**
 * AI 对手分析器
 * 负责分析对手行为模式、推测牌力、检测倾斜状态
 */

/**
 * 对手分析器
 */
export class AIOpponentAnalyzer {
  constructor() {
    this.sessionMemory = new Map()  // 本局记忆
    this.playerBetPatterns = new Map()  // 玩家下注模式缓存
  }

  // 记录对手本局行为
  recordAction(playerName, action, amount, round, hasPeeked, currentBet) {
    if (!this.sessionMemory.has(playerName)) {
      this.sessionMemory.set(playerName, {
        actions: [],
        raiseCount: 0,
        foldCount: 0,
        totalBet: 0,
        maxBet: 0,
        peekedAtRound: null,
        behaviorShift: 0
      })
    }
    
    const memory = this.sessionMemory.get(playerName)
    const prevActionCount = memory.actions.length
    
    memory.actions.push({ action, amount, round, hasPeeked, timestamp: Date.now() })
    
    if (action === 'raise' || (action === 'blind' && amount > currentBet)) {
      memory.raiseCount++
      memory.totalBet += amount
      memory.maxBet = Math.max(memory.maxBet, amount)
    }
    
    if (action === 'fold') memory.foldCount++
    
    if (hasPeeked && !memory.peekedAtRound) {
      memory.peekedAtRound = round
    }
    
    if (prevActionCount >= 2) {
      memory.behaviorShift = this.detectBehaviorShift(memory)
    }
  }

  // 检测行为变化
  detectBehaviorShift(memory) {
    const actions = memory.actions
    if (actions.length < 3) return 0
    
    const recent = actions.slice(-2)
    const earlier = actions.slice(0, -2)
    
    const earlierAvg = earlier.reduce((sum, a) => sum + (a.amount || 0), 0) / earlier.length
    const recentAvg = recent.reduce((sum, a) => sum + (a.amount || 0), 0) / recent.length
    
    if (earlierAvg > 0) {
      return (recentAvg - earlierAvg) / earlierAvg
    }
    return 0
  }

  // 统一的行为模式分析
  analyzeSessionBehavior(memory, currentBet) {
    const result = {
      trend: 'stable',
      intensity: 0,
      isAbnormal: false,
      avgBet: 0,
      consecutiveBigBets: 0,
      totalBigBets: 0,
      strongHandLikelihood: 0
    }
    
    if (!memory || memory.actions.length < 2) return result
    
    const bets = memory.actions.filter(a => a.amount > 0).map(a => a.amount)
    if (bets.length < 2) return result
    
    result.avgBet = bets.reduce((a, b) => a + b, 0) / bets.length
    result.intensity = memory.behaviorShift || 0
    
    if (result.intensity > 0.3) {
      result.trend = 'escalating'
    } else if (result.intensity < -0.3) {
      result.trend = 'declining'
    }
    
    if (currentBet > result.avgBet * 2 || (currentBet < result.avgBet * 0.5 && currentBet > 0)) {
      result.isAbnormal = true
    }
    
    const bigBetThreshold = 30
    let consecutive = 0
    for (let i = bets.length - 1; i >= 0; i--) {
      if (bets[i] >= bigBetThreshold) {
        consecutive++
        result.totalBigBets++
      } else {
        break
      }
    }
    result.consecutiveBigBets = consecutive
    
    if (consecutive >= 4) {
      result.strongHandLikelihood = 0.9
    } else if (consecutive >= 3) {
      result.strongHandLikelihood = 0.8
    } else if (consecutive >= 2) {
      result.strongHandLikelihood = 0.6
    } else if (consecutive >= 1 && result.trend === 'escalating') {
      result.strongHandLikelihood = 0.4
    }
    
    if (memory.totalBet > 100) {
      result.strongHandLikelihood = Math.min(0.95, result.strongHandLikelihood + 0.15)
    }
    
    return result
  }

  // 获取本局记忆
  getSessionMemory(playerName) {
    return this.sessionMemory.get(playerName) || null
  }

  // 清除本局记忆
  clearSessionMemory() {
    this.sessionMemory.clear()
  }

  // 缓存玩家下注模式
  cachePlayerBetPattern(playerName, pattern) {
    this.playerBetPatterns.set(playerName, pattern)
  }

  // 获取缓存的下注模式
  getCachedBetPattern(playerName) {
    return this.playerBetPatterns.get(playerName) || null
  }

  // 根据下注强度推测对手牌力
  estimateHandByBetPattern(pattern, currentBetIntensity) {
    if (!pattern || pattern.totalRecords < 5) return null
    
    let level = 'medium'
    if (currentBetIntensity < 0.8) level = 'low'
    else if (currentBetIntensity >= 1.3) level = 'high'
    
    const levelData = pattern[level]
    if (!levelData || levelData.sampleCount < 2) return null
    
    return {
      estimatedWeight: levelData.avgHandWeight,
      confidence: Math.min(levelData.sampleCount / 10, 1),
      level
    }
  }


  // 对手深度分析
  analyzeOpponent(opponent, profile, sessionMem = null, sessionBehavior = null, aiPersonality = null) {
    const analysis = {
      type: 'unknown',
      bluffLikelihood: 0.3,
      foldPressure: 0.5,
      dangerLevel: 0.5,
      exploitStrategy: null,
      betSizePattern: 'normal',
      showdownTendency: 0.5,
      tiltLevel: 0,
      sessionAggression: 0
    }
    
    // AI对手：直接使用其性格配置
    if (aiPersonality && aiPersonality.config) {
      const config = aiPersonality.config
      if (config.name === '激进型') {
        analysis.type = 'aggressive'
        analysis.bluffLikelihood = 0.45
        analysis.foldPressure = 0.3
        analysis.dangerLevel = 0.6
      } else if (config.name === '保守型') {
        analysis.type = 'rock'
        analysis.bluffLikelihood = 0.15
        analysis.foldPressure = 0.7
        analysis.dangerLevel = 0.4
      } else if (config.name === '诡诈型') {
        analysis.type = 'maniac'
        analysis.bluffLikelihood = 0.55
        analysis.foldPressure = 0.4
        analysis.dangerLevel = 0.7
      } else if (config.name === '均衡型') {
        analysis.type = 'balanced'
        analysis.bluffLikelihood = 0.3
        analysis.foldPressure = 0.5
        analysis.dangerLevel = 0.5
      } else if (config.name === '紧凶型') {
        analysis.type = 'aggressive'
        analysis.bluffLikelihood = 0.25
        analysis.foldPressure = 0.55
        analysis.dangerLevel = 0.65
      }
      
      if (sessionBehavior) {
        analysis.sessionAggression = sessionBehavior.intensity
        if (sessionBehavior.isAbnormal) {
          analysis.bluffLikelihood += 0.1
        }
      }
      
      return analysis
    }
    
    // 整合本局行为分析
    if (sessionBehavior) {
      analysis.sessionAggression = sessionBehavior.intensity
      if (sessionBehavior.isAbnormal) {
        analysis.bluffLikelihood += 0.15
      }
    }
    
    if (!profile || profile.totalHands < 10) {
      analysis.type = opponent.lastBetAmount > 30 ? 'aggressive' : 'unknown'
      return analysis
    }
    
    const totalHands = Math.max(profile.totalHands, 1)
    const foldRate = profile.foldCount / totalHands
    const raiseRate = profile.raiseCount / totalHands
    const bluffRate = profile.bluffCaught / totalHands
    const blindRate = profile.blindBetCount / totalHands
    const showdownTotal = profile.showdownWins + profile.showdownLosses
    const showdownWinRate = showdownTotal > 0 ? profile.showdownWins / showdownTotal : 0.5
    
    const totalFolds = profile.foldCount || 1
    const earlyFoldRatio = (profile.earlyFoldCount || 0) / totalFolds
    const totalRaises = profile.raiseCount || 1
    const bigRaiseRatio = (profile.bigRaiseCount || 0) / totalRaises
    const showdownActions = (profile.showdownInitiated || 0) + (profile.showdownReceived || 0)
    const showdownAggressiveness = showdownActions > 0 ? (profile.showdownInitiated || 0) / showdownActions : 0.5
    const wins = profile.showdownWins + (profile.wonWithoutShowdown || 0)
    const pressureWinRate = wins > 0 ? (profile.wonWithoutShowdown || 0) / wins : 0
    const avgBet = profile.avgBetSize || 20
    
    const pressureAttempts = profile.pressureAttempts || 0
    const pressureWins = profile.pressureWins || 0
    const pressureSuccessRate = pressureAttempts > 0 ? pressureWins / pressureAttempts : 0
    
    // 倾斜状态检测
    analysis.tiltLevel = this.detectTiltLevel(profile, opponent)
    
    // 玩家分类
    if (raiseRate > 0.4 && foldRate < 0.3 && bigRaiseRatio > 0.5) {
      analysis.type = 'maniac'
      analysis.exploitStrategy = '用强牌跟注陷阱，让他自己打光筹码'
    } else if (raiseRate > 0.35 || bigRaiseRatio > 0.6) {
      analysis.type = 'aggressive'
      analysis.exploitStrategy = '强牌慢打，弱牌快弃'
    } else if (foldRate > 0.5 || earlyFoldRatio > 0.7) {
      analysis.type = 'rock'
      analysis.exploitStrategy = '频繁加注逼他弃牌，他跟注时要小心'
    } else if (blindRate > 0.4) {
      analysis.type = 'blind_lover'
      analysis.exploitStrategy = '他焖牌时不用太担心，看牌后再决定'
    } else if (raiseRate < 0.15 && foldRate < 0.3) {
      analysis.type = 'calling_station'
      analysis.exploitStrategy = '有牌就加注榨取价值，别诈唬他'
    } else if (pressureWinRate > 0.4) {
      analysis.type = 'pressure_player'
      analysis.exploitStrategy = '他加注时多跟注看看，可能在诈唬'
    } else {
      analysis.type = 'balanced'
    }
    
    // 诈唬概率
    analysis.bluffLikelihood = bluffRate * 0.5 + 0.2
    if (pressureSuccessRate > 0.3 && bluffRate > 0.1) {
      analysis.bluffLikelihood += pressureSuccessRate * 0.3
    } else if (pressureSuccessRate > 0.3 && bluffRate < 0.1 && showdownTotal >= 3) {
      analysis.bluffLikelihood -= 0.1
    }
    
    if (bigRaiseRatio > 0.5 && showdownWinRate < 0.4) analysis.bluffLikelihood += 0.2
    if (pressureWinRate > 0.4) analysis.bluffLikelihood += 0.1
    if (!opponent.hasPeeked && opponent.lastBetAmount > 25) analysis.bluffLikelihood += 0.15
    if (opponent.hasPeeked && opponent.lastBetAmount > avgBet * 1.5) {
      analysis.bluffLikelihood += bluffRate > 0.15 ? 0.1 : -0.1
    }
    analysis.bluffLikelihood = Math.max(0.05, Math.min(0.85, analysis.bluffLikelihood))
    
    // 施压后弃牌概率
    analysis.foldPressure = foldRate * 0.6 + 0.15
    if (earlyFoldRatio > 0.6) analysis.foldPressure += 0.15
    if (analysis.type === 'rock') analysis.foldPressure += 0.15
    if (analysis.type === 'calling_station') analysis.foldPressure -= 0.25
    if (analysis.type === 'maniac') analysis.foldPressure -= 0.3
    if (analysis.type === 'pressure_player') analysis.foldPressure -= 0.1
    analysis.foldPressure = Math.max(0.05, Math.min(0.85, analysis.foldPressure))
    
    // 威胁程度
    analysis.dangerLevel = showdownWinRate * 0.5 + 0.25
    const netProfit = (profile.totalChipsWon || 0) - (profile.totalChipsLost || 0)
    if (netProfit > 500) analysis.dangerLevel += 0.15
    else if (netProfit < -500) analysis.dangerLevel -= 0.1
    if ((profile.maxSingleWin || 0) > 200) analysis.dangerLevel += 0.1
    if (opponent.hasPeeked && opponent.lastBetAmount > 35) analysis.dangerLevel += 0.15
    analysis.dangerLevel = Math.max(0.1, Math.min(0.9, analysis.dangerLevel))
    
    // 下注模式
    if (avgBet > 35) analysis.betSizePattern = 'big'
    else if (avgBet < 15) analysis.betSizePattern = 'small'
    
    analysis.showdownTendency = showdownAggressiveness
    
    return analysis
  }

  // 检测倾斜状态
  detectTiltLevel(profile, opponent) {
    if (!profile) return 0
    
    let tiltLevel = 0
    
    // 最近连续输牌
    const recentLosses = profile.recentLosses || 0
    if (recentLosses >= 3) tiltLevel += 0.3
    else if (recentLosses >= 2) tiltLevel += 0.15
    
    // 大额亏损
    const netProfit = (profile.totalChipsWon || 0) - (profile.totalChipsLost || 0)
    if (netProfit < -300) tiltLevel += 0.2
    
    // 本局行为异常（下注突然变大）
    const sessionMem = this.getSessionMemory(opponent.name)
    if (sessionMem && sessionMem.behaviorShift > 0.5) {
      tiltLevel += 0.2
    }
    
    return Math.min(1, tiltLevel)
  }


  // 推测对手牌力
  estimateOpponentStrength(opponent, profile, sessionMem = null, sessionBehavior = null, betPattern = null) {
    let strength = 0.5
    
    if (opponent.hasPeeked) {
      if (opponent.lastBetAmount > 40) strength = 0.75
      else if (opponent.lastBetAmount > 25) strength = 0.6
      else if (opponent.lastBetAmount <= 10) strength = 0.35
    } else {
      strength = opponent.lastBetAmount > 30 ? 0.55 : 0.45
    }
    
    // 使用下注模式推测牌力
    if (betPattern && betPattern.totalRecords >= 5 && profile) {
      const avgBet = profile.avgBetSize || 20
      const currentBetIntensity = avgBet > 0 ? opponent.currentBet / avgBet : 1
      const estimate = this.estimateHandByBetPattern(betPattern, currentBetIntensity)
      
      if (estimate && estimate.confidence >= 0.3) {
        const patternStrength = Math.min(0.95, estimate.estimatedWeight / 10000 + 0.2)
        strength = strength * (1 - estimate.confidence) + patternStrength * estimate.confidence
      }
    }
    
    // 整合本局行为分析
    if (sessionBehavior) {
      if (sessionBehavior.strongHandLikelihood > 0) {
        strength = Math.max(strength, sessionBehavior.strongHandLikelihood)
      }
      
      if (sessionBehavior.isAbnormal && sessionBehavior.strongHandLikelihood < 0.5) {
        const bluffRate = profile ? profile.bluffCaught / Math.max(profile.totalHands, 1) : 0.2
        strength += bluffRate > 0.2 ? -0.1 : 0.1
      }
      
      if (sessionBehavior.trend === 'escalating') {
        strength += 0.1
      } else if (sessionBehavior.trend === 'declining') {
        strength -= 0.1
      }
    }
    
    // 整合本局记忆
    if (sessionMem && sessionMem.actions.length >= 2) {
      if (sessionMem.maxBet > 50) {
        strength += 0.1
      }
      
      if (sessionMem.peekedAtRound) {
        if (sessionMem.peekedAtRound <= 1) strength -= 0.05
        else if (sessionMem.peekedAtRound >= 3) strength += 0.05
      }
    }
    
    if (profile && profile.totalHands >= 20) {
      const totalHands = Math.max(profile.totalHands, 1)
      const bluffRate = profile.bluffCaught / totalHands
      const raiseRate = profile.raiseCount / totalHands
      const avgBet = profile.avgBetSize || 20
      
      if (bluffRate > 0.15 && opponent.lastBetAmount > 25) strength *= 0.8
      if (raiseRate < 0.2 && opponent.lastBetAmount > 30) strength *= 1.2
      
      if (opponent.lastBetAmount > avgBet * 1.8) {
        strength *= bluffRate > 0.2 ? 0.85 : 1.15
      } else if (opponent.lastBetAmount < avgBet * 0.6) {
        strength *= 0.9
      }
      
      if (profile.foldCount / totalHands > 0.5) strength += 0.1
      
      const wins = profile.showdownWins + (profile.wonWithoutShowdown || 0)
      const pressureWinRate = wins > 0 ? (profile.wonWithoutShowdown || 0) / wins : 0
      if (pressureWinRate > 0.4 && opponent.lastBetAmount > 30) strength *= 0.85
    }
    
    return Math.max(0.1, Math.min(0.95, strength))
  }
}
