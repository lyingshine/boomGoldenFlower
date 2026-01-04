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
    </div>
  </div>
</template>

<script>
import { NetworkManager } from '../utils/NetworkManager.js'
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
      isLoading: false
    }
  },
  mounted() {
    if (!sharedNetworkManager) {
      sharedNetworkManager = new NetworkManager()
    }
    this.networkManager = sharedNetworkManager
    this.userManager = new UserManager(this.networkManager)
  },
  methods: {
    async submit() {
      this.message = ''
      this.isSuccess = false
      this.isLoading = true
      
      try {
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
        
        const res = await this.userManager.login(this.username, this.password)
        if (res.success) {
          this.message = '登录成功，正在进入...'
          this.isSuccess = true
          setTimeout(() => this.$emit('login-success', this.userManager), 500)
        } else {
          this.message = res.message
          this.isLoading = false
        }
      } catch (e) {
        this.message = '网络错误，请重试'
        this.isLoading = false
      }
    },
    toggleMode() {
      this.isRegister = !this.isRegister
      this.message = ''
      this.isSuccess = false
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
</style>
