export function buildEmbedScript(appUrl: string): string {
  return `(function(){
  var APP_URL = ${JSON.stringify(appUrl)};
  var script = document.currentScript;
  if (!script) {
    var scripts = document.getElementsByTagName('script');
    script = scripts[scripts.length - 1];
  }
  if (!script) return;

  var formId = script.getAttribute('data-form-id');
  if (!formId) { console.error('[psh-form] missing data-form-id'); return; }

  var mode = script.getAttribute('data-mode') || 'dom';
  var targetSelector = script.getAttribute('data-target');
  var container;
  if (targetSelector) {
    container = document.querySelector(targetSelector);
  } else {
    container = document.createElement('div');
    script.parentNode.insertBefore(container, script);
  }
  if (!container) { console.error('[psh-form] target not found:', targetSelector); return; }

  if (mode === 'iframe') {
    var iframe = document.createElement('iframe');
    iframe.src = APP_URL + '/form/' + formId + '?embed=1';
    iframe.style.cssText = 'width:100%;border:0;min-height:420px;';
    iframe.setAttribute('title', 'Subscribe form');
    container.appendChild(iframe);
    return;
  }

  injectStylesOnce();

  fetch(APP_URL + '/api/public/forms/' + formId + '/schema', { credentials: 'omit' })
    .then(function(r){ if (!r.ok) throw new Error('schema'); return r.json(); })
    .then(function(schema){ render(container, schema); })
    .catch(function(err){
      console.error('[psh-form] failed to load schema', err);
    });

  function injectStylesOnce() {
    if (document.getElementById('psh-form-style')) return;
    var s = document.createElement('style');
    s.id = 'psh-form-style';
    s.textContent = [
      '.psh-form{font-family:inherit;max-width:420px;}',
      '.psh-form-field{margin-bottom:12px;display:flex;flex-direction:column;gap:6px;}',
      '.psh-form-label{font-size:13px;font-weight:500;}',
      '.psh-form-input,.psh-form-select{padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;font:inherit;}',
      '.psh-form-checkbox{display:flex;align-items:center;gap:8px;}',
      '.psh-form-button{padding:10px 16px;background:#111827;color:#fff;border:0;border-radius:6px;font:inherit;cursor:pointer;margin-top:8px;}',
      '.psh-form-button:disabled{opacity:.6;cursor:not-allowed;}',
      '.psh-form-error{color:#b91c1c;font-size:13px;margin-top:6px;}',
      '.psh-form-success{padding:12px;border-radius:6px;background:#ecfdf5;color:#065f46;}',
      '.psh-form-hp{position:absolute;left:-9999px;height:1px;width:1px;overflow:hidden;}'
    ].join('');
    document.head.appendChild(s);
  }

  function render(container, schema) {
    var form = document.createElement('form');
    form.className = 'psh-form';
    form.setAttribute('novalidate', '');

    schema.fields.forEach(function(field){
      var wrap = document.createElement('div');
      wrap.className = 'psh-form-field';
      if (field.type === 'checkbox') {
        wrap.className += ' psh-form-checkbox';
        var input = document.createElement('input');
        input.type = 'checkbox';
        input.name = field.key;
        input.id = 'psh-f-' + field.id;
        input.value = '1';
        var label = document.createElement('label');
        label.className = 'psh-form-label';
        label.htmlFor = input.id;
        label.textContent = field.label + (field.required ? ' *' : '');
        wrap.appendChild(input);
        wrap.appendChild(label);
      } else if (field.type === 'select') {
        var label = document.createElement('label');
        label.className = 'psh-form-label';
        label.textContent = field.label + (field.required ? ' *' : '');
        var select = document.createElement('select');
        select.className = 'psh-form-select';
        select.name = field.key;
        if (field.required) select.required = true;
        var placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Select...';
        select.appendChild(placeholder);
        (field.options || []).forEach(function(opt){
          var o = document.createElement('option');
          o.value = opt;
          o.textContent = opt;
          select.appendChild(o);
        });
        wrap.appendChild(label);
        wrap.appendChild(select);
      } else {
        var label = document.createElement('label');
        label.className = 'psh-form-label';
        label.textContent = field.label + (field.required ? ' *' : '');
        var input = document.createElement('input');
        input.className = 'psh-form-input';
        input.name = field.key;
        input.type = field.type === 'email' ? 'email' : 'text';
        input.autocomplete = field.type === 'email' ? 'email' : 'off';
        if (field.required) input.required = true;
        wrap.appendChild(label);
        wrap.appendChild(input);
      }
      form.appendChild(wrap);
    });

    var hp = document.createElement('input');
    hp.className = 'psh-form-hp';
    hp.tabIndex = -1;
    hp.autocomplete = 'off';
    hp.name = '_hp';
    hp.type = 'text';
    form.appendChild(hp);

    var errorEl = document.createElement('div');
    errorEl.className = 'psh-form-error';
    errorEl.style.display = 'none';
    form.appendChild(errorEl);

    var button = document.createElement('button');
    button.className = 'psh-form-button';
    button.type = 'submit';
    button.textContent = 'Subscribe';
    form.appendChild(button);

    form.addEventListener('submit', function(e){
      e.preventDefault();
      errorEl.style.display = 'none';
      button.disabled = true;
      var fd = new FormData(form);
      var body = new URLSearchParams();
      fd.forEach(function(value, key){ body.append(key, String(value)); });
      fetch(APP_URL + '/api/public/forms/' + schema.id + '/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: body.toString(),
        credentials: 'omit'
      }).then(function(r){
        return r.json().then(function(json){ return { ok: r.ok, json: json }; });
      }).then(function(res){
        if (!res.ok || !res.json.ok) {
          errorEl.textContent = (res.json && res.json.error) || 'Submission failed';
          errorEl.style.display = 'block';
          button.disabled = false;
          return;
        }
        if (res.json.redirectUrl) {
          window.location.href = res.json.redirectUrl;
          return;
        }
        var success = document.createElement('div');
        success.className = 'psh-form-success';
        success.textContent = res.json.message || 'Thanks for subscribing.';
        form.replaceWith(success);
      }).catch(function(){
        errorEl.textContent = 'Network error. Please try again.';
        errorEl.style.display = 'block';
        button.disabled = false;
      });
    });

    container.appendChild(form);
  }
})();`
}
