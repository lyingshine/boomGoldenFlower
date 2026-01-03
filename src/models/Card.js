/**
 * 扑克牌类
 */
export class Card {
  constructor(suit, rank) {
    this.suit = suit; // 花色：红桃、黑桃、梅花、方块
    this.rank = rank; // 点数：A, 2-10, J, Q, K
  }

  toString() {
    return `${this.suit}${this.rank}`;
  }

  // 获取牌的数值（用于比较大小）
  getValue() {
    if (this.rank === 'A') return 14;
    if (this.rank === 'K') return 13;
    if (this.rank === 'Q') return 12;
    if (this.rank === 'J') return 11;
    return parseInt(this.rank);
  }
}