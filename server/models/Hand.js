import { Card } from './Card.js'

/**
 * 手牌类 (服务端)
 */
export class Hand {
  constructor() {
    this.cards = []
  }

  addCard(card) {
    if (this.cards.length >= 3) throw new Error('手牌已满')
    this.cards.push(card)
  }

  clear() {
    this.cards = []
  }

  // 整理手牌（按点数从大到小排序）
  sort() {
    this.cards.sort((a, b) => b.getValue() - a.getValue())
  }

  getType() {
    if (this.cards.length !== 3) return { type: 'incomplete', weight: 0 }

    const sorted = [...this.cards].sort((a, b) => b.getValue() - a.getValue())
    const values = sorted.map(c => c.getValue())
    const suits = sorted.map(c => c.suit)

    const isFlush = suits.every(s => s === suits[0])
    const isStraight = this.checkStraight(values)

    // 豹子
    if (values[0] === values[1] && values[1] === values[2]) {
      return { type: 'leopard', weight: 8000 + values[0] }
    }

    // 同花顺
    if (isFlush && isStraight) {
      const w = (values[0] === 14 && values[1] === 3) ? 1 : values[0]
      return { type: 'straight_flush', weight: 7000 + w }
    }

    // 同花
    if (isFlush) {
      return { type: 'flush', weight: 6000 + values[0] * 100 + values[1] * 10 + values[2] }
    }

    // 顺子（比对子大）
    if (isStraight) {
      const w = (values[0] === 14 && values[1] === 3) ? 1 : values[0]
      return { type: 'straight', weight: 5000 + w }
    }

    // 对子（比顺子小）
    if (values[0] === values[1] || values[1] === values[2] || values[0] === values[2]) {
      const pair = values[0] === values[1] ? values[0] : values[1] === values[2] ? values[1] : values[2]
      const kicker = values.find(v => v !== pair)
      return { type: 'pair', weight: 3000 + pair * 100 + kicker }
    }

    // 高牌
    return { type: 'high_card', weight: values[0] * 100 + values[1] * 10 + values[2] }
  }

  checkStraight(values) {
    // A-2-3 特殊顺子（最小）
    if (values[0] === 14 && values[1] === 3 && values[2] === 2) return true
    // 普通顺子：连续递减（Q-K-A 会正确判断，K-A-2 会被排除）
    return values[0] - values[1] === 1 && values[1] - values[2] === 1
  }

  toJSON() {
    return this.cards.map(c => c.toJSON())
  }
}
