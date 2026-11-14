//! NEP-297 events. The licence token mint uses near-contract-standards' own event type, unchanged. The crate has no
//! nft_metadata_update, so it's written here exactly as NEP-171 defines it (standard "nep171", version "1.2.0",
//! data [{ "token_ids": [...] }]): a log line telling indexers and wallets to re-read the token, nothing stored.

use near_contract_standards::non_fungible_token::events::NftMint;
use near_sdk::{env, AccountId};

pub(crate) fn emit_mint(owner: &AccountId, token_id: &str) {
    NftMint { owner_id: owner, token_ids: &[token_id], memo: None }.emit();
}

/// The token's computed metadata (status, renders, money) changed: re-read it.
/// Token ids are licence ids (digits only), so the JSON is written in the spec's field order without escaping.
pub(crate) fn emit_metadata_update(token_id: &str) {
    env::log_str(&format!(
        r#"EVENT_JSON:{{"standard":"nep171","version":"1.2.0","event":"nft_metadata_update","data":[{{"token_ids":["{token_id}"]}}]}}"#
    ));
}
