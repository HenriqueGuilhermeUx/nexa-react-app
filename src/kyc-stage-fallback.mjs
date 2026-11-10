// Minimal, read-only recovery of the verification step when the lifecycle
// summary is unavailable. Trust only the authenticated Didit /me response.
// No financial stage is inferred or enabled from this fallback.
export function kycRecoverySnapshot(value) {
  if (!value || value.success !== true || value.provider !== 'didit') return null;
  const status = String(value.kycStatus || '').trim().toLowerCase();
  if (!['pending', 'in_review', 'rejected'].includes(status)) return null;

  const needsReview = status === 'in_review' || value.manualReviewRequired === true;
  const stage = status === 'rejected' ? 'kyc_assistance'
    : needsReview ? 'kyc_review' : 'kyc';
  const nextAction = stage === 'kyc'
    ? {
        title: 'Próximo passo: verificar sua identidade',
        description: 'Sua conta está criada. Autorize a verificação e continue no ambiente seguro da Didit. Você não precisa depositar para iniciar.',
      }
    : {
        title: 'Verificação em acompanhamento',
        description: 'Consulte a situação da sua identidade. Se houver análise ou pendência, peça orientação ao atendimento Nexa.',
      };
  return {
    success: true,
    recoveryOnly: true,
    stage,
    nextAction,
    milestones: {
      identity: stage === 'kyc' ? 'pending'
        : stage === 'kyc_review' ? 'in_review' : 'needs_support',
    },
    educationalContent: [],
  };
}
