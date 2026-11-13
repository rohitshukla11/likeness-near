//! Proving one's likeness is optional: register with an all-zero capture hash, prove it later with set_capture.
use super::*;

const ZERO: &str = "0000000000000000000000000000000000000000000000000000000000000000";

#[test]
fn register_without_a_capture_reads_as_not_proven() {
    at(&owner(), 0, T0);
    let mut c = Contract::new(owner());
    at(&creator(), NEAR / 100, T0);
    c.register_creator(terms(3), ZERO.into());
    assert_eq!(c.get_creator(creator()).unwrap().capture_sha256, None);
    assert_eq!(c.list_creators(None, None)[0].capture_sha256, None);
}

#[test]
fn set_capture_proves_the_likeness_later() {
    at(&owner(), 0, T0);
    let mut c = Contract::new(owner());
    at(&creator(), NEAR / 100, T0);
    c.register_creator(terms(3), ZERO.into());
    at(&creator(), 0, T0 + DAY);
    c.set_capture(sha(7));
    assert_eq!(c.get_creator(creator()).unwrap().capture_sha256, Some(sha(7)));
    assert!(get_logs().iter().any(|l| l.contains("likeness proven")));
}

#[test]
fn a_proven_capture_still_reads_as_given_at_registration() {
    let c = world();
    assert_eq!(c.get_creator(creator()).unwrap().capture_sha256, Some(sha(200)));
}

#[test]
#[should_panic(expected = "a capture hash can't be all zeros")]
fn set_capture_refuses_all_zeros() {
    let mut c = world();
    at(&creator(), 0, T0);
    c.set_capture(ZERO.into());
}

#[test]
#[should_panic(expected = "not a registered creator")]
fn only_a_registered_creator_sets_a_capture() {
    let mut c = world();
    at(&stranger(), 0, T0);
    c.set_capture(sha(9));
}
