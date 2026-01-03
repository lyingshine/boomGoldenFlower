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
          <button type="button" class="menu-btn lobby-btn" @click.stop="handleBackToLobby">
            🏠 返回大厅
          </button>
          <button type="button" class="menu-btn logout-btn" @click.stop="handleLogout">
            🚪 退出登录
          </button>
        </div>
      </div>
      
      <div class="header-right">
      </div>
    </header>
    
    <!-- 点击外部关闭菜单 - 放在最后 -->
    <div v-if="showMenu" class="menu-overlay" @click="closeMenu"></div>
  </div>
</template>

<script>
export default {
  name: 'GameHeader',
  props: ['userManager', 'gamePhase', 'myPlayer'],
  emits: ['back-to-lobby', 'logout'],
  data() {
    return {
      showMenu: false
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
    },
    closeMenu() {
      this.showMenu = false
    },
    handleBackToLobby() {
      const inGame = this.gamePhase === 'betting'
      const message = inGame 
        ? '返回大厅将弃牌离开当前对局，确定吗？' 
        : '确定返回大厅？'
      if (confirm(message)) {
        this.showMenu = false
        this.$emit('back-to-lobby', { manual: true })
      }
    },
    handleLogout() {
      if (confirm('确定要退出登录吗？')) {
        this.showMenu = false
        this.$emit('logout', { manual: true })
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
  top: 0;
  left: 0;
  right: 0;
  height: 44px;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(10px);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 12px;
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
  min-width: 160px;
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

.menu-btn.logout-btn {
  background: rgba(239, 68, 68, 0.8);
  color: white;
}

.menu-btn.logout-btn:hover {
  background: rgba(239, 68, 68, 1);
}

.menu-btn.logout-btn:active {
  background: rgba(239, 68, 68, 0.6);
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
