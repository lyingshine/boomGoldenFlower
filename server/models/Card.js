/**
 * 扑克牌类 (服务端)
 */
export class Card {
  constructor(suit, rank) {
    this.suit = suit
    this.rank = rank
  }

  getValue() {
    if (this.rank === 'A') return 14
    if (this.rank === 'K') return 13
    if (this.rank === 'Q') return 12
    if (this.rank === 'J') return 11
    return parseInt(this.rank)
  }

  toJSON() {
    return { suit: this.suit, rank: this.rank }
  }

  static fromJSON(data) {
    return new Card(data.suit, data.rank)
  }
}
