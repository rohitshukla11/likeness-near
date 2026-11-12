//! The creator's record, from their full-access wallet: terms and the sha256 of their consented capture.

use crate::storage::byte_cost;
use crate::*;
use near_sdk::{log, require, NearToken, Promise};

#[near]
impl Contract {
    /// Registers the caller as a creator. The attached deposit pays for the record's storage; any excess is refunded.
    #[payable]
    pub fn register_creator(&mut self, terms: Terms, capture_sha256: String) {
        let creator = env::predecessor_account_id();
        require!(!self.creators.contains_key(&creator), "already registered: use update_terms");
        validate_terms(&terms);
        let sha = parse_sha(&capture_sha256);
        let before = self.usage();
        self.creators.insert(creator.clone(), Creator { terms, capture_sha256: sha, active: true, registered_at: now() });
        self.creator_list.push(creator.clone());
        let cost = (self.usage() - before) as u128 * byte_cost();
        let attached = env::attached_deposit().as_yoctonear();
        require!(attached >= cost, format!("attach at least {} yoctoNEAR for storage", cost));
        if attached > cost {
            Promise::new(creator.clone()).transfer(NearToken::from_yoctonear(attached - cost)).detach();
        }
        log!("creator registered: {}", creator);
    }

    /// New terms apply to new requests only; existing licences keep the terms they were approved under (terms_hash).
    pub fn update_terms(&mut self, terms: Terms) {
        validate_terms(&terms);
        let c = self.creators.get_mut(&env::predecessor_account_id()).unwrap_or_else(|| env::panic_str("not a registered creator"));
        c.terms = terms;
    }

    /// Pauses (or resumes) new licence requests.
    pub fn set_active(&mut self, active: bool) {
        let c = self.creators.get_mut(&env::predecessor_account_id()).unwrap_or_else(|| env::panic_str("not a registered creator"));
        c.active = active;
    }
}
