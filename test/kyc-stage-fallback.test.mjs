import test from 'node:test';
import assert from 'node:assert/strict';
import {kycRecoverySnapshot} from '../src/kyc-stage-fallback.mjs';

const verified = status => ({success:true,provider:'didit',kycStatus:status});
test('pending authenticated Didit profile retains a manual KYC action',()=>{
  const result=kycRecoverySnapshot(verified('pending'));
  assert.equal(result?.stage,'kyc');
  assert.equal(result?.recoveryOnly,true);
  assert.equal(result?.milestones.identity,'pending');
  assert.match(result.nextAction.description,/não precisa depositar/);
  assert.equal(result.educationalEmail,undefined);
});
test('approved identities never receive a repeat KYC CTA',()=>{
  assert.equal(kycRecoverySnapshot(verified('approved')),null);
});
test('manual review is never represented as approval or retry',()=>{
  assert.equal(kycRecoverySnapshot(verified('in_review'))?.stage,'kyc_review');
  assert.equal(kycRecoverySnapshot({...verified('pending'),manualReviewRequired:true})?.stage,'kyc_review');
  assert.equal(kycRecoverySnapshot(verified('rejected'))?.stage,'kyc_assistance');
});
test('untrusted or malformed responses fail closed',()=>{
  for(const value of [null,{}, {kycStatus:'pending'}, {success:true,kycStatus:'pending'}, {success:true,provider:'unknown',kycStatus:'pending'}, verified('unknown')]) {
    assert.equal(kycRecoverySnapshot(value),null);
  }
});
