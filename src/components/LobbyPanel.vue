<template>
  <div class="lobby-container">
    <!-- 氛围背景层 -->
    <div class="lobby-atmosphere">
      <div class="atmosphere-glow"></div>
      <div class="table-spotlight"></div>
    </div>
    
    <div class="lobby-panel">
      <!-- 顶部用户栏 - 点击进入资料 -->
      <div class="lobby-user-bar">
        <div class="user-info-display" @click="openProfilePanel">
          <div class="user-avatar-ring">
            <img v-if="userAvatarUrl" :src="userAvatarUrl" class="user-avatar-img" />
            <span v-else class="user-avatar-small">{{ userAvatar }}</span>
          </div>
          <div class="user-text">
            <span class="user-name-small">{{ displayName }}</span>
            <span class="user-chips-small">
              <span class="chip-icon">💰</span>
              ¥{{ formatChips(userManager?.getCurrentUser()?.chips || 1000) }}
            </span>
          </div>
          <span class="profile-arrow">›</span>
        </div>
        <button @click="handleLogout" class="logout-btn-small">退出</button>
      </div>

      <!-- 资料面板 -->
      <div v-if="showProfilePanel" class="profile-overlay" @click.self="showProfilePanel = false">
        <div class="profile-panel">
          <div class="profile-header">
            <span>个人资料</span>
            <button class="profile-close" @click="showProfilePanel = false">✕</button>
          </div>
          
          <!-- 头像上传 -->
          <div class="profile-avatar-section">
            <div class="profile-avatar-preview" @click="triggerAvatarUpload">
              <img v-if="previewAvatarUrl || userAvatarUrl" :src="previewAvatarUrl || userAvatarUrl" class="avatar-preview-img" />
              <span v-else class="avatar-preview-emoji">{{ selectedAvatar }}</span>
              <div class="avatar-upload-hint">点击上传</div>
            </div>
            <input type="file" ref="avatarInput" @change="handleAvatarUpload" accept="image/*" style="display:none" />
          </div>
          
          <!-- 或选择表情头像 -->
          <div class="emoji-avatar-section">
            <div class="emoji-label">或选择表情</div>
            <div class="avatar-picker">
              <span v-for="emoji in avatarOptions" :key="emoji" 
                    class="avatar-option" 
                    :class="{ selected: selectedAvatar === emoji && !previewAvatarUrl }"
                    @click="selectEmojiAvatar(emoji)">{{ emoji }}</span>
            </div>
          </div>
          
          <!-- 昵称 -->
          <div class="profile-field">
            <label>昵称</label>
            <input v-model="newNickname" class="profile-input" placeholder="输入昵称" maxlength="8" />
          </div>
          
          <!-- 战绩 -->
          <div class="profile-stats">
            <div class="stat-row">
              <span class="stat-label">总局数</span>
              <span class="stat-value">{{ stats.totalGames }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">胜局</span>
              <span class="stat-value win">{{ stats.wins }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">胜率</span>
              <span class="stat-value">{{ winRate }}%</span>
            </div>
          </div>
          
          <!-- 操作按钮 -->
          <div class="profile-actions">
            <button class="btn btn-secondary" @click="showProfilePanel = false">取消</button>
            <button class="btn btn-primary" @click="saveProfile">保存</button>
          </div>
        </div>
      </div>

      <!-- 主标题区 - 高端感 -->
      <div class="lobby-brand">
        <div class="brand-decoration left">♠</div>
        <div class="brand-center">
          <h2 class="lobby-title">炸金花</h2>
          <p class="lobby-subtitle-text">GOLDEN FLOWER</p>
        </div>
        <div class="brand-decoration right">♥</div>
      </div>
      
      <p class="lobby-welcome">欢迎回来, <strong>{{ userManager?.getCurrentUser()?.username }}</strong></p>

      <!-- 在线人数提示 -->
      <div v-if="!inRoom && !showRoomList && !showLeaderboard" class="online-hint">
        <span class="online-dot"></span>
        <span>当前在线</span>
      </div>

      <!-- 签到和排行榜按钮 - 更有质感 -->
      <div v-if="!inRoom && !showRoomList && !showLeaderboard" class="quick-actions">
        <button @click="handleSignIn" class="quick-btn sign-in-btn" :class="{ signed: !canSignIn }">
          <span class="quick-icon">📅</span>
          <span>{{ canSignIn ? '每日签到' : '已签到' }}</span>
          <span v-if="signInStreak > 0" class="streak-badge">{{ signInStreak }}天</span>
        </button>
        <button @click="showLeaderboard = true" class="quick-btn rank-btn">
          <span class="quick-icon">🏆</span>
          <span>财富榜</span>
        </button>
      </div>

      <!-- 签到奖励弹窗 -->
      <div v-if="showSignInReward" class="sign-in-modal">
        <div class="sign-in-content">
          <div class="sign-in-icon">🎁</div>
          <div class="sign-in-title">签到成功！</div>
          <div class="sign-in-reward">+{{ signInReward }} 筹码</div>
          <div class="sign-in-streak">连续签到 {{ signInStreak }} 天</div>
          <button @click="showSignInReward = false" class="btn btn-primary">好的</button>
        </div>
      </div>

      <!-- 排行榜 -->
      <div v-if="showLeaderboard && !inRoom" class="leaderboard-panel">
        <div class="leaderboard-header">
          <h3>🏆 排行榜</h3>
          <div class="leaderboard-tabs">
            <button @click="leaderboardType = 'chips'" 
                    :class="{ active: leaderboardType === 'chips' }">筹码榜</button>
            <button @click="leaderboardType = 'wins'" 
                    :class="{ active: leaderboardType === 'wins' }">胜场榜</button>
            <button @click="leaderboardType = 'winRate'" 
                    :class="{ active: leaderboardType === 'winRate' }">胜率榜</button>
          </div>
        </div>
        <div class="leaderboard-list">
          <div v-for="player in leaderboard" :key="player.username" 
               class="leaderboard-item"
               :class="{ 'is-me': player.username === currentUsername, 'top-3': player.rank <= 3 }">
            <div class="rank-num" :class="'rank-' + player.rank">
              {{ player.rank <= 3 ? ['🥇', '🥈', '🥉'][player.rank - 1] : player.rank }}
            </div>
            <div class="player-name">{{ player.username }}</div>
            <div class="player-stat">
              <template v-if="leaderboardType === 'chips'">¥{{ player.chips }}</template>
              <template v-else-if="leaderboardType === 'wins'">{{ player.wins }}胜</template>
              <template v-else>{{ player.winRate }}%</template>
            </div>
          </div>
          <div v-if="leaderboard.length === 0" class="no-data">暂无数据</div>
        </div>
        <div v-if="myRank" class="my-rank">
          我的排名: 第 {{ myRank }} 名
        </div>
        <button @click="showLeaderboard = false" class="btn btn-danger">← 返回</button>
      </div>

      <!-- 主菜单 - 高端卡片风格 -->
      <div v-if="!inRoom && !showRoomList && !showLeaderboard" class="mode-selection">
        <button @click="createRoom" class="mode-btn create-btn" :disabled="isCreating">
          <div class="mode-card-inner">
            <div class="mode-icon-wrap">
              <span class="mode-icon">{{ isCreating ? '⏳' : '🎴' }}</span>
            </div>
            <div class="mode-text">
              <div class="mode-title">{{ isCreating ? '创建中...' : '开设牌局' }}</div>
              <div class="mode-desc">邀请好友 · 私人房间</div>
            </div>
          </div>
          <div class="mode-card-shine"></div>
        </button>
        <button @click="showRoomList = true; loadRooms()" class="mode-btn join-btn">
          <div class="mode-card-inner">
            <div class="mode-icon-wrap">
              <span class="mode-icon">🚪</span>
            </div>
            <div class="mode-text">
              <div class="mode-title">加入牌局</div>
              <div class="mode-desc">浏览房间 · 快速加入</div>
            </div>
          </div>
          <div class="mode-card-shine"></div>
        </button>
      </div>

      <!-- 房间列表 - 更有质感 -->
      <div v-if="showRoomList && !inRoom" class="join-room-form">
        <div class="room-list-header">
          <span class="room-list-icon">🎰</span>
          <span class="room-list-title">正在进行的牌局</span>
        </div>
        <div v-if="loading" class="loading-rooms">
          <span class="loading-spinner-small"></span>
          <span>搜索中...</span>
        </div>
        <div v-else-if="rooms.length > 0" class="rooms-list">
          <div v-for="room in rooms" :key="room.roomCode" 
               class="room-item" 
               :class="{ full: room.playerCount >= room.maxPlayers }"
               @click="joinRoom(room)">
            <div class="room-item-left">
              <span class="room-code-badge">{{ room.roomCode }}</span>
              <span class="room-host">私人牌局</span>
            </div>
            <div class="room-item-right">
              <span class="room-players" :class="{ full: room.playerCount >= room.maxPlayers }">
                <span class="player-icons">
                  <span v-for="i in room.playerCount" :key="i" class="player-dot active"></span>
                  <span v-for="i in (room.maxPlayers - room.playerCount)" :key="'e'+i" class="player-dot"></span>
                </span>
                {{ room.playerCount }}/{{ room.maxPlayers }}
              </span>
              <span v-if="room.playerCount >= room.maxPlayers" class="room-full-tag">已满</span>
              <span v-else class="room-join-hint">点击加入</span>
            </div>
          </div>
        </div>
        <div v-else class="no-rooms">
          <div class="no-rooms-icon">🃏</div>
          <div class="no-rooms-text">暂无进行中的牌局</div>
          <div class="no-rooms-hint">开设一局，邀请好友来战</div>
        </div>
        <div class="room-list-actions">
          <button @click="loadRooms" class="btn btn-info" :disabled="loading">
            🔄 {{ loading ? '刷新中' : '刷新列表' }}
          </button>
          <button @click="showRoomList = false" class="btn btn-danger">← 返回</button>
        </div>
      </div>

      <!-- 房间内 -->
      <div v-if="inRoom" class="lobby-content">
        <!-- 顶部信息区 -->
        <div class="room-top-section">
          <div class="lobby-header">
            <span class="lobby-mode-badge">🌐 联机对战</span>
            <span class="lobby-player-count">👥 {{ lobbyPlayers.length }}/8 人</span>
          </div>
          
          <div v-if="roomCode" class="lobby-room-code">
            <div class="room-code-label">房间码</div>
            <div class="room-code-row">
              <div class="room-code">{{ roomCode }}</div>
              <button @click="copyRoomCode" class="copy-room-btn">
                {{ copied ? '✓' : '📋' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 玩家列表 -->
        <div class="lobby-players">
          <div v-for="(p, idx) in lobbyPlayers" :key="p.seatIndex" 
               class="lobby-player-card"
               :class="{ host: idx === 0 }">
            <div class="lobby-player-avatar">
              {{ getPlayerEmoji(p, idx) }}
            </div>
            <div class="lobby-player-info">
              <div class="lobby-player-name">
                {{ p.name }}
                <span v-if="idx === 0" class="host-badge">房主</span>
              </div>
              <div class="lobby-player-chips">💰 ¥{{ p.chips }}</div>
            </div>
            <button v-if="p.type === 'ai' && networkManager?.isHost" 
                    @click="removeAI(p.seatIndex)" 
                    class="lobby-remove-btn"
                    title="移除AI">✕</button>
          </div>
        </div>

        <!-- 底部操作区 -->
        <div class="lobby-actions">
          <button v-if="networkManager?.isHost && lobbyPlayers.length < 8" 
                  @click="addAI" 
                  class="btn btn-warning lobby-btn">
            🤖 添加AI
          </button>
          <button v-if="networkManager?.isHost" 
                  @click="$emit('start-game')" 
                  class="btn btn-primary lobby-btn start-btn"
                  :disabled="lobbyPlayers.length < 2">
            🎲 开始游戏
          </button>
          <button v-if="!networkManager?.isHost" class="btn lobby-btn waiting-btn" disabled>
            ⏳ 等待房主开始...
          </button>
          <button @click="leave" class="btn btn-danger lobby-btn">🚪 离开</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'LobbyPanel',
  props: ['networkManager', 'userManager', 'lobbyPlayers', 'roomCode'],
  emits: ['start-game', 'leave-lobby', 'players-updated', 'room-created', 'logout'],
  data() {
    return { 
      showRoomList: false, 
      showLeaderboard: false,
      leaderboardType: 'chips',
      leaderboardData: [],
      rooms: [], 
      loading: false,
      isCreating: false,
      copied: false,
      showSignInReward: false,
      signInReward: 0,
      showProfilePanel: false,
      selectedAvatar: '😎',
      newNickname: '',
      previewAvatarUrl: null,
      avatarFile: null,
      avatarOptions: ['😎', '😊', '😄', '🙂', '😏', '🤔', '😌', '🧐', '😁', '🤨', '😤', '🙄', '😶', '🤩', '😇', '🥳']
    }
  },
  computed: {
    inRoom() { return this.roomCode && this.lobbyPlayers.length > 0 },
    canSignIn() { return this.userManager?.canSignIn() },
    signInStreak() { return this.userManager?.getSignInInfo()?.streak || 0 },
    currentUsername() { return this.userManager?.getCurrentUser()?.username },
    leaderboard() { return this.leaderboardData },
    myRank() { 
      const idx = this.leaderboardData.findIndex(u => u.username === this.currentUsername)
      return idx >= 0 ? idx + 1 : null
    },
    userAvatar() {
      const user = this.userManager?.getCurrentUser()
      return user?.avatar || '😎'
    },
    userAvatarUrl() {
      const user = this.userManager?.getCurrentUser()
      return user?.avatarUrl || null
    },
    displayName() {
      const user = this.userManager?.getCurrentUser()
      return user?.nickname || user?.username || '玩家'
    },
    stats() {
      const user = this.userManager?.getCurrentUser()
      return {
        totalGames: user?.totalGames || 0,
        wins: user?.wins || 0
      }
    },
    winRate() {
      if (this.stats.totalGames === 0) return 0
      return Math.round((this.stats.wins / this.stats.totalGames) * 100)
    }
  },
  methods: {
    getPlayerEmoji(player, idx) {
      const user = this.userManager?.getCurrentUser()
      if (user && player.name === user.username) return user.avatar || '😎'
      const emojis = ['😊', '😄', '🙂', '😏', '🤔', '😌', '🧐', '😁', '🤨', '😤', '🙄', '😶']
      return emojis[idx % emojis.length]
    },
    formatChips(num) {
      if (num >= 10000) return (num / 10000).toFixed(1) + 'w'
      if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
      return num
    },
    handleLogout() {
      if (confirm('确定要退出登录吗？')) {
        this.$emit('logout')
      }
    },
    triggerAvatarUpload() {
      this.$refs.avatarInput.click()
    },
    handleAvatarUpload(e) {
      const file = e.target.files[0]
      if (!file) return
      if (file.size > 2 * 1024 * 1024) {
        alert('图片大小不能超过2MB')
        return
      }
      this.avatarFile = file
      this.previewAvatarUrl = URL.createObjectURL(file)
    },
    selectEmojiAvatar(emoji) {
      this.selectedAvatar = emoji
      this.previewAvatarUrl = null
      this.avatarFile = null
    },
    async saveProfile() {
      let avatarUrl = this.userAvatarUrl
      
      // 如果有上传的头像文件，先上传
      if (this.avatarFile) {
        try {
          const formData = new FormData()
          formData.append('avatar', this.avatarFile)
          formData.append('username', this.currentUsername)
          
          // 生产环境使用 3001 端口，开发环境通过 vite 代理
          const apiBase = window.location.port === '3000' ? '' : ':3001'
          const apiUrl = `${window.location.protocol}//${window.location.hostname}${apiBase}/api/upload-avatar`
          
          const response = await fetch(apiUrl, {
            method: 'POST',
            body: formData
          })
          const result = await response.json()
          if (result.success) {
            avatarUrl = result.avatarUrl
          } else {
            alert('头像上传失败: ' + result.message)
            return
          }
        } catch (e) {
          console.error('上传头像失败:', e)
          alert('头像上传失败，请重试')
          return
        }
      }
      
      const updates = {
        avatar: this.previewAvatarUrl ? null : this.selectedAvatar,
        avatarUrl: avatarUrl,
        nickname: this.newNickname.trim() || undefined
      }
      
      const result = await this.userManager.updateProfile(updates)
      if (result.success) {
        this.showProfilePanel = false
        this.previewAvatarUrl = null
        this.avatarFile = null
        this.$emit('profile-updated')
      }
    },
    openProfilePanel() {
      const user = this.userManager?.getCurrentUser()
      this.selectedAvatar = user?.avatar || '😎'
      this.newNickname = user?.nickname || user?.username || ''
      this.previewAvatarUrl = null
      this.avatarFile = null
      this.showProfilePanel = true
    },
    async handleSignIn() {
      if (!this.canSignIn) return
      try {
        const result = await this.userManager.signIn()
        if (result.success) {
          this.signInReward = result.reward
          this.showSignInReward = true
        } else {
          alert(result.message)
        }
      } catch (e) {
        alert('签到失败，请重试')
      }
    },
    syncUserToServer() {
      // 不再需要手动同步，服务器已处理
    },
    async loadLeaderboard() {
      if (!this.networkManager) return
      try {
        await this.networkManager.connect()
        this.leaderboardData = await this.networkManager.getLeaderboard(this.leaderboardType)
      } catch (e) {
        console.error('获取排行榜失败:', e)
        // 降级使用本地数据
        this.leaderboardData = this.userManager?.getLeaderboard(this.leaderboardType, 999) || []
      }
    },
    async createRoom() {
      this.isCreating = true
      const user = this.userManager.getCurrentUser()
      await this.networkManager.createRoom(user.username)
      this.isCreating = false
    },
    async loadRooms() {
      this.loading = true
      try { this.rooms = await this.networkManager.getRoomsList() || [] }
      catch (e) { this.rooms = [] }
      this.loading = false
    },
    async joinRoom(room) {
      if (room.playerCount >= room.maxPlayers) { 
        alert('房间已满，请选择其他房间'); 
        return 
      }
      const user = this.userManager.getCurrentUser()
      await this.networkManager.joinRoom(room.roomCode, user.username)
      this.showRoomList = false
    },
    addAI() { this.networkManager.addAI() },
    removeAI(seatIndex) { this.networkManager.removeAI(seatIndex) },
    leave() {
      this.showRoomList = false
      this.$emit('leave-lobby')
    },
    async copyRoomCode() {
      try {
        await navigator.clipboard.writeText(this.roomCode)
        this.copied = true
        setTimeout(() => this.copied = false, 2000)
      } catch (e) {
        const input = document.createElement('input')
        input.value = this.roomCode
        document.body.appendChild(input)
        input.select()
        document.execCommand('copy')
        document.body.removeChild(input)
        this.copied = true
        setTimeout(() => this.copied = false, 2000)
      }
    }
  },
  mounted() { 
    this.loadRooms()
    // 同步当前用户数据到服务器
    this.syncUserToServer()
  },
  watch: {
    showLeaderboard(val) {
      if (val) this.loadLeaderboard()
    },
    leaderboardType() {
      if (this.showLeaderboard) this.loadLeaderboard()
    }
  }
}
</script>

<style scoped>
/* ===== 氛围背景层 ===== */
.lobby-atmosphere {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: -1;
  overflow: hidden;
}

.atmosphere-glow {
  position: absolute;
  top: 30%;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  height: 400px;
  background: radial-gradient(ellipse at center, 
    rgba(139, 69, 19, 0.15) 0%, 
    rgba(139, 69, 19, 0.05) 40%,
    transparent 70%);
  filter: blur(60px);
}

.table-spotlight {
  position: absolute;
  top: 20%;
  left: 50%;
  transform: translateX(-50%);
  width: 300px;
  height: 300px;
  background: radial-gradient(ellipse at center, 
    rgba(255, 215, 0, 0.08) 0%, 
    transparent 60%);
  filter: blur(40px);
}

/* ===== 顶部用户栏 - 精致版 ===== */
.lobby-user-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  margin-top: env(safe-area-inset-top);
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 100%);
  border-radius: 14px;
  margin-bottom: 20px;
  border: 1px solid rgba(255, 215, 0, 0.1);
}

.user-info-display {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar-ring {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ffd700 0%, #b8860b 100%);
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-avatar-small {
  width: 100%;
  height: 100%;
  background: linear-gradient(145deg, #1e293b, #0f172a);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.user-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-name-small {
  font-size: 14px;
  color: white;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.user-chips-small {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #4ade80;
  font-weight: 700;
  font-family: 'Courier New', monospace;
}

.chip-icon {
  font-size: 11px;
}

.logout-btn-small {
  padding: 8px 16px;
  background: transparent;
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 8px;
  color: rgba(239, 68, 68, 0.8);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.logout-btn-small:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.6);
  color: #ef4444;
}

/* ===== 品牌标题区 ===== */
.lobby-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-bottom: 8px;
}

.brand-decoration {
  font-size: 24px;
  color: rgba(255, 215, 0, 0.3);
  font-weight: bold;
}

.brand-decoration.left { color: #1e293b; text-shadow: 0 0 10px rgba(255, 215, 0, 0.3); }
.brand-decoration.right { color: #dc2626; text-shadow: 0 0 10px rgba(220, 38, 38, 0.3); }

.brand-center {
  text-align: center;
}

.lobby-title {
  font-size: 28px;
  color: #ffd700;
  margin: 0;
  font-weight: 800;
  letter-spacing: 4px;
  text-shadow: 
    0 0 20px rgba(255, 215, 0, 0.4),
    0 2px 4px rgba(0, 0, 0, 0.8);
}

.lobby-subtitle-text {
  font-size: 10px;
  color: rgba(255, 215, 0, 0.5);
  letter-spacing: 6px;
  margin-top: 4px;
  font-weight: 500;
}

.lobby-welcome {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0 0 16px 0;
  text-align: center;
}

.lobby-welcome strong {
  color: rgba(255, 215, 0, 0.8);
  font-weight: 600;
}

/* ===== 在线提示 ===== */
.online-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 16px;
}

.online-dot {
  width: 6px;
  height: 6px;
  background: #22c55e;
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.6);
  animation: pulse-dot 2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.8); }
}

/* ===== 快捷操作按钮 ===== */
.quick-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.quick-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.25s ease;
}

.quick-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.15);
  color: white;
}

.sign-in-btn:hover {
  border-color: rgba(34, 197, 94, 0.4);
}

.sign-in-btn.signed {
  opacity: 0.5;
  cursor: default;
}

.rank-btn:hover {
  border-color: rgba(255, 215, 0, 0.4);
}

.quick-icon {
  font-size: 16px;
}

.streak-badge {
  font-size: 10px;
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}

/* ===== 主菜单卡片 ===== */
.mode-selection {
  display: flex;
  gap: 16px;
  margin: 0 0 20px 0;
}

.mode-btn {
  flex: 1;
  position: relative;
  padding: 0;
  background: linear-gradient(165deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.mode-btn:hover:not(:disabled) {
  transform: translateY(-4px);
  border-color: rgba(255, 215, 0, 0.3);
  box-shadow: 
    0 12px 40px rgba(0, 0, 0, 0.4),
    0 0 30px rgba(255, 215, 0, 0.1);
}

.mode-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}

.mode-card-inner {
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  position: relative;
  z-index: 1;
}

.mode-card-shine {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.05), transparent);
  transition: left 0.5s ease;
}

.mode-btn:hover .mode-card-shine {
  left: 100%;
}

.mode-icon-wrap {
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 215, 0, 0.05) 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 215, 0, 0.2);
}

.mode-icon {
  font-size: 28px;
}

.mode-text {
  text-align: center;
}

.mode-title {
  font-size: 15px;
  font-weight: 700;
  color: #ffd700;
  margin-bottom: 4px;
  letter-spacing: 0.5px;
}

.mode-desc {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 0.3px;
}

/* ===== 房间列表 ===== */
.join-room-form {
  margin-top: 0;
  padding: 20px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.room-list-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.room-list-icon {
  font-size: 18px;
}

.room-list-title {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 600;
  letter-spacing: 0.5px;
}

.loading-rooms {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: rgba(255, 255, 255, 0.5);
  gap: 10px;
}

.loading-spinner-small {
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 215, 0, 0.2);
  border-top-color: #ffd700;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.rooms-list {
  max-height: 260px;
  overflow-y: auto;
}

.room-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.25s ease;
}

.room-item:hover:not(.full) {
  background: rgba(255, 215, 0, 0.08);
  border-color: rgba(255, 215, 0, 0.25);
  transform: translateX(4px);
}

.room-item.full {
  opacity: 0.4;
  cursor: not-allowed;
}

.room-item-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.room-code-badge {
  font-size: 16px;
  font-weight: 700;
  color: #ffd700;
  font-family: 'Courier New', monospace;
  letter-spacing: 3px;
}

.room-host {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 0.5px;
}

.room-item-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.room-players {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.player-icons {
  display: flex;
  gap: 3px;
}

.player-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
}

.player-dot.active {
  background: #4ade80;
  box-shadow: 0 0 6px rgba(74, 222, 128, 0.5);
}

.room-players.full {
  color: #ef4444;
}

.room-full-tag {
  font-size: 10px;
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  padding: 2px 8px;
  border-radius: 6px;
}

.room-join-hint {
  font-size: 10px;
  color: rgba(255, 215, 0, 0.5);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.room-item:hover:not(.full) .room-join-hint {
  opacity: 1;
}

.no-rooms {
  text-align: center;
  padding: 40px 20px;
  color: rgba(255, 255, 255, 0.4);
}

.no-rooms-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.4;
}

.no-rooms-text {
  font-size: 14px;
  margin-bottom: 6px;
}

.no-rooms-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
}

.room-list-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.room-list-actions .btn {
  flex: 1;
}

/* ===== 签到弹窗 ===== */
.sign-in-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(8px);
}

.sign-in-content {
  background: linear-gradient(165deg, #1e293b 0%, #0f172a 100%);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 24px;
  padding: 36px 48px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.sign-in-icon {
  font-size: 56px;
  margin-bottom: 16px;
}

.sign-in-title {
  font-size: 22px;
  color: #ffd700;
  font-weight: 700;
  margin-bottom: 12px;
  letter-spacing: 1px;
}

.sign-in-reward {
  font-size: 32px;
  color: #4ade80;
  font-weight: 800;
  margin-bottom: 8px;
  font-family: 'Courier New', monospace;
}

.sign-in-streak {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 24px;
}

/* ===== 排行榜 ===== */
.leaderboard-panel {
  text-align: left;
}

.leaderboard-header {
  margin-bottom: 16px;
}

.leaderboard-header h3 {
  color: #ffd700;
  margin: 0 0 14px 0;
  text-align: center;
  font-size: 18px;
  letter-spacing: 1px;
}

.leaderboard-tabs {
  display: flex;
  gap: 8px;
  background: rgba(0, 0, 0, 0.2);
  padding: 4px;
  border-radius: 10px;
}

.leaderboard-tabs button {
  flex: 1;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
}

.leaderboard-tabs button.active {
  background: rgba(255, 215, 0, 0.15);
  color: #ffd700;
}

.leaderboard-tabs button:hover:not(.active) {
  color: rgba(255, 255, 255, 0.8);
}

.leaderboard-list {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 16px;
}

.leaderboard-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 10px;
  margin-bottom: 8px;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.leaderboard-item:hover {
  background: rgba(0, 0, 0, 0.35);
}

.leaderboard-item.is-me {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.25);
}

.leaderboard-item.top-3 {
  background: rgba(255, 215, 0, 0.08);
}

.rank-num {
  width: 30px;
  text-align: center;
  font-weight: 700;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
}

.rank-num.rank-1, .rank-num.rank-2, .rank-num.rank-3 {
  font-size: 20px;
}

.player-name {
  flex: 1;
  font-size: 13px;
  color: white;
  font-weight: 500;
}

.player-stat {
  font-size: 14px;
  color: #ffd700;
  font-weight: 700;
  font-family: 'Courier New', monospace;
}

.my-rank {
  text-align: center;
  padding: 12px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 10px;
  margin-bottom: 16px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.no-data {
  text-align: center;
  padding: 40px;
  color: rgba(255, 255, 255, 0.4);
}

/* ===== 复制房间码按钮 ===== */
.room-code-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.copy-room-btn {
  margin-top: 0;
  padding: 10px 24px;
  background: transparent;
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 10px;
  color: #ffd700;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s ease;
}

.copy-room-btn:hover {
  background: rgba(255, 215, 0, 0.1);
  border-color: rgba(255, 215, 0, 0.5);
}

/* ===== 房间内玩家卡片 ===== */
.lobby-player-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  margin-bottom: 10px;
  transition: all 0.2s ease;
}

.lobby-player-card:last-child {
  margin-bottom: 0;
}

.lobby-player-card:hover {
  background: rgba(0, 0, 0, 0.4);
}

.lobby-player-card.host {
  border-color: rgba(255, 215, 0, 0.25);
  background: rgba(255, 215, 0, 0.05);
}

.host-badge {
  font-size: 10px;
  background: linear-gradient(135deg, #ffd700, #b8860b);
  color: #1a202c;
  padding: 2px 8px;
  border-radius: 6px;
  margin-left: 8px;
  font-weight: 700;
  letter-spacing: 0.3px;
}

.lobby-player-avatar {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
}

.lobby-player-info {
  flex: 1;
  text-align: left;
}

.lobby-player-name {
  font-size: 14px;
  font-weight: 600;
  color: white;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
}

.lobby-player-chips {
  font-size: 13px;
  color: #4ade80;
  font-family: 'Courier New', monospace;
  font-weight: 600;
}

.lobby-remove-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.2);
  color: rgba(239, 68, 68, 0.8);
  border: 1px solid rgba(239, 68, 68, 0.3);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lobby-remove-btn:hover {
  background: rgba(239, 68, 68, 0.3);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.5);
}

.waiting-btn {
  background: rgba(255, 255, 255, 0.05) !important;
  color: rgba(255, 255, 255, 0.5) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
}

.mode-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

/* ===== 资料面板 ===== */
.user-info-display {
  cursor: pointer;
  transition: all 0.2s ease;
}

.user-info-display:hover {
  opacity: 0.85;
}

.profile-arrow {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.4);
  margin-left: 8px;
}

.user-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.profile-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(8px);
}

.profile-panel {
  width: 90%;
  max-width: 360px;
  background: linear-gradient(165deg, #1e293b 0%, #0f172a 100%);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 20px;
  padding: 24px;
  max-height: 85vh;
  overflow-y: auto;
}

.profile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  font-size: 18px;
  color: #ffd700;
  font-weight: 700;
}

.profile-close {
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.6);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.profile-close:hover {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.profile-avatar-section {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}

.profile-avatar-preview {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 215, 0, 0.05) 100%);
  border: 3px solid rgba(255, 215, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all 0.2s ease;
}

.profile-avatar-preview:hover {
  border-color: rgba(255, 215, 0, 0.7);
}

.profile-avatar-preview:hover .avatar-upload-hint {
  opacity: 1;
}

.avatar-preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-preview-emoji {
  font-size: 48px;
}

.avatar-upload-hint {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  font-size: 11px;
  padding: 6px;
  text-align: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.emoji-avatar-section {
  margin-bottom: 20px;
}

.emoji-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
  margin-bottom: 10px;
}

.avatar-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.avatar-option {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  cursor: pointer;
  border-radius: 10px;
  border: 2px solid transparent;
  transition: all 0.2s ease;
  background: rgba(0, 0, 0, 0.2);
}

.avatar-option:hover {
  background: rgba(255, 255, 255, 0.1);
}

.avatar-option.selected {
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.2);
}

.profile-field {
  margin-bottom: 20px;
}

.profile-field label {
  display: block;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 8px;
}

.profile-input {
  width: 100%;
  padding: 12px 16px;
  font-size: 14px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.3);
  color: white;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s ease;
}

.profile-input:focus {
  border-color: rgba(255, 215, 0, 0.5);
}

.profile-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.profile-stats {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.stat-row:last-child {
  border-bottom: none;
}

.stat-row .stat-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.stat-row .stat-value {
  font-size: 14px;
  color: white;
  font-weight: 600;
}

.stat-row .stat-value.win {
  color: #4ade80;
}

.profile-actions {
  display: flex;
  gap: 12px;
}

.profile-actions .btn {
  flex: 1;
  padding: 14px;
  font-size: 14px;
  font-weight: 600;
}

.btn-secondary {
  background: rgba(107, 114, 128, 0.3);
  border: 1px solid rgba(107, 114, 128, 0.4);
  color: rgba(255, 255, 255, 0.8);
}

.btn-secondary:hover {
  background: rgba(107, 114, 128, 0.4);
}
</style>
