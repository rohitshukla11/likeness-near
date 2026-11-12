//! Ads: the agent submits one (reserving the price); only the creator's approve_render(sha256) pays for it.

use crate::storage::byte_cost;
use crate::*;
use near_sdk::json_types::{U128, U64};
use near_sdk::{log, require, NearToken, Promise, PromiseError};

#[near]
impl Contract {
    /// The brand's agent submits an ad (its final bytes' sha256) under an active licence, with the advisory face check.
    /// Every check passes or nothing changes; then the price is reserved and the receipt's storage charged to escrow.
    pub fn submit_render(&mut self, licence_id: U64, sha256: String, face_check: FaceCheck) {
        let id = licence_id.0;
        let sha = parse_sha(&sha256);
        let caller = env::predecessor_account_id();
        let l = self.licences.get(&id).cloned().unwrap_or_else(|| env::panic_str("no such licence"));
        require!(l.brand == caller, "only the licence's brand can submit renders");
        require!(l.state == LicenceState::Active, "the licence isn't active");
        require!(now() < l.expires_at.unwrap_or(0), "the licence has expired");
        require!(l.renders_used + l.renders_reserved < l.render_cap, "the render cap is reached");
        require!(l.pending.len() < MAX_PENDING, "5 ads are already waiting for the creator");
        require!(!self.receipts.contains_key(&sha), "this exact file was already submitted");
        {
            let b = self.brands.get(&caller).unwrap();
            require!(l.price <= b.max_per_render, "over the brand's per-render limit");
            require!(b.spent + b.reserved + l.price <= b.total_budget, "over the brand's total budget");
        }

        let before = self.usage();
        self.receipts.insert(
            sha,
            Receipt { licence_id: id, amount: l.price, face_check, status: ReceiptStatus::Reserved, created_at: now(), decided_at: None },
        );
        {
            let lm = self.licences.get_mut(&id).unwrap();
            lm.pending.push(sha);
            lm.renders_reserved += 1;
        }
        let used = self.usage() - before;
        let storage = used as u128 * byte_cost();

        let b = self.brands.get_mut(&caller).unwrap();
        require!(b.escrow - b.reserved >= l.price + storage, "escrow too low for this ad");
        b.escrow -= storage;
        b.spent += storage;
        b.reserved += l.price;
        log!("render {} submitted under licence {} ({:?}); {} reserved, {} bytes stored", sha256, id, face_check, l.price, used);
    }

    /// The creator's consent to this exact ad, and the human approval of its payment: pays the creator from the
    /// reservation and writes the receipt. Refused once the licence is revoked or expired.
    pub fn approve_render(&mut self, sha256: String) {
        let sha = parse_sha(&sha256);
        let r = self.receipts.get(&sha).cloned().unwrap_or_else(|| env::panic_str("no such ad"));
        require!(r.status == ReceiptStatus::Reserved, "this ad isn't waiting for a decision");
        let l = self.licences.get(&r.licence_id).cloned().unwrap();
        require!(l.creator == env::predecessor_account_id(), "only the creator can approve");
        require!(l.state == LicenceState::Active, "the licence was revoked");
        require!(now() < l.expires_at.unwrap_or(0), "the licence has expired");

        {
            let lm = self.licences.get_mut(&r.licence_id).unwrap();
            lm.pending.retain(|p| p != &sha);
            lm.renders_reserved -= 1;
            lm.renders_used += 1;
        }
        {
            let rm = self.receipts.get_mut(&sha).unwrap();
            rm.status = ReceiptStatus::Approved;
            rm.decided_at = Some(now());
        }
        {
            let b = self.brands.get_mut(&l.brand).unwrap();
            b.reserved -= r.amount;
            b.escrow -= r.amount;
            b.spent += r.amount;
        }
        log!("render {} approved: {} yoctoNEAR to {}", sha256, r.amount, l.creator);
        Promise::new(l.creator.clone())
            .transfer(NearToken::from_yoctonear(r.amount))
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_CALLBACK).on_payout(l.creator, U128(r.amount)))
            .detach();
    }

    /// The creator rejects this ad: the reservation is released and it doesn't count toward the render cap.
    pub fn reject_render(&mut self, sha256: String) {
        let sha = parse_sha(&sha256);
        let r = self.receipts.get(&sha).cloned().unwrap_or_else(|| env::panic_str("no such ad"));
        require!(r.status == ReceiptStatus::Reserved, "this ad isn't waiting for a decision");
        let l = self.licences.get(&r.licence_id).cloned().unwrap();
        require!(l.creator == env::predecessor_account_id(), "only the creator can reject");
        {
            let lm = self.licences.get_mut(&r.licence_id).unwrap();
            lm.pending.retain(|p| p != &sha);
            lm.renders_reserved -= 1;
        }
        {
            let rm = self.receipts.get_mut(&sha).unwrap();
            rm.status = ReceiptStatus::Rejected;
            rm.decided_at = Some(now());
        }
        self.brands.get_mut(&l.brand).unwrap().reserved -= r.amount;
        log!("render {} rejected", sha256);
    }

    /// If a payout transfer failed, the amount is kept for the creator to claim (never lost outside the accounting).
    #[private]
    pub fn on_payout(&mut self, creator: AccountId, amount: U128, #[callback_result] result: Result<(), PromiseError>) -> bool {
        if result.is_err() {
            let prev = self.unclaimed.get(&creator).copied().unwrap_or(0);
            self.unclaimed.insert(creator.clone(), prev + amount.0);
            log!("payout to {} failed: {} yoctoNEAR kept as unclaimed", creator, amount.0);
            return false;
        }
        true
    }

    /// The creator claims payouts whose transfer failed.
    pub fn claim_unclaimed(&mut self) -> Promise {
        let creator = env::predecessor_account_id();
        let amount = self.unclaimed.remove(&creator).unwrap_or(0);
        require!(amount > 0, "nothing to claim");
        Promise::new(creator.clone())
            .transfer(NearToken::from_yoctonear(amount))
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_CALLBACK).on_payout(creator, U128(amount)))
    }
}
