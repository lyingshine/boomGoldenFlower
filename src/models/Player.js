import { Hand } from './Hand.js'

/**
 * 玩家类
 */
export class Player {
  constructor(id, name, chips, type = 'human') {
    this.id = id
    this.name = name
    this.chips = chips
    this.type = type // 'human' 或 'ai'
    this.hand = new Hand()
    this.currentBet = 0
    this.folded = false
    this.totalBetThisRound = 0
    this.hasPeeked = false // 是否已看牌
    this.isAllIn = false // 是否全押
    this.hasActedThisRound = false // 本轮是否已行动
  }

  // 添加牌到手牌
  addCard(card) {
    this.hand.addCard(card)
  }

  // 下注
  bet(amount) {
    const actualBet = Math.min(amount, this.chips)
    this.chips -= actualBet
    this.currentBet += actualBet
    this.totalBetThisRound += actualBet
    
    // 检查是否全押
    if (this.chips === 0) {
      this.isAllIn = true
    }
    
    return actualBet
  }

  // 弃牌
  fold() {
    this.folded = true
  }

  // 看牌
  peek() {
    this.hasPeeked = true
  }

  // 重置新一轮
  resetForNewRound() {
    this.hand.clear()
    this.currentBet = 0
    this.folded = false
    this.totalBetThisRound = 0
    this.hasPeeked = false
    this.isAllIn = false
    this.hasActedThisRound = false
  }

  // 获取手牌信息
  getHandInfo() {
    return {
      cards: this.hand.getCards(),
      type: this.hand.getHandType(),
      hasPeeked: this.hasPeeked
    }
  }

  // 是否可以继续游戏
  canContinue() {
    return this.chips > 0 && !this.folded
  }

  // 获取玩家状态
  getStatus() {
    if (this.folded) return 'folded'
    if (this.isAllIn) return 'all-in'
    if (this.hasPeeked) return 'peeked'
    return 'active'
  }

  // 获取显示名称（包含状态图标）
  getDisplayName() {
    let statusIcon = ''
    switch (this.getStatus()) {
      case 'folded':
        statusIcon = '🚫'
        break
      case 'all-in':
        statusIcon = '💰'
        break
      case 'peeked':
        statusIcon = '👁️'
        break
      default:
        statusIcon = ''
    }
    return `${statusIcon} ${this.name}`.trim()
  }

  toString() {
    return `${this.getDisplayName()} (筹码: ${this.chips}, 手牌: ${this.hand.toString()})`
  }
}