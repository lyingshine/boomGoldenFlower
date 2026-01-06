/**
 * 用户认证
 * 处理注册、登录逻辑
 */
import { getUser, createUser } from '../../db/mysql.js'
import { getUsersCache, setCachedUser, saveUserData } from './UserCache.js'
import { validateUsername, validatePassword, validateAll } from '../../validators/index.js'
import { ErrorCode, createError } from '../../constants/errors.js'
import { hashPassword, verifyPassword, sanitizeUser, loginLimiter } from '../../utils/security.js'
import { userLog } from '../../utils/logger.js'

// 用户注册
export async function registerUser(username, password) {
  // 输入验证
  const validation = validateAll(
    validateUsername(username),
    validatePassword(password)
  )
  
  if (!validation.isValid) {
    throw createError(ErrorCode.INVALID_INPUT, validation.firstError.message)
  }
  
  const usersCache = getUsersCache()
  if (usersCache[username]) {
    throw createError(ErrorCode.USER_ALREADY_EXISTS)
  }
  
  // 加密密码
  const hashedPassword = await hashPassword(password)
  
  const newUser = await createUser({
    username: username.trim(),
    password: hashedPassword
  })
  
  setCachedUser(username, newUser)
  userLog.register(username)
  
  return { 
    success: true, 
    message: '注册成功',
    user: sanitizeUser(newUser)
  }
}

// 用户登录
export async function loginUser(username, password) {
  // 输入验证
  const validation = validateAll(
    validateUsername(username),
    validatePassword(password)
  )
  
  if (!validation.isValid) {
    throw createError(ErrorCode.INVALID_INPUT, validation.firstError.message)
  }
  
  // 检查登录限流
  if (loginLimiter.isLimited(username)) {
    userLog.loginFailed(username, '登录尝试次数过多')
    throw createError(ErrorCode.USER_LOCKED, '登录尝试次数过多，请稍后再试')
  }
  
  const user = await getUser(username)
  if (!user) {
    userLog.loginFailed(username, '用户不存在')
    throw createError(ErrorCode.USER_NOT_FOUND)
  }
  
  // 验证密码
  const isValid = await verifyPassword(password, user.password)
  if (!isValid) {
    userLog.loginFailed(username, '密码错误')
    throw createError(ErrorCode.INVALID_CREDENTIALS)
  }
  
  // 登录成功，重置限流
  loginLimiter.reset(username)
  
  user.lastLogin = Date.now()
  setCachedUser(username, user)
  saveUserData(username)
  
  userLog.login(username)
  
  return { 
    success: true, 
    message: '登录成功',
    user: sanitizeUser(user)
  }
}
