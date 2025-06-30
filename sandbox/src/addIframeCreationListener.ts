export function addIframeCreationListener(
  fn: (elem: HTMLIFrameElement) => void
) {
  const mutation_config = { childList: true, subtree: true }
  let mo = new MutationObserver(mutations => {
    for (let mutation of mutations) {
      for (let node of mutation.addedNodes) {
        if (node.nodeName == "IFRAME") {
          fn(node as HTMLIFrameElement)
        }
      }
    }
  })
  mo.observe(document.documentElement, mutation_config)
}
