// ===== CHATBOT.JS =====
// AI Agent dùng Groq API với tool use để tra cứu đơn hàng

const GROQ_API_KEY = (window.GROQ_API_KEY || localStorage.getItem('GROQ_API_KEY') || '').trim()
const GROQ_PROXY_URL = '/api/chat'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

// ── Tool definitions ──────────────────────────────────────
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_order_status',
      description: 'Tra cứu trạng thái đơn hàng theo mã đơn hoặc email. Dùng khi khách hỏi về đơn hàng, trạng thái giao hàng.',
      parameters: {
        type: 'object',
        properties: {
          order_code: {
            type: 'string',
            description: 'Mã đơn hàng, ví dụ: DURI12345678'
          },
          email: {
            type: 'string',
            description: 'Email khách hàng để tìm tất cả đơn'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_product_info',
      description: 'Lấy thông tin sản phẩm DURI: giá, mô tả, tồn kho. Dùng khi khách hỏi về sản phẩm, giá cả.',
      parameters: {
        type: 'object',
        properties: {
          product_name: {
            type: 'string',
            description: 'Tên hoặc từ khóa sản phẩm'
          }
        },
        required: ['product_name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_shipping_info',
      description: 'Thông tin vận chuyển: thời gian giao, phí ship. Dùng khi khách hỏi giao hàng bao lâu.',
      parameters: {
        type: 'object',
        properties: {
          province: {
            type: 'string',
            description: 'Tỉnh/thành phố của khách'
          }
        }
      }
    }
  }
]

// ── Tool execution ────────────────────────────────────────
async function executeTool(toolName, args) {
  switch (toolName) {

    case 'get_order_status': {
      try {
        let query = db.from('orders').select(`*, order_items(*)`)

        if (args.order_code) {
          const code = args.order_code.replace(/DURI/i, '').trim()
          query = query.ilike('order_code', `%${code}%`)
        } else if (args.email) {
          query = query.eq('customer_email', args.email.toLowerCase().trim())
        } else {
          return 'Bạn vui lòng gửi mã đơn (ví dụ: DURI12345678) hoặc email đặt hàng để mình tra cứu nhé.'
        }

        const { data: orders, error } = await query
        if (error || !orders || orders.length === 0) {
          return 'Không tìm thấy đơn hàng. Vui lòng kiểm tra lại mã đơn hoặc email.'
        }

        return orders.map(o => {
          const date = new Date(o.created_at).toLocaleString('vi-VN')
          const statusConfig = {
            'Đang chuẩn bị': '📦',
            'Đang giao': '🚚',
            'Đã giao': '✅',
            'Đã hủy': '❌',
            'Đặt hàng': '📋'
          }
          const statusIcon = statusConfig[o.status] || '📋'
          const itemsList = (o.order_items || [])
            .map(i => `• ${i.product_name} ×${i.quantity}`)
            .join('\n')

          return [
            `Chào ${o.customer_name || 'bạn'}, mình đã tra được đơn của bạn.`,
            `Mã đơn: #${o.order_code}`,
            `Trạng thái: ${statusIcon} ${o.status}`,
            `Ngày đặt: ${date}`,
            `Tổng tiền: ${(o.total_price || 0).toLocaleString('vi-VN')}đ`,
            `Sản phẩm:\n${itemsList}`
          ].join('\n')
        }).join('\n\n---\n\n')

      } catch (err) {
        console.error('Order tool error:', err)
        return 'Có lỗi khi tra cứu đơn hàng.'
      }
    }

    case 'get_product_info': {
      try {
        let query = db.from('products').select('*')

        if (args.category) {
          query = query.eq('category', args.category)
        } else {
          query = query.ilike('name', `%${args.product_name}%`)
        }

        const { data: products } = await query

        if (!products || products.length === 0) {
          const { data: all } = await db.from('products').select('*')
          if (all && all.length > 0) {
            return 'Mình chưa tìm thấy đúng nhóm bạn hỏi, nhưng DURI hiện có các sản phẩm sau:\n\n' + all.map(p =>
              `• ${p.name} — ${p.price?.toLocaleString('vi-VN')}đ — còn ${p.stock} sp`
            ).join('\n')
          }
          return 'Không tìm thấy sản phẩm phù hợp.'
        }

        const intro = args.category
          ? `Mình gợi ý nhóm ${args.category.toLowerCase()} phù hợp cho bé như sau:`
          : 'Mình gợi ý một số sản phẩm phù hợp:'

        return `${intro}\n\n${products.map(p =>
          `• ${p.name} — ${p.price?.toLocaleString('vi-VN')}đ — còn ${p.stock} sp`
        ).join('\n')}`

      } catch {
        return 'Có lỗi khi tìm sản phẩm.'
      }
    }

    case 'get_shipping_info': {
      const prov = (args.province || '').toLowerCase()
      let time = '2-3 ngày làm việc'
      if (prov.includes('hồ chí minh') || prov.includes('hcm') || prov.includes('sài gòn')) {
        time = '1-2 ngày (nội thành có thể nhận trong ngày)'
      } else if (prov.includes('hà nội')) {
        time = '1-2 ngày làm việc'
      }
      return `Vận chuyển:\n• Thời gian: ${time}\n• Phí ship: 30.000đ (miễn phí đơn trên 500.000đ)\n• Đơn vị: GHN, GHTK\n• Theo dõi đơn hàng real-time qua trang Đơn hàng`
    }

    default:
      return 'Tool không hợp lệ.'
  }
}

// ── Gọi Groq API ──────────────────────────────────────────
const SYSTEM_PROMPT = `Bạn là DURI Assistant — trợ lý AI của cửa hàng DURI, chuyên sản phẩm chăm sóc trẻ em từ Hàn Quốc.

Nhiệm vụ:
1. Tra cứu đơn hàng khi khách hỏi → dùng tool get_order_status
2. Thông tin sản phẩm/giá → dùng tool get_product_info  
3. Thời gian giao hàng → dùng tool get_shipping_info
4. Các câu hỏi khác → trả lời trực tiếp

Luôn trả lời bằng tiếng Việt, ngắn gọn, thân thiện. Xưng "mình".
Khi tra cứu đơn hàng, hãy mở đầu bằng lời chào theo tên khách nếu có.
Khi trả lời về sản phẩm, bám sát đúng nhu cầu trong câu hỏi, không liệt kê quá nhiều thứ không liên quan.
Ưu tiên trả lời theo từng dòng ngắn, dễ đọc.`

let conversationHistory = []

function findRecentOrderCodeFromHistory() {
  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    const msg = conversationHistory[i]
    const content = typeof msg?.content === 'string' ? msg.content : ''
    const found = parseOrderCode(content)
    if (found) return found
  }
  return ''
}

function parseOrderCode(text = '') {
  const match = text.match(/DURI\s*\d{6,}/i)
  return match ? match[0].replace(/\s+/g, '') : ''
}

function parseEmail(text = '') {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return match ? match[0] : ''
}

function parseProvince(text = '') {
  const known = [
    'hà nội', 'hồ chí minh', 'tp hcm', 'sài gòn', 'đà nẵng', 'cần thơ',
    'hải phòng', 'đồng nai', 'bình dương', 'quảng ninh', 'nghệ an', 'huế'
  ]
  const lower = text.toLowerCase()
  const found = known.find(p => lower.includes(p))
  return found || ''
}

async function localAssistantReply(userText = '') {
  const text = userText.toLowerCase()
  const orderKeywords = /(đơn hàng|mã đơn|trạng thái|đang ở đâu|kiểm tra đơn)/
  const shippingKeywords = /(ship|giao hàng|vận chuyển|bao lâu|mấy ngày)/
  const productKeywords = /(sản phẩm|giá|bao nhiêu|còn hàng|danh mục|mua gì)/

  const categoryMap = [
    { keywords: /(ăn|bé ăn|cho bé ăn|ăn dặm|bú|sữa|bình sữa)/, category: 'Cho bé ăn', prompt: 'Mình gợi ý nhóm đồ cho bé ăn, bạn có thể quan tâm: bình sữa, núm ti, đồ ăn dặm.' },
    { keywords: /(vệ sinh|đi vệ sinh|bỉm|tã|nước rửa|lau chùi)/, category: 'Đi vệ sinh', prompt: 'Mình gợi ý nhóm đồ đi vệ sinh, bạn có thể xem: bệ ngồi toilet, giấy ướt, phụ kiện vệ sinh.' },
    { keywords: /(tắm|phòng tắm|tắm gội|rửa mặt)/, category: 'Phòng tắm', prompt: 'Mình gợi ý nhóm đồ phòng tắm, thường phù hợp là vòi rửa, phụ kiện tắm và vệ sinh.' },
    { keywords: /(sinh hoạt|ngủ|đồ dùng|đồ chơi|gia đình)/, category: 'Sinh hoạt', prompt: 'Mình gợi ý nhóm đồ sinh hoạt, phù hợp cho nhu cầu dùng hằng ngày của bé.' },
  ]

  const matchedCategory = categoryMap.find(item => item.keywords.test(text))

  if (orderKeywords.test(text)) {
    const orderCode = parseOrderCode(userText) || findRecentOrderCodeFromHistory()
    const email = parseEmail(userText)

    if (!orderCode && !email) {
      return 'Bạn vui lòng gửi mã đơn (ví dụ: DURI12345678) hoặc email đặt hàng để mình tra cứu chính xác nhé.'
    }

    return executeTool('get_order_status', {
      order_code: orderCode || undefined,
      email: email || undefined
    })
  }

  if (shippingKeywords.test(text)) {
    return executeTool('get_shipping_info', { province: parseProvince(userText) || undefined })
  }

  if (productKeywords.test(text)) {
    if (matchedCategory) {
      return executeTool('get_product_info', {
        category: matchedCategory.category,
        product_name: matchedCategory.category
      })
    }

    const cleaned = userText
      .replace(/(sản phẩm|giá|bao nhiêu|còn hàng|danh mục|mua gì|cho mình|giúp mình)/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (!cleaned || cleaned.length < 3 || /(tư vấn|sản phẩm|bé|trẻ em)/i.test(cleaned)) {
      return 'Mình có thể tư vấn theo nhu cầu của bé. Bạn đang quan tâm nhóm nào hơn: ăn, vệ sinh, tắm hay sinh hoạt?'
    }

    return executeTool('get_product_info', {
      product_name: cleaned || 'DURI'
    })
  }

  if (matchedCategory) {
    return executeTool('get_product_info', {
      category: matchedCategory.category,
      product_name: matchedCategory.category
    })
  }

  return 'Mình có thể hỗ trợ bạn 3 việc nhanh:\n• Tra cứu đơn hàng (gửi mã DURI... hoặc email)\n• Tìm sản phẩm và giá\n• Thông tin vận chuyển\n\nBạn muốn mình hỗ trợ mục nào?'
}

async function callGroq(messages) {
  const payload = {
    model: GROQ_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages
    ],
    tools: TOOLS,
    tool_choice: 'auto',
    max_tokens: 1024,
    temperature: 0.7
  }

  let res = null

  // Ưu tiên proxy server để giữ API key ở backend (an toàn cho production).
  try {
    res = await fetch(GROQ_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  } catch {
    res = null
  }

  // Fallback local key cho môi trường dev nếu có cấu hình thủ công.
  if ((!res || !res.ok) && GROQ_API_KEY) {
    res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify(payload)
    })
  }

  if (!res || !res.ok) {
    const errText = res ? await res.text() : 'No response from API'
    throw new Error(`AI API unavailable: ${errText}`)
  }

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq API error ${res.status}: ${err}`)
  }
  return await res.json()
}

// ── Xử lý response + tool calls ──────────────────────────
async function processGroqResponse(data) {
  const message = data.choices?.[0]?.message
  if (!message) return 'Xin lỗi, mình không hiểu. Bạn thử hỏi lại nhé!'

  // Có tool calls
  if (message.tool_calls && message.tool_calls.length > 0) {
    // Thêm assistant message vào history
    conversationHistory.push(message)

    // Thực thi từng tool
    for (const toolCall of message.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments || '{}')
      const result = await executeTool(toolCall.function.name, args)

      conversationHistory.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result
      })
    }

    // Gọi lại Groq với kết quả tool
    const finalData = await callGroq(conversationHistory)
    const finalMsg = finalData.choices?.[0]?.message
    const reply = finalMsg?.content || 'Mình đã tra xong, bạn cần hỗ trợ thêm không?'
    conversationHistory.push({ role: 'assistant', content: reply })
    return reply
  }

  // Không có tool call
  const reply = message.content || 'Xin lỗi, mình chưa hiểu. Bạn thử hỏi lại nhé!'
  conversationHistory.push({ role: 'assistant', content: reply })
  return reply
}

// ── Chat UI ───────────────────────────────────────────────
let isOpen = false

function initChatbot() {
  const toggle   = document.getElementById('chat-toggle')
  const chatWin  = document.getElementById('chat-window')
  const closeBtn = document.getElementById('chat-close-btn')
  const sendBtn  = document.getElementById('chat-send')
  const input    = document.getElementById('chat-input')

  if (!toggle) return

  toggle.addEventListener('click', () => {
    isOpen = !isOpen
    chatWin.style.display = isOpen ? 'flex' : 'none'
    toggle.textContent = isOpen ? '✕' : '💬'
    if (isOpen && document.getElementById('chat-messages').children.length === 0) {
      sendWelcome()
    }
  })

  closeBtn?.addEventListener('click', () => {
    isOpen = false
    chatWin.style.display = 'none'
    toggle.textContent = '💬'
  })

  sendBtn?.addEventListener('click', handleSend)
  input?.addEventListener('keydown', e => { if (e.key === 'Enter') handleSend() })
}

function sendWelcome() {
  addMessage('bot', 'Xin chào! 👋 Mình là DURI Assistant.\n\nMình có thể giúp bạn:\n• 📦 Tra cứu trạng thái đơn hàng\n• 🛍️ Thông tin sản phẩm & giá\n• 🚚 Thời gian & phí vận chuyển\n\nBạn cần hỗ trợ gì ạ?')

  const messages = document.getElementById('chat-messages')
  const quickReplies = document.createElement('div')
  quickReplies.className = 'quick-replies-wrap'
  quickReplies.innerHTML = `
    <div class="quick-replies-chips">
      <button class="quick-reply-btn" onclick="sendQuickReply('Đơn hàng của tôi đang ở đâu?')">📦 Kiểm tra đơn hàng</button>
      <button class="quick-reply-btn" onclick="sendQuickReply('Sản phẩm DURI có những loại nào?')">🛍️ Xem sản phẩm</button>
      <button class="quick-reply-btn" onclick="sendQuickReply('Thời gian giao hàng bao lâu?')">🚚 Thời gian giao hàng</button>
    </div>
  `
  messages.appendChild(quickReplies)
  messages.scrollTop = messages.scrollHeight
}

function sendQuickReply(text) {
  const input = document.getElementById('chat-input')
  if (input) input.value = text
  handleSend()
}

async function handleSend() {
  const input   = document.getElementById('chat-input')
  const text    = input?.value?.trim()
  if (!text) return
  input.value = ''

  addMessage('user', text)
  const typingId = addTyping()

  // Thêm vào history
  conversationHistory.push({ role: 'user', content: text })

  // Giữ history không quá dài
  if (conversationHistory.length > 20) {
    conversationHistory = conversationHistory.slice(-20)
  }

  try {
    removeTyping(typingId)
    let reply = ''

    try {
      const data = await callGroq(conversationHistory)
      reply = await processGroqResponse(data)
    } catch {
      reply = await localAssistantReply(text)
      conversationHistory.push({ role: 'assistant', content: reply })
    }

    addMessage('bot', reply)
  } catch (err) {
    console.error('Chatbot error:', err)
    removeTyping(typingId)
    addMessage('bot', 'Xin lỗi, mình đang gặp sự cố. Bạn thử lại sau nhé! 🙏')
  }
}

function addMessage(role, text) {
  const messages = document.getElementById('chat-messages')
  const div = document.createElement('div')
  div.className = role === 'bot' ? 'msg-bot' : 'msg-user'
  
  // Nếu là HTML (bắt đầu với <), hiển thị trực tiếp; nếu là plain text thì convert \n → <br/>
  if (typeof text === 'string' && text.trim().startsWith('<')) {
    div.innerHTML = text
  } else {
    div.innerHTML = (text || '').toString().replace(/\n/g, '<br/>')
  }
  
  messages.appendChild(div)
  messages.scrollTop = messages.scrollHeight
}

function addTyping() {
  const messages = document.getElementById('chat-messages')
  const id = 'typing-' + Date.now()
  const div = document.createElement('div')
  div.className = 'msg-typing'
  div.id = id
  div.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  `
  messages.appendChild(div)
  messages.scrollTop = messages.scrollHeight
  return id
}

function removeTyping(id) {
  document.getElementById(id)?.remove()
}

document.addEventListener('DOMContentLoaded', initChatbot)