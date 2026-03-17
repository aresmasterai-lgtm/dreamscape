import { useEffect, useRef } from 'react'

export default function CosmicBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let animFrame
    let stars = []
    let nebulas = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    const initStars = () => {
      stars = Array.from({ length: 180 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.5 + 0.3,
        alpha: Math.random() * 0.7 + 0.3,
        speed: Math.random() * 0.02 + 0.005,
        phase: Math.random() * Math.PI * 2,
        color: ['#00D4FF', '#A855F7', '#ffffff', '#00E5CC'][Math.floor(Math.random() * 4)],
        crossFlare: Math.random() > 0.7,
      }))
    }

    const initNebulas = () => {
      nebulas = [
        { x: 0.15, y: 0.2,  rx: 0.35, ry: 0.3,  color: 'rgba(123,92,240,',  alpha: 0.18, speed: 0.00008, phase: 0 },
        { x: 0.8,  y: 0.75, rx: 0.4,  ry: 0.35, color: 'rgba(255,45,155,',  alpha: 0.14, speed: 0.00006, phase: 1 },
        { x: 0.5,  y: 0.45, rx: 0.3,  ry: 0.28, color: 'rgba(0,212,255,',   alpha: 0.12, speed: 0.0001,  phase: 2 },
        { x: 0.85, y: 0.15, rx: 0.28, ry: 0.3,  color: 'rgba(0,150,255,',   alpha: 0.13, speed: 0.00007, phase: 3 },
        { x: 0.1,  y: 0.8,  rx: 0.3,  ry: 0.25, color: 'rgba(245,200,66,',  alpha: 0.10, speed: 0.00009, phase: 4 },
      ]
    }

    let t = 0
    const draw = () => {
      t++
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Nebula clouds
      nebulas.forEach(n => {
        const px = (n.x + Math.sin(t * n.speed + n.phase) * 0.04) * canvas.width
        const py = (n.y + Math.cos(t * n.speed + n.phase) * 0.04) * canvas.height
        const rx = n.rx * canvas.width
        const ry = n.ry * canvas.height
        const grad = ctx.createRadialGradient(px, py, 0, px, py, Math.max(rx, ry))
        grad.addColorStop(0,   n.color + n.alpha + ')')
        grad.addColorStop(0.4, n.color + (n.alpha * 0.5) + ')')
        grad.addColorStop(1,   n.color + '0)')
        ctx.save()
        ctx.scale(1, ry / rx)
        ctx.beginPath()
        ctx.arc(px, py * (rx / ry), rx, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.filter = 'blur(40px)'
        ctx.fill()
        ctx.filter = 'none'
        ctx.restore()
      })

      // Stars
      stars.forEach(s => {
        const twinkle = Math.sin(t * s.speed + s.phase)
        const alpha = s.alpha * (0.6 + 0.4 * twinkle)
        const scale = 1 + 0.3 * twinkle

        ctx.save()
        ctx.globalAlpha = alpha
        ctx.fillStyle = s.color
        ctx.shadowColor = s.color
        ctx.shadowBlur = 6

        // Cross flare for brighter stars
        if (s.crossFlare) {
          ctx.strokeStyle = s.color
          ctx.lineWidth = 0.5
          ctx.globalAlpha = alpha * 0.6
          ctx.beginPath()
          ctx.moveTo(s.x - s.r * 3 * scale, s.y)
          ctx.lineTo(s.x + s.r * 3 * scale, s.y)
          ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(s.x, s.y - s.r * 3 * scale)
          ctx.lineTo(s.x, s.y + s.r * 3 * scale)
          ctx.stroke()
          ctx.globalAlpha = alpha
        }

        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r * scale, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })

      animFrame = requestAnimationFrame(draw)
    }

    resize()
    initStars()
    initNebulas()
    draw()

    window.addEventListener('resize', () => { resize(); initStars() })

    return () => {
      cancelAnimationFrame(animFrame)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        width: '100%',
        height: '100%',
      }}
    />
  )
}