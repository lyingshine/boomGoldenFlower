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

  startRound(hostSeatIndex = -1) {
    const players = this.seats.filter(p => p)
    if (players.length < 1) return { success: false, error: '没有玩家' }

    this.deck = new Deck()
    this.state.startRound()
    players.forEach(p => p.reset())

    const dealResult = this.dealCards()
    this.collectAntes()
    this.setFirstPlayer(hostSeatIndex)
    
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
    // 发牌完成后整理每个玩家的手牌
    this.seats.forEach(player => {
      if (player) {
        player.hand.sort()
      }
    })
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

  setFirstPlayer(hostSeatIndex = -1) {
    let startIndex = -1
    
    // 如果有上一局赢家，从赢家的下家开始
    if (this.state.lastWinnerIndex >= 0 && this.seats[this.state.lastWinnerIndex]) {
      startIndex = this.state.lastWinnerIndex
    } 
    // 第一局从房主的下家开始
    else if (hostSeatIndex >= 0) {
      startIndex = hostSeatIndex
    }
    
    // 找到下一个有效玩家
    if (startIndex >= 0) {
      for (let i = 1; i <= 8; i++) {
        const nextIndex = (startIndex + i) % 8
        if (this.seats[nextIndex] && !this.seats[nextIndex].folded) {
          this.state.currentPlayerIndex = nextIndex
          return
        }
      }
    }
    
    // 兜底：找第一个有效玩家
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
    loser.lostShowdown = true
    loser.showdownBy = challenger.id  // 记录是被谁开的牌
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
      targetHand,
      targetCards: target.hand.toJSON()  // 返回被开牌玩家的手牌
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
    this.state.lastWinnerIndex = winner.id // 记录赢家座位
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
    
    // 筹码压力分析
    const chipPressure = callAmount / player.chips
    
    // 底池价值分析
    const potValue = this.state.pot
    const potToChipRatio = potValue / player.chips

    // ========== 筹码不足时的决策 ==========
    if (player.chips < callAmount) {
      // 焖牌状态：不知道牌力，根据底池赔率和随机决定
      if (!player.hasPeeked) {
        // 底池大时更愿意搏一把
        if (potToChipRatio > 0.5 && Math.random() > 0.4) return { action: 'call' }
        if (Math.random() > 0.6) return { action: 'call' }
        return { action: 'fold' }
      }
      // 已看牌：根据真实牌力决定
      const handType = player.hand.getType()
      const strength = handType.weight
      if (strength >= 7000) return { action: 'call' }
      if (strength >= 5000 && Math.random() > 0.4) return { action: 'call' }
      if (Math.random() > 0.7) return { action: 'call' }
      return { action: 'fold' }
    }

    // ========== 焖牌状态的决策（不能看牌力！）==========
    if (!player.hasPeeked) {
      return this.makeBlindDecision(player, callAmount, {
        round,
        totalOpponents,
        blindOpponents,
        peekedOpponents,
        aggressiveCount,
        likelyStrongCount,
        likelyBluffingCount,
        chipPressure,
        potToChipRatio,
        potOdds
      })
    }

    // ========== 已看牌后的决策（可以使用真实牌力）==========
    const handType = player.hand.getType()
    const strength = handType.weight
    
    // 根据玩家数动态调整牌力评估
    const { isMonster, isStrong, isMedium, isWeak } = this.evaluateHandStrength(strength, totalOpponents + 1)
    
    // 开牌决策
    if (activePlayers.length >= 1) {
      if (isMonster && Math.random() > 0.7) {
        const target = this.findBestShowdownTarget(activePlayers)
        if (target) return { action: 'showdown', amount: target.id }
      }
      if (isStrong && totalOpponents === 1 && Math.random() > 0.8) {
        return { action: 'showdown', amount: activePlayers[0].id }
      }
      if (isMedium && totalOpponents === 1 && Math.random() > 0.9) {
        return { action: 'showdown', amount: activePlayers[0].id }
      }
    }

    // 下注决策
    if (isMonster) {
      const raiseAmount = Math.min(20 + Math.floor(Math.random() * 20), player.chips - callAmount)
      if (raiseAmount > 0 && Math.random() > 0.2) {
        return { action: 'raise', amount: raiseAmount }
      }
      return { action: 'call' }
    }
    
    if (isStrong) {
      if (Math.random() > 0.3) {
        const raiseAmount = Math.min(15 + Math.floor(Math.random() * 15), player.chips - callAmount)
        if (raiseAmount > 0) return { action: 'raise', amount: raiseAmount }
      }
      return { action: 'call' }
    }
    
    if (isMedium) {
      if (chipPressure > 0.25 && Math.random() > 0.6) return { action: 'fold' }
      if (Math.random() > 0.8) return { action: 'raise', amount: 10 }
      return { action: 'call' }
    }
    
    // 弱牌
    if (aggressiveCount > 0 || chipPressure > 0.15) {
      if (Math.random() > 0.2) return { action: 'fold' }
    }
    if (potOdds > 0.35) return { action: 'fold' }
    if (Math.random() > 0.7) return { action: 'call' }
    return { action: 'fold' }
  }

  // 焖牌状态的决策（完全不看牌力）
  makeBlindDecision(player, callAmount, context) {
    const {
      round,
      totalOpponents,
      blindOpponents,
      peekedOpponents,
      aggressiveCount,
      likelyStrongCount,
      likelyBluffingCount,
      chipPressure,
      potToChipRatio,
      potOdds
    } = context

    // 基础继续概率（随机性是焖牌的核心）
    let continueChance = 0.7  // 70%基础继续率
    
    // 根据对手行为调整
    if (aggressiveCount >= 2) continueChance -= 0.2  // 多个激进对手，降低继续率
    if (likelyStrongCount > 0) continueChance -= 0.15  // 有人看起来很强
    if (likelyBluffingCount > 0) continueChance += 0.1  // 有人可能在诈
    
    // 根据筹码压力调整
    if (chipPressure > 0.3) continueChance -= 0.2
    if (chipPressure > 0.5) continueChance -= 0.2
    
    // 底池大时更愿意继续
    if (potToChipRatio > 0.3) continueChance += 0.1
    
    // 回合数影响：后期更谨慎
    if (round > 3) continueChance -= 0.1
    
    // 确保概率在合理范围
    continueChance = Math.max(0.2, Math.min(0.85, continueChance))

    // 决定是否继续
    if (Math.random() > continueChance) {
      return { action: 'fold' }
    }

    // 决定是否看牌
    let peekChance = 0.25  // 25%基础看牌率
    if (round >= 3) peekChance += 0.15  // 后期更想看牌
    if (peekedOpponents.length > blindOpponents.length) peekChance += 0.2  // 多数人看了
    if (aggressiveCount > 0) peekChance += 0.15  // 对手激进时想看牌应对
    if (chipPressure > 0.25) peekChance += 0.1  // 压力大时想看牌
    
    if (Math.random() < peekChance) {
      return { action: 'peek' }
    }

    // 继续焖牌
    // 决定是否加注（虚张声势）
    let raiseChance = 0.2  // 20%基础加注率
    if (blindOpponents.length > peekedOpponents.length) raiseChance += 0.1  // 大家都焖，可以诈
    if (potToChipRatio > 0.3) raiseChance += 0.1  // 底池大，值得诈
    if (likelyBluffingCount > 0) raiseChance -= 0.1  // 别人也在诈，收敛点
    
    const shouldRaise = Math.random() < raiseChance && player.chips > callAmount + 10
    return this.makeBlindBet(player, callAmount, shouldRaise)
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

  // 根据玩家数动态评估牌力
  evaluateHandStrength(strength, playerCount) {
    // 2-3人局：对子就很有价值
    if (playerCount <= 3) {
      return {
        isMonster: strength >= 7000,  // 同花顺、豹子
        isStrong: strength >= 5000,   // 顺子、同花
        isMedium: strength >= 3000,   // 对子
        isWeak: strength < 3000       // 散牌
      }
    }
    
    // 4-5人局：需要顺子以上才稳
    if (playerCount <= 5) {
      return {
        isMonster: strength >= 8000,  // 豹子
        isStrong: strength >= 6000,   // 同花、同花顺
        isMedium: strength >= 4000,   // 顺子、大对子
        isWeak: strength < 4000       // 小对子、散牌
      }
    }
    
    // 6-8人局：同花以上才有优势
    return {
      isMonster: strength >= 9000,  // 豹子
      isStrong: strength >= 7000,   // 同花顺
      isMedium: strength >= 5000,   // 同花、顺子
      isWeak: strength < 5000       // 对子、散牌
    }
  }

  // AI 生成聊天消息
  generateAIMessage(seatIndex, action, context = {}) {
    const player = this.seats[seatIndex]
    if (!player || player.type !== 'ai') return null

    // 50% 概率发消息
    if (Math.random() > 0.5) return null

    const messages = this.getAIMessagePool(action, context)
    if (!messages || messages.length === 0) return null

    const message = messages[Math.floor(Math.random() * messages.length)]
    return { seatIndex, playerName: player.name, message }
  }

  // 获取 AI 消息池
  getAIMessagePool(action, context) {
    const { isBluffing, hasStrongHand, opponentAggressive } = context

    const pools = {
      // 焖牌消息
      blind: [
        '不看了，直接焖！',
        '焖到底！',
        '我有信心',
        '来吧，跟不跟？',
        '这把稳了',
        '焖牌才刺激',
        '不用看，感觉不错',
        '闭着眼都能赢',
        '今天手气好',
        '就这样焖着',
        '焖！',
        '继续焖',
        '不看牌更刺激',
        '盲打到底',
        '我就不看',
        '焖牌是艺术',
        '相信直觉',
        '感觉来了',
        '这把有戏',
        '稳住，我们能赢',
        '焖牌王者',
        '不看也能赢',
        '就是这么自信',
        '跟着感觉走',
        '今天运气不错'
      ],
      // 跟注消息
      call: [
        '跟了',
        '我跟',
        '看看再说',
        '不急',
        '慢慢来',
        '跟一个',
        '还行吧',
        '继续',
        '跟着',
        '没问题',
        '可以',
        '行吧',
        '跟上',
        '我也跟',
        '不多不少',
        '刚刚好',
        '稳扎稳打',
        '先跟着看看',
        '不着急',
        '慢慢玩'
      ],
      // 加注消息
      raise: [
        '加点！',
        '来真的了',
        '敢不敢跟？',
        '加注！',
        '不服来战',
        '小意思',
        '再加点',
        '有胆就跟',
        '加！',
        '来劲了',
        '上强度',
        '玩大的',
        '加码！',
        '谁怕谁',
        '继续加',
        '不够刺激',
        '再来！',
        '加满！',
        '豁出去了',
        '梭哈精神',
        '就是要加',
        '怕了吗？',
        '来点刺激的',
        '加注见真章',
        '真金白银'
      ],
      // 弃牌消息
      fold: [
        '算了算了',
        '这把不玩了',
        '下把再来',
        '溜了溜了',
        '不跟了',
        '你们玩',
        '弃了',
        '等下一把',
        '告辞',
        '我先撤',
        '不陪了',
        '下次再战',
        '认输',
        '这把没戏',
        '收手了',
        '见好就收',
        '战略撤退',
        '保存实力',
        '留得青山在',
        '下把翻盘'
      ],
      // 看牌消息
      peek: [
        '看看牌',
        '让我瞧瞧',
        '看一眼',
        '偷偷看下',
        '看看什么牌',
        '揭晓答案',
        '终于忍不住了',
        '看看运气如何'
      ],
      // 开牌消息
      showdown: [
        '开！',
        '来比比！',
        '亮牌吧！',
        '不信你比我大',
        '开牌定胜负！',
        '摊牌了！',
        '见真章！',
        '比比看！',
        '一决高下！',
        '揭晓时刻！',
        '来吧，开牌！',
        '不装了，开！',
        '是骡子是马，拉出来溜溜'
      ],
      // 虚张声势（焖牌时的嘴炮）
      bluffing: [
        '怕了吧？',
        '我牌很大的',
        '你们最好弃牌',
        '这把我赢定了',
        '不信你试试',
        '哼哼',
        '稳如老狗',
        '你们没机会的',
        '认输吧',
        '别挣扎了',
        '大牌在手',
        '今天是我的',
        '你们输定了',
        '乖乖弃牌吧',
        '别浪费筹码了',
        '我已经赢了',
        '就这？',
        '太简单了',
        '小场面',
        '稳得一批'
      ],
      // 真正有大牌时的迷惑消息
      strongButHumble: [
        '唉，牌不太好',
        '随便跟跟',
        '凑合吧',
        '一般般',
        '不太行啊',
        '算了，跟一个',
        '牌不咋地',
        '将就着玩',
        '没什么好牌',
        '运气不好',
        '今天手气差',
        '随便玩玩',
        '无所谓了',
        '混混看吧',
        '不抱希望',
        '听天由命',
        '随缘吧',
        '差不多得了',
        '意思意思',
        '玩玩而已'
      ],
      // 对手激进时的回应
      responseToAggressive: [
        '别吓我',
        '你在诈我？',
        '我不信',
        '真有那么大？',
        '虚张声势吧',
        '我看你在诈',
        '少来这套',
        '吓唬谁呢',
        '我不怕',
        '来就来',
        '谁怕谁啊',
        '有本事开牌',
        '别装了',
        '我看穿你了',
        '诈我？没门',
        '你诈不到我',
        '演技不行啊',
        '太假了',
        '我就不信',
        '放马过来'
      ],
      // 赢牌后的得意
      winning: [
        '哈哈哈',
        '谢谢款待',
        '承让承让',
        '运气好而已',
        '小赢一把',
        '今天手气不错',
        '再来一把？',
        '这把稳了',
        '意料之中',
        '太简单了'
      ],
      // 输牌后的反应
      losing: [
        '下把翻盘',
        '运气不好',
        '再来！',
        '不服再战',
        '手气差',
        '下把一定赢',
        '等着瞧',
        '这把不算',
        '热身而已',
        '马上回本'
      ],
      // 观战/等待时的闲聊
      idle: [
        '快点啊',
        '想好了没',
        '别磨蹭',
        '时间宝贵',
        '抓紧时间',
        '等得花儿都谢了',
        '睡着了？',
        '醒醒',
        '该你了',
        '别发呆'
      ]
    }

    // 根据上下文选择消息池
    if (action === 'blind' || action === 'call' || action === 'raise') {
      // 已看牌且有大牌，用迷惑性消息
      if (hasStrongHand && Math.random() > 0.5) {
        return pools.strongButHumble
      }
      // 对手激进时
      if (opponentAggressive && Math.random() > 0.6) {
        return pools.responseToAggressive
      }
    }

    return pools[action] || null
  }

  getStateForPlayer(seatIndex) {
    const state = this.state.toJSON()
    const seats = this.seats.map((p, i) => {
      if (!p) return null
      if (i === seatIndex) return p.toPrivateJSON()
      if (this.state.phase === 'showdown' || this.state.phase === 'ended') return p.toFullJSON()
      // 被开牌输掉的玩家，只有发起开牌的人能看到手牌
      if (p.lostShowdown && p.showdownBy === seatIndex) return p.toFullJSON()
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
