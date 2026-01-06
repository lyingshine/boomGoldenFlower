/**
 * 用户服务
 * 处理用户缓存、认证、签到等逻辑
 */
import { getAllUsers, getUser, createUser, updateUser } from '../db/mysql.js'

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

// 获取用户缓存
export function getUsersCache() {
  return usersCache
}

// 获取单个用户
export function getCachedUser(username) {
  return usersCache[username]
}

// 设置用户缓存
export function setCachedUser(username, user) {
  usersCache[username] = user
}

// 用户注册
export async function registerUser(username, password) {
  if (!username || username.trim() === '') {
    return { success: false, message: '用户名不能为空' }
  }
  
  if (!password || password.trim() === '') {
    return { success: false, message: '密码不能为空' }
  }
  
  if (username.length < 2 || username.length > 10) {
    return { success: false, message: '用户名长度为2-10个字符' }
  }
  
  if (password.length < 4) {
    return { success: false, message: '密码至少4个字符' }
  }
  
  if (usersCache[username]) {
    return { success: false, message: '用户名已存在' }
  }
  
  try {
    const newUser = await createUser({
      username: username.trim(),
      password: password
    })
    
    usersCache[username] = newUser
    console.log('📝 注册新用户:', username)
    
    return { 
      success: true, 
      message: '注册成功',
      user: { ...newUser, password: undefined }
    }
  } catch (e) {
    console.error('注册失败:', e)
    return { success: false, message: '注册失败，请重试' }
  }
}

// 用户登录
export async function loginUser(username, password) {
  if (!username || username.trim() === '') {
    return { success: false, message: '用户名不能为空' }
  }
  
  if (!password || password.trim() === '') {
    return { success: false, message: '密码不能为空' }
  }
  
  try {
    const user = await getUser(username)
    if (!user) {
      return { success: false, message: '用户不存在' }
    }
    
    if (user.password !== password) {
      return { success: false, message: '密码错误' }
    }
    
    user.lastLogin = Date.now()
    usersCache[username] = user
    saveUserData(username)
    
    console.log('✅ 用户登录:', username)
    
    return { 
      success: true, 
      message: '登录成功',
      user: { ...user, password: undefined }
    }
  } catch (e) {
    console.error('登录失败:', e.message)
    return { success: false, message: '登录失败，请重试' }
  }
}

// 用户签到
export function signInUser(username) {
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
  
  try {
    const user = await getUser(username)
    if (!user) {
      return { success: false, message: '用户不存在' }
    }
    
    usersCache[username] = user
    
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
    usersCache[username] = user
    
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
  const userList = Object.values(usersCache)
  
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
