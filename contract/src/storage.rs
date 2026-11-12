//! Storage accounting and the flat per-account indexes.
//!
//! `request_licence` and `submit_render` run under a function-call key and can't attach a deposit, so their storage
//! is measured (flush, then `env::storage_usage()` before/after) and charged to the brand's escrow.

use crate::{Contract, IndexKind};
use near_sdk::{env, AccountId};

pub(crate) fn byte_cost() -> u128 {
    env::storage_byte_cost().as_yoctonear()
}

/// Bytes reserved for minting a licence token (owner index entry, its length, the `minted` entry). The mint is
/// measured when it happens; a unit test asserts it fits in this reservation.
pub(crate) const MINT_RESERVE_BYTES: u64 = 300;

impl Contract {
    /// Writes every pending collection change, so `env::storage_usage()` is exact.
    pub(crate) fn flush(&mut self) {
        self.creators.flush();
        self.creator_list.flush();
        self.brands.flush();
        self.licences.flush();
        self.index_len.flush();
        self.index_at.flush();
        self.minted.flush();
        self.receipts.flush();
        self.unclaimed.flush();
    }

    pub(crate) fn usage(&mut self) -> u64 {
        self.flush();
        env::storage_usage()
    }

    pub(crate) fn index_push(&mut self, kind: IndexKind, account: &AccountId, id: u64) {
        let key = (kind, account.clone());
        let n = self.index_len.get(&key).copied().unwrap_or(0);
        self.index_at.insert((kind, account.clone(), n), id);
        self.index_len.insert(key, n + 1);
    }

    pub(crate) fn index_len_of(&self, kind: IndexKind, account: &AccountId) -> u32 {
        self.index_len.get(&(kind, account.clone())).copied().unwrap_or(0)
    }

    /// Ids at positions [from, from + limit), limit capped at 50.
    pub(crate) fn index_page(&self, kind: IndexKind, account: &AccountId, from: u64, limit: u64) -> Vec<u64> {
        let len = self.index_len_of(kind, account) as u64;
        let end = len.min(from.saturating_add(limit.min(crate::MAX_PAGE)));
        (from..end).filter_map(|i| self.index_at.get(&(kind, account.clone(), i as u32)).copied()).collect()
    }
}
