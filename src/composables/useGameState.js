/**
 * 游戏状态 Composable
 * 管理游戏相关的状态和逻辑
 */
import { inject, computed } from 'vue'
import * as gameGetters from '../store/gameGetters.js'

export function useGameState() {
  const store = inject('store')
  
  // 游戏状态
  const gamePhase = computed(() => store.state.game.phase)
  const allSeats = computed(() => store.state.game.seats)
  const players = computed(() => allSeats.value.filter(p => p))
  const currentPlayerIndex = computed(() => store.state.game.currentPlayerIndex)
  const pot = computed(() => store.state.game.pot)
  const currentBet = computed(() => store.state.game.currentBet)
  const ante = computed(() => store.state.game.ante)
  const winner = computed(() => store.state.game.winner)
  const mySeatIndex = computed(() => store.state.game.mySeatIndex)
  const firstRoundComplete = computed(() => store.state.game.firstRoundComplete)
  const myPlayer = computed(() => allSeats.value[mySeatIndex.value])
  const isMyTurn = computed(() => mySeatIndex.value === currentPlayerIndex.value)
  
  // 游戏统计
  const gameStats = computed(() => ({
    round: store.state.game.round,
    activePlayers: allSeats.value.filter(p => p && !p.folded).length
  }))
  
  // 游戏操作判断
  const canCall = computed(() => 
    gameGetters.canCall(allSeats.value, mySeatIndex.value, currentPlayerIndex.value, currentBet.value)
  )
  
  const canRaise = computed(() => 
    gameGetters.canRaise(allSeats.value, mySeatIndex.value, currentPlayerIndex.value, currentBet.value)
  )
  
  const canBlind = computed(() => 
    gameGetters.canBlind(allSeats.value, mySeatIndex.value, currentPlayerIndex.value, currentBet.value)
  )
  
  const canShowdown = computed(() => 
    gameGetters.canShowdown(allSeats.value, mySeatIndex.value, currentPlayerIndex.value, currentBet.value, firstRoundComplete.value)
  )
  
  const callAmount = computed(() => 
    gameGetters.getCallAmount(allSeats.value, mySeatIndex.value, currentBet.value)
  )
  
  const blindMinAmount = computed(() => 
    gameGetters.getCallAmount(allSeats.value, mySeatIndex.value, currentBet.value)
  )
  
  const showdownCost = computed(() => 
    gameGetters.getCallAmount(allSeats.value, mySeatIndex.value, currentBet.value)
  )
  
  const showdownTargets = computed(() => 
    gameGetters.getShowdownTargets(allSeats.value, mySeatIndex.value)
  )
  
  const gameStatus = computed(() => 
    gameGetters.getStatusMessage(gamePhase.value, winner.value)
  )
  
  return {
    // 状态
    gamePhase,
    allSeats,
    players,
    currentPlayerIndex,
    pot,
    currentBet,
    ante,
    winner,
    mySeatIndex,
    firstRoundComplete,
    myPlayer,
    isMyTurn,
    gameStats,
    
    // 操作判断
    canCall,
    canRaise,
    canBlind,
    canShowdown,
    callAmount,
    blindMinAmount,
    showdownCost,
    showdownTargets,
    gameStatus
  }
}
