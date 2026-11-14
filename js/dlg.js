// Подстраховка для старых iOS (< 15.4): там нет <dialog>, showModal() падает и фильтры/вход не открываются.
(function () {
  if (window.HTMLDialogElement && HTMLDialogElement.prototype.showModal) return;
  document.documentElement.classList.add('nodlg');
  function fix(d) {
    if (d._shim) return; d._shim = 1;
    Object.defineProperty(d, 'open', { get: function () { return d.hasAttribute('open'); }, set: function (v) { v ? d.setAttribute('open', '') : d.removeAttribute('open'); } });
    Object.defineProperty(d, 'returnValue', { value: '', writable: true });
    d.show = d.showModal = function () { d.setAttribute('open', ''); d.classList.add('modal'); };
    d.close = function (v) { if (!d.hasAttribute('open')) return; if (v !== undefined) d.returnValue = v; d.removeAttribute('open'); d.classList.remove('modal'); d.dispatchEvent(new Event('close')); };
  }
  function all() { Array.prototype.forEach.call(document.querySelectorAll('dialog'), fix); }
  document.addEventListener('DOMContentLoaded', all); all();
  document.addEventListener('keydown', function (e) { if (e.key !== 'Escape') return; var o = document.querySelectorAll('dialog[open]'); var d = o[o.length - 1]; if (d) { var c = new Event('cancel', { cancelable: true }); d.dispatchEvent(c); if (!c.defaultPrevented) d.close(); } });
})();
