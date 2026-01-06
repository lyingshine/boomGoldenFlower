/**
 * 性能指标收集
 * 收集和统计系统运行指标
 */
import logger from './logger.js'

class Metrics {
  constructor() {
    this.counters = new Map()
    this.timers = new Map()
    this.gauges = new Map()
  }
  
  /**
   * 计数器 - 累加
   */
  increment(name, value = 1) {
    const current = this.counters.get(name) || 0
    this.counters.set(name, current + value)
  }
  
  /**
   * 计数器 - 减少
   */
  decrement(name, value = 1) {
    const current = this.counters.get(name) || 0
    this.counters.set(name, current - value)
  }
  
  /**
   * 仪表 - 设置当前值
   */
  gauge(name, value) {
    this.gauges.set(name, value)
  }
  
  /**
   * 计时器 - 开始
   */
  timerStart(name) {
    this.timers.set(name, Date.now())
  }
  
  /**
   * 计时器 - 结束并记录
   */
  timerEnd(name) {
    const start = this.timers.get(name)
    if (!start) return
    
    const duration = Date.now() - start
    this.timers.delete(name)
    
    // 记录到计数器
    const key = `${name}_duration_ms`
    const current = this.counters.get(key) || 0
    this.counters.set(key, current + duration)
    
    return duration
  }
  
  /**
   * 获取所有指标
   */
  getAll() {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges)
    }
  }
  
  /**
   * 重置所有指标
   */
  reset() {
    this.counters.clear()
    this.timers.clear()
    this.gauges.clear()
  }
  
  /**
   * 打印指标摘要
   */
  summary() {
    logger.info('性能指标摘要', this.getAll())
  }
}

// 单例导出
export const metrics = new Metrics()

// 游戏相关指标
export const gameMetrics = {
  roomCreated: () => metrics.increment('rooms_created'),
  roomClosed: () => metrics.increment('rooms_closed'),
  gameStarted: () => metrics.increment('games_started'),
  gameEnded: () => metrics.increment('games_ended'),
  playerJoined: () => metrics.increment('players_joined'),
  playerLeft: () => metrics.increment('players_left'),
  
  setActiveRooms: (count) => metrics.gauge('active_rooms', count),
  setActivePlayers: (count) => metrics.gauge('active_players', count),
  setActiveGames: (count) => metrics.gauge('active_games', count)
}

// 用户相关指标
export const userMetrics = {
  register: () => metrics.increment('users_registered'),
  login: () => metrics.increment('users_logged_in'),
  loginFailed: () => metrics.increment('login_failures'),
  signIn: () => metrics.increment('daily_sign_ins')
}

// WebSocket 相关指标
export const wsMetrics = {
  connected: () => metrics.increment('ws_connections'),
  disconnected: () => metrics.increment('ws_disconnections'),
  messageReceived: () => metrics.increment('ws_messages_received'),
  messageSent: () => metrics.increment('ws_messages_sent'),
  
  setConnectedClients: (count) => metrics.gauge('ws_connected_clients', count)
}

// 定期打印指标摘要（每5分钟）
setInterval(() => {
  metrics.summary()
}, 5 * 60 * 1000)
