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
  const container = _getChipContainer(inputEl);
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
        if (options.length === 0) {
          _showMessage(container, 'No suggestions — type Hindi directly');
        } else {
          _transCache.set(text, options);
          _renderChips(container, options, outputEl);
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
