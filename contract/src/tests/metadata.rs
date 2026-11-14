//! The token's computed metadata: the SVG image, the money in `extra` and licence_summary, and the
//! nft_metadata_update events. Nothing here is stored: statuses flip on read, with no write.

use super::*;
use near_sdk::serde_json::{self, Value};

pub fn unbase64(s: &str) -> Vec<u8> {
    const A: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = Vec::new();
    let (mut acc, mut bits) = (0u32, 0u32);
    for c in s.bytes().filter(|c| *c != b'=') {
        acc = acc << 6 | A.iter().position(|x| *x == c).expect("base64") as u32;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((acc >> bits) as u8);
        }
    }
    out
}

/// The token's SVG, decoded from its data URI, after checking media_hash = sha256 of exactly those bytes.
pub fn svg_of(c: &Contract, id: u64) -> String {
    let m = c.nft_token(id.to_string()).unwrap().metadata.unwrap();
    let uri = m.media.unwrap();
    let b64 = uri.strip_prefix("data:image/svg+xml;base64,").expect("an SVG data URI");
    let svg = unbase64(b64);
    assert_eq!(m.media_hash.unwrap().0, env::sha256(&svg), "media_hash is the sha256 of the SVG returned");
    String::from_utf8(svg).unwrap()
}

#[test]
fn media_hash_is_base64_sha256_in_json_per_nep177() {
    let mut c = world();
    let id = active(&mut c, 3);
    // What a wallet or indexer receives: the token as JSON.
    let j = serde_json::to_value(c.nft_token(id.to_string()).unwrap()).unwrap();
    let h = j["metadata"]["media_hash"].as_str().expect("media_hash is a JSON string");
    assert_eq!(h.len(), 44, "base64 of 32 bytes is 44 characters (hex would be 64): {h}");
    assert!(h.ends_with('=') && !h.chars().all(|c| c.is_ascii_hexdigit()), "base64, not hex: {h}");
    let media = j["metadata"]["media"].as_str().unwrap();
    let svg = unbase64(media.strip_prefix("data:image/svg+xml;base64,").unwrap());
    assert_eq!(unbase64(h), env::sha256(&svg), "decodes to the sha256 of the SVG bytes");
    // And the encoder agrees with standard base64 on a known vector.
    assert_eq!(crate::nft::base64(b"Many hands make light work."), "TWFueSBoYW5kcyBtYWtlIGxpZ2h0IHdvcmsu");
    assert_eq!(crate::nft::base64(b"ab"), "YWI=");
}

fn extra_of(c: &Contract, id: u64) -> Value {
    serde_json::from_str(&c.nft_token(id.to_string()).unwrap().metadata.unwrap().extra.unwrap()).unwrap()
}

fn update_event(id: u64) -> String {
    format!(r#"EVENT_JSON:{{"standard":"nep171","version":"1.2.0","event":"nft_metadata_update","data":[{{"token_ids":["{id}"]}}]}}"#)
}

#[test]
fn the_svg_is_small_plain_and_shows_the_licence() {
    let mut c = world();
    let id = active(&mut c, 3);
    let svg = svg_of(&c, id);
    assert!(svg.len() < 2048, "{} bytes", svg.len());
    assert!(svg.starts_with("<svg xmlns=\"http://www.w3.org/2000/svg\""));
    assert!(
        !svg.contains("href") && !svg.contains("@import") && !svg.contains("<image") && !svg.contains("url("),
        "no external fonts or images"
    );
    for want in [
        format!("Likeness licence #{id}"),
        creator().to_string(),
        brand().to_string(),
        "Fitness".into(),
        "0 used of 3".into(),
        "0 NEAR".into(),
        "ACTIVE".into(),
        "#1f8a3b".into(),
    ] {
        assert!(svg.contains(&want), "svg has {want:?}: {svg}");
    }
}

#[test]
fn the_svg_flips_to_revoked_and_to_expired_with_no_write() {
    let mut c = world();
    let a = active(&mut c, 3);
    let b = active(&mut c, 3);
    at(&creator(), 0, T0 + DAY);
    c.revoke_licence(U64(a));
    let svg = svg_of(&c, a);
    assert!(svg.contains("REVOKED") && svg.contains("#c62828") && !svg.contains("ACTIVE"));
    // No call at all: only the clock moves past b's 30 days, and its image says EXPIRED.
    at(&stranger(), 0, T0 + 31 * DAY);
    let svg = svg_of(&c, b);
    assert!(svg.contains("EXPIRED") && svg.contains("#6b6b6b") && !svg.contains("ACTIVE"), "{svg}");
    assert_eq!(extra_of(&c, b)["status"], "Expired");
    // The revoked one stays a token, as history.
    assert!(svg_of(&c, a).contains("REVOKED"));
}

#[test]
fn the_svg_says_exhausted_when_every_render_is_used() {
    let mut c = world();
    let id = active(&mut c, 1);
    submit(&mut c, id, 1);
    at(&creator(), 0, T0 + DAY);
    c.approve_render(sha(1));
    let svg = svg_of(&c, id);
    assert!(svg.contains("EXHAUSTED") && svg.contains("1 used of 1") && svg.contains("0.05 NEAR"), "{svg}");
}

#[test]
fn the_summary_and_extra_add_up() {
    let mut c = world();
    let id = active(&mut c, 3);
    let s = c.licence_summary(U64(id)).unwrap();
    assert_eq!((s.renders_used, s.renders_reserved, s.renders_left, s.paid_to_creator.0, s.reserved.0), (0, 0, 3, 0, 0));
    submit(&mut c, id, 1);
    submit(&mut c, id, 2);
    at(&creator(), 0, T0 + DAY);
    c.approve_render(sha(1));
    let s = c.licence_summary(U64(id)).unwrap();
    assert_eq!(s.price_per_render.0, PRICE);
    assert_eq!((s.renders_used, s.renders_reserved, s.renders_left), (1, 1, 1));
    assert_eq!(s.paid_to_creator.0, PRICE);
    assert_eq!(s.reserved.0, PRICE);
    assert_eq!(s.refundable_on_end.0, PRICE);
    assert_eq!(s.token_id.as_deref(), Some(id.to_string().as_str()));
    let e = extra_of(&c, id);
    assert_eq!(e["paid_to_creator"], PRICE.to_string());
    assert_eq!(e["reserved"], PRICE.to_string());
    assert_eq!(e["refundable_on_end"], PRICE.to_string());
    assert_eq!(e["renders_reserved"], 1);
    // The brand's own books agree: the reserved price is in its reservation.
    assert!(brand_of(&c).reserved.0 >= PRICE);
    // Revoking releases the waiting ad: nothing reserved any more, nothing left to refund, the payment stays.
    c.revoke_licence(U64(id));
    let s = c.licence_summary(U64(id)).unwrap();
    assert_eq!((s.reserved.0, s.refundable_on_end.0, s.paid_to_creator.0, s.renders_reserved), (0, 0, PRICE, 0));
    assert!(c.licence_summary(U64(999)).is_none());
}

#[test]
fn a_pending_licence_has_a_summary_but_no_token() {
    let mut c = world();
    let id = request(&mut c, 30, 3);
    let s = c.licence_summary(U64(id)).unwrap();
    assert!(s.token_id.is_none());
    assert_eq!(serde_json::to_value(s.status).unwrap(), "Pending");
    assert!(c.nft_token(id.to_string()).is_none());
}

#[test]
fn every_change_logs_nft_metadata_update() {
    let mut c = world();
    let id = request(&mut c, 30, 3);
    approve(&mut c, id);
    assert!(get_logs().contains(&update_event(id)), "approve_licence: {:?}", get_logs());

    submit(&mut c, id, 1);
    assert!(!get_logs().contains(&update_event(id)), "submit_render changes no token field shown as paid");
    at(&creator(), 0, T0 + DAY);
    c.approve_render(sha(1));
    assert!(get_logs().contains(&update_event(id)), "approve_render: {:?}", get_logs());

    at(&creator(), 0, T0 + DAY);
    c.revoke_licence(U64(id));
    assert!(get_logs().contains(&update_event(id)), "revoke_licence: {:?}", get_logs());

    let other = active(&mut c, 3);
    submit(&mut c, other, 2);
    at(&stranger(), 0, T0 + 31 * DAY);
    assert_eq!(c.release_expired(U64(other)), 1);
    assert!(get_logs().contains(&update_event(other)), "release_expired: {:?}", get_logs());
}

#[test]
fn near_amounts_read_well() {
    use crate::nft::near_text;
    assert_eq!(near_text(0), "0 NEAR");
    assert_eq!(near_text(NEAR / 25), "0.04 NEAR");
    assert_eq!(near_text(NEAR + NEAR / 2), "1.5 NEAR");
    assert_eq!(near_text(3 * NEAR), "3 NEAR");
}
