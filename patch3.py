s = open('src/App.jsx').read()
changes = 0

# 1. Add suggestion cards after assistant message bubble
# Find the closing of the message bubble div and inject cards after it
old1 = """                  <div style={{ padding: '10px 14px', borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px', background: msg.isError ? `${C.red}18` : msg.isLimit ? `${C.gold}12` : isUser ? `linear-gradient(135deg, ${C.accent}, #4B2FD0)` : C.panel, border: msg.isError ? `1px solid ${C.red}44` : msg.isLimit ? `1px solid ${C.gold}44` : isUser ? 'none' : `1px solid ${C.border}`, fontSize: 13, lineHeight: 1.6, color: msg.isError ? '#FF6B6B' : msg.isLimit ? C.gold : C.text, whiteSpace: 'pre-wrap' }}>
                    {textContent}
                    {msg.isLimit && (
                      <a href="/pricing" style={{ display: 'inline-block', marginTop: 8, background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, borderRadius: 8, padding: '6px 14px', color: '#fff', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>⬆ Upgrade Plan</a>
                    )}
                    {msg.isError && (
                      <button onClick={() => { setMessages(prev => prev.filter((_, idx) => idx !== i)); send() }}
                        style={{ display: 'block', marginTop: 6, background: 'none', border: `1px solid ${C.red}44`, borderRadius: 6, padding: '3px 10px', color: '#FF6B6B', fontSize: 11, cursor: 'pointer' }}>
                        ↺ Retry
                      </button>
                    )}
                  </div>
                </div>
              </div>"""

new1 = """                  <div style={{ padding: '10px 14px', borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px', background: msg.isError ? `${C.red}18` : msg.isLimit ? `${C.gold}12` : isUser ? `linear-gradient(135deg, ${C.accent}, #4B2FD0)` : C.panel, border: msg.isError ? `1px solid ${C.red}44` : msg.isLimit ? `1px solid ${C.gold}44` : isUser ? 'none' : `1px solid ${C.border}`, fontSize: 13, lineHeight: 1.6, color: msg.isError ? '#FF6B6B' : msg.isLimit ? C.gold : C.text, whiteSpace: 'pre-wrap' }}>
                    {textContent}
                    {msg.isLimit && (
                      <a href="/pricing" style={{ display: 'inline-block', marginTop: 8, background: `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, borderRadius: 8, padding: '6px 14px', color: '#fff', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>⬆ Upgrade Plan</a>
                    )}
                    {msg.isError && (
                      <button onClick={() => { setMessages(prev => prev.filter((_, idx) => idx !== i)); send() }}
                        style={{ display: 'block', marginTop: 6, background: 'none', border: `1px solid ${C.red}44`, borderRadius: 6, padding: '3px 10px', color: '#FF6B6B', fontSize: 11, cursor: 'pointer' }}>
                        ↺ Retry
                      </button>
                    )}
                  </div>
                  {/* ── Suggestion cards — tap to reply ── */}
                  {!isUser && msg.suggestions && msg.suggestions.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {msg.suggestions.map((opt, si) => (
                        <button key={si} onClick={() => {
                          setInput(opt)
                          setTimeout(() => {
                            setMessages(prev => [...prev, { role: 'user', content: opt }])
                            setInput('')
                            setLoading(true)
                            const sanitized = messages.filter((_, idx) => idx > 0).map(m => {
                              if (Array.isArray(m.content)) {
                                const t = m.content.find(c => c.type === 'text')
                                return { role: m.role, content: t?.text || '' }
                              }
                              return { role: m.role, content: m.content }
                            })
                            getAuthHeader().then(h => {
                              fetch('/api/dream', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', ...h },
                                body: JSON.stringify({ messages: [...sanitized, { role: 'user', content: opt }] })
                              }).then(r => r.json()).then(data => {
                                if (!mountedRef.current) return
                                const reply = data.reply || "Tell me more..."
                                const cards = extractSuggestionOptions(reply)
                                setMessages(prev => [...prev, { role: 'assistant', content: reply, suggestions: cards }])
                                setLoading(false)
                                if (data.generationPrompt) setPendingPrompt({ prompt: data.generationPrompt, refImage: null })
                              }).catch(() => setLoading(false))
                            })
                          }, 100)
                        }}
                        style={{
                          background: `rgba(124,92,252,0.1)`,
                          border: `1px solid rgba(124,92,252,0.35)`,
                          borderRadius: 20,
                          padding: '6px 14px',
                          color: C.accent,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          WebkitTapHighlightColor: 'transparent',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = `rgba(124,92,252,0.2)`; e.currentTarget.style.borderColor = `rgba(124,92,252,0.6)` }}
                        onMouseLeave={e => { e.currentTarget.style.background = `rgba(124,92,252,0.1)`; e.currentTarget.style.borderColor = `rgba(124,92,252,0.35)` }}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>"""

if old1 in s:
    s = s.replace(old1, new1, 1)
    changes += 1
    print('1 done - suggestion cards rendering')
else:
    print('1 skip - message bubble not found exactly')

# 2. Fix banner dashed border showing on published profile
# The edit modal uses dashed border (correct) but ProfileHeader banner has no dashed — 
# the issue is the edit modal's dashed border bleeds through. 
# Fix: remove dashed border from the edit modal banner when a preview is loaded
old2 = """                <div onClick={() => bannerRef.current?.click()} style={{ width: '100%', height: 120, borderRadius: 12, background: bannerPreview ? 'transparent' : `linear-gradient(135deg, ${C.accent}20, ${C.teal}20)`, border: `2px dashed ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', position: 'relative' }}>"""

new2 = """                <div onClick={() => bannerRef.current?.click()} style={{ width: '100%', height: 120, borderRadius: 12, background: bannerPreview ? 'transparent' : `linear-gradient(135deg, ${C.accent}20, ${C.teal}20)`, border: bannerPreview ? `1px solid ${C.border}` : `2px dashed ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', position: 'relative' }}>"""

if old2 in s:
    s = s.replace(old2, new2, 1)
    changes += 1
    print('2 done - banner dashed border hidden when image loaded')
else:
    print('2 skip')

# 3. Improve ProfileHeader banner — taller, better object-position, responsive
old3 = """      <div style={{ width: '100%', height: 180, borderRadius: '16px 16px 0 0', background: profile?.banner_url ? 'transparent' : `linear-gradient(135deg, ${C.accent}30, ${C.teal}20, #FF6B9D18)`, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        {profile?.banner_url && <img src={profile.banner_url} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}"""

new3 = """      <div style={{ width: '100%', height: 'clamp(160px, 22vw, 260px)', borderRadius: '16px 16px 0 0', background: profile?.banner_url ? 'transparent' : `linear-gradient(135deg, ${C.accent}30, ${C.teal}20, #FF6B9D18)`, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        {profile?.banner_url && <img src={profile.banner_url} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />}"""

if old3 in s:
    s = s.replace(old3, new3, 1)
    changes += 1
    print('3 done - banner taller + responsive + object-position top')
else:
    print('3 skip')

open('src/App.jsx', 'w').write(s)
print(f'\nDone: {changes}/3 applied')
