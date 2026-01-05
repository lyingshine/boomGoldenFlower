import { GameEngine } from './GameEngine.js'
import { getPlayerProfile, updatePlayerProfile, getPlayerProfiles } from '../db/mysql.js'

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
    this.hostSeatIndex = -1 // 房主座位
    // 断线玩家信息，用于重连
    this.disconnectedPlayers = new Map() // seatIndex -> { playerName, chips, disconnectedAt }
    this.reconnectTimeout = 5 * 60 * 1000 // 5分钟重连超时
    
    // AI 对手建模数据（内存缓存 + 数据库持久化）
    this.playerProfiles = new Map()
    // 待保存的档案更新（批量写入）
    this.pendingProfileUpdates = new Map()
  }
  
  // 获取玩家档案（优先内存，否则从数据库加载）
  async getPlayerProfile(playerName) {
    // 内存缓存
    if (this.playerProfiles.has(playerName)) {
      return this.playerProfiles.get(playerName)
    }
    
    // 从数据库加载
    try {
      const profile = await getPlayerProfile(playerName)
      if (profile) {
        this.playerProfiles.set(playerName, profile)
        return profile
      }
    } catch (e) {
      console.error('加载玩家档案失败:', e.message)
    }
    
    // 新玩家，创建空档案
    const newProfile = {
      username: playerName,
      totalHands: 0,
      foldCount: 0,
      raiseCount: 0,
      callCount: 0,
      blindBetCount: 0,
      showdownWins: 0,
      showdownLosses: 0,
      bluffCaught: 0,
      bigBetWithWeak: 0,
      avgPeekRound: 0,
      peekRoundSamples: 0
    }
    this.playerProfiles.set(playerName, newProfile)
    return newProfile
  }
  
  // 预加载房间内所有玩家的档案
  async preloadPlayerProfiles() {
    const playerNames = this.game.seats
      .filter(p => p && p.type === 'human')
      .map(p => p.name)
    
    if (playerNames.length === 0) return
    
    try {
      const profiles = await getPlayerProfiles(playerNames)
      for (const [name, profile] of Object.entries(profiles)) {
        this.playerProfiles.set(name, profile)
      }
    } catch (e) {
      console.error('预加载玩家档案失败:', e.message)
    }
  }
  
  // 更新玩家档案（先更新内存，标记待保存）
  updatePlayerProfile(playerName, updates) {
    const profile = this.playerProfiles.get(playerName) || {
      username: playerName,
      totalHands: 0,
      foldCount: 0,
      raiseCount: 0,
      callCount: 0,
      blindBetCount: 0,
      showdownWins: 0,
      showdownLosses: 0,
      bluffCaught: 0,
      bigBetWithWeak: 0,
      avgPeekRound: 0,
      peekRoundSamples: 0,
      // 新增字段
      earlyFoldCount: 0,
      lateFoldCount: 0,
      smallRaiseCount: 0,
      bigRaiseCount: 0,
      checkRaiseCount: 0,
      showdownInitiated: 0,
      showdownReceived: 0,
      wonWithoutShowdown: 0,
      totalChipsWon: 0,
      totalChipsLost: 0,
      maxSingleWin: 0,
      maxSingleLoss: 0,
      avgBetSize: 0,
      betSizeSamples: 0
    }
    
    // 更新内存 - 累加字段
    const incrementFields = [
      'totalHands', 'foldCount', 'raiseCount', 'callCount', 'blindBetCount',
      'showdownWins', 'showdownLosses', 'bluffCaught', 'bigBetWithWeak',
      'earlyFoldCount', 'lateFoldCount', 'smallRaiseCount', 'bigRaiseCount',
      'checkRaiseCount', 'showdownInitiated', 'showdownReceived', 'wonWithoutShowdown',
      'totalChipsWon', 'totalChipsLost'
    ]
    
    for (const field of incrementFields) {
      if (updates[field]) {
        profile[field] = (profile[field] || 0) + updates[field]
      }
    }
    
    // 最大值字段
    if (updates.maxSingleWin && updates.maxSingleWin > (profile.maxSingleWin || 0)) {
      profile.maxSingleWin = updates.maxSingleWin
    }
    if (updates.maxSingleLoss && updates.maxSingleLoss > (profile.maxSingleLoss || 0)) {
      profile.maxSingleLoss = updates.maxSingleLoss
    }
    
    // 看牌轮次滑动平均
    if (updates.peekRound) {
      const newSamples = profile.peekRoundSamples + 1
      profile.avgPeekRound = (profile.avgPeekRound * profile.peekRoundSamples + updates.peekRound) / newSamples
      profile.peekRoundSamples = newSamples
    }
    
    // 下注金额滑动平均
    if (updates.betSize) {
      const newSamples = (profile.betSizeSamples || 0) + 1
      profile.avgBetSize = ((profile.avgBetSize || 0) * (profile.betSizeSamples || 0) + updates.betSize) / newSamples
      profile.betSizeSamples = newSamples
    }
    
    this.playerProfiles.set(playerName, profile)
    
    // 标记待保存
    const pending = this.pendingProfileUpdates.get(playerName) || {}
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'maxSingleWin' || key === 'maxSingleLoss') {
        pending[key] = Math.max(pending[key] || 0, value)
      } else {
        pending[key] = (pending[key] || 0) + value
      }
    }
    this.pendingProfileUpdates.set(playerName, pending)
  }
  
  // 保存所有待更新的档案到数据库
  async savePlayerProfiles() {
    if (this.pendingProfileUpdates.size === 0) return
    
    const updates = new Map(this.pendingProfileUpdates)
    this.pendingProfileUpdates.clear()
    
    for (const [playerName, profileUpdates] of updates) {
      try {
        await updatePlayerProfile(playerName, profileUpdates)
      } catch (e) {
        console.error(`保存玩家档案失败 ${playerName}:`, e.message)
        // 失败的放回队列
        this.pendingProfileUpdates.set(playerName, profileUpdates)
      }
    }
  }

  addClient(clientId, ws, playerName, chips = 1000) {
    if (this.clients.size >= this.maxPlayers) return null
    
    const seatIndex = this.findEmptySeat()
    if (seatIndex === -1) return null

    this.clients.set(clientId, { ws, playerName, seatIndex })
    
    // 如果游戏正在进行中（非等待阶段），新玩家标记为等待下一局
    const isGameInProgress = this.gameStarted && this.game.state.phase !== 'waiting' && this.game.state.phase !== 'ended'
    this.game.addPlayer(seatIndex, playerName, chips, 'human', isGameInProgress)
    
    // 第一个加入的玩家是房主，记录座位
    if (this.hostSeatIndex === -1) {
      this.hostSeatIndex = seatIndex
    }
    
    return { seatIndex, waitingForNextRound: isGameInProgress }
  }

  // 重连玩家
  reconnectClient(clientId, ws, playerName, seatIndex) {
    const disconnected = this.disconnectedPlayers.get(seatIndex)
    if (!disconnected || disconnected.playerName !== playerName) {
      return null
    }
    
    // 恢复连接
    this.clients.set(clientId, { ws, playerName, seatIndex })
    this.disconnectedPlayers.delete(seatIndex)
    
    console.log(`🔄 玩家重连: ${playerName} 座位${seatIndex}`)
    
    return { seatIndex, chips: disconnected.chips }
  }

  // 检查是否可以重连
  canReconnect(playerName) {
    for (const [seatIndex, info] of this.disconnectedPlayers) {
      if (info.playerName === playerName) {
        // 检查是否超时
        if (Date.now() - info.disconnectedAt < this.reconnectTimeout) {
          return { seatIndex, ...info }
        } else {
          // 超时，清理
          this.disconnectedPlayers.delete(seatIndex)
          this.game.removePlayer(seatIndex)
        }
      }
    }
    return null
  }

  removeClient(clientId, isDisconnect = false) {
    const client = this.clients.get(clientId)
    if (!client) return false

    // 如果是断线且游戏已开始（任何阶段），保留座位等待重连
    if (isDisconnect && this.gameStarted) {
      const player = this.game.seats[client.seatIndex]
      if (player) {
        this.disconnectedPlayers.set(client.seatIndex, {
          playerName: client.playerName,
          chips: player.chips,
          disconnectedAt: Date.now()
        })
        console.log(`⏸️ 玩家断线，保留座位: ${client.playerName} 座位${client.seatIndex} (阶段: ${this.game.state.phase})`)
      }
    } else {
      this.game.removePlayer(client.seatIndex)
    }
    
    this.clients.delete(clientId)
    return true
  }

  // 固定的 10 个 AI 名字
  static AI_NAMES = ['小明', '小红', '阿强', '老王', '大壮', '飞哥', '豆豆', '皮皮', '乐乐', '天天']

  addAI() {
    const seatIndex = this.findEmptySeat()
    if (seatIndex === -1) return null

    // 获取已使用的 AI 名字
    const usedNames = new Set()
    for (const seat of this.game.seats) {
      if (seat && seat.type === 'ai') usedNames.add(seat.name)
    }
    
    // 从固定列表中找一个未使用的名字
    let aiName = null
    for (const name of Room.AI_NAMES) {
      if (!usedNames.has(name)) {
        aiName = name
        break
      }
    }
    
    // 所有 AI 名字都用完了
    if (!aiName) return null
    
    this.aiCounter++
    this.game.addPlayer(seatIndex, aiName, 3000, 'ai')
    
    return { seatIndex, name: aiName }
  }

  removeAI(seatIndex) {
    const player = this.game.seats[seatIndex]
    if (!player || player.type !== 'ai') return false
    return this.game.removePlayer(seatIndex)
  }

  findEmptySeat() {
    // 优先填充上下左右4个位置：底部(0)、顶部(5)、左侧(6)、右侧(2)
    const prioritySeats = [0, 5, 6, 2]
    const otherSeats = [1, 4, 7, 3]
    
    // 先找优先座位
    for (const i of prioritySeats) {
      if (!this.game.seats[i] && !this.disconnectedPlayers.has(i)) return i
    }
    // 再找其他座位
    for (const i of otherSeats) {
      if (!this.game.seats[i] && !this.disconnectedPlayers.has(i)) return i
    }
    return -1
  }

  getSeatIndex(clientId) {
    const client = this.clients.get(clientId)
    return client ? client.seatIndex : -1
  }

  broadcast(message, excludeClientId = null) {
    this.clients.forEach((client, clientId) => {
      if (clientId !== excludeClientId && client.ws.readyState === 1) {
        client.ws.send(JSON.stringify(message))
      }
    })
  }

  sendTo(clientId, message) {
    const client = this.clients.get(clientId)
    if (client && client.ws.readyState === 1) {
      client.ws.send(JSON.stringify(message))
    }
  }

  broadcastGameState() {
    this.clients.forEach((client, clientId) => {
      const state = this.game.getStateForPlayer(client.seatIndex)
      this.sendTo(clientId, { type: 'game_state', state })
    })
  }

  getPlayerList() {
    return this.game.seats
      .map((p, i) => p ? { 
        seatIndex: i, 
        name: p.name, 
        type: p.type, 
        chips: p.chips,
        waitingForNextRound: p.waitingForNextRound || false
      } : null)
      .filter(p => p)
  }

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

  isHost(clientId) {
    return clientId === this.hostId
  }

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
  
  // 清理超时的断线玩家
  cleanupDisconnected() {
    const now = Date.now()
    for (const [seatIndex, info] of this.disconnectedPlayers) {
      if (now - info.disconnectedAt >= this.reconnectTimeout) {
        this.disconnectedPlayers.delete(seatIndex)
        this.game.removePlayer(seatIndex)
        console.log(`🗑️ 清理超时断线玩家: ${info.playerName}`)
      }
    }
  }
}
