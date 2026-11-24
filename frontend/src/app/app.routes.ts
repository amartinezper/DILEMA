import { Routes } from '@angular/router';
import { rolGuard } from './core/guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'ingreso' },
  { path: 'demo-personaje', loadComponent: () => import('./pages/demo-personaje.component').then(m => m.DemoPersonajeComponent) },
  { path: 'ingreso', loadComponent: () => import('./pages/ingreso.component').then(m => m.IngresoComponent) },
  { path: 'estudiante', canActivate: [rolGuard('ESTUDIANTE')], loadComponent: () => import('./pages/estudiante.component').then(m => m.PanelEstudianteComponent) },
  // Briefing: portada y presentación del caso, reglas y "Iniciar simulación" (el reloj empieza al iniciar).
  { path: 'estudiante/sesion/:id', canActivate: [rolGuard('ESTUDIANTE')], loadComponent: () => import('./pages/estudiante.component').then(m => m.BriefingComponent) },
  { path: 'estudiante/participacion/:id', canActivate: [rolGuard('ESTUDIANTE')], loadComponent: () => import('./pages/estudiante.component').then(m => m.SimulacionComponent) },
  { path: 'estudiante/avisos', canActivate: [rolGuard('ESTUDIANTE')], loadComponent: () => import('./pages/estudiante.component').then(m => m.AvisosComponent) },
  { path: 'docente', canActivate: [rolGuard('PROFESOR')], loadComponent: () => import('./pages/docente.component').then(m => m.PanelDocenteComponent) },
  { path: 'docente/casos', canActivate: [rolGuard('PROFESOR')], loadComponent: () => import('./pages/docente.component').then(m => m.CasosComponent) },
  { path: 'docente/casos/nuevo', canActivate: [rolGuard('PROFESOR')], loadComponent: () => import('./pages/docente.component').then(m => m.EditorCasoComponent) },
  { path: 'docente/casos/:id', canActivate: [rolGuard('PROFESOR')], loadComponent: () => import('./pages/docente.component').then(m => m.EditorCasoComponent) },
  { path: 'docente/grupos', canActivate: [rolGuard('PROFESOR')], loadComponent: () => import('./pages/docente.component').then(m => m.GruposComponent) },
  { path: 'docente/programar', canActivate: [rolGuard('PROFESOR')], loadComponent: () => import('./pages/docente.component').then(m => m.ProgramarComponent) },
  { path: 'docente/seguimiento', canActivate: [rolGuard('PROFESOR')], loadComponent: () => import('./pages/docente.component').then(m => m.SeguimientoComponent) },
  { path: 'docente/seguimiento/:id', canActivate: [rolGuard('PROFESOR')], loadComponent: () => import('./pages/docente.component').then(m => m.DetalleParticipacionComponent) },
  { path: 'docente/perfil', canActivate: [rolGuard('PROFESOR')], loadComponent: () => import('./pages/admin.component').then(m => m.PerfilComponent) },
  { path: 'admin', canActivate: [rolGuard('ADMIN')], loadComponent: () => import('./pages/admin.component').then(m => m.PanelAdminComponent) },
  { path: 'admin/usuarios', canActivate: [rolGuard('ADMIN')], loadComponent: () => import('./pages/admin.component').then(m => m.UsuariosComponent) },
  { path: 'admin/usuarios/nuevo', canActivate: [rolGuard('ADMIN')], loadComponent: () => import('./pages/admin.component').then(m => m.CrearUsuarioComponent) },
  { path: 'admin/usuarios/:id', canActivate: [rolGuard('ADMIN')], loadComponent: () => import('./pages/admin.component').then(m => m.PermisosDocenteComponent) },
  { path: 'admin/estudiantes/nuevo', canActivate: [rolGuard('ADMIN')], loadComponent: () => import('./pages/admin.component').then(m => m.CrearEstudianteComponent) },
  { path: 'admin/estudiantes', canActivate: [rolGuard('ADMIN')], loadComponent: () => import('./pages/admin.component').then(m => m.EstudiantesComponent) },
  { path: 'admin/grupos', canActivate: [rolGuard('ADMIN')], loadComponent: () => import('./pages/admin.component').then(m => m.GruposAdminComponent) },
  { path: 'admin/perfil', canActivate: [rolGuard('ADMIN')], loadComponent: () => import('./pages/admin.component').then(m => m.PerfilComponent) },
  { path: '**', redirectTo: 'ingreso' }
];
