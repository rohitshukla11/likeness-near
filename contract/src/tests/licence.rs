use super::*;
use crate::storage::{byte_cost, MINT_RESERVE_BYTES};

#[test]
fn request_reserves_licence_and_mint_storage() {
    let mut c = world();
    let id = request(&mut c, 30, 3);
    let bytes = logged_bytes("bytes stored");
    let l = c.get_licence(U64(id)).unwrap();
    assert_eq!(l.state, LicenceState::Pending);
    assert_eq!(l.status, LicenceStatus::Pending);
    assert_eq!(l.token_id, None);
    assert_eq!(brand_of(&c).reserved.0, (bytes + MINT_RESERVE_BYTES) as u128 * byte_cost());
}

#[test]
#[should_panic(expected = "no such creator")]
fn request_unknown_creator() {
    let mut c = world();
    at(&brand(), 0, T0);
    c.request_licence(stranger(), Use::Fitness, 30, 3);
}

#[test]
#[should_panic(expected = "this creator isn't taking requests")]
fn request_paused_creator() {
    let mut c = world();
    at(&creator(), 0, T0);
    c.set_active(false);
    request(&mut c, 30, 3);
}

#[test]
#[should_panic(expected = "the creator doesn't allow this use")]
fn request_use_not_allowed() {
    let mut c = world();
    at(&brand(), 0, T0);
    c.request_licence(creator(), Use::Finance, 30, 3);
}

#[test]
#[should_panic(expected = "longer than the creator allows")]
fn request_too_long() {
    let mut c = world();
    request(&mut c, 31, 3);
}

#[test]
#[should_panic(expected = "more renders than the creator allows")]
fn request_too_many_renders() {
    let mut c = world();
    request(&mut c, 30, 4);
}

#[test]
#[should_panic(expected = "above the brand's per-render limit")]
fn request_over_per_render_limit() {
    let mut c = world_with(3, 2 * NEAR, PRICE - 1, NEAR);
    request(&mut c, 30, 3);
}

#[test]
#[should_panic(expected = "escrow too low for this request's storage")]
fn request_panics_when_escrow_is_short() {
    // A 0.0025 NEAR deposit: after the brand record, less than a licence + mint reservation.
    let mut c = world_with(3, NEAR / 400, NEAR / 10, NEAR);
    let b = brand_of(&c);
    assert!(b.escrow.0 < (600 + MINT_RESERVE_BYTES as u128) * byte_cost());
    request(&mut c, 30, 3);
}

#[test]
fn decline_removes_the_request_and_releases_storage() {
    let mut c = world();
    let id = request(&mut c, 30, 3);
    at(&creator(), 0, T0);
    c.decline_licence(U64(id));
    assert_eq!(brand_of(&c).reserved.0, 0);
    assert!(c.get_licence(U64(id)).is_none());
    assert!(c.nft_token(id.to_string()).is_none());
    assert!(c.licences_for_creator(creator(), None, None).is_empty(), "declined requests are gone from the index view");
}

#[test]
fn approve_spends_licence_storage_and_releases_the_unused_mint_reserve() {
    let mut c = world();
    let escrow0 = brand_of(&c).escrow.0;
    let id = request(&mut c, 30, 3);
    let licence_bytes = logged_bytes("bytes stored");
    approve(&mut c, id);
    let mint_bytes = logged_bytes("token minted");
    assert!(mint_bytes <= MINT_RESERVE_BYTES, "the mint ({mint_bytes} B) fits its reservation ({MINT_RESERVE_BYTES} B)");
    let b = brand_of(&c);
    assert_eq!(b.reserved.0, 0);
    assert_eq!(escrow0 - b.escrow.0, (licence_bytes + mint_bytes) as u128 * byte_cost());
    assert_eq!(b.spent.0, escrow0 - b.escrow.0);
}

#[test]
#[should_panic(expected = "only the creator can approve")]
fn only_the_creator_approves_a_licence() {
    let mut c = world();
    let id = request(&mut c, 30, 3);
    at(&brand(), 0, T0);
    c.approve_licence(U64(id));
}

#[test]
fn status_active_then_revoked() {
    let mut c = world();
    let id = active(&mut c, 3);
    assert_eq!(c.get_licence(U64(id)).unwrap().status, LicenceStatus::Active);
    at(&creator(), 0, T0 + DAY);
    c.revoke_licence(U64(id));
    assert_eq!(c.get_licence(U64(id)).unwrap().status, LicenceStatus::Revoked);
    assert!(c.nft_token(id.to_string()).is_some(), "revoke never burns the token");
}

#[test]
fn status_expires_as_time_passes_without_any_write() {
    let mut c = world();
    let id = active(&mut c, 3);
    at(&stranger(), 0, T0 + 30 * DAY - 1);
    assert_eq!(c.get_licence(U64(id)).unwrap().status, LicenceStatus::Active);
    at(&stranger(), 0, T0 + 30 * DAY);
    assert_eq!(c.get_licence(U64(id)).unwrap().status, LicenceStatus::Expired);
}

#[test]
fn status_exhausted_when_every_render_is_used() {
    let mut c = world();
    let id = active(&mut c, 1);
    submit(&mut c, id, 1);
    at(&creator(), 0, T0 + DAY);
    c.approve_render(sha(1));
    assert_eq!(c.get_licence(U64(id)).unwrap().status, LicenceStatus::Exhausted);
}

#[test]
fn revoke_releases_every_pending_render_in_the_same_call() {
    let mut c = world();
    let id = active(&mut c, 3);
    submit(&mut c, id, 1);
    submit(&mut c, id, 2);
    assert_eq!(brand_of(&c).reserved.0, 2 * PRICE);
    at(&creator(), 0, T0 + DAY);
    c.revoke_licence(U64(id));
    assert_eq!(brand_of(&c).reserved.0, 0);
    let l = c.get_licence(U64(id)).unwrap();
    assert_eq!(l.renders_reserved, 0);
    assert_eq!(c.get_receipt(sha(1)).unwrap().status, ReceiptStatus::Released);
    assert_eq!(c.get_receipt(sha(2)).unwrap().status, ReceiptStatus::Released);
}

#[test]
fn release_expired_returns_reservations() {
    let mut c = world();
    let id = active(&mut c, 3);
    submit(&mut c, id, 1);
    at(&stranger(), 0, T0 + 30 * DAY);
    assert_eq!(c.release_expired(U64(id)), 1);
    assert_eq!(brand_of(&c).reserved.0, 0);
    assert_eq!(c.get_receipt(sha(1)).unwrap().status, ReceiptStatus::Released);
}

#[test]
#[should_panic(expected = "this licence hasn't expired")]
fn release_expired_refuses_a_live_licence() {
    let mut c = world();
    let id = active(&mut c, 3);
    at(&stranger(), 0, T0 + DAY);
    c.release_expired(U64(id));
}
