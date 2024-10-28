library;

use ::stream::StreamData;
use std::storage::storage_vec::*;

abi Stream {
    #[storage(read, write), payable]
    fn create_stream(
        recipient: Identity,
        amount: u64,
        start_time: u64,
        end_time: u64,
    ) -> u64;

    #[storage(read, write)]
    fn claim(stream_id: u64);

    #[storage(read)]
    fn get_stream(stream_id: u64) -> StreamData;

    #[storage(read, write)]
    fn constructor(owner: Identity);

    #[storage(read)]
    fn get_streams(owner: Identity) -> Vec<u64>;

    fn now() -> u64;

    #[storage(read)]
    fn will_claim(stream_id: u64) -> (u64, u64);
}
