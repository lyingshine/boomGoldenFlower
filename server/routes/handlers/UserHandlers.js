/**
 * 用户相关消息处理器
 */
import {
  registerUser, loginUser, signInUser, getUserData, 
  updateUserProfile, getLeaderboard
} from '../../services/UserService.js'
import { send } from '../../services/RoomService.js'

export async function handleRegister(clientId, data, clients) {
  const client = clients.get(clientId)
  const { username, password } = data
  
  try {
    const result = await registerUser(username, password)
    send(client.ws, { type: 'register_result', ...result })
  } catch (error) {
    send(client.ws, { 
      type: 'register_result', 
      success: false, 
      message: error.message || '注册失败'
    })
  }
}

export async function handleLogin(clientId, data, clients) {
  const client = clients.get(clientId)
  const { username, password } = data
  
  try {
    const result = await loginUser(username, password)
    send(client.ws, { type: 'login_result', ...result })
  } catch (error) {
    // 捕获错误并返回失败结果
    send(client.ws, { 
      type: 'login_result', 
      success: false, 
      message: error.message || '登录失败'
    })
  }
}

export function handleSignIn(clientId, data, clients) {
  const client = clients.get(clientId)
  const { username } = data
  
  const result = signInUser(username)
  send(client.ws, { type: 'sign_in_result', ...result })
}

export async function handleGetUser(clientId, data, clients) {
  const client = clients.get(clientId)
  const { username } = data
  
  const result = await getUserData(username)
  send(client.ws, { type: 'get_user_result', ...result })
}

export async function handleUpdateProfile(clientId, data, clients) {
  const client = clients.get(clientId)
  const { username, nickname, avatar, avatarUrl } = data
  
  const result = await updateUserProfile(username, { nickname, avatar, avatarUrl })
  send(client.ws, { type: 'update_profile_result', ...result })
}

export function handleGetLeaderboard(clientId, data, clients) {
  const client = clients.get(clientId)
  const { leaderboardType = 'chips', limit = 999 } = data
  
  const leaderboard = getLeaderboard(leaderboardType, limit)
  send(client.ws, { type: 'leaderboard', leaderboard, leaderboardType })
}

export function handleSyncUser(clientId, data, clients) {
  const client = clients.get(clientId)
  send(client.ws, { type: 'user_synced', success: true })
}
