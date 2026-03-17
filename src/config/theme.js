export const C = {
  bg:       '#06040f',
  bg2:      '#0a0618',
  panel:    'rgba(14, 10, 30, 0.82)',
  card:     'rgba(20, 15, 42, 0.90)',
  border:   'rgba(123, 92, 240, 0.20)',
  borderHi: 'rgba(0, 212, 255, 0.30)',
  text:     '#f0eeff',
  muted:    '#8a80b0',
  dim:      'rgba(180, 170, 220, 0.35)',
  accent:   '#7B5CF0',
  teal:     '#00E5CC',
  cyan:     '#00D4FF',
  magenta:  '#FF2D9B',
  violet:   '#A855F7',
  gradCTA:     'linear-gradient(135deg, #7B5CF0, #4B2FD0)',
  gradUser:    'linear-gradient(135deg, #6B2FF0, #9B2DD0)',
  gradBorder:  'linear-gradient(135deg, #00D4FF, #7B5CF0, #FF2D9B)',
  gradHero:    'linear-gradient(180deg, rgba(123,92,240,0.15) 0%, transparent 100%)',
}

export const shadow = {
  panel: `
    -5px  5px 20px rgba(0, 212, 255, 0.28),
    -10px 10px 45px rgba(0, 212, 255, 0.12),
     5px -5px 20px rgba(255, 45, 155, 0.28),
    10px -10px 45px rgba(255, 45, 155, 0.12),
    inset 0 0 35px rgba(123, 92, 240, 0.04)
  `,
  button:    '0 0 14px rgba(123, 92, 240, 0.50), 0 0 35px rgba(123, 92, 240, 0.22)',
  buttonHov: '0 0 20px rgba(123, 92, 240, 0.70), 0 0 50px rgba(123, 92, 240, 0.35)',
  cyan:      '0 0 12px rgba(0, 212, 255, 0.50), 0 0 28px rgba(0, 212, 255, 0.22)',
  magenta:   '0 0 12px rgba(255, 45, 155, 0.50), 0 0 28px rgba(255, 45, 155, 0.22)',
  bubbleUser:'0 0 12px rgba(139, 47, 240, 0.55), 0 0 28px rgba(139, 47, 240, 0.25)',
  bubbleAi:  '0 0 10px rgba(0, 212, 255, 0.12), 0 0 24px rgba(0, 212, 255, 0.05)',
  img:       '0 0 15px rgba(123, 92, 240, 0.40), 0 0 35px rgba(123, 92, 240, 0.20), 0 0 2px rgba(0, 212, 255, 0.60)',
}

export const styles = {
  panel: {
    background: 'rgba(14, 10, 30, 0.82)',
    backdropFilter: 'blur(24px) saturate(1.4)',
    WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
    borderRadius: 16,
    border: '1px solid rgba(0, 212, 255, 0.12)',
    boxShadow: shadow.panel,
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #7B5CF0, #4B2FD0)',
    border: 'none',
    borderRadius: 12,
    boxShadow: shadow.button,
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  bubbleUser: {
    background: 'linear-gradient(135deg, #6B2FF0, #9B2DD0)',
    border: 'none',
    boxShadow: shadow.bubbleUser,
  },
  bubbleAi: {
    background: 'rgba(22, 16, 48, 0.90)',
    border: '1px solid rgba(0, 212, 255, 0.20)',
    boxShadow: shadow.bubbleAi,
  },
  input: {
    background: 'rgba(10, 7, 22, 0.80)',
    border: '1px solid rgba(123, 92, 240, 0.30)',
    borderRadius: 12,
    color: '#f0eeff',
  },
  imgFrame: {
    borderRadius: 12,
    border: '1px solid rgba(0, 212, 255, 0.25)',
    boxShadow: shadow.img,
  },
}
