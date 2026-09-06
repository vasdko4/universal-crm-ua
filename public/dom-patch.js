(function () {
  try {
    if (window.__domPatched) return
    window.__domPatched = true
    var rc = Node.prototype.removeChild
    Node.prototype.removeChild = function (child) {
      if (child && child.parentNode !== this) return child
      return rc.apply(this, arguments)
    }
    var ib = Node.prototype.insertBefore
    Node.prototype.insertBefore = function (newNode, refNode) {
      if (refNode && refNode.parentNode !== this) {
        this.appendChild(newNode)
        return newNode
      }
      return ib.apply(this, arguments)
    }
  } catch (_) {}
})()
