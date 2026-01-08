<template>
  <div class="login-modal">
    <div class="login-box">
      <h2 class="login-title">🎰 诈金花 🎰</h2>
      <p class="login-subtitle">{{ isRegister ? '创建新账户' : '欢迎回来' }}</p>
      
      <div v-if="message" class="login-message" :class="{ success: isSuccess }">
        {{ message }}
      </div>
      
      <div class="input-group">
        <label class="input-label">用户名</label>
        <input v-model="username" type="text" class="login-input" 
          placeholder="2-10个字符" maxlength="10" @keyup.enter="submit" 
          autocomplete="username" />
      </div>
      
      <div class="input-group">
        <label class="input-label">密码</label>
        <input v-model="password" type="password" class="login-input" 
          placeholder="至少4个字符" @keyup.enter="submit"
          autocomplete="current-password" />
      </div>
      
      <button @click="submit" class="btn btn-primary login-btn" :disabled="isLoading">
        <span v-if="isLoading">⏳ 处理中...</span>
        <span v-else>{{ isRegister ? '🚀 注册并开始' : '🎮 登录' }}</span>
      </button>
      
      <div class="login-toggle">
        <span>{{ isRegister ? '已有账户？' : '没有账户？' }}</span>
        <a @click="toggleMode" class="toggle-link">
          {{ isRegister ? '立即登录' : '立即注册' }}
        </a>
      </div>
      
      <!-- Safari 调试面板 -->
      <div v-if="showDebug" class="debug-panel">
        <div class="debug-header">
          <span>🔧 调试日志</span>
          <div>
            <button @click="copyDebugLogs" class="debug-copy">{{ copyText }}</button>
            <button @click="showDebug = false" class="debug-close">×</button>
          </div>
        </div>
        <pre id="safari-debug" class="debug-content">{{ debugLogs }}</pre>
      </div>
      <button v-else @click="showDebug = true" class="debug-toggle">🔧</button>
    </div>
  </div>
</template>

<script>
import { NetworkManager, getDebugLogs } from '../utils/NetworkManager.js'
import { UserManager } from '../utils/UserManager.js'

// 单例模式，避免重复创建连接
let sharedNetworkManager = null

export default {
  name: 'LoginModal',
  emits: ['login-success'],
  data() {
    return {
      networkManager: null,
      userManager: null,
      username: '',
      password: '',
      isRegister: false,
      message: '',
      isSuccess: false,
      isLoading: false,
      showDebug: false,
      debugLogs: '',
      copyText: '复制'
    }
  },
  mounted() {
    if (!sharedNetworkManager) {
      sharedNetworkManager = new NetworkManager()
    }
    this.networkManager = sharedNetworkManager
    this.userManager = new UserManager(this.networkManager)
    
    // 定时更新调试日志
    this._debugTimer = setInterval(() => {
      if (this.showDebug) {
        this.debugLogs = getDebugLogs().join('\n')
      }
    }, 500)
  },
  beforeUnmount() {
    if (this._debugTimer) {
      clearInterval(this._debugTimer)
    }
  },
  methods: {
    async submit() {
      this.message = ''
      this.isSuccess = false
      this.isLoading = true
      
      // 总超时 15 秒
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('连接超时，请检查网络后重试')), 15000)
      )
      
      try {
        await Promise.race([this._doSubmit(), timeoutPromise])
      } catch (e) {
        console.error('登录异常:', e)
        this.message = e.message || '网络错误，请重试'
        this.isLoading = false
      }
    },
    
    async _doSubmit() {
      // 先确保网络连接就绪
      const connected = await this.networkManager.ensureConnected()
      if (!connected) {
        this.message = '无法连接服务器，请检查网络'
        this.isLoading = false
        return
      }
      
      if (this.isRegister) {
        const res = await this.userManager.register(this.username, this.password)
        if (!res.success) { 
          this.message = res.message
          this.isLoading = false
          return 
        }
        this.message = '注册成功！'
        this.isSuccess = true
      }
      
      const loginRes = await this.userManager.login(this.username, this.password)
      
      if (loginRes.success) {
        this.message = '登录成功，正在进入...'
        this.isSuccess = true
        setTimeout(() => this.$emit('login-success', this.userManager), 500)
      } else {
        this.message = loginRes.message || '登录失败'
        this.isLoading = false
      }
    },
    toggleMode() {
      this.isRegister = !this.isRegister
      this.message = ''
      this.isSuccess = false
    },
    async copyDebugLogs() {
      try {
        await navigator.clipboard.writeText(this.debugLogs)
        this.copyText = '已复制!'
        setTimeout(() => { this.copyText = '复制' }, 1500)
      } catch (e) {
        // iOS Safari 可能不支持 clipboard API，使用备用方案
        const textarea = document.createElement('textarea')
        textarea.value = this.debugLogs
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        try {
          document.execCommand('copy')
          this.copyText = '已复制!'
        } catch (err) {
          this.copyText = '复制失败'
        }
        document.body.removeChild(textarea)
        setTimeout(() => { this.copyText = '复制' }, 1500)
      }
    }
  }
}
</script>

<style scoped>
.input-group {
  margin-bottom: 16px;
  text-align: left;
}

.input-label {
  display: block;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 6px;
  font-weight: 500;
}

.login-message.success {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.login-btn {
  margin-top: 8px;
}

.login-btn:disabled {
  opacity: 0.7;
}

/* 调试面板样式 */
.debug-toggle {
  position: absolute;
  bottom: 10px;
  right: 10px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}

.debug-panel {
  position: absolute;
  bottom: 50px;
  left: 10px;
  right: 10px;
  max-height: 200px;
  background: rgba(0, 0, 0, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  overflow: hidden;
}

.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.1);
  font-size: 12px;
  color: #fff;
}

.debug-close {
  background: none;
  border: none;
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
}

.debug-copy {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: #fff;
  font-size: 11px;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 4px;
  margin-right: 8px;
}

.debug-content {
  padding: 8px 12px;
  margin: 0;
  font-size: 10px;
  color: #0f0;
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 150px;
  overflow-y: auto;
}
</style>
