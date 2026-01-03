import { GameEngine } from './GameEngine.js'

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
    this.game = new GameEngine(roomCode)
    this.aiCounter = 0
    this.gameStarted = false
    // 断线玩家信息，用于重连
    this.disconnectedPlayers = new Map() // seatIndex -> { playerName, chips, disconnectedAt }
    this.reconnectTimeout = 5 * 60 * 1000 // 5分钟重连超时
  }

  addClient(clientId, ws, playerName, chips = 1000) {
    if (this.clients.size >= this.maxPlayers) return null
    
    const seatIndex = this.findEmptySeat()
    if (seatIndex === -1) return null

    this.clients.set(clientId, { ws, playerName, seatIndex })
    this.game.addPlayer(seatIndex, playerName, chips, 'human')
    
    return { seatIndex }
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

    // 如果是断线且游戏进行中，保留座位
    if (isDisconnect && this.gameStarted && this.game.state.phase === 'betting') {
      const player = this.game.seats[client.seatIndex]
      if (player) {
        this.disconnectedPlayers.set(client.seatIndex, {
          playerName: client.playerName,
          chips: player.chips,
          disconnectedAt: Date.now()
        })
        console.log(`⏸️ 玩家断线，保留座位: ${client.playerName} 座位${client.seatIndex}`)
      }
    } else {
      this.game.removePlayer(client.seatIndex)
    }
    
    this.clients.delete(clientId)
    return true
  }

  addAI() {
    const seatIndex = this.findEmptySeat()
    if (seatIndex === -1) return null

    this.aiCounter++
    const aiName = `AI-${this.aiCounter}`
    this.game.addPlayer(seatIndex, aiName, 3000, 'ai')
    
    return { seatIndex, name: aiName }
  }

  removeAI(seatIndex) {
    const player = this.game.seats[seatIndex]
    if (!player || player.type !== 'ai') return false
    return this.game.removePlayer(seatIndex)
  }

  findEmptySeat() {
    for (let i = 0; i < 8; i++) {
      // 跳过断线玩家保留的座位
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
      .map((p, i) => p ? { seatIndex: i, name: p.name, type: p.type, chips: p.chips } : null)
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
