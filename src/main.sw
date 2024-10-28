contract;

mod interface;
mod stream;

use std::{context::msg_amount, hash::Hash, storage::storage_string::*, string::String};
use std::array_conversions::{b256::*, u16::*, u256::*, u32::*, u64::*,};
use std::bytes_conversions::{b256::*, u64::*};
use std::{auth::msg_sender, hash::sha256, storage::storage_api::{read, write}};
use std::{
    asset::{
        burn,
        mint_to,
        transfer,
    },
    call_frames::msg_asset_id,
    context::this_balance,
    storage::storage_string::*,
};
use std::block::timestamp;
use interface::Stream;
use stream::StreamData;
use std::storage::storage_vec::*;
use sway_libs::{
    asset::{
        base::{
            _decimals,
            _name,
            _set_decimals,
            _set_name,
            _set_symbol,
            _symbol,
            _total_assets,
            _total_supply,
            SetAssetAttributes,
        },
        supply::{
            _burn,
            _mint,
        },
    },
    ownership::{
        _owner,
        initialize_ownership,
        only_owner,
    },
};

const TAI64_DIFFERENCE = 4611686018427387904;

storage {
    counter: u64 = 123,
    streams: StorageMap<u64, StreamData> = StorageMap {},
    incoming_streams: StorageMap<Identity, StorageVec<u64>> = StorageMap {},
}
impl Stream for Contract {
    #[storage(read, write), payable]
    fn create_stream(
        recipient: Identity,
        amount: u64,
        start_time: u64,
        end_time: u64,
    ) -> u64 {
        let v: u64 = storage.counter.read();
        let result: u64 = v + 1;
        storage.counter.write(v + 1);
        let asset_id = msg_asset_id();
        let sender = msg_sender().unwrap();
        let stream_data = StreamData {
            asset_id,
            sender,
            recipient,
            amount,
            start_time,
            end_time,
            claimed_amount: 0,
            claimed_time: start_time,
        };
        storage.streams.insert(v, stream_data);
        storage.incoming_streams.get(recipient).push(v);
        result
    }

    #[storage(read, write)]
    fn claim(stream_id: u64) {
        let mut stream_data = storage.streams.get(stream_id).read();
        let recipient = stream_data.recipient;
        let amount = stream_data.amount;
        let asset_id = stream_data.asset_id;
        let end_time = stream_data.end_time;

        let mut current_time: u64 = timestamp() - TAI64_DIFFERENCE;
        if (current_time > end_time) {
            current_time = end_time;
        }
        let time_elapsed = current_time - stream_data.claimed_time;
        let amount_per_interval = amount / (end_time - stream_data.claimed_time);
        let amount_to_send = time_elapsed * amount_per_interval;

        transfer(recipient, asset_id, amount_to_send);

        stream_data.claimed_amount += amount_to_send;
        stream_data.claimed_time = current_time;
        stream_data.amount = amount - amount_to_send;
        storage.streams.insert(stream_id, stream_data);
    }
    #[storage(read)]
    fn get_stream(stream_id: u64) -> StreamData {
        storage.streams.get(stream_id).read()
    }

    #[storage(read, write)]
    fn constructor(owner: Identity) {
        initialize_ownership(owner);
    }

    #[storage(read)]
    fn get_streams(owner: Identity) -> Vec<u64> {
        let mut result = Vec::new();
        let mut i = 0;
        while i < storage.incoming_streams.get(owner).len() {
            let id = storage.incoming_streams.get(owner).get(i).unwrap().read();
            result.push(id);
            i += 1;
        }
        result
    }

    #[storage(read)]
    fn will_claim(stream_id: u64) -> (u64, u64) {
        let mut stream_data = storage.streams.get(stream_id).read();
        let amount = stream_data.amount;
        let end_time = stream_data.end_time;
        let claimed_time = stream_data.claimed_time;

        let mut current_time: u64 = timestamp() - TAI64_DIFFERENCE;
        if (current_time > end_time) {
            current_time = end_time;
        }
        let time_elapsed = current_time - claimed_time;
        let amount_per_interval = amount / (end_time - claimed_time);
        let amount_to_send = time_elapsed * amount_per_interval;
        (amount_to_send, current_time)
    }

    fn now() -> u64 {
        timestamp() - TAI64_DIFFERENCE
    }
}
