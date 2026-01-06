/**
 * 静态文件服务中间件
 */
import { readFileSync, existsSync } from 'fs'
import { join, extname } from 'path'

// MIME 类型映射
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
}

/**
 * 创建静态文件服务
 * @param {string} staticDir 静态文件目录
 */
export function createStaticServer(staticDir) {
  return function serveStaticFile(req, res) {
    let filePath = req.url === '/' ? '/index.html' : req.url
    filePath = filePath.split('?')[0]
    
    const fullPath = join(staticDir, filePath)
    const ext = extname(filePath)
    
    // 安全检查：防止目录遍历攻击
    if (!fullPath.startsWith(staticDir)) {
      res.writeHead(403)
      res.end('Forbidden')
      return
    }
    
    if (existsSync(fullPath)) {
      try {
        const content = readFileSync(fullPath)
        const contentType = MIME_TYPES[ext] || 'application/octet-stream'
        res.writeHead(200, { 'Content-Type': contentType })
        res.end(content)
      } catch (e) {
        res.writeHead(500)
        res.end('Server Error')
      }
    } else {
      // SPA fallback：返回 index.html
      try {
        const content = readFileSync(join(staticDir, 'index.html'))
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(content)
      } catch (e) {
        res.writeHead(404)
        res.end('Not Found')
      }
    }
  }
}
