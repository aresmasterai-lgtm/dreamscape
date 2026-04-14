// src/lib/downloadImage.js
// ─────────────────────────────────────────────────────────────────────────────
// Downloads an image properly — even from cross-origin URLs like Supabase.
// The browser's native <a download> doesn't work cross-origin, it just opens
// the image in a new tab. This fetches the image as a blob and triggers a
// real file download.
// ─────────────────────────────────────────────────────────────────────────────

export async function downloadImage(url, filename = 'dreamscape-art.png') {
  try {
    // Fetch image as blob (bypasses cross-origin download restriction)
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`)
    const blob = await response.blob()

    // Detect extension from mime type
    const mime = blob.type || 'image/png'
    const ext  = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg'
               : mime.includes('webp') ? 'webp'
               : 'png'

    // Ensure filename has correct extension
    const name = filename.includes('.') ? filename : `${filename}.${ext}`

    // Create object URL and trigger download
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href     = objectUrl
    a.download = name
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    // Clean up object URL after short delay
    setTimeout(() => URL.revokeObjectURL(objectUrl), 5000)

    return { success: true }
  } catch (err) {
    console.warn('Download failed, falling back to new tab:', err.message)
    // Fallback: open in new tab so user can save manually
    window.open(url, '_blank', 'noopener,noreferrer')
    return { success: false, error: err.message }
  }
}

// ── Download button component ─────────────────────────────────────────────────
// Drop-in replacement for <a href download> that actually works cross-origin.
// Usage: <DownloadButton url={imageUrl} filename="my-art" style={...} />
import { useState } from 'react'

export function DownloadButton({ url, filename, children, style, className }) {
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async (e) => {
    e.preventDefault()
    if (downloading || !url) return
    setDownloading(true)
    await downloadImage(url, filename || 'dreamscape-art')
    setDownloading(false)
  }

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className={className}
      style={{
        cursor: downloading ? 'wait' : 'pointer',
        opacity: downloading ? 0.7 : 1,
        ...style,
      }}>
      {downloading ? '⬇ Downloading...' : (children || '⬇ Download')}
    </button>
  )
}
