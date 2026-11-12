//! Likeness: creators license their face to AI ads on NEAR.
//!
//! - Creators register terms (price per render, allowed uses, longest licence, render cap) and the sha256 of their
//!   consented capture. They approve or decline each licence, approve or reject each ad, and can revoke at any time.
//! - Brands deposit escrow and set limits. Their AI agent acts through a function-call key on the brand's own account
//!   that may call only `request_licence` and `submit_render` (no deposits), so its storage is charged to escrow.
//! - `submit_render` reserves the price; only the creator's `approve_render(sha256)` pays it and writes the receipt
//!   anyone can `verify`. Revoking releases every pending reservation in the same call; expiry is enforced on read.
//! - Each approved licence is a non-transferable NEP-171 token owned by the brand: a view of the licence record,
//!   whose status is computed on every read.

use near_sdk::borsh::BorshSerialize;
use near_sdk::store::{LookupMap, Vector};
use near_sdk::{env, near, AccountId, BorshStorageKey, Gas, PanicOnDefault};

mod brand;
mod creator;
mod events;
mod licence;
mod nft;
mod render;
mod storage;
mod types;
mod views;

#[cfg(test)]
mod tests;

pub use types::*;

pub(crate) const GAS_CALLBACK: Gas = Gas::from_tgas(10);

#[derive(BorshStorageKey, BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
pub(crate) enum StorageKey {
    Creators,
    CreatorList,
    Brands,
    Licences,
    IndexLen,
    IndexAt,
    Minted,
    Receipts,
    Unclaimed,
}

/// Per-account lists kept as flat (account, position) → licence id entries: no nested collections, no unbounded loops.
#[near(serializers = [borsh])]
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug)]
pub enum IndexKind {
    CreatorLicences,
    BrandLicences,
    OwnerTokens,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    pub(crate) owner_id: AccountId,
    pub(crate) creators: LookupMap<AccountId, Creator>,
    pub(crate) creator_list: Vector<AccountId>,
    pub(crate) brands: LookupMap<AccountId, Brand>,
    pub(crate) licences: LookupMap<u64, Licence>,
    pub(crate) next_licence_id: u64,
    pub(crate) index_len: LookupMap<(IndexKind, AccountId), u32>,
    pub(crate) index_at: LookupMap<(IndexKind, AccountId, u32), u64>,
    pub(crate) minted: Vector<u64>,
    pub(crate) receipts: LookupMap<Sha, Receipt>,
    pub(crate) unclaimed: LookupMap<AccountId, u128>,
}

#[near]
impl Contract {
    #[init]
    pub fn new(owner_id: AccountId) -> Self {
        Self {
            owner_id,
            creators: LookupMap::new(StorageKey::Creators),
            creator_list: Vector::new(StorageKey::CreatorList),
            brands: LookupMap::new(StorageKey::Brands),
            licences: LookupMap::new(StorageKey::Licences),
            next_licence_id: 0,
            index_len: LookupMap::new(StorageKey::IndexLen),
            index_at: LookupMap::new(StorageKey::IndexAt),
            minted: Vector::new(StorageKey::Minted),
            receipts: LookupMap::new(StorageKey::Receipts),
            unclaimed: LookupMap::new(StorageKey::Unclaimed),
        }
    }

    pub fn owner_id(&self) -> AccountId {
        self.owner_id.clone()
    }
}

pub(crate) fn now() -> u64 {
    env::block_timestamp()
}
