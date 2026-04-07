import re

s = open('src/App.jsx').read()
changes = 0

# 1. Pending prompt pickup in DreamChat
old1 = """    const refinePrompt = sessionStorage.getItem('dreamRefinePrompt')
    if (refinePrompt) {
      sessionStorage.removeItem('dreamRefinePrompt')
      setInput(`Refine this prompt: ${refinePrompt}`)
      setTimeout(() => inputRef.current?.focus(), 100)
    }"""

new1 = """    const refinePrompt = sessionStorage.getItem('dreamRefinePrompt')
    if (refinePrompt) {
      sessionStorage.removeItem('dreamRefinePrompt')
      setInput(`Refine this prompt: ${refinePrompt}`)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
    const pendingDream = sessionStorage.getItem('ds_pending_prompt')
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

if old1 in s:
    s = s.replace(old1, new1, 1)
    changes += 1
    print('1 done - pending prompt pickup')
else:
    print('1 skip')

# 2. Add suggestion card extraction after assistant reply is set
# Find where reply is added to messages and inject card parsing
old2 = """      setMessages(prev => [...prev, { role: 'assistant', content: replyContent }])
      setLoading(false)"""

new2 = """      // Parse clarifying options from Dream's reply for tap-to-choose cards
      const cardOptions = extractSuggestionOptions(replyContent)
      setMessages(prev => [...prev, { role: 'assistant', content: replyContent, suggestions: cardOptions }])
      setLoading(false)"""

if old2 in s:
    s = s.replace(old2, new2, 1)
    changes += 1
    print('2 done - suggestion cards injected into messages')
else:
    print('2 skip')

# 3. Add extractSuggestionOptions helper before DreamChat function
old3 = "function DreamChat({ user, onSignIn }) {"
new3 = """// ── Extract clickable suggestion options from Dream's reply ─────────────────
// Detects: "A or B?", "1. Option  2. Option", "- Option" lists, "X vs Y"
function extractSuggestionOptions(text) {
  if (!text || typeof text !== 'string') return []

  // Pattern 1: "A or B?" or "X or Y or Z?" near end of message
  const orMatch = text.match(/(?:^|[.!\\n])\\s*([^.!?\\n]{3,40})\\s+or\\s+([^.!?\\n]{3,40})\\??\\s*$/im)
  if (orMatch) {
    const a = orMatch[1].replace(/^(go with|use|try|choose|pick|do|make it|want)\s+/i, '').trim()
    const b = orMatch[2].replace(/\\?$/, '').trim()
    if (a.length > 2 && b.length > 2 && a.length < 50 && b.length < 50) {
      return [a, b]
    }
  }

  // Pattern 2: Numbered list "1. X\\n2. Y\\n3. Z"
  const numbered = [...text.matchAll(/^\\s*[1-5][.):]\\s*(.+)$/gm)]
  if (numbered.length >= 2 && numbered.length <= 5) {
    const opts = numbered.map(m => m[1].trim()).filter(o => o.length > 2 && o.length < 60)
    if (opts.length >= 2) return opts.slice(0, 4)
  }

  // Pattern 3: Bullet list "- X\\n- Y"
  const bullets = [...text.matchAll(/^\\s*[-•*]\\s+(.+)$/gm)]
  if (bullets.length >= 2 && bullets.length <= 5) {
    const opts = bullets.map(m => m[1].trim()).filter(o => o.length > 2 && o.length < 60)
    if (opts.length >= 2) return opts.slice(0, 4)
  }

  // Pattern 4: "X vs Y"
  const vsMatch = text.match(/([^.!?\\n]{3,35})\\s+vs\\.?\\s+([^.!?\\n]{3,35})/i)
  if (vsMatch) {
    return [vsMatch[1].trim(), vsMatch[2].trim()]
  }

  return []
}

function DreamChat({ user, onSignIn }) {"""

if old3 in s:
    s = s.replace(old3, new3, 1)
    changes += 1
    print('3 done - extractSuggestionOptions added')
else:
    print('3 skip')

# 4. Fix nav breakpoint — lower from 900px to 1100px so it doesn't overflow at medium widths
old4 = "@media (max-width: 900px) { .nav-links-full { display: none !important; } .mobile-menu-btn { display: flex !important; } }"
new4 = "@media (max-width: 1100px) { .nav-links-full { display: none !important; } .mobile-menu-btn { display: flex !important; } }"

if old4 in s:
    s = s.replace(old4, new4, 1)
    changes += 1
    print('4 done - nav breakpoint 900→1100px')
else:
    print('4 skip')

open('src/App.jsx', 'w').write(s)
print(f'\nDone: {changes}/4 applied')
