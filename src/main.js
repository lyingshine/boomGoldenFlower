import { createApp } from 'vue'
import App from './App.vue'
import AIPage from './AIPage.vue'
import './style.css'

// 简单路由：/ai 显示 AI 监控页面
const path = window.location.pathname
if (path === '/ai' || path === '/ai/') {
  createApp(AIPage).mount('#app')
} else {
  createApp(App).mount('#app')
}