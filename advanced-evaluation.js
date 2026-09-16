const advancedEvaluationPage = document.querySelector('[data-page="advanced-evaluation"]');

if (advancedEvaluationPage) {
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
    algorithm: document.querySelector('[data-advanced-stat="algorithm"]'),
    threshold: document.querySelector('[data-advanced-stat="threshold"]'),
    split: document.querySelector('[data-advanced-stat="split"]'),
    features: document.querySelector('[data-advanced-stat="features"]'),
    whiteTp: document.querySelector('[data-matrix="white-tp"]'),
    whiteFp: document.querySelector('[data-matrix="white-fp"]'),
    whiteFn: document.querySelector('[data-matrix="white-fn"]'),
    whiteTn: document.querySelector('[data-matrix="white-tn"]'),
    redTp: document.querySelector('[data-matrix="red-tp"]'),
    redFp: document.querySelector('[data-matrix="red-fp"]'),
    redFn: document.querySelector('[data-matrix="red-fn"]'),
    redTn: document.querySelector('[data-matrix="red-tn"]'),
    whiteMetrics: document.querySelector('[data-metrics="white"]'),
    redMetrics: document.querySelector('[data-metrics="red"]'),
    whiteCount: document.querySelector('[data-group-count="blanco"]'),
    redCount: document.querySelector('[data-group-count="tinto"]'),
    comparisonNote: document.getElementById('advancedComparisonNote'),
    note: document.getElementById('advancedEvaluationNote'),
    backToStep3Link: document.getElementById('backToStep3Link'),
    backToTrainingLink: document.getElementById('backToTrainingLink'),
    content: document.getElementById('advancedEvaluationContent'),
    emptyState: document.getElementById('advancedEmptyState')
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
      try { window.localStorage.setItem(configKey, JSON.stringify(queryConfig)); } catch (error) { /* no-op */ }
      return queryConfig;
    }
    try {
      const raw = window.localStorage.getItem(configKey);
      return raw ? normalizeConfig(JSON.parse(raw)) : null;
    } catch (error) {
      return null;
    }
  };

  const buildParams = (config) => new URLSearchParams({
    threshold: String(config.threshold),
    split: String(config.split),
    selectedFeatures: config.selectedFeatures.join(','),
    algorithm: config.algorithm,
    trained: '1'
  }).toString();

  const buildMetrics = (matrix) => {
    const safePercent = (numerator, denominator) => (denominator ? (numerator / denominator) * 100 : 0);
    return [
      { label: 'Accuracy', value: safePercent(matrix.tp + matrix.tn, matrix.total), description: 'Porcentaje total de aciertos del modelo dentro de este grupo.' },
      { label: 'Sensibilidad', value: safePercent(matrix.tp, matrix.tp + matrix.fn), description: 'Proporción de compras reales detectadas correctamente en este grupo.' },
      { label: 'Especificidad', value: safePercent(matrix.tn, matrix.tn + matrix.fp), description: 'Porcentaje de rechazos reales que el modelo identifica bien.' },
      { label: 'Valor predictivo positivo', value: safePercent(matrix.tp, matrix.tp + matrix.fp), description: 'Fiabilidad de la predicción “comprar” dentro de este tipo de vino.' },
      { label: 'Valor predictivo negativo', value: safePercent(matrix.tn, matrix.tn + matrix.fn), description: 'Fiabilidad de la predicción “rechazar” dentro de este tipo de vino.' },
      { label: 'Tasa de detección', value: safePercent(matrix.tp, matrix.total), description: 'Porción total del grupo en la que el modelo acierta una compra real.' }
    ];
  };

  const renderMetricsTable = (target, metrics) => {
    target.innerHTML = metrics.map((metric) => `
      <tr><td>${metric.label}</td><td><strong>${formatPercent(metric.value)}</strong></td><td>${metric.description}</td></tr>
    `).join('');
  };

  const render = () => {
    if (!rows.length || !window.WineML) {
      elements.comparisonNote.textContent = 'No se han podido cargar los datos o el motor de aprendizaje automático.';
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

    const queryString = buildParams(config);
    elements.backToStep3Link.href = `./evaluacion.html?${queryString}`;
    elements.backToTrainingLink.href = `./entrenamiento.html?${queryString}`;

    const { trainRows, testRows } = window.WineML.splitRows(rows, config.split, 73);
    const model = window.WineML.train({
      rows: trainRows,
      featureKeys: config.selectedFeatures,
      qualityThreshold: config.threshold,
      algorithm: config.algorithm,
      seed: 73
    });
    const decisionThreshold = window.WineML.findDecisionThreshold(trainRows, model, config.threshold);
    const whiteRows = testRows.filter((row) => row.type === 'blanco');
    const redRows = testRows.filter((row) => row.type === 'tinto');
    const white = window.WineML.confusionMatrix(whiteRows, model, config.threshold, decisionThreshold);
    const red = window.WineML.confusionMatrix(redRows, model, config.threshold, decisionThreshold);

    elements.algorithm.textContent = algorithms[config.algorithm];
    elements.threshold.textContent = `Calidad ≥ ${config.threshold}`;
    elements.split.textContent = `${config.split}% train · ${100 - config.split}% test`;
    elements.features.textContent = String(config.selectedFeatures.length);

    elements.whiteCount.textContent = formatInt(white.total);
    elements.redCount.textContent = formatInt(red.total);
    elements.whiteTp.textContent = formatInt(white.tp);
    elements.whiteFp.textContent = formatInt(white.fp);
    elements.whiteFn.textContent = formatInt(white.fn);
    elements.whiteTn.textContent = formatInt(white.tn);
    elements.redTp.textContent = formatInt(red.tp);
    elements.redFp.textContent = formatInt(red.fp);
    elements.redFn.textContent = formatInt(red.fn);
    elements.redTn.textContent = formatInt(red.tn);

    renderMetricsTable(elements.whiteMetrics, buildMetrics(white));
    renderMetricsTable(elements.redMetrics, buildMetrics(red));

    elements.comparisonNote.innerHTML = 'Las dos tablas proceden del <strong>mismo modelo real</strong>, entrenado solo con el conjunto de entrenamiento. La evaluación se separa después por tipo de vino para comprobar si su comportamiento cambia entre blancos y tintos.';
    elements.note.innerHTML = `El umbral de clasificación utilizado es <strong>${decisionThreshold.toFixed(2)}</strong> y se ha elegido usando exclusivamente los datos de entrenamiento. Compara accuracy, sensibilidad, especificidad y las casillas de error para responder las preguntas 22 y 23.`;
  };

  try {
    render();
  } catch (error) {
    console.error(error);
    if (elements.note) elements.note.textContent = `No se pudo completar el análisis: ${error.message}`;
  }
}
