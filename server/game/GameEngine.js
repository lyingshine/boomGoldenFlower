import { Deck } from '../models/Deck.js'
import { Player } from '../models/Player.js'
import { GameState } from './GameState.js'
import { AIDecisionMaker } from './AIDecisionMaker.js'
import { generateAIMessage } from './AIMessageGenerator.js'
import * as BettingHandler from './handlers/BettingHandler.js'
import { handleShowdown as processShowdown } from './handlers/ShowdownHandler.js'
import { saveGameReplay } from '../db/aiRepository.js'

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
    this.aiDecisionMaker = new AIDecisionMaker(this)
    
    // 异步加载 AI 策略调整参数
    this.aiDecisionMaker.loadStrategyAdjustments().catch(() => {})
  }

  addPlayer(seatIndex, name, chips, type = 'human', waitingForNextRound = false, avatarUrl = null) {
    if (seatIndex < 0 || seatIndex >= 8 || this.seats[seatIndex]) return false
    const player = new Player(seatIndex, name, chips, type)
    // 中途加入的玩家标记为等待下一局，本局不参与
    if (waitingForNextRound) {
      player.waitingForNextRound = true
      player.folded = true  // 本局视为已弃牌
    }
    // 设置头像
    if (avatarUrl) {
      player.avatarUrl = avatarUrl
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

    // 清除上一局的 AI 记忆和复盘记录
    this.aiDecisionMaker.clearSessionMemory()
    this.aiDecisionMaker.clearReplayLog()

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

    // 记录玩家行为到 AI 记忆
    if (player.type !== 'ai') {
      this.aiDecisionMaker.recordAction(
        player.name, action, amount, 
        this.state.round, player.hasPeeked
      )
    }

    // 记录到复盘日志（人类玩家）
    if (player.type === 'human') {
      this.aiDecisionMaker.logPlayerAction(player.name, 'human', action, amount)
    }

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
    return BettingHandler.getCallAmountForPlayer(this, player)
  }

  handleCall(player) {
    return BettingHandler.handleCall(this, player)
  }

  handleRaise(player, raiseAmount) {
    return BettingHandler.handleRaise(this, player, raiseAmount)
  }

  // 焖牌：不看牌下注，下家看牌要跟双倍
  handleBlind(player, blindAmount) {
    return BettingHandler.handleBlind(this, player, blindAmount)
  }

  // 获取上一个未弃牌玩家的信息
  getLastActivePlayerInfo(currentSeatIndex) {
    return BettingHandler.getLastBettingPlayerInfo(this, currentSeatIndex)
  }

  // 获取最近一个下注玩家的信息（跳过弃牌的，用于判断焖牌状态）
  getLastBettingPlayerInfo(currentSeatIndex) {
    return BettingHandler.getLastBettingPlayerInfo(this, currentSeatIndex)
  }

  // 获取上一个未弃牌玩家这一手的下注金额
  getLastActiveBetAmount(currentSeatIndex) {
    return BettingHandler.getLastActiveBetAmount(this, currentSeatIndex)
  }

  // 开牌：选择一个对手比牌，输的弃牌
  handleShowdown(challenger, targetSeatIndex) {
    return processShowdown(this, challenger, targetSeatIndex)
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

    // 保存复盘记录
    const replay = this.aiDecisionMaker.getFormattedReplay()
    replay.winnerName = winner.name
    replay.potSize = this.state.pot
    saveGameReplay(replay).catch(e => console.error('保存复盘失败:', e.message))

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
    const decision = await this.aiDecisionMaker.makeDecision(seatIndex)
    
    // 记录 AI 操作到复盘日志（带决策思路）
    if (decision && player) {
      const activePlayers = this.getActivePlayers().filter(p => p.id !== seatIndex)
      const opponentProfiles = await this.aiDecisionMaker.getOpponentProfiles(seatIndex, activePlayers)
      const position = this.aiDecisionMaker.calculatePosition(seatIndex, activePlayers)
      const handEval = player.hasPeeked ? this.aiDecisionMaker.evaluateHandStrength(
        player.hand.getType().weight,
        activePlayers.length + 1,
        position
      ) : null
      
      const reasoning = this.aiDecisionMaker.generateReasoning(player, decision, {
        strength: player.hasPeeked ? player.hand.getType().weight : null,
        handEval,
        opponentProfiles,
        round: this.state.round,
        position,
        callAmount: this.getCallAmountForPlayer(player),
        player
      })
      
      this.aiDecisionMaker.logPlayerAction(player.name, 'ai', decision.action, decision.amount, { reasoning })
    }
    
    return decision
  }









  // AI 生成聊天消息（委托给 AIMessageGenerator）
  generateAIMessage(seatIndex, action, context = {}) {
    const player = this.seats[seatIndex]
    return generateAIMessage(player, action, context)
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
