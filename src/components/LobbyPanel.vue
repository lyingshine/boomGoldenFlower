<template>
  <div class="lobby-container">
    <div class="lobby-panel">
      <!-- 顶部用户栏 -->
      <div class="lobby-user-bar">
        <div class="user-info-display">
          <span class="user-avatar-small">😎</span>
          <span class="user-name-small">{{ userManager?.getCurrentUser()?.username }}</span>
          <span class="user-chips-small">¥{{ userManager?.getCurrentUser()?.chips || 1000 }}</span>
        </div>
        <button @click="handleLogout" class="logout-btn-small">退出</button>
      </div>

      <h2 class="lobby-title">🎮 游戏大厅</h2>
      <p class="lobby-welcome">欢迎, <strong>{{ userManager?.getCurrentUser()?.username }}</strong></p>

      <!-- 签到和排行榜按钮 -->
      <div v-if="!inRoom && !showRoomList && !showLeaderboard" class="quick-actions">
        <button @click="handleSignIn" class="quick-btn sign-in-btn" :class="{ signed: !canSignIn }">
          <span class="quick-icon">📅</span>
          <span>{{ canSignIn ? '签到' : '已签到' }}</span>
          <span v-if="signInStreak > 0" class="streak-badge">{{ signInStreak }}天</span>
        </button>
        <button @click="showLeaderboard = true" class="quick-btn rank-btn">
          <span class="quick-icon">🏆</span>
          <span>排行榜</span>
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

      <!-- 主菜单 -->
      <div v-if="!inRoom && !showRoomList && !showLeaderboard" class="mode-selection">
        <button @click="createRoom" class="mode-btn" :disabled="isCreating">
          <div class="mode-icon">{{ isCreating ? '⏳' : '➕' }}</div>
          <div class="mode-title">{{ isCreating ? '创建中...' : '创建房间' }}</div>
          <div class="mode-desc">邀请好友一起玩</div>
        </button>
        <button @click="showRoomList = true; loadRooms()" class="mode-btn">
          <div class="mode-icon">🚪</div>
          <div class="mode-title">加入房间</div>
          <div class="mode-desc">加入已有房间</div>
        </button>
      </div>

      <!-- 房间列表 -->
      <div v-if="showRoomList && !inRoom" class="join-room-form">
        <p class="lobby-subtitle">🔍 可用房间</p>
        <div v-if="loading" class="loading-rooms">
          <span class="loading-spinner-small"></span>
          <span>加载中...</span>
        </div>
        <div v-else-if="rooms.length > 0" class="rooms-list">
          <div v-for="room in rooms" :key="room.roomCode" 
               class="room-item" 
               :class="{ full: room.playerCount >= room.maxPlayers }"
               @click="joinRoom(room)">
            <div class="room-item-left">
              <span class="room-code-badge">{{ room.roomCode }}</span>
              <span class="room-host">房主房间</span>
            </div>
            <div class="room-item-right">
              <span class="room-players" :class="{ full: room.playerCount >= room.maxPlayers }">
                👥 {{ room.playerCount }}/{{ room.maxPlayers }}
              </span>
              <span v-if="room.playerCount >= room.maxPlayers" class="room-full-tag">已满</span>
            </div>
          </div>
        </div>
        <div v-else class="no-rooms">
          <div class="no-rooms-icon">🏠</div>
          <div>暂无可用房间</div>
          <div class="no-rooms-hint">创建一个新房间开始游戏吧</div>
        </div>
        <div class="room-list-actions">
          <button @click="loadRooms" class="btn btn-info" :disabled="loading">
            🔄 {{ loading ? '刷新中' : '刷新' }}
          </button>
          <button @click="showRoomList = false" class="btn btn-danger">← 返回</button>
        </div>
      </div>

      <!-- 房间内 -->
      <div v-if="inRoom" class="lobby-content">
        <div class="lobby-header">
          <span class="lobby-mode-badge">🌐 联机对战</span>
          <span class="lobby-player-count">👥 {{ lobbyPlayers.length }}/8 人</span>
        </div>
        
        <div v-if="roomCode" class="lobby-room-code">
          <div class="room-code-label">房间码 (分享给好友)</div>
          <div class="room-code">{{ roomCode }}</div>
          <button @click="copyRoomCode" class="copy-room-btn">
            {{ copied ? '✓ 已复制' : '📋 复制' }}
          </button>
        </div>

        <div class="lobby-players">
          <div v-for="(p, idx) in lobbyPlayers" :key="p.seatIndex" 
               class="lobby-player-card"
               :class="{ host: idx === 0 }">
            <div class="lobby-player-avatar" :class="p.type">
              {{ p.type === 'human' ? '🎮' : '🤖' }}
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

        <div class="lobby-actions">
          <button v-if="networkManager?.isHost && lobbyPlayers.length < 8" 
                  @click="addAI" 
                  class="btn btn-warning lobby-btn">
            🤖 添加AI
          </button>
          <button v-if="networkManager?.isHost" 
                  @click="$emit('start-game')" 
                  class="btn btn-primary lobby-btn"
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
      signInReward: 0
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
    }
  },
  methods: {
    handleLogout() {
      if (confirm('确定要退出登录吗？')) {
        this.$emit('logout')
      }
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
/* 顶部用户栏 */
.lobby-user-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
  margin-bottom: 16px;
}

.user-info-display {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-avatar-small {
  font-size: 18px;
}

.user-name-small {
  font-size: 13px;
  color: white;
  font-weight: 500;
}

.user-chips-small {
  font-size: 12px;
  color: #4ade80;
  font-weight: 600;
  font-family: 'Courier New', monospace;
}

.logout-btn-small {
  padding: 6px 12px;
  background: rgba(239, 68, 68, 0.7);
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.logout-btn-small:hover {
  background: rgba(239, 68, 68, 0.9);
}

/* 快捷操作按钮 */
.quick-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.quick-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 215, 0, 0.4);
}

.sign-in-btn {
  border-color: rgba(34, 197, 94, 0.4);
}

.sign-in-btn:hover {
  border-color: rgba(34, 197, 94, 0.7);
  background: rgba(34, 197, 94, 0.1);
}

.sign-in-btn.signed {
  opacity: 0.6;
  cursor: default;
}

.rank-btn {
  border-color: rgba(255, 215, 0, 0.4);
}

.rank-btn:hover {
  border-color: rgba(255, 215, 0, 0.7);
  background: rgba(255, 215, 0, 0.1);
}

.quick-icon {
  font-size: 16px;
}

.streak-badge {
  font-size: 10px;
  background: rgba(34, 197, 94, 0.3);
  color: #4ade80;
  padding: 2px 6px;
  border-radius: 8px;
}

/* 签到弹窗 */
.sign-in-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.sign-in-content {
  background: linear-gradient(145deg, #1e293b 0%, #0f172a 100%);
  border: 2px solid rgba(255, 215, 0, 0.5);
  border-radius: 20px;
  padding: 30px 40px;
  text-align: center;
}

.sign-in-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.sign-in-title {
  font-size: 20px;
  color: #ffd700;
  font-weight: bold;
  margin-bottom: 10px;
}

.sign-in-reward {
  font-size: 28px;
  color: #4ade80;
  font-weight: bold;
  margin-bottom: 8px;
}

.sign-in-streak {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 20px;
}

/* 排行榜 */
.leaderboard-panel {
  text-align: left;
}

.leaderboard-header {
  margin-bottom: 15px;
}

.leaderboard-header h3 {
  color: #ffd700;
  margin: 0 0 12px 0;
  text-align: center;
}

.leaderboard-tabs {
  display: flex;
  gap: 8px;
}

.leaderboard-tabs button {
  flex: 1;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.leaderboard-tabs button.active {
  background: rgba(255, 215, 0, 0.2);
  border-color: rgba(255, 215, 0, 0.5);
  color: #ffd700;
}

.leaderboard-list {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 15px;
}

.leaderboard-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  margin-bottom: 6px;
}

.leaderboard-item.is-me {
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.leaderboard-item.top-3 {
  background: rgba(255, 215, 0, 0.1);
}

.rank-num {
  width: 28px;
  text-align: center;
  font-weight: bold;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}

.rank-num.rank-1, .rank-num.rank-2, .rank-num.rank-3 {
  font-size: 18px;
}

.player-name {
  flex: 1;
  font-size: 13px;
  color: white;
}

.player-stat {
  font-size: 13px;
  color: #ffd700;
  font-weight: 600;
  font-family: 'Courier New', monospace;
}

.my-rank {
  text-align: center;
  padding: 10px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  margin-bottom: 15px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

.no-data {
  text-align: center;
  padding: 30px;
  color: rgba(255, 255, 255, 0.5);
}

.loading-spinner-small {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 215, 0, 0.3);
  border-top-color: #ffd700;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 8px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-rooms {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px;
  color: rgba(255, 255, 255, 0.7);
}

.rooms-list {
  max-height: 250px;
  overflow-y: auto;
}

.room-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 215, 0, 0.2);
  border-radius: 10px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.room-item:hover:not(.full) {
  background: rgba(255, 215, 0, 0.1);
  border-color: rgba(255, 215, 0, 0.5);
  transform: translateX(5px);
}

.room-item.full {
  opacity: 0.5;
  cursor: not-allowed;
}

.room-item-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.room-code-badge {
  font-size: 16px;
  font-weight: bold;
  color: #ffd700;
  font-family: 'Courier New', monospace;
  letter-spacing: 2px;
}

.room-host {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.room-item-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.room-players {
  font-size: 13px;
  color: #4ade80;
}

.room-players.full {
  color: #ef4444;
}

.room-full-tag {
  font-size: 10px;
  background: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  padding: 2px 6px;
  border-radius: 4px;
}

.no-rooms {
  text-align: center;
  padding: 40px 20px;
  color: rgba(255, 255, 255, 0.6);
}

.no-rooms-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.no-rooms-hint {
  font-size: 12px;
  margin-top: 8px;
  color: rgba(255, 255, 255, 0.4);
}

.room-list-actions {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.room-list-actions .btn {
  flex: 1;
}

.copy-room-btn {
  margin-top: 10px;
  padding: 8px 20px;
  background: rgba(255, 215, 0, 0.2);
  border: 1px solid rgba(255, 215, 0, 0.4);
  border-radius: 8px;
  color: #ffd700;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s ease;
}

.copy-room-btn:hover {
  background: rgba(255, 215, 0, 0.3);
}

.lobby-player-card.host {
  border-color: rgba(255, 215, 0, 0.4);
  background: rgba(255, 215, 0, 0.05);
}

.host-badge {
  font-size: 10px;
  background: linear-gradient(135deg, #ffd700, #ffed4e);
  color: #2d3748;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 6px;
  font-weight: bold;
}

.lobby-player-avatar.ai {
  background: linear-gradient(135deg, #3b82f6, #60a5fa);
  border-color: #2563eb;
}

.waiting-btn {
  background: rgba(255, 255, 255, 0.1) !important;
  color: rgba(255, 255, 255, 0.6) !important;
}

.mode-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.mode-desc {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}
</style>
