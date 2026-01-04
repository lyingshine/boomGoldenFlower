<template>
  <div class="header-wrapper">
    <header class="game-header">
      <div class="header-left">
        <h1 class="game-title">🎰 诈金花</h1>
      </div>
      
      <div class="header-center">
        <div class="user-info" @click.stop="toggleMenu">
          <span class="user-avatar">😎</span>
          <span class="user-name">{{ displayName }}</span>
          <span class="user-chips">¥{{ displayChips }}</span>
          <span class="dropdown-arrow">{{ showMenu ? '▲' : '▼' }}</span>
        </div>
        
        <!-- 下拉菜单 -->
        <div v-if="showMenu" class="user-menu" @click.stop>
          <div class="menu-header">个人战绩</div>
          <div class="menu-stats">
            <div class="stat-item">
              <span class="stat-label">总局数</span>
              <span class="stat-value">{{ stats.totalGames }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">胜局</span>
              <span class="stat-value win">{{ stats.wins }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">胜率</span>
              <span class="stat-value">{{ winRate }}%</span>
            </div>
          </div>
          <div class="menu-divider"></div>
          <button type="button" class="menu-btn lobby-btn" @click.stop="showLobbyConfirm = true">
            🏠 返回大厅
          </button>
          <button v-if="showLobbyConfirm" type="button" class="menu-btn confirm-btn" @click.stop="confirmBackToLobby">
            确认返回
          </button>
        </div>
      </div>
      
      <div class="header-right">
        <button v-if="roomCode" class="room-info-toggle" @click.stop="toggleRoomInfo">
          ℹ️
        </button>
        <!-- 房间信息下拉 -->
        <div v-if="showRoomInfo && roomCode" class="room-info-dropdown" @click.stop>
          <div class="room-info-item room-code-item" @click="copyRoomCode" title="点击复制">
            <span class="room-info-icon">🔑</span>
            <span class="room-info-value room-code-value">{{ roomCode }}</span>
            <span class="copy-icon">{{ copied ? '✓' : '📋' }}</span>
          </div>
          <div class="room-info-item">
            <span class="room-info-icon">👥</span>
            <span class="room-info-value">{{ playerCount }}人</span>
          </div>
          <div class="room-info-item">
            <span class="room-info-icon">🎲</span>
            <span class="room-info-value">第{{ round }}局</span>
          </div>
        </div>
      </div>
    </header>
    
    <!-- 点击外部关闭菜单 - 放在最后 -->
    <div v-if="showMenu || showRoomInfo" class="menu-overlay" @click="closeAllMenus"></div>
  </div>
</template>

<script>
export default {
  name: 'GameHeader',
  props: ['userManager', 'gamePhase', 'myPlayer', 'roomCode', 'playerCount', 'round'],
  emits: ['back-to-lobby', 'logout'],
  data() {
    return {
      showMenu: false,
      showRoomInfo: false,
      copied: false,
      showLobbyConfirm: false
    }
  },
  computed: {
    displayName() {
      const user = this.userManager?.getCurrentUser()
      return user?.username || '玩家'
    },
    displayChips() {
      // 优先显示游戏中的实时筹码
      if (this.myPlayer && typeof this.myPlayer.chips === 'number') {
        return this.myPlayer.chips
      }
      const user = this.userManager?.getCurrentUser()
      return user?.chips || 1000
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
    toggleMenu() {
      this.showMenu = !this.showMenu
      if (this.showMenu) this.showRoomInfo = false
    },
    toggleRoomInfo() {
      this.showRoomInfo = !this.showRoomInfo
      if (this.showRoomInfo) this.showMenu = false
    },
    closeAllMenus() {
      this.showMenu = false
      this.showRoomInfo = false
      this.showLobbyConfirm = false
    },
    confirmBackToLobby() {
      this.showMenu = false
      this.showLobbyConfirm = false
      this.$emit('back-to-lobby', { manual: true })
    },
    handleBackToLobby() {
      // 保留此方法以防其他地方调用
      this.showLobbyConfirm = true
    },
    handleLogout() {
      if (confirm('确定要退出登录吗？')) {
        this.showMenu = false
        this.$emit('logout', { manual: true })
      }
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
  }
}
</script>

<style scoped>
.header-wrapper {
  position: relative;
}

.game-header {
  position: fixed;
  top: env(safe-area-inset-top);
  left: 0;
  right: 0;
  height: 44px;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(10px);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-left: 12px;
  padding-right: 12px;
  z-index: 100;
  border-bottom: 1px solid rgba(255, 215, 0, 0.2);
}

.header-left {
  flex: 0 0 auto;
}

.game-title {
  font-size: 15px;
  font-weight: 700;
  color: #ffd700;
  margin: 0;
  text-shadow: 0 0 8px rgba(255, 215, 0, 0.4);
  white-space: nowrap;
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
  position: relative;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: rgba(255, 215, 0, 0.1);
  border-radius: 20px;
  border: 1px solid rgba(255, 215, 0, 0.3);
  cursor: pointer;
  transition: all 0.2s ease;
}

.user-info:hover {
  background: rgba(255, 215, 0, 0.15);
  border-color: rgba(255, 215, 0, 0.5);
}

.user-avatar {
  font-size: 16px;
}

.user-name {
  font-size: 13px;
  color: #ffd700;
  font-weight: 600;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 0 6px rgba(255, 215, 0, 0.3);
}

.user-chips {
  font-size: 13px;
  color: #4ade80;
  font-weight: 700;
  font-family: 'Courier New', monospace;
  text-shadow: 0 0 6px rgba(74, 222, 128, 0.3);
}

.dropdown-arrow {
  font-size: 8px;
  color: rgba(255, 255, 255, 0.5);
  margin-left: 2px;
}

.header-right {
  flex: 0 0 auto;
  width: 60px;
  display: flex;
  justify-content: flex-end;
  position: relative;
}

.room-info-toggle {
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  color: white;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.room-info-toggle:hover {
  background: rgba(255, 255, 255, 0.2);
}

.room-info-dropdown {
  position: absolute;
  top: 40px;
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: rgba(15, 23, 42, 0.98);
  padding: 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 215, 0, 0.3);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.room-info-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  white-space: nowrap;
}

.room-code-item {
  cursor: pointer;
  border: 1px solid rgba(255, 215, 0, 0.3);
}

.room-code-item:hover {
  background: rgba(255, 215, 0, 0.1);
}

.room-info-icon {
  font-size: 12px;
}

.room-info-value {
  font-size: 12px;
  color: white;
  font-weight: 600;
}

.room-code-value {
  color: #ffd700;
  font-family: 'Courier New', monospace;
  letter-spacing: 1px;
}

.copy-icon {
  font-size: 10px;
  opacity: 0.6;
}

/* 下拉菜单 */
.user-menu {
  position: absolute;
  top: 40px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.98);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 12px;
  padding: 12px;
  min-width: 180px;
  z-index: 1000;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}

.menu-header {
  font-size: 12px;
  color: #ffd700;
  font-weight: 600;
  margin-bottom: 8px;
  text-align: center;
}

.menu-stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
}

.stat-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
}

.stat-value {
  font-size: 11px;
  color: white;
  font-weight: 600;
}

.stat-value.win {
  color: #4ade80;
}

.menu-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 10px 0;
}

.menu-btn {
  display: block;
  width: 100%;
  padding: 10px 12px;
  font-size: 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 6px;
  transition: all 0.2s ease;
  font-weight: 500;
  text-align: center;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.menu-btn:last-child {
  margin-bottom: 0;
}

.menu-btn.lobby-btn {
  background: rgba(59, 130, 246, 0.8);
  color: white;
}

.menu-btn.lobby-btn:hover {
  background: rgba(59, 130, 246, 1);
}

.menu-btn.lobby-btn:active {
  background: rgba(59, 130, 246, 0.6);
}

.menu-btn.confirm-btn {
  background: rgba(34, 197, 94, 0.9);
  color: white;
}

.menu-btn.confirm-btn:hover {
  background: rgba(34, 197, 94, 1);
}

.menu-btn.confirm-btn:active {
  background: rgba(34, 197, 94, 0.7);
}

.menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 99;
  background: transparent;
}

@media (max-width: 380px) {
  .game-header {
    padding: 0 8px;
    height: 40px;
  }
  
  .game-title {
    font-size: 13px;
  }
  
  .user-info {
    padding: 4px 10px;
    gap: 6px;
  }
  
  .user-avatar {
    font-size: 14px;
  }
  
  .user-name {
    font-size: 11px;
    max-width: 55px;
  }
  
  .user-chips {
    font-size: 11px;
  }
  
  .user-menu {
    min-width: 140px;
  }
}
</style>
