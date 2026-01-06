/**
 * 客户端管理器
 * 管理 WebSocket 客户端连接
 */
import { 
  getClients as getClientsFromStore, 
  generateClientId, 
  send as sendToClient 
} from '../../store/StateStore.js'

export function getClients() {
  return getClientsFromStore()
}

export function generateId() {
  return generateClientId()
}

export function send(ws, data) {
  sendToClient(ws, data)
}
