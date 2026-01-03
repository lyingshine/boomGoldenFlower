import { Deck } from '../models/Deck.js'
import { Player } from '../models/Player.js'
import { EventEmitter } from './EventEmitter.js'
import { GameState } from './GameState.js'

/**
 * 游戏引擎 - 负责游戏逻辑控制
 */
export class GameEngine extends EventEmitter {
  constructor(customPlayers = null) {
    super()
    this.players = []
    this.deck = null
    this.gameState = new GameState()
    this.dealingDelay = 100 // 发牌延迟
    this.actionDelay = 800 // AI行动延迟
    
    if (customPlayers) {
      this.initializeCustomPlayers(customPlayers)
    } else {
      this.initializePlayers()
    }
  }

  initializeCustomPlayers(customPlayers) {
    // 8个固定座位：底部4个(0,1,2,3)，右侧2个(4,5)，左侧2个(6,7)
    const availableSeats = [0, 1, 2, 3, 4, 5, 6, 7]
    const selectedSeats = this.shuffleArray(availableSeats).slice(0, customPlayers.length).sort((a, b) => a - b)
    
    // 创建8个座位的数组，只在选中的座位放置玩家
    this.players = new Array(8).fill(null)
    const shuffledPlayers = this.shuffleArray([...customPlayers])
    
    selectedSeats.forEach((seatIndex, i) => {
      const p = shuffledPlayers[i]
      // 直接使用座位索引作为玩家ID，确保一致性
      this.players[seatIndex] = new Player(seatIndex, p.name, p.chips, p.type)
    })
  }

  initializePlayers() {
    // 创建4个玩家（1个人类玩家 + 3个AI）
    const aiNames = ['小明', '小红', '小刚']
    const playerData = [
      { name: '玩家', chips: 1000, type: 'human' },
      ...aiNames.map(name => ({ name, chips: 1000, type: 'ai' }))
    ]
    
    // 8个固定座位：底部4个(0,1,2,3)，右侧2个(4,5)，左侧2个(6,7)
    const availableSeats = [0, 1, 2, 3, 4, 5, 6, 7]
    const selectedSeats = this.shuffleArray(availableSeats).slice(0, 4).sort((a, b) => a - b)
    
    // 创建8个座位的数组，只在选中的座位放置玩家
    this.players = new Array(8).fill(null)
    const shuffledPlayerData = this.shuffleArray(playerData)
    
    selectedSeats.forEach((seatIndex, i) => {
      const p = shuffledPlayerData[i]
      // 直接使用座位索引作为玩家ID，确保一致性
      this.players[seatIndex] = new Player(seatIndex, p.name, p.chips, p.type)
    })
  }

  // 数组随机打乱
  shuffleArray(array) {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  getPlayers() {
    // 只返回非空座位的玩家
    return this.players.filter(p => p !== null)
  }

  getAllSeats() {
    // 返回所有8个座位（包括空座位）
    return this.players
  }

  getGameState() {
    return {
      players: this.players,
      currentPlayerIndex: this.gameState.currentPlayerIndex,
      pot: this.gameState.pot,
      currentBet: this.gameState.currentBet,
      gamePhase: this.gameState.phase,
      status: this.gameState.getStatusMessage(),
      canPeek: this.gameState.canPeek(0), // 玩家是否可以看牌
      canShowdown: this.gameState.canShowdown()
    }
  }

  startNewRound() {
    this.deck = new Deck()
    this.gameState.startNewRound()

    // 重置玩家状态（只重置非空座位）
    this.players.forEach(player => {
      if (player !== null) {
        player.resetForNewRound()
      }
    })

    this.emit('gameStateChanged', this.getGameState())
    this.emit('roundStarted', { round: this.gameState.round })

    // 开始发牌流程
    setTimeout(() => {
      this.startDealing()
    }, 1000)
  }

  // 发牌流程
  async startDealing() {
    this.gameState.setPhase('dealing')
    this.emit('gameStateChanged', this.getGameState())
    this.emit('dealingStarted', {})

    // 按玩家顺序一圈一圈发牌，每个玩家发3张
    for (let cardIndex = 0; cardIndex < 3; cardIndex++) {
      for (let playerIndex = 0; playerIndex < this.players.length; playerIndex++) {
        const player = this.players[playerIndex]
        if (player !== null && !player.folded) {
          await this.dealCardToPlayer(player, cardIndex)
        }
      }
    }

    // 发牌完成，收取底注
    this.gameState.dealingComplete = true
    this.collectAntes()
    this.gameState.setPhase('betting')
    
    // 设置第一个玩家为当前玩家（找到第一个非空座位）
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i] !== null && !this.players[i].folded) {
        this.gameState.currentPlayerIndex = i
        break
      }
    }
    
    this.emit('dealingComplete', {})
    this.emit('gameStateChanged', this.getGameState())
    this.emit('playerAction', { message: '🎲 发牌完成，开始下注' })
    
    // 如果第一个玩家是AI，自动处理
    if (this.players[this.gameState.currentPlayerIndex].type === 'ai') {
      this.processAITurn()
    }
  }

  // 给玩家发一张牌
  async dealCardToPlayer(player, cardIndex) {
    return new Promise(resolve => {
      setTimeout(() => {
        const card = this.deck.dealCard()
        player.addCard(card)
        
        this.emit('cardDealt', { 
          player: player, 
          card: card, 
          cardIndex: cardIndex 
        })
        
        resolve()
      }, this.dealingDelay)
    })
  }

  collectAntes() {
    // 收取底注（只对非空座位）
    this.players.forEach(player => {
      if (player !== null && !player.folded && player.chips > 0) {
        const ante = Math.min(this.gameState.currentBet, player.chips)
        player.bet(ante)
        this.gameState.pot += ante
      }
    })
  }

  // 玩家看牌
  playerPeek() {
    const humanPlayer = this.players.find(p => p !== null && p.type === 'human')
    if (!humanPlayer || this.gameState.phase !== 'betting') {
      return false
    }

    humanPlayer.hasPeeked = true
    this.emit('playerPeeked', { player: humanPlayer })
    this.emit('gameStateChanged', this.getGameState())
    return true
  }

  // 玩家行动
  playerAction(action, amount = 0) {
    const player = this.players[this.gameState.currentPlayerIndex]
    
    console.log(`🎮 玩家操作: ${action}, 座位${this.gameState.currentPlayerIndex}`)
    console.log(`当前玩家:`, player ? `${player.name} (${player.type})` : 'null')
    console.log(`游戏阶段: ${this.gameState.phase}`)
    
    if (!player || player.type !== 'human' || this.gameState.phase !== 'betting') {
      console.log('⚠️ 操作无效: 玩家不存在、不是人类或不在下注阶段')
      return false
    }

    let success = false
    switch (action) {
      case 'peek':
        success = this.playerPeek()
        break
      case 'call':
        success = this.handleCall(player)
        break
      case 'raise':
        success = this.handleRaise(player, amount)
        break
      case 'fold':
        success = this.handleFold(player)
        break
      case 'showdown':
        success = this.handleShowdown()
        break
    }

    console.log(`操作结果: ${success ? '成功' : '失败'}`)

    if (success) {
      this.nextPlayer()
    }
    
    return success
  }

  handleCall(player) {
    const callAmount = Math.min(this.gameState.currentBet - player.currentBet, player.chips)
    if (callAmount < 0) return false

    // 如果跟注金额为0，相当于过牌
    if (callAmount === 0) {
      player.hasActedThisRound = true
      this.emit('playerAction', { 
        player: player.name, 
        action: 'check', 
        amount: 0,
        newChips: player.chips,
        message: `✋ ${player.name} 过牌`
      })
      return true
    }

    player.bet(callAmount)
    this.gameState.pot += callAmount
    player.hasActedThisRound = true

    // 检查是否全押
    const isAllIn = player.chips === 0
    
    this.gameState.addToHistory({
      type: isAllIn ? 'allin' : 'call',
      player: player.name,
      amount: callAmount
    })

    this.emit('playerAction', { 
      player: player.name, 
      action: isAllIn ? 'allin' : 'call', 
      amount: callAmount,
      newChips: player.chips,
      message: isAllIn ? `💰 ${player.name} 全押 ¥${callAmount}` : `💰 ${player.name} 跟注 ¥${callAmount}`
    })

    return true
  }

  handleRaise(player, raiseAmount) {
    const callAmount = this.gameState.currentBet - player.currentBet
    const totalBet = this.gameState.currentBet + raiseAmount
    const betAmount = Math.min(totalBet - player.currentBet, player.chips)
    
    // 确保加注金额大于跟注金额
    if (betAmount <= callAmount) return false

    player.bet(betAmount)
    this.gameState.pot += betAmount
    this.gameState.currentBet = player.currentBet
    
    // 检查是否全押
    const isAllIn = player.chips === 0
    
    // 加注后，重置所有玩家的行动状态（除了当前玩家和已全押的玩家）
    this.players.forEach(p => {
      if (p !== null && !p.folded && p.id !== player.id && !p.isAllIn) {
        p.hasActedThisRound = false
      }
    })
    player.hasActedThisRound = true

    this.gameState.addToHistory({
      type: isAllIn ? 'allin' : 'raise',
      player: player.name,
      amount: betAmount,
      newBet: this.gameState.currentBet
    })

    this.emit('playerAction', { 
      player: player.name, 
      action: isAllIn ? 'allin' : 'raise', 
      amount: betAmount,
      newChips: player.chips,
      newBet: this.gameState.currentBet,
      message: isAllIn ? `💰 ${player.name} 全押 ¥${betAmount}` : `📈 ${player.name} 加注到 ¥${this.gameState.currentBet}`
    })

    return true
  }

  handleFold(player) {
    player.fold()
    player.hasActedThisRound = true
    
    this.gameState.addToHistory({
      type: 'fold',
      player: player.name
    })

    this.emit('playerAction', { 
      player: player.name, 
      action: 'fold',
      message: `🚫 ${player.name} 弃牌`
    })

    return true
  }

  handleShowdown() {
    this.gameState.setPhase('showdown')
    this.endGame()
    return true
  }

  processAITurn() {
    const player = this.players[this.gameState.currentPlayerIndex]
    
    console.log(`🤖 processAITurn: 座位${this.gameState.currentPlayerIndex}`)
    
    if (!player || player.type !== 'ai' || player.folded) {
      console.log('⚠️ 玩家无效或已弃牌，跳过')
      this.nextPlayer()
      return
    }

    console.log(`AI ${player.name} 正在决策...`)
    // AI决策逻辑
    const decision = this.makeAIDecision(player)
    console.log(`AI ${player.name} 决定: ${decision.action}`, decision.amount ? `金额: ${decision.amount}` : '')

    setTimeout(() => {
      let actionData = null
      switch (decision.action) {
        case 'call':
          this.handleCall(player)
          actionData = { action: 'call', playerName: player.name }
          break
        case 'raise':
          this.handleRaise(player, decision.amount)
          actionData = { action: 'raise', playerName: player.name, amount: decision.amount }
          break
        case 'fold':
          this.handleFold(player)
          actionData = { action: 'fold', playerName: player.name }
          break
        case 'showdown':
          this.handleShowdown()
          actionData = { action: 'showdown', playerName: player.name }
          return
      }
      
      // 触发AI动作事件供网络同步
      if (actionData) {
        this.emit('aiAction', actionData)
      }
      
      setTimeout(() => {
        this.nextPlayer()
      }, 500)
    }, this.actionDelay)
  }

  makeAIDecision(player) {
    const handType = player.hand.getHandType()
    const handStrength = handType.weight
    const callAmount = this.gameState.currentBet - player.currentBet
    const activePlayers = this.players.filter(p => p !== null && !p.folded).length
    const chipRatio = player.chips / (this.gameState.pot + callAmount) // 筹码与底池比例
    
    // 如果筹码不足跟注，只能弃牌或全押
    if (player.chips < callAmount) {
      // 强牌全押，弱牌弃牌
      return handStrength > 5000 ? { action: 'call' } : { action: 'fold' }
    }
    
    // 根据牌力和情况决定行动
    if (handStrength >= 8000) { // 豹子（三条）
      // 最强牌，90%加注
      if (Math.random() > 0.1 && player.chips >= callAmount + 30) {
        return { action: 'raise', amount: 30 }
      }
      return { action: 'call' }
    } else if (handStrength >= 7000) { // 同花顺
      // 非常强的牌，70%加注
      if (Math.random() > 0.3 && player.chips >= callAmount + 25) {
        return { action: 'raise', amount: 25 }
      }
      return { action: 'call' }
    } else if (handStrength >= 6000) { // 同花
      // 强牌，50%加注，50%跟注
      if (Math.random() > 0.5 && player.chips >= callAmount + 20) {
        return { action: 'raise', amount: 20 }
      }
      return { action: 'call' }
    } else if (handStrength >= 5000) { // 顺子
      // 中等牌，60%跟注，40%弃牌
      return Math.random() > 0.4 ? { action: 'call' } : { action: 'fold' }
    } else if (handStrength >= 4000) { // 对子
      // 弱牌，考虑底池赔率
      if (chipRatio > 3) { // 底池很大，值得跟注
        return Math.random() > 0.5 ? { action: 'call' } : { action: 'fold' }
      }
      return Math.random() > 0.7 ? { action: 'call' } : { action: 'fold' }
    } else { // 高牌
      // 最弱牌
      if (activePlayers <= 2 && Math.random() > 0.85 && player.chips >= callAmount + 15) {
        // 只剩两人时，15%概率诈唬
        return { action: 'raise', amount: 15 }
      }
      // 底池很大且跟注金额小，可以尝试
      if (chipRatio > 5 && callAmount < player.chips * 0.1) {
        return Math.random() > 0.7 ? { action: 'call' } : { action: 'fold' }
      }
      return Math.random() > 0.9 ? { action: 'call' } : { action: 'fold' }
    }
  }

  nextPlayer() {
    const activePlayers = this.players.filter(p => p !== null && !p.folded)
    
    console.log('=== nextPlayer 调用 ===')
    console.log('活跃玩家数:', activePlayers.length)
    console.log('当前座位索引:', this.gameState.currentPlayerIndex)
    
    if (activePlayers.length <= 1) {
      console.log('只剩1个玩家，游戏结束')
      this.endGame()
      return
    }

    // 检查是否所有活跃玩家都已行动且下注相等
    // 全押玩家无需再行动，所以排除他们
    const playersNeedAction = activePlayers.filter(p => !p.isAllIn)
    const allActed = playersNeedAction.every(p => p.hasActedThisRound)
    const allBetsEqual = activePlayers.every(p => p.currentBet === this.gameState.currentBet || p.isAllIn)
    
    console.log('所有玩家已行动:', allActed)
    console.log('所有下注相等:', allBetsEqual)
    console.log('玩家行动状态:', activePlayers.map(p => `${p.name}(座位${this.players.indexOf(p)}): 已行动=${p.hasActedThisRound}, 下注=${p.currentBet}, 全押=${p.isAllIn}`))
    
    if (allActed && allBetsEqual) {
      // 所有玩家都已行动且下注相等，可以开牌了
      console.log('✅ 可以开牌了')
      this.gameState.showdownReady = true
      this.emit('showdownReady', {})
    }
    
    // 检查是否还有可以行动的玩家（未弃牌且未全押）
    const canActPlayers = activePlayers.filter(p => !p.isAllIn)
    if (canActPlayers.length === 0) {
      // 所有活跃玩家都已全押，直接结束游戏
      console.log('⚠️ 所有活跃玩家都已全押，直接开牌')
      this.endGame()
      return
    }

    // 移动到下一个活跃玩家（跳过弃牌和全押的玩家）
    const oldIndex = this.gameState.currentPlayerIndex
    let attempts = 0
    do {
      this.gameState.currentPlayerIndex = (this.gameState.currentPlayerIndex + 1) % this.players.length
      attempts++
      // 防止死循环
      if (attempts > this.players.length) {
        console.warn('⚠️ 找不到下一个玩家，可能所有玩家都已全押或弃牌')
        this.endGame()
        return
      }
    } while (
      this.players[this.gameState.currentPlayerIndex] === null || 
      this.players[this.gameState.currentPlayerIndex].folded ||
      this.players[this.gameState.currentPlayerIndex].isAllIn
    )

    const newPlayer = this.players[this.gameState.currentPlayerIndex]
    console.log(`移动玩家: 座位${oldIndex} -> 座位${this.gameState.currentPlayerIndex} (${newPlayer.name}, ${newPlayer.type})`)

    this.emit('gameStateChanged', this.getGameState())

    // 如果是AI回合，自动处理
    if (this.players[this.gameState.currentPlayerIndex].type === 'ai') {
      console.log(`🤖 AI玩家 ${newPlayer.name} 开始思考...`)
      this.processAITurn()
    } else {
      console.log(`🎮 等待人类玩家 ${newPlayer.name} 操作`)
    }
  }

  endGame() {
    this.gameState.setPhase('showdown')
    const activePlayers = this.players.filter(p => p !== null && !p.folded)
    
    let winner
    if (activePlayers.length === 1) {
      // 只有一个玩家未弃牌
      winner = activePlayers[0]
    } else {
      // 比较牌型
      winner = this.compareHands(activePlayers)
    }
    
    winner.chips += this.gameState.pot
    this.gameState.setWinner(winner)

    this.gameState.addToHistory({
      type: 'gameEnd',
      winner: winner.name,
      pot: this.gameState.pot,
      handType: winner.hand.getHandType().type
    })
    
    this.emit('gameEnded', { 
      winner: winner, 
      pot: this.gameState.pot,
      activePlayers: activePlayers
    })
  }

  compareHands(players) {
    return players.reduce((winner, player) => {
      const winnerHand = winner.hand.getHandType()
      const playerHand = player.hand.getHandType()
      
      return playerHand.weight > winnerHand.weight ? player : winner
    })
  }
}