import { z } from "zod";

import { IdentityOidcAuthsSchema } from "@app/db/schemas";
import { EventType } from "@app/ee/services/audit-log/audit-log-types";
import { readLimit, writeLimit } from "@app/server/config/rateLimiter";
import { verifyAuth } from "@app/server/plugins/auth/verify-auth";
import { AuthMode } from "@app/services/auth/auth-type";
import { TIdentityTrustedIp } from "@app/services/identity/identity-types";
import { validateOidcAuthAudiencesField } from "@app/services/identity-oidc-auth/identity-oidc-auth-validators";

const IdentityOidcAuthResponseSchema = IdentityOidcAuthsSchema.omit({
  encryptedCaCert: true,
  caCertIV: true,
  caCertTag: true
}).extend({
  caCert: z.string()
});

export const registerIdentityOidcAuthRouter = async (server: FastifyZodProvider) => {
  server.route({
    method: "POST",
    url: "/oidc-auth/identities/:identityId",
    config: {
      rateLimit: writeLimit
    },
    onRequest: verifyAuth([AuthMode.JWT, AuthMode.IDENTITY_ACCESS_TOKEN]),
    schema: {
      description: "Attach OIDC Auth configuration onto identity",
      security: [
        {
          bearerAuth: []
        }
      ],
      params: z.object({
        identityId: z.string().trim()
      }),
      body: z.object({
        accessTokenTrustedIps: z
          .object({
            ipAddress: z.string().trim()
          })
          .array()
          .min(1)
          .default([{ ipAddress: "0.0.0.0/0" }, { ipAddress: "::/0" }]),
        accessTokenTTL: z
          .number()
          .int()
          .min(1)
          .refine((value) => value !== 0, {
            message: "accessTokenTTL must have a non zero number"
          })
          .default(2592000),
        accessTokenMaxTTL: z
          .number()
          .int()
          .refine((value) => value !== 0, {
            message: "accessTokenMaxTTL must have a non zero number"
          })
          .default(2592000),
        accessTokenNumUsesLimit: z.number().int().min(0).default(0),
        oidcDiscoveryUrl: z.string().url().min(1),
        caCert: z.string().trim().default(""),
        boundIssuer: z.string().min(1),
        boundAudiences: validateOidcAuthAudiencesField,
        boundClaims: z.record(z.string()),
        boundSubject: z.string().optional().default("")
      }),
      response: {
        200: z.object({
          identityOidcAuth: IdentityOidcAuthResponseSchema
        })
      }
    },
    handler: async (req) => {
      const identityOidcAuth = await server.services.identityOidcAuth.attachOidcAuth({
        actor: req.permission.type,
        actorId: req.permission.id,
        actorAuthMethod: req.permission.authMethod,
        actorOrgId: req.permission.orgId,
        ...req.body,
        identityId: req.params.identityId
      });

      await server.services.auditLog.createAuditLog({
        ...req.auditLogInfo,
        orgId: identityOidcAuth.orgId,
        event: {
          type: EventType.ADD_IDENTITY_OIDC_AUTH,
          metadata: {
            identityId: identityOidcAuth.identityId,
            oidcDiscoveryUrl: identityOidcAuth.oidcDiscoveryUrl,
            caCert: identityOidcAuth.caCert,
            boundIssuer: identityOidcAuth.boundIssuer,
            boundAudiences: identityOidcAuth.boundAudiences,
            boundClaims: identityOidcAuth.boundClaims as Record<string, string>,
            boundSubject: identityOidcAuth.boundSubject as string,
            accessTokenTTL: identityOidcAuth.accessTokenTTL,
            accessTokenMaxTTL: identityOidcAuth.accessTokenMaxTTL,
            accessTokenTrustedIps: identityOidcAuth.accessTokenTrustedIps as TIdentityTrustedIp[],
            accessTokenNumUsesLimit: identityOidcAuth.accessTokenNumUsesLimit
          }
        }
      });

      return {
        identityOidcAuth
      };
    }
  });

  server.route({
    method: "PATCH",
    url: "/oidc-auth/identities/:identityId",
    config: {
      rateLimit: writeLimit
    },
    onRequest: verifyAuth([AuthMode.JWT, AuthMode.IDENTITY_ACCESS_TOKEN]),
    schema: {
      description: "Update OIDC Auth configuration on identity",
      security: [
        {
          bearerAuth: []
        }
      ],
      params: z.object({
        identityId: z.string().trim()
      }),
      body: z
        .object({
          accessTokenTrustedIps: z
            .object({
              ipAddress: z.string().trim()
            })
            .array()
            .min(1)
            .default([{ ipAddress: "0.0.0.0/0" }, { ipAddress: "::/0" }]),
          accessTokenTTL: z
            .number()
            .int()
            .min(1)
            .refine((value) => value !== 0, {
              message: "accessTokenTTL must have a non zero number"
            })
            .default(2592000),
          accessTokenMaxTTL: z
            .number()
            .int()
            .refine((value) => value !== 0, {
              message: "accessTokenMaxTTL must have a non zero number"
            })
            .default(2592000),
          accessTokenNumUsesLimit: z.number().int().min(0).default(0),
          oidcDiscoveryUrl: z.string().url().min(1),
          caCert: z.string().trim().default(""),
          boundIssuer: z.string().min(1),
          boundAudiences: validateOidcAuthAudiencesField,
          boundClaims: z.record(z.string()),
          boundSubject: z.string().optional().default("")
        })
        .partial(),
      response: {
        200: z.object({
          identityOidcAuth: IdentityOidcAuthResponseSchema
        })
      }
    },
    handler: async (req) => {
      const identityOidcAuth = await server.services.identityOidcAuth.updateOidcAuth({
        actor: req.permission.type,
        actorId: req.permission.id,
        actorOrgId: req.permission.orgId,
        actorAuthMethod: req.permission.authMethod,
        ...req.body,
        identityId: req.params.identityId
      });

      await server.services.auditLog.createAuditLog({
        ...req.auditLogInfo,
        orgId: identityOidcAuth.orgId,
        event: {
          type: EventType.UPDATE_IDENTITY_OIDC_AUTH,
          metadata: {
            identityId: identityOidcAuth.identityId,
            oidcDiscoveryUrl: identityOidcAuth.oidcDiscoveryUrl,
            caCert: identityOidcAuth.caCert,
            boundIssuer: identityOidcAuth.boundIssuer,
            boundAudiences: identityOidcAuth.boundAudiences,
            boundClaims: identityOidcAuth.boundClaims as Record<string, string>,
            boundSubject: identityOidcAuth.boundSubject as string,
            accessTokenTTL: identityOidcAuth.accessTokenTTL,
            accessTokenMaxTTL: identityOidcAuth.accessTokenMaxTTL,
            accessTokenTrustedIps: identityOidcAuth.accessTokenTrustedIps as TIdentityTrustedIp[],
            accessTokenNumUsesLimit: identityOidcAuth.accessTokenNumUsesLimit
          }
        }
      });

      return { identityOidcAuth };
    }
  });

  server.route({
    method: "GET",
    url: "/oidc-auth/identities/:identityId",
    config: {
      rateLimit: readLimit
    },
    onRequest: verifyAuth([AuthMode.JWT, AuthMode.IDENTITY_ACCESS_TOKEN]),
    schema: {
      description: "Retrieve OIDC Auth configuration on identity",
      security: [
        {
          bearerAuth: []
        }
      ],
      params: z.object({
        identityId: z.string()
      }),
      response: {
        200: z.object({
          identityOidcAuth: IdentityOidcAuthResponseSchema
        })
      }
    },
    handler: async (req) => {
      const identityOidcAuth = await server.services.identityOidcAuth.getOidcAuth({
        identityId: req.params.identityId,
        actor: req.permission.type,
        actorId: req.permission.id,
        actorOrgId: req.permission.orgId,
        actorAuthMethod: req.permission.authMethod
      });

      await server.services.auditLog.createAuditLog({
        ...req.auditLogInfo,
        orgId: identityOidcAuth.orgId,
        event: {
          type: EventType.GET_IDENTITY_OIDC_AUTH,
          metadata: {
            identityId: identityOidcAuth.identityId
          }
        }
      });

      return { identityOidcAuth };
    }
  });
};
