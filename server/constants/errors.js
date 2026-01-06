/**
 * 错误码和错误消息定义
 */

// 错误码
export const ErrorCode = {
  // 通用错误 1xxx
  UNKNOWN_ERROR: 1000,
  INVALID_INPUT: 1001,
  MISSING_PARAMETER: 1002,
  INVALID_MESSAGE_TYPE: 1003,
  
  // 用户相关 2xxx
  USER_NOT_FOUND: 2001,
  USER_ALREADY_EXISTS: 2002,
  INVALID_CREDENTIALS: 2003,
  INVALID_USERNAME: 2004,
  INVALID_PASSWORD: 2005,
  USER_LOCKED: 2006,
  
  // 房间相关 3xxx
  ROOM_NOT_FOUND: 3001,
  ROOM_FULL: 3002,
  ROOM_ALREADY_STARTED: 3003,
  INVALID_ROOM_CODE: 3004,
  NOT_ROOM_HOST: 3005,
  ALREADY_IN_ROOM: 3006,
  
  // 游戏相关 4xxx
  GAME_NOT_STARTED: 4001,
  NOT_YOUR_TURN: 4002,
  INVALID_ACTION: 4003,
  INSUFFICIENT_CHIPS: 4004,
  INVALID_BET_AMOUNT: 4005,
  PLAYER_NOT_FOUND: 4006,
  ALREADY_FOLDED: 4007,
  
  // 数据库相关 5xxx
  DATABASE_ERROR: 5001,
  QUERY_FAILED: 5002,
  CONNECTION_FAILED: 5003
}

// 错误消息
export const ErrorMessage = {
  [ErrorCode.UNKNOWN_ERROR]: '未知错误',
  [ErrorCode.INVALID_INPUT]: '输入数据无效',
  [ErrorCode.MISSING_PARAMETER]: '缺少必需参数',
  [ErrorCode.INVALID_MESSAGE_TYPE]: '无效的消息类型',
  
  [ErrorCode.USER_NOT_FOUND]: '用户不存在',
  [ErrorCode.USER_ALREADY_EXISTS]: '用户名已存在',
  [ErrorCode.INVALID_CREDENTIALS]: '用户名或密码错误',
  [ErrorCode.INVALID_USERNAME]: '用户名格式不正确',
  [ErrorCode.INVALID_PASSWORD]: '密码格式不正确',
  [ErrorCode.USER_LOCKED]: '账号已被锁定，请稍后再试',
  
  [ErrorCode.ROOM_NOT_FOUND]: '房间不存在',
  [ErrorCode.ROOM_FULL]: '房间已满',
  [ErrorCode.ROOM_ALREADY_STARTED]: '游戏已开始',
  [ErrorCode.INVALID_ROOM_CODE]: '房间码格式不正确',
  [ErrorCode.NOT_ROOM_HOST]: '只有房主可以执行此操作',
  [ErrorCode.ALREADY_IN_ROOM]: '已在房间中',
  
  [ErrorCode.GAME_NOT_STARTED]: '游戏未开始',
  [ErrorCode.NOT_YOUR_TURN]: '还没轮到你',
  [ErrorCode.INVALID_ACTION]: '无效的操作',
  [ErrorCode.INSUFFICIENT_CHIPS]: '筹码不足',
  [ErrorCode.INVALID_BET_AMOUNT]: '下注金额无效',
  [ErrorCode.PLAYER_NOT_FOUND]: '玩家不存在',
  [ErrorCode.ALREADY_FOLDED]: '已经弃牌',
  
  [ErrorCode.DATABASE_ERROR]: '数据库错误',
  [ErrorCode.QUERY_FAILED]: '查询失败',
  [ErrorCode.CONNECTION_FAILED]: '连接失败'
}

// 自定义错误类
export class AppError extends Error {
  constructor(code, message = null, details = null) {
    super(message || ErrorMessage[code] || '未知错误')
    this.name = 'AppError'
    this.code = code
    this.details = details
  }
  
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details
    }
  }
}

// 快捷创建错误的工具函数
export function createError(code, message = null, details = null) {
  return new AppError(code, message, details)
}
