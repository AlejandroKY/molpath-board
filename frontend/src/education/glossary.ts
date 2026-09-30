// Contenido educativo general (conceptos de biología molecular y anatomía patológica).
// NO es interpretación clínica ni se aplica a ningún caso. Redactado para docencia.

export interface GlossaryEntry {
  id: string;
  term: string;
  short: string;
  why: string;
  caveat?: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    id: 'vaf',
    term: 'VAF (fracción alélica de la variante)',
    short: 'Porcentaje de lecturas de secuenciación que contienen la variante en una posición concreta.',
    why: 'Ayuda a razonar si una variante podría estar en todas las células tumorales o sólo en una parte (subclonal), y a compararla entre muestras a lo largo del tiempo. Su valor depende del porcentaje de células tumorales de la muestra, del número de copias del gen y de la profundidad de secuenciación.',
    caveat: 'Una VAF aislada no permite concluir el origen (somático o germinal) ni la clonalidad sin integrar otros datos.',
  },
  {
    id: 'ngs',
    term: 'NGS (secuenciación de nueva generación)',
    short: 'Tecnología que secuencia en paralelo millones de fragmentos de ADN o ARN.',
    why: 'Permite estudiar muchos genes a la vez (paneles) y detectar distintos tipos de alteraciones —SNV, indels, CNV, fusiones— en una sola prueba. Lo que no se analizó en el panel no puede considerarse "ausente".',
    caveat: 'La sensibilidad depende de la cobertura, del límite de detección declarado y de la calidad del material.',
  },
  {
    id: 'fish',
    term: 'FISH (hibridación in situ fluorescente)',
    short: 'Técnica que usa sondas fluorescentes para ver en el tejido reordenamientos o cambios de número de copias de regiones concretas.',
    why: 'Conserva la información morfológica y célula a célula, útil para reordenamientos y amplificaciones. Interroga regiones concretas, no el genoma completo.',
  },
  {
    id: 'driver',
    term: 'Mutación driver',
    short: 'Alteración que contribuye al crecimiento o supervivencia del tumor, a diferencia de las "passenger", que acompañan sin aportar ventaja.',
    why: 'Distinguirlas ayuda a entender la biología del tumor. Que una alteración sea driver se sustenta en evidencia (funcional, poblacional, clínica) y puede depender del tipo de tumor.',
    caveat: 'La categoría "driver" es una conclusión basada en evidencia, no una propiedad observable en un único resultado.',
  },
  {
    id: 'tumor-pct',
    term: 'Porcentaje tumoral (celularidad tumoral)',
    short: 'Proporción estimada de células tumorales en el área de tejido usada para el estudio molecular.',
    why: 'Condiciona la probabilidad de detectar una variante: si hay pocas células tumorales, la VAF esperada baja y puede quedar por debajo del límite de detección. Por eso se registra junto a cada muestra.',
  },
  {
    id: 'coverage',
    term: 'Cobertura / profundidad',
    short: 'Número de lecturas de secuenciación que cubren una posición del genoma.',
    why: 'A mayor profundidad, más confianza en detectar variantes con VAF baja y en la precisión de la VAF estimada. Una cobertura baja en una región puede impedir descartar una alteración.',
  },
  {
    id: 'lod',
    term: 'Límite de detección (LoD)',
    short: 'VAF mínima que un ensayo detecta de forma fiable según su validación.',
    why: 'Un resultado "no detectado" sólo significa que no se detectó por encima de ese límite en esa muestra.',
  },
  {
    id: 'snv',
    term: 'SNV (variante de un solo nucleótido)',
    short: 'Cambio de una única base del ADN (p. ej. c.2573T>G).',
    why: 'Puede cambiar un aminoácido de la proteína (p. ej. p.Leu858Arg). Su efecto depende de la posición y del gen, por lo que se contrasta con bases de conocimiento.',
  },
  {
    id: 'indel',
    term: 'Indel',
    short: 'Pequeña inserción o deleción de bases.',
    why: 'Si no es múltiplo de tres puede desplazar el marco de lectura; si lo es, puede eliminar o añadir aminoácidos manteniendo el marco.',
  },
  {
    id: 'cnv',
    term: 'CNV (variación en el número de copias)',
    short: 'Ganancia (amplificación) o pérdida (deleción) de copias de un gen o región.',
    why: 'Puede aumentar o anular la dosis de un gen. Su estimación por NGS depende de la celularidad tumoral y del método.',
  },
  {
    id: 'fusion',
    term: 'Fusión génica',
    short: 'Unión de dos genes por un reordenamiento cromosómico, que puede producir una proteína quimérica.',
    why: 'Se detecta mejor en ARN (NGS ARN, RNA-seq) o con FISH/IHQ; un panel sólo de ADN puede no capturarla.',
  },
  {
    id: 'pathway',
    term: 'Pathway (ruta biológica)',
    short: 'Conjunto de moléculas e interacciones que llevan a cabo una función celular (p. ej. señalización MAPK).',
    why: 'Situar un gen en sus rutas ayuda a entender el contexto biológico de una alteración. En MolPath sólo se muestran pertenencias gen→pathway trazables a una fuente (Reactome).',
  },
  {
    id: 'ihc',
    term: 'Inmunohistoquímica (IHQ)',
    short: 'Técnica que detecta proteínas en el tejido con anticuerpos, conservando la morfología.',
    why: 'Informa del linaje celular y de la expresión de proteínas. Los resultados dependen del clon del anticuerpo, la plataforma y el sistema de puntuación utilizado.',
  },
  {
    id: 'hgvs',
    term: 'Nomenclatura HGVS',
    short: 'Estándar internacional para describir variantes: "c." a nivel de ADN codificante y "p." a nivel de proteína.',
    why: 'Permite comparar la misma variante entre informes y bases de datos. MolPath normaliza p.Leu858Arg y p.L858R a la misma forma para compararlas.',
  },
  {
    id: 'tmb',
    term: 'TMB (carga mutacional tumoral)',
    short: 'Número de mutaciones por megabase de ADN secuenciado.',
    why: 'Resume cuánta variación somática acumula un tumor. Su valor depende del tamaño del panel y del método de cálculo, por lo que no es directamente comparable entre laboratorios.',
  },
  {
    id: 'msi',
    term: 'MSI (inestabilidad de microsatélites)',
    short: 'Cambios en la longitud de secuencias repetitivas del ADN por fallo del sistema de reparación de apareamientos (MMR).',
    why: 'Refleja un mecanismo de reparación deficiente, que también puede estudiarse por IHQ de las proteínas MMR (MLH1, PMS2, MSH2, MSH6).',
  },
  {
    id: 'evidence-level',
    term: 'Niveles de evidencia y certeza',
    short: 'Clasificación de cuán sólida es la base de una afirmación científica.',
    why: 'MolPath nunca inventa un nivel: procede de la fuente (con regla de mapeo documentada) o de una clasificación explícita del usuario. "Contradictoria" indica registros de fuentes con direcciones opuestas para la misma afirmación.',
  },
  {
    id: 'germline-somatic',
    term: 'Germinal frente a somático',
    short: 'Germinal: presente desde el nacimiento en todas las células. Somático: adquirido en el tumor.',
    why: 'Tienen implicaciones muy distintas, por eso MolPath mantiene separadas las interpretaciones germinales (p. ej. ClinVar germinal) de las somáticas/oncológicas.',
  },
];

export const GLOSSARY_BY_ID = Object.fromEntries(GLOSSARY.map((g) => [g.id, g]));
