/**
 * 用户资料管理
 * 处理签到、资料更新、排行榜等
 */
import { getUser, updateUser } from '../../db/mysql.js'
import { getUsersCache, setCachedUser, saveUserData } from './UserCache.js'

// 用户签到
export function signInUser(username) {
  const usersCache = getUsersCache()
  if (!username || !usersCache[username]) {
    return { success: false, message: '用户不存在' }
  }
  
  const user = usersCache[username]
  const today = new Date().toDateString()
  const lastSignIn = user.lastSignIn ? new Date(user.lastSignIn).toDateString() : null
  
  if (today === lastSignIn) {
    return { success: false, message: '今天已经签到过了' }
  }
  
  const now = Date.now()
  if (lastSignIn) {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (lastSignIn === yesterday.toDateString()) {
      user.signInStreak = (user.signInStreak || 0) + 1
    } else {
      user.signInStreak = 1
    }
  } else {
    user.signInStreak = 1
  }
  
  const streak = Math.min(user.signInStreak, 7)
  const reward = 100 + (streak - 1) * 50
  
  user.lastSignIn = now
  user.totalSignIns = (user.totalSignIns || 0) + 1
  user.chips += reward
  
  saveUserData(username)
  
  return {
    success: true,
    reward,
    streak: user.signInStreak,
    totalChips: user.chips,
    user: { ...user, password: undefined }
  }
}

// 获取用户数据
export async function getUserData(username) {
  if (!username) {
    return { success: false, message: '用户名不能为空' }
  }
  
  const usersCache = getUsersCache()
  
  try {
    const user = await getUser(username)
    if (!user) {
      return { success: false, message: '用户不存在' }
    }
    
    setCachedUser(username, user)
    
    return {
      success: true,
      user: { ...user, password: undefined }
    }
  } catch (e) {
    console.error('获取用户数据失败:', e.message)
    if (usersCache[username]) {
      return {
        success: true,
        user: { ...usersCache[username], password: undefined }
      }
    }
    return { success: false, message: '获取用户数据失败' }
  }
}


// 更新用户资料
export async function updateUserProfile(username, { nickname, avatar, avatarUrl }) {
  if (!username) {
    return { success: false, message: '用户名不能为空' }
  }
  
  try {
    const user = await getUser(username)
    if (!user) {
      return { success: false, message: '用户不存在' }
    }
    
    if (nickname !== undefined) user.nickname = nickname
    if (avatar !== undefined) user.avatar = avatar
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl
    
    await updateUser(username, user)
    setCachedUser(username, user)
    
    console.log(`✏️ 用户 ${username} 更新资料:`, { nickname, avatar, avatarUrl })
    
    return {
      success: true,
      user: { ...user, password: undefined }
    }
  } catch (e) {
    console.error('更新用户资料失败:', e)
    return { success: false, message: '更新失败' }
  }
}

// 获取排行榜
export function getLeaderboard(leaderboardType = 'chips', limit = 999) {
  const usersCache = getUsersCache()
  // 过滤掉管理员
  const userList = Object.values(usersCache).filter(u => !u.isAdmin)
  
  let sorted
  switch (leaderboardType) {
    case 'chips':
      sorted = [...userList].sort((a, b) => (b.chips || 0) - (a.chips || 0))
      break
    case 'wins':
      sorted = [...userList].sort((a, b) => (b.wins || 0) - (a.wins || 0))
      break
    case 'winRate':
      sorted = [...userList]
        .filter(u => (u.totalGames || 0) >= 10)
        .sort((a, b) => {
          const rateA = a.totalGames ? (a.wins / a.totalGames) : 0
          const rateB = b.totalGames ? (b.wins / b.totalGames) : 0
          return rateB - rateA
        })
      break
    default:
      sorted = [...userList]
  }
  
  return sorted.slice(0, limit).map((user, index) => ({
    rank: index + 1,
    username: user.username,
    chips: user.chips || 0,
    wins: user.wins || 0,
    totalGames: user.totalGames || 0,
    winRate: user.totalGames ? Math.round((user.wins / user.totalGames) * 100) : 0
  }))
}
