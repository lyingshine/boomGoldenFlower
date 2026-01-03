import { Card } from './Card.js';

/**
 * 牌堆类
 */
export class Deck {
  constructor() {
    this.cards = [];
    this.initializeDeck();
    this.shuffle();
  }

  // 初始化一副牌
  initializeDeck() {
    const suits = ['♠', '♥', '♣', '♦'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    
    for (const suit of suits) {
      for (const rank of ranks) {
        this.cards.push(new Card(suit, rank));
      }
    }
  }

  // 洗牌
  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  // 发牌
  dealCard() {
    if (this.cards.length === 0) {
      throw new Error('牌堆已空');
    }
    return this.cards.pop();
  }

  // 获取剩余牌数
  getRemainingCards() {
    return this.cards.length;
  }
}