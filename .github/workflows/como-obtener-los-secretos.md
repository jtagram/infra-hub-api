# Cómo obtener los secretos del workflow de local

Guía paso a paso para conseguir el valor listado en [secrets.github-action.example](secrets.github-action.example)
y cargarlo como secreto del environment `local` en GitHub Actions
(Settings > Environments > local > Add environment secret).

El workflow [release-infra-hub-api-local.yml](release-infra-hub-api-local.yml) solo dispara el deploy en
`deploy-hub-api`. La compilación, la publicación de la imagen y el deploy corren
allá, por eso los secretos de Docker Hub, kubeconfig y Tailscale se cargan en
`deploy-hub-api` y no en este repo.

## DISPATCH_DEPLOY_HUB_API_LOCAL

Lo usa `gh workflow run` (como `GH_TOKEN`) para disparar el workflow
`deploy-infra-hub-api-local.yml` en `deploy-hub-api`.

1. Entrá a GitHub > Settings (de tu cuenta) > Developer settings >
   Personal access tokens > Fine-grained tokens > Generate new token.
2. Resource owner: la cuenta/organización dueña de `deploy-hub-api`.
3. Repository access: Only select repositories > `deploy-hub-api`.
4. Permissions > Repository permissions:
   - `Actions`: Read and write (necesario para disparar el workflow).
   - `Contents`: Read-only (para resolver el ref).
5. Generá el token y copialo apenas se muestre.
6. Guardalo como `DISPATCH_DEPLOY_HUB_API_LOCAL` en el environment `local` de
   **este** repo (no en `deploy-hub-api`).

> Si el dispatch falla con `HTTP 403: Resource not accessible by personal
> access token`, típicamente el token no tiene `Actions: Read and write`
> sobre `deploy-hub-api` — revisá el paso 4.
