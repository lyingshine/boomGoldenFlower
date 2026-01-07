/**
 * AI 手牌评估器
 * 负责评估手牌强度、计算胜率、位置优势等
 */

export class AIHandEvaluator {
  
  // 评估牌力等级
  evaluateHandStrength(strength, playerCount, position = 'middle', thresholdAdjusts = {}) {
    // 位置调整：后位可以放宽标准，前位要收紧
    let positionAdjust = 0
    if (position === 'late') positionAdjust = -500
    else if (position === 'early') positionAdjust = 500
    
    const monsterAdj = positionAdjust + (thresholdAdjusts.monsterThresholdAdjust || 0)
    const strongAdj = positionAdjust + (thresholdAdjusts.strongThresholdAdjust || 0)
    const mediumAdj = positionAdjust + (thresholdAdjusts.mediumThresholdAdjust || 0)
    
    if (playerCount <= 3) {
      return {
        isMonster: strength >= 7000 + monsterAdj,
        isStrong: strength >= 5000 + strongAdj,
        isMedium: strength >= 3000 + mediumAdj,
        isWeak: strength < 3000 + mediumAdj
      }
    }
    
    if (playerCount <= 5) {
      return {
        isMonster: strength >= 8000 + monsterAdj,
        isStrong: strength >= 6000 + strongAdj,
        isMedium: strength >= 4000 + mediumAdj,
        isWeak: strength < 4000 + mediumAdj
      }
    }
    
    return {
      isMonster: strength >= 9000 + monsterAdj,
      isStrong: strength >= 7000 + strongAdj,
      isMedium: strength >= 5000 + mediumAdj,
      isWeak: strength < 5000 + mediumAdj
    }
  }

  // 计算胜率
  calculateWinProbability(myStrength, targetProfile, playerCount = 2) {
    const oppEstimatedStrength = targetProfile.estimatedStrength
    const bluffLikelihood = targetProfile.analysis.bluffLikelihood
    const tiltLevel = targetProfile.analysis.tiltLevel || 0
    
    // 将对手估计强度(0-1)转换为牌力值(1000-10000)
    const oppStrengthValue = 1000 + oppEstimatedStrength * 9000
    
    // 基于牌力差距计算胜率（sigmoid函数）
    const strengthDiff = myStrength - oppStrengthValue
    let baseWinProb = 1 / (1 + Math.exp(-strengthDiff / 1000))
    
    // 诈唬可能性加成
    const bluffBonus = bluffLikelihood * 0.1
    
    // 倾斜加成
    const tiltBonus = tiltLevel * 0.05
    
    // 多人底池折扣
    const multiWayDiscount = Math.pow(0.9, playerCount - 2)
    
    let winProb = baseWinProb * multiWayDiscount + bluffBonus + tiltBonus
    
    // 根据对手类型微调
    const oppType = targetProfile.analysis.type
    if (oppType === 'rock') {
      winProb *= 0.8
    } else if (oppType === 'maniac') {
      winProb *= 1.05
    }
    
    return Math.max(0.05, Math.min(0.95, winProb))
  }

  // 计算位置优势
  calculatePosition(seatIndex, activePlayers) {
    const totalActive = activePlayers.length + 1
    if (totalActive <= 1) return 'late'
    
    const activeSeats = [seatIndex, ...activePlayers.map(p => p.id)].sort((a, b) => a - b)
    const myPosition = activeSeats.indexOf(seatIndex)
    const positionRatio = myPosition / (totalActive - 1)
    
    if (positionRatio <= 0.33) return 'early'
    if (positionRatio <= 0.66) return 'middle'
    return 'late'
  }

  // 计算筹码深度
  calculateStackDepth(player, activePlayers, ante = 10) {
    const effectiveStack = player.chips
    const bigBlinds = effectiveStack / ante
    
    const oppChips = activePlayers.map(p => p.chips)
    const avgOppChips = oppChips.length > 0 
      ? oppChips.reduce((a, b) => a + b, 0) / oppChips.length 
      : effectiveStack
    const relativeStack = effectiveStack / Math.max(avgOppChips, 1)
    
    return {
      absolute: bigBlinds,
      relative: relativeStack,
      isShort: bigBlinds < 15,
      isDeep: bigBlinds > 50,
      isCovered: relativeStack < 0.7,
      covers: relativeStack > 1.5
    }
  }

  // 计算底池赔率
  calculatePotOdds(callAmount, potSize) {
    if (callAmount <= 0) return 0
    return callAmount / (potSize + callAmount)
  }

  // 判断是否有正期望值
  hasPositiveEV(winProb, potOdds) {
    return winProb > potOdds
  }

  // 计算隐含赔率
  calculateImpliedOdds(callAmount, potSize, opponentChips, winProb) {
    const potOdds = this.calculatePotOdds(callAmount, potSize)
    
    const avgOpponentChips = opponentChips.reduce((a, b) => a + b, 0) / Math.max(opponentChips.length, 1)
    const impliedWinnings = avgOpponentChips * winProb * 0.3
    
    const impliedPotOdds = callAmount / (potSize + callAmount + impliedWinnings)
    
    return impliedPotOdds
  }

  // 计算回合压力
  calculateRoundPressure(round) {
    if (round <= 2) return 0
    if (round <= 4) return 0.2
    if (round <= 6) return 0.4
    return 0.6
  }

  // 多人底池调整系数
  calculateMultiwayAdjustment(playerCount) {
    if (playerCount <= 2) return { strengthMultiplier: 1, bluffMultiplier: 1, foldMultiplier: 1 }
    if (playerCount === 3) return { strengthMultiplier: 1.1, bluffMultiplier: 0.7, foldMultiplier: 1.15 }
    if (playerCount === 4) return { strengthMultiplier: 1.2, bluffMultiplier: 0.5, foldMultiplier: 1.25 }
    return { strengthMultiplier: 1.3, bluffMultiplier: 0.3, foldMultiplier: 1.35 }
  }
}
