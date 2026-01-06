import { Deck } from '../models/Deck.js'
import { Player } from '../models/Player.js'
import { GameState } from './GameState.js'

/**
 * 游戏引擎 (服务端权威)
 */
export class GameEngine {
  constructor(roomCode, room = null) {
    this.roomCode = roomCode
    this.room = room  // 引用 Room 以访问跨局玩家档案
    this.seats = new Array(8).fill(null)
    this.deck = null
    this.state = new GameState()
  }

  addPlayer(seatIndex, name, chips, type = 'human', waitingForNextRound = false) {
    if (seatIndex < 0 || seatIndex >= 8 || this.seats[seatIndex]) return false
    const player = new Player(seatIndex, name, chips, type)
    // 中途加入的玩家标记为等待下一局，本局不参与
    if (waitingForNextRound) {
      player.waitingForNextRound = true
      player.folded = true  // 本局视为已弃牌
    }
    this.seats[seatIndex] = player
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

  startRound(hostSeatIndex = -1, ante = 10) {
    const players = this.seats.filter(p => p)
    if (players.length < 1) return { success: false, error: '没有玩家' }

    this.deck = new Deck()
    this.state.startRound(ante)
    players.forEach(p => {
      p.reset()
      // 新一轮开始，清除等待状态
      p.waitingForNextRound = false
    })

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
    // 记录初始玩家数，用于判断第一轮是否完成
    this.state.initialPlayerCount = this.getActivePlayers().length
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
      if (gameEnded) {
        // 游戏结束，返回 gameEnd 结果
        return {
          success: true,
          action: 'gameEnd',
          foldedPlayer: seatIndex,
          winner: this.state.winner,
          pot: this.state.pot
        }
      }
      this.nextPlayer()
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
    // 第一轮不能开牌
    if (!this.state.firstRoundComplete) {
      return { success: false, error: '第一轮不能开牌' }
    }
    
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
    
    // 如果赢家是焖牌状态，开牌后自动变为已看牌
    if (!winner.hasPeeked) {
      winner.hasPeeked = true
      winner.forcePeekedByShowdown = true  // 标记是被开牌强制看牌的
    }
    
    // 记录开牌双方关系，用于结束时显示牌
    challenger.showdownWith = Number(targetSeatIndex)
    target.showdownWith = Number(challenger.id)
    console.log(`📋 开牌关系: challenger(${challenger.id}).showdownWith=${targetSeatIndex}, target(${targetSeatIndex}).showdownWith=${challenger.id}`)

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
      const endResult = this.endGame()
      // 保留开牌信息用于记录
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
      targetCards: target.hand.toJSON(),  // 返回被开牌玩家的手牌
      winnerCards: winner.hand.toJSON(),  // 返回赢家的手牌（用于焖牌赢家看自己的牌）
      winnerForcePeeked: winner.forcePeekedByShowdown || false  // 标记赢家是否被强制看牌
    }
  }

  nextPlayer() {
    const active = this.getActivePlayers()
    if (active.length <= 1) {
      this.endGame()
      return
    }

    // 行动计数+1，检查第一轮是否完成
    this.state.actionCount++
    if (!this.state.firstRoundComplete && this.state.actionCount >= this.state.initialPlayerCount) {
      this.state.firstRoundComplete = true
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

  async makeAIDecision(seatIndex) {
    const player = this.seats[seatIndex]
    if (!player || player.type !== 'ai') return null

    const activePlayers = this.getActivePlayers().filter(p => p.id !== seatIndex)
    const callAmount = this.getCallAmountForPlayer(player)
    const round = this.state.round || 1
    
    // ========== 获取对手档案（跨局数据）==========
    const opponentProfiles = await Promise.all(activePlayers.map(async p => {
      const profile = this.room ? await this.room.getPlayerProfile(p.name) : null
      return {
        player: p,
        profile,
        // 基于档案的深度分析
        analysis: this.analyzeOpponentWithProfile(p, profile),
        estimatedStrength: this.estimateOpponentStrengthWithProfile(p, profile)
      }
    }))
    
    // ========== 筹码不足时的决策 ==========
    if (player.chips < callAmount) {
      if (!player.hasPeeked) {
        return { action: 'peek' }
      }
      const handType = player.hand.getType()
      const strength = handType.weight
      if (strength >= 3000) return { action: 'call' }
      if (Math.random() > 0.4) return { action: 'call' }
      return { action: 'fold' }
    }

    // ========== 焖牌状态的决策 ==========
    if (!player.hasPeeked) {
      const decision = this.makeBlindDecisionV2(player, callAmount, {
        round, opponentProfiles, activePlayers
      })
      if (decision.action === 'fold') {
        return { action: 'peek' }
      }
      return decision
    }

    // ========== 已看牌后的决策 ==========
    const handType = player.hand.getType()
    const strength = handType.weight
    const playerCount = activePlayers.length + 1
    const { isMonster, isStrong, isMedium, isWeak } = this.evaluateHandStrength(strength, playerCount)
    
    // ========== 开牌决策 ==========
    if (activePlayers.length >= 1 && this.state.firstRoundComplete) {
      const showdownDecision = this.considerShowdownV2(player, strength, opponentProfiles)
      if (showdownDecision) return showdownDecision
    }

    // ========== 下注决策 ==========
    const decision = this.makeBettingDecisionV2(player, callAmount, {
      strength, isMonster, isStrong, isMedium, isWeak,
      opponentProfiles, round
    })
    
    if (decision.action === 'fold' && (isMonster || isStrong)) {
      return { action: 'call' }
    }
    
    return decision
  }

  // ========== 基于档案的对手深度分析 ==========
  analyzeOpponentWithProfile(opponent, profile) {
    const analysis = {
      type: 'unknown',        // 玩家类型
      bluffLikelihood: 0.3,   // 当前诈唬概率
      foldPressure: 0.5,      // 施压后弃牌概率
      dangerLevel: 0.5,       // 威胁程度
      exploitStrategy: null,  // 剥削策略
      betSizePattern: 'normal', // 下注模式
      showdownTendency: 0.5   // 开牌倾向
    }
    
    if (!profile || profile.totalHands < 5) {
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
    
    // 新数据：早期/晚期弃牌比例
    const totalFolds = profile.foldCount || 1
    const earlyFoldRatio = (profile.earlyFoldCount || 0) / totalFolds
    
    // 新数据：大注/小注比例
    const totalRaises = profile.raiseCount || 1
    const bigRaiseRatio = (profile.bigRaiseCount || 0) / totalRaises
    
    // 新数据：主动开牌倾向
    const showdownActions = (profile.showdownInitiated || 0) + (profile.showdownReceived || 0)
    const showdownAggressiveness = showdownActions > 0 ? (profile.showdownInitiated || 0) / showdownActions : 0.5
    
    // 新数据：不开牌赢的比例（施压能力）
    const wins = profile.showdownWins + (profile.wonWithoutShowdown || 0)
    const pressureWinRate = wins > 0 ? (profile.wonWithoutShowdown || 0) / wins : 0
    
    // 新数据：平均下注金额
    const avgBet = profile.avgBetSize || 20
    
    // ========== 玩家分类（用新数据优化）==========
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
      analysis.type = 'pressure_player'  // 新类型：善于施压
      analysis.exploitStrategy = '他加注时多跟注看看，可能在诈唬'
    } else {
      analysis.type = 'balanced'
    }
    
    // ========== 诈唬概率（用新数据优化）==========
    analysis.bluffLikelihood = bluffRate * 0.5 + 0.2
    
    // 大注比例高但胜率低 → 诈唬多
    if (bigRaiseRatio > 0.5 && showdownWinRate < 0.4) {
      analysis.bluffLikelihood += 0.2
    }
    
    // 施压赢的多 → 可能诈唬多
    if (pressureWinRate > 0.4) {
      analysis.bluffLikelihood += 0.15
    }
    
    // 当前行为修正
    if (!opponent.hasPeeked && opponent.lastBetAmount > 25) {
      analysis.bluffLikelihood += 0.15
    }
    if (opponent.hasPeeked && opponent.lastBetAmount > avgBet * 1.5) {
      // 下注明显高于平均，可能是强牌也可能是诈唬
      if (bluffRate > 0.15) {
        analysis.bluffLikelihood += 0.1
      } else {
        analysis.bluffLikelihood -= 0.1
      }
    }
    analysis.bluffLikelihood = Math.max(0.05, Math.min(0.8, analysis.bluffLikelihood))
    
    // ========== 施压后弃牌概率（用新数据优化）==========
    analysis.foldPressure = foldRate * 0.6 + 0.15
    
    // 早期弃牌多 → 更容易被逼退
    if (earlyFoldRatio > 0.6) {
      analysis.foldPressure += 0.15
    }
    
    // 类型修正
    if (analysis.type === 'rock') analysis.foldPressure += 0.15
    if (analysis.type === 'calling_station') analysis.foldPressure -= 0.25
    if (analysis.type === 'maniac') analysis.foldPressure -= 0.3
    if (analysis.type === 'pressure_player') analysis.foldPressure -= 0.1
    
    analysis.foldPressure = Math.max(0.05, Math.min(0.85, analysis.foldPressure))
    
    // ========== 威胁程度（用新数据优化）==========
    analysis.dangerLevel = showdownWinRate * 0.5 + 0.25
    
    // 总盈利为正 → 更危险
    const netProfit = (profile.totalChipsWon || 0) - (profile.totalChipsLost || 0)
    if (netProfit > 500) {
      analysis.dangerLevel += 0.15
    } else if (netProfit < -500) {
      analysis.dangerLevel -= 0.1
    }
    
    // 单局最大赢很高 → 会打大牌
    if ((profile.maxSingleWin || 0) > 200) {
      analysis.dangerLevel += 0.1
    }
    
    // 当前行为修正
    if (opponent.hasPeeked && opponent.lastBetAmount > 35) {
      analysis.dangerLevel += 0.15
    }
    
    analysis.dangerLevel = Math.max(0.1, Math.min(0.9, analysis.dangerLevel))
    
    // ========== 下注模式 ==========
    if (avgBet > 35) {
      analysis.betSizePattern = 'big'
    } else if (avgBet < 15) {
      analysis.betSizePattern = 'small'
    }
    
    // ========== 开牌倾向 ==========
    analysis.showdownTendency = showdownAggressiveness
    
    return analysis
  }

  // ========== 基于档案的牌力推测 ==========
  estimateOpponentStrengthWithProfile(opponent, profile) {
    let strength = 0.5
    
    // 当前行为分析
    if (opponent.hasPeeked) {
      if (opponent.lastBetAmount > 40) strength = 0.75
      else if (opponent.lastBetAmount > 25) strength = 0.6
      else if (opponent.lastBetAmount <= 10) strength = 0.35
    } else {
      if (opponent.lastBetAmount > 30) strength = 0.55
      else strength = 0.45
    }
    
    // 用档案修正
    if (profile && profile.totalHands >= 5) {
      const totalHands = Math.max(profile.totalHands, 1)
      const bluffRate = profile.bluffCaught / totalHands
      const raiseRate = profile.raiseCount / totalHands
      const avgBet = profile.avgBetSize || 20
      
      // 经常诈唬的人，大注时强度打折
      if (bluffRate > 0.15 && opponent.lastBetAmount > 25) {
        strength *= 0.8
      }
      
      // 很少加注的人突然加注，更可能是真货
      if (raiseRate < 0.2 && opponent.lastBetAmount > 30) {
        strength *= 1.2
      }
      
      // 下注金额相对于平均值的偏离
      if (opponent.lastBetAmount > avgBet * 1.8) {
        // 下注远高于平均，要么很强要么诈唬
        if (bluffRate > 0.2) {
          strength *= 0.85  // 诈唬倾向高，打折
        } else {
          strength *= 1.15  // 诈唬倾向低，可能真强
        }
      } else if (opponent.lastBetAmount < avgBet * 0.6) {
        // 下注远低于平均，可能在控池
        strength *= 0.9
      }
      
      // 岩石型玩家还在场，说明牌不差
      if (profile.foldCount / totalHands > 0.5) {
        strength += 0.1
      }
      
      // 施压型玩家的大注可信度低
      const wins = profile.showdownWins + (profile.wonWithoutShowdown || 0)
      const pressureWinRate = wins > 0 ? (profile.wonWithoutShowdown || 0) / wins : 0
      if (pressureWinRate > 0.4 && opponent.lastBetAmount > 30) {
        strength *= 0.85
      }
    }
    
    return Math.max(0.1, Math.min(0.95, strength))
  }

  // ========== 焖牌决策V2：基于对手档案 ==========
  makeBlindDecisionV2(player, callAmount, context) {
    const { round, opponentProfiles } = context
    const chipPressure = callAmount / player.chips
    
    // 分析对手构成
    const rockCount = opponentProfiles.filter(o => o.analysis.type === 'rock').length
    const maniacCount = opponentProfiles.filter(o => o.analysis.type === 'maniac').length
    const avgBluffLikelihood = opponentProfiles.reduce((sum, o) => sum + o.analysis.bluffLikelihood, 0) / Math.max(opponentProfiles.length, 1)
    const avgDanger = opponentProfiles.reduce((sum, o) => sum + o.analysis.dangerLevel, 0) / Math.max(opponentProfiles.length, 1)
    
    // ========== 决定是否看牌 ==========
    let peekChance = 0.3  // 基础看牌概率提高
    
    // 轮次越多，越该看牌（加大权重）
    peekChance += round * 0.15
    
    // 筹码压力大，必须看牌
    if (chipPressure > 0.2) peekChance += 0.3
    if (chipPressure > 0.4) peekChance += 0.4
    
    // 对手威胁度高，先看牌
    if (avgDanger > 0.5) peekChance += 0.25
    
    // 有疯狂型玩家，需要看牌应对
    if (maniacCount > 0) peekChance += 0.2
    
    // 对手诈唬概率高，可以继续焖（但减少幅度）
    if (avgBluffLikelihood > 0.4) peekChance -= 0.1
    
    peekChance = Math.max(0.15, Math.min(0.95, peekChance))
    
    if (Math.random() < peekChance) {
      return { action: 'peek' }
    }

    // ========== 继续焖牌 ==========
    // 后期轮次不要盲目焖牌加注
    if (round >= 3) {
      return { action: 'blind', amount: callAmount }
    }
    
    // 针对岩石型玩家：焖牌加注逼他弃牌（降低概率）
    if (rockCount > 0 && player.chips > callAmount + 20 && round <= 2) {
      const avgFoldPressure = opponentProfiles
        .filter(o => o.analysis.type === 'rock')
        .reduce((sum, o) => sum + o.analysis.foldPressure, 0) / rockCount
      
      if (Math.random() < avgFoldPressure * 0.4) {
        const raiseAmount = 10 + Math.floor(Math.random() * 15)
        return { action: 'blind', amount: callAmount + raiseAmount }
      }
    }
    
    // 针对跟注站：不诈唬，老实焖
    const callingStationCount = opponentProfiles.filter(o => o.analysis.type === 'calling_station').length
    if (callingStationCount > 0) {
      return { action: 'blind', amount: callAmount }
    }
    
    // 普通情况：小概率加注（降低概率）
    if (Math.random() < 0.1 && player.chips > callAmount + 15 && round <= 2) {
      const raiseAmount = 10 + Math.floor(Math.random() * 10)
      return { action: 'blind', amount: callAmount + raiseAmount }
    }
    
    return { action: 'blind', amount: callAmount }
  }

  // ========== 下注决策V2：基于对手档案 ==========
  makeBettingDecisionV2(player, callAmount, context) {
    const { strength, isMonster, isStrong, isMedium, isWeak, opponentProfiles, round } = context
    const chipPressure = callAmount / player.chips
    
    // 对手分析
    const rockCount = opponentProfiles.filter(o => o.analysis.type === 'rock').length
    const callingStationCount = opponentProfiles.filter(o => o.analysis.type === 'calling_station').length
    const maniacCount = opponentProfiles.filter(o => o.analysis.type === 'maniac').length
    const avgDanger = opponentProfiles.reduce((sum, o) => sum + o.analysis.dangerLevel, 0) / Math.max(opponentProfiles.length, 1)
    const avgFoldPressure = opponentProfiles.reduce((sum, o) => sum + o.analysis.foldPressure, 0) / Math.max(opponentProfiles.length, 1)
    
    // ========== 怪兽牌 ==========
    if (isMonster) {
      // 对跟注站：疯狂加注榨取价值
      if (callingStationCount > 0) {
        const raiseAmount = Math.min(30 + Math.floor(Math.random() * 30), player.chips - callAmount)
        if (raiseAmount > 0) return { action: 'raise', amount: raiseAmount }
      }
      // 对疯狂型：让他加注，我们跟注陷阱
      if (maniacCount > 0 && Math.random() < 0.5) {
        return { action: 'call' }
      }
      // 默认：混合加注
      if (Math.random() < 0.7) {
        const raiseAmount = Math.min(20 + Math.floor(Math.random() * 25), player.chips - callAmount)
        if (raiseAmount > 0) return { action: 'raise', amount: raiseAmount }
      }
      return { action: 'call' }
    }
    
    // ========== 强牌 ==========
    if (isStrong) {
      // 对岩石型：他还在就要小心
      if (rockCount > 0 && avgDanger > 0.6) {
        return { action: 'call' }
      }
      // 对跟注站：加注榨取
      if (callingStationCount > 0) {
        const raiseAmount = Math.min(20 + Math.floor(Math.random() * 15), player.chips - callAmount)
        if (raiseAmount > 0) return { action: 'raise', amount: raiseAmount }
      }
      // 默认
      if (Math.random() < 0.4) {
        const raiseAmount = Math.min(15 + Math.floor(Math.random() * 15), player.chips - callAmount)
        if (raiseAmount > 0) return { action: 'raise', amount: raiseAmount }
      }
      return { action: 'call' }
    }
    
    // ========== 中等牌 ==========
    if (isMedium) {
      // 对岩石型：可以加注逼弃牌
      if (rockCount > 0 && avgFoldPressure > 0.5 && Math.random() < 0.35) {
        return { action: 'raise', amount: Math.min(20, player.chips - callAmount) }
      }
      // 对跟注站：别诈唬，老实跟
      if (callingStationCount > 0) {
        return { action: 'call' }
      }
      // 压力大且对手危险，考虑弃牌
      if (chipPressure > 0.4 && avgDanger > 0.65 && Math.random() < 0.4) {
        return { action: 'fold' }
      }
      return { action: 'call' }
    }
    
    // ========== 弱牌 ==========
    // 综合分析局势
    const potSize = this.state.pot
    const investedRatio = player.currentBet / (player.chips + player.currentBet)  // 已投入比例
    const potOdds = callAmount / (potSize + callAmount)  // 底池赔率
    
    // 分析对手行为强度
    let opponentAggression = 0
    for (const opp of opponentProfiles) {
      const p = opp.player
      // 对手看牌后大额下注 = 高威胁
      if (p.hasPeeked && p.lastBetAmount > 30) opponentAggression += 0.4
      else if (p.hasPeeked && p.lastBetAmount > 20) opponentAggression += 0.25
      // 对手焖牌大额下注 = 中等威胁（可能诈唬）
      else if (!p.hasPeeked && p.lastBetAmount > 25) opponentAggression += 0.15
      // 对手一直跟注不加注 = 低威胁
      else if (p.lastBetAmount <= this.state.ante) opponentAggression += 0.05
    }
    opponentAggression = opponentAggression / Math.max(opponentProfiles.length, 1)
    
    // 对手诈唬可能性
    const avgBluffLikelihood = opponentProfiles.reduce((sum, o) => sum + o.analysis.bluffLikelihood, 0) / Math.max(opponentProfiles.length, 1)
    
    // ========== 弃牌决策 ==========
    let foldChance = 0.3  // 基础弃牌概率
    
    // 对手攻击性强，弃牌概率大增
    foldChance += opponentAggression * 0.5
    
    // 对手威胁度高
    foldChance += avgDanger * 0.3
    
    // 筹码压力
    foldChance += chipPressure * 0.4
    
    // 已投入太多沉没成本，但散牌继续打只会亏更多
    if (investedRatio > 0.3) foldChance += 0.2
    
    // 底池赔率差（需要投入太多）
    if (potOdds > 0.35) foldChance += 0.15
    
    // 对跟注站：绝不诈唬，直接弃牌
    if (callingStationCount > 0) {
      foldChance += 0.3
    }
    
    // 对手可能在诈唬，降低弃牌概率
    if (avgBluffLikelihood > 0.4) foldChance -= 0.2
    if (avgBluffLikelihood > 0.5) foldChance -= 0.15
    
    // 底池赔率很好（便宜看看）
    if (potOdds < 0.15 && chipPressure < 0.1) {
      foldChance -= 0.25
    }
    
    foldChance = Math.max(0.1, Math.min(0.9, foldChance))
    
    if (Math.random() < foldChance) {
      return { action: 'fold' }
    }
    
    // ========== 不弃牌时的决策 ==========
    // 对岩石型：小概率诈唬（只在对手可能弃牌时）
    if (rockCount > 0 && avgFoldPressure > 0.6 && player.chips > callAmount + 20) {
      if (Math.random() < avgFoldPressure * 0.25) {
        return { action: 'raise', amount: 15 + Math.floor(Math.random() * 10) }
      }
    }
    
    // 默认跟注（已经决定不弃牌了）
    return { action: 'call' }
  }

  // ========== 开牌决策V2 ==========
  considerShowdownV2(player, strength, opponentProfiles) {
    if (opponentProfiles.length === 0) return null
    
    const showdownCost = this.getLastActiveBetAmount(player.id)
    if (player.chips < showdownCost) return null
    
    // 找最佳开牌目标：优先选推测最弱的
    const sorted = [...opponentProfiles].sort((a, b) => a.estimatedStrength - b.estimatedStrength)
    const target = sorted[0]
    
    if (!target) return null
    
    // 计算开牌期望值
    const winProb = this.calculateWinProbability(strength, target)
    const ev = winProb * this.state.pot - (1 - winProb) * showdownCost
    
    // 特殊情况：对手是岩石型还没弃牌，他可能有大牌，谨慎开
    if (target.analysis.type === 'rock') {
      if (strength < 6000) return null  // 没有顺子以上不开岩石
    }
    
    // 对手是诈唬倾向高的，更愿意开他
    let showdownChance = 0.25
    if (ev > 0) showdownChance += 0.3
    if (target.analysis.bluffLikelihood > 0.4) showdownChance += 0.2
    if (strength >= 7000) showdownChance += 0.15  // 顺子以上更愿意开
    
    showdownChance = Math.min(0.75, showdownChance)
    
    if (Math.random() < showdownChance) {
      return { action: 'showdown', amount: target.player.id }
    }
    
    return null
  }

  // 计算胜率
  calculateWinProbability(myStrength, targetProfile) {
    const oppStrength = targetProfile.estimatedStrength
    const bluffLikelihood = targetProfile.analysis.bluffLikelihood
    
    // 基础胜率
    let winProb
    if (myStrength >= 8000) winProb = 0.85
    else if (myStrength >= 6000) winProb = 0.7
    else if (myStrength >= 4000) winProb = 0.55
    else if (myStrength >= 3000) winProb = 0.4
    else winProb = 0.25
    
    // 根据对手推测强度调整
    winProb -= oppStrength * 0.3
    
    // 对手诈唬概率高，我们胜率上升
    winProb += bluffLikelihood * 0.15
    
    return Math.max(0.1, Math.min(0.9, winProb))
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

  // 获取最近一个下注玩家的信息
  getLastBettingPlayerInfo(currentSeatIndex) {
    let index = currentSeatIndex
    for (let i = 0; i < 8; i++) {
      index = (index - 1 + 8) % 8
      const player = this.seats[index]
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

  // 根据玩家数动态评估牌力
  evaluateHandStrength(strength, playerCount) {
    if (playerCount <= 3) {
      return {
        isMonster: strength >= 7000,
        isStrong: strength >= 5000,
        isMedium: strength >= 3000,
        isWeak: strength < 3000
      }
    }
    
    if (playerCount <= 5) {
      return {
        isMonster: strength >= 8000,
        isStrong: strength >= 6000,
        isMedium: strength >= 4000,
        isWeak: strength < 4000
      }
    }
    
    return {
      isMonster: strength >= 9000,
      isStrong: strength >= 7000,
      isMedium: strength >= 5000,
      isWeak: strength < 5000
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
    const me = this.seats[seatIndex]
    
    const seats = this.seats.map((p, i) => {
      if (!p) return null
      // 自己的牌始终可见
      if (i === seatIndex) return p.toPrivateJSON()
      
      // 我和这个玩家有开牌关系（无论谁发起、谁输赢、游戏是否结束）
      const myShowdownWith = me?.showdownWith
      const theirShowdownWith = p.showdownWith
      
      // 调试日志
      if (myShowdownWith !== undefined || theirShowdownWith !== undefined) {
        console.log(`🔍 座位${seatIndex}视角看座位${i}: myShowdownWith=${myShowdownWith}, theirShowdownWith=${theirShowdownWith}`)
      }
      
      if (myShowdownWith === i || theirShowdownWith === seatIndex) {
        return p.toFullJSON()
      }
      
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
