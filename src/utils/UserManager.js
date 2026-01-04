/**
 * 用户管理器 - 处理用户注册、登录（通过服务器验证）
 */
export class UserManager {
  constructor(networkManager) {
    this.networkManager = networkManager
    this.currentUserKey = 'zhajinhua_current_user'
    this.currentUser = null
    this.loadCurrentUser()
  }

  // 设置网络管理器
  setNetworkManager(nm) {
    this.networkManager = nm
  }

  // 加载当前登录用户（仅用于恢复会话）
  loadCurrentUser() {
    try {
      const userData = localStorage.getItem(this.currentUserKey)
      if (userData) {
        this.currentUser = JSON.parse(userData)
        console.log('恢复用户会话:', this.currentUser.username)
      }
    } catch (error) {
      // Safari 隐私模式下 localStorage 可能不可用
      console.warn('加载当前用户失败:', error)
    }
  }

  // 保存当前登录用户
  saveCurrentUser() {
    try {
      if (this.currentUser) {
        localStorage.setItem(this.currentUserKey, JSON.stringify(this.currentUser))
      }
    } catch (error) {
      // Safari 隐私模式下 localStorage 可能不可用
      console.warn('保存当前用户失败:', error)
    }
  }

  // 用户注册（服务器验证）
  async register(username, password) {
    if (!this.networkManager) {
      return { success: false, message: '网络未连接' }
    }
    
    try {
      await this.networkManager.connect()
      const result = await this.networkManager.register(username, password)
      
      if (result.success && result.user) {
        this.currentUser = result.user
        this.saveCurrentUser()
      }
      
      return result
    } catch (e) {
      return { success: false, message: '网络错误' }
    }
  }

  // 用户登录（服务器验证）
  async login(username, password) {
    if (!this.networkManager) {
      return { success: false, message: '网络未连接' }
    }
    
    try {
      await this.networkManager.connect()
      const result = await this.networkManager.login(username, password)
      
      if (result.success && result.user) {
        this.currentUser = result.user
        this.saveCurrentUser()
      }
      
      return result
    } catch (e) {
      return { success: false, message: '网络错误' }
    }
  }

  // 用户登出
  logout() {
    this.currentUser = null
    localStorage.removeItem(this.currentUserKey)
    console.log('用户登出')
  }

  // 获取当前用户
  getCurrentUser() {
    return this.currentUser
  }

  // 是否已登录
  isLoggedIn() {
    return this.currentUser !== null
  }

  // 更新本地用户数据
  updateUser(userData) {
    if (this.currentUser && userData) {
      this.currentUser = { ...this.currentUser, ...userData }
      this.saveCurrentUser()
    }
  }

  // 检查今天是否已签到
  canSignIn() {
    if (!this.currentUser) return false
    if (!this.currentUser.lastSignIn) return true
    
    const today = new Date().toDateString()
    const lastSignIn = new Date(this.currentUser.lastSignIn).toDateString()
    return today !== lastSignIn
  }

  // 签到（服务器验证）
  async signIn() {
    if (!this.currentUser) {
      return { success: false, message: '请先登录' }
    }
    
    if (!this.canSignIn()) {
      return { success: false, message: '今天已经签到过了' }
    }
    
    if (!this.networkManager) {
      return { success: false, message: '网络未连接' }
    }
    
    try {
      await this.networkManager.connect()
      const result = await this.networkManager.signIn(this.currentUser.username)
      
      if (result.success && result.user) {
        this.currentUser = result.user
        this.saveCurrentUser()
      }
      
      return result
    } catch (e) {
      return { success: false, message: '网络错误' }
    }
  }

  // 获取签到信息
  getSignInInfo() {
    if (!this.currentUser) return null
    
    return {
      canSignIn: this.canSignIn(),
      streak: this.currentUser.signInStreak || 0,
      totalSignIns: this.currentUser.totalSignIns || 0,
      lastSignIn: this.currentUser.lastSignIn
    }
  }
}
