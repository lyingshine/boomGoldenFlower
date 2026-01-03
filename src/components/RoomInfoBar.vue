<template>
  <div class="room-info-bar" :class="{ 'expanded': showInfo }">
    <button class="room-info-toggle" @click="showInfo = !showInfo">
      ℹ️
    </button>
    <div v-if="showInfo" class="room-info-content">
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
</template>

<script>
export default {
  name: 'RoomInfoBar',
  props: ['roomCode', 'playerCount', 'round'],
  data() {
    return { copied: false, showInfo: false }
  },
  methods: {
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
.room-info-bar {
  position: fixed;
  top: 50px;
  left: 10px;
  z-index: 90;
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
  margin: 0;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  box-shadow: none !important;
  min-width: auto !important;
  max-width: none !important;
}

.room-info-toggle {
  width: 28px;
  height: 28px;
  background: transparent !important;
  border: none !important;
  color: white;
  font-size: 18px;
  cursor: pointer;
  padding: 0;
  margin: 0;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

.room-info-content {
  position: absolute;
  top: 40px;
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: rgba(0, 0, 0, 0.85);
  padding: 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
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
</style>
