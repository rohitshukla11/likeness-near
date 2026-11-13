//! Stored records (borsh) and the JSON the views return (snake_case; times in ms; u128 as strings).

use near_sdk::json_types::U128;
use near_sdk::{env, near, require, AccountId};

/// A sha256, raw bytes.
pub type Sha = [u8; 32];

/// What an ad may be for. Banned uses (political, adult, minors, impersonation, deception) are not representable.
#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Use {
    Fashion,
    Beauty,
    FoodDrink,
    Tech,
    Travel,
    Fitness,
    Finance,
    Other,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Terms {
    pub price_per_render: U128,
    pub allowed_uses: Vec<Use>,
    pub max_days: u32,
    pub render_cap: u32,
}

#[near(serializers = [borsh])]
#[derive(Clone, Debug)]
pub struct Creator {
    pub terms: Terms,
    pub capture_sha256: Sha,
    pub active: bool,
    pub registered_at: u64,
}

/// A brand's money in the contract, yoctoNEAR. available = escrow - reserved. `spent` counts every escrow
/// deduction (render payments and storage), so the budget check is conservative.
#[near(serializers = [borsh])]
#[derive(Clone, Debug, Default)]
pub struct Brand {
    pub escrow: u128,
    pub reserved: u128,
    pub max_per_render: u128,
    pub total_budget: u128,
    pub spent: u128,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum LicenceState {
    Pending,
    Active,
    Declined,
    Revoked,
}

#[near(serializers = [borsh])]
#[derive(Clone, Debug)]
pub struct Licence {
    pub creator: AccountId,
    pub brand: AccountId,
    pub usage: Use,
    pub price: u128,
    pub render_cap: u32,
    pub renders_used: u32,
    pub renders_reserved: u32,
    pub state: LicenceState,
    pub requested_at: u64,
    pub issued_at: Option<u64>,
    pub duration_ns: u64,
    pub expires_at: Option<u64>,
    pub terms_hash: Sha,
    /// Licence + mint storage reserved from the brand's escrow at request time (yoctoNEAR).
    pub storage_reserved: u128,
    /// Receipts waiting for the creator's decision (at most MAX_PENDING).
    pub pending: Vec<Sha>,
}

#[near(serializers = [borsh, json])]
#[serde(rename_all = "snake_case")]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum FaceCheck {
    LikelyMatch,
    NeedsCreatorReview,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ReceiptStatus {
    Reserved,
    Approved,
    Rejected,
    Released,
}

#[near(serializers = [borsh])]
#[derive(Clone, Debug)]
pub struct Receipt {
    pub licence_id: u64,
    pub amount: u128,
    pub face_check: FaceCheck,
    pub status: ReceiptStatus,
    pub created_at: u64,
    pub decided_at: Option<u64>,
}

/// Computed on every read, never stored.
#[near(serializers = [json])]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum LicenceStatus {
    Pending,
    Declined,
    Active,
    Exhausted,
    Expired,
    Revoked,
}

#[near(serializers = [json])]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Verdict {
    Licensed,
    Expired,
    Revoked,
    Unknown,
}

// ---------------------------------------------------------------- view JSON

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct CreatorJson {
    pub account_id: AccountId,
    pub terms: Terms,
    /// null until the creator proves their likeness (an all-zero hash on-chain).
    pub capture_sha256: Option<String>,
    pub active: bool,
    pub registered_at_ms: u64,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct BrandJson {
    pub account_id: AccountId,
    pub escrow: U128,
    pub reserved: U128,
    pub max_per_render: U128,
    pub total_budget: U128,
    pub spent: U128,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct LicenceJson {
    pub id: String,
    pub token_id: Option<String>,
    pub creator: AccountId,
    pub brand: AccountId,
    #[serde(rename = "use")]
    pub usage: Use,
    pub price: U128,
    pub render_cap: u32,
    pub renders_used: u32,
    pub renders_reserved: u32,
    pub state: LicenceState,
    pub status: LicenceStatus,
    pub requested_at_ms: u64,
    pub issued_at_ms: Option<u64>,
    pub expires_at_ms: Option<u64>,
    pub terms_hash: String,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct ReceiptJson {
    pub sha256: String,
    pub licence_id: String,
    pub amount: U128,
    pub face_check: FaceCheck,
    pub status: ReceiptStatus,
    pub created_at_ms: u64,
    pub decided_at_ms: Option<u64>,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct VerifyJson {
    pub sha256: String,
    pub verdict: Verdict,
    pub token_id: Option<String>,
    pub licence: Option<LicenceJson>,
    pub receipt: Option<ReceiptJson>,
}

// ---------------------------------------------------------------- helpers

pub const NANOS_PER_DAY: u64 = 86_400 * 1_000_000_000;
pub const MAX_DAYS: u32 = 180;
pub const MAX_RENDER_CAP: u32 = 1000;
pub const MAX_PRICE: u128 = 5 * 10u128.pow(24);
pub const MAX_PENDING: usize = 5;
pub const MAX_PAGE: u64 = 50;

pub fn ms(ns: u64) -> u64 {
    ns / 1_000_000
}

pub fn to_hex(b: &Sha) -> String {
    const H: &[u8; 16] = b"0123456789abcdef";
    let mut s = String::with_capacity(64);
    for x in b {
        s.push(H[(x >> 4) as usize] as char);
        s.push(H[(x & 15) as usize] as char);
    }
    s
}

/// 64 lowercase hex characters → raw bytes; panics otherwise.
pub fn parse_sha(s: &str) -> Sha {
    require!(s.len() == 64, "a sha256 is 64 lowercase hex characters");
    let mut out = [0u8; 32];
    for (i, c) in s.as_bytes().chunks(2).enumerate() {
        let n = |x: u8| match x {
            b'0'..=b'9' => x - b'0',
            b'a'..=b'f' => x - b'a' + 10,
            _ => env::panic_str("a sha256 is 64 lowercase hex characters"),
        };
        out[i] = n(c[0]) << 4 | n(c[1]);
    }
    out
}

/// Validates a creator's terms (the same limits the app shows).
pub fn validate_terms(t: &Terms) {
    require!(!t.allowed_uses.is_empty(), "allow at least one use");
    for (i, u) in t.allowed_uses.iter().enumerate() {
        require!(!t.allowed_uses[..i].contains(u), "a use is listed twice");
    }
    require!(t.price_per_render.0 > 0 && t.price_per_render.0 <= MAX_PRICE, "the price must be above 0 and at most 5 NEAR per render");
    require!(t.max_days >= 1 && t.max_days <= MAX_DAYS, "the longest licence is 1 to 180 days");
    require!(t.render_cap >= 1 && t.render_cap <= MAX_RENDER_CAP, "the render cap is 1 to 1000");
}

/// What a licence (and its token) is right now: Revoked; else Expired at/after expiry; else Exhausted; else Active.
pub fn status_at(l: &Licence, now: u64) -> LicenceStatus {
    match l.state {
        LicenceState::Pending => LicenceStatus::Pending,
        LicenceState::Declined => LicenceStatus::Declined,
        LicenceState::Revoked => LicenceStatus::Revoked,
        LicenceState::Active => {
            if now >= l.expires_at.unwrap_or(0) {
                LicenceStatus::Expired
            } else if l.renders_used >= l.render_cap {
                LicenceStatus::Exhausted
            } else {
                LicenceStatus::Active
            }
        }
    }
}
