/**
 * 游戏状态管理器
 */
export class GameState {
  constructor() {
    this.phase = 'waiting' // waiting, dealing, betting, peeking, showdown
    this.round = 0
    this.currentPlayerIndex = 0
    this.pot = 0
    this.currentBet = 10
    this.minRaise = 10
    this.dealingComplete = false
    this.peekingAllowed = true
    this.showdownReady = false
    this.winner = null
    this.gameHistory = []
  }

  // 设置游戏阶段
  setPhase(phase) {
    const validPhases = ['waiting', 'dealing', 'betting', 'peeking', 'showdown', 'ended']
    if (validPhases.includes(phase)) {
      this.phase = phase
      return true
    }
    return false
  }

  // 获取当前阶段
  getPhase() {
    return this.phase
  }

  // 开始新一轮
  startNewRound() {
    this.round++
    this.phase = 'dealing'
    this.pot = 0
    this.currentBet = 10
    this.dealingComplete = false
    this.peekingAllowed = true
    this.showdownReady = false
    this.winner = null
    this.currentPlayerIndex = 0
  }

  // 发牌完成
  setDealingComplete() {
    this.dealingComplete = true
    this.phase = 'betting'
  }

  // 是否可以看牌
  canPeek(playerId) {
    return this.peekingAllowed && this.phase === 'betting'
  }

  // 是否可以下注
  canBet(playerId) {
    return this.phase === 'betting' && this.currentPlayerIndex === playerId
  }

  // 是否可以开牌
  canShowdown() {
    return this.showdownReady || this.phase === 'showdown'
  }

  // 设置获胜者
  setWinner(winner) {
    this.winner = winner
    this.phase = 'ended'
  }

  // 获取游戏状态描述
  getStatusMessage() {
    switch (this.phase) {
      case 'waiting':
        return '等待开始游戏'
      case 'dealing':
        return '正在发牌...'
      case 'betting':
        return '下注阶段'
      case 'peeking':
        return '看牌阶段'
      case 'showdown':
        return '开牌比较'
      case 'ended':
        return `游戏结束，${this.winner?.name || '未知'} 获胜`
      default:
        return '游戏进行中'
    }
  }

  // 记录游戏历史
  addToHistory(action) {
    this.gameHistory.push({
      round: this.round,
      timestamp: Date.now(),
      action: action
    })
  }

  // 获取游戏历史
  getHistory() {
    return this.gameHistory
  }

  // 重置游戏
  reset() {
    this.phase = 'waiting'
    this.round = 0
    this.currentPlayerIndex = 0
    this.pot = 0
    this.currentBet = 10
    this.dealingComplete = false
    this.peekingAllowed = true
    this.showdownReady = false
    this.winner = null
    this.gameHistory = []
  }
}