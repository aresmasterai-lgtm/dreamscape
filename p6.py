s = open('src/App.jsx').read()
c = 0

# Add data-send-btn attribute to the send button at line 1641
old1 = """            <button onClick={send} disabled={loading || !input.trim()} style={{ background: loading || !input.trim() ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 18px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', minWidth: 44, minHeight: 44, WebkitTapHighlightColor: 'transparent' }}>✦</button>"""
new1 = """            <button data-send-btn onClick={send} disabled={loading || !input.trim()} style={{ background: loading || !input.trim() ? C.border : `linear-gradient(135deg, ${C.accent}, #4B2FD0)`, border: 'none', borderRadius: 10, padding: '10px 18px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', minWidth: 44, minHeight: 44, WebkitTapHighlightColor: 'transparent' }}>✦</button>"""
if old1 in s:
    s = s.replace(old1, new1, 1); c += 1; print('1 done - tagged send button')
else:
    print('1 skip')

# Fix pending prompt to actually click the send button
old2 = """    const pendingDream = sessionStorage.getItem('ds_pending_prompt')
    if (pendingDream) {
      sessionStorage.removeItem('ds_pending_prompt')
      setTimeout(() => {
        setInput(pendingDream)
        inputRef.current?.focus()
        // Auto-send after a short delay so user sees it fire
        setTimeout(() => {
          setMessages(prev => [...prev, { role: 'user', content: pendingDream }])
          setInput('')
        }, 400)
      }, 350)
    }"""
new2 = """    const pendingDream = sessionStorage.getItem('ds_pending_prompt')
    if (pendingDream) {
      sessionStorage.removeItem('ds_pending_prompt')
      setTimeout(() => {
        setInput(pendingDream)
        setTimeout(() => {
          document.querySelector('[data-send-btn]')?.click()
        }, 400)
      }, 600)
    }"""
if old2 in s:
    s = s.replace(old2, new2, 1); c += 1; print('2 done - pending prompt auto-sends')
else:
    print('2 skip')

open('src/App.jsx', 'w').write(s)
print('changes:', c)
