// ===== ORDERS.JS =====

const STATUS_TIMELINE = [
  { status: 'Đang chuẩn bị', delay: 0 },
  { status: 'Đang giao',     delay: 10 * 60 * 1000 },
  { status: 'Đã giao',       delay: 24 * 60 * 60 * 1000 },
]

const STATUS_CONFIG = {
  'Đang chuẩn bị': { class: 'status-preparing', icon: '📦', step: 0 },
  'Đang giao':     { class: 'status-shipping',  icon: '🚚', step: 1 },
  'Đã giao':       { class: 'status-delivered', icon: '✅', step: 2 },
  'Đã hủy':        { class: 'status-cancelled', icon: '❌', step: -1 },
}

// ── Gửi email ─────────────────────────────────────────────
async function sendEmail(to, subject, body) {
  try {
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: to, subject, body })
    })
  } catch (err) {
    console.error('Lỗi gửi email:', err)
  }
}

// ── Footer dùng chung ─────────────────────────────────────
const EMAIL_FOOTER = `
  <div style="background:#f9fafb;padding:24px 40px;text-align:center;border-radius:0 0 12px 12px;border-top:1px solid #e8e3dd">
    <p style="color:#374151;font-size:13px;font-weight:600;margin:0 0 8px">DURI Smart Baby Care</p>
    <p style="color:#9ca3af;font-size:12px;margin:4px 0">
      Website: <a href="https://present-landing-page.vercel.app/" style="color:#1d4ed8;text-decoration:none">present-landing-page.vercel.app</a>
    </p>
    <p style="color:#9ca3af;font-size:12px;margin:4px 0">
      Email: <a href="mailto:durimall.vn@gmail.com" style="color:#1d4ed8;text-decoration:none">durimall.vn@gmail.com</a>
    </p>
    <p style="color:#9ca3af;font-size:12px;margin:10px 0 0">&copy; 2025 DURI Vietnam &ndash; Smart Baby Care Solutions from Korea</p>
  </div>`

// ── Template email cập nhật trạng thái ───────────────────
function emailStatusTemplate(order, newStatus) {
  const statusInfo = {
    'Đang giao': {
      color: '#0284c7',
      bg: '#e0f2fe',
      title: 'Đơn hàng đang được giao!',
      message: 'Đơn hàng của bạn đã được bàn giao cho đơn vị vận chuyển và đang trên đường đến tay bạn.',
      note: 'Thời gian dự kiến: 1-3 ngày làm việc tùy khu vực.'
    },
    'Đã giao': {
      color: '#16a34a',
      bg: '#dcfce7',
      title: 'Đã giao hàng thành công!',
      message: 'Đơn hàng của bạn đã được giao thành công. Cảm ơn bạn đã tin tưởng DURI!',
      note: 'Nếu có bất kỳ vấn đề gì, vui lòng liên hệ: durimall.vn@gmail.com'
    }
  }

  const info = statusInfo[newStatus]
  if (!info) return null

  return `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:580px;margin:0 auto;background:#ffffff">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1f2937,#111827);padding:32px 40px;text-align:center;border-radius:12px 12px 0 0">
      <h1 style="color:#ffffff;font-size:28px;margin:0;letter-spacing:4px">DURI</h1>
      <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:13px">Smart Baby Care from Korea</p>
    </div>

    <div style="padding:32px 40px">
      <div style="text-align:center;margin-bottom:28px">
        <h2 style="color:#111827;font-size:22px;margin:0 0 8px">${info.title}</h2>
        <p style="color:#6b7280;font-size:14px;margin:0">Xin chào <strong>${order.customer_name}</strong></p>
      </div>

      <!-- Order code -->
      <div style="background:#F5F1ED;border-radius:10px;padding:16px;text-align:center;margin-bottom:24px">
        <p style="color:#9ca3af;font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px">Mã đơn hàng</p>
        <p style="color:#111827;font-size:22px;font-weight:700;margin:0;letter-spacing:2px">#${order.order_code}</p>
      </div>

      <!-- Status message -->
      <div style="background:${info.bg};border-radius:10px;padding:16px;margin-bottom:24px">
        <p style="color:${info.color};font-size:14px;margin:0;line-height:1.7">
          ${info.message}<br/>
          <span style="font-size:13px;opacity:0.8">${info.note}</span>
        </p>
      </div>

      <!-- Shipping info -->
      <div style="background:#f9fafb;border-radius:10px;padding:16px">
        <h3 style="color:#111827;font-size:13px;margin:0 0 10px;text-transform:uppercase;letter-spacing:1px">Thông tin giao hàng</h3>
        <p style="color:#374151;font-size:14px;margin:4px 0">Họ tên: ${order.customer_name}</p>
        <p style="color:#374151;font-size:14px;margin:4px 0">Điện thoại: ${order.customer_phone || ''}</p>
        <p style="color:#374151;font-size:14px;margin:4px 0">Địa chỉ: ${order.shipping_address}</p>
      </div>
    </div>

    ${EMAIL_FOOTER}

  </div>`
}

// ── Tra cứu đơn hàng ──────────────────────────────────────
async function searchOrder() {
  const input  = document.getElementById('search-code')
  const result = document.getElementById('order-result')
  const code   = input?.value?.trim().toUpperCase().replace(/^#/, '')

  if (!code) { showToast('Vui lòng nhập mã đơn hàng', 'error'); return }

  result.innerHTML = `<div class="loading-spinner"><div class="spinner"></div></div>`

  try {
    const { data: order, error } = await db
      .from('orders')
      .select(`*, order_items(*)`)
      .ilike('order_code', code)
      .single()

    if (error || !order) {
      result.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <h3>Không tìm thấy đơn hàng</h3>
          <p>Vui lòng kiểm tra lại mã đơn hàng.</p>
        </div>`
      return
    }

    const updatedOrder = await autoUpdateStatus(order)
    result.innerHTML = renderOrderCard(updatedOrder)

  } catch (err) {
    console.error(err)
    result.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3>Có lỗi xảy ra</h3>
        <p>Vui lòng thử lại.</p>
      </div>`
  }
}

// ── Render order card ─────────────────────────────────────
function renderOrderCard(order) {
  const cfg         = STATUS_CONFIG[order.status] || STATUS_CONFIG['Đang chuẩn bị']
  const currentStep = cfg.step
  const steps = [
    { label: 'Chuẩn bị',  icon: '📦' },
    { label: 'Đang giao', icon: '🚚' },
    { label: 'Đã giao',   icon: '✅' },
  ]

  const timelineHTML = steps.map((step, i) => {
    const isDone   = i < currentStep
    const isActive = i === currentStep
    return `
      <div class="timeline-step">
        <div class="timeline-dot ${isDone ? 'done' : isActive ? 'active' : ''}">
          ${isDone ? '✓' : step.icon}
        </div>
        <div class="timeline-label ${isDone ? 'done' : isActive ? 'active' : ''}">${step.label}</div>
      </div>
      ${i < steps.length - 1 ? `<div class="timeline-line ${i < currentStep ? 'done' : ''}"></div>` : ''}
    `
  }).join('')

  const itemsHTML = (order.order_items || []).map(item => `
    <div class="order-item-row">
      <span>${item.product_name} x ${item.quantity}</span>
      <span>${formatPrice(item.unit_price * item.quantity)}</span>
    </div>
  `).join('')

  return `
    <div class="order-card">
      <div class="order-card-header">
        <div>
          <div class="order-code">#${order.order_code}</div>
          <div class="order-date">${new Date(order.created_at).toLocaleString('vi-VN')}</div>
        </div>
        <div class="order-status ${cfg.class}">${cfg.icon} ${order.status}</div>
      </div>

      ${order.status !== 'Đã hủy' ? `<div class="order-timeline">${timelineHTML}</div>` : ''}

      <div class="order-items-list">
        ${itemsHTML}
        <div class="order-total-row">
          <span>Tổng cộng</span>
          <span>${formatPrice(order.total_price)}</span>
        </div>
      </div>

      <div style="margin-top:12px;font-size:0.82rem;color:#6b7280;line-height:1.8">
        ${order.customer_name} &nbsp;|&nbsp;
        ${order.customer_phone || ''} &nbsp;|&nbsp;
        ${order.customer_email}<br/>
        ${order.shipping_address}
        ${order.note ? `<br/>Ghi chú: ${order.note}` : ''}
      </div>
    </div>
  `
}

// ── Tự động cập nhật trạng thái + gửi email ──────────────
async function autoUpdateStatus(order) {
  if (order.status === 'Đã giao' || order.status === 'Đã hủy') return order

  const elapsed    = Date.now() - new Date(order.created_at).getTime()
  let targetStatus = order.status
  const prevStatus = order.status

  for (const s of STATUS_TIMELINE) {
    if (elapsed >= s.delay) targetStatus = s.status
  }

  if (targetStatus !== prevStatus) {
    const { error } = await db
      .from('orders')
      .update({ status: targetStatus })
      .eq('id', order.id)

    if (!error) {
      order.status = targetStatus

      const emailBody = emailStatusTemplate(order, targetStatus)
      if (emailBody) {
        const subjects = {
          'Đang giao': 'DURI - Đơn hàng #' + order.order_code + ' đang được giao',
          'Đã giao':   'DURI - Đơn hàng #' + order.order_code + ' đã giao thành công'
        }
        await sendEmail(order.customer_email, subjects[targetStatus], emailBody)
      }
    }
  }

  return order
}

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search)

  if (params.get('success') === '1') {
    const code   = params.get('code')
    const banner = document.getElementById('success-banner')
    const msg    = document.getElementById('success-msg')
    if (banner) banner.style.display = 'block'
    if (msg && code) msg.textContent = `Mã đơn hàng của bạn: ${code}`

    const searchInput = document.getElementById('search-code')
    if (searchInput && code) {
      searchInput.value = code
      searchOrder()
    }

    window.history.replaceState({}, '', 'orders.html')
  }
})