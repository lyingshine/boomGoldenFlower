/**
 * 断线重连管理器
 * 处理玩家断线和重连逻辑
 */

export class DisconnectManager {
  constructor(reconnectTimeout = 5 * 60 * 1000) {
    // 断线玩家信息，用于重连
    this.disconnectedPlayers = new Map() // seatIndex -> { playerName, chips, disconnectedAt }
    this.reconnectTimeout = reconnectTimeout
  }

  // 记录断线玩家
  recordDisconnect(seatIndex, playerName, chips) {
    this.disconnectedPlayers.set(seatIndex, {
      playerName,
      chips,
      disconnectedAt: Date.now()
    })
    console.log(`⏸️ 玩家断线，保留座位: ${playerName} 座位${seatIndex}`)
  }

  // 检查是否可以重连
  canReconnect(playerName) {
    for (const [seatIndex, info] of this.disconnectedPlayers) {
      if (info.playerName === playerName) {
        if (Date.now() - info.disconnectedAt < this.reconnectTimeout) {
          return { seatIndex, ...info }
        } else {
          this.disconnectedPlayers.delete(seatIndex)
        }
      }
    }
    return null
  }

  // 完成重连
  completeReconnect(seatIndex) {
    const info = this.disconnectedPlayers.get(seatIndex)
    this.disconnectedPlayers.delete(seatIndex)
    return info
  }

  // 检查座位是否被断线玩家占用
  isSeatReserved(seatIndex) {
    return this.disconnectedPlayers.has(seatIndex)
  }

  // 清理超时的断线玩家
  cleanupExpired(onCleanup) {
    const now = Date.now()
    for (const [seatIndex, info] of this.disconnectedPlayers) {
      if (now - info.disconnectedAt >= this.reconnectTimeout) {
        this.disconnectedPlayers.delete(seatIndex)
        if (onCleanup) onCleanup(seatIndex, info)
        console.log(`🗑️ 清理超时断线玩家: ${info.playerName}`)
      }
    }
  }

  // 获取断线玩家数量
  get size() {
    return this.disconnectedPlayers.size
  }

  // 遍历断线玩家
  forEach(callback) {
    this.disconnectedPlayers.forEach(callback)
  }
}
