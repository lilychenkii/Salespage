// ===== CHATBOT.JS =====
// AI Agent dùng Groq API với tool use để tra cứu đơn hàng

const GROQ_API_KEY = (window.GROQ_API_KEY || localStorage.getItem('GROQ_API_KEY') || '').trim()
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
          const user = await getCurrentUser()
          if (user) {
            query = query
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(3)
          } else {
            return 'Vui lòng cung cấp mã đơn hàng hoặc email để tra cứu.'
          }
        }

        const { data: orders, error } = await query
        if (error || !orders || orders.length === 0) {
          return 'Không tìm thấy đơn hàng. Vui lòng kiểm tra lại mã đơn hoặc email.'
        }

        return orders.map(o => {
          const items = (o.order_items || [])
            .map(i => `${i.product_name} x${i.quantity}`)
            .join(', ')
          const date = new Date(o.created_at).toLocaleString('vi-VN')
          return `Mã đơn: #${o.order_code} | Trạng thái: ${o.status} | Sản phẩm: ${items} | Tổng: ${o.total_price?.toLocaleString('vi-VN')}đ | Địa chỉ: ${o.shipping_address} | Đặt lúc: ${date}`
        }).join('\n---\n')

      } catch (err) {
        return 'Có lỗi khi tra cứu đơn hàng.'
      }
    }

    case 'get_product_info': {
      try {
        const { data: products } = await db
          .from('products')
          .select('*')
          .ilike('name', `%${args.product_name}%`)

        if (!products || products.length === 0) {
          const { data: all } = await db.from('products').select('*')
          if (all && all.length > 0) {
            return 'Sản phẩm DURI hiện có:\n' + all.map(p =>
              `• ${p.name} — Giá: ${p.price?.toLocaleString('vi-VN')}đ | Còn: ${p.stock} sp | ${p.description}`
            ).join('\n')
          }
          return 'Không tìm thấy sản phẩm phù hợp.'
        }

        return products.map(p =>
          `• ${p.name} — Giá: ${p.price?.toLocaleString('vi-VN')}đ | Còn: ${p.stock} sp | ${p.description}`
        ).join('\n')

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

Luôn trả lời bằng tiếng Việt, ngắn gọn, thân thiện. Xưng "mình".`

let conversationHistory = []

async function callGroq(messages) {
  if (!GROQ_API_KEY) {
    return {
      choices: [
        {
          message: {
            content: 'Chatbot AI đang tạm thời chưa được cấu hình API key. Mình vẫn có thể hỗ trợ bạn tra cứu đơn hàng ở trang Tra cứu đơn hàng nhé.'
          }
        }
      ]
    }
  }

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
      ],
      tools: TOOLS,
      tool_choice: 'auto',
      max_tokens: 1024,
      temperature: 0.7
    })
  })

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
    const data = await callGroq(conversationHistory)
    removeTyping(typingId)
    const reply = await processGroqResponse(data)
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
  div.innerHTML = text.replace(/\n/g, '<br/>')
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