export function overrideCookie() {
  clearCookies()
  Object.defineProperty(document, "cookie", {
    set() {
      console.warn("Setting cookies is a no-op in sandboxed mode")
    },
    get() {
      return ""
    },
  })
}

// Credit: https://stackoverflow.com/a/7487448
function expireAllCookies(name: string, paths: string[]) {
  const expires = new Date(0).toUTCString()

  // expire null-path cookies as well
  document.cookie = name + "=; expires=" + expires

  for (let i = 0, l = paths.length; i < l; i++) {
    document.cookie = name + "=; path=" + paths[i] + "; expires=" + expires
  }
}

// Credit: https://stackoverflow.com/a/7487448
function expireActiveCookies(name: string) {
  const pathname = location.pathname.replace(/\/$/, ""),
    segments = pathname.split("/"),
    paths = []

  for (let i = 0, l = segments.length; i < l; i++) {
    const path = segments.slice(0, i + 1).join("/")

    paths.push(path) // as file
    paths.push(path + "/") // as directory
  }

  expireAllCookies(name, paths)
}
export async function clearCookies() {
  const cookies = document.cookie.split(";").map(s => s.trim())
  for (const cookie of cookies) {
    const name = cookie.split("=")[0]
    expireActiveCookies(name)
  }
  if (document.cookie.length != 0) {
    throw new Error("not all cookies were cleared! Cookie: " + document.cookie)
  }
}
