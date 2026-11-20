/**
 * Fail-closed identity-bound read-only Nexa Maya benefit contract.
 * This is NOT an Agentics capability/authorization contract.
 */
export function parseMayaAgenticsBenefits(raw, expectedUserId) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
      typeof expectedUserId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(expectedUserId) ||
      raw.contract !== 'nexa-maya-agentics-benefits-v1' ||
      raw.actorUserId !== expectedUserId ||
      raw.mayaGeneralAccess !== true ||
      raw.mayaAgenticsPremiumBenefit !== true ||
      typeof raw.premiumActive !== 'boolean' ||
      raw.agenticsPilotStatus !== 'under_homologation' ||
      raw.previewAvailable !== false ||
      raw.reviewRequired !== true ||
      raw.externalEffects !== false ||
      raw.financialExecution !== false) {
    return null;
  }
  return Object.freeze({premiumActive:raw.premiumActive,previewAvailable:false,verified:true});
}

/** Only enable after the authenticated backend benefits endpoint is deployed. */
export const MAYA_BENEFITS_DISCOVERY_ENABLED =
  import.meta.env.VITE_NEXA_MAYA_BENEFITS_DISCOVERY_ENABLED === 'true';
