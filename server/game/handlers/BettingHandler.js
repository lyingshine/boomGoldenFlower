/**
 * 下注处理器
 * 处理 call/raise/blind/showdown 等下注相关操作
 */

/**
 * @typedef {import('../GameEngine.js').GameEngine} GameEngine
 * @typedef {import('../../models/Player.js').Player} Player
 */

/**
 * @typedef {Object} BetResult
 * @property {boolean} success - 是否成功
 * @property {string} [action] - 操作类型
 * @property {number} [seatIndex] - 座位索引
 * @property {number} [amount] - 金额
 * @property {number} [newChips] - 新筹码数
 * @property {number} [newBet] - 新下注额
 * @property {string} [error] - 错误信息
 */

/**
 * 获取跟注金额（考虑双方是否看牌）
 * @param {GameEngine} engine - 游戏引擎
 * @param {Player} player - 玩家
 * @returns {number}
 */
export function getCallAmountForPlayer(engine, player) {
  const lastInfo = getLastBettingPlayerInfo(engine, player.id)
  if (!lastInfo) return engine.state.currentBet
  
  const iBlind = !player.hasPeeked
  const lastBlind = lastInfo.lastBetBlind
  
  // 焖牌规则
  if (iBlind && !lastBlind) {
    return Math.ceil(lastInfo.lastBetAmount / 2)
  } else if (!iBlind && lastBlind) {
    return lastInfo.lastBetAmount * 2
  }
  return lastInfo.lastBetAmount
}

/**
 * 获取最近一个下注玩家的信息
 * @param {GameEngine} engine - 游戏引擎
 * @param {number} currentSeatIndex - 当前座位索引
 * @returns {{lastBetAmount: number, lastBetBlind: boolean}}
 */
export function getLastBettingPlayerInfo(engine, currentSeatIndex) {
  let index = currentSeatIndex
  for (let i = 0; i < 8; i++) {
    index = (index - 1 + 8) % 8
    const player = engine.seats[index]
    if (player && !player.folded && player.lastBetAmount > 0) {
      return {
        lastBetAmount: player.lastBetAmount,
        lastBetBlind: player.lastBetBlind || false
      }
    }
  }
  return { lastBetAmount: engine.state.currentBet, lastBetBlind: false }
}

/**
 * 获取上一个未弃牌玩家这一手的下注金额
 * @param {GameEngine} engine - 游戏引擎
 * @param {number} currentSeatIndex - 当前座位索引
 * @returns {number}
 */
export function getLastActiveBetAmount(engine, currentSeatIndex) {
  let index = currentSeatIndex
  for (let i = 0; i < 8; i++) {
    index = (index - 1 + 8) % 8
    const player = engine.seats[index]
    if (player && !player.folded) {
      return player.lastBetAmount || engine.state.currentBet
    }
  }
  return engine.state.currentBet
}

/**
 * 处理跟注
 * @param {GameEngine} engine - 游戏引擎
 * @param {Player} player - 玩家
 * @returns {BetResult}
 */
export function handleCall(engine, player) {
  const callAmount = getCallAmountForPlayer(engine, player)
  
  if (callAmount <= 0) {
    return { success: false, error: '跟注金额无效' }
  }
  
  if (player.chips < callAmount) {
    // 筹码不足，全押
    const allInAmount = player.chips
    player.chips = 0
    player.currentBet += allInAmount
    player.lastBetAmount = allInAmount
    player.isAllIn = true
    engine.state.pot += allInAmount
    player.hasActed = true
    return {
      success: true,
      action: 'allin',
      seatIndex: player.id,
      amount: allInAmount,
      newChips: 0
    }
  }

  player.chips -= callAmount
  player.currentBet += callAmount
  player.lastBetAmount = callAmount
  player.lastBetBlind = false
  engine.state.pot += callAmount
  player.hasActed = true

  return {
    success: true,
    action: 'call',
    seatIndex: player.id,
    amount: callAmount,
    newChips: player.chips
  }
}

/**
 * 处理加注
 * @param {GameEngine} engine - 游戏引擎
 * @param {Player} player - 玩家
 * @param {number} raiseAmount - 加注金额
 * @returns {BetResult}
 */
export function handleRaise(engine, player, raiseAmount) {
  const baseAmount = getCallAmountForPlayer(engine, player)
  const totalAmount = baseAmount + raiseAmount

  if (player.chips < totalAmount) {
    return { success: false, error: '筹码不足' }
  }

  player.chips -= totalAmount
  player.currentBet += totalAmount
  player.lastBetAmount = totalAmount
  player.lastBetBlind = false
  engine.state.pot += totalAmount
  engine.state.currentBet = player.currentBet

  engine.seats.forEach(p => {
    if (p && !p.folded && p.id !== player.id && !p.isAllIn) {
      p.hasActed = false
    }
  })
  player.hasActed = true

  return {
    success: true,
    action: player.isAllIn ? 'allin' : 'raise',
    seatIndex: player.id,
    amount: totalAmount,
    newBet: engine.state.currentBet,
    newChips: player.chips
  }
}

/**
 * 处理焖牌
 * @param {GameEngine} engine - 游戏引擎
 * @param {Player} player - 玩家
 * @param {number} blindAmount - 焖牌金额
 * @returns {BetResult}
 */
export function handleBlind(engine, player, blindAmount) {
  if (player.hasPeeked) {
    return { success: false, error: '已看牌不能焖牌' }
  }
  
  const minAmount = getCallAmountForPlayer(engine, player)
  if (blindAmount < minAmount) {
    return { success: false, error: '焖牌金额不能低于' + minAmount }
  }

  if (player.chips < blindAmount) {
    return { success: false, error: '筹码不足' }
  }

  player.chips -= blindAmount
  player.currentBet += blindAmount
  player.lastBetAmount = blindAmount
  player.lastBetBlind = true
  engine.state.pot += blindAmount
  player.hasActed = true

  return {
    success: true,
    action: 'blind',
    seatIndex: player.id,
    amount: blindAmount,
    newChips: player.chips
  }
}
