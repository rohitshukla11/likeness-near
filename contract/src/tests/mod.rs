//! Unit tests: one fixture (a creator, a funded brand with limits), then the brand, licence, render and NFT suites.

mod brand;
mod licence;
mod nft;
mod render;
mod self_licence;

use crate::*;
use near_sdk::json_types::{U128, U64};
use near_sdk::test_utils::{accounts, get_logs, VMContextBuilder};
use near_sdk::{testing_env, NearToken};

pub const NEAR: u128 = 10u128.pow(24);
pub const T0: u64 = 1_800_000_000_000_000_000; // a fixed block time (ns)
pub const DAY: u64 = NANOS_PER_DAY;
pub const PRICE: u128 = NEAR / 20; // 0.05 NEAR per render

pub fn contract_id() -> AccountId {
    "likeness.testnet".parse().unwrap()
}
pub fn owner() -> AccountId {
    accounts(0)
}
pub fn creator() -> AccountId {
    accounts(1)
}
pub fn brand() -> AccountId {
    accounts(2)
}
pub fn stranger() -> AccountId {
    accounts(3)
}

/// 64 hex characters for a fake ad numbered `n`.
pub fn sha(n: u8) -> String {
    to_hex(&[n; 32])
}

/// Sets the call context: who calls, what they attach, the block time.
pub fn at(caller: &AccountId, deposit: u128, t: u64) {
    let mut b = VMContextBuilder::new();
    b.current_account_id(contract_id())
        .signer_account_id(caller.clone())
        .predecessor_account_id(caller.clone())
        .attached_deposit(NearToken::from_yoctonear(deposit))
        .block_timestamp(t)
        .account_balance(NearToken::from_near(1_000_000))
        .storage_usage(1_000_000);
    testing_env!(b.build());
}

pub fn terms(cap: u32) -> Terms {
    Terms { price_per_render: U128(PRICE), allowed_uses: vec![Use::Fitness, Use::Tech], max_days: 30, render_cap: cap }
}

/// A contract with a registered creator (cap 3) and a brand with 2 NEAR escrow, 0.1 per render, 1 NEAR budget.
pub fn world() -> Contract {
    world_with(3, 2 * NEAR, NEAR / 10, NEAR)
}

pub fn world_with(cap: u32, deposit: u128, max_per_render: u128, budget: u128) -> Contract {
    at(&owner(), 0, T0);
    let mut c = Contract::new(owner());
    at(&creator(), NEAR / 100, T0);
    c.register_creator(terms(cap), sha(200));
    at(&brand(), deposit, T0);
    c.deposit();
    at(&brand(), 0, T0);
    c.set_limits(U128(max_per_render), U128(budget));
    c
}

/// The agent (the brand's function-call key) asks for a licence; returns its id.
pub fn request(c: &mut Contract, days: u32, cap: u32) -> u64 {
    at(&brand(), 0, T0);
    c.request_licence(creator(), Use::Fitness, days, cap).0
}

pub fn approve(c: &mut Contract, id: u64) {
    at(&creator(), 0, T0);
    c.approve_licence(U64(id));
}

/// An approved 30-day licence with this cap.
pub fn active(c: &mut Contract, cap: u32) -> u64 {
    let id = request(c, 30, cap);
    approve(c, id);
    id
}

pub fn submit(c: &mut Contract, id: u64, n: u8) {
    at(&brand(), 0, T0 + DAY);
    c.submit_render(U64(id), sha(n), FaceCheck::LikelyMatch);
}

pub fn brand_of(c: &Contract) -> BrandJson {
    c.get_brand(brand()).unwrap()
}

/// The first number in the first log line containing `needle`, just before " bytes".
pub fn logged_bytes(needle: &str) -> u64 {
    let line = get_logs().into_iter().find(|l| l.contains(needle)).unwrap_or_else(|| panic!("no log with {needle:?}"));
    let i = line.find(" bytes").unwrap();
    let digits: String = line[..i].chars().rev().take_while(|c| c.is_ascii_digit()).collect::<String>().chars().rev().collect();
    digits.parse().unwrap()
}
