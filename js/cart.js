// ===== CART.JS =====

function renderCart() {
  const container  = document.getElementById('cart-items')
  const emptyState = document.getElementById('cart-empty')
  const cartContent= document.getElementById('cart-content')
  if (!container) return

  const cart = getCart()

  if (cart.length === 0) {
    if (emptyState)   emptyState.style.display   = 'block'
    if (cartContent)  cartContent.style.display  = 'none'
    return
  }

  if (emptyState)   emptyState.style.display   = 'none'
  if (cartContent)  cartContent.style.display  = 'grid'

    container.innerHTML = cart.map(item => {
      const safeImageUrl = resolveProductImage(item.id, item.image_url)
      return `
    <div class="cart-item">
      <img class="cart-item-img" src="${safeImageUrl}" alt="${item.name}"
        onerror="this.src='https://placehold.co/80x80/F5F1ED/333333?text=DURI'" />
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">${formatPrice(item.price)} / sản phẩm</div>
        <div class="qty-control" style="margin-top:8px">
          <button class="qty-btn" onclick="changeQty('${item.id}', -1)">−</button>
          <span class="qty-value">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty('${item.id}', 1)">+</button>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:700;margin-bottom:8px">${formatPrice(item.price * item.qty)}</div>
        <button class="cart-item-remove" onclick="removeFromCart('${item.id}')">🗑️</button>
      </div>
    </div>
  `}).join('')

  updateSummary(cart)
}

function updateSummary(cart) {
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0)
  const shipping = subtotal > 0 ? 30000 : 0
  const total    = subtotal + shipping
  const el = id => document.getElementById(id)
  if (el('summary-subtotal')) el('summary-subtotal').textContent = formatPrice(subtotal)
  if (el('summary-shipping')) el('summary-shipping').textContent = shipping === 0 ? 'Miễn phí' : formatPrice(shipping)
  if (el('summary-total'))    el('summary-total').textContent    = formatPrice(total)
}

function changeQty(id, delta) {
  const cart = getCart()
  const item = cart.find(i => i.id === id)
  if (!item) return
  item.qty += delta
  if (item.qty <= 0) { removeFromCart(id); return }
  saveCart(cart)
  renderCart()
}

function removeFromCart(id) {
  saveCart(getCart().filter(i => i.id !== id))
  renderCart()
  showToast('Đã xóa sản phẩm', '')
}

document.addEventListener('DOMContentLoaded', renderCart)