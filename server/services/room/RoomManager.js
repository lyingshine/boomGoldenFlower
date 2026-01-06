/**
 * 房间管理器
 * 管理房间的创建、查询、删除
 */
import { Room } from '../../game/Room.js'
import { 
  getRooms as getRoomsFromStore,
  setRoom,
  deleteRoom as deleteRoomFromStore
} from '../../store/StateStore.js'

export function getRooms() {
  return getRoomsFromStore()
}

// 生成房间号
export function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// 获取房间列表
export function getRoomList() {
  const rooms = getRoomsFromStore()
  return Array.from(rooms.values()).map(r => r.getInfo())
}

// 验证房间
export function verifyRoom(roomCode) {
  const rooms = getRoomsFromStore()
  const room = rooms.get(roomCode)
  return {
    exists: !!room,
    roomInfo: room ? room.getInfo() : null
  }
}

// 创建房间实例
export function createRoomInstance(roomCode, hostId, hostName) {
  const room = new Room(roomCode, hostId, hostName)
  setRoom(roomCode, room)
  return room
}

// 删除房间
export function deleteRoom(roomCode) {
  deleteRoomFromStore(roomCode)
}
