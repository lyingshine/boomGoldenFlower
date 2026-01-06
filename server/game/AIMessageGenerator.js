/**
 * AI 消息生成器
 * 生成 AI 玩家的聊天消息
 */

// AI 消息池
const MESSAGE_POOLS = {
  blind: [
    '不看了，直接焖！', '焖到底！', '我有信心', '来吧，跟不跟？', '这把稳了',
    '焖牌才刺激', '不用看，感觉不错', '闭着眼都能赢', '今天手气好', '就这样焖着',
    '焖！', '继续焖', '不看牌更刺激', '盲打到底', '我就不看',
    '焖牌是艺术', '相信直觉', '感觉来了', '这把有戏', '稳住，我们能赢',
    '焖牌王者', '不看也能赢', '就是这么自信', '跟着感觉走', '今天运气不错'
  ],
  call: [
    '跟了', '我跟', '看看再说', '不急', '慢慢来',
    '跟一个', '还行吧', '继续', '跟着', '没问题',
    '可以', '行吧', '跟上', '我也跟', '不多不少',
    '刚刚好', '稳扎稳打', '先跟着看看', '不着急', '慢慢玩'
  ],
  raise: [
    '加点！', '来真的了', '敢不敢跟？', '加注！', '不服来战',
    '小意思', '再加点', '有胆就跟', '加！', '来劲了',
    '上强度', '玩大的', '加码！', '谁怕谁', '继续加',
    '不够刺激', '再来！', '加满！', '豁出去了', '梭哈精神',
    '就是要加', '怕了吗？', '来点刺激的', '加注见真章', '真金白银'
  ],
  fold: [
    '算了算了', '这把不玩了', '下把再来', '溜了溜了', '不跟了',
    '你们玩', '弃了', '等下一把', '告辞', '我先撤',
    '不陪了', '下次再战', '认输', '这把没戏', '收手了',
    '见好就收', '战略撤退', '保存实力', '留得青山在', '下把翻盘'
  ],
  peek: [
    '看看牌', '让我瞧瞧', '看一眼', '偷偷看下',
    '看看什么牌', '揭晓答案', '终于忍不住了', '看看运气如何'
  ],
  showdown: [
    '开！', '来比比！', '亮牌吧！', '不信你比我大', '开牌定胜负！',
    '摊牌了！', '见真章！', '比比看！', '一决高下！', '揭晓时刻！',
    '来吧，开牌！', '不装了，开！', '是骡子是马，拉出来溜溜'
  ],
  strongButHumble: [
    '唉，牌不太好', '随便跟跟', '凑合吧', '一般般', '不太行啊',
    '算了，跟一个', '牌不咋地', '将就着玩', '没什么好牌', '运气不好',
    '今天手气差', '随便玩玩', '无所谓了', '混混看吧', '不抱希望',
    '听天由命', '随缘吧', '差不多得了', '意思意思', '玩玩而已'
  ],
  responseToAggressive: [
    '别吓我', '你在诈我？', '我不信', '真有那么大？', '虚张声势吧',
    '我看你在诈', '少来这套', '吓唬谁呢', '我不怕', '来就来',
    '谁怕谁啊', '有本事开牌', '别装了', '我看穿你了', '诈我？没门',
    '你诈不到我', '演技不行啊', '太假了', '我就不信', '放马过来'
  ],
  // 个性化消息池
  aggressive_raise: [
    '怕了吗？', '来啊！', '不服就跟！', '加到你怕！', '敢不敢跟？',
    '我就是要加！', '有种别跑！', '来真的！', '上强度！', '玩大的！'
  ],
  conservative_call: [
    '稳一手', '不急', '看看情况', '先跟着', '稳扎稳打',
    '慢慢来', '不冒险', '谨慎点好', '观察一下', '再看看'
  ],
  tricky_bluff: [
    '嘿嘿', '你猜？', '信不信由你', '猜猜我什么牌', '有意思',
    '你看不透我', '真真假假', '虚虚实实', '猜不到吧', '哈哈'
  ],
  tilt_response: [
    '别急别急', '冷静点', '上头了？', '稳住', '别冲动',
    '慢慢来', '急什么', '淡定', '别着急输', '冷静'
  ]
}


/**
 * 生成 AI 聊天消息
 * @param {Object} player - AI 玩家对象
 * @param {string} action - 操作类型
 * @param {Object} context - 上下文信息
 * @returns {Object|null} 消息对象或 null
 */
export function generateAIMessage(player, action, context = {}) {
  if (!player || player.type !== 'ai') return null

  // 根据个性调整发消息概率
  const { personality } = context
  let messageChance = 0.5
  if (personality) {
    // 激进型和诡诈型更爱说话
    if (personality.name === '激进型' || personality.name === '诡诈型') {
      messageChance = 0.65
    }
    // 保守型话少
    else if (personality.name === '保守型') {
      messageChance = 0.35
    }
  }
  
  if (Math.random() > messageChance) return null

  const messages = getMessagePool(action, context)
  if (!messages || messages.length === 0) return null

  const message = messages[Math.floor(Math.random() * messages.length)]
  return { seatIndex: player.id, playerName: player.name, message }
}

/**
 * 获取消息池
 * @param {string} action - 操作类型
 * @param {Object} context - 上下文
 * @returns {string[]|null} 消息数组
 */
function getMessagePool(action, context) {
  const { hasStrongHand, opponentAggressive, personality, opponentTilting, isBluffing } = context

  // 根据个性选择消息池
  if (personality) {
    // 激进型加注时用激进消息
    if (personality.name === '激进型' && action === 'raise') {
      if (Math.random() < 0.6) return MESSAGE_POOLS.aggressive_raise
    }
    
    // 保守型跟注时用保守消息
    if (personality.name === '保守型' && action === 'call') {
      if (Math.random() < 0.5) return MESSAGE_POOLS.conservative_call
    }
    
    // 诡诈型诈唬时用诡诈消息
    if (personality.name === '诡诈型' && isBluffing) {
      if (Math.random() < 0.5) return MESSAGE_POOLS.tricky_bluff
    }
  }
  
  // 对手上头时嘲讽
  if (opponentTilting && Math.random() < 0.4) {
    return MESSAGE_POOLS.tilt_response
  }

  // 根据上下文选择消息池
  if (action === 'blind' || action === 'call' || action === 'raise') {
    // 已看牌且有大牌，用迷惑性消息
    if (hasStrongHand && Math.random() > 0.5) {
      return MESSAGE_POOLS.strongButHumble
    }
    // 对手激进时
    if (opponentAggressive && Math.random() > 0.6) {
      return MESSAGE_POOLS.responseToAggressive
    }
  }

  return MESSAGE_POOLS[action] || null
}
