/**
 * 游戏相关消息处理器
 */
import {
  handleStartGame as startGame,
  handlePlayerAction as playerAction,
  handleReconnect as reconnect,
  handleBatchTest as batchTest
} from '../../services/GameService.js'

export function handleStartGame(clientId, clients) {
  startGame(clientId)
}

export function handlePlayerAction(clientId, data, clients) {
  playerAction(clientId, data)
}

export function handleReconnect(clientId, data, clients) {
  reconnect(clientId, data)
}

export function handleBatchTest(clientId, data, clients) {
  batchTest(clientId, data)
}
