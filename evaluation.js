const evaluationPage = document.querySelector('[data-page="evaluation"]');

if (evaluationPage) {
  const rows = Array.isArray(window.WINE_DATA) ? window.WINE_DATA : [];

  const features = [
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

  const algorithms = {
    'logistic-regression': 'Regresión logística',
    'decision-tree': 'Árbol de decisión',
    'random-forest': 'Random forest'
  };

  const configKey = 'juradoVinosTrainingConfig';
  const defaultConfig = {
    threshold: 5,
    split: 50,
    selectedFeatures: features.map((feature) => feature.key),
    algorithm: 'logistic-regression'
  };

  const elements = {
    algorithm: document.querySelector('[data-eval-stat="algorithm"]'),
    threshold: document.querySelector('[data-eval-stat="threshold"]'),
    split: document.querySelector('[data-eval-stat="split"]'),
    features: document.querySelector('[data-eval-stat="features"]'),
    summary: document.getElementById('evaluationSummary'),
    matrixTp: document.getElementById('matrixTp'),
    matrixFp: document.getElementById('matrixFp'),
    matrixFn: document.getElementById('matrixFn'),
    matrixTn: document.getElementById('matrixTn'),
    metricsBody: document.getElementById('metricsBody'),
    importanceList: document.getElementById('importanceList'),
    note: document.getElementById('evaluationNote'),
    furtherLink: document.getElementById('furtherEvaluationLink'),
    content: document.getElementById('evaluationContent'),
    emptyState: document.getElementById('evaluationEmptyState')
  };

  const formatInt = (value) => Number(value).toLocaleString('es-ES');
  const formatPercent = (value) => `${value.toFixed(2)}%`;

  const normalizeConfig = (source = {}) => ({
    threshold: Number(source.threshold) || defaultConfig.threshold,
    split: Number(source.split) || defaultConfig.split,
    selectedFeatures: Array.isArray(source.selectedFeatures) && source.selectedFeatures.length
      ? source.selectedFeatures.filter((key) => features.some((feature) => feature.key === key))
      : defaultConfig.selectedFeatures,
    algorithm: source.algorithm in algorithms ? source.algorithm : defaultConfig.algorithm
  });

  const loadConfigFromQuery = () => {
    const params = new URLSearchParams(window.location.search);
    const selectedFeatures = params.get('selectedFeatures');
    if (!params.toString() || !params.get('trained')) return null;
    return normalizeConfig({
      threshold: params.get('threshold'),
      split: params.get('split'),
      selectedFeatures: selectedFeatures ? selectedFeatures.split(',').filter(Boolean) : null,
      algorithm: params.get('algorithm')
    });
  };

  const loadConfig = () => {
    const queryConfig = loadConfigFromQuery();
    if (queryConfig) {
      try {
        window.localStorage.setItem(configKey, JSON.stringify(queryConfig));
      } catch (error) {
        // La configuración de la URL sigue siendo válida aunque localStorage no esté disponible.
      }
      return queryConfig;
    }
    try {
      const raw = window.localStorage.getItem(configKey);
      return raw ? normalizeConfig(JSON.parse(raw)) : null;
    } catch (error) {
      return null;
    }
  };

  const buildMetrics = (matrix) => {
    const safePercent = (numerator, denominator) => (denominator ? (numerator / denominator) * 100 : 0);
    return [
      { label: 'Accuracy', value: safePercent(matrix.tp + matrix.tn, matrix.total), description: 'Porcentaje total de vinos del test que el modelo clasifica correctamente.' },
      { label: 'Sensibilidad', value: safePercent(matrix.tp, matrix.tp + matrix.fn), description: 'Proporción de vinos de compra correctamente detectados en el conjunto de prueba.' },
      { label: 'Especificidad', value: safePercent(matrix.tn, matrix.tn + matrix.fp), description: 'Porcentaje de vinos rechazables correctamente identificados como negativos.' },
      { label: 'Valor predictivo positivo', value: safePercent(matrix.tp, matrix.tp + matrix.fp), description: 'Fiabilidad de la etiqueta “comprar” cuando el modelo predice una compra.' },
      { label: 'Valor predictivo negativo', value: safePercent(matrix.tn, matrix.tn + matrix.fn), description: 'Fiabilidad de la etiqueta “rechazar” cuando el modelo descarta una compra.' },
      { label: 'Tasa de detección', value: safePercent(matrix.tp, matrix.total), description: 'Proporción del total del test en la que el modelo acierta compras reales.' }
    ];
  };

  const render = () => {
    if (!rows.length) {
      elements.note.textContent = 'No se han encontrado datos cargados para calcular la evaluación.';
      return;
    }

    if (!window.WineML) {
      elements.note.textContent = 'No se ha podido cargar el motor local de aprendizaje automático.';
      return;
    }

    const config = loadConfig();
    if (!config) {
      if (elements.content) elements.content.hidden = true;
      if (elements.emptyState) elements.emptyState.hidden = false;
      return;
    }

    if (elements.content) elements.content.hidden = false;
    if (elements.emptyState) elements.emptyState.hidden = true;

    const params = new URLSearchParams({
      threshold: String(config.threshold),
      split: String(config.split),
      selectedFeatures: config.selectedFeatures.join(','),
      algorithm: config.algorithm,
      trained: '1'
    });
    if (elements.furtherLink) elements.furtherLink.href = `./evaluacion-avanzada.html?${params.toString()}`;

    const { trainRows, testRows } = window.WineML.splitRows(rows, config.split, 73);
    const model = window.WineML.train({
      rows: trainRows,
      featureKeys: config.selectedFeatures,
      qualityThreshold: config.threshold,
      algorithm: config.algorithm,
      seed: 73
    });
    const decisionThreshold = window.WineML.findDecisionThreshold(trainRows, model, config.threshold);
    const matrix = window.WineML.confusionMatrix(testRows, model, config.threshold, decisionThreshold);
    const metrics = buildMetrics(matrix);

    const sortedImportance = config.selectedFeatures
      .map((key) => ({
        key,
        label: features.find((feature) => feature.key === key)?.label || key,
        weight: Number(model.featureImportance[key]) || 0
      }))
      .sort((a, b) => b.weight - a.weight);

    elements.algorithm.textContent = algorithms[config.algorithm];
    elements.threshold.textContent = `Calidad ≥ ${config.threshold}`;
    elements.split.textContent = `${config.split}% train · ${100 - config.split}% test`;
    elements.features.textContent = String(config.selectedFeatures.length);

    elements.summary.innerHTML = `
      <div class="summary-item"><span class="summary-item__label">Algoritmo evaluado</span><strong class="summary-item__value">${algorithms[config.algorithm]}</strong></div>
      <div class="summary-item"><span class="summary-item__label">Partición aplicada</span><strong class="summary-item__value">${formatInt(trainRows.length)} train · ${formatInt(testRows.length)} test</strong></div>
      <div class="summary-item"><span class="summary-item__label">Criterio de compra</span><strong class="summary-item__value">Comprar si calidad ≥ ${config.threshold}</strong></div>
      <div class="summary-item"><span class="summary-item__label">Variables seleccionadas</span><strong class="summary-item__value">${sortedImportance.map((item) => item.label).join(', ')}</strong></div>
    `;

    elements.matrixTp.textContent = formatInt(matrix.tp);
    elements.matrixFp.textContent = formatInt(matrix.fp);
    elements.matrixFn.textContent = formatInt(matrix.fn);
    elements.matrixTn.textContent = formatInt(matrix.tn);

    elements.metricsBody.innerHTML = metrics.map((metric) => `
      <tr><td>${metric.label}</td><td><strong>${formatPercent(metric.value)}</strong></td><td>${metric.description}</td></tr>
    `).join('');

    elements.importanceList.innerHTML = sortedImportance.map((item) => {
      const percentage = item.weight * 100;
      return `
        <div class="legend-item importance-item">
          <div class="importance-item__header"><span class="legend-item__label">${item.label}</span><strong>${percentage.toFixed(1)}%</strong></div>
          <div class="importance-item__bar-wrap" aria-hidden="true"><div class="legend-bar importance-item__bar" style="width:${percentage.toFixed(1)}%"></div></div>
        </div>
      `;
    }).join('');

    const bestFeature = sortedImportance[0]?.label || 'la variable principal';
    elements.note.innerHTML = `Con esta configuración se ha entrenado un <strong>${algorithms[config.algorithm]}</strong> real en el navegador con <strong>${formatInt(trainRows.length)}</strong> vinos y se ha evaluado sobre <strong>${formatInt(testRows.length)}</strong>. La variable con mayor importancia en este modelo es <strong>${bestFeature}</strong>. El umbral de clasificación (${decisionThreshold.toFixed(2)}) se ajusta usando únicamente el conjunto de entrenamiento.`;
  };

  try {
    render();
  } catch (error) {
    console.error(error);
    if (elements.note) elements.note.textContent = `No se pudo completar el entrenamiento: ${error.message}`;
  }
}
