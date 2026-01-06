/**
 * 游戏状态计算属性
 */

/**
 * 获取最近一个下注玩家的信息
 * @param {Array} seats - 座位数组
 * @param {number} mySeatIndex - 我的座位索引
 * @param {number} currentBet - 当前下注额
 */
export function getLastBettingPlayerInfo(seats, mySeatIndex, currentBet) {
  let index = mySeatIndex
  for (let i = 0; i < 8; i++) {
    index = (index - 1 + 8) % 8
    const player = seats[index]
    if (player && !player.folded && player.lastBetAmount > 0) {
      return {
        lastBetAmount: player.lastBetAmount,
        lastBetBlind: player.lastBetBlind || false
      }
    }
  }
  return { lastBetAmount: currentBet, lastBetBlind: false }
}

/**
 * 获取跟注金额
 */
export function getCallAmount(seats, mySeatIndex, currentBet) {
  const me = seats[mySeatIndex]
  if (!me) return currentBet
  
  const lastInfo = getLastBettingPlayerInfo(seats, mySeatIndex, currentBet)
  const iBlind = !me.hasPeeked
  const lastBlind = lastInfo.lastBetBlind
  
  if (iBlind && !lastBlind) {
    return Math.ceil(lastInfo.lastBetAmount / 2)
  } else if (!iBlind && lastBlind) {
    return lastInfo.lastBetAmount * 2
  }
  return lastInfo.lastBetAmount
}

/**
 * 判断是否可以跟注
 */
export function canCall(seats, mySeatIndex, currentPlayerIndex, currentBet) {
  const me = seats[mySeatIndex]
  if (!me || me.folded || mySeatIndex !== currentPlayerIndex) return false
  const callAmount = getCallAmount(seats, mySeatIndex, currentBet)
  return me.chips > 0 && callAmount > 0
}

/**
 * 判断是否可以加注
 */
export function canRaise(seats, mySeatIndex, currentPlayerIndex, currentBet) {
  const me = seats[mySeatIndex]
  if (!me || me.folded || mySeatIndex !== currentPlayerIndex) return false
  const callAmount = getCallAmount(seats, mySeatIndex, currentBet)
  return me.chips > callAmount + 20
}

/**
 * 判断是否可以焖牌
 */
export function canBlind(seats, mySeatIndex, currentPlayerIndex, currentBet) {
  const me = seats[mySeatIndex]
  if (!me || me.folded || mySeatIndex !== currentPlayerIndex || me.hasPeeked) return false
  const minAmount = getCallAmount(seats, mySeatIndex, currentBet)
  return me.chips >= minAmount
}

/**
 * 判断是否可以开牌
 */
export function canShowdown(seats, mySeatIndex, currentPlayerIndex, currentBet, firstRoundComplete) {
  if (!firstRoundComplete) return false
  const me = seats[mySeatIndex]
  if (!me || me.folded || mySeatIndex !== currentPlayerIndex) return false
  const showdownCost = getCallAmount(seats, mySeatIndex, currentBet)
  return me.chips >= showdownCost
}

/**
 * 获取可开牌的对手列表
 */
export function getShowdownTargets(seats, mySeatIndex) {
  return seats.filter((p, i) => p && !p.folded && i !== mySeatIndex)
}

/**
 * 获取游戏状态描述
 */
export function getStatusMessage(phase, winner) {
  switch (phase) {
    case 'waiting': return '等待开始游戏'
    case 'dealing': return '正在发牌...'
    case 'betting': return '下注阶段'
    case 'showdown': return '开牌比较'
    case 'ended': return winner ? `${winner.name} 获胜` : '游戏结束'
    default: return '游戏进行中'
  }
}
