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
    
    // 计算牌面分数（用于同牌型比较）
    const cardScore = values[0] * 225 + values[1] * 15 + values[2]  // 最大 14*225+13*15+12 = 3357

    // 豹子 (8000-8999)
    if (values[0] === values[1] && values[1] === values[2]) {
      return { type: 'leopard', weight: 8000 + values[0] }
    }

    // 同花顺 (7000-7999)
    if (isFlush && isStraight) {
      const w = (values[0] === 14 && values[1] === 3) ? 1 : values[0]
      return { type: 'straight_flush', weight: 7000 + w }
    }

    // 同花 (6000-6999)
    if (isFlush) {
      return { type: 'flush', weight: 6000 + cardScore * 0.29 }  // 最大约 6973
    }

    // 顺子 (5000-5999)
    if (isStraight) {
      const w = (values[0] === 14 && values[1] === 3) ? 1 : values[0]
      return { type: 'straight', weight: 5000 + w }
    }

    // 对子 (4000-4999)
    if (values[0] === values[1] || values[1] === values[2] || values[0] === values[2]) {
      const pair = values[0] === values[1] ? values[0] : values[1] === values[2] ? values[1] : values[2]
      const kicker = values.find(v => v !== pair)
      return { type: 'pair', weight: 4000 + pair * 15 + kicker }  // 最大 4000+210+13=4223
    }

    // 高牌 (1000-1999)
    return { type: 'high_card', weight: 1000 + cardScore * 0.29 }  // 最大约 1973
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
