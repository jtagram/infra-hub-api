# Reglas de variables de entorno

- Todas las variables de entorno son **obligatorias**. Ninguna variable nueva puede tener un valor por defecto ni ser opcional (`@IsOptional()` prohibido en este contexto): si falta, la aplicación debe fallar al arrancar.
- Toda variable de entorno debe declararse en `src/common/config/env.validation.ts`, dentro de la clase `EnvironmentVariables`, con sus decoradores de `class-validator` correspondientes (`@IsString()`, `@IsNumberString()`, `@IsIn()`, etc. según el tipo).
- Ningún archivo del proyecto debe leer `process.env` directamente. El único punto de lectura permitido es a través de `ConfigService` (expuesto globalmente por `EnvModule`), inyectado donde se necesite.
- Antes de agregar una variable nueva, verificar que no exista ya una equivalente en `EnvironmentVariables`.
