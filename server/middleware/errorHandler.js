/**
 * 错误处理中间件
 */
import { AppError, ErrorCode, ErrorMessage } from '../constants/errors.js'
import { serverConfig } from '../config/index.js'
import logger from '../utils/logger.js'

/**
 * 包装异步处理器，自动捕获错误
 */
export function asyncHandler(handler) {
  return async (...args) => {
    try {
      await handler(...args)
    } catch (error) {
      const errorResponse = handleError(error, args[0], args[1])
      
      // 发送错误响应给客户端
      const clientId = args[0]
      const clients = args[2] // 第三个参数是 clients Map
      if (clients) {
        const client = clients.get(clientId)
        if (client?.ws) {
          sendError(client.ws, error)
        }
      }
    }
  }
}

/**
 * 统一错误处理
 */
export function handleError(error, clientId, data = null) {
  // 如果是自定义错误
  if (error instanceof AppError) {
    logger.error(`应用错误 [${error.code}]`, { 
      message: error.message, 
      details: error.details,
      clientId 
    })
    return {
      type: 'error',
      code: error.code,
      message: error.message,
      details: serverConfig.isDevelopment ? error.details : undefined
    }
  }
  
  // 数据库错误
  if (error.code?.startsWith('ER_') || error.code === 'ECONNREFUSED') {
    logger.error('数据库错误', { error: error.message, clientId })
    return {
      type: 'error',
      code: ErrorCode.DATABASE_ERROR,
      message: ErrorMessage[ErrorCode.DATABASE_ERROR],
      details: serverConfig.isDevelopment ? error.message : undefined
    }
  }
  
  // 未知错误
  logger.error('未知错误', { error: error.message, stack: error.stack, clientId })
  return {
    type: 'error',
    code: ErrorCode.UNKNOWN_ERROR,
    message: ErrorMessage[ErrorCode.UNKNOWN_ERROR],
    details: serverConfig.isDevelopment ? error.message : undefined
  }
}

/**
 * 发送错误响应
 */
export function sendError(ws, error) {
  if (!ws || ws.readyState !== 1) return
  
  const errorResponse = error instanceof AppError 
    ? {
        type: 'error',
        code: error.code,
        message: error.message,
        details: serverConfig.isDevelopment ? error.details : undefined
      }
    : handleError(error)
  
  try {
    ws.send(JSON.stringify(errorResponse))
  } catch (e) {
    logger.error('发送错误响应失败', { error: e.message })
  }
}
