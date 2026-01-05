/**
 * 网络管理器 - 与服务端通信
 * 客户端只发送操作意图，服务端执行并返回结果
 */
export class NetworkManager {
  constructor() {
    this.ws = null
    this.clientId = null
    this.isConnected = false
    this.isHost = false
    this.roomCode = null
    this.seatIndex = -1
    
    // 延迟初始化 serverUrl，iOS PWA 模式下 window.location 可能需要时间
    this.serverUrl = null
    this._initServerUrl()
    
    console.log('🔧 WebSocket URL:', this.serverUrl)
    
    // 回调函数
    this.onConnected = null
    this.onDisconnected = null
    this.onRoomCreated = null
    this.onRoomJoined = null
    this.onPlayerJoined = null
    this.onPlayerLeft = null
    this.onRoomClosed = null
    this.onAIAdded = null
    this.onAIRemoved = null
    this.onGameState = null
    this.onGameStarted = null
    this.onActionResult = null
    this.onActionFailed = null
    this.onRoomsList = null
    this.onReconnectSuccess = null
    this.onReconnectFailed = null
    this.onPlayerDisconnected = null
    this.onPlayerReconnected = null
    this.onChatMessage = null
    this.onActionMessage = null
    
    // 自动重连
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectDelay = 2000
  }

  // 初始化服务器 URL（iOS PWA 兼容）
  _initServerUrl() {
    try {
      const loc = window.location
      let host = loc.host || loc.hostname
      
      // iOS PWA 模式下可能获取不到 host
      if (!host || host === '') {
        // 尝试从 href 解析
        const href = loc.href || ''
        const match = href.match(/^https?:\/\/([^\/]+)/)
        if (match) {
          host = match[1]
        } else {
          host = 'localhost'
        }
      }
      
      const isSecure = loc.protocol === 'https:'
      const wsProtocol = isSecure ? 'wss:' : 'ws:'
      this.serverUrl = `${wsProtocol}//${host}/ws`
    } catch (e) {
      console.error('初始化 serverUrl 失败:', e)
      this.serverUrl = 'wss://localhost/ws'
    }
  }

  // 保存会话信息到本地
  saveSession() {
    if (this.roomCode) {
      const session = {
        roomCode: this.roomCode,
        seatIndex: this.seatIndex,
        isHost: this.isHost,
        timestamp: Date.now()
      }
      try {
        localStorage.setItem('gameSession', JSON.stringify(session))
      } catch (e) {
        // Safari 隐私模式下 localStorage 可能不可用
        console.warn('无法保存会话:', e)
      }
    }
  }

  // 获取保存的会话
  getSavedSession() {
    try {
      const data = localStorage.getItem('gameSession')
      if (!data) return null
      
      const session = JSON.parse(data)
      // 5分钟内有效
      if (Date.now() - session.timestamp > 5 * 60 * 1000) {
        this.clearSession()
        return null
      }
      return session
    } catch {
      return null
    }
  }

  // 清除会话
  clearSession() {
    try {
      localStorage.removeItem('gameSession')
    } catch (e) {
      console.warn('无法清除会话:', e)
    }
  }

  connect() {
    // 如果已经连接且有clientId，直接返回
    // Safari 兼容：使用数字 1 代替 WebSocket.OPEN
    if (this.isConnected && this.clientId && this.ws && this.ws.readyState === 1) {
      return Promise.resolve()
    }
    
    // 如果正在连接中，等待连接完成
    if (this._connectingPromise) {
      return this._connectingPromise
    }
    
    // iOS Safari/PWA: 每次连接前重新获取 URL，清理僵尸状态
    this._initServerUrl()
    this.isConnected = false
    console.log('🔌 正在连接:', this.serverUrl)
    
    this._connectingPromise = new Promise((resolve, reject) => {
      let resolved = false
      let timeoutId = null
      
      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId)
        this._connectingPromise = null
      }
      
      const doResolve = () => {
        if (resolved) return
        resolved = true
        cleanup()
        resolve()
      }
      
      const doReject = (error) => {
        if (resolved) return
        resolved = true
        cleanup()
        reject(error)
      }
      
      try {
        // 关闭旧连接
        if (this.ws) {
          try {
            this.ws.onclose = null
            this.ws.onerror = null
            this.ws.onmessage = null
            this.ws.onopen = null
            this.ws.close()
          } catch (e) {
            // Safari 可能在某些状态下抛出异常
          }
          this.ws = null
        }
        
        console.log('🔌 正在连接:', this.serverUrl)
        this.ws = new WebSocket(this.serverUrl)
        
        this.ws.onopen = () => {
          console.log('✅ 已连接到游戏服务器')
          this.isConnected = true
          this.reconnectAttempts = 0
          if (this.onConnected) this.onConnected()
        }
        
        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            this.handleMessage(message)
            // 收到 clientId 后才算连接完成
            if (message.type === 'connected' && message.clientId) {
              doResolve()
            }
          } catch (error) {
            console.error('消息解析错误:', error)
          }
        }
        
        this.ws.onclose = (event) => {
          console.log('❌ 与服务器断开连接', event.code, event.reason)
          this.isConnected = false
          this.clientId = null
          if (this.onDisconnected) this.onDisconnected()
          doReject(new Error('连接关闭'))
          this.tryReconnect()
        }
        
        this.ws.onerror = (error) => {
          console.error('WebSocket错误:', error)
          this.isConnected = false
          // Safari 有时只触发 onerror 不触发 onclose
          doReject(new Error('连接错误'))
        }
        
        timeoutId = setTimeout(() => {
          doReject(new Error('连接超时'))
        }, 10000) // iOS Safari/PWA 可能需要更长时间
        
      } catch (error) {
        console.error('创建WebSocket失败:', error)
        doReject(error)
      }
    })
    
    return this._connectingPromise
  }

  // 尝试自动重连
  tryReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('❌ 重连失败，已达最大尝试次数')
      return
    }
    
    const session = this.getSavedSession()
    if (!session) return
    
    this.reconnectAttempts++
    console.log(`🔄 尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
    
    setTimeout(async () => {
      try {
        await this.connect()
        // 连接成功后尝试重连房间
        this.reconnectToRoom(session.roomCode)
      } catch (e) {
        console.error('重连失败:', e)
      }
    }, this.reconnectDelay)
  }

  // 重连到房间
  async reconnectToRoom(roomCode) {
    const playerName = localStorage.getItem('playerName')
    if (!playerName) return
    
    this.send({ type: 'reconnect', roomCode, playerName })
  }

  handleMessage(message) {
    console.log('📨 收到消息:', message.type, message)
    
    switch (message.type) {
      case 'connected':
        this.clientId = message.clientId
        break
        
      case 'room_created':
        this.isHost = true
        this.roomCode = message.roomCode
        this.seatIndex = message.seatIndex
        this.saveSession()
        if (this.onRoomCreated) this.onRoomCreated(message)
        break
        
      case 'room_joined':
        this.roomCode = message.roomCode
        this.seatIndex = message.seatIndex
        this.isHost = message.isHost
        this.saveSession()
        if (this.onRoomJoined) this.onRoomJoined(message)
        break
        
      case 'reconnect_success':
        this.roomCode = message.roomCode
        this.seatIndex = message.seatIndex
        this.isHost = message.isHost
        this.saveSession()
        if (this.onReconnectSuccess) this.onReconnectSuccess(message)
        break
        
      case 'reconnect_failed':
        this.clearSession()
        if (this.onReconnectFailed) this.onReconnectFailed(message.message)
        break
        
      case 'player_disconnected':
        if (this.onPlayerDisconnected) this.onPlayerDisconnected(message)
        break
        
      case 'player_reconnected':
        if (this.onPlayerReconnected) this.onPlayerReconnected(message)
        break
        
      case 'join_failed':
        console.error('加入失败:', message.message)
        break
        
      case 'player_joined':
        if (this.onPlayerJoined) this.onPlayerJoined(message)
        break
        
      case 'player_left':
        if (this.onPlayerLeft) this.onPlayerLeft(message)
        break
        
      case 'room_closed':
        this.clearSession()
        if (this.onRoomClosed) this.onRoomClosed(message.message)
        this.roomCode = null
        this.isHost = false
        break
        
      case 'room_verified':
        // Promise处理
        break
        
      case 'rooms_list':
        if (this.onRoomsList) this.onRoomsList(message.rooms)
        break
        
      case 'ai_added':
      case 'ai_removed':
        if (message.type === 'ai_added' && this.onAIAdded) this.onAIAdded(message)
        if (message.type === 'ai_removed' && this.onAIRemoved) this.onAIRemoved(message)
        break
        
      case 'game_state':
        if (this.onGameState) this.onGameState(message.state)
        break
        
      case 'game_started':
        if (this.onGameStarted) this.onGameStarted(message)
        break
        
      case 'action_result':
        if (this.onActionResult) this.onActionResult(message)
        break
        
      case 'action_failed':
        if (this.onActionFailed) this.onActionFailed(message.message)
        break
        
      case 'start_failed':
        console.error('开始游戏失败:', message.message)
        break
        
      case 'leaderboard':
        if (this.onLeaderboard) this.onLeaderboard(message)
        break
        
      case 'user_synced':
        // 用户数据同步成功
        break
        
      case 'register_result':
        if (this.onRegisterResult) this.onRegisterResult(message)
        break
        
      case 'login_result':
        if (this.onLoginResult) this.onLoginResult(message)
        break
        
      case 'sign_in_result':
        if (this.onSignInResult) this.onSignInResult(message)
        break
        
      case 'get_user_result':
        if (this.onGetUserResult) this.onGetUserResult(message)
        break
        
      case 'update_profile_result':
        if (this.onUpdateProfileResult) this.onUpdateProfileResult(message)
        break
        
      case 'chat_message':
        if (this.onChatMessage) this.onChatMessage(message)
        break
        
      case 'action_message':
        if (this.onActionMessage) this.onActionMessage(message)
        break
        
      case 'ai_profiles':
        if (this.onAIProfiles) this.onAIProfiles(message)
        break
        
      case 'ai_detail':
        if (this.onAIDetail) this.onAIDetail(message)
        break
        
      case 'clear_ai_data_result':
        if (this.onClearAIData) this.onClearAIData(message)
        break
        
      case 'batch_test_progress':
        if (this.onBatchTestProgress) this.onBatchTestProgress(message)
        break
        
      case 'batch_test_result':
        if (this.onBatchTestResult) this.onBatchTestResult(message)
        break
    }
  }

  send(message) {
    // Safari 兼容：使用数字 1 代替 WebSocket.OPEN
    if (this.ws && this.ws.readyState === 1) {
      try {
        this.ws.send(JSON.stringify(message))
      } catch (e) {
        console.error('发送消息失败:', e)
      }
    } else {
      console.warn('WebSocket 未就绪，消息未发送:', message.type)
    }
  }

  // 创建房间
  async createRoom(playerName) {
    if (!this.isConnected) await this.connect()
    localStorage.setItem('playerName', playerName)
    this.send({ type: 'create_room', playerName })
  }

  // 加入房间
  async joinRoom(roomCode, playerName) {
    if (!this.isConnected) await this.connect()
    localStorage.setItem('playerName', playerName)
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('加入超时')), 5000)
      
      const originalHandler = this.onRoomJoined
      this.onRoomJoined = (msg) => {
        clearTimeout(timeout)
        this.onRoomJoined = originalHandler
        if (originalHandler) originalHandler(msg)
        resolve(msg)
      }
      
      this.send({ type: 'join_room', roomCode, playerName })
    })
  }

  // 获取房间列表
  async getRoomsList() {
    if (!this.isConnected) await this.connect()
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('获取超时')), 5000)
      
      const originalHandler = this.onRoomsList
      this.onRoomsList = (rooms) => {
        clearTimeout(timeout)
        this.onRoomsList = originalHandler
        resolve(rooms)
      }
      
      this.send({ type: 'get_rooms' })
    })
  }

  // 添加AI
  addAI() {
    this.send({ type: 'add_ai' })
  }

  // 移除AI
  removeAI(seatIndex) {
    this.send({ type: 'remove_ai', seatIndex })
  }

  // 开始游戏
  startGame() {
    this.send({ type: 'start_game' })
  }

  // 发送玩家操作
  sendAction(action, amount = 0) {
    this.send({ type: 'player_action', action, amount })
  }

  // 离开房间
  leaveRoom() {
    this.send({ type: 'leave_room' })
    this.clearSession()
    this.roomCode = null
    this.isHost = false
    this.seatIndex = -1
  }

  // 同步用户数据到服务器
  syncUser(user) {
    this.send({ type: 'sync_user', user })
  }

  // 获取排行榜
  getLeaderboard(leaderboardType = 'chips', limit = 999) {
    return new Promise((resolve) => {
      this.onLeaderboard = (msg) => {
        this.onLeaderboard = null
        resolve(msg.leaderboard)
      }
      this.send({ type: 'get_leaderboard', leaderboardType, limit })
      
      // 超时返回空数组
      setTimeout(() => {
        if (this.onLeaderboard) {
          this.onLeaderboard = null
          resolve([])
        }
      }, 3000)
    })
  }

  // 确保连接就绪
  async ensureConnected() {
    // 如果已连接且有 clientId，直接返回
    if (this.isConnected && this.clientId && this.ws && this.ws.readyState === 1) {
      return true
    }
    
    try {
      await this.connect()
      
      // 等待 clientId 设置完成
      let retries = 0
      while (!this.clientId && retries < 20) {
        await new Promise(r => setTimeout(r, 100))
        retries++
      }
      
      return !!this.clientId
    } catch (e) {
      console.error('连接失败:', e.message)
      return false
    }
  }

  // 注册
  async register(username, password) {
    try {
      const connected = await this.ensureConnected()
      if (!connected) {
        return { success: false, message: '无法连接服务器' }
      }
    } catch (e) {
      return { success: false, message: '连接失败: ' + e.message }
    }
    
    return new Promise((resolve) => {
      this.onRegisterResult = (msg) => {
        this.onRegisterResult = null
        resolve(msg)
      }
      this.send({ type: 'register', username, password })
      
      setTimeout(() => {
        if (this.onRegisterResult) {
          this.onRegisterResult = null
          resolve({ success: false, message: '请求超时' })
        }
      }, 5000)
    })
  }

  // 登录
  async login(username, password) {
    try {
      const connected = await this.ensureConnected()
      if (!connected) {
        return { success: false, message: '无法连接服务器' }
      }
    } catch (e) {
      return { success: false, message: '连接失败: ' + e.message }
    }
    
    return new Promise((resolve) => {
      this.onLoginResult = (msg) => {
        this.onLoginResult = null
        resolve(msg)
      }
      this.send({ type: 'login', username, password })
      
      setTimeout(() => {
        if (this.onLoginResult) {
          this.onLoginResult = null
          resolve({ success: false, message: '请求超时' })
        }
      }, 5000)
    })
  }

  // 签到
  signIn(username) {
    return new Promise((resolve) => {
      this.onSignInResult = (msg) => {
        this.onSignInResult = null
        resolve(msg)
      }
      this.send({ type: 'sign_in', username })
      
      setTimeout(() => {
        if (this.onSignInResult) {
          this.onSignInResult = null
          resolve({ success: false, message: '请求超时' })
        }
      }, 5000)
    })
  }

  // 获取用户数据
  getUser(username) {
    return new Promise((resolve) => {
      this.onGetUserResult = (msg) => {
        this.onGetUserResult = null
        resolve(msg)
      }
      this.send({ type: 'get_user', username })
      
      setTimeout(() => {
        if (this.onGetUserResult) {
          this.onGetUserResult = null
          resolve({ success: false, message: '请求超时' })
        }
      }, 5000)
    })
  }

  // 更新用户资料
  updateProfile(username, updates) {
    return new Promise((resolve) => {
      this.onUpdateProfileResult = (msg) => {
        this.onUpdateProfileResult = null
        resolve(msg)
      }
      this.send({ type: 'update_profile', username, ...updates })
      
      setTimeout(() => {
        if (this.onUpdateProfileResult) {
          this.onUpdateProfileResult = null
          resolve({ success: false, message: '请求超时' })
        }
      }, 5000)
    })
  }

  // 断开连接
  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.isConnected = false
    this.clientId = null
  }

  getRoomInfo() {
    return {
      roomCode: this.roomCode,
      isHost: this.isHost,
      seatIndex: this.seatIndex
    }
  }

  // 获取 AI 玩家档案
  getAIProfiles() {
    return new Promise((resolve) => {
      this.onAIProfiles = (msg) => {
        this.onAIProfiles = null
        resolve({
          profiles: msg.profiles || [],
          aiStats: msg.aiStats || [],
          handJudgments: msg.handJudgments || [],
          handCalibrations: msg.handCalibrations || [],
          playerStrategies: msg.playerStrategies || []
        })
      }
      this.send({ type: 'get_ai_profiles' })
      
      setTimeout(() => {
        if (this.onAIProfiles) {
          this.onAIProfiles = null
          resolve({ profiles: [], aiStats: [], handJudgments: [], handCalibrations: [], playerStrategies: [] })
        }
      }, 3000)
    })
  }

  // 获取单个 AI 详情
  getAIDetail(aiName) {
    return new Promise((resolve) => {
      this.onAIDetail = (msg) => {
        this.onAIDetail = null
        resolve({ detail: msg.detail, strategies: msg.strategies || [] })
      }
      this.send({ type: 'get_ai_detail', aiName })
      
      setTimeout(() => {
        if (this.onAIDetail) {
          this.onAIDetail = null
          resolve({ detail: null, strategies: [] })
        }
      }, 3000)
    })
  }

  // 清除所有 AI 数据
  clearAIData() {
    return new Promise((resolve) => {
      this.onClearAIData = (msg) => {
        this.onClearAIData = null
        resolve(msg.success)
      }
      this.send({ type: 'clear_ai_data' })
      
      setTimeout(() => {
        if (this.onClearAIData) {
          this.onClearAIData = null
          resolve(false)
        }
      }, 5000)
    })
  }
}
