//! Licences: the agent asks, the creator approves (minting the licence token), declines or revokes.

use crate::storage::{byte_cost, MINT_RESERVE_BYTES};
use crate::*;
use near_sdk::json_types::U64;
use near_sdk::{log, require};

#[near]
impl Contract {
    /// The brand's agent (a function-call key on the brand's account) asks to license `creator_id`'s face for one use.
    /// Licence + mint storage is reserved from the brand's escrow now; it's released if declined or cancelled.
    pub fn request_licence(&mut self, creator_id: AccountId, usage: Use, days: u32, render_cap: u32) -> U64 {
        let brand_id = env::predecessor_account_id();
        let creator = self.creators.get(&creator_id).cloned().unwrap_or_else(|| env::panic_str("no such creator"));
        require!(creator.active, "this creator isn't taking requests");
        require!(creator.terms.allowed_uses.contains(&usage), "the creator doesn't allow this use");
        require!(days >= 1 && days <= creator.terms.max_days, "longer than the creator allows");
        require!(render_cap >= 1 && render_cap <= creator.terms.render_cap, "more renders than the creator allows");
        let price = creator.terms.price_per_render.0;
        {
            let b = self.brands.get(&brand_id).unwrap_or_else(|| env::panic_str("deposit first: no escrow for this account"));
            require!(b.max_per_render > 0, "set limits first");
            require!(price <= b.max_per_render, "the creator's price is above the brand's per-render limit");
        }

        let id = self.next_licence_id;
        self.next_licence_id += 1;
        let terms_hash =
            env::sha256_array(&near_sdk::borsh::to_vec(&(&creator_id, &brand_id, usage, price, render_cap, days, &creator.terms)).unwrap());
        let before = self.usage();
        self.licences.insert(
            id,
            Licence {
                creator: creator_id.clone(),
                brand: brand_id.clone(),
                usage,
                price,
                render_cap,
                renders_used: 0,
                renders_reserved: 0,
                state: LicenceState::Pending,
                requested_at: now(),
                issued_at: None,
                duration_ns: days as u64 * NANOS_PER_DAY,
                expires_at: None,
                terms_hash,
                storage_reserved: 0,
                pending: Vec::new(),
            },
        );
        self.index_push(IndexKind::CreatorLicences, &creator_id, id);
        self.index_push(IndexKind::BrandLicences, &brand_id, id);
        let used = self.usage() - before;
        let reserve = (used + MINT_RESERVE_BYTES) as u128 * byte_cost();

        let b = self.brands.get_mut(&brand_id).unwrap();
        require!(b.escrow - b.reserved >= reserve, "escrow too low for this request's storage");
        require!(b.spent + b.reserved + reserve <= b.total_budget, "over the brand's total budget");
        b.reserved += reserve;
        self.licences.get_mut(&id).unwrap().storage_reserved = reserve;
        log!("licence {} requested: {} -> {} ({} bytes stored, {} reserved for mint)", id, brand_id, creator_id, used, MINT_RESERVE_BYTES);
        U64(id)
    }

    /// The creator approves: the licence starts now and its token is minted to the brand.
    pub fn approve_licence(&mut self, licence_id: U64) {
        let id = licence_id.0;
        let (brand_id, reserved) = {
            let l = self.licences.get_mut(&id).unwrap_or_else(|| env::panic_str("no such licence"));
            require!(l.creator == env::predecessor_account_id(), "only the creator can approve");
            require!(l.state == LicenceState::Pending, "this licence isn't pending");
            l.state = LicenceState::Active;
            l.issued_at = Some(now());
            l.expires_at = Some(now() + l.duration_ns);
            (l.brand.clone(), l.storage_reserved)
        };
        let before = self.usage();
        self.index_push(IndexKind::OwnerTokens, &brand_id, id);
        self.minted.push(id);
        let mint_bytes = self.usage() - before;
        let mint_cost = mint_bytes as u128 * byte_cost();
        let licence_cost = reserved - MINT_RESERVE_BYTES as u128 * byte_cost();
        // Spend the licence storage and the actual mint storage; release the rest of the reservation.
        let spend = (licence_cost + mint_cost).min(reserved);
        let b = self.brands.get_mut(&brand_id).unwrap();
        b.reserved -= reserved;
        b.escrow -= spend;
        b.spent += spend;
        self.licences.get_mut(&id).unwrap().storage_reserved = 0;
        events::emit_mint(&brand_id, &id.to_string());
        log!("licence {} approved; token minted to {} ({} bytes)", id, brand_id, mint_bytes);
    }

    /// The creator declines a pending request: the record is removed and the brand's reservation released.
    pub fn decline_licence(&mut self, licence_id: U64) {
        let l = self.licences.get(&licence_id.0).unwrap_or_else(|| env::panic_str("no such licence"));
        require!(l.creator == env::predecessor_account_id(), "only the creator can decline");
        require!(l.state == LicenceState::Pending, "this licence isn't pending");
        self.drop_pending_licence(licence_id.0);
    }

    /// The creator revokes an active licence. Every ad still waiting is released in the same call. The token stays;
    /// its status reads Revoked from now on.
    pub fn revoke_licence(&mut self, licence_id: U64) {
        let l = self.licences.get(&licence_id.0).unwrap_or_else(|| env::panic_str("no such licence"));
        require!(l.creator == env::predecessor_account_id(), "only the creator can revoke");
        require!(l.state == LicenceState::Active, "only an active licence can be revoked");
        self.release_pending(licence_id.0);
        self.licences.get_mut(&licence_id.0).unwrap().state = LicenceState::Revoked;
        log!("licence {} revoked", licence_id.0);
    }

    /// Anyone may release the reservations of an expired licence (expiry can't fire by itself).
    pub fn release_expired(&mut self, licence_id: U64) -> u32 {
        let l = self.licences.get(&licence_id.0).unwrap_or_else(|| env::panic_str("no such licence"));
        require!(l.state == LicenceState::Active, "only an active licence can expire");
        require!(now() >= l.expires_at.unwrap_or(u64::MAX), "this licence hasn't expired");
        self.release_pending(licence_id.0)
    }
}

impl Contract {
    /// Releases every pending receipt of a licence (≤ MAX_PENDING): receipts → Released, reservations returned.
    pub(crate) fn release_pending(&mut self, id: u64) -> u32 {
        let (brand_id, pending) = {
            let l = self.licences.get_mut(&id).unwrap();
            let p = std::mem::take(&mut l.pending);
            l.renders_reserved = 0;
            (l.brand.clone(), p)
        };
        let mut released = 0u128;
        for sha in &pending {
            let r = self.receipts.get_mut(sha).unwrap();
            r.status = ReceiptStatus::Released;
            r.decided_at = Some(now());
            released += r.amount;
        }
        self.brands.get_mut(&brand_id).unwrap().reserved -= released;
        pending.len() as u32
    }

    /// Removes a pending licence record and releases its storage reservation (decline or cancel).
    pub(crate) fn drop_pending_licence(&mut self, id: u64) {
        let l = self.licences.remove(&id).unwrap();
        self.brands.get_mut(&l.brand).unwrap().reserved -= l.storage_reserved;
        log!("licence {} request removed; {} yoctoNEAR released", id, l.storage_reserved);
    }
}
