const DETAIL_STATUS_TIMELINE = [
  { status: 'Đang chuẩn bị', delay: 0 },
  { status: 'Đang giao', delay: 10 * 60 * 1000 },
  { status: 'Đã giao', delay: 24 * 60 * 60 * 1000 },
]

const DETAIL_STATUS_CONFIG = {
  'Đang chuẩn bị': { class: 'status-preparing', icon: '📦', step: 0 },
  'Đang giao': { class: 'status-shipping', icon: '🚚', step: 1 },
  'Đã giao': { class: 'status-delivered', icon: '✅', step: 2 },
  'Đã hủy': { class: 'status-cancelled', icon: '❌', step: -1 },
}

let _currentDetailOrder = null

function normalizeOrderCode(value = '') {
  return value.trim().toUpperCase().replace(/^#/, '')
}

function escapeHTML(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function searchOrderDetails() {
  const input = document.getElementById('detail-search-code')
  const code = normalizeOrderCode(input?.value || '')

  if (!code) {
    showToast('Vui lòng nhập mã đơn hàng', 'error')
    return
  }

  await loadOrderDetails(code)
}

async function loadOrderDetails(code) {
  const result = document.getElementById('order-detail-result')
  if (!result) return

  result.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>'

  try {
    const { data: order, error } = await db
      .from('orders')
      .select('*, order_items(*)')
      .ilike('order_code', code)
      .single()

    if (error || !order) {
      const fallback = getLastLocalOrder(code)
      if (!fallback) {
        result.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🔎</div>
            <h3>Không tìm thấy đơn hàng</h3>
            <p>Vui lòng kiểm tra lại mã đơn và thử lại.</p>
          </div>`
        return
      }
      _currentDetailOrder = fallback
      result.innerHTML = renderOrderDetail(fallback)
      return
    }

    const updatedOrder = await autoUpdateOrderStatus(order)
    await enrichOrderItemsWithImages(updatedOrder)

    _currentDetailOrder = updatedOrder
    result.innerHTML = renderOrderDetail(updatedOrder)
  } catch (err) {
    console.error('Lỗi tải chi tiết đơn:', err)
    result.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3>Có lỗi xảy ra</h3>
        <p>Vui lòng thử lại sau ít phút.</p>
      </div>`
  }
}

function getLastLocalOrder(code) {
  try {
    const raw = localStorage.getItem('duri_last_order')
    if (!raw) return null

    const localOrder = JSON.parse(raw)
    if (normalizeOrderCode(localOrder.order_code || '') !== normalizeOrderCode(code)) {
      return null
    }

    const items = Array.isArray(localOrder.items) ? localOrder.items : []
    return {
      order_code: localOrder.order_code,
      created_at: localOrder.created_at || new Date().toISOString(),
      customer_name: localOrder.customer_name || '',
      customer_phone: localOrder.customer_phone || '',
      customer_email: localOrder.customer_email || '',
      shipping_address: localOrder.shipping_address || '',
      note: localOrder.note || '',
      total_price: localOrder.total_price || 0,
      status: 'Đang chuẩn bị',
      order_items: items.map(item => ({
        product_name: item.name,
        quantity: item.qty,
        unit_price: item.price,
        image_url: resolveProductImage('', item.image_url || ''),
      })),
      _isLocalFallback: true,
    }
  } catch (err) {
    console.error('Lỗi đọc đơn local:', err)
    return null
  }
}

async function enrichOrderItemsWithImages(order) {
  const items = Array.isArray(order?.order_items) ? order.order_items : []
  if (!items.length) return

  const productIds = [...new Set(items.map(item => item.product_id).filter(Boolean))]
  if (!productIds.length) {
    items.forEach(item => {
      item.image_url = resolveProductImage('', item.image_url || '')
    })
    return
  }

  try {
    const { data: products, error } = await db
      .from('products')
      .select('id, image_url')
      .in('id', productIds)

    if (error) throw error

    const productMap = new Map((products || []).map(p => [p.id, p.image_url]))
    items.forEach(item => {
      item.image_url = resolveProductImage(item.product_id, productMap.get(item.product_id) || item.image_url || '')
    })
  } catch (err) {
    console.warn('Lỗi lấy ảnh sản phẩm:', err)
  }
}

async function autoUpdateOrderStatus(order) {
  if (order.status === 'Đã giao' || order.status === 'Đã hủy') return order

  const elapsed = Date.now() - new Date(order.created_at).getTime()
  let targetStatus = order.status

  for (const item of DETAIL_STATUS_TIMELINE) {
    if (elapsed >= item.delay) targetStatus = item.status
  }

  if (targetStatus !== order.status && order.id) {
    const { error } = await db
      .from('orders')
      .update({ status: targetStatus })
      .eq('id', order.id)

    if (!error) order.status = targetStatus
  }

  return order
}

function renderOrderDetail(order) {
  const cfg = DETAIL_STATUS_CONFIG[order.status] || DETAIL_STATUS_CONFIG['Đang chuẩn bị']
  const createdAt = order.created_at ? new Date(order.created_at).toLocaleString('vi-VN') : '-'
  const steps = [
    { label: 'Chuẩn bị', icon: '📦' },
    { label: 'Đang giao', icon: '🚚' },
    { label: 'Đã giao', icon: '✅' },
  ]

  const timelineHTML = steps.map((step, i) => {
    const isDone = i < cfg.step
    const isActive = i === cfg.step
    return `
      <div class="timeline-step">
        <div class="timeline-dot ${isDone ? 'done' : isActive ? 'active' : ''}">${isDone ? '✓' : step.icon}</div>
        <div class="timeline-label ${isDone ? 'done' : isActive ? 'active' : ''}">${step.label}</div>
      </div>
      ${i < steps.length - 1 ? `<div class="timeline-line ${i < cfg.step ? 'done' : ''}"></div>` : ''}
    `
  }).join('')

  const itemsHTML = (order.order_items || []).map(item => {
    const imageUrl = item.image_url || 'https://placehold.co/80x80/F5F1ED/333333?text=DURI'
    return `
      <div class="order-item-row" style="display:flex;justify-content:space-between;gap:10px;align-items:center">
        <div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1">
          <img
            src="${imageUrl}"
            alt="${escapeHTML(item.product_name || 'Sản phẩm')}"
            style="width:52px;height:52px;border-radius:10px;object-fit:cover;border:1px solid #e8e3dd;flex-shrink:0"
            onerror="this.src='https://placehold.co/80x80/F5F1ED/333333?text=DURI'"
          />
          <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(item.product_name || '')} x ${item.quantity || 0}</span>
        </div>
        <span style="font-weight:700;white-space:nowrap">${formatPrice((item.unit_price || 0) * (item.quantity || 0))}</span>
      </div>
    `
  }).join('')

  const localNote = order._isLocalFallback
    ? '<p style="font-size:0.82rem;color:#a16207;margin:12px 0 0">Đây là dữ liệu tạm từ trình duyệt. Vui lòng tra cứu lại sau vài giây nếu vừa đặt xong.</p>'
    : ''

  return `
    <div class="order-card" id="order-detail-card">
      <div class="order-card-header" style="gap:10px;flex-wrap:wrap">
        <div>
          <div class="order-code">#${escapeHTML(order.order_code || '')}</div>
          <div class="order-date">${createdAt}</div>
        </div>
        <div class="order-status ${cfg.class}">${cfg.icon} ${escapeHTML(order.status || 'Đang chuẩn bị')}</div>
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;margin:14px 0 8px">
        <button class="btn btn-dark btn-sm" onclick="copyCurrentOrderCode()">📋 Sao chép mã</button>
        <button class="btn btn-orange btn-sm" onclick="downloadInvoice()">⬇ Tải hóa đơn</button>
        <button class="btn btn-outline btn-sm" onclick="printInvoice()">🖨 In hóa đơn</button>
      </div>

      ${order.status !== 'Đã hủy' ? `<div class="order-timeline">${timelineHTML}</div>` : ''}

      <div class="order-items-list">
        ${itemsHTML}
        <div class="order-total-row">
          <span>Tổng cộng</span>
          <span>${formatPrice(order.total_price || 0)}</span>
        </div>
      </div>

      <div style="margin-top:12px;font-size:0.86rem;color:#6b7280;line-height:1.8;background:#f8fafc;border-radius:10px;padding:12px 14px">
        <strong style="color:#334155">${escapeHTML(order.customer_name || '')}</strong><br/>
        ${escapeHTML(order.customer_phone || '')} | ${escapeHTML(order.customer_email || '')}<br/>
        ${escapeHTML(order.shipping_address || '')}
        ${order.note ? `<br/>Ghi chú: ${escapeHTML(order.note)}` : ''}
      </div>

      ${localNote}
    </div>
  `
}

function copyCurrentOrderCode() {
  const code = _currentDetailOrder?.order_code
  if (!code) {
    showToast('Không có mã đơn hàng để sao chép', 'error')
    return
  }

  const copyPromise = navigator.clipboard && window.isSecureContext
    ? navigator.clipboard.writeText(code)
    : Promise.reject(new Error('Clipboard API unavailable'))

  copyPromise
    .then(() => showToast('Đã sao chép mã đơn hàng', 'success'))
    .catch(() => {
      const temp = document.createElement('input')
      temp.value = code
      document.body.appendChild(temp)
      temp.select()
      document.execCommand('copy')
      document.body.removeChild(temp)
      showToast('Đã sao chép mã đơn hàng', 'success')
    })
}

function buildInvoiceHTML(order) {
  const rows = (order.order_items || []).map(item => {
    const imageUrl = item.image_url || 'https://placehold.co/100x80/F5F1ED/333333?text=DURI'
    return `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb;vertical-align:middle">
        <img src="${imageUrl}" alt="${escapeHTML(item.product_name || '')}" style="width:80px;height:60px;object-fit:cover;border-radius:4px;border:1px solid #d1d5db" />
      </td>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb;vertical-align:middle">${escapeHTML(item.product_name || '')}</td>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:center;vertical-align:middle">${item.quantity || 0}</td>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;vertical-align:middle">${formatPrice(item.unit_price || 0)}</td>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;vertical-align:middle">${formatPrice((item.unit_price || 0) * (item.quantity || 0))}</td>
    </tr>
  `}).join('')

  return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8" />
      <title>Hoa don ${escapeHTML(order.order_code || '')}</title>
    </head>
    <body style="font-family:Arial,sans-serif;color:#111827;padding:28px;line-height:1.5">
      <h1 style="margin:0 0 6px">DURI - Hóa đơn bán hàng</h1>
      <p style="margin:0 0 2px">Mã đơn: <strong>#${escapeHTML(order.order_code || '')}</strong></p>
      <p style="margin:0 0 2px">Ngày tạo: ${order.created_at ? new Date(order.created_at).toLocaleString('vi-VN') : '-'}</p>
      <p style="margin:0 0 16px">Trạng thái: ${escapeHTML(order.status || '')}</p>

      <h3 style="margin:0 0 8px">Thông tin khách hàng</h3>
      <p style="margin:0 0 2px">${escapeHTML(order.customer_name || '')}</p>
      <p style="margin:0 0 2px">${escapeHTML(order.customer_phone || '')} | ${escapeHTML(order.customer_email || '')}</p>
      <p style="margin:0 0 16px">${escapeHTML(order.shipping_address || '')}</p>

      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:8px;text-align:center;width:80px">Ảnh</th>
            <th style="padding:8px;text-align:left">Sản phẩm</th>
            <th style="padding:8px;text-align:center">SL</th>
            <th style="padding:8px;text-align:right">Đơn giá</th>
            <th style="padding:8px;text-align:right">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <p style="text-align:right;font-size:18px;font-weight:700;margin-top:16px">Tổng cộng: ${formatPrice(order.total_price || 0)}</p>
    </body>
    </html>
  `
}

function downloadInvoice() {
  if (!_currentDetailOrder) {
    showToast('Không có dữ liệu để tải hóa đơn', 'error')
    return
  }

  const html = buildInvoiceHTML(_currentDetailOrder)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `hoa-don-${normalizeOrderCode(_currentDetailOrder.order_code || 'DURI')}.html`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
  showToast('Đã tải hóa đơn', 'success')
}

function printInvoice() {
  if (!_currentDetailOrder) {
    showToast('Không có dữ liệu để in hóa đơn', 'error')
    return
  }

  const html = buildInvoiceHTML(_currentDetailOrder)
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    showToast('Trình duyệt đã chặn cửa sổ in', 'error')
    return
  }

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => {
    printWindow.print()
  }, 200)
}

document.addEventListener('DOMContentLoaded', async () => {
  const code = normalizeOrderCode(new URLSearchParams(window.location.search).get('code') || '')
  const input = document.getElementById('detail-search-code')
  if (input && code) input.value = code

  if (code) {
    await loadOrderDetails(code)
  } else {
    const result = document.getElementById('order-detail-result')
    if (result) {
      result.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📦</div>
          <h3>Chưa có mã đơn hàng</h3>
          <p>Nhập mã đơn ở ô tra cứu để xem chi tiết.</p>
        </div>`
    }
  }
})
