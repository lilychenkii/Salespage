function initNavbarScrollEffect() {
  const navbar = document.querySelector('.navbar')
  if (!navbar) return

  const updateNavbarState = () => {
    navbar.classList.toggle('scrolled', window.scrollY > 18)
  }

  updateNavbarState()
  window.addEventListener('scroll', updateNavbarState, { passive: true })
}

function initRevealOnScroll() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) return

  const selectors = [
    '.landing-section',
    '.hero-flash-badge',
    '.hero-title',
    '.hero-subtitle',
    '.hero-countdown',
    '.hero-actions',
    '.hero-proof-card',
    '.benefit-card',
    '.feature-row',
    '.review-card',
    '.faq-list details',
    '.section-title',
    '.product-card',
    '.cart-item',
    '.cart-summary',
    '.orders-page > div',
    '.auth-card'
  ]

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return
      entry.target.classList.add('is-visible')
      observer.unobserve(entry.target)
    })
  }, {
    threshold: 0.14,
    rootMargin: '0px 0px -8% 0px'
  })

  const bindReveal = (elements) => {
    elements.forEach((el, index) => {
      if (el.classList.contains('reveal-on-scroll')) return
      el.classList.add('reveal-on-scroll')
      el.style.transitionDelay = `${Math.min(index % 6, 5) * 70}ms`
      observer.observe(el)
    })
  }

  const initialTargets = Array.from(document.querySelectorAll(selectors.join(',')))
  bindReveal(initialTargets)

  const productGrid = document.getElementById('product-grid')
  if (productGrid) {
    const gridObserver = new MutationObserver(() => {
      const newCards = Array.from(productGrid.querySelectorAll('.product-card:not(.reveal-on-scroll)'))
      bindReveal(newCards)
    })

    gridObserver.observe(productGrid, { childList: true })
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initNavbarScrollEffect()
  initRevealOnScroll()
})
