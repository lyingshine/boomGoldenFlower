/**
 * 游戏状态差异计算
 * 只发送变化的字段，减少网络传输
 */

// 存储每个客户端的上一次状态
const clientStates = new Map()

/**
 * 计算两个对象的差异
 * @param {Object} oldState - 旧状态
 * @param {Object} newState - 新状态
 * @returns {Object|null} - 差异对象，如果没有变化返回 null
 */
export function calculateDiff(oldState, newState) {
  if (!oldState) return newState
  if (!newState) return null
  
  const diff = {}
  let hasChanges = false
  
  for (const key of Object.keys(newState)) {
    const oldVal = oldState[key]
    const newVal = newState[key]
    
    if (key === 'seats') {
      // 座位数组特殊处理
      const seatsDiff = calculateSeatsDiff(oldVal, newVal)
      if (seatsDiff) {
        diff.seats = seatsDiff
        hasChanges = true
      }
    } else if (typeof newVal === 'object' && newVal !== null && !Array.isArray(newVal)) {
      // 嵌套对象递归比较
      const nestedDiff = calculateDiff(oldVal, newVal)
      if (nestedDiff) {
        diff[key] = nestedDiff
        hasChanges = true
      }
    } else if (!isEqual(oldVal, newVal)) {
      diff[key] = newVal
      hasChanges = true
    }
  }
  
  return hasChanges ? diff : null
}

/**
 * 计算座位数组的差异
 * 注意：如果旧座位为空但新座位有数据，需要发送完整的座位信息
 */
function calculateSeatsDiff(oldSeats, newSeats) {
  if (!oldSeats || !newSeats) return newSeats
  
  const diff = {}
  let hasChanges = false
  
  for (let i = 0; i < 8; i++) {
    const oldSeat = oldSeats[i]
    const newSeat = newSeats[i]
    
    if (!oldSeat && !newSeat) continue
    
    if (!oldSeat || !newSeat) {
      // 座位从无到有或从有到无，发送完整数据
      diff[i] = newSeat
      hasChanges = true
      continue
    }
    
    // 比较座位属性 - 包含所有可能变化的字段
    const seatDiff = {}
    let seatHasChanges = false
    
    const keys = ['id', 'name', 'type', 'avatarUrl',
                  'chips', 'currentBet', 'lastBetAmount', 'lastBetBlind', 
                  'folded', 'hasPeeked', 'isAllIn', 'lostShowdown', 
                  'cards', 'handType', 'cardCount']
    
    for (const key of keys) {
      if (!isEqual(oldSeat[key], newSeat[key])) {
        seatDiff[key] = newSeat[key]
        seatHasChanges = true
      }
    }
    
    if (seatHasChanges) {
      diff[i] = seatDiff
      hasChanges = true
    }
  }
  
  return hasChanges ? diff : null
}

/**
 * 简单的深度比较
 */
function isEqual(a, b) {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== typeof b) return false
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((val, i) => isEqual(val, b[i]))
  }
  
  if (typeof a === 'object') {
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)
    if (keysA.length !== keysB.length) return false
    return keysA.every(key => isEqual(a[key], b[key]))
  }
  
  return false
}

/**
 * 获取客户端的状态差异
 */
export function getStateDiffForClient(clientId, newState) {
  const oldState = clientStates.get(clientId)
  const diff = calculateDiff(oldState, newState)
  
  // 更新缓存
  clientStates.set(clientId, JSON.parse(JSON.stringify(newState)))
  
  return diff
}

/**
 * 清除客户端状态缓存
 */
export function clearClientState(clientId) {
  clientStates.delete(clientId)
}

/**
 * 清除所有状态缓存
 */
export function clearAllStates() {
  clientStates.clear()
}
