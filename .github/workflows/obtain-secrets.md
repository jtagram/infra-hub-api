# Cómo obtener los secretos del workflow de release

Guía paso a paso para conseguir los valores listados en [env.secrets.example](env.secrets.example)
y cargarlos como secretos del repositorio en GitHub Actions
(Settings > Secrets and variables > Actions > New repository secret).

## DOCKERHUB_USERNAME

La cuenta/organización de Docker Hub bajo la que se publica la imagen de
pcbox-api.

1. Es el username que figura en tu perfil de [Docker Hub](https://hub.docker.com/)
   (o el nombre de la organización dueña del repositorio de imágenes).
2. Guardalo como `DOCKERHUB_USERNAME`.

## DOCKERHUB_TOKEN

Lo usa el login contra Docker Hub para publicar la imagen, y también el job
que borra los tags viejos después de cada release — por eso necesita permiso
de borrado, no alcanza con "Read & Write".

1. Entrá a [Docker Hub](https://hub.docker.com/) > Account Settings > Security > New Access Token.
2. Access permissions: elegí **Read, Write, Delete**.
3. Copiá el token apenas se muestre — solo se ve una vez.
4. Guardalo como `DOCKERHUB_TOKEN`.

## INFRA_HUB_DISPATCH_TOKEN

Lo usa `gh workflow run` (como `GH_TOKEN`) para disparar el workflow de
deploy en `infra-hub` y después consultar el estado de esa corrida — ver
[dispatch-infra-hub-deploy.sh](../scripts/dispatch-infra-hub-deploy.sh) y
[wait-for-infra-hub-deploy.sh](../scripts/wait-for-infra-hub-deploy.sh).

1. Entrá a GitHub > Settings (de tu cuenta) > Developer settings >
   Personal access tokens > Fine-grained tokens > Generate new token.
2. Resource owner: la cuenta/organización dueña de `infra-hub`.
3. Repository access: Only select repositories > `infra-hub`.
4. Permissions > Repository permissions:
   - `Actions`: Read and write (necesario para disparar el workflow y leer
     el estado de la corrida).
   - `Contents`: Read-only (para resolver el ref).
5. Generá el token y copialo apenas se muestre.
6. Guardalo como `INFRA_HUB_DISPATCH_TOKEN` en **este** repo (no en
   `infra-hub`).

> Si el dispatch falla con `HTTP 403: Resource not accessible by personal
> access token`, típicamente el token no tiene `Actions: Read and write`
> sobre `infra-hub` — revisá el paso 4.
