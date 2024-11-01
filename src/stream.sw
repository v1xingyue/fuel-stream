library;

pub enum StreamStatus {
    Paused: (),
    Active: (),
    Completed: (),
    Cancelled: (),
}

pub struct StreamData {
    pub id: u64,
    pub asset_id: AssetId,
    pub sender: Identity,
    pub recipient: Identity,
    pub amount: u64,
    pub claimed_amount: u64,
    pub claimed_time: u64,
    pub paused_at: u64,
    pub start_time: u64,
    pub end_time: u64,
    pub status: StreamStatus,
}
