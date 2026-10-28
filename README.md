# DILEMA — Simulador de psicología social

Aplicación de Spring Boot, Angular, PostgreSQL y correo. El código vive en https://github.com/amartinezper/DILEMA. Se levanta con Docker.

## Stack

- Java 21 y Spring Boot
- Spring Data JPA y PostgreSQL
- Spring Security
- API REST
- Angular y Angular Material
- Correo SMTP (Mailpit en el entorno local)

## Ejecutar

```powershell
git clone https://github.com/amartinezper/DILEMA.git
cd DILEMA
docker compose up --build
```

- Interfaz: http://localhost:4200
- API: http://localhost:8080/api/salud
- Bandeja de correo: http://localhost:8025

## Cuentas de demostración

| Rol | Correo | Acceso |
|-----|--------|--------|
| Estudiante | estudiante@psicosim.edu | código `DILEMA-2026` |
| Docente | docente@psicosim.edu | `docente123` |
| Administración | admin@psicosim.edu | `admin123` |
