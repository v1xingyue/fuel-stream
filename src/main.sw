contract;

mod stream;
mod interface;

use interface::Stream;
use interface::StreamDisplay;
use stream::{StreamData, StreamStatus};

use std::{
    array_conversions::{
        b256::*,
        u16::*,
        u256::*,
        u32::*,
        u64::*,
    },
    assert::assert,
    asset::{
        burn,
        mint_to,
        transfer,
    },
    auth::msg_sender,
    block::timestamp,
    bytes_conversions::{
        b256::*,
        u64::*,
    },
    call_frames::msg_asset_id,
    context::msg_amount,
    context::this_balance,
    hash::Hash,
    storage::{
        storage_api::{
            read,
            write,
        },
        storage_string::*,
        storage_vec::*,
    },
    string::String,
};

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
    outgoing_streams: StorageMap<Identity, StorageVec<u64>> = StorageMap {},
    registered_tokens: StorageVec<AssetId> = StorageVec {},
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
            id: v,
            asset_id,
            sender,
            recipient,
            amount,
            start_time,
            end_time,
            claimed_amount: 0,
            claimed_time: start_time,
            paused_at: 0,
            status: StreamStatus::Active,
        };
        storage.streams.insert(v, stream_data);
        storage.incoming_streams.get(recipient).push(v);
        storage.outgoing_streams.get(sender).push(v);
        result
    }

    #[storage(read, write)]
    fn claim(stream_id: u64) {
        let mut stream_data = storage.streams.get(stream_id).read();
        match stream_data.status {
            StreamStatus::Active => (),
            _ => assert(false),
        }
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
        if (stream_data.amount == 0) {
            stream_data.status = StreamStatus::Completed;
        }
        storage.streams.insert(stream_id, stream_data);
    }

    #[storage(read, write)]
    fn constructor(owner: Identity) {
        initialize_ownership(owner);
    }

    #[storage(read, write)]
    fn pause(stream_id: u64) {
        let mut stream_data = storage.streams.get(stream_id).read();
        let mut current_time: u64 = timestamp() - TAI64_DIFFERENCE;
        let end_time = stream_data.end_time;
        match stream_data.status {
            StreamStatus::Active => (),
            _ => assert(false),
        }
        assert(current_time < end_time);
        let sender = msg_sender().unwrap();
        assert(stream_data.sender == sender);
        let amount = stream_data.amount;

        // transfer token 
        let time_elapsed = current_time - stream_data.claimed_time;
        let amount_per_interval = amount / (end_time - stream_data.claimed_time);
        let amount_to_send = time_elapsed * amount_per_interval;
        let recipient = stream_data.recipient;
        let asset_id = stream_data.asset_id;
        transfer(recipient, asset_id, amount_to_send);

        stream_data.claimed_amount += amount_to_send;
        stream_data.claimed_time = current_time;
        stream_data.amount = amount - amount_to_send;

        stream_data.paused_at = current_time;
        stream_data.status = StreamStatus::Paused;
        storage.streams.insert(stream_id, stream_data);
    }

    #[storage(read, write)]
    fn resume(stream_id: u64) {
        let mut stream_data = storage.streams.get(stream_id).read();
        match stream_data.status {
            StreamStatus::Paused => (),
            _ => assert(false),
        }
        let sender = msg_sender().unwrap();
        assert(stream_data.sender == sender);

        let mut current_time: u64 = timestamp() - TAI64_DIFFERENCE;

        stream_data.claimed_time = current_time;
        stream_data.end_time = stream_data.end_time + (current_time - stream_data.paused_at);

        stream_data.paused_at = 0;
        stream_data.status = StreamStatus::Active;
        storage.streams.insert(stream_id, stream_data);
    }

    #[storage(read, write)]
    fn cancel(stream_id: u64) {
        let mut stream_data = storage.streams.get(stream_id).read();
        match stream_data.status {
            StreamStatus::Active => (),
            StreamStatus::Paused => (),
            _ => assert(false),
        }

        let sender = msg_sender().unwrap();
        assert(stream_data.sender == sender);

        let mut current_time: u64 = timestamp() - TAI64_DIFFERENCE;
        let end_time = stream_data.end_time;
        if (current_time > end_time) {
            current_time = end_time;
        }
        let amount = stream_data.amount;

        // transfer token 
        let time_elapsed = current_time - stream_data.claimed_time;
        let amount_per_interval = amount / (end_time - stream_data.claimed_time);
        let amount_to_send = time_elapsed * amount_per_interval;
        let recipient = stream_data.recipient;
        let sender = stream_data.sender;
        let asset_id = stream_data.asset_id;

        transfer(recipient, asset_id, amount_to_send);
        transfer(sender, asset_id, amount - amount_to_send);

        stream_data.status = StreamStatus::Cancelled;
        stream_data.claimed_amount += amount_to_send;
        stream_data.claimed_time = current_time;
        stream_data.amount = 0;

        storage.streams.insert(stream_id, stream_data);
    }

    #[storage(read, write)]
    fn register_token(token: AssetId) {
        assert(false);
    }
}

impl StreamDisplay for Contract {
    #[storage(read)]
    fn get_stream(stream_id: u64) -> StreamData {
        storage.streams.get(stream_id).read()
    }
    #[storage(read)]
    fn get_incoming_streams(owner: Identity) -> Vec<StreamData> {
        let mut result = Vec::new();
        let mut i = 0;
        while i < storage.incoming_streams.get(owner).len() {
            let id = storage.incoming_streams.get(owner).get(i).unwrap().read();
            let stream_data = storage.streams.get(id).read();
            result.push(stream_data);
            i += 1;
        }
        result
    }
    #[storage(read)]
    fn get_outgoing_streams(owner: Identity) -> Vec<StreamData> {
        let mut result = Vec::new();
        let mut i = 0;
        while i < storage.outgoing_streams.get(owner).len() {
            let id = storage.outgoing_streams.get(owner).get(i).unwrap().read();
            let stream_data = storage.streams.get(id).read();
            result.push(stream_data);
            i += 1;
        }
        result
    }
    #[storage(read)]
    fn will_claim(stream_id: u64) -> (u64, u64) {
        let mut stream_data = storage.streams.get(stream_id).read();
        let end_time = stream_data.end_time;
        let mut current_time: u64 = timestamp() - TAI64_DIFFERENCE;
        if (current_time > end_time) {
            current_time = end_time;
        }
        match stream_data.status {
            StreamStatus::Paused => (0, current_time),
            _ => {
                let amount = stream_data.amount;
                let claimed_time = stream_data.claimed_time;
                let time_elapsed = current_time - claimed_time;
                let amount_per_interval = amount / (end_time - claimed_time);
                let amount_to_send = time_elapsed * amount_per_interval;
                (amount_to_send, current_time)
            },
        }
    }
    fn now() -> u64 {
        timestamp() - TAI64_DIFFERENCE
    }
}
