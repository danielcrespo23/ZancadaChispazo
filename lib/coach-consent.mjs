export const AI_CONSENT_VERSION=1;
export const hasAIConsent=state=>state?.settings?.aiConsent?.enabled===true&&state.settings.aiConsent.version===AI_CONSENT_VERSION;
export function withAIConsent(state,enabled){return {...state,settings:{...state.settings,aiConsent:{version:AI_CONSENT_VERSION,enabled:enabled===true,updatedAt:new Date().toISOString(),scope:'manual-profile-plan-and-activities'}}};}
