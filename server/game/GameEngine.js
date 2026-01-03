import { Deck } from '../models/Deck.js'
import { Player } from '../models/Player.js'
import { GameState } from './GameState.js'

/**
 * 游戏引擎 (服务端权威)
 */
export class GameEngine {
  constructor(roomCode) {
    this.roomCode = roomCode
    this.seats = new Array(8).fill(null)
    this.deck = null
    this.state = new GameState()
  }

  addPlayer(seatIndex, name, chips, type = 'human') {
    if (seatIndex < 0 || seatIndex >= 8 || this.seats[seatIndex]) return false
    this.seats[seatIndex] = new Player(seatIndex, name, chips, type)
    return true
  }

  removePlayer(seatIndex) {
    if (this.seats[seatIndex]) {
      this.seats[seatIndex] = null
      return true
    }
    return false
  }

  getActivePlayers() {
    return this.seats.filter(p => p && !p.folded)
  }

  getActionablePlayers() {
    return this.seats.filter(p => p && !p.folded && !p.isAllIn)
  }

  startRound() {
    const players = this.seats.filter(p => p)
    if (players.length < 1) return { success: false, error: '没有玩家' }

    this.deck = new Deck()
    this.state.startRound()
    players.forEach(p => p.reset())

    const dealResult = this.dealCards()
    this.collectAntes()
    this.setFirstPlayer()
    
    // 先设置为发牌阶段，让客户端播放动画
    this.state.setPhase('dealing')

    return { success: true, dealResult, needDealingDelay: true }
  }

  // 发牌动画结束后切换到下注阶段
  finishDealing() {
    this.state.setPhase('betting')
  }

  dealCards() {
    const result = []
    for (let cardIndex = 0; cardIndex < 3; cardIndex++) {
      for (let seatIndex = 0; seatIndex < 8; seatIndex++) {
        const player = this.seats[seatIndex]
        if (player) {
          const card = this.deck.deal()
          player.addCard(card)
          result.push({ seatIndex, cardIndex, card: card.toJSON() })
        }
      }
    }
    return result
  }

  collectAntes() {
    this.seats.forEach(player => {
      if (player && !player.folded) {
        const ante = Math.min(this.state.currentBet, player.chips)
        player.chips -= ante
        player.currentBet = ante
        player.lastBetAmount = ante  // 底注也算本轮下注
        this.state.pot += ante
        if (player.chips === 0) player.isAllIn = true
      }
    })
  }

  setFirstPlayer() {
    for (let i = 0; i < 8; i++) {
      if (this.seats[i] && !this.seats[i].folded) {
        this.state.currentPlayerIndex = i
        break
      }
    }
  }

  handleAction(seatIndex, action, amount = 0) {
    const player = this.seats[seatIndex]
    if (!player) return { success: false, error: '玩家不存在' }
    if (this.state.phase !== 'betting') return { success: false, error: '非下注阶段' }

    if (action === 'peek') {
      player.peek()
      return { success: true, action: 'peek', seatIndex }
    }

    if (action === 'fold') {
      player.fold()
      player.hasActed = true
      const gameEnded = this.checkRoundEnd()
      if (!gameEnded) {
        this.nextPlayer()
      }
      return { success: true, action: 'fold', seatIndex }
    }

    if (seatIndex !== this.state.currentPlayerIndex) {
      return { success: false, error: '不是你的回合' }
    }

    let result
    switch (action) {
      case 'call':
        result = this.handleCall(player)
        break
      case 'raise':
        result = this.handleRaise(player, amount)
        break
      case 'blind':
        result = this.handleBlind(player, amount)
        break
      case 'showdown':
        result = this.handleShowdown(player, amount)
        break
      default:
        return { success: false, error: '未知操作' }
    }

    if (result.success && result.action !== 'gameEnd') {
      this.nextPlayer()
    }

    return result
  }

  // 获取跟注金额（考虑双方是否看牌）
  getCallAmountForPlayer(player) {
    const lastInfo = this.getLastBettingPlayerInfo(player.id)
    if (!lastInfo) return this.state.currentBet
    
    const iBlind = !player.hasPeeked  // 我是否焖牌（未看牌）
    const lastBlind = lastInfo.lastBetBlind  // 上家是否焖牌
    
    // 焖牌规则：
    // 我焖牌，上家看牌：我只需跟一半
    // 我看牌，上家焖牌：我需要跟双倍
    // 双方都焖牌或都看牌：跟同样金额
    if (iBlind && !lastBlind) {
      // 我焖，上家看：跟一半
      return Math.ceil(lastInfo.lastBetAmount / 2)
    } else if (!iBlind && lastBlind) {
      // 我看，上家焖：跟双倍
      return lastInfo.lastBetAmount * 2
    }
    return lastInfo.lastBetAmount
  }

  handleCall(player) {
    // 跟注金额：根据上家是否焖牌计算
    const callAmount = this.getCallAmountForPlayer(player)
    
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
      this.state.pot += allInAmount
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
    this.state.pot += callAmount
    player.hasActed = true

    return {
      success: true,
      action: 'call',
      seatIndex: player.id,
      amount: callAmount,
      newChips: player.chips
    }
  }

  handleRaise(player, raiseAmount) {
    const baseAmount = this.getCallAmountForPlayer(player)
    const totalAmount = baseAmount + raiseAmount

    if (player.chips < totalAmount) {
      return { success: false, error: '筹码不足' }
    }

    player.chips -= totalAmount
    player.currentBet += totalAmount
    player.lastBetAmount = totalAmount
    player.lastBetBlind = false
    this.state.pot += totalAmount
    this.state.currentBet = player.currentBet

    this.seats.forEach(p => {
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
      newBet: this.state.currentBet,
      newChips: player.chips
    }
  }

  // 焖牌：不看牌下注，下家看牌要跟双倍
  handleBlind(player, blindAmount) {
    if (player.hasPeeked) {
      return { success: false, error: '已看牌不能焖牌' }
    }
    
    const minAmount = this.getCallAmountForPlayer(player)
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
    this.state.pot += blindAmount
    player.hasActed = true

    return {
      success: true,
      action: 'blind',
      seatIndex: player.id,
      amount: blindAmount,
      newChips: player.chips
    }
  }

  // 获取上一个未弃牌玩家的信息
  getLastActivePlayerInfo(currentSeatIndex) {
    let index = currentSeatIndex
    for (let i = 0; i < 8; i++) {
      index = (index - 1 + 8) % 8
      const player = this.seats[index]
      if (player && !player.folded) {
        return {
          lastBetAmount: player.lastBetAmount || this.state.currentBet,
          lastBetBlind: player.lastBetBlind || false
        }
      }
    }
    return { lastBetAmount: this.state.currentBet, lastBetBlind: false }
  }

  // 获取最近一个下注玩家的信息（跳过弃牌的，用于判断焖牌状态）
  getLastBettingPlayerInfo(currentSeatIndex) {
    let index = currentSeatIndex
    for (let i = 0; i < 8; i++) {
      index = (index - 1 + 8) % 8
      const player = this.seats[index]
      // 找到最近一个有下注记录的非弃牌玩家
      if (player && !player.folded && player.lastBetAmount > 0) {
        return {
          lastBetAmount: player.lastBetAmount,
          lastBetBlind: player.lastBetBlind || false
        }
      }
    }
    return { lastBetAmount: this.state.currentBet, lastBetBlind: false }
  }

  // 获取上一个未弃牌玩家这一手的下注金额
  getLastActiveBetAmount(currentSeatIndex) {
    let index = currentSeatIndex
    for (let i = 0; i < 8; i++) {
      index = (index - 1 + 8) % 8
      const player = this.seats[index]
      if (player && !player.folded) {
        return player.lastBetAmount || this.state.currentBet
      }
    }
    return this.state.currentBet
  }

  // 开牌：选择一个对手比牌，输的弃牌
  handleShowdown(challenger, targetSeatIndex) {
    const target = this.seats[targetSeatIndex]
    if (!target || target.folded) {
      return { success: false, error: '目标玩家无效' }
    }
    if (targetSeatIndex === challenger.id) {
      return { success: false, error: '不能和自己开牌' }
    }

    // 开牌费用：上家这一手的下注金额
    const showdownCost = this.getLastActiveBetAmount(challenger.id)
    if (challenger.chips < showdownCost) {
      return { success: false, error: '筹码不足，需要' + showdownCost }
    }

    // 扣除开牌费用
    challenger.chips -= showdownCost
    challenger.currentBet += showdownCost
    challenger.lastBetAmount = showdownCost
    this.state.pot += showdownCost
    challenger.hasActed = true

    // 比较牌型
    const challengerHand = challenger.hand.getType()
    const targetHand = target.hand.getType()
    
    let loser, winner
    if (challengerHand.weight > targetHand.weight) {
      winner = challenger
      loser = target
    } else if (challengerHand.weight < targetHand.weight) {
      winner = target
      loser = challenger
    } else {
      // 牌型相同，挑战者输（诈金花规则）
      winner = target
      loser = challenger
    }
    
    loser.fold()
    loser.hasActed = true

    // 记录开牌结果
    this.state.showdownResult = {
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
    const active = this.getActivePlayers()
    if (active.length <= 1) {
      return this.endGame()
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
      targetHand
    }
  }

  nextPlayer() {
    const active = this.getActivePlayers()
    if (active.length <= 1) {
      this.endGame()
      return
    }

    const actionable = this.getActionablePlayers()
    const allActed = actionable.every(p => p.hasActed)
    const allBetsEqual = active.every(p => p.currentBet === this.state.currentBet || p.isAllIn)

    if (allActed && allBetsEqual) {
      this.state.showdownReady = true
    }

    if (actionable.length === 0) {
      this.endGame()
      return
    }

    let attempts = 0
    do {
      this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % 8
      attempts++
      if (attempts > 8) {
        this.endGame()
        return
      }
    } while (
      !this.seats[this.state.currentPlayerIndex] ||
      this.seats[this.state.currentPlayerIndex].folded ||
      this.seats[this.state.currentPlayerIndex].isAllIn
    )

    // 如果是AI，自动决策
    const currentPlayer = this.seats[this.state.currentPlayerIndex]
    if (currentPlayer && currentPlayer.type === 'ai') {
      return { needAIAction: true, seatIndex: this.state.currentPlayerIndex }
    }
  }

  checkRoundEnd() {
    const active = this.getActivePlayers()
    if (active.length <= 1) {
      this.endGame()
      return true
    }
    return false
  }

  endGame() {
    this.state.setPhase('showdown')
    const active = this.getActivePlayers()

    let winner
    if (active.length === 1) {
      winner = active[0]
    } else {
      winner = this.compareHands(active)
    }

    winner.chips += this.state.pot
    this.state.winner = {
      seatIndex: winner.id,
      name: winner.name,
      handType: winner.hand.getType()
    }
    this.state.setPhase('ended')

    return {
      success: true,
      action: 'gameEnd',
      winner: this.state.winner,
      pot: this.state.pot,
      players: active.map(p => p.toFullJSON())
    }
  }

  compareHands(players) {
    return players.reduce((winner, player) => {
      const wHand = winner.hand.getType()
      const pHand = player.hand.getType()
      return pHand.weight > wHand.weight ? player : winner
    })
  }

  makeAIDecision(seatIndex) {
    const player = this.seats[seatIndex]
    if (!player || player.type !== 'ai') return null

    const handType = player.hand.getType()
    const strength = handType.weight
    const activePlayers = this.getActivePlayers().filter(p => p.id !== seatIndex)
    const callAmount = this.getCallAmountForPlayer(player)
    const potOdds = callAmount / (this.state.pot + callAmount)
    const round = this.state.round || 1
    
    // 分析对手行为
    const blindOpponents = activePlayers.filter(p => !p.hasPeeked)
    const peekedOpponents = activePlayers.filter(p => p.hasPeeked)
    const totalOpponents = activePlayers.length
    
    // 深度分析每个对手
    const opponentAnalysis = activePlayers.map(p => ({
      player: p,
      behavior: this.analyzeOpponentBehavior(p),
      tendency: this.getOpponentTendency(p.id)
    }))
    
    // 统计对手类型
    const aggressiveCount = opponentAnalysis.filter(a => a.behavior.aggressive).length
    const likelyBluffingCount = opponentAnalysis.filter(a => a.behavior.likelyBluffing).length
    const likelyStrongCount = opponentAnalysis.filter(a => a.behavior.likelyStrong).length
    
    // 分析对手下注模式
    const maxOpponentBet = Math.max(...activePlayers.map(p => p.lastBetAmount || 0), 0)
    const avgOpponentBet = activePlayers.reduce((sum, p) => sum + (p.lastBetAmount || 0), 0) / (totalOpponents || 1)
    
    // 牌型分类（诈金花牌型权重）
    const isMonster = strength >= 9000  // 豹子(10000)、同花顺(9500)
    const isStrong = strength >= 7000   // 同花(8000)、顺子(7500)
    const isMedium = strength >= 5000   // 对子(5000-6999)
    const isWeak = strength < 5000      // 散牌(1000-4999)
    
    // 计算相对牌力（考虑对手数量和行为）
    let relativeStrength = this.estimateWinProbability(strength, totalOpponents)
    // 如果对手看起来很强，降低相对牌力评估
    if (likelyStrongCount > 0) relativeStrength *= 0.8
    // 如果对手可能在诈，提高相对牌力评估
    if (likelyBluffingCount > 0) relativeStrength *= 1.15

    // 筹码压力分析
    const chipPressure = callAmount / player.chips
    const isShortStack = player.chips < callAmount * 5
    const isBigStack = player.chips > callAmount * 20
    
    // 底池价值分析
    const potValue = this.state.pot
    const potToChipRatio = potValue / player.chips

    // ========== 筹码不足时的决策 ==========
    if (player.chips < callAmount) {
      // 短筹码全押决策
      if (isStrong || isMonster) return { action: 'call' }
      if (isMedium && relativeStrength > 0.4) return { action: 'call' }
      if (isWeak && relativeStrength > 0.6 && Math.random() > 0.5) return { action: 'call' }
      return { action: 'fold' }
    }

    // ========== 看牌决策 ==========
    if (!player.hasPeeked) {
      // 诈金花策略：焖牌是重要策略，不要轻易看牌
      
      // 怪兽牌：慢玩，先焖几轮再看
      if (isMonster) {
        if (round <= 2 && Math.random() > 0.3) {
          // 前两轮焖牌慢玩
          return this.makeBlindBet(player, callAmount, true)
        }
        return { action: 'peek' }
      }
      
      // 强牌：根据对手行为决定
      if (isStrong) {
        // 对手激进时看牌准备反击
        if (aggressiveOpponents > 0 && Math.random() > 0.4) {
          return { action: 'peek' }
        }
        // 否则继续焖
        if (Math.random() > 0.5) {
          return this.makeBlindBet(player, callAmount, false)
        }
        return { action: 'peek' }
      }
      
      // 中等牌：倾向焖牌
      if (isMedium) {
        // 对手都在焖，继续焖
        if (blindOpponents.length >= peekedOpponents.length) {
          return this.makeBlindBet(player, callAmount, false)
        }
        // 有人看牌了，考虑也看
        if (Math.random() > 0.6) {
          return { action: 'peek' }
        }
        return this.makeBlindBet(player, callAmount, false)
      }
      
      // 弱牌：焖牌虚张声势是关键策略
      if (isWeak) {
        // 弱牌看了就没优势了，坚持焖
        // 但如果底池太大或对手太激进，考虑弃牌
        if (chipPressure > 0.3 && Math.random() > 0.4) {
          return { action: 'fold' }
        }
        if (aggressiveCount >= 2 && Math.random() > 0.3) {
          return { action: 'fold' }
        }
        // 如果有对手看起来很强，更容易弃牌
        if (likelyStrongCount > 0 && Math.random() > 0.4) {
          return { action: 'fold' }
        }
        // 虚张声势焖牌
        if (Math.random() > 0.3) {
          // 底池大时加大虚张声势力度
          const shouldBluffHard = potToChipRatio > 0.3 && Math.random() > 0.5
          return this.makeBlindBet(player, callAmount, shouldBluffHard)
        }
        return { action: 'fold' }
      }
    }

    // ========== 已看牌后的决策 ==========
    
    // 开牌决策
    if (activePlayers.length >= 1) {
      // 怪兽牌：找最佳目标开牌
      if (isMonster) {
        // 优先开可能在诈的对手
        const bluffingTargets = opponentAnalysis.filter(a => a.behavior.likelyBluffing)
        if (bluffingTargets.length > 0) {
          return { action: 'showdown', amount: bluffingTargets[0].player.id }
        }
        // 优先开看牌的对手（确定能赢）
        if (peekedOpponents.length > 0) {
          const target = this.findBestShowdownTarget(peekedOpponents)
          return { action: 'showdown', amount: target.id }
        }
        // 开焖牌的对手
        const target = this.findBestShowdownTarget(activePlayers)
        return { action: 'showdown', amount: target.id }
      }
      
      // 强牌：选择性开牌
      if (isStrong) {
        // 优先开焖牌的对手（可能在虚张声势）
        if (blindOpponents.length > 0 && Math.random() > 0.3) {
          const target = this.findBestShowdownTarget(blindOpponents)
          return { action: 'showdown', amount: target.id }
        }
        // 只剩一个对手时更倾向开牌
        if (totalOpponents === 1 && Math.random() > 0.4) {
          return { action: 'showdown', amount: activePlayers[0].id }
        }
      }
      
      // 中等牌：谨慎开牌
      if (isMedium && totalOpponents === 1) {
        // 对手焖牌且下注不大，考虑开
        const opponent = activePlayers[0]
        if (!opponent.hasPeeked && opponent.lastBetAmount <= callAmount && Math.random() > 0.6) {
          return { action: 'showdown', amount: opponent.id }
        }
      }
    }

    // ========== 下注决策 ==========
    
    // 怪兽牌：价值下注
    if (isMonster) {
      // 不要加注太多吓跑对手
      const raiseAmount = Math.min(
        20 + Math.floor(Math.random() * 20),
        player.chips - callAmount
      )
      if (raiseAmount > 0 && Math.random() > 0.2) {
        return { action: 'raise', amount: raiseAmount }
      }
      return { action: 'call' }
    }
    
    // 强牌：中等加注
    if (isStrong) {
      if (Math.random() > 0.3) {
        const raiseAmount = Math.min(
          15 + Math.floor(Math.random() * 15),
          player.chips - callAmount
        )
        if (raiseAmount > 0) {
          return { action: 'raise', amount: raiseAmount }
        }
      }
      return { action: 'call' }
    }
    
    // 中等牌：跟注为主
    if (isMedium) {
      // 对手下注太大时考虑弃牌
      if (chipPressure > 0.25 && Math.random() > 0.6) {
        return { action: 'fold' }
      }
      // 偶尔小加注
      if (Math.random() > 0.8) {
        return { action: 'raise', amount: 10 }
      }
      return { action: 'call' }
    }
    
    // 弱牌：已看牌的弱牌很被动
    if (isWeak) {
      // 对手激进时弃牌
      if (aggressiveOpponents > 0 || chipPressure > 0.15) {
        if (Math.random() > 0.2) {
          return { action: 'fold' }
        }
      }
      // 底池赔率不好时弃牌
      if (potOdds > 0.35) {
        return { action: 'fold' }
      }
      // 小概率跟注（诈一下）
      if (Math.random() > 0.7) {
        return { action: 'call' }
      }
      return { action: 'fold' }
    }

    return { action: 'fold' }
  }

  // 焖牌下注
  makeBlindBet(player, callAmount, shouldRaise) {
    if (shouldRaise && player.chips > callAmount + 10) {
      // 焖牌加注
      const raiseAmount = 10 + Math.floor(Math.random() * 20)
      return { action: 'blind', amount: Math.min(callAmount + raiseAmount, player.chips) }
    }
    return { action: 'blind', amount: callAmount }
  }

  // 估算胜率
  estimateWinProbability(strength, opponentCount) {
    // 简化的胜率估算
    const baseWinRate = strength / 10000
    // 对手越多，胜率越低
    const adjustedRate = Math.pow(baseWinRate, 1 + opponentCount * 0.15)
    return adjustedRate
  }

  // 找最佳开牌目标
  findBestShowdownTarget(opponents) {
    if (!opponents || opponents.length === 0) return null
    
    // 评分系统：综合考虑多个因素
    const scored = opponents.map(p => {
      let score = 0
      
      // 焖牌的对手更可能在虚张声势（+30分）
      if (!p.hasPeeked) score += 30
      
      // 下注激进但焖牌的可能在诈（+20分）
      if (!p.hasPeeked && p.lastBetAmount > 20) score += 20
      
      // 下注保守的看牌玩家可能牌不强（+15分）
      if (p.hasPeeked && p.lastBetAmount <= 15) score += 15
      
      // 筹码少的对手更容易是在搏命（+10分）
      if (p.chips < 100) score += 10
      
      // 筹码多的对手赢得多（+5分）
      score += Math.min(p.chips / 50, 10)
      
      return { player: p, score }
    })
    
    // 按分数排序
    scored.sort((a, b) => b.score - a.score)
    return scored[0].player
  }

  // 分析对手的下注模式，推测牌力
  analyzeOpponentBehavior(opponent) {
    const behavior = {
      likelyStrong: false,
      likelyBluffing: false,
      aggressive: false,
      passive: false
    }
    
    // 看牌后大额加注，可能是强牌
    if (opponent.hasPeeked && opponent.lastBetAmount > 30) {
      behavior.likelyStrong = true
      behavior.aggressive = true
    }
    
    // 焖牌但下注很大，可能在诈
    if (!opponent.hasPeeked && opponent.lastBetAmount > 25) {
      behavior.likelyBluffing = true
      behavior.aggressive = true
    }
    
    // 看牌后只是跟注，可能牌力一般
    if (opponent.hasPeeked && opponent.lastBetAmount <= 15) {
      behavior.passive = true
    }
    
    // 焖牌且下注保守，可能在观望
    if (!opponent.hasPeeked && opponent.lastBetAmount <= 15) {
      behavior.passive = true
    }
    
    return behavior
  }

  // AI记忆系统：记录本局对手的行为模式
  updateOpponentProfile(opponent, action) {
    if (!this.opponentProfiles) {
      this.opponentProfiles = {}
    }
    
    const id = opponent.id
    if (!this.opponentProfiles[id]) {
      this.opponentProfiles[id] = {
        bluffCount: 0,
        foldCount: 0,
        raiseCount: 0,
        showdownWins: 0,
        showdownLosses: 0
      }
    }
    
    const profile = this.opponentProfiles[id]
    
    if (action === 'fold') profile.foldCount++
    if (action === 'raise' || action === 'blind') profile.raiseCount++
  }

  // 获取对手的历史行为倾向
  getOpponentTendency(opponentId) {
    if (!this.opponentProfiles || !this.opponentProfiles[opponentId]) {
      return { isAggressive: false, isTight: false, isLoose: false }
    }
    
    const profile = this.opponentProfiles[opponentId]
    const totalActions = profile.foldCount + profile.raiseCount + 1
    
    return {
      isAggressive: profile.raiseCount / totalActions > 0.5,
      isTight: profile.foldCount / totalActions > 0.4,
      isLoose: profile.foldCount / totalActions < 0.2
    }
  }

  getStateForPlayer(seatIndex) {
    const state = this.state.toJSON()
    const seats = this.seats.map((p, i) => {
      if (!p) return null
      if (i === seatIndex) return p.toPrivateJSON()
      if (this.state.phase === 'showdown' || this.state.phase === 'ended') return p.toFullJSON()
      return p.toPublicJSON()
    })
    return { ...state, seats }
  }

  getFullState() {
    return {
      ...this.state.toJSON(),
      seats: this.seats.map(p => p ? p.toFullJSON() : null)
    }
  }
}
