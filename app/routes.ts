import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('routes/accueil.tsx'),
  route('classements', 'routes/classements.tsx'),
  route('dates', 'routes/dates.tsx'),
  route('contact', 'routes/contact.tsx'),
  route('mentions-legales', 'routes/mentions-legales.tsx'),
  route('confidentialite', 'routes/confidentialite.tsx'),
  route('noter', 'routes/noter.tsx'),
  route('inscription', 'routes/inscription.tsx'),
  route('inscription/code', 'routes/inscription-code.tsx'),
  route('admin', 'routes/admin.tsx'),
  route('admin/statistiques', 'routes/admin-statistiques.tsx'),
  route('*', 'routes/introuvable.tsx'),
] satisfies RouteConfig;
