/**
 * 游戏状态管理 (服务端)
 */
export class GameState {
  constructor() {
    this.phase = 'waiting'
    this.round = 0
    this.currentPlayerIndex = 0
    this.pot = 0
    this.currentBet = 10
    this.dealerIndex = 0
    this.showdownReady = false
    this.winner = null
    this.showdownResult = null // 开牌结果
    this.lastWinnerIndex = -1 // 上一局赢家座位
    this.firstRoundComplete = false // 第一轮是否完成（完成后才能开牌）
    this.actionCount = 0 // 本局行动次数计数
    this.initialPlayerCount = 0 // 本局初始玩家数
  }

  setPhase(phase) {
    const valid = ['waiting', 'dealing', 'betting', 'showdown', 'ended']
    if (valid.includes(phase)) {
      this.phase = phase
      return true
    }
    return false
  }

  startRound() {
    this.round++
    this.phase = 'dealing'
    this.pot = 0
    this.currentBet = 10
    this.showdownReady = false
    this.winner = null
    this.firstRoundComplete = false // 新一局开始，重置第一轮状态
    this.actionCount = 0
    this.initialPlayerCount = 0
  }

  reset() {
    this.phase = 'waiting'
    this.round = 0
    this.currentPlayerIndex = 0
    this.pot = 0
    this.currentBet = 10
    this.showdownReady = false
    this.winner = null
    this.showdownResult = null
    this.firstRoundComplete = false
    this.actionCount = 0
    this.initialPlayerCount = 0
  }

  toJSON() {
    return {
      phase: this.phase,
      round: this.round,
      currentPlayerIndex: this.currentPlayerIndex,
      pot: this.pot,
      currentBet: this.currentBet,
      dealerIndex: this.dealerIndex,
      showdownReady: this.showdownReady,
      winner: this.winner,
      showdownResult: this.showdownResult,
      lastWinnerIndex: this.lastWinnerIndex,
      firstRoundComplete: this.firstRoundComplete
    }
  }
}
