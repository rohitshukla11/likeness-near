use super::*;
use crate::storage::MINT_RESERVE_BYTES;
use near_sdk::serde_json::{self, Value};

fn token_status(c: &Contract, id: u64) -> String {
    let t = c.nft_token(id.to_string()).unwrap();
    let extra: Value = serde_json::from_str(&t.metadata.unwrap().extra.unwrap()).unwrap();
    extra["status"].as_str().unwrap().to_string()
}

fn verify_licence_status(c: &Contract, n: u8) -> String {
    serde_json::to_value(c.verify(sha(n)).licence.unwrap().status).unwrap().as_str().unwrap().to_string()
}

#[test]
fn no_token_before_the_creator_approves() {
    let mut c = world();
    let id = request(&mut c, 30, 3);
    assert!(c.nft_token(id.to_string()).is_none());
    assert_eq!(c.nft_total_supply().0, 0);
    assert_eq!(c.nft_supply_for_owner(brand()).0, 0);
}

#[test]
fn approve_mints_to_the_brand_with_the_standard_event() {
    let mut c = world();
    let id = request(&mut c, 30, 3);
    approve(&mut c, id);
    let logs = get_logs();
    let want = format!(
        r#"EVENT_JSON:{{"standard":"nep171","version":"1.0.0","event":"nft_mint","data":[{{"owner_id":"{}","token_ids":["{}"]}}]}}"#,
        brand(),
        id
    );
    assert!(logs.contains(&want), "logs: {logs:?}");
    let t = c.nft_token(id.to_string()).unwrap();
    assert_eq!(t.owner_id, brand());
    let m = t.metadata.unwrap();
    assert_eq!(m.title.as_deref(), Some(format!("Likeness licence #{id}").as_str()));
    assert!(m.description.unwrap().starts_with(&format!("{} -> {}: Fitness, 3 renders, until ", creator(), brand())));
    let extra: Value = serde_json::from_str(&m.extra.unwrap()).unwrap();
    for k in ["creator", "brand", "use", "price_per_render", "render_cap", "renders_used", "expires_at", "terms_hash", "status"] {
        assert!(extra.get(k).is_some(), "extra has {k}");
    }
    assert_eq!(c.nft_total_supply().0, 1);
    assert_eq!(c.nft_supply_for_owner(brand()).0, 1);
}

#[test]
fn contract_metadata() {
    let c = world();
    let m = c.nft_metadata();
    assert_eq!((m.spec.as_str(), m.name.as_str(), m.symbol.as_str()), ("nft-1.0.0", "Likeness Licence", "LIKE"));
}

#[test]
#[should_panic(expected = "licence tokens are non-transferable")]
fn nft_transfer_panics() {
    let mut c = world();
    let id = active(&mut c, 3);
    at(&brand(), 1, T0);
    c.nft_transfer(stranger(), id.to_string(), None, None);
}

#[test]
#[should_panic(expected = "licence tokens are non-transferable")]
fn nft_transfer_call_panics() {
    let mut c = world();
    let id = active(&mut c, 3);
    at(&brand(), 1, T0);
    let _ = c.nft_transfer_call(stranger(), id.to_string(), None, None, "x".into());
}

#[test]
#[should_panic(expected = "licence tokens are non-transferable")]
fn nft_resolve_transfer_panics() {
    let mut c = world();
    let id = active(&mut c, 3);
    at(&contract_id(), 0, T0);
    c.nft_resolve_transfer(brand(), stranger(), id.to_string(), None);
}

#[test]
fn token_status_always_equals_verify_status() {
    let mut c = world();
    let id = active(&mut c, 2);
    submit(&mut c, id, 1);
    at(&creator(), 0, T0 + DAY);
    c.approve_render(sha(1));
    assert_eq!(token_status(&c, id), "Active");
    assert_eq!(token_status(&c, id), verify_licence_status(&c, 1));
    submit(&mut c, id, 2);
    at(&creator(), 0, T0 + DAY);
    c.approve_render(sha(2));
    assert_eq!(token_status(&c, id), "Exhausted");
    assert_eq!(token_status(&c, id), verify_licence_status(&c, 1));
    at(&stranger(), 0, T0 + 30 * DAY);
    assert_eq!(token_status(&c, id), "Expired");
    assert_eq!(token_status(&c, id), verify_licence_status(&c, 2));

    let id2 = active(&mut c, 3);
    submit(&mut c, id2, 3);
    at(&creator(), 0, T0 + DAY);
    c.approve_render(sha(3));
    c.revoke_licence(U64(id2));
    assert_eq!(token_status(&c, id2), "Revoked");
    assert_eq!(token_status(&c, id2), verify_licence_status(&c, 3));
}

#[test]
fn enumeration_is_capped_at_fifty() {
    let mut c = world_with(3, 3 * NEAR, NEAR / 10, 3 * NEAR);
    for _ in 0..51 {
        active(&mut c, 3);
    }
    assert_eq!(c.nft_total_supply().0, 51);
    assert_eq!(c.nft_tokens(None, Some(100)).len(), 50);
    assert_eq!(c.nft_tokens(Some(U128(50)), Some(50)).len(), 1);
    assert_eq!(c.nft_tokens_for_owner(brand(), None, Some(1000)).len(), 50);
    assert_eq!(c.nft_tokens_for_owner(brand(), Some(U128(49)), None).len(), 2);
    assert_eq!(c.licences_for_creator(creator(), None, Some(1000)).len(), 50);
    assert_eq!(c.licences_for_brand(brand(), Some(50), None).len(), 1);
    assert_eq!(c.list_creators(None, Some(1000)).len(), 1);
}

/// The measured storage (`cargo test -- --nocapture measured_storage` prints it).
#[test]
fn measured_storage() {
    let mut c = world();
    let id = request(&mut c, 30, 3);
    let licence = logged_bytes("bytes stored");
    approve(&mut c, id);
    let mint = logged_bytes("token minted");
    submit(&mut c, id, 1);
    let receipt = logged_bytes("bytes stored");
    println!("MEASURED STORAGE: licence request {licence} B, mint {mint} B (reserve {MINT_RESERVE_BYTES} B), receipt {receipt} B");
    assert!(mint <= MINT_RESERVE_BYTES);
}
