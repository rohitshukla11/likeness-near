//! NEP-171 / 177 / 181, written by hand over the licence records. A token exists only once its licence is approved;
//! token_id = licence_id, owner = the brand. Tokens can't be transferred (no approvals either), and revoking never
//! burns one: its status, computed on every read, says Revoked.

use crate::*;
use near_contract_standards::non_fungible_token::metadata::{NFTContractMetadata, TokenMetadata, NFT_METADATA_SPEC};
use near_contract_standards::non_fungible_token::Token;
use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::PromiseOrValue;
use std::collections::HashMap;

const NON_TRANSFERABLE: &str = "licence tokens are non-transferable";

fn day(ns: u64) -> String {
    // Days since the epoch → YYYY-MM-DD (civil-from-days, proleptic Gregorian).
    let z = (ns / NANOS_PER_DAY) as i64 + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + if m <= 2 { 1 } else { 0 };
    format!("{y:04}-{m:02}-{d:02}")
}

fn use_label(u: Use) -> &'static str {
    match u {
        Use::Fashion => "Fashion",
        Use::Beauty => "Beauty",
        Use::FoodDrink => "Food & drink",
        Use::Tech => "Tech",
        Use::Travel => "Travel",
        Use::Fitness => "Fitness",
        Use::Finance => "Finance & crypto",
        Use::Other => "Other",
    }
}

impl Contract {
    /// The token for a licence, if it has been minted (approved), with metadata computed now.
    pub(crate) fn token_of(&self, id: u64) -> Option<Token> {
        let l = self.licences.get(&id)?;
        let issued = l.issued_at?;
        let expires = l.expires_at.unwrap_or(issued);
        let status = status_at(l, now());
        let extra = json!({
            "creator": l.creator,
            "brand": l.brand,
            "use": l.usage,
            "price_per_render": U128(l.price),
            "render_cap": l.render_cap,
            "renders_used": l.renders_used,
            "expires_at": ms(expires),
            "terms_hash": to_hex(&l.terms_hash),
            "status": status,
        });
        Some(Token {
            token_id: id.to_string(),
            owner_id: l.brand.clone(),
            metadata: Some(TokenMetadata {
                title: Some(format!("Likeness licence #{id}")),
                description: Some(format!(
                    "{} -> {}: {}, {} renders, until {}",
                    l.creator,
                    l.brand,
                    use_label(l.usage),
                    l.render_cap,
                    day(expires)
                )),
                media: None,
                media_hash: None,
                copies: Some(1),
                issued_at: Some(ms(issued).to_string()),
                expires_at: Some(ms(expires).to_string()),
                starts_at: Some(ms(issued).to_string()),
                updated_at: None,
                extra: Some(extra.to_string()),
                reference: None,
                reference_hash: None,
            }),
            approved_account_ids: None,
        })
    }
}

#[near]
impl Contract {
    // ---------------------------------------------------------------- NEP-171 core

    pub fn nft_token(&self, token_id: String) -> Option<Token> {
        token_id.parse::<u64>().ok().and_then(|id| self.token_of(id))
    }

    #[payable]
    #[allow(unused_variables)]
    pub fn nft_transfer(&mut self, receiver_id: AccountId, token_id: String, approval_id: Option<u64>, memo: Option<String>) {
        env::panic_str(NON_TRANSFERABLE)
    }

    #[payable]
    #[allow(unused_variables)]
    pub fn nft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: String,
        approval_id: Option<u64>,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<bool> {
        env::panic_str(NON_TRANSFERABLE)
    }

    #[private]
    #[allow(unused_variables)]
    pub fn nft_resolve_transfer(
        &mut self,
        previous_owner_id: AccountId,
        receiver_id: AccountId,
        token_id: String,
        approved_account_ids: Option<HashMap<AccountId, u64>>,
    ) -> bool {
        env::panic_str(NON_TRANSFERABLE)
    }

    // ---------------------------------------------------------------- NEP-177 metadata

    pub fn nft_metadata(&self) -> NFTContractMetadata {
        NFTContractMetadata {
            spec: NFT_METADATA_SPEC.to_string(),
            name: "Likeness Licence".to_string(),
            symbol: "LIKE".to_string(),
            icon: None,
            base_uri: None,
            reference: None,
            reference_hash: None,
        }
    }

    // ---------------------------------------------------------------- NEP-181 enumeration (limit ≤ 50)

    pub fn nft_total_supply(&self) -> U128 {
        U128(self.minted.len() as u128)
    }

    pub fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> {
        let from = from_index.map(|f| f.0 as u64).unwrap_or(0);
        let take = limit.unwrap_or(MAX_PAGE).min(MAX_PAGE);
        let len = self.minted.len() as u64;
        (from..len.min(from.saturating_add(take))).filter_map(|i| self.minted.get(i as u32).and_then(|id| self.token_of(*id))).collect()
    }

    pub fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 {
        U128(self.index_len_of(IndexKind::OwnerTokens, &account_id) as u128)
    }

    pub fn nft_tokens_for_owner(&self, account_id: AccountId, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> {
        let from = from_index.map(|f| f.0 as u64).unwrap_or(0);
        self.index_page(IndexKind::OwnerTokens, &account_id, from, limit.unwrap_or(MAX_PAGE))
            .into_iter()
            .filter_map(|id| self.token_of(id))
            .collect()
    }
}
