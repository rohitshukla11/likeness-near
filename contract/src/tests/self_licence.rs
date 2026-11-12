//! One account as both creator and brand (the demo setup): nothing in the contract forbids it, and every step still
//! needs the right role's call. (The agent's function-call key can't call approve_*: the protocol limits it to
//! request_licence and submit_render.)
use super::*;

#[test]
fn one_account_can_license_itself_end_to_end() {
    let me = brand();
    at(&owner(), 0, T0);
    let mut c = Contract::new(owner());
    at(&me, NEAR / 100, T0);
    c.register_creator(terms(3), sha(200));
    at(&me, 2 * NEAR, T0);
    c.deposit();
    at(&me, 0, T0);
    c.set_limits(U128(NEAR / 10), U128(NEAR));

    at(&me, 0, T0);
    let id = c.request_licence(me.clone(), Use::Fitness, 30, 3).0;
    at(&me, 0, T0);
    c.approve_licence(U64(id));
    let l = c.get_licence(U64(id)).unwrap();
    assert_eq!((l.creator.clone(), l.brand.clone()), (me.clone(), me.clone()));
    assert_eq!(c.nft_token(id.to_string()).unwrap().owner_id, me);

    at(&me, 0, T0 + DAY);
    c.submit_render(U64(id), sha(1), FaceCheck::LikelyMatch);
    let before = c.get_brand(me.clone()).unwrap();
    at(&me, 0, T0 + DAY);
    c.approve_render(sha(1));
    let after = c.get_brand(me.clone()).unwrap();
    assert_eq!(before.escrow.0 - after.escrow.0, PRICE, "the price leaves escrow (and is paid to the same account)");
    assert_eq!(c.verify(sha(1)).verdict, Verdict::Licensed);
}
