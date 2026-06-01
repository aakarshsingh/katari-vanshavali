const _transCache = new Map();

function _getChipContainer(outputEl) {
  return outputEl ? outputEl.nextElementSibling : null;
}

function _clearChips(container) {
  if (container) container.innerHTML = '';
}

function _showSpinner(container) {
  if (!container) return;
  container.innerHTML = '<span class="chip-spinner" aria-label="Loading…">⋯</span>';
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
      outputEl.value = opt;
    });
    container.appendChild(btn);
  });
}

function attachTransliterate(inputEl, outputEl) {
  if (!inputEl || !outputEl) return;
  const container = _getChipContainer(outputEl);
  let debounceTimer = null;

  inputEl.addEventListener('keyup', function() {
    const text = inputEl.value.trim();
    clearTimeout(debounceTimer);

    if (!text) {
      _clearChips(container);
      return;
    }

    debounceTimer = setTimeout(function() {
      if (_transCache.has(text)) {
        _renderChips(container, _transCache.get(text), outputEl);
        return;
      }

      _showSpinner(container);
      api.transliterate(text).then(function(data) {
        const options = (data && data.options) ? data.options : [];
        _transCache.set(text, options);
        _renderChips(container, options, outputEl);
      }).catch(function() {
        _clearChips(container);
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
