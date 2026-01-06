/**
 * 用户服务
 * 统一导出用户相关功能
 */

// 从子模块导出
export { 
  loadUsersToCache, 
  saveUserData, 
  getUsersCache, 
  getCachedUser, 
  setCachedUser 
} from './user/UserCache.js'

export { 
  registerUser, 
  loginUser 
} from './user/UserAuth.js'

export { 
  signInUser, 
  getUserData, 
  updateUserProfile, 
  getLeaderboard 
} from './user/UserProfile.js'
