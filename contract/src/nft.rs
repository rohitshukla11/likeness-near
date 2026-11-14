//! NEP-171 / 177 / 181, written by hand over the licence records. A token exists only once its licence is approved;
//! token_id = licence_id, owner = the brand. Tokens can't be transferred (no approvals either), and revoking never
//! burns one: its status, computed on every read, says Revoked, so the token keeps the licence's history.
//!
//! Everything in the metadata is computed on every read from the stored licence (nothing extra is stored): the status,
//! the money (paid to the creator, reserved now, refundable to the brand when the licence ends) and `media`, a small
//! SVG (a data URI) drawn from those values, with `media_hash` = base64(sha256) of exactly the SVG returned. So the
//! image flips to REVOKED / EXPIRED / EXHAUSTED by itself, with no write; the calls that change it log an NEP-171
//! nft_metadata_update event (events.rs) so wallets and indexers re-read it.

use crate::views::money;
use crate::*;
use near_contract_standards::non_fungible_token::metadata::{NFTContractMetadata, TokenMetadata, NFT_METADATA_SPEC};
use near_contract_standards::non_fungible_token::Token;
use near_sdk::json_types::{Base64VecU8, U128};
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

/// yoctoNEAR → "0.04 NEAR" (up to 4 decimals, trailing zeros dropped).
pub(crate) fn near_text(yocto: u128) -> String {
    const ONE: u128 = 10u128.pow(24);
    let whole = yocto / ONE;
    let frac = (yocto % ONE) / 10u128.pow(20);
    if frac == 0 {
        return format!("{whole} NEAR");
    }
    let f = format!("{frac:04}");
    format!("{whole}.{} NEAR", f.trim_end_matches('0'))
}

fn xml(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            _ => out.push(c),
        }
    }
    out
}

/// An account id for one SVG line: at most 34 characters, then "…".
fn short(a: &AccountId) -> String {
    let s = a.as_str();
    if s.chars().count() <= 34 {
        xml(s)
    } else {
        format!("{}…", xml(&s.chars().take(33).collect::<String>()))
    }
}

fn badge(s: LicenceStatus) -> (&'static str, &'static str) {
    match s {
        LicenceStatus::Active => ("ACTIVE", "#1f8a3b"),
        LicenceStatus::Revoked => ("REVOKED", "#c62828"),
        LicenceStatus::Expired => ("EXPIRED", "#6b6b6b"),
        LicenceStatus::Exhausted => ("EXHAUSTED", "#6b6b6b"),
        LicenceStatus::Pending => ("PENDING", "#6b6b6b"),
        LicenceStatus::Declined => ("DECLINED", "#6b6b6b"),
    }
}

/// The token's image: plain shapes and text, no external fonts or images, well under 2 KB.
pub(crate) fn licence_svg(id: u64, l: &Licence, status: LicenceStatus, paid: u128, expires: u64) -> String {
    let (label, colour) = badge(status);
    let line =
        |y: u32, k: &str, v: &str| format!(r##"<text x="24" y="{y}" fill="#bbb" font-size="14">{k}<tspan fill="#fff">{v}</tspan></text>"##);
    let mut s = String::with_capacity(1600);
    s.push_str(r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" font-family="sans-serif">"#);
    s.push_str(r##"<rect width="400" height="300" rx="18" fill="#111"/>"##);
    s.push_str(&format!(r##"<text x="24" y="42" fill="#fff" font-size="22" font-weight="700">Likeness licence #{id}</text>"##));
    s.push_str(&format!(r#"<rect x="24" y="60" width="352" height="64" rx="12" fill="{colour}"/>"#));
    s.push_str(&format!(r##"<text x="200" y="104" fill="#fff" font-size="34" font-weight="700" text-anchor="middle">{label}</text>"##));
    s.push_str(&line(156, "Creator: ", &short(&l.creator)));
    s.push_str(&line(180, "Brand: ", &short(&l.brand)));
    s.push_str(&line(204, "Use: ", &xml(use_label(l.usage))));
    s.push_str(&line(228, "Renders: ", &format!("{} used of {}", l.renders_used, l.render_cap)));
    s.push_str(&line(252, "Paid to creator: ", &near_text(paid)));
    s.push_str(&line(276, "Expires: ", &day(expires)));
    s.push_str("</svg>");
    s
}

/// Standard base64 with padding (the data URI).
pub(crate) fn base64(b: &[u8]) -> String {
    const A: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(b.len().div_ceil(3) * 4);
    for c in b.chunks(3) {
        let n = (c[0] as u32) << 16 | (*c.get(1).unwrap_or(&0) as u32) << 8 | *c.get(2).unwrap_or(&0) as u32;
        out.push(A[(n >> 18) as usize & 63] as char);
        out.push(A[(n >> 12) as usize & 63] as char);
        out.push(if c.len() > 1 { A[(n >> 6) as usize & 63] as char } else { '=' });
        out.push(if c.len() > 2 { A[n as usize & 63] as char } else { '=' });
    }
    out
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
        let (paid, reserved) = money(l);
        let svg = licence_svg(id, l, status, paid, expires);
        let media_hash = env::sha256_array(svg.as_bytes());
        let extra = json!({
            "creator": l.creator,
            "brand": l.brand,
            "use": l.usage,
            "price_per_render": U128(l.price),
            "render_cap": l.render_cap,
            "renders_used": l.renders_used,
            "renders_reserved": l.renders_reserved,
            "paid_to_creator": U128(paid),
            "reserved": U128(reserved),
            "refundable_on_end": U128(reserved),
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
                media: Some(format!("data:image/svg+xml;base64,{}", base64(svg.as_bytes()))),
                media_hash: Some(Base64VecU8(media_hash.to_vec())),
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
