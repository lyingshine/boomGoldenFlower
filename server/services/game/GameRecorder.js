/**
 * 游戏记录器
 * 处理玩家行为记录、战绩更新等
 */
import { getUsersCache, saveUserData } from '../UserService.js'
import { recordAIGame, recordShowdownForCalibration, updateAIPlayerStrategy } from '../../db/mysql.js'
import { savePlayerShowdownRecord } from '../../db/aiRepository.js'

// 记录玩家行为到档案
export function recordPlayerBehavior(room, seatIndex, action, amount, result) {
  const player = room.game.seats[seatIndex]
  if (!player || player.type !== 'human') return
  
  const updates = {}
  const round = room.game.state.round || 1
  
  if (action === 'fold') {
    updates.foldCount = 1
    if (!room.game.state.firstRoundComplete) {
      updates.earlyFoldCount = 1
    } else {
      updates.lateFoldCount = 1
    }
  }
  
  if (action === 'raise') {
    updates.raiseCount = 1
    updates.pressureAttempts = 1  // 每次加注都是施压尝试
    if (amount <= 20) {
      updates.smallRaiseCount = 1
    } else {
      updates.bigRaiseCount = 1
    }
    updates.betSize = amount
  }
  
  if (action === 'call') {
    updates.callCount = 1
    if (result.amount) updates.betSize = result.amount
  }
  
  if (action === 'blind') {
    updates.blindBetCount = 1
    updates.betSize = amount
    const callAmount = room.game.getCallAmountForPlayer(player)
    if (amount > callAmount) {
      updates.raiseCount = 1
      if (amount - callAmount > 20) {
        updates.bigRaiseCount = 1
      } else {
        updates.smallRaiseCount = 1
      }
    }
  }
  
  if (action === 'peek') updates.peekRound = round
  if (action === 'showdown') updates.showdownInitiated = 1
  
  if (Object.keys(updates).length > 0) {
    room.updatePlayerProfile(player.name, updates)
  }
}


// 记录开牌结果
export function recordShowdownResult(room, seatIndex, result) {
  const game = room.game
  const winner = game.seats[result.winnerSeatIndex]
  const loser = game.seats[result.loserSeatIndex]
  const target = game.seats[result.targetSeatIndex]
  
  if (target?.type === 'human') {
    room.updatePlayerProfile(target.name, { showdownReceived: 1 })
  }
  
  if (winner?.type === 'human') {
    room.updatePlayerProfile(winner.name, { showdownWins: 1 })
  }
  
  if (loser?.type === 'human') {
    room.updatePlayerProfile(loser.name, { showdownLosses: 1 })
    
    const loserHand = result.loserSeatIndex === seatIndex ? result.challengerHand : result.targetHand
    if (loserHand) {
      const isWeakHand = loserHand.weight < 3500
      const totalBet = loser.currentBet || 0
      if (isWeakHand && totalBet > 30) {
        room.updatePlayerProfile(loser.name, { bluffCaught: 1 })
        console.log(`🎭 诈唬被抓: ${loser.name}`)
      }
    }
  }
  
  // 记录牌力校准数据
  const { challengerHand, targetHand } = result
  if (challengerHand && targetHand) {
    const challengerWon = result.winnerSeatIndex === seatIndex
    recordShowdownForCalibration(challengerHand.type, challengerHand.weight, challengerWon, targetHand.weight)
      .catch(e => console.error('记录牌力校准失败:', e.message))
    recordShowdownForCalibration(targetHand.type, targetHand.weight, !challengerWon, challengerHand.weight)
      .catch(e => console.error('记录牌力校准失败:', e.message))
    
    // 记录玩家开牌下注模式（用于 AI 分析）
    const challenger = game.seats[seatIndex]
    const target = game.seats[result.targetSeatIndex]
    
    // 记录挑战者的下注模式
    if (challenger?.type === 'human') {
      const profile = room.playerProfiles?.get(challenger.name)
      const avgBet = profile?.avgBetSize || 20
      const betIntensity = avgBet > 0 ? challenger.currentBet / avgBet : 1
      savePlayerShowdownRecord(challenger.name, {
        handType: challengerHand.type,
        handWeight: challengerHand.weight,
        betIntensity,
        totalBet: challenger.currentBet,
        avgBet,
        won: challengerWon
      }).catch(e => console.error('记录玩家开牌数据失败:', e.message))
    }
    
    // 记录被开牌者的下注模式
    if (target?.type === 'human') {
      const profile = room.playerProfiles?.get(target.name)
      const avgBet = profile?.avgBetSize || 20
      const betIntensity = avgBet > 0 ? target.currentBet / avgBet : 1
      savePlayerShowdownRecord(target.name, {
        handType: targetHand.type,
        handWeight: targetHand.weight,
        betIntensity,
        totalBet: target.currentBet,
        avgBet,
        won: !challengerWon
      }).catch(e => console.error('记录玩家开牌数据失败:', e.message))
    }
  }
  
  // AI 开牌时记录策略
  const challenger = game.seats[seatIndex]
  const showdownTarget = game.seats[result.targetSeatIndex]
  if (challenger?.type === 'ai' && showdownTarget) {
    const playerProfile = room.playerProfiles?.get(showdownTarget.name)
    updateAIPlayerStrategy(challenger.name, showdownTarget.name, {
      playerType: getPlayerTypeFromProfile(playerProfile),
      bluffTendency: playerProfile ? (playerProfile.bluffCaught / Math.max(playerProfile.totalHands, 1)) : 0.5,
      aggressionLevel: playerProfile ? (playerProfile.raiseCount / Math.max(playerProfile.totalHands, 1)) : 0.5,
      foldThreshold: playerProfile ? (playerProfile.foldCount / Math.max(playerProfile.totalHands, 1)) : 0.5,
      recommendedStrategy: generateStrategyRecommendation(playerProfile),
      won: result.winnerSeatIndex === seatIndex
    }).catch(e => console.error('更新 AI 策略失败:', e.message))
  }
}


// 更新用户战绩
export function updateUsersGameStats(room, result) {
  const usersCache = getUsersCache()
  const winnerSeatIndex = result.winner?.seatIndex
  const pot = room.game.state.pot || 0
  
  room.game.seats.forEach((player, seatIndex) => {
    if (!player) return
    
    const isWinner = seatIndex === winnerSeatIndex
    
    // AI 玩家记录对局
    if (player.type === 'ai') {
      const handType = player.hand?.getType()
      recordAIGame({
        aiName: player.name,
        opponentName: result.winner?.name || 'unknown',
        roomCode: room.roomCode,
        handType: handType?.name,
        handWeight: handType?.weight,
        actionTaken: player.folded ? 'fold' : 'showdown',
        result: isWinner ? 'win' : 'lose',
        chipsWon: isWinner ? pot : -player.currentBet,
        roundCount: room.game.state.round || 1
      }).catch(e => console.error('记录AI对局失败:', e.message))
    }
    
    // 人类玩家更新战绩
    if (player.type === 'human') {
      const playerName = player.name
      if (!playerName || !usersCache[playerName]) return
      
      usersCache[playerName].totalGames = (usersCache[playerName].totalGames || 0) + 1
      
      const profileUpdates = { totalHands: 1 }
      if (isWinner) {
        usersCache[playerName].wins = (usersCache[playerName].wins || 0) + 1
        const chipsWon = pot - player.currentBet
        if (chipsWon > 0) {
          profileUpdates.totalChipsWon = chipsWon
          profileUpdates.maxSingleWin = chipsWon
        }
        if (!player.lostShowdown && room.game.getActivePlayers().length === 1) {
          profileUpdates.wonWithoutShowdown = 1
        }
      } else {
        usersCache[playerName].losses = (usersCache[playerName].losses || 0) + 1
        const chipsLost = player.currentBet
        if (chipsLost > 0) {
          profileUpdates.totalChipsLost = chipsLost
          profileUpdates.maxSingleLoss = chipsLost
        }
      }
      
      room.updatePlayerProfile(playerName, profileUpdates)
      saveUserData(playerName).catch(e => console.error(`保存战绩失败 ${playerName}:`, e.message))
    }
  })
}


// 根据档案判断玩家类型
function getPlayerTypeFromProfile(profile) {
  if (!profile || !profile.totalHands) return 'unknown'
  const foldRate = profile.foldCount / profile.totalHands
  const raiseRate = profile.raiseCount / profile.totalHands
  
  if (raiseRate > 0.4) return 'aggressive'
  if (foldRate > 0.5) return 'tight'
  if (raiseRate < 0.15 && foldRate < 0.3) return 'passive'
  return 'balanced'
}

// 生成策略建议
function generateStrategyRecommendation(profile) {
  if (!profile || !profile.totalHands || profile.totalHands < 5) {
    return '数据不足，继续观察'
  }
  
  const foldRate = profile.foldCount / profile.totalHands
  const raiseRate = profile.raiseCount / profile.totalHands
  const bluffRate = profile.bluffCaught / profile.totalHands
  
  const tips = []
  if (foldRate > 0.5) tips.push('容易弃牌，可用激进策略逼退')
  if (raiseRate > 0.4) tips.push('频繁加注，大注时需谨慎判断真假')
  if (bluffRate > 0.15) tips.push('诈唬被抓率高，大注可能是虚张声势')
  if (profile.blindBetCount / profile.totalHands > 0.3) tips.push('喜欢焖牌，难以读牌')
  if (profile.avgPeekRound > 3) tips.push('看牌较晚，可能是焖牌高手')
  
  return tips.length > 0 ? tips.join('；') : '打法均衡，需综合判断'
}


// 记录施压获胜（玩家加注后其他人全弃牌）
export function recordPressureWin(room, result) {
  // 只记录非开牌获胜的情况
  if (result.challengerHand) return  // 开牌获胜不算施压获胜
  
  const winner = room.game.seats[result.winner?.seatIndex]
  if (!winner || winner.type !== 'human') return
  
  // 检查赢家本局是否有加注行为
  const winnerBet = winner.currentBet || 0
  const ante = room.ante || 10
  
  // 如果赢家下注超过底注，说明有施压行为
  if (winnerBet > ante) {
    room.updatePlayerProfile(winner.name, {
      pressureWins: 1
    })
    console.log(`[施压记录] ${winner.name} 施压获胜，下注: ${winnerBet}`)
  }
}
