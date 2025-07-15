# Misc Notes

### Proof that Date Prototype (and all default prototypes) Cannot be Made Totally Inaccessable

Credit to Cole for finding a:

```js
mo = new MutationObserver(mutations => {
  console.log(mutations)
})
mo.observe(document.documentElement, { childList: true, subtree: true })
document.body.innerHTML += "<iframe id=i></iframe>"
globalThis.newRTC = i.contentWindow.RTCPeerConnection
```
