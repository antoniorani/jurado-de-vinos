const statisticsPage = document.querySelector('[data-page="statistics"]');

if (statisticsPage) {
  const rows = Array.isArray(window.WINE_DATA) ? window.WINE_DATA : [];

  const variables = [
    { key: 'fixedAcidity', label: 'Acidez fija' },
    { key: 'volatileAcidity', label: 'Acidez volátil' },
    { key: 'citricAcid', label: 'Ácido cítrico' },
    { key: 'residualSugar', label: 'Azúcar residual' },
    { key: 'chlorides', label: 'Cloruros' },
    { key: 'freeSulfurDioxide', label: 'SO₂ libre' },
    { key: 'totalSulfurDioxide', label: 'SO₂ total' },
    { key: 'density', label: 'Densidad' },
    { key: 'pH', label: 'pH' },
    { key: 'sulphates', label: 'Sulfatos' },
    { key: 'alcohol', label: 'Alcohol' }
  ];

  const qualityCountEl = document.querySelector('[data-stat="quality-count"]');
  const selectedVariableEl = document.querySelector('[data-stat="selected-variable"]');
  const bestCorrelationEl = document.querySelector('[data-stat="best-correlation"]');
  const variableSelect = document.getElementById('variableSelect');
  const statsByQualityBody = document.getElementById('statsByQualityBody');
  const correlationList = document.getElementById('correlationList');
  const chartCanvas = document.getElementById('qualityChart');

  const state = { variable: 'alcohol' };

  const mean = (values) => values.reduce((acc, value) => acc + value, 0) / values.length;
  const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  };
  const stdDev = (values) => {
    const avg = mean(values);
    return Math.sqrt(values.reduce((acc, value) => acc + (value - avg) ** 2, 0) / values.length);
  };
  const formatNumber = (value) => Number(value).toFixed(2);

  const pearson = (x, y) => {
    const avgX = mean(x);
    const avgY = mean(y);
    let numerator = 0;
    let sumX = 0;
    let sumY = 0;
    for (let index = 0; index < x.length; index += 1) {
      const dx = x[index] - avgX;
      const dy = y[index] - avgY;
      numerator += dx * dy;
      sumX += dx * dx;
      sumY += dy * dy;
    }
    const denominator = Math.sqrt(sumX * sumY);
    return denominator === 0 ? 0 : numerator / denominator;
  };

  const qualityValues = rows.map((row) => row.quality);
  const qualities = [...new Set(qualityValues)].sort((a, b) => a - b);

  const correlations = variables
    .map((variable) => ({
      ...variable,
      value: pearson(
        rows.map((row) => Number(row[variable.key])),
        qualityValues
      )
    }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  const bestCorrelation = correlations[0];

  const renderCorrelationList = () => {
    const maxAbs = Math.max(...correlations.map((item) => Math.abs(item.value)), 0.01);
    correlationList.innerHTML = correlations
      .map((item) => {
        const width = `${Math.max(12, Math.round((Math.abs(item.value) / maxAbs) * 100))}%`;
        return `
          <div class="legend-item">
            <span class="legend-item__label">${item.label}</span>
            <div style="min-width: 120px; flex: 1; display:flex; align-items:center; gap:12px;">
              <div class="legend-bar" style="width:${width}"></div>
              <strong>${item.value.toFixed(2)}</strong>
            </div>
          </div>
        `;
      })
      .join('');
  };

  const renderVariableOptions = () => {
    variableSelect.innerHTML = variables
      .map((variable) => `<option value="${variable.key}">${variable.label}</option>`)
      .join('');
    variableSelect.value = state.variable;
  };

  const renderStatsByQuality = () => {
    const selected = variables.find((variable) => variable.key === state.variable);
    selectedVariableEl.textContent = selected?.label || state.variable;

    statsByQualityBody.innerHTML = qualities
      .map((quality) => {
        const values = rows
          .filter((row) => row.quality === quality)
          .map((row) => Number(row[state.variable]));

        return `
          <tr>
            <td>${quality}</td>
            <td>${formatNumber(mean(values))}</td>
            <td>${formatNumber(stdDev(values))}</td>
            <td>${formatNumber(median(values))}</td>
          </tr>
        `;
      })
      .join('');
  };

  const renderQualityChart = () => {
    const counts = qualities.map((quality) => rows.filter((row) => row.quality === quality).length);

    new Chart(chartCanvas, {
      type: 'bar',
      data: {
        labels: qualities.map(String),
        datasets: [{
          label: 'Número de vinos',
          data: counts,
          backgroundColor: 'rgba(111, 29, 27, 0.82)',
          borderRadius: 12,
          borderSkipped: false
        }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { displayColors: false }
        },
        scales: {
          x: {
            grid: { display: false },
            title: { display: true, text: 'Calidad' }
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Frecuencia' }
          }
        }
      }
    });
  };

  const initialize = () => {
    if (!rows.length) {
      statsByQualityBody.innerHTML = '<tr><td colspan="4">No se han encontrado datos cargados.</td></tr>';
      return;
    }

    renderVariableOptions();
    renderCorrelationList();
    renderStatsByQuality();
    renderQualityChart();

    qualityCountEl.textContent = String(qualities.length);
    bestCorrelationEl.textContent = `${bestCorrelation.label} (${bestCorrelation.value.toFixed(2)})`;

    variableSelect.addEventListener('change', () => {
      state.variable = variableSelect.value;
      renderStatsByQuality();
    });
  };

  initialize();
}
