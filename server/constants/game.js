/**
 * 游戏相关常量
 */

// 游戏阶段
export const GamePhase = {
  WAITING: 'waiting',
  DEALING: 'dealing',
  BETTING: 'betting',
  SHOWDOWN: 'showdown',
  ENDED: 'ended'
}

// 玩家动作
export const PlayerAction = {
  PEEK: 'peek',
  CALL: 'call',
  RAISE: 'raise',
  FOLD: 'fold',
  SHOWDOWN: 'showdown',
  BLIND: 'blind'
}

// 牌型权重范围
export const HandWeight = {
  LEOPARD_MIN: 8000,      // 豹子
  STRAIGHT_FLUSH_MIN: 7000, // 同花顺
  FLUSH_MIN: 6000,        // 同花
  STRAIGHT_MIN: 5000,     // 顺子
  PAIR_MIN: 4000,         // 对子
  HIGH_CARD_MIN: 0        // 散牌
}

// 牌型名称
export const HandType = {
  LEOPARD: 'leopard',
  STRAIGHT_FLUSH: 'straightFlush',
  FLUSH: 'flush',
  STRAIGHT: 'straight',
  PAIR: 'pair',
  HIGH_CARD: 'highCard'
}

// 牌型中文名
export const HandTypeName = {
  [HandType.LEOPARD]: '豹子',
  [HandType.STRAIGHT_FLUSH]: '同花顺',
  [HandType.FLUSH]: '同花',
  [HandType.STRAIGHT]: '顺子',
  [HandType.PAIR]: '对子',
  [HandType.HIGH_CARD]: '散牌'
}

// 座位数量
export const MAX_SEATS = 8

// AI 名称池
export const AI_NAMES = [
  '小明', '小红', '小刚', '小丽', '小强', 
  '小芳', '小华', '小军', '小美', '小龙'
]

// AI 性格类型
export const AIPersonality = {
  AGGRESSIVE: 'aggressive',  // 激进
  CONSERVATIVE: 'conservative', // 保守
  BALANCED: 'balanced',      // 平衡
  TRICKY: 'tricky'          // 狡猾
}
