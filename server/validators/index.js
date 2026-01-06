/**
 * 输入验证工具
 * 提供统一的数据验证方法
 */

// 验证结果类
class ValidationResult {
  constructor(isValid, errors = []) {
    this.isValid = isValid
    this.errors = errors
  }
  
  get firstError() {
    return this.errors[0] || null
  }
}

// 验证器基类
class Validator {
  constructor() {
    this.errors = []
  }
  
  addError(field, message) {
    this.errors.push({ field, message })
    return this
  }
  
  validate() {
    return new ValidationResult(this.errors.length === 0, this.errors)
  }
}

// 字符串验证
export function validateString(value, field, options = {}) {
  const {
    required = false,
    minLength = 0,
    maxLength = Infinity,
    pattern = null,
    trim = true
  } = options
  
  const validator = new Validator()
  
  if (required && (!value || (trim && value.trim() === ''))) {
    return validator.addError(field, `${field}不能为空`).validate()
  }
  
  if (!value) return validator.validate()
  
  const str = trim ? value.trim() : value
  
  if (str.length < minLength) {
    validator.addError(field, `${field}长度至少${minLength}个字符`)
  }
  
  if (str.length > maxLength) {
    validator.addError(field, `${field}长度不能超过${maxLength}个字符`)
  }
  
  if (pattern && !pattern.test(str)) {
    validator.addError(field, `${field}格式不正确`)
  }
  
  return validator.validate()
}

// 数字验证
export function validateNumber(value, field, options = {}) {
  const {
    required = false,
    min = -Infinity,
    max = Infinity,
    integer = false
  } = options
  
  const validator = new Validator()
  
  if (required && (value === null || value === undefined)) {
    return validator.addError(field, `${field}不能为空`).validate()
  }
  
  if (value === null || value === undefined) return validator.validate()
  
  const num = Number(value)
  
  if (isNaN(num)) {
    return validator.addError(field, `${field}必须是数字`).validate()
  }
  
  if (integer && !Number.isInteger(num)) {
    validator.addError(field, `${field}必须是整数`)
  }
  
  if (num < min) {
    validator.addError(field, `${field}不能小于${min}`)
  }
  
  if (num > max) {
    validator.addError(field, `${field}不能大于${max}`)
  }
  
  return validator.validate()
}

// 用户名验证
export function validateUsername(username) {
  return validateString(username, '用户名', {
    required: true,
    minLength: 2,
    maxLength: 20,
    pattern: /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/
  })
}

// 密码验证
export function validatePassword(password) {
  return validateString(password, '密码', {
    required: true,
    minLength: 4,
    maxLength: 50,
    trim: false
  })
}

// 房间码验证
export function validateRoomCode(roomCode) {
  return validateString(roomCode, '房间码', {
    required: true,
    minLength: 6,
    maxLength: 6,
    pattern: /^[A-Z0-9]{6}$/
  })
}

// 玩家名称验证
export function validatePlayerName(name) {
  return validateString(name, '玩家名称', {
    required: true,
    minLength: 1,
    maxLength: 20
  })
}

// 筹码验证
export function validateChips(chips) {
  return validateNumber(chips, '筹码', {
    required: true,
    min: 0,
    max: 1000000000,
    integer: true
  })
}

// 底注验证
export function validateAnte(ante) {
  return validateNumber(ante, '底注', {
    required: true,
    min: 1,
    max: 10000,
    integer: true
  })
}

// 座位索引验证
export function validateSeatIndex(seatIndex) {
  return validateNumber(seatIndex, '座位索引', {
    required: true,
    min: 0,
    max: 7,
    integer: true
  })
}

// 批量验证
export function validateAll(...validations) {
  const allErrors = []
  
  for (const result of validations) {
    if (!result.isValid) {
      allErrors.push(...result.errors)
    }
  }
  
  return new ValidationResult(allErrors.length === 0, allErrors)
}
