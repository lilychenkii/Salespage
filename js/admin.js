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

// ── Auto check login ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('admin_auth') === '1') {
    document.getElementById('admin-login').style.display = 'none'
    document.getElementById('admin-panel').style.display = 'block'
    loadOrders()
  }
})