# Installeren op Azure Static Web Apps Free

Deze versie gebruikt een Managed Azure Function op `/api/tenant`. Je hebt geen aparte App Service of permanent draaiende Node-server nodig. De vormgeving is behouden. Deze ZIP vervangt de eerdere versie met `server.js`.

## 1. Graph-appregistratie controleren

- API permissions > Microsoft Graph > **Application permissions**: `CrossTenantInformation.ReadBasic.All`.
- Verleen **Grant admin consent** voor je tenant.
- Noteer de Directory (tenant) ID, Application (client) ID en secret **Value**. De secret-ID is niet de juiste waarde.

## 2. Gegevens in Azure opslaan

Open je Static Web App in Azure > Settings > Environment variables. Selecteer productie en voeg toe:

| Naam | Waarde |
| --- | --- |
| `ENTRA_TENANT_ID` | Directory (tenant) ID van jouw appregistratie |
| `ENTRA_CLIENT_ID` | Application (client) ID |
| `ENTRA_CLIENT_SECRET` | Client secret Value |

Klik op Apply. Zet deze waarden niet in de repository, workflow of frontend. De Graph-secret hoeft geen repository secret te worden. Houd de verloopdatum bij en vervang de secret tijdig in Azure.

Laat `assets/config.js` ongewijzigd: `window.TENANT_LOOKUP_API_BASE = "";`. De API draait op dezelfde website; een apart API-adres en CORS-configuratie zijn niet nodig.

## 3A. Zelfstandige Static Web App

Gebruik dit wanneer Azure rechtstreeks de TenantLookupTool-repository deployt.

1. Plaats de **inhoud** van deze projectmap in de root van je repository. Verwijder de oude `server.js` en `.env.example` als die nog aanwezig zijn.
2. Gebruik Static Web Apps **Free** met Managed Functions.
3. Kopieer het **deployment token** van de Static Web App uit Azure. Maak in GitHub > Settings > Secrets and variables > Actions een repository secret `AZURE_STATIC_WEB_APPS_API_TOKEN` met dit token. Dit is een ander geheim dan de Graph-secret.
4. Maak op het tabblad Variables een repository variable `SWA_DEPLOY_ENABLED` met waarde `true`.
5. De meegeleverde `.github/workflows/azure-static-web-apps.yml` test en deployt bij push naar `main`. Je kunt ook Actions > Run workflow gebruiken.
6. Als er al een Azure-deploymentworkflow bestaat voor dezelfde site, vervang die of werk die bij; laat niet twee workflows dezelfde website deployen.

De workflow gebruikt Node 22, test de code en bouwt `dist/` met alleen publieke bestanden. Azure bouwt de API uit `api/`. `staticwebapp.config.json` stelt de runtime in op `node:22`.

De oorspronkelijke mirror-workflow is behouden. Gebruik daarvoor nog steeds `COLLECTIVE_TOOLS_REPO`. Als je uitsluitend zelfstandig host, schakel de mirror-workflow via GitHub Actions uit.

## 3B. Je bestaande verzamelwebsite `swa-jv-toolspage`

De oorspronkelijke workflow kopieert de tool naar `tenantlookuptool/` in `JustinVerstijnen/swa-jv-toolspage`. Voor deze route laat je `SWA_DEPLOY_ENABLED` in de bronrepository weg. De deployment gebeurt in de **verzamelrepository**.

De mirror kopieert de API-code mee en sluit `node_modules`, `dist`, `.env` en `local.settings.json` uit. De secret `COLLECTIVE_TOOLS_REPO` blijft nodig.

Voeg in het `with`-blok van `Azure/static-web-apps-deploy@v1` in de bestaande deploymentworkflow van de verzamelrepository toe:

```yaml
api_location: "tenantlookuptool/api"
```

Laat het `app_location` van je verzamelwebsite intact. Voeg in het **centrale** `staticwebapp.config.json`, met behoud van bestaande instellingen, toe:

```json
"platform": { "apiRuntime": "node:22" }
```

Dat centrale bestand moet in de root van het gepubliceerde frontend-artifact staan. Bij een bestaande `navigationFallback` voeg je `/api/*` toe aan de `exclude`-lijst, zodat API-aanvragen geen HTML terugkrijgen.

Publiceer van deze tool alleen `index.html` en `assets/` in de publieke map `/tenantlookuptool/`. Je kunt hiervoor eerst `node tenantlookuptool/scripts/build.mjs` uitvoeren en de publieke bestanden uit `tenantlookuptool/dist/` gebruiken. Het configbestand in die submap vervangt niet de centrale websiteconfiguratie. Houd de API-bronmap apart beschikbaar voor `api_location`.

De frontend werkt ook in een submap: de API-aanvraag gaat altijd naar `/api/tenant`, niet `/tenantlookuptool/api/tenant`.

**Heeft de verzamelwebsite al een API?** Vervang het bestaande `api_location` dan niet blind. Static Web Apps heeft één API-project: integreer de functie en de dependency `@azure/functions` dan in het bestaande compatibele Functions-project. De deploymentworkflow en eventuele API van de verzamelwebsite zaten niet in de aangeleverde ZIP; deze integratie is dus niet ter plaatse aangepast of getest.

## 4. Testen na deployment

1. Controleer dat de GitHub Action slaagt.
2. Zoek een bekend domein, bijvoorbeeld `microsoft.com`.
3. Kopieer het gevonden Tenant ID en zoek daarmee opnieuw. Het resultaat toont het standaarddomein en de organisatienaam.
4. Eventueel kun je rechtstreeks openen: `https://jouw-site/api/tenant?id=72f988bf-86f1-41af-91ab-2d7cd011db47`.

De API toont één standaarddomein, niet alle domeinen. Ontbrekende waarden verschijnen als `Not available`. De lookup gebruikt de wereldwijde Microsoft-cloud.

| Probleem | Controle |
| --- | --- |
| 503 / not configured | De drie Azure-variabelen ontbreken of de ID's hebben geen GUID-formaat. |
| 502 / service unavailable | Controleer secret Value, verloopdatum, app-ID en tenant-ID. Ook een tijdelijke storing kan dit veroorzaken. |
| 502 / Microsoft could not complete | Controleer Application permission en admin consent. |
| 404 met HTML | Controleer `api_location`, deployment en fallbackregels. |
| 404 met JSON `Tenant not found` | Microsoft Graph kent het ID niet. |
| 429 | Wacht even; Microsoft beperkt het aantal aanvragen. |

## Lokaal ontwikkelen

Installeer Node 22 en voer uit:

```sh
npm ci --prefix api
npm test
npm run build
```

Voor een lokale echte API installeer je ook Azure Functions Core Tools v4 en de Azure Static Web Apps CLI. Kopieer `api/local.settings.example.json` naar `api/local.settings.json`, vul de drie waarden in en start `swa start dist --api-location api`. Open het adres dat de CLI toont. Het lokale instellingenbestand wordt uitgesloten van Git en deployment.

De 19 tests gebruiken gesimuleerde Microsoft-antwoorden. Ze zijn lokaal uitgevoerd met Node 24; de deployment is geconfigureerd voor Node 22 en voert de tests daarop opnieuw uit. Er is nog geen Azure-deployment of live Graph-test met jouw secret uitgevoerd.

## Bronnen

- [Free-plan en Managed Functions](https://learn.microsoft.com/en-us/azure/static-web-apps/plans)
- [Environment variables](https://learn.microsoft.com/en-us/azure/static-web-apps/application-settings)
- [Deploymentworkflow](https://learn.microsoft.com/en-us/azure/static-web-apps/build-configuration)
- [Microsoft Graph tenant lookup](https://learn.microsoft.com/en-us/graph/api/tenantrelationship-findtenantinformationbytenantid?view=graph-rest-1.0)
