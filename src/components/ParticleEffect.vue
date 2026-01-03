<template>
  <div class="particles" ref="particlesContainer">
    <!-- 粒子效果已禁用以防止抖动 -->
  </div>
</template>

<script>
export default {
  name: 'ParticleEffect',
  data() {
    return {
      particles: [],
      particleId: 0,
      animationFrame: null
    }
  },
  mounted() {
    // 粒子系统已禁用
  },
  beforeUnmount() {
    // 清理已禁用
  },
  methods: {
    startParticleSystem() {
      // 已禁用
    },
    
    createParticles() {
      // 已禁用
    },
    
    addParticle() {
      // 已禁用
    },
    
    updateParticleStyle(particle) {
      // 已禁用
    },
    
    animateParticles() {
      // 已禁用
    }
  }
}
</script>