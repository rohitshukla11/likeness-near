use super::*;
use near_sdk::PromiseError;

#[test]
fn deposit_pays_the_brand_record_storage_once() {
    let c = world();
    let b = brand_of(&c);
    assert!(b.escrow.0 < 2 * NEAR && b.escrow.0 > 2 * NEAR - NEAR / 100, "escrow = deposit - record storage");
    assert_eq!(b.reserved.0, 0);
    assert_eq!(b.max_per_render.0, NEAR / 10);
    let mut c = c;
    at(&brand(), NEAR, T0);
    c.deposit();
    assert_eq!(brand_of(&c).escrow.0, b.escrow.0 + NEAR, "a second deposit is credited in full");
}

#[test]
#[should_panic(expected = "deposit first")]
fn limits_need_a_deposit() {
    at(&owner(), 0, T0);
    let mut c = Contract::new(owner());
    at(&stranger(), 0, T0);
    c.set_limits(U128(1), U128(2));
}

#[test]
#[should_panic(expected = "the total budget must be at least the per-render limit")]
fn limits_are_consistent() {
    let mut c = world();
    at(&brand(), 0, T0);
    c.set_limits(U128(NEAR), U128(NEAR / 2));
}

#[test]
#[should_panic(expected = "only the unreserved balance can be withdrawn")]
fn withdraw_never_touches_reserved_escrow() {
    let mut c = world();
    let id = active(&mut c, 3);
    submit(&mut c, id, 1);
    let b = brand_of(&c);
    at(&brand(), 0, T0 + DAY);
    let _ = c.withdraw(U128(b.escrow.0 - b.reserved.0 + 1));
}

#[test]
fn withdraw_and_failed_transfer_restores_escrow() {
    let mut c = world();
    let before = brand_of(&c).escrow.0;
    at(&brand(), 0, T0);
    let _ = c.withdraw(U128(NEAR / 2));
    assert_eq!(brand_of(&c).escrow.0, before - NEAR / 2);
    at(&contract_id(), 0, T0);
    assert!(!c.on_withdraw(brand(), U128(NEAR / 2), Err(PromiseError::Failed)));
    assert_eq!(brand_of(&c).escrow.0, before, "a failed withdrawal is restored");
}

#[test]
fn cancel_releases_the_storage_reservation() {
    let mut c = world();
    let id = request(&mut c, 30, 3);
    assert!(brand_of(&c).reserved.0 > 0);
    at(&brand(), 0, T0);
    c.cancel_licence_request(U64(id));
    assert_eq!(brand_of(&c).reserved.0, 0);
    assert!(c.get_licence(U64(id)).is_none());
}

#[test]
#[should_panic(expected = "only the brand that asked can cancel")]
fn only_the_brand_cancels() {
    let mut c = world();
    let id = request(&mut c, 30, 3);
    at(&creator(), 0, T0);
    c.cancel_licence_request(U64(id));
}
