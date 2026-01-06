/**
 * 玩家档案数据仓库
 */
import { pool } from './connection.js'

// 获取玩家档案
export async function getPlayerProfile(username) {
  const [rows] = await pool.execute(
    'SELECT * FROM player_profiles WHERE username = ?',
    [username]
  )
  if (rows.length === 0) return null
  return formatProfile(rows[0])
}

// 批量获取玩家档案
export async function getPlayerProfiles(usernames) {
  if (!usernames || usernames.length === 0) return {}

  const placeholders = usernames.map(() => '?').join(',')
  const [rows] = await pool.execute(
    `SELECT * FROM player_profiles WHERE username IN (${placeholders})`,
    usernames
  )

  const profiles = {}
  for (const row of rows) {
    profiles[row.username] = formatProfile(row)
  }
  return profiles
}

// 获取所有玩家档案
export async function getAllPlayerProfiles() {
  const [rows] = await pool.execute('SELECT * FROM player_profiles ORDER BY total_hands DESC')
  return rows.map(formatProfile)
}

// 创建或更新玩家档案
export async function updatePlayerProfile(username, updates) {
  const existing = await getPlayerProfile(username)
  const now = Date.now()

  if (!existing) {
    await createProfile(username, updates, now)
  } else {
    await updateExistingProfile(username, updates, existing, now)
  }
}

async function createProfile(username, updates, now) {
  await pool.execute(
    `INSERT INTO player_profiles 
     (username, total_hands, fold_count, raise_count, call_count, blind_bet_count, 
      showdown_wins, showdown_losses, bluff_caught, big_bet_with_weak, 
      avg_peek_round, peek_round_samples, early_fold_count, late_fold_count, 
      small_raise_count, big_raise_count, check_raise_count, showdown_initiated, 
      showdown_received, won_without_showdown, total_chips_won, total_chips_lost, 
      max_single_win, max_single_loss, avg_bet_size, bet_size_samples, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [username, updates.totalHands || 0, updates.foldCount || 0, updates.raiseCount || 0,
     updates.callCount || 0, updates.blindBetCount || 0, updates.showdownWins || 0,
     updates.showdownLosses || 0, updates.bluffCaught || 0, updates.bigBetWithWeak || 0,
     updates.avgPeekRound || 0, updates.peekRoundSamples || 0, updates.earlyFoldCount || 0,
     updates.lateFoldCount || 0, updates.smallRaiseCount || 0, updates.bigRaiseCount || 0,
     updates.checkRaiseCount || 0, updates.showdownInitiated || 0, updates.showdownReceived || 0,
     updates.wonWithoutShowdown || 0, updates.totalChipsWon || 0, updates.totalChipsLost || 0,
     updates.maxSingleWin || 0, updates.maxSingleLoss || 0, updates.avgBetSize || 0,
     updates.betSizeSamples || 0, now]
  )
}


async function updateExistingProfile(username, updates, existing, now) {
  const fields = []
  const values = []

  const incrementFields = {
    totalHands: 'total_hands', foldCount: 'fold_count', raiseCount: 'raise_count',
    callCount: 'call_count', blindBetCount: 'blind_bet_count', showdownWins: 'showdown_wins',
    showdownLosses: 'showdown_losses', bluffCaught: 'bluff_caught', bigBetWithWeak: 'big_bet_with_weak',
    earlyFoldCount: 'early_fold_count', lateFoldCount: 'late_fold_count',
    smallRaiseCount: 'small_raise_count', bigRaiseCount: 'big_raise_count',
    checkRaiseCount: 'check_raise_count', showdownInitiated: 'showdown_initiated',
    showdownReceived: 'showdown_received', wonWithoutShowdown: 'won_without_showdown',
    totalChipsWon: 'total_chips_won', totalChipsLost: 'total_chips_lost'
  }

  for (const [key, dbField] of Object.entries(incrementFields)) {
    if (updates[key]) {
      fields.push(`${dbField} = ${dbField} + ?`)
      values.push(updates[key])
    }
  }

  if (updates.maxSingleWin) {
    fields.push('max_single_win = GREATEST(max_single_win, ?)')
    values.push(updates.maxSingleWin)
  }
  if (updates.maxSingleLoss) {
    fields.push('max_single_loss = GREATEST(max_single_loss, ?)')
    values.push(updates.maxSingleLoss)
  }

  if (updates.peekRound) {
    const newSamples = existing.peekRoundSamples + 1
    const newAvg = (existing.avgPeekRound * existing.peekRoundSamples + updates.peekRound) / newSamples
    fields.push('avg_peek_round = ?', 'peek_round_samples = ?')
    values.push(newAvg, newSamples)
  }

  if (updates.betSize) {
    const newSamples = (existing.betSizeSamples || 0) + 1
    const newAvg = ((existing.avgBetSize || 0) * (existing.betSizeSamples || 0) + updates.betSize) / newSamples
    fields.push('avg_bet_size = ?', 'bet_size_samples = ?')
    values.push(newAvg, newSamples)
  }

  if (fields.length > 0) {
    fields.push('updated_at = ?')
    values.push(now)
    values.push(username)
    await pool.execute(`UPDATE player_profiles SET ${fields.join(', ')} WHERE username = ?`, values)
  }
}

function formatProfile(row) {
  return {
    username: row.username,
    totalHands: row.total_hands,
    foldCount: row.fold_count,
    raiseCount: row.raise_count,
    callCount: row.call_count,
    blindBetCount: row.blind_bet_count,
    showdownWins: row.showdown_wins,
    showdownLosses: row.showdown_losses,
    bluffCaught: row.bluff_caught,
    bigBetWithWeak: row.big_bet_with_weak,
    avgPeekRound: row.avg_peek_round,
    peekRoundSamples: row.peek_round_samples,
    earlyFoldCount: row.early_fold_count || 0,
    lateFoldCount: row.late_fold_count || 0,
    smallRaiseCount: row.small_raise_count || 0,
    bigRaiseCount: row.big_raise_count || 0,
    checkRaiseCount: row.check_raise_count || 0,
    showdownInitiated: row.showdown_initiated || 0,
    showdownReceived: row.showdown_received || 0,
    wonWithoutShowdown: row.won_without_showdown || 0,
    totalChipsWon: row.total_chips_won || 0,
    totalChipsLost: row.total_chips_lost || 0,
    maxSingleWin: row.max_single_win || 0,
    maxSingleLoss: row.max_single_loss || 0,
    avgBetSize: row.avg_bet_size || 0,
    betSizeSamples: row.bet_size_samples || 0,
    updatedAt: row.updated_at
  }
}
