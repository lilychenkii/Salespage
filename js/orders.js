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
      await enrichOrderItemsWithImages(updatedOrder)
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

  async function enrichOrderItemsWithImages(order) {
    const items = Array.isArray(order?.order_items) ? order.order_items : []
    if (!items.length) return

    const productIds = [...new Set(
      items
        .map(item => item.product_id)
        .filter(Boolean)
    )]

    if (!productIds.length) return

    try {
      const { data: products, error } = await db
        .from('products')
        .select('id, image_url')
        .in('id', productIds)

      if (error) throw error

      const productMap = new Map((products || []).map(p => [p.id, p]))
      items.forEach(item => {
        const product = productMap.get(item.product_id)
        item.image_url = resolveProductImage(item.product_id, product?.image_url || '')
      })
    } catch (err) {
      console.warn('Không thể tải ảnh sản phẩm cho đơn hàng:', err)
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

    const itemsHTML = (order.order_items || []).map(item => {
      const imageUrl = item.image_url || 'https://placehold.co/80x80/F5F1ED/333333?text=DURI'
      return `
      <div class="order-item-row" style="display:flex;justify-content:space-between;gap:10px;align-items:center">
        <div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1">
          <img
            src="${imageUrl}"
            alt="${item.product_name || 'Sản phẩm'}"
            style="width:48px;height:48px;border-radius:8px;object-fit:cover;border:1px solid #e8e3dd;flex-shrink:0"
            onerror="this.src='https://placehold.co/80x80/F5F1ED/333333?text=DURI'"
          />
          <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.product_name} x ${item.quantity}</span>
        </div>
        <span style="font-weight:700;white-space:nowrap">${formatPrice(item.unit_price * item.quantity)}</span>
      </div>
    `}).join('')

  // Form feedback — chỉ hiện khi đơn "Đã giao"
  const feedbackHTML = order.status === 'Đã giao'
    ? renderFeedbackForm(order)
    : ''

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

      <div style="margin-top:12px;display:flex;justify-content:flex-end">
        <a href="order-details.html?code=${encodeURIComponent(order.order_code)}" class="btn btn-outline btn-sm">
          🧾 Xem chi tiết đơn hàng
        </a>
      </div>

      <div style="margin-top:12px;font-size:0.82rem;color:#6b7280;line-height:1.8">
        ${order.customer_name} &nbsp;|&nbsp;
        ${order.customer_phone || ''} &nbsp;|&nbsp;
        ${order.customer_email}<br/>
        ${order.shipping_address}
        ${order.note ? `<br/>Ghi chú: ${order.note}` : ''}
      </div>

      ${feedbackHTML}
    </div>
  `
}

// ── Tự động cập nhật trạng thái (email do webhook xử lý) ──
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

// ── Render form feedback ──────────────────────────────────
function renderFeedbackForm(order) {
  return `
    <div id="feedback-section" style="margin-top:24px;border-top:1px solid #e8e3dd;padding-top:20px">
      <div id="feedback-done" style="display:none;background:#dcfce7;border-radius:12px;padding:18px;text-align:center">
        <div style="font-size:1.5rem">🎉</div>
        <p style="color:#15803d;font-weight:600;margin:8px 0 4px">Cảm ơn bạn đã đánh giá!</p>
        <p style="color:#166534;font-size:0.85rem;margin:0">Phản hồi của bạn giúp DURI cải thiện dịch vụ tốt hơn.</p>
      </div>

      <div id="feedback-form">
        <h3 style="font-size:0.95rem;font-weight:700;color:#111827;margin:0 0 16px">
          ⭐ Đánh giá đơn hàng của bạn
        </h3>

        <!-- Đánh giá chung -->
        <div style="margin-bottom:16px">
          <p style="font-size:0.85rem;color:#374151;margin:0 0 8px;font-weight:600">Mức độ hài lòng chung</p>
          <div class="star-group" id="star-rating" data-field="rating">
            ${[1,2,3,4,5].map(n => `
              <span class="star" data-val="${n}" onclick="selectStar('rating',${n})"
                style="font-size:1.6rem;cursor:pointer;color:#d1d5db;transition:color 0.15s">★</span>
            `).join('')}
          </div>
        </div>

        <!-- Giao hàng -->
        <div style="margin-bottom:16px">
          <p style="font-size:0.85rem;color:#374151;margin:0 0 8px;font-weight:600">Trải nghiệm giao hàng</p>
          <div class="star-group" id="star-delivery" data-field="delivery_satisfaction">
            ${[1,2,3,4,5].map(n => `
              <span class="star" data-val="${n}" onclick="selectStar('delivery_satisfaction',${n})"
                style="font-size:1.6rem;cursor:pointer;color:#d1d5db;transition:color 0.15s">★</span>
            `).join('')}
          </div>
        </div>

        <!-- Sản phẩm -->
        <div style="margin-bottom:16px">
          <p style="font-size:0.85rem;color:#374151;margin:0 0 8px;font-weight:600">Chất lượng sản phẩm</p>
          <div class="star-group" id="star-product" data-field="product_satisfaction">
            ${[1,2,3,4,5].map(n => `
              <span class="star" data-val="${n}" onclick="selectStar('product_satisfaction',${n})"
                style="font-size:1.6rem;cursor:pointer;color:#d1d5db;transition:color 0.15s">★</span>
            `).join('')}
          </div>
        </div>

        <!-- Nhận xét -->
        <div style="margin-bottom:16px">
          <p style="font-size:0.85rem;color:#374151;margin:0 0 8px;font-weight:600">Nhận xét thêm (không bắt buộc)</p>
          <textarea id="fb-comment" rows="3" placeholder="Chia sẻ cảm nhận của bạn về sản phẩm và dịch vụ..."
            style="width:100%;box-sizing:border-box;border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;font-size:0.85rem;resize:vertical;font-family:inherit;outline:none"></textarea>
        </div>

        <!-- Giới thiệu -->
        <div style="margin-bottom:20px;display:flex;align-items:center;gap:10px">
          <input type="checkbox" id="fb-recommend" style="width:16px;height:16px;cursor:pointer" />
          <label for="fb-recommend" style="font-size:0.85rem;color:#374151;cursor:pointer">
            Tôi sẽ giới thiệu DURI cho bạn bè / người thân
          </label>
        </div>

        <button onclick="submitFeedback('${order.id}','${order.order_code}','${order.customer_email}','${order.customer_name}')"
          style="width:100%;padding:12px;background:#111827;color:#fff;border:none;border-radius:10px;font-size:0.9rem;font-weight:600;cursor:pointer;transition:opacity 0.2s"
          onmouseover="this.style.opacity=0.85" onmouseout="this.style.opacity=1">
          Gửi đánh giá
        </button>
      </div>
    </div>
  `
}

// ── State lưu điểm sao ────────────────────────────────────
const _fbScores = { rating: 0, delivery_satisfaction: 0, product_satisfaction: 0 }

function selectStar(field, val) {
  _fbScores[field] = val
  const fieldToId = {
    rating: 'star-rating',
    delivery_satisfaction: 'star-delivery',
    product_satisfaction: 'star-product'
  }
  const container = document.getElementById(fieldToId[field])
  if (!container) return
  container.querySelectorAll('.star').forEach(star => {
    star.style.color = parseInt(star.dataset.val) <= val ? '#f59e0b' : '#d1d5db'
  })
}

async function submitFeedback(orderId, orderCode, customerEmail, customerName) {
  if (_fbScores.rating === 0) {
    showToast('Vui lòng chọn mức độ hài lòng chung', 'error'); return
  }

  const comment   = document.getElementById('fb-comment')?.value?.trim() || null
  const recommend = document.getElementById('fb-recommend')?.checked || false

  try {
    const { error } = await db.from('feedback').insert({
      order_id:              orderId,
      order_code:            orderCode,
      customer_email:        customerEmail,
      customer_name:         customerName,
      rating:                _fbScores.rating,
      delivery_satisfaction: _fbScores.delivery_satisfaction || null,
      product_satisfaction:  _fbScores.product_satisfaction || null,
      comment:               comment,
      would_recommend:       recommend
    })

    if (error) throw error

    document.getElementById('feedback-form').style.display = 'none'
    document.getElementById('feedback-done').style.display = 'block'
    showToast('Đã gửi đánh giá, cảm ơn bạn!', 'success')

  } catch (err) {
    console.error('Lỗi gửi feedback:', err)
    showToast('Có lỗi xảy ra, vui lòng thử lại', 'error')
  }
}