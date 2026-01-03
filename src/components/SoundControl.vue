<template>
  <div class="sound-control">
    <button 
      @click="toggleSound" 
      class="sound-btn"
      :class="{ 'sound-off': !soundEnabled }"
      :title="soundEnabled ? '关闭音效' : '开启音效'"
    >
      {{ soundEnabled ? '🔊' : '🔇' }}
    </button>
    
    <div class="volume-control" v-show="soundEnabled">
      <input 
        type="range" 
        min="0" 
        max="100" 
        v-model="volume"
        @input="updateVolume"
        class="volume-slider"
      />
    </div>
  </div>
</template>

<script>
export default {
  name: 'SoundControl',
  props: {
    soundManager: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      soundEnabled: true,
      volume: 50
    }
  },
  methods: {
    toggleSound() {
      this.soundEnabled = this.soundManager.toggle()
      this.$emit('soundToggled', this.soundEnabled)
    },
    
    updateVolume() {
      this.soundManager.setVolume(this.volume / 100)
      this.$emit('volumeChanged', this.volume)
    }
  }
}
</script>

<style scoped>
.sound-control {
  position: fixed;
  top: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 1000;
}

.sound-btn {
  width: 50px;
  height: 50px;
  border: none;
  border-radius: 50%;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(10px);
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  border: 1px solid rgba(255,255,255,0.2);
}

.sound-btn:hover {
  background: rgba(0,0,0,0.7);
}

.sound-btn.sound-off {
  background: rgba(255,0,0,0.3);
}

.volume-control {
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(10px);
  padding: 10px;
  border-radius: 25px;
  border: 1px solid rgba(255,255,255,0.2);
}

.volume-slider {
  width: 100px;
  height: 5px;
  border-radius: 5px;
  background: rgba(255,255,255,0.3);
  outline: none;
  cursor: pointer;
}

.volume-slider::-webkit-slider-thumb {
  appearance: none;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: #ffd700;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
}

.volume-slider::-moz-range-thumb {
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: #ffd700;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
}
</style>