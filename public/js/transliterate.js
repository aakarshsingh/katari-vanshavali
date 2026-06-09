const _transCache = new Map();

// The chip row sits immediately after the English (input) field, e.g.
// #f-name-en -> #chips-name, #f-spouse-en -> #chips-spouse.
function _getChipContainer(inputEl) {
  return inputEl ? inputEl.nextElementSibling : null;
}

function _showMessage(container, msg) {
  if (container) container.innerHTML = '<span class="chip-msg">' + msg + '</span>';
}

function _clearChips(container) {
  if (container) container.innerHTML = '';
}

function _showSpinner(container) {
  if (!container) return;
  container.innerHTML = '<span class="chip-spinner" aria-label="Loading…">⋯</span>';
}

// Set a value programmatically AND notify listeners. The lineage editor keeps a
// working array synced via the field's 'input' event, so a silent `.value =`
// would be lost on save; dispatching a bubbling input event keeps it in sync
// (harmless for forms that read the DOM directly at submit time).
function _setValue(outputEl, val) {
  outputEl.value = val;
  outputEl.dispatchEvent(new Event('input', { bubbles: true }));
}

function _renderChips(container, options, outputEl) {
  if (!container) return;
  container.innerHTML = '';
  options.forEach(function(opt) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.textContent = opt;
    btn.addEventListener('click', function() {
      _setValue(outputEl, opt); // clicking a chip is an explicit, deliberate replace
    });
    container.appendChild(btn);
  });
}

// Apply suggestions WITHOUT clobbering a value the user already has: auto-fill
// only when the output field is blank; otherwise just offer the suggestions as
// chips (excluding the current value). This is the fix for auto-fill overwriting
// a correct Hindi spelling while the English field is edited.
function _applySuggestions(container, options, outputEl) {
  const current = (outputEl.value || '').trim();
  if (!current && options.length) _setValue(outputEl, options[0]); // fill only when blank
  const after = (outputEl.value || '').trim();
  const chips = after ? options.filter(function(o) { return o !== after; }) : options;
  _renderChips(container, chips, outputEl);
}

// attachTransliterate(inputEl, outputEl, opts)
//   opts.translit — function(text) -> Promise<{ options }>. Defaults to the
//   global public `api.transliterate`, so the public sidebar keeps working with
//   the two-arg call; the admin page passes its own (adminApi-based) fetcher.
function attachTransliterate(inputEl, outputEl, opts) {
  if (!inputEl || !outputEl) return;
  const container = (opts && opts.container) || _getChipContainer(inputEl);
  const translit = (opts && opts.translit)
    || (window.api && window.api.transliterate)
    || null;
  let debounceTimer = null;

  inputEl.addEventListener('keyup', function() {
    const text = inputEl.value.trim();
    clearTimeout(debounceTimer);

    // Always clear stale chips immediately so we never show a previous name's
    // suggestions while the new ones are fetched.
    _clearChips(container);
    if (!text) return;
    if (!translit) { _showMessage(container, 'Suggestions unavailable — type Hindi directly'); return; }

    debounceTimer = setTimeout(function() {
      if (_transCache.has(text)) {
        _applySuggestions(container, _transCache.get(text), outputEl);
        return;
      }

      _showSpinner(container);
      translit(text).then(function(data) {
        const options = (data && data.options) ? data.options : [];
        if (options.length === 0) {
          _showMessage(container, 'No suggestions — type Hindi directly');
        } else {
          _transCache.set(text, options);
          // Preserve an existing Hindi value; only fill a blank one.
          _applySuggestions(container, options, outputEl);
        }
      }).catch(function() {
        _showMessage(container, 'Suggestions unavailable — type Hindi directly');
      });
    }, 600);
  });

  inputEl.addEventListener('blur', function() {
    if (!inputEl.value.trim()) {
      _clearChips(container);
    }
  });
}

window.attachTransliterate = attachTransliterate;
