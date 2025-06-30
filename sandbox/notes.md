# Misc Notes

### Proof that Date Prototype (and all default prototypes) Cannot be Made Totally Inaccessable

Credit to Cole for finding a:

```js
mo = new MutationObserver(mutations => {
  console.log(mutations)
})
mo.observe(document.documentElement, { childList: true, subtree: true })
$0.innerHTML += "<iframe id=i></iframe>"
alert(i.contentWindow.Date())
```
