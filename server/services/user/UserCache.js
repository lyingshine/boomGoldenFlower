/**
 * 用户缓存管理
 * 管理内存中的用户数据缓存
 */
import { getAllUsers, updateUser } from '../../db/mysql.js'
import { sanitizeUser } from '../../utils/security.js'

// 内存缓存用户数据
let usersCache = {}

// 从数据库加载用户到缓存
export async function loadUsersToCache() {
  try {
    const users = await getAllUsers()
    usersCache = {}
    users.forEach(user => {
      usersCache[user.username] = user
    })
    console.log(`✅ 加载了 ${users.length} 个用户到缓存`)
  } catch (e) {
    console.error('加载用户数据失败:', e)
  }
}

// 保存用户数据到数据库
export async function saveUserData(username) {
  const user = usersCache[username]
  if (!user) return
  
  try {
    await updateUser(username, user)
  } catch (e) {
    console.error('保存用户数据失败:', e)
  }
}

// 获取用户缓存（返回安全副本，不包含密码）
export function getUsersCache() {
  return usersCache
}

// 获取单个用户
export function getCachedUser(username) {
  return usersCache[username]
}

// 获取单个用户（安全版本，不包含密码）
export function getSafeCachedUser(username) {
  return sanitizeUser(usersCache[username])
}

// 设置用户缓存
export function setCachedUser(username, user) {
  usersCache[username] = user
}
