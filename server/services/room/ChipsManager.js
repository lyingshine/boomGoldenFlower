/**
 * 筹码管理器
 * 处理用户筹码的更新和同步
 */
import { saveUserData, getUsersCache } from '../UserService.js'

// 离开房间时更新用户筹码
export function updateUserChipsOnLeave(playerName, seatIndex, room, isDisconnect) {
  const usersCache = getUsersCache()
  if (!playerName || !usersCache[playerName]) return
  if (seatIndex === -1 || seatIndex === undefined) return
  
  const player = room.game.seats[seatIndex]
  if (!player || player.type !== 'human') return
  
  if (!isDisconnect) {
    usersCache[playerName].chips = player.chips
    saveUserData(playerName)
    console.log(`💰 主动离开，更新筹码: ${playerName} -> ${player.chips}`)
  } else {
    console.log(`⏸️ 断线，保留筹码等待重连: ${playerName}`)
  }
}

// 更新用户筹码（游戏中）
export function updateUserChips(room) {
  const usersCache = getUsersCache()
  room.game.seats.forEach(player => {
    if (player && player.type === 'human' && usersCache[player.name]) {
      usersCache[player.name].chips = player.chips
      saveUserData(player.name)
    }
  })
}

// 定期检查断线超时
export function startDisconnectChecker(rooms) {
  const usersCache = getUsersCache()
  setInterval(() => {
    rooms.forEach((room) => {
      room.disconnectedPlayers.forEach((info, seatIndex) => {
        if (Date.now() - info.disconnectedAt >= room.reconnectTimeout) {
          if (info.playerName && usersCache[info.playerName]) {
            usersCache[info.playerName].chips = info.chips
            saveUserData(info.playerName)
            console.log(`⏰ 重连超时，更新筹码: ${info.playerName} -> ${info.chips}`)
          }
          room.disconnectedPlayers.delete(seatIndex)
          room.game.removePlayer(seatIndex)
        }
      })
    })
  }, 30000)
}
