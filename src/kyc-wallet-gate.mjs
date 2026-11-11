/**
 * KYC recovery is permitted only after /user/me confirmed the current
 * authenticated account. This signal never enables wallet or payment actions.
 */
export function shouldOfferKycWithoutWallet({accountVerified, walletProfileState, kycStatus}={}) {
  if (accountVerified !== true || walletProfileState !== 'unavailable') return false;
  return ['pending','in_review','rejected'].includes(String(kycStatus || '').trim().toLowerCase());
}
