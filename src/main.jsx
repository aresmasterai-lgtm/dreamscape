import React from 'react'
import ReactDOM from 'react-dom/client'
import DevDashboard from './DevDashboard.jsx'

// To switch to the main Dreamscape site, change DevDashboard to App:
// import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DevDashboard />
  </React.StrictMode>,
)
