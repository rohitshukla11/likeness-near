use super::*;
use crate::storage::byte_cost;
use near_sdk::PromiseError;

// ---------------------------------------------------------------- every check in submit_render

#[test]
#[should_panic(expected = "only the licence's brand can submit renders")]
fn submit_by_someone_else() {
    let mut c = world();
    let id = active(&mut c, 3);
    at(&stranger(), 0, T0 + DAY);
    c.submit_render(U64(id), sha(1), FaceCheck::LikelyMatch);
}

#[test]
#[should_panic(expected = "the licence isn't active")]
fn submit_before_approval() {
    let mut c = world();
    let id = request(&mut c, 30, 3);
    submit(&mut c, id, 1);
}

#[test]
#[should_panic(expected = "the licence isn't active")]
fn submit_after_revoke() {
    let mut c = world();
    let id = active(&mut c, 3);
    at(&creator(), 0, T0);
    c.revoke_licence(U64(id));
    submit(&mut c, id, 1);
}

#[test]
#[should_panic(expected = "the licence has expired")]
fn submit_after_expiry() {
    let mut c = world();
    let id = active(&mut c, 3);
    at(&brand(), 0, T0 + 30 * DAY);
    c.submit_render(U64(id), sha(1), FaceCheck::LikelyMatch);
}

#[test]
#[should_panic(expected = "the render cap is reached")]
fn submit_counts_reserved_renders_toward_the_cap() {
    let mut c = world();
    let id = active(&mut c, 2);
    submit(&mut c, id, 1);
    submit(&mut c, id, 2);
    submit(&mut c, id, 3);
}

#[test]
#[should_panic(expected = "5 ads are already waiting for the creator")]
fn submit_at_most_five_pending() {
    let mut c = world_with(10, 2 * NEAR, NEAR / 10, NEAR);
    let id = active(&mut c, 10);
    for n in 1..=6 {
        submit(&mut c, id, n);
    }
}

#[test]
#[should_panic(expected = "this exact file was already submitted")]
fn submit_same_file_twice() {
    let mut c = world();
    let id = active(&mut c, 3);
    submit(&mut c, id, 1);
    submit(&mut c, id, 1);
}

#[test]
#[should_panic(expected = "over the brand's per-render limit")]
fn submit_over_per_render_limit_set_later() {
    let mut c = world();
    let id = active(&mut c, 3);
    at(&brand(), 0, T0);
    c.set_limits(U128(PRICE - 1), U128(NEAR));
    submit(&mut c, id, 1);
}

#[test]
#[should_panic(expected = "over the brand's total budget")]
fn submit_over_total_budget() {
    let mut c = world();
    let id = active(&mut c, 3);
    let spent = brand_of(&c).spent.0;
    at(&brand(), 0, T0);
    c.set_limits(U128(PRICE), U128(spent + PRICE + PRICE / 2));
    submit(&mut c, id, 1);
    submit(&mut c, id, 2);
}

#[test]
#[should_panic(expected = "escrow too low for this ad")]
fn submit_without_enough_escrow() {
    let mut c = world();
    let id = active(&mut c, 3);
    let b = brand_of(&c);
    at(&brand(), 0, T0);
    let _ = c.withdraw(U128(b.escrow.0 - b.reserved.0 - PRICE / 2));
    submit(&mut c, id, 1);
}

#[test]
#[should_panic(expected = "a sha256 is 64 lowercase hex characters")]
fn submit_rejects_a_malformed_hash() {
    let mut c = world();
    let id = active(&mut c, 3);
    at(&brand(), 0, T0 + DAY);
    c.submit_render(U64(id), "ABC".into(), FaceCheck::LikelyMatch);
}

// ---------------------------------------------------------------- reservation, payment, storage

#[test]
fn submit_reserves_the_price_and_charges_the_receipt_storage() {
    let mut c = world();
    let id = active(&mut c, 3);
    let before = brand_of(&c);
    submit(&mut c, id, 1);
    let bytes = logged_bytes("bytes stored");
    let after = brand_of(&c);
    assert_eq!(after.reserved.0, before.reserved.0 + PRICE);
    assert_eq!(before.escrow.0 - after.escrow.0, bytes as u128 * byte_cost());
    let r = c.get_receipt(sha(1)).unwrap();
    assert_eq!(r.status, ReceiptStatus::Reserved);
    assert_eq!(r.face_check, FaceCheck::LikelyMatch);
    assert_eq!(c.get_licence(U64(id)).unwrap().renders_reserved, 1);
}

#[test]
fn approve_render_pays_from_the_reservation() {
    let mut c = world();
    let id = active(&mut c, 3);
    submit(&mut c, id, 1);
    let before = brand_of(&c);
    at(&creator(), 0, T0 + DAY);
    c.approve_render(sha(1));
    let after = brand_of(&c);
    assert_eq!(after.reserved.0, before.reserved.0 - PRICE);
    assert_eq!(after.escrow.0, before.escrow.0 - PRICE);
    assert_eq!(after.spent.0, before.spent.0 + PRICE);
    let l = c.get_licence(U64(id)).unwrap();
    assert_eq!((l.renders_used, l.renders_reserved), (1, 0));
    assert_eq!(c.get_receipt(sha(1)).unwrap().status, ReceiptStatus::Approved);
}

#[test]
#[should_panic(expected = "only the creator can approve")]
fn only_the_creator_approves_an_ad() {
    let mut c = world();
    let id = active(&mut c, 3);
    submit(&mut c, id, 1);
    at(&brand(), 0, T0 + DAY);
    c.approve_render(sha(1));
}

#[test]
#[should_panic(expected = "this ad isn't waiting for a decision")]
fn approve_after_revoke_is_refused() {
    let mut c = world();
    let id = active(&mut c, 3);
    submit(&mut c, id, 1);
    at(&creator(), 0, T0 + DAY);
    c.revoke_licence(U64(id));
    c.approve_render(sha(1));
}

#[test]
#[should_panic(expected = "the licence has expired")]
fn approve_after_expiry_is_refused() {
    let mut c = world();
    let id = active(&mut c, 3);
    submit(&mut c, id, 1);
    at(&creator(), 0, T0 + 30 * DAY);
    c.approve_render(sha(1));
}

#[test]
fn a_rejected_render_does_not_count_toward_the_cap() {
    let mut c = world();
    let id = active(&mut c, 1);
    submit(&mut c, id, 1);
    at(&creator(), 0, T0 + DAY);
    c.reject_render(sha(1));
    assert_eq!(brand_of(&c).reserved.0, 0);
    let l = c.get_licence(U64(id)).unwrap();
    assert_eq!((l.renders_used, l.renders_reserved), (0, 0));
    submit(&mut c, id, 2); // the single render is still available
    assert_eq!(c.get_receipt(sha(1)).unwrap().status, ReceiptStatus::Rejected);
}

#[test]
fn a_failed_payout_is_kept_for_the_creator() {
    let mut c = world();
    at(&contract_id(), 0, T0);
    assert!(!c.on_payout(creator(), U128(PRICE), Err(PromiseError::Failed)));
    assert_eq!(c.unclaimed_of(creator()).0, PRICE);
    at(&creator(), 0, T0);
    let _ = c.claim_unclaimed();
    assert_eq!(c.unclaimed_of(creator()).0, 0);
}

// ---------------------------------------------------------------- verify

#[test]
fn verify_reads_unknown_licensed_expired() {
    let mut c = world();
    assert_eq!(c.verify(sha(9)).verdict, Verdict::Unknown);
    let id = active(&mut c, 3);
    submit(&mut c, id, 1);
    assert_eq!(c.verify(sha(1)).verdict, Verdict::Unknown, "waiting for the creator is not licensed");
    at(&creator(), 0, T0 + DAY);
    c.approve_render(sha(1));
    let v = c.verify(sha(1));
    assert_eq!(v.verdict, Verdict::Licensed);
    assert_eq!(v.token_id, Some(id.to_string()));
    at(&stranger(), 0, T0 + 30 * DAY);
    assert_eq!(c.verify(sha(1)).verdict, Verdict::Expired);
}

#[test]
fn verify_reads_revoked_and_rejected() {
    let mut c = world();
    let id = active(&mut c, 3);
    submit(&mut c, id, 1);
    submit(&mut c, id, 2);
    at(&creator(), 0, T0 + DAY);
    c.approve_render(sha(1));
    c.reject_render(sha(2));
    assert_eq!(c.verify(sha(2)).verdict, Verdict::Unknown, "a rejected ad is never licensed");
    c.revoke_licence(U64(id));
    assert_eq!(c.verify(sha(1)).verdict, Verdict::Revoked);
}
