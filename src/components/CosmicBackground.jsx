import { useEffect, useRef } from 'react'

export default function CosmicBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let animFrameId
    let W = window.innerWidth
    let H = window.innerHeight

    const resize = () => {
      W = canvas.width  = window.innerWidth
      H = canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const STAR_COUNT = 180
    const stars = Array.from({ length: STAR_COUNT }, () => ({
      x:       Math.random() * W,
      y:       Math.random() * H,
      r:       Math.random() * 1.6 + 0.2,
      twinkle: Math.random() * Math.PI * 2,
      speed:   Math.random() * 0.008 + 0.002,
      color:   Math.random() > 0.7
                 ? 'rgba(0, 212, 255,'
                 : Math.random() > 0.5
                   ? 'rgba(168, 85, 247,'
                   : 'rgba(240, 238, 255,',
    }))

    const nebulas = [
      { x: 0.15, y: 0.30, r: 320, c1: 'rgba(123, 92, 240, 0.12)',  c2: 'rgba(123, 92, 240, 0)' },
      { x: 0.80, y: 0.20, r: 280, c1: 'rgba(255, 45, 155, 0.10)',  c2: 'rgba(255, 45, 155, 0)' },
      { x: 0.55, y: 0.75, r: 350, c1: 'rgba(0, 212, 255, 0.08)',   c2: 'rgba(0, 212, 255, 0)'  },
      { x: 0.90, y: 0.65, r: 200, c1: 'rgba(168, 85, 247, 0.09)',  c2: 'rgba(168, 85, 247, 0)' },
      { x: 0.25, y: 0.80, r: 240, c1: 'rgba(255, 45, 155, 0.07)',  c2: 'rgba(255, 45, 155, 0)' },
    ]

    let t = 0

    const drawNebulas = () => {
      nebulas.forEach(n => {
        const cx = n.x * W + Math.sin(t * 0.0003 + n.x * 5) * 18
        const cy = n.y * H + Math.cos(t * 0.0004 + n.y * 5) * 14
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, n.r)
        grad.addColorStop(0, n.c1)
        grad.addColorStop(1, n.c2)
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(cx, cy, n.r, 0, Math.PI * 2)
        ctx.fill()
      })
    }

    const drawStars = () => {
      stars.forEach(s => {
        s.twinkle += s.speed
        const alpha = 0.2 + (Math.sin(s.twinkle) * 0.5 + 0.5) * 0.75
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `${s.color}${alpha.toFixed(2)})`
        ctx.fill()

        if (s.r > 1.2 && alpha > 0.7) {
          ctx.strokeStyle = `${s.color}${(alpha * 0.3).toFixed(2)})`
          ctx.lineWidth = 0.5
          const flare = s.r * 4
          ctx.beginPath()
          ctx.moveTo(s.x - flare, s.y)
          ctx.lineTo(s.x + flare, s.y)
          ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(s.x, s.y - flare)
          ctx.lineTo(s.x, s.y + flare)
          ctx.stroke()
        }
      })
    }

    const render = (timestamp) => {
      t = timestamp
      ctx.fillStyle = '#06040f'
      ctx.fillRect(0, 0, W, H)
      drawNebulas()
      drawStars()
      animFrameId = requestAnimationFrame(render)
    }

    animFrameId = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animFrameId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
        display: 'block',
      }}
    />
  )
}
