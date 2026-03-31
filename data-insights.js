const dataPage = document.querySelector('[data-page="data-insights"]');

if (dataPage) {
  const columns = [
    { key: 'fixedAcidity', label: 'Acidez fija' },
    { key: 'volatileAcidity', label: 'Acidez volátil' },
    { key: 'citricAcid', label: 'Ácido cítrico' },
    { key: 'residualSugar', label: 'Azúcar residual' },
    { key: 'chlorides', label: 'Cloruros' },
    { key: 'freeSulfurDioxide', label: 'SO₂ libre' },
    { key: 'totalSulfurDioxide', label: 'SO₂ total' },
    { key: 'density', label: 'Densidad' },
    { key: 'pH', label: 'pH' },
    { key: 'sulphates', label: 'Sulfitos' },
    { key: 'alcohol', label: 'Alcohol' },
    { key: 'quality', label: 'Calidad' },
    { key: 'type', label: 'Tipo' }
  ];

  const headRow = document.getElementById('tableHeadRow');
  const body = document.getElementById('tableBody');
  const rowsPerPage = document.getElementById('rowsPerPage');
  const searchInput = document.getElementById('searchInput');
  const tableSummary = document.getElementById('tableSummary');
  const pageIndicator = document.getElementById('pageIndicator');
  const prevPage = document.getElementById('prevPage');
  const nextPage = document.getElementById('nextPage');

  const totalRecordsEl = document.querySelector('[data-metric="total-records"]');
  const variableCountEl = document.querySelector('[data-metric="variables-count"]');
  const statusTextEl = document.querySelector('[data-metric="status-text"]');
  const datasetBanner = document.getElementById('datasetBanner');

  const embeddedData = Array.isArray(window.WINE_DATA) ? window.WINE_DATA : [];

  const state = {
    page: 1,
    perPage: Number(rowsPerPage?.value || 10),
    query: '',
    sortKey: 'quality',
    sortDirection: 'desc',
    rows: embeddedData
  };

  const formatValue = (value) => {
    if (typeof value === 'number') {
      return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
    }
    return value;
  };

  const buildHeaders = () => {
    headRow.innerHTML = columns.map((column) => {
      const isActive = state.sortKey === column.key;
      const arrow = isActive ? (state.sortDirection === 'asc' ? '↑' : '↓') : '↕';
      return `
        <th>
          <button class="sort-button ${isActive ? 'sort-button--active' : ''}" data-sort="${column.key}" type="button">
            <span>${column.label}</span>
            <span class="sort-arrow">${arrow}</span>
          </button>
        </th>
      `;
    }).join('');

    headRow.querySelectorAll('[data-sort]').forEach((button) => {
      button.addEventListener('click', () => {
        const sortKey = button.dataset.sort;
        if (state.sortKey === sortKey) {
          state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortKey = sortKey;
          state.sortDirection = 'asc';
        }
        render();
      });
    });
  };

  const getFilteredRows = () => {
    const normalizedQuery = state.query.trim().toLowerCase();
    const filtered = !normalizedQuery
      ? [...state.rows]
      : state.rows.filter((row) =>
          columns.some((column) => String(row[column.key]).toLowerCase().includes(normalizedQuery))
        );

    filtered.sort((a, b) => {
      const valueA = a[state.sortKey];
      const valueB = b[state.sortKey];
      if (valueA === valueB) return 0;
      const result = valueA > valueB ? 1 : -1;
      return state.sortDirection === 'asc' ? result : -result;
    });

    return filtered;
  };

  const renderEmptyState = (message) => {
    body.innerHTML = `
      <tr>
        <td colspan="${columns.length}">
          <div class="empty-state">${message}</div>
        </td>
      </tr>
    `;
  };

  const render = () => {
    buildHeaders();

    if (!state.rows.length) {
      renderEmptyState('No se han podido cargar los datos embebidos del proyecto.');
      tableSummary.textContent = 'Mostrando 0 filas';
      pageIndicator.textContent = 'Página 0 de 0';
      prevPage.disabled = true;
      nextPage.disabled = true;
      return;
    }

    const rows = getFilteredRows();
    const totalPages = Math.max(1, Math.ceil(rows.length / state.perPage));
    if (state.page > totalPages) state.page = totalPages;

    const start = (state.page - 1) * state.perPage;
    const end = start + state.perPage;
    const currentRows = rows.slice(start, end);

    if (!currentRows.length) {
      renderEmptyState('No hay filas que coincidan con la búsqueda actual.');
    } else {
      body.innerHTML = currentRows.map((row) => `
        <tr>
          ${columns.map((column) => `<td>${formatValue(row[column.key])}</td>`).join('')}
        </tr>
      `).join('');
    }

    tableSummary.textContent = rows.length
      ? `Mostrando ${start + 1} a ${Math.min(end, rows.length)} de ${rows.length} filas`
      : 'Mostrando 0 filas';
    pageIndicator.textContent = `Página ${state.page} de ${totalPages}`;
    prevPage.disabled = state.page === 1;
    nextPage.disabled = state.page === totalPages || rows.length === 0;
  };

  const initializeSummary = () => {
    const totalRecords = state.rows.length;
    const variableCount = columns.length - 1; // sin contar tipo como variable química/objetivo conjunta
    if (totalRecordsEl) totalRecordsEl.textContent = totalRecords.toLocaleString('es-ES');
    if (variableCountEl) variableCountEl.textContent = String(variableCount);
    if (statusTextEl) statusTextEl.textContent = 'datos locales cargados';
    if (datasetBanner) {
      datasetBanner.innerHTML = '<strong>Modo robusto activado:</strong> esta pantalla usa un archivo JavaScript local con el dataset integrado, por lo que funciona incluso si abres el HTML directamente con doble clic.';
    }
  };

  rowsPerPage?.addEventListener('change', () => {
    state.perPage = Number(rowsPerPage.value);
    state.page = 1;
    render();
  });

  searchInput?.addEventListener('input', () => {
    state.query = searchInput.value;
    state.page = 1;
    render();
  });

  prevPage?.addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      render();
    }
  });

  nextPage?.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(getFilteredRows().length / state.perPage));
    if (state.page < totalPages) {
      state.page += 1;
      render();
    }
  });

  initializeSummary();
  render();
}
