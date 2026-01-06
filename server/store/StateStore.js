/**
 * 全局状态存储
 * 统一管理 rooms 和 clients，避免循环依赖
 */

/**
 * @typedef {import('ws').WebSocket} WebSocket
 * @typedef {import('../game/Room.js').Room} Room
 */

/**
 * @typedef {Object} ClientInfo
 * @property {WebSocket} ws - WebSocket 连接
 * @property {string|null} roomCode - 所在房间号
 * @property {string|null} playerName - 玩家名称
 */

/** @type {Map<string, Room>} */
const rooms = new Map()

/** @type {Map<string, ClientInfo>} */
const clients = new Map()

/** @type {number} */
let clientIdCounter = 0

/**
 * 获取所有房间
 * @returns {Map<string, Room>}
 */
export function getRooms() {
  return rooms
}

/**
 * 获取所有客户端
 * @returns {Map<string, ClientInfo>}
 */
export function getClients() {
  return clients
}

/**
 * 生成唯一客户端 ID
 * @returns {string}
 */
export function generateClientId() {
  return `client_${++clientIdCounter}_${Date.now()}`
}

/**
 * 发送消息给客户端
 * @param {WebSocket} ws - WebSocket 连接
 * @param {Object} message - 要发送的消息对象
 */
export function send(ws, message) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(message))
  }
}

/**
 * 获取房间
 * @param {string} roomCode - 房间号
 * @returns {Room|undefined}
 */
export function getRoom(roomCode) {
  return rooms.get(roomCode)
}

/**
 * 设置房间
 * @param {string} roomCode - 房间号
 * @param {Room} room - 房间实例
 */
export function setRoom(roomCode, room) {
  rooms.set(roomCode, room)
}

/**
 * 删除房间
 * @param {string} roomCode - 房间号
 */
export function deleteRoom(roomCode) {
  rooms.delete(roomCode)
}

/**
 * 获取客户端
 * @param {string} clientId - 客户端 ID
 * @returns {ClientInfo|undefined}
 */
export function getClient(clientId) {
  return clients.get(clientId)
}

/**
 * 设置客户端
 * @param {string} clientId - 客户端 ID
 * @param {ClientInfo} client - 客户端信息
 */
export function setClient(clientId, client) {
  clients.set(clientId, client)
}

/**
 * 删除客户端
 * @param {string} clientId - 客户端 ID
 */
export function deleteClient(clientId) {
  clients.delete(clientId)
}
