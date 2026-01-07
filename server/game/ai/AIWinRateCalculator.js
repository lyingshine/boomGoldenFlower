/**
 * AI 胜率计算器
 * 基于炸金花真实牌型分布计算胜率
 */

// 炸金花牌型权重和概率分布
// 52张牌选3张 = C(52,3) = 22100 种组合
export const HAND_TYPES = {
  HIGH_CARD: { weight: 1000, probability: 0.7411, name: '散牌' },      // 16440/22100
  PAIR: { weight: 3000, probability: 0.1694, name: '对子' },          // 3744/22100
  STRAIGHT: { weight: 5000, probability: 0.0326, name: '顺子' },      // 720/22100
  FLUSH: { weight: 6000, probability: 0.0496, name: '同花' },         // 1096/22100
  STRAIGHT_FLUSH: { weight: 7000, probability: 0.0022, name: '同花顺' }, // 48/22100
  LEOPARD: { weight: 10000, probability: 0.0024, name: '豹子' }       // 52/22100
}

// 牌型权重范围（用于更精确的胜率计算）
const WEIGHT_RANGES = {
  HIGH_CARD: { min: 1000, max: 2999 },
  PAIR: { min: 3000, max: 4999 },
  STRAIGHT: { min: 5000, max: 5999 },
  FLUSH: { min: 6000, max: 6999 },
  STRAIGHT_FLUSH: { min: 7000, max: 9999 },
  LEOPARD: { min: 10000, max: 10000 }
}

// 累积概率分布（用于快速查询"比某牌力强的概率"）
const CUMULATIVE_PROB = {
  1000: 1.0,      // 所有牌都比最弱散牌强或相等
  2000: 0.63,     // 约63%的牌比中等散牌强
  3000: 0.2589,   // 约26%的牌比散牌强（对子及以上）
  4000: 0.0895,   // 约9%的牌比对子强
  5000: 0.0568,   // 约5.7%的牌比顺子强
  6000: 0.0242,   // 约2.4%的牌比同花强
  7000: 0.0046,   // 约0.46%的牌比同花顺强
  10000: 0.0024   // 约0.24%的牌是豹子
}

export class AIWinRateCalculator {
  
  constructor() {
    // 预计算的牌型分布缓存
    this.handDistributionCache = null
    // 对手范围历史（用于贝叶斯更新）
    this.opponentRangeHistory = new Map()
  }
  
  /**
   * 贝叶斯更新对手范围
   * 根据对手的行动动态收窄其可能的牌力范围
   * @param {string} opponentId - 对手ID
   * @param {string} action - 行动类型 (fold/call/raise/check)
   * @param {number} betAmount - 下注金额
   * @param {number} potSize - 底池大小
   * @param {Object} currentRange - 当前范围估计
   * @returns {Object} - 更新后的范围
   */
  bayesianUpdateRange(opponentId, action, betAmount, potSize, currentRange) {
    // 获取或初始化该对手的范围历史
    if (!this.opponentRangeHistory.has(opponentId)) {
      this.opponentRangeHistory.set(opponentId, {
        priorRange: { minWeight: 1000, maxWeight: 10000 },
        observations: []
      })
    }
    
    const history = this.opponentRangeHistory.get(opponentId)
    const prior = currentRange || history.priorRange
    
    // 计算每种牌型采取该行动的似然度
    const likelihoods = this.calculateActionLikelihoods(action, betAmount, potSize)
    
    // 贝叶斯更新：后验 ∝ 先验 × 似然
    const posterior = this.computePosteriorRange(prior, likelihoods, action)
    
    // 记录观察
    history.observations.push({ action, betAmount, potSize, timestamp: Date.now() })
    history.priorRange = posterior
    
    return posterior
  }
  
  /**
   * 计算不同牌力采取某行动的似然度
   */
  calculateActionLikelihoods(action, betAmount, potSize) {
    const betRatio = potSize > 0 ? betAmount / potSize : 0
    
    // 不同牌型采取各行动的基础概率
    const likelihoods = {}
    
    for (const [type, info] of Object.entries(HAND_TYPES)) {
      const range = WEIGHT_RANGES[type]
      const midWeight = (range.min + range.max) / 2
      
      switch (action) {
        case 'fold':
          // 弱牌更可能弃牌
          likelihoods[type] = midWeight < 3000 ? 0.6 : 
                             midWeight < 5000 ? 0.3 : 0.05
          break
          
        case 'call':
          // 中等牌更可能跟注
          likelihoods[type] = midWeight < 2000 ? 0.2 :
                             midWeight < 4000 ? 0.5 :
                             midWeight < 6000 ? 0.4 : 0.3
          break
          
        case 'raise':
          // 根据加注尺度调整
          if (betRatio >= 0.7) {
            // 大加注：强牌或诈唬
            likelihoods[type] = midWeight >= 6000 ? 0.7 :
                               midWeight >= 5000 ? 0.4 :
                               midWeight < 2500 ? 0.25 : 0.15  // 弱牌诈唬
          } else if (betRatio >= 0.4) {
            // 中等加注：中强牌
            likelihoods[type] = midWeight >= 5000 ? 0.6 :
                               midWeight >= 3000 ? 0.5 : 0.2
          } else {
            // 小加注：试探或薄价值
            likelihoods[type] = midWeight >= 4000 ? 0.5 :
                               midWeight >= 3000 ? 0.4 : 0.3
          }
          break
          
        case 'check':
        case 'blind':
          // 过牌/焖牌：范围较宽
          likelihoods[type] = 0.4
          break
          
        default:
          likelihoods[type] = info.probability
      }
    }
    
    return likelihoods
  }
  
  /**
   * 计算后验范围
   */
  computePosteriorRange(prior, likelihoods, action) {
    let totalWeight = 0
    let weightedMin = 10000
    let weightedMax = 1000
    let weightedSum = 0
    
    // 计算每种牌型的后验概率
    for (const [type, info] of Object.entries(HAND_TYPES)) {
      const range = WEIGHT_RANGES[type]
      const likelihood = likelihoods[type] || 0.3
      
      // 检查是否在先验范围内
      if (range.max < prior.minWeight || range.min > prior.maxWeight) continue
      
      // 后验权重 = 先验概率 × 似然度
      const posteriorWeight = info.probability * likelihood
      totalWeight += posteriorWeight
      
      // 更新范围边界
      const effectiveMin = Math.max(range.min, prior.minWeight)
      const effectiveMax = Math.min(range.max, prior.maxWeight)
      
      if (posteriorWeight > 0.01) {
        weightedMin = Math.min(weightedMin, effectiveMin)
        weightedMax = Math.max(weightedMax, effectiveMax)
        weightedSum += ((effectiveMin + effectiveMax) / 2) * posteriorWeight
      }
    }
    
    // 计算加权平均
    const avgWeight = totalWeight > 0 ? weightedSum / totalWeight : (prior.minWeight + prior.maxWeight) / 2
    
    // 根据行动调整置信度
    let confidence = prior.confidence || 0.3
    if (action === 'raise') confidence += 0.15
    else if (action === 'fold') confidence += 0.2
    else if (action === 'call') confidence += 0.1
    
    return {
      minWeight: Math.max(1000, weightedMin),
      maxWeight: Math.min(10000, weightedMax),
      avgWeight: avgWeight,
      confidence: Math.min(0.9, confidence)
    }
  }
  
  /**
   * 清除对手范围历史（新牌局时调用）
   */
  clearRangeHistory() {
    this.opponentRangeHistory.clear()
  }

  /**
   * 深度限制搜索 - 向前看2步评估行动
   * @param {number} myWeight - 我的牌力
   * @param {Object} gameState - 游戏状态 { potSize, myChips, opponentChips, currentBet }
   * @param {Object} opponentRange - 对手范围
   * @param {number} depth - 搜索深度
   * @returns {Object} - 最优行动及其EV
   */
  depthLimitedSearch(myWeight, gameState, opponentRange, depth = 2) {
    const { potSize, myChips, opponentChips, currentBet } = gameState
    
    // 可能的行动
    const actions = ['fold', 'call', 'raise_small', 'raise_big']
    let bestAction = null
    let bestEV = -Infinity
    
    for (const action of actions) {
      const ev = this.evaluateAction(action, myWeight, gameState, opponentRange, depth)
      if (ev > bestEV) {
        bestEV = ev
        bestAction = action
      }
    }
    
    return { action: bestAction, ev: bestEV }
  }

  /**
   * 评估单个行动的EV（递归搜索）
   */
  evaluateAction(action, myWeight, gameState, opponentRange, depth) {
    const { potSize, myChips, opponentChips, currentBet } = gameState
    
    if (action === 'fold') {
      return 0  // 弃牌EV = 0（放弃已投入的筹码）
    }
    
    const callAmount = currentBet
    let betAmount = callAmount
    
    if (action === 'raise_small') {
      betAmount = callAmount + Math.floor(potSize * 0.5)
    } else if (action === 'raise_big') {
      betAmount = callAmount + Math.floor(potSize * 0.8)
    }
    
    // 检查筹码是否足够
    if (betAmount > myChips) betAmount = myChips
    
    // 计算胜率
    const winRate = this.monteCarloWinRate(myWeight, opponentRange, 200)
    
    // 预测对手反应
    const oppResponse = this.predictOpponentResponse(action, betAmount, potSize, opponentRange)
    
    // 计算即时EV
    let ev = 0
    
    // 对手弃牌：赢得底池
    ev += oppResponse.foldProb * potSize
    
    // 对手跟注：进入摊牌
    const newPot = potSize + betAmount * 2
    ev += oppResponse.callProb * (winRate * newPot - (1 - winRate) * betAmount)
    
    // 对手加注：需要递归搜索
    if (depth > 1 && oppResponse.raiseProb > 0.1) {
      const oppRaiseAmount = betAmount + Math.floor(potSize * 0.6)
      const newState = {
        potSize: potSize + betAmount + oppRaiseAmount,
        myChips: myChips - betAmount,
        opponentChips: opponentChips - oppRaiseAmount,
        currentBet: oppRaiseAmount
      }
      
      // 递归搜索我方最优响应
      const response = this.depthLimitedSearch(myWeight, newState, opponentRange, depth - 1)
      ev += oppResponse.raiseProb * response.ev
    }
    
    return ev
  }

  /**
   * 预测对手对我方行动的反应
   */
  predictOpponentResponse(myAction, betAmount, potSize, opponentRange) {
    const betRatio = potSize > 0 ? betAmount / potSize : 0
    const avgOppStrength = opponentRange.avgWeight || 3500
    
    // 基础反应概率
    let foldProb = 0.3
    let callProb = 0.5
    let raiseProb = 0.2
    
    // 根据我方行动调整
    if (myAction === 'raise_big') {
      foldProb += 0.2
      callProb -= 0.1
      raiseProb -= 0.1
    } else if (myAction === 'raise_small') {
      foldProb += 0.1
      callProb += 0.05
      raiseProb -= 0.15
    } else if (myAction === 'call') {
      foldProb = 0
      callProb = 0.6
      raiseProb = 0.4
    }
    
    // 根据对手范围调整
    if (avgOppStrength >= 5000) {
      // 对手可能有强牌
      foldProb *= 0.5
      raiseProb += 0.15
    } else if (avgOppStrength <= 2500) {
      // 对手可能是弱牌
      foldProb += 0.15
      raiseProb *= 0.5
    }
    
    // 归一化
    const total = foldProb + callProb + raiseProb
    return {
      foldProb: foldProb / total,
      callProb: callProb / total,
      raiseProb: raiseProb / total
    }
  }
  
  /**
   * 蒙特卡洛模拟计算胜率
   * @param {number} myWeight - 我的牌力权重
   * @param {Object} opponentRange - 对手范围 { minWeight, maxWeight }
   * @param {number} simulations - 模拟次数
   * @returns {number} - 胜率 (0-1)
   */
  monteCarloWinRate(myWeight, opponentRange, simulations = 1000) {
    let wins = 0
    const { minWeight, maxWeight } = opponentRange
    
    // 获取范围内的牌型分布
    const distribution = this.getHandDistributionInRange(minWeight, maxWeight)
    
    for (let i = 0; i < simulations; i++) {
      // 根据分布随机生成对手牌力
      const oppWeight = this.sampleFromDistribution(distribution)
      if (myWeight > oppWeight) wins++
      else if (myWeight === oppWeight) wins += 0.5  // 平局算半赢
    }
    
    return wins / simulations
  }
  
  /**
   * 获取指定范围内的牌型分布
   */
  getHandDistributionInRange(minWeight, maxWeight) {
    const distribution = []
    
    // 遍历每种牌型
    for (const [type, info] of Object.entries(HAND_TYPES)) {
      const range = WEIGHT_RANGES[type]
      
      // 检查牌型是否在范围内
      if (range.max < minWeight || range.min > maxWeight) continue
      
      // 计算该牌型在范围内的权重区间
      const effectiveMin = Math.max(range.min, minWeight)
      const effectiveMax = Math.min(range.max, maxWeight)
      
      // 计算该牌型在范围内的比例
      const typeRange = range.max - range.min + 1
      const effectiveRange = effectiveMax - effectiveMin + 1
      const ratio = effectiveRange / typeRange
      
      distribution.push({
        type,
        probability: info.probability * ratio,
        minWeight: effectiveMin,
        maxWeight: effectiveMax
      })
    }
    
    // 归一化概率
    const totalProb = distribution.reduce((sum, d) => sum + d.probability, 0)
    if (totalProb > 0) {
      distribution.forEach(d => d.probability /= totalProb)
    }
    
    return distribution
  }
  
  /**
   * 从分布中采样一个牌力值
   */
  sampleFromDistribution(distribution) {
    const rand = Math.random()
    let cumulative = 0
    
    for (const d of distribution) {
      cumulative += d.probability
      if (rand <= cumulative) {
        // 在该牌型范围内均匀采样
        return d.minWeight + Math.random() * (d.maxWeight - d.minWeight)
      }
    }
    
    // 默认返回最后一个
    const last = distribution[distribution.length - 1]
    return last ? last.minWeight : 2000
  }

  /**
   * 根据牌力权重获取牌型
   */
  getHandType(weight) {
    if (weight >= 10000) return 'LEOPARD'
    if (weight >= 7000) return 'STRAIGHT_FLUSH'
    if (weight >= 6000) return 'FLUSH'
    if (weight >= 5000) return 'STRAIGHT'
    if (weight >= 3000) return 'PAIR'
    return 'HIGH_CARD'
  }

  /**
   * 计算比指定牌力强的概率
   * @param {number} weight - 牌力权重
   * @returns {number} - 比该牌力强的概率
   */
  getProbabilityStronger(weight) {
    // 找到最接近的累积概率
    const thresholds = Object.keys(CUMULATIVE_PROB).map(Number).sort((a, b) => a - b)
    
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (weight >= thresholds[i]) {
        const baseProb = CUMULATIVE_PROB[thresholds[i]]
        
        // 在同一牌型内线性插值
        if (i < thresholds.length - 1) {
          const nextThreshold = thresholds[i + 1]
          const nextProb = CUMULATIVE_PROB[nextThreshold]
          const ratio = (weight - thresholds[i]) / (nextThreshold - thresholds[i])
          return baseProb - ratio * (baseProb - nextProb)
        }
        return baseProb
      }
    }
    return 1.0
  }

  /**
   * 计算对单个对手的基础胜率
   * @param {number} myWeight - 我的牌力权重
   * @returns {number} - 胜率 (0-1)
   */
  calculateBaseWinRate(myWeight) {
    // 比我弱的概率 = 1 - 比我强的概率
    const strongerProb = this.getProbabilityStronger(myWeight)
    return 1 - strongerProb
  }

  /**
   * 根据对手行为调整其牌力范围
   * @param {Object} opponentProfile - 对手档案
   * @returns {Object} - 调整后的范围 { minWeight, maxWeight, avgWeight, confidence }
   */
  estimateOpponentRange(opponentProfile) {
    const { player, analysis, sessionBehavior, betPattern } = opponentProfile
    
    // 优先使用贝叶斯更新的范围
    const playerId = player.name || player.id
    if (this.opponentRangeHistory.has(playerId)) {
      const bayesianRange = this.opponentRangeHistory.get(playerId).priorRange
      if (bayesianRange && bayesianRange.confidence > 0.4) {
        // 贝叶斯范围置信度高，直接使用并微调
        let range = { ...bayesianRange }
        
        // 根据对手类型微调
        if (analysis) {
          if (analysis.type === 'rock') {
            range.minWeight = Math.max(range.minWeight, WEIGHT_RANGES.PAIR.min)
          } else if (analysis.type === 'maniac') {
            range.minWeight = Math.min(range.minWeight, 2000)
          }
        }
        
        return range
      }
    }
    
    // 默认范围：全部牌型
    let range = { 
      minWeight: 1000, 
      maxWeight: 10000, 
      avgWeight: 3500,
      confidence: 0.3  // 范围估计的置信度
    }
    
    // 根据是否看牌调整
    if (!player.hasPeeked) {
      // 焖牌：范围较宽，但偏向中等牌力
      range.avgWeight = 3000
      range.confidence = 0.2
    } else {
      // 已看牌：根据下注金额调整
      const betAmount = player.lastBetAmount || 0
      
      if (betAmount >= 50) {
        // 大注：范围收窄到强牌
        range.minWeight = WEIGHT_RANGES.PAIR.min
        range.avgWeight = 6000
        range.confidence = 0.6
      } else if (betAmount >= 30) {
        // 中等注：中等到强牌
        range.minWeight = WEIGHT_RANGES.PAIR.min
        range.avgWeight = 4500
        range.confidence = 0.5
      } else if (betAmount >= 15) {
        // 小注：弱到中等牌
        range.maxWeight = WEIGHT_RANGES.FLUSH.max
        range.avgWeight = 3500
        range.confidence = 0.4
      } else {
        // 极小注：可能是弱牌或陷阱
        range.avgWeight = 3000
        range.confidence = 0.3
      }
    }
    
    // 使用下注模式历史数据精确推断
    if (betPattern && betPattern.totalRecords >= 5) {
      const currentBet = player.lastBetAmount || 0
      const patternEstimate = this.estimateRangeFromBetPattern(betPattern, currentBet)
      if (patternEstimate) {
        // 根据历史数据调整范围
        range.minWeight = Math.max(range.minWeight, patternEstimate.minWeight)
        range.maxWeight = Math.min(range.maxWeight, patternEstimate.maxWeight)
        range.avgWeight = (range.avgWeight + patternEstimate.avgWeight) / 2
        range.confidence = Math.min(0.8, range.confidence + patternEstimate.confidence * 0.3)
      }
    }
    
    // 根据对手类型调整
    if (analysis) {
      switch (analysis.type) {
        case 'rock':
          // 岩石型还在牌局 = 牌力较强
          range.minWeight = Math.max(range.minWeight, WEIGHT_RANGES.PAIR.min + 500)
          range.avgWeight = Math.max(range.avgWeight, 4500)
          range.confidence += 0.1
          break
        case 'maniac':
          // 疯狂型什么牌都打，范围很宽
          range.minWeight = WEIGHT_RANGES.HIGH_CARD.min
          range.avgWeight = Math.min(range.avgWeight, 3500)
          range.confidence -= 0.1  // 疯狂型难以预测
          break
        case 'calling_station':
          // 跟注站范围较宽
          range.avgWeight = Math.min(range.avgWeight + 500, 5000)
          break
        case 'aggressive':
          // 激进型可能在诈唬
          if (analysis.bluffLikelihood > 0.4) {
            range.avgWeight = Math.max(range.avgWeight - 800, 2500)
            range.confidence -= 0.05
          }
          break
      }
    }
    
    // 根据本局行为调整
    if (sessionBehavior) {
      if (sessionBehavior.strongHandLikelihood >= 0.8) {
        // 连续大注，很可能是大牌
        range.minWeight = Math.max(range.minWeight, WEIGHT_RANGES.STRAIGHT.min)
        range.avgWeight = Math.max(range.avgWeight, 6500)
        range.confidence = Math.min(0.85, range.confidence + 0.2)
      } else if (sessionBehavior.strongHandLikelihood >= 0.6) {
        range.minWeight = Math.max(range.minWeight, WEIGHT_RANGES.PAIR.min + 500)
        range.avgWeight = Math.max(range.avgWeight, 5000)
        range.confidence = Math.min(0.75, range.confidence + 0.1)
      }
      
      if (sessionBehavior.isAbnormal && analysis?.bluffLikelihood > 0.3) {
        // 异常行为 + 有诈唬历史 = 可能在诈唬
        range.avgWeight = Math.max(range.avgWeight - 1000, 2000)
        range.confidence -= 0.1
      }
    }
    
    // 确保范围合理
    range.minWeight = Math.max(WEIGHT_RANGES.HIGH_CARD.min, range.minWeight)
    range.maxWeight = Math.min(WEIGHT_RANGES.LEOPARD.max, range.maxWeight)
    range.avgWeight = Math.max(range.minWeight, Math.min(range.maxWeight, range.avgWeight))
    range.confidence = Math.max(0.1, Math.min(0.9, range.confidence))
    
    return range
  }

  /**
   * 根据下注模式历史推断牌力范围
   */
  estimateRangeFromBetPattern(betPattern, currentBet) {
    if (!betPattern || betPattern.totalRecords < 5) return null
    
    const result = {
      minWeight: 1000,
      maxWeight: 10000,
      avgWeight: 3500,
      confidence: 0
    }
    
    // 分析不同下注尺度对应的牌力
    const avgBet = betPattern.avgBetSize || 20
    const betRatio = currentBet / avgBet
    
    if (betRatio >= 2.0) {
      // 下注远超平均 = 很可能是大牌
      result.minWeight = WEIGHT_RANGES.STRAIGHT.min
      result.avgWeight = 6500
      result.confidence = 0.5
    } else if (betRatio >= 1.5) {
      // 下注高于平均
      result.minWeight = WEIGHT_RANGES.PAIR.min
      result.avgWeight = 5000
      result.confidence = 0.4
    } else if (betRatio <= 0.5) {
      // 下注远低于平均 = 可能是弱牌或陷阱
      result.maxWeight = WEIGHT_RANGES.FLUSH.max
      result.avgWeight = 3000
      result.confidence = 0.3
    }
    
    // 使用历史开牌数据调整
    if (betPattern.showdownData && betPattern.showdownData.length >= 3) {
      // 找到类似下注尺度的历史开牌
      const similarBets = betPattern.showdownData.filter(d => {
        const ratio = d.betSize / avgBet
        return Math.abs(ratio - betRatio) < 0.3
      })
      
      if (similarBets.length >= 2) {
        const avgStrength = similarBets.reduce((sum, d) => sum + d.handStrength, 0) / similarBets.length
        result.avgWeight = avgStrength
        result.confidence += 0.2
      }
    }
    
    return result
  }

  /**
   * 计算对单个对手的胜率（考虑对手范围和置信度）
   * @param {number} myWeight - 我的牌力权重
   * @param {Object} opponentProfile - 对手档案
   * @returns {number} - 胜率 (0-1)
   */
  calculateWinRateVsOpponent(myWeight, opponentProfile) {
    const range = this.estimateOpponentRange(opponentProfile)
    
    // 边界情况
    if (myWeight >= range.maxWeight) {
      return 0.95
    }
    if (myWeight <= range.minWeight) {
      return 0.05
    }
    
    // 计算范围宽度（用于调整不确定性）
    const rangeWidth = range.maxWeight - range.minWeight
    
    // 高置信度时使用蒙特卡洛模拟获得更精确的胜率
    let winRate
    if (range.confidence >= 0.5 && rangeWidth < 5000) {
      // 范围较窄且置信度高，使用蒙特卡洛模拟
      winRate = this.monteCarloWinRate(myWeight, range, 500)
    } else {
      // 否则使用混合方法
      // 方法1：使用平均牌力的 Sigmoid
      const strengthDiff = myWeight - range.avgWeight
      const winRateByAvg = 1 / (1 + Math.exp(-strengthDiff / 800))
      
      // 方法2：基于范围位置的线性计算
      const positionInRange = (myWeight - range.minWeight) / rangeWidth
      const winRateByRange = positionInRange
      
      // 根据置信度混合两种方法
      winRate = range.confidence * winRateByRange + (1 - range.confidence) * winRateByAvg
      
      // 范围越宽，不确定性越大，向 50% 回归
      if (rangeWidth > 6000) {
        winRate = winRate * 0.7 + 0.5 * 0.3
      }
    }
    
    // 根据对手诈唬可能性调整
    const bluffBonus = (opponentProfile.analysis?.bluffLikelihood || 0.3) * 0.08
    winRate += bluffBonus
    
    // 根据对手倾斜状态调整
    const tiltBonus = (opponentProfile.analysis?.tiltLevel || 0) * 0.05
    winRate += tiltBonus
    
    return Math.max(0.05, Math.min(0.95, winRate))
  }

  /**
   * 计算多人底池胜率
   * @param {number} myWeight - 我的牌力权重
   * @param {Array} opponentProfiles - 所有对手档案
   * @returns {Object} - { winRate, bestTarget, worstThreat, eliminationOrder }
   */
  calculateMultiwayWinRate(myWeight, opponentProfiles) {
    if (opponentProfiles.length === 0) {
      return { winRate: 1.0, bestTarget: null, worstThreat: null }
    }
    
    // 计算对每个对手的胜率
    const vsEach = opponentProfiles.map(opp => ({
      opponent: opp,
      winRate: this.calculateWinRateVsOpponent(myWeight, opp),
      range: this.estimateOpponentRange(opp),
      // 计算开牌优先级分数（胜率高 + 筹码少 = 优先开牌）
      showdownPriority: this.calculateShowdownPriority(myWeight, opp)
    }))
    
    // 多人底池胜率 = 对所有对手都赢的概率（简化为乘积）
    let totalWinRate = 1.0
    for (const vs of vsEach) {
      totalWinRate *= vs.winRate
    }
    
    // 找出最佳开牌目标（综合胜率和优先级）
    const bestTarget = vsEach.reduce((best, curr) => 
      curr.showdownPriority > best.showdownPriority ? curr : best
    )
    
    // 找出最大威胁（胜率最低的对手）
    const worstThreat = vsEach.reduce((worst, curr) => 
      curr.winRate < worst.winRate ? curr : worst
    )
    
    // 计算建议的淘汰顺序（按开牌优先级排序）
    const eliminationOrder = [...vsEach]
      .sort((a, b) => b.showdownPriority - a.showdownPriority)
      .map(v => v.opponent)
    
    return {
      winRate: totalWinRate,
      vsEach,
      bestTarget: bestTarget.opponent,
      bestTargetWinRate: bestTarget.winRate,
      worstThreat: worstThreat.opponent,
      worstThreatWinRate: worstThreat.winRate,
      eliminationOrder
    }
  }

  /**
   * 计算开牌优先级分数
   * 综合考虑：胜率、对手筹码、对手威胁程度
   */
  calculateShowdownPriority(myWeight, opponentProfile) {
    const winRate = this.calculateWinRateVsOpponent(myWeight, opponentProfile)
    const player = opponentProfile.player
    const analysis = opponentProfile.analysis || {}
    
    let priority = winRate * 100  // 基础分：胜率
    
    // 筹码少的对手优先开（容易淘汰）
    const chips = player.chips || 100
    if (chips < 50) priority += 20
    else if (chips < 100) priority += 10
    else if (chips > 300) priority -= 10
    
    // 威胁程度低的优先开
    const danger = analysis.dangerLevel || 0.5
    priority += (1 - danger) * 15
    
    // 诈唬可能性高的优先开（可能是弱牌）
    const bluffLikelihood = analysis.bluffLikelihood || 0.3
    priority += bluffLikelihood * 10
    
    // 倾斜状态的优先开（决策质量下降）
    const tiltLevel = analysis.tiltLevel || 0
    priority += tiltLevel * 10
    
    return priority
  }

  /**
   * 计算开牌 EV（期望值）
   * @param {number} myWeight - 我的牌力权重
   * @param {Object} targetProfile - 开牌目标
   * @param {number} potSize - 当前底池
   * @param {number} showdownCost - 开牌成本
   * @returns {Object} - { ev, winRate, shouldShowdown }
   */
  calculateShowdownEV(myWeight, targetProfile, potSize, showdownCost) {
    const winRate = this.calculateWinRateVsOpponent(myWeight, targetProfile)
    const range = this.estimateOpponentRange(targetProfile)
    
    // EV = 胜率 * 底池 - 败率 * 开牌成本
    const ev = winRate * potSize - (1 - winRate) * showdownCost
    
    // 根据置信度调整开牌阈值
    // 置信度高时，可以在胜率稍低时开牌
    // 置信度低时，需要更高胜率才开牌
    const winRateThreshold = 0.5 + (1 - range.confidence) * 0.1
    const shouldShowdown = ev > 0 && winRate > winRateThreshold
    
    return {
      ev,
      winRate,
      shouldShowdown,
      evPerChip: showdownCost > 0 ? ev / showdownCost : 0,
      confidence: range.confidence
    }
  }

  /**
   * 计算继续下注 vs 开牌的 EV 对比
   * @param {number} myWeight - 我的牌力权重
   * @param {Array} opponentProfiles - 所有对手档案
   * @param {number} potSize - 当前底池
   * @param {number} showdownCost - 开牌成本
   * @param {number} betAmount - 如果继续下注的金额
   * @returns {Object} - 决策建议
   */
  compareBetVsShowdown(myWeight, opponentProfiles, potSize, showdownCost, betAmount) {
    const multiway = this.calculateMultiwayWinRate(myWeight, opponentProfiles)
    
    // 开牌 EV（选最佳目标）
    const showdownEV = this.calculateShowdownEV(
      myWeight, 
      multiway.bestTarget, 
      potSize, 
      showdownCost
    )
    
    // 继续下注 EV（简化计算）
    // 假设对手有 foldPressure 概率弃牌
    const avgFoldPressure = opponentProfiles.reduce(
      (sum, o) => sum + (o.analysis?.foldPressure || 0.5), 0
    ) / opponentProfiles.length
    
    // 计算下注后各种情况的 EV
    // 情况1：所有对手弃牌 = 赢得当前底池
    const allFoldProb = Math.pow(avgFoldPressure, opponentProfiles.length)
    const allFoldEV = allFoldProb * potSize
    
    // 情况2：部分对手跟注
    // 简化：假设平均有一半对手跟注
    const avgCallCount = opponentProfiles.length * (1 - avgFoldPressure)
    const newPot = potSize + betAmount * (1 + avgCallCount)
    const partialCallEV = (1 - allFoldProb) * (multiway.winRate * newPot - (1 - multiway.winRate) * betAmount)
    
    const betEV = allFoldEV + partialCallEV
    
    // 计算弃牌 EV（放弃当前投入）
    const foldEV = 0
    
    // 综合建议
    let recommendation = 'bet'
    let reasoning = ''
    
    if (showdownEV.ev > betEV && showdownEV.shouldShowdown) {
      recommendation = 'showdown'
      reasoning = `开牌EV(${showdownEV.ev.toFixed(1)}) > 下注EV(${betEV.toFixed(1)})`
    } else if (betEV < 0 && showdownEV.ev < 0) {
      // 两个选项都是负 EV
      if (showdownEV.ev > betEV) {
        recommendation = 'showdown'
        reasoning = '两者都是负EV，开牌损失更小'
      } else {
        recommendation = 'fold_or_check'
        reasoning = '两者都是负EV，考虑弃牌或过牌'
      }
    }
    
    return {
      showdownEV: showdownEV.ev,
      showdownWinRate: showdownEV.winRate,
      showdownConfidence: showdownEV.confidence,
      betEV,
      foldEV,
      allFoldProb,
      recommendation,
      reasoning,
      bestTarget: multiway.bestTarget,
      worstThreat: multiway.worstThreat,
      eliminationOrder: multiway.eliminationOrder
    }
  }
}
