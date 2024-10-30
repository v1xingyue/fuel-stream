import { StreamDataOutput } from "./contract-types/FuelStream";
import { TOKENS } from "./config";
import { bn } from "fuels";
import { useEffect, useState } from "react";
import { FuelStream } from "./contract-types";
import { CONTRACT_ID } from "./config";
import { useWallet } from "@fuels/react";

interface StreamDetailProps {
  stream: StreamDataOutput;
  onBack: () => void;
}

const StreamDetail = ({ stream }: StreamDetailProps) => {
  const { wallet } = useWallet();
  const [currentTime, setCurrentTime] = useState<number>(
    Math.floor(Date.now() / 1000)
  );
  const [claimableAmount, setClaimableAmount] = useState<string>("0");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 获取代币信息
  const token = TOKENS.find((t) => t.id === stream.asset_id.bits) || {
    symbol: "Unknown",
    decimals: 9,
  };

  // 计算可领取的代币数量
  const calculateClaimableAmount = (now: number) => {
    const startTime = Number(stream.start_time);
    const endTime = Number(stream.end_time);
    const totalAmount = bn(stream.amount);

    if (now < startTime) return "0";
    if (now >= endTime) return formatAmount(stream.amount.toString());

    const totalDuration = endTime - startTime;
    const elapsedDuration = now - startTime;

    const claimable = totalAmount.mul(elapsedDuration).div(totalDuration);

    return formatAmount(claimable.toString());
  };

  // 设置轮询
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      setCurrentTime(now);
      setClaimableAmount(calculateClaimableAmount(now));
    }, 1000);

    return () => clearInterval(timer);
  });

  // 格式化代币金额
  const formatAmount = (amount: string) => {
    return bn(amount).format({
      precision: token.decimals,
      units: token.decimals,
    });
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  // 格式化地址显示
  const truncateAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleClaim = async () => {
    if (!wallet) return;

    try {
      setIsSubmitting(true);
      const contract = new FuelStream(CONTRACT_ID, wallet);
      const tx = await contract.functions.claim(stream.id).call();
      await tx.waitForResult();
      // TODO: 可以添加成功提示
      console.log("Claim successful");
    } catch (error) {
      console.error("Failed to claim:", error);
      // TODO: 可以添加错误提示
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card bg-base-100">
      <div className="card-body">
        <div className="space-y-6">
          {/* Stream ID */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 min-w-[120px]">Stream ID:</span>
            <span className="font-medium">{stream.id.toString()}</span>
          </div>

          {/* Token Info */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 min-w-[120px]">Token:</span>
            <span className="font-medium">{token.symbol}</span>
          </div>

          {/* Amount with formatted decimals */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 min-w-[120px]">Total Amount:</span>
            <span className="font-medium">
              {formatAmount(stream.amount.toString())} {token.symbol}
            </span>
          </div>

          {/* Sender Address */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 min-w-[120px]">From:</span>
            <span className="font-medium" title={stream.sender.Address?.bits}>
              {truncateAddress(stream.sender.Address?.bits || "")}
            </span>
          </div>

          {/* Time Range */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 min-w-[120px]">Start Time:</span>
            <span className="font-medium">
              {formatTime(Number(stream.start_time))}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-500 min-w-[120px]">End Time:</span>
            <span className="font-medium">
              {formatTime(Number(stream.end_time))}
            </span>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 min-w-[120px]">
              Status On Chain:
            </span>
            <span className="font-medium">{stream.status.toString()}</span>
          </div>

          {/* Current Chain Time */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 min-w-[120px]">Current Time:</span>
            <span className="font-medium">{formatTime(currentTime)}</span>
          </div>

          {/* Claimable Amount - 使用更大更醒目的样式 */}
          <div className="flex flex-col items-center justify-center py-8">
            <div className="text-2xl font-bold text-primary">
              {claimableAmount} {token.symbol}
            </div>
            <div className="text-sm text-gray-500 mt-2">available to claim</div>
          </div>

          {/* Progress Bar */}
          <div className="w-full">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-primary h-2.5 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(
                    ((currentTime - Number(stream.start_time)) /
                      (Number(stream.end_time) - Number(stream.start_time))) *
                      100,
                    100
                  )}%`,
                }}
              ></div>
            </div>
          </div>

          {/* Stream Status Indicator */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 min-w-[120px]">Stream Status:</span>
            <span
              className={`font-medium ${
                currentTime < Number(stream.start_time)
                  ? "text-warning"
                  : currentTime >= Number(stream.end_time)
                  ? "text-success"
                  : "text-primary"
              }`}
            >
              {currentTime < Number(stream.start_time)
                ? "Pending"
                : currentTime >= Number(stream.end_time)
                ? "Completed"
                : "Streaming"}
            </span>
          </div>

          {/* Claim Button Section */}
          <div className="flex flex-col items-center gap-4 pt-6">
            <button
              className={`
                btn btn-lg gap-2 min-w-[200px]
                ${
                  stream.status.toString() === "Claimed"
                    ? "btn-disabled bg-gray-500 border-gray-500 text-gray-300"
                    : currentTime < Number(stream.start_time)
                    ? "btn-warning"
                    : Number(claimableAmount) === 0
                    ? "btn-disabled"
                    : "btn-primary hover:btn-primary-focus"
                }
              `}
              onClick={handleClaim}
              disabled={
                isSubmitting ||
                currentTime < Number(stream.start_time) ||
                Number(claimableAmount) === 0 ||
                stream.status.toString() === "Claimed"
              }
            >
              {isSubmitting && (
                <span className="loading loading-spinner loading-sm"></span>
              )}
              {stream.status.toString() === "Claimed"
                ? "Already Claimed"
                : currentTime < Number(stream.start_time)
                ? "Not Started Yet"
                : Number(claimableAmount) === 0
                ? "Nothing to Claim"
                : isSubmitting
                ? "Claiming..."
                : "Claim Tokens"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreamDetail;
