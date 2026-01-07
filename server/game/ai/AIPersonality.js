/**
 * AI 个性配置和管理
 */

// AI 个性配置
export const AI_PERSONALITIES = {
  aggressive: {
    name: '激进型',
    raiseFrequency: 0.6,      // 加注频率
    bluffFrequency: 0.35,     // 诈唬频率
    foldThreshold: 0.7,       // 弃牌阈值（越高越不容易弃牌）
    slowPlayChance: 0.2,      // 慢打概率
    showdownAggression: 0.7,  // 开牌激进度
    blindPlayChance: 0.5      // 焖牌概率
  },
  conservative: {
    name: '保守型',
    raiseFrequency: 0.25,
    bluffFrequency: 0.1,
    foldThreshold: 0.4,
    slowPlayChance: 0.4,
    showdownAggression: 0.3,
    blindPlayChance: 0.3
  },
  balanced: {
    name: '均衡型',
    raiseFrequency: 0.4,
    bluffFrequency: 0.2,
    foldThreshold: 0.55,
    slowPlayChance: 0.3,
    showdownAggression: 0.5,
    blindPlayChance: 0.4
  },
  tricky: {
    name: '诡诈型',
    raiseFrequency: 0.45,
    bluffFrequency: 0.4,
    foldThreshold: 0.5,
    slowPlayChance: 0.5,
    showdownAggression: 0.4,
    blindPlayChance: 0.6
  },
  tight: {
    name: '紧凶型',
    raiseFrequency: 0.5,
    bluffFrequency: 0.15,
    foldThreshold: 0.35,
    slowPlayChance: 0.25,
    showdownAggression: 0.6,
    blindPlayChance: 0.25
  }
}

/**
 * AI 个性管理器
 */
export class AIPersonalityManager {
  constructor() {
    this.aiPersonalities = new Map()
  }

  // 获取或分配 AI 个性，返回 { type, config }
  getPersonality(playerName) {
    if (!this.aiPersonalities.has(playerName)) {
      // 根据名字哈希分配个性，保证同一个 AI 总是同一个性格
      const types = Object.keys(AI_PERSONALITIES)
      const hash = playerName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
      const type = types[hash % types.length]
      this.aiPersonalities.set(playerName, { type, config: AI_PERSONALITIES[type] })
    }
    return this.aiPersonalities.get(playerName)
  }

  // 设置固定性格（从固定AI列表调用）
  setFixedPersonality(playerName, personalityType) {
    const config = AI_PERSONALITIES[personalityType]
    if (config) {
      this.aiPersonalities.set(playerName, { type: personalityType, config })
    }
  }

  // 获取个性类型名称
  getPersonalityType(playerName) {
    return this.getPersonality(playerName).type
  }

  // 清除所有个性映射
  clear() {
    this.aiPersonalities.clear()
  }
}
