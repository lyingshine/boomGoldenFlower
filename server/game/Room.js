import { GameEngine } from './GameEngine.js'
import { PlayerProfileManager } from './room/PlayerProfileManager.js'
import { DisconnectManager } from './room/DisconnectManager.js'

// 随机网名生成器
const AI_NAME_PREFIXES = [
  '快乐的', '沉默的', '神秘', '暴躁的', '佛系', '咸鱼', '摸鱼', '划水', '躺平', '卷王',
  '深夜', '凌晨', '午夜', '黄昏', '清晨', '迷路的', '孤独的', '寂寞的', '无敌', '最强',
  '隔壁', '楼下', '村口', '街角', '路边', '天选', '欧皇', '非酋', '倒霉', '幸运'
]
const AI_NAME_MIDS = [
  '小', '老', '大', '阿', '', '二', '三', '狂', '野', '萌',
  '酷', '帅', '美', '靓', '憨', '呆', '傻', '皮', '浪', '稳'
]
const AI_NAME_SUFFIXES = [
  '王', '哥', '姐', '弟', '妹', '叔', '爷', '总', '神', '仙',
  '豆', '瓜', '蛋', '饼', '面', '猫', '狗', '鱼', '鸟', '虎',
  '牛', '马', '羊', '鸡', '龙', '蛇', '兔', '鼠', '猪', '猴'
]

function generateRandomAIName() {
  const usePrefix = Math.random() < 0.35
  const prefix = usePrefix ? AI_NAME_PREFIXES[Math.floor(Math.random() * AI_NAME_PREFIXES.length)] : ''
  const mid = AI_NAME_MIDS[Math.floor(Math.random() * AI_NAME_MIDS.length)]
  const suffix = AI_NAME_SUFFIXES[Math.floor(Math.random() * AI_NAME_SUFFIXES.length)]
  return prefix + mid + suffix
}

// 生成随机 AI 头像 URL（使用 DiceBear API）
function generateRandomAIAvatar() {
  const styles = ['avataaars', 'bottts', 'personas', 'adventurer', 'big-smile', 'lorelei', 'notionists', 'open-peeps', 'pixel-art', 'thumbs']
  const style = styles[Math.floor(Math.random() * styles.length)]
  const seed = Math.random().toString(36).substring(2, 10)
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`
}

/**
 * 房间管理类
 */
export class Room {
  constructor(roomCode, hostId, hostName) {
    this.roomCode = roomCode
    this.hostId = hostId
    this.hostName = hostName
    this.clients = new Map()
    this.maxPlayers = 8
    this.createdAt = Date.now()
    this.game = new GameEngine(roomCode, this)
    this.aiCounter = 0
    this.gameStarted = false
    this.hostSeatIndex = -1

    // 使用管理器
    this.profileManager = new PlayerProfileManager()
    this.disconnectManager = new DisconnectManager()
  }

  // 兼容旧代码的属性访问
  get playerProfiles() {
    return this.profileManager.getProfiles()
  }

  get disconnectedPlayers() {
    return this.disconnectManager.disconnectedPlayers
  }

  get reconnectTimeout() {
    return this.disconnectManager.reconnectTimeout
  }

  // 委托给 ProfileManager
  async getPlayerProfile(playerName) {
    return this.profileManager.getPlayerProfile(playerName)
  }

  async preloadPlayerProfiles() {
    const playerNames = this.game.seats
      .filter(p => p && p.type === 'human')
      .map(p => p.name)
    return this.profileManager.preloadProfiles(playerNames)
  }

  updatePlayerProfile(playerName, updates) {
    this.profileManager.updateProfile(playerName, updates)
  }

  async savePlayerProfiles() {
    return this.profileManager.saveAll()
  }


  // 添加客户端
  addClient(clientId, ws, playerName, chips = 1000, avatarUrl = null) {
    if (this.clients.size >= this.maxPlayers) return null

    const seatIndex = this.findEmptySeat()
    if (seatIndex === -1) return null

    this.clients.set(clientId, { ws, playerName, seatIndex })

    const isGameInProgress = this.gameStarted && 
      this.game.state.phase !== 'waiting' && 
      this.game.state.phase !== 'ended'
    
    this.game.addPlayer(seatIndex, playerName, chips, 'human', isGameInProgress, avatarUrl)

    if (this.hostSeatIndex === -1) {
      this.hostSeatIndex = seatIndex
    }

    return { seatIndex, waitingForNextRound: isGameInProgress }
  }

  // 重连玩家
  reconnectClient(clientId, ws, playerName, seatIndex) {
    const disconnected = this.disconnectManager.disconnectedPlayers.get(seatIndex)
    if (!disconnected || disconnected.playerName !== playerName) {
      return null
    }

    this.clients.set(clientId, { ws, playerName, seatIndex })
    this.disconnectManager.completeReconnect(seatIndex)

    console.log(`🔄 玩家重连: ${playerName} 座位${seatIndex}`)
    return { seatIndex, chips: disconnected.chips }
  }

  // 检查是否可以重连
  canReconnect(playerName) {
    return this.disconnectManager.canReconnect(playerName)
  }

  // 移除客户端
  removeClient(clientId, isDisconnect = false) {
    const client = this.clients.get(clientId)
    if (!client) return false

    if (isDisconnect && this.gameStarted) {
      const player = this.game.seats[client.seatIndex]
      if (player) {
        this.disconnectManager.recordDisconnect(
          client.seatIndex,
          client.playerName,
          player.chips
        )
        console.log(`⏸️ 阶段: ${this.game.state.phase}`)
      }
    } else {
      this.game.removePlayer(client.seatIndex)
    }

    this.clients.delete(clientId)
    return true
  }

  // 添加 AI
  addAI() {
    const seatIndex = this.findEmptySeat()
    if (seatIndex === -1) return null

    const usedNames = new Set()
    for (const seat of this.game.seats) {
      if (seat) usedNames.add(seat.name)
    }

    // 生成不重复的随机名称
    let aiName = null
    for (let i = 0; i < 20; i++) {
      const name = generateRandomAIName()
      if (!usedNames.has(name)) {
        aiName = name
        break
      }
    }

    if (!aiName) {
      // 兜底：加随机数
      aiName = generateRandomAIName() + Math.floor(Math.random() * 100)
    }

    // 生成随机头像
    const avatarUrl = generateRandomAIAvatar()

    this.aiCounter++
    this.game.addPlayer(seatIndex, aiName, 20000, 'ai', false, avatarUrl)

    return { seatIndex, name: aiName, avatarUrl }
  }

  // 移除 AI
  removeAI(seatIndex) {
    const player = this.game.seats[seatIndex]
    if (!player || player.type !== 'ai') return false
    return this.game.removePlayer(seatIndex)
  }


  // 查找空座位
  findEmptySeat() {
    const prioritySeats = [0, 5, 6, 2]
    const otherSeats = [1, 4, 7, 3]

    for (const i of prioritySeats) {
      if (!this.game.seats[i] && !this.disconnectManager.isSeatReserved(i)) return i
    }
    for (const i of otherSeats) {
      if (!this.game.seats[i] && !this.disconnectManager.isSeatReserved(i)) return i
    }
    return -1
  }

  // 获取座位索引
  getSeatIndex(clientId) {
    const client = this.clients.get(clientId)
    return client ? client.seatIndex : -1
  }

  // 广播消息
  broadcast(message, excludeClientId = null) {
    this.clients.forEach((client, clientId) => {
      if (clientId !== excludeClientId && client.ws.readyState === 1) {
        client.ws.send(JSON.stringify(message))
      }
    })
  }

  // 发送给指定客户端
  sendTo(clientId, message) {
    const client = this.clients.get(clientId)
    if (client && client.ws.readyState === 1) {
      client.ws.send(JSON.stringify(message))
    }
  }

  // 广播游戏状态
  broadcastGameState() {
    this.clients.forEach((client, clientId) => {
      const state = this.game.getStateForPlayer(client.seatIndex)
      this.sendTo(clientId, { type: 'game_state', state })
    })
  }

  // 获取玩家列表
  getPlayerList() {
    return this.game.seats
      .map((p, i) => p ? {
        seatIndex: i,
        name: p.name,
        type: p.type,
        chips: p.chips,
        avatarUrl: p.avatarUrl || null,
        waitingForNextRound: p.waitingForNextRound || false
      } : null)
      .filter(p => p)
  }

  // 获取房间信息
  getInfo() {
    return {
      roomCode: this.roomCode,
      hostName: this.hostName,
      playerCount: this.getPlayerList().length,
      maxPlayers: this.maxPlayers,
      createdAt: this.createdAt,
      gameStarted: this.gameStarted
    }
  }

  // 是否是房主
  isHost(clientId) {
    return clientId === this.hostId
  }

  // 转移房主
  transferHost() {
    const clients = Array.from(this.clients.entries())
    if (clients.length > 0) {
      const [newHostId, newHost] = clients[0]
      this.hostId = newHostId
      this.hostName = newHost.playerName
      return { newHostId, newHostName: newHost.playerName }
    }
    return null
  }

  // 清理超时断线玩家
  cleanupDisconnected() {
    this.disconnectManager.cleanupExpired((seatIndex, info) => {
      this.game.removePlayer(seatIndex)
    })
  }
}
