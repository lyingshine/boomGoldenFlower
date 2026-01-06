/**
 * 文件上传处理器
 */
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, extname } from 'path'

/**
 * 创建头像上传处理器
 * @param {string} avatarsDir 头像存储目录
 */
export function createAvatarUploadHandler(avatarsDir) {
  // 确保目录存在
  if (!existsSync(avatarsDir)) {
    mkdirSync(avatarsDir, { recursive: true })
  }

  return function handleAvatarUpload(req, res) {
    // CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }
    
    const chunks = []
    
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks)
        const boundary = req.headers['content-type'].split('boundary=')[1]
        const parts = parseMultipart(buffer, boundary)
        
        const avatarPart = parts.find(p => p.name === 'avatar')
        const usernamePart = parts.find(p => p.name === 'username')
        
        if (!avatarPart || !usernamePart) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, message: '缺少必要参数' }))
          return
        }
        
        const username = usernamePart.data.toString()
        const ext = avatarPart.filename ? extname(avatarPart.filename) : '.jpg'
        const filename = `${username}_${Date.now()}${ext}`
        const filepath = join(avatarsDir, filename)
        
        writeFileSync(filepath, avatarPart.data)
        
        const avatarUrl = `/avatars/${filename}`
        console.log(`📷 头像上传成功: ${username} -> ${avatarUrl}`)
        
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true, avatarUrl }))
      } catch (e) {
        console.error('头像上传失败:', e)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, message: '上传失败' }))
      }
    })
  }
}

/**
 * 解析 multipart/form-data
 */
function parseMultipart(buffer, boundary) {
  const parts = []
  const boundaryBuffer = Buffer.from(`--${boundary}`)
  
  let start = buffer.indexOf(boundaryBuffer) + boundaryBuffer.length + 2
  
  while (start < buffer.length) {
    const end = buffer.indexOf(boundaryBuffer, start)
    if (end === -1) break
    
    const part = buffer.slice(start, end - 2)
    const headerEnd = part.indexOf('\r\n\r\n')
    
    if (headerEnd !== -1) {
      const headers = part.slice(0, headerEnd).toString()
      const data = part.slice(headerEnd + 4)
      
      const nameMatch = headers.match(/name="([^"]+)"/)
      const filenameMatch = headers.match(/filename="([^"]+)"/)
      
      if (nameMatch) {
        parts.push({
          name: nameMatch[1],
          filename: filenameMatch ? filenameMatch[1] : null,
          data
        })
      }
    }
    
    start = end + boundaryBuffer.length + 2
  }
  
  return parts
}
