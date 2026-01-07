/**
 * AI 策略自修正器
 * 负责记录决策、分析效果、调整策略参数
 */
import { savePersonalityAdjustments, saveGlobalAdjustments, loadAllPersonalityAdjustments, loadGlobalAdjustments } from '../../db/aiRepository.js'

export class AIStrategyAdjuster {
  constructor() {
    this.decisionHistory = new Map()
    this.personalityAdjustments = new Map()
    this.globalAdjustments = null
    this.adjustmentsLoaded = false
  }

  // 从数据库加载调整参数
  async loadStrategyAdjustments() {
    try {
      const [personalityAdj, globalAdj] = await Promise.all([
        loadAllPersonalityAdjustments(),
        loadGlobalAdjustments()
      ])
      this.personalityAdjustments = personalityAdj
      this.globalAdjustments = globalAdj
      this.adjustmentsLoaded = true
      console.log(`✅ 已加载 ${personalityAdj.size} 个个性类型的调整参数`)
    } catch (e) {
      console.error('加载 AI 策略调整参数失败:', e.message)
    }
  }

  // 保存调整参数到数据库
  async saveStrategyAdjustments(personalityType) {
    const personalityAdj = this.personalityAdjustments.get(personalityType)
    const history = this.decisionHistory.get(personalityType)
    const totalDecisions = history ? history.length : 0
    
    try {
      const promises = []
      if (personalityAdj) {
        promises.push(savePersonalityAdjustments(personalityType, personalityAdj, totalDecisions))
      }
      if (this.globalAdjustments) {
        promises.push(saveGlobalAdjustments(this.globalAdjustments, totalDecisions))
      }
      await Promise.all(promises)
    } catch (e) {
      console.error(`保存策略调整参数失败:`, e.message)
    }
  }

  // 记录 AI 决策
  recordDecision(playerName, decision, context) {
    if (!this.decisionHistory.has(playerName)) {
      this.decisionHistory.set(playerName, [])
    }
    
    const history = this.decisionHistory.get(playerName)
    history.push({
      action: decision.action,
      amount: decision.amount || 0,
      handStrength: context.strength || 0,
      round: context.round || 1,
      potSize: context.potSize || 0,
      callAmount: context.callAmount || 0,
      position: context.position || 'middle',
      timestamp: Date.now(),
      result: null
    })
    
    if (history.length > 50) {
      history.shift()
    }
  }

  // 记录决策结果
  recordDecisionResult(playerName, won, profit) {
    const history = this.decisionHistory.get(playerName)
    if (!history || history.length === 0) return
    
    const currentTime = Date.now()
    for (let i = history.length - 1; i >= 0; i--) {
      const record = history[i]
      if (currentTime - record.timestamp > 60000) break
      if (record.result === null) {
        record.result = { won, profit }
      }
    }
    
    this.analyzeAndAdjust(playerName)
  }

  // 获取策略调整参数
  getStrategyAdjustments(personalityType) {
    const personalityAdj = this.personalityAdjustments.get(personalityType) || {}
    const globalAdj = this.globalAdjustments || {}
    
    return {
      bluffAdjust: personalityAdj.bluffAdjust || 0,
      aggressionAdjust: personalityAdj.aggressionAdjust || 0,
      slowPlayAdjust: personalityAdj.slowPlayAdjust || 0,
      trapAdjust: personalityAdj.trapAdjust || 0,
      foldAdjust: globalAdj.foldAdjust || 0,
      showdownAdjust: globalAdj.showdownAdjust || 0,
      monsterThresholdAdjust: globalAdj.monsterThresholdAdjust || 0,
      strongThresholdAdjust: globalAdj.strongThresholdAdjust || 0,
      mediumThresholdAdjust: globalAdj.mediumThresholdAdjust || 0,
      probeAdjust: globalAdj.probeAdjust || 0
    }
  }


  // 分析决策历史并调整策略
  analyzeAndAdjust(playerName, personalityType) {
    const history = this.decisionHistory.get(playerName)
    if (!history || history.length < 5) return
    
    const completedDecisions = history.filter(d => d.result !== null)
    if (completedDecisions.length < 5) return
    
    // 初始化个性调整参数
    if (!this.personalityAdjustments.has(personalityType)) {
      this.personalityAdjustments.set(personalityType, {
        bluffAdjust: 0,
        aggressionAdjust: 0,
        slowPlayAdjust: 0,
        trapAdjust: 0
      })
    }
    const personalityAdj = this.personalityAdjustments.get(personalityType)
    
    // 初始化全局调整参数
    if (!this.globalAdjustments) {
      this.globalAdjustments = {
        foldAdjust: 0,
        showdownAdjust: 0,
        monsterThresholdAdjust: 0,
        strongThresholdAdjust: 0,
        mediumThresholdAdjust: 0,
        weakThresholdAdjust: 0,
        probeAdjust: 0
      }
    }
    const globalAdj = this.globalAdjustments
    
    // 分析诈唬效果
    const bluffs = completedDecisions.filter(d => d.action === 'raise' && d.handStrength < 4000)
    if (bluffs.length >= 2) {
      const bluffWinRate = bluffs.filter(b => b.result.won).length / bluffs.length
      if (bluffWinRate < 0.3) {
        personalityAdj.bluffAdjust = Math.max(-0.15, personalityAdj.bluffAdjust - 0.03)
      } else if (bluffWinRate > 0.5) {
        personalityAdj.bluffAdjust = Math.min(0.15, personalityAdj.bluffAdjust + 0.02)
      }
    }
    
    // 分析强牌激进度
    const strongHands = completedDecisions.filter(d => d.handStrength >= 5000)
    if (strongHands.length >= 2) {
      const strongWinRate = strongHands.filter(s => s.result.won).length / strongHands.length
      const avgProfit = strongHands.reduce((sum, s) => sum + s.result.profit, 0) / strongHands.length
      
      if (strongWinRate > 0.6 && avgProfit < 30) {
        personalityAdj.aggressionAdjust = Math.min(0.15, personalityAdj.aggressionAdjust + 0.03)
      } else if (strongWinRate < 0.4) {
        personalityAdj.aggressionAdjust = Math.max(-0.15, personalityAdj.aggressionAdjust - 0.02)
      }
    }
    
    // 分析弃牌决策
    const folds = completedDecisions.filter(d => d.action === 'fold')
    const nonFolds = completedDecisions.filter(d => d.action !== 'fold')
    if (folds.length >= 3 && nonFolds.length >= 3) {
      const nonFoldWinRate = nonFolds.filter(n => n.result.won).length / nonFolds.length
      if (nonFoldWinRate < 0.35) {
        globalAdj.foldAdjust = Math.max(-0.1, globalAdj.foldAdjust - 0.02)
      } else if (nonFoldWinRate > 0.55 && folds.length > nonFolds.length) {
        globalAdj.foldAdjust = Math.min(0.1, globalAdj.foldAdjust + 0.02)
      }
    }
    
    // 分析开牌决策
    const showdowns = completedDecisions.filter(d => d.action === 'showdown')
    if (showdowns.length >= 3) {
      const showdownWinRate = showdowns.filter(s => s.result.won).length / showdowns.length
      if (showdownWinRate < 0.4) {
        globalAdj.showdownAdjust = Math.max(-0.15, globalAdj.showdownAdjust - 0.03)
      } else if (showdownWinRate > 0.65) {
        globalAdj.showdownAdjust = Math.min(0.15, globalAdj.showdownAdjust + 0.02)
      }
    }
    
    // 分析慢打效果
    const slowPlays = completedDecisions.filter(d => d.action === 'call' && d.handStrength >= 5000)
    if (slowPlays.length >= 2) {
      const slowPlayAvgProfit = slowPlays.reduce((sum, s) => sum + s.result.profit, 0) / slowPlays.length
      if (slowPlayAvgProfit < 20) {
        personalityAdj.slowPlayAdjust = Math.max(-0.15, personalityAdj.slowPlayAdjust - 0.03)
      } else if (slowPlayAvgProfit > 40) {
        personalityAdj.slowPlayAdjust = Math.min(0.1, personalityAdj.slowPlayAdjust + 0.02)
      }
    }
    
    // 分析陷阱效果
    const traps = completedDecisions.filter(d => d.action === 'call' && d.handStrength >= 6000)
    if (traps.length >= 2) {
      const trapAvgProfit = traps.reduce((sum, t) => sum + t.result.profit, 0) / traps.length
      if (trapAvgProfit < 20) {
        personalityAdj.trapAdjust = Math.max(-0.2, personalityAdj.trapAdjust - 0.05)
      } else if (trapAvgProfit > 50) {
        personalityAdj.trapAdjust = Math.min(0.2, personalityAdj.trapAdjust + 0.03)
      }
    }
    
    // 保存到数据库
    this.saveStrategyAdjustments(personalityType).catch(() => {})
  }
}
