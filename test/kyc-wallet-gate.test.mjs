import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldOfferKycWithoutWallet} from '../src/kyc-wallet-gate.mjs';

const mode=(accountVerified,walletProfileState,kycStatus)=>
  shouldOfferKycWithoutWallet({accountVerified,walletProfileState,kycStatus});

test('authenticated pending KYC remains accessible without financial profile',()=>{
  assert.equal(mode(true,'unavailable','pending'),true);
  assert.equal(mode(true,'unavailable','in_review'),true);
  assert.equal(mode(true,'unavailable','rejected'),true);
});
test('no wallet-profile fallback before authenticated /user/me confirmation',()=>{
  assert.equal(mode(false,'unavailable','pending'),false);
  assert.equal(mode(undefined,'unavailable','pending'),false);
  assert.equal(mode(true,'checking','pending'),false);
  assert.equal(mode(true,'available','pending'),false);
});
test('wallet-profile failure never presents an unnecessary KYC CTA to approved users',()=>{
  assert.equal(mode(true,'unavailable','approved'),false);
  assert.equal(mode(true,'unavailable',null),false);
  assert.equal(mode(true,'unavailable','unknown'),false);
});
test('unverified fallback values cannot grant access',()=>{
  assert.equal(mode('true','unavailable','pending'),false);
  assert.equal(shouldOfferKycWithoutWallet(),false);
});
