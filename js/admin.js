// ===== ADMIN.JS =====

const ADMIN_PASSWORD = 'duri2024admin' // Đổi password này theo ý bạn

const STATUS_OPTIONS = ['Đặt hàng', 'Đang chuẩn bị', 'Đang giao', 'Đã giao', 'Đã hủy']
const STATUS_CONFIG = {
  'Đặt hàng':      { class: 'status-placed',    icon: '📋' },
  'Đang chuẩn bị': { class: 'status-preparing', icon: '📦' },
  'Đang giao':     { class: 'status-shipping',  icon: '🚚' },
  'Đã giao':       { class: 'status-delivered', icon: '✅' },
  'Đã hủy':        { class: 'status-cancelled', icon: '❌' },
}

let allOrders = []
let currentFilter = null

// ── Login ─────────────────────────────────────────────────
function checkLogin() {
  const pw = document.getElementById('admin-password')?.value
  if (pw === ADMIN_PASSWORD) {
    sessionStorage.setItem('admin_auth', '1')
    document.getElementById('admin-login').style.display = 'none'
    document.getElementById('admin-panel').style.display = 'block'
    loadOrders()
  } else {
    showToast('Mật khẩu không đúng', 'error')
  }
}

function adminLogout() {
  sessionStorage.removeItem('admin_auth')
  document.getElementById('admin-login').style.display = 'flex'
  document.getElementById('admin-panel').style.display = 'none'
}

// ── Load orders ───────────────────────────────────────────
async function loadOrders() {
  const tbody   = document.getElementById('orders-tbody')
  const loading = document.getElementById('orders-loading')
  const empty   = document.getElementById('orders-empty')
  const table   = document.getElementById('orders-table')

  loading.style.display = 'block'
  table.style.display   = 'none'

  try {
    const { data: orders, error } = await db
      .from('orders')
      .select(`*, order_items(*)`)
      .order('created_at', { ascending: false })

    if (error) throw error

    allOrders = orders || []
    updateStats(allOrders)
    renderOrders(allOrders)

  } catch (err) {
    console.error(err)
    showToast('Lỗi tải đơn hàng', 'error')
  } finally {
    loading.style.display = 'none'
    table.style.display   = 'table'
  }
}

// ── Stats ─────────────────────────────────────────────────
function updateStats(orders) {
  document.getElementById('stat-total').textContent     = orders.length
  document.getElementById('stat-pending').textContent   = orders.filter(o => ['Đặt hàng','Đang chuẩn bị'].includes(o.status)).length
  document.getElementById('stat-shipping').textContent  = orders.filter(o => o.status === 'Đang giao').length
  document.getElementById('stat-delivered').textContent = orders.filter(o => o.status === 'Đã giao').length
}

// ── Render orders ─────────────────────────────────────────
function renderOrders(orders) {
  const tbody = document.getElementById('orders-tbody')
  const empty = document.getElementById('orders-empty')
  const table = document.getElementById('orders-table')

  const filtered = currentFilter ? orders.filter(o => o.status === currentFilter) : orders

  if (filtered.length === 0) {
    tbody.innerHTML = ''
    empty.style.display = 'block'
    return
  }

  empty.style.display = 'none'

  tbody.innerHTML = filtered.map(order => {
    const cfg   = STATUS_CONFIG[order.status] || STATUS_CONFIG['Đặt hàng']
    const items = (order.order_items || []).map(i => `${i.product_name} ×${i.quantity}`).join(', ')
    const date  = new Date(order.created_at).toLocaleString('vi-VN')

    const selectOptions = STATUS_OPTIONS.map(s =>
      `<option value="${s}" ${s === order.status ? 'selected' : ''}>${STATUS_CONFIG[s]?.icon} ${s}</option>`
    ).join('')

    return `
      <tr>
        <td>
          <div style="font-weight:700;color:#333">#${order.order_code}</div>
        </td>
        <td>
          <div style="font-weight:600">${order.customer_name}</div>
          <div style="font-size:0.78rem;color:#9ca3af">${order.customer_email}</div>
          <div style="font-size:0.78rem;color:#9ca3af">${order.customer_phone || ''}</div>
          <div style="font-size:0.78rem;color:#9ca3af;margin-top:2px">📍 ${order.shipping_address}</div>
        </td>
        <td>
          <div class="order-items-mini">${items}</div>
        </td>
        <td>
          <div style="font-weight:700">${formatPrice(order.total_price)}</div>
        </td>
        <td style="color:#6b7280;font-size:0.82rem">${date}</td>
        <td>
          <select class="status-select" onchange="updateOrderStatus('${order.id}', this.value, this)">
            ${selectOptions}
          </select>
        </td>
        <td>
          <button class="btn btn-dark btn-sm" onclick="openAdminOrderDetail('${order.id}')">🔍 Xem</button>
        </td>
      </tr>
    `
  }).join('')
}

// ── Update status (email do webhook tự xử lý) ────────────
async function updateOrderStatus(orderId, newStatus, selectEl) {
  const originalValue = selectEl.dataset.original || selectEl.value
  selectEl.disabled = true

  try {
    const { error } = await db
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId)

    if (error) throw error

    const order = allOrders.find(o => o.id === orderId)
    if (order) order.status = newStatus

    updateStats(allOrders)
    showToast(`✓ Đã cập nhật: ${newStatus}`, 'success')
    selectEl.dataset.original = newStatus

  } catch (err) {
    console.error(err)
    showToast('Lỗi cập nhật trạng thái', 'error')
    selectEl.value = originalValue
  } finally {
    selectEl.disabled = false
  }
}

// ── Filter ────────────────────────────────────────────────
function filterOrders(status, btn) {
  currentFilter = status
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  renderOrders(allOrders)
}

// ── Order details modal ───────────────────────────────────
async function openAdminOrderDetail(orderId) {
  const order = allOrders.find(o => o.id === orderId)
  if (!order) {
    showToast('Không tìm thấy đơn hàng', 'error')
    return
  }

  await enrichOrderItemsWithImages(order)

  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG['Đặt hàng']
  const createdAt = new Date(order.created_at).toLocaleString('vi-VN')

  const itemsHTML = (order.order_items || []).map(item => {
    const imageUrl = item.image_url || 'https://placehold.co/100x80/F5F1ED/333333?text=DURI'
    const itemTotal = (item.unit_price || 0) * (item.quantity || 0)
    return `
      <div style="display:flex;gap:10px;align-items:flex-start;padding:12px 0;border-bottom:1px solid #e8e3dd">
        <img src="${imageUrl}" alt="${escapeHTML(item.product_name || '')}" style="width:60px;height:45px;object-fit:cover;border-radius:6px;border:1px solid #e8e3dd;flex-shrink:0" />
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;color:#0f172a">${escapeHTML(item.product_name || '')}</div>
          <div style="font-size:0.82rem;color:#9ca3af;margin-top:2px">SL: ${item.quantity || 0} × ${formatPrice(item.unit_price || 0)}</div>
        </div>
        <div style="font-weight:700;text-align:right;white-space:nowrap">${formatPrice(itemTotal)}</div>
      </div>
    `
  }).join('')

  const contentHTML = `
    <div style="margin-bottom:16px;background:#f8fafc;border-radius:10px;padding:12px 14px">
      <div style="font-weight:800;color:#1d4ed8;font-size:1.1rem;letter-spacing:1px">#${escapeHTML(order.order_code || '')}</div>
      <div style="font-size:0.82rem;color:#64748b;margin-top:3px">${createdAt}</div>
    </div>

    <div style="background:linear-gradient(135deg,#${cfg.class === 'status-delivered' ? 'dcfce7' : cfg.class === 'status-shipping' ? 'e0f2fe' : cfg.class === 'status-cancelled' ? 'fee2e2' : 'fef9c3'},transparent);border-radius:10px;padding:10px 12px;margin-bottom:16px">
      <div style="font-weight:700;color:#0f172a">${cfg.icon} ${escapeHTML(order.status || '')}</div>
    </div>

    <h4 style="font-size:0.9rem;font-weight:700;color:#0f172a;margin:12px 0">Sản phẩm</h4>
    <div style="margin-bottom:12px">
      ${itemsHTML}
    </div>

    <div style="background:#fff7ed;border:1px solid #ffedd5;border-radius:10px;padding:10px 12px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;font-size:0.88rem;color:#334155;margin-bottom:6px">
        <span>Tạm tính</span>
        <span>${formatPrice((order.total_price || 0) - 30000)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:0.88rem;color:#334155;margin-bottom:6px">
        <span>Phí vận chuyển</span>
        <span>30.000đ</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-weight:800;color:#111827">
        <span>Tổng cộng</span>
        <span>${formatPrice(order.total_price || 0)}</span>
      </div>
    </div>

    <h4 style="font-size:0.9rem;font-weight:700;color:#0f172a;margin:12px 0">Thông tin khách hàng</h4>
    <div style="background:#f8fafc;border-radius:10px;padding:10px 12px;font-size:0.88rem;line-height:1.8">
      <div><strong>${escapeHTML(order.customer_name || '')}</strong></div>
      <div>${escapeHTML(order.customer_phone || '')} | ${escapeHTML(order.customer_email || '')}</div>
      <div>${escapeHTML(order.shipping_address || '')}</div>
      ${order.note ? `<div style="margin-top:6px;color:#6b7280">Ghi chú: ${escapeHTML(order.note)}</div>` : ''}
    </div>
  `

  document.getElementById('admin-detail-content').innerHTML = contentHTML
  document.getElementById('admin-detail-modal').style.display = 'flex'
}

function closeAdminDetailModal() {
  const modal = document.getElementById('admin-detail-modal')
  if (modal) modal.style.display = 'none'
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

function escapeHTML(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── Auto check login ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('admin_auth') === '1') {
    document.getElementById('admin-login').style.display = 'none'
    document.getElementById('admin-panel').style.display = 'block'
    loadOrders()
  }
})