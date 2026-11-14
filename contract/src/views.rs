//! Public views: verify(sha256) and the records behind it. All JSON is snake_case, times in ms, u128 as strings.

use crate::*;
use near_sdk::json_types::{U128, U64};

/// What a licence's money looks like now, computed on read (view-only JSON; nothing here is stored).
#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct LicenceSummaryJson {
    pub licence_id: String,
    pub token_id: Option<String>,
    pub status: LicenceStatus,
    pub price_per_render: U128,
    pub render_cap: u32,
    pub renders_used: u32,
    pub renders_reserved: u32,
    pub renders_left: u32,
    /// Every approved render's price, paid to the creator.
    pub paid_to_creator: U128,
    /// The prices of ads waiting for the creator, held in the brand's escrow now.
    pub reserved: U128,
    /// Goes back to the brand's free escrow if the licence ends now (revoke, or release_expired after expiry).
    pub refundable_on_end: U128,
    pub expires_at_ms: Option<u64>,
}

/// (paid to the creator, reserved now) for a licence: price × approved renders, price × renders waiting.
pub(crate) fn money(l: &Licence) -> (u128, u128) {
    (l.price * l.renders_used as u128, l.price * l.renders_reserved as u128)
}

impl Contract {
    pub(crate) fn licence_json(&self, id: u64) -> Option<LicenceJson> {
        let l = self.licences.get(&id)?;
        Some(LicenceJson {
            id: id.to_string(),
            token_id: l.issued_at.map(|_| id.to_string()),
            creator: l.creator.clone(),
            brand: l.brand.clone(),
            usage: l.usage,
            price: U128(l.price),
            render_cap: l.render_cap,
            renders_used: l.renders_used,
            renders_reserved: l.renders_reserved,
            state: l.state,
            status: status_at(l, now()),
            requested_at_ms: ms(l.requested_at),
            issued_at_ms: l.issued_at.map(ms),
            expires_at_ms: l.expires_at.map(ms),
            terms_hash: to_hex(&l.terms_hash),
        })
    }

    fn receipt_json(sha: &Sha, r: &Receipt) -> ReceiptJson {
        ReceiptJson {
            sha256: to_hex(sha),
            licence_id: r.licence_id.to_string(),
            amount: U128(r.amount),
            face_check: r.face_check,
            status: r.status,
            created_at_ms: ms(r.created_at),
            decided_at_ms: r.decided_at.map(ms),
        }
    }
}

#[near]
impl Contract {
    /// Licensed if the creator approved this exact file and its licence is Active or Exhausted; Expired / Revoked if
    /// approved but the licence has ended or was revoked; Unknown otherwise (never submitted, waiting, rejected or
    /// released). Uses the same status function as the licence token.
    pub fn verify(&self, sha256: String) -> VerifyJson {
        let sha = parse_sha(&sha256);
        let Some(r) = self.receipts.get(&sha) else {
            return VerifyJson { sha256, verdict: Verdict::Unknown, token_id: None, licence: None, receipt: None };
        };
        let licence = self.licence_json(r.licence_id);
        let verdict = match (r.status, licence.as_ref().map(|l| l.status)) {
            (ReceiptStatus::Approved, Some(LicenceStatus::Active | LicenceStatus::Exhausted)) => Verdict::Licensed,
            (ReceiptStatus::Approved, Some(LicenceStatus::Expired)) => Verdict::Expired,
            (ReceiptStatus::Approved, Some(LicenceStatus::Revoked)) => Verdict::Revoked,
            _ => Verdict::Unknown,
        };
        VerifyJson {
            sha256,
            verdict,
            token_id: licence.as_ref().and_then(|l| l.token_id.clone()),
            licence,
            receipt: Some(Self::receipt_json(&sha, r)),
        }
    }

    pub fn get_creator(&self, account_id: AccountId) -> Option<CreatorJson> {
        self.creators.get(&account_id).map(|c| CreatorJson {
            account_id: account_id.clone(),
            terms: c.terms.clone(),
            capture_sha256: (c.capture_sha256 != [0u8; 32]).then(|| to_hex(&c.capture_sha256)),
            active: c.active,
            registered_at_ms: ms(c.registered_at),
        })
    }

    pub fn list_creators(&self, from_index: Option<u64>, limit: Option<u64>) -> Vec<CreatorJson> {
        let from = from_index.unwrap_or(0);
        let take = limit.unwrap_or(MAX_PAGE).min(MAX_PAGE);
        let len = self.creator_list.len() as u64;
        (from..len.min(from.saturating_add(take)))
            .filter_map(|i| self.creator_list.get(i as u32).cloned())
            .filter_map(|a| self.get_creator(a))
            .collect()
    }

    pub fn get_brand(&self, account_id: AccountId) -> Option<BrandJson> {
        self.brands.get(&account_id).map(|b| BrandJson {
            account_id: account_id.clone(),
            escrow: U128(b.escrow),
            reserved: U128(b.reserved),
            max_per_render: U128(b.max_per_render),
            total_budget: U128(b.total_budget),
            spent: U128(b.spent),
        })
    }

    pub fn get_licence(&self, licence_id: U64) -> Option<LicenceJson> {
        self.licence_json(licence_id.0)
    }

    /// The licence's money and render counts, computed now (the token's `extra` carries the same numbers).
    pub fn licence_summary(&self, licence_id: U64) -> Option<LicenceSummaryJson> {
        let id = licence_id.0;
        let l = self.licences.get(&id)?;
        let (paid, reserved) = money(l);
        Some(LicenceSummaryJson {
            licence_id: id.to_string(),
            token_id: l.issued_at.map(|_| id.to_string()),
            status: status_at(l, now()),
            price_per_render: U128(l.price),
            render_cap: l.render_cap,
            renders_used: l.renders_used,
            renders_reserved: l.renders_reserved,
            renders_left: l.render_cap.saturating_sub(l.renders_used + l.renders_reserved),
            paid_to_creator: U128(paid),
            reserved: U128(reserved),
            refundable_on_end: U128(reserved),
            expires_at_ms: l.expires_at.map(ms),
        })
    }

    pub fn get_receipt(&self, sha256: String) -> Option<ReceiptJson> {
        let sha = parse_sha(&sha256);
        self.receipts.get(&sha).map(|r| Self::receipt_json(&sha, r))
    }

    /// A creator's licences in request order (declined/cancelled requests are gone), limit ≤ 50.
    pub fn licences_for_creator(&self, creator_id: AccountId, from_index: Option<u64>, limit: Option<u64>) -> Vec<LicenceJson> {
        self.index_page(IndexKind::CreatorLicences, &creator_id, from_index.unwrap_or(0), limit.unwrap_or(MAX_PAGE))
            .into_iter()
            .filter_map(|id| self.licence_json(id))
            .collect()
    }

    /// A brand's licences in request order, limit ≤ 50.
    pub fn licences_for_brand(&self, brand_id: AccountId, from_index: Option<u64>, limit: Option<u64>) -> Vec<LicenceJson> {
        self.index_page(IndexKind::BrandLicences, &brand_id, from_index.unwrap_or(0), limit.unwrap_or(MAX_PAGE))
            .into_iter()
            .filter_map(|id| self.licence_json(id))
            .collect()
    }

    /// Payouts kept for a creator after a failed transfer.
    pub fn unclaimed_of(&self, account_id: AccountId) -> U128 {
        U128(self.unclaimed.get(&account_id).copied().unwrap_or(0))
    }
}
