//! Upgrade safety: the NEW code reads state the OLD code wrote. The fixture (onchain_state.rs) is the contract's whole
//! storage on testnet before this upgrade, byte for byte; it is written into the test VM's storage as-is, the contract
//! is read from the "STATE" key exactly as a deployed method would, and every licence, token and receipt is read back.

use super::metadata::svg_of;
use super::onchain_state::{BLOCK, ENTRIES};
use super::*;
use near_sdk::borsh;
use near_sdk::serde_json;

/// 14 Nov 2026, shortly after the snapshot (every licence on it was issued before this).
const SNAPSHOT_NS: u64 = 1_794_668_050_000 * 1_000_000;

fn unhex(s: &str) -> Vec<u8> {
    (0..s.len()).step_by(2).map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap()).collect()
}

/// The old code's bytes, loaded into storage, read with the new code's types.
fn load(t: u64) -> Contract {
    at(&stranger(), 0, t);
    for (k, v) in ENTRIES {
        env::storage_write(&unhex(k), &unhex(v));
    }
    env::state_read::<Contract>().expect("the old STATE record deserializes with the new Contract type")
}

fn status_str<T: near_sdk::serde::Serialize>(s: T) -> String {
    serde_json::to_value(s).unwrap().as_str().unwrap().to_string()
}

#[test]
fn the_new_code_reads_every_record_the_old_code_wrote() {
    let c = load(SNAPSHOT_NS);
    assert_eq!(c.owner_id().as_str(), "likeness-near-rohit.testnet");
    let n = c.next_licence_id;
    assert!(n >= 3, "three licences on testnet at block {BLOCK}");
    assert_eq!(c.nft_total_supply().0, 3);
    for id in 0..n {
        let l = c.get_licence(U64(id)).unwrap_or_else(|| panic!("licence {id} reads"));
        let s = c.licence_summary(U64(id)).unwrap();
        assert_eq!((s.renders_used, s.renders_reserved, s.render_cap), (l.renders_used, l.renders_reserved, l.render_cap));
        assert_eq!(s.paid_to_creator.0, l.price.0 * l.renders_used as u128);
        assert_eq!(status_str(s.status), status_str(l.status));
        if l.token_id.is_some() {
            let svg = svg_of(&c, id);
            let label = status_str(l.status).to_uppercase();
            assert!(svg.contains(&label) && svg.contains(&format!("Likeness licence #{id}")), "token {id}: {svg}");
            assert!(svg.len() < 2048);
        }
    }
    // The receipts the old code wrote still verify; the first ad's licence (0) was revoked.
    let v = c.verify("cb3c711510d2280036121a4df1de7bea7a4f7f2739877e568226c029e6b2ff9a".into());
    assert_eq!(status_str(v.verdict), "Revoked");
    assert_eq!(v.token_id.as_deref(), Some("0"));
    assert_eq!(status_str(v.receipt.unwrap().status), "Approved");
    assert!(svg_of(&c, 0).contains("REVOKED"));
}

#[test]
fn the_old_records_round_trip_byte_for_byte() {
    // Every stored value decodes with the new types and re-encodes to the exact same bytes.
    load(SNAPSHOT_NS);
    for (k, v) in ENTRIES {
        let (key, val) = (unhex(k), unhex(v));
        let again = match key[0] {
            _ if key == b"STATE" => borsh::to_vec(&borsh::from_slice::<Contract>(&val).unwrap()).unwrap(),
            0 => borsh::to_vec(&borsh::from_slice::<Creator>(&val).unwrap()).unwrap(),
            1 => borsh::to_vec(&borsh::from_slice::<AccountId>(&val).unwrap()).unwrap(),
            2 => borsh::to_vec(&borsh::from_slice::<Brand>(&val).unwrap()).unwrap(),
            3 => borsh::to_vec(&borsh::from_slice::<Licence>(&val).unwrap()).unwrap(),
            4 => borsh::to_vec(&borsh::from_slice::<u32>(&val).unwrap()).unwrap(),
            5 | 6 => borsh::to_vec(&borsh::from_slice::<u64>(&val).unwrap()).unwrap(),
            7 => borsh::to_vec(&borsh::from_slice::<Receipt>(&val).unwrap()).unwrap(),
            8 => borsh::to_vec(&borsh::from_slice::<u128>(&val).unwrap()).unwrap(),
            p => panic!("unknown storage prefix {p}"),
        };
        assert_eq!(again, val, "key {k}");
    }
}

#[test]
fn an_old_active_token_flips_to_expired_on_read() {
    // Far past every licence's end: no write, and each un-revoked token now reads Expired.
    let c = load(SNAPSHOT_NS + 400 * DAY);
    for id in 0..c.next_licence_id {
        if let Some(l) = c.get_licence(U64(id)) {
            if l.token_id.is_some() {
                let want = if status_str(l.state) == "Revoked" { "REVOKED" } else { "EXPIRED" };
                assert!(svg_of(&c, id).contains(want), "token {id}");
            }
        }
    }
}
