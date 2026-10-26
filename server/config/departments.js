/** Departamentos de Colombia (con Bogotá D.C.). Los nombres coinciden con `region` de las cooperativas. */
const DEPARTMENTS = [
  'Amazonas',
  'Antioquia',
  'Arauca',
  'Atlántico',
  'Bogotá D.C.',
  'Bolívar',
  'Boyacá',
  'Caldas',
  'Caquetá',
  'Casanare',
  'Cauca',
  'Cesar',
  'Chocó',
  'Córdoba',
  'Cundinamarca',
  'Guainía',
  'Guaviare',
  'Huila',
  'La Guajira',
  'Magdalena',
  'Meta',
  'Nariño',
  'Norte de Santander',
  'Putumayo',
  'Quindío',
  'Risaralda',
  'San Andrés y Providencia',
  'Santander',
  'Sucre',
  'Tolima',
  'Valle del Cauca',
  'Vaupés',
  'Vichada',
];

const fold = (text) =>
  String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

const byFolded = new Map(DEPARTMENTS.map((name) => [fold(name), name]));

/** Devuelve el nombre oficial si el texto corresponde a un departamento (sin importar tildes ni mayúsculas); si no, null. */
function canonicalDepartment(value) {
  if (value == null || value === '') return null;
  return byFolded.get(fold(value)) || null;
}

module.exports = { DEPARTMENTS, canonicalDepartment };
