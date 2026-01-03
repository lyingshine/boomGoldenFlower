/**
 * 手牌类
 */
export class Hand {
  constructor() {
    this.cards = [];
  }

  // 添加牌
  addCard(card) {
    if (this.cards.length >= 3) {
      throw new Error('手牌不能超过3张');
    }
    this.cards.push(card);
  }

  // 获取手牌
  getCards() {
    return [...this.cards];
  }

  // 清空手牌
  clear() {
    this.cards = [];
  }

  // 获取手牌类型和权重
  getHandType() {
    if (this.cards.length !== 3) {
      return { type: 'incomplete', weight: 0 };
    }

    // 使用副本排序，避免修改原数组顺序
    const sortedCards = [...this.cards].sort((a, b) => b.getValue() - a.getValue());
    const values = sortedCards.map(card => card.getValue());
    const suits = sortedCards.map(card => card.suit);

    // 豹子（三条）
    if (values[0] === values[1] && values[1] === values[2]) {
      return { type: 'leopard', weight: 8000 + values[0] };
    }

    // 同花顺
    const isFlush = suits.every(suit => suit === suits[0]);
    const isStraight = this.isStraight(values);
    
    if (isFlush && isStraight) {
      // A-2-3 同花顺权重最小
      const weight = (values[0] === 14 && values[1] === 3 && values[2] === 2) 
        ? 7000 + 1  // 最小权重
        : 7000 + values[0];
      return { type: 'straight_flush', weight };
    }

    // 同花
    if (isFlush) {
      return { type: 'flush', weight: 6000 + values[0] * 100 + values[1] * 10 + values[2] };
    }

    // 顺子
    if (isStraight) {
      // A-2-3 顺子权重最小
      const weight = (values[0] === 14 && values[1] === 3 && values[2] === 2) 
        ? 5000 + 1  // 最小权重
        : 5000 + values[0];
      return { type: 'straight', weight };
    }

    // 对子
    if (values[0] === values[1] || values[1] === values[2] || values[0] === values[2]) {
      const pairValue = values[0] === values[1] ? values[0] : 
                       values[1] === values[2] ? values[1] : values[2];
      const kicker = values.find(v => v !== pairValue);
      return { type: 'pair', weight: 4000 + pairValue * 100 + kicker };
    }

    // 高牌
    return { 
      type: 'high_card', 
      weight: values[0] * 100 + values[1] * 10 + values[2] 
    };
  }

  // 判断是否为顺子
  isStraight(values) {
    // A-2-3 特殊顺子（最小）
    if (values[0] === 14 && values[1] === 3 && values[2] === 2) {
      return true;
    }
    
    // K-A-2 不是顺子（排除跨越情况）
    if (values[0] === 14 && values[1] === 13) {
      return false;
    }
    
    // 普通顺子：连续递减
    return values[0] - values[1] === 1 && values[1] - values[2] === 1;
  }

  toString() {
    return this.cards.map(card => card.toString()).join(' ');
  }
}