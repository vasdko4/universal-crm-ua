(function () {
  try {
    var p = window.performance
    if (!p || typeof p.measure !== 'function' || p.__v0Patched) return
    var o = p.measure.bind(p)
    p.measure = function () {
      try {
        return o.apply(p, arguments)
      } catch (e) {
        if (e && e.message && e.message.indexOf('negative time stamp') !== -1) return
        throw e
      }
    }
    p.__v0Patched = true
  } catch (_) {}
})()
