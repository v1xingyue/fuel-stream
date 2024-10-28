library;

pub struct StreamData {
    pub asset_id: AssetId,
    pub sender: Identity,
    pub recipient: Identity,
    pub amount: u64,
    pub claimed_amount: u64,
    pub claimed_time: u64,
    pub start_time: u64,
    pub end_time: u64
}
