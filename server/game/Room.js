import { GameEngine } from './GameEngine.js'
import { PlayerProfileManager } from './room/PlayerProfileManager.js'
import { DisconnectManager } from './room/DisconnectManager.js'

// 固定的100个AI玩家列表（名字+性格）
const FIXED_AI_LIST = [
  // 激进型 (20个)
  { name: '狂瓜', personality: 'aggressive' },
  { name: '暴躁老哥', personality: 'aggressive' },
  { name: '冲锋鸡', personality: 'aggressive' },
  { name: '莽夫', personality: 'aggressive' },
  { name: '火爆辣椒', personality: 'aggressive' },
  { name: '战狂', personality: 'aggressive' },
  { name: '横冲直撞', personality: 'aggressive' },
  { name: '不服就干', personality: 'aggressive' },
  { name: '梭哈王', personality: 'aggressive' },
  { name: '全押狂人', personality: 'aggressive' },
  { name: '暴力熊', personality: 'aggressive' },
  { name: '疯狗', personality: 'aggressive' },
  { name: '狂战士', personality: 'aggressive' },
  { name: '怒火中烧', personality: 'aggressive' },
  { name: '血性男儿', personality: 'aggressive' },
  { name: '猛虎下山', personality: 'aggressive' },
  { name: '霸王龙', personality: 'aggressive' },
  { name: '狂风暴雨', personality: 'aggressive' },
  { name: '烈焰红唇', personality: 'aggressive' },
  { name: '雷霆万钧', personality: 'aggressive' },
  
  // 保守型 (20个)
  { name: '稳如老狗', personality: 'conservative' },
  { name: '佛系青年', personality: 'conservative' },
  { name: '躺平大师', personality: 'conservative' },
  { name: '咸鱼王', personality: 'conservative' },
  { name: '淡定哥', personality: 'conservative' },
  { name: '慢慢来', personality: 'conservative' },
  { name: '稳健投资', personality: 'conservative' },
  { name: '保本第一', personality: 'conservative' },
  { name: '小心驶得万年船', personality: 'conservative' },
  { name: '谨慎老王', personality: 'conservative' },
  { name: '乌龟流', personality: 'conservative' },
  { name: '蜗牛哥', personality: 'conservative' },
  { name: '慢热型', personality: 'conservative' },
  { name: '稳坐钓鱼台', personality: 'conservative' },
  { name: '老谋深算', personality: 'conservative' },
  { name: '深藏不露', personality: 'conservative' },
  { name: '静观其变', personality: 'conservative' },
  { name: '以逸待劳', personality: 'conservative' },
  { name: '守株待兔', personality: 'conservative' },
  { name: '按兵不动', personality: 'conservative' },
  
  // 均衡型 (20个)
  { name: '中庸之道', personality: 'balanced' },
  { name: '平衡大师', personality: 'balanced' },
  { name: '随机应变', personality: 'balanced' },
  { name: '见招拆招', personality: 'balanced' },
  { name: '灵活多变', personality: 'balanced' },
  { name: '不偏不倚', personality: 'balanced' },
  { name: '中规中矩', personality: 'balanced' },
  { name: '稳中求进', personality: 'balanced' },
  { name: '攻守兼备', personality: 'balanced' },
  { name: '进退自如', personality: 'balanced' },
  { name: '张弛有度', personality: 'balanced' },
  { name: '收放自如', personality: 'balanced' },
  { name: '游刃有余', personality: 'balanced' },
  { name: '从容不迫', personality: 'balanced' },
  { name: '不急不躁', personality: 'balanced' },
  { name: '心如止水', personality: 'balanced' },
  { name: '波澜不惊', personality: 'balanced' },
  { name: '泰然自若', personality: 'balanced' },
  { name: '处变不惊', personality: 'balanced' },
  { name: '临危不乱', personality: 'balanced' },
  
  // 诡诈型 (20个)
  { name: '神秘萌狗', personality: 'tricky' },
  { name: '午夜采马', personality: 'tricky' },
  { name: '诈唬大师', personality: 'tricky' },
  { name: '千面狐', personality: 'tricky' },
  { name: '影子杀手', personality: 'tricky' },
  { name: '迷雾行者', personality: 'tricky' },
  { name: '虚虚实实', personality: 'tricky' },
  { name: '真真假假', personality: 'tricky' },
  { name: '声东击西', personality: 'tricky' },
  { name: '暗度陈仓', personality: 'tricky' },
  { name: '瞒天过海', personality: 'tricky' },
  { name: '偷天换日', personality: 'tricky' },
  { name: '无中生有', personality: 'tricky' },
  { name: '李代桃僵', personality: 'tricky' },
  { name: '金蝉脱壳', personality: 'tricky' },
  { name: '笑里藏刀', personality: 'tricky' },
  { name: '口蜜腹剑', personality: 'tricky' },
  { name: '绵里藏针', personality: 'tricky' },
  { name: '扮猪吃虎', personality: 'tricky' },
  { name: '深不可测', personality: 'tricky' },
  
  // 紧凶型 (20个)
  { name: '帅饼', personality: 'tight' },
  { name: '小豆', personality: 'tight' },
  { name: '精打细算', personality: 'tight' },
  { name: '一击必杀', personality: 'tight' },
  { name: '蓄势待发', personality: 'tight' },
  { name: '伺机而动', personality: 'tight' },
  { name: '养精蓄锐', personality: 'tight' },
  { name: '厚积薄发', personality: 'tight' },
  { name: '韬光养晦', personality: 'tight' },
  { name: '卧薪尝胆', personality: 'tight' },
  { name: '忍者神龟', personality: 'tight' },
  { name: '潜伏者', personality: 'tight' },
  { name: '狙击手', personality: 'tight' },
  { name: '刺客信条', personality: 'tight' },
  { name: '暗夜猎手', personality: 'tight' },
  { name: '致命一击', personality: 'tight' },
  { name: '一剑封喉', personality: 'tight' },
  { name: '毒蛇出洞', personality: 'tight' },
  { name: '猎鹰突击', personality: 'tight' },
  { name: '雷霆一击', personality: 'tight' }
]

// 生成随机 AI 头像 URL（使用 DiceBear API）
function generateRandomAIAvatar() {
  const styles = ['avataaars', 'bottts', 'personas', 'adventurer', 'big-smile', 'lorelei', 'notionists', 'open-peeps', 'pixel-art', 'thumbs']
  const style = styles[Math.floor(Math.random() * styles.length)]
  const seed = Math.random().toString(36).substring(2, 10)
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`
}

// 获取固定AI（根据索引）
function getFixedAI(index) {
  return FIXED_AI_LIST[index % FIXED_AI_LIST.length]
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

    // 从固定AI列表中选择未使用的AI
    let selectedAI = null
    for (let i = 0; i < FIXED_AI_LIST.length; i++) {
      const ai = FIXED_AI_LIST[(this.aiCounter + i) % FIXED_AI_LIST.length]
      if (!usedNames.has(ai.name)) {
        selectedAI = ai
        break
      }
    }

    if (!selectedAI) {
      // 兜底：所有名字都用完了，加编号
      selectedAI = { 
        name: FIXED_AI_LIST[this.aiCounter % FIXED_AI_LIST.length].name + this.aiCounter,
        personality: FIXED_AI_LIST[this.aiCounter % FIXED_AI_LIST.length].personality
      }
    }

    // 生成随机头像
    const avatarUrl = generateRandomAIAvatar()

    this.aiCounter++
    this.game.addPlayer(seatIndex, selectedAI.name, 20000, 'ai', false, avatarUrl)
    
    // 设置AI的固定性格
    this.game.aiDecisionMaker.setFixedPersonality(selectedAI.name, selectedAI.personality)

    return { seatIndex, name: selectedAI.name, avatarUrl }
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
