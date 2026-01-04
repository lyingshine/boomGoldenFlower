/**
 * 客户端游戏状态 (纯展示层)
 * 只负责存储和展示服务端同步过来的状态
 */
export class ClientGameState {
  constructor() {
    this.seats = new Array(8).fill(null)
    this.phase = 'waiting'
    this.round = 0
    this.currentPlayerIndex = 0
    this.pot = 0
    this.currentBet = 10
    this.dealerIndex = 0
    this.showdownReady = false
    this.winner = null
    this.mySeatIndex = -1
    this.showdownResult = null // 开牌结果
  }

  // 从服务端状态更新
  updateFromServer(state) {
    if (!state) return

    this.phase = state.phase || 'waiting'
    this.round = state.round || 0
    this.currentPlayerIndex = state.currentPlayerIndex || 0
    this.pot = state.pot || 0
    this.currentBet = state.currentBet || 10
    this.dealerIndex = state.dealerIndex || 0
    this.showdownReady = state.showdownReady || false
    this.winner = state.winner || null
    this.showdownResult = state.showdownResult || null
    this.firstRoundComplete = state.firstRoundComplete || false

    // 更新座位信息
    if (state.seats) {
      this.seats = state.seats.map(seat => {
        if (!seat) return null
        return {
          id: seat.id,
          name: seat.name,
          chips: seat.chips,
          type: seat.type,
          currentBet: seat.currentBet || 0,
          lastBetAmount: seat.lastBetAmount || 0,
          lastBetBlind: seat.lastBetBlind || false,
          folded: seat.folded || false,
          lostShowdown: seat.lostShowdown || false,
          hasPeeked: seat.hasPeeked || false,
          isAllIn: seat.isAllIn || false,
          cardCount: seat.cardCount || 0,
          cards: seat.cards || null,
          handType: seat.handType || null
        }
      })
    }
  }

  // 获取活跃玩家
  getActivePlayers() {
    return this.seats.filter(p => p && !p.folded)
  }

  // 获取当前玩家
  getCurrentPlayer() {
    return this.seats[this.currentPlayerIndex]
  }

  // 判断是否是我的回合
  isMyTurn() {
    return this.mySeatIndex === this.currentPlayerIndex
  }

  // 获取我的座位信息
  getMyPlayer() {
    return this.seats[this.mySeatIndex]
  }

  // 判断是否可以看牌
  canPeek() {
    const me = this.getMyPlayer()
    return me && !me.hasPeeked && this.phase === 'betting'
  }

  // 获取上一个未弃牌玩家的信息
  getLastActivePlayerInfo() {
    let index = this.mySeatIndex
    for (let i = 0; i < 8; i++) {
      index = (index - 1 + 8) % 8
      const player = this.seats[index]
      if (player && !player.folded) {
        return {
          lastBetAmount: player.lastBetAmount || this.currentBet,
          lastBetBlind: player.lastBetBlind || false
        }
      }
    }
    return { lastBetAmount: this.currentBet, lastBetBlind: false }
  }

  // 获取最近一个下注玩家的信息（跳过弃牌的）
  getLastBettingPlayerInfo() {
    let index = this.mySeatIndex
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
    return { lastBetAmount: this.currentBet, lastBetBlind: false }
  }

  // 判断是否可以跟注
  canCall() {
    const me = this.getMyPlayer()
    if (!me || me.folded || !this.isMyTurn()) return false
    const callAmount = this.getCallAmount()
    return me.chips > 0 && callAmount > 0
  }

  // 获取跟注金额（考虑双方是否看牌）
  getCallAmount() {
    const me = this.getMyPlayer()
    if (!me) return this.currentBet
    
    const lastInfo = this.getLastBettingPlayerInfo()
    const iBlind = !me.hasPeeked  // 我是否焖牌
    const lastBlind = lastInfo.lastBetBlind  // 上家是否焖牌
    
    // 我焖，上家看：跟一半
    // 我看，上家焖：跟双倍
    // 双方都焖或都看：跟同样金额
    if (iBlind && !lastBlind) {
      return Math.ceil(lastInfo.lastBetAmount / 2)
    } else if (!iBlind && lastBlind) {
      return lastInfo.lastBetAmount * 2
    }
    return lastInfo.lastBetAmount
  }

  // 判断是否可以焖牌
  canBlind() {
    const me = this.getMyPlayer()
    if (!me || me.folded || !this.isMyTurn() || me.hasPeeked) return false
    const minAmount = this.getCallAmount()
    return me.chips >= minAmount
  }

  // 获取焖牌最小金额
  getBlindMinAmount() {
    return this.getCallAmount()
  }

  // 判断是否可以加注
  canRaise() {
    const me = this.getMyPlayer()
    if (!me || me.folded || !this.isMyTurn()) return false
    const callAmount = this.getCallAmount()
    return me.chips > callAmount + 20
  }

  // 判断是否可以开牌
  canShowdown() {
    // 第一轮未完成不能开牌
    if (!this.firstRoundComplete) return false
    const me = this.getMyPlayer()
    if (!me || me.folded || !this.isMyTurn()) return false
    const showdownCost = this.getCallAmount()
    return me.chips >= showdownCost
  }

  // 获取开牌费用
  getShowdownCost() {
    return this.getCallAmount()
  }

  // 获取可开牌的对手列表
  getShowdownTargets() {
    return this.seats.filter((p, i) => 
      p && !p.folded && i !== this.mySeatIndex
    )
  }

  // 获取状态描述
  getStatusMessage() {
    switch (this.phase) {
      case 'waiting': return '等待开始游戏'
      case 'dealing': return '正在发牌...'
      case 'betting': return '下注阶段'
      case 'showdown': return '开牌比较'
      case 'ended': return this.winner ? `${this.winner.name} 获胜` : '游戏结束'
      default: return '游戏进行中'
    }
  }

  // 重置状态
  reset() {
    this.seats = new Array(8).fill(null)
    this.phase = 'waiting'
    this.round = 0
    this.currentPlayerIndex = 0
    this.pot = 0
    this.currentBet = 10
    this.showdownReady = false
    this.winner = null
    this.showdownResult = null
  }

  // 从玩家列表更新座位（用于玩家加入/离开时）
  updateSeatsFromPlayers(players) {
    if (!players) return
    // 先清空
    this.seats = new Array(8).fill(null)
    // 填入玩家
    players.forEach(p => {
      const idx = p.seatIndex ?? p.id
      if (idx >= 0 && idx < 8) {
        this.seats[idx] = {
          id: idx,
          name: p.name,
          chips: p.chips || 1000,
          type: p.type,
          currentBet: 0,
          folded: false,
          hasPeeked: false,
          isAllIn: false,
          cardCount: 0,
          cards: null
        }
      }
    })
  }
}
