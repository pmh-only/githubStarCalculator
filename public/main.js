// deno-lint-ignore-file
window.onload = async function () {
  const token = getCookie('token')
  const enabledCalculation = { fork: true, public: true, private: true, collabo: true, orgPublic: true, orgPrivate: true }
  let globalData

  for (const key of Object.keys(enabledCalculation)) {
    const elem = document.querySelectorAll('.' + key + '>.ind')[0]
    elem.onclick = function () {
      enabledCalculation[key] = !enabledCalculation[key]
      if (enabledCalculation[key]) elem.style.color = '#2e3440'
      else elem.style.color = '#e5e9f0'
      refreshStars()
    }
  }

  if (!token) {
    const config = await window.fetch('/config').then(function (res) { return res.json() })
  
    const url = new URL('https://github.com/login/oauth/authorize')
  
    url.searchParams.append('scope', config.scope)
    url.searchParams.append('client_id', config.client_id)
    url.searchParams.append('redirect_uri', config.redirect_uri)
  
    document.getElementsByClassName('login-box')[0].innerHTML = `
      <a href="${url.toString()}">
        <button class="login-btn">Login with <img src="/3rd/octicon/github.svg" alt="Github"></button>
        <div class="muted" style="margin-top: 5px">to start calculating</div>
      </a>
    `
  } else {
    document.cookie = 'token=;expires=Thu, 01 Jan 1970 00:00:00 GMT'
    document.getElementsByClassName('login-box')[0].innerHTML = `
      <div class="lds-ripple"><div></div><div></div></div>
      <div class="muted">calculating...</div>
      <div class="muted detail"></div>
    `

    const socket = new WebSocket('wss:' + window.location.host + '/ws?token=' + token)

    socket.onmessage = function (event) {
      const data = JSON.parse(event.data)
      globalData = data.data

      if (data.finished) {
        document.getElementsByClassName('login-box')[0].innerHTML = ''
      } else {
        document.getElementsByClassName('detail')[0].innerText = data.message
        refreshStars()
      }
    }
  }

  function refreshStars () {
    let star = 0
    const keys = Object.keys(globalData.stars)
    for (const key of keys) {
      document.querySelectorAll('.' + key + '>.ind')[0].innerText = globalData.stars[key]
      if (enabledCalculation[key]) star += globalData.stars[key]
    }

    document.getElementsByClassName('result')[0].innerHTML = `
      ${star}<img src="/3rd/octicon/star.svg" alt="stars">
    `
  }
}

function getCookie (name) {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop().split(';').shift()
}
