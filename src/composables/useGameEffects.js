/**
 * 游戏特效 Composable
 * 管理音效、粒子特效等
 */
import { ref, isRef } from 'vue'

export function useGameEffects(soundManagerRef) {
  const particlesRef = ref(null)
  
  // 获取 soundManager 实例（支持 ref 或普通对象）
  const getSound = () => isRef(soundManagerRef) ? soundManagerRef.value : soundManagerRef
  
  // 播放发牌音效
  const playDealingSound = (playerCount) => {
    const totalCards = playerCount * 3
    for (let i = 0; i < totalCards; i++) {
      setTimeout(() => getSound()?.play('card'), i * 300)
    }
  }
  
  // 播放轮次提示音
  const playTurnSound = () => {
    getSound()?.play('turn')
  }
  
  // 播放动作音效
  const playActionSound = (action, amount) => {
    const sound = getSound()
    if (['call', 'blind'].includes(action)) {
      sound?.play('call')
    } else if (action === 'raise') {
      if (amount >= 100) {
        sound?.play('bigBet')
      } else {
        sound?.play('raise')
      }
    } else if (action === 'allin') {
      sound?.play('allIn')
      particlesRef.value?.triggerAllInEffect()
    } else if (action === 'peek') {
      sound?.play('peek')
    } else if (action === 'fold') {
      sound?.play('fold')
    } else if (action === 'showdown') {
      sound?.play('showdown')
    }
  }
  
  // 播放手牌类型音效
  const playHandTypeSound = (handType) => {
    getSound()?.playHandTypeSound(handType)
  }
  
  // 播放胜负音效
  const playWinLoseSound = (isWin) => {
    setTimeout(() => {
      if (isWin) {
        getSound()?.play('win')
      } else {
        getSound()?.play('lose')
      }
    }, 600)
  }
  
  // 触发胜利特效
  const triggerWinEffects = (winner, pot, allSeats) => {
    if (!winner || !particlesRef.value) return
    
    const handType = winner.handType?.type || winner.handType
    const centerX = window.innerWidth / 2
    const centerY = window.innerHeight / 2 - 50
    
    const handTypeNames = {
      'leopard': '豹子！',
      'straight_flush': '同花顺！',
      'flush': '同花',
      'straight': '顺子',
      'pair': '对子',
      'high_card': '散牌'
    }
    
    if (handType === 'leopard' || handType === 'straight_flush') {
      particlesRef.value.triggerShake('heavy')
      particlesRef.value.triggerBigHandEffect()
      setTimeout(() => {
        particlesRef.value.triggerWinEffect(centerX, centerY, pot)
        particlesRef.value.triggerFloatText(centerX, centerY - 60, handTypeNames[handType], 'handtype')
      }, 300)
      setTimeout(() => {
        particlesRef.value.triggerFloatText(centerX, centerY + 20, `+${pot}`, 'win')
      }, 600)
    } else if (handType === 'flush' || handType === 'straight') {
      particlesRef.value.triggerShake('medium')
      particlesRef.value.triggerWinEffect(centerX, centerY, pot)
      setTimeout(() => {
        particlesRef.value.triggerFloatText(centerX, centerY, `+${pot}`, 'win')
      }, 200)
    } else {
      particlesRef.value.triggerShake('light')
      particlesRef.value.triggerWinEffect(centerX, centerY, Math.min(pot, 200))
      setTimeout(() => {
        particlesRef.value.triggerFloatText(centerX, centerY, `+${pot}`, 'win')
      }, 200)
    }
  }
  
  // 触发 VS 对决特效
  const triggerVSEffect = (challengerName, targetName) => {
    particlesRef.value?.triggerVSEffect(challengerName, targetName)
  }
  
  // 触发连胜特效
  const triggerStreakEffect = (winStreak, isWin) => {
    setTimeout(() => {
      particlesRef.value?.triggerStreakEffect(winStreak, isWin)
    }, 800)
  }
  
  return {
    particlesRef,
    playDealingSound,
    playTurnSound,
    playActionSound,
    playHandTypeSound,
    playWinLoseSound,
    triggerWinEffects,
    triggerVSEffect,
    triggerStreakEffect
  }
}
