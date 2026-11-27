# TenantLookupTool — Azure Static Web Apps

Lookup Microsoft 365 tenants by domain or Tenant ID, with the existing design preserved.

- Domain lookup uses public Microsoft OpenID metadata.
- Reverse lookup returns the default domain and organization name via Microsoft Graph.
- The API is a Managed Azure Function compatible with Static Web Apps Free (Node 22, Functions programming model v4).
- Graph credentials are stored in Azure application settings, never in frontend code.

Read **[INSTALLATIE.md](INSTALLATIE.md)** for setup, secrets, deployment and integration into the existing collective repository.

## Development

```sh
npm ci --prefix api
npm test
npm run build
```

`index.html` and `assets/` are the frontend sources. `api/` contains the Functions app. The build copies only public files to `dist/`. The standalone deployment workflow is enabled with repository variable `SWA_DEPLOY_ENABLED=true`; the existing mirror workflow is retained for collective hosting.

The public API requires an Entra app registration with application permission `CrossTenantInformation.ReadBasic.All` and admin consent. Set `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID` and `ENTRA_CLIENT_SECRET` in Azure.

Original project by Justin Verstijnen. MIT license; see LICENSE.
