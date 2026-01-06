/**
 * 开牌处理器
 * 处理开牌比牌逻辑
 */
import { getLastActiveBetAmount } from './BettingHandler.js'

/**
 * 处理开牌
 */
export function handleShowdown(engine, challenger, targetSeatIndex) {
  // 第一轮不能开牌
  if (!engine.state.firstRoundComplete) {
    return { success: false, error: '第一轮不能开牌' }
  }
  
  const target = engine.seats[targetSeatIndex]
  if (!target || target.folded) {
    return { success: false, error: '目标玩家无效' }
  }
  if (targetSeatIndex === challenger.id) {
    return { success: false, error: '不能和自己开牌' }
  }

  // 开牌费用
  const showdownCost = getLastActiveBetAmount(engine, challenger.id)
  if (challenger.chips < showdownCost) {
    return { success: false, error: '筹码不足，需要' + showdownCost }
  }

  // 扣除开牌费用
  challenger.chips -= showdownCost
  challenger.currentBet += showdownCost
  challenger.lastBetAmount = showdownCost
  engine.state.pot += showdownCost
  challenger.hasActed = true

  // 比较牌型
  const challengerHand = challenger.hand.getType()
  const targetHand = target.hand.getType()
  
  const { winner, loser } = compareHands(challenger, target, challengerHand, targetHand)
  
  loser.fold()
  loser.lostShowdown = true
  loser.showdownBy = challenger.id
  loser.hasActed = true
  
  // 如果赢家是焖牌状态，开牌后自动变为已看牌
  if (!winner.hasPeeked) {
    winner.hasPeeked = true
    winner.forcePeekedByShowdown = true
  }
  
  // 记录开牌双方关系
  challenger.showdownWith = Number(targetSeatIndex)
  target.showdownWith = Number(challenger.id)
  console.log(`📋 开牌关系: challenger(${challenger.id}).showdownWith=${targetSeatIndex}, target(${targetSeatIndex}).showdownWith=${challenger.id}`)

  // 记录开牌结果
  engine.state.showdownResult = {
    challengerIndex: challenger.id,
    challengerName: challenger.name,
    targetIndex: targetSeatIndex,
    targetName: target.name,
    winnerIndex: winner.id,
    winnerName: winner.name,
    loserIndex: loser.id,
    loserName: loser.name,
    challengerHand,
    targetHand
  }

  // 检查游戏是否结束
  const active = engine.getActivePlayers()
  if (active.length <= 1) {
    const endResult = engine.endGame()
    endResult.challengerHand = challengerHand
    endResult.targetHand = targetHand
    endResult.winnerSeatIndex = winner.id
    endResult.loserSeatIndex = loser.id
    endResult.targetSeatIndex = targetSeatIndex
    return endResult
  }

  return {
    success: true,
    action: 'showdown',
    seatIndex: challenger.id,
    targetSeatIndex,
    winnerSeatIndex: winner.id,
    winnerName: winner.name,
    loserSeatIndex: loser.id,
    loserName: loser.name,
    cost: showdownCost,
    challengerHand,
    targetHand,
    targetCards: target.hand.toJSON(),
    winnerCards: winner.hand.toJSON(),
    winnerForcePeeked: winner.forcePeekedByShowdown || false
  }
}

/**
 * 比较两个玩家的牌型
 */
function compareHands(challenger, target, challengerHand, targetHand) {
  if (challengerHand.weight > targetHand.weight) {
    return { winner: challenger, loser: target }
  } else if (challengerHand.weight < targetHand.weight) {
    return { winner: target, loser: challenger }
  } else {
    // 牌型相同，挑战者输（诈金花规则）
    return { winner: target, loser: challenger }
  }
}
