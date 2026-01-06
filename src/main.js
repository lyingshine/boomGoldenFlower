import { createApp } from 'vue'
import App from './App.vue'
import AIPage from './AIPage.vue'
import { store } from './store/index.js'
import './style.css'

// 简单路由：/ai 显示 AI 监控页面
const path = window.location.pathname
const app = path === '/ai' || path === '/ai/' 
  ? createApp(AIPage) 
  : createApp(App)

// 注入 store 到全局
app.provide('store', store)
app.mount('#app')