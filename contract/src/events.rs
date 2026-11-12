//! NEP-297 events. The licence token mint uses near-contract-standards' own event type, unchanged.

use near_contract_standards::non_fungible_token::events::NftMint;
use near_sdk::AccountId;

pub(crate) fn emit_mint(owner: &AccountId, token_id: &str) {
    NftMint { owner_id: owner, token_ids: &[token_id], memo: None }.emit();
}
