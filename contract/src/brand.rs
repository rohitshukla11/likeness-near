//! The brand's side, from its full-access wallet: escrow, limits, withdraw, and cancelling a pending request.

use crate::storage::byte_cost;
use crate::*;
use near_sdk::json_types::{U128, U64};
use near_sdk::{log, require, NearToken, Promise, PromiseError};

#[near]
impl Contract {
    /// Adds the attached NEAR to the caller's escrow. The first deposit also pays for the brand record's storage.
    #[payable]
    pub fn deposit(&mut self) {
        let brand = env::predecessor_account_id();
        let attached = env::attached_deposit().as_yoctonear();
        require!(attached > 0, "attach NEAR to deposit");
        let mut credit = attached;
        if !self.brands.contains_key(&brand) {
            let before = self.usage();
            self.brands.insert(brand.clone(), Brand::default());
            let cost = (self.usage() - before) as u128 * byte_cost();
            require!(attached > cost, "the deposit doesn't cover this brand record's storage");
            credit -= cost;
        }
        let b = self.brands.get_mut(&brand).unwrap();
        b.escrow += credit;
        log!("deposit: {} added {} yoctoNEAR to escrow", brand, credit);
    }

    /// The most the agent may spend per render and in total (spent + reserved). Enforced on every request and render.
    pub fn set_limits(&mut self, max_per_render: U128, total_budget: U128) {
        let brand = env::predecessor_account_id();
        require!(max_per_render.0 > 0, "the per-render limit must be above 0");
        require!(total_budget.0 >= max_per_render.0, "the total budget must be at least the per-render limit");
        let b = self.brands.get_mut(&brand).unwrap_or_else(|| env::panic_str("deposit first: no escrow for this account"));
        b.max_per_render = max_per_render.0;
        b.total_budget = total_budget.0;
    }

    /// Withdraws unreserved escrow. Restored by the callback if the transfer fails.
    pub fn withdraw(&mut self, amount: U128) -> Promise {
        let brand = env::predecessor_account_id();
        let b = self.brands.get_mut(&brand).unwrap_or_else(|| env::panic_str("no escrow for this account"));
        require!(amount.0 > 0, "withdraw more than 0");
        require!(amount.0 <= b.escrow - b.reserved, "only the unreserved balance can be withdrawn");
        b.escrow -= amount.0;
        Promise::new(brand.clone())
            .transfer(NearToken::from_yoctonear(amount.0))
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_CALLBACK).on_withdraw(brand, amount))
    }

    #[private]
    pub fn on_withdraw(&mut self, brand: AccountId, amount: U128, #[callback_result] result: Result<(), PromiseError>) -> bool {
        if result.is_err() {
            if let Some(b) = self.brands.get_mut(&brand) {
                b.escrow += amount.0;
            }
            log!("withdraw to {} failed: {} yoctoNEAR restored to escrow", brand, amount.0);
            return false;
        }
        true
    }

    /// The brand cancels its own pending request: the record is removed and its storage reservation released.
    pub fn cancel_licence_request(&mut self, licence_id: U64) {
        let l = self.licences.get(&licence_id.0).unwrap_or_else(|| env::panic_str("no such licence"));
        require!(l.brand == env::predecessor_account_id(), "only the brand that asked can cancel");
        require!(l.state == LicenceState::Pending, "only a pending request can be cancelled");
        self.drop_pending_licence(licence_id.0);
    }
}
