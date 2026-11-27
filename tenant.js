import { app } from "@azure/functions";
import { createTenantHandler } from "../tenant-handler.js";

app.http("tenantLookup", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "tenant",
  handler: createTenantHandler(),
});
