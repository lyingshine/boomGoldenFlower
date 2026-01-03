import { Hand } from './Hand.js'

/**
 * 玩家类 (服务端)
 */
export class Player {
  constructor(id, name, chips, type = 'human') {
    this.id = id
    this.name = name
    this.chips = chips
    this.type = type
    this.hand = new Hand()
    this.currentBet = 0
    this.lastBetAmount = 0 // 这一手下注的金额
    this.lastBetBlind = false // 这一手是否焖牌
    this.folded = false
    this.hasPeeked = false
    this.isAllIn = false
    this.hasActed = false
  }

  addCard(card) {
    this.hand.addCard(card)
  }

  bet(amount) {
    const actual = Math.min(amount, this.chips)
    this.chips -= actual
    this.currentBet += actual
    this.lastBetAmount = actual // 记录这一手的下注金额
    if (this.chips === 0) this.isAllIn = true
    return actual
  }

  fold() {
    this.folded = true
  }

  peek() {
    this.hasPeeked = true
  }

  reset() {
    this.hand.clear()
    this.currentBet = 0
    this.lastBetAmount = 0
    this.lastBetBlind = false
    this.folded = false
    this.hasPeeked = false
    this.isAllIn = false
    this.hasActed = false
  }

  // 公开信息
  toPublicJSON() {
    return {
      id: this.id,
      name: this.name,
      chips: this.chips,
      type: this.type,
      currentBet: this.currentBet,
      lastBetAmount: this.lastBetAmount,
      lastBetBlind: this.lastBetBlind,
      folded: this.folded,
      hasPeeked: this.hasPeeked,
      isAllIn: this.isAllIn,
      cardCount: this.hand.cards.length
    }
  }

  // 私有信息（含手牌）
  toPrivateJSON() {
    return {
      ...this.toPublicJSON(),
      cards: this.hand.toJSON()
    }
  }

  // 完整信息（开牌用）
  toFullJSON() {
    return {
      ...this.toPublicJSON(),
      cards: this.hand.toJSON(),
      handType: this.hand.getType()
    }
  }
}
