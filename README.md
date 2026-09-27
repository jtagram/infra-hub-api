# infra-hub-api

## Variables de entorno

La app requiere las siguientes variables de entorno para arrancar (definidas y
validadas en `src/common/config/env.validation.ts`; si falta alguna, el
proceso no arranca):

- `SERVER_SSH_HOST`
- `SERVER_SSH_USER`
- `SERVER_SSH_PRIVATE_KEY`
- `PORT`
- `LOG_LEVEL`
- `DB_HOST`
- `DB_PORT`
- `DB_USERNAME`
- `DB_PASSWORD`
- `DB_NAME`
- `IAM_API_URL`
- `INFRA_HUB_API_APPLICATION_NAME`

## Cómo obtener cada una

### `SERVER_SSH_HOST` / `SERVER_SSH_USER` / `SERVER_SSH_PRIVATE_KEY`

Datos de acceso SSH al servidor real `pcbox`, contra el que `AnsibleService`
ejecuta los playbooks. El host es la IP de Tailscale de `pcbox`, el usuario
es el configurado para el acceso por SSH, y la clave privada es la misma
`deploy_key` documentada en `wiki-hub/pcbox/pcbox.bootstrap.md`.

### `PORT`

Puerto en el que escucha el proceso de Nest.

### `LOG_LEVEL`

Nivel de log de Pino: `trace`, `debug`, `info`, `warn`, `error` o `fatal`.

### `DB_HOST` / `DB_PORT` / `DB_USERNAME` / `DB_PASSWORD` / `DB_NAME`

Datos de conexión a la base de datos propia de `infra-hub-api`. Las
credenciales salen del Secret `postgres-credentials` (ver
`wiki-hub/microk8s/microk8s.secrets.md`); host y puerto son los del Service
de PostgreSQL dentro del namespace del cluster, y el nombre es el de la
base creada específicamente para `infra-hub-api`.

### `IAM_API_URL`

URL desde la que `infra-hub-api` alcanza a `iam-api`, usada para pedirle por
HTTP (`GET /auth/public-key`) la clave pública RSA con la que se validan los
tokens que emite `iam-api`.

### `INFRA_HUB_API_APPLICATION_NAME`

Nombre exacto (columna `name`) de la aplicación "infra-hub-api" tal como está
registrada en la base de datos de `iam-api` (tabla `apps_applications`). Lo
usa `RolesGuard` para verificar que el token recibido fue emitido para esta
aplicación.
