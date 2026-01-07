/**
 * AI 决策器
 * 负责 AI 玩家的所有决策逻辑
 */
import { analyzePlayerBetPattern } from '../db/aiRepository.js'
import { AI_PERSONALITIES, AIPersonalityManager } from './ai/AIPersonality.js'
import { AIOpponentAnalyzer } from './ai/AIOpponentAnalyzer.js'
import { AIHandEvaluator } from './ai/AIHandEvaluator.js'
import { AIStrategyAdjuster } from './ai/AIStrategyAdjuster.js'
import { AIProfileCache } from './ai/AIProfileCache.js'

export class AIDecisionMaker {
  constructor(gameEngine) {
    this.game = gameEngine
    
    // 使用拆分的模块
    this.personalityManager = new AIPersonalityManager()
    this.opponentAnalyzer = new AIOpponentAnalyzer()
    this.handEvaluator = new AIHandEvaluator()
    this.strategyAdjuster = new AIStrategyAdjuster()
    this.profileCache = new AIProfileCache()
    
    this.gameReplayLog = []  // 牌局复盘记录
  }

  // 从数据库加载调整参数
  async loadStrategyAdjustments() {
    return this.strategyAdjuster.loadStrategyAdjustments()
  }

  // 获取玩家的下注模式（带缓存）
  async getPlayerBetPattern(playerName) {
    const cached = this.opponentAnalyzer.getCachedBetPattern(playerName)
    if (cached) return cached
    
    try {
      const pattern = await analyzePlayerBetPattern(playerName)
      this.opponentAnalyzer.cachePlayerBetPattern(playerName, pattern)
      return pattern
    } catch (e) {
      return null
    }
  }

  // 获取或分配 AI 个性
  getPersonality(playerName) {
    return this.personalityManager.getPersonality(playerName)
  }

  // 设置固定性格
  setFixedPersonality(playerName, personalityType) {
    this.personalityManager.setFixedPersonality(playerName, personalityType)
  }

  // 获取个性类型名称
  getPersonalityType(playerName) {
    return this.personalityManager.getPersonalityType(playerName)
  }

  // 记录对手行为
  recordAction(playerName, action, amount, round, hasPeeked) {
    this.opponentAnalyzer.recordAction(playerName, action, amount, round, hasPeeked, this.game.state.currentBet)
  }

  // 获取本局记忆
  getSessionMemory(playerName) {
    return this.opponentAnalyzer.getSessionMemory(playerName)
  }

  // 清除本局记忆
  clearSessionMemory() {
    this.opponentAnalyzer.clearSessionMemory()
    this.profileCache.clearAll()  // 清除分析缓存，保留档案缓存
  }

  // 记录决策
  recordDecision(playerName, decision, context) {
    context.potSize = this.game.state.pot
    this.strategyAdjuster.recordDecision(playerName, decision, context)
  }

  // 记录决策结果
  recordDecisionResult(playerName, won, profit) {
    this.strategyAdjuster.recordDecisionResult(playerName, won, profit)
  }

  // 获取策略调整参数
  getStrategyAdjustments(playerName) {
    const personalityType = this.getPersonalityType(playerName)
    return this.strategyAdjuster.getStrategyAdjustments(personalityType)
  }

  // 评估牌力
  evaluateHandStrength(strength, playerCount, position, adjustments) {
    return this.handEvaluator.evaluateHandStrength(strength, playerCount, position, adjustments)
  }

  // 计算位置
  calculatePosition(seatIndex, activePlayers) {
    return this.handEvaluator.calculatePosition(seatIndex, activePlayers)
  }

  // 计算筹码深度
  calculateStackDepth(player, activePlayers) {
    return this.handEvaluator.calculateStackDepth(player, activePlayers, this.game.state.ante)
  }

  // 计算回合压力
  calculateRoundPressure(round) {
    return this.handEvaluator.calculateRoundPressure(round)
  }

  // 计算底池赔率
  calculatePotOdds(callAmount, potSize) {
    return this.handEvaluator.calculatePotOdds(callAmount, potSize)
  }

  // 判断是否有正期望值
  hasPositiveEV(winProb, potOdds) {
    return this.handEvaluator.hasPositiveEV(winProb, potOdds)
  }

  // 计算隐含赔率
  calculateImpliedOdds(callAmount, potSize, opponentChips, winProb) {
    return this.handEvaluator.calculateImpliedOdds(callAmount, potSize, opponentChips, winProb)
  }

  // 多人底池调整
  calculateMultiwayAdjustment(playerCount) {
    return this.handEvaluator.calculateMultiwayAdjustment(playerCount)
  }

  // 对手分析
  analyzeOpponent(opponent, profile, sessionMem, sessionBehavior, aiPersonality) {
    return this.opponentAnalyzer.analyzeOpponent(opponent, profile, sessionMem, sessionBehavior, aiPersonality)
  }

  // 推测对手牌力
  estimateOpponentStrength(opponent, profile, sessionMem, sessionBehavior, betPattern) {
    return this.opponentAnalyzer.estimateOpponentStrength(opponent, profile, sessionMem, sessionBehavior, betPattern)
  }

  // 分析本局行为
  analyzeSessionBehavior(memory, currentBet) {
    return this.opponentAnalyzer.analyzeSessionBehavior(memory, currentBet)
  }

  // GTO 混合策略：根据权重随机选择行动
  selectMixedAction(actions) {
    const totalWeight = actions.reduce((sum, a) => sum + a.weight, 0)
    if (totalWeight <= 0) return actions[0]
    
    let random = Math.random() * totalWeight
    for (const action of actions) {
      random -= action.weight
      if (random <= 0) {
        return { action: action.action, amount: action.amount }
      }
    }
    return { action: actions[0].action, amount: actions[0].amount }
  }

  // 生成混合策略选项
  generateMixedStrategy(handEval, context) {
    const { potSize, avgFoldPressure, personality } = context
    const actions = []
    
    if (handEval.isMonster) {
      actions.push({ action: 'raise', amount: Math.floor(potSize * 0.7), weight: 0.65 })
      actions.push({ action: 'call', weight: 0.30 })
      actions.push({ action: 'raise', amount: Math.floor(potSize * 0.4), weight: 0.05 })
    } else if (handEval.isStrong) {
      actions.push({ action: 'raise', amount: Math.floor(potSize * 0.5), weight: 0.55 })
      actions.push({ action: 'call', weight: 0.40 })
      actions.push({ action: 'raise', amount: Math.floor(potSize * 0.8), weight: 0.05 })
    } else if (handEval.isMedium) {
      actions.push({ action: 'call', weight: 0.60 })
      actions.push({ action: 'raise', amount: Math.floor(potSize * 0.5), weight: 0.20 })
      actions.push({ action: 'fold', weight: 0.20 })
    } else {
      const bluffWeight = avgFoldPressure > 0.5 ? 0.25 : 0.10
      actions.push({ action: 'fold', weight: 0.50 - bluffWeight / 2 })
      actions.push({ action: 'call', weight: 0.50 - bluffWeight / 2 })
      actions.push({ action: 'raise', amount: Math.floor(potSize * 0.6), weight: bluffWeight })
    }
    
    if (personality) {
      for (const a of actions) {
        if (a.action === 'raise') {
          a.weight *= (0.7 + personality.raiseFrequency)
        } else if (a.action === 'fold') {
          a.weight *= (1.5 - personality.foldThreshold)
        }
      }
    }
    
    return actions
  }

  // 主决策入口
  async makeDecision(seatIndex) {
    const player = this.game.seats[seatIndex]
    if (!player || player.type !== 'ai') return null

    const activePlayers = this.game.getActivePlayers().filter(p => p.id !== seatIndex)
    const callAmount = this.game.getCallAmountForPlayer(player)
    const round = this.game.state.round || 1
    
    // 获取 AI 个性配置
    const personality = this.getPersonality(player.name).config
    
    // 获取对手档案
    const opponentProfiles = await this.getOpponentProfiles(seatIndex, activePlayers)
    
    // 计算位置优势
    const position = this.calculatePosition(seatIndex, activePlayers)
    
    // 计算筹码深度
    const stackDepth = this.calculateStackDepth(player, activePlayers)
    
    // 筹码不足时的决策
    if (player.chips < callAmount) {
      return this.handleLowChips(player)
    }

    // 焖牌状态的决策
    if (!player.hasPeeked) {
      const decision = this.makeBlindDecision(player, callAmount, { round, opponentProfiles, activePlayers, personality })
      if (decision.action === 'fold') {
        return { action: 'peek' }
      }
      // 记录焖牌决策
      this.recordDecision(player.name, decision, { round, callAmount, position })
      return decision
    }

    // 已看牌后的决策
    const handType = player.hand.getType()
    const strength = handType.weight
    const playerCount = activePlayers.length + 1
    
    // 获取自修正参数
    const adjustments = this.getStrategyAdjustments(player.name)
    const handEval = this.evaluateHandStrength(strength, playerCount, position, adjustments)
    
    // 计算回合压力（只计算一次）
    const roundPressure = this.calculateRoundPressure(round)
    
    // 开牌决策
    if (activePlayers.length >= 1 && this.game.state.firstRoundComplete) {
      const showdownDecision = this.considerShowdown(player, strength, opponentProfiles, personality, roundPressure)
      if (showdownDecision) {
        // 记录开牌决策
        this.recordDecision(player.name, showdownDecision, { strength, round, callAmount, position })
        return showdownDecision
      }
    }

    // 下注决策
    const decision = this.makeBettingDecision(player, callAmount, {
      strength, ...handEval, opponentProfiles, round, position, stackDepth, personality, roundPressure
    })
    
    // 针对倾斜玩家调整策略（在强牌保护之前）
    const maxTilt = Math.max(...opponentProfiles.map(o => o.analysis.tiltLevel), 0)
    let finalDecision = decision
    if (maxTilt > 0.3) {
      finalDecision = this.adjustForTilt(decision, maxTilt, player, callAmount)
    }
    
    // 强牌不弃牌（最后执行，确保不会被覆盖）
    if (finalDecision.action === 'fold' && (handEval.isMonster || handEval.isStrong)) {
      finalDecision = { action: 'call' }
    }
    
    // 记录最终决策
    this.recordDecision(player.name, finalDecision, { strength, round, callAmount, position })
    
    return finalDecision
  }

  // 获取对手档案分析（带缓存）
  async getOpponentProfiles(seatIndex, activePlayers) {
    return Promise.all(activePlayers.map(async p => {
      // 优先从缓存获取档案
      let profile = this.profileCache.getProfile(p.name)
      if (!profile && this.game.room) {
        profile = await this.game.room.getPlayerProfile(p.name)
        if (profile) {
          this.profileCache.setProfile(p.name, profile)
        }
      }
      
      const sessionMem = this.getSessionMemory(p.name)
      const sessionBehavior = this.analyzeSessionBehavior(sessionMem, p.lastBetAmount)
      const betPattern = p.type === 'human' ? await this.getPlayerBetPattern(p.name) : null
      
      // 获取AI对手的性格配置
      const aiPersonality = p.isAI ? this.getPersonality(p.name) : null
      
      // 尝试从缓存获取分析结果
      let analysis = this.profileCache.getAnalysis(p.name, p.lastBetAmount)
      if (!analysis) {
        analysis = this.analyzeOpponent(p, profile, sessionMem, sessionBehavior, aiPersonality)
        this.profileCache.setAnalysis(p.name, analysis, p.lastBetAmount)
      }
      
      return {
        player: p,
        profile,
        sessionMemory: sessionMem,
        sessionBehavior,
        betPattern,
        aiPersonality,
        analysis,
        estimatedStrength: this.estimateOpponentStrength(p, profile, sessionMem, sessionBehavior, betPattern)
      }
    }))
  }

  // 筹码不足时的决策
  handleLowChips(player) {
    if (!player.hasPeeked) {
      return { action: 'peek' }
    }
    const strength = player.hand.getType().weight
    if (strength >= 3000) return { action: 'call' }
    if (Math.random() > 0.4) return { action: 'call' }
    return { action: 'fold' }
  }

  // 对手深度分析
  analyzeOpponent(opponent, profile, sessionMem = null, sessionBehavior = null, aiPersonality = null) {
    const analysis = {
      type: 'unknown',
      bluffLikelihood: 0.3,
      foldPressure: 0.5,
      dangerLevel: 0.5,       // 对手整体威胁（技术水平、历史战绩）
      exploitStrategy: null,
      betSizePattern: 'normal',
      showdownTendency: 0.5,
      tiltLevel: 0,
      sessionAggression: 0
    }
    
    // AI对手：直接使用其性格配置
    if (aiPersonality && aiPersonality.config) {
      const config = aiPersonality.config
      // 根据AI性格设置分析结果
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
      
      // 整合本局行为微调
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
      
      // 异常行为可能是诈唬
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
    
    // 施压成功率（新增）
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
    
    // 诈唬概率（结合已知诈唬率和施压成功率）
    // 基础诈唬率
    analysis.bluffLikelihood = bluffRate * 0.5 + 0.2
    
    // 施压成功率高 + 已知诈唬率高 = 很可能经常诈唬
    if (pressureSuccessRate > 0.3 && bluffRate > 0.1) {
      analysis.bluffLikelihood += pressureSuccessRate * 0.3
    }
    // 施压成功率高但开牌诈唬率低 = 可能真的牌好，降低诈唬判断
    else if (pressureSuccessRate > 0.3 && bluffRate < 0.1 && showdownTotal >= 3) {
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
    
    // 使用下注模式推测牌力（优先级最高）
    if (betPattern && betPattern.totalRecords >= 5 && profile) {
      const avgBet = profile.avgBetSize || 20
      const currentBetIntensity = avgBet > 0 ? opponent.currentBet / avgBet : 1
      const estimate = this.estimateHandByBetPattern(betPattern, currentBetIntensity)
      
      if (estimate && estimate.confidence >= 0.3) {
        // 将估计的牌力权重转换为 0-1 的强度值
        // 3000 以下弱牌 → 0.3, 5000 中等 → 0.5, 7000+ 强牌 → 0.8+
        const patternStrength = Math.min(0.95, estimate.estimatedWeight / 10000 + 0.2)
        // 根据置信度混合原有估计和模式估计
        strength = strength * (1 - estimate.confidence) + patternStrength * estimate.confidence
      }
    }
    
    // 整合本局行为分析
    if (sessionBehavior) {
      // 连续大注是大牌的强信号！
      if (sessionBehavior.strongHandLikelihood > 0) {
        // 直接使用大牌可能性作为主要参考
        strength = Math.max(strength, sessionBehavior.strongHandLikelihood)
      }
      
      // 行为异常时，结合历史诈唬率判断
      if (sessionBehavior.isAbnormal && sessionBehavior.strongHandLikelihood < 0.5) {
        const bluffRate = profile ? profile.bluffCaught / Math.max(profile.totalHands, 1) : 0.2
        strength += bluffRate > 0.2 ? -0.1 : 0.1
      }
      
      // 递增趋势可能牌力强
      if (sessionBehavior.trend === 'escalating') {
        strength += 0.1
      }
      // 下降趋势可能牌力弱
      else if (sessionBehavior.trend === 'declining') {
        strength -= 0.1
      }
    }
    
    // 整合本局记忆
    if (sessionMem && sessionMem.actions.length >= 2) {
      // 本局最大下注很大，提高估计
      if (sessionMem.maxBet > 50) {
        strength += 0.1
      }
      
      // 看牌时机
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


  // 焖牌决策
  makeBlindDecision(player, callAmount, context) {
    const { round, opponentProfiles, personality } = context
    const chipPressure = callAmount / player.chips
    
    const rockCount = opponentProfiles.filter(o => o.analysis.type === 'rock').length
    const maniacCount = opponentProfiles.filter(o => o.analysis.type === 'maniac').length
    const avgBluffLikelihood = opponentProfiles.reduce((sum, o) => sum + o.analysis.bluffLikelihood, 0) / Math.max(opponentProfiles.length, 1)
    const avgDanger = opponentProfiles.reduce((sum, o) => sum + o.analysis.dangerLevel, 0) / Math.max(opponentProfiles.length, 1)
    const avgTiltLevel = opponentProfiles.reduce((sum, o) => sum + (o.analysis.tiltLevel || 0), 0) / Math.max(opponentProfiles.length, 1)
    
    // 个性影响焖牌概率
    const blindPlayBonus = personality ? personality.blindPlayChance - 0.4 : 0
    
    // 决定是否看牌
    let peekChance = 0.3 - blindPlayBonus
    peekChance += round * 0.15
    if (chipPressure > 0.2) peekChance += 0.3
    if (chipPressure > 0.4) peekChance += 0.4
    if (avgDanger > 0.5) peekChance += 0.25
    if (maniacCount > 0) peekChance += 0.2
    if (avgBluffLikelihood > 0.4) peekChance -= 0.1
    // 对手上头时可以继续焖牌施压
    if (avgTiltLevel > 0.4) peekChance -= 0.15
    peekChance = Math.max(0.15, Math.min(0.95, peekChance))
    
    if (Math.random() < peekChance) {
      return { action: 'peek' }
    }

    // 继续焖牌
    if (round >= 3) {
      return { action: 'blind', amount: callAmount }
    }
    
    // 计算焖牌加注尺度
    const blindRaiseAmount = this.calculateBlindRaiseAmount(player, callAmount, opponentProfiles, round)
    
    // 针对岩石型玩家
    if (rockCount > 0 && player.chips > callAmount + blindRaiseAmount && round <= 2) {
      const avgFoldPressure = opponentProfiles
        .filter(o => o.analysis.type === 'rock')
        .reduce((sum, o) => sum + o.analysis.foldPressure, 0) / rockCount
      
      if (Math.random() < avgFoldPressure * 0.4) {
        return { action: 'blind', amount: callAmount + blindRaiseAmount }
      }
    }
    
    // 对手上头时加注施压
    if (avgTiltLevel > 0.5 && player.chips > callAmount + blindRaiseAmount) {
      if (Math.random() < avgTiltLevel * 0.35) {
        return { action: 'blind', amount: callAmount + blindRaiseAmount }
      }
    }
    
    // 针对跟注站
    const callingStationCount = opponentProfiles.filter(o => o.analysis.type === 'calling_station').length
    if (callingStationCount > 0) {
      return { action: 'blind', amount: callAmount }
    }
    
    // 普通情况：小概率加注
    if (Math.random() < 0.1 && player.chips > callAmount + blindRaiseAmount && round <= 2) {
      return { action: 'blind', amount: callAmount + blindRaiseAmount }
    }
    
    return { action: 'blind', amount: callAmount }
  }

  // 计算焖牌加注尺度
  calculateBlindRaiseAmount(player, callAmount, opponentProfiles, round) {
    const potSize = this.game.state.pot
    const ante = this.game.state.ante || 10
    const maxRaise = player.chips - callAmount
    
    if (maxRaise <= 0) return 0
    
    // 基础加注：底池的 30-50%
    let baseRaise = Math.floor(potSize * 0.4)
    
    // 早期回合加注小一点
    if (round <= 1) baseRaise = Math.floor(baseRaise * 0.7)
    
    // 根据对手调整
    const avgFoldPressure = opponentProfiles.reduce((sum, o) => sum + o.analysis.foldPressure, 0) / Math.max(opponentProfiles.length, 1)
    
    // 对手容易弃牌时，加注可以小一点
    if (avgFoldPressure > 0.6) {
      baseRaise = Math.floor(baseRaise * 0.8)
    }
    
    // 确保最小加注
    baseRaise = Math.max(baseRaise, ante)
    
    return Math.min(baseRaise, maxRaise)
  }

  // 下注决策
  makeBettingDecision(player, callAmount, context) {
    const { strength, isMonster, isStrong, isMedium, isWeak, opponentProfiles, round, stackDepth, personality, roundPressure = 0 } = context
    const chipPressure = callAmount / player.chips
    const playerCount = opponentProfiles.length + 1
    
    // 检测是否有对手缺少开牌记录（未知风险）
    const unknownRiskOpponents = opponentProfiles.filter(o => 
      o.player.type === 'human' && (!o.betPattern || o.betPattern.totalRecords < 5)
    )
    const hasUnknownRisk = unknownRiskOpponents.length > 0
    
    // 面对未知玩家时的风险控制：限制最大投入比例
    // 防止被极端玩家（只有大牌才下注）收割
    if (hasUnknownRisk) {
      const totalInvested = player.currentBet + callAmount  // 如果跟注，总投入
      const investRatio = totalInvested / (player.chips + player.currentBet)  // 投入占总筹码比例
      
      // 根据牌力设置不同的投入上限
      let maxInvestRatio
      if (isMonster) {
        maxInvestRatio = 0.8  // 怪兽牌可以投入80%
      } else if (isStrong) {
        maxInvestRatio = 0.5  // 强牌（顺子等）最多投入50%
      } else if (isMedium) {
        maxInvestRatio = 0.3  // 中等牌最多投入30%
      } else {
        maxInvestRatio = 0.15  // 弱牌最多投入15%
      }
      
      // 超过上限时，根据超出程度决定是否弃牌
      if (investRatio > maxInvestRatio) {
        const overRatio = (investRatio - maxInvestRatio) / maxInvestRatio
        const foldProb = Math.min(0.8, overRatio * 0.6)  // 超出越多，弃牌概率越高
        if (Math.random() < foldProb) {
          return { action: 'fold' }
        }
        // 不弃牌也只跟注，不加注
        return { action: 'call' }
      }
    }
    
    // 获取自修正调整参数
    const adjustments = this.getStrategyAdjustments(player.name)
    
    // 多人底池调整
    const multiwayAdj = this.calculateMultiwayAdjustment(playerCount)
    
    // 个性参数（回合压力会提高激进度）+ 自修正调整 + 多人调整
    const raiseFreq = ((personality ? personality.raiseFrequency : 0.4) + roundPressure * 0.15 + adjustments.aggressionAdjust) / multiwayAdj.strengthMultiplier
    const bluffFreq = ((personality ? personality.bluffFrequency : 0.2) + roundPressure * 0.1 + adjustments.bluffAdjust) * multiwayAdj.bluffMultiplier
    const foldThreshold = ((personality ? personality.foldThreshold : 0.55) + roundPressure * 0.1 + adjustments.foldAdjust) / multiwayAdj.foldMultiplier
    
    const rockCount = opponentProfiles.filter(o => o.analysis.type === 'rock').length
    const callingStationCount = opponentProfiles.filter(o => o.analysis.type === 'calling_station').length
    const maniacCount = opponentProfiles.filter(o => o.analysis.type === 'maniac').length
    const unknownCount = opponentProfiles.filter(o => o.analysis.type === 'unknown' || o.analysis.type === 'balanced').length
    const avgDanger = opponentProfiles.reduce((sum, o) => sum + o.analysis.dangerLevel, 0) / Math.max(opponentProfiles.length, 1)
    const avgFoldPressure = opponentProfiles.reduce((sum, o) => sum + o.analysis.foldPressure, 0) / Math.max(opponentProfiles.length, 1)
    
    // GTO 混合策略：对手类型不明确时使用，避免被读牌
    const useGTO = unknownCount > 0 && unknownCount >= opponentProfiles.length * 0.5
    if (useGTO && !stackDepth?.isShort) {
      const potSize = this.game.state.pot
      const handEval = { isMonster, isStrong, isMedium, isWeak }
      const mixedActions = this.generateMixedStrategy(handEval, {
        callAmount, potSize, avgFoldPressure, avgDanger, personality
      })
      // 30% 概率使用混合策略
      if (Math.random() < 0.3) {
        return this.selectMixedAction(mixedActions)
      }
    }
    
    // 短筹码策略：更激进，要么全押要么弃牌
    if (stackDepth && stackDepth.isShort) {
      return this.makeShortStackDecision(player, callAmount, { isMonster, isStrong, isMedium, avgDanger })
    }
    
    // 深筹码策略：可以慢打设陷阱（后期回合减少慢打）
    if (stackDepth && stackDepth.isDeep && (isMonster || isStrong) && roundPressure < 0.4) {
      const slowPlayChance = personality ? personality.slowPlayChance : 0.3
      const slowPlayDecision = this.considerSlowPlay(player, callAmount, {
        isMonster, isStrong, maniacCount, callingStationCount, round, slowPlayChance
      })
      if (slowPlayDecision) return slowPlayDecision
    }
    
    // 检测对手激进程度
    const maxStrongHandLikelihood = Math.max(...opponentProfiles.map(o => o.sessionBehavior?.strongHandLikelihood || 0), 0)
    const opponentIsAggressive = maxStrongHandLikelihood >= 0.5 || maniacCount > 0
    
    // 怪兽牌
    if (isMonster) {
      // 对手激进时，更多跟注设陷阱，让对手继续送钱
      if (opponentIsAggressive && Math.random() < 0.6) {
        return { action: 'call' }
      }
      if (callingStationCount > 0) {
        const raiseAmount = this.calculateBetSize(player, callAmount, 'value_heavy', context)
        if (raiseAmount > 0) return { action: 'raise', amount: raiseAmount }
      }
      const trapChance = 0.5 + adjustments.trapAdjust
      if (maniacCount > 0 && Math.random() < trapChance) {
        return { action: 'call' }
      }
      if (Math.random() < raiseFreq + 0.3) {
        const raiseAmount = this.calculateBetSize(player, callAmount, 'value', context)
        if (raiseAmount > 0) return { action: 'raise', amount: raiseAmount }
      }
      return { action: 'call' }
    }
    
    // 强牌
    if (isStrong) {
      const chipPressure = callAmount / player.chips
      
      // 对手极度激进（连续大注80%+可能有大牌）且筹码压力大时，强牌也要考虑弃牌
      // 顺子(5000+)遇到可能的同花/同花顺(6000+/7000+)应该谨慎
      if (maxStrongHandLikelihood >= 0.8 && chipPressure > 0.3 && strength < 6000) {
        // 只有"低强牌"（顺子、低对子等）才考虑弃牌
        if (Math.random() < 0.4) {
          return { action: 'fold' }
        }
      }
      
      // 对手激进时，跟注让对手继续加注
      if (opponentIsAggressive && Math.random() < 0.5) {
        return { action: 'call' }
      }
      if (rockCount > 0 && avgDanger > 0.6) {
        return { action: 'call' }
      }
      if (callingStationCount > 0) {
        const raiseAmount = this.calculateBetSize(player, callAmount, 'value', context)
        if (raiseAmount > 0) return { action: 'raise', amount: raiseAmount }
      }
      if (Math.random() < raiseFreq) {
        const raiseAmount = this.calculateBetSize(player, callAmount, 'standard', context)
        if (raiseAmount > 0) return { action: 'raise', amount: raiseAmount }
      }
      return { action: 'call' }
    }
    
    // 中等牌
    if (isMedium) {
      const potSize = this.game.state.pot
      const potOdds = this.calculatePotOdds(callAmount, potSize)
      const mediumWinProb = 0.45
      const hasGoodOdds = this.hasPositiveEV(mediumWinProb, potOdds)
      
      // 对手可能有大牌时，中等牌要谨慎（复用上面计算的 maxStrongHandLikelihood）
      if (maxStrongHandLikelihood >= 0.7) {
        // 高压力下弃牌
        if (chipPressure > 0.3 && Math.random() < 0.5) {
          return { action: 'fold' }
        }
        // 否则只跟注，不加注
        return { action: 'call' }
      }
      
      if (rockCount > 0 && avgFoldPressure > 0.5 && maxStrongHandLikelihood < 0.5 && Math.random() < bluffFreq + 0.15) {
        const raiseAmount = this.calculateBetSize(player, callAmount, 'bluff', context)
        return { action: 'raise', amount: raiseAmount }
      }
      if (callingStationCount > 0) {
        if (hasGoodOdds && Math.random() < 0.3) {
          const raiseAmount = this.calculateBetSize(player, callAmount, 'thin', context)
          if (raiseAmount > 0) return { action: 'raise', amount: raiseAmount }
        }
        return { action: 'call' }
      }
      if (chipPressure > 0.4 && avgDanger > 0.65 && !hasGoodOdds && Math.random() < (1 - foldThreshold)) {
        return { action: 'fold' }
      }
      return { action: 'call' }
    }
    
    // 弱牌决策
    return this.makeWeakHandDecision(player, callAmount, opponentProfiles, avgDanger, avgFoldPressure, rockCount, callingStationCount, foldThreshold, bluffFreq, maxStrongHandLikelihood, adjustments)
  }

  // 弱牌决策
  makeWeakHandDecision(player, callAmount, opponentProfiles, avgDanger, avgFoldPressure, rockCount, callingStationCount, foldThreshold = 0.55, bluffFreq = 0.2, maxStrongHandLikelihood = 0, adjustments = {}) {
    const chipPressure = callAmount / player.chips
    const potSize = this.game.state.pot
    const investedRatio = player.currentBet / (player.chips + player.currentBet)
    
    // 使用改进的底池赔率计算
    const potOdds = this.calculatePotOdds(callAmount, potSize)
    const opponentChips = opponentProfiles.map(o => o.player.chips)
    
    // 计算对手诈唬可能性
    const avgBluffLikelihood = opponentProfiles.reduce((sum, o) => sum + o.analysis.bluffLikelihood, 0) / Math.max(opponentProfiles.length, 1)
    
    // 估算弱牌胜率（基础 25%，诈唬可能性只在这里影响胜率）
    const estimatedWinProb = 0.25 + avgBluffLikelihood * 0.25
    
    // 计算隐含赔率
    const impliedOdds = this.calculateImpliedOdds(callAmount, potSize, opponentChips, estimatedWinProb)
    
    // 判断是否有正期望值
    const hasGoodOdds = this.hasPositiveEV(estimatedWinProb, impliedOdds)
    
    // 分析对手行为强度
    let opponentAggression = 0
    for (const opp of opponentProfiles) {
      const p = opp.player
      if (p.hasPeeked && p.lastBetAmount > 30) opponentAggression += 0.4
      else if (p.hasPeeked && p.lastBetAmount > 20) opponentAggression += 0.25
      else if (!p.hasPeeked && p.lastBetAmount > 25) opponentAggression += 0.15
      else if (p.lastBetAmount <= this.game.state.ante) opponentAggression += 0.05
    }
    opponentAggression = opponentAggression / Math.max(opponentProfiles.length, 1)
    
    const avgTiltLevel = opponentProfiles.reduce((sum, o) => sum + (o.analysis.tiltLevel || 0), 0) / Math.max(opponentProfiles.length, 1)
    
    // 弃牌决策
    let foldChance = 1 - foldThreshold
    foldChance += opponentAggression * 0.5
    foldChance += avgDanger * 0.3
    foldChance += chipPressure * 0.4
    if (investedRatio > 0.3) foldChance += 0.2
    if (potOdds > 0.35) foldChance += 0.15
    if (callingStationCount > 0) foldChance += 0.3
    if (avgTiltLevel > 0.4) foldChance -= 0.15
    if (hasGoodOdds) foldChance -= 0.25
    if (potOdds < 0.15 && chipPressure < 0.1) foldChance -= 0.2
    
    // 对手连续大注时，弱牌适当增加弃牌（但不要太激进）
    if (maxStrongHandLikelihood >= 0.8) {
      foldChance += 0.2
    } else if (maxStrongHandLikelihood >= 0.6) {
      foldChance += 0.1
    }
    
    foldChance = Math.max(0.1, Math.min(0.75, foldChance))
    
    if (Math.random() < foldChance) {
      return { action: 'fold' }
    }
    
    // 不弃牌时的决策：考虑诈唬
    // 对手可能有大牌时，减少诈唬频率
    const adjustedBluffFreq = maxStrongHandLikelihood > 0.5 ? bluffFreq * 0.3 : bluffFreq
    
    if (rockCount > 0 && avgFoldPressure > 0.6 && player.chips > callAmount + 20) {
      if (Math.random() < avgFoldPressure * adjustedBluffFreq * 1.5) {
        const bluffAmount = this.calculateBetSize(player, callAmount, 'bluff', { opponentProfiles })
        if (bluffAmount > 0) {
          return { action: 'raise', amount: bluffAmount }
        }
      }
    }
    
    // 对手可能在诈唬时，用小加注试探
    const probeChance = 0.15 + adjustedBluffFreq * 0.5 + (adjustments.probeAdjust || 0)
    if (avgBluffLikelihood > 0.5 && maxStrongHandLikelihood < 0.5 && player.chips > callAmount + 15) {
      if (Math.random() < probeChance) {
        const probeAmount = this.calculateBetSize(player, callAmount, 'thin', { opponentProfiles })
        if (probeAmount > 0) {
          return { action: 'raise', amount: probeAmount }
        }
      }
    }
    
    return { action: 'call' }
  }

  // 开牌决策
  considerShowdown(player, strength, opponentProfiles, personality = null, roundPressure = 0) {
    if (opponentProfiles.length === 0) return null
    
    const showdownCost = this.game.getLastActiveBetAmount(player.id)
    if (player.chips < showdownCost) return null
    
    // 牌力门槛：至少要有一对才考虑开牌
    if (strength < 3500) return null  // 一对小牌约3000-4000
    
    // 多人底池时更谨慎开牌
    const playerCount = opponentProfiles.length + 1
    if (playerCount >= 4 && strength < 5000) return null  // 4人以上需要顺子级别
    if (playerCount >= 3 && strength < 4000) return null  // 3人需要一对大牌以上
    
    // 获取自修正参数
    const adjustments = this.getStrategyAdjustments(player.name)
    
    // 个性影响开牌激进度 + 自修正
    const showdownAggression = (personality ? personality.showdownAggression : 0.5) + adjustments.showdownAdjust
    
    // 找最佳开牌目标（选估计牌力最弱的对手）
    const sorted = [...opponentProfiles].sort((a, b) => a.estimatedStrength - b.estimatedStrength)
    const target = sorted[0]
    if (!target) return null
    
    // 计算开牌期望值（使用改进的胜率计算）
    const winProb = this.calculateWinProbability(strength, target, opponentProfiles.length + 1)
    
    // 胜率低于50%不开牌
    if (winProb < 0.5) return null
    
    const potSize = this.game.state.pot
    const ev = winProb * potSize - (1 - winProb) * showdownCost
    
    // 对岩石型谨慎开（保守型更谨慎）
    const rockThreshold = showdownAggression > 0.5 ? 5500 : 6500
    if (target.analysis.type === 'rock' && strength < rockThreshold) return null
    
    // 基于 EV 的开牌决策
    let showdownChance = 0.05 + showdownAggression * 0.15
    
    // EV 为正时更愿意开牌
    if (ev > showdownCost * 0.5) showdownChance += 0.4
    else if (ev > 0) showdownChance += 0.25
    else if (ev > -showdownCost * 0.3) showdownChance += 0.1
    else return null  // EV 太负，不开牌
    
    // 高胜率时更愿意开
    if (winProb > 0.7) showdownChance += 0.2
    else if (winProb > 0.55) showdownChance += 0.1
    
    // 对手可能在诈唬时更愿意开
    if (target.analysis.bluffLikelihood > 0.5) showdownChance += 0.15
    
    // 对手倾斜时更愿意开
    if (target.analysis.tiltLevel > 0.4) showdownChance += 0.1
    
    // 回合压力加成（后期更愿意开牌结束游戏）
    showdownChance += roundPressure * 0.2
    
    // 个性加成
    showdownChance *= (0.7 + showdownAggression * 0.6)
    
    showdownChance = Math.min(0.85, showdownChance)
    
    if (Math.random() < showdownChance) {
      return { action: 'showdown', amount: target.player.id }
    }
    
    return null
  }

  // 计算胜率（改进版）
  calculateWinProbability(myStrength, targetProfile, playerCount = 2) {
    const oppEstimatedStrength = targetProfile.estimatedStrength
    const bluffLikelihood = targetProfile.analysis.bluffLikelihood
    const tiltLevel = targetProfile.analysis.tiltLevel || 0
    
    // 将对手估计强度(0-1)转换为牌力值(1000-10000)
    // oppEstimatedStrength 0.3 → 约3000, 0.5 → 约5000, 0.75 → 约7500
    const oppStrengthValue = 1000 + oppEstimatedStrength * 9000
    
    // 基于牌力差距计算胜率
    const strengthDiff = myStrength - oppStrengthValue
    // 使用 sigmoid 函数，差距1000约等于10%胜率变化
    let baseWinProb = 1 / (1 + Math.exp(-strengthDiff / 1000))
    
    // 诈唬可能性加成（对手可能在诈唬，实际牌力比估计的弱）
    const bluffBonus = bluffLikelihood * 0.1
    
    // 倾斜加成（倾斜玩家判断力下降）
    const tiltBonus = tiltLevel * 0.05
    
    // 多人底池折扣（人越多，胜率越低）
    const multiWayDiscount = Math.pow(0.9, playerCount - 2)
    
    let winProb = baseWinProb * multiWayDiscount + bluffBonus + tiltBonus
    
    // 根据对手类型微调
    const oppType = targetProfile.analysis.type
    if (oppType === 'rock') {
      // 岩石型玩家还在牌局里，说明牌力可能较强
      winProb *= 0.8
    } else if (oppType === 'maniac') {
      // 疯狂型玩家什么牌都打，胜率相对提高
      winProb *= 1.05
    }
    
    return Math.max(0.05, Math.min(0.95, winProb))
  }

  // 针对倾斜玩家的策略调整
  adjustForTilt(decision, tiltLevel, player, callAmount) {
    if (tiltLevel < 0.3) return decision
    
    if (decision.action === 'fold' && tiltLevel > 0.5) {
      if (Math.random() < tiltLevel * 0.4) {
        return { action: 'call' }
      }
    }
    
    if (decision.action === 'raise' && tiltLevel > 0.4) {
      const extraAmount = Math.floor(decision.amount * tiltLevel * 0.5)
      const maxExtra = player.chips - callAmount - decision.amount
      if (maxExtra > 0) {
        return { action: 'raise', amount: decision.amount + Math.min(extraAmount, maxExtra) }
      }
    }
    
    return decision
  }

  // 短筹码决策（推-弃策略）
  makeShortStackDecision(player, callAmount, context) {
    const { isMonster, isStrong, isMedium, avgDanger } = context
    const remainingChips = player.chips - callAmount
    
    // 怪兽牌或强牌：全押
    if (isMonster || isStrong) {
      if (remainingChips > 0) {
        return { action: 'raise', amount: remainingChips }
      }
      return { action: 'call' }
    }
    
    // 中等牌：根据对手威胁决定
    if (isMedium) {
      if (avgDanger < 0.5 && remainingChips > 0) {
        // 对手不太危险，可以推
        if (Math.random() < 0.5) {
          return { action: 'raise', amount: remainingChips }
        }
      }
      return { action: 'call' }
    }
    
    // 弱牌：大概率弃牌
    if (Math.random() < 0.7) {
      return { action: 'fold' }
    }
    return { action: 'call' }
  }

  // 深筹码慢打策略
  considerSlowPlay(player, callAmount, context) {
    const { isMonster, isStrong, maniacCount, callingStationCount, round, slowPlayChance: personalitySlowPlay } = context
    
    // 获取自修正参数
    const adjustments = this.getStrategyAdjustments(player.name)
    
    // 慢打条件检查（加入自修正）
    let slowPlayChance = (personalitySlowPlay || 0.3) + adjustments.slowPlayAdjust
    
    // 怪兽牌更适合慢打
    if (isMonster) slowPlayChance += 0.25
    else if (isStrong) slowPlayChance += 0.1
    
    // 有疯狂型玩家时慢打更有价值（让他们自己加注）
    if (maniacCount > 0) slowPlayChance += 0.25
    
    // 有跟注站时不要慢打（他们不会主动加注）
    if (callingStationCount > 0) slowPlayChance -= 0.3
    
    // 早期回合更适合慢打
    if (round <= 2) slowPlayChance += 0.15
    else slowPlayChance -= 0.2
    
    // 底池还小时慢打
    const potSize = this.game.state.pot
    if (potSize < player.chips * 0.15) slowPlayChance += 0.1
    
    slowPlayChance = Math.max(0, Math.min(0.7, slowPlayChance))
    
    if (Math.random() < slowPlayChance) {
      // 执行慢打：只跟注，不加注
      return { action: 'call', isSlowPlay: true }
    }
    
    return null  // 不慢打，继续正常决策
  }

  // 计算下注尺度
  calculateBetSize(player, callAmount, betType, context) {
    const potSize = this.game.state.pot
    const ante = this.game.state.ante || 10
    const maxBet = player.chips - callAmount
    const { opponentProfiles, stackDepth, position } = context
    
    if (maxBet <= 0) return 0
    
    // 基础下注尺度（以底池百分比计算）
    let basePct
    switch (betType) {
      case 'value_heavy':  // 重价值下注
        basePct = 0.8
        break
      case 'value':        // 价值下注
        basePct = 0.6
        break
      case 'standard':     // 标准下注
        basePct = 0.5
        break
      case 'bluff':        // 诈唬下注
        basePct = 0.65     // 诈唬要下大一点才有弃牌率
        break
      case 'thin':         // 薄价值
        basePct = 0.35
        break
      default:
        basePct = 0.5
    }
    
    let betAmount = Math.floor(potSize * basePct)
    
    // 位置调整：后位可以下注更大（有信息优势）
    if (position === 'late') {
      betAmount = Math.floor(betAmount * 1.15)
    } else if (position === 'early') {
      // 前位下注保守一点
      betAmount = Math.floor(betAmount * 0.9)
    }
    
    // 根据对手类型调整
    if (opponentProfiles && opponentProfiles.length > 0) {
      const avgFoldPressure = opponentProfiles.reduce((sum, o) => sum + o.analysis.foldPressure, 0) / opponentProfiles.length
      const hasCallingStation = opponentProfiles.some(o => o.analysis.type === 'calling_station')
      const hasRock = opponentProfiles.some(o => o.analysis.type === 'rock')
      
      // 对跟注站：价值下注可以更大
      if (hasCallingStation && (betType === 'value' || betType === 'value_heavy')) {
        betAmount = Math.floor(betAmount * 1.3)
      }
      
      // 对岩石型：诈唬下注可以小一点（他们容易弃牌）
      if (hasRock && betType === 'bluff') {
        betAmount = Math.floor(betAmount * 0.7)
      }
      
      // 对手弃牌率高时，诈唬下注可以小一点
      if (avgFoldPressure > 0.6 && betType === 'bluff') {
        betAmount = Math.floor(betAmount * 0.8)
      }
    }
    
    // 筹码深度调整
    if (stackDepth) {
      // 深筹码时下注可以更大
      if (stackDepth.isDeep) betAmount = Math.floor(betAmount * 1.15)
      // 覆盖对手时可以施加更多压力
      if (stackDepth.covers) betAmount = Math.floor(betAmount * 1.1)
    }
    
    // 确保最小下注
    betAmount = Math.max(betAmount, ante)
    
    // 不超过最大可下注额
    return Math.min(betAmount, maxBet)
  }

  // ========== 牌局复盘功能 ==========

  // 清空复盘记录（新牌局开始时调用）
  clearReplayLog() {
    this.gameReplayLog = []
  }

  // 记录玩家操作（所有玩家通用）
  logPlayerAction(playerName, playerType, action, amount, context = {}) {
    // 获取玩家对象以判断状态
    const player = this.game.seats.find(p => p && p.name === playerName)
    
    const entry = {
      timestamp: Date.now(),
      round: this.game.state.round || 1,
      playerName,
      playerType,  // 'human' 或 'ai'
      action,
      amount: amount || 0,
      potSize: this.game.state.pot,
      currentBet: this.game.state.currentBet,
      isBlind: player ? !player.hasPeeked : false,  // 是否焖牌状态
      reasoning: null
    }

    // AI 玩家生成决策思路（简化版，不显示手牌）
    if (playerType === 'ai' && context.reasoning) {
      entry.reasoning = context.reasoning
    }

    this.gameReplayLog.push(entry)
  }

  // 生成 AI 决策思路（不显示手牌）
  generateReasoning(player, decision, context) {
    const { strength, handEval, opponentProfiles, round, position, callAmount, personality } = context
    const parts = []

    // 1. 位置
    if (position) {
      const posName = { early: '前位', middle: '中位', late: '后位' }
      parts.push(`位置: ${posName[position] || position}`)
    }

    // 2. 对手分析（使用AI性格名称）
    if (opponentProfiles && opponentProfiles.length > 0) {
      const oppInfo = opponentProfiles.map(o => {
        // 优先使用AI的性格名称
        const aiPersonality = this.getPersonality(o.player.name)
        if (aiPersonality && aiPersonality.config) {
          return `${o.player.name}(${aiPersonality.config.name})`
        }
        // 人类玩家使用分析类型
        const type = o.analysis?.type || 'unknown'
        const typeName = {
          rock: '岩石型', maniac: '疯狂型', aggressive: '激进型',
          calling_station: '跟注站', balanced: '均衡型', unknown: '玩家'
        }
        return `${o.player.name}(${typeName[type] || type})`
      }).join(', ')
      parts.push(`对手: ${oppInfo}`)
    }

    // 3. 筹码压力（使用总投入占比）
    if (callAmount > 0 && player.chips > 0) {
      const totalInvested = player.currentBet + callAmount
      const totalStack = player.chips + player.currentBet
      const pressure = Math.round(totalInvested / totalStack * 100)
      parts.push(`跟注压力: ${pressure}%`)
    }

    // 5. 决策理由
    let reason = ''
    switch (decision.action) {
      case 'fold':
        reason = this.explainFold(context)
        break
      case 'call':
        reason = this.explainCall(context)
        break
      case 'raise':
      case 'blind':
        reason = this.explainRaise(context, decision.amount)
        break
      case 'showdown':
        reason = this.explainShowdown(context)
        break
      case 'peek':
        reason = '压力过大或需要看牌决策'
        break
    }
    if (reason) parts.push(`理由: ${reason}`)

    return parts.join(' | ')
  }

  // 解释弃牌原因
  explainFold(context) {
    const { handEval, opponentProfiles, callAmount, player } = context
    const reasons = []
    
    if (handEval?.isWeak) reasons.push('牌力不足')
    
    const maxStrong = Math.max(...(opponentProfiles || []).map(o => o.sessionBehavior?.strongHandLikelihood || 0), 0)
    if (maxStrong >= 0.6) reasons.push('对手可能有大牌')
    
    if (callAmount && player && callAmount > player.chips * 0.3) reasons.push('筹码压力大')
    
    const hasUnknown = (opponentProfiles || []).some(o => !o.betPattern || o.betPattern.totalRecords < 5)
    if (hasUnknown) reasons.push('对手数据不足,控制风险')
    
    return reasons.length > 0 ? reasons.join(', ') : '综合判断不利'
  }

  // 解释跟注原因
  explainCall(context) {
    const { handEval, opponentProfiles } = context
    const reasons = []
    
    if (handEval?.isMonster || handEval?.isStrong) reasons.push('慢打设陷阱')
    else if (handEval?.isMedium) reasons.push('底池赔率合适')
    
    const hasManiac = (opponentProfiles || []).some(o => o.analysis?.type === 'maniac')
    if (hasManiac) reasons.push('让疯狂型对手继续加注')
    
    return reasons.length > 0 ? reasons.join(', ') : '跟注观察'
  }

  // 解释加注原因
  explainRaise(context, amount) {
    const { handEval, opponentProfiles } = context
    const reasons = []
    
    if (handEval?.isMonster) reasons.push('价值下注榨取')
    else if (handEval?.isStrong) reasons.push('保护手牌')
    else if (handEval?.isMedium) reasons.push('半诈唬')
    else reasons.push('诈唬施压')
    
    const hasRock = (opponentProfiles || []).some(o => o.analysis?.type === 'rock')
    if (hasRock && !handEval?.isStrong) reasons.push('逼岩石型弃牌')
    
    return reasons.length > 0 ? reasons.join(', ') : '主动施压'
  }

  // 解释开牌原因
  explainShowdown(context) {
    const { strength, opponentProfiles } = context
    const reasons = []
    
    if (strength >= 6000) reasons.push('牌力足够')
    
    const target = opponentProfiles?.[0]
    if (target?.analysis?.bluffLikelihood > 0.4) reasons.push('对手可能在诈唬')
    if (target?.analysis?.tiltLevel > 0.3) reasons.push('对手可能上头')
    
    return reasons.length > 0 ? reasons.join(', ') : '胜率判断有利'
  }

  // 获取当前牌局的复盘记录
  getReplayLog() {
    return this.gameReplayLog
  }

  // 获取格式化的复盘数据（用于存储和展示）
  getFormattedReplay() {
    // 收集所有玩家的手牌信息
    const playerHands = []
    for (let i = 0; i < this.game.seats.length; i++) {
      const player = this.game.seats[i]
      if (player && player.hand && player.hand.cards) {
        playerHands.push({
          seatIndex: i,
          name: player.name,
          isAI: player.isAI || false,
          cards: player.hand.cards.map(c => ({ rank: c.rank, suit: c.suit })),
          handType: player.hand.getType()?.name || null,
          folded: player.folded || false
        })
      }
    }

    return {
      gameId: `${Date.now()}`,
      roomCode: this.game.roomCode || 'unknown',
      startTime: this.gameReplayLog[0]?.timestamp || Date.now(),
      endTime: this.gameReplayLog[this.gameReplayLog.length - 1]?.timestamp || Date.now(),
      totalRounds: this.game.state.round || 1,
      playerHands,
      actions: this.gameReplayLog.map(entry => ({
        ...entry,
        timestamp: entry.timestamp
      }))
    }
  }
}
